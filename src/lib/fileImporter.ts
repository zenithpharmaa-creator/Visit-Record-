/**
 * Master Data File Importer & Exporter
 * Supports Excel (.xlsx, .xls), CSV, and JSON for:
 * 1. المندوب (Sales Rep)
 * 2. المنطقة (Region / Territory)
 * 3. الصنف (Product / Item)
 * 4. العميل (Client / Doctor / Clinic / Hospital)
 * 5. الصيدلية (Pharmacy)
 */

import * as XLSX from 'xlsx';
import { Region, ProductItem, Client, Pharmacy, User } from '../types';

export type EntityType = 'REP' | 'REGION' | 'PRODUCT' | 'CLIENT' | 'PHARMACY';

export interface EntityMeta {
  type: EntityType;
  titleAr: string;
  descriptionAr: string;
  sampleRows: Record<string, any>[];
  headersAr: { key: string; labelAr: string; required: boolean; hint?: string }[];
}

export const ENTITY_METAS: Record<EntityType, EntityMeta> = {
  REP: {
    type: 'REP',
    titleAr: 'المناديب',
    descriptionAr: 'بيانات المندوبين والمشرفين ومناطق التغطية في صنعاء وضواحيها',
    headersAr: [
      { key: 'username', labelAr: 'اسم المستخدم', required: true, hint: 'اسم فريد لتسجيل الدخول' },
      { key: 'fullName', labelAr: 'الاسم الكامل للمندوب', required: true },
      { key: 'role', labelAr: 'الدور الوظيفي', required: true, hint: 'SALES_REP أو SALES_MANAGER' },
      { key: 'phone', labelAr: 'رقم الهاتف', required: true, hint: 'مثال: +967 77xxxxxxx' },
      { key: 'assignedRegion', labelAr: 'المنطقة الأساسية', required: true },
      { key: 'password', labelAr: 'كلمة المرور الافتراضية', required: false, hint: 'افتراضياً 123456' },
    ],
    sampleRows: [
      {
        'اسم المستخدم': 'rep_sanaa_hassan',
        'الاسم الكامل للمندوب': 'حسن محمد الحيمي (مندوب حدة والسبعين)',
        'الدور الوظيفي': 'SALES_REP',
        'رقم الهاتف': '+967 771234567',
        'المنطقة الأساسية': 'صنعاء - حدة والسبعين',
        'كلمة المرور الافتراضية': '123456',
      },
      {
        'اسم المستخدم': 'rep_sanaa_khalid',
        'الاسم الكامل للمندوب': 'خالد عبد الله المؤيد (مندوب التحرير والزبيري)',
        'الدور الوظيفي': 'SALES_REP',
        'رقم الهاتف': '+967 772345678',
        'المنطقة الأساسية': 'صنعاء - التحرير والزبيري',
        'كلمة المرور الافتراضية': '123456',
      },
      {
        'اسم المستخدم': 'rep_suburbs_ali',
        'الاسم الكامل للمندوب': 'علي يحيى الكبسي (مندوب ضواحي صنعاء - سنحان وهمدان)',
        'الدور الوظيفي': 'SALES_REP',
        'رقم الهاتف': '+967 773456789',
        'المنطقة الأساسية': 'ضواحي صنعاء - سنحان وهمدان',
        'كلمة المرور الافتراضية': '123456',
      },
    ],
  },
  REGION: {
    type: 'REGION',
    titleAr: 'المناطق',
    descriptionAr: 'المناطق والمربعات الجغرافية في أمانة العاصمة صنعاء وضواحيها',
    headersAr: [
      { key: 'code', labelAr: 'كود المنطقة', required: true, hint: 'مثال: REG-NORTH' },
      { key: 'name', labelAr: 'اسم المنطقة', required: true, hint: 'مثال: المنطقة الشمالية' },
      { key: 'section', labelAr: 'قسم المنطقة', required: true, hint: 'شمالية / جنوبية / وسطى' },
      { key: 'governorate', labelAr: 'المحافظة', required: true, hint: 'أمانة العاصمة صنعاء' },
      { key: 'description', labelAr: 'الوصف أو الملاحظات', required: false },
    ],
    sampleRows: [
      {
        'كود المنطقة': 'REG-NORTH',
        'اسم المنطقة': 'المنطقة الشمالية',
        'قسم المنطقة': 'شمالية',
        'المحافظة': 'أمانة العاصمة صنعاء',
        'الوصف أو الملاحظات': 'شعوب، الحصبة، الروضة، جولة الساعة، بني الحارث، شملان، والمطار',
      },
      {
        'كود المنطقة': 'REG-CENTER',
        'اسم المنطقة': 'المنطقة الوسطى',
        'قسم المنطقة': 'وسطى',
        'المحافظة': 'أمانة العاصمة صنعاء',
        'الوصف أو الملاحظات': 'التحرير، شارع الزبيري، القاع، الدائري، عصر، وباب اليمن',
      },
      {
        'كود المنطقة': 'REG-SOUTH',
        'اسم المنطقة': 'المنطقة الجنوبية',
        'قسم المنطقة': 'جنوبية',
        'المحافظة': 'أمانة العاصمة ومحافظة صنعاء (ضواحي)',
        'الوصف أو الملاحظات': 'حدة، السبعين، الحي السياسي، شميلة، حزيز، وضواحي سنحان ومتنة',
      },
    ],
  },
  PRODUCT: {
    type: 'PRODUCT',
    titleAr: 'الأصناف',
    descriptionAr: 'قائمة الأدوية والمستحضرات الطبية والأسعار بالريال اليمني',
    headersAr: [
      { key: 'itemCode', labelAr: 'كود الصنف', required: true, hint: 'مثال: PRD-101' },
      { key: 'name', labelAr: 'الاسم التجاري', required: true, hint: 'مثال: أوجمنتين 1 جم' },
      { key: 'scientificName', labelAr: 'الاسم العلمي', required: false, hint: 'مثال: Amoxicillin' },
      { key: 'category', labelAr: 'التصنيف الدوائي', required: true, hint: 'مضاد حيوي، مسكن، فيتامينات' },
      { key: 'unitPrice', labelAr: 'سعر الوحدة (ر.ي)', required: true },
      { key: 'packageSize', labelAr: 'العبوة / الشكل الدوائي', required: false, hint: 'علبة 14 قرص' },
    ],
    sampleRows: [
      {
        'كود الصنف': 'PRD-101',
        'الاسم التجاري': 'أوجمنتين 1 جم أقراص',
        'الاسم العلمي': 'Amoxicillin 875mg + Clavulanic Acid 125mg',
        'التصنيف الدوائي': 'مضادات حيوية',
        'سعر الوحدة (ر.ي)': 4800,
        'العبوة / الشكل الدوائي': 'علبة 14 قرص',
      },
      {
        'كود الصنف': 'PRD-102',
        'الاسم التجاري': 'بانادول إكسترا 500 مجم',
        'الاسم العلمي': 'Paracetamol 500mg + Caffeine 65mg',
        'التصنيف الدوائي': 'مسكن وخافض حرارة',
        'سعر الوحدة (ر.ي)': 1400,
        'العبوة / الشكل الدوائي': 'شريط 12 قرص',
      },
      {
        'كود الصنف': 'PRD-103',
        'الاسم التجاري': 'كتافلام 50 مجم سريعة المفعول',
        'الاسم العلمي': 'Diclofenac Potassium 50mg',
        'التصنيف الدوائي': 'مضاد للالتهاب',
        'سعر الوحدة (ر.ي)': 2200,
        'العبوة / الشكل الدوائي': 'علبة 20 قرص',
      },
      {
        'كود الصنف': 'PRD-104',
        'الاسم التجاري': 'أوميبرازول 20 مجم كبسول',
        'الاسم العلمي': 'Omeprazole 20mg',
        'التصنيف الدوائي': 'أدوية الجهاز الهضمي والمعدة',
        'سعر الوحدة (ر.ي)': 2800,
        'العبوة / الشكل الدوائي': 'علبة 14 كبسولة',
      },
    ],
  },
  CLIENT: {
    type: 'CLIENT',
    titleAr: 'العملاء (أطباء ومستشفيات صنعاء)',
    descriptionAr: 'المستشفيات والعيادات والمراكز التخصصية في صنعاء وضواحيها',
    headersAr: [
      { key: 'clientCode', labelAr: 'كود العميل', required: false, hint: 'اختياري: يتم توليده تلقائياً في حال تركه فارغاً (مثال: CLI-SNA-01)' },
      { key: 'name', labelAr: 'اسم العميل / الطبيب / المركز', required: true },
      { key: 'clientType', labelAr: 'نوع العميل', required: true, hint: 'DOCTOR / CLINIC / HOSPITAL' },
      { key: 'doctorClass', labelAr: 'الكلاس', required: false, hint: 'A / B / C' },
      { key: 'specialty', labelAr: 'التخصص الطبي', required: false, hint: 'باطنة، جراحة، أطفال، قلب' },
      { key: 'phone', labelAr: 'رقم الهاتف', required: true, hint: 'مثال: +967 1 xxxxxx أو 77xxxxxxx' },
      { key: 'address', labelAr: 'العنوان التفصيلي', required: true },
      { key: 'region', labelAr: 'المنطقة', required: true },
      { key: 'assignedRep', labelAr: 'اسم أو كود المندوب المسند له', required: false },
      { key: 'latitude', labelAr: 'خط العرض (Latitude)', required: false, hint: 'مثال: 15.3533' },
      { key: 'longitude', labelAr: 'خط الطول (Longitude)', required: false, hint: 'مثال: 44.2045' },
      { key: 'allowedVisitRadiusMeters', labelAr: 'نطاق الزيارة (متر)', required: false, hint: 'افتراضياً 100' },
    ],
    sampleRows: [
      {
        'كود العميل': 'CLI-SNA-01',
        'اسم العميل / الطبيب / المركز': 'هيئة مستشفى الثورة العام النموذجي',
        'نوع العميل': 'HOSPITAL',
        'الكلاس': 'A',
        'قسم المنطقة': 'وسطى',
        'التخصص الطبي': 'مستشفى حكومي وهيئة تعليمية كبرى',
        'رقم الهاتف': '+967 1 246966',
        'العنوان التفصيلي': 'شارع الزبيري، صنعاء',
        'المنطقة': 'المنطقة الوسطى',
        'اسم أو كود المندوب المسند له': 'rep_sanaa_khalid',
        'خط العرض (Latitude)': 15.3533,
        'خط الطول (Longitude)': 44.2045,
        'نطاق الزيارة (متر)': 200,
      },
      {
        'كود العميل': 'CLI-SNA-02',
        'اسم العميل / الطبيب / المركز': 'مستشفى جامعة العلوم والتكنولوجيا',
        'نوع العميل': 'HOSPITAL',
        'الكلاس': 'A',
        'قسم المنطقة': 'شمالية',
        'التخصص الطبي': 'مستشفى تخصصي وجراحة متقدمة',
        'رقم الهاتف': '+967 1 372700',
        'العنوان التفصيلي': 'شارع الستين الغربي، تقاطع مذبح، صنعاء',
        'المنطقة': 'المنطقة الشمالية',
        'اسم أو كود المندوب المسند له': 'rep_sanaa_hassan',
        'خط العرض (Latitude)': 15.3780,
        'خط الطول (Longitude)': 44.1680,
        'نطاق الزيارة (متر)': 200,
      },
      {
        'كود العميل': 'CLI-SNA-03',
        'اسم العميل / الطبيب / المركز': 'أ.د. عبد القادر المتوكل (مركز القلب)',
        'نوع العميل': 'DOCTOR',
        'الكلاس': 'A',
        'قسم المنطقة': 'جنوبية',
        'التخصص الطبي': 'استشاري أمراض القلب والشرايين',
        'رقم الهاتف': '+967 771122334',
        'العنوان التفصيلي': 'شارع حدة، أمام بريد حدة، صنعاء',
        'المنطقة': 'المنطقة الجنوبية',
        'اسم أو كود المندوب المسند له': 'rep_sanaa_hassan',
        'خط العرض (Latitude)': 15.3210,
        'خط الطول (Longitude)': 44.1950,
        'نطاق الزيارة (متر)': 100,
      },
      {
        'كود العميل': 'CLI-SNA-05',
        'اسم العميل / الطبيب / المركز': 'د. وليد الشرفي (عيادات النخبة)',
        'نوع العميل': 'DOCTOR',
        'الكلاس': 'B',
        'قسم المنطقة': 'وسطى',
        'التخصص الطبي': 'أخصائي أمراض باطنة وجهاز هضمي',
        'رقم الهاتف': '+967 773456789',
        'العنوان التفصيلي': 'شارع الزبيري، تقاطع عمان، صنعاء',
        'المنطقة': 'المنطقة الوسطى',
        'اسم أو كود المندوب المسند له': 'rep_sanaa_khalid',
        'خط العرض (Latitude)': 15.3480,
        'خط الطول (Longitude)': 44.1980,
        'نطاق الزيارة (متر)': 120,
      },
      {
        'كود العميل': 'CLI-SNA-08',
        'اسم العميل / الطبيب / المركز': 'د. بشرى الحداد',
        'نوع العميل': 'DOCTOR',
        'الكلاس': 'C',
        'قسم المنطقة': 'وسطى',
        'التخصص الطبي': 'طبيبة عامة ورعاية أولية',
        'رقم الهاتف': '+967 776789012',
        'العنوان التفصيلي': 'حي القاع، أمام المستشفى الجمهوري، صنعاء',
        'المنطقة': 'المنطقة الوسطى',
        'اسم أو كود المندوب المسند له': 'rep_sanaa_khalid',
        'خط العرض (Latitude)': 15.3510,
        'خط الطول (Longitude)': 44.1920,
        'نطاق الزيارة (متر)': 100,
      },
    ],
  },
  PHARMACY: {
    type: 'PHARMACY',
    titleAr: 'الصيدليات في صنعاء وضواحيها',
    descriptionAr: 'الصيدليات الأهلية والمراكز الصيدلانية في صنعاء وضواحيها',
    headersAr: [
      { key: 'pharmacyCode', labelAr: 'كود الصيدلية', required: true, hint: 'مثال: PHR-SNA-01' },
      { key: 'name', labelAr: 'اسم الصيدلية', required: true },
      { key: 'pharmacistInCharge', labelAr: 'اسم الصيدلي المسؤول', required: true },
      { key: 'licenseNumber', labelAr: 'رقم الترخيص', required: false },
      { key: 'phone', labelAr: 'رقم الهاتف', required: true, hint: 'مثال: +967 77xxxxxxx' },
      { key: 'address', labelAr: 'العنوان', required: true },
      { key: 'region', labelAr: 'المنطقة', required: true },
      { key: 'assignedRep', labelAr: 'اسم أو كود المندوب المسند له', required: false },
      { key: 'latitude', labelAr: 'خط العرض (Latitude)', required: false, hint: 'مثال: 15.3540' },
      { key: 'longitude', labelAr: 'خط الطول (Longitude)', required: false, hint: 'مثال: 44.2050' },
      { key: 'allowedVisitRadiusMeters', labelAr: 'نطاق الزيارة (متر)', required: false, hint: 'افتراضياً 100' },
    ],
    sampleRows: [
      {
        'كود الصيدلية': 'PHR-SNA-01',
        'اسم الصيدلية': 'صيدلية ابن حيان النموذجية',
        'اسم الصيدلي المسؤول': 'د. إبراهيم محمد المؤيد',
        'رقم الترخيص': 'LIC-SNA-2024-118',
        'رقم الهاتف': '+967 1 240001',
        'العنوان': 'شارع الزبيري، أمام هيئة مستشفى الثورة، صنعاء',
        'المنطقة': 'صنعاء - التحرير والزبيري',
        'اسم أو كود المندوب المسند له': 'rep_sanaa_khalid',
        'خط العرض (Latitude)': 15.3540,
        'خط الطول (Longitude)': 44.2050,
        'نطاق الزيارة (متر)': 100,
      },
      {
        'كود الصيدلية': 'PHR-SNA-02',
        'اسم الصيدلية': 'صيدلية الشفاء الدولية',
        'اسم الصيدلي المسؤول': 'د. وفاء عبد الله الكبسي',
        'رقم الترخيص': 'LIC-SNA-2023-455',
        'رقم الهاتف': '+967 1 445566',
        'العنوان': 'شارع حدة، جولة الرويشان، صنعاء',
        'المنطقة': 'صنعاء - حدة والسبعين',
        'اسم أو كود المندوب المسند له': 'rep_sanaa_hassan',
        'خط العرض (Latitude)': 15.3245,
        'خط الطول (Longitude)': 44.1985,
        'نطاق الزيارة (متر)': 120,
      },
      {
        'كود الصيدلية': 'PHR-SNA-03',
        'اسم الصيدلية': 'صيدلية الدواء الحديث - فرع مذبح',
        'اسم الصيدلي المسؤول': 'د. عادل قاسم الشامي',
        'رقم الترخيص': 'LIC-SNA-2025-072',
        'رقم الهاتف': '+967 777123456',
        'العنوان': 'شارع الستين الغربي، تقاطع مذبح، صنعاء',
        'المنطقة': 'صنعاء - الستين ومذبح',
        'اسم أو كود المندوب المسند له': 'rep_sanaa_hassan',
        'خط العرض (Latitude)': 15.3765,
        'خط الطول (Longitude)': 44.1695,
        'نطاق الزيارة (متر)': 100,
      },
      {
        'كود الصيدلية': 'PHR-SUB-04',
        'اسم الصيدلية': 'صيدلية سنحان الكبرى',
        'اسم الصيدلي المسؤول': 'د. يحيى علي الحيمي',
        'رقم الترخيص': 'LIC-SUB-2023-890',
        'رقم الهاتف': '+967 770987654',
        'العنوان': 'الشارع العام، ريمة حميد، سنحان',
        'المنطقة': 'ضواحي صنعاء - سنحان وهمدان',
        'اسم أو كود المندوب المسند له': 'rep_suburbs_ali',
        'خط العرض (Latitude)': 15.2810,
        'خط الطول (Longitude)': 44.2320,
        'نطاق الزيارة (متر)': 120,
      },
    ],
  },
};

/**
 * Downloads a ready-to-fill Excel template for the specified entity type
 */
export function downloadTemplateExcel(type: EntityType): void {
  const meta = ENTITY_METAS[type];
  const worksheet = XLSX.utils.json_to_sheet(meta.sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, meta.titleAr);
  XLSX.writeFile(workbook, `نموذج_إدراج_${meta.titleAr.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Downloads a ready-to-fill CSV template for the specified entity type
 */
export function downloadTemplateCsv(type: EntityType): void {
  const meta = ENTITY_METAS[type];
  const worksheet = XLSX.utils.json_to_sheet(meta.sampleRows);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  
  // Add UTF-8 BOM so Excel opens Arabic correctly
  const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `نموذج_إدراج_${meta.titleAr.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports data list to Excel (.xlsx) file
 */
export function exportDataToExcel(title: string, data: Record<string, any>[]): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title.substring(0, 30));
  XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0, 10)}.xlsx`);
}

/**
 * Parse an uploaded file (.xlsx, .xls, .csv, .json) into standardized records
 */
export async function parseUploadedFile(file: File, type: EntityType): Promise<{
  success: boolean;
  records: any[];
  errors: string[];
  totalRows: number;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      console.log('[DEBUG] Reader onload triggered for:', file.name);
      try {
        const data = e.target?.result;
        if (!data) {
          return resolve({ success: false, records: [], errors: ['الملف فارغ أو تعذر قراءته'], totalRows: 0 });
        }

        let rawRows: any[] = [];

        if (file.name.endsWith('.json')) {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          const parsed = JSON.parse(text);
          rawRows = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          // Excel or CSV via XLSX
          const workbook = XLSX.read(data, { type: 'array', raw: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        }

        if (!rawRows || rawRows.length === 0) {
          return resolve({ success: false, records: [], errors: ['لم يتم العثور على أي صفوف في الملف المرفوع'], totalRows: 0 });
        }

        // Map and validate rows according to entity meta
        const meta = ENTITY_METAS[type];
        const normalizedRecords: any[] = [];
        const errors: string[] = [];

        rawRows.forEach((row: any, idx: number) => {
          const rowNum = idx + 2; // considering header is row 1
          const normalized: any = {};

          // Match each field either by Arabic label or English key
          meta.headersAr.forEach((hdr) => {
            let val = row[hdr.labelAr];
            if (val === undefined || val === '') {
              val = row[hdr.key];
            }
            if (val === undefined || val === '') {
              // Check case-insensitive
              const foundKey = Object.keys(row).find(
                (k) => k.trim().toLowerCase() === hdr.labelAr.toLowerCase() || k.trim().toLowerCase() === hdr.key.toLowerCase()
              );
              if (foundKey) val = row[foundKey];
            }

            if (hdr.required && (val === undefined || val === null || String(val).trim() === '')) {
              errors.push(`صف ${rowNum}: حقل "${hdr.labelAr}" مطلوب.`);
            }

            normalized[hdr.key] = val !== undefined && val !== null ? String(val).trim() : '';
          });

          // Entity-specific transformations & number parsings
          if (type === 'PRODUCT') {
            normalized.unitPrice = parseFloat(normalized.unitPrice) || 0;
          }

          if (type === 'CLIENT') {
            // Auto-generate client code if omitted or empty in uploaded file
            if (!normalized.clientCode || normalized.clientCode.trim() === '') {
              const seq = String(idx + 1).padStart(3, '0');
              normalized.clientCode = `CLI-SNA-${Date.now().toString().slice(-4)}${seq}`;
            }
            if (!normalized.doctorClass || normalized.doctorClass.trim() === '') {
              if (normalized.clientType === 'HOSPITAL' || normalized.specialty?.includes('استشاري')) normalized.doctorClass = 'A';
              else if (normalized.specialty?.includes('أخصائي')) normalized.doctorClass = 'B';
              else normalized.doctorClass = 'C';
            }
          }

          if (type === 'PHARMACY') {
            if (!normalized.pharmacyCode || normalized.pharmacyCode.trim() === '') {
              const seq = String(idx + 1).padStart(3, '0');
              normalized.pharmacyCode = `PHR-SNA-${Date.now().toString().slice(-4)}${seq}`;
            }
          }

          if (type === 'REP') {
            if (!normalized.role) normalized.role = 'SALES_REP';
          }

          normalizedRecords.push(normalized);
        });

        resolve({
          success: errors.length === 0,
          records: normalizedRecords,
          errors,
          totalRows: rawRows.length,
        });
      } catch (err: any) {
        console.error('[DEBUG] Parsing error:', err);
        resolve({
          success: false,
          records: [],
          errors: [`حدث خطأ أثناء معالجة الملف: ${err.message || 'تنسيق الملف غير صالح'}`, 'تأكد من اختيار الملف الصحيح للتنسيق المحدد'],
          totalRows: 0,
        });
      }
    };

    reader.onerror = (e) => {
      console.error('[DEBUG] Reader error:', e);
      resolve({ success: false, records: [], errors: ['تعذر قراءة الملف من الجهاز'], totalRows: 0 });
    };

    reader.onabort = () => {
      console.warn('[DEBUG] Reader aborted');
      resolve({ success: false, records: [], errors: ['تم إلغاء قراءة الملف'], totalRows: 0 });
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}
