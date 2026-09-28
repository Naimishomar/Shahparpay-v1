import { useState } from 'react';
import {
    ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, CheckCircle2, FileImage, Globe, IdCard, Loader2, Mail,
    Package, Pencil, ShieldCheck, Sparkles, Upload, User, UserPlus, X,
} from 'lucide-react';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON, SILVER_TILE } from './shared';
import { INDIAN_STATES } from '../../constants';
import { SERVICES } from '../../lib/services';

export type RetailerForm = Record<string, string | boolean>;

// One Yes/No per service the retailer UI offers; stored in the form as `svc_<key>`.
const PACKAGES = SERVICES.map((s) => [`svc_${s.key}`, s.label, s.hint] as const);
const PACKAGE_OPTIONS = [['Yes', 'Yes'], ['No', 'No']] as const;

const STEPS = [
    { title: 'Account', hint: 'Who they are and how they sign in', icon: User },
    { title: 'KYC & business', hint: 'Identity documents and shop address', icon: IdCard },
    { title: 'Services & branding', hint: 'What they can use', icon: Package },
    { title: 'Review', hint: 'Check everything, then create', icon: BadgeCheck },
] as const;

const AADHAAR = /^\d{12}$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const MOBILE = /^[6-9]\d{9}$/;

const Field = ({ label, required, error, hint, children, className = '' }: {
    label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string;
}) => (
    <div className={`space-y-1.5 ${className}`}>
        <label className="text-sm font-medium text-foreground">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {children}
        {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
);

/** Drop-zone style picker with an image preview, so a wrong photo is caught before upload. */
const FilePicker = ({ label, file, onChange, required, error }: {
    label: string; file: File | null; onChange: (f: File | null) => void; required?: boolean; error?: string;
}) => {
    const preview = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    return (
        <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{label} {required && <span className="text-red-500">*</span>}</p>
            {file ? (
                <div className="relative flex items-center gap-3 rounded-xl border bg-background p-2.5 shadow-sm">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" onLoad={() => URL.revokeObjectURL(preview)} /> : <FileImage className="m-auto mt-4 h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button type="button" onClick={() => onChange(null)} className="rounded-full p-1.5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Remove ${label}`}>
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <label className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-background px-4 py-5 text-center transition hover:border-zinc-400 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${error ? 'border-red-500/60' : ''}`}>
                    <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Upload className="h-4 w-4" /></div>
                    <span className="text-sm font-medium">Click to upload</span>
                    <span className="text-xs text-muted-foreground">JPG or PNG, a clear photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
                </label>
            )}
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
};

const CreateRetailerWizard = ({
    formData, setFormData, parentName, merchantCode, setMerchantCode, isExistingMerchant, setIsExistingMerchant,
    aadhaarPicture, setAadhaarPicture, panPicture, setPanPicture, profilePicture, setProfilePicture,
    otpSent, sendingOtp, isEmailVerified, verifyingEmail, onSendOtp, onVerifyEmail, onResetEmail,
    isLoading, message, onSubmit,
}: {
    formData: RetailerForm;
    setFormData: (f: RetailerForm) => void;
    parentName: string;
    merchantCode: string;
    setMerchantCode: (v: string) => void;
    isExistingMerchant: boolean;
    setIsExistingMerchant: (v: boolean) => void;
    aadhaarPicture: File | null; setAadhaarPicture: (f: File | null) => void;
    panPicture: File | null; setPanPicture: (f: File | null) => void;
    profilePicture: File | null; setProfilePicture: (f: File | null) => void;
    otpSent: boolean; sendingOtp: boolean; isEmailVerified: boolean; verifyingEmail: boolean;
    onSendOtp: () => void; onVerifyEmail: () => void; onResetEmail: () => void;
    isLoading: boolean;
    message: string;
    onSubmit: (e: React.FormEvent) => void;
}) => {
    const [step, setStep] = useState(0);
    const [touched, setTouched] = useState<Set<number>>(new Set());
    const [showPassword, setShowPassword] = useState(false);

    const v = (k: string) => String(formData[k] ?? '');
    const set = (k: string, value: string | boolean) => setFormData({ ...formData, [k]: value });

    // Errors for every step, shown only once the user has tried to leave that step.
    const errors: Record<string, string>[] = [
        {
            ...(!v('firstName').trim() && { firstName: 'Required' }),
            ...(!v('lastName').trim() && { lastName: 'Required' }),
            ...(!/^\S+@\S+\.\S+$/.test(v('email')) ? { email: 'Enter a valid email' } : !isEmailVerified ? { email: 'Verify this email with the OTP' } : {}),
            ...(!MOBILE.test(v('contactNumber')) && { contactNumber: 'Enter a 10-digit mobile number' }),
            ...(!v('dob') && { dob: 'Required' }),
            ...(v('password').length < 6 && { password: 'At least 6 characters' }),
            ...(isExistingMerchant && !merchantCode.trim() && { merchantCode: 'Enter the existing merchant ID' }),
        },
        {
            ...(!v('businessName').trim() && { businessName: 'Required' }),
            ...(!AADHAAR.test(v('aadhaarNumber')) && { aadhaarNumber: 'Aadhaar is 12 digits' }),
            ...(!PAN.test(v('panNumber')) && { panNumber: 'Format: ABCDE1234F' }),
            ...(!aadhaarPicture && { aadhaarPicture: 'Upload the Aadhaar photo' }),
            ...(!panPicture && { panPicture: 'Upload the PAN photo' }),
            ...(!v('businessAddress').trim() && { businessAddress: 'Required' }),
            ...(!v('city').trim() && { city: 'Required' }),
            ...(!v('district').trim() && { district: 'Required' }),
            ...(!v('state') && { state: 'Select a state' }),
        },
        {},
        {},
    ];
    const err = (k: string) => (touched.has(step) ? errors[step][k] : undefined);
    const stepValid = (i: number) => Object.keys(errors[i]).length === 0;
    const firstInvalid = errors.findIndex((e) => Object.keys(e).length > 0);

    const next = () => {
        setTouched(new Set(touched).add(step));
        if (stepValid(step)) setStep(step + 1);
    };
    const jump = (i: number) => {
        // Forward jumps only past steps that are already complete.
        if (i <= step || errors.slice(0, i).every((e) => Object.keys(e).length === 0)) setStep(i);
        else setTouched(new Set(touched).add(step));
    };

    const inputCls = (k: string) => `${INPUT} ${err(k) ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/15' : ''}`;
    const text = (k: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, clean?: (s: string) => string) => (
        <input
            name={k}
            value={v(k)}
            onChange={(e) => set(k, clean ? clean(e.target.value) : e.target.value)}
            className={inputCls(k)}
            {...props}
        />
    );

    const done = message.toLowerCase().includes('success');

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero + stepper */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><UserPlus className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Onboard a retailer</h1>
                            <p className="text-sm text-muted-foreground">Four short steps. They'll join your network under {parentName}.</p>
                        </div>
                    </div>

                    <ol className="grid grid-cols-4 gap-2">
                        {STEPS.map((s, i) => {
                            const state = i < step ? 'done' : i === step ? 'current' : 'todo';
                            return (
                                <li key={s.title}>
                                    <button type="button" onClick={() => jump(i)} className="group w-full text-left">
                                        <div className={`h-1.5 rounded-full transition-colors ${state === 'todo' ? 'bg-black/10 dark:bg-white/10' : 'bg-zinc-800 dark:bg-zinc-200'}`} />
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${state === 'current' ? 'bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-100' : state === 'done' ? SILVER_TILE : 'bg-background text-muted-foreground ring-border'}`}>
                                                {state === 'done' ? <Check size={14} /> : i + 1}
                                            </span>
                                            <div className="hidden min-w-0 sm:block">
                                                <p className={`truncate text-sm font-semibold ${state === 'todo' ? 'text-muted-foreground' : ''}`}>{s.title}</p>
                                                <p className="truncate text-[11px] text-muted-foreground">{s.hint}</p>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </section>

            <form
                onSubmit={(e) => {
                    // Enter in a field moves forward instead of submitting half a form.
                    if (step < STEPS.length - 1) { e.preventDefault(); next(); return; }
                    if (firstInvalid !== -1) { e.preventDefault(); setStep(firstInvalid); setTouched(new Set(touched).add(firstInvalid)); return; }
                    onSubmit(e);
                }}
                className="grid gap-6 lg:grid-cols-3"
            >
                <section className={`${CARD} lg:col-span-2`}>
                    <div className="mb-6 flex items-center gap-3">
                        {(() => { const Icon = STEPS[step].icon; return <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Icon className="h-4 w-4" /></div>; })()}
                        <div>
                            <p className={LABEL}>Step {step + 1} of {STEPS.length}</p>
                            <h2 className="text-lg font-semibold">{STEPS[step].title}</h2>
                        </div>
                    </div>

                    {step === 0 && (
                        <div className="grid gap-5 md:grid-cols-2 animate-in fade-in duration-300">
                            <Field label="Name" required error={err('firstName') || err('lastName')} className="md:col-span-2">
                                <div className="grid grid-cols-[90px_1fr_1fr] gap-2">
                                    <select value={v('prefix')} onChange={(e) => set('prefix', e.target.value)} className={INPUT} aria-label="Prefix">
                                        {['Mr', 'Mrs', 'Miss'].map((p) => <option key={p}>{p}</option>)}
                                    </select>
                                    {text('firstName', { placeholder: 'First name', autoComplete: 'off' })}
                                    {text('lastName', { placeholder: 'Last name', autoComplete: 'off' })}
                                </div>
                            </Field>

                            <Field label="Email" required error={err('email')} hint={isEmailVerified ? undefined : 'We send a 6-digit code to confirm the address.'} className="md:col-span-2">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        {text('email', { type: 'email', placeholder: 'name@example.com', disabled: otpSent, className: `${inputCls('email')} pl-9 disabled:opacity-70` })}
                                        {isEmailVerified && <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
                                    </div>
                                    {!otpSent ? (
                                        <button type="button" onClick={onSendOtp} disabled={sendingOtp || !/^\S+@\S+\.\S+$/.test(v('email'))} className={SECONDARY_BUTTON}>
                                            {sendingOtp ? <Loader2 size={16} className="animate-spin" /> : null} Send OTP
                                        </button>
                                    ) : !isEmailVerified ? (
                                        <button type="button" onClick={onResetEmail} className={SECONDARY_BUTTON}>Change</button>
                                    ) : null}
                                </div>
                                {otpSent && !isEmailVerified && (
                                    <div className="mt-2 flex gap-2 animate-in fade-in">
                                        <input
                                            value={v('otp')}
                                            onChange={(e) => set('otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="6-digit OTP"
                                            inputMode="numeric"
                                            className={`${INPUT} font-mono tracking-[0.4em]`}
                                        />
                                        <button type="button" onClick={onVerifyEmail} disabled={verifyingEmail || v('otp').length !== 6} className={PRIMARY_BUTTON}>
                                            {verifyingEmail ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Verify
                                        </button>
                                    </div>
                                )}
                            </Field>

                            <Field label="Mobile" required error={err('contactNumber')}>
                                <div className="flex">
                                    <span className="flex items-center rounded-l-xl border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
                                    {text('contactNumber', { inputMode: 'numeric', placeholder: '98765 43210', className: `${inputCls('contactNumber')} rounded-l-none` }, (s) => s.replace(/\D/g, '').slice(0, 10))}
                                </div>
                            </Field>
                            <Field label="Date of birth" required error={err('dob')}>
                                {text('dob', { type: 'date', max: new Date().toISOString().slice(0, 10), className: `${inputCls('dob')} dark:[color-scheme:dark]` })}
                            </Field>

                            <Field label="Password" required error={err('password')} hint="They can change it after signing in.">
                                <div className="relative">
                                    {text('password', { type: showPassword ? 'text' : 'password', placeholder: 'At least 6 characters', autoComplete: 'new-password', className: `${inputCls('password')} pr-16` })}
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </Field>
                            <FilePicker label="Profile photo" file={profilePicture} onChange={setProfilePicture} />

                            <div className="md:col-span-2 rounded-2xl border bg-background p-4">
                                <label className="flex cursor-pointer items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={isExistingMerchant}
                                        onChange={(e) => setIsExistingMerchant(e.target.checked)}
                                        className="mt-0.5 h-4 w-4 rounded border-border accent-zinc-900 dark:accent-zinc-200"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold">Already a PaySprint merchant</p>
                                        <p className="text-xs text-muted-foreground">Tick this to migrate them with their existing merchant ID instead of a new one.</p>
                                    </div>
                                </label>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <Field label={isExistingMerchant ? 'Existing merchant ID' : 'Retailer ID (auto-generated)'} error={err('merchantCode')}>
                                        <input
                                            value={merchantCode}
                                            onChange={(e) => setMerchantCode(e.target.value.toUpperCase())}
                                            disabled={!isExistingMerchant}
                                            className={`${INPUT} font-mono disabled:cursor-not-allowed disabled:opacity-70`}
                                        />
                                    </Field>
                                    <Field label="Parent distributor">
                                        <input value={parentName} disabled className={`${INPUT} disabled:cursor-not-allowed disabled:opacity-70`} />
                                    </Field>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="grid gap-5 md:grid-cols-2 animate-in fade-in duration-300">
                            <Field label="Aadhaar number" required error={err('aadhaarNumber')}>
                                {text('aadhaarNumber', { inputMode: 'numeric', placeholder: '1234 5678 9012', className: `${inputCls('aadhaarNumber')} font-mono tracking-wider` }, (s) => s.replace(/\D/g, '').slice(0, 12))}
                            </Field>
                            <Field label="PAN number" required error={err('panNumber')}>
                                {text('panNumber', { placeholder: 'ABCDE1234F', className: `${inputCls('panNumber')} font-mono uppercase tracking-wider` }, (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                            </Field>
                            <FilePicker label="Aadhaar photo" required file={aadhaarPicture} onChange={setAadhaarPicture} error={err('aadhaarPicture')} />
                            <FilePicker label="PAN photo" required file={panPicture} onChange={setPanPicture} error={err('panPicture')} />

                            <div className="md:col-span-2 border-t pt-5">
                                <p className={`${LABEL} mb-4 flex items-center gap-2`}><Building2 size={14} /> Shop details</p>
                                <div className="grid gap-5 md:grid-cols-2">
                                    <Field label="Business name" required error={err('businessName')}>
                                        {text('businessName', { placeholder: 'e.g. Sharma Mobile Centre' })}
                                    </Field>
                                    <Field label="Company registered name">
                                        {text('companyRegisterName', { placeholder: 'Optional' })}
                                    </Field>
                                    <Field label="Street address" required error={err('businessAddress')} className="md:col-span-2">
                                        {text('businessAddress', { placeholder: 'Shop no., street, area' })}
                                    </Field>
                                    <Field label="City" required error={err('city')}>{text('city', { placeholder: 'City' })}</Field>
                                    <Field label="District" required error={err('district')}>{text('district', { placeholder: 'District' })}</Field>
                                    <Field label="State" required error={err('state')}>
                                        <select value={v('state')} onChange={(e) => set('state', e.target.value)} className={inputCls('state')}>
                                            <option value="" disabled>Select state</option>
                                            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Landmark">{text('landmark', { placeholder: 'Optional' })}</Field>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <p className={`${LABEL} mb-4 flex items-center gap-2`}><Globe size={14} /> Branding & support <span className="normal-case tracking-normal">(optional)</span></p>
                                <div className="grid gap-5 md:grid-cols-2">
                                    <Field label="Brand name">{text('brandName', { placeholder: 'Brand name' })}</Field>
                                    <Field label="Website">
                                        <div className="flex">
                                            <span className="flex items-center rounded-l-xl border border-r-0 bg-muted px-3 text-sm text-muted-foreground">https://</span>
                                            {text('website', { placeholder: 'www.company.com', className: `${INPUT} rounded-l-none` })}
                                        </div>
                                    </Field>
                                    <Field label="Support email">{text('supportEmail', { type: 'email', placeholder: 'support@company.com' })}</Field>
                                    <Field label="Support mobile">{text('supportMobile', { inputMode: 'numeric', placeholder: 'Support number' }, (s) => s.replace(/\D/g, '').slice(0, 10))}</Field>
                                </div>
                            </div>

                            <div className="border-t pt-5">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                    <p className={`${LABEL} flex items-center gap-2`}><Package size={14} /> Service packages</p>
                                    <p className="w-full text-xs text-muted-foreground">Services set to No are hidden from the retailer and blocked. You can change this later from the retailer's page.</p>
                                    <div className="flex gap-2">
                                        {(['Yes', 'No'] as const).map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, ...Object.fromEntries(PACKAGES.map(([k]) => [k, p])) })}
                                                className="rounded-lg border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                                            >
                                                All {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="divide-y rounded-2xl border bg-background">
                                    {PACKAGES.map(([key, label, hint]) => (
                                        <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium">{label}</p>
                                                <p className="text-xs text-muted-foreground">{hint}</p>
                                            </div>
                                            <div className="inline-flex rounded-xl border bg-card p-1" role="radiogroup" aria-label={`${label} package`}>
                                                {PACKAGE_OPTIONS.map(([value, text]) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={v(key) === value}
                                                        onClick={() => set(key, value)}
                                                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${v(key) === value ? 'bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'text-muted-foreground hover:text-foreground'}`}
                                                    >
                                                        {text}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {[
                                { title: 'Account', to: 0, rows: [
                                    ['Name', `${v('prefix')} ${v('firstName')} ${v('lastName')}`],
                                    ['Email', v('email')], ['Mobile', v('contactNumber') && `+91 ${v('contactNumber')}`],
                                    ['Date of birth', v('dob')], ['Retailer ID', merchantCode + (isExistingMerchant ? ' (existing)' : '')],
                                ] },
                                { title: 'KYC & business', to: 1, rows: [
                                    ['Aadhaar', v('aadhaarNumber') && `XXXX XXXX ${v('aadhaarNumber').slice(-4)}`], ['PAN', v('panNumber')],
                                    ['Documents', [aadhaarPicture && 'Aadhaar', panPicture && 'PAN', profilePicture && 'Profile'].filter(Boolean).join(', ')],
                                    ['Business', v('businessName')],
                                    ['Address', [v('businessAddress'), v('city'), v('district'), v('state')].filter(Boolean).join(', ')],
                                ] },
                                { title: 'Services & branding', to: 2, rows: [
                                    ['Brand', v('brandName')], ['Website', v('website')],
                                    ['Packages', PACKAGES.every(([k]) => v(k) === 'Yes') ? 'All services' : PACKAGES.filter(([k]) => v(k) === 'Yes').map(([, l]) => l).join(', ') || 'None'],
                                ] },
                            ].map((block) => (
                                <div key={block.title} className="rounded-2xl border bg-background p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <p className="text-sm font-semibold">{block.title}</p>
                                        <button type="button" onClick={() => setStep(block.to)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                                            <Pencil size={12} /> Edit
                                        </button>
                                    </div>
                                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                                        {block.rows.map(([k, val]) => (
                                            <div key={k} className="flex justify-between gap-3 text-sm sm:block">
                                                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                                                <dd className="truncate font-medium">{val || <span className="text-muted-foreground">—</span>}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            ))}
                            {message && (
                                <div className={`rounded-xl border px-4 py-3 text-sm ${done ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : isLoading ? 'bg-background text-muted-foreground' : 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400'}`}>
                                    {message}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
                        <button type="button" onClick={() => setStep(step - 1)} disabled={step === 0 || isLoading} className={`${SECONDARY_BUTTON} disabled:invisible`}>
                            <ArrowLeft size={16} /> Back
                        </button>
                        {step < STEPS.length - 1 ? (
                            <button type="submit" className={PRIMARY_BUTTON}>
                                {step === 2 ? 'Review' : 'Continue'} <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button type="submit" disabled={isLoading || done} className={`${PRIMARY_BUTTON} px-6`}>
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : done ? <CheckCircle2 size={16} /> : <UserPlus size={16} />}
                                {isLoading ? 'Creating…' : done ? 'Created' : 'Create retailer'}
                            </button>
                        )}
                    </div>
                </section>

                {/* Checklist */}
                <aside className="flex flex-col gap-6">
                    <section className={CARD}>
                        <p className={`${LABEL} mb-4`}>Checklist</p>
                        <ul className="space-y-3 text-sm">
                            {[
                                ['Email verified', isEmailVerified],
                                ['Mobile & date of birth', MOBILE.test(v('contactNumber')) && !!v('dob')],
                                ['Aadhaar number & photo', AADHAAR.test(v('aadhaarNumber')) && !!aadhaarPicture],
                                ['PAN number & photo', PAN.test(v('panNumber')) && !!panPicture],
                                ['Shop address', !!(v('businessName') && v('businessAddress') && v('city') && v('district') && v('state'))],
                            ].map(([label, ok]) => (
                                <li key={label as string} className="flex items-center gap-3">
                                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${ok ? 'bg-emerald-500 text-white' : 'border bg-background'}`}>
                                        {ok && <Check size={12} />}
                                    </span>
                                    <span className={ok ? '' : 'text-muted-foreground'}>{label}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section className={`${CARD} bg-gradient-to-br from-card to-zinc-100/60 dark:to-zinc-900/60`}>
                        <div className="flex items-start gap-3">
                            <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Sparkles className="h-4 w-4" /></div>
                            <div className="text-sm">
                                <p className="font-semibold">After you create them</p>
                                <p className="mt-1 text-muted-foreground">They sign in with this email and password. Send them the KYC link from <b>Retailers</b> so they can start AEPS.</p>
                            </div>
                        </div>
                    </section>
                </aside>
            </form>
        </div>
    );
};

export default CreateRetailerWizard;
