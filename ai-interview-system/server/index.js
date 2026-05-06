/**
 * AI Interview System - Main Server Entry Point
 * Initializes Express, MongoDB, Socket.IO, and all middleware
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interview');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/upload');
const { initializeSocketHandlers } = require('./sockets/socketHandler');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// ─── Socket.IO Configuration ──────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e7, // 10MB for audio chunks
  transports: ['websocket', 'polling'],
});

// Make io accessible in routes/controllers
app.set('io', io);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Diagnostic endpoint
app.get('/api/diagnostic', (req, res) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const apiKeyValid = hasApiKey && !process.env.OPENAI_API_KEY.includes('your-actual') && process.env.OPENAI_API_KEY !== 'sk-test-placeholder';
  
  res.json({
    status: 'diagnostic',
    timestamp: new Date().toISOString(),
    openai: {
      apiKeyConfigured: hasApiKey,
      apiKeyValid: apiKeyValid,
      keyPreview: hasApiKey ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : 'NOT SET',
    },
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-interview',
    },
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Socket Handlers ──────────────────────────────────────────────────────────
initializeSocketHandlers(io);

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-interview');
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 Socket.IO ready`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

module.exports = { app, server, io };
