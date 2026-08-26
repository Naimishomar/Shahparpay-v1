import React, { useState } from 'react';
import { Fingerprint, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { captureBiometric } from '../utils/rdService';

interface DailyAuthModalProps {
    onClose: () => void;
    activePipes?: string[];
    latitude?: string;
    longitude?: string;
}

const DailyAuthModal: React.FC<DailyAuthModalProps> = ({ onClose, activePipes = [], latitude, longitude }) => {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const actualMerchantCode = user?.retailerId || user?.distributorId || user?.adminId || "";
    const actualAadhaar = user?.aadhaarNumber || "";
    const [loading, setLoading] = useState(false);
    const [merchantCode] = useState(actualMerchantCode);
    const [aadhaar] = useState(actualAadhaar);
    
    const handleCaptureAndAuth = async () => {
        if (!merchantCode || aadhaar.length !== 12) {
            toast.error('Please enter valid Merchant Code and 12-digit Aadhaar');
            return;
        }

        setLoading(true);
        try {
            // 1. Capture Fingerprint First (Without OTP WADH, typical capture)
            const { pidData: capturedData } = await captureBiometric();

            // 2. Submit to Daily Auth Endpoint
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/daily-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    merchantcode: merchantCode,
                    aadhaarNumber: aadhaar,
                    mobileNumber: "9999999999", // Could be dynamic from profile
                    pidData: capturedData,
                    latitude: latitude || "28.7041",
                    longitude: longitude || "77.1025"
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.data?.response_code === 1) {
                toast.error("Daily 2FA Authentication Successful! You can now perform transactions.");
                onClose();
            } else if (result.data?.response_code === 1 && result.data?.errorcode === 2) {
                toast.error("Authentication Already Completed for today.");
                onClose();
            } else {
                const errorMsg = result.data?.message || result.message;
                if (errorMsg.includes('Registration Successful')) {
                    toast.error(errorMsg);
                } else if (result.deviceMapped || errorMsg.includes('already mapped') || errorMsg.includes('mapped with other merchant')) {
                    toast.error("Your biometric scanner is already mapped to another merchant on this pipe. Contact your service provider to unbind the device, or use a different scanner.");
                } else if (result.needsWebOnboarding || errorMsg.includes('reset your status') || errorMsg.includes('pending')) {
                    const pipeToOnboard = result.pipe || 'bank2';
                    const dynamicIsNew = activePipes.includes(pipeToOnboard) ? "0" : "1";
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
                                isNew: dynamicIsNew,
                                pipe: pipeToOnboard,
                                callbackUrl: window.location.href
                            })
                        });
                        const onboardData = await onboardRes.json();
                        if (onboardData.success && onboardData.alreadyOnboarded) {
                            toast.success("Merchant already onboarded. Proceeding...");
                            setTimeout(() => { window.location.reload(); }, 1200);
                        } else if (onboardData.success && onboardData.url) {
                            setTimeout(() => { window.location.href = onboardData.url; }, 1500);
                        } else {
                            toast.error("Failed to get Onboarding URL: " + (onboardData.message || "Unknown error"));
                        }
                    } catch (e) {
                        toast.error("Error generating onboarding URL");
                    }
                } else {
                    toast.error("Daily Auth Failed: " + errorMsg);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Error during Daily Authentication.");
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
                    <button 
                        onClick={() => {
                            onClose();
                            navigate('/');
                        }} 
                        className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyAuthModal;
