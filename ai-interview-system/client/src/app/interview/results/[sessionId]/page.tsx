'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { interviewAPI } from '@/lib/apiClient';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { Trophy, Mic, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openAnswer, setOpenAnswer] = useState<number | null>(0);

  useEffect(() => {
    interviewAPI.getSession(sessionId)
      .then(r => setInterview(r.data.interview))
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!interview) return null;

  const summary = interview.performanceSummary || {};
  const score = interview.overallScore || 0;
  const scoreColor = score >= 80 ? 'text-neon-green' : score >= 60 ? 'text-neon-blue' : score >= 40 ? 'text-yellow-400' : 'text-red-400';
  const scoreBorder = score >= 80 ? 'border-neon-green/30' : score >= 60 ? 'border-neon-blue/30' : score >= 40 ? 'border-yellow-400/30' : 'border-red-400/30';

  // Build radar data from average answer scores
  const radarData = ['relevance', 'clarity', 'confidence', 'structure'].map(dim => {
    const avg = interview.answers.reduce((s: number, a: any) =>
      s + (a.aiAnalysis?.[`${dim}Score`] || 0), 0) / Math.max(interview.answers.length, 1);
    return { metric: dim.charAt(0).toUpperCase() + dim.slice(1), score: Math.round(avg) };
  });

  const durationMin = Math.round((interview.duration || 0) / 60);

  return (
    <div className="min-h-screen grid-bg p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Back */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/30 hover:text-white transition-colors text-sm font-mono mb-8">
          <ArrowLeft size={14} /> Dashboard
        </Link>

        {/* Hero score */}
        <div className={`glass-card p-8 text-center mb-8 border-2 ${scoreBorder}`}>
          <Trophy size={40} className={`${scoreColor} mx-auto mb-4`} />
          <p className="text-white/40 font-mono text-xs uppercase tracking-widest mb-2">Overall Score</p>
          <p className={`font-display font-bold text-8xl ${scoreColor} mb-2`}>{score}</p>
          <p className="text-white/30 font-mono text-sm">/100 · {interview.mode} · {interview.difficulty}</p>

          {summary.overallFeedback && (
            <p className="text-white/60 font-body text-sm max-w-xl mx-auto mt-4 leading-relaxed">
              {summary.overallFeedback}
            </p>
          )}

          <div className="flex items-center justify-center gap-8 mt-6 border-t border-white/5 pt-6">
            <div className="text-center">
              <p className="text-white font-display font-bold text-xl">{interview.answers.length}</p>
              <p className="text-white/30 text-xs font-mono">Questions answered</p>
            </div>
            <div className="text-center">
              <p className="text-white font-display font-bold text-xl">{summary.averageWpm || 0}</p>
              <p className="text-white/30 text-xs font-mono">Avg WPM</p>
            </div>
            <div className="text-center">
              <p className="text-white font-display font-bold text-xl">{durationMin}m</p>
              <p className="text-white/30 text-xs font-mono">Duration</p>
            </div>
            <div className="text-center">
              <p className="text-white font-display font-bold text-xl">{summary.totalFillerWords || 0}</p>
              <p className="text-white/30 text-xs font-mono">Filler words</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Radar chart */}
          <div className="glass-card p-6">
            <h2 className="font-display font-semibold text-white mb-4">Skill Breakdown</h2>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <Radar dataKey="score" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Highlights */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-display font-semibold text-white mb-2">Session Highlights</h2>
            {summary.strongestSkill && (
              <div className="flex items-start gap-3">
                <span className="text-neon-green text-lg">💪</span>
                <div>
                  <p className="text-white/50 text-xs font-mono mb-0.5">Strongest Area</p>
                  <p className="text-white font-body text-sm">{summary.strongestSkill}</p>
                </div>
              </div>
            )}
            {summary.weakestSkill && (
              <div className="flex items-start gap-3">
                <span className="text-yellow-400 text-lg">🎯</span>
                <div>
                  <p className="text-white/50 text-xs font-mono mb-0.5">Focus Area</p>
                  <p className="text-white font-body text-sm">{summary.weakestSkill}</p>
                </div>
              </div>
            )}
            {summary.recommendedTopics?.length > 0 && (
              <div>
                <p className="text-white/50 text-xs font-mono mb-2">Study These Next</p>
                <div className="flex flex-wrap gap-2">
                  {summary.recommendedTopics.map((t: string) => (
                    <span key={t} className="text-xs px-2 py-1 rounded-lg bg-neon-purple/10 border border-neon-purple/20 text-neon-purple font-mono">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Per-question answers */}
        <div className="glass-card overflow-hidden mb-8">
          <div className="p-6 border-b border-white/5">
            <h2 className="font-display font-semibold text-white">Question-by-Question Review</h2>
          </div>
          <div className="divide-y divide-white/5">
            {interview.answers.map((answer: any, idx: number) => {
              const ai = answer.aiAnalysis || {};
              const isOpen = openAnswer === idx;
              const qScore = ai.overallScore || 0;
              const qColor = qScore >= 80 ? 'text-neon-green' : qScore >= 60 ? 'text-neon-blue' : qScore >= 40 ? 'text-yellow-400' : 'text-red-400';

              return (
                <div key={idx}>
                  <button
                    onClick={() => setOpenAnswer(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-all text-left"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="text-white/20 font-mono text-sm w-6">{idx + 1}.</span>
                      <p className="text-white/70 font-body text-sm truncate flex-1">{answer.question}</p>
                    </div>
                    <div className="flex items-center gap-4 ml-4 shrink-0">
                      <span className={`font-display font-bold ${qColor}`}>{qScore}/100</span>
                      {isOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 space-y-4 animate-fade-in bg-white/1">
                      {/* Mini score bars */}
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          ['Relevance', ai.relevanceScore],
                          ['Clarity', ai.clarityScore],
                          ['Confidence', ai.confidenceScore],
                          ['Structure', ai.structureScore],
                        ].map(([lbl, val]: any) => (
                          <div key={lbl}>
                            <div className="flex justify-between mb-1">
                              <span className="text-white/30 text-xs font-mono">{lbl}</span>
                              <span className="text-white text-xs font-mono">{val}</span>
                            </div>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${val || 0}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {answer.transcribedText && (
                        <div>
                          <p className="text-white/30 text-xs font-mono mb-1 uppercase tracking-wider">Your Answer</p>
                          <p className="text-white/60 font-body text-sm italic leading-relaxed">"{answer.transcribedText}"</p>
                        </div>
                      )}

                      {ai.feedback && (
                        <div>
                          <p className="text-white/30 text-xs font-mono mb-1 uppercase tracking-wider">Feedback</p>
                          <p className="text-white/70 font-body text-sm leading-relaxed">{ai.feedback}</p>
                        </div>
                      )}

                      <div className="flex gap-3 text-xs">
                        <span className="font-mono text-white/30">WPM: <span className="text-white/60">{answer.wpm || 0}</span></span>
                        <span className="font-mono text-white/30">Duration: <span className="text-white/60">{answer.duration || 0}s</span></span>
                        <span className={`font-mono text-white/30`}>Sentiment: <span className={
                          answer.sentiment?.label === 'positive' ? 'text-neon-green'
                          : answer.sentiment?.label === 'negative' ? 'text-red-400'
                          : 'text-white/40'
                        }>{answer.sentiment?.label || 'neutral'}</span></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="flex gap-4 justify-center">
          <Link href="/interview/setup" className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 text-sm">
            <Mic size={16} /> Practice Again
          </Link>
          <Link href="/dashboard" className="px-8 py-3 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all text-sm">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
