'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { interviewAPI } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Mic, Brain, Users, Shuffle, ChevronRight } from 'lucide-react';

const MODES = [
  { id: 'technical', label: 'Technical', icon: Brain, desc: 'Coding, system design, algorithms' },
  { id: 'hr', label: 'HR / Behavioral', icon: Users, desc: 'STAR method, soft skills, culture fit' },
  { id: 'mixed', label: 'Mixed', icon: Shuffle, desc: 'Balanced technical + behavioral' },
];

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', color: 'text-neon-green', border: 'border-neon-green/40', bg: 'bg-neon-green/10', desc: 'Conceptual & beginner friendly' },
  { id: 'medium', label: 'Medium', color: 'text-yellow-400', border: 'border-yellow-400/40', bg: 'bg-yellow-400/10', desc: 'Practical knowledge required' },
  { id: 'hard', label: 'Hard', color: 'text-red-400', border: 'border-red-400/40', bg: 'bg-red-400/10', desc: 'Expert-level deep dives' },
];

export default function InterviewSetupPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [config, setConfig] = useState({
    mode: 'mixed',
    difficulty: 'medium',
    questionsCount: 5,
    language: 'en',
  });
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await interviewAPI.start(config);
      const { sessionId } = res.data;
      router.push(`/interview/session/${sessionId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start interview');
      setLoading(false);
    }
  };

  return (
    <div className="p-8 grid-bg min-h-screen max-w-3xl">
      <div className="mb-10">
        <h1 className="font-display font-bold text-3xl text-white mb-2">Configure Interview</h1>
        <p className="text-white/40 font-mono text-sm">
          {user?.targetRole ? `Role: ${user.targetRole}` : 'Set your target role in Profile for better questions'}
        </p>
      </div>

      {/* Mode */}
      <div className="mb-8">
        <h2 className="font-display font-semibold text-white mb-4 text-lg">Interview Mode</h2>
        <div className="grid grid-cols-3 gap-4">
          {MODES.map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              onClick={() => setConfig(c => ({ ...c, mode: id }))}
              className={`glass-card p-5 text-left transition-all border-2 ${
                config.mode === id
                  ? 'border-neon-blue/60 bg-neon-blue/10'
                  : 'border-white/5 hover:border-white/20'
              }`}
            >
              <Icon size={22} className={config.mode === id ? 'text-neon-blue mb-3' : 'text-white/30 mb-3'} />
              <p className={`font-display font-semibold text-sm mb-1 ${config.mode === id ? 'text-white' : 'text-white/60'}`}>{label}</p>
              <p className="text-white/30 text-xs font-body leading-snug">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div className="mb-8">
        <h2 className="font-display font-semibold text-white mb-4 text-lg">Difficulty</h2>
        <div className="grid grid-cols-3 gap-4">
          {DIFFICULTIES.map(({ id, label, color, border, bg, desc }) => (
            <button
              key={id}
              onClick={() => setConfig(c => ({ ...c, difficulty: id }))}
              className={`glass-card p-5 text-left transition-all border-2 ${
                config.difficulty === id ? `${bg} ${border}` : 'border-white/5 hover:border-white/20'
              }`}
            >
              <p className={`font-display font-bold text-2xl mb-2 ${config.difficulty === id ? color : 'text-white/20'}`}>
                {label[0]}
              </p>
              <p className={`font-display font-semibold text-sm mb-1 ${config.difficulty === id ? 'text-white' : 'text-white/60'}`}>{label}</p>
              <p className="text-white/30 text-xs font-body leading-snug">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Questions count */}
      <div className="mb-8">
        <h2 className="font-display font-semibold text-white mb-4 text-lg">
          Number of Questions: <span className="text-neon-blue">{config.questionsCount}</span>
        </h2>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={3}
            max={10}
            value={config.questionsCount}
            onChange={e => setConfig(c => ({ ...c, questionsCount: parseInt(e.target.value) }))}
            className="flex-1 accent-[#00d4ff] h-2 rounded-full cursor-pointer"
          />
          <div className="flex gap-2">
            {[3, 5, 7, 10].map(n => (
              <button
                key={n}
                onClick={() => setConfig(c => ({ ...c, questionsCount: n }))}
                className={`w-10 h-8 rounded-lg text-xs font-mono transition-all ${
                  config.questionsCount === n
                    ? 'bg-neon-blue/20 border border-neon-blue/50 text-neon-blue'
                    : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/30'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="mb-10">
        <h2 className="font-display font-semibold text-white mb-4 text-lg">Language</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { id: 'en', label: '🇺🇸 English' },
            { id: 'es', label: '🇪🇸 Spanish' },
            { id: 'fr', label: '🇫🇷 French' },
            { id: 'de', label: '🇩🇪 German' },
            { id: 'hi', label: '🇮🇳 Hindi' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setConfig(c => ({ ...c, language: id }))}
              className={`px-4 py-2 rounded-xl text-sm font-body transition-all border ${
                config.language === id
                  ? 'bg-neon-blue/15 border-neon-blue/50 text-neon-blue'
                  : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pre-flight checklist */}
      <div className="glass-card p-5 mb-8 border border-neon-blue/10">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">Before you start</p>
        <ul className="space-y-2">
          {[
            'Camera and microphone permissions will be requested',
            'Find a quiet, well-lit space',
            'Use Chrome or Firefox for best experience',
            'Speak clearly — Whisper AI will transcribe your answers',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/40 font-body">
              <span className="text-neon-green mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleStart}
        disabled={loading}
        className="btn-primary w-full py-4 rounded-xl flex items-center justify-center gap-3 text-base disabled:opacity-50"
      >
        <Mic size={18} />
        {loading ? 'Setting up your interview...' : 'Start Interview'}
        {!loading && <ChevronRight size={16} />}
      </button>
    </div>
  );
}
