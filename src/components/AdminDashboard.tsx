/**
 * Web Admin & Manager Portal
 * FIELD VISIT TRACKER — Interactive Map, Delta Sync, Server Config, Audit Logs & Reports
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Settings,
  FileSpreadsheet,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  LogOut,
  Plus,
  Edit2,
  Download,
  Upload,
  Trash2,
  X,
  Check,
  Filter,
  RefreshCw,
  Search,
  Sliders,
  Calendar,
  Layers,
  FileText,
  Key,
  ShieldAlert,
  BarChart as BarChartIcon,
  CalendarCheck,
  Clock,
  Compass,
  Eye,
  Navigation
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Customer, Visit, User, AppConfiguration, AuditLog, DailyReportSummary, Client } from '../types';
import { offlineRoomDb } from '../lib/offlineDb';
import { MasterDataManager } from './MasterDataManager';
import { PermissionsManager } from './PermissionsManager';
import { parseUploadedFile, downloadTemplateExcel, downloadTemplateCsv, exportDataToExcel } from '../lib/fileImporter';

interface AdminDashboardProps {
  currentUser: User;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'map' | 'master_data' | 'customers' | 'config' | 'reps' | 'reports' | 'audit' | 'permissions' | 'statistics' | 'visit_audit' | 'all_visits'>('all_visits');
  
  // Data State
  const [visits, setVisits] = useState<Visit[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reps, setReps] = useState<User[]>([]);
  const [config, setConfig] = useState<AppConfiguration | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // All Visits Filter State
  const [visitSearchQuery, setVisitSearchQuery] = useState<string>('');
  const [visitRepFilter, setVisitRepFilter] = useState<string>('الكل');
  const [visitGpsFilter, setVisitGpsFilter] = useState<string>('الكل');
  const [visitTypeFilter, setVisitTypeFilter] = useState<string>('الكل');
  const [visitOutcomeFilter, setVisitOutcomeFilter] = useState<string>('الكل');
  const [visitDateRange, setVisitDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [visitStartDate, setVisitStartDate] = useState<string>('');
  const [visitEndDate, setVisitEndDate] = useState<string>('');
  const [selectedVisitDetail, setSelectedVisitDetail] = useState<Visit | null>(null);
  const [reportSummary, setReportSummary] = useState<DailyReportSummary | null>(null);

  // Manual Column Widths State for Reports Table
  const [reportColumnWidths, setReportColumnWidths] = useState<Record<string, number>>({
    id: 120,
    rep: 150,
    client: 200,
    class: 90,
    region: 130,
    time: 160,
    status: 140,
    distance: 100,
  });

  // Filters & Selection State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [selectedVisitForModal, setSelectedVisitForModal] = useState<Visit | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Customer Master State
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer>>({
    customerCode: `0${Math.floor(10000 + Math.random() * 90000)}`,
    customerName: '',
    ownerName: '',
    phone: '',
    address: '',
    region: 'المنطقة الوسطى',
    latitude: 15.3533,
    longitude: 44.2045,
    allowedVisitRadiusMeters: 100,
    assignedRepId: '',
  });

  const [showCustomerImportModal, setShowCustomerImportModal] = useState<boolean>(false);
  const [customerImportData, setCustomerImportData] = useState<any[]>([]);
  const [customerImportErrors, setCustomerImportErrors] = useState<string[]>([]);
  const [isProcessingCustomerImport, setIsProcessingCustomerImport] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [customerRegionFilter, setCustomerRegionFilter] = useState<string>('الكل');
  const [customerRepFilter, setCustomerRepFilter] = useState<string>('الكل');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const customerFileInputRef = React.useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Derived Data for Charts
  const getRepStatistics = () => {
    const stats = reps.filter(r => r.role === 'SALES_REP').map(rep => {
      const repVisits = visits.filter(v => v.userId === rep.id);
      const uniqueVisitedCustomers = new Set(repVisits.map(v => v.customerId));
      const assignedCustomers = customers.filter(c => c.assignedRepId === rep.id);
      
      const completedVisits = repVisits.length;
      const plannedVisits = assignedCustomers.length;
      const completionRate = plannedVisits > 0 ? (uniqueVisitedCustomers.size / plannedVisits) * 100 : 0;
      
      return {
        name: rep.fullName,
        visits: completedVisits,
        completionRate: Math.round(completionRate)
      };
    });
    return stats;
  };

  const repStats = getRepStatistics();

  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<Partial<User> & { password?: string }>({
    username: '',
    fullName: '',
    role: 'SALES_REP',
    phone: '',
    assignedRegion: 'المنطقة الوسطى',
    password: '123',
  });

  useEffect(() => {
    fetchAllData();
  }, [selectedDate, activeTab]);

  const fetchAllData = async () => {
    const { token } = offlineRoomDb.getSession();
    if (!token) return;

    try {
      // 1. Fetch Visits & Reports
      const visitsRes = await fetch(`/api/reports/daily?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (visitsRes.ok) {
        const data = await visitsRes.json();
        setVisits(data.visits || []);
        setReportSummary(data.summary || null);
      }

      // 2. Fetch Customers
      const custRes = await fetch('/api/customers?sinceVersion=0', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(data.customers || []);
      }

      // 3. Fetch Users
      const usersRes = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (usersRes.ok) {
        const data = await usersRes.json();
        setReps(data.users || []);
      }

      // 4. Fetch Config
      const configRes = await fetch('/api/configuration');
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }

      // 5. Fetch Audit Logs
      const auditRes = await fetch('/api/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.auditLogs || []);
      }

      // 6. Fetch All-Time Visits (since the beginning of using the application)
      const allVisitsRes = await fetch('/api/visits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (allVisitsRes.ok) {
        const data = await allVisitsRes.json();
        setAllVisits(data.visits || []);
      }

      // 7. Fetch Clients for medical specialty and doctorClass metadata
      const clientsRes = await fetch('/api/clients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('[AdminDashboard] Error fetching data:', err);
    }
  };

  // Filtered All-Time Visits for the Visits Registry Page
  const filteredAllVisits = React.useMemo(() => {
    return allVisits.filter((v) => {
      const cust = customers.find(c => c.id === v.customerId || c.customerCode === v.customerId);
      const cli = clients.find(c => c.id === v.customerId || c.clientCode === v.customerId);
      const rep = reps.find(r => r.id === v.userId);

      const customerName = cust?.customerName || cli?.name || '';
      const customerCode = cust?.customerCode || cli?.clientCode || '';
      const repName = rep?.fullName || rep?.username || '';
      const specialty = cli?.specialty || '';
      const notes = v.notes || '';
      const outcome = v.visitOutcome || '';
      const type = v.visitType || '';

      // 1. Text Search
      if (visitSearchQuery.trim()) {
        const q = visitSearchQuery.toLowerCase();
        const matchesSearch =
          customerName.toLowerCase().includes(q) ||
          customerCode.toLowerCase().includes(q) ||
          repName.toLowerCase().includes(q) ||
          specialty.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q) ||
          outcome.toLowerCase().includes(q) ||
          type.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // 2. Rep Filter
      if (visitRepFilter !== 'الكل') {
        if (v.userId !== visitRepFilter) return false;
      }

      // 3. GPS Status Filter
      if (visitGpsFilter !== 'الكل') {
        if (visitGpsFilter === 'WITHIN_RADIUS' && v.locationStatus !== 'WITHIN_RADIUS') return false;
        if (visitGpsFilter === 'OUTSIDE_RADIUS' && v.locationStatus === 'WITHIN_RADIUS') return false;
        if (visitGpsFilter === 'MOCK' && !v.isStartMock && !v.isEndMock) return false;
      }

      // 4. Visit Type Filter
      if (visitTypeFilter !== 'الكل') {
        if (v.visitType !== visitTypeFilter) return false;
      }

      // 5. Outcome Filter
      if (visitOutcomeFilter !== 'الكل') {
        if (v.visitOutcome !== visitOutcomeFilter) return false;
      }

      // 6. Date Range Filter
      const visitDateStr = (v.startTimeDevice || v.createdAt).substring(0, 10);
      const todayStr = new Date().toISOString().substring(0, 10);

      if (visitDateRange === 'TODAY') {
        if (visitDateStr !== todayStr) return false;
      } else if (visitDateRange === 'WEEK') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().substring(0, 10);
        if (visitDateStr < weekAgoStr) return false;
      } else if (visitDateRange === 'MONTH') {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        const monthAgoStr = monthAgo.toISOString().substring(0, 10);
        if (visitDateStr < monthAgoStr) return false;
      } else if (visitDateRange === 'CUSTOM') {
        if (visitStartDate && visitDateStr < visitStartDate) return false;
        if (visitEndDate && visitDateStr > visitEndDate) return false;
      }

      return true;
    });
  }, [allVisits, customers, clients, reps, visitSearchQuery, visitRepFilter, visitGpsFilter, visitTypeFilter, visitOutcomeFilter, visitDateRange, visitStartDate, visitEndDate]);

  // Export All / Filtered Visits to Excel
  const handleExportAllVisitsExcel = () => {
    if (filteredAllVisits.length === 0) {
      alert('لا توجد سجلات زيارات لتصديرها');
      return;
    }

    const dataToExport = filteredAllVisits.map((v) => {
      const cust = customers.find(c => c.id === v.customerId || c.customerCode === v.customerId);
      const cli = clients.find(c => c.id === v.customerId || c.clientCode === v.customerId);
      const rep = reps.find(r => r.id === v.userId);

      const startDate = v.startTimeDevice ? new Date(v.startTimeDevice).toLocaleDateString('ar-YE') : '';
      const startTime = v.startTimeDevice ? new Date(v.startTimeDevice).toLocaleTimeString('ar-YE') : '';
      const durationMin = v.visitDurationSeconds ? Math.round(v.visitDurationSeconds / 60) : 0;

      return {
        'معرف الزيارة': v.visitId,
        'تاريخ الزيارة': startDate,
        'وقت البدء': startTime,
        'المدة بالدقائق': durationMin,
        'اسم المندوب': rep?.fullName || rep?.username || v.userId,
        'منطقة المندوب': rep?.assignedRegion || '',
        'اسم العميل / الطبيب': cust?.customerName || cli?.name || v.customerId,
        'كود العميل': cust?.customerCode || cli?.clientCode || '',
        'الكلاس': cli?.doctorClass || 'B',
        'التخصص': cli?.specialty || '',
        'نوع المنشأة': cli?.clientType || '',
        'نوع الزيارة': v.visitType || 'روتينية',
        'نتيجة الزيارة': v.visitOutcome || '',
        'المطابقة الجغرافية': v.locationStatus === 'WITHIN_RADIUS' ? 'مطابق للنطاق' : 'خارج النطاق',
        'المسافة بالأمتار': v.distanceMeters ?? '',
        'تزييف الموقع Mock GPS': v.isStartMock || v.isEndMock ? 'نعم (تحذير)' : 'لا',
        'إحداثيات البدء': `${v.startLatitude || ''}, ${v.startLongitude || ''}`,
        'ملاحظات الزيارة': v.notes || '',
      };
    });

    exportDataToExcel('سجل_الزيارات_الشامل_Zenith', dataToExport);
  };

  // Customer Upsert Submit
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const { token } = offlineRoomDb.getSession();

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingCustomer),
      });

      if (res.ok) {
        setShowCustomerModal(false);
        showToast('تم حفظ بيانات العميل وتحديث الإصدار المركزي بنجاح', 'success');
        fetchAllData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'فشل حفظ العميل. يرجى التأكد من البيانات.', 'error');
      }
    } catch (err) {
      console.error('Customer save error:', err);
      showToast('حدث خطأ أثناء حفظ العميل', 'error');
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${name}" من السجل المركزي؟`)) return;
    const { token } = offlineRoomDb.getSession();
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('تم حذف العميل بنجاح من السجل المركزي', 'success');
        fetchAllData();
      } else {
        showToast('تعذر حذف العميل', 'error');
      }
    } catch (err) {
      showToast('حدث خطأ أثناء حذف العميل', 'error');
    }
  };

  // Upload File for Customer Master Import
  const handleCustomerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingCustomerImport(true);
    setCustomerImportErrors([]);
    setCustomerImportData([]);

    const result = await parseUploadedFile(file, 'CLIENT');
    setIsProcessingCustomerImport(false);

    if (result.records.length > 0) {
      setCustomerImportData(result.records);
      setCustomerImportErrors(result.errors);
      if (result.errors.length > 0) {
        showToast(`تمت قراءة الملف مع وجود ${result.errors.length} تنبيه`, 'info');
      } else {
        showToast(`تمت قراءة ${result.records.length} سجل بنجاح. راجع الجدول واضغط اعتماد وحفظ`, 'success');
      }
    } else {
      setCustomerImportErrors(result.errors);
      showToast('تعذر استخراج بيانات صالحة من الملف', 'error');
    }

    if (customerFileInputRef.current) customerFileInputRef.current.value = '';
  };

  // Commit Bulk Customer Import
  const handleCommitCustomerImport = async () => {
    if (customerImportData.length === 0) return;

    setIsProcessingCustomerImport(true);
    const { token } = offlineRoomDb.getSession();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    try {
      const res = await fetch('/api/customers/bulk', {
        method: 'POST',
        headers,
        body: JSON.stringify({ customers: customerImportData }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'تم استيراد العملاء وحفظهم في السجل المركزي بنجاح!', 'success');
        setShowCustomerImportModal(false);
        setCustomerImportData([]);
        setCustomerImportErrors([]);
        await fetchAllData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'فشل استيراد العملاء', 'error');
      }
    } catch (err) {
      showToast('حدث خطأ أثناء استيراد البيانات', 'error');
    } finally {
      setIsProcessingCustomerImport(false);
    }
  };

  // Export Customer Master to Excel
  const handleExportCustomers = () => {
    if (customers.length === 0) {
      showToast('لا توجد سجلات عملاء للتصدير', 'info');
      return;
    }
    const exportRows = customers.map(c => {
      const rep = reps.find(r => r.id === c.assignedRepId);
      return {
        'كود العميل': c.customerCode,
        'اسم العميل': c.customerName,
        'المسؤول / التخصص': c.ownerName || '',
        'رقم الهاتف': c.phone || '',
        'العنوان': c.address || '',
        'المنطقة': c.region || '',
        'المندوب المعين': rep?.fullName || rep?.username || c.assignedRepId || 'غير معين',
        'خط العرض': c.latitude,
        'خط الطول': c.longitude,
        'النطاق المسموح (متر)': c.allowedVisitRadiusMeters,
        'الإصدار': c.version,
        'الحالة': c.isActive ? 'نشط' : 'معطل'
      };
    });
    exportDataToExcel('سجل_العملاء_المركزي', exportRows);
    showToast('تم تصدير سجل العملاء المركزي بنجاح', 'success');
  };

  // User Save Submit
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const { token } = offlineRoomDb.getSession();

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingUser),
      });

      if (res.ok) {
        setShowUserModal(false);
        fetchAllData();
      } else {
        alert('فشل حفظ بيانات المستخدم.');
      }
    } catch (err) {
      console.error('User save error:', err);
    }
  };

  // Server Config Update
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    const { token } = offlineRoomDb.getSession();

    try {
      const res = await fetch('/api/configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        alert('تم تحديث الإعدادات بنجاح. سيقوم التطبيق الميداني بتحميل الإعدادات الجديدة تلقائياً دون الحاجة لبناء APK جديد!');
        fetchAllData();
      }
    } catch (err) {
      console.error('Config save error:', err);
    }
  };

  // CSV Export Engine based on real database records
  const exportToCSV = () => {
    if (visits.length === 0) {
      alert('لا توجد زيارات للتصدير في هذا التاريخ.');
      return;
    }

    const headers = [
      'Visit ID',
      'Customer Code',
      'Customer Name',
      'Sales Rep ID',
      'Start Time (Device)',
      'End Time (Device)',
      'Duration (s)',
      'Distance (m)',
      'Location Status',
      'Mock Location Flag',
      'Outcome',
      'Notes'
    ];

    const rows = visits.map(v => {
      const cust = customers.find(c => c.id === v.customerId);
      return [
        v.visitId,
        `"${cust?.customerCode || '000000'}"`, // Preserve leading zero string!
        `"${cust?.customerName || ''}"`,
        v.userId,
        v.startTimeDevice,
        v.endTimeDevice || '',
        v.visitDurationSeconds || 0,
        v.distanceMeters || 0,
        v.locationStatus,
        v.isStartMock || v.isEndMock ? 'YES' : 'NO',
        `"${v.visitOutcome || ''}"`,
        `"${(v.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `field_visits_report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar - Header Contract */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">FIELD VISIT TRACKER</h1>
            <p className="text-xs text-slate-400">لوحة الإدارة والمتابعة الميدانية المركزية</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-medium overflow-x-auto whitespace-nowrap shadow-xl">
          <button
            onClick={() => setActiveTab('master_data')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'master_data' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-300" />
            <span>إدارة البيانات والتعيينات (صنعاء وضواحيها)</span>
          </button>

          <button
            onClick={() => setActiveTab('all_visits')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'all_visits'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg ring-1 ring-emerald-400'
                : 'text-emerald-400 hover:text-emerald-200 hover:bg-slate-800'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-emerald-300" />
            <span>سجل الزيارات الشامل ({allVisits.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'map' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>الخريطة والمؤشرات</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'customers' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>سجل العملاء (Master)</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'config' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>إعدادات النظام (Config)</span>
          </button>

          <button
            onClick={() => setActiveTab('reps')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'reps' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>المستخدمون (مناديب ومشرفين)</span>
          </button>

          {currentUser.role === 'SYSTEM_ADMIN' && (
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'permissions' ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white font-bold shadow-lg' : 'text-amber-400/90 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>صفحة الصلاحيات (Permissions)</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('visit_audit')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'visit_audit' ? 'bg-emerald-600 text-white font-bold shadow' : 'text-emerald-400/90 hover:text-emerald-300 hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>المصادقة وتدقيق الزيارات</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'reports' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>التقارير والتصدير</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'audit' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>سجل التدقيق (Audit)</span>
          </button>

          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'statistics' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChartIcon className="w-4 h-4" />
            <span>الإحصائيات</span>
          </button>
        </nav>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-3">
          <div className="text-left text-xs">
            <div className="font-bold text-slate-200">{currentUser.fullName}</div>
            <div className="text-cyan-400 font-mono">{currentUser.role}</div>
          </div>
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-slate-800"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-slate-400">إجمالي زيارات اليوم</span>
            <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
              {reportSummary?.totalVisits || 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-emerald-400">داخل النطاق (Valid)</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {reportSummary?.withinRadius || 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-amber-400">خارج النطاق</span>
            <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {reportSummary?.outsideRadius || 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-rose-400">إنذارات Mock GPS</span>
            <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
              {reportSummary?.mockLocationWarnings || 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-cyan-400">المندوبون النشطون</span>
            <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
              {reportSummary?.activeRepsCount || 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-slate-400">تاريخ التقرير</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* TAB: MASTER DATA & ASSIGNMENTS (صنعاء وضواحيها) */}
        {activeTab === 'master_data' && (
          <MasterDataManager currentUser={currentUser} onRefreshParent={fetchAllData} />
        )}

        {/* TAB: ALL-TIME FIELD VISITS REGISTRY (سجل الزيارات الشامل للمناديب منذ بداية التطبيق) */}
        {activeTab === 'all_visits' && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-100 font-sans">
                      سجل الزيارات الشامل للمناديب (All-Time Field Visits Registry)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    أرشيف رقمي كامل ومفصل لجميع الزيارات الميدانية المنفذة من قِبل المناديب العلميين والمبيعات منذ انطلاق التطبيق مع التدقيق الجغرافي والنتائج والملاحظات.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={handleExportAllVisitsExcel}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-950/40"
                    title="تصدير جميع الزيارات الحالية إلى ملف Excel"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير الزيارات Excel</span>
                  </button>

                  <button
                    onClick={fetchAllData}
                    className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-400 rounded-xl transition-all shadow-sm"
                    title="تحديث البيانات لحظياً"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold">إجمالي الزيارات التاريخية:</span>
                  <CalendarCheck className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black font-mono text-cyan-400">
                  {allVisits.length} <span className="text-xs font-normal text-slate-400">زيارة</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  منذ بدء تفعيل النظام وحتى اللحظة
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold">المطابقة الجغرافية الدقيقة:</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {allVisits.filter(v => v.locationStatus === 'WITHIN_RADIUS').length}
                  <span className="text-xs font-bold text-emerald-400/80 mr-1.5 font-sans">
                    ({allVisits.length > 0 ? Math.round((allVisits.filter(v => v.locationStatus === 'WITHIN_RADIUS').length / allVisits.length) * 100) : 100}%)
                  </span>
                </div>
                <div className="text-[11px] text-emerald-500/80">
                  ضمن النطاق المسموح للعيادات
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold">زيارات طلبيات وتعاقدات:</span>
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black font-mono text-amber-400">
                  {allVisits.filter(v => v.visitOutcome === 'تم كتابة طلبية').length}
                  <span className="text-xs font-normal text-slate-400 mr-1.5">طلبية بيع</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {allVisits.filter(v => v.visitOutcome === 'مهتم بالصنف').length} زيارة مهتم / متابعة
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold">المناديب والمراكز المغطاة:</span>
                  <Users className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-black font-mono text-indigo-400">
                  {new Set(allVisits.map(v => v.userId)).size} <span className="text-xs font-normal text-slate-400">مندوبين</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  تغطية {new Set(allVisits.map(v => v.customerId)).size} طبيب ومنشأة طبية
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-cyan-400" />
                  <input
                    type="text"
                    placeholder="بحث في السجلات باسم الطبيب، كود المنشأة، اسم المندوب، النتيجة، أو الملاحظات..."
                    value={visitSearchQuery}
                    onChange={(e) => setVisitSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pr-10 pl-9 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all shadow-inner font-sans"
                  />
                  {visitSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setVisitSearchQuery('')}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>
                      عرض {filteredAllVisits.length} من {allVisits.length} زيارة
                    </span>
                  </div>

                  {(visitSearchQuery || visitRepFilter !== 'الكل' || visitGpsFilter !== 'الكل' || visitTypeFilter !== 'الكل' || visitOutcomeFilter !== 'الكل' || visitDateRange !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setVisitSearchQuery('');
                        setVisitRepFilter('الكل');
                        setVisitGpsFilter('الكل');
                        setVisitTypeFilter('الكل');
                        setVisitOutcomeFilter('الكل');
                        setVisitDateRange('ALL');
                        setVisitStartDate('');
                        setVisitEndDate('');
                      }}
                      className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all"
                    >
                      تصفير الفلاتر
                    </button>
                  )}
                </div>
              </div>

              {/* Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-800/80">
                {/* 1. فلتر الفترة الزمنية */}
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>الفترة الزمنية:</span>
                  </label>
                  <select
                    value={visitDateRange}
                    onChange={(e: any) => setVisitDateRange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-all font-sans cursor-pointer"
                  >
                    <option value="ALL">كل الزيارات منذ البداية ({allVisits.length})</option>
                    <option value="TODAY">زيارات اليوم فقط</option>
                    <option value="WEEK">آخر 7 أيام</option>
                    <option value="MONTH">آخر 30 يوماً</option>
                    <option value="CUSTOM">تاريخ مخصص...</option>
                  </select>
                </div>

                {/* 2. فلتر المندوب المسؤول */}
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>المندوب المسؤول:</span>
                  </label>
                  <select
                    value={visitRepFilter}
                    onChange={(e) => setVisitRepFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-all font-sans cursor-pointer"
                  >
                    <option value="الكل">جميع المناديب ({reps.filter(r => r.role === 'SALES_REP').length})</option>
                    {reps.filter(r => r.role === 'SALES_REP').map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.fullName || rep.username} ({allVisits.filter(v => v.userId === rep.id).length} زيارة)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. فلتر المطابقة الجغرافية */}
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>توثيق الـ GPS:</span>
                  </label>
                  <select
                    value={visitGpsFilter}
                    onChange={(e) => setVisitGpsFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-all font-sans cursor-pointer"
                  >
                    <option value="الكل">كل الحالات الجغرافية</option>
                    <option value="WITHIN_RADIUS">✅ مطابق للنطاق (Within Radius)</option>
                    <option value="OUTSIDE_RADIUS">⚠️ خارج النطاق (Outside Radius)</option>
                    <option value="MOCK">🚨 إنذار تزييف (Mock GPS)</option>
                  </select>
                </div>

                {/* 4. فلتر نمط الزيارة */}
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>نمط ونوع الزيارة:</span>
                  </label>
                  <select
                    value={visitTypeFilter}
                    onChange={(e) => setVisitTypeFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-all font-sans cursor-pointer"
                  >
                    <option value="الكل">كل أنواع الزيارات</option>
                    <option value="علمية / ترويج أصناف">علمية / ترويج أصناف</option>
                    <option value="روتينية">روتينية</option>
                    <option value="متابعة عينات">متابعة عينات</option>
                    <option value="تعاقد توريد">تعاقد توريد</option>
                    <option value="تحصيل مالي">تحصيل مالي</option>
                  </select>
                </div>

                {/* 5. فلتر نتيجة الزيارة */}
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>نتيجة ومخرجات الزيارة:</span>
                  </label>
                  <select
                    value={visitOutcomeFilter}
                    onChange={(e) => setVisitOutcomeFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-all font-sans cursor-pointer"
                  >
                    <option value="الكل">كل النتائج</option>
                    <option value="تم كتابة طلبية">تم كتابة طلبية</option>
                    <option value="مهتم بالصنف">مهتم بالصنف</option>
                    <option value="طلب عينات إضافية">طلب عينات إضافية</option>
                    <option value="متابعة لاحقة">متابعة لاحقة</option>
                    <option value="العيادة مغلقة / اعتذار">العيادة مغلقة / اعتذار</option>
                  </select>
                </div>
              </div>

              {/* Custom Date Range Picker when CUSTOM is selected */}
              {visitDateRange === 'CUSTOM' && (
                <div className="flex items-center gap-3 pt-2 text-xs">
                  <span className="text-slate-400 font-bold">من تاريخ:</span>
                  <input
                    type="date"
                    value={visitStartDate}
                    onChange={(e) => setVisitStartDate(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-slate-400 font-bold">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={visitEndDate}
                    onChange={(e) => setVisitEndDate(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}
            </div>

            {/* Visits Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                    <tr>
                      <th className="p-3.5">التاريخ والتوقيت</th>
                      <th className="p-3.5">المندوب المسؤول</th>
                      <th className="p-3.5">العميل / المركز الطبي</th>
                      <th className="p-3.5 text-center">الكلاس والتخصص</th>
                      <th className="p-3.5">نوع ونمط الزيارة</th>
                      <th className="p-3.5">النتيجة</th>
                      <th className="p-3.5">توثيق GPS والمسافة</th>
                      <th className="p-3.5">الملاحظات</th>
                      <th className="p-3.5 text-center">تفاصيل الزيارة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans text-slate-300">
                    {filteredAllVisits.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-10 text-center text-slate-500">
                          لا توجد سجلات زيارات تطابق معايير الفلترة المحددة.
                        </td>
                      </tr>
                    ) : (
                      filteredAllVisits.map((v) => {
                        const cust = customers.find(c => c.id === v.customerId || c.customerCode === v.customerId);
                        const cli = clients.find(c => c.id === v.customerId || c.clientCode === v.customerId);
                        const rep = reps.find(r => r.id === v.userId);
                        const visitDateStr = v.startTimeDevice ? new Date(v.startTimeDevice).toLocaleDateString('ar-YE') : '';
                        const visitTimeStr = v.startTimeDevice ? new Date(v.startTimeDevice).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : '';
                        const durationMinutes = v.visitDurationSeconds ? Math.round(v.visitDurationSeconds / 60) : 0;
                        const docClass = cli?.doctorClass || 'B';

                        return (
                          <tr key={v.visitId} className="hover:bg-slate-850/50 transition-colors">
                            <td className="p-3.5 font-mono">
                              <div className="font-bold text-slate-200">{visitDateStr}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-cyan-400" />
                                <span>{visitTimeStr} ({durationMinutes} د)</span>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div className="font-bold text-slate-100">{rep?.fullName || rep?.username || v.userId}</div>
                              <div className="text-[11px] text-slate-400">{rep?.assignedRegion}</div>
                            </td>

                            <td className="p-3.5">
                              <div className="font-bold text-cyan-300">{cust?.customerName || cli?.name || v.customerId}</div>
                              <div className="text-[11px] text-slate-400 font-mono">كود: {cust?.customerCode || cli?.clientCode || v.customerId}</div>
                            </td>

                            <td className="p-3.5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {docClass === 'A+' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-400/25 text-yellow-300 border border-yellow-500/50">
                                    <span>★ A+</span>
                                  </span>
                                ) : docClass === 'A' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    <span>★ A</span>
                                  </span>
                                ) : docClass === 'B' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/40">
                                    <span>كلاس B</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/40">
                                    <span>كلاس C</span>
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                  {cli?.specialty || cli?.clientType || ''}
                                </span>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                                {v.visitType || 'روتينية'}
                              </span>
                            </td>

                            <td className="p-3.5">
                              {v.visitOutcome === 'تم كتابة طلبية' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>{v.visitOutcome}</span>
                                </span>
                              ) : v.visitOutcome === 'مهتم بالصنف' ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                  <span>{v.visitOutcome}</span>
                                </span>
                              ) : v.visitOutcome === 'طلب عينات إضافية' ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <span>{v.visitOutcome}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-400">
                                  <span>{v.visitOutcome || 'متابعة لاحقة'}</span>
                                </span>
                              )}
                            </td>

                            <td className="p-3.5">
                              <div className="flex flex-col gap-1">
                                {v.locationStatus === 'WITHIN_RADIUS' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>مطابق ({v.distanceMeters ?? 0}م)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>خارج النطاق ({v.distanceMeters ?? 0}م)</span>
                                  </span>
                                )}
                                {(v.isStartMock || v.isEndMock) && (
                                  <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                                    <AlertOctagon className="w-3 h-3" />
                                    <span>تحذير تزييف الموقع!</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-3.5 max-w-xs">
                              <p className="text-[11px] text-slate-300 truncate" title={v.notes || ''}>
                                {v.notes || 'لا توجد ملاحظات إضافية'}
                              </p>
                            </td>

                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedVisitDetail(v)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-slate-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>عرض التفاصيل</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visit Details Modal */}
            {selectedVisitDetail && (() => {
              const cust = customers.find(c => c.id === selectedVisitDetail.customerId || c.customerCode === selectedVisitDetail.customerId);
              const cli = clients.find(c => c.id === selectedVisitDetail.customerId || c.clientCode === selectedVisitDetail.customerId);
              const rep = reps.find(r => r.id === selectedVisitDetail.userId);

              return (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-base font-bold text-slate-100 font-sans">
                          تفاصيل الزيارة الميدانية الكاملة
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedVisitDetail(null)}
                        className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Metadata Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                      {/* Doctor Info */}
                      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                        <span className="text-slate-400 font-bold block">العميل / الطبيب:</span>
                        <div className="text-sm font-bold text-cyan-300">{cust?.customerName || cli?.name}</div>
                        <div className="text-slate-400">الكود: {cust?.customerCode || cli?.clientCode}</div>
                        <div className="text-slate-400">الكلاس: {cli?.doctorClass || 'B'} | التخصص: {cli?.specialty || cli?.clientType}</div>
                        <div className="text-slate-400">العنوان: {cust?.address || cli?.address}</div>
                        <div className="text-slate-400">الهاتف: {cust?.phone || cli?.phone}</div>
                      </div>

                      {/* Rep Info */}
                      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                        <span className="text-slate-400 font-bold block">المندوب المنفذ:</span>
                        <div className="text-sm font-bold text-slate-100">{rep?.fullName || rep?.username}</div>
                        <div className="text-slate-400">المنطقة الأساسية: {rep?.assignedRegion}</div>
                        <div className="text-slate-400">معرف الجهاز: {selectedVisitDetail.deviceInstallationId}</div>
                        <div className="text-slate-400 font-mono">معرف الزيارة: {selectedVisitDetail.visitId}</div>
                      </div>
                    </div>

                    {/* Time & GPS Verification */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs font-sans">
                      <span className="text-slate-300 font-bold block border-b border-slate-800/80 pb-1.5">
                        التوقيت والتحقق الجغرافي (GPS Audit):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-slate-500 block">وقت البدء:</span>
                          <span className="text-slate-200 font-mono">
                            {selectedVisitDetail.startTimeDevice ? new Date(selectedVisitDetail.startTimeDevice).toLocaleString('ar-YE') : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">وقت الانتهاء:</span>
                          <span className="text-slate-200 font-mono">
                            {selectedVisitDetail.endTimeDevice ? new Date(selectedVisitDetail.endTimeDevice).toLocaleString('ar-YE') : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">مدة اللقاء:</span>
                          <span className="text-cyan-400 font-bold font-mono">
                            {selectedVisitDetail.visitDurationSeconds ? Math.round(selectedVisitDetail.visitDurationSeconds / 60) : 0} دقيقة
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">المسافة الفعلية:</span>
                          <span className="text-slate-200 font-mono font-bold">
                            {selectedVisitDetail.distanceMeters ?? 0} متر
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">حالة النطاق:</span>
                          <span className={selectedVisitDetail.locationStatus === 'WITHIN_RADIUS' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                            {selectedVisitDetail.locationStatus === 'WITHIN_RADIUS' ? '✅ داخل النطاق المسموح' : '⚠️ خارج النطاق'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">كشف التزييف Mock:</span>
                          <span className={selectedVisitDetail.isStartMock || selectedVisitDetail.isEndMock ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                            {selectedVisitDetail.isStartMock || selectedVisitDetail.isEndMock ? '🚨 تنبيه تزييف' : 'آمن ونظامي'}
                          </span>
                        </div>
                      </div>

                      {/* Coordinates */}
                      <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                        إحداثيات المندوب الفعلية: {selectedVisitDetail.startLatitude}, {selectedVisitDetail.startLongitude}
                      </div>
                    </div>

                    {/* Notes & Outcomes */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold">نوع الزيارة: <span className="text-cyan-400">{selectedVisitDetail.visitType}</span></span>
                        <span className="text-slate-400 font-bold">النتيجة: <span className="text-emerald-400">{selectedVisitDetail.visitOutcome}</span></span>
                      </div>
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-slate-400 font-bold block mb-1">الملاحظات والطلبيات المدونة:</span>
                        <p className="text-slate-200 bg-slate-900 p-3 rounded-lg border border-slate-800 leading-relaxed font-sans">
                          {selectedVisitDetail.notes || 'لا توجد ملاحظات مسجلة.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedVisitDetail(null)}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 1: INTERACTIVE MAP & LIVE VISITS */}
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* High Precision Visual Map Canvas */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  <h2 className="font-bold text-slate-200 text-sm">الخريطة الميدانية التفاعلية للزيارات والعملاء</h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">المنطقة: أمانة العاصمة صنعاء وضواحيها</span>
              </div>

              {/* High precision SVG / Canvas Simulation of Sana'a Field Area */}
              <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800/80 relative overflow-hidden min-h-[420px] flex items-center justify-center">
                {/* Background Grid Lines */}
                <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Simulated Map Markers for Customers and Visits */}
                <div className="relative w-full h-full p-8 flex items-center justify-center">
                  {customers.map((cust, idx) => {
                    // Map lat/lng coordinates into visual container positions
                    const offsetX = (cust.longitude - 31.2000) * 2000 + 100;
                    const offsetY = (30.1200 - cust.latitude) * 2000 + 50;

                    const relatedVisit = visits.find(v => v.customerId === cust.id);

                    return (
                      <div
                        key={cust.id}
                        className="absolute group cursor-pointer transition-all transform hover:scale-110"
                        style={{
                          left: `${Math.min(85, Math.max(10, (idx + 1) * 18))}%`,
                          top: `${Math.min(80, Math.max(15, (idx % 3 + 1) * 25))}%`,
                        }}
                        onClick={() => relatedVisit && setSelectedVisitForModal(relatedVisit)}
                      >
                        {/* Allowed Radius Circle */}
                        <div className="w-20 h-20 -ml-8 -mt-8 rounded-full border border-cyan-500/30 bg-cyan-500/5 animate-pulse-subtle pointer-events-none absolute" />

                        {/* Customer Marker Pin */}
                        <div className="w-7 h-7 rounded-full bg-cyan-600 text-white font-bold text-xs flex items-center justify-center shadow-lg border-2 border-slate-900">
                          {cust.customerCode.slice(-2)}
                        </div>

                        {/* Visit Marker Pin if visited */}
                        {relatedVisit && (
                          <div className={`w-5 h-5 rounded-full absolute -top-2 -right-2 flex items-center justify-center shadow border border-slate-900 text-[10px] font-bold ${
                            relatedVisit.locationStatus === 'WITHIN_RADIUS' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'
                          }`}>
                            ✓
                          </div>
                        )}

                        {/* Tooltip Hover Card */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-8 right-0 bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-2xl text-xs w-48 z-20 pointer-events-none">
                          <div className="font-bold text-slate-100">{cust.customerName}</div>
                          <div className="text-[11px] text-cyan-400 font-mono">الكود: {cust.customerCode}</div>
                          {relatedVisit ? (
                            <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
                              زيارة مسجلة: {relatedVisit.distanceMeters}m ({relatedVisit.locationStatus})
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 mt-1">لم تتم الزيارة اليوم</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Visits Detail List Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col">
              <h2 className="font-bold text-slate-200 text-sm">تفاصيل زيارات الميدان المرفوعة ({visits.length})</h2>

              <div className="space-y-2 flex-1 overflow-y-auto max-h-[460px] pr-1">
                {visits.map(v => {
                  const cust = customers.find(c => c.id === v.customerId);
                  const rep = reps.find(r => r.id === v.userId);

                  return (
                    <div
                      key={v.visitId}
                      onClick={() => setSelectedVisitForModal(v)}
                      className="bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-xs">{cust?.customerName || 'عميل'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.locationStatus === 'WITHIN_RADIUS'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {v.locationStatus}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 flex items-center justify-between font-mono tabular-nums">
                        <span>المندوب: {rep?.fullName.split(' ')[0] || v.userId}</span>
                        <span className="text-cyan-400">الكود: {cust?.customerCode}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center justify-between font-mono">
                        <span>الوقت: {new Date(v.startTimeDevice).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>المسافة: {v.distanceMeters || 0}m</span>
                      </div>

                      {(v.isStartMock || v.isEndMock) && (
                        <div className="text-[10px] text-rose-400 bg-rose-950/40 p-1 rounded flex items-center gap-1 border border-rose-900">
                          <AlertOctagon className="w-3 h-3 shrink-0" />
                          <span>تحذير موقع وهمي (Mock GPS)</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {visits.length === 0 && (
                  <div className="text-center py-12 text-xs text-slate-500">
                    لا توجد زيارات مرفوعة لهذا التاريخ حتى الآن.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOMERS MASTER MANAGER */}
        {activeTab === 'customers' && (() => {
          const filteredCustomers = customers.filter(c => {
            if (customerRegionFilter !== 'الكل' && c.region !== customerRegionFilter) return false;
            if (customerRepFilter !== 'الكل' && c.assignedRepId !== customerRepFilter) return false;
            if (customerSearchQuery) {
              const q = customerSearchQuery.trim().toLowerCase();
              const matchName = c.customerName?.toLowerCase().includes(q);
              const matchCode = c.customerCode?.toLowerCase().includes(q);
              const matchOwner = c.ownerName?.toLowerCase().includes(q);
              const matchPhone = c.phone?.toLowerCase().includes(q);
              return matchName || matchCode || matchOwner || matchPhone;
            }
            return true;
          });

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              {/* Header with Title and Action Buttons */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-base font-bold text-slate-100">سجل العملاء المركزي (Customer Master)</h2>
                    <span className="px-2 py-0.5 bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 rounded-full text-[11px] font-bold">
                      {customers.length} عميل مسجل
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    السجل المعتمد المركزي لجميع المستشفيات والعيادات والمراكز والأطباء. أي تعديل أو استيراد هنا يتم حفظه وتحديث نسخته تلقائياً لتصل إلى هواتف المناديب عبر التزامن المباشر!
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Import Button */}
                  <button
                    onClick={() => setShowCustomerImportModal(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow transition-all"
                    title="استيراد عملاء وأطباء من ملف Excel أو CSV"
                  >
                    <Upload className="w-4 h-4" />
                    <span>استيراد عملاء (Excel / CSV)</span>
                  </button>

                  {/* Export Button */}
                  <button
                    onClick={handleExportCustomers}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                    title="تصدير السجل المركزي إلى ملف Excel"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    <span>تصدير Excel</span>
                  </button>

                  {/* Add Customer Button */}
                  <button
                    onClick={() => {
                      setEditingCustomer({
                        customerCode: `0${Math.floor(10000 + Math.random() * 90000)}`,
                        customerName: '',
                        ownerName: '',
                        phone: '',
                        address: '',
                        region: 'المنطقة الوسطى',
                        latitude: 15.3533,
                        longitude: 44.2045,
                        allowedVisitRadiusMeters: 100,
                        assignedRepId: '',
                      });
                      setShowCustomerModal(true);
                    }}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة عميل جديد</span>
                  </button>
                </div>
              </div>

              {/* Search & Filtering Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={e => setCustomerSearchQuery(e.target.value)}
                    placeholder="بحث باسم العميل، الكود، الهاتف، أو التخصص..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  {customerSearchQuery && (
                    <button
                      onClick={() => setCustomerSearchQuery('')}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Region Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium shrink-0">المنطقة:</span>
                  <select
                    value={customerRegionFilter}
                    onChange={e => setCustomerRegionFilter(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="الكل">جميع المناطق</option>
                    <option value="المنطقة الشمالية">المنطقة الشمالية (قطاع العمليات الشمالي)</option>
                    <option value="المنطقة الوسطى">المنطقة الوسطى (قطاع العمليات الأوسط)</option>
                    <option value="المنطقة الجنوبية">المنطقة الجنوبية (قطاع العمليات الجنوبي)</option>
                  </select>
                </div>

                {/* Rep Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium shrink-0">المندوب:</span>
                  <select
                    value={customerRepFilter}
                    onChange={e => setCustomerRepFilter(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="الكل">جميع المناديب</option>
                    {reps.filter(r => r.role === 'SALES_REP').map(rep => (
                      <option key={rep.id} value={rep.id}>
                        {rep.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customers Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Customer Code</th>
                      <th className="p-3">اسم العميل / المركز</th>
                      <th className="p-3">المسؤول / التخصص</th>
                      <th className="p-3">المنطقة</th>
                      <th className="p-3">المندوب المسند</th>
                      <th className="p-3">إحداثيات GPS</th>
                      <th className="p-3">النطاق</th>
                      <th className="p-3">الإصدار (Version)</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200 font-mono tabular-nums">
                    {filteredCustomers.map(c => {
                      const rep = reps.find(r => r.id === c.assignedRepId);
                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-bold text-cyan-400">{c.customerCode}</td>
                          <td className="p-3 font-sans font-semibold text-slate-100">
                            {c.customerName}
                            {c.phone && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.phone}</div>}
                          </td>
                          <td className="p-3 font-sans text-slate-300">{c.ownerName || '-'}</td>
                          <td className="p-3 font-sans text-slate-400">{c.region}</td>
                          <td className="p-3 font-sans">
                            {rep ? (
                              <span className="px-2 py-0.5 bg-amber-950/50 text-amber-300 border border-amber-800/50 rounded-lg text-[11px] font-bold">
                                {rep.fullName}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">غير مسند</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400">{c.latitude?.toFixed(4)}, {c.longitude?.toFixed(4)}</td>
                          <td className="p-3 text-emerald-400 font-bold">{c.allowedVisitRadiusMeters}m</td>
                          <td className="p-3 text-cyan-400 font-bold">v{c.version}</td>
                          <td className="p-3 font-sans">
                            {c.isActive ? (
                              <span className="text-emerald-400 text-[11px] font-bold">نشط</span>
                            ) : (
                              <span className="text-rose-400 text-[11px]">معطل</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingCustomer(c);
                                  setShowCustomerModal(true);
                                }}
                                className="p-1.5 text-cyan-400 hover:bg-cyan-950/60 rounded-lg transition-colors"
                                title="تعديل العميل"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCustomer(c.id, c.customerName)}
                                className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors"
                                title="حذف العميل من السجل المركزي"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500 font-sans">
                          لم يتم العثور على أي عملاء مطابقين لمعايير البحث.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* TAB 3: SERVER CONFIGURATION & FEATURE FLAGS */}
        {activeTab === 'config' && config && (
          <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-100">إعدادات النظام والـ Feature Flags (Server-Driven Config)</h2>
              <p className="text-xs text-slate-400">
                تغيير دقة الـ GPS، النطاق الافتراضي، أو تفعيل المزايا يتم هنا ويرسل للهواتف فوراً بدون بناء APK جديد.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-slate-300 font-sans block">إصدار الإعدادات الحالي (Config Version):</label>
                <input
                  type="text"
                  value={`v${config.configVersion}`}
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-sans block">أقل إصدار تطبيق مدعوم (Min App Version):</label>
                <input
                  type="text"
                  value={config.minSupportedAppVersion}
                  onChange={e => setConfig({ ...config, minSupportedAppVersion: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-sans block">حد دقة الـ GPS المسموح (متر):</label>
                <input
                  type="number"
                  value={config.gpsAccuracyThresholdMeters}
                  onChange={e => setConfig({ ...config, gpsAccuracyThresholdMeters: parseFloat(e.target.value) || 30 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-sans block">نطاق الزيارة الافتراضي (متر):</label>
                <input
                  type="number"
                  value={config.defaultVisitRadiusMeters}
                  onChange={e => setConfig({ ...config, defaultVisitRadiusMeters: parseFloat(e.target.value) || 100 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-sans block">معدل المزامنة الخلفية (دقائق):</label>
                <input
                  type="number"
                  value={config.syncIntervalMinutes}
                  onChange={e => setConfig({ ...config, syncIntervalMinutes: parseInt(e.target.value, 10) || 15 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Feature Flags Checkboxes */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="font-bold text-slate-200 text-xs font-sans">تفعيل وتجميد المزايا التشغيلية (Feature Flags):</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableAdvancedReports}
                    onChange={e => setConfig({ ...config, enableAdvancedReports: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span>تفعيل التقارير المتقدمة للمدير</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableMap}
                    onChange={e => setConfig({ ...config, enableMap: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span>تفعيل العرض الخريطي المباشر</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableVisitPhotos}
                    onChange={e => setConfig({ ...config, enableVisitPhotos: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span>تفعيل التقاط صور الميدان</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg"
            >
              حفظ الإعدادات ونشرها لجميع الهواتف بدون APK
            </button>
          </form>
        )}

        {/* TAB 4: REPS & USERS MANAGEMENT */}
        {activeTab === 'reps' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100">إدارة مندوبي المبيعات والمستخدمين</h2>
                <p className="text-xs text-slate-400">إضافة أو تعطيل مندوب يتم فوراً عبر الخادم دون إصدار APK جديد.</p>
              </div>

              <button
                onClick={() => {
                  setEditingUser({
                    username: '',
                    fullName: '',
                    role: 'SALES_REP',
                    phone: '',
                    assignedRegion: 'القاهرة الكبرى',
                    password: '123',
                  });
                  setShowUserModal(true);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مندوب جديد</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">اسم المستخدم</th>
                    <th className="p-3">الاسم الكامل</th>
                    <th className="p-3">الدور (Role)</th>
                    <th className="p-3">الهاتف</th>
                    <th className="p-3">المنطقة المسندة</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200 font-mono tabular-nums">
                  {reps.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-bold text-cyan-400">{r.username}</td>
                      <td className="p-3 font-sans font-semibold text-slate-100">{r.fullName}</td>
                      <td className="p-3 font-sans text-slate-300">{r.role}</td>
                      <td className="p-3 text-slate-400">{r.phone || '-'}</td>
                      <td className="p-3 font-sans text-slate-300">{r.assignedRegion}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                          {r.isActive ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => {
                            setEditingUser(r);
                            setShowUserModal(true);
                          }}
                          className="p-1.5 text-cyan-400 hover:bg-cyan-950/60 rounded-lg transition-colors"
                          title="تعديل المستخدم"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: REPORTS & EXPORT ENGINE */}
        {activeTab === 'reports' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-100">تقارير الامتثال الميداني والتصدير الرسمية</h2>
                <p className="text-xs text-slate-400">تصدير بيانات حقيقية مباشرة من قاعدة البيانات مع إمكانية التمرير العرضي وتعديل عرض الأعمدة يدوياً.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400">تاريخ التقرير:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent text-slate-200 font-mono outline-none"
                  />
                </div>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير ملف Excel (CSV)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block">نسبة الالتزام بالنطاق الجغرافي:</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                  {reportSummary && reportSummary.totalVisits > 0
                    ? `${Math.round((reportSummary.withinRadius / reportSummary.totalVisits) * 100)}%`
                    : '100%'}
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block">الزيارات خارج النطاق (Outside Radius):</span>
                <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                  {reportSummary?.outsideRadius || 0} زيارة
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block">إنذارات تزييف الموقع (Mock GPS):</span>
                <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
                  {reportSummary?.mockLocationWarnings || 0} إنذار
                </div>
              </div>
            </div>

            {/* Manual Column Width Customization Toolbar */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">تحكم يدوي في عرض أعمدة الجدول (بكسل):</span>
                <button
                  onClick={() => setReportColumnWidths({ id: 120, rep: 150, client: 200, class: 90, region: 130, time: 160, status: 140, distance: 100 })}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  إعادة ضبط العرض الافتراضي
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">معرف الزيارة</label>
                  <input
                    type="number"
                    min="80"
                    max="300"
                    value={reportColumnWidths.id}
                    onChange={e => setReportColumnWidths({ ...reportColumnWidths, id: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">المندوب</label>
                  <input
                    type="number"
                    min="100"
                    max="350"
                    value={reportColumnWidths.rep}
                    onChange={e => setReportColumnWidths({ ...reportColumnWidths, rep: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">العميل / الطبيب</label>
                  <input
                    type="number"
                    min="120"
                    max="400"
                    value={reportColumnWidths.client}
                    onChange={e => setReportColumnWidths({ ...reportColumnWidths, client: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">الفئة</label>
                  <input
                    type="number"
                    min="70"
                    max="200"
                    value={reportColumnWidths.class}
                    onChange={e => setReportColumnWidths({ ...reportColumnWidths, class: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">المنطقة</label>
                  <input
                    type="number"
                    min="90"
                    max="250"
                    value={reportColumnWidths.region}
                    onChange={e => setReportColumnWidths({ ...reportColumnWidths, region: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">التوقيت</label>
                  <input
                    type="number"
                    min="120"
                    max="300"
                    value={reportColumnWidths.time}
                    onChange={e => setReportColumnWidths({ ...reportColumnWidths, time: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">حالة الموقع</label>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    value={reportColumnWidths.status}
                    onChange={e => setReportColumnWidths({ ...reportColumnWidths, status: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">المسافة</label>
                  <input
                    type="number"
                    min="80"
                    max="200"
                    value={reportColumnWidths.distance}
                    onChange={e => setReportColumnWidths({ ...reportColumnWidths, distance: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Visits Report Table with Horizontal Scrolling */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table className="text-right text-xs divide-y divide-slate-800" style={{ minWidth: '1100px' }}>
                <thead className="bg-slate-900 text-slate-400 font-semibold sticky top-0">
                  <tr>
                    <th className="p-3 whitespace-nowrap" style={{ width: `${reportColumnWidths.id}px` }}>معرف الزيارة</th>
                    <th className="p-3 whitespace-nowrap" style={{ width: `${reportColumnWidths.rep}px` }}>المندوب</th>
                    <th className="p-3 whitespace-nowrap" style={{ width: `${reportColumnWidths.client}px` }}>العميل / الطبيب</th>
                    <th className="p-3 whitespace-nowrap" style={{ width: `${reportColumnWidths.class}px` }}>الفئة</th>
                    <th className="p-3 whitespace-nowrap" style={{ width: `${reportColumnWidths.region}px` }}>المنطقة</th>
                    <th className="p-3 whitespace-nowrap" style={{ width: `${reportColumnWidths.time}px` }}>التوقيت</th>
                    <th className="p-3 whitespace-nowrap" style={{ width: `${reportColumnWidths.status}px` }}>حالة الموقع</th>
                    <th className="p-3 whitespace-nowrap" style={{ width: `${reportColumnWidths.distance}px` }}>المسافة (متر)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200 font-mono tabular-nums">
                  {visits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                        لا توجد زيارات مسجلة لهذا التاريخ.
                      </td>
                    </tr>
                  ) : (
                    visits.map(v => {
                      const rep = reps.find(r => r.id === v.userId);
                      const cust = customers.find(c => c.id === v.customerId);
                      return (
                        <tr key={v.visitId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 whitespace-nowrap text-cyan-400 font-bold truncate" style={{ width: `${reportColumnWidths.id}px` }}>{v.visitId}</td>
                          <td className="p-3 whitespace-nowrap font-sans text-slate-200 truncate" style={{ width: `${reportColumnWidths.rep}px` }}>{rep?.fullName || v.userId}</td>
                          <td className="p-3 whitespace-nowrap font-sans text-slate-100 truncate" style={{ width: `${reportColumnWidths.client}px` }}>{cust?.customerName || v.customerId}</td>
                          <td className="p-3 whitespace-nowrap font-sans text-center truncate" style={{ width: `${reportColumnWidths.class}px` }}>
                            <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-bold">
                              {(cust as any)?.doctorClass || 'C'}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap font-sans text-slate-300 truncate" style={{ width: `${reportColumnWidths.region}px` }}>{cust?.region || 'ضواحي صنعاء'}</td>
                          <td className="p-3 whitespace-nowrap text-slate-400 truncate" style={{ width: `${reportColumnWidths.time}px` }}>{new Date(v.startTimeDevice).toLocaleString('ar-EG')}</td>
                          <td className="p-3 whitespace-nowrap truncate" style={{ width: `${reportColumnWidths.status}px` }}>
                            {v.locationStatus === 'WITHIN_RADIUS' ? (
                              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[10px]">
                                داخل النطاق ✓
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px]">
                                خارج النطاق ⚠
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap text-slate-300 truncate" style={{ width: `${reportColumnWidths.distance}px` }}>{Math.round(v.distanceMeters || 0)} م</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: VISIT AUTHENTICATION & AUDIT */}
        {activeTab === 'visit_audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-100">شاشة المصادقة وتدقيق الزيارات الميدانية (Visit Authentication & Geofence Audit)</h2>
                <p className="text-xs text-slate-400">التحقق من صحة إحداثيات GPS، مطابقة النطاق الجغرافي، وكشف أي تزييف موقع (Mock GPS) مع اعتماد المصادقة.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400">تاريخ التدقيق:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent text-slate-200 font-mono outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Authentication & Audit KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block">إجمالي الزيارات المرفوعة:</span>
                <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
                  {visits.length} زيارة
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block">زيارات مصادقة (Within Radius):</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                  {visits.filter(v => v.locationStatus === 'WITHIN_RADIUS').length} زيارة
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block">زيارات خارج النطاق (Outside Radius):</span>
                <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                  {visits.filter(v => v.locationStatus !== 'WITHIN_RADIUS').length} زيارة
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block">إنذارات تزييف الموقع (Mock GPS):</span>
                <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
                  {visits.filter(v => v.isStartMock || v.isEndMock).length} إنذار
                </div>
              </div>
            </div>

            {/* Authentication & Verification Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table className="w-full text-right text-xs divide-y divide-slate-800">
                <thead className="bg-slate-900 text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3">معرف الزيارة (Idempotency Key)</th>
                    <th className="p-3">المندوب</th>
                    <th className="p-3">العميل / المركز الطبي</th>
                    <th className="p-3">حالة المصادقة الجغرافية</th>
                    <th className="p-3">المسافة الفعلية</th>
                    <th className="p-3">حالة التزييف (Mock GPS)</th>
                    <th className="p-3">التوقيت والتفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200 font-mono tabular-nums">
                  {visits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                        لا توجد زيارات مسجلة للتدقيق في هذا التاريخ.
                      </td>
                    </tr>
                  ) : (
                    visits.map(v => {
                      const rep = reps.find(r => r.id === v.userId);
                      const cust = customers.find(c => c.id === v.customerId);
                      const isMock = v.isStartMock || v.isEndMock;
                      const isVerified = v.locationStatus === 'WITHIN_RADIUS' && !isMock;
                      return (
                        <tr key={v.visitId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-cyan-400 font-bold">{v.visitId}</td>
                          <td className="p-3 font-sans text-slate-200">{rep?.fullName || v.userId}</td>
                          <td className="p-3 font-sans text-slate-100">{cust?.customerName || v.customerId}</td>
                          <td className="p-3">
                            {isVerified ? (
                              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[10px] font-bold">
                                مصادقة صحيحة ✓
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px] font-bold">
                                تحتاج مراجعة ⚠
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-300">{Math.round(v.distanceMeters || 0)} متر</td>
                          <td className="p-3">
                            {isMock ? (
                              <span className="px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded text-[10px] font-bold">
                                محاكي موقع مكتشف ⛔
                              </span>
                            ) : (
                              <span className="text-slate-500">نظام آمن (سليم)</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400 font-sans">
                            <div>{new Date(v.startTimeDevice).toLocaleString('ar-EG')}</div>
                            <div className="text-[10px] text-slate-500">{v.visitDurationSeconds ? `المدة: ${Math.round(v.visitDurationSeconds / 60)} دقيقة` : ''}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: IMMUTABLE AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">سجل التدقيق غير القابل للتعديل (Immutable Audit Logs)</h2>
              <p className="text-xs text-slate-400">تتبع جميع العمليات والتغييرات الإدارية والميدانية المرفوعة.</p>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Audit ID</th>
                    <th className="p-3">المستخدم / الدور</th>
                    <th className="p-3">الإجراء (Action)</th>
                    <th className="p-3">الكيان (Entity)</th>
                    <th className="p-3">التاريخ والتوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200 font-mono tabular-nums">
                  {auditLogs.map(log => (
                    <tr key={log.auditId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-cyan-400 font-bold">{log.auditId}</td>
                      <td className="p-3 font-sans text-slate-200">{log.userId} ({log.role})</td>
                      <td className="p-3 font-sans font-bold text-emerald-400">{log.action}</td>
                      <td className="p-3 font-sans text-slate-400">{log.entityType} #{log.entityId}</td>
                      <td className="p-3 text-slate-400">{new Date(log.timestamp).toLocaleString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: PERMISSIONS MANAGER (مدير النظام) */}
        {activeTab === 'permissions' && currentUser.role === 'SYSTEM_ADMIN' && (
          <PermissionsManager currentUser={currentUser} />
        )}

        {/* TAB 8: STATISTICS */}
        {activeTab === 'statistics' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-100">إحصائيات الأداء (عدد الزيارات ونسبة الإنجاز)</h2>
            <div className="h-[400px] w-full bg-slate-950 p-4 rounded-xl border border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                  <Legend />
                  <Bar dataKey="visits" name="عدد الزيارات" fill="#06b6d4" />
                  <Bar dataKey="completionRate" name="معدل الإنجاز (%)" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>

      {/* CUSTOMER EDIT / CREATE MODAL */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCustomer} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-100 text-base">إضافة / تعديل عميل (Master)</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Customer Code (حفظ الأصفار البادئة):</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.customerCode || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, customerCode: e.target.value })}
                  placeholder="مثال: 010001"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono font-bold focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">اسم العميل:</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.customerName || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, customerName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">المسؤول / صاحب العميل:</label>
                <input
                  type="text"
                  value={editingCustomer.ownerName || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, ownerName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">الهاتف:</label>
                  <input
                    type="text"
                    value={editingCustomer.phone || ''}
                    onChange={e => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">المنطقة:</label>
                  <input
                    type="text"
                    value={editingCustomer.region || ''}
                    onChange={e => setEditingCustomer({ ...editingCustomer, region: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">العنوان التفصيلي:</label>
                <input
                  type="text"
                  value={editingCustomer.address || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">المندوب الميداني المسند له:</label>
                <select
                  value={editingCustomer.assignedRepId || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, assignedRepId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">بدون تعيين (غير مسند)</option>
                  {reps.filter(r => r.role === 'SALES_REP').map(rep => (
                    <option key={rep.id} value={rep.id}>
                      {rep.fullName} ({rep.assignedRegion || 'بدون منطقة'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Latitude:</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingCustomer.latitude !== undefined ? editingCustomer.latitude : 15.3533}
                    onChange={e => setEditingCustomer({ ...editingCustomer, latitude: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Longitude:</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingCustomer.longitude !== undefined ? editingCustomer.longitude : 44.2045}
                    onChange={e => setEditingCustomer({ ...editingCustomer, longitude: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Radius (متر):</label>
                  <input
                    type="number"
                    value={editingCustomer.allowedVisitRadiusMeters || 100}
                    onChange={e => setEditingCustomer({ ...editingCustomer, allowedVisitRadiusMeters: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow"
              >
                حفظ العميل وتحديث الإصدار المركزي
              </button>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* USER EDIT / CREATE MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveUser} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-100 text-base">إضافة / تعديل مستخدم ومندوب</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">اسم المستخدم (Username):</label>
                <input
                  type="text"
                  required
                  value={editingUser.username || ''}
                  onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">الاسم الكامل:</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName || ''}
                  onChange={e => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">كلمة المرور:</label>
                <input
                  type="password"
                  value={editingUser.password || ''}
                  onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                  placeholder="اتركه فارغاً للتمرير"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">الدور (Role):</label>
                  <select
                    value={editingUser.role || 'SALES_REP'}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="SALES_REP">SALES_REP (مندوب مبيعات)</option>
                    <option value="SALES_MANAGER">SALES_MANAGER (مشرف)</option>
                    <option value="SYSTEM_ADMIN">SYSTEM_ADMIN (مدير)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">المنطقة:</label>
                  <input
                    type="text"
                    value={editingUser.assignedRegion || 'القاهرة الكبرى'}
                    onChange={e => setEditingUser({ ...editingUser, assignedRegion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow"
              >
                حفظ المستخدم دون الحاجة لـ APK
              </button>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VISIT DETAILS MODAL */}
      {selectedVisitForModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm">تفاصيل الزيارة الميدانية المرفوعة</h3>
              <button
                onClick={() => setSelectedVisitForModal(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono tabular-nums">
              <div><span className="text-slate-400">Visit ID:</span> <span className="text-cyan-400 font-bold">{selectedVisitForModal.visitId}</span></div>
              <div><span className="text-slate-400">Customer ID:</span> <span className="text-slate-200">{selectedVisitForModal.customerId}</span></div>
              <div><span className="text-slate-400">Rep ID:</span> <span className="text-slate-200">{selectedVisitForModal.userId}</span></div>
              <div><span className="text-slate-400">Start Device Time:</span> <span className="text-slate-200">{selectedVisitForModal.startTimeDevice}</span></div>
              <div><span className="text-slate-400">Server Received Time:</span> <span className="text-slate-200">{selectedVisitForModal.serverReceivedTimestamp}</span></div>
              <div><span className="text-slate-400">Calculated Distance:</span> <span className="text-emerald-400 font-bold">{selectedVisitForModal.distanceMeters || 0} meters</span></div>
              <div><span className="text-slate-400">Location Status:</span> <span className="text-amber-400 font-bold">{selectedVisitForModal.locationStatus}</span></div>
              <div><span className="text-slate-400">Visit Outcome:</span> <span className="text-slate-200">{selectedVisitForModal.visitOutcome || 'لا يوجد'}</span></div>
              <div><span className="text-slate-400">Notes:</span> <span className="text-slate-300 font-sans block mt-1 bg-slate-950 p-2 rounded border border-slate-800">{selectedVisitForModal.notes || 'لا توجد ملاحظات'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER BULK IMPORT MODAL */}
      {showCustomerImportModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-base">استيراد عملاء وأطباء إلى سجل العملاء المركزي (Excel / CSV)</h3>
              </div>
              <button
                onClick={() => {
                  setShowCustomerImportModal(false);
                  setCustomerImportData([]);
                  setCustomerImportErrors([]);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download & Instructions */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="text-slate-200 font-semibold mb-1">حمّل نموذج الإدراج المعتمد واملأ بيانات العملاء أو الأطباء:</p>
                <p className="text-slate-400">يدعم الملف صيغ Excel (.xlsx, .xls) و CSV مع الحفاظ على الأصفار البادئة والإحداثيات الجغرافية.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadTemplateExcel('CLIENT')}
                  className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg font-bold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل نموذج Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadTemplateCsv('CLIENT')}
                  className="px-3 py-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg font-bold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل نموذج CSV</span>
                </button>
              </div>
            </div>

            {/* File Upload Drop Area */}
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-6 text-center bg-slate-950/40 transition-colors">
              <input
                ref={customerFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .json, .txt"
                onChange={handleCustomerFileUpload}
                className="hidden"
                id="customer-master-file-upload"
              />
              <label htmlFor="customer-master-file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-cyan-400 animate-pulse" />
                <span className="text-sm font-bold text-slate-200">اضغط هنا لاختيار ملف من جهازك</span>
                <span className="text-xs text-slate-400">يدعم جداول Excel و CSV وقوائم الأطباء والمراكز</span>
              </label>
            </div>

            {/* Errors / Warnings */}
            {customerImportErrors.length > 0 && (
              <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-3 max-h-24 overflow-y-auto text-xs space-y-1">
                {customerImportErrors.map((err, i) => (
                  <p key={i} className="text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{err}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Preview Table */}
            {customerImportData.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-cyan-400">معاينة السجلات الجاهزة للاستيراد ({customerImportData.length} عميل):</span>
                </div>
                <div className="flex-1 overflow-auto border border-slate-800 rounded-xl max-h-60">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">كود العميل</th>
                        <th className="p-2">اسم العميل</th>
                        <th className="p-2">النوع / التخصص</th>
                        <th className="p-2">المنطقة</th>
                        <th className="p-2">الهاتف</th>
                        <th className="p-2">المندوب</th>
                        <th className="p-2">الإحداثيات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200 font-mono text-[11px]">
                      {customerImportData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-2 text-slate-500">{idx + 1}</td>
                          <td className="p-2 font-bold text-cyan-400">{row.clientCode || row.customerCode || 'تلقائي'}</td>
                          <td className="p-2 font-sans font-semibold text-slate-100">{row.name || row.customerName}</td>
                          <td className="p-2 font-sans text-slate-300">{row.specialty || row.clientType || row.ownerName || '-'}</td>
                          <td className="p-2 font-sans text-slate-400">{row.region || 'المنطقة الوسطى'}</td>
                          <td className="p-2 text-slate-400">{row.phone || '-'}</td>
                          <td className="p-2 font-sans text-amber-400">{row.assignedRep || '-'}</td>
                          <td className="p-2 text-slate-400">{row.latitude || 15.3533}, {row.longitude || 44.2045}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowCustomerImportModal(false);
                  setCustomerImportData([]);
                  setCustomerImportErrors([]);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={customerImportData.length === 0 || isProcessingCustomerImport}
                onClick={handleCommitCustomerImport}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg"
              >
                {isProcessingCustomerImport ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>اعتماد واستيراد ({customerImportData.length}) سجل إلى السجل المركزي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className={`fixed bottom-6 left-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
          toastMessage.type === 'success'
            ? 'bg-emerald-950/95 text-emerald-300 border-emerald-700'
            : toastMessage.type === 'error'
              ? 'bg-rose-950/95 text-rose-300 border-rose-700'
              : 'bg-cyan-950/95 text-cyan-300 border-cyan-700'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};
