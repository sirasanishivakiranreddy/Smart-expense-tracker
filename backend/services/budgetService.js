const db = require('../db');

class BudgetService {
  /**
   * Set or update a budget for a category
   */
  async setBudget(userId, budgetData) {
    const { category, monthly_limit } = budgetData;

    if (!category || !monthly_limit || isNaN(parseFloat(monthly_limit))) {
      throw new Error('Invalid budget data');
    }

    return new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE monthly_limit = ?',
        [userId, category, parseFloat(monthly_limit).toFixed(2), parseFloat(monthly_limit).toFixed(2)],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to set budget: ${err.message}`));
            return;
          }
          resolve({ message: 'Budget set successfully' });
        }
      );
    });
  }

  /**
   * Get all budgets for a user
   */
  async getBudgets(userId) {
    return new Promise((resolve, reject) => {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

      db.query(
        `SELECT
          b.id,
          b.category,
          b.monthly_limit,
          COALESCE(SUM(e.amount), 0) AS spent,
          (b.monthly_limit - COALESCE(SUM(e.amount), 0)) AS remaining
        FROM budgets b
        LEFT JOIN expenses e ON b.user_id = e.user_id
          AND b.category = e.category
          AND DATE_FORMAT(e.date, '%Y-%m') = ?
        WHERE b.user_id = ?
        GROUP BY b.id, b.category, b.monthly_limit
        ORDER BY b.category ASC`,
        [currentMonth, userId],
        (err, results) => {
          if (err) {
            reject(new Error(`Failed to get budgets: ${err.message}`));
            return;
          }
          resolve(results);
        }
      );
    });
  }

  /**
   * Delete a budget by id for a user
   */
  async deleteBudget(userId, budgetId) {
    if (!budgetId) {
      throw new Error('Budget ID is required');
    }

    return new Promise((resolve, reject) => {
      db.query(
        'DELETE FROM budgets WHERE id = ? AND user_id = ?',
        [budgetId, userId],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to delete budget: ${err.message}`));
            return;
          }

          if (!result.affectedRows) {
            reject(new Error('Budget not found'));
            return;
          }

          resolve({ message: 'Budget deleted successfully' });
        }
      );
    });
  }

  /**
   * Get budget vs actual spending comparison
   */
  async getBudgetComparison(userId) {
    return new Promise((resolve, reject) => {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

      db.query(`
        SELECT
          b.category,
          b.monthly_limit as budget,
          COALESCE(SUM(e.amount), 0) as spent,
          (COALESCE(SUM(e.amount), 0) / b.monthly_limit * 100) as percentage
        FROM budgets b
        LEFT JOIN expenses e ON b.user_id = e.user_id
          AND b.category = e.category
          AND DATE_FORMAT(e.date, '%Y-%m') = ?
        WHERE b.user_id = ?
        GROUP BY b.category, b.monthly_limit
      `, [currentMonth, userId], (err, results) => {
        if (err) {
          reject(new Error(`Failed to get budget comparison: ${err.message}`));
          return;
        }
        resolve(results);
      });
    });
  }
}

module.exports = new BudgetService();