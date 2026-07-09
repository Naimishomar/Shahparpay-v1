import React, { useState } from 'react';
import { Fingerprint, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface DailyAuthModalProps {
    onClose: () => void;
}

const DailyAuthModal: React.FC<DailyAuthModalProps> = ({ onClose }) => {
    const { user } = useAuth();
    const actualMerchantCode = user?.retailerId || user?.distributorId || user?.adminId || "";
    const actualAadhaar = user?.aadhaarNumber || "";
    const [loading, setLoading] = useState(false);
    const [merchantCode] = useState(actualMerchantCode);
    const [aadhaar] = useState(actualAadhaar);
    
    const handleCaptureAndAuth = async () => {
        if (!merchantCode || aadhaar.length !== 12) {
            alert('Please enter valid Merchant Code and 12-digit Aadhaar');
            return;
        }

        setLoading(true);
        try {
            // 1. Capture Fingerprint First (Without OTP WADH, typical capture)
            const ports = [11100, 11101, 11102];
            let activeUrl = null;
            
            const captureXml = `<?xml version="1.0"?>
                <PidOptions ver="1.0">
                  <Opts fCount="1" fType="2" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" env="P" posh="UNKNOWN" />
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
                alert("RD Service not found. Please ensure your Biometric scanner is connected and running.");
                setLoading(false);
                return;
            }

            const captureResponse = await fetch(`${activeUrl}/rd/capture`, {
                method: 'CAPTURE',
                body: captureXml,
                headers: { 'Content-Type': 'text/xml', 'Accept': 'text/xml' }
            });
            const capturedData = await captureResponse.text();

            if (!capturedData.includes('errCode="0"')) {
                alert("Biometric capture failed. Please clean the scanner and try again.");
                setLoading(false);
                return;
            }

            // 2. Submit to Daily Auth Endpoint
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/daily-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchantcode: merchantCode,
                    aadhaarNumber: aadhaar,
                    mobileNumber: "9999999999", // Could be dynamic from profile
                    pidData: capturedData,
                    latitude: "28.7041",
                    longitude: "77.1025"
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.data?.response_code === 1) {
                alert("Daily 2FA Authentication Successful! You can now perform transactions.");
                onClose();
            } else if (result.data?.response_code === 1 && result.data?.errorcode === 2) {
                alert("Authentication Already Completed for today.");
                onClose();
            } else {
                const errorMsg = result.data?.message || result.message;
                if (errorMsg.includes('Registration Successful')) {
                    alert(errorMsg);
                } else if (result.needsWebOnboarding || errorMsg.includes('reset your status') || errorMsg.includes('pending')) {
                    const pipeToOnboard = result.pipe || 'bank3';
                    toast.error(`KYC pending for ${pipeToOnboard}. Redirecting to KYC completion...`);
                    
                    try {
                        const onboardRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/paysprint/get-onboard-url`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({
                                merchantId: user?.id || user?._id || merchantCode,
                                isNew: "0",
                                pipe: pipeToOnboard,
                                callbackUrl: window.location.href
                            })
                        });
                        const onboardData = await onboardRes.json();
                        if (onboardData.success && onboardData.url) {
                            setTimeout(() => { window.location.href = onboardData.url; }, 1500);
                        } else if (onboardData.success && onboardData.alreadyOnboarded) {
                            toast.success("Merchant already onboarded. Please try again.");
                            setTimeout(() => { window.location.reload(); }, 1500);
                        } else {
                            alert("Failed to get Onboarding URL: " + (onboardData.message || "Unknown error"));
                        }
                    } catch (e) {
                        alert("Error generating onboarding URL");
                    }
                } else {
                    alert("Daily Auth Failed: " + errorMsg);
                }
            }
        } catch (error) {
            console.error(error);
            alert("Error during Daily Authentication.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-background w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden">
                <div className="p-5 border-b border-border bg-muted/30 flex items-center gap-3">
                    <KeyRound className="text-primary w-6 h-6" />
                    <div>
                        <h2 className="font-bold text-lg text-foreground">Daily 2FA Login</h2>
                        <p className="text-xs text-muted-foreground">Required once every 24 hours</p>
                    </div>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Merchant Code</label>
                        <input 
                            type="text" 
                            value={merchantCode} 
                            readOnly
                            className="w-full p-2.5 rounded-lg border border-border bg-muted cursor-not-allowed opacity-80"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Aadhaar Number</label>
                        <input 
                            type="text" 
                            value={aadhaar} 
                            readOnly
                            className="w-full p-2.5 rounded-lg border border-border bg-muted cursor-not-allowed opacity-80"
                        />
                    </div>

                    <div className="border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-muted/20 mt-2">
                        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                            <Fingerprint className="w-8 h-8" />
                        </div>
                        <button 
                            onClick={handleCaptureAndAuth}
                            disabled={loading}
                            className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-semibold shadow-md flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Scan Finger & Authenticate'}
                        </button>
                        <p className="text-xs text-muted-foreground text-center">Your biometric data is encrypted securely</p>
                    </div>
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

export default DailyAuthModal;
