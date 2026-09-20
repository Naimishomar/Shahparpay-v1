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

const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [isOtpStep, setIsOtpStep] = useState(false);
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
                login(data.token, { ...data.user, role: data.role });
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
        <div className="min-h-screen flex w-full bg-white text-slate-900 selection:bg-[#ccf788] selection:text-slate-900 font-sans relative overflow-hidden">
            {/* ------------------------------------------------ LEFT BRANDING & HERO COMPONENTS PANEL */}
            <div className="hidden lg:flex flex-col justify-between w-7/12 p-10 xl:p-14 relative overflow-hidden bg-white border-r border-slate-200/80">
                {/* Official Cashfree Platform Background Texture */}
                <img
                    src="https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6a9462804c0231fefd408efe_platform-bg-p-1600.png"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 select-none z-0"
                />

                {/* Subtle Hero Background MP4 Video Loop */}
                <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none opacity-30 z-0">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover object-bottom"
                    >
                        <source
                            src="https://cashfreelogo.cashfree.com/website/hero/Homepage_Hero_Cashfree%20revamp_v4%20Mp4.mp4"
                            type="video/mp4"
                        />
                    </video>
                </div>

                {/* Top Ambient Radial Glows */}
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#a3e635]/25 rounded-full blur-3xl pointer-events-none z-0" />
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
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-[#008c46] transition-colors bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 shadow-xs"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>Return to Website</span>
                    </Link>
                </div>

                {/* CENTER CONTENT CONTAINER */}
                <div className="relative z-10 my-auto py-8 space-y-6 max-w-xl">
                    {/* Eyebrow Pill Badge (from Landing Hero) */}
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-4 py-1.5 rounded-full text-xs font-bold shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>India's #1 Payment Infrastructure</span>
                    </div>

                    <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                        Welcome back to your <span className="text-[#008c46]">Payment Command Center</span>
                    </h1>

                    <p className="text-slate-600 font-medium text-sm xl:text-base leading-relaxed">
                        Manage 180+ payment modes, instant 24/7 payouts, automated reconciliation, and AePS banking services from a single dashboard.
                    </p>

                    {/* HERO LIME/YELLOW OFFER CARD (Directly referenced from Landing Page Hero) */}
                    <div
                        className="rounded-2xl p-5 border border-lime-300/90 shadow-md relative overflow-hidden backdrop-blur-md space-y-3"
                        style={{
                            background: 'linear-gradient(180deg, rgba(228, 250, 173, 0.95) 0%, rgba(254, 248, 184, 0.95) 100%)'
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-[#00502b] tracking-tight">0%</span>
                                <span className="text-lg font-bold text-slate-400 line-through">1.95%</span>
                                <span className="text-xs font-extrabold text-[#00502b] uppercase tracking-wide">Platform Fees*</span>
                            </div>
                            <span className="text-[0.68rem] font-bold bg-[#008c46] text-white px-2.5 py-1 rounded-full shadow-2xs">
                                Festive Season Offer
                            </span>
                        </div>

                        <div className="w-full h-px bg-slate-900/10" />

                        <div className="grid grid-cols-3 gap-2 text-[0.7rem] font-bold text-slate-800">
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00502b] shrink-0" />
                                <span>Next-Day Payouts</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00502b] shrink-0" />
                                <span>24/7 Support</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00502b] shrink-0" />
                                <span>Instant Setup</span>
                            </div>
                        </div>
                    </div>

                    {/* LIVE TRANSACTIONS CARD PREVIEW (Referenced from Landing Platform Section) */}
                    <div className="bg-[#ccf788]/40 backdrop-blur-md border border-lime-300/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs">
                                <Zap className="w-5 h-5 text-lime-300" />
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                    <span>Real-time Merchant Settlements</span>
                                </div>
                                <p className="text-[0.72rem] text-slate-600 font-medium">99.99% Uptime SLA • Instant Auto-Routing</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-full border border-emerald-300">
                                ⚡ T+0 Active
                            </span>
                        </div>
                    </div>

                    {/* PAYMENT MODES STRIP */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[0.68rem] font-extrabold text-slate-400 uppercase tracking-wider mr-2">Supports:</span>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
                            <QrCode className="w-3.5 h-3.5 text-[#008c46]" /> UPI 2.0
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
                            <CreditCard className="w-3.5 h-3.5 text-[#008c46]" /> Cards
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
                            <Fingerprint className="w-3.5 h-3.5 text-[#008c46]" /> AePS
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
                            <Receipt className="w-3.5 h-3.5 text-[#008c46]" /> BBPS
                        </div>
                    </div>
                </div>

                {/* FOOTER COPYRIGHT */}
                <div className="relative z-10 text-xs font-semibold text-slate-400 flex items-center justify-between">
                    <span>© {new Date().getFullYear()} Shahparpay Solutions Pvt. Ltd.</span>
                    <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#008c46]" /> RBI Authorized Payment Aggregator</span>
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
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[#008c46] transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Home</span>
                    </Link>
                </div>

                {/* Desktop Top Security Header */}
                <div className="hidden lg:flex items-center justify-between text-xs font-extrabold text-slate-500">
                    <div className="inline-flex items-center gap-1.5 text-[0.68rem] text-[#008c46] bg-[#f0fdf4] px-3 py-1 rounded-full border border-emerald-200">
                        <Building2 className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>Merchant Portal</span>
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
                            {isOtpStep ? 'Security Verification' : 'Sign in to Account'}
                        </h2>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            {isOtpStep
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

                    {/* STEP 1: CREDENTIALS FORM */}
                    {!isOtpStep ? (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Identifier Input */}
                            <div className="space-y-2">
                                <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                    User ID / Email / Phone
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#008c46] transition-colors">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder="Enter your User ID, Email, or Phone"
                                        className="w-full pl-12 pr-4 py-3.5 sm:py-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-sm sm:text-base font-semibold focus:border-[#008c46] focus:bg-white focus:ring-4 focus:ring-[#008c46]/10 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2">
                                <label className="text-[0.7rem] font-extrabold text-slate-700 uppercase tracking-wider block">
                                    Password
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#008c46] transition-colors">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full pl-12 pr-12 py-3.5 sm:py-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-sm sm:text-base font-semibold focus:border-[#008c46] focus:bg-white focus:ring-4 focus:ring-[#008c46]/10 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
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

                            {/* Remember Me Row */}
                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <div
                                        onClick={() => setRememberMe(!rememberMe)}
                                        className={`w-4 h-4 rounded-md border transition-all flex items-center justify-center ${
                                            rememberMe
                                                ? 'bg-[#008c46] border-[#008c46] text-white'
                                                : 'bg-slate-50 border-slate-300'
                                        }`}
                                    >
                                        {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span className="text-xs font-bold text-slate-600">Remember this device</span>
                                </label>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !identifier.trim() || !password}
                                className="w-full py-4 px-6 bg-[#18181b] hover:bg-black text-white font-extrabold text-base rounded-full shadow-lg shadow-slate-900/10 hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-3 cursor-pointer group mt-4"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Sign In to Dashboard</span>
                                        <div className="w-6.5 h-6.5 rounded-md bg-[#a3e635] text-slate-900 flex items-center justify-center font-black text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                                            ↗
                                        </div>
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
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#008c46] transition-colors">
                                        <KeyRound className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="••••••"
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 text-center tracking-[0.3em] font-mono text-xl font-bold focus:border-[#008c46] focus:bg-white focus:ring-4 focus:ring-[#008c46]/10 outline-none transition-all placeholder:text-slate-300"
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
                                        className="text-[#008c46] font-extrabold hover:underline disabled:text-slate-400 disabled:no-underline"
                                    >
                                        {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || otp.length < 6}
                                className="w-full py-4 px-6 bg-[#18181b] hover:bg-black text-white font-extrabold text-base rounded-full shadow-lg shadow-slate-900/10 hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Verify &amp; Enter Dashboard</span>
                                        <ShieldCheck className="w-5 h-5 text-[#a3e635]" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Trust Badges Bar */}
                    <div className="pt-4 grid grid-cols-2 gap-3 text-center">
                        <div className="bg-slate-50 px-3.5 py-3 rounded-2xl border border-slate-200/70 flex items-center justify-center gap-2 text-slate-600 font-bold text-xs">
                            <ShieldCheck className="w-4 h-4 text-[#008c46] shrink-0" />
                            <span>PCI-DSS Level 1</span>
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
                    <a href="#terms" className="hover:underline text-slate-500 font-bold">Terms of Service</a>
                    <span> &amp; </span>
                    <a href="#privacy" className="hover:underline text-slate-500 font-bold">Privacy Policy</a>
                </div>
            </div>
        </div>
    );
};

export default Login;
