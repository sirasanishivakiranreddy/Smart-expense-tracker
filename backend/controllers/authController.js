const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendResetCode, sendWelcomeEmail } = require('../utils/sendEmail');

// Store reset codes in memory (in production, use Redis or database)
const resetCodes = new Map();
const RESET_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword],
      (err, result) => {
        if (err) {
          console.error('DB register error:', err);
          return res.status(400).json({ error: 'Email already exists', details: err.message });
        }
        res.json({ message: 'User registered successfully' });
      }
    );
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('DB login error:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
      }
      if (!results || results.length === 0) return res.status(400).json({ error: 'User not found' });
      const user = results[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ error: 'Wrong password' });
      const token = jwt.sign({ id: user.id, name: user.name }, 'smartexpense123', { expiresIn: '7d' });
      res.json({ token, name: user.name });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  try {
    // Validate input
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('DB reset error:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
      }

      if (!results || results.length === 0) {
        return res.status(400).json({ error: 'User not found' });
      }

      // In production, verify resetCode was sent via email
      // For now, we accept it (frontend validates it matches sent code)
      // In real implementation: check resetCode against DB with expiry time

      try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.query(
          'UPDATE users SET password = ? WHERE email = ?',
          [hashedPassword, email],
          (err, result) => {
            if (err) {
              console.error('DB update error:', err);
              return res.status(500).json({ error: 'Failed to reset password', details: err.message });
            }

            res.json({
              message: 'Password reset successfully',
              email: email
            });
          }
        );
      } catch (hashErr) {
        console.error('Hash error:', hashErr);
        res.status(500).json({ error: 'Server error during password hashing', details: hashErr.message });
      }
    });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

/**
 * Step 1: Send password reset code to email
 */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('DB lookup error:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
      }

      // Security: don't reveal if email exists
      if (!results || results.length === 0) {
        return res.json({
          message: 'If email exists, reset code has been sent',
          email: email
        });
      }

      try {
        // Generate 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Store code with expiry
        resetCodes.set(email, {
          code: resetCode,
          expiresAt: Date.now() + RESET_CODE_EXPIRY
        });

        // Send email
        await sendResetCode(email, resetCode);

        console.log(`✅ Reset code sent to ${email}`);

        res.json({
          message: 'Password reset code sent to email',
          email: email,
          expiresIn: '10 minutes'
        });
      } catch (emailErr) {
        console.error('Email sending error:', emailErr);
        res.status(500).json({
          error: 'Failed to send email. Check server configuration.',
          details: emailErr.message
        });
      }
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

/**
 * Step 2: Verify the reset code
 */
exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    const storedData = resetCodes.get(email);

    if (!storedData) {
      return res.status(400).json({ error: 'No reset code sent for this email' });
    }

    // Check if code has expired
    if (Date.now() > storedData.expiresAt) {
      resetCodes.delete(email);
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    // Verify code
    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    console.log(`✅ Reset code verified for ${email}`);

    res.json({
      message: 'Code verified successfully',
      verified: true
    });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

/**
 * Step 3: Reset password with verified code
 */
exports.resetPasswordWithCode = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    // Validate input
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Verify code is valid
    const storedData = resetCodes.get(email);

    if (!storedData) {
      return res.status(400).json({ error: 'No valid reset code. Request a new one.' });
    }

    if (Date.now() > storedData.expiresAt) {
      resetCodes.delete(email);
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('DB lookup error:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
      }

      if (!results || results.length === 0) {
        return res.status(400).json({ error: 'User not found' });
      }

      try {
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        db.query(
          'UPDATE users SET password = ? WHERE email = ?',
          [hashedPassword, email],
          (err, result) => {
            if (err) {
              console.error('DB update error:', err);
              return res.status(500).json({ error: 'Failed to reset password', details: err.message });
            }

            // Clear the reset code
            resetCodes.delete(email);

            console.log(`✅ Password reset successfully for ${email}`);

            res.json({
              message: 'Password reset successfully',
              success: true
            });
          }
        );
      } catch (hashErr) {
        console.error('Hash error:', hashErr);
        res.status(500).json({ error: 'Server error during password reset', details: hashErr.message });
      }
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}