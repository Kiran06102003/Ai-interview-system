'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dashboardAPI } from '@/lib/apiClient';
import { Mic, TrendingUp, Award, Clock, ChevronRight, Zap } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface DashboardData {
  user: any;
  stats: any;
  charts: any;
  recentInterviews: any[];
}

const ScoreColor = ({ score }: { score: number }) => {
  const color = score >= 80 ? 'text-neon-green' : score >= 60 ? 'text-neon-blue' : score >= 40 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`font-display font-bold text-2xl ${color}`}>{score}</span>;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card px-3 py-2 text-xs">
        <p className="text-white/50 font-mono mb-1">{new Date(label).toLocaleDateString()}</p>
        <p className="text-neon-blue font-display font-bold">{payload[0].value}/100</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.getData()
      .then(res => setData(res.data))
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

  const stats = data?.stats || {};
  const scoreHistory = data?.charts?.scoreHistory || [];

  const statCards = [
    {
      label: 'Total Interviews',
      value: stats.totalInterviews || 0,
      icon: Mic,
      color: 'text-neon-blue',
      bg: 'bg-neon-blue/10 border-neon-blue/20',
    },
    {
      label: 'Average Score',
      value: `${stats.averageScore || 0}/100`,
      icon: Award,
      color: 'text-neon-green',
      bg: 'bg-neon-green/10 border-neon-green/20',
    },
    {
      label: 'Best Score',
      value: `${stats.bestScore || 0}/100`,
      icon: Zap,
      color: 'text-neon-purple',
      bg: 'bg-neon-purple/10 border-neon-purple/20',
    },
    {
      label: 'Improvement',
      value: `${stats.improvementTrend >= 0 ? '+' : ''}${stats.improvementTrend || 0} pts`,
      icon: TrendingUp,
      color: stats.improvementTrend >= 0 ? 'text-neon-green' : 'text-red-400',
      bg: 'bg-white/5 border-white/10',
    },
  ];

  return (
    <div className="p-8 grid-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">
            Welcome back, <span className="text-neon-blue">{data?.user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-white/40 font-body text-sm mt-1">
            {data?.user?.targetRole ? `Preparing for: ${data.user.targetRole}` : 'Set your target role in Profile'}
          </p>
        </div>
        <Link
          href="/interview/setup"
          className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 text-sm"
        >
          <Mic size={16} />
          <span>New Interview</span>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`glass-card p-5 border ${bg}`}>
            <div className="flex items-start justify-between mb-3">
              <Icon size={18} className={color} />
            </div>
            <p className={`font-display font-bold text-2xl ${color} mb-1`}>{value}</p>
            <p className="text-white/40 text-xs font-mono">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Score History Chart */}
        <div className="xl:col-span-2 glass-card p-6">
          <h2 className="font-display font-semibold text-white mb-1">Score History</h2>
          <p className="text-white/30 text-xs font-mono mb-6">Performance over time</p>
          {scoreHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scoreHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  dot={{ fill: '#00d4ff', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <Mic size={32} className="text-white/10 mb-3" />
              <p className="text-white/30 text-sm font-body">Complete interviews to see your trend</p>
              <Link href="/interview/setup" className="text-neon-blue text-xs mt-2 hover:underline">
                Start your first interview →
              </Link>
            </div>
          )}
        </div>

        {/* Mode Performance */}
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold text-white mb-1">By Mode</h2>
          <p className="text-white/30 text-xs font-mono mb-6">Average score per type</p>
          <div className="space-y-4">
            {[
              { label: 'Technical', key: 'technical', color: 'bg-neon-blue' },
              { label: 'HR', key: 'hr', color: 'bg-neon-purple' },
              { label: 'Mixed', key: 'mixed', color: 'bg-neon-green' },
            ].map(({ label, key, color }) => {
              const score = stats.modeAverages?.[key] || 0;
              return (
                <div key={key}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-white/50 text-xs font-mono">{label}</span>
                    <span className="text-white text-xs font-display font-bold">{score}/100</span>
                  </div>
                  <div className="progress-bar">
                    <div className={`${color} h-full rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Interviews */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display font-semibold text-white">Recent Interviews</h2>
            <p className="text-white/30 text-xs font-mono mt-0.5">Your last sessions</p>
          </div>
          <Link href="/dashboard/history" className="text-neon-blue text-xs hover:underline flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {data?.recentInterviews?.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={40} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 font-body text-sm">No interviews yet</p>
            <Link href="/interview/setup" className="text-neon-blue text-xs mt-2 inline-block hover:underline">
              Start your first interview →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.recentInterviews?.map((interview: any) => (
              <Link
                key={interview.sessionId}
                href={`/interview/results/${interview.sessionId}`}
                className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/5 hover:border-neon-blue/20 hover:bg-neon-blue/5 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center">
                    <Mic size={16} className="text-neon-blue" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-display font-semibold capitalize">
                      {interview.mode} Interview
                    </p>
                    <p className="text-white/30 text-xs font-mono mt-0.5">
                      {new Date(interview.completedAt).toLocaleDateString()} · {interview.difficulty} · {interview.questionsCount}Q
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ScoreColor score={interview.overallScore} />
                  <ChevronRight size={14} className="text-white/20 group-hover:text-neon-blue transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
