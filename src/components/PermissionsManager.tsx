/**
 * Permissions & Access Control Matrix Component (صفحة الصلاحيات)
 * Exclusively for System Admin (مدير النظام)
 * 
 * Features:
 * - Granular Permissions Matrix for SYSTEM_ADMIN, SALES_MANAGER, SALES_REP
 * - Categorized permissions with danger/warning badges
 * - User-specific permission overrides
 * - Search & Filter
 * - Save, Reset to defaults, and Select All / Clear All
 * - Live synchronization with backend persistent database store
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Users,
  Lock,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  X,
  Sliders,
  Filter,
  Eye,
  Key,
  Smartphone,
  Briefcase
} from 'lucide-react';
import { User, UserRole, RolePermissionsMatrix, PermissionDefinition } from '../types';
import { offlineRoomDb } from '../lib/offlineDb';

interface PermissionsManagerProps {
  currentUser: User;
}

export const PermissionsManager: React.FC<PermissionsManagerProps> = ({ currentUser }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('SALES_MANAGER');
  const [viewMode, setViewMode] = useState<'ROLE_MATRIX' | 'USER_OVERRIDES'>('ROLE_MATRIX');
  const [permissionsMatrix, setPermissionsMatrix] = useState<RolePermissionsMatrix>({
    SYSTEM_ADMIN: [],
    SALES_MANAGER: [],
    SALES_REP: [],
    userOverrides: {},
  });
  const [definitions, setDefinitions] = useState<PermissionDefinition[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getAuthToken = () => {
    const { token } = offlineRoomDb.getSession();
    return token || '';
  };

  const fetchPermissionsData = async () => {
    setIsLoading(true);
    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [permRes, usersRes] = await Promise.all([
        fetch('/api/permissions', { headers }),
        fetch('/api/users', { headers }),
      ]);

      if (permRes.ok) {
        const data = await permRes.json();
        setPermissionsMatrix(data.permissions || { SYSTEM_ADMIN: [], SALES_MANAGER: [], SALES_REP: [], userOverrides: {} });
        setDefinitions(data.definitions || []);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
        if (data.users && data.users.length > 0 && !selectedUserId) {
          setSelectedUserId(data.users[0].id);
        }
      }
    } catch (err) {
      console.error('[PermissionsManager] Error fetching permissions:', err);
      showToast('تعذر تحميل الصلاحيات من الخادم', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissionsData();
  }, []);

  // Categories list
  const categories = useMemo(() => {
    const cats = Array.from(new Set(definitions.map(d => d.category)));
    return ['الكل', ...cats];
  }, [definitions]);

  // Filtered definitions
  const filteredDefinitions = useMemo(() => {
    return definitions.filter(def => {
      const matchSearch =
        def.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.descriptionAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'الكل' || def.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [definitions, searchQuery, selectedCategory]);

  // Group definitions by category for structured display
  const groupedDefinitions = useMemo(() => {
    const groups: Record<string, PermissionDefinition[]> = {};
    for (const def of filteredDefinitions) {
      if (!groups[def.category]) groups[def.category] = [];
      groups[def.category].push(def);
    }
    return groups;
  }, [filteredDefinitions]);

  // Current active permissions for the role being edited
  const currentRolePerms = useMemo(() => {
    return permissionsMatrix[selectedRole] || [];
  }, [permissionsMatrix, selectedRole]);

  // Current selected user
  const targetUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId);
  }, [users, selectedUserId]);

  // Toggle single permission for role
  const handleToggleRolePermission = (permId: string) => {
    setPermissionsMatrix(prev => {
      const roleList = prev[selectedRole] || [];
      const exists = roleList.includes(permId);
      const updatedList = exists ? roleList.filter(id => id !== permId) : [...roleList, permId];
      return {
        ...prev,
        [selectedRole]: updatedList,
      };
    });
  };

  // Toggle single permission for user override
  const handleToggleUserPermission = (permId: string) => {
    if (!selectedUserId) return;
    setPermissionsMatrix(prev => {
      const overrides = { ...(prev.userOverrides || {}) };
      const userList = overrides[selectedUserId] || (targetUser?.role ? prev[targetUser.role] : []) || [];
      const exists = userList.includes(permId);
      const updated = exists ? userList.filter(id => id !== permId) : [...userList, permId];
      overrides[selectedUserId] = updated;
      return {
        ...prev,
        userOverrides: overrides,
      };
    });
  };

  // Select all or deselect all for current category
  const handleBatchToggleCategory = (categoryName: string, enable: boolean) => {
    const catPermIds = definitions.filter(d => d.category === categoryName).map(d => d.id);
    if (viewMode === 'ROLE_MATRIX') {
      setPermissionsMatrix(prev => {
        const currentList = prev[selectedRole] || [];
        let updatedList: string[];
        if (enable) {
          updatedList = Array.from(new Set([...currentList, ...catPermIds]));
        } else {
          updatedList = currentList.filter(id => !catPermIds.includes(id));
        }
        return { ...prev, [selectedRole]: updatedList };
      });
    } else if (selectedUserId) {
      setPermissionsMatrix(prev => {
        const overrides = { ...(prev.userOverrides || {}) };
        const currentList = overrides[selectedUserId] || (targetUser?.role ? prev[targetUser.role] : []) || [];
        let updatedList: string[];
        if (enable) {
          updatedList = Array.from(new Set([...currentList, ...catPermIds]));
        } else {
          updatedList = currentList.filter(id => !catPermIds.includes(id));
        }
        overrides[selectedUserId] = updatedList;
        return { ...prev, userOverrides: overrides };
      });
    }
  };

  // Save Permissions to Backend
  const handleSavePermissions = async () => {
    setIsSaving(true);
    const token = getAuthToken();
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: permissionsMatrix }),
      });

      if (res.ok) {
        showToast('تم حفظ وتطبيق مصفوفة الصلاحيات بنجاح!', 'success');
      } else {
        const err = await res.json();
        showToast(err.error || 'تعذر حفظ الصلاحيات', 'error');
      }
    } catch (err) {
      showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في استعادة مصفوفة الصلاحيات الافتراضية للنظام؟')) return;
    setIsSaving(true);
    const token = getAuthToken();
    try {
      const res = await fetch('/api/permissions/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPermissionsMatrix(data.permissions);
        showToast('تمت استعادة الصلاحيات الافتراضية بنجاح!', 'success');
      } else {
        showToast('فشل استعادة الصلاحيات الافتراضية', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Current active list depending on mode
  const isPermActive = (permId: string) => {
    if (viewMode === 'ROLE_MATRIX') {
      return (permissionsMatrix[selectedRole] || []).includes(permId);
    } else {
      const overrides = permissionsMatrix.userOverrides?.[selectedUserId];
      if (overrides) {
        return overrides.includes(permId);
      }
      return targetUser?.role ? (permissionsMatrix[targetUser.role] || []).includes(permId) : false;
    }
  };

  const activeCount = definitions.filter(d => isPermActive(d.id)).length;

  return (
    <div className="space-y-6 dir-rtl text-right font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-900/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100">لوحة إدارة ومصفوفة الصلاحيات المركزية</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                  خاصة بمدير النظام
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تحديد وضبط أذونات المشرفين، المناديب الميدانيين، ومدراء النظام مع مزامنة فورية وتأثير لحظي.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              disabled={isSaving}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>استعادة الافتراضي</span>
            </button>

            <button
              onClick={handleSavePermissions}
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ تعديلات الصلاحيات'}</span>
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setViewMode('ROLE_MATRIX')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                viewMode === 'ROLE_MATRIX'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>صلاحيات الأدوار العامة (Role Matrix)</span>
            </button>

            <button
              onClick={() => setViewMode('USER_OVERRIDES')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                viewMode === 'USER_OVERRIDES'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>تخصيص صلاحيات مستخدم فردي (User Overrides)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>الصلاحيات الفعالة:</span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold">
              {activeCount} من أصل {definitions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Target Role or User Selector */}
      {viewMode === 'ROLE_MATRIX' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* SYSTEM_ADMIN */}
          <button
            onClick={() => setSelectedRole('SYSTEM_ADMIN')}
            className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 relative ${
              selectedRole === 'SYSTEM_ADMIN'
                ? 'bg-rose-950/20 border-rose-500 shadow-lg shadow-rose-950/20'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedRole === 'SYSTEM_ADMIN' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-rose-400'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100">مدير النظام (System Admin)</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">
                  {(permissionsMatrix.SYSTEM_ADMIN || []).length} صلاحية
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">صلاحيات إدارة المستخدمين، الصلاحيات، حذف البيانات، وإعدادات GPS الحساسة.</p>
            </div>
          </button>

          {/* SALES_MANAGER */}
          <button
            onClick={() => setSelectedRole('SALES_MANAGER')}
            className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 relative ${
              selectedRole === 'SALES_MANAGER'
                ? 'bg-blue-950/20 border-blue-500 shadow-lg shadow-blue-950/20'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedRole === 'SALES_MANAGER' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400'
            }`}>
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100">المشرف / مدير المبيعات</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300">
                  {(permissionsMatrix.SALES_MANAGER || []).length} صلاحية
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">إشراف على مناديب صنعاء، اعتماد الزيارات، إضافة الأطباء، ومراجعة تقارير الامتثال.</p>
            </div>
          </button>

          {/* SALES_REP */}
          <button
            onClick={() => setSelectedRole('SALES_REP')}
            className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 relative ${
              selectedRole === 'SALES_REP'
                ? 'bg-emerald-950/20 border-emerald-500 shadow-lg shadow-emerald-950/20'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedRole === 'SALES_REP' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400'
            }`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100">المندوب الميداني (Sales Rep)</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                  {(permissionsMatrix.SALES_REP || []).length} صلاحية
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">تسجيل الزيارات الميدانية دون إنترنت، مزامنة نهاية اليوم، ومطابقة موقع الطبيب.</p>
            </div>
          </button>
        </div>
      ) : (
        /* User Specific Picker */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="text-xs text-slate-400 font-semibold block">اختر المستخدم لتخصيص صلاحياته الفردية:</span>
              <div className="flex items-center gap-2 mt-1">
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold focus:border-cyan-500 focus:outline-none"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.username}) · {u.role === 'SYSTEM_ADMIN' ? 'مدير نظام' : u.role === 'SALES_MANAGER' ? 'مشرف' : 'مندوب'} · {u.assignedRegion}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {targetUser && (
            <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">الدور الأساسي:</span>
                <span className="font-bold text-slate-200">{targetUser.role}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-slate-400 block text-[11px]">المنطقة:</span>
                <span className="font-bold text-slate-200">{targetUser.assignedRegion}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-slate-400 block text-[11px]">البريد الإلكتروني:</span>
                <span className="font-mono text-cyan-300 font-bold">{targetUser.email || 'غير مسجل'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Category Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="ابحث عن صلاحية معينة (مثل: حذف، GPS، استيراد، إضافة)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Permissions Matrix Content */}
      <div className="space-y-6">
        {Object.entries(groupedDefinitions).map(([categoryName, perms]) => {
          const categoryActiveCount = perms.filter(p => isPermActive(p.id)).length;
          const allActive = categoryActiveCount === perms.length;

          return (
            <div key={categoryName} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              {/* Category Header */}
              <div className="bg-slate-950/70 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <h3 className="font-bold text-sm text-slate-100">{categoryName}</h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({categoryActiveCount} من {perms.length} مفعلة)
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleBatchToggleCategory(categoryName, true)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    تحديد الكل
                  </button>
                  <button
                    onClick={() => handleBatchToggleCategory(categoryName, false)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>

              {/* Permissions Items List */}
              <div className="divide-y divide-slate-800/60 p-2">
                {perms.map(perm => {
                  const active = isPermActive(perm.id);

                  return (
                    <div
                      key={perm.id}
                      onClick={() => {
                        if (viewMode === 'ROLE_MATRIX') {
                          handleToggleRolePermission(perm.id);
                        } else {
                          handleToggleUserPermission(perm.id);
                        }
                      }}
                      className={`p-3.5 rounded-xl transition-all flex items-center justify-between gap-4 cursor-pointer ${
                        active ? 'hover:bg-cyan-950/20' : 'hover:bg-slate-800/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Toggle Checkbox Indicator */}
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                            active
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-slate-950 border border-slate-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-xs font-bold transition-colors ${active ? 'text-slate-100' : 'text-slate-400'}`}>
                              {perm.nameAr}
                            </h4>

                            {perm.dangerLevel === 'danger' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-300">
                                صلاحية حرجة (حذف/أمان)
                              </span>
                            )}
                            {perm.dangerLevel === 'warning' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-300">
                                حساسة (GPS / كلمات مرور)
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{perm.descriptionAr}</p>
                        </div>
                      </div>

                      {/* Technical Key Tag */}
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 shrink-0">
                        {perm.id}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
