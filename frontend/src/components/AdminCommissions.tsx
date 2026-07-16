import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Save, Percent } from 'lucide-react';

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

    if (loading) return <div className="text-center py-10">Loading settings...</div>;

    const adminProfit = (rates.totalApiPercentage - rates.retailerPercentage - rates.distributorPercentage).toFixed(2);

    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-10">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">Commission Settings</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure global percentage-based commissions for your network.</p>
            </div>

            <div className="glass-card p-6 md:p-8 rounded-2xl border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3"></div>
                
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Percent className="w-5 h-5 text-primary" />
                    AEPS Commissions
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Total API Commission (%)</label>
                        <p className="text-xs text-muted-foreground mb-2">The total commission you receive from PaySprint</p>
                        <input
                            type="number"
                            step="0.01"
                            value={rates.totalApiPercentage}
                            onChange={e => setRates({...rates, totalApiPercentage: parseFloat(e.target.value) || 0})}
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                    </div>
                </div>

                <div className="h-px w-full bg-black/10 dark:bg-white/10 my-6"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Retailer Commission (%)</label>
                        <p className="text-xs text-muted-foreground mb-2">Percentage given to the Retailer</p>
                        <input
                            type="number"
                            step="0.01"
                            value={rates.retailerPercentage}
                            onChange={e => setRates({...rates, retailerPercentage: parseFloat(e.target.value) || 0})}
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Distributor Commission (%)</label>
                        <p className="text-xs text-muted-foreground mb-2">Percentage given to the Distributor</p>
                        <input
                            type="number"
                            step="0.01"
                            value={rates.distributorPercentage}
                            onChange={e => setRates({...rates, distributorPercentage: parseFloat(e.target.value) || 0})}
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                    </div>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <p className="text-sm font-medium text-foreground">Your Admin Profit (Calculated)</p>
                        <p className="text-xs text-muted-foreground">What remains in your Admin Wallet</p>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                        {adminProfit}%
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary py-3 px-8 rounded-xl font-medium flex items-center gap-2"
                    >
                        {saving ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminCommissions;
