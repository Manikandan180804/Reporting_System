const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @route   POST /api/users
// @desc    Register a new user
// @access  Public
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // 🔐 Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ name, email, password: hashedPassword, role: role || 'employee' });
    await user.save();

    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// ✅ Add this login route below the register route
// @route   POST /api/users/login
// @desc    Authenticate user and return success
// @access  Public
const jwt = require('jsonwebtoken');
const protect = require('../middleware/authMiddleware');
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.status(200).json({ 
      message: 'Login successful', 
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/', protect, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// @route   POST /api/auth/signup (alias for /)
// @desc    Register a new user via signup route
// @access  Public
router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ name, email, password: hashedPassword, role: role || 'employee' });
    await user.save();

    // Return token for immediate login after signup
    const token = jwt.sign(
      { userId: user._id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// @route   GET /api/users/me
// @desc    Get current logged-in user's profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// @route   GET /api/users/responders
// @desc    Get all responders (users with responder or admin role)
// @access  Private
router.get('/responders', protect, async (req, res) => {
  try {
    const responders = await User.find({ role: { $in: ['responder', 'admin'] } }).select('-password');
    res.status(200).json(responders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;