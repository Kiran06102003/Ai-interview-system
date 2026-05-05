/**
 * Upload Routes - Resume parsing and TTS generation
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { generateTTS, audioToBase64 } = require('../ai-services/ttsService');
const User = require('../models/User');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload resume text
router.post('/resume', authenticate, async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) {
      return res.status(400).json({ error: 'Resume text is required' });
    }

    await User.findByIdAndUpdate(req.userId, { resumeText: resumeText.substring(0, 5000) });
    res.json({ message: 'Resume uploaded successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save resume' });
  }
});

// Generate TTS for a question (REST fallback)
router.post('/tts', authenticate, async (req, res) => {
  try {
    const { text, voice = 'professional' } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const result = await generateTTS(text, voice);
    if (!result) {
      return res.status(503).json({ error: 'TTS service unavailable' });
    }

    const audioBase64 = audioToBase64(result.audio, result.mimeType);
    res.json({ audio: audioBase64, mimeType: result.mimeType });
  } catch (err) {
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

module.exports = router;
