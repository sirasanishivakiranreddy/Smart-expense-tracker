const db = require('../db');

class ExpenseService {
  /**
   * Add a new expense
   */
  async addExpense(userId, expenseData) {
    const { amount, category, description, date } = expenseData;

    if (!amount || isNaN(parseFloat(amount))) {
      throw new Error('Invalid amount');
    }
    if (!description) {
      throw new Error('Description required');
    }

    const d = date ? new Date(date) : new Date();
    const dbDate = d.toISOString().slice(0, 19).replace('T', ' ');

    return new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
        [userId, parseFloat(amount).toFixed(2), category, description, dbDate],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to add expense: ${err.message}`));
            return;
          }
          resolve({ id: result.insertId, message: 'Expense added successfully' });
        }
      );
    });
  }

  /**
   * Get all expenses for a user
   */
  async getExpenses(userId) {
    return new Promise((resolve, reject) => {
      db.query(
        'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC',
        [userId],
        (err, results) => {
          if (err) {
            reject(new Error(`Failed to get expenses: ${err.message}`));
            return;
          }
          resolve(results);
        }
      );
    });
  }

  /**
   * Update an expense
   */
  async updateExpense(userId, expenseId, expenseData) {
    const { amount, category, description, date } = expenseData;

    return new Promise((resolve, reject) => {
      db.query(
        'UPDATE expenses SET amount=?, category=?, description=?, date=? WHERE id=? AND user_id=?',
        [amount, category, description, date, expenseId, userId],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to update expense: ${err.message}`));
            return;
          }
          if (result.affectedRows === 0) {
            reject(new Error('Expense not found or unauthorized'));
            return;
          }
          resolve({ message: 'Expense updated successfully' });
        }
      );
    });
  }

  /**
   * Delete an expense
   */
  async deleteExpense(userId, expenseId) {
    return new Promise((resolve, reject) => {
      db.query(
        'DELETE FROM expenses WHERE id=? AND user_id=?',
        [expenseId, userId],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to delete expense: ${err.message}`));
            return;
          }
          if (result.affectedRows === 0) {
            reject(new Error('Expense not found or unauthorized'));
            return;
          }
          resolve({ message: 'Expense deleted successfully' });
        }
      );
    });
  }

  /**
   * Get expense statistics
   */
  async getExpenseStats(userId) {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as totalExpenses, SUM(amount) as totalAmount FROM expenses WHERE user_id = ?',
        'SELECT category, SUM(amount) as total FROM expenses WHERE user_id = ? GROUP BY category ORDER BY total DESC',
        'SELECT AVG(amount) as avgAmount FROM expenses WHERE user_id = ?'
      ];

      const results = {};

      let completed = 0;
      queries.forEach((query, index) => {
        db.query(query, [userId], (err, result) => {
          if (err) {
            reject(new Error(`Failed to get stats: ${err.message}`));
            return;
          }

          if (index === 0) {
            results.totalExpenses = result[0].totalExpenses;
            results.totalAmount = result[0].totalAmount || 0;
          } else if (index === 1) {
            results.categoryBreakdown = result;
          } else if (index === 2) {
            results.avgAmount = result[0].avgAmount || 0;
          }

          completed++;
          if (completed === queries.length) {
            resolve(results);
          }
        });
      });
    });
  }
}

module.exports = new ExpenseService();