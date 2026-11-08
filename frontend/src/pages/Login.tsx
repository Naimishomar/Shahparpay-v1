import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck, Zap } from 'lucide-react';
import logo from '../assets/logo.png';
import AepsReceipt from '@/components/landing/AepsReceipt';
import { ALERT_ERROR, ALERT_OK, BTN_PRIMARY, INPUT, LABEL } from '@/components/landing/ui';
import './landing.css';

const LINK = 'text-sm text-[var(--lp-accent-ink)] hover:underline disabled:text-[var(--lp-muted)] disabled:no-underline';
const BACK = 'text-sm text-[var(--lp-fg-2)] hover:text-[var(--lp-fg)]';
const OTP_INPUT = `${INPUT} lp-figure text-center text-xl tracking-[0.4em]`;

/** Password field with a show/hide toggle inside it. */
const PasswordInput = ({ show, onToggle, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { show: boolean; onToggle: () => void }) => (
    <div className="relative">
        <input {...props} type={show ? 'text' : 'password'} className={`${INPUT} pr-12`} />
        <button
            type="button"
            onClick={onToggle}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center text-[var(--lp-muted)] hover:text-[var(--lp-fg)]"
        >
            {show ? <EyeOff aria-hidden strokeWidth={1.5} className="size-[18px]" /> : <Eye aria-hidden strokeWidth={1.5} className="size-[18px]" />}
        </button>
    </div>
);

const Spinner = () => <Loader2 aria-hidden strokeWidth={1.5} className="size-5 animate-spin" />;

const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [acceptTerms, setAcceptTerms] = useState(true);
    const [isOtpStep, setIsOtpStep] = useState(false);

    // Forgot Password State
    const [isForgotMode, setIsForgotMode] = useState(false);
    const [forgotStep, setForgotStep] = useState<1 | 2>(1);
    const [forgotIdentifier, setForgotIdentifier] = useState('');
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleSendResetOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: forgotIdentifier.trim() })
            });
            const data = await response.json();

            if (data.success) {
                setForgotEmail(data.email);
                setForgotMaskedEmail(data.maskedEmail);
                setMessage(data.message);
                setForgotStep(2);
                setCountdown(60);
            } else {
                setError(data.message || 'Could not find registered user with these details.');
            }
        } catch {
            setError('Connection error. Please check your network connection.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters long.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match. Please verify.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: forgotEmail,
                    otp: forgotOtp.trim(),
                    newPassword
                })
            });
            const data = await response.json();

            if (data.success) {
                setMessage('Password reset successfully! Please sign in with your new password.');
                setIsForgotMode(false);
                setForgotStep(1);
                setIdentifier(forgotIdentifier);
                setPassword('');
            } else {
                setError(data.message || 'Password reset failed. Please check the OTP.');
            }
        } catch {
            setError('Connection error. Please check your network connection.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError('');
        setIsLoading(true);
        const trimmedIdentifier = identifier.trim();

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ identifier: trimmedIdentifier, password })
            });
            const data = await response.json();

            if (data.success && data.requireOtp) {
                setMessage(data.message);
                setIsOtpStep(true);
                setIsLoading(false);
                setCountdown(60);
            } else {
                setError(data.message || 'Invalid credentials. Please verify and try again.');
                setIsLoading(false);
            }
        } catch {
            setError('System error occurred. Please check your internet connection.');
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/verify-login-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ identifier, otp })
            });
            const data = await response.json();

            if (data.success) {
                login(data.token, { ...data.user, role: data.role }, data.refreshToken);
                setTimeout(() => {
                    if (data.role === 'admin') navigate('/admin');
                    else if (data.role === 'distributor') navigate('/distributor');
                    else navigate('/dashboard');
                }, 500);
            } else {
                setError(data.message || 'Invalid OTP code.');
                setIsLoading(false);
            }
        } catch {
            setError('System error occurred. Please check your internet connection.');
            setIsLoading(false);
        }
    };

    const title = isForgotMode
        ? forgotStep === 1 ? 'Reset your password' : 'Set a new password'
        : isOtpStep ? 'Enter the code' : 'Sign in';
    const subtitle = isForgotMode
        ? forgotStep === 1
            ? 'Enter your registered User ID, email or mobile to receive a password reset OTP.'
            : `Enter the 6-digit OTP sent to ${forgotMaskedEmail || 'your registered email'} and choose a new password.`
        : isOtpStep
        ? 'Enter the 6-digit verification code sent to your registered contact.'
        : 'Use your registered credentials to open your dashboard.';
    const backToSignIn = () => {
        setIsForgotMode(false);
        setForgotStep(1);
        setError('');
        setMessage('');
    };

    return (
        <div className="landing-page grid min-h-screen w-full lg:grid-cols-2">
            {/* Left: the counter, shown on large screens only */}
            <aside className="hidden flex-col justify-between border-r border-[var(--lp-border)] p-10 lg:flex xl:p-14">
                <div className="flex items-center justify-between">
                    <Link to="/" aria-label="Shahparpay home">
                        <img src={logo} alt="Shahparpay" className="h-9 w-auto object-contain" />
                    </Link>
                    <Link to="/" className={`${BACK} inline-flex items-center gap-1.5`}>
                        <ArrowLeft aria-hidden strokeWidth={1.5} className="size-4" /> Back to website
                    </Link>
                </div>

                <div className="mx-auto w-full max-w-lg py-10">
                    <h1 className="lp-serif text-[48px] leading-[1.02] text-[var(--lp-fg)] xl:text-[60px]">
                        Your banking point, one sign in away
                    </h1>
                    <p className="mt-4 text-base leading-relaxed text-[var(--lp-fg-2)]">
                        Serve your neighbourhood with AEPS, Micro ATM, money transfer, recharge, bill payments and PAN services, all from one dashboard.
                    </p>
                    <div className="mt-10">
                        <AepsReceipt />
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm text-[var(--lp-muted)]">
                    <span>© {new Date().getFullYear()} Shahparpay Solutions Pvt. Ltd.</span>
                    <span className="inline-flex items-center gap-1.5"><Zap aria-hidden strokeWidth={1.5} className="size-4" /> Runs on NPCI rails</span>
                </div>
            </aside>

            {/* Right: the form */}
            <main className="flex flex-col p-6 sm:p-10 xl:p-14">
                <div className="flex items-center justify-between lg:justify-end">
                    <Link to="/" aria-label="Shahparpay home" className="lg:hidden">
                        <img src={logo} alt="Shahparpay" className="h-8 w-auto object-contain" />
                    </Link>
                    <span className="hidden text-sm text-[var(--lp-muted)] lg:inline">Retailer, distributor and admin portal</span>
                    <Link to="/" className={`${BACK} inline-flex items-center gap-1.5 lg:hidden`}>
                        <ArrowLeft aria-hidden strokeWidth={1.5} className="size-4" /> Home
                    </Link>
                </div>

                <div className="mx-auto my-auto w-full max-w-sm py-12">
                    <h2 className="lp-serif text-[44px] leading-[1.04] text-[var(--lp-fg)]">{title}</h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-[var(--lp-fg-2)]">{subtitle}</p>

                    <div aria-live="polite" className="mt-6 space-y-3 empty:hidden">
                        {error && <p role="alert" className={ALERT_ERROR}>{error}</p>}
                        {message && <p className={ALERT_OK}>{message}</p>}
                    </div>

                    {isForgotMode ? (
                        forgotStep === 1 ? (
                            <form onSubmit={handleSendResetOtp} className="mt-8 space-y-6">
                                <label className={LABEL}>
                                    User ID, email or mobile
                                    <input
                                        type="text"
                                        value={forgotIdentifier}
                                        onChange={(e) => setForgotIdentifier(e.target.value)}
                                        autoComplete="username"
                                        className={INPUT}
                                        required
                                        disabled={isLoading}
                                    />
                                </label>
                                <button type="submit" disabled={isLoading || !forgotIdentifier.trim()} className={`${BTN_PRIMARY} w-full`}>
                                    {isLoading ? <Spinner /> : 'Send reset OTP'}
                                </button>
                                <button type="button" onClick={backToSignIn} className={`${BACK} block w-full text-center`}>
                                    Back to sign in
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPasswordSubmit} className="mt-8 space-y-6">
                                <label className={LABEL}>
                                    Verification code
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        value={forgotOtp}
                                        onChange={(e) => setForgotOtp(e.target.value)}
                                        className={OTP_INPUT}
                                        required
                                        maxLength={6}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label className={LABEL}>
                                    New password
                                    <PasswordInput
                                        show={showNewPassword}
                                        onToggle={() => setShowNewPassword(!showNewPassword)}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="At least 6 characters"
                                        autoComplete="new-password"
                                        required
                                        minLength={6}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label className={LABEL}>
                                    Confirm new password
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className={INPUT}
                                        required
                                        disabled={isLoading}
                                    />
                                </label>
                                <button
                                    type="submit"
                                    disabled={isLoading || forgotOtp.length < 6 || !newPassword || !confirmPassword}
                                    className={`${BTN_PRIMARY} w-full`}
                                >
                                    {isLoading ? <Spinner /> : 'Update password'}
                                </button>
                                <div className="flex items-center justify-between">
                                    <button type="button" onClick={backToSignIn} className={BACK}>Back to sign in</button>
                                    <button type="button" onClick={() => handleSendResetOtp()} disabled={countdown > 0 || isLoading} className={LINK}>
                                        {countdown > 0 ? <>Resend OTP in <span className="lp-figure">{countdown}s</span></> : 'Resend OTP'}
                                    </button>
                                </div>
                            </form>
                        )
                    ) : !isOtpStep ? (
                        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                            <label className={LABEL}>
                                User ID, email or mobile
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    autoComplete="username"
                                    className={INPUT}
                                    required
                                    disabled={isLoading}
                                />
                            </label>

                            <div>
                                <div className="flex items-center justify-between">
                                    <label htmlFor="login-password" className={LABEL}>Password</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsForgotMode(true);
                                            setForgotStep(1);
                                            setForgotIdentifier(identifier);
                                            setError('');
                                            setMessage('');
                                        }}
                                        className={LINK}
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <PasswordInput
                                    id="login-password"
                                    show={showPassword}
                                    onToggle={() => setShowPassword(!showPassword)}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="flex cursor-pointer items-center gap-3 text-sm text-[var(--lp-fg-2)]">
                                    <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="size-4 accent-[var(--lp-accent)]" />
                                    Remember this device
                                </label>
                                <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[var(--lp-fg-2)]">
                                    <input type="checkbox" checked={acceptTerms} onChange={() => setAcceptTerms(!acceptTerms)} className="mt-0.5 size-4 shrink-0 accent-[var(--lp-accent)]" />
                                    <span>
                                        I accept Shahparpay's{' '}
                                        <Link to="/terms" target="_blank" className="text-[var(--lp-accent-ink)] hover:underline">terms and conditions</Link>
                                        {' '}and{' '}
                                        <Link to="/privacy-policy" target="_blank" className="text-[var(--lp-accent-ink)] hover:underline">privacy policy</Link>
                                    </span>
                                </label>
                            </div>

                            <button type="submit" disabled={isLoading || !identifier.trim() || !password || !acceptTerms} className={`${BTN_PRIMARY} w-full`}>
                                {isLoading ? <Spinner /> : 'Sign in'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6">
                            <label className={LABEL}>
                                Verification code
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className={OTP_INPUT}
                                    required
                                    maxLength={6}
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </label>
                            <button type="submit" disabled={isLoading || otp.length < 6} className={`${BTN_PRIMARY} w-full`}>
                                {isLoading ? <Spinner /> : 'Verify and continue'}
                            </button>
                            <div className="flex items-center justify-between">
                                <button type="button" onClick={() => setIsOtpStep(false)} className={BACK}>Change details</button>
                                <button type="button" onClick={() => handleSubmit()} disabled={countdown > 0 || isLoading} className={LINK}>
                                    {countdown > 0 ? <>Resend code in <span className="lp-figure">{countdown}s</span></> : 'Resend code'}
                                </button>
                            </div>
                        </form>
                    )}

                    {!isForgotMode && !isOtpStep && (
                        <p className="mt-8 text-center text-[15px] text-[var(--lp-fg-2)]">
                            New retailer? <Link to="/signup" className="text-[var(--lp-accent-ink)] hover:underline">Create an account</Link>
                        </p>
                    )}

                    <p className="mt-10 flex items-center gap-2 text-sm text-[var(--lp-muted)]">
                        <ShieldCheck aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
                        Aadhaar data never stored · 256-bit SSL encrypted
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Login;
