/**
 * Speech Analytics Utility
 * Calculates WPM, detects filler words, sentiment analysis
 */

const Sentiment = require('sentiment');
const sentiment = new Sentiment();

// Common filler words and phrases
const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'basically', 'literally',
  'actually', 'sort of', 'kind of', 'i mean', 'you see',
  'right', 'okay', 'so', 'well', 'anyway', 'whatever',
  'hmm', 'er', 'ah', 'uhh', 'umm',
];

/**
 * Analyze speech text for various metrics
 */
const analyzeSpeech = (text, durationSeconds) => {
  if (!text || text.trim().length === 0) {
    return {
      wordCount: 0,
      wpm: 0,
      fillerWords: [],
      totalFillerCount: 0,
      fillerWordPercent: 0,
      sentiment: { score: 0, label: 'neutral', comparative: 0 },
      avgWordLength: 0,
      sentenceCount: 0,
    };
  }

  const words = text.trim().split(/\s+/);
  const wordCount = words.length;

  // Calculate WPM
  const durationMinutes = durationSeconds / 60;
  const wpm = durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;

  // Detect filler words
  const lowerText = text.toLowerCase();
  const fillerWords = [];

  FILLER_WORDS.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      fillerWords.push({ word: filler, count: matches.length });
    }
  });

  const totalFillerCount = fillerWords.reduce((sum, f) => sum + f.count, 0);
  const fillerWordPercent = wordCount > 0 ? Math.round((totalFillerCount / wordCount) * 100) : 0;

  // Sentiment analysis
  const sentimentResult = sentiment.analyze(text);
  const sentimentLabel = sentimentResult.score > 0.5
    ? 'positive'
    : sentimentResult.score < -0.5
      ? 'negative'
      : 'neutral';

  // Additional metrics
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(wordCount, 1);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  return {
    wordCount,
    wpm,
    fillerWords: fillerWords.sort((a, b) => b.count - a.count),
    totalFillerCount,
    fillerWordPercent,
    sentiment: {
      score: sentimentResult.score,
      comparative: sentimentResult.comparative,
      label: sentimentLabel,
    },
    avgWordLength: Math.round(avgWordLength * 10) / 10,
    sentenceCount: sentences.length,
  };
};

/**
 * Get WPM interpretation
 */
const interpretWPM = (wpm) => {
  if (wpm < 100) return { label: 'Too slow', color: 'orange', suggestion: 'Try to speak more naturally and at a steady pace.' };
  if (wpm < 130) return { label: 'Slightly slow', color: 'yellow', suggestion: 'Your pace is good but could be slightly faster.' };
  if (wpm <= 160) return { label: 'Optimal', color: 'green', suggestion: 'Great speaking pace! Clear and easy to follow.' };
  if (wpm <= 200) return { label: 'Slightly fast', color: 'yellow', suggestion: 'Slow down a bit to ensure clarity.' };
  return { label: 'Too fast', color: 'red', suggestion: 'You are speaking too quickly. Take pauses between key points.' };
};

/**
 * Calculate confidence score based on speech metrics
 */
const calculateConfidenceScore = ({ wpm, fillerWordPercent, sentimentScore, wordCount }) => {
  let score = 70; // Base score

  // WPM contribution (optimal 130-160)
  if (wpm >= 130 && wpm <= 160) score += 15;
  else if (wpm >= 110 && wpm <= 180) score += 8;
  else score -= 10;

  // Filler words (fewer is better)
  if (fillerWordPercent === 0) score += 10;
  else if (fillerWordPercent <= 5) score += 5;
  else if (fillerWordPercent <= 10) score -= 5;
  else score -= 15;

  // Sentiment (positive correlates with confidence)
  if (sentimentScore > 0) score += 5;
  else if (sentimentScore < -1) score -= 5;

  // Length (too short = not confident)
  if (wordCount < 20) score -= 10;
  else if (wordCount >= 50) score += 5;

  return Math.max(0, Math.min(100, score));
};

module.exports = { analyzeSpeech, interpretWPM, calculateConfidenceScore };
