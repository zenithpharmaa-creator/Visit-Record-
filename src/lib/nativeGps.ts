/**
 * Native Android Location Service Helper (Capacitor Geolocation)
 * Interfaces directly with Android Location APIs & Runtime Permission Flow with Zero-Tolerance for Disabled/Denied GPS.
 */

import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface NativeGpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  provider: string;
  isMockLocation: boolean;
  permissionGranted: boolean;
  errorMessage?: string;
}

export async function requestAndGetNativeLocation(): Promise<NativeGpsPosition> {
  const isNative = Capacitor.isNativePlatform();

  try {
    if (isNative) {
      // 1. Check & Request Permissions on Android Native
      const permResult = await Geolocation.checkPermissions();
      if (permResult.location !== 'granted') {
        const reqResult = await Geolocation.requestPermissions();
        if (reqResult.location !== 'granted') {
          return {
            latitude: 0,
            longitude: 0,
            accuracy: 0,
            timestamp: Date.now(),
            provider: 'android_native_denied',
            isMockLocation: false,
            permissionGranted: false,
            errorMessage: 'تم رفض صلاحية استخدام موقع الجهاز (GPS Permission Denied). يرجى السماح للوصول للموقع.',
          };
        }
      }

      // 2. Fetch Native Position
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      };

      const position = await Geolocation.getCurrentPosition(options);

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round((position.coords.accuracy || 0) * 10) / 10,
        timestamp: position.timestamp,
        provider: 'android_fused_location_provider',
        isMockLocation: false,
        permissionGranted: true,
      };
    } else {
      // Browser Geolocation for Web Preview - STRICT Zero-Tolerance (No silent fallbacks)
      return new Promise(resolve => {
        if (!navigator.geolocation) {
          resolve({
            latitude: 0,
            longitude: 0,
            accuracy: 0,
            timestamp: Date.now(),
            provider: 'web_geolocation_unsupported',
            isMockLocation: false,
            permissionGranted: false,
            errorMessage: 'متصفح الويب لا يدعم خدمة تحديد الموقع (Geolocation not supported).',
          });
          return;
        }

        navigator.geolocation.getCurrentPosition(
          pos => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: Math.round((pos.coords.accuracy || 10) * 10) / 10,
              timestamp: pos.timestamp,
              provider: 'browser_geolocation',
              isMockLocation: false,
              permissionGranted: true,
            });
          },
          err => {
            resolve({
              latitude: 0,
              longitude: 0,
              accuracy: 0,
              timestamp: Date.now(),
              provider: 'browser_geolocation_error',
              isMockLocation: false,
              permissionGranted: false,
              errorMessage: err.message || 'تعذر الحصول على موقع الـ GPS. يرجى السماح بالوصول للموقع في المتصفح.',
            });
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      });
    }
  } catch (err: any) {
    console.error('[NativeGPS] Location capture error:', err);
    return {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      timestamp: Date.now(),
      provider: 'error_strict_guard',
      isMockLocation: false,
      permissionGranted: false,
      errorMessage: err.message || 'تعذر تشغيل أو قراءة أداة الـ GPS من النظام.',
    };
  }
}
