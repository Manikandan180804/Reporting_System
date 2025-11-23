const express = require('express');
const router = express.Router();
const RoutingRule = require('../models/RoutingRule');
const protect = require('../middleware/authMiddleware');

// Get all routing rules
router.get('/', protect, async (req, res) => {
  try {
    const rules = await RoutingRule.find().sort({ createdAt: -1 });
    res.status(200).json(rules);
  } catch (error) {
    console.error('Error fetching routing rules:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create rule (admin)
router.post('/', protect, async (req, res) => {
  try {
    // enforce admin-only
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }
    const { category, assignedTeam, assignedTo, priority, active } = req.body;
    const rule = new RoutingRule({ category, assignedTeam, assignedTo, priority, active });
    await rule.save();
    res.status(201).json({ message: 'Routing rule created', rule });
  } catch (error) {
    console.error('Error creating routing rule:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update rule
router.patch('/:id', protect, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }
    const rule = await RoutingRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    // Allow updates to all fields
    const { assignedTeam, assignedTo, priority, active } = req.body;
    if (assignedTeam !== undefined) rule.assignedTeam = assignedTeam;
    if (assignedTo !== undefined) rule.assignedTo = assignedTo;
    if (priority !== undefined) rule.priority = priority;
    if (active !== undefined) rule.active = active;
    await rule.save();
    res.status(200).json({ message: 'Routing rule updated', rule });
  } catch (error) {
    console.error('Error updating routing rule:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete rule
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }
    const rule = await RoutingRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.status(200).json({ message: 'Routing rule deleted' });
  } catch (error) {
    console.error('Error deleting routing rule:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
