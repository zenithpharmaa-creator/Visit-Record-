/**
 * Server Database Engine - Relational Storage with Atomic JSON Persistence,
 * Foreign Keys, Constraints, Versioning, and Audit Logs.
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, Customer, Visit, SyncQueueItem, AuditLog, AppConfiguration, Region, ProductItem, Client, Pharmacy, RolePermissionsMatrix, PermissionDefinition, UserRole, DoctorClass, RegionSection, BoundaryBasis, VerificationStatus, VisitVerificationResult, isRepAssignedToCustomer, isRegionMatch } from '../types';

const DB_FILE_PATH = fs.existsSync('/app/applet/server_database_store.json')
  ? '/app/applet/server_database_store.json'
  : path.resolve(process.cwd(), 'server_database_store.json');

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // 1. المستخدمون والمناديب
  { id: 'users.view', nameAr: 'عرض قائمة المستخدمين والمناديب', descriptionAr: 'استعراض سجلات الموظفين والمناديب والمشرفين', category: 'المستخدمون والمناديب' },
  { id: 'users.create', nameAr: 'إضافة مستخدم جديد', descriptionAr: 'إنشاء حساب جديد لمندوب أو مشرف أو مدير', category: 'المستخدمون والمناديب' },
  { id: 'users.edit', nameAr: 'تعديل بيانات المستخدمين', descriptionAr: 'تعديل الاسم أو الهاتف أو المنطقة أو الحالة', category: 'المستخدمون والمناديب' },
  { id: 'users.delete', nameAr: 'حذف مستخدم', descriptionAr: 'حذف حساب مندوب أو مشرف نهائياً من النظام', category: 'المستخدمون والمناديب', dangerLevel: 'danger' },
  { id: 'users.reset_password', nameAr: 'إعادة تعيين كلمة المرور', descriptionAr: 'تغيير كلمة مرور أي مستخدم', category: 'المستخدمون والمناديب', dangerLevel: 'warning' },

  // 2. المناطق الجغرافية
  { id: 'regions.view', nameAr: 'عرض المناطق وتوزيعها', descriptionAr: 'استعراض مناطق صنعاء وضواحيها', category: 'المناطق الجغرافية' },
  { id: 'regions.create', nameAr: 'إضافة منطقة جديدة', descriptionAr: 'تعريف نطاق جغرافي جديد', category: 'المناطق الجغرافية' },
  { id: 'regions.edit', nameAr: 'تعديل بيانات المنطقة', descriptionAr: 'تعديل اسم أو حدود المنطقة', category: 'المناطق الجغرافية' },
  { id: 'regions.delete', nameAr: 'حذف منطقة', descriptionAr: 'إزالة منطقة من النظام', category: 'المناطق الجغرافية', dangerLevel: 'danger' },
  { id: 'regions.assign', nameAr: 'تعيين المناديب للمناطق', descriptionAr: 'إسناد المندوب لمنطقة معينة', category: 'المناطق الجغرافية' },

  // 3. الأطباء والعملاء
  { id: 'clients.view', nameAr: 'عرض الأطباء والعملاء', descriptionAr: 'استعراض بيانات العيادات والمراكز والأطباء', category: 'الأطباء والعملاء' },
  { id: 'clients.create', nameAr: 'إضافة طبيب / عميل جديد', descriptionAr: 'تسجيل طبيب أو مركز طبي في قاعدة البيانات', category: 'الأطباء والعملاء' },
  { id: 'clients.edit', nameAr: 'تعديل بيانات الطبيب', descriptionAr: 'تحديث الاسم، التخصص، الهاتف، المنطقة', category: 'الأطباء والعملاء' },
  { id: 'clients.delete', nameAr: 'حذف طبيب / عميل', descriptionAr: 'حذف سجل الطبيب نهائياً من النظام', category: 'الأطباء والعملاء', dangerLevel: 'danger' },
  { id: 'clients.edit_gps', nameAr: 'تعديل إحداثيات موقع الطبيب (GPS)', descriptionAr: 'تعديل خط الطول والعرض ونطاق الزيارة المسموح', category: 'الأطباء والعملاء', dangerLevel: 'warning' },
  { id: 'clients.assign', nameAr: 'تعيين المندوب المسؤول للطبيب', descriptionAr: 'تحديد المندوب المكلف بزيارة الطبيب', category: 'الأطباء والعملاء' },

  // 4. الصيدليات
  { id: 'pharmacies.view', nameAr: 'عرض الصيدليات', descriptionAr: 'استعراض قائمة الصيدليات والصيدلي المسؤول', category: 'الصيدليات' },
  { id: 'pharmacies.create', nameAr: 'إضافة صيدلية جديدة', descriptionAr: 'تسجيل صيدلية جديدة في صنعاء وضواحيها', category: 'الصيدليات' },
  { id: 'pharmacies.edit', nameAr: 'تعديل بيانات الصيدلية', descriptionAr: 'تعديل الاسم، الصيدلي، رقم الترخيص، الهاتف', category: 'الصيدليات' },
  { id: 'pharmacies.delete', nameAr: 'حذف صيدلية', descriptionAr: 'حذف الصيدلية نهائياً من النظام', category: 'الصيدليات', dangerLevel: 'danger' },
  { id: 'pharmacies.edit_gps', nameAr: 'تعديل إحداثيات موقع الصيدلية (GPS)', descriptionAr: 'تعديل الإحداثيات ونطاق المتر المسموح للصيدلية', category: 'الصيدليات', dangerLevel: 'warning' },
  { id: 'pharmacies.assign', nameAr: 'تعيين المندوب المسؤول للصيدلية', descriptionAr: 'إسناد الصيدلية لمندوب معين', category: 'الصيدليات' },

  // 5. الأصناف الدوائية
  { id: 'products.view', nameAr: 'عرض الأصناف والأدوية', descriptionAr: 'استعراض قائمة الأدوية والأسعار والتصنيفات', category: 'الأصناف والأدوية' },
  { id: 'products.create', nameAr: 'إضافة صنف دوائي جديد', descriptionAr: 'إضافة دواء جديد للنظام', category: 'الأصناف والأدوية' },
  { id: 'products.edit', nameAr: 'تعديل بيانات الصنف', descriptionAr: 'تعديل السعر، العبوة، الاسم العلمي', category: 'الأصناف والأدوية' },
  { id: 'products.delete', nameAr: 'حذف صنف دوائي', descriptionAr: 'حذف الصنف من النظام', category: 'الأصناف والأدوية', dangerLevel: 'danger' },
  { id: 'products.assign', nameAr: 'تعيين الأصناف للمناديب', descriptionAr: 'تخصيص منتجات ترويجية للمندوب', category: 'الأصناف والأدوية' },

  // 6. الزيارات الميدانية ومطابقة الإحداثيات
  { id: 'visits.record_offline', nameAr: 'تسجيل الزيارة وحفظها أوفلاين', descriptionAr: 'حفظ موقع ووقت الزيارة محلياً بدون إنترنت', category: 'الزيارات والمطابقة' },
  { id: 'visits.sync_gps_matching', nameAr: 'مزامنة نهاية اليوم ومطابقة الإحداثيات', descriptionAr: 'مطابقة موقع الزيارة مع إحداثيات الطبيب المحفوظة وحساب المسافة', category: 'الزيارات والمطابقة' },
  { id: 'visits.view_all', nameAr: 'عرض جميع زيارات المناديب', descriptionAr: 'استعراض زيارات كافة المناديب على الخريطة والتقارير', category: 'الزيارات والمطابقة' },
  { id: 'visits.approve_override', nameAr: 'اعتماد يدوي للزيارات الخارجة عن النطاق', descriptionAr: 'الموافقة على زيارة تمت خارج نطاق الـ 100 متر بعذر رسمي', category: 'الزيارات والمطابقة', dangerLevel: 'warning' },
  { id: 'visits.delete', nameAr: 'حذف سجل زيارة', descriptionAr: 'إزالة زيارة من السجل العام', category: 'الزيارات والمطابقة', dangerLevel: 'danger' },

  // 7. الاستيراد والتصدير
  { id: 'files.import_excel', nameAr: 'إدراج واستيراد ملفات Excel و CSV', descriptionAr: 'رفع ملفات المناديب والمناطق والأطباء والصيدليات', category: 'الاستيراد والتصدير' },
  { id: 'files.export_excel', nameAr: 'تصدير البيانات والتقارير إلى Excel', descriptionAr: 'تنزيل كشوفات الحسابات والزيارات بصيغة إكسل', category: 'الاستيراد والتصدير' },
  { id: 'files.download_templates', nameAr: 'تنزيل النماذج الجاهزة', descriptionAr: 'تحميل قوالب الإدخال المعتمدة', category: 'الاستيراد والتصدير' },

  // 8. إعدادات النظام وسجل الرقابة
  { id: 'permissions.view', nameAr: 'عرض صفحة الصلاحيات', descriptionAr: 'الاطلاع على مصفوفة صلاحيات الأدوار والمستخدمين', category: 'إعدادات النظام والأمان' },
  { id: 'permissions.manage', nameAr: 'تعديل وحفظ مصفوفة الصلاحيات', descriptionAr: 'تغيير صلاحيات المشرفين والمناديب وتخصيصها', category: 'إعدادات النظام والأمان', dangerLevel: 'danger' },
  { id: 'config.edit_gps_threshold', nameAr: 'تعديل دقة GPS ونطاق الزيارة', descriptionAr: 'تغيير العتبة المترية الافتراضية للتطبيق الميداني', category: 'إعدادات النظام والأمان', dangerLevel: 'warning' },
  { id: 'audit.view_logs', nameAr: 'استعراض سجل التدقيق والرقابة (Audit Trail)', descriptionAr: 'الاطلاع على جميع العمليات التي تمت على الخادم', category: 'إعدادات النظام والأمان' },
];

export const DEFAULT_PERMISSIONS_MATRIX: RolePermissionsMatrix = {
  SYSTEM_ADMIN: PERMISSION_DEFINITIONS.map(p => p.id),
  SALES_MANAGER: [
    'users.view', 'users.create', 'users.edit',
    'regions.view', 'regions.assign',
    'clients.view', 'clients.create', 'clients.edit', 'clients.edit_gps', 'clients.assign',
    'pharmacies.view', 'pharmacies.create', 'pharmacies.edit', 'pharmacies.edit_gps', 'pharmacies.assign',
    'products.view', 'products.create', 'products.edit', 'products.assign',
    'visits.view_all', 'visits.sync_gps_matching', 'visits.approve_override',
    'files.import_excel', 'files.export_excel', 'files.download_templates',
    'audit.view_logs'
  ],
  SALES_REP: [
    'clients.view',
    'pharmacies.view',
    'products.view',
    'visits.record_offline',
    'visits.sync_gps_matching',
    'files.download_templates'
  ],
  userOverrides: {}
};

interface DatabaseStore {
  users: User[];
  customers: Customer[];
  regions: Region[];
  products: ProductItem[];
  clients: Client[];
  pharmacies: Pharmacy[];
  visits: Visit[];
  syncQueue: SyncQueueItem[];
  auditLogs: AuditLog[];
  configuration: AppConfiguration;
  permissions: RolePermissionsMatrix;
}

// Initial Default Configuration
const DEFAULT_CONFIG: AppConfiguration = {
  configVersion: 1,
  minSupportedAppVersion: '1.0.0',
  gpsAccuracyThresholdMeters: 30,
  defaultVisitRadiusMeters: 100,
  syncIntervalMinutes: 15,
  maxSyncRetryCount: 5,
  enableVisitPhotos: false,
  enableAdvancedReports: true,
  enableMap: true,
  enableRouteTracking: false,
  allowedVisitTypes: ['روتينية', 'تحصيل', 'ترويج منتج جديد', 'شكوى عميل', 'افتتاح جديد'],
  allowedVisitOutcomes: ['تم كتابة طلبية', 'متابعة لاحقة', 'تحصيل مبلغ', 'رفض الشراء', 'العميل مغلق', 'اجتماع مع المدير'],
  isActive: true,
  updatedBy: 'usr_admin_1',
  createdAt: '2026-09-01T08:00:00Z',
};

// Real Seed Users (3 Reps for North, Center, South, 1 Manager, 1 System Admin)
const createSeedUsers = (): User[] => {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('123456', salt);
  const now = '2026-09-01T08:00:00Z';

  return [
    {
      id: 'usr_admin_1',
      username: 'admin',
      email: 'zenithpharmaa@gmail.com', // Account Owner Email
      fullName: 'نجيب راصع (مدير النظام - صنعاء)',
      passwordHash,
      role: 'SYSTEM_ADMIN',
      phone: '+967 770000001',
      assignedRegion: 'الكل',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'usr_mgr_1',
      username: 'manager_sanaa',
      email: 'manager.sanaa@zenithpharma.com',
      fullName: 'د. صادق الشامي (مشرف مبيعات عام)',
      passwordHash,
      role: 'SALES_MANAGER',
      phone: '+967 770000002',
      assignedRegion: 'الكل',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'usr_rep_1',
      username: 'rep_north',
      email: 'rep.north@zenithpharma.com',
      fullName: 'حسن محمد الحيمي (مندوب المنطقة الشمالية)',
      passwordHash,
      role: 'SALES_REP',
      phone: '+967 771234567',
      assignedRegion: 'المنطقة الشمالية',
      assignedRegionIds: ['reg_sna_north'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'usr_rep_2',
      username: 'rep_center',
      email: 'rep.center@zenithpharma.com',
      fullName: 'خالد عبد الله المؤيد (مندوب المنطقة الوسطى)',
      passwordHash,
      role: 'SALES_REP',
      phone: '+967 772345678',
      assignedRegion: 'المنطقة الوسطى',
      assignedRegionIds: ['reg_sna_center'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'usr_rep_3',
      username: 'rep_south',
      email: 'rep.south@zenithpharma.com',
      fullName: 'سم علي الشعيبي (مندوب المنطقة الجنوبية وضواحيها)',
      passwordHash,
      role: 'SALES_REP',
      phone: '+967 773456789',
      assignedRegion: 'المنطقة الجنوبية',
      assignedRegionIds: ['reg_sna_south'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];
};

// Real Seed Customers (Sana'a Locations across the 3 Zones)
const createSeedCustomers = (): Customer[] => {
  const now = '2026-09-01T08:00:00Z';
  return [
    {
      id: 'cust_010001',
      customerCode: '010001',
      customerName: 'صيدلية ابن حيان النموذجية',
      ownerName: 'د. إبراهيم محمد المؤيد',
      phone: '+967 1 240001',
      address: 'شارع الزبيري، أمام هيئة مستشفى الثورة، صنعاء',
      region: 'المنطقة الوسطى',
      latitude: 15.3540,
      longitude: 44.2050,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'cust_010002',
      customerCode: '010002',
      customerName: 'هيئة مستشفى الثورة العام النموذجي',
      ownerName: 'د. عبد السلام المتوكل',
      phone: '+967 1 246966',
      address: 'شارع الزبيري، التحرير، صنعاء',
      region: 'المنطقة الوسطى',
      latitude: 15.3533,
      longitude: 44.2045,
      allowedVisitRadiusMeters: 200,
      isActive: true,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'cust_010003',
      customerCode: '010003',
      customerName: 'صيدلية الشفاء الدولية',
      ownerName: 'د. وفاء عبد الله الكبسي',
      phone: '+967 1 445566',
      address: 'شارع حدة، جولة الرويشان، صنعاء',
      region: 'المنطقة الجنوبية',
      latitude: 15.3245,
      longitude: 44.1985,
      allowedVisitRadiusMeters: 120,
      isActive: true,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'cust_020004',
      customerCode: '020004',
      customerName: 'مستشفى جامعة العلوم والتكنولوجيا',
      ownerName: 'د. فهمي العريقي',
      phone: '+967 1 372700',
      address: 'شارع الستين الغربي، تقاطع مذبح، صنعاء',
      region: 'المنطقة الشمالية',
      latitude: 15.3780,
      longitude: 44.1680,
      allowedVisitRadiusMeters: 150,
      isActive: true,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'cust_020005',
      customerCode: '020005',
      customerName: 'صيدلية سنحان الكبرى',
      ownerName: 'د. يحيى علي الحيمي',
      phone: '+967 770987654',
      address: 'الشارع العام، ريمة حميد، سنحان، ضواحي صنعاء',
      region: 'المنطقة الجنوبية',
      latitude: 15.2810,
      longitude: 44.2320,
      allowedVisitRadiusMeters: 120,
      isActive: true,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];
};

// Real Seed Regions: Defined by System Admin according to Field Team Agreement (not city administrative borders)
export const createSeedRegions = (): Region[] => {
  const now = '2026-09-01T08:00:00Z';
  return [
    {
      id: 'reg_sna_north',
      code: 'REG-NORTH',
      name: 'المنطقة الشمالية (قطاع العمليات الشمالي)',
      section: 'شمالية',
      governorate: 'نطاق العمليات الميدانية المتفق عليه (شمال العاصمة والضواحي)',
      boundaryBasis: 'TEAM_AGREEMENT',
      description: 'المراكز والمستشفيات والعيادات من جولة الساعة والحصبة والروضة حتى شملان والمطار، استناداً للتوزيع الميداني الداخلي',
      agreedBoundaries: 'الحدود المتفق عليها بين أعضاء الفريق: تبدأ من خط التماس الشمالي بشارع الستين الشمالي وجولة الجمنة ومحيط المطار، ممتدة إلى الحصبة وبني الحارث وغرباً حتى شملان، متجاوزة التقسيم البلدي للمدينة لضمان تغطية خط سير المندوب بكفاءة.',
      teamAgreement: 'محضر اتفاق الفريق: تم الاتفاق بين المندوبين والمشرف الميداني على إسناد المستشفيات والعيادات التخصصية في هذا القطاع للمندوب المسؤول دون تداخل في خطوط الزيارة، مع اعتماد استثناءات التغطية من مدير النظام.',
      approvedByAdmin: true,
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'reg_sna_center',
      code: 'REG-CENTER',
      name: 'المنطقة الوسطى (قطاع العمليات الأوسط)',
      section: 'وسطى',
      governorate: 'نطاق العمليات الميدانية المتفق عليه (قلب العاصمة والمحاور الرئيسية)',
      boundaryBasis: 'TEAM_AGREEMENT',
      description: 'المحور الطبي المركزي: الزبيري، التحرير، القاع، الدائري، عصر، وباب اليمن مع التركيز على كبار الأطباء والمستشفيات المرجعية',
      agreedBoundaries: 'الحدود المتفق عليها بين أعضاء الفريق: يمتد النطاق على طول المحاور الطبية الكبرى من جولة عصر والدائري الغربي مروراً بشارع الزبيري والقاع حتى التحرير وباب اليمن، وفق مسار دائري منسق يضمن عدم تصادم المواعيد مع قطاعي الشمال والجنوب.',
      teamAgreement: 'محضر اتفاق الفريق: إسناد الحسابات الاستراتيجية والعيادات ذات الكثافة العالية (Class A و B) لمندوب القطاع الأوسط، والتنسيق المشترك مع بقية الفريق عند تحويل العينات أو الطلبيات المشتركة.',
      approvedByAdmin: true,
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'reg_sna_south',
      code: 'REG-SOUTH',
      name: 'المنطقة الجنوبية (قطاع العمليات الجنوبي)',
      section: 'جنوبية',
      governorate: 'نطاق العمليات الميدانية المتفق عليه (جنوب العاصمة وامتدادات الضواحي)',
      boundaryBasis: 'TEAM_AGREEMENT',
      description: 'حدة، السبعين، الحي السياسي، شميلة، وحزيز مع التمدد للضواحي والمراكز الخاصة المتفق عليها',
      agreedBoundaries: 'الحدود المتفق عليها بين أعضاء الفريق: تغطي من جنوب شارع الزبيري والحي السياسي وميدان السبعين وحدّة مروراً بشميلة وحزيز وحتى الضواحي الجنوبية لسنحان ومتنة، بمرونة ميدانية كاملة متفق عليها بين الزملاء لتغطية كافة المراكز الصيدلانية والطبية.',
      teamAgreement: 'محضر اتفاق الفريق: اتفق الفريق على تغطية المندوب للمراكز والعيادات الجنوبية والامتدادات الحيوية وفق جداول مرنة، مع التزام كامل بعدم اختراق خطوط السير للقطاعات الأخرى إلا بإذن مسبق من المشرف ومدير النظام.',
      approvedByAdmin: true,
      assignedRepIds: ['usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const createSeedProducts = (): ProductItem[] => {
  const now = '2026-09-01T08:00:00Z';
  return [
    {
      id: 'prd_101',
      itemCode: 'PRD-101',
      name: 'أوجمنتين 1 جم أقراص',
      scientificName: 'Amoxicillin 875mg + Clavulanic Acid 125mg',
      category: 'مضادات حيوية',
      unitPrice: 4800,
      packageSize: 'علبة 14 قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_102',
      itemCode: 'PRD-102',
      name: 'بانادول إكسترا 500 مجم',
      scientificName: 'Paracetamol 500mg + Caffeine 65mg',
      category: 'مسكن وخافض حرارة',
      unitPrice: 1400,
      packageSize: 'شريط 12 قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_103',
      itemCode: 'PRD-103',
      name: 'كتافلام 50 مجم سريعة المفعول',
      scientificName: 'Diclofenac Potassium 50mg',
      category: 'مضاد للالتهاب',
      unitPrice: 2200,
      packageSize: 'علبة 20 قرص',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_104',
      itemCode: 'PRD-104',
      name: 'أوميبرازول 20 مجم كبسول',
      scientificName: 'Omeprazole 20mg',
      category: 'أدوية الجهاز الهضمي والمعدة',
      unitPrice: 2800,
      packageSize: 'علبة 14 كبسولة',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_105',
      itemCode: 'PRD-105',
      name: 'Akisol 2mg tab',
      scientificName: 'Trihexyphenidyl',
      category: 'أدوية الجهاز العصبي المركزي / الشلل الرعاش',
      unitPrice: 1515,
      packageSize: '١٠٠ قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_106',
      itemCode: 'PRD-106',
      name: 'Akisol 5mg tab',
      scientificName: 'Trihexyphenidyl',
      category: 'أدوية الجهاز العصبي المركزي / الشلل الرعاش',
      unitPrice: 2040,
      packageSize: '١٠٠ قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_107',
      itemCode: 'PRD-107',
      name: 'Amiram 25mg tab',
      scientificName: 'Amitriptyline',
      category: 'أدوية مضادة للاكتئاب',
      unitPrice: 1365,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_108',
      itemCode: 'PRD-108',
      name: 'Amlocard 5mg tab',
      scientificName: 'Amlodipine',
      category: 'أدوية ضغط الدم / خافض للضغط',
      unitPrice: 4752,
      packageSize: '٢٨ قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_109',
      itemCode: 'PRD-109',
      name: 'Cefadril 500mg cap',
      scientificName: 'Cefadroxil',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 2535,
      packageSize: '١٢ كبسولة',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_110',
      itemCode: 'PRD-110',
      name: 'Cefadril 250mg susp',
      scientificName: 'Cefadroxil',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 1900,
      packageSize: 'عبوة ٦٠مل',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_111',
      itemCode: 'PRD-111',
      name: 'Claritop 125mg susp',
      scientificName: 'Clarithromycin',
      category: 'مضادات حيوية (ماكروليد)',
      unitPrice: 3406,
      packageSize: 'عبوة ٣٠مل',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_112',
      itemCode: 'PRD-112',
      name: 'Claritop 250mg tab',
      scientificName: 'Clarithromycin',
      category: 'مضادات حيوية (ماكروليد)',
      unitPrice: 3960,
      packageSize: '١٤ قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_113',
      itemCode: 'PRD-113',
      name: 'Forticef 250mg susp',
      scientificName: 'Cefaclor',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 2605,
      packageSize: 'عبوة ٧٥مل',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_114',
      itemCode: 'PRD-114',
      name: 'Hyposec 20mg cap',
      scientificName: 'Omeprazole',
      category: 'أدوية الجهاز الهضمي والمعدة',
      unitPrice: 3960,
      packageSize: '١٤ كبسولة',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_115',
      itemCode: 'PRD-115',
      name: 'Infantril 50mg tab',
      scientificName: 'Clomiphene',
      category: 'أدوية الخصوبة والغدد الصماء',
      unitPrice: 1820,
      packageSize: '١٠ اقراص',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_116',
      itemCode: 'PRD-116',
      name: 'Losart 50mg tab',
      scientificName: 'Losartan',
      category: 'أدوية ضغط الدم / خافض للضغط',
      unitPrice: 5265,
      packageSize: '٢٨ قرص',
      assignedRepIds: ['usr_rep_2', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_117',
      itemCode: 'PRD-117',
      name: 'Magnacef 200mg cap',
      scientificName: 'Cefixime',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 4428,
      packageSize: '٨ كبسولات',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_118',
      itemCode: 'PRD-118',
      name: 'Magnacef 400mg cap',
      scientificName: 'Cefixime',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 5376,
      packageSize: '٦ كبسولات',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_119',
      itemCode: 'PRD-119',
      name: 'Magnacef 30ml susp',
      scientificName: 'Cefixime 100mg/5ml',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 3168,
      packageSize: 'عبوة ٣٠مل',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_120',
      itemCode: 'PRD-120',
      name: 'Magnacef 60ml susp',
      scientificName: 'Cefixime 100mg/5ml',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 3960,
      packageSize: 'عبوة ٦٠مل',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_121',
      itemCode: 'PRD-121',
      name: 'Motilat 10mg Susp',
      scientificName: 'Domperidone',
      category: 'أدوية الجهاز الهضمي / مضاد للقيء',
      unitPrice: 1215,
      packageSize: 'عبوة ١٠٠مل',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_122',
      itemCode: 'PRD-122',
      name: 'Motilat 10mg tab',
      scientificName: 'Domperidone',
      category: 'أدوية الجهاز الهضمي / مضاد للقيء',
      unitPrice: 1980,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_123',
      itemCode: 'PRD-123',
      name: 'Norcetam 200mg syr',
      scientificName: 'Piracetam',
      category: 'منشطات الدورة الدموية الدماغية',
      unitPrice: 3168,
      packageSize: '١٢٠ مل',
      assignedRepIds: ['usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_124',
      itemCode: 'PRD-124',
      name: 'Norcetam 800mg tab',
      scientificName: 'Piracetam',
      category: 'منشطات الدورة الدموية الدماغية',
      unitPrice: 3168,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_125',
      itemCode: 'PRD-125',
      name: 'Norcetam 400mg tab',
      scientificName: 'Piracetam',
      category: 'منشطات الدورة الدموية الدماغية',
      unitPrice: 1900,
      packageSize: '٣٠ كبسولة',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_126',
      itemCode: 'PRD-126',
      name: 'Novepam 1.5mg tab',
      scientificName: 'Bromazepam',
      category: 'ممهدات النوم / مهدئات',
      unitPrice: 1100,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_127',
      itemCode: 'PRD-127',
      name: 'Novepam 3mg tab',
      scientificName: 'Bromazepam',
      category: 'ممهدات النوم / مهدئات',
      unitPrice: 1320,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_128',
      itemCode: 'PRD-128',
      name: 'OflacinRam 200mg tab',
      scientificName: 'Ofloxacine',
      category: 'مضادات حيوية (فلوروكينولون)',
      unitPrice: 2693,
      packageSize: '١٠ اقراص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_129',
      itemCode: 'PRD-129',
      name: 'Pangesic 500mg tab',
      scientificName: 'Mefenamic Acid',
      category: 'مسكن وخافض حرارة / مضاد للالتهاب',
      unitPrice: 1350,
      packageSize: '٥٠ قرص',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_130',
      itemCode: 'PRD-130',
      name: 'Ramlac 300ml syr',
      scientificName: 'Lactulose',
      category: 'أدوية الجهاز الهضمي / ملين',
      unitPrice: 3650,
      packageSize: 'عبوة ٣٠٠ مل',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_131',
      itemCode: 'PRD-131',
      name: 'Ramoclav 156mg susp',
      scientificName: 'Amoxycillin+...',
      category: 'مضادات حيوية واسعة المجال',
      unitPrice: 2150,
      packageSize: 'عبوة ١٠٠مل',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_132',
      itemCode: 'PRD-132',
      name: 'Ramoclav 312mg susp',
      scientificName: 'Amoxycillin+...',
      category: 'مضادات حيوية واسعة المجال',
      unitPrice: 2850,
      packageSize: 'عبوة ١٠٠مل',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_133',
      itemCode: 'PRD-133',
      name: 'Ramoxin 500mg cap',
      scientificName: 'Cephalexin',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 1350,
      packageSize: '٢٠ قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_134',
      itemCode: 'PRD-134',
      name: 'Ramoxin 250mg susp',
      scientificName: 'Cephalexin',
      category: 'مضادات حيوية (سيفالوسبورين)',
      unitPrice: 1743,
      packageSize: 'عبوة ١٠٠مل',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_135',
      itemCode: 'PRD-135',
      name: 'Trianil 25mg tab',
      scientificName: 'Clomipramine',
      category: 'أدوية مضادة للاكتئاب',
      unitPrice: 2165,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_136',
      itemCode: 'PRD-136',
      name: 'Vertizin 25mg tab',
      scientificName: 'Cinnarizine',
      category: 'أدوية الدوار والدوخة / مضاد للهيستامين',
      unitPrice: 810,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_137',
      itemCode: 'PRD-137',
      name: 'Vertizin 75mg cap',
      scientificName: 'Cinnarizine',
      category: 'أدوية الدوار والدوخة / مضاد للهيستامين',
      unitPrice: 1215,
      packageSize: '٢٠ قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_138',
      itemCode: 'PRD-138',
      name: 'Zenoril 5mg tab',
      scientificName: 'Lisinopril',
      category: 'أدوية ضغط الدم / خافض للضغط',
      unitPrice: 1980,
      packageSize: '٢٨ قرص',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_139',
      itemCode: 'PRD-139',
      name: 'Zenoril 10mg tab',
      scientificName: 'Lisinopril',
      category: 'أدوية ضغط الدم / خافض للضغط',
      unitPrice: 3326,
      packageSize: '٢٨ قرص',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_140',
      itemCode: 'PRD-140',
      name: 'Zenoril 20mg tab',
      scientificName: 'Lisinopril',
      category: 'أدوية ضغط الدم / خافض للضغط',
      unitPrice: 4752,
      packageSize: '٢٨ قرص',
      assignedRepIds: ['usr_rep_1', 'usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_141',
      itemCode: 'PRD-141',
      name: 'Zolam 0.25mg tab',
      scientificName: 'Alprazolam',
      category: 'مهدئات / مضادات القلق',
      unitPrice: 1395,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_142',
      itemCode: 'PRD-142',
      name: 'Zolam 0.5mg tab',
      scientificName: 'Alprazolam',
      category: 'مهدئات / مضادات القلق',
      unitPrice: 1515,
      packageSize: '٣٠ قرص',
      assignedRepIds: ['usr_rep_2', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_143',
      itemCode: 'PRD-143',
      name: 'Claritop 500mg tab',
      scientificName: 'Clarithromycin',
      category: 'مضادات حيوية (ماكروليد)',
      unitPrice: 4815,
      packageSize: '٢٠ قرص',
      assignedRepIds: ['usr_rep_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_144',
      itemCode: 'PRD-144',
      name: 'Moxiram 1g tab',
      scientificName: 'Amoxycillin',
      category: 'مضادات حيوية (بنسلين)',
      unitPrice: 1980,
      packageSize: '١٠ اقراص',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_145',
      itemCode: 'PRD-145',
      name: 'Lanzoram 30mg cap',
      scientificName: 'Lansoprazole',
      category: 'أدوية الجهاز الهضمي والمعدة',
      unitPrice: 3960,
      packageSize: '١٤ كبسولة',
      assignedRepIds: ['usr_rep_1', 'usr_rep_3'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_146',
      itemCode: 'PRD-146',
      name: 'loxicam 15mg tab',
      scientificName: 'Meloxicam',
      category: 'مضاد للالتهاب غير استرويدي',
      unitPrice: 1585,
      packageSize: '١٠ اقراص',
      assignedRepIds: ['usr_rep_2'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const createSeedClients = (): Client[] => {
  const now = '2026-09-01T08:00:00Z';
  return [
    {
      id: 'cli_01',
      clientCode: 'CLI-SNA-01',
      name: 'هيئة مستشفى الثورة العام النموذجي',
      clientType: 'HOSPITAL',
      doctorClass: 'A',
      regionSection: 'وسطى',
      specialty: 'مستشفى حكومي وهيئة تعليمية كبرى',
      phone: '+967 1 246966',
      address: 'شارع الزبيري، صنعاء',
      region: 'المنطقة الوسطى',
      assignedRepId: 'usr_rep_2',
      latitude: 15.3533,
      longitude: 44.2045,
      allowedVisitRadiusMeters: 200,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_02',
      clientCode: 'CLI-SNA-02',
      name: 'مستشفى جامعة العلوم والتكنولوجيا',
      clientType: 'HOSPITAL',
      doctorClass: 'A',
      regionSection: 'شمالية',
      specialty: 'مستشفى تخصصي وجراحة متقدمة',
      phone: '+967 1 372700',
      address: 'شارع الستين الغربي، تقاطع مذبح، صنعاء',
      region: 'المنطقة الشمالية',
      assignedRepId: 'usr_rep_1',
      latitude: 15.3780,
      longitude: 44.1680,
      allowedVisitRadiusMeters: 150,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_03',
      clientCode: 'CLI-SNA-03',
      name: 'أ.د. عبد القادر المتوكل (مركز القلب التخصصي)',
      clientType: 'DOCTOR',
      doctorClass: 'A',
      regionSection: 'جنوبية',
      specialty: 'استشاري أمراض القلب والقسطرة التداخلية',
      phone: '+967 771122334',
      address: 'شارع حدة، أمام بريد حدة، صنعاء',
      region: 'المنطقة الجنوبية',
      assignedRepId: 'usr_rep_1',
      latitude: 15.3210,
      longitude: 44.1950,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_04',
      clientCode: 'CLI-SNA-04',
      name: 'د. سميرة الأغبري',
      clientType: 'DOCTOR',
      doctorClass: 'A',
      regionSection: 'شمالية',
      specialty: 'استشارية طب وجراحة العيون والليزك',
      phone: '+967 772345678',
      address: 'شارع الروضة، برج الأطباء، صنعاء',
      region: 'المنطقة الشمالية',
      assignedRepId: 'usr_rep_1',
      latitude: 15.3900,
      longitude: 44.2150,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_05',
      clientCode: 'CLI-SNA-05',
      name: 'د. وليد الشرفي (عيادات النخبة التخصصية)',
      clientType: 'DOCTOR',
      doctorClass: 'B',
      regionSection: 'وسطى',
      specialty: 'أخصائي أمراض باطنة وجهاز هضمي ومناظير',
      phone: '+967 773456789',
      address: 'شارع الزبيري، تقاطع عمان، صنعاء',
      region: 'المنطقة الوسطى',
      assignedRepId: 'usr_rep_2',
      latitude: 15.3480,
      longitude: 44.1980,
      allowedVisitRadiusMeters: 120,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_06',
      clientCode: 'CLI-SNA-06',
      name: 'د. طارق الحميري',
      clientType: 'DOCTOR',
      doctorClass: 'B',
      regionSection: 'جنوبية',
      specialty: 'أخصائي جراحة العظام والمفاصل والعمود الفقري',
      phone: '+967 774567890',
      address: 'شارع الرويشان، تقاطع الحي السياسي، صنعاء',
      region: 'المنطقة الجنوبية',
      assignedRepId: 'usr_rep_3',
      latitude: 15.3260,
      longitude: 44.2050,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_07',
      clientCode: 'CLI-SNA-07',
      name: 'د. مروان الكحلاني',
      clientType: 'DOCTOR',
      doctorClass: 'B',
      regionSection: 'شمالية',
      specialty: 'أخصائي طب الأطفال وحديثي الولادة',
      phone: '+967 775678901',
      address: 'شارع عمران، جولة الساعة، الحصبة، صنعاء',
      region: 'المنطقة الشمالية',
      assignedRepId: 'usr_rep_1',
      latitude: 15.3720,
      longitude: 44.2010,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_08',
      clientCode: 'CLI-SNA-08',
      name: 'د. بشرى الحداد',
      clientType: 'DOCTOR',
      doctorClass: 'C',
      regionSection: 'وسطى',
      specialty: 'طبيبة عامة وطب أسرة ورعاية أولية',
      phone: '+967 776789012',
      address: 'حي القاع، أمام المستشفى الجمهوري، صنعاء',
      region: 'المنطقة الوسطى',
      assignedRepId: 'usr_rep_2',
      latitude: 15.3510,
      longitude: 44.1920,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_09',
      clientCode: 'CLI-SNA-09',
      name: 'د. رضوان الوادعي',
      clientType: 'DOCTOR',
      doctorClass: 'C',
      regionSection: 'شمالية',
      specialty: 'طب عام وعيادة طوارئ أسرية',
      phone: '+967 777890123',
      address: 'شارع المطار، شملان، شمال صنعاء',
      region: 'المنطقة الشمالية',
      assignedRepId: 'usr_rep_1',
      latitude: 15.4100,
      longitude: 44.1750,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli_10',
      clientCode: 'CLI-SUB-10',
      name: 'مستشفى متنة الريفي التخصصي',
      clientType: 'HOSPITAL',
      doctorClass: 'B',
      regionSection: 'جنوبية',
      specialty: 'طوارئ وباطنة وجراحة عامة',
      phone: '+967 1 480111',
      address: 'سوق متنة العام، بني مطر، ضواحي صنعاء',
      region: 'المنطقة الجنوبية',
      assignedRepId: 'usr_rep_3',
      latitude: 15.2650,
      longitude: 44.0850,
      allowedVisitRadiusMeters: 150,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const createSeedPharmacies = (): Pharmacy[] => {
  const now = '2026-09-01T08:00:00Z';
  return [
    {
      id: 'phr_01',
      pharmacyCode: 'PHR-SNA-01',
      name: 'صيدلية ابن حيان النموذجية',
      pharmacistInCharge: 'د. إبراهيم محمد المؤيد',
      licenseNumber: 'LIC-SNA-2024-118',
      phone: '+967 1 240001',
      address: 'شارع الزبيري، أمام هيئة مستشفى الثورة، صنعاء',
      region: 'صنعاء - التحرير والزبيري',
      assignedRepId: 'usr_rep_2',
      latitude: 15.3540,
      longitude: 44.2050,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'phr_02',
      pharmacyCode: 'PHR-SNA-02',
      name: 'صيدلية الشفاء الدولية',
      pharmacistInCharge: 'د. وفاء عبد الله الكبسي',
      licenseNumber: 'LIC-SNA-2023-455',
      phone: '+967 1 445566',
      address: 'شارع حدة، جولة الرويشان، صنعاء',
      region: 'صنعاء - حدة والسبعين',
      assignedRepId: 'usr_rep_1',
      latitude: 15.3245,
      longitude: 44.1985,
      allowedVisitRadiusMeters: 120,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'phr_03',
      pharmacyCode: 'PHR-SNA-03',
      name: 'صيدلية الدواء الحديث - فرع مذبح',
      pharmacistInCharge: 'د. عادل قاسم الشامي',
      licenseNumber: 'LIC-SNA-2025-072',
      phone: '+967 777123456',
      address: 'شارع الستين الغربي، تقاطع مذبح، صنعاء',
      region: 'صنعاء - الستين ومذبح',
      assignedRepId: 'usr_rep_1',
      latitude: 15.3765,
      longitude: 44.1695,
      allowedVisitRadiusMeters: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'phr_04',
      pharmacyCode: 'PHR-SUB-04',
      name: 'صيدلية سنحان الكبرى',
      pharmacistInCharge: 'د. يحيى علي الحيمي',
      licenseNumber: 'LIC-SUB-2023-890',
      phone: '+967 770987654',
      address: 'الشارع العام، ريمة حميد، سنحان، ضواحي صنعاء',
      region: 'ضواحي صنعاء - سنحان وهمدان',
      assignedRepId: 'usr_rep_3',
      latitude: 15.2810,
      longitude: 44.2320,
      allowedVisitRadiusMeters: 120,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

class ServerDatabase {
  private store: DatabaseStore;

  constructor() {
    this.store = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseStore {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.users && parsed.customers && parsed.visits) {
          // Check if data is still using old seeds, and upgrade to Sana'a
          const isOldSeed = !parsed.regions || parsed.regions.some((r: any) => r.name?.includes('المعادي'));
          if (isOldSeed) {
            parsed.users = createSeedUsers();
            parsed.customers = createSeedCustomers();
            parsed.regions = createSeedRegions();
            parsed.products = createSeedProducts();
            parsed.clients = createSeedClients();
            parsed.pharmacies = createSeedPharmacies();
            parsed.permissions = DEFAULT_PERMISSIONS_MATRIX;
          } else {
            if (!parsed.regions || parsed.regions.length === 0) parsed.regions = createSeedRegions();
            if (!parsed.products || parsed.products.length === 0) parsed.products = createSeedProducts();
            if (!parsed.clients || parsed.clients.length === 0) parsed.clients = createSeedClients();
            if (!parsed.pharmacies || parsed.pharmacies.length === 0) parsed.pharmacies = createSeedPharmacies();
            if (!parsed.permissions) parsed.permissions = DEFAULT_PERMISSIONS_MATRIX;

            // Ensure regions have section (شمالية، جنوبية، وسطى) and team agreement boundaries
            const seedRegionsMap = new Map(createSeedRegions().map(sr => [sr.code, sr]));
            for (const r of (parsed.regions || [])) {
              if (!r.section) {
                if (r.name?.includes('شمال') || r.code?.includes('NORTH')) r.section = 'شمالية';
                else if (r.name?.includes('جنوب') || r.code?.includes('SOUTH')) r.section = 'جنوبية';
                else r.section = 'وسطى';
              }
              const seedMatch = seedRegionsMap.get(r.code) || Array.from(seedRegionsMap.values()).find(sr => sr.section === r.section);
              if (seedMatch) {
                if (!r.boundaryBasis) r.boundaryBasis = 'TEAM_AGREEMENT';
                if (!r.agreedBoundaries) r.agreedBoundaries = seedMatch.agreedBoundaries;
                if (!r.teamAgreement) r.teamAgreement = seedMatch.teamAgreement;
                if (r.approvedByAdmin === undefined) r.approvedByAdmin = true;
                if (r.name === 'المنطقة الشمالية' || r.name === 'المنطقة الوسطى' || r.name === 'المنطقة الجنوبية') {
                  r.name = seedMatch.name;
                }
              } else {
                if (!r.boundaryBasis) r.boundaryBasis = 'TEAM_AGREEMENT';
                if (!r.agreedBoundaries) r.agreedBoundaries = r.description || 'حدود تغطية ميدانية محددة باتفاق الفريق ومعتمدة من مدير النظام';
                if (!r.teamAgreement) r.teamAgreement = 'تم الاتفاق بين أعضاء الفريق على توزيع المربعات الميدانية واعتمادها رسمياً من مدير النظام';
                if (r.approvedByAdmin === undefined) r.approvedByAdmin = true;
              }
            }

            // Ensure clients have doctorClass ('A', 'B', 'C')
            for (const c of (parsed.clients || [])) {
              if (!c.doctorClass) {
                if (c.clientType === 'HOSPITAL' || c.specialty?.includes('استشاري')) c.doctorClass = 'A';
                else if (c.specialty?.includes('أخصائي')) c.doctorClass = 'B';
                else c.doctorClass = 'C';
              }
            }
            
            // If parsed.clients had only the initial 4 clients without the new seeded doctors, merge seed clients
            if (parsed.clients.length < 8) {
              const seedClients = createSeedClients();
              for (const sc of seedClients) {
                if (!parsed.clients.some((ec: Client) => ec.clientCode === sc.clientCode || ec.id === sc.id)) {
                  parsed.clients.push(sc);
                }
              }
            }
            
            // Ensure all 46 products from seed are present and up to date
            const seedProducts = createSeedProducts();
            if (!parsed.products) parsed.products = [];
            const prodMap = new Map<string, ProductItem>(parsed.products.map((p: ProductItem) => [p.itemCode, p]));
            for (const sp of seedProducts) {
              if (!prodMap.has(sp.itemCode)) {
                parsed.products.push(sp);
              } else {
                const existing = prodMap.get(sp.itemCode);
                if (existing) {
                  existing.name = sp.name;
                  existing.scientificName = sp.scientificName;
                  existing.category = sp.category;
                  existing.unitPrice = sp.unitPrice;
                  existing.packageSize = sp.packageSize;
                }
              }
            }

            // Ensure admin has owner email and correct name
            const admin = parsed.users.find((u: User) => u.username === 'admin' || u.role === 'SYSTEM_ADMIN');
            if (admin) {
              admin.email = 'zenithpharmaa@gmail.com';
              admin.fullName = 'نجيب راصع (مدير النظام - صنعاء)';
            }
          }
          this.syncAllClientsAndCustomers(parsed);
          this.saveToDisk(parsed);
          return parsed;
        }
      }
    } catch (err) {
      console.error('[ServerDB] Failed to load disk storage, reinitializing default seed:', err);
    }

    const newStore: DatabaseStore = {
      users: createSeedUsers(),
      customers: createSeedCustomers(),
      regions: createSeedRegions(),
      products: createSeedProducts(),
      clients: createSeedClients(),
      pharmacies: createSeedPharmacies(),
      visits: [],
      syncQueue: [],
      auditLogs: [],
      configuration: DEFAULT_CONFIG,
      permissions: DEFAULT_PERMISSIONS_MATRIX,
    };

    this.syncAllClientsAndCustomers(newStore);
    this.saveToDisk(newStore);
    return newStore;
  }

  private saveToDisk(data: DatabaseStore = this.store): void {
    try {
      const tempPath = `${DB_FILE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE_PATH);
    } catch (err) {
      console.error('[ServerDB] Atomic save error:', err);
    }
  }

  /**
   * Safe bidirectional synchronization between clients (العملاء والأطباء) and customers (سجل العملاء المركزي).
   * Ensures zero duplication, updates missing metadata, and protects all manual edits.
   */
  public syncAllClientsAndCustomers(data: DatabaseStore = this.store): void {
    if (!data.clients) data.clients = [];
    if (!data.customers) data.customers = [];

    // 1. Sync every client into customers table
    for (const client of data.clients) {
      let existingCust = data.customers.find(
        c => c.id === `cust_${client.id}` || 
             (client.clientCode && c.customerCode === client.clientCode) || 
             (client.name && c.customerName?.trim().toLowerCase() === client.name.trim().toLowerCase())
      );

      if (existingCust) {
        existingCust.customerName = client.name || existingCust.customerName;
        if (client.clientCode) existingCust.customerCode = client.clientCode;
        if (client.phone) existingCust.phone = client.phone;
        if (client.address) existingCust.address = client.address;
        if (client.region) existingCust.region = client.region;
        if (client.latitude !== undefined) existingCust.latitude = Number(client.latitude);
        if (client.longitude !== undefined) existingCust.longitude = Number(client.longitude);
        if (client.allowedVisitRadiusMeters !== undefined) existingCust.allowedVisitRadiusMeters = Number(client.allowedVisitRadiusMeters);
        if (client.assignedRepId !== undefined) existingCust.assignedRepId = client.assignedRepId;
        if (client.isActive !== undefined) existingCust.isActive = client.isActive;
        if (client.specialty || client.clientType) existingCust.ownerName = client.specialty || client.clientType;
      } else {
        data.customers.push({
          id: `cust_${client.id}`,
          customerCode: client.clientCode || `0${Math.floor(10000 + Math.random() * 90000)}`,
          customerName: client.name,
          ownerName: client.specialty || client.clientType || '',
          phone: client.phone || '',
          address: client.address || '',
          region: client.region || 'المنطقة الوسطى',
          latitude: Number(client.latitude) || 15.3533,
          longitude: Number(client.longitude) || 44.2045,
          allowedVisitRadiusMeters: Number(client.allowedVisitRadiusMeters) || 100,
          assignedRepId: client.assignedRepId || '',
          isActive: client.isActive !== undefined ? client.isActive : true,
          isDeleted: false,
          createdAt: client.createdAt || new Date().toISOString(),
          updatedAt: client.updatedAt || new Date().toISOString(),
          version: 1,
        });
      }
    }

    // 2. Sync every customer into clients table
    for (const cust of data.customers) {
      if (cust.isDeleted) continue;
      let existingCli = data.clients.find(
        c => c.id === cust.id.replace('cust_', '') || 
             (cust.customerCode && c.clientCode === cust.customerCode) || 
             (cust.customerName && c.name?.trim().toLowerCase() === cust.customerName.trim().toLowerCase())
      );

      if (existingCli) {
        existingCli.name = cust.customerName || existingCli.name;
        if (cust.customerCode) existingCli.clientCode = cust.customerCode;
        if (cust.phone) existingCli.phone = cust.phone;
        if (cust.address) existingCli.address = cust.address;
        if (cust.region) existingCli.region = cust.region;
        if (cust.latitude !== undefined) existingCli.latitude = Number(cust.latitude);
        if (cust.longitude !== undefined) existingCli.longitude = Number(cust.longitude);
        if (cust.allowedVisitRadiusMeters !== undefined) existingCli.allowedVisitRadiusMeters = Number(cust.allowedVisitRadiusMeters);
        if (cust.assignedRepId !== undefined) existingCli.assignedRepId = cust.assignedRepId;
        if (cust.isActive !== undefined) existingCli.isActive = cust.isActive;
      } else {
        const clientType: any = cust.customerName.includes('صيدلية') 
          ? 'DISTRIBUTOR' 
          : cust.customerName.includes('مستشفى') 
            ? 'HOSPITAL' 
            : 'DOCTOR';
        data.clients.push({
          id: cust.id.startsWith('cust_') ? cust.id.replace('cust_', '') : `cli_${cust.id}`,
          clientCode: cust.customerCode,
          name: cust.customerName,
          clientType,
          doctorClass: 'B',
          specialty: cust.ownerName || '',
          phone: cust.phone || '',
          address: cust.address || '',
          region: cust.region || 'المنطقة الوسطى',
          assignedRepId: cust.assignedRepId || '',
          latitude: Number(cust.latitude) || 15.3533,
          longitude: Number(cust.longitude) || 44.2045,
          allowedVisitRadiusMeters: Number(cust.allowedVisitRadiusMeters) || 100,
          isActive: cust.isActive !== undefined ? cust.isActive : true,
          createdAt: cust.createdAt || new Date().toISOString(),
          updatedAt: cust.updatedAt || new Date().toISOString(),
        });
      }
    }
  }

  // --- Users CRUD ---
  public getUsers(): User[] {
    return this.store.users.filter(u => u.isActive);
  }

  public getAllUsersAdmin(): User[] {
    return this.store.users;
  }

  public getUserById(id: string): User | undefined {
    return this.store.users.find(u => u.id === id);
  }

  public getUserByUsername(username: string): User | undefined {
    return this.store.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  public getUserByUsernameOrEmail(identifier: string): User | undefined {
    const clean = identifier.trim().toLowerCase();
    return this.store.users.find(u => 
      (u.username && u.username.toLowerCase() === clean) ||
      (u.email && u.email.toLowerCase() === clean) ||
      (u.phone && u.phone.replace(/[\s+-]/g, '') === clean.replace(/[\s+-]/g, ''))
    );
  }

  public deleteUser(userId: string, actorId: string): { success: boolean; message: string } {
    if (userId === actorId) {
      return { success: false, message: 'لا يمكنك حذف حسابك الحالي الذي تستخدمه لتسجيل الدخول.' };
    }
    const idx = this.store.users.findIndex(u => u.id === userId);
    if (idx === -1) {
      return { success: false, message: 'المستخدم غير موجود.' };
    }
    const user = this.store.users[idx];
    if (user.role === 'SYSTEM_ADMIN') {
      const adminCount = this.store.users.filter(u => u.role === 'SYSTEM_ADMIN' && u.isActive).length;
      if (adminCount <= 1) {
        return { success: false, message: 'لا يمكن حذف مدير النظام الوحيد المتبقي في التطبيق.' };
      }
    }

    const removed = this.store.users.splice(idx, 1)[0];
    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: userId,
      timestamp: new Date().toISOString(),
      oldValues: { username: removed.username, fullName: removed.fullName, role: removed.role },
    });
    this.saveToDisk();
    return { success: true, message: `تم حذف المستخدم "${removed.fullName}" بنجاح.` };
  }

  public updateUser(userId: string, updates: Partial<User> & { password?: string }, actorId: string): User {
    const user = this.store.users.find(u => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const oldValues = { ...user };
    const now = new Date().toISOString();

    if (updates.fullName !== undefined) user.fullName = updates.fullName;
    if (updates.username !== undefined) user.username = updates.username;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.phone !== undefined) user.phone = updates.phone;
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.assignedRegion !== undefined) user.assignedRegion = updates.assignedRegion;
    if (updates.assignedRegionIds !== undefined) user.assignedRegionIds = updates.assignedRegionIds;
    if (updates.assignedProductIds !== undefined) user.assignedProductIds = updates.assignedProductIds;
    if (updates.customPermissions !== undefined) user.customPermissions = updates.customPermissions;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    if (updates.password && updates.password.trim().length > 0) {
      const salt = bcrypt.genSaltSync(10);
      user.passwordHash = bcrypt.hashSync(updates.password.trim(), salt);
    }

    user.updatedAt = now;
    user.version += 1;

    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user.id,
      timestamp: now,
      oldValues,
      newValues: { ...user, passwordHash: '***' },
    });

    this.saveToDisk();
    return user;
  }

  // --- Permissions Management ---
  public getPermissions(): RolePermissionsMatrix {
    if (!this.store.permissions) {
      this.store.permissions = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS_MATRIX));
      this.saveToDisk();
    }
    return this.store.permissions;
  }

  public updatePermissions(matrix: RolePermissionsMatrix, actorId: string): RolePermissionsMatrix {
    this.store.permissions = matrix;
    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'PERMISSIONS_MATRIX_UPDATED',
      entityType: 'PERMISSIONS',
      entityId: 'global_matrix',
      timestamp: new Date().toISOString(),
      newValues: matrix,
    });
    this.saveToDisk();
    return this.store.permissions;
  }

  public resetPermissions(actorId: string): RolePermissionsMatrix {
    this.store.permissions = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS_MATRIX));
    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'PERMISSIONS_MATRIX_RESET',
      entityType: 'PERMISSIONS',
      entityId: 'global_matrix',
      timestamp: new Date().toISOString(),
    });
    this.saveToDisk();
    return this.store.permissions;
  }

  public createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'version'>, passwordPlain: string, actorId: string): User {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(passwordPlain, salt);
    const now = new Date().toISOString();

    const newUser: User = {
      ...user,
      id: `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.store.users.push(newUser);
    
    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: newUser.id,
      timestamp: now,
      newValues: { username: newUser.username, fullName: newUser.fullName, role: newUser.role, region: newUser.assignedRegion },
    });

    this.saveToDisk();
    return newUser;
  }

  public updateUserRoleOrRegion(userId: string, updates: Partial<Pick<User, 'role' | 'assignedRegion' | 'isActive' | 'fullName' | 'phone'>>, actorId: string): User {
    const user = this.store.users.find(u => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const oldValues = { ...user };
    const now = new Date().toISOString();

    if (updates.role !== undefined) user.role = updates.role;
    if (updates.assignedRegion !== undefined) user.assignedRegion = updates.assignedRegion;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;
    if (updates.fullName !== undefined) user.fullName = updates.fullName;
    if (updates.phone !== undefined) user.phone = updates.phone;

    user.updatedAt = now;
    user.version += 1;

    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user.id,
      timestamp: now,
      oldValues,
      newValues: user,
    });

    this.saveToDisk();
    return user;
  }

  // --- Representative ID Resolution Helper ---
  public resolveRepId(repInput?: string): string {
    if (!repInput || String(repInput).trim() === '') return '';
    const clean = String(repInput).trim().toLowerCase();

    // 1. Direct match with users by ID, username, or full name
    const found = (this.store.users || []).find(
      u =>
        u.id.toLowerCase() === clean ||
        u.username.toLowerCase() === clean ||
        u.fullName.toLowerCase() === clean ||
        u.fullName.toLowerCase().includes(clean)
    );
    if (found) return found.id;

    // 2. Legacy codes from doctor import tables
    if (clean.includes('khalid') || clean.includes('الرميمة') || clean.includes('center')) return 'usr_rep_2';
    if (clean.includes('hassan') || clean.includes('الحداد') || clean.includes('الحيمي') || clean.includes('north')) return 'usr_rep_1';
    if (clean.includes('ali') || clean.includes('الشعيبي') || clean.includes('south')) return 'usr_rep_3';

    return repInput;
  }

  // --- Customers Delta & CRUD ---
  public getCustomersDelta(sinceVersion: number = 0, region?: string, repId?: string, user?: User): Customer[] {
    const repUser = user || (repId ? this.store.users.find(u => u.id === repId) : undefined);

    return this.store.customers.filter(c => {
      // Version delta & deletion check
      if (c.version <= sinceVersion) return false;
      if (c.isDeleted) return false;

      // If user is Admin or Sales Manager (no repId constraint), filter purely by region if specified
      if (!repId || !repUser || repUser.role !== 'SALES_REP') {
        if (!region || region === 'الكل') return true;
        return isRegionMatch(c.region, region);
      }

      // 1. Explicitly assigned to this sales representative -> ALWAYS 100% VISIBLE!
      if (isRepAssignedToCustomer(c.assignedRepId, repUser)) {
        return true;
      }

      // 2. Unassigned customer within the sales rep's territory -> Visible for visit scheduling!
      const isUnassigned = !c.assignedRepId || c.assignedRepId.trim() === '';
      if (isUnassigned && isRegionMatch(c.region, repUser.assignedRegion, repUser.assignedRegionIds)) {
        return true;
      }

      // Customer is assigned to another representative
      return false;
    });
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.store.customers.find(c => c.id === id);
  }

  public upsertCustomer(customerData: Partial<Customer> & { customerCode: string; customerName: string }, actorId: string): Customer {
    const now = new Date().toISOString();
    let existing = this.store.customers.find(
      c => c.id === customerData.id || 
           c.customerCode === customerData.customerCode ||
           (customerData.customerName && c.customerName?.trim().toLowerCase() === customerData.customerName.trim().toLowerCase())
    );

    let savedCust: Customer;
    if (existing) {
      const oldValues = { ...existing };
      existing.customerCode = String(customerData.customerCode); // Preserve leading zeros!
      if (customerData.customerName) existing.customerName = customerData.customerName;
      if (customerData.ownerName !== undefined) existing.ownerName = customerData.ownerName;
      if (customerData.phone !== undefined) existing.phone = customerData.phone;
      if (customerData.address !== undefined) existing.address = customerData.address;
      if (customerData.region !== undefined) existing.region = customerData.region;
      if (customerData.latitude !== undefined) existing.latitude = Number(customerData.latitude);
      if (customerData.longitude !== undefined) existing.longitude = Number(customerData.longitude);
      if (customerData.allowedVisitRadiusMeters !== undefined) existing.allowedVisitRadiusMeters = Number(customerData.allowedVisitRadiusMeters);
      if (customerData.assignedRepId !== undefined) existing.assignedRepId = this.resolveRepId(customerData.assignedRepId);
      if (customerData.isActive !== undefined) existing.isActive = customerData.isActive;
      if (customerData.isDeleted !== undefined) existing.isDeleted = customerData.isDeleted;

      existing.updatedAt = now;
      existing.version += 1;

      this.addAuditLog({
        userId: actorId,
        role: 'ADMIN',
        action: 'CUSTOMER_UPDATED',
        entityType: 'CUSTOMER',
        entityId: existing.id,
        timestamp: now,
        oldValues,
        newValues: existing,
      });

      savedCust = existing;
    } else {
      const newCustomer: Customer = {
        id: customerData.id || `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        customerCode: String(customerData.customerCode),
        customerName: customerData.customerName,
        ownerName: customerData.ownerName || '',
        phone: customerData.phone || '',
        address: customerData.address || '',
        region: customerData.region || 'المنطقة الوسطى',
        latitude: customerData.latitude !== undefined ? Number(customerData.latitude) : 15.3533,
        longitude: customerData.longitude !== undefined ? Number(customerData.longitude) : 44.2045,
        allowedVisitRadiusMeters: customerData.allowedVisitRadiusMeters !== undefined ? Number(customerData.allowedVisitRadiusMeters) : 100,
        isActive: customerData.isActive !== undefined ? Boolean(customerData.isActive) : true,
        isDeleted: false,
        assignedRepId: this.resolveRepId(customerData.assignedRepId || ''),
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      this.store.customers.push(newCustomer);

      this.addAuditLog({
        userId: actorId,
        role: 'ADMIN',
        action: 'CUSTOMER_CREATED',
        entityType: 'CUSTOMER',
        entityId: newCustomer.id,
        timestamp: now,
        newValues: newCustomer,
      });

      savedCust = newCustomer;
    }

    // Bidirectional sync to clients table
    if (!this.store.clients) this.store.clients = [];
    const clientMatch = this.store.clients.find(
      c => c.id === savedCust.id.replace('cust_', '') || 
           c.clientCode === savedCust.customerCode || 
           (savedCust.customerName && c.name?.trim().toLowerCase() === savedCust.customerName.trim().toLowerCase())
    );

    if (clientMatch) {
      clientMatch.name = savedCust.customerName;
      clientMatch.clientCode = savedCust.customerCode;
      clientMatch.phone = savedCust.phone;
      clientMatch.address = savedCust.address;
      clientMatch.region = savedCust.region;
      clientMatch.latitude = savedCust.latitude;
      clientMatch.longitude = savedCust.longitude;
      clientMatch.allowedVisitRadiusMeters = savedCust.allowedVisitRadiusMeters;
      clientMatch.assignedRepId = savedCust.assignedRepId;
      clientMatch.isActive = savedCust.isActive;
      clientMatch.updatedAt = now;
    } else {
      const clientType: any = savedCust.customerName.includes('صيدلية') 
        ? 'DISTRIBUTOR' 
        : savedCust.customerName.includes('مستشفى') 
          ? 'HOSPITAL' 
          : 'DOCTOR';
      this.store.clients.push({
        id: savedCust.id.startsWith('cust_') ? savedCust.id.replace('cust_', '') : `cli_${savedCust.id}`,
        clientCode: savedCust.customerCode,
        name: savedCust.customerName,
        clientType,
        doctorClass: 'B',
        specialty: savedCust.ownerName || '',
        phone: savedCust.phone || '',
        address: savedCust.address || '',
        region: savedCust.region || 'المنطقة الوسطى',
        assignedRepId: savedCust.assignedRepId || '',
        latitude: savedCust.latitude,
        longitude: savedCust.longitude,
        allowedVisitRadiusMeters: savedCust.allowedVisitRadiusMeters,
        isActive: savedCust.isActive,
        createdAt: now,
        updatedAt: now,
      });
    }

    this.saveToDisk();
    return savedCust;
  }

  public deleteCustomer(id: string, actorId: string): boolean {
    const cust = (this.store.customers || []).find(c => c.id === id || c.customerCode === id);
    if (!cust) return false;
    const now = new Date().toISOString();
    cust.isDeleted = true;
    cust.isActive = false;
    cust.version += 1;
    cust.updatedAt = now;

    // Also remove matching client from clients list
    const clientIdx = (this.store.clients || []).findIndex(
      c => c.id === id.replace('cust_', '') || c.clientCode === cust.customerCode
    );
    if (clientIdx !== -1) {
      this.store.clients.splice(clientIdx, 1);
    }

    this.addAuditLog({
      userId: actorId,
      role: 'ADMIN',
      action: 'CUSTOMER_DELETED',
      entityType: 'CUSTOMER',
      entityId: cust.id,
      timestamp: now,
      oldValues: cust,
    });

    this.saveToDisk();
    return true;
  }

  // --- Idempotent Batch Visits Sync ---
  public syncVisitsBatch(visits: Visit[], actorUserId: string): { syncedVisitIds: string[]; failedVisitIds: string[]; verificationResults: VisitVerificationResult[] } {
    const now = new Date().toISOString();
    const syncedVisitIds: string[] = [];
    const failedVisitIds: string[] = [];
    const verificationResults: VisitVerificationResult[] = [];

    for (const v of visits) {
      try {
        if (!v.visitId) {
          failedVisitIds.push('missing_id');
          continue;
        }

        // SECURITY: Verify user identity
        if (v.userId !== actorUserId) {
          failedVisitIds.push(v.visitId);
          continue;
        }

        const customer = this.store.customers.find(c => c.id === v.customerId || c.customerCode === v.customerId);
        const client = (this.store as any).clients?.find((c: any) => c.id === v.customerId || c.clientCode === v.customerId);

        const targetLat = customer?.latitude ?? client?.latitude;
        const targetLng = customer?.longitude ?? client?.longitude;
        const targetRadius = customer?.allowedVisitRadiusMeters ?? client?.allowedVisitRadiusMeters ?? 30;
        const targetName = customer?.customerName ?? client?.name ?? "عميل غير محدد";

        let distance: number | null = null;
        let verificationStatus: VerificationStatus = "PENDING";
        let verificationReason: string = "";

        if (targetLat !== undefined && targetLng !== undefined && v.startLatitude && v.startLongitude) {
          const lat1 = v.startLatitude;
          const lon1 = v.startLongitude;
          const lat2 = targetLat;
          const lon2 = targetLng;

          const R = 6371e3; // metres
          const φ1 = lat1 * Math.PI/180;
          const φ2 = lat2 * Math.PI/180;
          const Δφ = (lat2-lat1) * Math.PI/180;
          const Δλ = (lon2-lon1) * Math.PI/180;

          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance = R * c;

          if (distance <= targetRadius) {
            verificationStatus = "ACCEPTED";
            verificationReason = `مطابقة صحيحة: المسافة ${Math.round(distance)} متر ضمن النطاق الجغرافي المسموح (${targetRadius} متر)`;
          } else {
            verificationStatus = "REJECTED";
            verificationReason = `خارج النطاق المسموح: المسافة ${Math.round(distance)} متر تتجاوز الحد المسموح (${targetRadius} متر)`;
          }
        } else {
          verificationStatus = "REJECTED";
          verificationReason = "بيانات الإحداثيات الجغرافية مفقودة أو غير متوفرة للعميل";
        }

        const existing = this.store.visits.find(item => item.visitId === v.visitId);

        if (existing) {
          syncedVisitIds.push(v.visitId);
          verificationResults.push({
            visitId: v.visitId,
            customerId: v.customerId,
            customerName: targetName,
            verificationStatus: existing.verificationStatus || verificationStatus,
            verificationReason: existing.verificationReason || verificationReason,
            distanceMeters: existing.distanceMeters ?? (distance !== null ? Math.round(distance) : null),
            allowedRadius: targetRadius,
            capturedCoords: {
              latitude: v.startLatitude || existing.startLatitude || 0,
              longitude: v.startLongitude || existing.startLongitude || 0,
              accuracy: v.startAccuracy || existing.startAccuracy || null,
            },
            savedCoords: {
              latitude: targetLat || 0,
              longitude: targetLng || 0,
            },
          });
          continue;
        }

        const serverVisit: Visit = {
          ...v,
          distanceMeters: distance !== null ? Math.round(distance) : v.distanceMeters,
          locationStatus: distance !== null ? (distance <= targetRadius ? "WITHIN_RADIUS" : "OUTSIDE_RADIUS") : v.locationStatus,
          serverReceivedTimestamp: now,
          state: "SYNCED",
          updatedAt: now,
          verificationStatus,
          verificationReason,
        };

        this.store.visits.push(serverVisit);
        syncedVisitIds.push(v.visitId);

        verificationResults.push({
          visitId: v.visitId,
          customerId: v.customerId,
          customerName: targetName,
          verificationStatus,
          verificationReason,
          distanceMeters: distance !== null ? Math.round(distance) : null,
          allowedRadius: targetRadius,
          capturedCoords: {
            latitude: v.startLatitude || 0,
            longitude: v.startLongitude || 0,
            accuracy: v.startAccuracy || null,
          },
          savedCoords: {
            latitude: targetLat || 0,
            longitude: targetLng || 0,
          },
        });

        // Update Sync Queue entry
        const queueEntry = this.store.syncQueue.find(q => q.visitId === v.visitId);
        if (queueEntry) {
          queueEntry.syncStatus = "SYNCED";
          queueEntry.syncedAt = now;
        } else {
          this.store.syncQueue.push({
            queueId: `q_${Date.now()}_${Math.random()}`,
            visitId: v.visitId,
            syncStatus: "SYNCED",
            retryCount: 0,
            createdAt: v.createdAt || now,
            syncedAt: now,
          });
        }

        // Log Audit Event
        this.addAuditLog({
          userId: actorUserId,
          role: "SALES_REP",
          action: "VISIT_SYNCED",
          entityType: "VISIT",
          entityId: v.visitId,
          timestamp: now,
          metadata: {
            customerId: v.customerId,
            distanceMeters: serverVisit.distanceMeters,
            locationStatus: serverVisit.locationStatus,
            verificationStatus,
            verificationReason,
            isStartMock: v.isStartMock,
            isEndMock: v.isEndMock,
          },
        });
      } catch (err) {
        console.error(`[ServerDB] Error syncing visit ${v.visitId}:`, err);
        failedVisitIds.push(v.visitId);
      }
    }

    this.saveToDisk();
    return { syncedVisitIds, failedVisitIds, verificationResults };
  }

  public getVisits(filters?: { date?: string; userId?: string; region?: string; locationStatus?: string }): Visit[] {
    return this.store.visits.filter(v => {
      if (filters?.userId && v.userId !== filters.userId) return false;
      if (filters?.locationStatus && v.locationStatus !== filters.locationStatus) return false;
      if (filters?.date && filters.date !== 'all' && filters.date.trim() !== '') {
        const visitDate = (v.startTimeDevice || v.createdAt).substring(0, 10);
        if (visitDate !== filters.date) return false;
      }
      return true;
    });
  }

  // --- Configuration Management ---
  public getConfiguration(): AppConfiguration {
    return this.store.configuration;
  }

  public updateConfiguration(newConfig: Partial<AppConfiguration>, actorId: string): AppConfiguration {
    const oldConfig = { ...this.store.configuration };
    const now = new Date().toISOString();

    this.store.configuration = {
      ...this.store.configuration,
      ...newConfig,
      configVersion: this.store.configuration.configVersion + 1,
      updatedBy: actorId,
      createdAt: now,
    };

    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'CONFIG_UPDATED',
      entityType: 'CONFIGURATION',
      entityId: `v_${this.store.configuration.configVersion}`,
      timestamp: now,
      oldValues: oldConfig,
      newValues: this.store.configuration,
    });

    this.saveToDisk();
    return this.store.configuration;
  }

  // --- Audit Logs ---
  public addAuditLog(log: Omit<AuditLog, 'auditId'>): AuditLog {
    const newLog: AuditLog = {
      ...log,
      auditId: `audit_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    };
    this.store.auditLogs.unshift(newLog); // Append-only, newest first
    return newLog;
  }

  public getAuditLogs(limit: number = 100): AuditLog[] {
    return this.store.auditLogs.slice(0, limit);
  }

  // ==========================================
  // --- REGIONS (المناطق) MANAGEMENT ---
  // ==========================================
  public getAllRegions(): Region[] {
    return this.store.regions || [];
  }

  public upsertRegion(data: Partial<Region>, actorId: string): Region {
    const now = new Date().toISOString();
    let existing = (this.store.regions || []).find(r => r.id === data.id || (data.code && r.code.toLowerCase() === data.code.toLowerCase()));

    if (existing) {
      const oldValues = { ...existing };
      if (data.name) existing.name = data.name;
      if (data.code) existing.code = data.code;
      if (data.governorate) existing.governorate = data.governorate;
      if (data.section !== undefined) existing.section = data.section;
      if (data.boundaryBasis !== undefined) existing.boundaryBasis = data.boundaryBasis;
      if (data.agreedBoundaries !== undefined) existing.agreedBoundaries = data.agreedBoundaries;
      if (data.teamAgreement !== undefined) existing.teamAgreement = data.teamAgreement;
      if (data.approvedByAdmin !== undefined) existing.approvedByAdmin = data.approvedByAdmin;
      if (data.description !== undefined) existing.description = data.description;
      if (data.assignedRepIds !== undefined) existing.assignedRepIds = data.assignedRepIds;
      if (data.isActive !== undefined) existing.isActive = data.isActive;
      existing.updatedAt = now;

      this.addAuditLog({
        userId: actorId,
        role: 'SYSTEM_ADMIN',
        action: 'REGION_UPDATED',
        entityType: 'REGION',
        entityId: existing.id,
        timestamp: now,
        oldValues,
        newValues: existing,
      });

      this.saveToDisk();
      return existing;
    } else {
      const newRegion: Region = {
        id: data.id || `reg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        code: data.code || `REG-${Date.now().toString().slice(-4)}`,
        name: data.name || 'منطقة جديدة',
        section: data.section || 'وسطى',
        governorate: data.governorate || 'نطاق العمليات الميدانية المتفق عليه',
        boundaryBasis: data.boundaryBasis || 'TEAM_AGREEMENT',
        agreedBoundaries: data.agreedBoundaries || '',
        teamAgreement: data.teamAgreement || '',
        approvedByAdmin: data.approvedByAdmin !== undefined ? data.approvedByAdmin : true,
        description: data.description || '',
        assignedRepIds: data.assignedRepIds || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now,
        updatedAt: now,
      };

      if (!this.store.regions) this.store.regions = [];
      this.store.regions.push(newRegion);

      this.addAuditLog({
        userId: actorId,
        role: 'SYSTEM_ADMIN',
        action: 'REGION_CREATED',
        entityType: 'REGION',
        entityId: newRegion.id,
        timestamp: now,
        newValues: newRegion,
      });

      this.saveToDisk();
      return newRegion;
    }
  }

  /**
   * Reset Region Boundaries according to System Admin & Team Member Agreements
   * (Rather than municipal geographic boundaries)
   */
  public resetRegionsToTeamAgreement(actorId: string): Region[] {
    const seed = createSeedRegions();
    const now = new Date().toISOString();

    if (!this.store.regions) this.store.regions = [];

    // Map existing assignedRepIds to retain current rep assignments if present
    const existingRepAssignments = new Map<string, string[]>();
    for (const r of this.store.regions) {
      if (r.section && r.assignedRepIds && r.assignedRepIds.length > 0) {
        existingRepAssignments.set(r.section, r.assignedRepIds);
      }
    }

    const updatedRegions: Region[] = seed.map(sr => {
      const existing = this.store.regions.find(r => r.code === sr.code || r.section === sr.section);
      const repIds = (sr.section && existingRepAssignments.get(sr.section)) || existing?.assignedRepIds || sr.assignedRepIds || [];
      return {
        ...sr,
        id: existing?.id || sr.id,
        assignedRepIds: repIds,
        updatedAt: now,
        approvedByAdmin: true,
      };
    });

    // Retain any custom regions created outside the 3 main sections
    const nonStandardRegions = this.store.regions.filter(
      r => !seed.some(sr => sr.code === r.code || sr.id === r.id || sr.section === r.section)
    ).map(r => ({
      ...r,
      boundaryBasis: r.boundaryBasis || 'TEAM_AGREEMENT' as const,
      approvedByAdmin: true,
      updatedAt: now,
    }));

    this.store.regions = [...updatedRegions, ...nonStandardRegions];

    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'REGIONS_RESET_TO_TEAM_AGREEMENT',
      entityType: 'REGION',
      entityId: 'ALL_REGIONS',
      timestamp: now,
      newValues: { totalRegions: this.store.regions.length, basis: 'TEAM_AGREEMENT' },
    });

    this.saveToDisk();
    return this.store.regions;
  }

  public deleteRegion(id: string, actorId: string): boolean {
    const idx = (this.store.regions || []).findIndex(r => r.id === id);
    if (idx === -1) return false;
    const removed = this.store.regions.splice(idx, 1)[0];
    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'REGION_DELETED',
      entityType: 'REGION',
      entityId: id,
      timestamp: new Date().toISOString(),
      oldValues: removed,
    });
    this.saveToDisk();
    return true;
  }

  public bulkImportRegions(regionsList: any[], actorId: string): { total: number; created: number; updated: number } {
    let created = 0;
    let updated = 0;
    for (const item of regionsList) {
      const existing = (this.store.regions || []).find(r => r.code?.toLowerCase() === String(item.code || item.itemCode || '').toLowerCase());
      if (existing) {
        this.upsertRegion({ ...existing, ...item }, actorId);
        updated++;
      } else {
        this.upsertRegion(item, actorId);
        created++;
      }
    }
    return { total: regionsList.length, created, updated };
  }

  // ==========================================
  // --- PRODUCTS (الأصناف) MANAGEMENT ---
  // ==========================================
  public getAllProducts(): ProductItem[] {
    return this.store.products || [];
  }

  public upsertProduct(data: Partial<ProductItem>, actorId: string): ProductItem {
    const now = new Date().toISOString();
    let existing = (this.store.products || []).find(p => p.id === data.id || (data.itemCode && p.itemCode.toLowerCase() === data.itemCode.toLowerCase()));

    if (existing) {
      const oldValues = { ...existing };
      if (data.name) existing.name = data.name;
      if (data.itemCode) existing.itemCode = data.itemCode;
      if (data.scientificName !== undefined) existing.scientificName = data.scientificName;
      if (data.category) existing.category = data.category;
      if (data.unitPrice !== undefined) existing.unitPrice = Number(data.unitPrice);
      if (data.packageSize !== undefined) existing.packageSize = data.packageSize;
      if (data.assignedRepIds !== undefined) {
        existing.assignedRepIds = data.assignedRepIds;
        // Bidirectional sync: update sales reps' assignedProductIds
        for (const u of (this.store.users || [])) {
          if (u.role === 'SALES_REP') {
            const currentProds = u.assignedProductIds || [];
            const shouldHave = data.assignedRepIds.includes(u.id);
            const hasIt = currentProds.includes(existing.id);
            if (shouldHave && !hasIt) {
              u.assignedProductIds = [...currentProds, existing.id];
              u.updatedAt = now;
            } else if (!shouldHave && hasIt) {
              u.assignedProductIds = currentProds.filter(id => id !== existing.id);
              u.updatedAt = now;
            }
          }
        }
      }
      if (data.isActive !== undefined) existing.isActive = data.isActive;
      existing.updatedAt = now;

      this.addAuditLog({
        userId: actorId,
        role: 'SYSTEM_ADMIN',
        action: 'PRODUCT_UPDATED',
        entityType: 'PRODUCT',
        entityId: existing.id,
        timestamp: now,
        oldValues,
        newValues: existing,
      });

      this.saveToDisk();
      return existing;
    } else {
      const newProduct: ProductItem = {
        id: data.id || `prd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        itemCode: data.itemCode || `PRD-${Date.now().toString().slice(-4)}`,
        name: data.name || 'صنف جديد',
        scientificName: data.scientificName || '',
        category: data.category || 'أدوية عامة',
        unitPrice: Number(data.unitPrice) || 0,
        packageSize: data.packageSize || '',
        assignedRepIds: data.assignedRepIds || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now,
        updatedAt: now,
      };

      if (!this.store.products) this.store.products = [];
      this.store.products.push(newProduct);

      if (newProduct.assignedRepIds && newProduct.assignedRepIds.length > 0) {
        for (const u of (this.store.users || [])) {
          if (u.role === 'SALES_REP' && newProduct.assignedRepIds.includes(u.id)) {
            const currentProds = u.assignedProductIds || [];
            if (!currentProds.includes(newProduct.id)) {
              u.assignedProductIds = [...currentProds, newProduct.id];
              u.updatedAt = now;
            }
          }
        }
      }

      this.addAuditLog({
        userId: actorId,
        role: 'SYSTEM_ADMIN',
        action: 'PRODUCT_CREATED',
        entityType: 'PRODUCT',
        entityId: newProduct.id,
        timestamp: now,
        newValues: newProduct,
      });

      this.saveToDisk();
      return newProduct;
    }
  }

  public assignProductReps(productId: string, repIds: string[], actorId: string): ProductItem {
    const product = (this.store.products || []).find(p => p.id === productId);
    if (!product) throw new Error(`الصنف برقم ${productId} غير موجود`);

    const oldRepIds = [...(product.assignedRepIds || [])];
    const now = new Date().toISOString();
    product.assignedRepIds = [...repIds];
    product.updatedAt = now;

    // Synchronize to users/reps assignedProductIds
    for (const u of (this.store.users || [])) {
      if (u.role === 'SALES_REP') {
        const prodList = u.assignedProductIds || [];
        const shouldHave = repIds.includes(u.id);
        const hasIt = prodList.includes(productId);

        if (shouldHave && !hasIt) {
          u.assignedProductIds = [...prodList, productId];
          u.updatedAt = now;
        } else if (!shouldHave && hasIt) {
          u.assignedProductIds = prodList.filter(id => id !== productId);
          u.updatedAt = now;
        }
      }
    }

    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'PRODUCT_REPS_ASSIGNED',
      entityType: 'PRODUCT',
      entityId: product.id,
      timestamp: now,
      oldValues: { assignedRepIds: oldRepIds },
      newValues: { assignedRepIds: product.assignedRepIds },
    });

    this.saveToDisk();
    return product;
  }

  public assignRegionReps(regionId: string, repIds: string[], actorId: string): Region {
    const region = (this.store.regions || []).find(r => r.id === regionId);
    if (!region) throw new Error(`المنطقة برقم ${regionId} غير موجودة`);

    const oldRepIds = [...(region.assignedRepIds || [])];
    const now = new Date().toISOString();
    region.assignedRepIds = [...repIds];
    region.updatedAt = now;

    // Synchronize to users/reps assignedRegionIds
    for (const u of (this.store.users || [])) {
      if (u.role === 'SALES_REP') {
        const regList = u.assignedRegionIds || [];
        const shouldHave = repIds.includes(u.id);
        const hasIt = regList.includes(regionId);

        if (shouldHave && !hasIt) {
          u.assignedRegionIds = [...regList, regionId];
          if (!u.assignedRegion || u.assignedRegion === 'القاهرة الكبرى') {
            u.assignedRegion = region.name;
          }
          u.updatedAt = now;
        } else if (!shouldHave && hasIt) {
          u.assignedRegionIds = regList.filter(id => id !== regionId);
          u.updatedAt = now;
        }
      }
    }

    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'REGION_REPS_ASSIGNED',
      entityType: 'REGION',
      entityId: region.id,
      timestamp: now,
      oldValues: { assignedRepIds: oldRepIds },
      newValues: { assignedRepIds: region.assignedRepIds },
    });

    this.saveToDisk();
    return region;
  }

  public deleteProduct(id: string, actorId: string): boolean {
    const idx = (this.store.products || []).findIndex(p => p.id === id);
    if (idx === -1) return false;
    const removed = this.store.products.splice(idx, 1)[0];
    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'PRODUCT_DELETED',
      entityType: 'PRODUCT',
      entityId: id,
      timestamp: new Date().toISOString(),
      oldValues: removed,
    });
    this.saveToDisk();
    return true;
  }

  public bulkImportProducts(productsList: any[], actorId: string): { total: number; created: number; updated: number } {
    let created = 0;
    let updated = 0;
    for (const item of productsList) {
      const existing = (this.store.products || []).find(p => p.itemCode?.toLowerCase() === String(item.itemCode || '').toLowerCase());
      if (existing) {
        this.upsertProduct({ ...existing, ...item }, actorId);
        updated++;
      } else {
        this.upsertProduct(item, actorId);
        created++;
      }
    }
    return { total: productsList.length, created, updated };
  }

  // ==========================================
  // --- CLIENTS (العملاء - أطباء ومستشفيات) ---
  // ==========================================
  public getAllClients(region?: string, repId?: string, doctorClass?: string, user?: User): Client[] {
    const repUser = user || (repId ? this.store.users.find(u => u.id === repId) : undefined);

    return (this.store.clients || []).filter(c => {
      if (doctorClass && doctorClass !== 'الكل' && c.doctorClass !== doctorClass) return false;

      // If queried for a sales representative
      if (repId && repUser && repUser.role === 'SALES_REP') {
        // 1. Explicitly assigned to this rep -> ALWAYS visible!
        if (isRepAssignedToCustomer(c.assignedRepId, repUser)) return true;

        // 2. Unassigned client in the rep's territory
        const isUnassigned = !c.assignedRepId || c.assignedRepId.trim() === '';
        if (isUnassigned && isRegionMatch(c.region, repUser.assignedRegion, repUser.assignedRegionIds)) {
          return true;
        }
        return false;
      }

      // For Manager / Admin
      if (region && region !== 'الكل' && !isRegionMatch(c.region, region)) return false;
      if (repId && c.assignedRepId !== repId) return false;
      return true;
    });
  }

  public upsertClient(data: Partial<Client>, actorId: string): Client {
    const now = new Date().toISOString();
    let existing = (this.store.clients || []).find(
      c => c.id === data.id || 
           (data.clientCode && c.clientCode === data.clientCode) ||
           (data.name && c.name?.trim().toLowerCase() === data.name.trim().toLowerCase())
    );

    let savedClient: Client;
    if (existing) {
      const oldValues = { ...existing };
      if (data.name) existing.name = data.name;
      if (data.clientCode) existing.clientCode = data.clientCode;
      if (data.clientType) existing.clientType = data.clientType;
      if (data.doctorClass !== undefined) existing.doctorClass = data.doctorClass;
      if (data.specialty !== undefined) existing.specialty = data.specialty;
      if (data.phone !== undefined) existing.phone = data.phone;
      if (data.address !== undefined) existing.address = data.address;
      if (data.region !== undefined) existing.region = data.region;
      if (data.assignedRepId !== undefined) {
        existing.assignedRepId = this.resolveRepId(data.assignedRepId);
      } else if ((data as any).assignedRep !== undefined) {
        existing.assignedRepId = this.resolveRepId((data as any).assignedRep);
      }
      if (data.latitude !== undefined) existing.latitude = Number(data.latitude);
      if (data.longitude !== undefined) existing.longitude = Number(data.longitude);
      if (data.allowedVisitRadiusMeters !== undefined) existing.allowedVisitRadiusMeters = Number(data.allowedVisitRadiusMeters);
      if (data.isActive !== undefined) existing.isActive = data.isActive;
      existing.updatedAt = now;

      savedClient = existing;

      this.addAuditLog({
        userId: actorId,
        role: 'SYSTEM_ADMIN',
        action: 'CLIENT_UPDATED',
        entityType: 'CLIENT',
        entityId: existing.id,
        timestamp: now,
        oldValues,
        newValues: existing,
      });
    } else {
      const newClient: Client = {
        id: data.id || `cli_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        clientCode: data.clientCode || `CLI-${Date.now().toString().slice(-4)}`,
        name: data.name || 'عميل جديد',
        clientType: data.clientType || 'DOCTOR',
        doctorClass: data.doctorClass || 'B',
        specialty: data.specialty || '',
        phone: data.phone || '',
        address: data.address || '',
        region: data.region || 'المنطقة الوسطى',
        assignedRepId: this.resolveRepId(data.assignedRepId || (data as any).assignedRep || ''),
        latitude: Number(data.latitude) || 15.3533,
        longitude: Number(data.longitude) || 44.2045,
        allowedVisitRadiusMeters: Number(data.allowedVisitRadiusMeters) || 100,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now,
        updatedAt: now,
      };

      if (!this.store.clients) this.store.clients = [];
      this.store.clients.push(newClient);
      savedClient = newClient;

      this.addAuditLog({
        userId: actorId,
        role: 'SYSTEM_ADMIN',
        action: 'CLIENT_CREATED',
        entityType: 'CLIENT',
        entityId: newClient.id,
        timestamp: now,
        newValues: newClient,
      });
    }

    // Direct synchronization to customers table (with version increment for delta sync)
    if (!this.store.customers) this.store.customers = [];
    let custMatch = this.store.customers.find(
      c => c.id === `cust_${savedClient.id}` || 
           (savedClient.clientCode && c.customerCode === savedClient.clientCode) || 
           (savedClient.name && c.customerName?.trim().toLowerCase() === savedClient.name.trim().toLowerCase())
    );

    if (custMatch) {
      custMatch.customerName = savedClient.name;
      custMatch.customerCode = savedClient.clientCode;
      custMatch.ownerName = savedClient.specialty || savedClient.clientType || custMatch.ownerName || '';
      custMatch.phone = savedClient.phone;
      custMatch.address = savedClient.address;
      custMatch.region = savedClient.region;
      custMatch.latitude = savedClient.latitude;
      custMatch.longitude = savedClient.longitude;
      custMatch.allowedVisitRadiusMeters = savedClient.allowedVisitRadiusMeters;
      custMatch.assignedRepId = savedClient.assignedRepId;
      custMatch.isActive = savedClient.isActive;
      custMatch.updatedAt = now;
      custMatch.version += 1;
    } else {
      this.store.customers.push({
        id: `cust_${savedClient.id}`,
        customerCode: savedClient.clientCode,
        customerName: savedClient.name,
        ownerName: savedClient.specialty || savedClient.clientType || '',
        phone: savedClient.phone,
        address: savedClient.address,
        region: savedClient.region,
        latitude: savedClient.latitude,
        longitude: savedClient.longitude,
        allowedVisitRadiusMeters: savedClient.allowedVisitRadiusMeters,
        assignedRepId: savedClient.assignedRepId,
        isActive: savedClient.isActive,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    }

    this.saveToDisk();
    return savedClient;
  }

  public deleteClient(id: string, actorId: string): boolean {
    const idx = (this.store.clients || []).findIndex(c => c.id === id);
    if (idx === -1) return false;
    const removed = this.store.clients.splice(idx, 1)[0];

    // Synchronously deactivate or mark deleted in customers table
    const cust = (this.store.customers || []).find(
      c => c.id === `cust_${id}` || (removed.clientCode && c.customerCode === removed.clientCode)
    );
    if (cust) {
      cust.isDeleted = true;
      cust.isActive = false;
      cust.version += 1;
      cust.updatedAt = new Date().toISOString();
    }

    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'CLIENT_DELETED',
      entityType: 'CLIENT',
      entityId: id,
      timestamp: new Date().toISOString(),
      oldValues: removed,
    });

    this.saveToDisk();
    return true;
  }

  public bulkImportClients(clientsList: any[], actorId: string): { total: number; created: number; updated: number } {
    let created = 0;
    let updated = 0;
    let seqCounter = (this.store.clients || []).length + 1;

    for (const item of clientsList) {
      if (!item.clientCode || String(item.clientCode).trim() === '') {
        // Auto-generate code if client code is missing
        item.clientCode = `CLI-SNA-${Date.now().toString().slice(-4)}${String(seqCounter).padStart(3, '0')}`;
        seqCounter++;
      }

      const existing = (this.store.clients || []).find(c => c.clientCode === item.clientCode || (item.name && c.name?.trim().toLowerCase() === item.name.trim().toLowerCase()));
      if (existing) {
        this.upsertClient({ ...existing, ...item }, actorId);
        updated++;
      } else {
        this.upsertClient(item, actorId);
        created++;
      }
    }
    return { total: clientsList.length, created, updated };
  }

  // ==========================================
  // --- PHARMACIES (الصيدليات) MANAGEMENT ---
  // ==========================================
  public getAllPharmacies(region?: string, repId?: string, user?: User): Pharmacy[] {
    const repUser = user || (repId ? this.store.users.find(u => u.id === repId) : undefined);

    return (this.store.pharmacies || []).filter(p => {
      if (repId && repUser && repUser.role === 'SALES_REP') {
        if (isRepAssignedToCustomer(p.assignedRepId, repUser)) return true;
        const isUnassigned = !p.assignedRepId || p.assignedRepId.trim() === '';
        if (isUnassigned && isRegionMatch(p.region, repUser.assignedRegion, repUser.assignedRegionIds)) {
          return true;
        }
        return false;
      }

      if (region && region !== 'الكل' && !isRegionMatch(p.region, region)) return false;
      if (repId && p.assignedRepId !== repId) return false;
      return true;
    });
  }

  public upsertPharmacy(data: Partial<Pharmacy>, actorId: string): Pharmacy {
    const now = new Date().toISOString();
    let existing = (this.store.pharmacies || []).find(p => p.id === data.id || (data.pharmacyCode && p.pharmacyCode === data.pharmacyCode));

    if (existing) {
      const oldValues = { ...existing };
      if (data.name) existing.name = data.name;
      if (data.pharmacyCode) existing.pharmacyCode = data.pharmacyCode;
      if (data.pharmacistInCharge !== undefined) existing.pharmacistInCharge = data.pharmacistInCharge;
      if (data.licenseNumber !== undefined) existing.licenseNumber = data.licenseNumber;
      if (data.phone) existing.phone = data.phone;
      if (data.address) existing.address = data.address;
      if (data.region) existing.region = data.region;
      if (data.assignedRepId !== undefined) {
        existing.assignedRepId = this.resolveRepId(data.assignedRepId);
      } else if ((data as any).assignedRep !== undefined) {
        existing.assignedRepId = this.resolveRepId((data as any).assignedRep);
      }
      if (data.latitude !== undefined) existing.latitude = Number(data.latitude);
      if (data.longitude !== undefined) existing.longitude = Number(data.longitude);
      if (data.allowedVisitRadiusMeters !== undefined) existing.allowedVisitRadiusMeters = Number(data.allowedVisitRadiusMeters);
      if (data.isActive !== undefined) existing.isActive = data.isActive;
      existing.updatedAt = now;

      // Sync with customers table
      this.upsertCustomer({
        id: `cust_${existing.id}`,
        customerCode: existing.pharmacyCode,
        customerName: existing.name,
        ownerName: existing.pharmacistInCharge,
        phone: existing.phone,
        address: existing.address,
        region: existing.region,
        latitude: existing.latitude,
        longitude: existing.longitude,
        allowedVisitRadiusMeters: existing.allowedVisitRadiusMeters,
        assignedRepId: existing.assignedRepId,
        isActive: existing.isActive,
      }, actorId);

      this.addAuditLog({
        userId: actorId,
        role: 'SYSTEM_ADMIN',
        action: 'PHARMACY_UPDATED',
        entityType: 'PHARMACY',
        entityId: existing.id,
        timestamp: now,
        oldValues,
        newValues: existing,
      });

      this.saveToDisk();
      return existing;
    } else {
      const newPharmacy: Pharmacy = {
        id: data.id || `phr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        pharmacyCode: data.pharmacyCode || `PHR-${Date.now().toString().slice(-4)}`,
        name: data.name || 'صيدلية جديدة',
        pharmacistInCharge: data.pharmacistInCharge || 'صيدلي مسؤول',
        licenseNumber: data.licenseNumber || '',
        phone: data.phone || '',
        address: data.address || '',
        region: data.region || 'المنطقة الوسطى',
        assignedRepId: this.resolveRepId(data.assignedRepId || (data as any).assignedRep || ''),
        latitude: Number(data.latitude) || 15.3533,
        longitude: Number(data.longitude) || 44.2045,
        allowedVisitRadiusMeters: Number(data.allowedVisitRadiusMeters) || 100,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now,
        updatedAt: now,
      };

      if (!this.store.pharmacies) this.store.pharmacies = [];
      this.store.pharmacies.push(newPharmacy);

      // Sync to customers table
      this.upsertCustomer({
        id: `cust_${newPharmacy.id}`,
        customerCode: newPharmacy.pharmacyCode,
        customerName: newPharmacy.name,
        ownerName: newPharmacy.pharmacistInCharge,
        phone: newPharmacy.phone,
        address: newPharmacy.address,
        region: newPharmacy.region,
        latitude: newPharmacy.latitude,
        longitude: newPharmacy.longitude,
        allowedVisitRadiusMeters: newPharmacy.allowedVisitRadiusMeters,
        assignedRepId: newPharmacy.assignedRepId,
        isActive: newPharmacy.isActive,
      }, actorId);

      this.addAuditLog({
        userId: actorId,
        role: 'SYSTEM_ADMIN',
        action: 'PHARMACY_CREATED',
        entityType: 'PHARMACY',
        entityId: newPharmacy.id,
        timestamp: now,
        newValues: newPharmacy,
      });

      this.saveToDisk();
      return newPharmacy;
    }
  }

  public deletePharmacy(id: string, actorId: string): boolean {
    const idx = (this.store.pharmacies || []).findIndex(p => p.id === id);
    if (idx === -1) return false;
    const removed = this.store.pharmacies.splice(idx, 1)[0];
    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'PHARMACY_DELETED',
      entityType: 'PHARMACY',
      entityId: id,
      timestamp: new Date().toISOString(),
      oldValues: removed,
    });
    this.saveToDisk();
    return true;
  }

  public bulkImportPharmacies(pharmaciesList: any[], actorId: string): { total: number; created: number; updated: number } {
    let created = 0;
    let updated = 0;
    for (const item of pharmaciesList) {
      const existing = (this.store.pharmacies || []).find(p => p.pharmacyCode === item.pharmacyCode);
      if (existing) {
        this.upsertPharmacy({ ...existing, ...item }, actorId);
        updated++;
      } else {
        this.upsertPharmacy(item, actorId);
        created++;
      }
    }
    return { total: pharmaciesList.length, created, updated };
  }

  // ==========================================
  // --- USERS / REPS ASSIGNMENTS & BULK ---
  // ==========================================
  public updateUserAssignments(
    userId: string,
    updates: {
      assignedRegion?: string;
      assignedRegionIds?: string[];
      assignedProductIds?: string[];
      role?: UserRole;
      phone?: string;
      fullName?: string;
      isActive?: boolean;
    },
    actorId: string
  ): User {
    const user = this.store.users.find(u => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const oldValues = { ...user };
    const now = new Date().toISOString();

    if (updates.assignedRegion !== undefined) user.assignedRegion = updates.assignedRegion;
    if (updates.assignedRegionIds !== undefined) {
      user.assignedRegionIds = updates.assignedRegionIds;
      // Sync to regions' assignedRepIds
      for (const reg of (this.store.regions || [])) {
        const shouldHave = updates.assignedRegionIds.includes(reg.id);
        const repList = reg.assignedRepIds || [];
        const hasIt = repList.includes(userId);
        if (shouldHave && !hasIt) {
          reg.assignedRepIds = [...repList, userId];
          reg.updatedAt = now;
        } else if (!shouldHave && hasIt) {
          reg.assignedRepIds = repList.filter(id => id !== userId);
          reg.updatedAt = now;
        }
      }
    }
    if (updates.assignedProductIds !== undefined) {
      user.assignedProductIds = updates.assignedProductIds;
      // Sync to products' assignedRepIds
      for (const prod of (this.store.products || [])) {
        const shouldHave = updates.assignedProductIds.includes(prod.id);
        const repList = prod.assignedRepIds || [];
        const hasIt = repList.includes(userId);
        if (shouldHave && !hasIt) {
          prod.assignedRepIds = [...repList, userId];
          prod.updatedAt = now;
        } else if (!shouldHave && hasIt) {
          prod.assignedRepIds = repList.filter(id => id !== userId);
          prod.updatedAt = now;
        }
      }
    }
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.phone !== undefined) user.phone = updates.phone;
    if (updates.fullName !== undefined) user.fullName = updates.fullName;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    user.updatedAt = now;
    user.version += 1;

    this.addAuditLog({
      userId: actorId,
      role: 'SYSTEM_ADMIN',
      action: 'USER_ASSIGNMENTS_UPDATED',
      entityType: 'USER',
      entityId: user.id,
      timestamp: now,
      oldValues,
      newValues: user,
    });

    this.saveToDisk();
    return user;
  }

  public bulkImportUsers(usersList: any[], actorId: string): { total: number; created: number; updated: number } {
    let created = 0;
    let updated = 0;

    for (const item of usersList) {
      const existing = this.store.users.find(u => u.username?.toLowerCase() === String(item.username || '').toLowerCase());
      if (existing) {
        this.updateUserAssignments(existing.id, {
          fullName: item.fullName || existing.fullName,
          phone: item.phone || existing.phone,
          assignedRegion: item.assignedRegion || existing.assignedRegion,
          role: item.role || existing.role,
        }, actorId);
        updated++;
      } else {
        this.createUser(
          {
            username: item.username,
            fullName: item.fullName || item.username,
            role: item.role || 'SALES_REP',
            phone: item.phone || '',
            assignedRegion: item.assignedRegion || 'القاهرة الكبرى',
            isActive: true,
          },
          item.password || '123456',
          actorId
        );
        created++;
      }
    }

    return { total: usersList.length, created, updated };
  }
}

export const serverDb = new ServerDatabase();
