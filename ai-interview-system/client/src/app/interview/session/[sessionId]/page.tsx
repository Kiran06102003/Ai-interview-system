'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { useInterview } from '@/hooks/useInterview';
import toast from 'react-hot-toast';
import {
  Mic, MicOff, Camera, CameraOff, Send, StopCircle,
  ChevronRight, AlertTriangle, Loader2, Volume2
} from 'lucide-react';

// ── Waveform animation shown while recording ──────────────────────────────────
const Waveform = ({ active }: { active: boolean }) => (
  <div className={`flex items-center gap-0.5 h-8 transition-opacity ${active ? 'opacity-100' : 'opacity-20'}`}>
    {Array.from({ length: 9 }).map((_, i) => (
      <div
        key={i}
        className="waveform-bar"
        style={{
          height: `${[8, 14, 20, 16, 24, 16, 20, 14, 8][i]}px`,
          animationDelay: `${i * 0.08}s`,
          animationPlayState: active ? 'running' : 'paused',
        }}
      />
    ))}
  </div>
);

// ── Score badge ───────────────────────────────────────────────────────────────
const ScoreBadge = ({ label, score }: { label: string; score: number }) => {
  const color = score >= 80 ? 'text-neon-green' : score >= 60 ? 'text-neon-blue' : score >= 40 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="text-center">
      <div className={`font-display font-bold text-xl ${color}`}>{score}</div>
      <div className="text-white/30 text-xs font-mono mt-0.5">{label}</div>
    </div>
  );
};

export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const textFallbackRef = useRef<HTMLTextAreaElement>(null);

  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [recordingTimer, setRecordingTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { mediaState, recording, requestPermissions, startRecording, stopRecording } =
    useMediaDevices(videoRef);

  const {
    phase, currentQuestion, currentQuestionIndex, totalQuestions,
    liveMetrics, analysis, transcript, statusMsg, questionAudio,
    browserTTSText, setBrowserTTSText,
    submitAudioAnswer, submitTextAnswer, nextQuestion, endSession, setPhase,
  } = useInterview(sessionId);

  // ── Step 1: request camera + mic on mount ────────────────────────────────
  useEffect(() => {
    requestPermissions().then(({ success }) => {
      setPermissionsChecked(true);
      if (!success) toast.error('Camera/mic required for interview. Please allow access and refresh.');
    });
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Play TTS audio when received ─────────────────────────────────────────
  useEffect(() => {
    if (questionAudio && audioRef.current) {
      audioRef.current.src = questionAudio;
      audioRef.current.play().catch(() => {
        // Autoplay blocked — use browser TTS fallback
        if (currentQuestion) useBrowserTTS(currentQuestion.question);
      });
    }
  }, [questionAudio]);

  // ── Browser TTS fallback ─────────────────────────────────────────────────
  useEffect(() => {
    if (browserTTSText) {
      useBrowserTTS(browserTTSText);
      setBrowserTTSText(null);
    }
  }, [browserTTSText]);

  const useBrowserTTS = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  };

  // ── Recording timer ───────────────────────────────────────────────────────
  const startTimer = () => {
    setRecordingTimer(0);
    timerRef.current = setInterval(() => setRecordingTimer(t => t + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleStartRecording = () => {
    if (!mediaState.isReady) {
      toast.error('Camera/microphone not ready');
      return;
    }
    startRecording();
    startTimer();
    setPhase('recording');
    toast('Recording... Speak your answer', { icon: '🎤' });
  };

  const handleStopRecording = async () => {
    stopTimer();
    const { blob, duration } = await stopRecording();
    console.log('Stopped recording. Blob size:', blob.size, 'bytes, Duration:', duration, 'seconds');
    if (!blob || blob.size < 50) {
      console.error('Audio blob too small or empty. Size:', blob?.size || 0);
      toast.error('No audio recorded. Please ensure:\n- Microphone is connected\n- App has microphone permission\n- No other app is using the microphone');
      setPhase('question');
      return;
    }
    setPhase('processing');
    await submitAudioAnswer(blob, duration, textAnswer || undefined);
  };

  const handleTextSubmit = async () => {
    if (!textAnswer.trim()) { toast.error('Please type your answer'); return; }
    setShowTextFallback(false);
    await submitTextAnswer(textAnswer, 30);
    setTextAnswer('');
  };

  const handleNext = () => {
    setTextAnswer('');
    setShowTextFallback(false);
    nextQuestion();
  };

  const handleEnd = async () => {
    if (confirm('End interview now? You can still see results.')) {
      await endSession();
      router.push(`/interview/results/${sessionId}`);
    }
  };

  // ── Permission gate ───────────────────────────────────────────────────────
  if (permissionsChecked && !mediaState.isReady) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center p-6">
        <div className="glass-card p-10 max-w-md text-center">
          <AlertTriangle size={48} className="text-yellow-400 mx-auto mb-4" />
          <h2 className="font-display font-bold text-2xl text-white mb-3">Permissions Required</h2>
          <p className="text-white/50 font-body text-sm mb-2">{mediaState.cameraError}</p>
          <p className="text-white/30 font-body text-xs mb-6">
            Camera and microphone access is mandatory for this interview. Please allow access in your browser then refresh.
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary px-8 py-3 rounded-xl text-sm">
            Retry Permissions
          </button>
        </div>
      </div>
    );
  }

  const progress = totalQuestions > 0 ? ((currentQuestionIndex) / totalQuestions) * 100 : 0;
  const isRecording = phase === 'recording';
  const isProcessing = phase === 'processing';

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Hidden audio player for TTS */}
      <audio ref={audioRef} preload="auto" />

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-obsidian-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${mediaState.hasCamera ? 'bg-neon-green' : 'bg-red-400'}`} />
            <Camera size={14} className="text-white/40" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${mediaState.hasMicrophone ? 'bg-neon-green' : 'bg-red-400'}`} />
            <Mic size={14} className="text-white/40" />
          </div>
          <span className="text-white/30 text-xs font-mono">
            Q{currentQuestionIndex + 1} / {totalQuestions || '?'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 mx-8 progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <button
          onClick={handleEnd}
          className="text-white/30 hover:text-red-400 transition-colors text-xs font-mono flex items-center gap-1"
        >
          <StopCircle size={14} /> End
        </button>
      </header>

      <div className="flex-1 flex gap-0">
        {/* Left: video feed */}
        <div className="w-72 shrink-0 bg-obsidian-950 border-r border-white/5 flex flex-col">
          {/* Camera feed */}
          <div className="relative aspect-video bg-obsidian-900 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500/90 px-2 py-1 rounded-lg backdrop-blur-sm">
                <div className="recording-dot w-2 h-2" />
                <span className="text-white text-xs font-mono">{recordingTimer}s</span>
              </div>
            )}
            {/* Audio level bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
              <div
                className="h-full bg-neon-green transition-all duration-100"
                style={{ width: `${recording.audioLevel}%` }}
              />
            </div>
          </div>

          {/* Live metrics panel */}
          <div className="flex-1 p-4 space-y-3">
            <p className="text-white/30 text-xs font-mono uppercase tracking-wider">Live Metrics</p>

            {liveMetrics ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="glass-card p-3 text-center">
                    <div className="text-neon-blue font-display font-bold text-lg">{liveMetrics.wpm}</div>
                    <div className="text-white/30 text-xs font-mono">WPM</div>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <div className="text-white font-display font-bold text-lg">{liveMetrics.wordCount}</div>
                    <div className="text-white/30 text-xs font-mono">Words</div>
                  </div>
                </div>

                {liveMetrics.fillerWords?.length > 0 && (
                  <div className="glass-card p-3">
                    <p className="text-white/30 text-xs font-mono mb-2">Filler Words</p>
                    <div className="flex flex-wrap gap-1">
                      {liveMetrics.fillerWords.slice(0, 4).map(fw => (
                        <span key={fw.word} className="text-xs bg-red-400/10 text-red-400 px-2 py-0.5 rounded font-mono">
                          "{fw.word}" ×{fw.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="glass-card p-3">
                  <p className="text-white/30 text-xs font-mono mb-1">Sentiment</p>
                  <span className={`text-xs font-mono capitalize px-2 py-1 rounded ${
                    liveMetrics.sentiment?.label === 'positive' ? 'bg-neon-green/10 text-neon-green'
                    : liveMetrics.sentiment?.label === 'negative' ? 'bg-red-400/10 text-red-400'
                    : 'bg-white/10 text-white/50'
                  }`}>
                    {liveMetrics.sentiment?.label || 'neutral'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-white/20 text-xs font-mono">Metrics appear after your answer</p>
            )}

            {/* Waveform */}
            <div className="flex items-center justify-center py-2">
              <Waveform active={isRecording} />
            </div>
          </div>
        </div>

        {/* Right: interview content */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">

          {/* Question display */}
          {currentQuestion && (
            <div className="mb-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono text-white/30 uppercase tracking-widest">
                  Question {currentQuestionIndex + 1}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono capitalize ${
                  currentQuestion.difficulty === 'hard' ? 'bg-red-400/10 text-red-400'
                  : currentQuestion.difficulty === 'medium' ? 'bg-yellow-400/10 text-yellow-400'
                  : 'bg-neon-green/10 text-neon-green'
                }`}>
                  {currentQuestion.difficulty}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/5 text-white/40 capitalize">
                  {currentQuestion.type}
                </span>
                <button
                  onClick={() => useBrowserTTS(currentQuestion.question)}
                  className="ml-auto text-white/20 hover:text-neon-blue transition-colors"
                  title="Read question aloud"
                >
                  <Volume2 size={16} />
                </button>
              </div>

              <div className="glass-card p-6 mb-4 border border-neon-blue/10">
                <p className="text-white text-xl font-display font-semibold leading-relaxed">
                  {currentQuestion.question}
                </p>
                {currentQuestion.hint && (
                  <p className="text-white/30 text-sm font-body mt-3 italic">
                    💡 {currentQuestion.hint}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Phase: question — recording controls */}
          {(phase === 'question' || phase === 'recording') && (
            <div className="animate-fade-in">
              {!isRecording ? (
                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={handleStartRecording}
                    disabled={!mediaState.isReady}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 transition-all flex items-center justify-center shadow-lg hover:shadow-red-500/30 disabled:opacity-40 animate-pulse-slow"
                  >
                    <Mic size={32} className="text-white" />
                  </button>
                  <p className="text-white/40 text-sm font-body">Click to start recording</p>
                  <button
                    onClick={() => setShowTextFallback(s => !s)}
                    className="text-white/20 hover:text-white/50 text-xs font-mono transition-colors underline"
                  >
                    {showTextFallback ? 'Hide' : 'Use text fallback instead'}
                  </button>

                  {showTextFallback && (
                    <div className="w-full mt-2 animate-fade-in">
                      <textarea
                        ref={textFallbackRef}
                        className="input-field resize-none"
                        rows={5}
                        placeholder="Type your answer here..."
                        value={textAnswer}
                        onChange={e => setTextAnswer(e.target.value)}
                      />
                      <button
                        onClick={handleTextSubmit}
                        className="btn-primary mt-3 px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm"
                      >
                        <Send size={14} /> Submit Answer
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-red-500/20 animate-recording-ring scale-125" />
                    <button
                      onClick={handleStopRecording}
                      className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 transition-all flex items-center justify-center z-10 relative"
                    >
                      <StopCircle size={32} className="text-white" />
                    </button>
                  </div>
                  <p className="text-white/60 text-sm font-body">
                    Recording... <span className="text-red-400 font-mono">{recordingTimer}s</span>
                  </p>
                  <p className="text-white/30 text-xs font-mono">Click to stop and submit</p>
                </div>
              )}
            </div>
          )}

          {/* Phase: processing */}
          {isProcessing && (
            <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
              <Loader2 size={40} className="text-neon-blue animate-spin" />
              <p className="text-white/60 font-body text-sm">{statusMsg || 'Processing your answer...'}</p>
            </div>
          )}

          {/* Phase: feedback */}
          {phase === 'feedback' && analysis && (
            <div className="animate-slide-up space-y-6">
              {/* Score row */}
              <div className="glass-card p-5 border border-neon-blue/15">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white/50 text-xs font-mono uppercase tracking-widest">Answer Analysis</p>
                  <div className="flex items-center gap-1">
                    <span className="text-white/30 text-xs font-mono">Overall</span>
                    <span className={`font-display font-bold text-2xl ml-2 ${
                      analysis.overallScore >= 80 ? 'text-neon-green'
                      : analysis.overallScore >= 60 ? 'text-neon-blue'
                      : analysis.overallScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{analysis.overallScore}/100</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 border-t border-white/5 pt-4">
                  <ScoreBadge label="Relevance" score={analysis.relevanceScore} />
                  <ScoreBadge label="Clarity" score={analysis.clarityScore} />
                  <ScoreBadge label="Confidence" score={analysis.confidenceScore} />
                  <ScoreBadge label="Structure" score={analysis.structureScore} />
                </div>
              </div>

              {/* Transcript */}
              {transcript && (
                <div className="glass-card p-5">
                  <p className="text-white/30 text-xs font-mono uppercase tracking-wider mb-2">Your Answer (Transcribed)</p>
                  <p className="text-white/70 font-body text-sm leading-relaxed italic">"{transcript}"</p>
                </div>
              )}

              {/* Feedback */}
              <div className="glass-card p-5">
                <p className="text-white/30 text-xs font-mono uppercase tracking-wider mb-2">AI Feedback</p>
                <p className="text-white/80 font-body text-sm leading-relaxed">{analysis.feedback}</p>
              </div>

              {/* Strengths + Improvements */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-4">
                  <p className="text-neon-green text-xs font-mono uppercase tracking-wider mb-3">✓ Strengths</p>
                  <ul className="space-y-1.5">
                    {analysis.strengths?.map((s, i) => (
                      <li key={i} className="text-white/60 text-sm font-body flex items-start gap-2">
                        <span className="text-neon-green">·</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="glass-card p-4">
                  <p className="text-yellow-400 text-xs font-mono uppercase tracking-wider mb-3">↑ Improve</p>
                  <ul className="space-y-1.5">
                    {analysis.improvements?.map((imp, i) => (
                      <li key={i} className="text-white/60 text-sm font-body flex items-start gap-2">
                        <span className="text-yellow-400">·</span>{imp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Ideal answer */}
              {analysis.idealAnswer && (
                <div className="glass-card p-5 border border-neon-purple/15">
                  <p className="text-neon-purple text-xs font-mono uppercase tracking-wider mb-2">Ideal Answer Outline</p>
                  <p className="text-white/60 font-body text-sm leading-relaxed">{analysis.idealAnswer}</p>
                </div>
              )}

              {/* Next / End buttons */}
              <div className="flex gap-3 pt-2">
                {currentQuestionIndex < totalQuestions - 1 ? (
                  <button onClick={handleNext} className="btn-primary flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
                    Next Question <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={async () => { await endSession(); router.push(`/interview/results/${sessionId}`); }}
                    className="btn-primary flex-1 py-3 rounded-xl text-sm"
                  >
                    Finish & See Results 🎉
                  </button>
                )}
                <button onClick={handleEnd} className="px-6 py-3 rounded-xl border border-white/15 text-white/40 hover:text-white hover:border-white/30 transition-all text-sm">
                  End Early
                </button>
              </div>
            </div>
          )}

          {/* Phase: complete */}
          {phase === 'complete' && (
            <div className="text-center py-12 animate-slide-up">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">Interview Complete!</h2>
              <p className="text-white/40 font-body mb-6">Loading your results...</p>
              <button
                onClick={() => router.push(`/interview/results/${sessionId}`)}
                className="btn-primary px-8 py-3 rounded-xl text-sm"
              >
                View Results
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
