/**
 * Local Room-like Persistent Offline Engine for Android Field Sales Rep Client
 * Uses Capacitor Preferences (Native Android Key-Value Storage Engine) & IndexedDB
 * as the Single Source of Truth for zero-loss offline data persistence.
 */

import { Preferences } from '@capacitor/preferences';
import { Customer, Visit, SyncQueueItem, AppConfiguration, AuditLog, LocationStatus, VerificationStatus } from '../types';
import { calculateHaversineDistanceMeters, evaluateLocationStatus } from './haversine';
import { nativeSQLiteEngine } from './sqliteEngine';

const DB_PREFIX = 'fvt_offline_db_v1';
const STORAGE_KEYS = {
  CUSTOMERS: `${DB_PREFIX}_customers`,
  VISITS: `${DB_PREFIX}_visits`,
  SYNC_QUEUE: `${DB_PREFIX}_sync_queue`,
  CONFIGURATION: `${DB_PREFIX}_app_config`,
  AUDIT_LOGS: `${DB_PREFIX}_audit_logs`,
  AUTH_TOKEN: `${DB_PREFIX}_auth_token`,
  CURRENT_USER: `${DB_PREFIX}_current_user`,
  CONFIG_VERSION: `${DB_PREFIX}_config_version`,
  LAST_CUSTOMER_VERSION: `${DB_PREFIX}_last_cust_version`,
};

class OfflineRoomDatabase {
  private memoryCache: {
    customers: Customer[];
    visits: Visit[];
    syncQueue: SyncQueueItem[];
    config: AppConfiguration | null;
    auditLogs: AuditLog[];
  } = {
    customers: [],
    visits: [],
    syncQueue: [],
    config: null,
    auditLogs: [],
  };

  private isInitialized = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1. Initialize Native SQLite Engine
      await nativeSQLiteEngine.initialize();

      // 2. Load stored customers
      const custPref = await Preferences.get({ key: STORAGE_KEYS.CUSTOMERS });
      const rawCustomers = custPref.value || localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (rawCustomers) this.memoryCache.customers = JSON.parse(rawCustomers);

      // 3. Load stored visits
      const visitsPref = await Preferences.get({ key: STORAGE_KEYS.VISITS });
      const rawVisits = visitsPref.value || localStorage.getItem(STORAGE_KEYS.VISITS);
      if (rawVisits) this.memoryCache.visits = JSON.parse(rawVisits);

      // 4. Load stored sync queue
      const queuePref = await Preferences.get({ key: STORAGE_KEYS.SYNC_QUEUE });
      const rawQueue = queuePref.value || localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      if (rawQueue) this.memoryCache.syncQueue = JSON.parse(rawQueue);

      // 5. Load app config
      const configPref = await Preferences.get({ key: STORAGE_KEYS.CONFIGURATION });
      const rawConfig = configPref.value || localStorage.getItem(STORAGE_KEYS.CONFIGURATION);
      if (rawConfig) this.memoryCache.config = JSON.parse(rawConfig);

      // 6. Load audit logs
      const auditPref = await Preferences.get({ key: STORAGE_KEYS.AUDIT_LOGS });
      const rawAudit = auditPref.value || localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (rawAudit) this.memoryCache.auditLogs = JSON.parse(rawAudit);

      this.isInitialized = true;
    } catch (e) {
      console.error('[OfflineRoomDB] Persistent storage initialization error:', e);
    }
  }

  private async persist(key: string, data: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(data);
      localStorage.setItem(key, jsonString);
      await Preferences.set({ key, value: jsonString });
    } catch (e) {
      console.error(`[OfflineRoomDB] Failed to write ${key} to persistent storage:`, e);
    }
  }

  // --- Auth & Session Storage ---
  public async setSession(token: string, user: any): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    await Preferences.set({ key: STORAGE_KEYS.AUTH_TOKEN, value: token });
    await Preferences.set({ key: STORAGE_KEYS.CURRENT_USER, value: JSON.stringify(user) });
  }

  public getSession() {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const rawUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return {
      token,
      user: rawUser ? JSON.parse(rawUser) : null,
    };
  }

  public async clearSession(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    await Preferences.remove({ key: STORAGE_KEYS.AUTH_TOKEN });
    await Preferences.remove({ key: STORAGE_KEYS.CURRENT_USER });
  }

  // --- Configuration Management ---
  public getAppConfig(): AppConfiguration | null {
    return this.memoryCache.config;
  }

  public async saveAppConfig(config: AppConfiguration): Promise<void> {
    this.memoryCache.config = config;
    await this.persist(STORAGE_KEYS.CONFIGURATION, config);
    localStorage.setItem(STORAGE_KEYS.CONFIG_VERSION, String(config.configVersion));
    await Preferences.set({ key: STORAGE_KEYS.CONFIG_VERSION, value: String(config.configVersion) });
  }

  // --- Customers Local Store & Delta Sync ---
  public getLocalCustomers(searchQuery?: string, region?: string): Customer[] {
    return this.memoryCache.customers.filter(c => {
      if (c.isDeleted || !c.isActive) return false;
      if (region && region !== 'الكل' && c.region !== region) return false;
      if (searchQuery) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = c.customerName.toLowerCase().includes(query);
        const matchCode = c.customerCode.toLowerCase().includes(query);
        const matchOwner = (c.ownerName || '').toLowerCase().includes(query);
        const matchPhone = (c.phone || '').includes(query);
        return matchName || matchCode || matchOwner || matchPhone;
      }
      return true;
    });
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.memoryCache.customers.find(c => c.id === id);
  }

  public async applyCustomersDelta(newCustomers: Customer[], latestVersion: number): Promise<void> {
    const existingMap = new Map<string, Customer>(this.memoryCache.customers.map(c => [c.id, c]));

    for (const item of newCustomers) {
      existingMap.set(item.id, {
        ...item,
        customerCode: String(item.customerCode), // Guarantee string preservation!
      });
    }

    this.memoryCache.customers = Array.from(existingMap.values());
    await this.persist(STORAGE_KEYS.CUSTOMERS, this.memoryCache.customers);
    localStorage.setItem(STORAGE_KEYS.LAST_CUSTOMER_VERSION, String(latestVersion));
    await Preferences.set({ key: STORAGE_KEYS.LAST_CUSTOMER_VERSION, value: String(latestVersion) });
  }

  public getLastCustomerVersion(): number {
    return parseInt(localStorage.getItem(STORAGE_KEYS.LAST_CUSTOMER_VERSION) || '0', 10);
  }

  // --- Visits Room Engine ---
  public getVisits(): Visit[] {
    return this.memoryCache.visits;
  }

  public getUncompletedVisit(userId: string): Visit | undefined {
    return this.memoryCache.visits.find(v => v.userId === userId && v.state === 'STARTED');
  }

  public startVisit(params: {
    userId: string;
    customer: Customer;
    deviceInstallationId: string;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    provider?: string | null;
    isMock?: boolean;
    configThreshold?: number;
    visitedProducts?: string[];
  }): Visit {
    const now = new Date().toISOString();
    const visitId = `vis_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    let distanceMeters: number | null = null;
    if (params.lat !== undefined && params.lat !== null && params.lng !== undefined && params.lng !== null) {
      distanceMeters = calculateHaversineDistanceMeters(
        params.lat,
        params.lng,
        params.customer.latitude,
        params.customer.longitude
      );
    }

    const locationStatus: LocationStatus = evaluateLocationStatus(
      distanceMeters,
      params.customer.allowedVisitRadiusMeters,
      params.accuracy,
      params.configThreshold || 30
    );

    const newVisit: Visit = {
      visitId,
      userId: params.userId,
      customerId: params.customer.id,
      deviceInstallationId: params.deviceInstallationId,
      state: 'STARTED',

      startTimeDevice: now,
      startTimeGps: now,
      startLatitude: params.lat,
      startLongitude: params.lng,
      startAccuracy: params.accuracy,
      startGpsProvider: params.provider || 'fused',
      isStartMock: params.isMock || false,

      isEndMock: false,

      customerLatitudeAtVisit: params.customer.latitude,
      customerLongitudeAtVisit: params.customer.longitude,
      customerRadiusAtVisit: params.customer.allowedVisitRadiusMeters,

      distanceMeters,
      locationStatus,
      visitedProducts: params.visitedProducts || [],
      createdAt: now,
      updatedAt: now,
    };

    const newSyncItem: SyncQueueItem = {
      queueId: `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      visitId,
      syncStatus: 'PENDING',
      retryCount: 0,
      createdAt: now,
    };

    // Execute Atomic Native SQLite Transaction
    nativeSQLiteEngine.executeAtomicVisitCreation(newVisit, newSyncItem).catch(err => {
      console.error('[OfflineRoomDB] Native SQLite Atomic Transaction error:', err);
    });

    this.memoryCache.visits.unshift(newVisit);
    this.memoryCache.syncQueue.unshift(newSyncItem);
    this.persist(STORAGE_KEYS.VISITS, this.memoryCache.visits);
    this.persist(STORAGE_KEYS.SYNC_QUEUE, this.memoryCache.syncQueue);

    this.addAuditLog({
      userId: params.userId,
      role: 'SALES_REP',
      action: 'VISIT_STARTED',
      entityType: 'VISIT',
      entityId: visitId,
      timestamp: now,
      metadata: { customerCode: params.customer.customerCode, locationStatus },
    });

    return newVisit;
  }

  public endVisit(params: {
    visitId: string;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    provider?: string | null;
    isMock?: boolean;
    notes?: string;
    visitOutcome?: string;
    visitType?: string;
    visitedProducts?: string[];
  }): Visit {
    const visit = this.memoryCache.visits.find(v => v.visitId === params.visitId);
    if (!visit) throw new Error(`Visit ${params.visitId} not found`);

    const now = new Date().toISOString();
    visit.endTimeDevice = now;
    visit.endTimeGps = now;
    visit.endLatitude = params.lat;
    visit.endLongitude = params.lng;
    visit.endAccuracy = params.accuracy;
    visit.endGpsProvider = params.provider || 'fused';
    visit.isEndMock = params.isMock || false;
    visit.notes = params.notes;
    visit.visitOutcome = params.visitOutcome;
    visit.visitType = params.visitType;
    visit.visitedProducts = params.visitedProducts;

    // Calculate duration in seconds
    const startMs = new Date(visit.startTimeDevice).getTime();
    const endMs = new Date(now).getTime();
    visit.visitDurationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));

    // Update location distance if end GPS available
    if (params.lat && params.lng) {
      visit.distanceMeters = calculateHaversineDistanceMeters(
        params.lat,
        params.lng,
        visit.customerLatitudeAtVisit,
        visit.customerLongitudeAtVisit
      );
      visit.locationStatus = evaluateLocationStatus(
        visit.distanceMeters,
        visit.customerRadiusAtVisit,
        params.accuracy
      );
    }

    visit.state = 'PENDING_SYNC';
    visit.updatedAt = now;

    // Queue for sync
    this.addToSyncQueue(visit.visitId);

    this.persist(STORAGE_KEYS.VISITS, this.memoryCache.visits);

    this.addAuditLog({
      userId: visit.userId,
      role: 'SALES_REP',
      action: 'VISIT_COMPLETED',
      entityType: 'VISIT',
      entityId: visit.visitId,
      timestamp: now,
      metadata: { durationSeconds: visit.visitDurationSeconds, locationStatus: visit.locationStatus },
    });

    return visit;
  }

  // --- Sync Queue Engine ---
  public getPendingSyncQueue(): SyncQueueItem[] {
    return this.memoryCache.syncQueue.filter(q => q.syncStatus === 'PENDING' || q.syncStatus === 'FAILED');
  }

  public getAllSyncQueue(): SyncQueueItem[] {
    return this.memoryCache.syncQueue;
  }

  private addToSyncQueue(visitId: string) {
    const existing = this.memoryCache.syncQueue.find(q => q.visitId === visitId);
    if (!existing) {
      const now = new Date().toISOString();
      this.memoryCache.syncQueue.push({
        queueId: `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        visitId,
        syncStatus: 'PENDING',
        retryCount: 0,
        createdAt: now,
      });
      this.persist(STORAGE_KEYS.SYNC_QUEUE, this.memoryCache.syncQueue);
    }
  }

  public async markVisitsSynced(
    syncedVisitIds: string[],
    verificationResults?: Array<{ visitId: string; verificationStatus: VerificationStatus; verificationReason?: string | null }>
  ): Promise<void> {
    const now = new Date().toISOString();
    const verMap = new Map<string, { status: VerificationStatus; reason?: string | null }>();
    if (verificationResults) {
      for (const item of verificationResults) {
        verMap.set(item.visitId, { status: item.verificationStatus, reason: item.verificationReason });
      }
    }

    for (const id of syncedVisitIds) {
      const visit = this.memoryCache.visits.find(v => v.visitId === id);
      if (visit) {
        visit.state = 'SYNCED';
        if (verMap.has(id)) {
          visit.verificationStatus = verMap.get(id)!.status;
          visit.verificationReason = verMap.get(id)!.reason;
        }
      }

      const queueItem = this.memoryCache.syncQueue.find(q => q.visitId === id);
      if (queueItem) {
        queueItem.syncStatus = 'SYNCED';
        queueItem.syncedAt = now;
      }
    }
    await this.persist(STORAGE_KEYS.VISITS, this.memoryCache.visits);
    await this.persist(STORAGE_KEYS.SYNC_QUEUE, this.memoryCache.syncQueue);
  }

  public async markVisitSyncFailed(visitId: string, errorMsg: string): Promise<void> {
    const queueItem = this.memoryCache.syncQueue.find(q => q.visitId === visitId);
    if (queueItem) {
      queueItem.syncStatus = 'FAILED';
      queueItem.retryCount += 1;
      queueItem.lastSyncAttempt = new Date().toISOString();
      queueItem.lastSyncError = errorMsg;
    }
    const visit = this.memoryCache.visits.find(v => v.visitId === visitId);
    if (visit) {
      visit.state = 'SYNC_FAILED';
    }
    await this.persist(STORAGE_KEYS.VISITS, this.memoryCache.visits);
    await this.persist(STORAGE_KEYS.SYNC_QUEUE, this.memoryCache.syncQueue);
  }

  // --- Audit Logs ---
  public async addAuditLog(log: Omit<AuditLog, 'auditId'>): Promise<void> {
    const newLog: AuditLog = {
      ...log,
      auditId: `audit_client_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
    this.memoryCache.auditLogs.unshift(newLog);
    await this.persist(STORAGE_KEYS.AUDIT_LOGS, this.memoryCache.auditLogs);
  }

  public getLocalAuditLogs(): AuditLog[] {
    return this.memoryCache.auditLogs;
  }
}

export const offlineRoomDb = new OfflineRoomDatabase();
