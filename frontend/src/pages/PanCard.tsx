import React, { useState } from 'react';
import { CreditCard, User, Mail, ChevronRight, FileText, Loader2, Store, MapPin, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PanCard: React.FC = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic validation
        if (formData.mobile.length !== 10) return toast.error("Mobile number must be 10 digits");
        if (formData.pincode.length !== 6) return toast.error("Pincode must be 6 digits");
        if (formData.pan_no.length !== 10) return toast.error("PAN number must be 10 characters");
        if (formData.aadhar_no.length !== 12) return toast.error("Aadhaar number must be 12 digits");

        setLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/register-psa`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (res.data.success) {
                toast.success(res.data.message || "PSA Registration Successful!");
                setFormData({
                    shop_name: '', name: '', state: '', district: '', address: '', pincode: '', mobile: '', email: '', dob: '', pan_no: '', aadhar_no: ''
                });
            } else {
                toast.error(res.data.message || "Failed to register PSA.");
            }
        } catch (error: any) {
            console.error("PSA Error:", error);
            toast.error(error.response?.data?.message || "An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-primary" />
                        UTI PSA Registration
                    </h1>
                    <p className="text-muted-foreground">Register for UTI PSA to provide PAN Card services.</p>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column: Instructions & Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-xl font-bold text-foreground mb-4">How It Works</h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Fill Details</p>
                                        <p className="text-xs text-muted-foreground">Enter all required shop and personal details.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Submit Application</p>
                                        <p className="text-xs text-muted-foreground">Submit the form for approval.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Approval</p>
                                        <p className="text-xs text-muted-foreground">Wait for your PSA ID to be approved.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Application Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-foreground">Registration Details</h2>
                                <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                                    UTI PSA
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Shop Name</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Store className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                name="shop_name"
                                                value={formData.shop_name}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                placeholder="Enter shop name"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">ShopKeeper Name</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                placeholder="Enter full name"
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
                                                placeholder="10 digit mobile"
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
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">PAN Number</label>
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
                                                placeholder="10 char PAN"
                                                maxLength={10}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Aadhaar Number</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <CreditCard className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                name="aadhar_no"
                                                value={formData.aadhar_no}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    if(val.length <= 12) setFormData({...formData, aadhar_no: val});
                                                }}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                placeholder="12 digit Aadhaar"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Date of Birth</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="date"
                                                name="dob"
                                                value={formData.dob}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Address</label>
                                        <div className="relative">
                                            <div className="absolute top-3 left-3 pointer-events-none">
                                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <textarea
                                                name="address"
                                                value={formData.address}
                                                onChange={(e: any) => handleChange(e)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all min-h-[80px]"
                                                placeholder="Full Address"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">State</label>
                                        <input
                                            type="text"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            placeholder="State"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">District</label>
                                        <input
                                            type="text"
                                            name="district"
                                            value={formData.district}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            placeholder="District"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Pincode</label>
                                        <input
                                            type="text"
                                            name="pincode"
                                            value={formData.pincode}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if(val.length <= 6) setFormData({...formData, pincode: val});
                                            }}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            placeholder="6 digit pincode"
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
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <ChevronRight className="w-5 h-5" />
                                                Submit Registration
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PanCard;
