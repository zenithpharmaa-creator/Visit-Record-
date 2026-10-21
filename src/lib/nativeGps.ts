import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Define the native plugin interface
interface LocationServicesPlugin {
  isLocationEnabled(): Promise<{ enabled: boolean }>;
}
const LocationServices = registerPlugin<LocationServicesPlugin>('LocationServices');

export type GpsErrorType = 
  | 'PERMISSION_DENIED'
  | 'LOCATION_SERVICES_DISABLED'
  | 'TIMEOUT'
  | 'LOCATION_UNAVAILABLE'
  | 'UNKNOWN';

export interface NativeGpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  provider: string;
  isMockLocation: boolean;
  permissionGranted: boolean;
  servicesEnabled: boolean;
  errorType?: GpsErrorType;
  errorMessage?: string;
}

export async function requestAndGetNativeLocation(): Promise<NativeGpsPosition> {
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    // Web / Browser / iPad Browser Fallback
    return new Promise(resolve => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        resolve({
          latitude: 0,
          longitude: 0,
          accuracy: 0,
          timestamp: Date.now(),
          provider: 'browser_unsupported',
          isMockLocation: false,
          permissionGranted: false,
          servicesEnabled: false,
          errorType: 'LOCATION_UNAVAILABLE',
          errorMessage: 'متصفح الويب لا يدعم خدمة تحديد الموقع (Geolocation).',
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round((pos.coords.accuracy || 8) * 10) / 10,
            timestamp: pos.timestamp,
            provider: 'browser_geolocation',
            isMockLocation: false,
            permissionGranted: true,
            servicesEnabled: true,
          });
        },
        err => {
          // If timeout on high accuracy, attempt fallback with network/cached location
          if (err.code === 3) {
            navigator.geolocation.getCurrentPosition(
              pos2 => {
                resolve({
                  latitude: pos2.coords.latitude,
                  longitude: pos2.coords.longitude,
                  accuracy: Math.round((pos2.coords.accuracy || 15) * 10) / 10,
                  timestamp: pos2.timestamp,
                  provider: 'browser_geolocation_network',
                  isMockLocation: false,
                  permissionGranted: true,
                  servicesEnabled: true,
                });
              },
              err2 => {
                let errorType: GpsErrorType = 'TIMEOUT';
                let errorMessage = 'انتهت مهلة استجابة مستشعر الـ GPS. يرجى التأكد من التواجد في مكان مفتوح وتشغيل الـ GPS.';
                if (err2.code === 1) {
                  errorType = 'PERMISSION_DENIED';
                  errorMessage = 'تم رفض إذن الوصول للموقع. يرجى تفعيل إذن الموقع للتطبيق.';
                } else if (err2.code === 2) {
                  errorType = 'LOCATION_SERVICES_DISABLED';
                  errorMessage = 'خدمات الموقع الجغرافي (GPS) معطلة على جهازك.';
                }
                resolve({
                  latitude: 0,
                  longitude: 0,
                  accuracy: 0,
                  timestamp: Date.now(),
                  provider: 'browser_error',
                  isMockLocation: false,
                  permissionGranted: err2.code !== 1,
                  servicesEnabled: err2.code !== 2,
                  errorType,
                  errorMessage,
                });
              },
              { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
            );
            return;
          }

          let errorType: GpsErrorType = 'UNKNOWN';
          let errorMessage = err.message || 'تعذر تحديد الموقع الجغرافي.';

          if (err.code === 1) {
            errorType = 'PERMISSION_DENIED';
            errorMessage = 'تم رفض إذن الوصول للموقع. يرجى تفعيل إذن الموقع في إعدادات المتصفح.';
          } else if (err.code === 2) {
            errorType = 'LOCATION_SERVICES_DISABLED';
            errorMessage = 'خدمات الموقع الجغرافي (GPS) معطلة على جهازك. يرجى تشغيلها من شريط الإعدادات.';
          }

          resolve({
            latitude: 0,
            longitude: 0,
            accuracy: 0,
            timestamp: Date.now(),
            provider: 'browser_error',
            isMockLocation: false,
            permissionGranted: err.code !== 1,
            servicesEnabled: err.code !== 2,
            errorType,
            errorMessage,
          });
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    });
  }

  // Native Android Platform (Capacitor)
  // 0. Check Location Services Status (Native)
  let servicesEnabled = true;
  try {
    const { enabled } = await LocationServices.isLocationEnabled();
    servicesEnabled = enabled;
  } catch (e) {
    console.warn('[NativeGPS] LocationServices plugin status check skipped:', e);
    servicesEnabled = true;
  }

  if (!servicesEnabled) {
    return {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      timestamp: Date.now(),
      provider: 'android_native',
      isMockLocation: false,
      permissionGranted: false,
      servicesEnabled: false,
      errorType: 'LOCATION_SERVICES_DISABLED',
      errorMessage: 'خدمات الموقع (GPS) معطلة في الجهاز. يرجى تفعيلها من شريط الإعدادات.',
    };
  }

  // 1. Check Permissions
  try {
    const permResult = await Geolocation.checkPermissions();
    if (permResult.location !== 'granted') {
      const reqResult = await Geolocation.requestPermissions();
      if (reqResult.location !== 'granted') {
        return {
          latitude: 0,
          longitude: 0,
          accuracy: 0,
          timestamp: Date.now(),
          provider: 'android_native',
          isMockLocation: false,
          permissionGranted: false,
          servicesEnabled: true,
          errorType: 'PERMISSION_DENIED',
          errorMessage: 'تم رفض إذن الوصول للموقع. يرجى منح الإذن للتطبيق.',
        };
      }
    }

    // 2. Fetch Position
    const options: PositionOptions = { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 };
    const position = await Geolocation.getCurrentPosition(options);

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Math.round((position.coords.accuracy || 5) * 10) / 10,
      timestamp: position.timestamp,
      provider: 'android_fused_location_provider',
      isMockLocation: false,
      permissionGranted: true,
      servicesEnabled: true,
    };
  } catch (err: any) {
    console.error('[NativeGPS] Geolocation.getCurrentPosition failed:', err);
    return {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      timestamp: Date.now(),
      provider: 'android_error',
      isMockLocation: false,
      permissionGranted: true,
      servicesEnabled: true,
      errorType: 'TIMEOUT',
      errorMessage: 'تعذر التقاط إشارة GPS حديثة. يرجى التأكد من التواجد في مكان مفتوح.',
    };
  }
}
