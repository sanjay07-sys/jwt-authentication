const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

// Base Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User Authentication & JWT API is running',
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout',
      profile: 'GET /api/user/profile'
    }
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Database connection helper
const connectDB = async (uri = process.env.MONGODB_URI) => {
  try {
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

let server;
if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      server = app.listen(PORT, HOST, () => {
        console.log(
          `Server running in ${process.env.NODE_ENV || 'development'} mode on http://${HOST}:${PORT}`
        );
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err.message);
    });
}

module.exports = { app, connectDB };
