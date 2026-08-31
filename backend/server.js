const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db');
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const alertRoutes = require('./routes/alerts');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/alerts', alertRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// basic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the process using that port or set PORT to another value before starting.`);
    console.error('Helpful commands:');
    console.error(`  lsof -i :${PORT}`);
    console.error(`  sudo kill -9 $(lsof -t -i :${PORT})`);
    console.error('Or start on another port: PORT=5001 npm run start');
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});