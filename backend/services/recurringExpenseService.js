const db = require('../db');

class RecurringExpenseService {
  /**
   * Add a recurring expense
   */
  async addRecurringExpense(userId, expenseData) {
    const { amount, category, description, frequency, start_date, end_date } = expenseData;

    if (!amount || isNaN(parseFloat(amount))) {
      throw new Error('Invalid amount');
    }
    if (!category) {
      throw new Error('Category required');
    }
    if (!frequency) {
      throw new Error('Frequency required');
    }

    const startDate = start_date ? new Date(start_date) : new Date();
    const endDate = end_date ? new Date(end_date) : null;
    const nextDueDate = this.calculateNextDueDate(startDate, frequency);

    return new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO recurring_expenses (user_id, amount, category, description, frequency, start_date, end_date, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, parseFloat(amount).toFixed(2), category, description, frequency, startDate.toISOString().slice(0, 19).replace('T', ' '), endDate ? endDate.toISOString().slice(0, 19).replace('T', ' ') : null, nextDueDate.toISOString().slice(0, 19).replace('T', ' ')],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to add recurring expense: ${err.message}`));
            return;
          }
          resolve({ id: result.insertId, message: 'Recurring expense added successfully' });
        }
      );
    });
  }

  /**
   * Get all recurring expenses for a user
   */
  async getRecurringExpenses(userId) {
    return new Promise((resolve, reject) => {
      db.query(
        'SELECT * FROM recurring_expenses WHERE user_id = ? AND is_active = TRUE ORDER BY next_due_date ASC',
        [userId],
        (err, results) => {
          if (err) {
            reject(new Error(`Failed to get recurring expenses: ${err.message}`));
            return;
          }
          resolve(results);
        }
      );
    });
  }

  /**
   * Update a recurring expense
   */
  async updateRecurringExpense(userId, expenseId, expenseData) {
    const { amount, category, description, frequency, start_date, end_date, is_active } = expenseData;

    return new Promise((resolve, reject) => {
      db.query(
        'UPDATE recurring_expenses SET amount=?, category=?, description=?, frequency=?, start_date=?, end_date=?, is_active=? WHERE id=? AND user_id=?',
        [amount, category, description, frequency, start_date, end_date, is_active, expenseId, userId],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to update recurring expense: ${err.message}`));
            return;
          }
          if (result.affectedRows === 0) {
            reject(new Error('Recurring expense not found or unauthorized'));
            return;
          }
          resolve({ message: 'Recurring expense updated successfully' });
        }
      );
    });
  }

  /**
   * Delete a recurring expense
   */
  async deleteRecurringExpense(userId, expenseId) {
    return new Promise((resolve, reject) => {
      db.query(
        'DELETE FROM recurring_expenses WHERE id=? AND user_id=?',
        [expenseId, userId],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to delete recurring expense: ${err.message}`));
            return;
          }
          if (result.affectedRows === 0) {
            reject(new Error('Recurring expense not found or unauthorized'));
            return;
          }
          resolve({ message: 'Recurring expense deleted successfully' });
        }
      );
    });
  }

  /**
   * Get total recurring expenses amount
   */
  async getTotalRecurring(userId) {
    return new Promise((resolve, reject) => {
      db.query(
        'SELECT SUM(amount) as total FROM recurring_expenses WHERE user_id = ? AND is_active = TRUE',
        [userId],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to get total recurring: ${err.message}`));
            return;
          }
          resolve({ total: result[0].total || 0 });
        }
      );
    });
  }

  /**
   * Calculate next due date based on frequency
   */
  calculateNextDueDate(startDate, frequency) {
    const date = new Date(startDate);

    switch (frequency.toLowerCase()) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1); // Default to monthly
    }

    return date;
  }

  /**
   * Process due recurring expenses (to be called by cron job)
   */
  async processDueExpenses(userId) {
    const now = new Date();

    return new Promise((resolve, reject) => {
      db.query(
        'SELECT * FROM recurring_expenses WHERE user_id = ? AND next_due_date <= ? AND is_active = TRUE',
        [userId, now.toISOString().slice(0, 19).replace('T', ' ')],
        async (err, dueExpenses) => {
          if (err) {
            reject(new Error(`Failed to get due expenses: ${err.message}`));
            return;
          }

          const processed = [];

          for (const expense of dueExpenses) {
            try {
              // Add to regular expenses
              await this.addToExpenses(userId, expense);

              // Update next due date
              const nextDue = this.calculateNextDueDate(expense.next_due_date, expense.frequency);
              await this.updateNextDueDate(expense.id, nextDue);

              processed.push(expense);
            } catch (error) {
              console.error(`Failed to process recurring expense ${expense.id}:`, error);
            }
          }

          resolve(processed);
        }
      );
    });
  }

  /**
   * Add recurring expense to regular expenses table
   */
  async addToExpenses(userId, recurringExpense) {
    return new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
        [userId, recurringExpense.amount, recurringExpense.category, `${recurringExpense.description} (Recurring)`, recurringExpense.next_due_date],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to add to expenses: ${err.message}`));
            return;
          }
          resolve(result);
        }
      );
    });
  }

  /**
   * Update next due date
   */
  async updateNextDueDate(expenseId, nextDueDate) {
    return new Promise((resolve, reject) => {
      db.query(
        'UPDATE recurring_expenses SET next_due_date = ? WHERE id = ?',
        [nextDueDate.toISOString().slice(0, 19).replace('T', ' '), expenseId],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to update next due date: ${err.message}`));
            return;
          }
          resolve(result);
        }
      );
    });
  }
}

module.exports = new RecurringExpenseService();