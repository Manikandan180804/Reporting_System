const express = require('express');
const router = express.Router();
const Incident = require('../models/Issue');
const RoutingRule = require('../models/RoutingRule');
const protect = require('../middleware/authMiddleware');
const User = require('../models/User');
const socketHelper = require('../socket');
const aiService = require('../services/aiService');
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

// Create incident (employees) with AI-powered triage, duplicate detection, and solution suggestions
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, category, severity } = req.body;
    const reporter = await User.findById(req.user.userId);

    // --- AI INTEGRATION: Predict triage, detect duplicates, suggest solutions ---
    let aiTriageData = {};
    let duplicateWarning = null;
    let suggestedSolutions = [];
    let aiGeneratedSolutions = [];
    let anomalyData = {};
    let embedding = [];

    try {
      // 1. AI-powered triage prediction (uses HuggingFace zero-shot classification)
      const triageResult = await aiService.predictTriage({ title, description });
      aiTriageData = {
        predictedCategory: triageResult.predictedCategory,
        predictedSeverity: triageResult.predictedSeverity,
        categoryConfidence: triageResult.categoryConfidence,
        severityConfidence: triageResult.severityConfidence,
        triageConfidence: triageResult.confidence,
        assignedTeam: triageResult.assignedTeam,
        aiPowered: triageResult.aiPowered || false,
        timestamp: new Date(),
      };

      // 2. Generate semantic embedding for similarity search
      embedding = await aiService.generateEmbedding(`${title}. ${description}`);

      // 3. Check for duplicates using semantic similarity
      const duplicateCheck = await aiService.findDuplicates({ title, description });
      if (duplicateCheck.hasDuplicates) {
        duplicateWarning = {
          message: duplicateCheck.recommendation,
          duplicates: duplicateCheck.duplicates,
          aiPowered: duplicateCheck.aiPowered,
        };
      }

      // 4. Suggest solutions from resolved issues + AI generation
      const solutionsResult = await aiService.suggestSolutions({
        title,
        description,
        category: triageResult.predictedCategory || category,
      });
      suggestedSolutions = solutionsResult.solutions;
      aiGeneratedSolutions = solutionsResult.aiGeneratedSolutions || [];

      // 5. Detect anomalies with enhanced AI analysis
      anomalyData = await aiService.detectAnomalies({
        title,
        description,
        category: triageResult.predictedCategory || category,
        severity: triageResult.predictedSeverity || severity,
      });
    } catch (aiErr) {
      console.warn('[incidents] AI service error:', aiErr.message);
      // Gracefully degrade if AI service fails - use fallback embedding
      embedding = aiService._generateEmbedding ? aiService._generateEmbedding(`${title} ${description}`) : [];
    }

    // Normalize category and severity from AI predictions
    const normalizeSeverity = (severity) => {
      if (!severity) return 'Low';
      const normalized = severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
      const validSeverities = ['Low', 'Medium', 'High', 'Critical'];
      return validSeverities.includes(normalized) ? normalized : 'Low';
    };

    const normalizeCategory = (category) => {
      if (!category) return 'IT';
      const validCategories = ['IT', 'HR', 'Facility'];
      return validCategories.includes(category) ? category : 'IT';
    };

    // Ensure suggestedSolutions maintains object structure
    const formatSuggestedSolutions = (solutions) => {
      return solutions
        .filter(s => s && (s.sourceIssueId || s.sourceTitle || s.solution))
        .map(s => ({
          sourceIssueId: s.sourceIssueId || undefined,
          sourceTitle: s.sourceTitle || 'Suggested Solution',
          solution: s.solution || (Array.isArray(s.solutions) ? s.solutions[0] : s),
          steps: Array.isArray(s.steps) ? s.steps : [],
          similarity: s.similarity || 0,
          resolution: s.resolution || undefined,
        }))
        .slice(0, 5);
    };

    // Create incident with AI predictions
    const incident = new Incident({
      title,
      description,
      // Use AI predictions as defaults, fallback to user input
      category: normalizeCategory(aiTriageData.predictedCategory || category),
      severity: normalizeSeverity(aiTriageData.predictedSeverity || severity),
      reportedBy: req.user.userId,
      reporterName: reporter ? reporter.name : undefined,
      // Store AI data
      embedding,
      aiTriageData,
      anomalyScore: anomalyData.anomalyScore || 0,
      anomalyFlags: anomalyData.flags || [],
      isAnomalous: anomalyData.isAnomaly || false,
      suggestedSolutions: formatSuggestedSolutions([...suggestedSolutions, ...aiGeneratedSolutions]),
    });

    // Apply routing rules + AI routing
    try {
      const rule = await RoutingRule.findOne({ category: incident.category });
      if (rule) {
        incident.assignedTeam = rule.assignedTeam;
        if (rule.assignedTo) {
          incident.assignedTo = rule.assignedTo;
          const assignee = await User.findById(rule.assignedTo);
          incident.assigneeName = assignee ? assignee.name : undefined;
        }
      } else if (aiTriageData.assignedTeam || triageResult?.assignedTeam) {
        // Fallback to AI routing if no routing rule exists
        incident.assignedTeam = aiTriageData.assignedTeam || triageResult?.assignedTeam;
      }
    } catch (rErr) {
      console.warn('[incidents] routing rule lookup failed', rErr);
    }

    // Initialize status history
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

    // Add activity entry
    incident.activity = incident.activity || [];
    incident.activity.push({
      type: 'created',
      message: 'Incident created',
      by: req.user.userId,
      byName: reporter ? reporter.name : undefined,
      at: new Date(),
    });

    await incident.save();

    // Emit socket event
    try {
      const io = socketHelper.getIO();
      if (io) io.emit('incident:created', incident);
    } catch (e) { }

    // Return incident with AI insights
    res.status(201).json({
      incident,
      aiInsights: {
        triage: aiTriageData,
        duplicateWarning,
        suggestedSolutions: suggestedSolutions.slice(0, 3),
        anomaly: anomalyData.isAnomaly ? anomalyData : null,
      },
    });
  } catch (error) {
    console.error('[incidents POST] error:', error);
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
    } catch (e) { }

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
    } catch (e) { }

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
    } catch (e) { }

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
    } catch (e) { }

    res.status(200).json(incident);
  } catch (err) {
    console.error('Assign error', err);
    res.status(500).json({ message: 'Assign failed' });
  }
});

// Check for duplicate incidents (real-time as user types)
router.post('/check-duplicate', protect, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description required' });
    }

    const duplicateResult = await aiService.findDuplicates({ title, description });

    res.status(200).json({
      hasDuplicates: duplicateResult.hasDuplicates,
      duplicates: duplicateResult.duplicates,
      recommendation: duplicateResult.recommendation,
    });
  } catch (err) {
    console.error('Duplicate check error', err);
    res.status(500).json({ message: 'Duplicate check failed' });
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

    // AI forecasting and anomaly detection
    const forecast = await aiService.forecastTicketVolume(7);
    const anomalies = incidents.filter((i) => i.isAnomalous).length;

    res.status(200).json({
      volume: volume.slice(-7),
      mttr: mttr || 0,
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      bySeverity: Object.entries(bySeverity).map(([severity, count]) => ({ severity, count })),
      forecast: {
        nextDays: forecast.forecast,
        trend: forecast.trend,
        avgHistorical: forecast.avgHistoricalVolume,
        confidence: forecast.confidence,
      },
      anomalies: {
        count: anomalies,
        percentage: ((anomalies / (incidents.length || 1)) * 100).toFixed(2),
      },
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

// ===== AI-POWERED ENDPOINTS =====

// Real-time AI triage prediction (as user types)
router.post('/ai/predict-triage', protect, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title && !description) {
      return res.status(400).json({ message: 'Title or description required' });
    }

    const triageResult = await aiService.predictTriage({
      title: title || '',
      description: description || ''
    });

    res.status(200).json({
      success: true,
      prediction: {
        category: triageResult.predictedCategory,
        severity: triageResult.predictedSeverity,
        categoryConfidence: Math.round((triageResult.categoryConfidence || 0) * 100),
        severityConfidence: Math.round((triageResult.severityConfidence || 0) * 100),
        assignedTeam: triageResult.assignedTeam,
        aiPowered: triageResult.aiPowered,
      },
    });
  } catch (err) {
    console.error('AI triage prediction error:', err);
    res.status(500).json({ message: 'AI prediction failed', error: err.message });
  }
});

// Generate AI solutions for an incident
router.post('/ai/generate-solutions', protect, async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description required' });
    }

    const solutions = await aiService.generateSolutionSuggestions({
      title,
      description,
      category: category || 'general',
    });

    res.status(200).json({
      success: true,
      solutions,
      aiPowered: true,
    });
  } catch (err) {
    console.error('AI solution generation error:', err);
    res.status(500).json({ message: 'Solution generation failed', error: err.message });
  }
});

// Summarize an incident description
router.post('/ai/summarize', protect, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text required' });
    }

    const summary = await aiService.summarizeIncident(text);

    res.status(200).json({
      success: true,
      summary,
      aiPowered: true,
    });
  } catch (err) {
    console.error('AI summarization error:', err);
    res.status(500).json({ message: 'Summarization failed', error: err.message });
  }
});

// Get AI-powered insights for an existing incident
router.get('/:id/ai-insights', protect, async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Get similar incidents
    const duplicates = await aiService.findDuplicates({
      title: incident.title,
      description: incident.description,
    });

    // Get solution suggestions
    const solutions = await aiService.suggestSolutions({
      title: incident.title,
      description: incident.description,
      category: incident.category,
    });

    // Get anomaly analysis
    const anomaly = await aiService.detectAnomalies({
      title: incident.title,
      description: incident.description,
      category: incident.category,
      severity: incident.severity,
    });

    res.status(200).json({
      success: true,
      insights: {
        similarIncidents: duplicates.duplicates,
        hasSimilar: duplicates.hasDuplicates,
        solutions: solutions.solutions,
        aiGeneratedSolutions: solutions.aiGeneratedSolutions,
        hasSolutions: solutions.hasSolutions,
        anomalyScore: anomaly.anomalyScore,
        isAnomalous: anomaly.isAnomaly,
        anomalyFlags: anomaly.flags,
        recommendation: anomaly.recommendation,
      },
      aiPowered: true,
    });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ message: 'AI insights failed', error: err.message });
  }
});

module.exports = router;
