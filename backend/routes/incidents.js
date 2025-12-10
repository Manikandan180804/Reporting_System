const express = require('express');
const router = express.Router();
const Incident = require('../models/Issue');
const RoutingRule = require('../models/RoutingRule');
const protect = require('../middleware/authMiddleware');
const User = require('../models/User');
const socketHelper = require('../socket');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// ensure uploads dir exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  }
});

const upload = multer({ storage });

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

    // add activity entry for creation
    incident.activity = incident.activity || [];
    incident.activity.push({ type: 'created', message: 'Incident created', by: req.user.userId, byName: reporter ? reporter.name : undefined, at: new Date() });
    await incident.save();

    // emit socket event if available
    try {
      const io = socketHelper.getIO();
      if (io) io.emit('incident:created', incident);
    } catch (e) {}

    res.status(201).json(incident);
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
    incident.activity = incident.activity || [];
    incident.activity.push({ type: 'status', message: `Status changed to ${status}`, by: req.user.userId, byName: user ? user.name : undefined, at: new Date(), meta: { status } });
    await incident.save();

    try {
      const io = socketHelper.getIO();
      if (io) io.emit('incident:updated', incident);
    } catch (e) {}

    res.status(200).json(incident);
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
    const comment = { text, createdBy: req.user.userId, name: user ? user.name : undefined, createdAt: new Date() };
    incident.comments.push(comment);
    incident.activity = incident.activity || [];
    incident.activity.push({ type: 'comment', message: `${user ? user.name : 'Someone'} commented`, by: req.user.userId, byName: user ? user.name : undefined, at: new Date(), meta: { text } });
    await incident.save();

    try {
      const io = socketHelper.getIO();
      if (io) io.emit('comment:added', { incidentId: incident._id, comment });
    } catch (e) {}

    res.status(201).json(incident);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Upload attachment to an incident
router.post('/:id/attachments', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    const user = await User.findById(req.user.userId);
    const fileUrl = `/uploads/${req.file.filename}`;
    incident.attachments = incident.attachments || [];
    incident.attachments.push({ url: fileUrl, filename: req.file.originalname, uploadedBy: req.user.userId, uploadedAt: new Date() });
    incident.activity = incident.activity || [];
    incident.activity.push({ type: 'attachment', message: `Attachment uploaded: ${req.file.originalname}`, by: req.user.userId, byName: user ? user.name : undefined, at: new Date(), meta: { filename: req.file.originalname, url: fileUrl } });
    await incident.save();

    try {
      const io = socketHelper.getIO();
      if (io) io.emit('incident:updated', incident);
    } catch (e) {}

    res.status(201).json({ url: fileUrl, filename: req.file.originalname });
  } catch (err) {
    console.error('Attachment upload error', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Watch/follow an incident
router.post('/:id/watch', protect, async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    const user = await User.findById(req.user.userId);
    incident.watchers = incident.watchers || [];
    if (!incident.watchers.includes(req.user.userId)) {
      incident.watchers.push(req.user.userId);
    }
    incident.activity = incident.activity || [];
    incident.activity.push({ type: 'watch', message: `${user?.name} is watching`, by: req.user.userId, byName: user?.name, at: new Date() });
    await incident.save();
    res.status(200).json(incident);
  } catch (err) {
    console.error('Watch error', err);
    res.status(500).json({ message: 'Watch failed' });
  }
});

// Assign incident
router.patch('/:id/assign', protect, async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    const assignee = await User.findById(assignedTo);
    const assigner = await User.findById(req.user.userId);
    incident.assignedTo = assignedTo;
    incident.assigneeName = assignee?.name;
    incident.activity = incident.activity || [];
    incident.activity.push({ type: 'assign', message: `Assigned to ${assignee?.name}`, by: req.user.userId, byName: assigner?.name, at: new Date(), meta: { assignedTo } });
    await incident.save();

    try {
      const io = socketHelper.getIO();
      if (io) io.emit('incident:assigned', incident);
    } catch (e) {}

    res.status(200).json(incident);
  } catch (err) {
    console.error('Assign error', err);
    res.status(500).json({ message: 'Assign failed' });
  }
});

// Get metrics
router.get('/metrics', protect, async (req, res) => {
  try {
    const incidents = await Incident.find();
    const volume = [];
    const byStatus = {};
    const bySeverity = {};

    incidents.forEach((inc) => {
      byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
      bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
      const dateStr = new Date(inc.createdAt).toLocaleDateString();
      const idx = volume.findIndex((v) => v.date === dateStr);
      if (idx >= 0) volume[idx].count++;
      else volume.push({ date: dateStr, count: 1 });
    });

    const mttr = incidents
      .filter((i) => i.status === 'Resolved')
      .reduce((sum, i) => {
        const resolved = i.statusHistory?.find((h) => h.toStatus === 'Resolved');
        if (resolved) return sum + (new Date(resolved.changedAt).getTime() - new Date(i.createdAt).getTime());
        return sum;
      }, 0) / Math.max(incidents.filter((i) => i.status === 'Resolved').length, 1);

    res.status(200).json({
      volume: volume.slice(-7),
      mttr: mttr || 0,
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      bySeverity: Object.entries(bySeverity).map(([severity, count]) => ({ severity, count })),
    });
  } catch (err) {
    console.error('Metrics error', err);
    res.status(500).json({ message: 'Metrics failed' });
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
