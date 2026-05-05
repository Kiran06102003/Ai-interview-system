/**
 * Interview Model
 * Stores complete interview sessions with questions, answers, and feedback
 */

const mongoose = require('mongoose');

// Individual answer schema
const answerSchema = new mongoose.Schema({
  questionIndex: Number,
  question: String,
  transcribedText: String,
  audioUrl: String,
  duration: Number, // seconds
  wpm: Number, // words per minute
  fillerWords: [{
    word: String,
    count: Number,
  }],
  sentiment: {
    score: Number, // -1 to 1
    label: String, // positive/neutral/negative
  },
  aiAnalysis: {
    relevanceScore: Number,    // 0-100
    clarityScore: Number,      // 0-100
    confidenceScore: Number,   // 0-100
    structureScore: Number,    // 0-100
    overallScore: Number,      // 0-100
    feedback: String,
    idealAnswer: String,
    strengths: [String],
    improvements: [String],
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

// Question schema
const questionSchema = new mongoose.Schema({
  text: String,
  type: {
    type: String,
    enum: ['behavioral', 'technical', 'situational', 'general', 'hr'],
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
  },
  category: String,
  askedAt: Date,
});

const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // Interview configuration
  mode: {
    type: String,
    enum: ['hr', 'technical', 'mixed'],
    default: 'mixed',
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  targetRole: String,
  skills: [String],
  language: {
    type: String,
    default: 'en',
  },
  // Session state
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active',
    index: true,
  },
  // Questions and answers
  questions: [questionSchema],
  answers: [answerSchema],
  // Session timing
  startedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
  duration: Number, // total seconds
  // Overall performance
  overallScore: {
    type: Number,
    default: 0,
  },
  performanceSummary: {
    averageWpm: Number,
    totalFillerWords: Number,
    averageSentiment: Number,
    strongestSkill: String,
    weakestSkill: String,
    overallFeedback: String,
    recommendedTopics: [String],
  },
  // Metadata
  questionsCount: {
    type: Number,
    default: 5,
  },
}, {
  timestamps: true,
});

// Calculate overall score from answers
interviewSchema.methods.calculateOverallScore = function () {
  if (this.answers.length === 0) return 0;
  const total = this.answers.reduce((sum, a) => sum + (a.aiAnalysis?.overallScore || 0), 0);
  return Math.round(total / this.answers.length);
};

// Virtual for completion percentage
interviewSchema.virtual('completionPercent').get(function () {
  if (this.questionsCount === 0) return 0;
  return Math.round((this.answers.length / this.questionsCount) * 100);
});

module.exports = mongoose.model('Interview', interviewSchema);
