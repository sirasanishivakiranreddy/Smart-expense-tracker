const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const {
  addExpense,
  getExpenses,
  deleteExpense,
  updateExpense,
  setBudget,
  getBudgets,
  deleteBudget,
  scanReceipt,
  addIncome,
  getIncome,
  deleteIncome,
  addRecurringExpense,
  getRecurringExpenses,
  deleteRecurringExpense,
  updateRecurringExpense,
  getMonthlyRecurringTotal,
  getCategories,
  chatWithAI
} = require('../controllers/expenseController');

// Expense routes
router.post('/add', auth, addExpense);
router.get('/all', auth, getExpenses);
router.delete('/:id', auth, deleteExpense);
router.put('/:id', auth, updateExpense);
router.post('/budget', auth, setBudget);
router.get('/budget', auth, getBudgets);
router.delete('/budget/:id', auth, deleteBudget);
router.post('/scan', auth, upload.single('receipt'), scanReceipt);
router.get('/categories', auth, getCategories);

// Income routes
router.post('/income/add', auth, addIncome);
router.get('/income/all', auth, getIncome);
router.delete('/income/:id', auth, deleteIncome);

// Recurring expense routes
router.post('/recurring/add', auth, addRecurringExpense);
router.get('/recurring/all', auth, getRecurringExpenses);
router.delete('/recurring/:id', auth, deleteRecurringExpense);
router.put('/recurring/:id', auth, updateRecurringExpense);
router.get('/recurring/monthly-total', auth, getMonthlyRecurringTotal);

// Gemini AI chatbot route
router.post('/chat', auth, chatWithAI);

module.exports = router;