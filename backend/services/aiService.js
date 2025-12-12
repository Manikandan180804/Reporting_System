const Issue = require('../models/Issue');
const User = require('../models/User');
const { HfInference } = require('@huggingface/inference');

/**
 * Enhanced AI Service for intelligent incident management
 * Uses HuggingFace Inference API for real ML capabilities:
 * - Semantic embeddings for duplicate detection
 * - Zero-shot classification for triage
 * - Text generation for solution suggestions
 */

class AIService {
  constructor() {
    // Initialize HuggingFace client
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

    // Model configurations
    this.embeddingModel = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
    this.classificationModel = process.env.HF_CLASSIFICATION_MODEL || 'facebook/bart-large-mnli';
    this.textGenModel = process.env.HF_TEXT_GENERATION_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

    // Cache for embeddings to reduce API calls
    this.embeddingCache = new Map();

    // Category and severity labels for zero-shot classification
    this.categoryLabels = ['infrastructure issue', 'application bug', 'security incident', 'database problem', 'general support request'];
    this.severityLabels = ['critical emergency', 'high priority', 'medium priority', 'low priority'];

    console.log('[AIService] Initialized with HuggingFace API');
  }

  /**
   * Generate semantic embeddings using HuggingFace Sentence Transformers
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - 384-dimensional embedding vector
   */
  async generateEmbedding(text) {
    try {
      // Check cache first
      const cacheKey = text.substring(0, 100);
      if (this.embeddingCache.has(cacheKey)) {
        return this.embeddingCache.get(cacheKey);
      }

      const result = await this.hf.featureExtraction({
        model: this.embeddingModel,
        inputs: text,
      });

      // Cache the result
      if (this.embeddingCache.size > 1000) {
        // Clear cache if too large
        this.embeddingCache.clear();
      }
      this.embeddingCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.warn('[AIService] Embedding generation failed:', error.message);
      // Fallback to simple embedding
      return this._generateFallbackEmbedding(text);
    }
  }

  /**
   * Zero-shot classification for incident category
   * @param {string} text - Incident text
   * @returns {Promise<{category: string, confidence: number}>}
   */
  async classifyCategory(text) {
    try {
      const result = await this.hf.zeroShotClassification({
        model: this.classificationModel,
        inputs: text,
        parameters: {
          candidate_labels: this.categoryLabels,
        },
      });

      const categoryMap = {
        'infrastructure issue': 'infrastructure',
        'application bug': 'application',
        'security incident': 'security',
        'database problem': 'database',
        'general support request': 'other',
      };

      // Handle both array and object response formats
      const data = Array.isArray(result) ? result[0] : result;

      if (!data || !data.labels || !data.scores) {
        console.warn('[AIService] Invalid classification response, using fallback');
        return this._classifyFallback(text);
      }

      const topLabel = data.labels[0];
      const topScore = data.scores[0];

      return {
        category: categoryMap[topLabel] || 'other',
        confidence: topScore,
        allScores: data.labels.map((label, i) => ({
          label: categoryMap[label] || label,
          score: data.scores[i],
        })),
      };
    } catch (error) {
      console.warn('[AIService] Category classification failed:', error.message);
      return this._classifyFallback(text);
    }
  }


  /**
   * Zero-shot classification for incident severity
   * @param {string} text - Incident text
   * @returns {Promise<{severity: string, confidence: number}>}
   */
  async classifySeverity(text) {
    try {
      const result = await this.hf.zeroShotClassification({
        model: this.classificationModel,
        inputs: text,
        parameters: {
          candidate_labels: this.severityLabels,
        },
      });

      const severityMap = {
        'critical emergency': 'critical',
        'high priority': 'high',
        'medium priority': 'medium',
        'low priority': 'low',
      };

      // Handle both array and object response formats
      const data = Array.isArray(result) ? result[0] : result;

      if (!data || !data.labels || !data.scores) {
        console.warn('[AIService] Invalid severity response, using fallback');
        return this._classifySeverityFallback(text);
      }

      const topLabel = data.labels[0];
      const topScore = data.scores[0];

      return {
        severity: severityMap[topLabel] || 'medium',
        confidence: topScore,
      };
    } catch (error) {
      console.warn('[AIService] Severity classification failed:', error.message);
      return this._classifySeverityFallback(text);
    }
  }

  /**
   * Generate AI-powered solution suggestions using LLM
   * @param {object} incidentData - Incident information
   * @returns {Promise<string[]>} - Array of suggested solutions
   */
  async generateSolutionSuggestions(incidentData) {
    try {
      const { title, description, category } = incidentData;

      const prompt = `<s>[INST] You are an IT support expert. Based on the following incident, provide 3 concise, actionable solutions.

Incident Category: ${category || 'General'}
Title: ${title}
Description: ${description}

Provide exactly 3 numbered solutions (1., 2., 3.) that are specific and actionable. Keep each solution under 100 words. [/INST]</s>`;

      const result = await this.hf.textGeneration({
        model: this.textGenModel,
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
        },
      });

      // Parse the generated text into solutions
      const generatedText = result.generated_text || '';
      const solutions = this._parseSolutions(generatedText);

      return solutions.length > 0 ? solutions : this._getDefaultSolutions(category);
    } catch (error) {
      console.warn('[AIService] Solution generation failed:', error.message);
      return this._getDefaultSolutions(incidentData.category);
    }
  }

  /**
   * Summarize incident for quick overview
   * @param {string} text - Full incident text
   * @returns {Promise<string>} - Summarized text
   */
  async summarizeIncident(text) {
    try {
      const prompt = `<s>[INST] Summarize this IT incident in one sentence (max 50 words):

${text}

Summary: [/INST]</s>`;

      const result = await this.hf.textGeneration({
        model: this.textGenModel,
        inputs: prompt,
        parameters: {
          max_new_tokens: 100,
          temperature: 0.3,
        },
      });

      return result.generated_text?.trim() || text.substring(0, 200);
    } catch (error) {
      console.warn('[AIService] Summarization failed:', error.message);
      return text.substring(0, 200) + '...';
    }
  }

  /**
   * Main triage prediction using real AI
   * Predicts category, severity, and optimal assignee based on incident text
   */
  async predictTriage(incidentData) {
    const { title, description } = incidentData;
    const text = `${title}. ${description}`;

    // Run classification in parallel for better performance
    const [categoryResult, severityResult] = await Promise.all([
      this.classifyCategory(text),
      this.classifySeverity(text),
    ]);

    // Determine assigned team based on category
    const assignedTeam = this._routeToTeam(categoryResult.category);

    // Find optimal assignee
    const optimalAssigneeId = await this._findOptimalAssignee(assignedTeam, severityResult.severity);

    return {
      predictedCategory: categoryResult.category,
      predictedSeverity: severityResult.severity,
      categoryConfidence: categoryResult.confidence,
      severityConfidence: severityResult.confidence,
      assignedTeam,
      optimalAssigneeId,
      confidence: (categoryResult.confidence + severityResult.confidence) / 2,
      aiPowered: true,
    };
  }

  /**
   * Find duplicate or similar issues using semantic embeddings
   * Uses cosine similarity on real embeddings
   */
  async findDuplicates(incidentData, similarityThreshold = 0.75) {
    const { title, description } = incidentData;
    const text = `${title}. ${description}`;

    // Generate embedding for new incident
    const newEmbedding = await this.generateEmbedding(text);

    // Find open/recent issues
    const openIssues = await Issue.find({
      status: { $in: ['open', 'investigating', 'in-progress', 'pending', 'Open', 'Investigating'] },
    }).select('title description embedding _id status severity reporterName updatedAt');

    const duplicates = [];

    for (const issue of openIssues) {
      let similarity;

      if (issue.embedding && issue.embedding.length > 0) {
        // Use stored embedding
        similarity = this._cosineSimilarity(newEmbedding, issue.embedding);
      } else {
        // Generate embedding on-the-fly
        const issueText = `${issue.title}. ${issue.description}`;
        const issueEmbedding = await this.generateEmbedding(issueText);
        similarity = this._cosineSimilarity(newEmbedding, issueEmbedding);

        // Store embedding for future use
        try {
          await Issue.findByIdAndUpdate(issue._id, { embedding: issueEmbedding });
        } catch (e) {
          // Ignore update errors
        }
      }

      if (similarity >= similarityThreshold) {
        duplicates.push({
          issueId: issue._id,
          title: issue.title,
          description: issue.description?.substring(0, 200),
          status: issue.status,
          severity: issue.severity,
          reporterName: issue.reporterName,
          updatedAt: issue.updatedAt,
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }

    // Sort by similarity and return top 3
    duplicates.sort((a, b) => b.similarity - a.similarity);
    const topDuplicates = duplicates.slice(0, 3);

    return {
      hasDuplicates: topDuplicates.length > 0,
      duplicates: topDuplicates,
      recommendation: topDuplicates.length > 0
        ? `🔍 AI found ${topDuplicates.length} similar issue(s) with ${Math.round(topDuplicates[0]?.similarity * 100)}% similarity. Please review before submitting.`
        : null,
      aiPowered: true,
    };
  }

  /**
   * Suggests solutions based on similar closed issues + AI generation
   */
  async suggestSolutions(incidentData) {
    const { title, description, category } = incidentData;
    const text = `${title}. ${description}`;
    const embedding = await this.generateEmbedding(text);

    // Find resolved issues in the same category
    const resolvedIssues = await Issue.find({
      status: { $in: ['resolved', 'Resolved'] },
      category: category || { $exists: true },
    })
      .select('title description suggestedSolutions embedding resolution _id')
      .limit(10);

    // Find similar resolved issues
    const similarSolutions = [];

    for (const issue of resolvedIssues) {
      let similarity;

      if (issue.embedding && issue.embedding.length > 0) {
        similarity = this._cosineSimilarity(embedding, issue.embedding);
      } else {
        const issueText = `${issue.title}. ${issue.description}`;
        const issueEmbedding = await this.generateEmbedding(issueText);
        similarity = this._cosineSimilarity(embedding, issueEmbedding);
      }

      if (similarity >= 0.6) {
        similarSolutions.push({
          sourceIssueId: issue._id,
          sourceTitle: issue.title,
          solutions: issue.suggestedSolutions || [],
          resolution: issue.resolution,
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }

    // Sort by similarity
    similarSolutions.sort((a, b) => b.similarity - a.similarity);
    const topMatches = similarSolutions.slice(0, 3);

    // Generate AI solutions if no similar issues found
    let aiGeneratedSolutions = [];
    if (topMatches.length === 0) {
      aiGeneratedSolutions = await this.generateSolutionSuggestions(incidentData);
    }

    return {
      solutions: topMatches,
      aiGeneratedSolutions,
      hasSolutions: topMatches.length > 0 || aiGeneratedSolutions.length > 0,
      message: topMatches.length > 0
        ? `✨ Found ${topMatches.length} similar resolved issue(s) with solutions.`
        : aiGeneratedSolutions.length > 0
          ? '🤖 AI generated suggestions based on the incident description.'
          : 'No similar resolved issues found. A responder will assist shortly.',
      aiPowered: true,
    };
  }

  /**
   * Enhanced anomaly detection with AI insights
   */
  async detectAnomalies(incidentData) {
    const { title, description, category, severity } = incidentData;
    const text = `${title}. ${description}`;

    // Fetch recent incidents for statistical comparison
    const recentIssues = await Issue.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }).select('severity category title description embedding');

    let anomalyScore = 0;
    const flags = [];

    // 1. Severity anomaly
    const severityMap = { low: 1, medium: 2, high: 3, critical: 4 };
    const recentSeverities = recentIssues.map((issue) => severityMap[issue.severity?.toLowerCase()] || 2);
    const avgSeverity = recentSeverities.length > 0
      ? recentSeverities.reduce((a, b) => a + b, 0) / recentSeverities.length
      : 2;
    const currentSeverity = severityMap[severity?.toLowerCase()] || 2;

    if (currentSeverity > avgSeverity + 1.5) {
      anomalyScore += 0.3;
      flags.push('🚨 Higher-than-average severity for this period');
    }

    // 2. Textual anomaly
    const wordCount = text.split(/\s+/).length;
    const avgWordCount = recentIssues.length > 0
      ? recentIssues.reduce((sum, issue) => {
        return sum + ((issue.title?.split(/\s+/).length || 0) + (issue.description?.split(/\s+/).length || 0));
      }, 0) / recentIssues.length
      : 50;

    if (wordCount > avgWordCount * 2.5) {
      anomalyScore += 0.15;
      flags.push('📊 Unusually detailed description');
    } else if (wordCount < avgWordCount * 0.2) {
      anomalyScore += 0.1;
      flags.push('📊 Unusually brief description');
    }

    // 3. Critical keyword detection
    const criticalKeywords = ['outage', 'breach', 'crash', 'down', 'urgent', 'critical', 'emergency', 'hacked', 'ransomware', 'data loss'];
    const textLower = text.toLowerCase();
    const foundCriticalKeywords = criticalKeywords.filter(kw => textLower.includes(kw));

    if (foundCriticalKeywords.length > 0 && severity !== 'critical') {
      anomalyScore += 0.25;
      flags.push(`⚠️ Critical keywords detected: ${foundCriticalKeywords.join(', ')}`);
    }

    // 4. Semantic similarity to critical issues
    if (recentIssues.length > 0) {
      const criticalIssues = recentIssues.filter(i => i.severity?.toLowerCase() === 'critical');
      if (criticalIssues.length > 0) {
        const embedding = await this.generateEmbedding(text);
        let maxSimilarity = 0;

        for (const issue of criticalIssues) {
          let similarity;
          if (issue.embedding && issue.embedding.length > 0) {
            similarity = this._cosineSimilarity(embedding, issue.embedding);
          } else {
            const issueEmbedding = await this.generateEmbedding(`${issue.title}. ${issue.description}`);
            similarity = this._cosineSimilarity(embedding, issueEmbedding);
          }
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        if (maxSimilarity > 0.8) {
          anomalyScore += 0.3;
          flags.push(`🔗 ${Math.round(maxSimilarity * 100)}% similar to a recent critical incident`);
        }
      }
    }

    const isAnomaly = anomalyScore > 0.45;

    return {
      anomalyScore: Math.min(anomalyScore, 1.0),
      isAnomaly,
      flags,
      recommendation: isAnomaly
        ? '⚡ This incident shows anomalous characteristics. Consider escalating to a senior responder.'
        : null,
      aiPowered: true,
    };
  }

  /**
   * Forecasts ticket volume for next N days
   */
  async forecastTicketVolume(days = 7) {
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
      return {
        forecast: Array(days).fill(5),
        trend: 'stable',
        avgHistoricalVolume: 5,
        confidence: 0.5,
        aiPowered: true,
      };
    }

    // Calculate statistics
    const avgVolume = dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length;
    const recentAvg = dailyVolumes.slice(-7).reduce((a, b) => a + b, 0) / Math.min(dailyVolumes.length, 7);
    const trend = recentAvg > avgVolume * 1.1 ? 'increasing' : recentAvg < avgVolume * 0.9 ? 'decreasing' : 'stable';

    const volatility = Math.sqrt(
      dailyVolumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / dailyVolumes.length
    );

    // Generate forecast with trend adjustment
    const trendMultiplier = trend === 'increasing' ? 1.05 : trend === 'decreasing' ? 0.95 : 1;
    const forecast = Array(days)
      .fill(0)
      .map((_, i) => {
        const base = recentAvg * Math.pow(trendMultiplier, i);
        const noise = (Math.random() - 0.5) * volatility * 0.5;
        return Math.max(1, Math.round(base + noise));
      });

    return {
      forecast,
      avgHistoricalVolume: Math.round(avgVolume),
      recentAverage: Math.round(recentAvg),
      trend,
      volatility: Math.round(volatility * 100) / 100,
      confidence: Math.min(0.85, 0.5 + (dailyVolumes.length / 60)),
      aiPowered: true,
    };
  }

  // ===== HELPER METHODS =====

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
   * Find optimal assignee based on team and workload
   */
  async _findOptimalAssignee(assignedTeam, severity) {
    try {
      const responders = await User.find({
        role: 'responder',
        department: assignedTeam,
      }).select('_id name department');

      if (responders.length === 0) {
        // Try to find any responder
        const anyResponder = await User.findOne({ role: 'responder' }).select('_id name');
        return anyResponder?._id || null;
      }

      // Get workload for each responder
      const responderWorkloads = await Promise.all(
        responders.map(async (responder) => {
          const openCount = await Issue.countDocuments({
            assignedTo: responder._id,
            status: { $in: ['open', 'investigating', 'in-progress', 'Open', 'Investigating'] },
          });
          return { responder, openCount };
        })
      );

      // Sort by workload (ascending) and return the one with least work
      responderWorkloads.sort((a, b) => a.openCount - b.openCount);

      return responderWorkloads[0]?.responder._id || null;
    } catch (error) {
      console.warn('[AIService] Failed to find optimal assignee:', error.message);
      return null;
    }
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

  /**
   * Parse LLM output into solutions array
   */
  _parseSolutions(text) {
    const solutions = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)/);
      if (match && match[1].trim().length > 10) {
        solutions.push(match[1].trim());
      }
    }

    return solutions.slice(0, 3);
  }

  /**
   * Get default solutions based on category
   */
  _getDefaultSolutions(category) {
    const defaults = {
      infrastructure: [
        'Check server logs and system health metrics',
        'Verify network connectivity and DNS resolution',
        'Review recent deployment changes or configuration updates',
      ],
      application: [
        'Clear application cache and restart the service',
        'Check application logs for error details',
        'Verify database connections and API endpoints',
      ],
      security: [
        'Immediately isolate affected systems',
        'Review access logs and audit trails',
        'Engage security team for incident response',
      ],
      database: [
        'Check database connection pool and query performance',
        'Review recent schema changes or migrations',
        'Verify backup status and consider point-in-time recovery',
      ],
    };

    return defaults[category] || [
      'Review incident details and gather more information',
      'Check related systems and dependencies',
      'Escalate to appropriate team if needed',
    ];
  }

  /**
   * Fallback embedding generation (when HF API fails)
   */
  _generateFallbackEmbedding(text) {
    const vector = [];
    const normalized = text.toLowerCase().split(/\s+/).slice(0, 50);

    for (let i = 0; i < 384; i++) {
      let sum = 0;
      for (let j = 0; j < normalized.length; j++) {
        sum += normalized[j].charCodeAt(j % normalized[j].length) || 0;
      }
      vector.push((Math.sin(sum + i) * Math.cos(i)) % 1);
    }

    return vector;
  }

  /**
   * Fallback category classification
   */
  _classifyFallback(text) {
    const categories = {
      'infrastructure': ['server', 'downtime', 'network', 'connectivity', 'hardware', 'deployment', 'dns', 'load balancer'],
      'application': ['crash', 'bug', 'error', 'app', 'feature', 'performance', 'slow', 'ui', 'frontend', 'backend'],
      'security': ['breach', 'vulnerability', 'attack', 'unauthorized', 'access', 'exploit', 'injection', 'malware', 'phishing'],
      'database': ['database', 'data', 'sql', 'query', 'backup', 'recovery', 'corruption', 'mongo', 'postgres'],
    };

    let detectedCategory = 'other';
    let maxScore = 0;
    const textLower = text.toLowerCase();

    for (const [category, keywords] of Object.entries(categories)) {
      const matches = keywords.filter((keyword) => textLower.includes(keyword)).length;
      if (matches > maxScore) {
        maxScore = matches;
        detectedCategory = category;
      }
    }

    return {
      category: detectedCategory,
      confidence: Math.min(0.5 + maxScore * 0.1, 0.9),
    };
  }

  /**
   * Fallback severity classification
   */
  _classifySeverityFallback(text) {
    const textLower = text.toLowerCase();
    const criticalKeywords = ['outage', 'breach', 'down', 'critical', 'urgent', 'emergency', 'hacked'];
    const highKeywords = ['error', 'crash', 'vulnerability', 'failure', 'timeout', 'broken'];
    const mediumKeywords = ['slow', 'issue', 'problem', 'bug', 'delay', 'intermittent'];

    if (criticalKeywords.some(kw => textLower.includes(kw))) {
      return { severity: 'critical', confidence: 0.8 };
    } else if (highKeywords.some(kw => textLower.includes(kw))) {
      return { severity: 'high', confidence: 0.75 };
    } else if (mediumKeywords.some(kw => textLower.includes(kw))) {
      return { severity: 'medium', confidence: 0.7 };
    }

    return { severity: 'low', confidence: 0.65 };
  }

  /**
   * Legacy method for backward compatibility with existing code
   */
  _generateEmbedding(text) {
    return this._generateFallbackEmbedding(text);
  }

  /**
   * Legacy method for backward compatibility
   */
  _classifyIncident(text) {
    const categoryResult = this._classifyFallback(text);
    const severityResult = this._classifySeverityFallback(text);
    return {
      category: categoryResult.category,
      severity: severityResult.severity,
    };
  }
}

module.exports = new AIService();
