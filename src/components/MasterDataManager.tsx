/**
 * Master Data & Assignments Management Component (إدارة البيانات والتعيينات)
 * Handles:
 * 1. المندوب (Sales Rep)
 * 2. المنطقة (Territory / Region)
 * 3. الصنف (Product / Item)
 * 4. العميل (Client / Doctor / Clinic / Hospital)
 * 5. الصيدلية (Pharmacy)
 * 
 * Features:
 * - إضافة (Add) with pristine modal forms
 * - حفظ (Save) with persistent API calls & audit trail
 * - تعديل (Edit) with pre-filled forms
 * - تعيين (Assign) reps to regions, products, clients, and pharmacies
 * - إدراج ملف (Import Excel / CSV / JSON) with live preview & validation
 * - تنزيل نماذج جاهزة (Download Ready Templates in Excel & CSV)
 * - تصدير (Export) to Excel & CSV
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  MapPin,
  Package,
  Building,
  Pill,
  UploadCloud,
  Download,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  X,
  Link as LinkIcon,
  FileSpreadsheet,
  Save,
  Check,
  Stethoscope,
  Briefcase
} from 'lucide-react';
import { User, Region, ProductItem, Client, Pharmacy } from '../types';
import { ConfirmationDialog } from './ConfirmationDialog';
import {
  EntityType,
  ENTITY_METAS,
  downloadTemplateExcel,
  downloadTemplateCsv,
  exportDataToExcel,
  parseUploadedFile
} from '../lib/fileImporter';
import { offlineRoomDb } from '../lib/offlineDb';

interface MasterDataManagerProps {
  currentUser: User;
  onRefreshParent?: () => void;
  defaultSubTab?: EntityType;
}

export const MasterDataManager: React.FC<MasterDataManagerProps> = ({
  currentUser,
  onRefreshParent,
  defaultSubTab = 'REP',
}) => {
  const [activeEntity, setActiveEntity] = useState<EntityType>(defaultSubTab);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string; type: EntityType } | null>(null);


  // Data States
  const [reps, setReps] = useState<User[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('الكل');
  const [classFilter, setClassFilter] = useState<string>('الكل'); // 'الكل' | 'A' | 'B' | 'C'

  const [clientTypeFilter, setClientTypeFilter] = useState<string>('الكل');

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modals State
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assigningTarget, setAssigningTarget] = useState<{ entityType: EntityType; item: any } | null>(null);
  const [selectedAssignIds, setSelectedAssignIds] = useState<string[]>([]);

  // File Import Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importEntityType, setImportEntityType] = useState<EntityType>(activeEntity);
  const [parsedImportData, setParsedImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getAuthToken = () => {
    const { token } = offlineRoomDb.getSession();
    return token || '';
  };

  // Fetch all entities from backend
  const fetchAllData = async () => {
    setIsLoading(true);
    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [repsRes, regRes, prodRes, cliRes, phrRes] = await Promise.all([
        fetch('/api/users', { headers }),
        fetch('/api/regions', { headers }),
        fetch('/api/products', { headers }),
        fetch('/api/clients', { headers }),
        fetch('/api/pharmacies', { headers }),
      ]);

      if (repsRes.ok) {
        const data = await repsRes.json();
        setReps(data.users || []);
      }
      if (regRes.ok) {
        const data = await regRes.json();
        setRegions(data.regions || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.products || []);
      }
      if (cliRes.ok) {
        const data = await cliRes.json();
        setClients(data.clients || []);
      }
      if (phrRes.ok) {
        const data = await phrRes.json();
        setPharmacies(data.pharmacies || []);
      }
    } catch (err) {
      console.error('[MasterData] Error fetching entities:', err);
      showToast('حدث خطأ أثناء تحميل البيانات من الخادم', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Update import entity type when active entity changes
  useEffect(() => {
    setImportEntityType(activeEntity);
  }, [activeEntity]);

  // Filtered lists
  const filteredReps = useMemo(() => {
    return reps.filter((r) => {
      const matchSearch =
        r.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phone?.includes(searchQuery);
      const matchRegion = regionFilter === 'الكل' || r.assignedRegion === regionFilter;
      return matchSearch && matchRegion;
    });
  }, [reps, searchQuery, regionFilter]);

  const filteredRegions = useMemo(() => {
    return regions.filter((r) => {
      const matchSearch =
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.governorate?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRegion = regionFilter === 'الكل' || r.name === regionFilter || r.governorate === regionFilter;
      const matchSection = true;
      return matchSearch && matchRegion && matchSection;
    });
  }, [regions, searchQuery, regionFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.itemCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.scientificName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [products, searchQuery]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.clientCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.region?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery);
      const matchRegion = regionFilter === 'الكل' || c.region === regionFilter;
      const matchClass = classFilter === 'الكل' || (c.doctorClass || 'B') === classFilter;
      const matchSection = true;
      const matchType = clientTypeFilter === 'الكل' || c.clientType === clientTypeFilter;
      return matchSearch && matchRegion && matchClass && matchSection && matchType;
    });
  }, [clients, searchQuery, regionFilter, classFilter, clientTypeFilter]);

  const filteredPharmacies = useMemo(() => {
    return pharmacies.filter((p) => {
      const matchSearch =
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.pharmacyCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.pharmacistInCharge?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone?.includes(searchQuery);
      const matchRegion = regionFilter === 'الكل' || p.region === regionFilter;
      return matchSearch && matchRegion;
    });
  }, [pharmacies, searchQuery, regionFilter]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    if (activeEntity === 'REP') {
      setEditingItem({
        username: '',
        fullName: '',
        role: 'SALES_REP',
        phone: '',
        assignedRegion: regions[0]?.name || 'القاهرة الكبرى',
        assignedRegionIds: [],
        assignedProductIds: [],
        password: '123',
        isActive: true,
      });
    } else if (activeEntity === 'REGION') {
      setEditingItem({
        code: `REG-SNA-${Date.now().toString().slice(-4)}`,
        name: '',
        section: 'شمالية',
        governorate: 'أمانة العاصمة صنعاء',
        description: '',
        assignedRepIds: [],
        isActive: true,
      });
    } else if (activeEntity === 'PRODUCT') {
      setEditingItem({
        itemCode: `PRD-${Date.now().toString().slice(-4)}`,
        name: '',
        scientificName: '',
        category: 'مضادات حيوية',
        unitPrice: 50,
        packageSize: 'علبة',
        assignedRepIds: [],
        isActive: true,
      });
    } else if (activeEntity === 'CLIENT') {
      const defaultReg = regions[0];
      setEditingItem({
        clientCode: `CLI-SNA-${Date.now().toString().slice(-4)}`,
        name: '',
        clientType: 'DOCTOR',
        doctorClass: 'A',
        regionSection: defaultReg?.section || 'وسطى',
        specialty: '',
        phone: '',
        address: '',
        region: defaultReg?.name || 'المنطقة الوسطى',
        assignedRepId: reps[0]?.id || '',
        latitude: 15.3533,
        longitude: 44.2045,
        allowedVisitRadiusMeters: 100,
        isActive: true,
      });
    } else if (activeEntity === 'PHARMACY') {
      setEditingItem({
        pharmacyCode: `PHR-${Date.now().toString().slice(-4)}`,
        name: '',
        pharmacistInCharge: '',
        licenseNumber: '',
        phone: '',
        address: '',
        region: regions[0]?.name || 'المنطقة الوسطى',
        assignedRepId: reps[0]?.id || '',
        latitude: 15.3533,
        longitude: 44.2045,
        allowedVisitRadiusMeters: 100,
        isActive: true,
      });
    }
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: any) => {
    setEditingItem({
      ...item,
      doctorClass: item.doctorClass || 'B',
      regionSection: item.regionSection || 'وسطى',
      section: item.section || 'وسطى',
      assignedRepIds: item.assignedRepIds ? [...item.assignedRepIds] : [],
      assignedProductIds: item.assignedProductIds ? [...item.assignedProductIds] : [],
      assignedRegionIds: item.assignedRegionIds ? [...item.assignedRegionIds] : [],
    });
    setShowAddEditModal(true);
  };

  // Save Item (Add or Edit)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    try {
      let endpoint = '';
      if (activeEntity === 'REP') endpoint = '/api/users';
      else if (activeEntity === 'REGION') endpoint = '/api/regions';
      else if (activeEntity === 'PRODUCT') endpoint = '/api/products';
      else if (activeEntity === 'CLIENT') endpoint = '/api/clients';
      else if (activeEntity === 'PHARMACY') endpoint = '/api/pharmacies';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(editingItem),
      });

      if (res.ok) {
        showToast('تم حفظ البيانات بنجاح', 'success');
        setShowAddEditModal(false);
        setEditingItem(null);
        await fetchAllData();
        if (onRefreshParent) onRefreshParent();
      } else {
        const err = await res.json();
        showToast(err.error || 'تعذر حفظ البيانات', 'error');
      }
    } catch (err: any) {
      showToast('حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  // Delete Item (Confirmation initiated)
  const handleDeleteItem = (id: string, name: string) => {
    setDeleteConfirmation({ id, name, type: activeEntity });
  };

  // Actual Delete Execution
  const executeDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, name, type } = deleteConfirmation;

    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      let endpoint = '';
      if (type === 'REGION') endpoint = `/api/regions/${id}`;
      else if (type === 'PRODUCT') endpoint = `/api/products/${id}`;
      else if (type === 'CLIENT') endpoint = `/api/clients/${id}`;
      else if (type === 'PHARMACY') endpoint = `/api/pharmacies/${id}`;
      else if (type === 'REP') {
        // Soft delete rep
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ id, isActive: false }),
        });
        if (res.ok) {
          showToast('تم تعطيل حساب المندوب بنجاح', 'success');
          await fetchAllData();
        }
        setDeleteConfirmation(null);
        return;
      }

      const res = await fetch(endpoint, { method: 'DELETE', headers });
      if (res.ok) {
        showToast('تم الحذف بنجاح', 'success');
        await fetchAllData();
        if (onRefreshParent) onRefreshParent();
      } else {
        showToast('تعذر الحذف، يرجى المحاولة مجدداً', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setDeleteConfirmation(null);
    }
  };

  // Open Assign Modal (تعيين)
  const handleOpenAssignModal = (item: any) => {
    setAssigningTarget({ entityType: activeEntity, item });
    if (activeEntity === 'REP') {
      setSelectedAssignIds(item.assignedProductIds ? [...item.assignedProductIds] : []);
    } else if (activeEntity === 'REGION' || activeEntity === 'PRODUCT') {
      setSelectedAssignIds(item.assignedRepIds ? [...item.assignedRepIds] : []);
    } else if (activeEntity === 'CLIENT' || activeEntity === 'PHARMACY') {
      setSelectedAssignIds(item.assignedRepId ? [item.assignedRepId] : []);
    }
    setShowAssignModal(true);
  };

  // Save Assignment
  const handleSaveAssignment = async () => {
    if (!assigningTarget) return;

    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    try {
      let res: Response | null = null;
      if (assigningTarget.entityType === 'REP') {
        res = await fetch(`/api/users/${assigningTarget.item.id}/assignments`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            assignedProductIds: selectedAssignIds,
          }),
        });
      } else if (assigningTarget.entityType === 'REGION') {
        res = await fetch(`/api/regions/${assigningTarget.item.id}/assign`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            assignedRepIds: selectedAssignIds,
          }),
        });
      } else if (assigningTarget.entityType === 'PRODUCT') {
        res = await fetch(`/api/products/${assigningTarget.item.id}/assign`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            assignedRepIds: selectedAssignIds,
          }),
        });
      } else if (assigningTarget.entityType === 'CLIENT') {
        res = await fetch(`/api/clients/${assigningTarget.item.id}/assign`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            repId: selectedAssignIds[0] || '',
          }),
        });
      } else if (assigningTarget.entityType === 'PHARMACY') {
        res = await fetch(`/api/pharmacies/${assigningTarget.item.id}/assign`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            repId: selectedAssignIds[0] || '',
          }),
        });
      }

      if (!res || !res.ok) {
        const errorData = await res?.json().catch(() => ({}));
        showToast(errorData?.error || 'حدث خطأ أثناء حفظ التعيين في الخادم', 'error');
        return;
      }

      // Optimistic state update immediately so UI never loses the assignment
      if (assigningTarget.entityType === 'PRODUCT') {
        setProducts((prev) =>
          prev.map((p) => (p.id === assigningTarget.item.id ? { ...p, assignedRepIds: [...selectedAssignIds] } : p))
        );
      } else if (assigningTarget.entityType === 'REGION') {
        setRegions((prev) =>
          prev.map((r) => (r.id === assigningTarget.item.id ? { ...r, assignedRepIds: [...selectedAssignIds] } : r))
        );
      } else if (assigningTarget.entityType === 'REP') {
        setReps((prev) =>
          prev.map((r) => (r.id === assigningTarget.item.id ? { ...r, assignedProductIds: [...selectedAssignIds] } : r))
        );
      } else if (assigningTarget.entityType === 'CLIENT') {
        setClients((prev) =>
          prev.map((c) => (c.id === assigningTarget.item.id ? { ...c, assignedRepId: selectedAssignIds[0] || '' } : c))
        );
      } else if (assigningTarget.entityType === 'PHARMACY') {
        setPharmacies((prev) =>
          prev.map((p) => (p.id === assigningTarget.item.id ? { ...p, assignedRepId: selectedAssignIds[0] || '' } : p))
        );
      }

      showToast('تم حفظ وتحديث التعيينات بنجاح!', 'success');
      setShowAssignModal(false);
      setAssigningTarget(null);
      await fetchAllData();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      showToast('حدث خطأ أثناء حفظ التعيين', 'error');
    }
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('[DEBUG] File uploaded:', file?.name, file?.type, file?.size, 'Type:', importEntityType);
    if (!file) return;

    setIsProcessingImport(true);
    setImportErrors([]);
    setParsedImportData([]);

    const result = await parseUploadedFile(file, importEntityType);
    setIsProcessingImport(false);

    if (result.records.length > 0) {
      setParsedImportData(result.records);
      setImportErrors(result.errors);
      if (result.errors.length > 0) {
        showToast(`تمت قراءة الملف مع وجود ${result.errors.length} تنبيه`, 'info');
      } else {
        showToast(`تمت قراءة ${result.records.length} سجل بنجاح. راجع الجدول واضغط اعتماد وحفظ`, 'success');
      }
    } else {
      setImportErrors(result.errors);
      showToast('تعذر استخراج بيانات صالحة من الملف', 'error');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Commit Bulk Import
  const handleCommitBulkImport = async () => {
    if (parsedImportData.length === 0) return;

    setIsProcessingImport(true);
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    try {
      let endpoint = '';
      let payloadKey = '';

      if (importEntityType === 'REP') {
        endpoint = '/api/users/bulk';
        payloadKey = 'users';
      } else if (importEntityType === 'REGION') {
        endpoint = '/api/regions/bulk';
        payloadKey = 'regions';
      } else if (importEntityType === 'PRODUCT') {
        endpoint = '/api/products/bulk';
        payloadKey = 'products';
      } else if (importEntityType === 'CLIENT') {
        endpoint = '/api/clients/bulk';
        payloadKey = 'clients';
      } else if (importEntityType === 'PHARMACY') {
        endpoint = '/api/pharmacies/bulk';
        payloadKey = 'pharmacies';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ [payloadKey]: parsedImportData }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'تم إدراج وحفظ السجلات بنجاح!', 'success');
        setShowImportModal(false);
        setParsedImportData([]);
        setImportErrors([]);
        await fetchAllData();
        if (onRefreshParent) onRefreshParent();
      } else {
        const err = await res.json();
        showToast(err.error || 'فشل استيراد الملف', 'error');
      }
    } catch (err) {
      showToast('حدث خطأ أثناء إرسال البيانات للخادم', 'error');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Export current list to Excel
  const handleExportCurrent = () => {
    const meta = ENTITY_METAS[activeEntity];
    let exportData: any[] = [];

    if (activeEntity === 'REP') {
      exportData = filteredReps.map((r) => ({
        'اسم المستخدم': r.username,
        'الاسم الكامل للمندوب': r.fullName,
        'الدور الوظيفي': r.role,
        'رقم الهاتف': r.phone,
        'المنطقة الأساسية': r.assignedRegion,
        'الحالة': r.isActive ? 'نشط' : 'معطل',
      }));
    } else if (activeEntity === 'REGION') {
      exportData = filteredRegions.map((r) => ({
        'كود المنطقة': r.code,
        'اسم المنطقة': r.name,
        'قسم المنطقة': r.section || 'وسطى',
        'المحافظة': r.governorate,
        'الوصف أو الملاحظات': r.description || '',
        'عدد المناديب المكلفين': r.assignedRepIds?.length || 0,
      }));
    } else if (activeEntity === 'PRODUCT') {
      exportData = filteredProducts.map((p) => ({
        'كود الصنف': p.itemCode,
        'الاسم التجاري': p.name,
        'الاسم العلمي': p.scientificName || '',
        'التصنيف الدوائي': p.category,
        'سعر الوحدة (ر.ي)': p.unitPrice,
        'العبوة / الشكل الدوائي': p.packageSize || '',
        'عدد المناديب المكلفين': p.assignedRepIds?.length || 0,
      }));
    } else if (activeEntity === 'CLIENT') {
      exportData = filteredClients.map((c) => {
        const assignedRep = reps.find((r) => r.id === c.assignedRepId);
        return {
          'كود العميل': c.clientCode,
          'اسم العميل / الطبيب / المركز': c.name,
          'نوع العميل': c.clientType,
          'الكلاس': c.doctorClass || 'B',
          'قسم المنطقة': c.regionSection || 'وسطى',
          'التخصص الطبي': c.specialty || '',
          'رقم الهاتف': c.phone,
          'العنوان التفصيلي': c.address,
          'المنطقة': c.region,
          'المندوب المسند له': assignedRep ? assignedRep.fullName : 'غير معين',
          'خط العرض (Latitude)': c.latitude,
          'خط الطول (Longitude)': c.longitude,
          'نطاق الزيارة (متر)': c.allowedVisitRadiusMeters,
        };
      });
    } else if (activeEntity === 'PHARMACY') {
      exportData = filteredPharmacies.map((p) => {
        const assignedRep = reps.find((r) => r.id === p.assignedRepId);
        return {
          'كود الصيدلية': p.pharmacyCode,
          'اسم الصيدلية': p.name,
          'اسم الصيدلي المسؤول': p.pharmacistInCharge,
          'رقم الترخيص': p.licenseNumber || '',
          'رقم الهاتف': p.phone,
          'العنوان': p.address,
          'المنطقة': p.region,
          'المندوب المسند له': assignedRep ? assignedRep.fullName : 'غير معين',
          'خط العرض (Latitude)': p.latitude,
          'خط الطول (Longitude)': p.longitude,
          'نطاق الزيارة (متر)': p.allowedVisitRadiusMeters,
        };
      });
    }

    exportDataToExcel(`سجل_${meta.titleAr}`, exportData);
    showToast(`تم تصدير سجل ${meta.titleAr} بنجاح بصيغة Excel`, 'success');
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
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
          ) : toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          ) : (
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deleteConfirmation}
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirmation(null)}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من رغبتك في حذف: "${deleteConfirmation?.name}"؟`}
      />

      {/* Sub-Navigation for the 5 Main Entities */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveEntity('REP')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeEntity === 'REP'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>المندوبون ({reps.length})</span>
          </button>

          <button
            onClick={() => setActiveEntity('REGION')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeEntity === 'REGION'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>المناطق ({regions.length})</span>
          </button>

          <button
            onClick={() => setActiveEntity('PRODUCT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeEntity === 'PRODUCT'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>الأصناف ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveEntity('CLIENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeEntity === 'CLIENT'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>العملاء والأطباء ({clients.length})</span>
          </button>

          <button
            onClick={() => setActiveEntity('PHARMACY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeEntity === 'PHARMACY'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Pill className="w-4 h-4" />
            <span>الصيدليات ({pharmacies.length})</span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow"
            title="إدراج واستيراد ملف Excel أو CSV"
          >
            <UploadCloud className="w-4 h-4" />
            <span>إدراج واستيراد ملف</span>
          </button>

          <button
            onClick={handleExportCurrent}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow"
            title="تصدير السجل الحالي إلى ملف Excel"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>
              إضافة{' '}
              {activeEntity === 'REP'
                ? 'مندوب جديد'
                : activeEntity === 'REGION'
                ? 'منطقة جديدة'
                : activeEntity === 'PRODUCT'
                ? 'صنف جديد'
                : activeEntity === 'CLIENT'
                ? 'عميل / طبيب'
                : 'صيدلية جديدة'}
            </span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-500" />
            <input
              type="text"
              placeholder={`بحث سريع في ${ENTITY_METAS[activeEntity].titleAr}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all font-mono"
            />
          </div>



          {/* Filters for CLIENT (Doctors & Hospitals) */}
          {activeEntity === 'CLIENT' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Doctor Class Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400 font-bold text-[11px] whitespace-nowrap">كلاس الطبيب:</span>
                <div className="flex items-center gap-1">
                  {(['الكل', 'A', 'B', 'C'] as const).map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setClassFilter(cls)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        classFilter === cls
                          ? cls === 'A'
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40 font-extrabold'
                            : cls === 'B'
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40 font-extrabold'
                            : cls === 'C'
                            ? 'bg-indigo-500 text-white shadow-md shadow-indigo-950/40 font-extrabold'
                            : 'bg-slate-700 text-slate-100'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      {cls === 'الكل' ? 'الكل' : `كلاس ${cls}`}
                    </button>
                  ))}
                </div>
              </div>



              {/* Specific Region Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-sans"
                >
                  <option value="الكل">كل المناطق</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.section || r.governorate})
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Type Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={clientTypeFilter}
                  onChange={(e) => setClientTypeFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-sans"
                >
                  <option value="الكل">كل أنواع المنشآت</option>
                  <option value="DOCTOR">أطباء وعيادات خاصة (Doctor)</option>
                  <option value="HOSPITAL">مستشفيات كبرى (Hospital)</option>
                  <option value="HEALTH_CENTER">مراكز طبية تخصصية (Center)</option>
                  <option value="CLINIC">مجمعات عيادات (Clinic)</option>
                </select>
              </div>
            </div>
          )}

          {/* Filters for REP and PHARMACY */}
          {(activeEntity === 'REP' || activeEntity === 'PHARMACY') && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="الكل">كل المناطق</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name} ({r.section || r.governorate})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          onClick={fetchAllData}
          disabled={isLoading}
          className="p-2.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
          title="تحديث البيانات"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* TABULAR DISPLAY PER ENTITY */}

      {/* 1. المناديب (Sales Reps) */}
      {activeEntity === 'REP' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-3.5">الاسم الكامل للمندوب</th>
                  <th className="p-3.5">اسم المستخدم</th>
                  <th className="p-3.5">الدور الوظيفي</th>
                  <th className="p-3.5">رقم الهاتف</th>
                  <th className="p-3.5">المنطقة الأساسية</th>
                  <th className="p-3.5">الأصناف المكلف بها</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">إجراءات والتعيين</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {filteredReps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                      لا يوجد مناديب مسجلين أو مطابقين لمعايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredReps.map((rep) => {
                    const assignedProdsCount = rep.assignedProductIds?.length || 0;
                    return (
                      <tr key={rep.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3.5 font-sans font-bold text-slate-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span>{rep.fullName}</span>
                        </td>
                        <td className="p-3.5 text-cyan-400">{rep.username}</td>
                        <td className="p-3.5 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              rep.role === 'SALES_REP'
                                ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                                : 'bg-purple-950/80 text-purple-400 border border-purple-800/60'
                            }`}
                          >
                            {rep.role === 'SALES_REP' ? 'مندوب مبيعات' : 'مشرف مبيعات'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400">{rep.phone || '—'}</td>
                        <td className="p-3.5 font-sans">{rep.assignedRegion || 'الكل'}</td>
                        <td className="p-3.5 font-sans">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                            {assignedProdsCount > 0 ? `${assignedProdsCount} أصناف مسندة` : 'كل الأصناف'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              rep.isActive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            }`}
                          >
                            {rep.isActive ? 'نشط' : 'معطل'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenAssignModal(rep)}
                              className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800/80 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 transition-all"
                              title="تعيين الأصناف والمناطق للمندوب"
                            >
                              <LinkIcon className="w-3 h-3" />
                              <span>تعيين</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(rep)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
                              title="تعديل بيانات المندوب"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(rep.id, rep.fullName)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
                              title="تعطيل المندوب"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* 2. المناطق (Regions) */}
      {activeEntity === 'REGION' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-3.5">كود المنطقة</th>
                  <th className="p-3.5">اسم المنطقة / المربع</th>
                  <th className="p-3.5">القسم الجغرافي</th>
                  <th className="p-3.5">المحافظة</th>
                  <th className="p-3.5">الملاحظات والوصف</th>
                  <th className="p-3.5">المناديب المكلفين</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">إجراءات والتعيين</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {filteredRegions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                      لا توجد مناطق مسجلة
                    </td>
                  </tr>
                ) : (
                  filteredRegions.map((region) => {
                    const assignedRepsNames = (region.assignedRepIds || [])
                      .map((id) => reps.find((r) => r.id === id)?.fullName)
                      .filter(Boolean);

                    return (
                      <tr key={region.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3.5 font-bold text-cyan-400">{region.code}</td>
                        <td className="p-3.5 font-sans font-bold text-slate-100">{region.name}</td>
                        <td className="p-3.5 font-sans">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              region.section === 'شمالية'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : region.section === 'جنوبية'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            }`}
                          >
                            {region.section || 'وسطى'}
                          </span>
                        </td>
                        <td className="p-3.5 font-sans">{region.governorate}</td>
                        <td className="p-3.5 font-sans text-slate-400 truncate max-w-xs">{region.description || '—'}</td>
                        <td className="p-3.5 font-sans">
                          {assignedRepsNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {assignedRepsNames.map((name, i) => (
                                <span key={i} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">غير مسند لمندوب</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              region.isActive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            }`}
                          >
                            {region.isActive ? 'نشط' : 'معطل'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenAssignModal(region)}
                              className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800/80 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 transition-all"
                              title="تعيين مناديب لهذه المنطقة"
                            >
                              <LinkIcon className="w-3 h-3" />
                              <span>تعيين مناديب</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(region)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(region.id, region.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* 3. الأصناف (Products / Items) */}
      {activeEntity === 'PRODUCT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-3.5">كود الصنف</th>
                  <th className="p-3.5">الاسم التجاري</th>
                  <th className="p-3.5">الاسم العلمي</th>
                  <th className="p-3.5">التصنيف الدوائي</th>
                  <th className="p-3.5">سعر الوحدة</th>
                  <th className="p-3.5">العبوة / الشكل</th>
                  <th className="p-3.5">المناديب المكلفين</th>
                  <th className="p-3.5 text-center">إجراءات والتعيين</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                      لا توجد أصناف مسجلة
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const assignedRepsCount = prod.assignedRepIds?.length || 0;
                    const assignedRepNames = reps
                      .filter((r) => (prod.assignedRepIds || []).includes(r.id))
                      .map((r) => r.fullName)
                      .join('، ');
                    return (
                      <tr key={prod.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3.5 font-bold text-cyan-400">{prod.itemCode}</td>
                        <td className="p-3.5 font-sans font-bold text-slate-100">{prod.name}</td>
                        <td className="p-3.5 text-slate-400 font-sans">{prod.scientificName || '—'}</td>
                        <td className="p-3.5 font-sans">
                          <span className="bg-slate-800/90 text-cyan-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-700">
                            {prod.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-emerald-400 font-bold font-mono">{prod.unitPrice} ج.م</td>
                        <td className="p-3.5 font-sans text-slate-400">{prod.packageSize || '—'}</td>
                        <td className="p-3.5 font-sans">
                          {assignedRepsCount > 0 ? (
                            <span
                              className="bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-help"
                              title={assignedRepNames || `${assignedRepsCount} مناديب`}
                            >
                              <Check className="w-3 h-3 text-cyan-400 stroke-[3]" />
                              <span>{assignedRepsCount} مناديب مكلفين</span>
                            </span>
                          ) : (
                            <span className="bg-slate-800/70 text-slate-400 px-2 py-0.5 rounded text-[11px]">
                              متاح للجميع
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenAssignModal(prod)}
                              className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800/80 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 transition-all"
                              title="تعيين مناديب مبيعات لهذا الصنف"
                            >
                              <LinkIcon className="w-3 h-3" />
                              <span>تعيين مناديب</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(prod)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(prod.id, prod.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* 4. العملاء (Clients / Doctors & Hospitals) */}
      {activeEntity === 'CLIENT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-3.5">كود العميل</th>
                  <th className="p-3.5">اسم العميل / الطبيب</th>
                  <th className="p-3.5 text-center">الكلاس</th>
                  <th className="p-3.5">النوع والتخصص</th>
                  <th className="p-3.5">الهاتف</th>
                  <th className="p-3.5">المنطقة والفرع</th>
                  <th className="p-3.5">المندوب المسؤول</th>
                  <th className="p-3.5">نطاق الزيارة</th>
                  <th className="p-3.5 text-center">إجراءات والتعيين</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 font-sans">
                      لا يوجد عملاء أو أطباء يطابقون الفلاتر المحددة
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const assignedRep = reps.find((r) => r.id === client.assignedRepId);
                    return (
                      <tr key={client.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3.5 font-bold text-cyan-400">{client.clientCode}</td>
                        <td className="p-3.5 font-sans font-bold text-slate-100">{client.name}</td>
                        <td className="p-3.5 text-center">
                          {client.doctorClass === 'A' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-950/30">
                              <span className="text-amber-400 text-xs">★</span>
                              <span>كلاس A</span>
                            </span>
                          ) : client.doctorClass === 'B' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950/30">
                              <span>كلاس B</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-950/30">
                              <span>كلاس C</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-sans">
                          <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[10px]">
                            {client.specialty || client.clientType}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400">{client.phone}</td>
                        <td className="p-3.5 font-sans max-w-xs truncate">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-cyan-400 font-bold">{client.region}</span>
                          </div>
                          <div className="text-slate-400 text-[11px] truncate">{client.address}</div>
                        </td>
                        <td className="p-3.5 font-sans">
                          {assignedRep ? (
                            <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded text-[10px] font-bold">
                              {assignedRep.fullName}
                            </span>
                          ) : (
                            <span className="text-amber-400 text-[11px] font-semibold">غير معين</span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono">{client.allowedVisitRadiusMeters}م</td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenAssignModal(client)}
                              className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800/80 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 transition-all"
                              title="تعيين مندوب مسؤول لهذا العميل"
                            >
                              <LinkIcon className="w-3 h-3" />
                              <span>تعيين مندوب</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(client)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(client.id, client.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* 5. الصيدليات (Pharmacies) */}
      {activeEntity === 'PHARMACY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-3.5">كود الصيدلية</th>
                  <th className="p-3.5">اسم الصيدلية</th>
                  <th className="p-3.5">الصيدلي المسؤول</th>
                  <th className="p-3.5">رقم الهاتف</th>
                  <th className="p-3.5">المنطقة والعنوان</th>
                  <th className="p-3.5">المندوب المسؤول</th>
                  <th className="p-3.5">نطاق الزيارة</th>
                  <th className="p-3.5 text-center">إجراءات والتعيين</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {filteredPharmacies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                      لا توجد صيدليات مسجلة
                    </td>
                  </tr>
                ) : (
                  filteredPharmacies.map((pharmacy) => {
                    const assignedRep = reps.find((r) => r.id === pharmacy.assignedRepId);
                    return (
                      <tr key={pharmacy.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3.5 font-bold text-cyan-400">{pharmacy.pharmacyCode}</td>
                        <td className="p-3.5 font-sans font-bold text-slate-100 flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{pharmacy.name}</span>
                        </td>
                        <td className="p-3.5 font-sans text-slate-300">{pharmacy.pharmacistInCharge}</td>
                        <td className="p-3.5 text-slate-400">{pharmacy.phone}</td>
                        <td className="p-3.5 font-sans max-w-xs truncate">
                          <span className="text-cyan-400 font-bold">{pharmacy.region}:</span> {pharmacy.address}
                        </td>
                        <td className="p-3.5 font-sans">
                          {assignedRep ? (
                            <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded text-[10px] font-bold">
                              {assignedRep.fullName}
                            </span>
                          ) : (
                            <span className="text-amber-400 text-[11px] font-semibold">غير معين</span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono">{pharmacy.allowedVisitRadiusMeters}م</td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenAssignModal(pharmacy)}
                              className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800/80 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 transition-all"
                              title="تعيين مندوب مبيعات للصيدلية"
                            >
                              <LinkIcon className="w-3 h-3" />
                              <span>تعيين مندوب</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(pharmacy)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(pharmacy.id, pharmacy.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* ============================================================ */}
      {/* ADD / EDIT MODAL                                             */}
      {/* ============================================================ */}
      {showAddEditModal && editingItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                <span>
                  {editingItem.id ? 'تعديل' : 'إضافة جديد'}: {ENTITY_METAS[activeEntity].titleAr}
                </span>
              </h3>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs font-sans">
              {/* REP Form Fields */}
              {activeEntity === 'REP' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">اسم المستخدم (للدخول):</label>
                      <input
                        type="text"
                        required
                        value={editingItem.username}
                        onChange={(e) => setEditingItem({ ...editingItem, username: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">الاسم الكامل للمندوب:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.fullName}
                        onChange={(e) => setEditingItem({ ...editingItem, fullName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">الدور الوظيفي:</label>
                      <select
                        value={editingItem.role}
                        onChange={(e) => setEditingItem({ ...editingItem, role: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="SALES_REP">مندوب مبيعات (Sales Rep)</option>
                        <option value="SALES_MANAGER">مشرف مبيعات (Sales Manager)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">رقم الهاتف:</label>
                      <input
                        type="text"
                        value={editingItem.phone}
                        onChange={(e) => setEditingItem({ ...editingItem, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">المنطقة الأساسية المسندة:</label>
                    <select
                      value={editingItem.assignedRegion}
                      onChange={(e) => setEditingItem({ ...editingItem, assignedRegion: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    >
                      {regions.map((reg) => (
                        <option key={reg.id} value={reg.name}>
                          {reg.name} ({reg.governorate})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!editingItem.id && (
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">كلمة المرور الأولية:</label>
                      <input
                        type="password"
                        value={editingItem.password || '123456'}
                        onChange={(e) => setEditingItem({ ...editingItem, password: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  )}
                </>
              )}

              {/* REGION Form Fields */}
              {activeEntity === 'REGION' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">كود المنطقة:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.code}
                        onChange={(e) => setEditingItem({ ...editingItem, code: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">قسم المنطقة (3 أقسام):</label>
                      <select
                        value={editingItem.section || 'وسطى'}
                        onChange={(e) => setEditingItem({ ...editingItem, section: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none font-bold text-cyan-300"
                      >
                        <option value="شمالية">القسم الشمالي (شمالية)</option>
                        <option value="وسطى">القسم الأوسط (وسطى)</option>
                        <option value="جنوبية">القسم الجنوبي (جنوبية)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">اسم المنطقة / المربع الجغرافي:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">المحافظة:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.governorate}
                        onChange={(e) => setEditingItem({ ...editingItem, governorate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">الوصف أو الشوارع المغطاة:</label>
                    <textarea
                      rows={2}
                      value={editingItem.description || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* PRODUCT Form Fields */}
              {activeEntity === 'PRODUCT' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">كود الصنف:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.itemCode}
                        onChange={(e) => setEditingItem({ ...editingItem, itemCode: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">التصنيف الدوائي:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.category}
                        onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">الاسم التجاري للمنتج:</label>
                    <input
                      type="text"
                      required
                      value={editingItem.name}
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">الاسم العلمي والمادة الفعالة:</label>
                    <input
                      type="text"
                      value={editingItem.scientificName || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, scientificName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">سعر الوحدة (ج.م):</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={editingItem.unitPrice}
                        onChange={(e) => setEditingItem({ ...editingItem, unitPrice: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">حجم العبوة / الشكل:</label>
                      <input
                        type="text"
                        value={editingItem.packageSize || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, packageSize: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">المناديب المكلفين بتسويق هذا الصنف:</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1">
                      {reps.length === 0 ? (
                        <div className="text-slate-500 text-xs py-2 text-center">لا يوجد مناديب مسجلين</div>
                      ) : (
                        reps.map((rep) => {
                          const isAssigned = (editingItem.assignedRepIds || []).includes(rep.id);
                          return (
                            <label
                              key={rep.id}
                              className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                                isAssigned
                                  ? 'bg-cyan-950/60 border-cyan-600/80 text-cyan-200'
                                  : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={(e) => {
                                    const current = editingItem.assignedRepIds || [];
                                    const updated = e.target.checked
                                      ? [...current, rep.id]
                                      : current.filter((id: string) => id !== rep.id);
                                    setEditingItem({ ...editingItem, assignedRepIds: updated });
                                  }}
                                  className="w-4 h-4 text-cyan-500 rounded border-slate-700 bg-slate-950 focus:ring-0"
                                />
                                <span className="font-bold">{rep.fullName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">({rep.assignedRegion})</span>
                              </div>
                              {isAssigned && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                            </label>
                          );
                        })
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {(editingItem.assignedRepIds?.length || 0) > 0
                        ? `تم تحديد ${editingItem.assignedRepIds.length} مندوب لهذا الصنف`
                        : 'إذا تركت فارغة، سيكون الصنف متاحاً لجميع المناديب'}
                    </div>
                  </div>
                </>
              )}

              {/* CLIENT Form Fields */}
              {activeEntity === 'CLIENT' && (
                <>
                  {/* Doctor Class Selector */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-300 font-bold text-xs">
                        كلاس وفئة الطبيب (Doctor Class):
                      </label>
                      <span className="text-[11px] text-cyan-400 font-bold">
                        الفئة الحالية: Class {editingItem.doctorClass || 'B'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, doctorClass: 'A' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          (editingItem.doctorClass || 'B') === 'A'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-sm font-black flex items-center gap-1 text-amber-400">
                          <span>★</span> كلاس A
                        </span>
                        <span className="text-[10px] text-amber-300/80">أولوية قصوى / صفوة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, doctorClass: 'B' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          (editingItem.doctorClass || 'B') === 'B'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-sm font-black text-cyan-300">كلاس B</span>
                        <span className="text-[10px] text-cyan-300/80">أولوية متوسطة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, doctorClass: 'C' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          editingItem.doctorClass === 'C'
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-sm font-black text-indigo-300">كلاس C</span>
                        <span className="text-[10px] text-indigo-300/80">فئة اعتيادية</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">كود العميل:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.clientCode}
                        onChange={(e) => setEditingItem({ ...editingItem, clientCode: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">نوع العميل:</label>
                      <select
                        value={editingItem.clientType}
                        onChange={(e) => setEditingItem({ ...editingItem, clientType: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="DOCTOR">طبيب / عيادة خاصة (Doctor)</option>
                        <option value="CLINIC">مجمع عيادات (Polyclinic)</option>
                        <option value="HOSPITAL">مستشفى (Hospital)</option>
                        <option value="HEALTH_CENTER">مركز طبي تخصصي (Medical Center)</option>
                        <option value="DISTRIBUTOR">موزع معتمد (Distributor)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">اسم العميل / الطبيب / المركز:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">التخصص الطبي:</label>
                      <select
                        value={editingItem.specialty || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, specialty: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="">اختر التخصص الطبي...</option>
                        <option value="Card">Card</option>
                        <option value="Derm">Derm</option>
                        <option value="Emer">Emer</option>
                        <option value="Endo">Endo</option>
                        <option value="ENT">ENT</option>
                        <option value="G.P">G.P</option>
                        <option value="Gyno">Gyno</option>
                        <option value="Hema">Hema</option>
                        <option value="Hepa">Hepa</option>
                        <option value="I.M">I.M</option>
                        <option value="Immu">Immu</option>
                        <option value="Nephro">Nephro</option>
                        <option value="Neur">Neur</option>
                        <option value="Onco">Onco</option>
                        <option value="Ortho">Ortho</option>
                        <option value="PED">PED</option>
                        <option value="Psych">Psych</option>
                        <option value="Pulmo">Pulmo</option>
                        <option value="Rheum">Rheum</option>
                        <option value="Surg">Surg</option>
                        <option value="Uro">Uro</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">رقم الهاتف:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.phone}
                        onChange={(e) => setEditingItem({ ...editingItem, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">البريد الإلكتروني:</label>
                      <input
                        type="email"
                        value={editingItem.email || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">المنطقة الجغرافية:</label>
                      <select
                        value={editingItem.region}
                        onChange={(e) => {
                          const regName = e.target.value;
                          const found = regions.find((r) => r.name === regName);
                          setEditingItem({
                            ...editingItem,
                            region: regName,
                            regionSection: found?.section || editingItem.regionSection || 'وسطى',
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      >
                        {regions.map((reg) => (
                          <option key={reg.id} value={reg.name}>
                            {reg.name} ({reg.section || reg.governorate})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">قسم المنطقة الجغرافي:</label>
                      <select
                        value={editingItem.regionSection || 'وسطى'}
                        onChange={(e) => setEditingItem({ ...editingItem, regionSection: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none font-bold text-cyan-300"
                      >
                        <option value="شمالية">القسم الشمالي (شمالية)</option>
                        <option value="وسطى">القسم الأوسط (وسطى)</option>
                        <option value="جنوبية">القسم الجنوبي (جنوبية)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">المندوب المسند له:</label>
                    <select
                      value={editingItem.assignedRepId || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, assignedRepId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">(غير معين - مفتوح)</option>
                      {reps.map((rep) => (
                        <option key={rep.id} value={rep.id}>
                          {rep.fullName} ({rep.assignedRegion})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">العنوان التفصيلي:</label>
                    <input
                      type="text"
                      required
                      value={editingItem.address}
                      onChange={(e) => setEditingItem({ ...editingItem, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Latitude:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editingItem.latitude}
                        onChange={(e) => setEditingItem({ ...editingItem, latitude: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-left focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Longitude:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editingItem.longitude}
                        onChange={(e) => setEditingItem({ ...editingItem, longitude: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-left focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">نطاق الزيارة (متر):</label>
                      <input
                        type="number"
                        value={editingItem.allowedVisitRadiusMeters}
                        onChange={(e) => setEditingItem({ ...editingItem, allowedVisitRadiusMeters: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* PHARMACY Form Fields */}
              {activeEntity === 'PHARMACY' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">كود الصيدلية:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.pharmacyCode}
                        onChange={(e) => setEditingItem({ ...editingItem, pharmacyCode: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">رقم ترخيص الصيدلية:</label>
                      <input
                        type="text"
                        value={editingItem.licenseNumber || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, licenseNumber: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">اسم الصيدلية:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">اسم الصيدلي المسؤول / المدير:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.pharmacistInCharge}
                        onChange={(e) => setEditingItem({ ...editingItem, pharmacistInCharge: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">رقم الهاتف:</label>
                      <input
                        type="text"
                        required
                        value={editingItem.phone}
                        onChange={(e) => setEditingItem({ ...editingItem, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">البريد الإلكتروني:</label>
                      <input
                        type="email"
                        value={editingItem.email || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">المنطقة الجغرافية:</label>
                      <select
                        value={editingItem.region}
                        onChange={(e) => setEditingItem({ ...editingItem, region: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      >
                        {regions.map((reg) => (
                          <option key={reg.id} value={reg.name}>
                            {reg.name} ({reg.governorate})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">المندوب المسند له:</label>
                    <select
                      value={editingItem.assignedRepId || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, assignedRepId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">(غير معين - مفتوح)</option>
                      {reps.map((rep) => (
                        <option key={rep.id} value={rep.id}>
                          {rep.fullName} ({rep.assignedRegion})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">العنوان بالتفصيل:</label>
                    <input
                      type="text"
                      required
                      value={editingItem.address}
                      onChange={(e) => setEditingItem({ ...editingItem, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Latitude:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editingItem.latitude}
                        onChange={(e) => setEditingItem({ ...editingItem, latitude: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-left focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Longitude:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editingItem.longitude}
                        onChange={(e) => setEditingItem({ ...editingItem, longitude: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-left focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">نطاق الزيارة (متر):</label>
                      <input
                        type="number"
                        value={editingItem.allowedVisitRadiusMeters}
                        onChange={(e) => setEditingItem({ ...editingItem, allowedVisitRadiusMeters: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ التغييرات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ASSIGNMENT MODAL (تعيين)                                      */}
      {/* ============================================================ */}
      {showAssignModal && assigningTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">
                    تعيين:{' '}
                    {assigningTarget.entityType === 'REP'
                      ? `أصناف المندوب (${assigningTarget.item.fullName})`
                      : assigningTarget.entityType === 'REGION'
                      ? `مناديب المنطقة (${assigningTarget.item.name})`
                      : assigningTarget.entityType === 'PRODUCT'
                      ? `مناديب الصنف (${assigningTarget.item.name})`
                      : `مندوب ${assigningTarget.item.name}`}
                  </h3>
                  <p className="text-[11px] text-slate-400">حدد العناصر واضغط حفظ لتحديث التعيين فوراً</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selection list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {/* If assigning products to Rep */}
              {assigningTarget.entityType === 'REP' && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 mb-2">اختر الأصناف التي سيتولى هذا المندوب ترويجها وبيعها:</div>
                  {products.map((p) => {
                    const isSelected = selectedAssignIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isSelected) setSelectedAssignIds(selectedAssignIds.filter((id) => id !== p.id));
                          else setSelectedAssignIds([...selectedAssignIds, p.id]);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500 text-cyan-100'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{p.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {p.itemCode} | {p.category} | {p.unitPrice} ج.م
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* If assigning reps to Region or Product */}
              {(assigningTarget.entityType === 'REGION' || assigningTarget.entityType === 'PRODUCT') && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 mb-2">اختر المناديب المكلفين:</div>
                  {reps.map((r) => {
                    const isSelected = selectedAssignIds.includes(r.id);
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          if (isSelected) setSelectedAssignIds(selectedAssignIds.filter((id) => id !== r.id));
                          else setSelectedAssignIds([...selectedAssignIds, r.id]);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500 text-cyan-100'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{r.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {r.username} | {r.phone} | المنطقة: {r.assignedRegion}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* If assigning single rep to Client or Pharmacy */}
              {(assigningTarget.entityType === 'CLIENT' || assigningTarget.entityType === 'PHARMACY') && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 mb-2">اختر المندوب المسؤول الوحيد عن هذه النقطة:</div>
                  <div
                    onClick={() => setSelectedAssignIds([])}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedAssignIds.length === 0
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-100'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div>
                      <div className="font-bold">غير معين (مفتوح لأي مندوب)</div>
                      <div className="text-[11px] text-slate-500">يمكن لأي مندوب في نفس المنطقة تسجيل الزيارة</div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        selectedAssignIds.length === 0 ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-700'
                      }`}
                    >
                      {selectedAssignIds.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>

                  {reps.map((r) => {
                    const isSelected = selectedAssignIds[0] === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedAssignIds([r.id])}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500 text-cyan-100'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{r.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {r.username} | المنطقة: {r.assignedRegion} | {r.phone}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                            isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={handleSaveAssignment}
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعيين المركزي</span>
              </button>
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* BULK FILE IMPORTER MODAL (إدراج واستيراد ملف)                 */}
      {/* ============================================================ */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full shadow-2xl max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">
                    إدراج واستيراد ملف (Excel / CSV / JSON)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    استيراد كميات كبيرة من البيانات بملف واحد مع فحص وتحديث السجلات القائمة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Select Entity Type */}
            <div className="space-y-2">
              <label className="block text-slate-300 text-xs font-semibold">1. اختر نوع البيانات المراد إدراجها:</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {(['REP', 'REGION', 'PRODUCT', 'CLIENT', 'PHARMACY'] as EntityType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setImportEntityType(t);
                      setParsedImportData([]);
                      setImportErrors([]);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                      importEntityType === t
                        ? 'bg-cyan-600 border-cyan-500 text-white shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {ENTITY_METAS[t].titleAr}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Download Ready Template */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">
                  تنزيل نموذج ملف جاهز لتعبئته لـ <strong>{ENTITY_METAS[importEntityType].titleAr}</strong>:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadTemplateExcel(importEntityType)}
                  className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg font-bold flex items-center gap-1.5 transition-all text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>نموذج Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadTemplateCsv(importEntityType)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-bold flex items-center gap-1.5 transition-all text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>نموذج CSV (.csv)</span>
                </button>
              </div>
            </div>

            {/* Step 3: File Input Drag & Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950/50 rounded-2xl p-6 text-center cursor-pointer transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .json, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <UploadCloud className="w-10 h-10 text-slate-500 group-hover:text-cyan-400 mx-auto mb-2 transition-colors" />
              <div className="text-slate-200 font-bold text-xs mb-1">
                اضغط هنا لاختيار ملف من جهازك أو اسحب الملف وأفلته
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                يدعم ملفات: Excel (.xlsx, .xls), CSV (.csv), JSON (.json)
              </div>
            </div>

            {/* Errors alert if any */}
            {importErrors.length > 0 && (
              <div className="bg-rose-950/60 border border-rose-800/80 p-3 rounded-xl text-rose-200 text-xs max-h-24 overflow-y-auto space-y-1">
                <div className="font-bold flex items-center gap-1 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>تنبيهات تنسيق الملف:</span>
                </div>
                {importErrors.map((err, i) => (
                  <div key={i} className="text-[11px] font-mono">
                    • {err}
                  </div>
                ))}
              </div>
            )}

            {/* Step 4: Live Preview Table */}
            {parsedImportData.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">
                    معاينة البيانات المستخرجة ({parsedImportData.length} سجل جاهز للحفظ):
                  </span>
                  <span className="text-emerald-400 font-bold font-mono">جاهز للاعتماد</span>
                </div>

                <div className="flex-1 overflow-auto border border-slate-800 rounded-xl bg-slate-950 max-h-48 text-[11px] font-mono">
                  <table className="w-full text-right">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 sticky top-0 font-sans">
                      <tr>
                        <th className="p-2">#</th>
                        {ENTITY_METAS[importEntityType].headersAr.map((h) => (
                          <th key={h.key} className="p-2 whitespace-nowrap">
                            {h.labelAr}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {parsedImportData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/50">
                          <td className="p-2 text-slate-500">{idx + 1}</td>
                          {ENTITY_METAS[importEntityType].headersAr.map((h) => (
                            <td key={h.key} className="p-2 whitespace-nowrap">
                              {String(row[h.key] || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={parsedImportData.length === 0 || isProcessingImport}
                onClick={handleCommitBulkImport}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessingImport ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري معالجة وحفظ البيانات...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد وحفظ البيانات ({parsedImportData.length} سجل)</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
