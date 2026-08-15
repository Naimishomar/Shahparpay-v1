import React, { useState } from 'react';
import { Fingerprint, Loader2, CheckCircle2, ShieldAlert, Cpu, Settings } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface MerchantKycModalProps {
    onClose: () => void;
    latitude?: string;
    longitude?: string;
}

// WADH keys for different RD Service providers per pipe
const WADH_KEYS: Record<string, Record<'mantra' | 'morpho', string>> = {
    bank2: {
        mantra: '18f4CEiXeXcfGXvgWA/blxD+w2pw7hfQPY45JMytkPw=',
        morpho: 'q/B7+M8fP5cU9HhG9JqK6w8R2tV4nX1zL3mN5pO7sT9=', // Morpho/IDEMIA WADH for Bank 2
    },
    bank3: {
        mantra: 'E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=',
        morpho: 'q/B7+M8fP5cU9HhG9JqK6w8R2tV4nX1zL3mN5pO7sT9=', // Morpho/IDEMIA WADH for Bank 3/5/6
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

const MerchantKycModal: React.FC<MerchantKycModalProps> = ({ onClose, latitude, longitude }) => {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [kycMethod, setKycMethod] = useState<'bank3' | 'bank2'>('bank2');
    const [merchantCode, setMerchantCode] = useState(user?.retailerId || user?.distributorId || '');
    const [aadhaar, setAadhaar] = useState(user?.aadhaarNumber || '');
    const [dob, setDob] = useState(user?.dob || '');
    const [otp, setOtp] = useState('');
    const [deviceType, setDeviceType] = useState<'mantra' | 'morpho'>('mantra');
    
    // API State
    const [ekycId, setEkycId] = useState('');
    const [stateresp, setStateresp] = useState('');
    
    // Biometric State
    const [pidData, setPidData] = useState<string | null>(null);

    const handleNextStep = async () => {
        if (!merchantCode || aadhaar.length !== 12) {
            toast.error('Please enter valid Merchant Code and 12-digit Aadhaar');
            return;
        }
        if (kycMethod === 'bank2' && !dob) {
            toast.error('Please enter your Date of Birth for Bank 2 activation');
            return;
        }

        if (kycMethod === 'bank3') {
            setLoading(true);
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/kyc/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchantcode: merchantCode,
                        aadhaar: aadhaar,
                        pipe: kycMethod,
                        latitude: latitude || "28.7041",
                        longitude: longitude || "77.1025"
                    })
                });
                const result = await response.json();
                if (result.success && result.data?.response_code === 1) {
                    setEkycId(result.data.data.otpreqid || result.data.data.ekyc_id);
                    setStateresp(result.data.data.stateresp || 'unknown');
                    setStep(2);
                    toast.error("OTP sent successfully to your registered Aadhaar mobile number.");
                } else if (result.data?.response_code === 2) {
                    toast.error("KYC already completed! You can proceed with transactions.");
                    onClose();
                } else {
                    toast.error("Failed to send OTP: " + (result.data?.message || result.message));
                }
            } catch (error) {
                console.error(error);
                toast.error('Server error while sending OTP');
            } finally {
                setLoading(false);
            }
        } else {
            // For bank 2, no OTP needed, just go to step 2 for fingerprint capture
            setStep(2);
        }
    };

    const handleCaptureFingerprint = async () => {
        setLoading(true);
        try {
            const ports = [11100, 11101, 11102];
            let activeUrl = null;
            const wadh = WADH_KEYS[kycMethod]?.[deviceType] || WADH_KEYS.bank2.mantra;
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
                setLoading(false);
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

    const handleVerifyKyc = async () => {
        if (kycMethod === 'bank3' && (!otp || !pidData)) {
            toast.error("Please enter OTP and capture your fingerprint first.");
            return;
        }
        if (kycMethod === 'bank2' && !pidData) {
            toast.error("Please capture your fingerprint first.");
            return;
        }

        setLoading(true);
        try {
            let response, result;

            if (kycMethod === 'bank3') {
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/kyc/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchantcode: merchantCode,
                        aadhaar: aadhaar,
                        pipe: kycMethod,
                        latitude: latitude || "28.7041",
                        longitude: longitude || "77.1025",
                        otp: otp,
                        stateresp: stateresp,
                        ekyc_id: ekycId,
                        pidData: pidData
                    })
                });
            } else {
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/kyc/activate-merchant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchantcode: merchantCode,
                        aadhaar: aadhaar,
                        dob: dob.replace(/-/g, '/'), // Convert YYYY-MM-DD to YYYY/MM/DD
                        pipe: 'bank2',
                        latitude: latitude || "28.7041",
                        longitude: longitude || "77.1025",
                        pidData: pidData
                    })
                });
            }

            result = await response.json();
            
            if (result.success && result.data?.response_code == "1") {
                toast.error("Merchant eKYC Completed Successfully! You can now perform transactions.");
                onClose();
            } else {
                toast.error("KYC Verification Failed: " + (result.data?.message || result.message));
            }
        } catch (error) {
            console.error(error);
            toast.error('Server error while verifying KYC');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-background w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
                <div className="p-5 border-b border-border bg-muted/30 flex items-center gap-3">
                    <ShieldAlert className="text-primary w-6 h-6" />
                    <div>
                        <h2 className="font-bold text-lg text-foreground">Merchant eKYC</h2>
                        <p className="text-xs text-muted-foreground">Mandatory identity verification</p>
                    </div>
                </div>

                <div className="p-6">
                    {step === 1 ? (
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">KYC Pipeline</label>
                                <select 
                                    value={kycMethod}
                                    onChange={(e) => setKycMethod(e.target.value as 'bank3' | 'bank2')}
                                    className="w-full p-2.5 rounded-lg border border-border bg-background"
                                >
                                    <option value="bank2">Bank 2 / 5 / 6 (Direct Biometric)</option>
                                    <option value="bank3">Bank 3 (OTP + Biometric)</option>
                                </select>
                            </div>
                            <div>
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
                            <div>
                                <label className="text-sm font-medium mb-1 block">Merchant Code</label>
                                <input 
                                    type="text" 
                                    value={merchantCode} 
                                    onChange={(e) => setMerchantCode(e.target.value)} 
                                    disabled={true}
                                    className="w-full p-2.5 rounded-lg border border-border bg-muted text-muted-foreground cursor-not-allowed"
                                    placeholder="e.g. PS00123"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Aadhaar Number</label>
                                <input 
                                    type="text" 
                                    value={aadhaar} 
                                    onChange={(e) => setAadhaar(e.target.value)} 
                                    maxLength={12}
                                    disabled={true}
                                    className="w-full p-2.5 rounded-lg border border-border bg-muted text-muted-foreground cursor-not-allowed tracking-widest"
                                    placeholder="Enter 12-digit Aadhaar"
                                />
                            </div>
                            
                            {kycMethod === 'bank2' && (
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

                            <button 
                                onClick={handleNextStep}
                                disabled={loading}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold shadow-md flex justify-center mt-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (kycMethod === 'bank3' ? 'Send OTP' : 'Next Step')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {kycMethod === 'bank3' && (
                                <>
                                    <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm flex gap-2 items-start border border-emerald-100">
                                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                                        <p>OTP has been sent to the mobile number linked with your Aadhaar.</p>
                                    </div>
                                    
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Enter Aadhaar OTP</label>
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

                            <div className="border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-muted/20">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${pidData ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                                    <Fingerprint className="w-8 h-8" />
                                </div>
                                <button 
                                    onClick={handleCaptureFingerprint}
                                    disabled={loading}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${pidData ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                                >
                                    {loading && (!otp && kycMethod === 'bank3') ? 'Scanning...' : (pidData ? 'Fingerprint Captured' : 'Capture Biometric')}
                                </button>
                                {!pidData && <p className="text-xs text-muted-foreground text-center">Place finger on scanner and click capture</p>}
                            </div>

                            <button 
                                onClick={handleVerifyKyc}
                                disabled={loading || !pidData || (kycMethod === 'bank3' && !otp)}
                                className="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-lg font-semibold shadow-md flex justify-center mt-2 disabled:opacity-50 transition-colors"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify eKYC'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MerchantKycModal;
