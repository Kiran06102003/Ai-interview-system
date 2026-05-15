/**
 * useInterview Hook
 * Manages interview session state and Socket.IO events
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { interviewAPI } from '@/lib/apiClient';
import toast from 'react-hot-toast';

export interface Question {
  questionIndex: number;
  question: string;
  type: string;
  difficulty: string;
  category: string;
  totalQuestions: number;
  hint?: string;
}

export interface LiveMetrics {
  wpm: number;
  wordCount: number;
  fillerWords: { word: string; count: number }[];
  sentiment: { score: number; label: string };
  duration: number;
}

export interface AnswerAnalysis {
  relevanceScore: number;
  clarityScore: number;
  confidenceScore: number;
  structureScore: number;
  overallScore: number;
  feedback: string;
  idealAnswer: string;
  strengths: string[];
  improvements: string[];
}

export type InterviewPhase =
  | 'idle'
  | 'setup'
  | 'ready'
  | 'question'
  | 'recording'
  | 'processing'
  | 'feedback'
  | 'complete';

export const useInterview = (sessionId: string | null) => {
  const [phase, setPhase] = useState<InterviewPhase>('idle');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [analysis, setAnalysis] = useState<AnswerAnalysis | null>(null);
  const [transcript, setTranscript] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [questionAudio, setQuestionAudio] = useState<string | null>(null);
  const [allAnalyses, setAllAnalyses] = useState<Map<number, AnswerAnalysis>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [browserTTSText, setBrowserTTSText] = useState<string | null>(null);

  const socketRef = useRef(getSocket());

  useEffect(() => {
    if (!sessionId) return;

    const socket = socketRef.current;

    // ─── Socket Event Listeners ─────────────────────────────────────────────
    const onConnect = () => {
      setIsConnected(true);
      // Start the interview session
      socket.emit('start_interview', { sessionId });
    };

    const onDisconnect = () => {
      setIsConnected(false);
      toast.error('Connection lost. Attempting to reconnect...');
    };

    const onInterviewReady = (data: any) => {
      setTotalQuestions(data.totalQuestions);
      setPhase('question');
    };

    const onNewQuestion = (data: Question) => {
      console.log('📥 New question received:', data.questionIndex);
      setCurrentQuestion(data);
      setCurrentQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setAnalysis(null);
      setTranscript('');
      setLiveMetrics(null);
      setQuestionAudio(null);
      setPhase('question');
      setStatusMsg('');
    };

    const onQuestionAudio = (data: { questionIndex: number; audio: string; mimeType: string }) => {
      setQuestionAudio(data.audio);
    };

    const onBrowserTTS = (data: { questionIndex: number; text: string }) => {
      setBrowserTTSText(data.text);
    };

    const onLiveTranscript = (data: { text: string }) => {
      setTranscript(data.text);
    };

    const onLiveFeedback = (data: { metrics: LiveMetrics; transcript: string }) => {
      setLiveMetrics(data.metrics);
      if (data.transcript) setTranscript(data.transcript);
    };

    const onTranscribing = (data: { status: string }) => {
      setPhase('processing');
      setStatusMsg(data.status);
    };

    const onAnalyzing = (data: { status: string }) => {
      setPhase('processing');
      setStatusMsg(data.status);
    };

    const onAnswerAnalyzed = (data: {
      questionIndex: number;
      transcript: string;
      analysis: AnswerAnalysis;
      speechMetrics: LiveMetrics;
    }) => {
      console.log('📥 Answer analyzed event received for Q:', data.questionIndex, data);
      setAnalysis(data.analysis);
      setTranscript(data.transcript);
      if (data.speechMetrics) setLiveMetrics(data.speechMetrics);
      
      // Force phase update
      setPhase('feedback');
      setAllAnalyses(prev => {
        const next = new Map(prev);
        next.set(data.questionIndex, data.analysis);
        return next;
      });
      setStatusMsg('Analysis complete.');
    };

    const onNextQuestionStarted = (data: { questionIndex: number }) => {
      console.log('🚀 Next question starting:', data.questionIndex);
      setPhase('question');
    };

    const onInterviewComplete = () => {
      console.log('🏁 Interview complete');
      setPhase('complete');
      setSessionEnded(true);
    };

    const onEndInterview = () => {
      setPhase('complete');
      setSessionEnded(true);
    };

    const onError = (data: { message: string; questionIndex?: number }) => {
      console.error('❌ Socket error:', data.message);
      toast.error(data.message, { duration: 5000 });
      
      // Use functional update to avoid stale closure issues with 'phase'
      setPhase(currentPhase => {
        if (currentPhase === 'processing' || currentPhase === 'recording') {
          return 'question';
        }
        return currentPhase;
      });
      setStatusMsg('');
    };

    const onWarning = (data: { message: string }) => {
      console.warn('⚠️ Server warning:', data.message);
      toast(data.message, { icon: '⚠️' });
      setStatusMsg(data.message);

      // If it's a processing warning, set a safety timeout to reset the UI 
      // if the server fails to send answer_analyzed or next_question
      if (data.message.toLowerCase().includes('evaluation is taking longer')) {
        setTimeout(() => {
          setPhase(current => {
            if (current === 'processing') {
              console.log('🛡️ Safety reset: Processing took too long after warning');
              return 'question';
            }
            return current;
          });
        }, 15000); // Wait another 15s after the warning before giving up
      }
    };

    // Attach listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('interview_ready', onInterviewReady);
    socket.on('new_question', onNewQuestion);
    socket.on('question_audio', onQuestionAudio);
    socket.on('use_browser_tts', onBrowserTTS);
    socket.on('live_transcript', onLiveTranscript);
    socket.on('live_feedback', onLiveFeedback);
    socket.on('transcribing', onTranscribing);
    socket.on('analyzing', onAnalyzing);
    socket.on('answer_analyzed', onAnswerAnalyzed);
    socket.on('next_question_started', onNextQuestionStarted);
    socket.on('interview_complete', onInterviewComplete);
    socket.on('end_interview', onEndInterview);
    socket.on('error', onError);
    socket.on('warning', onWarning);

    // Connect if not already
    if (socket.connected) {
      onConnect();
    }

    return () => {
      console.log('🧹 Cleaning up socket listeners');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('interview_ready', onInterviewReady);
      socket.off('new_question', onNewQuestion);
      socket.off('question_audio', onQuestionAudio);
      socket.off('use_browser_tts', onBrowserTTS);
      socket.off('live_transcript', onLiveTranscript);
      socket.off('live_feedback', onLiveFeedback);
      socket.off('transcribing', onTranscribing);
      socket.off('analyzing', onAnalyzing);
      socket.off('answer_analyzed', onAnswerAnalyzed);
      socket.off('next_question_started', onNextQuestionStarted);
      socket.off('interview_complete', onInterviewComplete);
      socket.off('end_interview', onEndInterview);
      socket.off('error', onError);
      socket.off('warning', onWarning);
    };
  }, [sessionId]);

  // Submit audio answer
  const submitAudioAnswer = useCallback(async (
    audioBlob: Blob,
    duration: number,
    textFallback?: string
  ) => {
    if (!sessionId || !currentQuestion) return;

    console.log('📤 Submitting audio answer...', { size: audioBlob.size, type: audioBlob.type });
    setPhase('processing');
    setStatusMsg('Processing your audio...');

    const socket = socketRef.current;

    // Convert blob to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        
        console.log('📡 Emitting user_answer to server...');
        socket.emit('user_answer', {
          sessionId,
          questionIndex: currentQuestion.questionIndex,
          audioData: base64,
          duration,
          textFallback,
          mimeType: audioBlob.type,
        });

        // Set a client-side watchdog to ensure we don't stay in processing forever
        const watchdog = setTimeout(() => {
          setPhase(current => {
            if (current === 'processing') {
              console.warn('🕒 Client-side watchdog triggered: No response from server');
              toast.error('The server is taking too long to respond. Please try again or use text fallback.');
              return 'question';
            }
            return current;
          });
        }, 60000); // 60s total client-side timeout

        // Clean up watchdog if we receive a response
        const cleanup = () => {
          clearTimeout(watchdog);
          socket.off('answer_analyzed', cleanup);
          socket.off('error', cleanup);
        };
        socket.once('answer_analyzed', cleanup);
        socket.once('error', cleanup);

      } catch (err) {
        console.error('Failed to emit user_answer:', err);
        setPhase('question');
        toast.error('Failed to upload audio. Please try again.');
      }
    };
    reader.onerror = () => {
      console.error('FileReader error');
      setPhase('question');
      toast.error('Failed to read audio data.');
    };
    reader.readAsDataURL(audioBlob);
  }, [sessionId, currentQuestion]);

  // Submit text answer (fallback)
  const submitTextAnswer = useCallback(async (text: string, duration: number = 30) => {
    if (!sessionId || !currentQuestion || !text.trim()) return;

    console.log('📤 Submitting text answer...');
    setPhase('processing');
    setStatusMsg('Analyzing your answer...');

    const socket = socketRef.current;
    socket.emit('user_answer', {
      sessionId,
      questionIndex: currentQuestion.questionIndex,
      audioData: null,
      duration,
      textFallback: text,
    });
  }, [sessionId, currentQuestion]);

  // Move to next question
  const nextQuestion = useCallback(() => {
    if (!sessionId || !currentQuestion) return;

    const nextIndex = currentQuestion.questionIndex + 1;
    if (nextIndex >= totalQuestions) {
      endSession();
      return;
    }

    const socket = socketRef.current;
    socket.emit('request_question', { sessionId, questionIndex: nextIndex });
    setPhase('question');
  }, [sessionId, currentQuestion, totalQuestions]);

  // End session
  const endSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      const socket = socketRef.current;
      socket.emit('end_interview', { sessionId });

      await interviewAPI.end(sessionId);
      setPhase('complete');
      setSessionEnded(true);
    } catch (err) {
      toast.error('Failed to end session properly');
    }
  }, [sessionId]);

  return {
    phase,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    liveMetrics,
    analysis,
    transcript,
    statusMsg,
    questionAudio,
    allAnalyses,
    isConnected,
    sessionEnded,
    browserTTSText,
    setBrowserTTSText,
    submitAudioAnswer,
    submitTextAnswer,
    nextQuestion,
    endSession,
    setPhase,
  };
};
