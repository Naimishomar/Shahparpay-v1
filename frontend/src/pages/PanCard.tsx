import React, { useState } from 'react';
import { CreditCard, User, Mail, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PanCard: React.FC = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '1',
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: 'Male',
        mode: 'E',
        email_id: ''
    });
    
    // State to hold the dynamic form for redirect
    const [redirectData, setRedirectData] = useState<{
        response_url: string;
        encdata: string;
    } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.first_name || !formData.last_name) {
            toast.error("First Name and Last Name are required.");
            return;
        }

        if (formData.mode === 'E' && !formData.email_id) {
            toast.error("Email ID is required for Electronic PAN.");
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/generate-url`,
                {
                    ...formData,
                    redirect_url: window.location.origin + '/dashboard'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (res.data.success) {
                toast.success("Redirecting to NSDL Portal...");
                setRedirectData({
                    response_url: res.data.data.response_url,
                    encdata: res.data.data.encdata
                });
            } else {
                toast.error(res.data.message || "Failed to generate PAN request.");
            }
        } catch (error: any) {
            console.error("PAN Error:", error);
            toast.error(error.response?.data?.message || "An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Automatically submit the form once redirect data is set
    React.useEffect(() => {
        if (redirectData) {
            const form = document.getElementById('nsdl-redirect-form') as HTMLFormElement;
            if (form) {
                form.submit();
            }
        }
    }, [redirectData]);

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-primary" />
                        NSDL PAN Card Services
                    </h1>
                    <p className="text-muted-foreground">Apply for a new Electronic or Physical PAN Card for your customers.</p>
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
                                        <p className="text-xs text-muted-foreground">Enter the customer's name, gender, and PAN mode</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">NSDL Portal</p>
                                        <p className="text-xs text-muted-foreground">You'll be redirected to the official NSDL portal</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Complete Application</p>
                                        <p className="text-xs text-muted-foreground">Fill remaining details on NSDL and make payment</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PAN Mode Info */}
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-foreground mb-3">PAN Card Types</h2>
                            <div className="space-y-3">
                                <div className="p-3 rounded-xl border border-border/50 bg-background/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-bold text-foreground">Electronic PAN (E-PAN)</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Digital PAN card sent via email. Faster processing.</p>
                                </div>
                                <div className="p-3 rounded-xl border border-border/50 bg-background/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CreditCard className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-bold text-foreground">Physical PAN</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Physical card delivered to address. Takes 15-20 days.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Application Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-foreground">Customer Details</h2>
                                <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                                    NSDL PAN
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Row 1: Title & Gender */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Title</label>
                                        <select
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            required
                                        >
                                            <option value="1">Mr / Shri</option>
                                            <option value="2">Mrs / Shrimati</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Gender</label>
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            required
                                        >
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Transgender">Transgender</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Row 2: First Name & Middle Name */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">First Name</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                name="first_name"
                                                value={formData.first_name}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                placeholder="Enter first name"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                                            Middle Name <span className="text-muted-foreground text-xs">(Optional)</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                name="middle_name"
                                                value={formData.middle_name}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                placeholder="Enter middle name"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Last Name */}
                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1.5 block">Last Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            placeholder="Enter last name"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Row 4: Mode & Email */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">PAN Card Mode</label>
                                        <select
                                            name="mode"
                                            value={formData.mode}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                            required
                                        >
                                            <option value="E">Electronic PAN (E-PAN)</option>
                                            <option value="P">Physical PAN</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                                            Email Address {formData.mode === 'E' && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="email"
                                                name="email_id"
                                                value={formData.email_id}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                                placeholder="customer@email.com"
                                                required={formData.mode === 'E'}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <div className="pt-4 border-t border-border/30">
                                    <button
                                        type="submit"
                                        disabled={loading || redirectData !== null}
                                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Processing...
                                            </>
                                        ) : redirectData !== null ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Redirecting to NSDL...
                                            </>
                                        ) : (
                                            <>
                                                <ChevronRight className="w-5 h-5" />
                                                Proceed to NSDL Application
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>

                            {/* Hidden form for NSDL redirect via POST */}
                            {redirectData && (
                                <form 
                                    id="nsdl-redirect-form" 
                                    action={redirectData.response_url} 
                                    method="POST" 
                                    className="hidden"
                                >
                                    <input type="hidden" name="encdata" value={redirectData.encdata} />
                                </form>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PanCard;
