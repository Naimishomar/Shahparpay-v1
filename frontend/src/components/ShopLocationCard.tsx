import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { useLocationContext } from '../context/LocationContext';

type Quota = {
    lat: number | null;
    long: number | null;
    updatedAt: string | null;
    usedThisYear: number;
    remainingThisYear: number;
    maxPerYear: number;
    year: number;
};

const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

/**
 * Lets a retailer re-register their shop's coordinates with the AEPS provider.
 *
 * The provider geo-fences transactions against a base location captured at
 * onboarding. A shop that has moved — or was onboarded with a bad GPS fix —
 * gets every withdrawal declined until that base location is corrected.
 *
 * The provider caps this at three changes per calendar year, which is why the
 * remaining allowance is shown up front and confirmed before spending one.
 */
const ShopLocationCard: React.FC = () => {
    const { location, error: locationError } = useLocationContext();
    const [quota, setQuota] = useState<Quota | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

    const load = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/base-location`, {
                headers: authHeaders(),
            });
            const data = await res.json();
            if (res.ok && data?.success) setQuota(data.data);
        } catch {
            /* the card simply stays collapsed if this cannot be read */
        }
    };

    useEffect(() => {
        load();
    }, []);

    const submit = async () => {
        if (!location) {
            setMessage({ kind: 'error', text: 'Turn on location access, then try again from inside your shop.' });
            return;
        }
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/base-location`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    lat: location.latitude,
                    long: location.longitude,
                    accessmode: 'SITE',
                }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                setMessage({ kind: 'error', text: data?.message || 'Could not update your location.' });
                if (data?.data) setQuota((q) => (q ? { ...q, ...data.data } : q));
                return;
            }
            setMessage({ kind: 'ok', text: data.message });
            setQuota((q) => (q ? { ...q, ...data.data } : q));
            setConfirming(false);
        } catch {
            setMessage({ kind: 'error', text: 'Could not reach the server. Please try again.' });
        } finally {
            setBusy(false);
        }
    };

    const exhausted = quota ? quota.remainingThisYear <= 0 : false;

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-bold text-foreground">Shop location</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        AEPS checks every transaction against the location your shop was registered
                        with. If withdrawals keep failing with a location or geo-fencing error, update
                        it from inside your shop.
                    </p>
                </div>
            </div>

            {quota && (
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                    <span className="text-muted-foreground">
                        Updates left in {quota.year}:{' '}
                        <span className={`font-bold ${exhausted ? 'text-destructive' : 'text-foreground'}`}>
                            {quota.remainingThisYear} of {quota.maxPerYear}
                        </span>
                    </span>
                    {quota.updatedAt && (
                        <span className="text-muted-foreground">
                            Last updated{' '}
                            <span className="font-medium text-foreground">
                                {new Date(quota.updatedAt).toLocaleDateString('en-IN')}
                            </span>
                        </span>
                    )}
                </div>
            )}

            {locationError && (
                <p className="mt-3 text-xs font-medium text-destructive">{locationError}</p>
            )}

            {message && (
                <p
                    role="alert"
                    className={`mt-3 text-xs font-semibold ${
                        message.kind === 'ok' ? 'text-primary' : 'text-destructive'
                    }`}
                >
                    {message.text}
                </p>
            )}

            {/* Spending one of three yearly updates is worth a deliberate second
                tap, especially since a bad GPS fix cannot be undone. */}
            {confirming ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
                    <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-foreground leading-relaxed">
                            This uses one of your {quota?.maxPerYear ?? 3} location updates for the year
                            and cannot be undone. Make sure you are standing inside your shop.
                            {location && (
                                <span className="block mt-1.5 font-mono text-[0.7rem] text-muted-foreground">
                                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={busy || !location}
                            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                        >
                            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {busy ? 'Updating…' : 'Yes, update it'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            disabled={busy}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        setMessage(null);
                        setConfirming(true);
                    }}
                    disabled={exhausted || !location}
                    className="mt-4 inline-flex items-center gap-2 border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {exhausted ? 'No updates left this year' : 'Update shop location'}
                </button>
            )}
        </div>
    );
};

export default ShopLocationCard;
