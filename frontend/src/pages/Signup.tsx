import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import CreateRetailerWizard, { type RetailerForm } from '../components/distributor/CreateRetailerWizard';
import logo from '../assets/logo.png';

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
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
                    <Link to="/" aria-label="Shahparpay home">
                        <img src={logo} alt="Shahparpay" className="h-8 w-auto object-contain dark:invert" />
                    </Link>
                    <p className="text-sm text-muted-foreground">
                        Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
                    </p>
                </div>
            </header>

            <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
                {done ? (
                    <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center" role="status">
                        <CheckCircle2 aria-hidden strokeWidth={1.5} className="mx-auto size-10 text-emerald-600" />
                        <h1 className="mt-5 text-2xl font-medium">Account created</h1>
                        <p className="mt-2 leading-relaxed text-muted-foreground">
                            An admin will verify your details. Sign in with your email and password to check the status.
                        </p>
                        <Link to="/login" className="mt-8 inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90">
                            <ArrowLeft aria-hidden strokeWidth={1.5} className="size-4" /> Back to sign in
                        </Link>
                    </div>
                ) : (
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
                )}
            </main>
        </div>
    );
};

export default Signup;
