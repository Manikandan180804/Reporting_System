const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const http = require('http');
const path = require('path');

// Middleware - ensure these are registered before routes so req.body is available
// CORS configuration for production
const allowedOrigins = [
  'https://issueflow-frontend.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CORS_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now to debug
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Simple request logger to help diagnose 'failed to fetch' / CORS issues
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin || req.headers.referer || '-';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} Origin: ${origin}`);
  } catch (err) {
    // don't let logging break the app
  }
  next();
});

const issueRoutes = require('./routes/issueRoutes');
app.use('/api/issues', issueRoutes);

// Mount existing user routes under both /api/users and /api/auth to match ARCHITECTURE.md
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);
app.use('/api/auth', userRoutes);

// New routes: incidents (more feature-complete), routing rules
const incidentsRoutes = require('./routes/incidents');
app.use('/api/incidents', incidentsRoutes);

const routingRules = require('./routes/routingRules');
app.use('/api/routing-rules', routingRules);

console.log('🔍 MONGO_URI:', process.env.MONGO_URI);
// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Test Route
app.get('/', (req, res) => {
  res.send('IssueFlow API is running...');
});

// Start Server (create HTTP server so Socket.IO can hook in)
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// initialize socket (if available)
try {
  const socketHelper = require('./socket');
  const io = socketHelper.init(server);
  if (io) console.log('🔌 Socket.IO initialized');
} catch (err) {
  console.warn('Socket init failed', err);
}

// serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));