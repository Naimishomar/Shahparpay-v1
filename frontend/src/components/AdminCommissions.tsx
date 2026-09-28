import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Loader2, Save, Percent } from 'lucide-react';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, SILVER_TILE } from './distributor/shared';

const AdminCommissions = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rates, setRates] = useState({
        retailerPercentage: 0,
        distributorPercentage: 0,
        totalApiPercentage: 0.45
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success && data.data?.aepsCommission) {
                    setRates(data.data.aepsCommission);
                }
            } catch (err) {
                console.error("Failed to fetch settings", err);
                toast.error("Failed to fetch commission settings");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [token]);

    const handleSave = async () => {
        if (rates.retailerPercentage + rates.distributorPercentage > rates.totalApiPercentage) {
            toast.error("Retailer + Distributor % cannot exceed Total API %");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/settings`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ aepsCommission: rates })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Commission settings updated successfully");
            } else {
                toast.error(data.message || "Failed to update settings");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while saving");
        } finally {
            setSaving(false);
        }
    };

    const adminProfit = rates.totalApiPercentage - rates.retailerPercentage - rates.distributorPercentage;
    const over = adminProfit < 0;
    // Share of the total API commission each party gets, for the split bar.
    const share = (v: number) => (rates.totalApiPercentage > 0 ? Math.max(0, (v / rates.totalApiPercentage) * 100) : 0);
    const EXAMPLE = 10000;

    const field = (key: keyof typeof rates, label: string, hint: string) => (
        <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{label}</label>
            <div className="relative">
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates[key]}
                    onChange={(e) => setRates({ ...rates, [key]: parseFloat(e.target.value) || 0 })}
                    className={`${INPUT} pr-10 tabular-nums`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Percent className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Commission settings</h1>
                            <p className="text-sm text-muted-foreground">How AEPS commission is split between retailers, distributors and you.</p>
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={saving || loading || over} className={PRIMARY_BUTTON}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save settings
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="grid gap-6 lg:grid-cols-3"><div className="h-80 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5 lg:col-span-2" /><div className="h-80 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" /></div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    <section className={`${CARD} lg:col-span-2 space-y-6`}>
                        <div>
                            <p className={LABEL}>AEPS commission</p>
                            <h2 className="mt-1 text-lg font-semibold">Rates</h2>
                        </div>
                        {field('totalApiPercentage', 'Total API commission', 'What PaySprint pays the platform on each withdrawal.')}
                        <div className="grid gap-5 border-t pt-5 md:grid-cols-2">
                            {field('retailerPercentage', 'Retailer share (reference)', 'Not used for payouts: retailers are paid by the fixed withdrawal slab. Shown to retailers as their rate.')}
                            {field('distributorPercentage', 'Distributor share', "Paid to the retailer's distributor on every successful withdrawal.")}
                        </div>
                        {over && (
                            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                                Retailer + distributor shares are more than the total API commission. Lower one of them to save.
                            </p>
                        )}
                    </section>

                    <section className={`${CARD} space-y-5`}>
                        <div>
                            <p className={LABEL}>The split</p>
                            <p className={`mt-1 text-3xl font-bold tabular-nums ${over ? 'text-red-600 dark:text-red-400' : ''}`}>{adminProfit.toFixed(2)}%</p>
                            <p className="text-sm text-muted-foreground">kept by the platform (estimate)</p>
                        </div>
                        <div className="flex h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10" aria-hidden>
                            <div className="bg-zinc-800 dark:bg-zinc-200" style={{ width: `${share(rates.retailerPercentage)}%` }} />
                            <div className="bg-zinc-500" style={{ width: `${share(rates.distributorPercentage)}%` }} />
                            <div className="bg-zinc-300 dark:bg-zinc-600" style={{ width: `${share(Math.max(0, adminProfit))}%` }} />
                        </div>
                        <ul className="space-y-2 text-sm">
                            {[
                                ['bg-zinc-800 dark:bg-zinc-200', 'Retailer', rates.retailerPercentage],
                                ['bg-zinc-500', 'Distributor', rates.distributorPercentage],
                                ['bg-zinc-300 dark:bg-zinc-600', 'Platform', Math.max(0, adminProfit)],
                            ].map(([dot, label, pct]) => (
                                <li key={label as string} className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${dot}`} />{label}</span>
                                    <span className="tabular-nums">
                                        {(pct as number).toFixed(2)}% · <span className="text-muted-foreground">₹{(((pct as number) / 100) * EXAMPLE).toFixed(2)}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="rounded-xl border bg-background px-3 py-2.5 text-xs text-muted-foreground">
                            Rupee figures are for a ₹{EXAMPLE.toLocaleString('en-IN')} withdrawal. Actual platform earnings are the total minus the retailer's slab commission and the distributor share, so they differ from this estimate.
                        </p>
                    </section>
                </div>
            )}
        </div>
    );
};

export default AdminCommissions;
