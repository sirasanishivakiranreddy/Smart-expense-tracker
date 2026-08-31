const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

const db = mysql.createConnection(dbConfig);

function createTables() {
  // users
  db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `, (err) => {
    if (err) console.error('Create users table error:', err);
    else console.log('Table users: OK');
  });

  // expenses
  db.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      category VARCHAR(100) DEFAULT 'Other',
      description TEXT,
      date DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `, (err) => {
    if (err) console.error('Create expenses table error:', err);
    else console.log('Table expenses: OK');
  });

  // budgets
  db.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      monthly_limit DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY user_category (user_id, category),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `, (err) => {
    if (err) console.error('Create budgets table error:', err);
    else console.log('Table budgets: OK');
  });

  // income tracking
  db.query(`
    CREATE TABLE IF NOT EXISTS income (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      source VARCHAR(100) NOT NULL DEFAULT 'Salary',
      description TEXT,
      date DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `, (err) => {
    if (err) console.error('Create income table error:', err);
    else console.log('Table income: OK');
  });

  // recurring expenses (rent, electricity, subscriptions, etc.)
  db.query(`
    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      category VARCHAR(100) NOT NULL DEFAULT 'Other',
      description TEXT,
      frequency VARCHAR(50) NOT NULL DEFAULT 'monthly',
      start_date DATETIME,
      end_date DATETIME,
      next_due_date DATETIME,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `, (err) => {
    if (err) console.error('Create recurring_expenses table error:', err);
    else console.log('Table recurring_expenses: OK');
  });

  // alert preferences for email notifications
  db.query(`
    CREATE TABLE IF NOT EXISTS alert_preferences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      budget_exceeded BOOLEAN DEFAULT TRUE,
      large_expense BOOLEAN DEFAULT TRUE,
      large_expense_threshold DECIMAL(10,2) DEFAULT 5000,
      recurring_reminder BOOLEAN DEFAULT TRUE,
      weekly_report BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `, (err) => {
    if (err) console.error('Create alert_preferences table error:', err);
    else console.log('Table alert_preferences: OK');
  });
}

// Log each SQL query (useful for debugging; remove in production)
const _origQuery = db.query.bind(db);
db.query = function (sql, params, cb) {
  try {
    const sqlPreview = typeof sql === 'string' ? sql.replace(/\s+/g, ' ').trim() : sql;
    console.log('SQL ▶', sqlPreview);
    if (Array.isArray(params)) console.log('PARAMS ▶', params);
  } catch (e) {
    console.error('Error logging SQL:', e);
  }
  return _origQuery(sql, params, cb);
};

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('MySQL connected successfully!');
  createTables();
  console.log('createTables() called — table creation initiated.');
});

// runtime error handler
db.on('error', (err) => {
  console.error('MySQL runtime error:', err);
});

module.exports = db;
