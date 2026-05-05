'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const SKILLS_OPTIONS = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'Go',
  'SQL', 'MongoDB', 'AWS', 'Docker', 'System Design', 'Data Structures',
];

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    skills: [] as string[],
    experience: 0,
    targetRole: '',
  });
  const [loading, setLoading] = useState(false);

  const toggleSkill = (skill: string) => {
    setForm(p => ({
      ...p,
      skills: p.skills.includes(skill)
        ? p.skills.filter(s => s !== skill)
        : [...p.skills, skill],
    }));
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all required fields');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.register(form);
      setAuth(res.data.user, res.data.token);
      toast.success('Account created! Welcome to InterviewPro 🎉');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
              <span className="text-obsidian-950 font-display font-bold">AI</span>
            </div>
            <span className="font-display font-bold text-2xl text-white">InterviewPro</span>
          </Link>
          <h1 className="font-display font-bold text-3xl text-white mb-2">Create your account</h1>
          <p className="text-white/40 text-sm font-body">Step {step} of 2</p>

          {/* Progress */}
          <div className="flex gap-2 mt-4 justify-center">
            {[1, 2].map(s => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-neon-blue w-16' : 'bg-white/10 w-8'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="glass-card p-8">
          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-5">
              <div>
                <label className="block text-white/60 text-sm mb-2">Full Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">Email *</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">Password *</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                />
              </div>

              <button type="submit" className="btn-primary w-full py-3 rounded-xl text-sm">
                Continue →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-white/60 text-sm mb-2">Target Role</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Senior Software Engineer"
                  value={form.targetRole}
                  onChange={e => setForm(p => ({ ...p, targetRole: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">Years of Experience</label>
                <select
                  className="input-field"
                  value={form.experience}
                  onChange={e => setForm(p => ({ ...p, experience: parseInt(e.target.value) }))}
                  style={{ background: 'rgba(6, 6, 40, 0.8)' }}
                >
                  <option value={0}>Fresher (0 years)</option>
                  <option value={1}>1 year</option>
                  <option value={2}>2 years</option>
                  <option value={3}>3 years</option>
                  <option value={5}>5 years</option>
                  <option value={7}>7+ years</option>
                  <option value={10}>10+ years</option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-3">Skills (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS_OPTIONS.map(skill => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-body transition-all ${
                        form.skills.includes(skill)
                          ? 'bg-neon-blue/20 border border-neon-blue/60 text-neon-blue'
                          : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/30'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all text-sm"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-primary py-3 rounded-xl text-sm disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-white/40 text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-neon-blue hover:text-white transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
