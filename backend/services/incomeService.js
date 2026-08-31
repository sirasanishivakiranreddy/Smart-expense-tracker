const db = require('../db');

class IncomeService {
  /**
   * Add income entry
   */
  async addIncome(userId, incomeData) {
    const { amount, source, description, date } = incomeData;

    if (!amount || isNaN(parseFloat(amount))) {
      throw new Error('Invalid amount');
    }
    if (!source) {
      throw new Error('Income source required');
    }

    const d = date ? new Date(date) : new Date();
    const dbDate = d.toISOString().slice(0, 19).replace('T', ' ');

    return new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO income (user_id, amount, source, description, date) VALUES (?, ?, ?, ?, ?)',
        [userId, parseFloat(amount).toFixed(2), source, description, dbDate],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to add income: ${err.message}`));
            return;
          }
          resolve({ id: result.insertId, message: 'Income added successfully' });
        }
      );
    });
  }

  /**
   * Get all income entries for a user
   */
  async getIncome(userId) {
    return new Promise((resolve, reject) => {
      db.query(
        'SELECT * FROM income WHERE user_id = ? ORDER BY date DESC',
        [userId],
        (err, results) => {
          if (err) {
            reject(new Error(`Failed to get income: ${err.message}`));
            return;
          }
          resolve(results);
        }
      );
    });
  }

  /**
   * Delete income entry
   */
  async deleteIncome(userId, incomeId) {
    return new Promise((resolve, reject) => {
      db.query(
        'DELETE FROM income WHERE id=? AND user_id=?',
        [incomeId, userId],
        (err, result) => {
          if (err) {
            reject(new Error(`Failed to delete income: ${err.message}`));
            return;
          }
          if (result.affectedRows === 0) {
            reject(new Error('Income entry not found or unauthorized'));
            return;
          }
          resolve({ message: 'Income deleted successfully' });
        }
      );
    });
  }

  /**
   * Get income statistics
   */
  async getIncomeStats(userId) {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as totalIncome, SUM(amount) as totalAmount FROM income WHERE user_id = ?',
        'SELECT source, SUM(amount) as total FROM income WHERE user_id = ? GROUP BY source ORDER BY total DESC',
        'SELECT AVG(amount) as avgAmount FROM income WHERE user_id = ?'
      ];

      const results = {};

      let completed = 0;
      queries.forEach((query, index) => {
        db.query(query, [userId], (err, result) => {
          if (err) {
            reject(new Error(`Failed to get income stats: ${err.message}`));
            return;
          }

          if (index === 0) {
            results.totalIncome = result[0].totalIncome;
            results.totalAmount = result[0].totalAmount || 0;
          } else if (index === 1) {
            results.sourceBreakdown = result;
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

module.exports = new IncomeService();