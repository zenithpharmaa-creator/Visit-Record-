/**
 * Android Native Field Sales Rep Mobile Interface (RTL)
 * Offline-First + Room DB + GPS + Haversine + Idempotent Sync
 */

import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Wifi,
  WifiOff,
  Navigation,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Search,
  User,
  Phone,
  Building2,
  LogOut,
  Send,
  FileText,
  Smartphone,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';
import { Customer, Visit, LocationStatus, AppConfiguration } from '../types';
import { offlineRoomDb } from '../lib/offlineDb';
import { calculateHaversineDistanceMeters } from '../lib/haversine';
import { requestAndGetNativeLocation } from '../lib/nativeGps';

interface MobileAppViewProps {
  currentUser: any;
  onLogout: () => void;
}

export const MobileAppView: React.FC<MobileAppViewProps> = ({ currentUser, onLogout }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Simulated GPS Hardware State
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(false); // Initialize as false until verified
  const [simulatedLat, setSimulatedLat] = useState<number>(15.3540); // Default Sana'a (Al-Zubairi / Hadda)
  const [simulatedLng, setSimulatedLng] = useState<number>(44.2050);
  const [simulatedAccuracy, setSimulatedAccuracy] = useState<number>(8.5); // meters
  const [isMockLocation, setIsMockLocation] = useState<boolean>(false);

  // Active & Today's Visits State
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [todaysVisits, setTodaysVisits] = useState<Visit[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('تم كتابة طلبية');
  const [selectedType, setSelectedType] = useState<string>('روتينية');
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfiguration | null>(null);

  // First-time GPS permission onboarding state
  const [showGpsPermissionModal, setShowGpsPermissionModal] = useState<boolean>(() => {
    return !localStorage.getItem('gps_permission_requested_2026');
  });

  const handleRequestGpsPermission = async () => {
    const res = await requestAndGetNativeLocation();
    localStorage.setItem('gps_permission_requested_2026', 'true');
    setShowGpsPermissionModal(false);
    if (res.permissionGranted) {
      setGpsEnabled(true);
      setSyncStatusMessage('تم تفعيل إذن الـ GPS بنجاح!');
      setTimeout(() => setSyncStatusMessage(null), 3000);
    } else {
      alert('⚠️ تم رفض الإذن أو تعذر الوصول للـ GPS. يرجى تفعيل الـ GPS من إعدادات المتصفح أو الجهاز.');
    }
  };

  // Real GPS Hardware Status Probe on Mount & Refresh
  const checkRealGpsHardware = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setGpsEnabled(true);
        },
        (err) => {
          console.warn('[GPS Hardware Check] Physical GPS is disabled or permission denied:', err);
          setGpsEnabled(false);
        },
        { timeout: 4000, maximumAge: 0, enableHighAccuracy: true }
      );
    } else {
      setGpsEnabled(false);
    }
  };

  useEffect(() => {
    checkRealGpsHardware();
  }, []);

  useEffect(() => {
    loadLocalData();
    fetchServerConfigAndDelta();
  }, [currentUser]);

  const loadLocalData = () => {
    // Universal customer assignment rule for ALL sales rep accounts:
    // 1. Explicitly assigned to current user (c.assignedRepId === currentUser.id) -> 100% visible across all rep accounts.
    // 2. Unassigned customers in their region.
    const allCustomers = offlineRoomDb.getLocalCustomers(searchQuery);
    const assignedCustomers = allCustomers.filter(c => {
      const isAssignedToMe = c.assignedRepId === currentUser.id;
      const isInMyRegionUnassigned = !c.assignedRepId && (
        !currentUser.assignedRegion || 
        currentUser.assignedRegion === 'الكل' || 
        c.region === currentUser.assignedRegion
      );
      return isAssignedToMe || isInMyRegionUnassigned;
    });
    setCustomers(assignedCustomers);

    const visits = offlineRoomDb.getVisits().filter(v => v.userId === currentUser.id);
    setTodaysVisits(visits);

    // Uncompleted visit crash recovery check
    const uncompleted = offlineRoomDb.getUncompletedVisit(currentUser.id);
    if (uncompleted) {
      setActiveVisit(uncompleted);
      const cust = offlineRoomDb.getCustomerById(uncompleted.customerId);
      if (cust) setSelectedCustomer(cust);
    }

    const config = offlineRoomDb.getAppConfig();
    if (config) setAppConfig(config);
  };

  const fetchServerConfigAndDelta = async () => {
    if (!isOnline) return;

    try {
      // Fetch latest configuration
      const configRes = await fetch('/api/configuration');
      if (configRes.ok) {
        const configData: AppConfiguration = await configRes.json();
        offlineRoomDb.saveAppConfig(configData);
        setAppConfig(configData);
      }

      // Fetch Customer Full/Delta sync
      const { token } = offlineRoomDb.getSession();
      if (token) {
        const custRes = await fetch(`/api/customers?sinceVersion=0`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (custRes.ok) {
          const deltaData = await custRes.json();
          if (deltaData.customers && deltaData.customers.length > 0) {
            offlineRoomDb.applyCustomersDelta(deltaData.customers, deltaData.latestVersion);
            loadLocalData();
          }
        }
      }
    } catch (err) {
      console.log('[MobileApp] Offline or server unreachable for config/delta update:', err);
    }
  };

  // Live GPS Distance calculation
  const currentDistanceMeters = selectedCustomer && gpsEnabled
    ? calculateHaversineDistanceMeters(simulatedLat, simulatedLng, selectedCustomer.latitude, selectedCustomer.longitude)
    : null;

  const threshold = appConfig?.gpsAccuracyThresholdMeters || 30;
  const isWithinRadius = selectedCustomer && currentDistanceMeters !== null
    ? currentDistanceMeters <= selectedCustomer.allowedVisitRadiusMeters
    : false;

  // Visit Actions - Zero-Trust Strict GPS & Geofencing Guard
  const handleStartVisit = async () => {
    if (!selectedCustomer) {
        alert('❌ يرجى اختيار عميل من القائمة أولاً لبدء الزيارة.');
        return;
    }

    // 1. Strict GPS Enabled Check (Direct Probe)
    const probe = await requestAndGetNativeLocation();
    
    // Only block if we are on Native platform and permission is actually denied. 
    // Relax for browser/web preview to avoid blocking testing while still logging error.
    if (!Capacitor.isNativePlatform()) {
        console.warn('[GPS Debug] Running in non-native mode, bypassing strict permission block for testing:', probe.errorMessage);
    } else if (!probe.permissionGranted || probe.latitude === 0) {
      let userMessage = `❌ تعذر بدء الزيارة! لا يمكن الوصول لخدمة الـ GPS.\n\nالسبب: ${probe.errorMessage || 'خطأ غير معروف.'}`;
      
      if (probe.errorType === 'PERMISSION_DENIED') {
        userMessage = '❌ تم رفض إذن الوصول للموقع. يرجى تفعيل الصلاحية من إعدادات التطبيق.';
      } else if (probe.errorType === 'TIMEOUT') {
        userMessage = '❌ انتهت مهلة البحث عن موقعك. يرجى التأكد من تواجدك في مكان مفتوح والمحاولة مرة أخرى.';
      }
      
      alert(userMessage);
      setGpsEnabled(false);
      return;
    }
    
    setGpsEnabled(true);

    let lat = probe.latitude;
    let lng = probe.longitude;
    let accuracy = probe.accuracy;
    let provider = probe.provider;
    let isMock = probe.isMockLocation;

    // 3. Strict Geofencing Radius Distance Guard (Zero-Tolerance)
    const distanceMeters = calculateHaversineDistanceMeters(
      lat,
      lng,
      selectedCustomer.latitude,
      selectedCustomer.longitude
    );

    const maxRadius = selectedCustomer.allowedVisitRadiusMeters || 30;

    if (distanceMeters > maxRadius) {
      alert(`❌ تعذر بدء الزيارة! أنت بعيد جداً عن موقع العميل.\n\n- المسافة الحالية: ${Math.round(distanceMeters)} متر\n- النطاق الجغرافي المسموح: ${maxRadius} متر\n\nلا يمكن تسجيل الزيارة خارج نطاق العميل الجغرافي.`);
      return;
    }

    const newVisit = offlineRoomDb.startVisit({
      userId: currentUser.id,
      customer: selectedCustomer,
      deviceInstallationId: 'android_device_rep_app_2026',
      lat,
      lng,
      accuracy,
      provider,
      isMock,
      configThreshold: threshold,
    });

    setActiveVisit(newVisit);
    setNotes('');
    loadLocalData();
  };

  const handleEndVisit = async () => {
    if (!activeVisit) return;

    // Strict GPS Enabled Check (Direct Probe)
    const probe = await requestAndGetNativeLocation();
    
    if (!probe.permissionGranted || probe.latitude === 0) {
      let userMessage = `❌ تعذر إنهاء الزيارة! لا يمكن الوصول لخدمة الـ GPS.\n\nالسبب: ${probe.errorMessage || 'خطأ غير معروف.'}`;
      
      if (probe.errorType === 'LOCATION_SERVICES_DISABLED') {
        userMessage = '❌ خدمات الموقع (GPS) معطلة على جهازك. يرجى تفعيلها من إعدادات الجهاز للمتابعة.';
      } else if (probe.errorType === 'PERMISSION_DENIED') {
        userMessage = '❌ تم رفض إذن الوصول للموقع. يرجى تفعيل الصلاحية من إعدادات التطبيق.';
      } else if (probe.errorType === 'TIMEOUT') {
        userMessage = '❌ انتهت مهلة البحث عن موقعك. يرجى التأكد من تواجدك في مكان مفتوح والمحاولة مرة أخرى.';
      }
      
      alert(userMessage);
      setGpsEnabled(false);
      return;
    }
    
    setGpsEnabled(true);

    const lat = probe.latitude;
    const lng = probe.longitude;
    const accuracy = probe.accuracy;
    const provider = probe.provider;
    const isMock = probe.isMockLocation;

    const customer = offlineRoomDb.getCustomerById(activeVisit.customerId);
    if (customer) {
      const distanceMeters = calculateHaversineDistanceMeters(lat, lng, customer.latitude, customer.longitude);
      const maxRadius = customer.allowedVisitRadiusMeters || 30;
      if (distanceMeters > maxRadius) {
        alert(`❌ تعذر إتمام الزيارة! أنت بعيد جداً عن موقع العميل (${Math.round(distanceMeters)} متر، المسموح ${maxRadius} متر). لا يمكن إنهاء الزيارة خارج نطاق العميل الجغرافي.`);
        return;
      }
    }

    offlineRoomDb.endVisit({
      visitId: activeVisit.visitId,
      lat,
      lng,
      accuracy,
      provider,
      isMock,
      notes,
      visitOutcome: selectedOutcome,
      visitType: selectedType,
    });

    setActiveVisit(null);
    setSelectedCustomer(null);
    setNotes('');
    loadLocalData();

    // Trigger auto-sync if online
    if (isOnline) {
      triggerSync();
    }
  };

  // Sync Processor
  const triggerSync = async () => {
    if (!isOnline) {
      setSyncStatusMessage('لا يوجد اتصال بالإنترنت. تم حفظ البيانات محلياً للرفع لاحقاً.');
      setTimeout(() => setSyncStatusMessage(null), 4000);
      return;
    }

    setIsSyncing(true);
    setSyncStatusMessage('جاري المزامنة مع الخادم المركزي...');

    try {
      const pendingQueue = offlineRoomDb.getPendingSyncQueue();
      if (pendingQueue.length === 0) {
        setSyncStatusMessage('جميع الزيارات متزامنة بالكامل مع الخادم!');
        setIsSyncing(false);
        setTimeout(() => setSyncStatusMessage(null), 3000);
        return;
      }

      const allVisits = offlineRoomDb.getVisits();
      const visitsToSync = pendingQueue
        .map(q => allVisits.find(v => v.visitId === q.visitId))
        .filter((v): v is Visit => v !== undefined);

      const { token } = offlineRoomDb.getSession();
      const res = await fetch('/api/visits/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visits: visitsToSync }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.syncedVisitIds && data.syncedVisitIds.length > 0) {
          offlineRoomDb.markVisitsSynced(data.syncedVisitIds);
          setSyncStatusMessage(`تمت مزامنة ${data.syncedVisitIds.length} زيارة بنجاح!`);
        }
      } else {
        setSyncStatusMessage('فشلت المزامنة. ستتم إعادة المحاولة تلقائياً.');
      }
    } catch (err) {
      console.warn('[Sync] Offline / Network unreachable, keeping visits in local Sync Queue:', err);
      setSyncStatusMessage('تم حفظ البيانات محلياً في قائمة الانتظار (Sync Queue). ستتم المزامنة تلقائياً عند استقرار الاتصال.');
    } finally {
      setIsSyncing(false);
      loadLocalData();
      setTimeout(() => setSyncStatusMessage(null), 4000);
    }
  };

  const pendingCount = todaysVisits.filter(v => v.state === 'PENDING_SYNC' || v.state === 'SYNC_FAILED').length;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 flex flex-col shadow-2xl border-x border-slate-800">
      {/* Top Header - Offline / Online Banner & Rep Identity */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100">{currentUser.fullName}</h1>
              <span className="text-xs text-slate-400">مندوب مبيعات · {currentUser.assignedRegion}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-slate-800"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Network & Offline Mode Switcher */}
        <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              const nextState = !isOnline;
              setIsOnline(nextState);
              if (nextState) fetchServerConfigAndDelta();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isOnline
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>{isOnline ? 'شبكة متصلة (Online)' : 'نمط الميدان (Offline)'}</span>
          </button>

          <button
            onClick={triggerSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>مزامنة ({pendingCount})</span>
          </button>
        </div>

        {syncStatusMessage && (
          <div className="mt-2 text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-800/80 p-2 rounded-lg flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{syncStatusMessage}</span>
          </div>
        )}
      </header>

      {/* Main Body */}
      <main className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* GPS Control Panel (Testing Simulator) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-300">
              <Navigation className="w-4 h-4 text-cyan-400" />
              <span>مستشعر GPS الحقيقي</span>
              <button
                type="button"
                onClick={checkRealGpsHardware}
                className="text-[10px] text-cyan-400 underline hover:text-cyan-300 ml-1"
                title="فحص حالة الـ GPS الحقيقي في الجهاز"
              >
                (فحص الجهاز)
              </button>
            </div>
            <button
              onClick={() => setGpsEnabled(!gpsEnabled)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                gpsEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {gpsEnabled ? 'مفعل (Fused)' : 'معطل'}
            </button>
          </div>

          {gpsEnabled ? (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums bg-slate-950/70 p-2 rounded-xl border border-slate-800 text-slate-400">
              <div>خط العرض: {simulatedLat.toFixed(4)}</div>
              <div>خط الطول: {simulatedLng.toFixed(4)}</div>
              <div>الدقة: {simulatedAccuracy} متر</div>
              <div className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  id="mockLocationCheck"
                  checked={isMockLocation}
                  onChange={e => setIsMockLocation(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="mockLocationCheck" className="text-amber-400 font-sans cursor-pointer">
                  محاكاة Fake GPS
                </label>
              </div>
            </div>
          ) : (
            <div className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-xl border border-rose-900/50 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>خدمات الموقع معطلة. سيتم تسجيل الزيارة كـ GPS Unavailable.</span>
            </div>
          )}
        </div>

        {/* Active Visit Banner (Crash Recovery) */}
        {activeVisit && (
          <div className="bg-gradient-to-r from-amber-950/80 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 shadow-xl space-y-3 animate-pulse-subtle">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/30">
                زيارة جارية غير مكتملة
              </span>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                بدأت: {new Date(activeVisit.startTimeDevice).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {selectedCustomer && (
              <div>
                <h3 className="font-bold text-slate-100 text-base">{selectedCustomer.customerName}</h3>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                  <span className="font-mono text-cyan-400">كود: {selectedCustomer.customerCode}</span>
                  <span>·</span>
                  <span>{selectedCustomer.address}</span>
                </div>
              </div>
            )}

            {/* Visit Outcomes Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs text-slate-300 font-semibold block">نوع ونشاط الزيارة:</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {(appConfig?.allowedVisitTypes || ['روتينية', 'تحصيل', 'ترويج منتج جديد']).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <select
                  value={selectedOutcome}
                  onChange={e => setSelectedOutcome(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {(appConfig?.allowedVisitOutcomes || ['تم كتابة طلبية', 'متابعة لاحقة', 'تحصيل مبلغ']).map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="ملاحظات الزيارة والمخزون..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none h-20 resize-none"
              />
            </div>

            <button
              onClick={handleEndVisit}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>إنهاء الزيارة وحفظها محلياً</span>
            </button>
          </div>
        )}

        {/* Customer Search & Selection View */}
        {!activeVisit && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCustomers(offlineRoomDb.getLocalCustomers(e.target.value, currentUser.assignedRegion));
                }}
                placeholder="ابحث باسم العميل، كود العميل (مثل 010001)، أو الهاتف..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none placeholder:text-slate-500"
              />
            </div>

            {/* Selected Customer Card Preview */}
            {selectedCustomer && (
              <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-slate-100 text-base">{selectedCustomer.customerName}</h2>
                    <div className="text-xs text-slate-400 mt-0.5 space-x-2 space-x-reverse">
                      <span className="font-mono text-cyan-400 font-bold">الكود: {selectedCustomer.customerCode}</span>
                      <span>·</span>
                      <span>{selectedCustomer.region}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="text-xs text-slate-300 space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>المسؤول: {selectedCustomer.ownerName || 'غير محدد'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono tabular-nums">{selectedCustomer.phone || 'غير مسجل'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{selectedCustomer.address}</span>
                  </div>
                </div>

                {/* GPS Live Proximity Check */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">حالة النطاق الجغرافي:</span>
                    {gpsEnabled ? (
                      <span className={`font-bold flex items-center gap-1 ${
                        isWithinRadius ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {isWithinRadius ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {isWithinRadius ? 'داخل النطاق المسموح' : 'خارج النطاق المسموح'}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-medium">GPS غير متاح</span>
                    )}
                  </div>

                  {gpsEnabled && currentDistanceMeters !== null && (
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums bg-slate-900/80 p-2 rounded-lg">
                      <div>المسافة الفعلية: <span className="font-bold text-slate-200">{currentDistanceMeters}m</span></div>
                      <div>النطاق المسموح: <span className="font-bold text-slate-200">{selectedCustomer.allowedVisitRadiusMeters}m</span></div>
                    </div>
                  )}

                  {isMockLocation && (
                    <div className="text-[11px] text-rose-400 bg-rose-950/40 p-1.5 rounded flex items-center gap-1.5 border border-rose-900">
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                      <span>تحذير: تم الكشف عن موفر موقع وهمي (Mock Location)</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartVisit}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <MapPin className="w-4 h-4" />
                  <span>بدء الزيارة الميدانية</span>
                </button>
              </div>
            )}

            {/* Customers Master List */}
            {!selectedCustomer && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>العملاء المتاحون للزيارة ({customers.length})</span>
                  <span>تحديث محلي تلقائي</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {customers.map(cust => (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setSimulatedLat(cust.latitude); // Snap simulation near customer
                        setSimulatedLng(cust.longitude);
                      }}
                      className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 cursor-pointer transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-sm">{cust.customerName}</span>
                        <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                          {cust.customerCode}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>{cust.address}</span>
                      </div>
                    </div>
                  ))}

                  {customers.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
                      لا يوجد عملاء يطابقون البحث في هذه المنطقة.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Today's Visits History */}
        <div className="pt-2 space-y-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold text-slate-300">سجل زيارات اليوم ({todaysVisits.length})</span>
            <span className="text-cyan-400 font-mono">Pending: {pendingCount}</span>
          </div>

          <div className="space-y-2">
            {todaysVisits.map(visit => {
              const cust = offlineRoomDb.getCustomerById(visit.customerId);
              return (
                <div
                  key={visit.visitId}
                  className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{cust?.customerName || 'عميل'}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      visit.state === 'SYNCED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : visit.state === 'PENDING_SYNC'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {visit.state === 'SYNCED' ? 'تمت المزامنة' : visit.state === 'PENDING_SYNC' ? 'بانتظار المزامنة' : visit.state}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400 font-mono tabular-nums text-[11px]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{new Date(visit.startTimeDevice).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      {visit.visitDurationSeconds && <span>({Math.round(visit.visitDurationSeconds / 60)} دقيقة)</span>}
                    </div>

                    <span className={`${visit.locationStatus === 'WITHIN_RADIUS' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {visit.locationStatus === 'WITHIN_RADIUS' ? 'داخل النطاق' : `${visit.distanceMeters || 0}m خارج النطاق`}
                    </span>
                  </div>

                  {visit.notes && (
                    <p className="text-slate-400 bg-slate-950/60 p-1.5 rounded text-[11px] italic">
                      "{visit.notes}"
                    </p>
                  )}
                </div>
              );
            })}

            {todaysVisits.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-500">
                لم يتم تسجيل أي زيارات اليوم حتى الآن.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* First-Time GPS Permission Onboarding Modal */}
      {showGpsPermissionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 dir-rtl">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl text-center">
            <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center text-cyan-400 mx-auto animate-bounce-subtle">
              <Navigation className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-100">إذن خدمة الموقع الجغرافي (GPS)</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                يتطلب النظام تفعيل إذن استخدام الـ (GPS) طوال فترة استخدام التطبيق للتحقق من تواجدك في موقع العملاء والأطباء واعتماد الزيارات الميدانية رسمياً.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleRequestGpsPermission}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-2xl text-xs transition-colors shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                <span>السماح الدائم بالوصول للموقع</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
