import { useEffect, useMemo, useState } from 'react';
import ChangePasswordModal from './ChangePasswordModal';
import { Camera, ChevronRight, Edit2, FileImage, Loader2, Lock, Save, Upload, X } from 'lucide-react';
import { ALERT_ERROR } from '../landing/ui';
import { BUTTON, BUTTON_QUIET, FIELD, inrShort, type NetworkAnalytics, useDistributorData } from './shared';
import { Empty, PageHeader, Panel, Skeleton, TextLink } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DocView = ({ label, number, picture }: { label: string; number?: string; picture?: string }) => (
    <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
            <p className="text-muted-foreground">{label}</p>
            <span className="lp-figure text-foreground">{number || '—'}</span>
        </div>
        {picture ? (
            <a href={picture} target="_blank" rel="noreferrer" className="group relative block aspect-[3/2] overflow-hidden rounded-xl border">
                <img src={picture} alt={label} className="h-full w-full object-cover" />
                <span className="absolute bottom-2 right-2 rounded-md bg-card px-2 py-1 text-[12px] text-foreground opacity-0 transition-opacity group-hover:opacity-100">View full</span>
            </a>
        ) : (
            <div className="flex aspect-[3/2] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Not uploaded</div>
        )}
    </div>
);

/** Upload row for a document; locked once the number is on record, as before. */
const DocUpload = ({ label, file, onChange, locked, current }: {
    label: string; file: File | null; onChange: (f: File | null) => void; locked: boolean; current?: string;
}) => {
    if (locked) {
        return (
            <div className="flex h-12 items-center gap-2.5 rounded-[10px] border bg-muted/50 px-4 text-sm">
                <Lock className="size-4 flex-none text-muted-foreground" />
                <span className="text-foreground">{label} verified</span>
                <span className="ml-auto text-[12px] text-muted-foreground">Ask support to change</span>
            </div>
        );
    }
    return file ? (
        <div className="flex h-12 items-center gap-3 rounded-[10px] border bg-card pl-4 pr-1 text-sm">
            <FileImage className="size-4 flex-none text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate text-foreground">{file.name}</p>
            <span className="lp-figure flex-none text-[12px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
            <button type="button" onClick={() => onChange(null)} className="flex size-10 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${label} file`}>
                <X size={16} />
            </button>
        </div>
    ) : (
        <label className="flex h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border border-dashed bg-card px-4 text-sm transition-colors hover:bg-muted/50">
            <Upload className="size-4 flex-none text-muted-foreground" />
            <span className="text-foreground">{current ? `Replace ${label} photo` : `Upload ${label} photo`}</span>
            <span className="ml-auto text-[12px] text-muted-foreground">JPG or PNG</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] || null)} />
        </label>
    );
};

/** A hairline key/value row: label muted on the left, value on the right. */
const KV = ({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) => (
    <div className="flex items-baseline justify-between gap-4 border-b px-5 py-3 text-sm last:border-0">
        <dt className="flex-none text-muted-foreground">{label}</dt>
        <dd className={`min-w-0 truncate text-right text-foreground ${mono ? 'lp-figure' : ''}`}>{children || '—'}</dd>
    </div>
);

const LBL = 'text-sm text-foreground';

const DistributorProfile = ({
    token, profile, setProfile, isEditing, setIsEditing, isLoading, message, onSubmit,
    profilePic, setProfilePic, aadhaarPic, setAadhaarPic, panPic, setPanPic, isAadhaarLocked, isPanLocked, onViewNetwork,
    roleLabel = 'Distributor', code, showNetwork = true,
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
    /** The admin portal reuses this page with its own label and ID, without the network card. */
    roleLabel?: string;
    code?: string;
    showNetwork?: boolean;
}) => {
    const idCode = code ?? profile.distributorId;
    const { data: network, loading: networkLoading } = useDistributorData<NetworkAnalytics>(token, showNetwork ? '/api/distributor/analytics' : null, 30);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const set = (key: string, value: unknown) => setProfile({ ...profile, [key]: value });
    // One object URL per picked file, released when it changes.
    const preview = useMemo(() => (profilePic ? URL.createObjectURL(profilePic) : null), [profilePic]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
    const avatarSrc = preview || profile.profilePicture;
    const address = [profile.address?.city, profile.address?.district, profile.address?.state].filter(Boolean).join(', ');
    const failed = message && !isLoading && !message.toLowerCase().includes('success');

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow={
                    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{roleLabel}</span>
                        {idCode && <span className="lp-figure text-foreground">{idCode}</span>}
                        {profile.businessName && <span>{profile.businessName}</span>}
                    </span>
                }
                title={
                    <span className="inline-flex items-center gap-4">
                        <label className={`group relative size-14 flex-none overflow-hidden rounded-full bg-muted ${isEditing ? 'cursor-pointer' : ''}`}>
                            {avatarSrc ? (
                                <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center font-sans text-xl font-medium text-foreground">{profile.name?.charAt(0) || 'D'}</span>
                            )}
                            {isEditing && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                    <Camera size={18} aria-label="Change photo" />
                                </span>
                            )}
                            {isEditing && <input type="file" accept="image/*" className="sr-only" onChange={(e) => setProfilePic(e.target.files?.[0] || null)} />}
                        </label>
                        <span className="truncate">{profile.name}</span>
                    </span>
                }
                description={profile.email}
                actions={!isEditing ? (
                    <button type="button" onClick={() => setIsEditing(true)} className={BUTTON_QUIET}>
                        <Edit2 size={16} strokeWidth={1.75} /> Edit profile
                    </button>
                ) : (
                    <>
                        <button type="button" onClick={() => { setIsEditing(false); setProfilePic(null); setAadhaarPic(null); setPanPic(null); }} disabled={isLoading} className={BUTTON_QUIET}>
                            Cancel
                        </button>
                        <button type="submit" form="distributor-profile-form" disabled={isLoading} className={BUTTON}>
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={1.75} />}
                            Save changes
                        </button>
                    </>
                )}
            />

            {failed && <div className={ALERT_ERROR}>{message}</div>}

            <div className="grid gap-6 xl:grid-cols-3">
                <form id="distributor-profile-form" onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6 xl:col-span-2">
                    <Panel title="Personal and business" action={isEditing ? <span className="text-[13px] text-muted-foreground">Editing</span> : undefined} flush={!isEditing}>
                        {isEditing ? (
                            <div className="grid gap-5 md:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className={LBL}>Full name</span>
                                    <input value={profile.name || ''} onChange={(e) => set('name', e.target.value)} required className={FIELD} />
                                </label>
                                <label className="space-y-1.5">
                                    <span className={LBL}>Contact number</span>
                                    <input value={profile.contactNumber || ''} onChange={(e) => set('contactNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" required className={`${FIELD} lp-figure`} />
                                </label>
                                <label className="space-y-1.5">
                                    <span className={LBL}>Business name</span>
                                    <input value={profile.businessName || ''} onChange={(e) => set('businessName', e.target.value)} required className={FIELD} />
                                </label>
                                <label className="space-y-1.5">
                                    <span className={LBL}>Business address</span>
                                    <input value={profile.businessAddress || ''} onChange={(e) => set('businessAddress', e.target.value)} required className={FIELD} />
                                </label>
                                <div className="space-y-3 md:col-span-2">
                                    <label className="flex cursor-pointer items-center gap-3">
                                        <input type="checkbox" checked={!!profile.hasGst} onChange={(e) => set('hasGst', e.target.checked)} className="size-4 accent-[var(--primary)]" />
                                        <span className={LBL}>Business has GST registration</span>
                                    </label>
                                    {profile.hasGst && (
                                        <input value={profile.gstNumber || ''} onChange={(e) => set('gstNumber', e.target.value.toUpperCase())} placeholder="GST number" className={`${FIELD} lp-figure uppercase`} />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <dl>
                                <KV label="Email">{profile.email}</KV>
                                <KV label="Contact number" mono>{profile.contactNumber}</KV>
                                <KV label="Business name">{profile.businessName}</KV>
                                <KV label="Business address">{profile.businessAddress || address}</KV>
                                {profile.hasGst && <KV label="GST number" mono>{profile.gstNumber}</KV>}
                            </dl>
                        )}
                    </Panel>

                    <Panel title="Identity documents">
                        {isEditing ? (
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="block space-y-1.5">
                                        <span className={LBL}>Aadhaar number</span>
                                        <input value={profile.aadhaarNumber || ''} onChange={(e) => set('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))} disabled={isAadhaarLocked} required placeholder="12 digits" className={`${FIELD} lp-figure`} />
                                    </label>
                                    <DocUpload label="Aadhaar" file={aadhaarPic} onChange={setAadhaarPic} locked={isAadhaarLocked} current={profile.aadhaarPicture} />
                                </div>
                                <div className="space-y-2">
                                    <label className="block space-y-1.5">
                                        <span className={LBL}>PAN number</span>
                                        <input value={profile.panNumber || ''} onChange={(e) => set('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} disabled={isPanLocked} required placeholder="ABCDE1234F" className={`${FIELD} lp-figure uppercase`} />
                                    </label>
                                    <DocUpload label="PAN" file={panPic} onChange={setPanPic} locked={isPanLocked} current={profile.panPicture} />
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2">
                                <DocView label="Aadhaar" number={profile.aadhaarNumber} picture={profile.aadhaarPicture} />
                                <DocView label="PAN" number={profile.panNumber} picture={profile.panPicture} />
                            </div>
                        )}
                    </Panel>
                </form>

                <aside className="flex min-w-0 flex-col gap-6">
                    {showNetwork && (
                        <Panel title="Your network" description="Last 30 days" action={<TextLink onClick={onViewNetwork}>Overview</TextLink>} flush>
                            {networkLoading && !network ? (
                                <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
                            ) : network ? (
                                <dl>
                                    <KV label="Retailers" mono>{network.totals.totalRetailers.toLocaleString('en-IN')}</KV>
                                    <KV label="Active" mono>{network.totals.activeRetailers.toLocaleString('en-IN')}</KV>
                                    <KV label="Commission" mono>{inrShort(network.totals.earned)}</KV>
                                    <KV label="Lifetime" mono>{inrShort(network.lifetimeEarned)}</KV>
                                </dl>
                            ) : (
                                <Empty>Network data is unavailable right now.</Empty>
                            )}
                        </Panel>
                    )}
                    <Panel title="Security" flush>
                        <button
                            type="button"
                            onClick={() => setPasswordOpen(true)}
                            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
                        >
                            <div>
                                <p className="text-sm text-foreground">Change password</p>
                                <p className="text-[12px] text-muted-foreground">Verified with a code sent to your email</p>
                            </div>
                            <ChevronRight size={16} className="flex-none text-muted-foreground" />
                        </button>
                    </Panel>
                    {/* Only distributors have a support team above them to ask. */}
                    {showNetwork && (
                        <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
                            Your email and verified documents are locked for security. Contact the Shahparpay support team to change them.
                        </p>
                    )}
                </aside>
            </div>

            {passwordOpen && <ChangePasswordModal token={token} email={profile.email || ''} onClose={() => setPasswordOpen(false)} />}
        </div>
    );
};

export default DistributorProfile;
