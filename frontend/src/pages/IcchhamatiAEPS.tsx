import { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import axios from 'axios';
import { toast } from 'sonner';
import {
    BadgeCheck, CheckCircle2, Clock, CreditCard, FileText, Fingerprint, IndianRupee, Landmark, Loader2, MapPin,
    Download, RefreshCcw, ShieldCheck, Store, Upload, Video, Wallet, X, XCircle,
} from 'lucide-react';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON, SILVER_TILE, inr } from '../components/distributor/shared';
import { useLocationContext } from '../context/LocationContext';
import logo from '../assets/logo.png';
import { captureBiometric, DEVICE_BRANDS, DEVICE_LABELS, type DeviceBrand } from '../utils/rdService';

/* eslint-disable @typescript-eslint/no-explicit-any */

const API = `${import.meta.env.VITE_BACKEND_URL}/api/aeps/icchhamati`;
const OTP_THRESHOLD = 5000;
// Fingpay's eKYC capture must carry this WADH; transactions and 2FA must not.
const EKYC_WADH = 'E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=';
const BRAND_NAME: Record<DeviceBrand, string> = { mantra: 'Mantra', morpho: 'Morpho', startek: 'Startek' };

type Step = 'register' | 'pan' | 'mobile' | 'email' | 'aadhaar' | 'bank' | 'video' | 'video_review' | 'onboard' | 'ekyc' | 'twofa' | 'ready';
type Status = {
    step: Step;
    outletId: string | null;
    aadhaarPayReady?: boolean;
    ekycOtpVerified?: boolean;
    remarks?: string | null;
    primaryKeyId?: string | null;
    encodeFPTxnId?: string | null;
    deviceIMEI?: string;
    deviceName?: string;
    profile: Record<string, string | undefined>;
    details?: Record<string, string>;
    detailsEditable?: boolean;
};

const STEPS: { key: Step; label: string }[] = [
    { key: 'register', label: 'Shop & bank' },
    { key: 'pan', label: 'PAN' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'aadhaar', label: 'Aadhaar' },
    { key: 'bank', label: 'Bank account' },
    { key: 'video', label: 'Video KYC' },
    { key: 'onboard', label: 'Activate' },
    { key: 'ekyc', label: 'Biometric eKYC' },
    { key: 'twofa', label: 'Daily login' },
];
const stepIndex = (s: Step) => (s === 'video_review' ? STEPS.findIndex((x) => x.key === 'video') : s === 'ready' ? STEPS.length : STEPS.findIndex((x) => x.key === s));

const SHOP_PHOTOS = [
    { key: 'shop_inner', label: 'Inside the shop' },
    { key: 'shop_outer', label: 'Shop front' },
];

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Drag a video in, or click to pick or record one; previews what will be uploaded. */
const VideoDrop = ({ video, onChange, disabled }: { video: File | null; onChange: (f: File | null) => void; disabled?: boolean }) => {
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const take = (file?: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('video/')) return toast.error('That is not a video. Choose an MP4 recording.');
        if (file.size > MAX_VIDEO_BYTES) return toast.error('The video must be 100 MB or smaller.');
        if (preview) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(file));
        onChange(file);
    };
    const clear = () => {
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        onChange(null);
    };

    if (video) {
        return (
            <div className="flex items-center gap-4 rounded-xl border bg-background p-3">
                {preview && <video src={preview} controls className="h-28 w-48 shrink-0 rounded-lg bg-black object-contain" />}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{video.name}</p>
                    <p className="text-xs text-muted-foreground">{(video.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button type="button" onClick={clear} disabled={disabled} className="rounded-full p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground disabled:opacity-50 dark:hover:bg-white/10" aria-label="Remove video">
                    <XCircle size={18} />
                </button>
            </div>
        );
    }

    return (
        <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); take(e.dataTransfer.files?.[0]); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${dragging ? 'border-primary bg-primary/5' : 'bg-background hover:border-zinc-400'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        >
            <div className={`rounded-xl p-2.5 ${SILVER_TILE}`}><Upload className="h-5 w-5" /></div>
            <span className="text-sm font-semibold">{dragging ? 'Drop the video here' : 'Drag and drop the KYC video'}</span>
            <span className="text-xs text-muted-foreground">or click to choose or record one · MP4, up to 100 MB</span>
            <input type="file" accept="video/*" capture="user" className="hidden" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
    );
};

const TXN_TABS = [
    { key: 'BE', label: 'Balance Enquiry', icon: Wallet },
    { key: 'CW', label: 'Cash Withdrawal', icon: IndianRupee },
    { key: 'MS', label: 'Mini Statement', icon: FileText },
    { key: 'M', label: 'Aadhaar Pay', icon: CreditCard },
] as const;
type TxnType = (typeof TXN_TABS)[number]['key'];

/** POST/GET that always resolves to our { success, message, data } envelope. */
const call = async (path: string, body?: any, method: 'get' | 'post' = 'post') => {
    try {
        const res = method === 'get' ? await axios.get(`${API}${path}`) : await axios.post(`${API}${path}`, body);
        return res.data;
    } catch (error: any) {
        return error?.response?.data || { success: false, message: 'Network error. Please try again.' };
    }
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}</label>
);

/** Scanner model + serial, shared by eKYC, daily login and transactions. */
const DevicePicker = ({ brand, setBrand, serial, setSerial }: { brand: DeviceBrand; setBrand: (b: DeviceBrand) => void; serial: string; setSerial: (s: string) => void }) => (
    <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scanner">
            <select value={brand} onChange={(e) => setBrand(e.target.value as DeviceBrand)} className={INPUT}>
                {DEVICE_BRANDS.map((b) => <option key={b} value={b}>{DEVICE_LABELS[b]}</option>)}
            </select>
        </Field>
        <Field label="Scanner serial number">
            <input value={serial} onChange={(e) => setSerial(e.target.value.trim())} placeholder="Printed under the scanner" className={`${INPUT} font-mono`} />
        </Field>
    </div>
);

const IcchhamatiAEPS = () => {
    const { location } = useLocationContext();
    const [status, setStatus] = useState<Status | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [brand, setBrand] = useState<DeviceBrand>('mantra');
    const [serial, setSerial] = useState('');

    const applyStatus = useCallback((res: any) => {
        if (res.success) {
            setStatus(res.data);
            if (res.data.deviceIMEI) setSerial((s) => s || res.data.deviceIMEI);
            const known = DEVICE_BRANDS.find((b) => String(res.data.deviceName || '').toLowerCase().includes(b));
            if (known) setBrand(known);
        } else toast.error(res.message || 'Could not load AEPS status');
        setLoading(false);
    }, []);
    const load = useCallback(() => call('/status', undefined, 'get').then(applyStatus), [applyStatus]);
    useEffect(() => { call('/status', undefined, 'get').then(applyStatus); }, [applyStatus]);
    const refresh = () => { setLoading(true); load(); };

    /** Runs a step call; on success toasts and reloads the onboarding status. */
    const run = async (path: string, body?: any, { reload = true } = {}) => {
        setBusy(true);
        const res = await call(path, body);
        setBusy(false);
        if (res.success) {
            toast.success(res.message || 'Done');
            if (reload) await load();
        } else toast.error(res.message || 'Request failed');
        return res;
    };

    const coords = () => {
        if (!location) {
            toast.error('Allow location access to continue.');
            return null;
        }
        return { latitude: String(location.latitude), longitude: String(location.longitude) };
    };

    /** The provider ties eKYC and 2FA to a registered scanner; register it when it changed. */
    const ensureDevice = async () => {
        if (!serial) {
            toast.error('Enter the scanner serial number.');
            return false;
        }
        if (serial === status?.deviceIMEI && BRAND_NAME[brand] === status?.deviceName) return true;
        const res = await run('/device', { deviceIMEI: serial, deviceName: BRAND_NAME[brand] }, { reload: false });
        if (res.success) setStatus((s) => (s ? { ...s, deviceIMEI: serial, deviceName: BRAND_NAME[brand] } : s));
        return Boolean(res.success);
    };

    const capture = async (opts: { wadh?: string; otp?: string } = {}) => {
        try {
            toast.info('Place the finger on the scanner');
            const { pidData } = await captureBiometric({ ...opts, device: brand });
            return pidData;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Fingerprint capture failed');
            return null;
        }
    };

    if (loading && !status) {
        return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading AEPS…</div>;
    }
    if (!status) {
        return <div className={`${CARD} text-center`}><p className="text-sm text-muted-foreground">AEPS status could not be loaded.</p><button onClick={refresh} className={`${SECONDARY_BUTTON} mt-4`}><RefreshCcw size={16} /> Retry</button></div>;
    }

    const ready = status.step === 'ready';
    const current = stepIndex(status.step);

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Fingerprint className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AEPS</h1>
                            <p className="text-sm text-muted-foreground">Aadhaar Enabled Payment System{status.outletId && <> · Outlet <span className="font-mono">{status.outletId}</span></>}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {ready ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-400"><ShieldCheck size={16} /> Ready</span>
                        ) : (
                            <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400"><Clock size={16} /> {status.step === 'twofa' ? 'Daily login pending' : 'Onboarding'}</span>
                        )}
                        <button onClick={refresh} disabled={loading} className={`${SECONDARY_BUTTON} py-2`} aria-label="Refresh status"><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /></button>
                    </div>
                </div>
            </section>

            {!ready && (
                <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    <aside className={CARD}>
                        <p className={`${LABEL} mb-4`}>Onboarding</p>
                        <ol className="space-y-3">
                            {STEPS.map((s, i) => (
                                <li key={s.key} className="flex items-center gap-3 text-sm">
                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i < current ? 'bg-emerald-500 text-white' : i === current ? 'btn-primary' : 'border bg-background text-muted-foreground'}`}>
                                        {i < current ? <CheckCircle2 size={14} /> : i + 1}
                                    </span>
                                    <span className={i > current ? 'text-muted-foreground' : i === current ? 'font-semibold' : ''}>{s.label}</span>
                                </li>
                            ))}
                        </ol>
                    </aside>
                    <section className={CARD}>
                        {editing ? (
                            <EditDetails status={status} busy={busy} run={run} onDone={() => setEditing(false)} />
                        ) : (<>
                        {status.step !== 'register' && status.detailsEditable && (
                            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 text-sm">
                                <span className="text-muted-foreground">Entered a wrong mobile, email, address or bank detail?</span>
                                <button type="button" disabled={busy} onClick={() => setEditing(true)} className={`${SECONDARY_BUTTON} py-2`}>Edit details</button>
                            </div>
                        )}
                        <OnboardingStep
                            key={status.step /* each step starts with a clean form */}
                            status={status}
                            busy={busy}
                            run={run}
                            coords={coords}
                            device={{ brand, setBrand, serial, setSerial }}
                            ensureDevice={ensureDevice}
                            capture={capture}
                            reload={load}
                            setBusy={setBusy}
                        />
                        </>)}
                    </section>
                </div>
            )}

            {ready && (
                <TransactionPanel
                    status={status}
                    device={{ brand, setBrand, serial, setSerial }}
                    ensureDevice={ensureDevice}
                    capture={capture}
                    run={run}
                />
            )}
        </div>
    );
};

type StepProps = {
    status: Status;
    busy: boolean;
    run: (path: string, body?: any, opts?: { reload?: boolean }) => Promise<any>;
    coords: () => { latitude: string; longitude: string } | null;
    device: { brand: DeviceBrand; setBrand: (b: DeviceBrand) => void; serial: string; setSerial: (s: string) => void };
    ensureDevice: () => Promise<boolean>;
    capture: (opts?: { wadh?: string; otp?: string }) => Promise<string | null>;
    reload: () => Promise<void>;
    setBusy: (b: boolean) => void;
};

const Title = ({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) => (
    <div className="mb-6 flex items-start gap-3">
        <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Icon className="h-4 w-4" /></div>
        <div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{hint}</p></div>
    </div>
);

const OnboardingStep = ({ status, busy, run, coords, device, ensureDevice, capture, reload, setBusy }: StepProps) => {
    const [form, setForm] = useState<Record<string, string>>({
        shop_address: status.profile.shopAddress || '', shop_city: status.profile.city || '', shop_district: status.profile.district || '',
        state_id: '', shop_pin_code: '', account_number: '', ifsc_code: '', bank_name: '', bank_branch: '',
    });
    const [states, setStates] = useState<{ stateId: string; stateName: string }[]>([]);
    const [bankNames, setBankNames] = useState<string[]>([]);
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [txnid, setTxnid] = useState('');
    // OTP verified earlier: resume at the fingerprint with the ids Icchhamati kept.
    const resumeIds = status.ekycOtpVerified && status.primaryKeyId && status.encodeFPTxnId
        ? { primaryKeyId: String(status.primaryKeyId), encodeFPTxnId: status.encodeFPTxnId } : null;
    const [fpIds, setFpIds] = useState<{ primaryKeyId: string; encodeFPTxnId: string } | null>(resumeIds);
    const [ekycOtpOk, setEkycOtpOk] = useState(!!resumeIds);
    const [video, setVideo] = useState<File | null>(null);
    const [shopPhotos, setShopPhotos] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (status.step !== 'register') return;
        call('/states', undefined, 'get').then((r) => r.success && setStates(r.data || []));
        call('/settlement-banks', undefined, 'get').then((r) => r.success && setBankNames(r.data || []));
    }, [status.step]);

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

    switch (status.step) {
        case 'register':
            return (
                <form onSubmit={(e) => { e.preventDefault(); const c = coords(); if (c) run('/register', { ...form, ...c }); }}>
                    <Title icon={Landmark} title="Shop & settlement bank" hint="Your name, PAN, Aadhaar, mobile and email are taken from your KYC profile." />
                    <dl className="mb-6 grid gap-3 rounded-xl border bg-background p-4 text-sm sm:grid-cols-3">
                        {[['Name', status.profile.name], ['PAN', status.profile.pan], ['Aadhaar', status.profile.aadhaar], ['Mobile', status.profile.phone], ['Email', status.profile.email], ['Shop', status.profile.shopName]].map(([k, v]) => (
                            <div key={k}><dt className={LABEL}>{k}</dt><dd className="truncate font-medium">{v || '—'}</dd></div>
                        ))}
                    </dl>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Shop address"><input required value={form.shop_address} onChange={set('shop_address')} className={INPUT} /></Field>
                        <Field label="City"><input required value={form.shop_city} onChange={set('shop_city')} className={INPUT} /></Field>
                        <Field label="District"><input required value={form.shop_district} onChange={set('shop_district')} className={INPUT} /></Field>
                        <Field label="State">
                            <select required value={form.state_id} onChange={set('state_id')} className={INPUT}>
                                <option value="" disabled>Select state</option>
                                {states.map((s) => <option key={s.stateId} value={s.stateId}>{s.stateName}</option>)}
                            </select>
                        </Field>
                        <Field label="Pincode"><input required inputMode="numeric" pattern="\d{6}" maxLength={6} value={form.shop_pin_code} onChange={set('shop_pin_code')} className={INPUT} /></Field>
                        <Field label="Bank name">
                            <input required list="icch-settlement-banks" placeholder="Search or type your bank" value={form.bank_name} onChange={set('bank_name')} className={INPUT} />
                            <datalist id="icch-settlement-banks">{bankNames.map((n) => <option key={n} value={n} />)}</datalist>
                        </Field>
                        <Field label="Account number"><input required inputMode="numeric" pattern="\d{9,18}" value={form.account_number} onChange={set('account_number')} className={`${INPUT} font-mono`} /></Field>
                        <Field label="IFSC"><input required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} className={`${INPUT} font-mono uppercase`} /></Field>
                        <Field label="Branch"><input required value={form.bank_branch} onChange={set('bank_branch')} className={INPUT} /></Field>
                    </div>
                    <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={14} /> Your current location is registered as the shop location.</p>
                    <button disabled={busy} className={`${PRIMARY_BUTTON} mt-6`}>{busy && <Loader2 size={16} className="animate-spin" />} Save and continue</button>
                </form>
            );

        case 'pan':
        case 'bank': {
            const isPan = status.step === 'pan';
            return (
                <div>
                    <Title icon={BadgeCheck} title={isPan ? 'Verify PAN' : 'Verify bank account'} hint={isPan ? `PAN ${status.profile.pan} is checked with NSDL against your name.` : 'A ₹1 penny drop confirms the settlement account is in your name.'} />
                    <button disabled={busy} onClick={() => run(isPan ? '/pan/verify' : '/bank/verify')} className={PRIMARY_BUTTON}>{busy && <Loader2 size={16} className="animate-spin" />} Verify</button>
                </div>
            );
        }

        case 'mobile':
        case 'email':
        case 'aadhaar': {
            const kind = status.step;
            const target = kind === 'mobile' ? status.profile.phone : kind === 'email' ? status.profile.email : `the mobile linked to Aadhaar ${status.profile.aadhaar}`;
            return (
                <div>
                    <Title icon={ShieldCheck} title={`Verify ${kind === 'aadhaar' ? 'Aadhaar' : kind}`} hint={`An OTP is sent to ${target}.`} />
                    {!otpSent ? (
                        <button disabled={busy} className={PRIMARY_BUTTON} onClick={async () => {
                            const res = await run(`/${kind}/send-otp`, {}, { reload: false });
                            if (res.success) { setOtpSent(true); setTxnid(res.data?.txnid || ''); }
                        }}>{busy && <Loader2 size={16} className="animate-spin" />} Send OTP</button>
                    ) : (
                        <div className="flex max-w-sm gap-2">
                            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" inputMode="numeric" className={`${INPUT} font-mono tracking-[0.4em]`} />
                            <button disabled={busy || otp.length < 4} className={PRIMARY_BUTTON} onClick={() => run(`/${kind}/verify-otp`, { otp, txnid })}>Verify</button>
                        </div>
                    )}
                </div>
            );
        }

        case 'video':
            return (
                <div>
                    <Title icon={Video} title="Shop photos & video KYC" hint="Two photos of your shop, then a short video of yourself holding your PAN card inside it." />
                    {status.remarks && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">Sent back by the provider: {status.remarks}</p>}
                    <div className="mb-6 grid gap-3 sm:grid-cols-2">
                        {SHOP_PHOTOS.map(({ key, label }) => (
                            <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${shopPhotos[key] ? 'border-emerald-500/40 bg-emerald-500/5' : 'bg-background'}`}>
                                {shopPhotos[key] ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Store className="h-5 w-5 text-muted-foreground" />}
                                <span className="text-sm font-medium">{label}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    disabled={busy}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        const c = coords();
                                        if (!file || !c) return;
                                        const body = new FormData();
                                        body.append('image', file);
                                        body.append('image_type', key);
                                        body.append('latitude', c.latitude);
                                        body.append('longitude', c.longitude);
                                        const res = await run('/shop-image', body, { reload: false });
                                        if (res.success) setShopPhotos((p) => ({ ...p, [key]: true }));
                                    }}
                                />
                            </label>
                        ))}
                    </div>
                    <VideoDrop video={video} onChange={setVideo} disabled={busy} />
                    <button
                        disabled={busy || !video || SHOP_PHOTOS.some((p) => !shopPhotos[p.key])}
                        className={`${PRIMARY_BUTTON} mt-6`}
                        onClick={async () => {
                            const c = coords();
                            if (!c || !video) return;
                            if (video.size > MAX_VIDEO_BYTES) return toast.error('The video must be 100 MB or smaller.');
                            const body = new FormData();
                            body.append('video', video);
                            body.append('latitude', c.latitude);
                            body.append('longitude', c.longitude);
                            await run('/video-kyc', body);
                        }}
                    >{busy && <Loader2 size={16} className="animate-spin" />} Upload video</button>
                </div>
            );

        case 'video_review':
            return (
                <div>
                    <Title icon={Clock} title="Video KYC under review" hint="The provider is reviewing your video. This usually takes a few hours." />
                    <button onClick={reload} className={SECONDARY_BUTTON}><RefreshCcw size={16} /> Check again</button>
                </div>
            );

        case 'onboard':
            return (
                <div>
                    <Title icon={BadgeCheck} title="Activate AEPS" hint="All checks passed. Create your AEPS merchant account." />
                    <button disabled={busy} onClick={() => run('/onboard')} className={PRIMARY_BUTTON}>{busy && <Loader2 size={16} className="animate-spin" />} Activate</button>
                </div>
            );

        case 'ekyc':
            return (
                <div className="space-y-5">
                    <Title icon={Fingerprint} title="Biometric eKYC" hint="One time: confirm your identity with an OTP and your fingerprint." />
                    <DevicePicker {...device} />
                    {!fpIds ? (
                        <button disabled={busy} className={PRIMARY_BUTTON} onClick={async () => {
                            const c = coords();
                            if (!c || !(await ensureDevice())) return;
                            const res = await run('/ekyc/send-otp', { ...c, deviceIMEI: device.serial }, { reload: false });
                            if (res.success && res.data?.primaryKeyId) setFpIds({ primaryKeyId: res.data.primaryKeyId, encodeFPTxnId: res.data.encodeFPTxnId });
                        }}>{busy && <Loader2 size={16} className="animate-spin" />} Send OTP</button>
                    ) : !ekycOtpOk ? (
                        <div className="flex max-w-sm gap-2">
                            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" inputMode="numeric" className={`${INPUT} font-mono tracking-[0.4em]`} />
                            <button disabled={busy || otp.length < 4} className={PRIMARY_BUTTON} onClick={async () => {
                                const res = await run('/ekyc/verify-otp', { otp, deviceIMEI: device.serial, ...fpIds }, { reload: false });
                                if (res.success) setEkycOtpOk(true);
                            }}>Verify</button>
                            <button disabled={busy} className={SECONDARY_BUTTON} onClick={() => { setFpIds(null); setOtp(''); }}>Resend</button>
                        </div>
                    ) : (
                        <button disabled={busy} className={PRIMARY_BUTTON} onClick={async () => {
                            setBusy(true);
                            const xml = await capture({ wadh: EKYC_WADH });
                            setBusy(false);
                            if (xml) await run('/ekyc/biometric', { xml, deviceIMEI: device.serial, ...fpIds });
                        }}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />} Scan your fingerprint</button>
                    )}
                </div>
            );

        case 'twofa':
            return <DailyLogin status={status} busy={busy} device={device} ensureDevice={ensureDevice} capture={capture} run={run} setBusy={setBusy} serviceType="AEPS" />;

        default:
            return null;
    }
};

/**
 * Back to the data entry: corrects the registration on the same outlet, so a
 * wrong mobile, email, address or bank detail is fixed without starting over.
 * Name, PAN and Aadhaar come from the KYC profile and stay as they are.
 */
const EditDetails = ({ status, busy, run, onDone }: Pick<StepProps, 'status' | 'busy' | 'run'> & { onDone: () => void }) => {
    const [form, setForm] = useState<Record<string, string>>({ ...(status.details || {}) });
    const [states, setStates] = useState<{ stateId: string; stateName: string }[]>([]);
    const [bankNames, setBankNames] = useState<string[]>([]);
    useEffect(() => {
        call('/states', undefined, 'get').then((r) => r.success && setStates(r.data || []));
        call('/settlement-banks', undefined, 'get').then((r) => r.success && setBankNames(r.data || []));
    }, []);
    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        const original = status.details || {};
        const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== (original[k] ?? '')));
        if (!Object.keys(changed).length) return onDone();
        const res = await run('/details', changed);
        if (res.success) onDone();
    };

    return (
        <form onSubmit={save}>
            <Title icon={Landmark} title="Edit registration details" hint={`Changes go to your existing registration${status.outletId ? ` (outlet ${status.outletId})` : ''}; no new registration is created. Name, PAN and Aadhaar come from your KYC profile.`} />
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mobile"><input required inputMode="numeric" pattern="[6-9]\d{9}" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={INPUT} /></Field>
                <Field label="Email"><input required type="email" value={form.email || ''} onChange={set('email')} className={INPUT} /></Field>
                <div className="sm:col-span-2"><Field label="Shop address"><input required minLength={10} value={form.shop_address || ''} onChange={set('shop_address')} placeholder="Shop number, street, area" className={INPUT} /></Field></div>
                <Field label="City"><input required value={form.shop_city || ''} onChange={set('shop_city')} className={INPUT} /></Field>
                <Field label="District"><input required value={form.shop_district || ''} onChange={set('shop_district')} className={INPUT} /></Field>
                <Field label="State">
                    <select required value={form.state_id || ''} onChange={set('state_id')} className={INPUT}>
                        <option value="" disabled>{states.length ? 'Select state' : 'Loading states…'}</option>
                        {states.map((st) => <option key={st.stateId} value={st.stateId}>{st.stateName}</option>)}
                    </select>
                </Field>
                <Field label="Pincode"><input required inputMode="numeric" pattern="\d{6}" value={form.shop_pin_code || ''} onChange={(e) => setForm({ ...form, shop_pin_code: e.target.value.replace(/\D/g, '').slice(0, 6) })} className={INPUT} /></Field>
                <Field label="Bank name">
                    <input required list="icch-edit-banks" value={form.bank_name || ''} onChange={set('bank_name')} className={INPUT} />
                    <datalist id="icch-edit-banks">{bankNames.map((n) => <option key={n} value={n} />)}</datalist>
                </Field>
                <Field label="Account number"><input required inputMode="numeric" pattern="\d{9,18}" value={form.account_number || ''} onChange={set('account_number')} className={`${INPUT} font-mono`} /></Field>
                <Field label="IFSC"><input required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" value={form.ifsc_code || ''} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} className={`${INPUT} font-mono uppercase`} /></Field>
                <Field label="Branch"><input required value={form.bank_branch || ''} onChange={set('bank_branch')} className={INPUT} /></Field>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
                <button disabled={busy} className={PRIMARY_BUTTON}>{busy && <Loader2 size={16} className="animate-spin" />} Save details</button>
                <button type="button" disabled={busy} onClick={onDone} className={SECONDARY_BUTTON}>Cancel</button>
            </div>
        </form>
    );
};

/** Daily merchant fingerprint login, for AEPS or separately for Aadhaar Pay. */
const DailyLogin = ({ status, busy, device, ensureDevice, capture, run, setBusy, serviceType }: Pick<StepProps, 'status' | 'busy' | 'device' | 'ensureDevice' | 'capture' | 'run' | 'setBusy'> & { serviceType: 'AEPS' | 'AP' }) => (
    <div className="space-y-5">
        <Title icon={ShieldCheck} title={serviceType === 'AP' ? 'Aadhaar Pay login' : 'Daily login'} hint="Scan your own fingerprint once a day before serving customers." />
        <DevicePicker {...device} />
        <button disabled={busy} className={PRIMARY_BUTTON} onClick={async () => {
            if (!(await ensureDevice())) return;
            setBusy(true);
            const xml = await capture();
            setBusy(false);
            if (xml) await run('/2fa', { xml, deviceIMEI: device.serial, deviceType: BRAND_NAME[device.brand], primaryKeyId: status.primaryKeyId, encodeFPTxnId: status.encodeFPTxnId, serviceType });
        }}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />} Scan your fingerprint</button>
    </div>
);

const TransactionPanel = ({ status, device, ensureDevice, capture, run }: Pick<StepProps, 'status' | 'device' | 'ensureDevice' | 'capture' | 'run'>) => {
    const [tab, setTab] = useState<TxnType>('BE');
    const [banks, setBanks] = useState<{ iinno: string; bankName: string }[]>([]);
    const [bankID, setBankID] = useState('');
    const [aadhaar, setAadhaar] = useState('');
    const [mobile, setMobile] = useState('');
    const [amount, setAmount] = useState('');
    const [otp, setOtp] = useState('');
    const [otpRef, setOtpRef] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<TxnResult | null>(null);
    const [showReceipt, setShowReceipt] = useState(false);

    useEffect(() => { call('/banks', undefined, 'get').then((r) => r.success && setBanks(r.data || [])); }, []);

    const moves = tab === 'CW' || tab === 'M';
    const needsOtp = moves && Number(amount) > OTP_THRESHOLD;
    const bank = banks.find((b) => String(b.iinno) === bankID);
    const resetOtp = () => { setOtp(''); setOtpRef(''); };

    const validate = () => {
        if (!/^\d{12}$/.test(aadhaar)) return 'Aadhaar number must be 12 digits.';
        if (!/^[6-9]\d{9}$/.test(mobile)) return 'Enter the customer’s 10-digit mobile number.';
        if (!bankID) return 'Select the customer’s bank.';
        if (moves && !(Number(amount) >= 1 && Number(amount) <= 10000)) return 'Amount must be between ₹1 and ₹10,000.';
        return null;
    };
    const base = () => ({ aepsType: tab, aadhaarNumber: aadhaar, customerMobile: mobile, bankID, bankName: bank?.bankName, amount: moves ? Number(amount) : undefined });

    const sendOtp = async () => {
        const problem = validate();
        if (problem) return toast.error(problem);
        setBusy(true);
        const res = await call('/txn-otp', base());
        setBusy(false);
        if (res.success) { setOtpRef(res.data.txnOtpRequestId); toast.success(res.message || 'OTP sent to the customer'); }
        else toast.error(res.message || 'Could not send the OTP');
    };

    const submit = async () => {
        const problem = validate();
        if (problem) return toast.error(problem);
        if (needsOtp && (!otpRef || otp.length < 4)) return toast.error('Enter the OTP the customer received.');
        if (!(await ensureDevice())) return;
        setBusy(true);
        const xml = await capture(needsOtp ? { otp } : {});
        if (!xml) return setBusy(false);
        const res = await call('/transaction', { ...base(), xml, deviceType: BRAND_NAME[device.brand], otp: needsOtp ? otp : undefined, txnOtpRequestId: needsOtp ? otpRef : undefined });
        setBusy(false);
        setResult({ ok: res.success ? true : res.data?.verification === 'PENDING' ? 'pending' : false, message: res.message, data: res.data || {}, at: new Date() });
        setShowReceipt(true);
        resetOtp();
    };

    if (tab === 'M' && status.aadhaarPayReady === false) {
        return (
            <div className="flex flex-col gap-6">
                <TxnTabs tab={tab} setTab={(t) => { setTab(t); setResult(null); resetOtp(); }} />
                <section className={CARD}>
                    <DailyLogin status={status} busy={busy} device={device} ensureDevice={ensureDevice} capture={capture} run={run} setBusy={setBusy} serviceType="AP" />
                </section>
            </div>
        );
    }

    const statement = statementOf(result);

    return (
        <div className="flex flex-col gap-6">
            <TxnTabs tab={tab} setTab={(t) => { setTab(t); setResult(null); resetOtp(); }} />
            <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
                <section className={`${CARD} space-y-5`}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Customer Aadhaar">
                            <input value={aadhaar} onChange={(e) => { setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12)); resetOtp(); }} inputMode="numeric" placeholder="12-digit Aadhaar" className={`${INPUT} font-mono tracking-wider`} />
                        </Field>
                        <Field label="Customer mobile">
                            <input value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); resetOtp(); }} inputMode="numeric" placeholder="10-digit mobile" className={INPUT} />
                        </Field>
                        <Field label="Bank">
                            <select value={bankID} onChange={(e) => { setBankID(e.target.value); resetOtp(); }} className={INPUT}>
                                <option value="" disabled>{banks.length ? 'Select bank' : 'Loading banks…'}</option>
                                {banks.map((b) => <option key={b.iinno} value={b.iinno}>{b.bankName}</option>)}
                            </select>
                        </Field>
                        {moves && (
                            <Field label="Amount">
                                <input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '').slice(0, 5)); resetOtp(); }} inputMode="numeric" placeholder="Up to ₹10,000" className={INPUT} />
                            </Field>
                        )}
                    </div>
                    {needsOtp && (
                        <div className="rounded-xl border bg-background p-4">
                            <p className="mb-3 text-sm">Above ₹{OTP_THRESHOLD.toLocaleString('en-IN')} the customer confirms with an OTP.</p>
                            {!otpRef ? (
                                <button disabled={busy} onClick={sendOtp} className={SECONDARY_BUTTON}>{busy && <Loader2 size={16} className="animate-spin" />} Send OTP to customer</button>
                            ) : (
                                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Customer OTP" inputMode="numeric" className={`${INPUT} max-w-xs font-mono tracking-[0.4em]`} />
                            )}
                        </div>
                    )}
                    <DevicePicker {...device} />
                    <button disabled={busy} onClick={submit} className={`${PRIMARY_BUTTON} w-full`}>
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />} Scan customer fingerprint & submit
                    </button>
                </section>

                <section className={CARD}>
                    <p className={`${LABEL} mb-4`}>Result</p>
                    {!result ? (
                        <p className="text-sm text-muted-foreground">The bank’s answer appears here.</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                {result.ok === true ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : result.ok === 'pending' ? <Clock className="h-5 w-5 text-amber-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                                <p className="font-semibold">{result.message}</p>
                            </div>
                            <dl className="space-y-2 text-sm">
                                {receiptRows(result).map(([k, v]) => (
                                    <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
                                ))}
                            </dl>
                            <button onClick={() => setShowReceipt(true)} className={`${SECONDARY_BUTTON} w-full`}><FileText size={16} /> View receipt</button>
                            {statement && (
                                <div className="max-h-72 overflow-auto rounded-xl border">
                                    <table className="w-full text-xs">
                                        <tbody className="divide-y">
                                            {statement.map((row, i) => (
                                                <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="px-2 py-1.5">{String(v ?? '')}</td>)}</tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
            {result && showReceipt && <ReceiptModal result={result} onClose={() => setShowReceipt(false)} />}
        </div>
    );
};

type TxnResult = { ok: boolean | 'pending'; message: string; data: any; at: Date };

const statementOf = (result: TxnResult | null) =>
    Object.values(result?.data || {}).find((v) => Array.isArray(v) && v.length) as any[] | undefined;

const receiptRows = (result: TxnResult) => {
    const d = result.data;
    return [
        ['Amount', d.transactionAmount !== undefined ? inr.format(Number(d.transactionAmount)) : null],
        ['Account balance', d.balanceAmount !== undefined ? inr.format(Number(d.balanceAmount)) : null],
        ['Bank', d.bankName],
        ['Aadhaar', d.aadhaar],
        ['Customer mobile', d.customerMobile],
        ['Bank RRN', d.bankRRN],
        ['Transaction ID', d.fpTransactionId],
        ['Reference', d.referenceNo],
    ].filter(([, v]) => v) as [string, string][];
};

/** Opens after every transaction, whatever the outcome; the receipt to hand the customer. */
const ReceiptModal = ({ result, onClose }: { result: TxnResult; onClose: () => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    const statement = statementOf(result);
    const type = TXN_TABS.find((t) => t.key === result.data.aepsType)?.label || 'AEPS';
    const tone = result.ok === true ? 'text-emerald-600' : result.ok === 'pending' ? 'text-amber-600' : 'text-red-600';
    const label = result.ok === true ? 'Transaction successful' : result.ok === 'pending' ? 'Awaiting bank confirmation' : 'Transaction failed';

    const download = async () => {
        if (!ref.current) return;
        try {
            const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff' });
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = `AEPS_Receipt_${result.data.referenceNo || result.data.fpTransactionId || Date.now()}.png`;
            a.click();
        } catch {
            toast.error('Could not download the receipt.');
        }
    };

    return (
        <div role="dialog" aria-modal="true" aria-label="Transaction receipt" onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div onClick={(e) => e.stopPropagation()} className="relative max-h-[90vh] w-full max-w-md overflow-y-auto no-scrollbar rounded-2xl bg-white shadow-2xl">
                <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
                <div ref={ref} className="space-y-4 bg-white p-6 text-slate-800">
                    <div className="border-b border-dashed border-slate-300 pb-4 text-center">
                        <img src={logo} alt="Shahparpay" className="mx-auto mb-1 h-10 w-auto object-contain" />
                        <p className="text-xs uppercase tracking-widest text-slate-500">{type} receipt</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-center">
                        {result.ok === true ? <CheckCircle2 className="h-12 w-12 text-emerald-500" /> : result.ok === 'pending' ? <Clock className="h-12 w-12 text-amber-500" /> : <XCircle className="h-12 w-12 text-red-500" />}
                        <p className={`text-lg font-bold ${tone}`}>{label}</p>
                        {result.message && result.message !== label && <p className="text-sm text-slate-500">{result.message}</p>}
                        <p className="text-xs text-slate-500">{result.at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                    <dl className="space-y-2 text-sm">
                        {[['Type', type] as [string, string], ...receiptRows(result)].map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-slate-200 pb-2 last:border-0">
                                <dt className="text-slate-500">{k}</dt><dd className="break-all text-right font-medium tabular-nums">{v}</dd>
                            </div>
                        ))}
                    </dl>
                    {statement && (
                        <table className="w-full text-xs">
                            <tbody className="divide-y">
                                {statement.map((row, i) => (
                                    <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="px-1.5 py-1">{String(v ?? '')}</td>)}</tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <p className="text-center text-[11px] text-slate-400">System generated receipt; no signature required.</p>
                </div>
                <div className="flex gap-3 border-t p-4">
                    <button onClick={download} className={`${SECONDARY_BUTTON} flex-1`}><Download size={16} /> Download</button>
                    <button onClick={onClose} className={`${PRIMARY_BUTTON} flex-1`}>Next transaction</button>
                </div>
            </div>
        </div>
    );
};

const TxnTabs = ({ tab, setTab }: { tab: TxnType; setTab: (t: TxnType) => void }) => (
    <div className="flex w-full gap-1 overflow-x-auto no-scrollbar rounded-2xl border bg-card p-1.5 md:w-max">
        {TXN_TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all ${tab === key ? 'btn-primary' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}>
                <Icon size={16} /> {label}
            </button>
        ))}
    </div>
);

export default IcchhamatiAEPS;
