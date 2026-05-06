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
      setCurrentQuestion(data);
      setCurrentQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setAnalysis(null);
      setTranscript('');
      setLiveMetrics(null);
      setQuestionAudio(null);
      setPhase('question');
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
      setAnalysis(data.analysis);
      setTranscript(data.transcript);
      setLiveMetrics(data.speechMetrics);
      setPhase('feedback');
      setAllAnalyses(prev => new Map(prev).set(data.questionIndex, data.analysis));
    };

    const onInterviewComplete = () => {
      setPhase('complete');
      setSessionEnded(true);
    };

    const onEndInterview = () => {
      setPhase('complete');
      setSessionEnded(true);
    };

    const onError = (data: { message: string }) => {
      toast.error(data.message);
      if (phase === 'processing') setPhase('question');
    };

    const onWarning = (data: { message: string }) => {
      console.warn('Server warning:', data.message);
      setStatusMsg(data.message);
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
    socket.on('interview_complete', onInterviewComplete);
    socket.on('end_interview', onEndInterview);
    socket.on('error', onError);
    socket.on('warning', onWarning);

    // Connect if not already
    if (socket.connected) {
      onConnect();
    }

    return () => {
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

    setPhase('processing');
    setStatusMsg('Processing your audio...');

    const socket = socketRef.current;

    // Set a client-side timeout for the processing
    const processingTimeout = setTimeout(() => {
      console.warn('Audio processing taking too long');
      toast.error('Processing is taking too long. Please try the text fallback.');
      setPhase('question');
    }, 45000); // 45 seconds timeout

    // Convert blob to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      socket.emit('user_answer', {
        sessionId,
        questionIndex: currentQuestion.questionIndex,
        audioData: base64,
        duration,
        textFallback,
      });

      // When we get a successful response, clear the timeout
      const onSuccess = () => {
        clearTimeout(processingTimeout);
        socket.off('answer_analyzed', onSuccess);
        socket.off('error', onError);
      };

      const onError = () => {
        clearTimeout(processingTimeout);
        socket.off('answer_analyzed', onSuccess);
        socket.off('error', onError);
      };

      socket.once('answer_analyzed', onSuccess);
      socket.once('error', onError);
    };
    reader.readAsDataURL(audioBlob);
  }, [sessionId, currentQuestion]);

  // Submit text answer (fallback)
  const submitTextAnswer = useCallback(async (text: string, duration: number = 30) => {
    if (!sessionId || !currentQuestion || !text.trim()) return;

    setPhase('processing');
    setStatusMsg('Analyzing your answer...');

    try {
      const response = await interviewAPI.submitAnswer({
        sessionId,
        questionIndex: currentQuestion.questionIndex,
        transcribedText: text,
        duration,
      });

      const { analysis, speechMetrics } = response.data;
      setAnalysis(analysis);
      setTranscript(text);
      setLiveMetrics(speechMetrics);
      setPhase('feedback');
      setAllAnalyses(prev => new Map(prev).set(currentQuestion.questionIndex, analysis));
    } catch (err: any) {
      toast.error('Failed to analyze answer. Please try again.');
      setPhase('question');
    }
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
