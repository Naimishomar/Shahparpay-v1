import { useEffect, useMemo, useState } from 'react';
import ChangePasswordModal from './ChangePasswordModal';
import { Briefcase, Building2, Camera, ChevronRight, KeyRound, Edit2, FileImage, IdCard, Loader2, Lock, Mail, MapPin, Network, Phone, Save, ShieldCheck, Upload, User, X } from 'lucide-react';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON, SILVER_TILE, inrShort, type NetworkAnalytics, useDistributorData } from './shared';
import { Skeleton } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DocView = ({ label, number, picture }: { label: string; number?: string; picture?: string }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
            <p className={LABEL}>{label}</p>
            <span className="font-mono text-sm">{number || '—'}</span>
        </div>
        {picture ? (
            <a href={picture} target="_blank" rel="noreferrer" className="group relative block aspect-[3/2] overflow-hidden rounded-xl border shadow-sm">
                <img src={picture} alt={label} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-sm font-medium text-white">View full</span>
                </div>
            </a>
        ) : (
            <div className="flex aspect-[3/2] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Not uploaded</div>
        )}
    </div>
);

/** Upload box for a document; locked once the number is on record, as before. */
const DocUpload = ({ label, file, onChange, locked, current }: {
    label: string; file: File | null; onChange: (f: File | null) => void; locked: boolean; current?: string;
}) => {
    if (locked) {
        return (
            <div className="flex items-center gap-3 rounded-xl border bg-black/[0.02] dark:bg-white/[0.03] p-3">
                <div className={`rounded-lg p-1.5 ${SILVER_TILE}`}><Lock className="h-3.5 w-3.5" /></div>
                <div className="text-sm">
                    <p className="font-medium">{label} verified</p>
                    <p className="text-xs text-muted-foreground">Contact support to change it.</p>
                </div>
            </div>
        );
    }
    return file ? (
        <div className="flex items-center gap-3 rounded-xl border bg-background p-2.5 shadow-sm">
            <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                <FileImage className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · replaces current</p>
            </div>
            <button type="button" onClick={() => onChange(null)} className="rounded-full p-1.5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Remove ${label} file`}>
                <X size={16} />
            </button>
        </div>
    ) : (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-background p-3 transition hover:border-zinc-400 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
            <div className={`rounded-lg p-1.5 ${SILVER_TILE}`}><Upload className="h-3.5 w-3.5" /></div>
            <div className="text-sm">
                <p className="font-medium">{current ? `Replace ${label} photo` : `Upload ${label} photo`}</p>
                <p className="text-xs text-muted-foreground">JPG or PNG</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
        </label>
    );
};

const DistributorProfile = ({
    token, profile, setProfile, isEditing, setIsEditing, isLoading, message, onSubmit,
    profilePic, setProfilePic, aadhaarPic, setAadhaarPic, panPic, setPanPic, isAadhaarLocked, isPanLocked, onViewNetwork,
}: {
    token: string | null;
    profile: any;
    setProfile: (p: any) => void;
    isEditing: boolean;
    setIsEditing: (v: boolean) => void;
    isLoading: boolean;
    message: string;
    onSubmit: (e: React.FormEvent) => void;
    profilePic: File | null; setProfilePic: (f: File | null) => void;
    aadhaarPic: File | null; setAadhaarPic: (f: File | null) => void;
    panPic: File | null; setPanPic: (f: File | null) => void;
    isAadhaarLocked: boolean;
    isPanLocked: boolean;
    onViewNetwork: () => void;
}) => {
    const { data: network, loading: networkLoading } = useDistributorData<NetworkAnalytics>(token, '/api/distributor/analytics', 30);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const set = (key: string, value: unknown) => setProfile({ ...profile, [key]: value });
    // One object URL per picked file, released when it changes.
    const preview = useMemo(() => (profilePic ? URL.createObjectURL(profilePic) : null), [profilePic]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
    const avatarSrc = preview || profile.profilePicture;
    const address = [profile.address?.city, profile.address?.district, profile.address?.state].filter(Boolean).join(', ');
    const failed = message && !isLoading && !message.toLowerCase().includes('success');

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
                        <label className={`group relative h-24 w-24 shrink-0 rounded-full bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600 p-[3px] shadow-md ${isEditing ? 'cursor-pointer' : ''}`}>
                            <div className="relative h-full w-full overflow-hidden rounded-full bg-background">
                                {avatarSrc ? (
                                    <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold">{profile.name?.charAt(0) || 'D'}</div>
                                )}
                                {isEditing && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                        <Camera size={20} className="mb-0.5" />
                                        <span className="text-[11px] font-medium">Change</span>
                                    </div>
                                )}
                            </div>
                            {isEditing && <input type="file" accept="image/*" className="hidden" onChange={(e) => setProfilePic(e.target.files?.[0] || null)} />}
                        </label>
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl md:text-3xl font-bold tracking-tight">{profile.name}</h1>
                            <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${SILVER_TILE}`}>Distributor</span>
                                {profile.distributorId && (
                                    <span className="rounded-full border bg-background/70 backdrop-blur px-2.5 py-0.5 font-mono text-xs">ID {profile.distributorId}</span>
                                )}
                                {profile.businessName && (
                                    <span className="flex items-center gap-1.5 rounded-full border bg-background/70 backdrop-blur px-2.5 py-0.5 text-xs">
                                        <Briefcase size={12} className="text-muted-foreground" /> {profile.businessName}
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
                                <button type="button" onClick={() => { setIsEditing(false); setProfilePic(null); setAadhaarPic(null); setPanPic(null); }} disabled={isLoading} className={SECONDARY_BUTTON}>
                                    <X size={16} /> Cancel
                                </button>
                                <button type="submit" form="distributor-profile-form" disabled={isLoading} className={`${PRIMARY_BUTTON} px-5`}>
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save changes
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {failed && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{message}</div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <form id="distributor-profile-form" onSubmit={onSubmit} className="lg:col-span-2 flex flex-col gap-6">
                    {/* Personal & business */}
                    <section className={CARD}>
                        <div className="mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-xl p-2 ${SILVER_TILE}`}><User className="h-4 w-4" /></div>
                                <h2 className="text-lg font-semibold">Personal & business</h2>
                            </div>
                            {isEditing && <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Editing</span>}
                        </div>
                        {isEditing ? (
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Full name <span className="text-red-500">*</span></label>
                                    <input value={profile.name || ''} onChange={(e) => set('name', e.target.value)} required className={INPUT} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Contact number <span className="text-red-500">*</span></label>
                                    <input value={profile.contactNumber || ''} onChange={(e) => set('contactNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" required className={INPUT} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Business name <span className="text-red-500">*</span></label>
                                    <input value={profile.businessName || ''} onChange={(e) => set('businessName', e.target.value)} required className={INPUT} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Business address <span className="text-red-500">*</span></label>
                                    <input value={profile.businessAddress || ''} onChange={(e) => set('businessAddress', e.target.value)} required className={INPUT} />
                                </div>
                                <div className="md:col-span-2 rounded-2xl border bg-background p-4">
                                    <label className="flex cursor-pointer items-center gap-3">
                                        <input type="checkbox" checked={!!profile.hasGst} onChange={(e) => set('hasGst', e.target.checked)} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-200" />
                                        <span className="text-sm font-semibold">Business has GST registration</span>
                                    </label>
                                    {profile.hasGst && (
                                        <input value={profile.gstNumber || ''} onChange={(e) => set('gstNumber', e.target.value.toUpperCase())} placeholder="GST number" className={`${INPUT} mt-3 font-mono uppercase`} />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <dl className="grid gap-5 sm:grid-cols-2">
                                {[
                                    [Mail, 'Email', profile.email],
                                    [Phone, 'Contact number', profile.contactNumber],
                                    [Building2, 'Business name', profile.businessName],
                                    [MapPin, 'Business address', profile.businessAddress || address],
                                    ...(profile.hasGst ? [[IdCard, 'GST number', profile.gstNumber]] : []),
                                ].map(([Icon, label, value]: any) => (
                                    <div key={label} className="flex items-start gap-3">
                                        <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                                        <div className="min-w-0">
                                            <dt className={LABEL}>{label}</dt>
                                            <dd className="mt-0.5 truncate font-medium">{value || '—'}</dd>
                                        </div>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </section>

                    {/* Documents */}
                    <section className={CARD}>
                        <div className="mb-5 flex items-center gap-3">
                            <div className={`rounded-xl p-2 ${SILVER_TILE}`}><ShieldCheck className="h-4 w-4" /></div>
                            <h2 className="text-lg font-semibold">Identity documents</h2>
                        </div>
                        {isEditing ? (
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Aadhaar number</label>
                                    <input value={profile.aadhaarNumber || ''} onChange={(e) => set('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))} disabled={isAadhaarLocked} required placeholder="12 digits" className={`${INPUT} font-mono disabled:cursor-not-allowed disabled:opacity-70`} />
                                    <DocUpload label="Aadhaar" file={aadhaarPic} onChange={setAadhaarPic} locked={isAadhaarLocked} current={profile.aadhaarPicture} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">PAN number</label>
                                    <input value={profile.panNumber || ''} onChange={(e) => set('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} disabled={isPanLocked} required placeholder="ABCDE1234F" className={`${INPUT} font-mono uppercase disabled:cursor-not-allowed disabled:opacity-70`} />
                                    <DocUpload label="PAN" file={panPic} onChange={setPanPic} locked={isPanLocked} current={profile.panPicture} />
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2">
                                <DocView label="Aadhaar" number={profile.aadhaarNumber} picture={profile.aadhaarPicture} />
                                <DocView label="PAN" number={profile.panNumber} picture={profile.panPicture} />
                            </div>
                        )}
                    </section>
                </form>

                {/* Network snapshot */}
                <aside className="flex flex-col gap-6">
                    <section className={CARD}>
                        <div className="mb-4 flex items-center gap-3">
                            <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Network className="h-4 w-4" /></div>
                            <div>
                                <h2 className="text-lg font-semibold">Your network</h2>
                                <p className="text-xs text-muted-foreground">Last 30 days</p>
                            </div>
                        </div>
                        {networkLoading && !network ? (
                            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
                        ) : network ? (
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    ['Retailers', network.totals.totalRetailers.toLocaleString('en-IN')],
                                    ['Active', network.totals.activeRetailers.toLocaleString('en-IN')],
                                    ['Commission', inrShort(network.totals.earned)],
                                    ['Lifetime', inrShort(network.lifetimeEarned)],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl border bg-background p-3">
                                        <p className={LABEL}>{label}</p>
                                        <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Network data is unavailable right now.</p>
                        )}
                        <button onClick={onViewNetwork} className={`${SECONDARY_BUTTON} mt-4 w-full justify-center`}>View overview</button>
                    </section>
                    <section className={`${CARD} p-2`}>
                        <p className={`${LABEL} px-4 pt-3 pb-1`}>Security</p>
                        <button
                            onClick={() => setPasswordOpen(true)}
                            className="group flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`rounded-xl p-2 ${SILVER_TILE}`}><KeyRound className="h-4 w-4" /></div>
                                <div>
                                    <p className="text-sm font-semibold">Change password</p>
                                    <p className="text-xs text-muted-foreground">Verified with a code sent to your email</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </button>
                    </section>
                    <section className={`${CARD} text-sm`}>
                        <p className="font-semibold">Need to change your email or a verified document?</p>
                        <p className="mt-1 text-muted-foreground">These are locked for security. Contact the Shahparpay support team and they will update them for you.</p>
                    </section>
                </aside>
            </div>

            {passwordOpen && <ChangePasswordModal token={token} email={profile.email || ''} onClose={() => setPasswordOpen(false)} />}
        </div>
    );
};

export default DistributorProfile;
