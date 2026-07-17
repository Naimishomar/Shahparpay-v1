import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { CreditCard, ExternalLink, RefreshCw, UserPlus } from 'lucide-react';

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
                                    <input
                                        type="text"
                                        value={formData.state}
                                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="State"
                                    />
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

                {/* History Section */}
                <div>
                    <div className="glass-card rounded-2xl h-full flex flex-col">
                        <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                Lead History
                            </h2>
                            <button
                                onClick={fetchHistory}
                                disabled={loading}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-black/5 dark:bg-white/5">
                                    <tr>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Product</th>
                                        <th className="px-6 py-4">Ref ID</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                                Loading history...
                                            </td>
                                        </tr>
                                    ) : leads.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                                No leads generated yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        leads.map((lead, idx) => (
                                            <tr key={idx} className="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-foreground">{lead.name}</div>
                                                    <div className="text-xs text-muted-foreground">{lead.mobile_no}</div>
                                                </td>
                                                <td className="px-6 py-4 font-medium">
                                                    {products.find(p => p.id === lead.product)?.name || lead.product}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                                                    {lead.refid}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${lead.executive_status === 'APPROVED' ? 'bg-green-500/10 text-green-500' :
                                                            lead.executive_status === 'REJECTED' || lead.executive_status === 'NOT_INTERESTED' ? 'bg-red-500/10 text-red-500' :
                                                                'bg-yellow-500/10 text-yellow-500'
                                                        }`}>
                                                        {lead.executive_status || 'PENDING'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                                    <button
                                                        onClick={() => handleStatusCheck(lead.refid)}
                                                        className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                                                        title="Check Status"
                                                    >
                                                        <RefreshCw className="w-3 h-3" /> Status
                                                    </button>
                                                    {lead.url && (
                                                        <button
                                                            onClick={() => handleOpenLink(lead.url)}
                                                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 ml-3"
                                                        >
                                                            Link <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadGeneration;
