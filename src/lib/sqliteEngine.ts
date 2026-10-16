/**
 * Native Android SQLite Database Engine
 * Powered by @capacitor-community/sqlite
 * Single Source of Truth for Android Production Persistence
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Customer, Visit, SyncQueueItem, AppConfiguration, AuditLog } from '../types';

export const DATABASE_NAME = 'field_visit_tracker_sqlite';
export const DATABASE_SCHEMA_VERSION = 1;

class NativeSQLiteEngine {
  private sqliteConnection: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);
        const ret = await this.sqliteConnection.checkConnectionsConsistency();
        const isConn = (await this.sqliteConnection.isConnection(DATABASE_NAME, false)).result;

        if (ret.result && isConn) {
          this.db = await this.sqliteConnection.retrieveConnection(DATABASE_NAME, false);
        } else {
          this.db = await this.sqliteConnection.createConnection(
            DATABASE_NAME,
            false,
            'no-encryption',
            DATABASE_SCHEMA_VERSION,
            false
          );
        }

        await this.db.open();
        await this.applySchemaMigrations();
        this.isInitialized = true;
        console.log('[NativeSQLite] Successfully initialized Native SQLite Database:', DATABASE_NAME);
      } catch (err) {
        console.error('[NativeSQLite] CRITICAL: Failed to open Native SQLite Database on Android Production:', err);
        // Throw explicit error on Android Production rather than silently degrading
        throw new Error('فشل فتح قاعدة البيانات المحلية (Native SQLite Initialization Failed). يرجى التأكد من صلاحيات الجهاز.');
      }
    } else {
      // Web Development Mode Adapter Init
      this.isInitialized = true;
      console.log('[NativeSQLite] Running in Web Development Adapter Mode.');
    }
  }

  private async applySchemaMigrations(): Promise<void> {
    if (!this.db) return;

    const schemaStatements = `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        customer_code TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        owner_name TEXT,
        phone TEXT,
        address TEXT,
        region TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        allowed_visit_radius_meters REAL NOT NULL DEFAULT 100.0,
        is_active INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS visits (
        visit_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        device_installation_id TEXT NOT NULL,
        state TEXT NOT NULL,
        start_time_device TEXT NOT NULL,
        start_time_gps TEXT,
        start_latitude REAL,
        start_longitude REAL,
        start_accuracy REAL,
        start_gps_provider TEXT,
        is_start_mock INTEGER DEFAULT 0,
        end_time_device TEXT,
        end_time_gps TEXT,
        end_latitude REAL,
        end_longitude REAL,
        end_accuracy REAL,
        end_gps_provider TEXT,
        is_end_mock INTEGER DEFAULT 0,
        visit_duration_seconds INTEGER,
        customer_latitude_at_visit REAL NOT NULL,
        customer_longitude_at_visit REAL NOT NULL,
        customer_radius_at_visit REAL NOT NULL,
        distance_meters REAL,
        location_status TEXT NOT NULL,
        notes TEXT,
        visit_outcome TEXT,
        visit_type TEXT,
        server_received_timestamp TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        queue_id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL UNIQUE,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER DEFAULT 0,
        last_sync_attempt TEXT,
        last_sync_error TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        FOREIGN KEY (visit_id) REFERENCES visits (visit_id)
      );

      CREATE TABLE IF NOT EXISTS app_configuration (
        config_version INTEGER PRIMARY KEY,
        min_supported_app_version TEXT NOT NULL,
        gps_accuracy_threshold_meters REAL NOT NULL,
        default_visit_radius_meters REAL NOT NULL,
        sync_interval_minutes INTEGER NOT NULL,
        max_sync_retry_count INTEGER NOT NULL,
        enable_visit_photos INTEGER DEFAULT 0,
        enable_advanced_reports INTEGER DEFAULT 1,
        enable_map INTEGER DEFAULT 1,
        enable_route_tracking INTEGER DEFAULT 0,
        allowed_visit_types TEXT NOT NULL,
        allowed_visit_outcomes TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        updated_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        audit_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        device_id TEXT,
        timestamp TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
      CREATE INDEX IF NOT EXISTS idx_visits_state ON visits(state);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(sync_status);

      INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'));
    `;

    await this.db.execute(schemaStatements);
  }

  // --- ATOMIC VISIT CREATION TRANSACTION ---
  public async executeAtomicVisitCreation(visit: Visit, syncItem: SyncQueueItem): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || !this.db) {
      return true; // Web adapter handles via local storage engine
    }

    try {
      await this.db.execute('BEGIN TRANSACTION;');

      const insertVisitQuery = `
        INSERT INTO visits (
          visit_id, user_id, customer_id, device_installation_id, state,
          start_time_device, start_time_gps, start_latitude, start_longitude,
          start_accuracy, start_gps_provider, is_start_mock, is_end_mock,
          customer_latitude_at_visit, customer_longitude_at_visit, customer_radius_at_visit,
          distance_meters, location_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      await this.db.run(insertVisitQuery, [
        visit.visitId,
        visit.userId,
        visit.customerId,
        visit.deviceInstallationId,
        visit.state,
        visit.startTimeDevice,
        visit.startTimeGps || null,
        visit.startLatitude || null,
        visit.startLongitude || null,
        visit.startAccuracy || null,
        visit.startGpsProvider || 'fused',
        visit.isStartMock ? 1 : 0,
        visit.isEndMock ? 1 : 0,
        visit.customerLatitudeAtVisit,
        visit.customerLongitudeAtVisit,
        visit.customerRadiusAtVisit,
        visit.distanceMeters || null,
        visit.locationStatus,
        visit.createdAt,
        visit.updatedAt,
      ]);

      const insertQueueQuery = `
        INSERT INTO sync_queue (
          queue_id, visit_id, sync_status, retry_count, created_at
        ) VALUES (?, ?, ?, ?, ?);
      `;

      await this.db.run(insertQueueQuery, [
        syncItem.queueId,
        syncItem.visitId,
        syncItem.syncStatus,
        syncItem.retryCount,
        syncItem.createdAt,
      ]);

      await this.db.execute('COMMIT;');
      return true;
    } catch (err) {
      console.error('[NativeSQLite] Transaction Failed! Executing ROLLBACK:', err);
      if (this.db) {
        await this.db.execute('ROLLBACK;');
      }
      throw new Error('فشلت عملية إنشاء الزيارة وتثبيتها في قاعدة البيانات. تم إلغاء المعاملة (Atomic Rollback).');
    }
  }

  // --- QUERY CRASH RECOVERY UNCOMPLETED VISITS ---
  public async getUncompletedVisitFromDb(userId: string): Promise<Visit | null> {
    if (!Capacitor.isNativePlatform() || !this.db) return null;

    try {
      const res = await this.db.query(
        `SELECT * FROM visits WHERE user_id = ? AND state = 'STARTED' LIMIT 1;`,
        [userId]
      );

      if (res.values && res.values.length > 0) {
        const row = res.values[0];
        return {
          visitId: row.visit_id,
          userId: row.user_id,
          customerId: row.customer_id,
          deviceInstallationId: row.device_installation_id,
          state: row.state,
          startTimeDevice: row.start_time_device,
          startTimeGps: row.start_time_gps,
          startLatitude: row.start_latitude,
          startLongitude: row.start_longitude,
          startAccuracy: row.start_accuracy,
          startGpsProvider: row.start_gps_provider,
          isStartMock: Boolean(row.is_start_mock),
          isEndMock: Boolean(row.is_end_mock),
          customerLatitudeAtVisit: row.customer_latitude_at_visit,
          customerLongitudeAtVisit: row.customer_longitude_at_visit,
          customerRadiusAtVisit: row.customer_radius_at_visit,
          distanceMeters: row.distance_meters,
          locationStatus: row.location_status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }
    } catch (err) {
      console.error('[NativeSQLite] Error querying crash recovery visit:', err);
    }
    return null;
  }
}

export const nativeSQLiteEngine = new NativeSQLiteEngine();
