package com.fieldvisit.tracker;

import android.content.Context;
import android.location.LocationManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "LocationServices")
public class LocationServicesPlugin extends Plugin {

    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        boolean isEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) || 
                            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        
        JSObject ret = new JSObject();
        ret.put("enabled", isEnabled);
        call.resolve(ret);
    }
}
