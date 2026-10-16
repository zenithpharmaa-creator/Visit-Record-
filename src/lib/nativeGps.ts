/**
 * Native Android Location Service Helper (Capacitor Geolocation)
 * Interfaces directly with Android Location APIs & Runtime Permission Flow.
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
      // 1. Check & Request Permissions on Android
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
            errorMessage: 'تم رفض صلاحية استخدام موقع الجهاز من قبل المستخدم (Location Permission Denied).',
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
        isMockLocation: false, // Standard Android Geolocation API wrapper
        permissionGranted: true,
      };
    } else {
      // Browser Geolocation Fallback for Web Preview
      return new Promise(resolve => {
        if (!navigator.geolocation) {
          resolve({
            latitude: 29.9723,
            longitude: 31.2785,
            accuracy: 10,
            timestamp: Date.now(),
            provider: 'web_simulator_fallback',
            isMockLocation: false,
            permissionGranted: true,
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
              latitude: 29.9723, // Default fallback coordinates (Maadi / Cairo)
              longitude: 31.2785,
              accuracy: 15,
              timestamp: Date.now(),
              provider: 'web_fallback_default',
              isMockLocation: false,
              permissionGranted: false,
              errorMessage: err.message,
            });
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }
  } catch (err: any) {
    console.error('[NativeGPS] Location capture error:', err);
    return {
      latitude: 29.9723,
      longitude: 31.2785,
      accuracy: 20,
      timestamp: Date.now(),
      provider: 'error_fallback',
      isMockLocation: false,
      permissionGranted: false,
      errorMessage: err.message || 'تعذر الحصول على موقع الـ GPS من النظام.',
    };
  }
}
