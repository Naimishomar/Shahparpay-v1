import React, { useState } from 'react';
import { ShieldAlert, Fingerprint, Loader2, CheckCircle2 } from 'lucide-react';

interface MerchantKycModalProps {
    onClose: () => void;
    latitude?: string;
    longitude?: string;
}

const MerchantKycModal: React.FC<MerchantKycModalProps> = ({ onClose, latitude, longitude }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [merchantCode, setMerchantCode] = useState('');
    const [aadhaar, setAadhaar] = useState('');
    const [otp, setOtp] = useState('');
    
    // API State
    const [ekycId, setEkycId] = useState('');
    const [stateresp, setStateresp] = useState('');
    
    // Biometric State
    const [pidData, setPidData] = useState<string | null>(null);

    const handleSendOtp = async () => {
        if (!merchantCode || aadhaar.length !== 12) {
            alert('Please enter valid Merchant Code and 12-digit Aadhaar');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/kyc/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchantcode: merchantCode,
                    aadhaar: aadhaar,
                    latitude: latitude || "28.7041",
                    longitude: longitude || "77.1025"
                })
            });
            const result = await response.json();
            if (result.success && result.data?.response_code === 1) {
                setEkycId(result.data.data.otpreqid || result.data.data.ekyc_id);
                setStateresp(result.data.data.stateresp || 'unknown');
                setStep(2);
                alert("OTP sent successfully to your registered Aadhaar mobile number.");
            } else if (result.data?.response_code === 2) {
                alert("KYC already completed! You can proceed with transactions.");
                onClose();
            } else {
                alert("Failed to send OTP: " + (result.data?.message || result.message));
            }
        } catch (error) {
            console.error(error);
            alert('Server error while sending OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleCaptureFingerprint = async () => {
        setLoading(true);
        try {
            const ports = [11100, 11101, 11102];
            let activeUrl = null;
            const wadh = "E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc="; // Provided WADH for eKYC
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
                    try {
                        const urlHttps = `https://127.0.0.1:${port}`;
                        const resHttps = await fetch(`${urlHttps}/rd/info`, { method: 'RDSERVICE', headers: { 'Accept': 'text/xml' }, signal: AbortSignal.timeout(500) });
                        if (resHttps.ok) { activeUrl = urlHttps; break; }
                    } catch (e2) { continue; }
                }
            }

            if (!activeUrl) {
                alert("RD Service not found. Please ensure Mantra/Morpho is connected and running.");
                setLoading(false);
                return;
            }

            const captureResponse = await fetch(`${activeUrl}/rd/capture`, {
                method: 'CAPTURE',
                body: captureXml,
                headers: { 'Content-Type': 'text/xml', 'Accept': 'text/xml' }
            });
            const capturedData = await captureResponse.text();

            if (capturedData.includes('errCode="0"')) {
                setPidData(capturedData);
                alert("Fingerprint captured successfully!");
            } else {
                alert("Biometric capture failed. Please clean the scanner and try again.");
            }
        } catch (error) {
            console.error(error);
            alert("Error during biometric capture.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || !pidData) {
            alert("Please enter OTP and capture your fingerprint first.");
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/kyc/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchantcode: merchantCode,
                    aadhaar: aadhaar,
                    latitude: latitude || "28.7041",
                    longitude: longitude || "77.1025",
                    otp: otp,
                    stateresp: stateresp,
                    ekyc_id: ekycId,
                    pidData: pidData
                })
            });
            const result = await response.json();
            if (result.success && result.data?.response_code === 1) {
                alert("Merchant eKYC Completed Successfully! You can now perform transactions.");
                onClose();
            } else {
                alert("KYC Verification Failed: " + (result.data?.message || result.message));
            }
        } catch (error) {
            console.error(error);
            alert('Server error while verifying OTP');
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
                                <label className="text-sm font-medium mb-1 block">Merchant Code</label>
                                <input 
                                    type="text" 
                                    value={merchantCode} 
                                    onChange={(e) => setMerchantCode(e.target.value)} 
                                    className="w-full p-2.5 rounded-lg border border-border bg-background"
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
                                    className="w-full p-2.5 rounded-lg border border-border bg-background"
                                    placeholder="Enter 12-digit Aadhaar"
                                />
                            </div>
                            <button 
                                onClick={handleSendOtp}
                                disabled={loading}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold shadow-md flex justify-center mt-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
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

                            <div className="border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-muted/20">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${pidData ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                                    <Fingerprint className="w-8 h-8" />
                                </div>
                                <button 
                                    onClick={handleCaptureFingerprint}
                                    disabled={loading}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${pidData ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                                >
                                    {loading && !otp ? 'Scanning...' : (pidData ? 'Fingerprint Captured' : 'Capture Biometric')}
                                </button>
                                {!pidData && <p className="text-xs text-muted-foreground text-center">Place finger on scanner and click capture</p>}
                            </div>

                            <button 
                                onClick={handleVerifyOtp}
                                disabled={loading || !pidData || !otp}
                                className="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-lg font-semibold shadow-md flex justify-center mt-2 disabled:opacity-50 transition-colors"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify eKYC'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="border-t border-border p-4 bg-muted/20 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MerchantKycModal;
