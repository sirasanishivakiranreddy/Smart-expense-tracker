const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD
  }
});

/**
 * Send password reset code via email
 * @param {string} to - Recipient email
 * @param {string} code - 6-digit reset code
 * @returns {Promise<boolean>} - Success status
 */
const sendResetCode = async (to, code) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: '🔐 Smart Expense Tracker - Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Password Reset Request</h2>
          <p style="color: #4a5568; font-size: 14px;">We received a request to reset your password. Use the code below:</p>
          
          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #3182ce; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          
          <p style="color: #4a5568; font-size: 14px;">
            This code will expire in 10 minutes.
          </p>
          
          <p style="color: #718096; font-size: 12px;">
            If you didn't request this, please ignore this email. Your account is safe.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          
          <p style="color: #718096; font-size: 12px; text-align: center;">
            Smart Expense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to:', to);
    console.log('📧 Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    if (error.code === 'EAUTH') {
      throw new Error('Invalid email credentials. Use a Gmail App Password with 2FA enabled.');
    }
    throw error;
  }
};

/**
 * Send welcome email to new user
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @returns {Promise<boolean>}
 */
const sendWelcomeEmail = async (to, name) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: '🎉 Welcome to Smart Expense Tracker!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Welcome to Smart Expense Tracker, ${name}!</h2>
          <p style="color: #4a5568;">Your account has been created successfully.</p>
          
          <p style="color: #4a5568;">You can now:</p>
          <ul style="color: #4a5568;">
            <li>📊 Track your daily expenses</li>
            <li>🎯 Set and manage budgets</li>
            <li>📈 Get visual insights on spending</li>
            <li>🤖 Get AI-powered financial advice</li>
          </ul>
          
          <p style="color: #4a5568;">
            <a href="https://smartfinance.netlify.app" style="color: #3182ce; text-decoration: none; font-weight: bold;">
              Log in to your account →
            </a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            Smart Expense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error.message);
    // Don't throw here - welcome email failure shouldn't block registration
    return false;
  }
};

/**
 * Send budget alert email when spending exceeds limits
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @param {Object} budgetData - Budget alert details
 * @returns {Promise<boolean>}
 */
const sendBudgetAlert = async (to, name, budgetData) => {
  try {
    const { category, spent, limit, percentage } = budgetData;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: '⚠️ Budget Alert - Smart Expense Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #e53e3e;">Budget Alert!</h2>
          <p style="color: #4a5568;">Hi ${name},</p>

          <div style="background-color: #fed7d7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e53e3e;">
            <h3 style="color: #c53030; margin: 0 0 10px 0;">${category} Budget Exceeded</h3>
            <p style="color: #742a2a; margin: 5px 0;">
              <strong>Spent:</strong> ₹${spent.toFixed(2)}<br>
              <strong>Limit:</strong> ₹${limit.toFixed(2)}<br>
              <strong>Over by:</strong> ₹${(spent - limit).toFixed(2)} (${percentage.toFixed(0)}%)
            </p>
          </div>

          <p style="color: #4a5568;">
            Consider reviewing your spending in this category to stay within your budget.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://smartfinance.netlify.app" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Dashboard
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            Smart Expense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Budget alert sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending budget alert:', error.message);
    return false;
  }
};

/**
 * Send weekly expense summary
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @param {Object} summaryData - Weekly summary data
 * @returns {Promise<boolean>}
 */
const sendWeeklySummary = async (to, name, summaryData) => {
  try {
    const { totalSpent, topCategory, transactionCount, avgPerDay } = summaryData;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: '📊 Your Weekly Expense Summary - Smart Expense Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Weekly Expense Summary</h2>
          <p style="color: #4a5568;">Hi ${name}, here's your spending overview for this week:</p>

          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div style="text-align: center;">
                <h3 style="color: #3182ce; margin: 0; font-size: 1.5rem;">₹${totalSpent.toFixed(2)}</h3>
                <p style="color: #718096; margin: 5px 0 0 0; font-size: 0.9rem;">Total Spent</p>
              </div>
              <div style="text-align: center;">
                <h3 style="color: #38a169; margin: 0; font-size: 1.5rem;">${transactionCount}</h3>
                <p style="color: #718096; margin: 5px 0 0 0; font-size: 0.9rem;">Transactions</p>
              </div>
              <div style="text-align: center;">
                <h3 style="color: #d69e2e; margin: 0; font-size: 1.5rem;">₹${avgPerDay.toFixed(2)}</h3>
                <p style="color: #718096; margin: 5px 0 0 0; font-size: 0.9rem;">Avg/Day</p>
              </div>
              <div style="text-align: center;">
                <h3 style="color: #805ad5; margin: 0; font-size: 1.2rem;">${topCategory}</h3>
                <p style="color: #718096; margin: 5px 0 0 0; font-size: 0.9rem;">Top Category</p>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://smartfinance.netlify.app" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Full Report
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            Smart Expense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Weekly summary sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending weekly summary:', error.message);
    return false;
  }
};

/**
 * Send monthly expense report
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @param {Object} reportData - Monthly report data
 * @returns {Promise<boolean>}
 */
const sendMonthlyReport = async (to, name, reportData) => {
  try {
    const { totalSpent, categoryBreakdown, budgetComparison, savings } = reportData;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: '📈 Monthly Expense Report - Smart Expense Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Monthly Expense Report</h2>
          <p style="color: #4a5568;">Hi ${name}, here's your complete spending analysis for this month:</p>

          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin: 0 0 15px 0;">Overview</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <h4 style="color: #3182ce; margin: 0;">₹${totalSpent.toFixed(2)}</h4>
                <p style="color: #718096; margin: 5px 0 0 0; font-size: 0.9rem;">Total Spent</p>
              </div>
              <div>
                <h4 style="color: #38a169; margin: 0;">₹${savings.toFixed(2)}</h4>
                <p style="color: #718096; margin: 5px 0 0 0; font-size: 0.9rem;">Savings</p>
              </div>
            </div>
          </div>

          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin: 0 0 15px 0;">Category Breakdown</h3>
            ${Object.entries(categoryBreakdown).map(([category, amount]) =>
              `<div style="display: flex; justify-content: space-between; margin: 8px 0;">
                <span style="color: #4a5568;">${category}</span>
                <span style="color: #3182ce; font-weight: bold;">₹${amount.toFixed(2)}</span>
              </div>`
            ).join('')}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://smartfinance.netlify.app" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Dashboard
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            Smart Expense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Monthly report sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending monthly report:', error.message);
    return false;
  }
};

/**
 * Send recurring expense reminder
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @param {Object} reminderData - Reminder details
 * @returns {Promise<boolean>}
 */
const sendRecurringReminder = async (to, name, reminderData) => {
  try {
    const { description, amount, dueDate, category } = reminderData;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: '⏰ Recurring Expense Reminder - Smart Expense Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Recurring Expense Reminder</h2>
          <p style="color: #4a5568;">Hi ${name},</p>

          <div style="background-color: #ebf8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3182ce;">
            <h3 style="color: #2c5282; margin: 0 0 10px 0;">${description}</h3>
            <p style="color: #2a4365; margin: 5px 0;">
              <strong>Amount:</strong> ₹${amount.toFixed(2)}<br>
              <strong>Category:</strong> ${category}<br>
              <strong>Due Date:</strong> ${dueDate}
            </p>
          </div>

          <p style="color: #4a5568;">
            Don't forget to pay this recurring expense on time.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://smartfinance.netlify.app" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Add to Expenses
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            Smart Expense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Recurring reminder sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending recurring reminder:', error.message);
    return false;
  }
};

/**
 * Send budget exceeded alert (new function for alertService)
 */
const sendBudgetExceededAlert = async (to, budgetData) => {
  try {
    const { category, budgetLimit, currentSpent, overage, percentageOver, isWarning } = budgetData;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: isWarning ? 
        `⚠️ Budget Warning: ${category} at ${percentageOver}% - SmartExpense Tracker` :
        `🚨 Budget Exceeded: ${category} - SmartExpense Tracker`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: ${isWarning ? '#d4a017' : '#e53e3e'};">
            ${isWarning ? '⚠️ Budget Warning' : '🚨 Budget Alert'}
          </h2>
          
          <div style="background-color: ${isWarning ? '#fef3c7' : '#fed7d7'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isWarning ? '#f59e0b' : '#e53e3e'};">
            <h3 style="color: ${isWarning ? '#b45309' : '#c53030'}; margin: 0 0 10px 0;">${category} Budget Status</h3>
            <p style="color: ${isWarning ? '#7c2d12' : '#742a2a'}; margin: 5px 0;">
              <strong>Budget Limit:</strong> ₹${budgetLimit.toFixed(2)}<br>
              <strong>Current Spent:</strong> ₹${currentSpent.toFixed(2)}<br>
              <strong>Status:</strong> ${isWarning ? `${percentageOver}% used` : `₹${overage.toFixed(2)} (${percentageOver}%) over budget`}
            </p>
          </div>

          <p style="color: #4a5568;">
            ${isWarning ? 
              'You have used ' + percentageOver + '% of your ' + category + ' budget. Consider being mindful of your spending.' :
              'Your spending in the ' + category + ' category has exceeded your set budget. Review your expenses and adjust your spending.'
            }
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://smartfinance.netlify.app/budget.html" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Budget Details
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            SmartExpense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Budget alert sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending budget alert:', error.message);
    return false;
  }
};

/**
 * Send large expense alert
 */
const sendLargeExpenseAlert = async (to, expenseData) => {
  try {
    const { amount, category, description, date, userName, threshold } = expenseData;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `💸 Large Expense Alert: ₹${amount.toFixed(2)} - SmartExpense Tracker`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Large Expense Detected</h2>
          <p style="color: #4a5568;">Hi ${userName},</p>

          <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <h3 style="color: #0c4a6e; margin: 0 0 10px 0;">Expense Details</h3>
            <p style="color: #0c4a6e; margin: 5px 0;">
              <strong>Amount:</strong> ₹${amount.toFixed(2)}<br>
              <strong>Category:</strong> ${category}<br>
              <strong>Description:</strong> ${description}<br>
              <strong>Date:</strong> ${new Date(date).toLocaleDateString()}
            </p>
          </div>

          <p style="color: #4a5568;">
            This expense exceeds your configured threshold of ₹${threshold.toFixed(2)}. Please verify this transaction.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://smartfinance.netlify.app/dashboard.html" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Expense
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            SmartExpense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Large expense alert sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending large expense alert:', error.message);
    return false;
  }
};

/**
 * Send recurring expense reminder
 */
const sendRecurringReminderAlert = async (to, reminderData) => {
  try {
    const { amount, category, description, dueDate, userName } = reminderData;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `📅 Recurring Expense Reminder: ${description} - SmartExpense Tracker`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Recurring Expense Reminder</h2>
          <p style="color: #4a5568;">Hi ${userName},</p>

          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <h3 style="color: #0c4a6e; margin: 0 0 10px 0;">Upcoming Payment</h3>
            <p style="color: #0c4a6e; margin: 5px 0;">
              <strong>Description:</strong> ${description}<br>
              <strong>Amount:</strong> ₹${amount.toFixed(2)}<br>
              <strong>Category:</strong> ${category}<br>
              <strong>Due Date:</strong> ${dueDate}${dueDate === new Date().getDate() ? ' (Today)' : ' (Tomorrow)'}
            </p>
          </div>

          <p style="color: #4a5568;">
            This is a reminder about your upcoming recurring expense. Make sure to have sufficient funds available.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://smartfinance.netlify.app/recurring.html" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Recurring Expenses
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            SmartExpense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Recurring reminder sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending recurring reminder:', error.message);
    return false;
  }
};

/**
 * Send weekly report alert
 */
const sendWeeklyReportAlert = async (to, reportData) => {
  try {
    const { userName, totalSpent, byCategory, period } = reportData;

    const categoryRows = byCategory
      .map(cat => `<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${cat.category}</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${parseFloat(cat.total).toFixed(2)}</td></tr>`)
      .join('');

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `📊 Weekly Spending Report - SmartExpense Tracker`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Weekly Spending Report</h2>
          <p style="color: #4a5568;">Hi ${userName},</p>

          <p style="color: #4a5568; font-size: 0.9rem;">
            <strong>Period:</strong> ${period}
          </p>

          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin: 0 0 15px 0; text-align: center;">
              Total Spent: ₹${totalSpent.toFixed(2)}
            </h3>

            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #edf2f7;">
                  <th style="padding: 8px; text-align: left; color: #2d3748; font-weight: bold;">Category</th>
                  <th style="padding: 8px; text-align: right; color: #2d3748; font-weight: bold;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${categoryRows}
              </tbody>
            </table>
          </div>

          <p style="color: #4a5568;">
            Keep tracking your expenses to maintain better financial health.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://smartfinance.netlify.app/dashboard.html" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Full Dashboard
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px; text-align: center;">
            SmartExpense Tracker © 2024 • All rights reserved
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Weekly report sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending weekly report:', error.message);
    return false;
  }
};

module.exports = {
  sendResetCode,
  sendWelcomeEmail,
  sendBudgetAlert,
  sendWeeklySummary,
  sendMonthlyReport,
  sendRecurringReminder,
  sendBudgetExceededAlert,
  sendLargeExpenseAlert,
  sendRecurringReminderAlert,
  sendWeeklyReportAlert
};
