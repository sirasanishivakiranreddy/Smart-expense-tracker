const db = require('../db');
const { 
  sendBudgetExceededAlert, 
  sendLargeExpenseAlert, 
  sendRecurringReminderAlert,
  sendWeeklyReportAlert 
} = require('../utils/sendEmail');

/**
 * Check if budget is exceeded and send alert
 */
exports.checkBudgetAndAlert = async (userId, category, currentSpent, budgetLimit, userEmail) => {
  try {
    // Calculate percentage overhead
    const percentageUsed = (currentSpent / budgetLimit) * 100;
    
    // Send alert if over budget
    if (currentSpent > budgetLimit) {
      const overage = currentSpent - budgetLimit;
      const percentageOver = percentageUsed - 100;
      
      await sendBudgetExceededAlert(userEmail, {
        category,
        budgetLimit,
        currentSpent,
        overage,
        percentageOver: percentageOver.toFixed(2)
      });
      
      console.log(`✅ Budget exceeded alert sent to ${userEmail} for ${category}`);
      return true;
    }
    
    // Send warning at 80% and 90%
    if (percentageUsed >= 90 && percentageUsed < 100) {
      await sendBudgetExceededAlert(userEmail, {
        category,
        budgetLimit,
        currentSpent,
        overage: 0,
        percentageOver: 90,
        isWarning: true
      });
      
      console.log(`⚠️ Budget warning (90%) sent to ${userEmail} for ${category}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in checkBudgetAndAlert:', error.message);
    throw error;
  }
};

/**
 * Send large expense alert
 */
exports.sendLargeExpenseNotification = async (userId, expense, userEmail, userName, threshold) => {
  try {
    if (expense.amount >= threshold) {
      await sendLargeExpenseAlert(userEmail, {
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        date: expense.date,
        userName,
        threshold
      });
      
      console.log(`💸 Large expense alert sent to ${userEmail}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error in sendLargeExpenseNotification:', error.message);
    throw error;
  }
};

/**
 * Get user's alert preferences
 */
exports.getAlertPreferences = (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM alert_preferences WHERE user_id = ?`,
      [userId],
      (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || {
          budget_exceeded: true,
          large_expense: true,
          large_expense_threshold: 5000,
          recurring_reminder: true,
          weekly_report: false
        });
      }
    );
  });
};

/**
 * Update user's alert preferences
 */
exports.updateAlertPreferences = (userId, preferences) => {
  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO alert_preferences (user_id, budget_exceeded, large_expense, large_expense_threshold, recurring_reminder, weekly_report) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       budget_exceeded = VALUES(budget_exceeded),
       large_expense = VALUES(large_expense),
       large_expense_threshold = VALUES(large_expense_threshold),
       recurring_reminder = VALUES(recurring_reminder),
       weekly_report = VALUES(weekly_report)`,
      [
        userId,
        preferences.budget_exceeded !== false,
        preferences.large_expense !== false,
        preferences.large_expense_threshold || 5000,
        preferences.recurring_reminder !== false,
        preferences.weekly_report === true
      ],
      (err, results) => {
        if (err) reject(err);
        else resolve({ message: 'Alert preferences updated successfully' });
      }
    );
  });
};

/**
 * Check recurring expenses and send reminders
 */
exports.checkRecurringExpensesAndAlert = async (userId, userEmail, userName) => {
  try {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Get all recurring expenses for this user
    db.query(
      `SELECT * FROM recurring_expenses WHERE user_id = ?`,
      [userId],
      async (err, recurringExpenses) => {
        if (err) {
          console.error('Error fetching recurring expenses:', err);
          return;
        }
        
        for (const expense of recurringExpenses) {
          // Check if it's the day before the due date
          if (dayOfMonth === expense.due_day || dayOfMonth === expense.due_day - 1) {
            await sendRecurringReminderAlert(userEmail, {
              amount: expense.amount,
              category: expense.category,
              description: expense.description,
              dueDate: expense.due_day,
              userName
            });
            
            console.log(`📅 Recurring reminder sent to ${userEmail}`);
          }
        }
      }
    );
  } catch (error) {
    console.error('Error in checkRecurringExpensesAndAlert:', error.message);
    throw error;
  }
};

/**
 * Send weekly spending report
 */
exports.sendWeeklyReport = async (userId, userEmail, userName) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    db.query(
      `SELECT category, SUM(amount) as total FROM expenses 
       WHERE user_id = ? AND date >= ? 
       GROUP BY category`,
      [userId, weekAgo.toISOString().split('T')[0]],
      async (err, results) => {
        if (err) {
          console.error('Error fetching weekly expenses:', err);
          return;
        }
        
        const totalSpent = results.reduce((sum, row) => sum + parseFloat(row.total), 0);
        
        await sendWeeklyReportAlert(userEmail, {
          userName,
          totalSpent,
          byCategory: results,
          period: `${weekAgo.toDateString()} - ${new Date().toDateString()}`
        });
        
        console.log(`📊 Weekly report sent to ${userEmail}`);
      }
    );
  } catch (error) {
    console.error('Error in sendWeeklyReport:', error.message);
    throw error;
  }
};
