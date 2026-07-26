import React, { useState, useEffect } from 'react';
import { CreditCard, User, Mail, ChevronRight, Loader2, Store, MapPin, Phone, CheckCircle2, AlertCircle, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PanCard: React.FC = () => {
    const { token } = useAuth();
    const [fetchingStatus, setFetchingStatus] = useState(true);
    const [hasPsa, setHasPsa] = useState(false);
    const [existingPsa, setExistingPsa] = useState<{
        psa_id: string;
        status: string;
        name?: string;
        contact_person?: string;
        mobile?: string;
        email?: string;
        pan_no?: string;
    } | null>(null);

    const [loading, setLoading] = useState(false);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponAmount, setCouponAmount] = useState('107');
    const [syncLoading, setSyncLoading] = useState(false);
    const [manualStatus, setManualStatus] = useState('REJECTED');
    const [manualPsaId, setManualPsaId] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        mobile: '',
        email: '',
        pan_no: '',
        pin: '',
        state_id: '13',
        district_id: '260',
        location: '',
        address_line_1: '',
        address_line_2: ''
    });

    const fetchPsaStatus = async () => {
        setFetchingStatus(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/pan/my-psa-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.hasPsa) {
                setHasPsa(true);
                setExistingPsa(res.data.data);
            } else {
                setHasPsa(false);
                setExistingPsa(null);
            }
        } catch (error) {
            console.error("Failed to fetch PSA status:", error);
        } finally {
            setFetchingStatus(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchPsaStatus();
        }
    }, [token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.mobile.length !== 10) return toast.error("Mobile number must be 10 digits");
        if (formData.pin.length !== 6) return toast.error("Pincode must be 6 digits");
        if (formData.pan_no.length !== 10) return toast.error("PAN number must be 10 characters");

        setLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/register-bio-psa`,
                formData,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (res.data.success) {
                toast.success(res.data.message || "Biometric PSA Agent Registered Successfully!");
                fetchPsaStatus();
            } else {
                toast.error(res.data.message || "Failed to register Biometric PSA Agent.");
            }
        } catch (error: any) {
            console.error("Biometric PSA Error:", error);
            toast.error(error.response?.data?.message || "An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleBuyCoupons = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!existingPsa || !existingPsa.psa_id) return;
        if (!couponAmount || Number(couponAmount) <= 0) return toast.error("Enter a valid coupon amount");

        setCouponLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/buy-coupons`,
                {
                    psa_id: existingPsa.psa_id,
                    amount: couponAmount
                },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (res.data.success) {
                toast.success(res.data.message || "PAN Coupon payment request submitted successfully!");
            } else {
                toast.error(res.data.message || "Failed to submit coupon payment request.");
            }
        } catch (error: any) {
            console.error("Coupon Buy Error:", error);
            toast.error(error.response?.data?.message || "An error occurred while submitting payment.");
        } finally {
            setCouponLoading(false);
        }
    };

    const [linkPsaId, setLinkPsaId] = useState('');
    const [linkLoading, setLinkLoading] = useState(false);

    const handleLinkPsaId = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkPsaId.trim()) return toast.error("Please enter your PSA ID");
        setLinkLoading(true);
        try {
            const res = await axios.patch(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/set-psa-id`,
                { psa_id: linkPsaId.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(`PSA ID ${linkPsaId} linked successfully!`);
                fetchPsaStatus();
            } else {
                toast.error(res.data.message || "Failed to link PSA ID");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error linking PSA ID");
        } finally {
            setLinkLoading(false);
        }
    };

    const handleSyncStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualPsaId.trim()) return toast.error("Enter the PSA ID to sync");
        setSyncLoading(true);
        try {
            const res = await axios.patch(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/sync-psa-status`,
                { psa_id: manualPsaId.trim(), status: manualStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(`Status synced to ${manualStatus} successfully!`);
                fetchPsaStatus();
            } else {
                toast.error(res.data.message || "Failed to sync status");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error syncing status");
        } finally {
            setSyncLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-primary" />
                        Biometric PSA Agent Services
                    </h1>
                    <p className="text-muted-foreground">UTI Biometric PAN Service Agent Onboarding & Application Tokens.</p>
                </div>

                {fetchingStatus ? (
                    <div className="flex items-center justify-center p-12 bg-card border border-border/50 rounded-2xl">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
                        <span className="text-muted-foreground">Checking PSA Registration Status...</span>
                    </div>
                ) : hasPsa && existingPsa && !existingPsa.psa_id ? (
                    /* Old record found but psa_id was never saved — let user link it manually */
                    <div className="bg-card border border-yellow-500/30 bg-yellow-500/5 rounded-2xl p-8 shadow-sm max-w-xl mx-auto space-y-4">
                        <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400 font-bold text-lg">
                            <AlertCircle className="w-6 h-6" />
                            <span>Registration Found — Link Your PSA ID</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                            We found your Biometric PSA registration record but the PSA ID (e.g. <strong>ANNECHM-806</strong>) was not saved due to an earlier issue. Please enter your assigned PSA ID from BharatPays to continue.
                        </p>
                        <form onSubmit={handleLinkPsaId} className="flex gap-3">
                            <input
                                type="text"
                                value={linkPsaId}
                                onChange={(e) => setLinkPsaId(e.target.value)}
                                className="flex-1 px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all font-mono"
                                placeholder="e.g. ANNECHM-806"
                                required
                            />
                            <button
                                type="submit"
                                disabled={linkLoading}
                                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                            >
                                {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                                Link PSA ID
                            </button>
                        </form>
                    </div>
                ) : hasPsa && existingPsa ? (
                    /* Existing PSA Agent Dashboard View */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Agent Profile Details Card */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-foreground">PSA Agent Account</h2>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                        existingPsa.status === 'APPROVED' || existingPsa.status === 'SUCCESS' 
                                            ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                                            : existingPsa.status === 'REJECTED' || existingPsa.status === 'FAILED'
                                            ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                                            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                                    }`}>
                                        {existingPsa.status || 'PENDING'}
                                    </span>
                                </div>

                                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-2">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Assigned PSA ID</p>
                                    <p className="text-2xl font-black text-primary tracking-wide">{existingPsa.psa_id}</p>
                                </div>

                                <div className="space-y-3 text-sm">
                                    {existingPsa.name && (
                                        <div className="flex justify-between border-b border-border/30 pb-2">
                                            <span className="text-muted-foreground">Shop Name</span>
                                            <span className="font-semibold text-foreground">{existingPsa.name}</span>
                                        </div>
                                    )}
                                    {existingPsa.contact_person && (
                                        <div className="flex justify-between border-b border-border/30 pb-2">
                                            <span className="text-muted-foreground">Contact Person</span>
                                            <span className="font-semibold text-foreground">{existingPsa.contact_person}</span>
                                        </div>
                                    )}
                                    {existingPsa.mobile && (
                                        <div className="flex justify-between border-b border-border/30 pb-2">
                                            <span className="text-muted-foreground">Mobile</span>
                                            <span className="font-semibold text-foreground">{existingPsa.mobile}</span>
                                        </div>
                                    )}
                                    {existingPsa.pan_no && (
                                        <div className="flex justify-between border-b border-border/30 pb-2">
                                            <span className="text-muted-foreground">PAN Number</span>
                                            <span className="font-semibold text-foreground uppercase">{existingPsa.pan_no}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Status / Coupon Purchase Section */}
                        <div className="lg:col-span-2 space-y-6">
                            {(existingPsa.status === 'REJECTED' || existingPsa.status === 'FAILED') ? (
                                <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-6 shadow-sm space-y-4">
                                    <div className="flex items-center gap-3 text-red-500 font-bold text-lg">
                                        <AlertCircle className="w-6 h-6" />
                                        <span>PSA Registration Rejected</span>
                                    </div>
                                    <p className="text-sm text-foreground leading-relaxed">
                                        Your registration request with PSA ID <strong>{existingPsa.psa_id}</strong> has been <strong className="text-red-500">rejected</strong> by UTI Interservices / BharatPays.
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Please contact BharatPays support to understand the reason for rejection and re-apply with corrected details. You may need to submit a fresh registration.
                                    </p>
                                    <button
                                        onClick={() => { setHasPsa(false); setExistingPsa(null); }}
                                        className="mt-2 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors"
                                    >
                                        Apply for New Registration
                                    </button>
                                </div>
                            ) : existingPsa.status === 'PENDING' ? (
                                <div className="bg-card border border-yellow-500/30 bg-yellow-500/5 rounded-2xl p-6 shadow-sm space-y-4">
                                    <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400 font-bold text-lg">
                                        <AlertCircle className="w-6 h-6" />
                                        <span>PSA ID Approval Pending</span>
                                    </div>
                                    <p className="text-sm text-foreground leading-relaxed">
                                        Your registration request with PSA ID <strong>{existingPsa.psa_id}</strong> is currently being verified and approved by UTI Interservices & BharatPays.
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Once your status changes to <strong>APPROVED</strong>, you will be able to purchase PAN application coupons/tokens directly from this page.
                                    </p>

                                    {/* Manual Status Sync — for cases where BharatPays webhook failed */}
                                    <div className="pt-4 border-t border-yellow-500/20 space-y-3">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Got a status update from BharatPays but it didn't reflect here?</p>
                                        <form onSubmit={handleSyncStatus} className="flex flex-col gap-3">
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={manualPsaId}
                                                    onChange={(e) => setManualPsaId(e.target.value)}
                                                    className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-xl text-sm text-foreground font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                    placeholder={`PSA ID (e.g. ${existingPsa.psa_id || 'ANNECHM-808'})`}
                                                    defaultValue={existingPsa.psa_id || ''}
                                                />
                                                <select
                                                    value={manualStatus}
                                                    onChange={(e) => setManualStatus(e.target.value)}
                                                    className="px-3 py-2 bg-background border border-border/50 rounded-xl text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                >
                                                    <option value="APPROVED">APPROVED</option>
                                                    <option value="REJECTED">REJECTED</option>
                                                    <option value="PENDING">PENDING</option>
                                                </select>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={syncLoading}
                                                className="w-full px-4 py-2 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30 rounded-xl text-sm font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                Manually Sync Status
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            ) : (
                                /* Buy Coupons Form (Step 2) */
                                <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                                <ShoppingBag className="w-6 h-6 text-primary" />
                                                Purchase PAN Application Coupons
                                            </h2>
                                            <p className="text-xs text-muted-foreground mt-1">Buy tokens to process customer biometric PAN card applications.</p>
                                        </div>
                                        <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-medium border border-green-500/20">
                                            Active Agent
                                        </div>
                                    </div>

                                    <form onSubmit={handleBuyCoupons} className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">PSA ID</label>
                                            <input
                                                type="text"
                                                value={existingPsa.psa_id}
                                                disabled
                                                className="w-full px-4 py-2.5 bg-background/50 border border-border/50 rounded-xl text-foreground font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Coupon Purchase Amount (₹)</label>
                                            <input
                                                type="number"
                                                value={couponAmount}
                                                onChange={(e) => setCouponAmount(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all font-semibold"
                                                placeholder="e.g. 107"
                                                required
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">Standard UTI PAN token charge: ₹107 per application.</p>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={couponLoading}
                                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {couponLoading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Submitting Coupon Payment Request...
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronRight className="w-5 h-5" />
                                                    Purchase Coupons (Submit Payment Request)
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Initial Registration Form (Step 1) */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                                <h2 className="text-xl font-bold text-foreground mb-4">Biometric PSA Benefits</h2>
                                
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Biometric e-KYC</p>
                                            <p className="text-xs text-muted-foreground">Process PAN applications using Mantra/Morpho fingerprint scanners.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Instant PSA ID</p>
                                            <p className="text-xs text-muted-foreground">Get a unique PSA Agent ID assigned to your retail shop.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Earn Commissions</p>
                                            <p className="text-xs text-muted-foreground">Earn attractive commissions on every successful PAN application.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-foreground">Agent Registration Form</h2>
                                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                                        Biometric PSA
                                    </div>
                                </div>

                                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Shop / Agent Name</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Store className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                    placeholder="Enter shop or agent name"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Contact Person Name</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <User className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="contact_person"
                                                    value={formData.contact_person}
                                                    onChange={handleChange}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                    placeholder="Enter contact person name"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Mobile Number</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="mobile"
                                                    value={formData.mobile}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        if(val.length <= 10) setFormData({...formData, mobile: val});
                                                    }}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                    placeholder="10-digit mobile"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Email Address</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                    placeholder="Email Address"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Agent PAN Number</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="pan_no"
                                                    value={formData.pan_no}
                                                    onChange={(e) => setFormData({...formData, pan_no: e.target.value.toUpperCase()})}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all uppercase"
                                                    placeholder="10-character PAN"
                                                    maxLength={10}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Pincode</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="pin"
                                                    value={formData.pin}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        if(val.length <= 6) setFormData({...formData, pin: val});
                                                    }}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                    placeholder="6-digit pincode"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Location / City</label>
                                        <input
                                            type="text"
                                            name="location"
                                            value={formData.location}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            placeholder="City / Area"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Address Line 1</label>
                                            <input
                                                type="text"
                                                name="address_line_1"
                                                value={formData.address_line_1}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                placeholder="Building / Street Address"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-foreground mb-1.5 block">Address Line 2</label>
                                            <input
                                                type="text"
                                                name="address_line_2"
                                                value={formData.address_line_2}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                placeholder="Landmark / Locality"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <div className="pt-4 border-t border-border/30">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Submitting Agent Registration...
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronRight className="w-5 h-5" />
                                                    Register Biometric PSA Agent
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PanCard;
