import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import logo from '../assets/logo.png'; // Assuming this exists based on dir check

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [isOtpStep, setIsOtpStep] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);

    React.useEffect(() => {
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
                setCountdown(60); // Start 60-second timer
            } else {
                setError(data.message || 'Invalid credentials. Please try again.');
                setIsLoading(false);
            }
        } catch (err) {
            setError('System error occurred. Please check your connection.');
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
                    else navigate('/'); 
                }, 500);
            } else {
                setError(data.message || 'Invalid OTP.');
                setIsLoading(false);
            }
        } catch (err) {
            setError('System error occurred. Please check your connection.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-background text-foreground overflow-hidden">
            {/* Left Side: Dynamic Branding Panel */}
            <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-gradient-to-br from-black to-zinc-900 border-r border-border">
                {/* Abstract Background Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-white/5 rounded-full blur-[100px] mix-blend-screen pointer-events-none"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>
                
                <div className="relative z-10 flex items-center gap-3">
                    <img src={logo} alt="Shahparpay Logo" className="h-16 w-auto invert" onError={(e) => e.currentTarget.style.display = 'none'} />
                </div>

                <div className="relative z-10 mb-20 animate-in slide-in-from-left-8 duration-700 fade-in">
                    <h1 className="text-5xl font-bold mb-6 leading-tight tracking-tighter">
                        Next-Gen <br/>
                        <span className="text-muted-foreground">Financial Network.</span>
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-md">
                        The ultimate unified platform for AePS, DMT, and Recharge services. Secure, fast, and reliable.
                    </p>
                    
                    <div className="mt-10 flex gap-4">
                        <div className="px-4 py-2 rounded-full border border-border bg-white/5 backdrop-blur flex items-center gap-2 text-sm font-medium">
                            <ShieldCheck size={16} className="text-primary"/> 256-bit Encryption
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} Shahparpay Networks. All rights reserved.
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
                
                {/* Mobile Logo Fallback */}
                <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2">
                    <img src={logo} alt="Shahparpay Logo" className="h-8 w-auto invert" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="text-xl font-bold tracking-tight">Shahparpay</span>
                </div>

                <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-500 fade-in">
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
                        <p className="text-muted-foreground">Enter your credentials to access your dashboard.</p>
                    </div>
                    
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-medium animate-in shake duration-300">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-sm font-medium">
                            {message}
                        </div>
                    )}
                    
                    {!isOtpStep ? (
                        <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in zoom-in duration-300">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground ml-1">Identifier</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder="User ID, Email, or Phone"
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-sm font-semibold text-muted-foreground">Password</label>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !identifier || !password}
                                className="w-full mt-2 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2 group"
                            >
                                {isLoading ? (
                                    <div className="w-6 h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>Secure Login <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-5 animate-in fade-in zoom-in duration-300">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground ml-1">6-Digit Verification Code</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="Enter OTP from email"
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50 text-center tracking-widest text-xl font-mono"
                                        required
                                        maxLength={6}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="flex justify-end mt-1">
                                    <button
                                        type="button"
                                        onClick={() => handleSubmit()}
                                        disabled={countdown > 0 || isLoading}
                                        className="text-sm text-primary font-medium hover:underline disabled:text-muted-foreground disabled:no-underline"
                                    >
                                        {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || otp.length < 6}
                                className="w-full mt-2 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-6 h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>Verify OTP <ShieldCheck size={18} /></>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
