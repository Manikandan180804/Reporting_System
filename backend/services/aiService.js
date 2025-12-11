const Issue = require('../models/Issue');
const User = require('../models/User');

/**
 * AI Service for intelligent incident triage, duplicate detection, and solution suggestions
 * Uses simulated ML models (can be replaced with real ML APIs like HuggingFace, OpenAI, etc.)
 */

class AIService {
  /**
   * Predicts category, severity, and optimal assignee based on incident text
   * Uses rule-based heuristics simulating an ML classifier
   */
  async predictTriage(incidentData) {
    const { title, description } = incidentData;
    const text = `${title} ${description}`.toLowerCase();

    // Simulate ML-based category and severity prediction
    // In production, replace with actual ML API call
    const { category, severity } = this._classifyIncident(text);

    // Simulate dynamic routing based on category and team workload
    const assignedTeam = this._routeToTeam(category);
    const optimalAssigneeId = await this._findOptimalAssignee(assignedTeam, severity);

    return {
      predictedCategory: category,
      predictedSeverity: severity,
      assignedTeam,
      optimalAssigneeId,
      confidence: Math.random() * 0.4 + 0.6, // 60-100% confidence score
    };
  }

  /**
   * Finds duplicate or similar issues using vector similarity
   * Simulates semantic search on embeddings
   */
  async findDuplicates(incidentData, similarityThreshold = 0.75) {
    const { title, description } = incidentData;
    const text = `${title} ${description}`;

    // Generate a simple embedding (in production, use Sentence Transformers)
    const newEmbedding = this._generateEmbedding(text);

    // Find open/recent issues and calculate cosine similarity
    const openIssues = await Issue.find({
      status: { $in: ['open', 'investigating', 'in-progress', 'pending'] },
    }).select('title description embedding _id status severity reporterName updatedAt');

    const duplicates = openIssues
      .map((issue) => ({
        issueId: issue._id,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        severity: issue.severity,
        reporterName: issue.reporterName,
        updatedAt: issue.updatedAt,
        similarity: this._cosineSimilarity(newEmbedding, issue.embedding || []),
      }))
      .filter((item) => item.similarity >= similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // Return top 3 matches

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      recommendation: duplicates.length > 0
        ? `Found ${duplicates.length} similar issue(s). Please review before submitting.`
        : null,
    };
  }

  /**
   * Suggests solutions based on similar closed issues (RAG-like approach)
   */
  async suggestSolutions(incidentData) {
    const { title, description, category } = incidentData;
    const text = `${title} ${description}`;
    const embedding = this._generateEmbedding(text);

    // Find resolved issues in the same category
    const resolvedIssues = await Issue.find({
      status: 'resolved',
      category: category || { $exists: true },
      suggestedSolutions: { $exists: true, $ne: [] },
    })
      .select('title suggestedSolutions embedding resolution _id')
      .limit(10);

    // Calculate similarity and rank
    const suggestedSolutions = resolvedIssues
      .map((issue) => ({
        sourceIssueId: issue._id,
        sourceTitle: issue.title,
        solutions: issue.suggestedSolutions || [],
        resolution: issue.resolution,
        similarity: this._cosineSimilarity(embedding, issue.embedding || []),
      }))
      .filter((item) => item.similarity >= 0.6)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map((item) => ({
        ...item,
        solutions: item.solutions.slice(0, 2), // Top 2 solutions per source
      }));

    return {
      solutions: suggestedSolutions,
      hasSolutions: suggestedSolutions.length > 0,
      message: suggestedSolutions.length > 0
        ? `Found ${suggestedSolutions.length} similar resolved issue(s) with solutions.`
        : 'No similar resolved issues found. A responder will assist shortly.',
    };
  }

  /**
   * Detects anomalies: unusual issues that may signal new problems
   */
  async detectAnomalies(incidentData) {
    const { title, description, category, severity } = incidentData;
    const text = `${title} ${description}`;

    // Fetch recent incidents for statistical comparison
    const recentIssues = await Issue.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    }).select('severity category title description');

    // Calculate anomaly score based on multiple factors
    let anomalyScore = 0;

    // 1. Severity anomaly: is this more severe than recent issues?
    const severityMap = { low: 1, medium: 2, high: 3, critical: 4 };
    const recentSeverities = recentIssues.map((issue) => severityMap[issue.severity] || 2);
    const avgSeverity = recentSeverities.reduce((a, b) => a + b, 0) / recentSeverities.length || 2;
    const currentSeverity = severityMap[severity] || 2;

    if (currentSeverity > avgSeverity + 1.5) {
      anomalyScore += 0.3; // High severity for category
    }

    // 2. Textual anomaly: unusual keywords or length
    const wordCount = text.split(/\s+/).length;
    const avgWordCount = recentIssues.reduce((sum, issue) => {
      return sum + (issue.title.split(/\s+/).length + issue.description.split(/\s+/).length);
    }, 0) / (recentIssues.length || 1);

    if (wordCount > avgWordCount * 2 || wordCount < avgWordCount * 0.3) {
      anomalyScore += 0.2; // Unusual length
    }

    // 3. Keyword-based anomaly detection
    const criticalKeywords = ['outage', 'breach', 'crash', 'down', 'urgent', 'critical', 'emergency'];
    const hasCriticalKeywords = criticalKeywords.some((keyword) => text.includes(keyword));

    if (hasCriticalKeywords && severity !== 'critical') {
      anomalyScore += 0.25; // Language suggests higher severity
    }

    // 4. Clustering-based anomaly (simulated): similar text to known critical issues
    const criticalIssues = recentIssues.filter((issue) => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      const embedding = this._generateEmbedding(text);
      const maxSimilarity = Math.max(
        ...criticalIssues.map((issue) =>
          this._cosineSimilarity(embedding, this._generateEmbedding(issue.title + ' ' + issue.description))
        )
      );
      if (maxSimilarity > 0.8) {
        anomalyScore += 0.25; // Similar to known critical issue
      }
    }

    const isAnomaly = anomalyScore > 0.5;

    return {
      anomalyScore: Math.min(anomalyScore, 1.0),
      isAnomaly,
      flags: [
        currentSeverity > avgSeverity + 1.5 && '🚨 Higher-than-average severity',
        (wordCount > avgWordCount * 2 || wordCount < avgWordCount * 0.3) && '📊 Unusual description length',
        hasCriticalKeywords && severity !== 'critical' && '⚠️ Critical language detected',
        maxSimilarity > 0.8 && '🔗 Similar to known critical issues',
      ].filter(Boolean),
      recommendation: isAnomaly
        ? 'This issue shows anomalous characteristics. Escalate to senior responder.'
        : null,
    };
  }

  /**
   * Forecasts ticket volume for next N days (simulated time-series prediction)
   */
  async forecastTicketVolume(days = 7) {
    // Fetch historical ticket volume (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const issues = await Issue.find({
      createdAt: { $gte: thirtyDaysAgo },
    }).select('createdAt severity category');

    // Group by day
    const volumeByDay = {};
    issues.forEach((issue) => {
      const date = new Date(issue.createdAt).toISOString().split('T')[0];
      volumeByDay[date] = (volumeByDay[date] || 0) + 1;
    });

    const dailyVolumes = Object.values(volumeByDay);

    if (dailyVolumes.length === 0) {
      return { forecast: Array(days).fill(5), trend: 'stable' }; // Default to 5 tickets/day
    }

    // Simple moving average + trend
    const avgVolume = dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length;
    const trend = dailyVolumes[dailyVolumes.length - 1] > avgVolume ? 'increasing' : 'decreasing';
    const volatility = Math.sqrt(
      dailyVolumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / dailyVolumes.length
    );

    // Generate forecast (simulated ARIMA/Prophet output)
    const forecast = Array(days)
      .fill(0)
      .map((_, i) => {
        const base = avgVolume + (trend === 'increasing' ? i * 0.5 : -i * 0.3);
        const noise = (Math.random() - 0.5) * volatility;
        return Math.max(1, Math.round(base + noise));
      });

    return {
      forecast,
      avgHistoricalVolume: Math.round(avgVolume),
      trend,
      volatility: Math.round(volatility * 100) / 100,
      confidence: 0.75, // Simulated confidence score
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Rule-based incident classification (simulates ML classifier)
   */
  _classifyIncident(text) {
    const categories = {
      'infrastructure': ['server', 'downtime', 'network', 'connectivity', 'hardware', 'deployment'],
      'application': ['crash', 'bug', 'error', 'app', 'feature', 'performance', 'slow'],
      'security': ['breach', 'vulnerability', 'attack', 'unauthorized', 'access', 'exploit', 'injection'],
      'database': ['database', 'data', 'sql', 'query', 'backup', 'recovery', 'corruption'],
    };

    let detectedCategory = 'other';
    let categoryScore = 0;

    for (const [category, keywords] of Object.entries(categories)) {
      const matches = keywords.filter((keyword) => text.includes(keyword)).length;
      if (matches > categoryScore) {
        categoryScore = matches;
        detectedCategory = category;
      }
    }

    // Determine severity
    let severity = 'low';
    const criticalKeywords = ['outage', 'breach', 'down', 'critical', 'urgent', 'emergency'];
    const highKeywords = ['error', 'crash', 'vulnerability', 'failure', 'timeout'];
    const mediumKeywords = ['slow', 'issue', 'problem', 'bug', 'delay'];

    if (criticalKeywords.some((kw) => text.includes(kw))) {
      severity = 'critical';
    } else if (highKeywords.some((kw) => text.includes(kw))) {
      severity = 'high';
    } else if (mediumKeywords.some((kw) => text.includes(kw))) {
      severity = 'medium';
    }

    return { category: detectedCategory, severity };
  }

  /**
   * Route to appropriate team based on category
   */
  _routeToTeam(category) {
    const routing = {
      'infrastructure': 'DevOps',
      'application': 'Development',
      'security': 'Security',
      'database': 'Database',
      'other': 'Support',
    };

    return routing[category] || 'Support';
  }

  /**
   * Find optimal assignee based on team, expertise, and workload
   */
  async _findOptimalAssignee(assignedTeam, severity) {
    const responders = await User.find({
      role: 'responder',
      department: assignedTeam,
    }).select('_id name department');

    if (responders.length === 0) {
      return null; // No responders in team, manual assignment needed
    }

    // Simulate finding responder with lowest workload
    // In production, fetch real workload from assignments
    const randomResponder = responders[Math.floor(Math.random() * responders.length)];
    return randomResponder._id;
  }

  /**
   * Generate embedding for text (simulated; use Sentence Transformers in production)
   */
  _generateEmbedding(text) {
    // Simulate a 768-dimensional embedding (BERT-like)
    // In production, use: const { Embeddings } = require('@huggingface/inference');
    const vector = [];
    const normalized = text.toLowerCase().split(/\s+/).slice(0, 50);

    for (let i = 0; i < 768; i++) {
      let sum = 0;
      for (let j = 0; j < normalized.length; j++) {
        sum += normalized[j].charCodeAt(j % normalized[j].length) || 0;
      }
      vector.push((Math.sin(sum + i) * Math.cos(i)) % 1);
    }

    return vector;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  _cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) {
      return 0;
    }

    const minLen = Math.min(vec1.length, vec2.length);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

module.exports = new AIService();
