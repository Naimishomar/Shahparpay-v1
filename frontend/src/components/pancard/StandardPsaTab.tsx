import React, { useState, useEffect } from 'react';
import { CreditCard, User, Mail, ChevronRight, Loader2, Store, MapPin, Phone, CheckCircle2, AlertCircle, ShoppingBag, Key } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import locationsData from '../../data/locations.json';

const StandardPsaTab: React.FC = () => {
    const { token } = useAuth();
    const [fetchingStatus, setFetchingStatus] = useState(true);
    const [hasPsa, setHasPsa] = useState(false);
    const [existingPsa, setExistingPsa] = useState<any>(null);

    const [loading, setLoading] = useState(false);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponAmount, setCouponAmount] = useState('1');
    
    const [updateLoading, setUpdateLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    const [formData, setFormData] = useState({
        shop_name: '',
        name: '',
        state: '',
        district: '',
        address: '',
        pincode: '',
        mobile: '',
        email: '',
        dob: '',
        pan_no: '',
        aadhar_no: ''
    });

    const [states, setStates] = useState<{ id: string; name: string }[]>([]);
    const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        const sortedStates = [...locationsData].map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
        setStates(sortedStates);
    }, []);

    const handleStateChange = (stateName: string) => {
        setFormData(prev => ({ ...prev, state: stateName, district: '' }));
        const selectedState = locationsData.find(s => s.name === stateName);
        if (selectedState && selectedState.districts) {
            const sortedDistricts = [...selectedState.districts].sort((a: any, b: any) => a.name.localeCompare(b.name));
            setDistricts(sortedDistricts);
        } else {
            setDistricts([]);
        }
    };

    const fetchPsaStatus = async () => {
        setFetchingStatus(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/pan/my-std-psa-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.hasPsa) {
                setHasPsa(true);
                setExistingPsa(res.data.data);
                
                // Pre-fill form if rejected
                if (res.data.data.status === 'REJECTED' || res.data.data.status === 'FAILED') {
                    setFormData(prev => ({
                        ...prev,
                        shop_name: res.data.data.shop_name || '',
                        name: res.data.data.name || '',
                        mobile: res.data.data.mobile || '',
                        email: res.data.data.email || '',
                        pan_no: res.data.data.pan_no || ''
                    }));
                }
            } else {
                setHasPsa(false);
                setExistingPsa(null);
            }
        } catch (error) {
            console.error("Failed to fetch Standard PSA status:", error);
        } finally {
            setFetchingStatus(false);
        }
    };

    useEffect(() => {
        fetchPsaStatus();
    }, [token]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'state') {
            handleStateChange(value);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/register-std-psa`,
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message || "Registration submitted successfully!");
                fetchPsaStatus();
            } else {
                toast.error(res.data.message || "Registration failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error submitting registration");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdateLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/update-std-psa`,
                { ...formData, psa_id: existingPsa.psa_id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message || "Registration updated successfully!");
                fetchPsaStatus();
            } else {
                toast.error(res.data.message || "Update failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error updating registration");
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleBuyCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!couponAmount || Number(couponAmount) < 1) return toast.error("Enter a valid coupon quantity");
        setCouponLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/buy-std-coupons`,
                { psa_id: existingPsa.psa_id, coupon: couponAmount },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(`Purchased ${couponAmount} coupons successfully!`);
                setCouponAmount('1');
            } else {
                toast.error(res.data.message || "Coupon purchase failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error purchasing coupons");
        } finally {
            setCouponLoading(false);
        }
    };

    const handleRequestPassword = async () => {
        if (!existingPsa?.psa_id) return toast.error("PSA ID not found");
        setPasswordLoading(true);
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/std-psa-password?psa_id=${existingPsa.psa_id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message || "Password request submitted. Check your registered email or phone.");
            } else {
                toast.error(res.data.message || "Password request failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error requesting password");
        } finally {
            setPasswordLoading(false);
        }
    };

    if (fetchingStatus) {
        return (
            <div className="flex items-center justify-center p-12 bg-card border border-border/50 rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
                <span className="text-muted-foreground">Checking Standard PSA Registration Status...</span>
            </div>
        );
    }

    if (hasPsa && existingPsa && (existingPsa.status === 'APPROVED' || existingPsa.status === 'SUCCESS' || existingPsa.status === 'PENDING')) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">Standard PSA Account</h2>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                existingPsa.status === 'APPROVED' || existingPsa.status === 'SUCCESS' 
                                    ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                                    : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                            }`}>
                                {existingPsa.status || 'PENDING'}
                            </span>
                        </div>
                        <div className="pt-4 border-t border-border/50 space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <Store className="w-4 h-4 text-muted-foreground" />
                                <span className="text-foreground">{existingPsa.shop_name || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="text-foreground">{existingPsa.name || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <CreditCard className="w-4 h-4 text-muted-foreground" />
                                <span className="text-foreground font-mono font-medium">{existingPsa.psa_id || 'Pending...'}</span>
                            </div>
                        </div>

                        {existingPsa.status === 'APPROVED' && (
                            <div className="pt-4 border-t border-border/50">
                                <button
                                    onClick={handleRequestPassword}
                                    disabled={passwordLoading}
                                    className="w-full px-4 py-2 bg-secondary text-secondary-foreground border border-border/50 rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                                    Request UTI Portal Password
                                </button>
                                <p className="text-[11px] text-center text-muted-foreground mt-2">
                                    Login directly to the UTI Web portal to apply for PAN cards.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {existingPsa.status === 'PENDING' ? (
                        <div className="bg-card border border-yellow-500/30 bg-yellow-500/5 rounded-2xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400 font-bold">
                                <AlertCircle className="w-6 h-6" />
                                <span>Approval Pending</span>
                            </div>
                            <p className="text-sm text-foreground">
                                Your Standard PSA Agent application has been submitted and is currently being reviewed by BharatPays and UTI. Once approved, you will be able to purchase coupons here.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <ShoppingBag className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Buy Standard PAN Coupons</h2>
                                    <p className="text-xs text-muted-foreground">Purchase coupons to process customer PAN cards</p>
                                </div>
                            </div>
                            
                            <form onSubmit={handleBuyCoupon} className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                                        Number of Coupons
                                    </label>
                                    <div className="flex gap-4">
                                        <input
                                            type="number"
                                            min="1"
                                            value={couponAmount}
                                            onChange={(e) => setCouponAmount(e.target.value)}
                                            className="flex-1 px-4 py-3 bg-background border border-border/50 rounded-xl text-lg font-bold text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                            placeholder="E.g. 5"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={couponLoading}
                                            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {couponLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buy Now'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Each standard coupon typically costs ₹107 and allows you to process 1 PAN card application on the UTI portal.
                                    </p>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border/50 flex items-center gap-4 bg-muted/30">
                <div className="p-3 bg-primary/10 rounded-2xl">
                    <Store className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-foreground">
                        {existingPsa && (existingPsa.status === 'REJECTED' || existingPsa.status === 'FAILED') 
                            ? 'Update Standard PSA Application' 
                            : 'Standard UTI PSA Onboarding'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {existingPsa && (existingPsa.status === 'REJECTED' || existingPsa.status === 'FAILED') 
                            ? 'Your previous application was rejected. Please correct the details below.'
                            : 'Register to become a standard UTI PAN card agent'}
                    </p>
                </div>
            </div>

            {existingPsa && (existingPsa.status === 'REJECTED' || existingPsa.status === 'FAILED') && (
                <div className="m-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-500">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-sm">Application Rejected</p>
                        <p className="text-xs opacity-90 mt-1">Please review your details and submit an update.</p>
                        <p className="text-xs opacity-90 mt-1 font-mono">PSA ID: {existingPsa.psa_id}</p>
                    </div>
                </div>
            )}

            <form onSubmit={existingPsa ? handleUpdate : handleRegister} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shop Name</label>
                    <input type="text" name="shop_name" value={formData.shop_name} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required placeholder="Ex: Krishna Online Center" />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ShopKeeper Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required placeholder="Ex: Narendra Damodardas Modi" />
                </div>
                
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date of Birth</label>
                    <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</label>
                    <select name="state" value={formData.state} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required>
                        <option value="">Select State</option>
                        {states.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">District</label>
                    <select name="district" value={formData.district} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required disabled={!formData.state}>
                        <option value="">Select District</option>
                        {districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required placeholder="Ex: Village, P.O, P.S" />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pincode</label>
                    <input type="text" name="pincode" value={formData.pincode} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required placeholder="Ex: 743611" maxLength={6} />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mobile Number</label>
                    <input type="text" name="mobile" value={formData.mobile} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required placeholder="Exact 10 digits" maxLength={10} />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email ID</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required placeholder="ads@bharatpays.in" />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PAN Number</label>
                    <input type="text" name="pan_no" value={formData.pan_no} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all uppercase" required placeholder="Exact 10 chars" maxLength={10} />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aadhaar Number</label>
                    <input type="text" name="aadhar_no" value={formData.aadhar_no} onChange={handleInputChange} className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required placeholder="Exact 12 digits" maxLength={12} />
                </div>

                <div className="md:col-span-2 pt-4">
                    <button
                        type="submit"
                        disabled={loading || updateLoading}
                        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {(loading || updateLoading) ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                        {existingPsa ? 'Update Application' : 'Submit Registration'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default StandardPsaTab;
