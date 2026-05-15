'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authAPI, uploadAPI } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import { Save, Upload } from 'lucide-react';

const ALL_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'Java', 'Go',
  'Rust', 'C++', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'AWS', 'GCP', 'Azure',
  'Docker', 'Kubernetes', 'System Design', 'Data Structures', 'Algorithms',
  'Machine Learning', 'DevOps', 'GraphQL', 'REST APIs',
];

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [form, setForm] = useState({
    name: user?.name || '',
    targetRole: user?.targetRole || '',
    experience: user?.experience || 0,
    skills: user?.skills || [],
    preferredLanguage: 'en',
    preferredDifficulty: 'medium',
    resumeText: '',
  });
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const toggleSkill = (skill: string) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill) ? f.skills.filter(s => s !== skill) : [...f.skills, skill],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authAPI.updateProfile(form);
      updateUser(res.data.user);
      if (form.resumeText) {
        await uploadAPI.resume(form.resumeText);
      }
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.new.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    try {
      await authAPI.updateProfile({ currentPassword: passwordForm.current, newPassword: passwordForm.new });
      toast.success('Password changed successfully');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Password change failed');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="p-8 grid-bg min-h-screen max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-white">Profile Settings</h1>
        <p className="text-white/40 text-sm font-mono mt-1">Customize your interview preparation</p>
      </div>

      {/* Profile card */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-display font-semibold text-white mb-5">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-white/50 text-xs font-mono mb-2 uppercase tracking-wider">Full Name</label>
            <input
              className="input-field"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs font-mono mb-2 uppercase tracking-wider">Target Role</label>
            <input
              className="input-field"
              placeholder="e.g., Senior Software Engineer"
              value={form.targetRole}
              onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-white/50 text-xs font-mono mb-2 uppercase tracking-wider">Experience</label>
            <select
              className="input-field"
              value={form.experience}
              onChange={e => setForm(f => ({ ...f, experience: parseInt(e.target.value) }))}
              style={{ background: 'rgba(6,6,40,0.8)' }}
            >
              {[0, 1, 2, 3, 5, 7, 10].map(y => (
                <option key={y} value={y}>{y === 0 ? 'Fresher' : `${y}+ years`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-white/50 text-xs font-mono mb-2 uppercase tracking-wider">Default Difficulty</label>
            <select
              className="input-field"
              value={form.preferredDifficulty}
              onChange={e => setForm(f => ({ ...f, preferredDifficulty: e.target.value }))}
              style={{ background: 'rgba(6,6,40,0.8)' }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-display font-semibold text-white mb-1">Skills</h2>
        <p className="text-white/30 text-xs font-mono mb-4">Selected: {form.skills.length}</p>
        <div className="flex flex-wrap gap-2">
          {ALL_SKILLS.map(skill => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                form.skills.includes(skill)
                  ? 'bg-neon-blue/20 border border-neon-blue/50 text-neon-blue'
                  : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/30'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>

      {/* Resume */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Upload size={16} className="text-neon-blue" />
          <h2 className="font-display font-semibold text-white">Resume (Optional)</h2>
        </div>
        <p className="text-white/30 text-xs font-mono mb-4">Paste your resume text for personalized questions</p>
        <textarea
          className="input-field resize-none"
          rows={6}
          placeholder="Paste your resume content here..."
          value={form.resumeText}
          onChange={e => setForm(f => ({ ...f, resumeText: e.target.value }))}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 text-sm mb-8 disabled:opacity-50"
      >
        <Save size={14} />
        {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Change Password */}
      <div className="glass-card p-6">
        <h2 className="font-display font-semibold text-white mb-5">Change Password</h2>
        <div className="space-y-4">
          {[
            { label: 'Current Password', key: 'current' },
            { label: 'New Password', key: 'new' },
            { label: 'Confirm New Password', key: 'confirm' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-white/50 text-xs font-mono mb-2 uppercase tracking-wider">{label}</label>
              <input
                type="password"
                className="input-field"
                value={(passwordForm as any)[key]}
                onChange={e => setPasswordForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <button
            onClick={handlePasswordChange}
            disabled={savingPassword}
            className="px-6 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all text-sm disabled:opacity-50"
          >
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
