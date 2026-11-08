import React, { createContext, useContext, useEffect, useState } from 'react';
import { Loader2, MapPinOff } from 'lucide-react';

interface LocationContextType {
    location: { latitude: number; longitude: number } | null;
    error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

/**
 * `required` false (admins, distributors: they never send a regulated
 * transaction) skips asking for location and never shows the modal.
 */
export const LocationProvider: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required = true }) => {
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [loading, setLoading] = useState(false);
    // Once the user blocks location, the browser answers "denied" at once and never asks
    // again, so Retry alone cannot help: the modal then says where to switch it back on.
    const [blocked, setBlocked] = useState(false);

    const requestLocation = () => {
        setLoading(true);
        setError(null);
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            setPermissionDenied(true);
            setLoading(false);
            return;
        }

        // Browser geolocation is blocked on plain HTTP (except localhost).
        // Surface the actionable cause instead of leaving the retailer to
        // retry a request the browser will reject every time.
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            setError('Location access requires a secure HTTPS connection.');
            setPermissionDenied(true);
            setLoading(false);
            return;
        }

        const done = (position: GeolocationPosition) => {
            setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            setPermissionDenied(false);
            setBlocked(false);
            setError(null);
            setLoading(false);
        };
        const failed = (err: GeolocationPositionError) => {
            setBlocked(err.code === err.PERMISSION_DENIED);
            setError(
                err.code === err.PERMISSION_DENIED
                    ? 'Location is blocked for this site.'
                    : err.code === err.TIMEOUT
                        ? 'Finding your location took too long. Turn on location on this device and retry.'
                        : 'This device could not find its location. Turn on location services and retry.'
            );
            // Location is required for regulated AEPS operations: the modal stays.
            setPermissionDenied(true);
            setLoading(false);
        };

        // GPS-grade accuracy first; a laptop has no GPS and often times out or
        // reports "unavailable", so retry once with Wi-Fi accuracy and a recent fix.
        navigator.geolocation.getCurrentPosition(
            done,
            (err) => {
                if (err.code === err.PERMISSION_DENIED) return failed(err);
                navigator.geolocation.getCurrentPosition(done, failed, { enableHighAccuracy: false, timeout: 20000, maximumAge: 5 * 60 * 1000 });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        if (!required) return;
        requestLocation();
        // Allowing location from the address bar fires this, so the modal closes without a reload.
        let status: PermissionStatus | null = null;
        const onChange = () => { if (status?.state === 'granted') requestLocation(); };
        navigator.permissions?.query({ name: 'geolocation' as PermissionName })
            .then((st) => { status = st; st.addEventListener('change', onChange); })
            .catch(() => { /* older browsers: Retry still works */ });
        return () => status?.removeEventListener('change', onChange);
    }, [required]);

    return (
        <LocationContext.Provider value={{ location, error }}>
            {required && permissionDenied && (
                <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-card border border-border p-8 rounded-2xl shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-6">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                            <MapPinOff className="text-red-500 w-8 h-8" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <h2 className="text-2xl font-bold text-foreground">Location Access Required</h2>
                            <p className="text-muted-foreground">
                                We need your location to provide secure financial services and comply with regulatory requirements.
                            </p>
                        </div>
                        {error && <p className="w-full rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
                        {blocked && (
                            <ol className="w-full list-decimal space-y-1.5 rounded-xl border bg-background/60 py-3 pl-8 pr-4 text-left text-sm text-muted-foreground">
                                <li>Click the <b className="text-foreground">location or lock icon</b> at the left of the address bar.</li>
                                <li>Set <b className="text-foreground">Location</b> to <b className="text-foreground">Allow</b>.</li>
                                <li>On a Mac, also check <b className="text-foreground">System Settings → Privacy &amp; Security → Location Services</b> is on for your browser.</li>
                                <li>Press Retry (or reload the page).</li>
                            </ol>
                        )}
                        <button onClick={requestLocation} disabled={loading} className="flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-70">
                            {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Finding your location…</> : 'Retry'}
                        </button>
                    </div>
                </div>
            )}
            {children}
        </LocationContext.Provider>
    );
};

export const useLocationContext = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocationContext must be used within a LocationProvider');
    }
    return context;
};
