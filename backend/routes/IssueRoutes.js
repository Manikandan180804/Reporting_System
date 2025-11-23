const express = require('express');
const router = express.Router();
const Issue = require('../models/Issue');
const protect = require('../middleware/authMiddleware');

// @route   POST /api/issues
// @desc    Create a new issue
// @access  Private
router.post('/', protect, async (req, res) => {
  const { title, description } = req.body;

  try {
    const issue = new Issue({
      title,
      description,
      createdBy: req.user.userId,
    });

    await issue.save();
    res.status(201).json({ message: 'Issue created', issue });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// @route   GET /api/issues
// @desc    Get all issues created by the logged-in user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const issues = await Issue.find({ createdBy: req.user.userId });
    res.status(200).json(issues);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// @route   GET /api/issues/:id
// @desc    Get single issue by id (only owner)
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const issue = await Issue.findOne({ _id: req.params.id, createdBy: req.user.userId });
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
    res.status(200).json(issue);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});
// @route   PUT /api/issues/:id
// @desc    Update an issue
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const { title, description, status } = req.body;

  try {
    const issue = await Issue.findOne({ _id: req.params.id, createdBy: req.user.userId });
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    issue.title = title || issue.title;
    issue.description = description || issue.description;
    issue.status = status || issue.status;

    await issue.save();
    res.status(200).json({ message: 'Issue updated', issue });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// @route   DELETE /api/issues/:id
// @desc    Delete an issue
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const issue = await Issue.findOneAndDelete({ _id: req.params.id, createdBy: req.user.userId });
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found or already deleted' });
    }

    res.status(200).json({ message: 'Issue deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;