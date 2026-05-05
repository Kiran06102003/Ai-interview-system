'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { dashboardAPI } from '@/lib/apiClient';
import { Mic, ChevronRight, Filter } from 'lucide-react';

export default function HistoryPage() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ mode: '', difficulty: '' });
  const [loading, setLoading] = useState(true);

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getHistory({ page, ...filters, limit: 10 });
      setInterviews(res.data.interviews);
      setPagination(res.data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(1); }, [filters]);

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-neon-green' : s >= 60 ? 'text-neon-blue' : s >= 40 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="p-8 grid-bg min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Interview History</h1>
          <p className="text-white/40 text-sm font-mono mt-1">{pagination.total} sessions recorded</p>
        </div>
        <Link href="/interview/setup" className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <Mic size={14} /> New Interview
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter size={14} className="text-white/30" />
        {['', 'hr', 'technical', 'mixed'].map(m => (
          <button
            key={m}
            onClick={() => setFilters(f => ({ ...f, mode: m }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-body transition-all capitalize ${
              filters.mode === m
                ? 'bg-neon-blue/20 border border-neon-blue/40 text-neon-blue'
                : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/30'
            }`}
          >
            {m || 'All Modes'}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10" />
        {['', 'easy', 'medium', 'hard'].map(d => (
          <button
            key={d}
            onClick={() => setFilters(f => ({ ...f, difficulty: d }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-body transition-all capitalize ${
              filters.difficulty === d
                ? 'bg-neon-purple/20 border border-neon-purple/40 text-neon-purple'
                : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/30'
            }`}
          >
            {d || 'All Levels'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="text-center py-20">
            <Mic size={40} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 font-body">No interviews found</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-6 gap-4 px-6 py-3 border-b border-white/5 text-xs font-mono text-white/30 uppercase tracking-wider">
              <div className="col-span-2">Session</div>
              <div>Mode</div>
              <div>Difficulty</div>
              <div>Score</div>
              <div>Date</div>
            </div>

            {interviews.map((iv, i) => (
              <Link
                key={iv.sessionId}
                href={`/interview/results/${iv.sessionId}`}
                className={`grid grid-cols-6 gap-4 px-6 py-4 items-center hover:bg-neon-blue/5 transition-all group border-b border-white/5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/1'}`}
              >
                <div className="col-span-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neon-blue/10 flex items-center justify-center shrink-0">
                    <Mic size={14} className="text-neon-blue" />
                  </div>
                  <span className="text-white text-sm font-body truncate">
                    {iv.targetRole || 'General Interview'}
                  </span>
                </div>
                <div>
                  <span className="capitalize text-white/60 text-sm font-body">{iv.mode}</span>
                </div>
                <div>
                  <span className={`capitalize text-xs px-2 py-1 rounded-md font-mono ${
                    iv.difficulty === 'hard' ? 'bg-red-400/10 text-red-400'
                    : iv.difficulty === 'medium' ? 'bg-yellow-400/10 text-yellow-400'
                    : 'bg-neon-green/10 text-neon-green'
                  }`}>
                    {iv.difficulty}
                  </span>
                </div>
                <div>
                  <span className={`font-display font-bold text-lg ${scoreColor(iv.overallScore)}`}>
                    {iv.overallScore}
                  </span>
                  <span className="text-white/30 text-xs font-mono">/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/30 text-xs font-mono">
                    {new Date(iv.completedAt).toLocaleDateString()}
                  </span>
                  <ChevronRight size={14} className="text-white/10 group-hover:text-neon-blue transition-colors" />
                </div>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => fetchHistory(p)}
              className={`w-8 h-8 rounded-lg text-xs font-mono transition-all ${
                p === pagination.page
                  ? 'bg-neon-blue/20 border border-neon-blue/40 text-neon-blue'
                  : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/30'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
