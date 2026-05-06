/**
 * Socket.IO Handler
 * Manages real-time interview events, live feedback, and session state
 */

const jwt = require('jsonwebtoken');
const Interview = require('../models/Interview');
const { generateTTS, audioToBase64 } = require('../ai-services/ttsService');
const { transcribeAudio, analyzeAnswer } = require('../ai-services/openaiService');
const { analyzeSpeech, calculateConfidenceScore } = require('../utils/speechAnalytics');

// Track active sessions: sessionId -> { userId, socket, state }
const activeSessions = new Map();

const initializeSocketHandlers = (io) => {
  // Middleware: authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-prod');
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id} (User: ${socket.userId})`);

    // ─── Join Interview Room ─────────────────────────────────────────────────
    socket.on('start_interview', async ({ sessionId }) => {
      try {
        const interview = await Interview.findOne({ sessionId, userId: socket.userId });

        if (!interview) {
          socket.emit('error', { message: 'Interview session not found' });
          return;
        }

        // Join the session room
        socket.join(sessionId);
        socket.currentSessionId = sessionId;

        activeSessions.set(sessionId, {
          userId: socket.userId,
          socketId: socket.id,
          startTime: Date.now(),
          currentQuestionIndex: 0,
        });

        console.log(`📋 Interview started: ${sessionId}`);

        // Send first question with TTS
        const firstQuestion = interview.questions[0];
        if (firstQuestion) {
          await sendQuestionWithTTS(socket, firstQuestion, 0, interview.questions.length);
        }

        socket.emit('interview_ready', {
          sessionId,
          totalQuestions: interview.questions.length,
          mode: interview.mode,
          difficulty: interview.difficulty,
        });
      } catch (err) {
        console.error('start_interview error:', err);
        socket.emit('error', { message: 'Failed to start interview: ' + err.message });
      }
    });

    // ─── Request Next Question ────────────────────────────────────────────────
    socket.on('request_question', async ({ sessionId, questionIndex }) => {
      try {
        const interview = await Interview.findOne({ sessionId, userId: socket.userId });
        if (!interview) return;

        const question = interview.questions[questionIndex];
        if (!question) {
          socket.emit('interview_complete', { message: 'All questions answered' });
          return;
        }

        await sendQuestionWithTTS(socket, question, questionIndex, interview.questions.length);
      } catch (err) {
        console.error('request_question error:', err);
        socket.emit('error', { message: 'Failed to fetch question' });
      }
    });

    // ─── Process Real-time Audio Answer ──────────────────────────────────────
    socket.on('user_answer', async ({ sessionId, questionIndex, audioData, duration, textFallback }) => {
      try {
        const session = activeSessions.get(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        let transcribedText = textFallback || '';
        let transcriptionSource = textFallback ? 'manual_text' : 'none';

        // Set a timeout for the entire processing
        const processingTimeout = setTimeout(() => {
          console.warn('Processing timeout - taking longer than expected');
          socket.emit('warning', { message: 'Processing is taking longer than expected. Still working...' });
        }, 15000);

        // Transcribe audio if provided
        if (audioData && audioData.length > 0) {
          try {
            socket.emit('transcribing', { status: 'Processing your audio...' });

            console.log('Attempting transcription...', { 
              audioDataLength: audioData.length,
              hasTextFallback: !!textFallback 
            });

            // audioData is base64 encoded
            const audioBuffer = Buffer.from(audioData, 'base64');
            console.log('Audio buffer created:', { bufferSize: audioBuffer.length });
            
            // Attempt transcription
            try {
              transcribedText = await transcribeAudio(audioBuffer, 'audio/webm');
              transcriptionSource = 'whisper_ai';
              console.log('Transcription successful:', { text: transcribedText.substring(0, 100) });

              // Send live transcript
              socket.emit('live_transcript', { text: transcribedText, questionIndex });
            } catch (transcribeErr) {
              console.error('Transcription error:', transcribeErr.message);
              throw transcribeErr;
            }
          } catch (transcribeErr) {
            console.error('Transcription failed:', {
              error: transcribeErr.message,
              hasTextFallback: !!textFallback,
              apiKeyConfigured: !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-actual'),
            });

            // If we have a text fallback, use it
            if (textFallback && textFallback.trim().length >= 3) {
              console.log('Using text fallback due to transcription failure');
              transcribedText = textFallback;
              transcriptionSource = 'manual_text';
              socket.emit('live_transcript', { 
                text: transcribedText, 
                questionIndex,
                source: 'text_fallback',
                note: 'Using text fallback due to transcription error'
              });
            } else {
              // No fallback available and transcription failed
              clearTimeout(processingTimeout);
              socket.emit('error', { 
                message: 'Failed to transcribe audio. Please try the text fallback or refresh and try again.' 
              });
              return;
            }
          }
        }

        if (!transcribedText || transcribedText.trim().length < 3) {
          clearTimeout(processingTimeout);
          socket.emit('error', { message: 'No answer detected. Please speak clearly or type your answer.' });
          return;
        }

        // Get interview for context
        const interview = await Interview.findOne({ sessionId, userId: socket.userId });
        if (!interview) {
          clearTimeout(processingTimeout);
          return;
        }

        const question = interview.questions[questionIndex];

        // Speech analytics
        const speechMetrics = analyzeSpeech(transcribedText, duration || 30);
        const confidenceScore = calculateConfidenceScore({
          wpm: speechMetrics.wpm,
          fillerWordPercent: speechMetrics.fillerWordPercent,
          sentimentScore: speechMetrics.sentiment.score,
          wordCount: speechMetrics.wordCount,
        });

        // Send real-time metrics immediately
        socket.emit('live_feedback', {
          questionIndex,
          metrics: {
            wpm: speechMetrics.wpm,
            wordCount: speechMetrics.wordCount,
            fillerWords: speechMetrics.fillerWords,
            sentiment: speechMetrics.sentiment,
            duration: duration || 30,
          },
          transcript: transcribedText,
          source: transcriptionSource,
        });

        // AI analysis (async)
        socket.emit('analyzing', { status: 'AI is evaluating your answer...' });

        const aiAnalysis = await analyzeAnswer({
          question: question.text,
          answer: transcribedText,
          role: interview.targetRole,
          difficulty: interview.difficulty,
        });

        aiAnalysis.confidenceScore = confidenceScore;
        aiAnalysis.overallScore = Math.round(
          aiAnalysis.relevanceScore * 0.35 +
          aiAnalysis.clarityScore * 0.25 +
          confidenceScore * 0.20 +
          aiAnalysis.structureScore * 0.20
        );

        // Save answer to database
        const answerDoc = {
          questionIndex,
          question: question.text,
          transcribedText,
          transcriptionSource,
          duration: duration || 30,
          wpm: speechMetrics.wpm,
          fillerWords: speechMetrics.fillerWords,
          sentiment: speechMetrics.sentiment,
          aiAnalysis,
        };

        const existingIdx = interview.answers.findIndex(a => a.questionIndex === questionIndex);
        if (existingIdx >= 0) {
          interview.answers[existingIdx] = answerDoc;
        } else {
          interview.answers.push(answerDoc);
        }
        await interview.save();

        clearTimeout(processingTimeout);

        // Send complete analysis
        socket.emit('answer_analyzed', {
          questionIndex,
          transcript: transcribedText,
          analysis: aiAnalysis,
          speechMetrics,
          source: transcriptionSource,
        });

      } catch (err) {
        console.error('user_answer error:', err);
        socket.emit('error', { message: 'Failed to process answer: ' + err.message });
      }
    });

    // ─── Live Metrics (streaming during recording) ────────────────────────────
    socket.on('live_metrics_update', ({ sessionId, partialTranscript, wordCount, duration }) => {
      // Re-broadcast to any other listeners (e.g., admin dashboard)
      socket.to(sessionId).emit('candidate_metrics', {
        partialTranscript,
        wordCount,
        duration,
      });
    });

    // ─── End Interview ────────────────────────────────────────────────────────
    socket.on('end_interview', async ({ sessionId }) => {
      try {
        const interview = await Interview.findOne({ sessionId, userId: socket.userId });
        if (!interview) return;

        interview.status = 'completed';
        interview.completedAt = new Date();
        await interview.save();

        activeSessions.delete(sessionId);
        socket.leave(sessionId);

        socket.emit('interview_ended', { sessionId, message: 'Interview session ended' });
        console.log(`✅ Interview ended: ${sessionId}`);
      } catch (err) {
        console.error('end_interview socket error:', err);
      }
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} (${reason})`);

      // Mark session as abandoned if disconnect was unexpected
      if (socket.currentSessionId && reason !== 'io client disconnect') {
        const session = activeSessions.get(socket.currentSessionId);
        if (session) {
          Interview.findOneAndUpdate(
            { sessionId: socket.currentSessionId, status: 'active' },
            { status: 'abandoned' },
            { new: true }
          ).catch(console.error);

          activeSessions.delete(socket.currentSessionId);
        }
      }
    });

    // ─── Reconnect handling ───────────────────────────────────────────────────
    socket.on('rejoin_session', async ({ sessionId }) => {
      try {
        const interview = await Interview.findOne({ sessionId, userId: socket.userId });
        if (!interview || interview.status === 'completed') {
          socket.emit('session_invalid', { message: 'Session cannot be rejoined' });
          return;
        }

        // Restore session
        if (interview.status === 'abandoned') {
          interview.status = 'active';
          await interview.save();
        }

        socket.join(sessionId);
        socket.currentSessionId = sessionId;

        socket.emit('session_rejoined', {
          sessionId,
          answeredCount: interview.answers.length,
          totalQuestions: interview.questions.length,
          currentQuestionIndex: interview.answers.length,
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to rejoin session' });
      }
    });
  });
};

// ─── Helper: Send question with TTS ──────────────────────────────────────────
const sendQuestionWithTTS = async (socket, question, questionIndex, totalQuestions) => {
  try {
    // Send question text immediately
    socket.emit('new_question', {
      questionIndex,
      question: question.text,
      type: question.type,
      difficulty: question.difficulty,
      category: question.category,
      totalQuestions,
      hint: question.hint,
    });

    // Generate and send TTS audio
    const ttsResult = await generateTTS(question.text, 'professional');
    if (ttsResult) {
      const audioBase64 = audioToBase64(ttsResult.audio, ttsResult.mimeType);
      socket.emit('question_audio', {
        questionIndex,
        audio: audioBase64,
        mimeType: ttsResult.mimeType,
        provider: ttsResult.provider,
      });
    } else {
      // Signal frontend to use Web Speech API
      socket.emit('use_browser_tts', { questionIndex, text: question.text });
    }
  } catch (err) {
    console.error('Error sending question with TTS:', err);
    socket.emit('new_question', {
      questionIndex,
      question: question.text,
      type: question.type,
      totalQuestions,
    });
    socket.emit('use_browser_tts', { questionIndex, text: question.text });
  }
};

module.exports = { initializeSocketHandlers };
