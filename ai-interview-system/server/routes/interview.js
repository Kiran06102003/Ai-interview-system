/**
 * Interview Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  startInterview,
  submitAnswer,
  processAudioAnswer,
  endInterview,
  getInterview,
  getFeedback,
} = require('../controllers/interviewController');
const { authenticate } = require('../middleware/auth');

// Multer for audio upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'), false);
    }
  },
});

router.post('/start', authenticate, startInterview);
router.post('/answer', authenticate, submitAnswer);
router.post('/answer/audio', authenticate, upload.single('audio'), processAudioAnswer);
router.post('/end/:sessionId', authenticate, endInterview);
router.get('/session/:sessionId', authenticate, getInterview);
router.get('/feedback/:sessionId', authenticate, getFeedback);

module.exports = router;
