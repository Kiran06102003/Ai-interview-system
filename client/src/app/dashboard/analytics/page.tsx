'use client';

import { useEffect, useState } from 'react';
import { dashboardAPI } from '@/lib/apiClient';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.getAnalytics()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
      </div>
    );
  }

  const radarData = data?.scoreRadar || [];
  const fillerData = data?.topFillerWords || [];
  const avgScores = data?.avgScores || {};

  const scoreItems = [
    { label: 'Relevance', score: avgScores.relevance || 0, color: 'bg-neon-blue' },
    { label: 'Clarity', score: avgScores.clarity || 0, color: 'bg-neon-green' },
    { label: 'Confidence', score: avgScores.confidence || 0, color: 'bg-neon-purple' },
    { label: 'Structure', score: avgScores.structure || 0, color: 'bg-yellow-400' },
  ];

  return (
    <div className="p-8 grid-bg min-h-screen">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-white">Performance Analytics</h1>
        <p className="text-white/40 text-sm font-mono mt-1">
          {data?.totalAnswers || 0} answers analyzed across all sessions
        </p>
      </div>

      {data?.totalAnswers === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-white/30 font-body">Complete interviews to see your analytics here.</p>
        </div>
      ) : (
        <>
          {/* WPM metric */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-6 text-center">
              <p className="text-neon-blue font-display font-bold text-4xl mb-1">{data?.avgWpm || 0}</p>
              <p className="text-white/40 text-xs font-mono">Avg Words per Minute</p>
              <p className="text-white/20 text-xs mt-2">
                {data?.avgWpm >= 130 && data?.avgWpm <= 160 ? '✓ Optimal pace' :
                  data?.avgWpm < 130 ? '↑ Speak faster' : '↓ Slow down'}
              </p>
            </div>
            <div className="glass-card p-6 text-center">
              <p className="text-neon-green font-display font-bold text-4xl mb-1">{avgScores.overall || 0}</p>
              <p className="text-white/40 text-xs font-mono">Overall Average Score</p>
            </div>
            <div className="glass-card p-6 text-center">
              <p className="text-neon-purple font-display font-bold text-4xl mb-1">{data?.totalAnswers || 0}</p>
              <p className="text-white/40 text-xs font-mono">Total Answers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            {/* Radar Chart */}
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-white mb-1">Skill Radar</h2>
              <p className="text-white/30 text-xs font-mono mb-4">Average scores by dimension</p>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  />
                  <Radar
                    dataKey="score"
                    stroke="#00d4ff"
                    fill="#00d4ff"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Score breakdown */}
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-white mb-1">Score Breakdown</h2>
              <p className="text-white/30 text-xs font-mono mb-6">Detailed dimension performance</p>
              <div className="space-y-5">
                {scoreItems.map(({ label, score, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-white/60 text-sm font-body">{label}</span>
                      <span className="text-white font-display font-bold text-sm">{score}/100</span>
                    </div>
                    <div className="progress-bar">
                      <div className={`${color} h-full rounded-full`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filler Words */}
          {fillerData.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-white mb-1">Top Filler Words</h2>
              <p className="text-white/30 text-xs font-mono mb-6">Words to avoid in your answers</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={fillerData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="word" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0c0c40', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, color: '#fff', fontFamily: 'monospace', fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#bf5fff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-white/20 text-xs font-mono mt-3 text-center">
                Reducing filler words improves your confidence score significantly
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
