const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  resetPassword,
  forgotPassword,
  verifyResetCode,
  resetPasswordWithCode
} = require('../controllers/authController');

// Original endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/reset-password', resetPassword);

// New email-based password reset flow
router.post('/forgot-password', forgotPassword);           // Step 1: Request reset code
router.post('/verify-reset-code', verifyResetCode);       // Step 2: Verify code
router.post('/reset-password-with-code', resetPasswordWithCode); // Step 3: Reset with verified code

module.exports = router;