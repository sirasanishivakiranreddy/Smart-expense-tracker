const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const alertService = require('../services/alertService');
const db = require('../db');

/**
 * GET /api/alerts/preferences
 * Get alert preferences for logged-in user
 */
router.get('/preferences', auth, async (req, res) => {
  try {
    const preferences = await alertService.getAlertPreferences(req.user.id);
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching alert preferences:', error.message);
    res.status(500).json({ error: 'Failed to fetch alert preferences' });
  }
});

/**
 * POST /api/alerts/preferences
 * Update alert preferences for logged-in user
 */
router.post('/preferences', auth, async (req, res) => {
  try {
    const result = await alertService.updateAlertPreferences(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating alert preferences:', error.message);
    res.status(500).json({ error: 'Failed to update alert preferences' });
  }
});

/**
 * POST /api/alerts/test
 * Send a test email to verify configuration
 */
router.post('/test', auth, async (req, res) => {
  try {
    const { sendBudgetExceededAlert } = require('../utils/sendEmail');
    
    // Get user email
    db.query(
      'SELECT email, name FROM users WHERE id = ?',
      [req.user.id],
      async (err, results) => {
        if (err || !results.length) {
          return res.status(500).json({ error: 'User not found' });
        }

        const user = results[0];
        
        // Send test email
        await sendBudgetExceededAlert(user.email, {
          category: 'Test Category',
          budgetLimit: 10000,
          currentSpent: 8500,
          overage: 0,
          percentageOver: 85,
          isWarning: true
        });

        res.json({ 
          message: 'Test email sent successfully!',
          email: user.email 
        });
      }
    );
  } catch (error) {
    console.error('Error sending test email:', error.message);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * POST /api/alerts/trigger-budget-check
 * Manually trigger budget check for all categories
 */
router.post('/trigger-budget-check', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user info
    db.query(
      'SELECT email, name FROM users WHERE id = ?',
      [userId],
      async (err, userResults) => {
        if (err || !userResults.length) {
          return res.status(500).json({ error: 'User not found' });
        }

        const user = userResults[0];

        // Get all budgets for user
        db.query(
          'SELECT * FROM budgets WHERE user_id = ?',
          [userId],
          async (err, budgets) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to fetch budgets' });
            }

            let alertsSent = 0;

            for (const budget of budgets) {
              // Get current spending for this category this month
              const currentDate = new Date();
              const month = String(currentDate.getMonth() + 1).padStart(2, '0');
              const year = currentDate.getFullYear();

              db.query(
                `SELECT SUM(amount) as total FROM expenses 
                 WHERE user_id = ? AND category = ? AND YEAR(date) = ? AND MONTH(date) = ?`,
                [userId, budget.category, year, month],
                async (err, spending) => {
                  if (err) {
                    console.error('Error fetching spending:', err);
                    return;
                  }

                  const currentSpent = spending[0]?.total || 0;

                  // Check and send alert if needed
                  await alertService.checkBudgetAndAlert(
                    userId,
                    budget.category,
                    currentSpent,
                    budget.monthly_limit,
                    user.email
                  );

                  alertsSent++;
                }
              );
            }

            res.json({
              message: `Budget check triggered. ${alertsSent} categories checked.`,
              budgetsChecked: budgets.length
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error triggering budget check:', error.message);
    res.status(500).json({ error: 'Failed to trigger budget check' });
  }
});

/**
 * POST /api/alerts/check-weekly-report
 * Manually trigger weekly report generation
 */
router.post('/check-weekly-report', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    db.query(
      'SELECT email, name FROM users WHERE id = ?',
      [userId],
      async (err, results) => {
        if (err || !results.length) {
          return res.status(500).json({ error: 'User not found' });
        }

        const user = results[0];
        await alertService.sendWeeklyReport(userId, user.email, user.name);

        res.json({ message: 'Weekly report generated and sent!' });
      }
    );
  } catch (error) {
    console.error('Error sending weekly report:', error.message);
    res.status(500).json({ error: 'Failed to send weekly report' });
  }
});

module.exports = router;
