import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, MapPin, Building2, ShieldCheck, KeyRound, ChevronRight, LogOut, Camera, Edit2, Save, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const Profile = () => {
    const { user, token, logout, checkSession } = useAuth();
    const [isHovering, setIsHovering] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Password Change State
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordStep, setPasswordStep] = useState(1);
    const [passwordFormData, setPasswordFormData] = useState({ email: '', otp: '', newPassword: '' });
    const [isPasswordLoading, setIsPasswordLoading] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        name: user?.name || '',
        contactNumber: user?.contactNumber || '',
        businessName: (user as any)?.businessName || '',
        address: {
            city: (user as any)?.address?.city || '',
            district: (user as any)?.address?.district || '',
            state: (user as any)?.address?.state || ''
        }
    });

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/update-profile`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Profile updated successfully!');
                setIsEditing(false);
                await checkSession();
            } else {
                toast.error(data.message || 'Failed to update profile');
            }
        } catch (error) {
            toast.error('A network error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const uploadData = new FormData();
            uploadData.append('profilePicture', file);
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/update-profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: uploadData
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Profile picture updated successfully!');
                await checkSession();
            } else {
                toast.error(data.message || 'Failed to update profile picture');
            }
        } catch (error) {
            toast.error('A network error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const aadhaarNumber = (user as any)?.aadhaarNumber;
    const panNumber = (user as any)?.panNumber;
    const aadhaarPicture = (user as any)?.aadhaarPicture;
    const panPicture = (user as any)?.panPicture;

    // Password Change Handlers
    const getMaskedEmail = (email: string) => {
        if (!email) return '';
        const [name, domain] = email.split('@');
        if (name.length <= 3) return `***@${domain}`;
        const visiblePart = name.slice(-3);
        const maskedPart = '*'.repeat(Math.min(name.length - 3, 5)); // show max 5 stars for neatness
        return `${maskedPart}${visiblePart}@${domain}`;
    };

    const handleSendPasswordOtp = async () => {
        if (passwordFormData.email !== user?.email) {
            toast.error("Incorrect email address");
            return;
        }
        setIsPasswordLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/send-verification-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, name: user.name })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("OTP sent to your email");
                setPasswordStep(2);
            } else {
                toast.error(data.message || "Failed to send OTP");
            }
        } catch (error) {
            toast.error("Network error");
        } finally {
            setIsPasswordLoading(false);
        }
    };

    const handleVerifyAndChangePassword = async () => {
        if (!passwordFormData.otp || !passwordFormData.newPassword) {
            toast.error("Please fill all fields");
            return;
        }
        setIsPasswordLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/change-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    email: user?.email, 
                    otp: passwordFormData.otp, 
                    newPassword: passwordFormData.newPassword 
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Password changed successfully!");
                setIsPasswordModalOpen(false);
                setPasswordStep(1);
                setPasswordFormData({ email: '', otp: '', newPassword: '' });
            } else {
                toast.error(data.message || "Failed to change password");
            }
        } catch (error) {
            toast.error("Network error");
        } finally {
            setIsPasswordLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 mt-8">
            
            {/* Profile Info Container */}
            <div className="relative px-6 sm:px-10">
                <div className="glass-card rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row gap-8 items-start md:items-center bg-card shadow-lg border border-border">
                    
                    {/* Avatar */}
                    <div 
                        className="relative w-32 h-32 rounded-full border-4 border-background bg-muted shadow-xl shrink-0 group cursor-pointer overflow-hidden"
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                        onClick={() => document.getElementById('profilePictureInput')?.click()}
                    >
                        <input 
                            type="file" 
                            id="profilePictureInput" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleProfilePictureUpload}
                        />
                        {user?.profilePicture ? (
                            <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary">
                                <span className="text-5xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
                            </div>
                        )}
                        
                        <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
                            <Camera size={24} className="mb-1" />
                            <span className="text-xs font-medium">Update Photo</span>
                        </div>
                    </div>

                    {/* Main Details */}
                    <div className="flex-1 w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-foreground mb-1">{user?.name || 'Retailer Name'}</h1>
                                <p className="text-muted-foreground flex flex-wrap items-center gap-3 mt-2">
                                    <span className="px-2.5 py-0.5 rounded-full bg-white text-primary text-xs font-semibold uppercase tracking-wider">
                                        {user?.role || 'Retailer'}
                                    </span>
                                    {user?.retailerId && (
                                        <span className="text-sm font-mono opacity-80 text-foreground">ID: {user.retailerId}</span>
                                    )}
                                    {user?.role === 'retailer' && (user as any)?.distributorId && (
                                        <span className="text-sm font-mono opacity-80 text-foreground border-l border-border pl-3 flex items-center gap-1.5">
                                            <Building2 size={14} className="text-primary" />
                                            Distributor: {(user as any)?.distributorId?.distributorId || (user as any)?.distributorId}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 self-start">
                                {!isEditing ? (
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="px-5 py-2.5 bg-primary/10 whitespace-nowrap hover:bg-primary/20 dark:bg-white/10 dark:hover:bg-white/20 text-primary dark:text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
                                    >
                                        <Edit2 size={16} /> Edit Profile
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => setIsEditing(false)}
                                            className="px-5 py-2.5 bg-muted hover:bg-muted/80 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white text-foreground rounded-xl font-semibold transition-colors flex items-center gap-2"
                                            disabled={isLoading}
                                        >
                                            <X size={16} /> Cancel
                                        </button>
                                        <button 
                                            onClick={handleSave}
                                            className="px-5 py-2.5 bg-primary whitespace-nowrap hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold shadow-lg transition-all flex items-center gap-2"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            Save Changes
                                        </button>
                                    </>
                                )}
                                <button 
                                    onClick={() => logout && logout()}
                                    className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-500 dark:text-red-400 rounded-xl font-semibold transition-colors flex items-center gap-2"
                                >
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 px-6 sm:px-10">
                
                {/* Left Column - Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Personal Information */}
                    <div className="glass-card rounded-3xl p-8 bg-card shadow-sm border border-border">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                                    <User size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-foreground">Personal Information</h2>
                            </div>
                            {isEditing && <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">Edit Mode</span>}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-sm text-muted-foreground font-medium">Full Name</label>
                                {isEditing ? (
                                    <input 
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full p-2.5 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                    />
                                ) : (
                                    <p className="font-medium text-foreground py-2.5">{user?.name || 'N/A'}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm text-muted-foreground font-medium">Email Address <span className="text-xs font-normal text-primary/70 ml-1">(Uneditable)</span></label>
                                <div className="flex items-center gap-2 opacity-70 cursor-not-allowed">
                                    <Mail size={16} className="text-muted-foreground" />
                                    <p className="font-medium text-foreground py-2.5">{user?.email || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm text-muted-foreground font-medium">Contact Number</label>
                                {isEditing ? (
                                    <input 
                                        type="text"
                                        value={formData.contactNumber}
                                        onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
                                        className="w-full p-2.5 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Phone size={16} className="text-muted-foreground" />
                                        <p className="font-medium text-foreground py-2.5">{user?.contactNumber || 'N/A'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Business Information */}
                    <div className="glass-card rounded-3xl p-8 bg-card shadow-sm border border-border">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                                    <Building2 size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-foreground">Business Details</h2>
                            </div>
                            {isEditing && <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">Edit Mode</span>}
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-sm text-muted-foreground font-medium">Business Name</label>
                                {isEditing ? (
                                    <input 
                                        type="text"
                                        value={formData.businessName}
                                        onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                                        className="w-full p-2.5 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                    />
                                ) : (
                                    <p className="font-medium text-foreground py-2.5">{(user as any)?.businessName || 'N/A'}</p>
                                )}
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className="text-sm text-muted-foreground font-medium">Registered Address</label>
                                {isEditing ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input 
                                            type="text"
                                            placeholder="City"
                                            value={formData.address.city}
                                            onChange={(e) => setFormData({...formData, address: {...formData.address, city: e.target.value}})}
                                            className="w-full p-2.5 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                        />
                                        <input 
                                            type="text"
                                            placeholder="District"
                                            value={formData.address.district}
                                            onChange={(e) => setFormData({...formData, address: {...formData.address, district: e.target.value}})}
                                            className="w-full p-2.5 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                        />
                                        <input 
                                            type="text"
                                            placeholder="State"
                                            value={formData.address.state}
                                            onChange={(e) => setFormData({...formData, address: {...formData.address, state: e.target.value}})}
                                            className="w-full p-2.5 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <MapPin size={16} className="text-muted-foreground mt-3 shrink-0" />
                                        <p className="font-medium text-foreground py-2.5">
                                            {[(user as any)?.address?.city, (user as any)?.address?.district, (user as any)?.address?.state].filter(Boolean).join(', ') || 'N/A'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Identity Documents */}
                    <div className="glass-card rounded-3xl p-8 bg-card shadow-sm border border-border">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
                                <ShieldCheck size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-foreground">Identity Documents</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-muted-foreground">Aadhaar Document</h3>
                                <p className="text-sm font-mono text-foreground">{aadhaarNumber || 'Not provided'}</p>
                                {aadhaarPicture ? (
                                    <a href={aadhaarPicture} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-border w-48 h-32">
                                        <img src={aadhaarPicture} alt="Aadhaar" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-sm font-medium text-white">View Full</span>
                                        </div>
                                    </a>
                                ) : <span className="text-sm text-muted-foreground">Not uploaded</span>}
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-muted-foreground">PAN Document</h3>
                                <p className="text-sm font-mono text-foreground">{panNumber || 'Not provided'}</p>
                                {panPicture ? (
                                    <a href={panPicture} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-border w-48 h-32">
                                        <img src={panPicture} alt="PAN" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-sm font-medium text-white">View Full</span>
                                        </div>
                                    </a>
                                ) : <span className="text-sm text-muted-foreground">Not uploaded</span>}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Column - Status & Actions */}
                <div className="space-y-6">
                    {/* KYC Status */}
                    <div className="glass-card rounded-3xl p-8 relative overflow-hidden bg-card shadow-sm border border-border">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
                        <div className="flex flex-col items-center text-center space-y-3 relative z-10">
                            {user?.isMerchantKycComplete ? (
                                <>
                                    <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-2">
                                        <ShieldCheck size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">KYC Verified</h3>
                                    <p className="text-sm text-muted-foreground">Your account is fully verified and unrestricted.</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mb-2">
                                        <ShieldCheck size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">KYC Pending</h3>
                                    <p className="text-sm text-muted-foreground">Complete your KYC to unlock all features.</p>
                                    <button className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                                        Complete Now
                                    </button>
                                </>
                            )}
                            <div className="mt-4 p-3 bg-muted/50 rounded-xl w-full">
                                <p className="text-xs text-muted-foreground text-center">
                                    <span className="font-semibold block mb-1 text-foreground">Identity Information</span>
                                    Cannot be modified. Please contact support for assistance with KYC details.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Settings */}
                    <div className="glass-card rounded-3xl p-4 bg-card shadow-sm border border-border">
                        <button 
                            onClick={() => setIsPasswordModalOpen(true)}
                            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 rounded-2xl transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                                    <KeyRound size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">Change Password</p>
                                    <p className="text-xs text-muted-foreground">Update your security credentials</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                    </div>
                </div>

            </div>
            
            {/* Change Password Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                        <button 
                            onClick={() => {
                                setIsPasswordModalOpen(false);
                                setPasswordStep(1);
                                setPasswordFormData({ email: '', otp: '', newPassword: '' });
                            }}
                            className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 bg-purple-500/10 text-purple-500 rounded-full flex items-center justify-center mb-4">
                                <KeyRound size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground">Change Password</h2>
                            <p className="text-sm text-muted-foreground mt-2">
                                {passwordStep === 1 ? "Verify your identity to proceed." : "Enter OTP and your new password."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {passwordStep === 1 && (
                                <>
                                    <div className="text-left space-y-2">
                                        <label className="text-sm font-medium text-foreground">Enter Registered Email</label>
                                        <p className="text-xs text-muted-foreground mb-2">Hint: {getMaskedEmail(user?.email || '')}</p>
                                        <input 
                                            type="email" 
                                            placeholder="Full email address"
                                            value={passwordFormData.email}
                                            onChange={(e) => setPasswordFormData({...passwordFormData, email: e.target.value})}
                                            className="w-full p-3 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleSendPasswordOtp}
                                        disabled={isPasswordLoading || !passwordFormData.email}
                                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        {isPasswordLoading ? "Sending OTP..." : "Send OTP"}
                                    </button>
                                </>
                            )}
                            
                            {passwordStep === 2 && (
                                <>
                                    <div className="text-left space-y-2">
                                        <label className="text-sm font-medium text-foreground">Enter OTP</label>
                                        <input 
                                            type="text" 
                                            maxLength={6}
                                            placeholder="6-digit OTP"
                                            value={passwordFormData.otp}
                                            onChange={(e) => setPasswordFormData({...passwordFormData, otp: e.target.value.replace(/\D/g, '')})}
                                            className="w-full p-3 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div className="text-left space-y-2">
                                        <label className="text-sm font-medium text-foreground">New Password</label>
                                        <input 
                                            type="password" 
                                            placeholder="Enter new password"
                                            value={passwordFormData.newPassword}
                                            onChange={(e) => setPasswordFormData({...passwordFormData, newPassword: e.target.value})}
                                            className="w-full p-3 bg-background dark:bg-black/20 border border-border dark:border-white/20 text-foreground dark:text-white rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleVerifyAndChangePassword}
                                        disabled={isPasswordLoading || !passwordFormData.otp || !passwordFormData.newPassword}
                                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        {isPasswordLoading ? "Updating..." : "Change Password"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
