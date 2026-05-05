/**
 * Interview Controller
 * Handles interview session management, answer processing, and feedback
 */

const { v4: uuidv4 } = require('uuid');
const Interview = require('../models/Interview');
const User = require('../models/User');
const { generateQuestions, analyzeAnswer, generateSessionSummary, transcribeAudio } = require('../ai-services/openaiService');
const { analyzeSpeech, calculateConfidenceScore } = require('../utils/speechAnalytics');

// ─── Start Interview ───────────────────────────────────────────────────────────
const startInterview = async (req, res) => {
  try {
    const { mode = 'mixed', difficulty = 'medium', questionsCount = 5, language = 'en' } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sessionId = uuidv4();

    // Generate questions
    const questionsData = await generateQuestions({
      targetRole: user.targetRole,
      skills: user.skills,
      difficulty,
      mode,
      count: Math.min(questionsCount, 10),
      resumeText: user.resumeText,
      language,
    });

    // Create interview session
    const interview = new Interview({
      userId: req.userId,
      sessionId,
      mode,
      difficulty,
      targetRole: user.targetRole,
      skills: user.skills,
      language,
      questionsCount: questionsData.length,
      questions: questionsData.map(q => ({
        ...q,
        askedAt: null,
      })),
    });

    await interview.save();

    res.status(201).json({
      message: 'Interview session started',
      sessionId,
      interviewId: interview._id,
      questions: questionsData,
      totalQuestions: questionsData.length,
    });
  } catch (err) {
    console.error('Start interview error:', err);
    res.status(500).json({ error: 'Failed to start interview session' });
  }
};

// ─── Submit Answer (text-based) ───────────────────────────────────────────────
const submitAnswer = async (req, res) => {
  try {
    const { sessionId, questionIndex, transcribedText, duration = 30 } = req.body;

    const interview = await Interview.findOne({ sessionId, userId: req.userId });
    if (!interview) {
      return res.status(404).json({ error: 'Interview session not found' });
    }

    if (interview.status !== 'active') {
      return res.status(400).json({ error: 'Interview session is not active' });
    }

    const question = interview.questions[questionIndex];
    if (!question) {
      return res.status(400).json({ error: 'Question not found' });
    }

    // Run speech analytics
    const speechMetrics = analyzeSpeech(transcribedText, duration);
    const confidenceScore = calculateConfidenceScore({
      wpm: speechMetrics.wpm,
      fillerWordPercent: speechMetrics.fillerWordPercent,
      sentimentScore: speechMetrics.sentiment.score,
      wordCount: speechMetrics.wordCount,
    });

    // AI analysis
    const aiAnalysis = await analyzeAnswer({
      question: question.text,
      answer: transcribedText,
      role: interview.targetRole,
      difficulty: interview.difficulty,
      language: interview.language,
    });

    // Override confidence score with our computed value
    aiAnalysis.confidenceScore = confidenceScore;
    aiAnalysis.overallScore = Math.round(
      (aiAnalysis.relevanceScore * 0.35 +
        aiAnalysis.clarityScore * 0.25 +
        confidenceScore * 0.20 +
        aiAnalysis.structureScore * 0.20)
    );

    // Build answer document
    const answerDoc = {
      questionIndex,
      question: question.text,
      transcribedText,
      duration,
      wpm: speechMetrics.wpm,
      fillerWords: speechMetrics.fillerWords,
      sentiment: speechMetrics.sentiment,
      aiAnalysis,
    };

    // Save to interview
    const existingAnswerIdx = interview.answers.findIndex(a => a.questionIndex === questionIndex);
    if (existingAnswerIdx >= 0) {
      interview.answers[existingAnswerIdx] = answerDoc;
    } else {
      interview.answers.push(answerDoc);
    }

    // Update question asked time
    if (!interview.questions[questionIndex].askedAt) {
      interview.questions[questionIndex].askedAt = new Date();
    }

    await interview.save();

    // Emit live feedback via Socket.IO
    const io = req.app.get('io');
    io.to(sessionId).emit('live_feedback', {
      questionIndex,
      metrics: {
        wpm: speechMetrics.wpm,
        fillerWords: speechMetrics.fillerWords,
        sentiment: speechMetrics.sentiment,
        duration,
        wordCount: speechMetrics.wordCount,
      },
      score: aiAnalysis.overallScore,
      feedback: aiAnalysis.feedback,
    });

    res.json({
      message: 'Answer processed successfully',
      analysis: aiAnalysis,
      speechMetrics: {
        wpm: speechMetrics.wpm,
        fillerWords: speechMetrics.fillerWords,
        totalFillerCount: speechMetrics.totalFillerCount,
        sentiment: speechMetrics.sentiment,
        wordCount: speechMetrics.wordCount,
      },
    });
  } catch (err) {
    console.error('Submit answer error:', err);
    res.status(500).json({ error: 'Failed to process answer' });
  }
};

// ─── Process Audio Answer ─────────────────────────────────────────────────────
const processAudioAnswer = async (req, res) => {
  try {
    const { sessionId, questionIndex, duration } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Transcribe audio using Whisper
    let transcribedText;
    try {
      transcribedText = await transcribeAudio(audioFile.buffer, audioFile.mimetype);
    } catch (transcribeErr) {
      return res.status(422).json({ error: 'Failed to transcribe audio: ' + transcribeErr.message });
    }

    // Process same as text answer
    req.body.transcribedText = transcribedText;
    req.body.duration = parseFloat(duration) || 30;

    // Delegate to submitAnswer
    return submitAnswer(req, res);
  } catch (err) {
    console.error('Audio answer error:', err);
    res.status(500).json({ error: 'Failed to process audio answer' });
  }
};

// ─── End Interview & Get Feedback ─────────────────────────────────────────────
const endInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const interview = await Interview.findOne({ sessionId, userId: req.userId });
    if (!interview) {
      return res.status(404).json({ error: 'Interview session not found' });
    }

    if (interview.status === 'completed') {
      return res.json({
        message: 'Interview already completed',
        summary: interview.performanceSummary,
        overallScore: interview.overallScore,
      });
    }

    // Generate overall summary
    const summaryData = await generateSessionSummary({
      answers: interview.answers,
      role: interview.targetRole,
      mode: interview.mode,
    });

    // Calculate aggregate metrics
    const totalDuration = interview.answers.reduce((sum, a) => sum + (a.duration || 0), 0);
    const avgWpm = interview.answers.reduce((sum, a) => sum + (a.wpm || 0), 0) / Math.max(interview.answers.length, 1);
    const totalFillerWords = interview.answers.reduce((sum, a) => sum + (a.fillerWords?.reduce((s, f) => s + f.count, 0) || 0), 0);
    const avgSentiment = interview.answers.reduce((sum, a) => sum + (a.sentiment?.score || 0), 0) / Math.max(interview.answers.length, 1);

    // Update interview
    interview.status = 'completed';
    interview.completedAt = new Date();
    interview.duration = totalDuration;
    interview.overallScore = summaryData.overallScore;
    interview.performanceSummary = {
      averageWpm: Math.round(avgWpm),
      totalFillerWords,
      averageSentiment: Math.round(avgSentiment * 100) / 100,
      strongestSkill: summaryData.strongestSkill,
      weakestSkill: summaryData.weakestSkill,
      overallFeedback: summaryData.overallFeedback,
      recommendedTopics: summaryData.recommendedTopics,
    };

    await interview.save();

    // Update user statistics
    const user = await User.findById(req.userId);
    const prevTotal = user.totalInterviews || 0;
    const prevAvg = user.averageScore || 0;
    user.totalInterviews = prevTotal + 1;
    user.averageScore = Math.round((prevAvg * prevTotal + summaryData.overallScore) / (prevTotal + 1));
    await user.save();

    // Emit end event
    const io = req.app.get('io');
    io.to(sessionId).emit('end_interview', {
      overallScore: summaryData.overallScore,
      summary: interview.performanceSummary,
    });

    res.json({
      message: 'Interview completed',
      overallScore: summaryData.overallScore,
      summary: interview.performanceSummary,
      answers: interview.answers,
      duration: totalDuration,
    });
  } catch (err) {
    console.error('End interview error:', err);
    res.status(500).json({ error: 'Failed to end interview session' });
  }
};

// ─── Get Interview Details ────────────────────────────────────────────────────
const getInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const interview = await Interview.findOne({ sessionId, userId: req.userId });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json({ interview });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
};

// ─── Get Feedback (per question) ──────────────────────────────────────────────
const getFeedback = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionIndex } = req.query;

    const interview = await Interview.findOne({ sessionId, userId: req.userId });
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (questionIndex !== undefined) {
      const answer = interview.answers.find(a => a.questionIndex === parseInt(questionIndex));
      return res.json({ feedback: answer?.aiAnalysis || null });
    }

    res.json({ feedback: interview.answers.map(a => a.aiAnalysis) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};

module.exports = {
  startInterview,
  submitAnswer,
  processAudioAnswer,
  endInterview,
  getInterview,
  getFeedback,
};
