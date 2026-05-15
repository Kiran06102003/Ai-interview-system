/**
 * Dashboard Controller
 * Provides analytics, history, and performance insights
 */

const Interview = require('../models/Interview');
const User = require('../models/User');

// ─── Get Dashboard Data ───────────────────────────────────────────────────────
const getDashboardData = async (req, res) => {
  try {
    const userId = req.userId;

    // Get recent interviews
    const interviews = await Interview.find({ userId, status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(20)
      .select('sessionId mode difficulty overallScore completedAt duration questionsCount performanceSummary targetRole');

    const user = await User.findById(userId).select('-password');

    // Calculate skill-wise analytics
    const skillAnalytics = {};
    const modeAnalytics = { hr: [], technical: [], mixed: [] };
    const scoreHistory = [];
    const wpmHistory = [];

    interviews.forEach(interview => {
      // Score history for trend chart
      scoreHistory.push({
        date: interview.completedAt,
        score: interview.overallScore,
        mode: interview.mode,
      });

      // WPM history
      if (interview.performanceSummary?.averageWpm) {
        wpmHistory.push({
          date: interview.completedAt,
          wpm: interview.performanceSummary.averageWpm,
        });
      }

      // Mode analytics
      if (modeAnalytics[interview.mode]) {
        modeAnalytics[interview.mode].push(interview.overallScore);
      }
    });

    // Average by mode
    const modeAverages = {};
    Object.keys(modeAnalytics).forEach(mode => {
      const scores = modeAnalytics[mode];
      modeAverages[mode] = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    });

    // Improvement trend (compare first half vs second half)
    let improvementTrend = 0;
    if (scoreHistory.length >= 4) {
      const half = Math.floor(scoreHistory.length / 2);
      const recentAvg = scoreHistory.slice(0, half).reduce((sum, s) => sum + s.score, 0) / half;
      const olderAvg = scoreHistory.slice(half).reduce((sum, s) => sum + s.score, 0) / (scoreHistory.length - half);
      improvementTrend = Math.round(recentAvg - olderAvg);
    }

    res.json({
      user: {
        name: user.name,
        email: user.email,
        targetRole: user.targetRole,
        skills: user.skills,
        experience: user.experience,
        totalInterviews: user.totalInterviews,
        averageScore: user.averageScore,
      },
      stats: {
        totalInterviews: interviews.length,
        averageScore: user.averageScore || 0,
        improvementTrend,
        bestScore: interviews.length > 0 ? Math.max(...interviews.map(i => i.overallScore)) : 0,
        modeAverages,
      },
      charts: {
        scoreHistory: scoreHistory.reverse(), // Oldest first for charts
        wpmHistory: wpmHistory.reverse(),
      },
      recentInterviews: interviews.slice(0, 5),
    });
  } catch (err) {
    console.error('Dashboard data error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// ─── Get Interview History ────────────────────────────────────────────────────
const getInterviewHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, mode, difficulty } = req.query;
    const query = { userId: req.userId, status: 'completed' };

    if (mode) query.mode = mode;
    if (difficulty) query.difficulty = difficulty;

    const total = await Interview.countDocuments(query);
    const interviews = await Interview.find(query)
      .sort({ completedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('sessionId mode difficulty overallScore completedAt duration questionsCount performanceSummary targetRole');

    res.json({
      interviews,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch interview history' });
  }
};

// ─── Get Performance Analytics ────────────────────────────────────────────────
const getPerformanceAnalytics = async (req, res) => {
  try {
    const interviews = await Interview.find({
      userId: req.userId,
      status: 'completed',
    }).select('answers overallScore completedAt mode difficulty performanceSummary');

    // Aggregate answer-level metrics
    const allAnswers = interviews.flatMap(i => i.answers);

    const avgScores = {
      relevance: 0,
      clarity: 0,
      confidence: 0,
      structure: 0,
      overall: 0,
    };

    if (allAnswers.length > 0) {
      allAnswers.forEach(a => {
        avgScores.relevance += a.aiAnalysis?.relevanceScore || 0;
        avgScores.clarity += a.aiAnalysis?.clarityScore || 0;
        avgScores.confidence += a.aiAnalysis?.confidenceScore || 0;
        avgScores.structure += a.aiAnalysis?.structureScore || 0;
        avgScores.overall += a.aiAnalysis?.overallScore || 0;
      });

      Object.keys(avgScores).forEach(key => {
        avgScores[key] = Math.round(avgScores[key] / allAnswers.length);
      });
    }

    // Filler word analysis
    const fillerWordMap = {};
    allAnswers.forEach(a => {
      a.fillerWords?.forEach(fw => {
        fillerWordMap[fw.word] = (fillerWordMap[fw.word] || 0) + fw.count;
      });
    });

    const topFillerWords = Object.entries(fillerWordMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    // WPM distribution
    const wpmData = allAnswers
      .filter(a => a.wpm > 0)
      .map(a => a.wpm);

    const avgWpm = wpmData.length > 0
      ? Math.round(wpmData.reduce((a, b) => a + b, 0) / wpmData.length)
      : 0;

    res.json({
      avgScores,
      topFillerWords,
      avgWpm,
      totalAnswers: allAnswers.length,
      scoreRadar: [
        { metric: 'Relevance', score: avgScores.relevance },
        { metric: 'Clarity', score: avgScores.clarity },
        { metric: 'Confidence', score: avgScores.confidence },
        { metric: 'Structure', score: avgScores.structure },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch performance analytics' });
  }
};

module.exports = { getDashboardData, getInterviewHistory, getPerformanceAnalytics };
