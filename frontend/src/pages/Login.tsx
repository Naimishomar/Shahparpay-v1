import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
    User, 
    Lock, 
    ArrowLeft, 
    ShieldCheck, 
    CheckCircle2, 
    Sparkles, 
    KeyRound, 
    Zap, 
    CreditCard, 
    QrCode, 
    Fingerprint, 
    Receipt,
    Eye,
    EyeOff,
    Check,
    Building2,
    Shield
} from 'lucide-react';
import logo from '../assets/logo.png';
import heroCspBg from '../assets/hero-csp-bg.svg';

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
        } catch (err) {
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
        } catch (err) {
            setError('System error occurred. Please check your internet connection.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex w-full bg-white text-slate-900 selection:bg-[#FDE3CF] selection:text-slate-900 font-sans relative overflow-hidden">
            {/* ------------------------------------------------ LEFT BRANDING & HERO COMPONENTS PANEL */}
            <div className="hidden lg:flex flex-col justify-between w-7/12 p-10 xl:p-14 relative overflow-hidden bg-white border-r border-slate-200/80">
                {/* Background illustration: neighbourhood shops with a CSP banking point (same as landing hero).
                    Only on tall screens; on short ones a cropped strip of it looks broken behind the footer. */}
                <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#FFF8F2] via-white to-[#ecfdf3]" />
                <img
                    src={heroCspBg}
                    alt=""
                    className="hidden [@media(min-height:860px)]:block absolute bottom-0 inset-x-0 w-full h-[210px] object-cover object-[100%_100%] pointer-events-none select-none z-0"
                />

                {/* Top Ambient Radial Glows */}
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#F79440]/25 rounded-full blur-3xl pointer-events-none z-0" />
                <div className="absolute bottom-10 -right-20 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none z-0" />

                {/* TOP HEADER LOGO & NAV */}
                <div className="relative z-10 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3 group">
                        <img
                            src={logo}
                            alt="Shahparpay Logo"
                            className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-[#E55C11] transition-colors bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 shadow-xs"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-[#BE4510]" />
                        <span>Return to Website</span>
                    </Link>
                </div>

                {/* CENTER CONTENT CONTAINER */}
                <div className="relative z-10 my-auto py-8 space-y-6 max-w-xl">
                    {/* Eyebrow Pill Badge (from Landing Hero) */}
                    <div className="inline-flex items-center gap-2 bg-[#FEF3EA] text-[#BE4510] border border-[#FAD3B5] px-4 py-1.5 rounded-full text-xs font-bold shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-[#BE4510]" />
                        <span>Digital banking services for your shop</span>
                    </div>

                    <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                        Welcome back to your <span className="text-[#BE4510]">Banking Point</span>
                    </h1>

                    <p className="text-slate-600 font-medium text-sm xl:text-base leading-relaxed">
                        Serve your neighbourhood with AEPS, Micro ATM, money transfer, recharge, bill payments and PAN services, all from one dashboard.
                    </p>

                    {/* HERO LIME/YELLOW OFFER CARD (Directly referenced from Landing Page Hero) */}
                    <div
                        className="rounded-2xl p-5 border border-orange-300/90 shadow-md relative overflow-hidden backdrop-blur-md space-y-3"
                        style={{
                            background: 'linear-gradient(180deg, rgba(254, 232, 214, 0.95) 0%, rgba(255, 246, 236, 0.95) 100%)'
                        }}
                    >
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-[#7A2E06] tracking-tight">₹0</span>
                            <span className="text-sm font-extrabold text-[#7A2E06]">to join. You earn a commission on every transaction.</span>
                        </div>

                        <div className="w-full h-px bg-slate-900/10" />

                        <div className="grid grid-cols-3 gap-2 text-[0.7rem] font-bold text-slate-800">
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#7A2E06] shrink-0" />
                                <span>Settle to bank daily</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#7A2E06] shrink-0" />
                                <span>Commission on every service</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#7A2E06] shrink-0" />
                                <span>Call &amp; WhatsApp support</span>
                            </div>
                        </div>
                    </div>

                    {/* PAYMENT MODES STRIP */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[0.68rem] font-extrabold text-slate-400 uppercase tracking-wider mr-2">Supports:</span>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
                            <Fingerprint className="w-3.5 h-3.5 text-[#BE4510]" /> AePS
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
                            <CreditCard className="w-3.5 h-3.5 text-[#BE4510]" /> Micro ATM
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
                            <QrCode className="w-3.5 h-3.5 text-[#BE4510]" /> UPI Collect
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
                            <Receipt className="w-3.5 h-3.5 text-[#BE4510]" /> BBPS
                        </div>
                    </div>
                </div>

                {/* FOOTER COPYRIGHT */}
                <div className="relative z-10 text-xs font-semibold text-slate-600 flex items-center justify-between">
                    <span className="bg-white/85 backdrop-blur-sm px-3 py-1 rounded-full">© {new Date().getFullYear()} Shahparpay Solutions Pvt. Ltd.</span>
                    <span className="flex items-center gap-1.5 bg-white/85 backdrop-blur-sm px-3 py-1 rounded-full"><Zap className="w-4 h-4 text-[#008c46]" /> Runs on NPCI rails</span>
                </div>
            </div>

            {/* ------------------------------------------------ FULL-AREA RIGHT FORM PANEL */}
            <div className="w-full lg:w-5/12 flex flex-col justify-between p-8 sm:p-12 xl:p-16 relative bg-white z-10">
                {/* Mobile Header Logo */}
                <div className="w-full flex items-center justify-between lg:hidden mb-6">
                    <Link to="/" className="flex items-center gap-2">
                        <img
                            src={logo}
                            alt="Shahparpay Logo"
                            className="h-9 w-auto object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[#E55C11] transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Home</span>
                    </Link>
                </div>

                {/* Desktop Top Security Header */}
                <div className="hidden lg:flex items-center justify-between text-xs font-extrabold text-slate-500">
                    <div className="inline-flex items-center gap-1.5 text-[0.68rem] text-[#BE4510] bg-[#FEF3EA] px-3 py-1 rounded-full border border-[#FAD3B5]">
                        <Building2 className="w-3.5 h-3.5 text-[#BE4510]" />
                        <span>Retailer Portal</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                        <Shield className="w-4 h-4 text-[#008c46]" />
                        <span>256-Bit SSL Encrypted</span>
                    </div>
                </div>

                {/* Main Form Content (Spans naturally in full right area) */}
                <div className="w-full max-w-md mx-auto my-auto py-8 space-y-7">
                    {/* Header Heading */}
                    <div className="space-y-2 text-left">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                            {isForgotMode
                                ? forgotStep === 1
                                    ? 'Reset Password'
                                    : 'Set New Password'
                                : isOtpStep
                                ? 'Security Verification'
                                : 'Sign in to Account'}
                        </h2>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            {isForgotMode
                                ? forgotStep === 1
                                    ? 'Enter your registered User ID, Email, or Mobile to receive a password reset OTP.'
                                    : `Enter the 6-digit OTP sent to ${forgotMaskedEmail || 'your registered email'} and enter your new password.`
                                : isOtpStep
                                ? 'Enter the 6-digit verification code sent to your registered contact.'
                                : 'Enter your registered credentials to access your merchant dashboard.'}
                        </p>
                    </div>

                    {/* Notifications / Alerts */}
                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-200">
                            <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[0.6rem] font-black shrink-0 mt-0.5">!</span>
                            <span>{error}</span>
                        </div>
                    )}
                    {message && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{message}</span>
                        </div>
                    )}

                    {/* FORGOT PASSWORD FLOW vs NORMAL LOGIN FLOW */}
                    {isForgotMode ? (
                        forgotStep === 1 ? (
                            /* FORGOT PASSWORD STEP 1: REQUEST OTP */
                            <form onSubmit={handleSendResetOtp} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                        User ID / Email / Phone Number
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#E55C11] transition-colors">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={forgotIdentifier}
                                            onChange={(e) => setForgotIdentifier(e.target.value)}
                                            placeholder="Enter registered User ID, Email, or Phone"
                                            className="w-full pl-12 pr-4 py-3.5 sm:py-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-sm sm:text-base font-semibold focus:border-[#E55C11] focus:bg-white focus:ring-4 focus:ring-[#E55C11]/10 outline-none transition-all placeholder:text-slate-400"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !forgotIdentifier.trim()}
                                    className="w-full py-4 px-6 bg-[#E55C11] hover:bg-[#D2520E] text-white font-extrabold text-base rounded-full shadow-lg shadow-orange-900/10 hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-3 cursor-pointer"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <span>Send Reset OTP</span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsForgotMode(false);
                                        setError('');
                                        setMessage('');
                                    }}
                                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors pt-2 block"
                                >
                                    ← Return to Sign In
                                </button>
                            </form>
                        ) : (
                            /* FORGOT PASSWORD STEP 2: VERIFY OTP & RESET PASSWORD */
                            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                        Verification Code (OTP)
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#E55C11] transition-colors">
                                            <KeyRound className="h-5 w-5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={forgotOtp}
                                            onChange={(e) => setForgotOtp(e.target.value)}
                                            placeholder="••••••"
                                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-center tracking-[0.3em] font-mono text-xl font-bold focus:border-[#E55C11] focus:bg-white focus:ring-4 focus:ring-[#E55C11]/10 outline-none transition-all placeholder:text-slate-300"
                                            required
                                            maxLength={6}
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                        New Password
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#E55C11] transition-colors">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="At least 6 characters"
                                            className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-sm font-semibold focus:border-[#E55C11] focus:bg-white focus:ring-4 focus:ring-[#E55C11]/10 outline-none transition-all placeholder:text-slate-400"
                                            required
                                            minLength={6}
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                        Confirm New Password
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#E55C11] transition-colors">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Re-enter new password"
                                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-sm font-semibold focus:border-[#E55C11] focus:bg-white focus:ring-4 focus:ring-[#E55C11]/10 outline-none transition-all placeholder:text-slate-400"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || forgotOtp.length < 6 || !newPassword || !confirmPassword}
                                    className="w-full py-4 px-6 bg-[#E55C11] hover:bg-[#D2520E] text-white font-extrabold text-base rounded-full shadow-lg shadow-orange-900/10 hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer mt-2"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <span>Reset &amp; Update Password</span>
                                    )}
                                </button>

                                <div className="flex items-center justify-between text-xs pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsForgotMode(false);
                                            setForgotStep(1);
                                            setError('');
                                            setMessage('');
                                        }}
                                        className="text-slate-500 hover:text-slate-900 font-bold transition-colors"
                                    >
                                        ← Cancel &amp; Back to Login
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSendResetOtp()}
                                        disabled={countdown > 0 || isLoading}
                                        className="text-[#BE4510] font-extrabold hover:underline disabled:text-slate-400 disabled:no-underline"
                                    >
                                        {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                                    </button>
                                </div>
                            </form>
                        )
                    ) : !isOtpStep ? (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Identifier Input */}
                            <div className="space-y-2">
                                <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                    User ID / Email / Phone
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#E55C11] transition-colors">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder="Enter your User ID, Email, or Phone"
                                        className="w-full pl-12 pr-4 py-3.5 sm:py-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-sm sm:text-base font-semibold focus:border-[#E55C11] focus:bg-white focus:ring-4 focus:ring-[#E55C11]/10 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsForgotMode(true);
                                            setForgotStep(1);
                                            setForgotIdentifier(identifier);
                                            setError('');
                                            setMessage('');
                                        }}
                                        className="text-xs font-bold text-[#BE4510] hover:underline cursor-pointer"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#E55C11] transition-colors">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full pl-12 pr-12 py-3.5 sm:py-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-sm sm:text-base font-semibold focus:border-[#E55C11] focus:bg-white focus:ring-4 focus:ring-[#E55C11]/10 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                                        required
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me Row & Terms Acceptance */}
                            <div className="space-y-3 pt-1">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <div
                                        onClick={() => setRememberMe(!rememberMe)}
                                        className={`w-4 h-4 rounded-md border transition-all flex items-center justify-center ${
                                            rememberMe
                                                ? 'bg-[#E55C11] border-[#E55C11] text-white'
                                                : 'bg-slate-50 border-slate-300'
                                        }`}
                                    >
                                        {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span className="text-xs font-bold text-slate-600">Remember this device</span>
                                </label>

                                <label className="flex items-start gap-2.5 cursor-pointer select-none p-3 rounded-2xl bg-slate-50 border border-slate-200/90 hover:border-[#E55C11]/40 transition-colors">
                                    <div
                                        onClick={() => setAcceptTerms(!acceptTerms)}
                                        className={`w-4.5 h-4.5 mt-0.5 rounded-md border transition-all flex items-center justify-center shrink-0 ${
                                            acceptTerms
                                                ? 'bg-[#E55C11] border-[#E55C11] text-white'
                                                : 'bg-white border-slate-300'
                                        }`}
                                    >
                                        {acceptTerms && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                    <span className="text-xs font-semibold text-slate-700 leading-relaxed">
                                        I accept &amp; agree to Shahparpay's{' '}
                                        <Link to="/terms" target="_blank" className="text-[#BE4510] font-bold hover:underline">
                                            Terms &amp; Conditions
                                        </Link>{' '}
                                        and{' '}
                                        <Link to="/privacy-policy" target="_blank" className="text-[#BE4510] font-bold hover:underline">
                                            Privacy Policy
                                        </Link>.
                                    </span>
                                </label>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !identifier.trim() || !password || !acceptTerms}
                                className="w-full min-h-13 inline-flex items-center justify-center gap-2.5 bg-[#E55C11] hover:bg-[#D2520E] text-white rounded-full pl-6 pr-2 py-2 text-base font-bold shadow-md transition-all hover:scale-[1.01] disabled:opacity-70 disabled:hover:scale-100 disabled:hover:bg-[#E55C11] disabled:cursor-not-allowed cursor-pointer group mt-4"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Sign In to Dashboard</span>
                                        <span className="w-6 h-6 rounded-full bg-white text-[#E55C11] flex items-center justify-center font-black text-xs [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,-apple-system,sans-serif] group-hover:rotate-45 group-disabled:rotate-0 transition-transform">
                                            ↗
                                        </span>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        /* STEP 2: OTP VERIFICATION FORM */
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                    Security Verification Code
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#E55C11] transition-colors">
                                        <KeyRound className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="••••••"
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-center tracking-[0.3em] font-mono text-xl font-bold focus:border-[#E55C11] focus:bg-white focus:ring-4 focus:ring-[#E55C11]/10 outline-none transition-all placeholder:text-slate-300"
                                        required
                                        maxLength={6}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="flex justify-between items-center pt-1 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setIsOtpStep(false)}
                                        className="text-slate-500 hover:text-slate-900 font-bold transition-colors"
                                    >
                                        ← Change Credentials
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleSubmit()}
                                        disabled={countdown > 0 || isLoading}
                                        className="text-[#BE4510] font-extrabold hover:underline disabled:text-slate-400 disabled:no-underline"
                                    >
                                        {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || otp.length < 6}
                                className="w-full min-h-13 inline-flex items-center justify-center gap-2.5 bg-[#E55C11] hover:bg-[#D2520E] text-white rounded-full pl-6 pr-2 py-2 text-base font-bold shadow-md transition-all hover:scale-[1.01] disabled:opacity-70 disabled:hover:scale-100 disabled:hover:bg-[#E55C11] disabled:cursor-not-allowed cursor-pointer group"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Verify &amp; Enter Dashboard</span>
                                        <span className="w-6 h-6 rounded-full bg-white text-[#E55C11] flex items-center justify-center font-black text-xs [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,-apple-system,sans-serif] group-hover:rotate-45 group-disabled:rotate-0 transition-transform">
                                            ↗
                                        </span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Trust Badges Bar */}
                    <div className="pt-4 grid grid-cols-2 gap-3 text-center">
                        <div className="bg-slate-50 px-3.5 py-3 rounded-2xl border border-slate-200/70 flex items-center justify-center gap-2 text-slate-600 font-bold text-xs">
                            <ShieldCheck className="w-4 h-4 text-[#008c46] shrink-0" />
                            <span>Aadhaar data never stored</span>
                        </div>
                        <div className="bg-slate-50 px-3.5 py-3 rounded-2xl border border-slate-200/70 flex items-center justify-center gap-2 text-slate-600 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-[#008c46] shrink-0" />
                            <span>256-Bit SSL Encrypted</span>
                        </div>
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="w-full text-center text-xs font-semibold text-slate-400">
                    <span>By signing in, you agree to Shahparpay's </span>
                    <Link to="/terms" target="_blank" className="hover:underline text-[#BE4510] font-bold">Terms of Service</Link>
                    <span> &amp; </span>
                    <Link to="/privacy-policy" target="_blank" className="hover:underline text-[#BE4510] font-bold">Privacy Policy</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
