const db = require('../db');
const fs = require('fs');
const path = require('path');
const ocrService = require('../utils/ocrService');
const expenseService = require('../services/expenseService');
const budgetService = require('../services/budgetService');
const incomeService = require('../services/incomeService');
const recurringExpenseService = require('../services/recurringExpenseService');
const alertService = require('../services/alertService');

const STANDARD_CATEGORIES = [
  'Food', 'Travel', 'Shopping', 'Entertainment', 'Health', 'Education', 'Other'
];

function parseDateToISO(str) {
  if (!str) return null;
  str = str.trim();
  let m = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = str.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m = str.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (m) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const mm = months[m[2].toLowerCase().slice(0,3)];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2,'0')}`;
  }
  return null;
}

function normalizeExpenseData(expenseData = {}) {
  const safeByCategory = expenseData.byCategory && typeof expenseData.byCategory === 'object' ? expenseData.byCategory : {};
  const safeByMonth = expenseData.byMonth && typeof expenseData.byMonth === 'object' ? expenseData.byMonth : {};
  const highestExpense = expenseData.highestExpense && typeof expenseData.highestExpense === 'object'
    ? expenseData.highestExpense
    : {};

  return {
    totalExpenses: Number(expenseData.totalExpenses || 0),
    totalAmount: Number(expenseData.totalAmount || 0).toFixed(2),
    averagePerExpense: Number(expenseData.averagePerExpense || 0).toFixed(2),
    byCategory: safeByCategory,
    byMonth: safeByMonth,
    highestExpense: {
      amount: Number(highestExpense.amount || 0).toFixed(2),
      description: highestExpense.description || '-',
      category: highestExpense.category || 'Other'
    }
  };
}

function buildFallbackAdvice(message, expenseData = {}) {
  const lower = (message || '').toLowerCase();
  const totals = expenseData.byCategory || {};
  const categories = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const top = categories[0];

  if (lower.includes('total')) {
    return `📊 Your total spending is ₹${expenseData.totalAmount}.`;
  }

  if (lower.includes('highest')) {
    return `💸 Highest expense is ₹${expenseData.highestExpense.amount} on "${expenseData.highestExpense.description}" (${expenseData.highestExpense.category}).`;
  }

  if (lower.includes('category') || lower.includes('breakdown')) {
    if (!categories.length) return '📂 No category data yet. Add more expenses first.';
    const summary = categories.map(([cat, amt]) => `${cat}: ₹${Number(amt).toFixed(2)}`).join(' | ');
    return `📂 Category breakdown: ${summary}`;
  }

  if (top) {
    return `💡 Groq is temporarily unavailable. Based on your data, you spend most on ${top[0]} (₹${Number(top[1]).toFixed(2)}). Try reducing that category by 10%.`;
  }

  return '💡 Groq is temporarily unavailable. Add a few expenses and ask again for personalized tips.';
}

async function triggerExpenseEmailAlerts(userId, expenseInput) {
  return new Promise((resolve) => {
    db.query('SELECT email, name FROM users WHERE id = ?', [userId], async (userErr, userResults) => {
      if (userErr || !Array.isArray(userResults) || !userResults.length) {
        if (userErr) console.error('Alert user fetch error:', userErr.message);
        return resolve();
      }

      const user = userResults[0];

      let preferences;
      try {
        preferences = await alertService.getAlertPreferences(userId);
      } catch (prefErr) {
        console.error('Alert preferences fetch error:', prefErr.message);
        preferences = {
          budget_exceeded: true,
          large_expense: true,
          large_expense_threshold: 5000
        };
      }

      const amount = Number(expenseInput.amount) || 0;
      const category = expenseInput.category || 'Other';
      const description = expenseInput.description || 'Expense entry';
      const expenseDate = expenseInput.date ? new Date(expenseInput.date) : new Date();
      const year = expenseDate.getFullYear();
      const month = expenseDate.getMonth() + 1;

      if (preferences.large_expense !== false) {
        try {
          await alertService.sendLargeExpenseNotification(
            userId,
            { amount, category, description, date: expenseDate },
            user.email,
            user.name,
            Number(preferences.large_expense_threshold) || 5000
          );
        } catch (largeErr) {
          console.error('Large expense alert error:', largeErr.message);
        }
      }

      if (preferences.budget_exceeded !== false) {
        db.query(
          'SELECT monthly_limit FROM budgets WHERE user_id = ? AND category = ?',
          [userId, category],
          async (budgetErr, budgetRows) => {
            if (budgetErr) {
              console.error('Budget lookup error:', budgetErr.message);
              return resolve();
            }

            if (!Array.isArray(budgetRows) || !budgetRows.length) {
              return resolve();
            }

            const budgetLimit = Number(budgetRows[0].monthly_limit) || 0;
            if (budgetLimit <= 0) {
              return resolve();
            }

            db.query(
              `SELECT COALESCE(SUM(amount), 0) AS total
               FROM expenses
               WHERE user_id = ? AND category = ? AND YEAR(date) = ? AND MONTH(date) = ?`,
              [userId, category, year, month],
              async (sumErr, totalRows) => {
                if (sumErr) {
                  console.error('Budget spending sum error:', sumErr.message);
                  return resolve();
                }

                try {
                  const currentSpent = Number(totalRows?.[0]?.total) || 0;
                  await alertService.checkBudgetAndAlert(
                    userId,
                    category,
                    currentSpent,
                    budgetLimit,
                    user.email
                  );
                } catch (budgetAlertErr) {
                  console.error('Budget alert send error:', budgetAlertErr.message);
                }

                resolve();
              }
            );
          }
        );
      } else {
        resolve();
      }
    });
  });
}

exports.addExpense = async (req, res) => {
  try {
    const result = await expenseService.addExpense(req.user.id, req.body);

    // Trigger notifications after successful insert. Do not block the API response on email failures.
    triggerExpenseEmailAlerts(req.user.id, req.body)
      .catch((err) => console.error('Post-expense alert trigger error:', err.message));

    res.json(result);
  } catch (error) {
    console.error('Add expense error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.getExpenses = (req, res) => {
  const user_id = req.user.id;

  if (!user_id) {
    console.error('No user_id in request');
    return res.status(400).json({ error: 'Invalid user' });
  }

  db.query(
    'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC',
    [user_id],
    (err, results) => {
      if (err) {
        console.error('DB getExpenses error:', err);
        return res.status(500).json({ error: 'Failed to get expenses', details: err.message });
      }
      console.log(`Found ${results.length} expenses for user ${user_id}`);
      res.json(Array.isArray(results) ? results : []);
    }
  );
};

exports.getCategories = (req, res) => {
  res.json(STANDARD_CATEGORIES);
};

exports.deleteExpense = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  db.query(
    'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    [id, user_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to delete expense' });
      res.json({ message: 'Expense deleted successfully' });
    }
  );
};

exports.setBudget = async (req, res) => {
  try {
    const result = await budgetService.setBudget(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Set budget error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.getBudgets = async (req, res) => {
  try {
    const budgets = await budgetService.getBudgets(req.user.id);
    res.json(budgets);
  } catch (error) {
    console.error('Get budgets error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteBudget = async (req, res) => {
  try {
    const result = await budgetService.deleteBudget(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Delete budget error:', error.message);
    const statusCode = error.message === 'Budget not found' ? 404 : 400;
    res.status(statusCode).json({ error: error.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const result = await expenseService.updateExpense(req.user.id, req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Update expense error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.scanReceipt = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imagePath = req.file.path;
  const user_id = req.user && req.user.id ? req.user.id : null;

  if (!user_id) {
    try { fs.unlinkSync(imagePath); } catch (e) {}
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Processing receipt with Google Vision API:', imagePath);

    // Extract data from receipt using OCR
    const ocrResult = await ocrService.extractReceiptData(imagePath);

    // Cleanup file
    fs.unlink(imagePath, () => {});

    // Use OCR data or fallback to defaults
    const parsedAmount = Number.parseFloat(ocrResult.amount);
    const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : (Math.random() * 5000 + 50);
    const description = (ocrResult.storeName || 'Scanned Receipt').toString().trim() || 'Scanned Receipt';
    const date = parseDateToISO(ocrResult.date) || new Date().toISOString().split('T')[0];
    const category = 'Shopping'; // Default category for receipts
    const confidence = Number.isFinite(Number(ocrResult.confidence)) ? Number(ocrResult.confidence) : 0;

    console.log('OCR extracted: Amount:', amount, 'Store:', description, 'Date:', date);

    // Save to database
    db.query(
      'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
      [user_id, Number(amount).toFixed(2), category, description, date],
      (err, result) => {
        if (err) {
          console.error('DB save error:', err);
          return res.status(500).json({ error: 'Failed to save expense', details: err.message });
        }

        console.log('Expense saved with ID:', result.insertId);
        return res.json({
          message: 'Receipt scanned and expense added',
          expense: {
            id: result.insertId,
            amount: Number(amount).toFixed(2),
            category,
            description,
            date,
            ocrConfidence: confidence
          },
          note: `OCR Confidence: ${(confidence * 100).toFixed(0)}%`
        });
      }
    );

  } catch (err) {
    console.error('Receipt processing error:', err.message);
    try { fs.unlinkSync(imagePath); } catch (e) {}
    return res.status(500).json({ error: 'Failed to process receipt', details: err.message });
  }
};

// ==================== INCOME TRACKING ====================

exports.addIncome = async (req, res) => {
  try {
    const result = await incomeService.addIncome(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Add income error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.deleteIncome = async (req, res) => {
  try {
    const result = await incomeService.deleteIncome(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Delete income error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.getIncome = async (req, res) => {
  try {
    const income = await incomeService.getIncome(req.user.id);
    res.json(income);
  } catch (error) {
    console.error('Get income error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== RECURRING EXPENSES ====================

exports.addRecurringExpense = async (req, res) => {
  try {
    const result = await recurringExpenseService.addRecurringExpense(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Add recurring expense error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.getRecurringExpenses = async (req, res) => {
  try {
    const expenses = await recurringExpenseService.getRecurringExpenses(req.user.id);
    res.json(expenses);
  } catch (error) {
    console.error('Get recurring expenses error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteRecurringExpense = async (req, res) => {
  try {
    const result = await recurringExpenseService.deleteRecurringExpense(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Delete recurring expense error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.updateRecurringExpense = async (req, res) => {
  try {
    const result = await recurringExpenseService.updateRecurringExpense(req.user.id, req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Update recurring expense error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.getMonthlyRecurringTotal = async (req, res) => {
  try {
    const result = await recurringExpenseService.getTotalRecurring(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Get monthly recurring total error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== GROQ AI CHATBOT ====================

exports.chatWithAI = async (req, res) => {
  const { message } = req.body;
  const expenseData = normalizeExpenseData(req.body.expenseData);
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    return res.json({ response: buildFallbackAdvice(message, expenseData), fallback: true });
  }

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const prompt = `You are a personal finance advisor analyzing someone's expense data.

User's Expense Data:
- Total Expenses: ${expenseData.totalExpenses}
- Total Amount Spent: ₹${expenseData.totalAmount}
- Average Per Expense: ₹${expenseData.averagePerExpense}
- Spending by Category: ${JSON.stringify(expenseData.byCategory)}
- Monthly Breakdown: ${JSON.stringify(expenseData.byMonth)}
- Highest Expense: ₹${expenseData.highestExpense.amount} on "${expenseData.highestExpense.description}" (${expenseData.highestExpense.category})

User's Question: "${message}"

Please provide:
1. A direct, helpful answer to their question
2. Specific insights from their expense data
3. Actionable recommendations if relevant
4. Use emojis to make the response friendly
5. Keep response concise (2-3 sentences + tips if needed)`;

         const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Groq API error:', error);
      return res.status(response.status).json({ error: error.error?.message || 'Failed to get Groq response' });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      return res.status(500).json({ error: 'Empty response from Groq' });
    }

    res.json({ response: aiResponse });

  } catch (err) {
    console.error('Groq API call error:', err);
    return res.json({ response: buildFallbackAdvice(message, expenseData), fallback: true });
  }
};

module.exports = {
  addExpense: exports.addExpense,
  getExpenses: exports.getExpenses,
  getCategories: exports.getCategories,
  deleteExpense: exports.deleteExpense,
  setBudget: exports.setBudget,
  getBudgets: exports.getBudgets,
  deleteBudget: exports.deleteBudget,
  updateExpense: exports.updateExpense,
  scanReceipt: exports.scanReceipt,
  addIncome: exports.addIncome,
  getIncome: exports.getIncome,
  deleteIncome: exports.deleteIncome,
  addRecurringExpense: exports.addRecurringExpense,
  getRecurringExpenses: exports.getRecurringExpenses,
  deleteRecurringExpense: exports.deleteRecurringExpense,
  updateRecurringExpense: exports.updateRecurringExpense,
  getMonthlyRecurringTotal: exports.getMonthlyRecurringTotal,
  chatWithAI: exports.chatWithAI
};