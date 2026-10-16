/**
 * Field Visit Tracker - Domain Type Definitions
 */

export type UserRole = 'SYSTEM_ADMIN' | 'SALES_MANAGER' | 'SALES_REP';

export interface User {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  role: UserRole;
  phone: string;
  assignedRegion: string;
  assignedRegionIds?: string[];
  assignedProductIds?: string[];
  customPermissions?: string[];
  passwordHash?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PermissionDefinition {
  id: string;
  nameAr: string;
  descriptionAr: string;
  category: string;
  dangerLevel?: 'normal' | 'warning' | 'danger';
}

export interface RolePermissionsMatrix {
  SYSTEM_ADMIN: string[];
  SALES_MANAGER: string[];
  SALES_REP: string[];
  userOverrides?: Record<string, string[]>;
}

export type RegionSection = 'شمالية' | 'جنوبية' | 'وسطى';
export type BoundaryBasis = 'TEAM_AGREEMENT' | 'CITY_GEOGRAPHY';
export type DoctorClass = 'A' | 'B' | 'C';

export interface Region {
  id: string;
  code: string;
  name: string;
  section?: 'شمالية' | 'جنوبية' | 'وسطى';
  governorate: string;
  description?: string;
  boundaryBasis?: 'TEAM_AGREEMENT' | 'CITY_GEOGRAPHY';
  agreedBoundaries?: string;
  teamAgreement?: string;
  approvedByAdmin?: boolean;
  assignedRepIds?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductItem {
  id: string;
  itemCode: string;
  name: string;
  scientificName?: string;
  category: string;
  unitPrice: number;
  packageSize?: string;
  assignedRepIds?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClientType = 'DOCTOR' | 'CLINIC' | 'HOSPITAL' | 'HEALTH_CENTER' | 'DISTRIBUTOR';

export interface Client {
  id: string;
  clientCode: string;
  name: string;
  clientType: ClientType;
  doctorClass?: DoctorClass;
  regionSection?: RegionSection;
  specialty?: string;
  phone: string;
  email?: string;
  address: string;
  region: string;
  assignedRepId?: string;
  assignedPharmacyIds?: string[];
  latitude: number;
  longitude: number;
  allowedVisitRadiusMeters: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Pharmacy {
  id: string;
  pharmacyCode: string;
  name: string;
  pharmacistInCharge: string;
  licenseNumber?: string;
  phone: string;
  email?: string;
  address: string;
  region: string;
  assignedRepId?: string;
  latitude: number;
  longitude: number;
  allowedVisitRadiusMeters: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  customerCode: string; // Must strictly preserve leading zeros (e.g., "010001")
  customerName: string;
  ownerName: string;
  phone: string;
  email?: string;
  address: string;
  region: string;
  latitude: number;
  longitude: number;
  allowedVisitRadiusMeters: number;
  assignedRepId?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type VisitState = 
  | 'DRAFT'
  | 'STARTED'
  | 'COMPLETED'
  | 'PENDING_SYNC'
  | 'SYNCING'
  | 'SYNCED'
  | 'SYNC_FAILED'
  | 'REVIEW_REQUIRED';

export type LocationStatus = 
  | 'WITHIN_RADIUS'
  | 'OUTSIDE_RADIUS'
  | 'GPS_UNAVAILABLE'
  | 'LOW_ACCURACY'
  | 'LOCATION_PENDING'
  | 'OFFLINE_SAVED_PENDING_MATCH';

export interface Visit {
  visitId: string; // Acts as Idempotency Key
  userId: string;
  customerId: string;
  deviceInstallationId: string;
  state: VisitState;
  
  // Device & GPS Start metadata
  startTimeDevice: string;
  startTimeGps?: string | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  startAccuracy?: number | null;
  startGpsProvider?: string | null;
  isStartMock: boolean;
  
  // Device & GPS End metadata
  endTimeDevice?: string | null;
  endTimeGps?: string | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  endAccuracy?: number | null;
  endGpsProvider?: string | null;
  isEndMock: boolean;
  
  visitDurationSeconds?: number | null;
  
  // Customer baseline at time of visit
  customerLatitudeAtVisit: number;
  customerLongitudeAtVisit: number;
  customerRadiusAtVisit: number;
  
  distanceMeters?: number | null;
  locationStatus: LocationStatus;
  notes?: string | null;
  visitOutcome?: string | null;
  visitType?: string | null;
  
  // Server timestamp
  serverReceivedTimestamp?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'SYNCED' | 'FAILED';

export interface SyncQueueItem {
  queueId: string;
  visitId: string;
  syncStatus: SyncStatus;
  retryCount: number;
  lastSyncAttempt?: string | null;
  lastSyncError?: string | null;
  createdAt: string;
  syncedAt?: string | null;
}

export interface AuditLog {
  auditId: string;
  userId: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string;
  deviceId?: string | null;
  timestamp: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface AppConfiguration {
  configVersion: number;
  minSupportedAppVersion: string;
  gpsAccuracyThresholdMeters: number;
  defaultVisitRadiusMeters: number;
  syncIntervalMinutes: number;
  maxSyncRetryCount: number;
  enableVisitPhotos: boolean;
  enableAdvancedReports: boolean;
  enableMap: boolean;
  enableRouteTracking: boolean;
  allowedVisitTypes: string[];
  allowedVisitOutcomes: string[];
  isActive: boolean;
  updatedBy: string;
  createdAt: string;
}

export interface DailyReportSummary {
  date: string;
  totalVisits: number;
  withinRadius: number;
  outsideRadius: number;
  gpsUnavailable: number;
  lowAccuracy: number;
  mockLocationWarnings: number;
  pendingSync: number;
  syncFailed: number;
  activeRepsCount: number;
}
