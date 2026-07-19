import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const KycStatus = () => {
    const navigate = useNavigate();
    const { checkSession } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        const verifyStatus = async () => {
            try {
                // Get the JWT token from PaySprint from the URL
                const params = new URLSearchParams(window.location.search);
                const jwtData = params.get('data');
                
                if (jwtData) {
                    const tokenLocal = localStorage.getItem('token');
                    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/paysprint/update-kyc-status`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${tokenLocal}`
                        },
                        body: JSON.stringify({ jwt: jwtData })
                    });
                    
                    const resData = await res.json();
                    if (!resData.success) throw new Error("Backend verification failed");
                }

                // Refresh the user session to pull the latest isMerchantKycComplete from the DB
                await checkSession();
                
                setStatus('success');
                localStorage.setItem('webKycCompleted', Date.now().toString());
                
                // Redirect back to dashboard after a short delay if it's the same window, but since it's a new tab, we just tell them to close it
                // setTimeout(() => {
                //     window.location.href = '/';
                // }, 3000);
            } catch (error) {
                setStatus('error');
            }
        };

        verifyStatus();
    }, []);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="bg-card border border-border shadow-2xl rounded-3xl p-8 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                
                {status === 'loading' && (
                    <>
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
                            <Loader2 size={40} className="animate-spin" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Verifying KYC...</h2>
                            <p className="text-muted-foreground text-sm">
                                Please wait while we confirm your KYC status with PaySprint.
                            </p>
                        </div>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500">
                            <CheckCircle2 size={40} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Web KYC Captured!</h2>
                            <p className="text-muted-foreground text-sm">
                                Your web identity verification was processed successfully. 
                                <br/><br/>
                                <strong>You can now safely close this tab, return to your dashboard, and click on "Step 2: Biometric Activation".</strong>
                            </p>
                        </div>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                            <XCircle size={40} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Verification Error</h2>
                            <p className="text-muted-foreground text-sm mb-4">
                                There was an issue verifying your status. You may need to try again.
                            </p>
                            <button 
                                onClick={() => navigate('/')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};

export default KycStatus;
