import React, { useState } from 'react';
import { CreditCard, User, Mail, ChevronRight, Loader2, Store, MapPin, Phone, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PanCard: React.FC = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [psaResult, setPsaResult] = useState<{ psa_id?: string; status?: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        mobile: '',
        email: '',
        pan_no: '',
        pin: '',
        state_id: '',
        district_id: '',
        location: '',
        address_line_1: '',
        address_line_2: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic validation
        if (formData.mobile.length !== 10) return toast.error("Mobile number must be 10 digits");
        if (formData.pin.length !== 6) return toast.error("Pincode must be 6 digits");
        if (formData.pan_no.length !== 10) return toast.error("PAN number must be 10 characters");

        setLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/register-bio-psa`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (res.data.success) {
                toast.success(res.data.message || "Biometric PSA Agent Registered Successfully!");
                setPsaResult(res.data.data);
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

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-primary" />
                        Biometric PSA Agent Registration
                    </h1>
                    <p className="text-muted-foreground">Register your shop to become an authorized Biometric PAN Service Agent (PSA).</p>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column: Instructions & Info */}
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

                        {psaResult && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 space-y-2">
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>Registration Submitted</span>
                                </div>
                                <p className="text-sm text-foreground">
                                    <strong>PSA ID:</strong> {psaResult.psa_id || 'N/A'}
                                </p>
                                <p className="text-sm text-foreground">
                                    <strong>Status:</strong> {psaResult.status || 'PENDING'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Application Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-foreground">Agent Registration Form</h2>
                                <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                                    Biometric PSA
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                
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

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">State ID</label>
                                        <input
                                            type="number"
                                            name="state_id"
                                            value={formData.state_id}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            placeholder="Numeric State ID (e.g. 13)"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">District ID</label>
                                        <input
                                            type="number"
                                            name="district_id"
                                            value={formData.district_id}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            placeholder="Numeric District ID (e.g. 260)"
                                            required
                                        />
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
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Address Line 2 (Optional)</label>
                                        <input
                                            type="text"
                                            name="address_line_2"
                                            value={formData.address_line_2}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            placeholder="Landmark / Locality"
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
            </div>
        </div>
    );
};

export default PanCard;
