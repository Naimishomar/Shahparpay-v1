import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, IdCard, Mail, Phone, Store } from 'lucide-react';
import CreateRetailerWizard, { type RetailerForm } from '../components/distributor/CreateRetailerWizard';
import { BTN_PRIMARY, H1, LEAD, WRAP } from '@/components/landing/ui';
import logo from '../assets/logo.png';
import './landing.css';

/** What the form asks for, so nobody stops halfway to fetch a document. */
const NEEDS = [
    { icon: Mail, label: 'An email and mobile number you can check now' },
    { icon: IdCard, label: 'PAN and Aadhaar, with a clear photo of each' },
    { icon: Store, label: 'Your shop name and address' },
];

const API = import.meta.env.VITE_BACKEND_URL;

const EMPTY: RetailerForm = {
    prefix: 'Mr', firstName: '', lastName: '', email: '', otp: '', contactNumber: '', password: '',
    dob: '', city: '', landmark: '', district: '', state: '',
    businessName: '', businessAddress: '', aadhaarNumber: '', panNumber: '', hasGst: false, gstNumber: '',
    website: '', brandName: '', companyRegisterName: '', supportEmail: '', supportMobile: '',
};
const ADDRESS_KEYS = ['city', 'landmark', 'district', 'state'];

/**
 * Public retailer self signup, as in the app: the distributor's onboarding form
 * with an email OTP, posted to /signup-retailer. The account waits for an admin,
 * who approves it and picks the distributor.
 */
const Signup: React.FC = () => {
    const [formData, setFormData] = useState<RetailerForm>(EMPTY);
    // Generated once per visit, the same way the app does.
    const [merchantCode] = useState(() => `RT${Math.floor(100000 + Math.random() * 900000)}`);
    const [aadhaarPicture, setAadhaarPicture] = useState<File | null>(null);
    const [panPicture, setPanPicture] = useState<File | null>(null);
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [done, setDone] = useState(false);

    const post = async (path: string, body: unknown) => {
        try {
            const res = await fetch(`${API}/api/auth/${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            return await res.json();
        } catch {
            return { success: false, message: 'Could not reach the server. Check your connection and try again.' };
        }
    };

    const sendOtp = async () => {
        setSendingOtp(true);
        const data = await post('send-verification-otp', { email: formData.email, name: `${formData.firstName} ${formData.lastName}`.trim() });
        setSendingOtp(false);
        if (data.success) {
            setOtpSent(true);
            toast.success('OTP sent to your email');
        } else toast.error(data.message || 'Could not send the OTP');
    };

    const verifyEmail = async () => {
        setVerifyingEmail(true);
        const data = await post('verify-email-otp', { email: formData.email, otp: formData.otp });
        setVerifyingEmail(false);
        if (data.success) {
            setIsEmailVerified(true);
            toast.success('Email verified');
        } else toast.error(data.message || 'Invalid OTP');
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEmailVerified) return toast.error('Verify your email first.');
        if (!aadhaarPicture || !panPicture) return toast.error('Upload the Aadhaar and PAN photos.');

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (!ADDRESS_KEYS.includes(key)) data.append(key, String(value));
        });
        data.append('address', JSON.stringify(Object.fromEntries(ADDRESS_KEYS.map((k) => [k, formData[k]]))));
        data.append('disabledServices', '[]');
        data.append('merchantCode', merchantCode);
        data.append('aadhaarPicture', aadhaarPicture);
        data.append('panPicture', panPicture);
        if (profilePicture) data.append('profilePicture', profilePicture);

        setIsLoading(true);
        setMessage('Creating your account…');
        try {
            const res = await fetch(`${API}/api/auth/signup-retailer`, { method: 'POST', body: data });
            const json = await res.json();
            if (json.success) {
                setMessage('Account created successfully.');
                setDone(true);
            } else {
                setMessage(json.message || 'Could not create the account.');
                toast.error(json.message || 'Could not create the account.');
            }
        } catch {
            setMessage('Could not reach the server. Check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="landing-page min-h-screen">
            <header className="border-b border-[var(--lp-border)]">
                <div className={`${WRAP} flex h-16 items-center justify-between`}>
                    <Link to="/" aria-label="Shahparpay home">
                        <img src={logo} alt="Shahparpay" className="h-8 w-auto object-contain sm:h-9" />
                    </Link>
                    <p className="text-sm text-[var(--lp-fg-2)]">
                        <span className="hidden sm:inline">Already have an account? </span>
                        <Link to="/login" className="text-[var(--lp-accent-ink)] hover:underline">Sign in</Link>
                    </p>
                </div>
            </header>

            {done ? (
                <main className={`${WRAP} py-20 sm:py-28`}>
                    <div className="mx-auto max-w-lg text-center" role="status">
                        <CheckCircle2 aria-hidden strokeWidth={1.5} className="mx-auto size-10 text-[var(--lp-positive)]" />
                        <h1 className={`${H1} mt-6`}>Account created</h1>
                        <p className={`${LEAD} mt-4`}>
                            An admin will verify your details. Sign in with your email and password to check the status.
                        </p>
                        <Link to="/login" className={`${BTN_PRIMARY} mt-10`}>
                            <ArrowLeft aria-hidden strokeWidth={1.5} className="size-4" /> Back to sign in
                        </Link>
                    </div>
                </main>
            ) : (
                <main>
                    <section className="border-b border-[var(--lp-border)]">
                        <div className={`${WRAP} grid gap-10 py-12 sm:py-16 lg:grid-cols-12 lg:items-end`}>
                            <div className="lg:col-span-7">
                                <p className="lp-eyebrow">Retailer signup</p>
                                <h1 className={`${H1} mt-3`}>Open your banking point</h1>
                                <p className={`${LEAD} mt-5 max-w-xl`}>
                                    Four short steps. An admin verifies your account, then you can start serving customers.
                                </p>
                            </div>
                            <div className="lg:col-span-5">
                                <p className="text-sm text-[var(--lp-muted)]">Keep these ready</p>
                                <ul className="mt-3 divide-y divide-[var(--lp-border)] border-y border-[var(--lp-border)]">
                                    {NEEDS.map(({ icon: Icon, label }) => (
                                        <li key={label} className="flex h-12 items-center gap-3 text-[15px] text-[var(--lp-fg)]">
                                            <Icon aria-hidden strokeWidth={1.5} className="size-[18px] shrink-0 text-[var(--lp-muted)]" /> {label}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-3 flex items-center gap-2 text-sm text-[var(--lp-fg-2)]">
                                    <Phone aria-hidden strokeWidth={1.5} className="size-4 text-[var(--lp-muted)]" /> Stuck? Call <a href="tel:+918240039776" className="lp-figure text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">+91 8240039776</a>
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="lp-band py-10 sm:py-14">
                        <div className={WRAP}>
                            <CreateRetailerWizard
                                self
                                formData={formData}
                                setFormData={setFormData}
                                parentName=""
                                merchantCode={merchantCode}
                                aadhaarPicture={aadhaarPicture} setAadhaarPicture={setAadhaarPicture}
                                panPicture={panPicture} setPanPicture={setPanPicture}
                                profilePicture={profilePicture} setProfilePicture={setProfilePicture}
                                otpSent={otpSent}
                                sendingOtp={sendingOtp}
                                isEmailVerified={isEmailVerified}
                                verifyingEmail={verifyingEmail}
                                onSendOtp={sendOtp}
                                onVerifyEmail={verifyEmail}
                                onResetEmail={() => {
                                    setOtpSent(false);
                                    setIsEmailVerified(false);
                                    setFormData({ ...formData, otp: '' });
                                }}
                                isLoading={isLoading}
                                message={message}
                                onSubmit={submit}
                            />
                        </div>
                    </section>
                </main>
            )}
        </div>
    );
};

export default Signup;
