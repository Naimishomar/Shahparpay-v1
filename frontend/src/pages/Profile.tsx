import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, MapPin, Building2, ShieldCheck, KeyRound, Lock, ChevronRight, Camera, Edit2, Save, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';
const PRIMARY_BUTTON = `${ACTIVE_BUTTON} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50`;
const SECONDARY_BUTTON = 'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border bg-card/70 backdrop-blur px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50';
const LABEL = 'text-[11px] font-medium uppercase tracking-wider text-muted-foreground';

const Profile = () => {
    const { user, token, checkSession } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Password Change State
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordStep, setPasswordStep] = useState(1);
    // The password and wallet-PIN changes are the same OTP-gated modal; only
    // the final field and the endpoint it posts to differ.
    const [securityMode, setSecurityMode] = useState<'password' | 'pin'>('password');
    const [passwordFormData, setPasswordFormData] = useState({ email: '', otp: '', newPassword: '', newPin: '' });
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
            // send-verification-otp guards signup and refuses an address that
            // already has an account — i.e. every address that could reach this
            // screen. send-password-otp is the signed-in equivalent and takes
            // the address off the access token.
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/send-password-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
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
                setPasswordFormData({ email: '', otp: '', newPassword: '', newPin: '' });
            } else {
                toast.error(data.message || "Failed to change password");
            }
        } catch (error) {
            toast.error("Network error");
        } finally {
            setIsPasswordLoading(false);
        }
    };

    const handleVerifyAndChangePin = async () => {
        if (!/^\d{4}$/.test(passwordFormData.newPin)) {
            toast.error("PIN must be exactly 4 digits");
            return;
        }
        setIsPasswordLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/wallet/change-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ otp: passwordFormData.otp, newPin: passwordFormData.newPin })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Wallet PIN changed successfully!");
                setIsPasswordModalOpen(false);
                setPasswordStep(1);
                setPasswordFormData({ email: '', otp: '', newPassword: '', newPin: '' });
            } else {
                toast.error(data.message || "Failed to change PIN");
            }
        } catch (error) {
            toast.error("Network error");
        } finally {
            setIsPasswordLoading(false);
        }
    };

    const openSecurityModal = (mode: 'password' | 'pin') => {
        setSecurityMode(mode);
        setPasswordStep(1);
        setPasswordFormData({ email: '', otp: '', newPassword: '', newPin: '' });
        setIsPasswordModalOpen(true);
    };

    const closeSecurityModal = () => {
        setIsPasswordModalOpen(false);
        setPasswordStep(1);
        setPasswordFormData({ email: '', otp: '', newPassword: '', newPin: '' });
    };

    const kycComplete = user?.role !== 'retailer' || user?.isMerchantKycComplete;
    const distributorCode = (user as any)?.distributorId?.distributorId || (user as any)?.distributorId;
    const addressLine = [(user as any)?.address?.city, (user as any)?.address?.district, (user as any)?.address?.state].filter(Boolean).join(', ');

    const sectionHeader = (Icon: typeof User, title: string, editable = false) => (
        <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 ${SILVER_TILE}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            </div>
            {editable && isEditing && (
                <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Editing</span>
            )}
        </div>
    );

    const documentTile = (label: string, number?: string, picture?: string) => (
        <div className="space-y-2">
            <p className={LABEL}>{label}</p>
            <p className="text-sm font-mono text-foreground">{number || 'Not provided'}</p>
            {picture ? (
                <a href={picture} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border w-full max-w-[14rem] aspect-[3/2] shadow-sm">
                    <img src={picture} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-sm font-medium text-white">View full</span>
                    </div>
                </a>
            ) : (
                <div className="flex w-full max-w-[14rem] aspect-[3/2] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Not uploaded</div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                        {/* Avatar */}
                        <button
                            type="button"
                            onClick={() => document.getElementById('profilePictureInput')?.click()}
                            className="group relative h-24 w-24 shrink-0 rounded-full bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600 p-[3px] shadow-md"
                            aria-label="Update profile photo"
                        >
                            <input
                                type="file"
                                id="profilePictureInput"
                                className="hidden"
                                accept="image/*"
                                onChange={handleProfilePictureUpload}
                            />
                            <div className="relative h-full w-full overflow-hidden rounded-full bg-background">
                                {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-foreground">
                                        {user?.name?.charAt(0) || 'U'}
                                    </div>
                                )}
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                    <Camera size={20} className="mb-0.5" />
                                    <span className="text-[11px] font-medium">Update</span>
                                </div>
                            </div>
                        </button>

                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate">{user?.name || 'Retailer Name'}</h1>
                            {user?.email && <p className="text-sm text-muted-foreground truncate">{user.email}</p>}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${SILVER_TILE}`}>
                                    {user?.role || 'Retailer'}
                                </span>
                                {user?.retailerId && (
                                    <span className="rounded-full border bg-background/70 backdrop-blur px-2.5 py-0.5 text-xs font-mono text-foreground">
                                        ID {user.retailerId}
                                    </span>
                                )}
                                {user?.role === 'retailer' && distributorCode && (
                                    <span className="flex items-center gap-1.5 rounded-full border bg-background/70 backdrop-blur px-2.5 py-0.5 text-xs font-mono text-foreground">
                                        <Building2 size={12} className="text-muted-foreground" />
                                        {distributorCode}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start lg:self-center">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className={SECONDARY_BUTTON}>
                                <Edit2 size={16} /> Edit profile
                            </button>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(false)} className={SECONDARY_BUTTON} disabled={isLoading}>
                                    <X size={16} /> Cancel
                                </button>
                                <button onClick={handleSave} className={`${PRIMARY_BUTTON} px-5`} disabled={isLoading}>
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save changes
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column - details */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="rounded-2xl border bg-card p-6 shadow-sm">
                        {sectionHeader(User, 'Personal information', true)}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className={LABEL}>Full name</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className={INPUT}
                                    />
                                ) : (
                                    <p className="font-medium text-foreground py-2.5">{user?.name || 'N/A'}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className={LABEL}>Email address <span className="normal-case tracking-normal">(not editable)</span></label>
                                <div className="flex items-center gap-2 py-2.5">
                                    <Mail size={16} className="text-muted-foreground shrink-0" />
                                    <p className="font-medium text-foreground truncate">{user?.email || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={LABEL}>Contact number</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.contactNumber}
                                        onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
                                        className={INPUT}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 py-2.5">
                                        <Phone size={16} className="text-muted-foreground shrink-0" />
                                        <p className="font-medium text-foreground tabular-nums">{user?.contactNumber || 'N/A'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border bg-card p-6 shadow-sm">
                        {sectionHeader(Building2, 'Business details', true)}
                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <label className={LABEL}>Business name</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.businessName}
                                        onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                                        className={INPUT}
                                    />
                                ) : (
                                    <p className="font-medium text-foreground py-2.5">{(user as any)?.businessName || 'N/A'}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className={LABEL}>Registered address</label>
                                {isEditing ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input
                                            type="text"
                                            placeholder="City"
                                            value={formData.address.city}
                                            onChange={(e) => setFormData({...formData, address: {...formData.address, city: e.target.value}})}
                                            className={INPUT}
                                        />
                                        <input
                                            type="text"
                                            placeholder="District"
                                            value={formData.address.district}
                                            onChange={(e) => setFormData({...formData, address: {...formData.address, district: e.target.value}})}
                                            className={INPUT}
                                        />
                                        <input
                                            type="text"
                                            placeholder="State"
                                            value={formData.address.state}
                                            onChange={(e) => setFormData({...formData, address: {...formData.address, state: e.target.value}})}
                                            className={INPUT}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 py-2.5">
                                        <MapPin size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                                        <p className="font-medium text-foreground">{addressLine || 'N/A'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border bg-card p-6 shadow-sm">
                        {sectionHeader(ShieldCheck, 'Identity documents')}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {documentTile('Aadhaar', aadhaarNumber, aadhaarPicture)}
                            {documentTile('PAN', panNumber, panPicture)}
                        </div>
                    </section>
                </div>

                {/* Right column - status & security */}
                <div className="flex flex-col gap-6">
                    <section className="rounded-2xl border bg-card p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-foreground">KYC status</h2>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ${kycComplete
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${kycComplete ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {kycComplete ? 'Verified' : 'Pending'}
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {kycComplete
                                    ? 'Your account is fully verified and unrestricted.'
                                    : 'Complete your KYC to unlock all features.'}
                            </p>
                        </div>
                        {!kycComplete && (
                            <button className={`${PRIMARY_BUTTON} mt-4 w-full`}>Complete now</button>
                        )}
                        <p className="mt-4 rounded-xl border bg-background px-3 py-2.5 text-xs text-muted-foreground">
                            Identity details can't be changed here. Contact support for help with KYC details.
                        </p>
                    </section>

                    <section className="rounded-2xl border bg-card p-2 shadow-sm">
                        <p className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Security</p>
                        {([
                            { mode: 'password', icon: KeyRound, title: 'Change password', hint: 'Update your sign-in credentials' },
                            { mode: 'pin', icon: Lock, title: 'Change wallet PIN', hint: '4-digit PIN for DMT and settlements' },
                        ] as const).map(({ mode, icon: Icon, title, hint }) => (
                            <button
                                key={mode}
                                onClick={() => openSecurityModal(mode)}
                                className="group w-full flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3 text-left">
                                    <div className={`rounded-xl p-2 ${SILVER_TILE}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{title}</p>
                                        <p className="text-xs text-muted-foreground">{hint}</p>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </button>
                        ))}
                    </section>
                </div>
            </div>

            {/* Password / PIN modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-md rounded-3xl border bg-card p-6 sm:p-8 shadow-2xl">
                        <button
                            onClick={closeSecurityModal}
                            className="absolute top-4 right-4 rounded-full p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex flex-col items-center text-center mb-6">
                            <div className={`mb-4 rounded-2xl p-3 ${SILVER_TILE}`}>
                                {securityMode === 'pin' ? <Lock className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground">
                                {securityMode === 'pin' ? 'Change wallet PIN' : 'Change password'}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {passwordStep === 1
                                    ? "Verify your identity to proceed."
                                    : securityMode === 'pin'
                                        ? "Enter the OTP and your new 4-digit PIN."
                                        : "Enter the OTP and your new password."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {passwordStep === 1 && (
                                <>
                                    <div className="text-left space-y-1.5">
                                        <label className="text-sm font-medium text-foreground">Registered email</label>
                                        <p className="text-xs text-muted-foreground">Hint: {getMaskedEmail(user?.email || '')}</p>
                                        <input
                                            type="email"
                                            placeholder="Full email address"
                                            value={passwordFormData.email}
                                            onChange={(e) => setPasswordFormData({...passwordFormData, email: e.target.value})}
                                            className={INPUT}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendPasswordOtp}
                                        disabled={isPasswordLoading || !passwordFormData.email}
                                        className={`${PRIMARY_BUTTON} w-full py-3`}
                                    >
                                        {isPasswordLoading && <Loader2 size={16} className="animate-spin" />}
                                        {isPasswordLoading ? "Sending OTP..." : "Send OTP"}
                                    </button>
                                </>
                            )}

                            {passwordStep === 2 && (
                                <>
                                    <div className="text-left space-y-1.5">
                                        <label className="text-sm font-medium text-foreground">OTP</label>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            placeholder="6-digit OTP"
                                            value={passwordFormData.otp}
                                            onChange={(e) => setPasswordFormData({...passwordFormData, otp: e.target.value.replace(/\D/g, '')})}
                                            className={`${INPUT} tabular-nums`}
                                        />
                                    </div>
                                    {securityMode === 'pin' ? (
                                        <div className="text-left space-y-1.5">
                                            <label className="text-sm font-medium text-foreground">New wallet PIN</label>
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                maxLength={4}
                                                placeholder="4 digits"
                                                value={passwordFormData.newPin}
                                                onChange={(e) => setPasswordFormData({...passwordFormData, newPin: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                                                className={`${INPUT} tracking-[0.5em]`}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-left space-y-1.5">
                                            <label className="text-sm font-medium text-foreground">New password</label>
                                            <input
                                                type="password"
                                                placeholder="Enter new password"
                                                value={passwordFormData.newPassword}
                                                onChange={(e) => setPasswordFormData({...passwordFormData, newPassword: e.target.value})}
                                                className={INPUT}
                                            />
                                        </div>
                                    )}
                                    <button
                                        onClick={securityMode === 'pin' ? handleVerifyAndChangePin : handleVerifyAndChangePassword}
                                        disabled={
                                            isPasswordLoading ||
                                            passwordFormData.otp.length !== 6 ||
                                            (securityMode === 'pin'
                                                ? passwordFormData.newPin.length !== 4
                                                : passwordFormData.newPassword.length < 6)
                                        }
                                        className={`${PRIMARY_BUTTON} w-full py-3`}
                                    >
                                        {isPasswordLoading && <Loader2 size={16} className="animate-spin" />}
                                        {isPasswordLoading ? "Updating..." : securityMode === 'pin' ? "Change PIN" : "Change password"}
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
