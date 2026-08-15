import React, { useState, useEffect, useCallback } from 'react';
import { Fingerprint, Loader2, CheckCircle2, ShieldAlert, ExternalLink, RefreshCw, Globe, KeyRound, Lock, Cpu, Settings, type LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

// WADH keys for different RD Service providers per pipe
const WADH_KEYS: Record<string, Record<'mantra' | 'morpho', string>> = {
    bank2: {
        mantra: '18f4CEiXeXcfGXvgWA/blxD+w2pw7hfQPY45JMytkPw=',
        morpho: 'q/B7+M8fP5cU9HhG9JqK6w8R2tV4nX1zL3mN5pO7sT9=',
    },
    bank3: {
        mantra: 'E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=',
        morpho: 'q/B7+M8fP5cU9HhG9JqK6w8R2tV4nX1zL3mN5pO7sT9=',
    },
    bank4: {
        mantra: 'E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=',
        morpho: 'q/B7+M8fP5cU9HhG9JqK6w8R2tV4nX1zL3mN5pO7sT9=',
    },
    bank5: {
        mantra: 'E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=',
        morpho: 'q/B7+M8fP5cU9HhG9JqK6w8R2tV4nX1zL3mN5pO7sT9=',
    },
    bank6: {
        mantra: 'E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=',
        morpho: 'q/B7+M8fP5cU9HhG9JqK6w8R2tV4nX1zL3mN5pO7sT9=',
    },
};

interface PipeOnboardingPlan {
    pipe: string;
    label: string;
    wadh: string;
    status: 'ACCEPTED' | 'PENDING' | 'REJECTED' | 'NOT_ONBOARDED' | 'UNKNOWN';
    is_approved: string | null;
    message: string | null;
    steps: OnboardingStep[];
    canStart: boolean;
    canStartEkyc: boolean;
    actionHint: string | null;
    merchantCode: string;
    mobile: string;
}

interface OnboardingStep {
    id: string;
    title: string;
    done: boolean;
    locked?: boolean;
    required: boolean;
    v2?: boolean;
    method?: 'activate' | 'otp';
    fields?: string[];
    wadh?: string;
}

interface PipeOnboardingModalProps {
    pipe: string;
    onClose: () => void;
    onComplete: () => void;
}

type Phase = 'loading' | 'plan' | 'web' | 'ekyc' | 'done';

const NATURE_OF_BUSINESS_OPTIONS = [
    'Agriculture', 'Antique Dealer', 'Arms Dealer', 'Art Dealer', 'Banking',
    'Mobility', 'Barber', 'Parlour', 'Salon', 'Bullion Dealer and Jeweller',
    'Casino', 'Gaming Application', 'Educational Institute', 'Financial Institution',
    'Healthcare', 'Pharma', 'Import And Export Trader', 'Law', 'Accountancy firm',
    'Liquor', 'Manufacturing', 'Marketing including Multi-level Marketing', 'Media',
    'Pawn Shop', 'Money Lender', 'Money Changer', 'Real Estate',
    'Restaurant and Hospitality', 'Retail Shop', 'Service Provider', 'Small vendor',
    'Kirana shop', 'Stock Trading', 'Brokerage', 'Transport', 'Logistics',
    'Wholesale Trading', 'Others'
];

const PipeOnboardingModal: React.FC<PipeOnboardingModalProps> = ({ pipe, onClose, onComplete }) => {
    const { token, user } = useAuth();

    const [phase, setPhase] = useState<Phase>('loading');
    const [plan, setPlan] = useState<PipeOnboardingPlan | null>(null);
    const [loading, setLoading] = useState(false);

    // Web KYC
    const [openingWeb, setOpeningWeb] = useState(false);
    const [webBlocked, setWebBlocked] = useState<string | null>(null);

    // eKYC state
    const [dob, setDob] = useState(user?.dob || '');
    const [annualIncome, setAnnualIncome] = useState('');
    const [natureOfBusiness, setNatureOfBusiness] = useState('');
    const [otp, setOtp] = useState('');
    const [ekycId, setEkycId] = useState('');
    const [stateresp, setStateresp] = useState('');
    const [pidData, setPidData] = useState<string | null>(null);
    const [deviceType, setDeviceType] = useState<'mantra' | 'morpho'>('mantra');

    const getHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

    const fetchPlan = useCallback(async (showLoader = true) => {
        if (showLoader) setPhase('loading');
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/onboarding/plan?pipe=${pipe}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setPlan(data.data);
                setWebBlocked(null);
                setPhase('plan');
            } else {
                toast.error(data.message || 'Failed to load onboarding plan');
                setPhase('plan');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load onboarding plan');
            setPhase('plan');
        }
    }, [pipe, token]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchPlan();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startWebKyc = async () => {
        const merchantId = user?.retailerId || user?.distributorId;
        if (!merchantId) return toast.error('Merchant code not found');
        setOpeningWeb(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/paysprint/get-onboard-url`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ merchantId, isNew: false, pipe, callbackUrl: window.location.href })
            });
            const data = await res.json();
            if (data.success && data.alreadyOnboarded) {
                toast.success('Merchant is already onboarded on this pipe');
                await fetchPlan(false);
            } else if (data.success && data.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer');
                toast.success('PaySprint KYC page opened in a new tab. Complete it, then come back.');
            } else {
                // PaySprint blocks web onboarding when the merchant already exists on another pipe.
                setWebBlocked(data.message || 'PaySprint blocked this onboarding. Contact PaySprint support to enable this pipe for your merchant.');
                toast.error(data.message || 'Failed to start Web KYC');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to start Web KYC');
        } finally {
            setOpeningWeb(false);
        }
    };

    const captureFingerprint = async () => {
        const currentPipe = plan?.pipe || pipe;
        const wadh = WADH_KEYS[currentPipe]?.[deviceType] || plan?.wadh || "E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=";
        setLoading(true);
        try {
            const ports = [11100, 11101, 11102];
            let activeUrl = null;
            const captureXml = `<?xml version="1.0"?>
                <PidOptions ver="1.0">
                  <Opts fCount="1" fType="2" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" env="P" posh="UNKNOWN" wadh="${wadh}" />
                </PidOptions>`;

            for (const port of ports) {
                const url = `http://127.0.0.1:${port}`;
                try {
                    const res = await fetch(`${url}/rd/info`, { method: 'RDSERVICE', headers: { 'Accept': 'text/xml' }, signal: AbortSignal.timeout(500) });
                    if (res.ok) { activeUrl = url; break; }
                } catch (e) {
                    const err = e as Error;
                    console.log(`Port ${port} HTTP failed:`, err.message);
                    try {
                        const urlHttps = `https://127.0.0.1:${port}`;
                        const resHttps = await fetch(`${urlHttps}/rd/info`, { method: 'RDSERVICE', headers: { 'Accept': 'text/xml' }, signal: AbortSignal.timeout(500) });
                        if (resHttps.ok) { activeUrl = urlHttps; break; }
                    } catch (e2) { 
                        const err2 = e2 as Error;
                        console.log(`Port ${port} HTTPS failed:`, err2.message);
                        continue; 
                    }
                }
            }

            if (!activeUrl) {
                toast.error("RD Service not found on ports 11100-11102. Please ensure Mantra/Morpho RD Service is installed, running, and the device is connected.");
                return;
            }

            const captureResponse = await fetch(`${activeUrl}/rd/capture`, {
                method: 'CAPTURE',
                body: captureXml,
                headers: { 'Content-Type': 'text/xml', 'Accept': 'text/xml' }
            });
            const capturedData = await captureResponse.text();
            console.log('RD Capture Response:', capturedData);

            // Check for RD Service errors in the XML response
            const errCodeMatch = capturedData.match(/errCode="([^"]*)"/);
            const errInfoMatch = capturedData.match(/errInfo="([^"]*)"/);
            const errCode = errCodeMatch ? errCodeMatch[1] : null;
            const errInfo = errInfoMatch ? errInfoMatch[1] : null;

            if (errCode === '0' && capturedData.includes('PidData')) {
                setPidData(capturedData);
                toast.success("Fingerprint captured successfully!");
            } else {
                let errorMsg = "Biometric capture failed. Please clean the scanner and try again.";
                if (errCode && errInfo) {
                    errorMsg = `RD Service Error (${errCode}): ${errInfo}`;
                } else if (capturedData.includes('init')) {
                    errorMsg = "RD Service initialization error. Please restart the RD Service (Mantra/Morpho) and try again.";
                }
                toast.error(errorMsg);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error during biometric capture.");
        } finally {
            setLoading(false);
        }
    };

    const sendOtp = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/kyc/send-otp`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    merchantcode: plan?.merchantCode,
                    aadhaar: user?.aadhaarNumber,
                    pipe: 'bank3',
                    latitude: "28.7041",
                    longitude: "77.1025"
                })
            });
            const result = await res.json();
            if (result.success && result.data?.response_code === 1) {
                setEkycId(result.data.data?.otpreqid || result.data.data?.ekyc_id || '');
                setStateresp(result.data.data?.stateresp || 'unknown');
                toast.success("OTP sent to your registered Aadhaar mobile number.");
            } else if (result.data?.response_code === 2) {
                toast.error("KYC already completed on this pipe.");
            } else {
                toast.error("Failed to send OTP: " + (result.data?.message || result.message));
            }
        } catch (error) {
            console.error(error);
            toast.error("Server error while sending OTP.");
        } finally {
            setLoading(false);
        }
    };

    const runEkyc = async () => {
        const method = plan?.steps.find(s => s.id === 'ekyc')?.method;
        const requiredFields = plan?.steps.find(s => s.id === 'ekyc')?.fields || [];

        if (!pidData) return toast.error('Please capture your fingerprint first.');
        if (method === 'otp' && !otp) return toast.error('Please enter the OTP first.');
        if (requiredFields.includes('dob') && !dob) return toast.error('Please enter your Date of Birth.');
        if (requiredFields.includes('annual_income') && !annualIncome) return toast.error('Please enter your Annual Income.');
        if (requiredFields.includes('nature_of_bussiness') && !natureOfBusiness) return toast.error('Please select your Nature of Business.');

        setLoading(true);
        try {
            let endpoint: string;
            let body: Record<string, string>;
            if (method === 'otp') {
                endpoint = '/api/aeps/kyc/verify-otp';
                body = {
                    merchantcode: plan?.merchantCode || '',
                    aadhaar: user?.aadhaarNumber || '',
                    pipe: 'bank3',
                    latitude: "28.7041",
                    longitude: "77.1025",
                    otp,
                    stateresp,
                    ekyc_id: ekycId,
                    pidData
                };
            } else {
                endpoint = '/api/aeps/kyc/activate-merchant';
                body = {
                    merchantcode: plan?.merchantCode || '',
                    aadhaar: user?.aadhaarNumber || '',
                    dob: dob.replace(/-/g, '/'),
                    pipe,
                    latitude: "28.7041",
                    longitude: "77.1025",
                    pidData
                };
                if (requiredFields.includes('annual_income')) body.annual_income = annualIncome;
                if (requiredFields.includes('nature_of_bussiness')) body.nature_of_bussiness = natureOfBusiness;
            }

            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(body)
            });
            const result = await res.json();

            if (result.success && (result.data?.response_code == "1" || result.data?.response_code === 1)) {
                toast.success("eKYC Completed Successfully!");
                await fetchPlan(false);
                setPhase('done');
            } else {
                toast.error("eKYC Failed: " + (result.data?.message || result.message));
            }
        } catch (error) {
            console.error(error);
            toast.error("Server error while verifying eKYC.");
        } finally {
            setLoading(false);
        }
    };

    const currentEkycMethod = plan?.steps.find(s => s.id === 'ekyc')?.method || null;
    const currentEkycFields = plan?.steps.find(s => s.id === 'ekyc')?.fields || [];
    const needsWebKyc = plan?.status !== 'ACCEPTED';

    const StepBadge: React.FC<{ active: boolean; done: boolean; icon: LucideIcon }> = ({ active, done, icon: Icon }) => (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            done ? 'bg-emerald-500/20 text-emerald-500'
            : active ? 'bg-primary/20 text-primary'
            : 'bg-muted/50 text-muted-foreground'
        }`}>
            <Icon className="w-4 h-4" />
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-background w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden">
                <div className="p-5 border-b border-border bg-muted/30 flex items-center gap-3">
                    <ShieldAlert className="text-primary w-6 h-6" />
                    <div>
                        <h2 className="font-bold text-lg text-foreground">Onboard: {plan?.label || pipe}</h2>
                        <p className="text-xs text-muted-foreground">PaySprint pipe onboarding</p>
                    </div>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {phase === 'loading' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                            <Loader2 className="w-5 h-5 animate-spin" /> Loading onboarding plan...
                        </div>
                    )}

                    {phase === 'plan' && plan && (
                        <div className="flex flex-col gap-5">
                            {/* Status banner */}
                            <div className={`p-4 rounded-xl border text-sm ${
                                plan.status === 'ACCEPTED' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700' :
                                plan.status === 'REJECTED' ? 'border-rose-500/40 bg-rose-500/10 text-rose-700' :
                                plan.status === 'PENDING' ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700' :
                                'border-border bg-muted/20 text-muted-foreground'
                            }`}>
                                <div className="flex items-center gap-2 font-semibold">
                                    {plan.status === 'ACCEPTED' ? <CheckCircle2 className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                                    PaySprint status: {plan.is_approved || plan.status}
                                </div>
                                {plan.message && <p className="text-xs mt-1 opacity-80">{plan.message}</p>}
                            </div>

                            {plan.status === 'ACCEPTED' ? (
                                <div className="flex flex-col items-center gap-3 py-6 text-center">
                                    <CheckCircle2 className="w-14 h-14 text-emerald-500" />
                                    <p className="text-sm text-muted-foreground">This pipe is already active for your merchant.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Steps */}
                                    <div className="flex flex-col gap-3">
                                        {plan.steps.map((step, idx) => {
                                            const active = idx === 0 || (idx === 1 && plan.steps[0]?.done);
                                            const StepIcon = step.id === 'web' ? Globe : step.id === 'ekyc' ? Fingerprint : KeyRound;
                                            return (
                                                <div key={step.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                                                    step.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/10'
                                                }`}>
                                                    <StepBadge active={active && !step.done} done={step.done} icon={StepIcon} />
                                                    <div className="flex flex-col flex-1">
                                                        <span className="text-sm font-semibold">{step.title}</span>
                                                        {step.id === 'ekyc' && currentEkycMethod === 'otp' && (
                                                            <span className="text-xs text-muted-foreground">OTP + Biometric verification</span>
                                                        )}
                                                        {step.id === 'ekyc' && currentEkycMethod === 'activate' && (
                                                            <span className="text-xs text-muted-foreground">Biometric verification (Aadhaar + Fingerprint)</span>
                                                        )}
                                                        {step.done && <span className="text-xs text-emerald-600">Completed</span>}
                                                        {step.locked && !step.done && (
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Lock className="w-3 h-3" /> Unlocks after Web KYC is complete
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {plan.actionHint && (
                                        <p className="text-xs text-muted-foreground bg-muted/20 border border-border rounded-lg p-3">
                                            {plan.actionHint}
                                        </p>
                                    )}

                                    {/* Web KYC action */}
                                    {needsWebKyc && !plan.steps[0]?.done && (
                                        <div className="flex flex-col gap-2">
                                            {webBlocked && (
                                                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                                                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                                                    <span>{webBlocked}</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={startWebKyc}
                                                disabled={openingWeb}
                                                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold shadow-md flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                {openingWeb ? <Loader2 className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
                                                Open PaySprint Web KYC
                                            </button>
                                            <button
                                                onClick={() => fetchPlan(false)}
                                                disabled={loading}
                                                className="w-full py-2.5 border border-border rounded-lg font-medium text-sm text-muted-foreground hover:text-foreground flex justify-center items-center gap-2 transition-colors"
                                            >
                                                <RefreshCw className="w-4 h-4" /> I've completed it — check status
                                            </button>
                                        </div>
                                    )}

                                    {/* eKYC action — only when web KYC is complete on this pipe */}
                                    {plan.canStartEkyc && currentEkycMethod && (
                                        <div className="flex flex-col gap-4 border border-border rounded-xl p-4 bg-muted/10">
                                            <div className="flex items-center gap-2 font-semibold text-sm">
                                                <Fingerprint className="w-4 h-4 text-primary" />
                                                {currentEkycMethod === 'otp' ? 'eKYC — OTP + Biometric' : 'eKYC — Biometric'}
                                            </div>

                                            {currentEkycFields.includes('dob') && (
                                                <div>
                                                    <label className="text-sm font-medium mb-1 block">Date of Birth</label>
                                                    <input
                                                        type="date"
                                                        value={dob}
                                                        onChange={(e) => setDob(e.target.value)}
                                                        className="w-full p-2.5 rounded-lg border border-border bg-background"
                                                    />
                                                </div>
                                            )}
                                            {currentEkycFields.includes('annual_income') && (
                                                <div>
                                                    <label className="text-sm font-medium mb-1 block">Annual Income</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="0.01"
                                                        value={annualIncome}
                                                        onChange={(e) => setAnnualIncome(e.target.value)}
                                                        placeholder="e.g. 500000"
                                                        className="w-full p-2.5 rounded-lg border border-border bg-background"
                                                    />
                                                </div>
                                            )}
                                            {currentEkycFields.includes('nature_of_bussiness') && (
                                                <div>
                                                    <label className="text-sm font-medium mb-1 block">Nature of Business</label>
                                                    <select
                                                        value={natureOfBusiness}
                                                        onChange={(e) => setNatureOfBusiness(e.target.value)}
                                                        className="w-full p-2.5 rounded-lg border border-border bg-background"
                                                        style={{ colorScheme: 'dark' }}
                                                    >
                                                        <option value="">Select Nature of Business</option>
                                                        {NATURE_OF_BUSINESS_OPTIONS.map((opt, i) => (
                                                            <option key={i} value={opt} className="bg-background">{opt}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {currentEkycMethod === 'otp' && (
                                                <>
                                                    <button
                                                        onClick={sendOtp}
                                                        disabled={loading}
                                                        className="w-full py-2.5 border border-primary/40 text-primary rounded-lg font-medium text-sm hover:bg-primary/10 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                                                    >
                                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                        Send OTP
                                                    </button>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1 block">Enter OTP</label>
                                                        <input
                                                            type="text"
                                                            value={otp}
                                                            onChange={(e) => setOtp(e.target.value)}
                                                            maxLength={6}
                                                            className="w-full p-2.5 rounded-lg border border-border text-center tracking-[0.5em] font-bold text-xl bg-background"
                                                            placeholder="------"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            <div className="mb-4">
                                                    <label className="text-sm font-medium mb-1 block">Biometric Device</label>
                                                    <select 
                                                        value={deviceType}
                                                        onChange={(e) => setDeviceType(e.target.value as 'mantra' | 'morpho')}
                                                        className="w-full p-2.5 rounded-lg border border-border bg-background"
                                                    >
                                                        <option value="mantra">Mantra (MFS100 / MFS110)</option>
                                                        <option value="morpho">Morpho (IDEMIA E2 / E3 / MSO)</option>
                                                    </select>
                                                    <p className="text-xs text-muted-foreground mt-1">Select your fingerprint scanner brand. Mantra and Morpho use different WADH keys.</p>
                                                </div>

                                            <div className="border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-background/50">
                                                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${pidData ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                                                    <Fingerprint className="w-8 h-8" />
                                                </div>
                                                <button
                                                    onClick={captureFingerprint}
                                                    disabled={loading}
                                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${pidData ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                                                >
                                                    {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : pidData ? 'Fingerprint Captured' : 'Capture Biometric'}
                                                </button>
                                            </div>

                                            <button
                                                onClick={runEkyc}
                                                disabled={loading || !pidData}
                                                className="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-lg font-semibold shadow-md flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                                Verify eKYC
                                            </button>
                                        </div>
                                    )}

                                    {plan.steps[0]?.done && !currentEkycMethod && (
                                        <div className="text-xs text-muted-foreground bg-muted/20 border border-border rounded-lg p-3">
                                            No additional eKYC is required for this pipe — wait for the bank to approve after web KYC.
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
                            <p className="text-lg font-bold">Onboarding Complete</p>
                            <p className="text-sm text-muted-foreground">{plan?.label} is now active for your merchant.</p>
                            <button
                                onClick={() => { onComplete(); onClose(); }}
                                className="mt-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold shadow-md"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>

                <div className="border-t border-border p-4 bg-muted/20 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PipeOnboardingModal;
