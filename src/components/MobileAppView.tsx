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
  AlertOctagon,
  Package,
  Check,
  X
} from 'lucide-react';
import { Customer, Visit, LocationStatus, AppConfiguration, VisitVerificationResult } from '../types';
import { offlineRoomDb } from '../lib/offlineDb';
import { calculateHaversineDistanceMeters } from '../lib/haversine';
import { requestAndGetNativeLocation } from '../lib/nativeGps';

const DEFAULT_COMPANY_PRODUCTS = [
  'أوجمنتين 1 جم أقراص',
  'بانادول إكسترا 500 مجم',
  'بروفين 400 مجم أقراص',
  'سيفيكسيم 400 مجم كبسول',
  'كلافوكس 625 مجم',
  'أوميبرازول 20 مجم كبسول',
  'أزيثروميسين 500 مجم',
  'فيتامين سي 1000 فوار',
  'أموكسيسيلين 500 مجم',
  'سيبتازول أقراص'
];

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
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(true); // Active by default for smooth field/preview work
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
  const [visitedProducts, setVisitedProducts] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('fvt_cached_products');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return DEFAULT_COMPANY_PRODUCTS;
  });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { token } = offlineRoomDb.getSession();
        const res = await fetch('/api/products', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: any = await res.json();
          const products = Array.isArray(data) ? data : (data.products && Array.isArray(data.products) ? data.products : []);
          
          let filtered: string[] = products.map((p: any) => p.name);
          
          if (currentUser.assignedProductIds && currentUser.assignedProductIds.length > 0) {
            filtered = products
              .filter((p: any) => currentUser.assignedProductIds.includes(p.id))
              .map((p: any) => p.name);
          }
          
          setAvailableProducts(filtered);
          localStorage.setItem('fvt_cached_products', JSON.stringify(filtered));
        }
      } catch (e) {
        console.error('Failed to fetch products', e);
      }
    };
    fetchProducts();
  }, [currentUser.assignedProductIds]);
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfiguration | null>(null);

  // Verification Report Modal State
  const [lastVerificationReport, setLastVerificationReport] = useState<VisitVerificationResult[] | null>(null);
  const [showVerificationReportModal, setShowVerificationReportModal] = useState<boolean>(false);

  // Visit Problem Modal State (to explain reasons if visit cannot be started or completed)
  const [visitProblem, setVisitProblem] = useState<{
    title: string;
    reason: string;
    solution: string;
    type: 'GPS_DISABLED' | 'LOCATION_SERVICES_DISABLED' | 'PERMISSION_DENIED' | 'TIMEOUT' | 'DISTANCE_EXCEEDED' | 'NO_CUSTOMER' | 'ERROR';
    details?: {
      distanceMeters?: number | null;
      maxRadius?: number;
      currentCoords?: { lat: number; lng: number } | null;
      customerCoords?: { lat: number; lng: number };
      customerName?: string;
    };
    allowOfflineOverride?: boolean;
    pendingOfflineParams?: {
      lat: number;
      lng: number;
      accuracy: number;
      provider: string;
      isMock: boolean;
    };
  } | null>(null);
  const [isProcessingVisit, setIsProcessingVisit] = useState<boolean>(false);

  // First-time GPS permission onboarding state
  const [showGpsPermissionModal, setShowGpsPermissionModal] = useState<boolean>(() => {
    return !localStorage.getItem('gps_permission_requested_2026');
  });

  const handleRequestGpsPermission = async () => {
    const res = await requestAndGetNativeLocation();
    localStorage.setItem('gps_permission_requested_2026', 'true');
    setShowGpsPermissionModal(false);
    if (res.permissionGranted && res.servicesEnabled && res.latitude !== 0) {
      setGpsEnabled(true);
      setSimulatedLat(res.latitude);
      setSimulatedLng(res.longitude);
      setSimulatedAccuracy(res.accuracy || 5);
      setSyncStatusMessage('تم تفعيل إذن الـ GPS والتقاط إشارة الموقع بنجاح!');
      setTimeout(() => setSyncStatusMessage(null), 3000);
    } else {
      setVisitProblem({
        title: 'تعذر الوصول لخدمة الـ GPS',
        reason: res.errorMessage || 'خدمات الموقع معطلة أو تم رفض الإذن من المتصفح/الجهاز.',
        solution: 'يرجى تفعيل الـ GPS من شريط إعدادات الجهاز ومنح التطبيق إذن الوصول للموقع الجغرافي.',
        type: 'GPS_DISABLED',
      });
    }
  };

  // Real GPS Hardware Status Probe on Mount & Refresh
  const checkRealGpsHardware = async () => {
    try {
      const probe = await requestAndGetNativeLocation();
      if (probe.permissionGranted && probe.servicesEnabled && probe.latitude !== 0) {
        setGpsEnabled(true);
        setSimulatedLat(probe.latitude);
        setSimulatedLng(probe.longitude);
        setSimulatedAccuracy(probe.accuracy || 5);
      } else {
        setGpsEnabled(false);
      }
    } catch (e) {
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

  // Helper to execute start visit after checks or user override
  const executeStartVisit = (lat: number, lng: number, accuracy: number, provider: string, isMock: boolean) => {
    if (!selectedCustomer) return;
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
      visitedProducts: visitedProducts,
    });

    setActiveVisit(newVisit);
    setNotes('');
    loadLocalData();
    setVisitProblem(null);
  };

  // Visit Actions - Zero-Trust Strict GPS & Geofencing Guard
  const executeEndVisitWithParams = (lat: number, lng: number, accuracy: number, provider: string, isMock: boolean) => {
    if (!activeVisit) return;
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
      visitedProducts: visitedProducts,
    });
    setActiveVisit(null);
    setSelectedCustomer(null);
    setNotes('');
    setVisitedProducts([]);
    setVisitProblem(null);
    loadLocalData();
    if (isOnline) {
      triggerSync();
    }
  };

  const handleStartVisit = async () => {
    if (!selectedCustomer) {
      setVisitProblem({
        title: 'يرجى اختيار عميل أولاً',
        reason: 'لم يتم اختيار الطبيب أو المركز الطبي من القائمة لبدء الزيارة.',
        solution: 'يرجى النقر على بطاقة الطبيب المراد زيارته من القائمة بالأسفل ثم النقر على زر بدء الزيارة.',
        type: 'NO_CUSTOMER',
      });
      return;
    }

    setIsProcessingVisit(true);
    setVisitProblem(null);

    try {
      // Direct hardware GPS inquiry (Native Android + Web/iPad Geolocation)
      const probe = await requestAndGetNativeLocation();
      if (!probe.permissionGranted || !probe.servicesEnabled || probe.latitude === 0) {
        setGpsEnabled(false);
        let title = 'تعذر الوصول لخدمة الـ GPS';
        let reason = probe.errorMessage || 'خدمة الـ GPS معطلة أو لم يتم منح الصلاحية للتطبيق.';
        let solution = 'يرجى التأكد من تشغيل الـ GPS من شريط الإعدادات بالجهاز ومنح الصلاحية للمتصفح/التطبيق.';
        let type: 'GPS_DISABLED' | 'PERMISSION_DENIED' | 'TIMEOUT' | 'LOCATION_SERVICES_DISABLED' | 'DISTANCE_EXCEEDED' | 'NO_CUSTOMER' | 'ERROR' = 'GPS_DISABLED';

        if (probe.errorType === 'PERMISSION_DENIED') {
          title = 'صلاحية الموقع مرفوضة';
          reason = 'تم حظر أو رفض إذن الوصول للموقع الجغرافي من إعدادات المتصفح أو الجهاز.';
          solution = 'انقر على أيقونة القفل أو الموقع بجانب شريط العنوان واختر (سماح)، أو فعل الإذن من إعدادات التطبيق.';
          type = 'PERMISSION_DENIED';
        } else if (probe.errorType === 'LOCATION_SERVICES_DISABLED') {
          title = 'خدمات الموقع (GPS) مغلقة بالجهاز';
          reason = 'مستشعر الـ GPS وخدمات الموقع مغلقة حالياً في إعدادات جهازك.';
          solution = 'اسحب شريط الإشعارات العلوي من أعلى الشاشة واضغط على أيقونة (الموقع / GPS) لتشغيلها ثم أعد المحاولة.';
          type = 'LOCATION_SERVICES_DISABLED';
        } else if (probe.errorType === 'TIMEOUT') {
          title = 'انتهت مهلة استجابة الـ GPS';
          reason = 'استغرق مستشعر الـ GPS وقتاً طويلاً دون استقبال إشارة موقع دقيقة.';
          solution = 'تأكد من تواجدك في مكان مفتوح وتشغيل الموقع ثم انقر على (إعادة فحص الـ GPS والمحاولة).';
          type = 'TIMEOUT';
        }

        const fallbackLat = probe.latitude !== 0 ? probe.latitude : selectedCustomer.latitude;
        const fallbackLng = probe.longitude !== 0 ? probe.longitude : selectedCustomer.longitude;

        setVisitProblem({
          title,
          reason,
          solution: solution + ' (يمكنك النقر على زر بدء الزيارة يدوياً أدناه إذا كنت متأكداً من تواجدك في عيادة الطبيب).',
          type,
          allowOfflineOverride: true,
          pendingOfflineParams: {
            lat: fallbackLat,
            lng: fallbackLng,
            accuracy: probe.accuracy || 15,
            provider: probe.latitude !== 0 ? probe.provider : 'manual_clinic_override',
            isMock: false,
          },
          details: {
            customerName: selectedCustomer.customerName,
            customerCoords: { lat: selectedCustomer.latitude, lng: selectedCustomer.longitude },
            maxRadius: selectedCustomer.allowedVisitRadiusMeters || 30,
          },
        });
        return;
      }

      setGpsEnabled(true);
      const lat = probe.latitude;
      const lng = probe.longitude;
      const accuracy = probe.accuracy;
      const provider = probe.provider;
      const isMock = probe.isMockLocation;

      setSimulatedLat(lat);
      setSimulatedLng(lng);
      setSimulatedAccuracy(accuracy);

      // Strict Geofencing Radius Distance Guard (Zero-Tolerance)
      const distanceMeters = calculateHaversineDistanceMeters(
        lat,
        lng,
        selectedCustomer.latitude,
        selectedCustomer.longitude
      );

      const maxRadius = selectedCustomer.allowedVisitRadiusMeters || 30;

      if (distanceMeters > maxRadius) {
        if (true) { // Corrected logic flow
          // Offline visit capture with user confirmation modal (now also allows online override with a flag)
          if (selectedCustomer) {
            setVisitProblem({
              title: 'تنبيه الموقع الجغرافي',
              reason: `المسافة الفعلية بينك وبين العميل (${Math.round(distanceMeters)} متر)، بينما النطاق الجغرافي المسموح به هو (${maxRadius} متر فقط).`,
              solution: 'إذا كنت متأكداً من تواجدك في موقع العميل، يمكنك بدء الزيارة مع العلم أنه سيتم تعليم هذه الزيارة للمراجعة الإدارية لتصحيح إحداثيات العميل.',
              type: 'DISTANCE_EXCEEDED',
              allowOfflineOverride: true,
              pendingOfflineParams: { lat, lng, accuracy, provider, isMock },
              details: {
                distanceMeters: Math.round(distanceMeters),
                maxRadius,
                currentCoords: { lat, lng },
                customerCoords: { lat: selectedCustomer.latitude, lng: selectedCustomer.longitude },
                customerName: selectedCustomer.customerName,
              },
            });
          }
          return;
        } else {
          // Keep existing strict block if not overriding, but the above covers all cases now.
          // Keep existing strict block if not overriding, but the above covers all cases now.
          if (selectedCustomer) {
            const cust = selectedCustomer!;
            setVisitProblem({
              title: 'أنت خارج النطاق الجغرافي المسموح',
              reason: `موقعك الحالي يبعد مسافة (${Math.round(distanceMeters)} متر) عن موقع العميل المعتمد (${cust.customerName})، في حين أن الحد الأقصى المسموح للزيارة هو (${maxRadius} متر فقط).`,
              solution: 'يرجى التواجد بالقرب من موقع العميل لإتمام الزيارة، أو التواصل مع مدير النظام لتصحيح إحداثيات العميل إذا كانت غير دقيقة.',
              type: 'DISTANCE_EXCEEDED',
              details: {
                distanceMeters: Math.round(distanceMeters),
                maxRadius,
                currentCoords: { lat, lng },
                customerCoords: { lat: cust.latitude, lng: cust.longitude },
                customerName: cust.customerName,
              },
            });
          }
          return;
        }
      }

      executeStartVisit(lat, lng, accuracy, provider, isMock);
    } catch (err: any) {
      setVisitProblem({
        title: 'حدث خطأ غير متوقع في فحص الموقع',
        reason: err?.message || 'تعذر التواصل مع مستشعر الموقع الجغرافي.',
        solution: 'يرجى تحديث الصفحة أو فحص حالة الـ GPS في جهازك.',
        type: 'ERROR',
      });
    } finally {
      setIsProcessingVisit(false);
    }
  };

  const handleEndVisit = async () => {
    if (!activeVisit) return;

    setIsProcessingVisit(true);
    setVisitProblem(null);

    try {
      // Direct hardware GPS inquiry
      const probe = await requestAndGetNativeLocation();
      if (!probe.permissionGranted || !probe.servicesEnabled || probe.latitude === 0) {
        setGpsEnabled(false);
        const customerEnd = activeVisit ? offlineRoomDb.getCustomerById(activeVisit.customerId) : null;
        const fallbackLatEnd = probe.latitude !== 0 ? probe.latitude : (customerEnd?.latitude || 0);
        const fallbackLngEnd = probe.longitude !== 0 ? probe.longitude : (customerEnd?.longitude || 0);

        setVisitProblem({
          title: 'تعذر إنهاء الزيارة - الـ GPS معطل',
          reason: probe.errorMessage || 'خدمات الموقع معطلة في الجهاز أو تعذرت الاستجابة.',
          solution: 'يرجى تشغيل الـ GPS أو النقر على زر إنهاء الزيارة يدوياً أدناه.',
          type: 'GPS_DISABLED',
          allowOfflineOverride: true,
          pendingOfflineParams: {
            lat: fallbackLatEnd,
            lng: fallbackLngEnd,
            accuracy: probe.accuracy || 15,
            provider: probe.latitude !== 0 ? probe.provider : 'manual_clinic_override_end',
            isMock: false,
          },
          details: customerEnd ? {
            customerName: customerEnd.customerName,
            customerCoords: { lat: customerEnd.latitude, lng: customerEnd.longitude },
            maxRadius: customerEnd.allowedVisitRadiusMeters || 30,
          } : undefined,
        });
        return;
      }

      setGpsEnabled(true);
      const lat = probe.latitude;
      const lng = probe.longitude;
      const accuracy = probe.accuracy;
      const provider = probe.provider;
      const isMock = probe.isMockLocation;

      setSimulatedLat(lat);
      setSimulatedLng(lng);
      setSimulatedAccuracy(accuracy);

      const customer = offlineRoomDb.getCustomerById(activeVisit.customerId);
      if (customer) {
        const distanceMeters = calculateHaversineDistanceMeters(lat, lng, customer.latitude, customer.longitude);
        const maxRadius = customer.allowedVisitRadiusMeters || 30;
        if (isOnline && distanceMeters > maxRadius) {
          setVisitProblem({
            title: 'أنت خارج النطاق عند إنهاء الزيارة',
            reason: `المسافة الحالية عن العميل (${Math.round(distanceMeters)} متر) تتجاوز الحد الأقصى المسموح (${maxRadius} متر).`,
            solution: 'يرجى التواجد داخل نطاق العميل لإنهاء الزيارة بنجاح.',
            type: 'DISTANCE_EXCEEDED',
            details: {
              distanceMeters: Math.round(distanceMeters),
              maxRadius,
              currentCoords: { lat, lng },
              customerCoords: { lat: customer.latitude, lng: customer.longitude },
              customerName: customer.customerName,
            },
          });
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
        visitedProducts: visitedProducts,
      });

      setActiveVisit(null);
      setSelectedCustomer(null);
      setNotes('');
      setVisitedProducts([]);
      loadLocalData();

      // Trigger auto-sync if online
      if (isOnline) {
        triggerSync();
      }
    } catch (err: any) {
      setVisitProblem({
        title: 'خطأ في إنهاء الزيارة',
        reason: err?.message || 'تعذر التقاط الموقع الجغرافي عند الإنهاء.',
        solution: 'يرجى إعادة المحاولة بعد التحقق من إشارة الـ GPS.',
        type: 'ERROR',
      });
    } finally {
      setIsProcessingVisit(false);
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
          await offlineRoomDb.markVisitsSynced(data.syncedVisitIds, data.verificationResults);
          if (data.verificationResults && data.verificationResults.length > 0) {
            setLastVerificationReport(data.verificationResults);
            setShowVerificationReportModal(true);
          }
          setSyncStatusMessage(`تمت مزامنة ومطابقة ${data.syncedVisitIds.length} زيارة بنجاح!`);
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

              <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-cyan-400" />
                    <span>الأصناف المزارة / المروجة:</span>
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    محدد: {visitedProducts.length}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                  {availableProducts.map(prod => {
                    const isSelected = visitedProducts.includes(prod);
                    return (
                      <button
                        key={prod}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setVisitedProducts(visitedProducts.filter(p => p !== prod));
                          } else {
                            setVisitedProducts([...visitedProducts, prod]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500 shadow-sm shadow-cyan-500/20 font-bold'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                        <span>{prod}</span>
                      </button>
                    );
                  })}
                </div>
                {visitedProducts.length > 0 && (
                  <div className="text-[11px] text-cyan-400 font-mono">
                    تم اختيار: {visitedProducts.join(' ، ')}
                  </div>
                )}
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

                {/* Visited Products Multi-Select (الصنف المزار في بطاقة الطبيب) */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-cyan-400" />
                      <span>الصنف المزار / الترويجي:</span>
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                      محدد: {visitedProducts.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-900/50 rounded-lg border border-slate-800/80">
                    {availableProducts.map(prod => {
                      const isSelected = visitedProducts.includes(prod);
                      return (
                        <button
                          key={prod}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setVisitedProducts(visitedProducts.filter(p => p !== prod));
                            } else {
                              setVisitedProducts([...visitedProducts, prod]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500 shadow-sm shadow-cyan-500/20 font-bold'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                          <span>{prod}</span>
                        </button>
                      );
                    })}
                  </div>
                  {visitedProducts.length > 0 && (
                    <div className="text-[11px] text-cyan-400 font-mono">
                      تم اختيار: {visitedProducts.join(' ، ')}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartVisit}
                  disabled={isProcessingVisit}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  {isProcessingVisit ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin text-cyan-200" />
                      <span>جاري فحص الـ GPS وتوثيق الموقع...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      <span>بدء الزيارة الميدانية</span>
                    </>
                  )}
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowVerificationReportModal(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-bold flex items-center gap-1"
                title="عرض تقرير مطابقة إحداثيات الزيارات"
              >
                <FileText className="w-3 h-3" />
                <span>تقرير المطابقة والقبول</span>
              </button>
              <span className="text-cyan-400 font-mono">Pending: {pendingCount}</span>
            </div>
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
                    <div className="flex items-center gap-1.5">
                      {visit.verificationStatus === 'ACCEPTED' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>مقبولة (مطابقة)</span>
                        </span>
                      ) : visit.verificationStatus === 'REJECTED' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>مرفوضة ({visit.distanceMeters ?? 0}م)</span>
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          visit.state === 'SYNCED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : visit.state === 'PENDING_SYNC'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {visit.state === 'SYNCED' ? 'تمت المزامنة' : visit.state === 'PENDING_SYNC' ? 'بانتظار المزامنة' : visit.state}
                        </span>
                      )}
                    </div>
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

                  {(visit.startLatitude !== undefined && visit.startLatitude !== null) && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/50 px-2 py-1 rounded">
                      <span>إحداثيات وقت الزيارة:</span>
                      <span className="text-cyan-400">{visit.startLatitude?.toFixed(4)}, {visit.startLongitude?.toFixed(4)}</span>
                    </div>
                  )}

                  {visit.verificationReason && (
                    <p className={`p-1.5 rounded text-[11px] font-sans ${
                      visit.verificationStatus === 'ACCEPTED'
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/50'
                        : 'bg-rose-950/40 text-rose-300 border border-rose-900/50'
                    }`}>
                      {visit.verificationReason}
                    </p>
                  )}

                  {visit.notes && (
                    <p className="text-slate-400 bg-slate-950/60 p-1.5 rounded text-[11px] italic">
                      "{visit.notes}"
                    </p>
                  )}

                  {visit.visitedProducts && visit.visitedProducts.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] border-t border-slate-800/60 mt-1">
                      <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                        <Package className="w-3 h-3 text-cyan-400" />
                        <span>الأصناف:</span>
                      </span>
                      {visit.visitedProducts.map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-medium text-[10px]">
                          {p}
                        </span>
                      ))}
                    </div>
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

      {/* Offline GPS Verification Report Modal */}
      {showVerificationReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 dir-rtl">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">تقرير مطابقة إحداثيات الزيارات</h3>
                  <span className="text-[11px] text-slate-400">نتيجة فحص وتدقيق خطوط الطول والعرض للزيارات</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVerificationReportModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats summary */}
            {lastVerificationReport && lastVerificationReport.length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-950/50 border border-emerald-800/60 p-2.5 rounded-xl text-center">
                  <span className="text-[11px] text-emerald-400 block font-medium">الزيارات المقبولة</span>
                  <span className="text-xl font-black font-mono text-emerald-300">
                    {lastVerificationReport.filter(r => r.verificationStatus === 'ACCEPTED').length}
                  </span>
                </div>
                <div className="bg-rose-950/50 border border-rose-800/60 p-2.5 rounded-xl text-center">
                  <span className="text-[11px] text-rose-400 block font-medium">الزيارات المرفوضة</span>
                  <span className="text-xl font-black font-mono text-rose-300">
                    {lastVerificationReport.filter(r => r.verificationStatus === 'REJECTED').length}
                  </span>
                </div>
              </div>
            )}

            {/* List of results */}
            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {lastVerificationReport && lastVerificationReport.length > 0 ? (
                lastVerificationReport.map(report => (
                  <div
                    key={report.visitId}
                    className={`p-3 rounded-xl border text-xs space-y-2 ${
                      report.verificationStatus === 'ACCEPTED'
                        ? 'bg-emerald-950/30 border-emerald-800/50'
                        : 'bg-rose-950/30 border-rose-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{report.customerName}</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-black flex items-center gap-1 ${
                        report.verificationStatus === 'ACCEPTED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {report.verificationStatus === 'ACCEPTED' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>مقبولة ✅</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span>مرفوضة ❌</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="space-y-1 bg-slate-950/60 p-2 rounded-lg font-mono text-[11px] text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">المسجل وقت الزيارة:</span>
                        <span className="text-cyan-400 font-bold">{report.capturedCoords.latitude.toFixed(5)}, {report.capturedCoords.longitude.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">إحداثيات العميل المسجلة:</span>
                        <span className="text-amber-400 font-bold">{report.savedCoords.latitude.toFixed(5)}, {report.savedCoords.longitude.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-800 text-[10px]">
                        <span className="text-slate-400">المسافة الفعلية:</span>
                        <span className={report.distanceMeters && report.distanceMeters <= report.allowedRadius ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {report.distanceMeters ?? 'غير محدد'} م (المسموح {report.allowedRadius} م)
                        </span>
                      </div>
                    </div>

                    <p className={`text-[11px] leading-relaxed font-sans ${
                      report.verificationStatus === 'ACCEPTED' ? 'text-emerald-300' : 'text-rose-300'
                    }`}>
                      {report.verificationReason}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  لا توجد تقارير مطابقة حالياً. قم بمزامنة الزيارات لعرض تقرير القبول والرفض.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowVerificationReportModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
            >
              إغلاق التقرير
            </button>
          </div>
        </div>
      )}

      {/* Visit Problem / Obstacle Explanation Modal */}
      {visitProblem && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 dir-rtl animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm leading-tight">{visitProblem.title}</h3>
                  <span className="text-[11px] text-slate-400">تنبيه توثيق الزيارة الميدانية</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisitProblem(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Cause */}
            <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-rose-300 block">سبب عدم إتمام الزيارة:</span>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                {visitProblem.reason}
              </p>
            </div>

            {/* Technical Geofence / GPS Details if applicable */}
            {visitProblem.details && (
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1.5 text-xs font-mono tabular-nums">
                {visitProblem.details.customerName && (
                  <div className="flex justify-between text-slate-300 font-sans pb-1 border-b border-slate-800">
                    <span className="text-slate-500">العميل / الطبيب:</span>
                    <span className="font-bold text-cyan-400">{visitProblem.details.customerName}</span>
                  </div>
                )}
                {visitProblem.details.distanceMeters !== undefined && visitProblem.details.distanceMeters !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">المسافة الحالية عن العميل:</span>
                    <span className="text-rose-400 font-bold">{visitProblem.details.distanceMeters} متر</span>
                  </div>
                )}
                {visitProblem.details.maxRadius && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">النطاق الجغرافي المسموح:</span>
                    <span className="text-emerald-400 font-bold">{visitProblem.details.maxRadius} متر</span>
                  </div>
                )}
                {visitProblem.details.currentCoords && (
                  <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400">موقعك الملتقط:</span>
                    <span className="text-cyan-400">{visitProblem.details.currentCoords.lat.toFixed(4)}, {visitProblem.details.currentCoords.lng.toFixed(4)}</span>
                  </div>
                )}
                {visitProblem.details.customerCoords && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">موقع العميل المعتمد:</span>
                    <span className="text-amber-400">{visitProblem.details.customerCoords.lat.toFixed(4)}, {visitProblem.details.customerCoords.lng.toFixed(4)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Recommended Solution */}
            <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-cyan-400 block">الإجراء والحل المطلوب:</span>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {visitProblem.solution}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {visitProblem.allowOfflineOverride && visitProblem.pendingOfflineParams && (
                <button
                  type="button"
                  onClick={() => {
                    const p = visitProblem.pendingOfflineParams!;
                    if (!activeVisit) {
                      executeStartVisit(p.lat, p.lng, p.accuracy, p.provider, p.isMock);
                    } else {
                      executeEndVisitWithParams(p.lat, p.lng, p.accuracy, p.provider, p.isMock);
                    }
                  }}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-amber-950/40 flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-4 h-4" />
                  <span>{activeVisit ? 'إنهاء الزيارة يدوياً (أنا في عيادة الطبيب)' : 'أنا في عيادة الطبيب - بدء الزيارة يدوياً'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setVisitProblem(null);
                  setShowGpsPermissionModal(true);
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-rose-950/40 flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>منح إذن الموقع مجدداً</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setVisitProblem(null);
                  handleStartVisit();
                }}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>إعادة فحص الـ GPS والمحاولة الآن</span>
              </button>

              <button
                type="button"
                onClick={() => setVisitProblem(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

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
