'use client';

import { useAuthStore } from '@/store/authStore';

export default function AdminDashboard() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Admin Dashboard</h1>
          <p className="text-white/40 text-sm font-body">Welcome back, {user.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white text-sm font-medium">{user.name}</p>
            <p className="text-white/30 text-xs uppercase tracking-wider font-mono">System Admin</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-neon-blue/20 border border-neon-blue/30 flex items-center justify-center text-neon-blue font-bold">
            {user.name.charAt(0)}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-2">Total Users</p>
          <h3 className="text-3xl font-display font-bold text-white">1,284</h3>
          <p className="text-neon-green text-xs font-mono mt-2">+12% from last week</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-2">Total Interviews</p>
          <h3 className="text-3xl font-display font-bold text-white">4,592</h3>
          <p className="text-neon-blue text-xs font-mono mt-2">+5% from last month</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-2">System Health</p>
          <h3 className="text-3xl font-display font-bold text-neon-green">Stable</h3>
          <p className="text-white/30 text-xs font-mono mt-2">All services operational</p>
        </div>
      </div>

      <div className="mt-8 glass-card p-8">
        <h2 className="text-xl font-display font-bold text-white mb-6">Recent Activity</h2>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/40 text-xs font-mono">
                  {i}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">New interview completed by user_{i}29</p>
                  <p className="text-white/30 text-xs font-body">2 minutes ago</p>
                </div>
              </div>
              <span className="text-neon-blue text-xs font-mono">View Details</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
