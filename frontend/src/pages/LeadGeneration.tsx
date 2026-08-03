import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { CreditCard, UserPlus } from 'lucide-react';
import { INDIAN_STATES } from '../constants';

const LeadGeneration = () => {
    const { token } = useAuth();
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        mobile_no: '',
        email: '',
        product: 'CC',
        pincode: '',
        state: ''
    });

    const products = [
        { id: 'CC', name: 'Credit Card' },
        { id: 'PL', name: 'Personal Loan' },
        { id: 'BL', name: 'Business Loan' },
        { id: 'IL', name: 'Instant Loan' },
        { id: 'SA', name: 'Savings Account' }
    ];

    useEffect(() => {
        fetchHistory();
    }, [token]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/lead/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setLeads(data.data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load leads history.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenLink = (url: string) => {
        try {
            const urlObj = new URL(url);
            const encdata = urlObj.searchParams.get('encdata');

            if (encdata) {
                // PaySprint expects a POST form submission with encdata
                const baseUrl = url.split('?')[0];
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = baseUrl;
                form.target = '_blank';

                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'encdata';
                // URL was already decoded by searchParams.get, but let's be safe
                input.value = encdata;

                form.appendChild(input);
                document.body.appendChild(form);
                form.submit();
                document.body.removeChild(form);
            } else {
                window.open(url, '_blank');
            }
        } catch (e) {
            window.open(url, '_blank');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.mobile_no || !formData.email || !formData.product) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/lead/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Lead generated successfully!");
                setFormData({
                    name: '',
                    mobile_no: '',
                    email: '',
                    product: 'CC',
                    pincode: '',
                    state: ''
                });
                fetchHistory(); // Refresh table

                // If you want to automatically open the URL for the customer:
                if (data.data && data.data.url) {
                    handleOpenLink(data.data.url);
                }
            } else {
                toast.error(data.message || "Failed to generate lead.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred during submission.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusCheck = async (refid: string) => {
        try {
            toast.info(`Checking status for ${refid}...`);
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/lead/status/${refid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                toast.success(`Status updated: ${data.data.executive_status || 'Pending'}`);
                fetchHistory(); // Refresh table to show new status
            } else {
                toast.error(data.message || "Failed to fetch status.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while checking status.");
        }
    };

    return (
        <div className="flex flex-col gap-4 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                    <UserPlus className="text-primary" size={28} />
                    Lead Generation
                </h1>
                <p className="text-sm text-muted-foreground hidden md:block">Generate leads for Credit Cards and Loans, and track their application status.</p>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Form Section */}
                <div>
                    <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -z-10 translate-x-1/2 -translate-y-1/2"></div>

                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-primary" />
                            New Lead
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Customer Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Enter full name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Mobile Number *</label>
                                <input
                                    type="tel"
                                    required
                                    maxLength={10}
                                    value={formData.mobile_no}
                                    onChange={e => setFormData({ ...formData, mobile_no: e.target.value.replace(/\D/g, '') })}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Enter 10 digit mobile"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Email ID *</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Enter email address"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Select Product *</label>
                                <select
                                    required
                                    value={formData.product}
                                    onChange={e => setFormData({ ...formData, product: e.target.value })}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                                >
                                    {products.map(p => (
                                        <option key={p.id} value={p.id} className="bg-background text-foreground">{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pincode</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={formData.pincode}
                                        onChange={e => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="Pincode"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">State</label>
                                    <select
                                        value={formData.state}
                                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="" disabled className="bg-background text-foreground">Select State</option>
                                        {INDIAN_STATES.map((state) => (
                                            <option key={state} value={state} className="bg-background text-foreground">{state}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full btn-primary py-3 rounded-xl font-medium mt-4 flex items-center justify-center gap-2 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                            >
                                {submitting ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <>
                                        <CreditCard className="w-5 h-5" />
                                        Generate Application Link
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LeadGeneration;
