import React, { createContext, useContext, useEffect, useState } from 'react';
import { MapPinOff } from 'lucide-react';

interface LocationContextType {
    location: { latitude: number; longitude: number } | null;
    error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            setPermissionDenied(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setPermissionDenied(false);
                setError(null);
            },
            (err) => {
                setError(err.message);
                if (err.code === err.PERMISSION_DENIED) {
                    setPermissionDenied(true);
                } else {
                    // For timeout or position unavailable, still show the modal since location is required
                    setPermissionDenied(true);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    useEffect(() => {
        requestLocation();
    }, []);

    return (
        <LocationContext.Provider value={{ location, error }}>
            {permissionDenied && (
                <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-card border border-border p-8 rounded-2xl shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-6">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                            <MapPinOff className="text-red-500 w-8 h-8" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <h2 className="text-2xl font-bold text-foreground">Location Access Required</h2>
                            <p className="text-muted-foreground">
                                We need your location to provide secure financial services and comply with regulatory requirements. 
                                Please allow location access in your browser to continue.
                            </p>
                        </div>
                        <button 
                            onClick={requestLocation}
                            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
                        >
                            Retry
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
