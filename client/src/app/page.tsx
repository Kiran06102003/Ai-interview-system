'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated]);

  return (
    <main className="min-h-screen grid-bg relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-blue/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-neon-purple/5 rounded-full blur-3xl pointer-events-none" />

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
            <span className="text-obsidian-950 font-display font-bold text-sm">AI</span>
          </div>
          <span className="font-display font-bold text-xl text-white">InterviewPro</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-white/60 hover:text-white transition-colors font-body text-sm">
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="btn-primary px-5 py-2 rounded-lg text-sm"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neon-blue/30 bg-neon-blue/5 mb-8">
          <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse-slow" />
          <span className="text-neon-blue text-xs font-mono tracking-widest uppercase">AI-Powered Interview Training</span>
        </div>

        <h1 className="font-display font-bold text-5xl md:text-7xl text-white mb-6 leading-tight max-w-4xl">
          Master Your
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-white to-neon-purple">
            Next Interview
          </span>
        </h1>

        <p className="text-white/50 font-body text-lg md:text-xl max-w-2xl mb-12 leading-relaxed">
          Practice with an AI interviewer that adapts to your role, analyzes your voice in real-time,
          and gives instant feedback to accelerate your growth.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link
            href="/auth/register"
            className="btn-primary px-8 py-4 rounded-xl text-base inline-flex items-center gap-2"
          >
            <span>Start Free Interview</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-4 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all text-base font-body"
          >
            Sign In
          </Link>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          {[
            {
              icon: '🎤',
              title: 'Voice-First AI',
              desc: 'Speak naturally. Our AI listens, transcribes, and evaluates your answers in real-time.',
            },
            {
              icon: '📊',
              title: 'Deep Analytics',
              desc: 'WPM, filler words, sentiment, confidence score — every aspect of your speech analyzed.',
            },
            {
              icon: '🧠',
              title: 'Adaptive Questions',
              desc: 'Questions adapt to your role, skills, difficulty preference, and resume.',
            },
          ].map((f, i) => (
            <div key={i} className="glass-card glass-card-hover p-6 text-left">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-display font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-white/40 text-sm font-body leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
