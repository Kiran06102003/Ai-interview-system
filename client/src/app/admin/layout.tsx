'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, Users, MessageSquare, Settings, LogOut, ChevronRight, ShieldCheck
} from 'lucide-react';

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Admin Home', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Manage Users', icon: Users },
  { href: '/admin/interviews', label: 'All Interviews', icon: MessageSquare },
  { href: '/admin/settings', label: 'System Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated()) {
        router.push('/auth/login');
      } else if (user?.role !== 'admin') {
        router.push('/dashboard'); // Regular users shouldn't be here
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !user || user.role !== 'admin') {
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
      <aside className="w-64 bg-obsidian-950 border-r border-white/5 flex flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
              <span className="text-obsidian-950 font-display font-bold text-sm">AI</span>
            </div>
            <span className="font-display font-bold text-lg text-white">AdminPanel</span>
          </Link>
        </div>

        {/* Admin info */}
        <div className="px-4 py-4 border-b border-white/5 bg-neon-blue/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-neon-blue/20 flex items-center justify-center border border-neon-blue/30">
              <ShieldCheck size={18} className="text-neon-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-display font-semibold truncate">{user.name}</p>
              <p className="text-neon-blue text-[10px] uppercase tracking-widest font-mono">System Admin</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {adminNavItems.map(({ href, label, icon: Icon }) => {
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

        {/* Bottom */}
        <div className="p-4 border-t border-white/5">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 w-full px-3 py-2 mb-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            <span className="font-body italic text-xs">Switch to User View</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/5 transition-all text-sm"
          >
            <LogOut size={14} />
            <span className="font-body">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
