const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware - ensure these are registered before routes so req.body is available
app.use(cors());
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

console.log('🔍 MONGO_URI:',process.env.MONGO_URI);
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

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));