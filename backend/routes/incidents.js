const express = require('express');
const router = express.Router();
const Incident = require('../models/Issue');
const RoutingRule = require('../models/RoutingRule');
const protect = require('../middleware/authMiddleware');
const User = require('../models/User');

// Create incident (employees)
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, category, severity } = req.body;
    const reporter = await User.findById(req.user.userId);

    const incident = new Incident({
      title,
      description,
      category,
      severity,
      reportedBy: req.user.userId,
      reporterName: reporter ? reporter.name : undefined,
    });

    // Apply routing rules to assign automatically
    try {
      const rule = await RoutingRule.findOne({ category });
      if (rule) {
        incident.assignedTeam = rule.assignedTeam;
        if (rule.assignedTo) {
          incident.assignedTo = rule.assignedTo;
          const assignee = await User.findById(rule.assignedTo);
          incident.assigneeName = assignee ? assignee.name : undefined;
        }
      }
    } catch (rErr) {
      console.warn('[incidents] routing rule lookup failed', rErr);
    }

    // initialize status history with creation entry (fromStatus = null -> toStatus = current)
    incident.statusHistory = [
      {
        fromStatus: null,
        toStatus: incident.status,
        changedBy: req.user.userId,
        changedByName: reporter ? reporter.name : undefined,
        note: 'Created',
        changedAt: new Date(),
      },
    ];

    await incident.save();
    res.status(201).json({ message: 'Incident created', incident });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get all incidents (admins can see all, others limited)
router.get('/', protect, async (req, res) => {
  try {
    const userRole = req.user.role || 'employee';
    let incidents;
    if (userRole === 'admin') {
      incidents = await Incident.find().sort({ createdAt: -1 });
    } else {
      incidents = await Incident.find({ reportedBy: req.user.userId }).sort({ createdAt: -1 });
    }
    res.status(200).json(incidents);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// NOTE: param route `/:id` is registered after static routes (see bottom)

// Update incident status
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    // simple workflow validation
    const valid = { Open: ['Investigating'], Investigating: ['Resolved'], Resolved: [] };
    if (incident.status !== status) {
      if (!valid[incident.status] || !valid[incident.status].includes(status)) {
        return res.status(400).json({ message: 'Invalid status transition' });
      }
    }
    const user = await User.findById(req.user.userId);
    // push history entry with from/to
    incident.statusHistory = incident.statusHistory || [];
    incident.statusHistory.push({
      fromStatus: incident.status,
      toStatus: status,
      changedBy: req.user.userId,
      changedByName: user ? user.name : undefined,
      note: req.body.note || undefined,
      changedAt: new Date(),
    });
    incident.status = status;
    await incident.save();
    res.status(200).json({ message: 'Status updated', incident });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get incidents reported by current user
router.get('/my-incidents', protect, async (req, res) => {
  try {
    const incidents = await Incident.find({ reportedBy: req.user.userId }).sort({ createdAt: -1 });
    res.status(200).json(incidents);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get incidents assigned to the responder
router.get('/assigned', protect, async (req, res) => {
  try {
    const incidents = await Incident.find({ assignedTo: req.user.userId }).sort({ createdAt: -1 });
    res.status(200).json(incidents);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Add comment
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { text } = req.body;
    const user = await User.findById(req.user.userId);
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    incident.comments.push({ text, createdBy: req.user.userId, name: user ? user.name : undefined });
    await incident.save();
    res.status(201).json({ message: 'Comment added', incident });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get incident by id (param route placed after other static routes)
router.get('/:id', protect, async (req, res) => {
  try {
    console.log('[incidents] GET /:id requested by', req.user);
    const incident = await Incident.findById(req.params.id);
    console.log('[incidents] lookup id=', req.params.id, 'found=', !!incident);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    // access check
    const userRole = req.user.role || 'employee';
    if (userRole !== 'admin' && incident.reportedBy.toString() !== req.user.userId && incident.assignedTo && incident.assignedTo.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.status(200).json(incident);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;
