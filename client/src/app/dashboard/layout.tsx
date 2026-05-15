'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, Mic, History, BarChart3, User, LogOut, ChevronRight, ShieldCheck
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/interview/setup', label: 'New Interview', icon: Mic },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated()) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-obsidian-950/80 border-r border-white/5 flex flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
              <span className="text-obsidian-950 font-display font-bold text-sm">AI</span>
            </div>
            <span className="font-display font-bold text-lg text-white">InterviewPro</span>
          </Link>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neon-blue/30 to-neon-purple/30 flex items-center justify-center border border-neon-blue/20">
              <span className="text-neon-blue font-display font-bold text-sm">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-display font-semibold truncate">{user?.name}</p>
              <p className="text-white/30 text-xs font-mono truncate">{user?.targetRole || 'Set your role'}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                  active
                    ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                <span className="font-body text-sm">{label}</span>
                {active && <ChevronRight size={12} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom stats */}
        {user && (
          <div className="px-4 py-4 border-t border-white/5">
            {user.role === 'admin' && (
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-2 w-full px-3 py-2 mb-2 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 transition-all text-sm font-medium"
              >
                <ShieldCheck size={14} />
                <span>Admin Panel</span>
              </Link>
            )}

            <div className="glass-card p-3 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/40 text-xs font-mono">Interviews</span>
                <span className="text-neon-blue font-display font-bold text-sm">{user.totalInterviews || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs font-mono">Avg Score</span>
                <span className={`font-display font-bold text-sm ${
                  (user.averageScore || 0) >= 70 ? 'text-neon-green' :
                  (user.averageScore || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>{user.averageScore || 0}/100</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/5 transition-all text-sm"
            >
              <LogOut size={14} />
              <span className="font-body">Sign out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
