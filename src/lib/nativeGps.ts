import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Define the plugin interface
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

  // 0. Check Location Services Status (Native)
  let servicesEnabled = true;
  if (isNative) {
    try {
      const { enabled } = await LocationServices.isLocationEnabled();
      console.log('[NativeGPS] Native services status:', enabled);
      servicesEnabled = enabled;
    } catch (e) {
      console.error('[NativeGPS] Failed to check native services status, defaulting to enabled:', e);
      // Relax: if plugin fails, don't block the user, just log it.
      servicesEnabled = true;
    }
  }

  if (!servicesEnabled) {
    return {
      latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now(),
      provider: 'none', isMockLocation: false, permissionGranted: false, servicesEnabled: false,
      errorType: 'LOCATION_SERVICES_DISABLED',
      errorMessage: 'خدمات الموقع معطلة في الجهاز.',
    };
  }

  // 1. Check Permissions
  try {
    const permResult = await Geolocation.checkPermissions();
    if (permResult.location !== 'granted') {
      const reqResult = await Geolocation.requestPermissions();
      if (reqResult.location !== 'granted') {
        return {
          latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now(),
          provider: 'none', isMockLocation: false, permissionGranted: false, servicesEnabled: true,
          errorType: 'PERMISSION_DENIED',
          errorMessage: 'تم رفض إذن الوصول للموقع.',
        };
      }
    }

    // 2. Fetch Position
    const options: PositionOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    const position = await Geolocation.getCurrentPosition(options);

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Math.round((position.coords.accuracy || 0) * 10) / 10,
      timestamp: position.timestamp,
      provider: 'android_fused',
      isMockLocation: false,
      permissionGranted: true,
      servicesEnabled: true,
    };
  } catch (err: any) {
    return {
      latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now(),
      provider: 'error', isMockLocation: false, permissionGranted: true, servicesEnabled: true,
      errorType: 'TIMEOUT',
      errorMessage: 'تعذر الحصول على إحداثيات GPS.',
    };
  }
}
