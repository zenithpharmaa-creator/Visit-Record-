/**
 * Main Application Shell & Authentication Router
 */

import React, { useState, useEffect } from 'react';
import { Smartphone, Shield, Users, Lock, User as UserIcon, Layers, LogIn } from 'lucide-react';
import { User } from './types';
import { offlineRoomDb } from './lib/offlineDb';
import { MobileAppView } from './components/MobileAppView';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string>('rep_hassan');
  const [password, setPassword] = useState<string>('123456');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'mobile' | 'admin'>('mobile');

  // GitHub Modal & Credentials State
  const [showGitHubModal, setShowGitHubModal] = useState<boolean>(false);
  const [githubClientId, setGithubClientId] = useState<string>(() => localStorage.getItem('github_client_id') || '');
  const [githubClientSecret, setGithubClientSecret] = useState<string>(() => localStorage.getItem('github_client_secret') || '');

  useEffect(() => {
    // Check local session for offline-first persistent login
    const session = offlineRoomDb.getSession();
    if (session.user) {
      setCurrentUser(session.user);
      setViewMode(session.user.role === 'SALES_REP' ? 'mobile' : 'admin');
    }

    // Listen for GitHub OAuth popup completion
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        const ghUser = event.data.user;
        const loggedInUser: User = {
          id: `gh_${ghUser.id || Date.now()}`,
          username: ghUser.login || 'github_user',
          fullName: ghUser.name || ghUser.login || 'GitHub User',
          role: 'SALES_MANAGER',
          phone: '',
          assignedRegion: 'صنعاء - حدة والسبعين',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };
        offlineRoomDb.setSession('github_oauth_token_2026', loggedInUser);
        setCurrentUser(loggedInUser);
        setViewMode('admin');
        setShowGitHubModal(false);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const triggerGitHubPopup = async (cId: string) => {
    // Open popup synchronously on user click to avoid browser popup blockers
    const popup = window.open('about:blank', 'github_oauth_popup', 'width=600,height=700');
    if (!popup) {
      alert('تم منع النافذة المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة (Pop-ups) ثم المحاولة مجدداً.');
      return;
    }

    try {
      const res = await fetch(`/api/auth/github/url?client_id=${encodeURIComponent(cId.trim())}`);
      if (res.ok) {
        const { url } = await res.json();
        popup.location.href = url;
      } else {
        popup.close();
        localStorage.removeItem('github_client_id');
        setGithubClientId('');
        setShowGitHubModal(true);
        alert('رمز Client ID غير صحيح أو غير مسجل في GitHub. يرجى التأكد من نسخه بدقة من صفحة OAuth Apps في GitHub.');
      }
    } catch (err) {
      console.error('[GitHub Connect] Error getting GitHub auth URL:', err);
      if (popup) popup.close();
    }
  };

  const handleGitHubConnect = () => {
    const savedId = localStorage.getItem('github_client_id') || githubClientId;
    if (!savedId) {
      setShowGitHubModal(true);
    } else {
      triggerGitHubPopup(savedId);
    }
  };

  const handleSaveGitHubConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubClientId.trim()) {
      alert('يرجى إدخال Client ID الخاص بـ GitHub');
      return;
    }
    localStorage.setItem('github_client_id', githubClientId.trim());
    if (githubClientSecret.trim()) {
      localStorage.setItem('github_client_secret', githubClientSecret.trim());
    }
    setShowGitHubModal(false);
    triggerGitHubPopup(githubClientId.trim());
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        offlineRoomDb.setSession(data.token, data.user);
        setCurrentUser(data.user);
        setViewMode(data.user.role === 'SALES_REP' ? 'mobile' : 'admin');
      } else {
        const errorData = await res.json();
        setLoginError(errorData.error || 'فشلت عملية تسجيل الدخول');
      }
    } catch (err) {
      console.log('Login network error, attempting offline login fallback:', err);
      // Fallback for offline login if session exists or offline test accounts
      const session = offlineRoomDb.getSession();
      if (session.user && session.user.username === username) {
        setCurrentUser(session.user);
        setViewMode(session.user.role === 'SALES_REP' ? 'mobile' : 'admin');
      } else {
        setLoginError('تعذر الاتصال بالخادم. يرجى تسجيل الدخول لأول مرة عبر الاتصال بالشبكة.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    offlineRoomDb.clearSession();
    setCurrentUser(null);
  };

  // Quick Demo Account Auto-Fill
  const quickLoginAs = (roleUsername: string) => {
    setUsername(roleUsername);
    setPassword('123456');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans dir-rtl">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center text-cyan-400 mx-auto">
              <Layers className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">FIELD VISIT TRACKER</h1>
            <p className="text-xs text-slate-400">نظام تسجيل ومتابعة الزيارات الميدانية - Offline-First</p>
          </div>

          {/* Quick Demo Selectors */}
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2">
            <span className="text-[11px] text-slate-400 font-bold block">اختر حساباً تجريبياً للتسجيل المباشر:</span>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => quickLoginAs('rep_hassan')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  username === 'rep_hassan'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4 mx-auto mb-1" />
                <span>مندوب (Rep)</span>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAs('manager_sanaa')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  username === 'manager_sanaa'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 mx-auto mb-1" />
                <span>مشرف (Mgr)</span>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAs('admin')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  username === 'admin'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-4 h-4 mx-auto mb-1" />
                <span>مدير (Admin)</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl text-center">
                {loginError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">اسم المستخدم:</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2.5 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">كلمة المرور:</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2.5 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoggingIn ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول للنظام'}</span>
            </button>

            <button
              type="button"
              onClick={handleGitHubConnect}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow transition-all"
            >
              <svg className="w-4 h-4 fill-current text-slate-200" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>تسجيل الدخول / الربط بحساب GitHub</span>
            </button>
          </form>
        </div>

        {/* GitHub Integration Modal */}
        {showGitHubModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-100 dir-rtl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <svg className="w-6 h-6 fill-current text-cyan-400" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">ربط تطبيق GitHub OAuth</h3>
                  <p className="text-xs text-slate-400">أدخل بيانات تطبيقك من GitHub Settings</p>
                </div>
              </div>

              <form onSubmit={handleSaveGitHubConfig} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">GitHub Client ID (مطلوب):</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: Ov23li..."
                    value={githubClientId}
                    onChange={e => setGithubClientId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">الرابط المطلوب في GitHub Settings:</p>
                  <code className="block bg-slate-900 p-1.5 rounded text-cyan-400 font-mono select-all break-all dir-ltr text-left">
                    https://ais-dev-gg2b2vz3woxxeevhjzru3w-53432909942.europe-west2.run.app/auth/github/callback
                  </code>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow"
                  >
                    حفظ ومتابعة الربط بـ GitHub
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGitHubModal(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Role Switcher Toolbar for Quick Testing */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>جلسة نشطة: <strong className="text-slate-200">{currentUser.fullName}</strong> ({currentUser.role})</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('mobile')}
            className={`px-3 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 ${
              viewMode === 'mobile' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>تطبيق المندوب (Mobile View)</span>
          </button>

          <button
            onClick={() => setViewMode('admin')}
            className={`px-3 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 ${
              viewMode === 'admin' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>لوحة المدير (Admin Dashboard)</span>
          </button>
        </div>
      </div>

      {viewMode === 'mobile' ? (
        <MobileAppView currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <AdminDashboard currentUser={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}
