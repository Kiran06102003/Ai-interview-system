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

// Periodic cleanup of stale sessions (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > 60 * 60 * 1000) { // 1 hour inactivity
      console.log(`🧹 Cleaning up stale session: ${sessionId}`);
      activeSessions.delete(sessionId);
    }
  }
}, 30 * 60 * 1000);

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
          status: 'idle',
          lastActivity: Date.now()
        });

        console.log(`📋 Interview started: ${sessionId}`);

        // Send first question with TTS
        const firstQuestion = interview.questions[0];
        if (firstQuestion) {
          await sendQuestionWithTTS(socket, firstQuestion, 0, interview.questions.length);
          const session = activeSessions.get(sessionId);
          if (session) session.status = 'question';
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
        console.log(`🔄 Manual question request: Session ${sessionId}, Index ${questionIndex}`);
        const interview = await Interview.findOne({ sessionId, userId: socket.userId });
        if (!interview) {
          console.error(`❌ Session ${sessionId} not found for manual request`);
          return;
        }

        const question = interview.questions[questionIndex];
        if (!question) {
          console.log(`🏁 No more questions for session ${sessionId}`);
          socket.emit('interview_complete', { message: 'All questions answered' });
          return;
        }

        const session = activeSessions.get(sessionId);
        if (session) {
          session.currentQuestionIndex = questionIndex;
          session.status = 'question';
          session.lastActivity = Date.now();
        }

        await sendQuestionWithTTS(socket, question, questionIndex, interview.questions.length);
      } catch (err) {
        console.error('request_question error:', err);
        socket.emit('error', { message: 'Failed to fetch question' });
      }
    });

    // ─── Process Real-time Audio Answer ──────────────────────────────────────
    socket.on('user_answer', async ({ sessionId, questionIndex, audioData, duration, textFallback, mimeType = 'audio/webm' }) => {
      console.log(`📥 Received user_answer for session ${sessionId}, Q${questionIndex}. Audio size: ${audioData ? audioData.length : 0}, MIME: ${mimeType}`);
      
      const session = activeSessions.get(sessionId);
      if (!session) {
        console.error(`❌ Session ${sessionId} not found in activeSessions`);
        socket.emit('error', { message: 'Session not found. Please refresh.' });
        return;
      }

      session.status = 'processing';
      session.lastActivity = Date.now();

      let transcribedText = textFallback || '';
      let transcriptionSource = textFallback ? 'manual_text' : 'none';
      let processingTimedOut = false;

      // Set a timeout for the entire processing
      const processingTimeout = setTimeout(() => {
        if (session.status !== 'processing') return; // Already finished
        
        console.warn(`⚠️ [Session ${sessionId}] Processing timeout reached for Q${questionIndex}`);
        processingTimedOut = true;
        socket.emit('warning', { message: 'AI evaluation is taking longer than expected. Continuing...' });
        
        // Emit a partial result so the UI moves to feedback phase
        socket.emit('answer_analyzed', {
          questionIndex,
          transcript: transcribedText || '[Analysis is taking longer than usual]',
          analysis: {
            overallScore: 70,
            feedback: 'The AI is still processing your detailed feedback in the background. We are moving forward to keep your interview momentum.',
            relevanceScore: 70, clarityScore: 70, confidenceScore: 70, structureScore: 70,
            strengths: ['Answer recorded'],
            improvements: ['Manual review recommended']
          },
          source: 'timeout_fallback',
        });
        
        // Move to next question after a shorter delay
        setTimeout(() => {
          if (session.currentQuestionIndex === questionIndex && session.status === 'processing') {
            proceedToNextQuestion(socket, sessionId, questionIndex);
          }
        }, 4000);
      }, 35000); // 35 seconds is a good middle ground

      try {
        // 1. Transcription Phase
        if (audioData && audioData.length > 0) {
          try {
            console.log(`🎙️ Starting transcription for Q${questionIndex}... (MIME: ${mimeType})`);
            socket.emit('transcribing', { status: 'Converting your speech to text...' });

            const audioBuffer = Buffer.from(audioData, 'base64');
            
            // Promise with timeout for Whisper
            const transcriptionPromise = transcribeAudio(audioBuffer, mimeType);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transcription service timed out')), 60000)
            );

            transcribedText = await Promise.race([transcriptionPromise, timeoutPromise]);
            
            if (!transcribedText || transcribedText === '[No audio detected]') {
              throw new Error('No speech detected in your audio. Please speak louder or check your microphone.');
            }
            transcriptionSource = 'whisper_ai';
            console.log(`✅ Transcription successful for Q${questionIndex}. Text: "${transcribedText.substring(0, 30)}..."`);

            socket.emit('live_transcript', { text: transcribedText, questionIndex });
          } catch (transcribeErr) {
            console.error(`❌ Transcription failed for Q${questionIndex}:`, transcribeErr.message);
            
            if (textFallback && textFallback.trim().length >= 3) {
              console.log(`ℹ️ Using text fallback for Q${questionIndex}`);
              transcribedText = textFallback;
              transcriptionSource = 'manual_text';
            } else {
              // Include the actual error message from Whisper/Service
              throw new Error(`Transcription failed: ${transcribeErr.message}. No text fallback provided.`);
            }
          }
        }

        if (processingTimedOut) return;

        if (!transcribedText || transcribedText.trim().length < 3) {
          throw new Error('No substantial answer detected. Please try again.');
        }

        // 2. Analysis Phase
        const interview = await Interview.findOne({ sessionId, userId: socket.userId });
        if (!interview) throw new Error('Interview record not found.');

        const question = interview.questions[questionIndex];
        
        console.log(`🧠 Starting AI analysis for Q${questionIndex}...`);
        socket.emit('analyzing', { status: 'AI is evaluating your response...' });

        // Speech analytics (local, fast)
        const speechMetrics = analyzeSpeech(transcribedText, duration || 30);
        const confidenceScore = calculateConfidenceScore({
          wpm: speechMetrics.wpm,
          fillerWordPercent: speechMetrics.fillerWordPercent,
          sentimentScore: speechMetrics.sentiment.score,
          wordCount: speechMetrics.wordCount,
        });

        // AI Analysis (OpenAI call)
        const aiAnalysisPromise = analyzeAnswer({
          question: question.text,
          answer: transcribedText,
          role: interview.targetRole,
          difficulty: interview.difficulty,
        });

        const aiAnalysis = await Promise.race([
          aiAnalysisPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI Analysis timeout')), 25000))
        ]);

        console.log(`✅ AI Analysis complete for Q${questionIndex}`);

        aiAnalysis.confidenceScore = confidenceScore;
        aiAnalysis.overallScore = Math.round(
          aiAnalysis.relevanceScore * 0.35 +
          aiAnalysis.clarityScore * 0.25 +
          confidenceScore * 0.20 +
          aiAnalysis.structureScore * 0.20
        );

        // 3. Save & Emit Phase
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

        if (processingTimedOut) return;
        clearTimeout(processingTimeout);
        session.status = 'feedback';

        socket.emit('answer_analyzed', {
          questionIndex,
          transcript: transcribedText,
          analysis: aiAnalysis,
          speechMetrics,
          source: transcriptionSource,
        });

        console.log(`📤 [Session ${sessionId}] Emitted answer_analyzed for Q${questionIndex}`);

        // 4. Automatic Progression
        // Wait 5 seconds for user to read feedback, then move to next question
        setTimeout(() => {
          proceedToNextQuestion(socket, sessionId, questionIndex);
        }, 6000);

      } catch (err) {
        console.error(`❌ user_answer processing error for Q${questionIndex}:`, err);
        clearTimeout(processingTimeout);
        if (!processingTimedOut) {
          socket.emit('error', { 
            message: err.message || 'Failed to process answer',
            questionIndex 
          });
          session.status = 'question'; // Reset to question state so user can retry
        }
      }
    });

    // ─── Proceed to Next Question Helper ─────────────────────────────────────
    async function proceedToNextQuestion(socket, sessionId, currentIndex) {
      try {
        const session = activeSessions.get(sessionId);
        if (!session) return;

        const interview = await Interview.findOne({ sessionId, userId: socket.userId });
        if (!interview) return;

        const nextIndex = currentIndex + 1;
        
        if (nextIndex >= interview.questions.length) {
          console.log(`🏁 Session ${sessionId} complete. Emitting interview_complete`);
          socket.emit('interview_complete', { 
            message: 'All questions answered. Great job!',
            sessionId 
          });
          session.status = 'complete';
          return;
        }

        console.log(`➡️ Moving to next question: Q${nextIndex} for session ${sessionId}`);
        session.currentQuestionIndex = nextIndex;
        session.status = 'question';
        session.lastActivity = Date.now();

        const nextQuestion = interview.questions[nextIndex];
        await sendQuestionWithTTS(socket, nextQuestion, nextIndex, interview.questions.length);
        
        socket.emit('next_question_started', { questionIndex: nextIndex });
      } catch (err) {
        console.error('Error in proceedToNextQuestion:', err);
      }
    }

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
