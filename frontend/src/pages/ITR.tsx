import React, { useState } from 'react';
import { FileText, Loader2, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ITR: React.FC = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleLaunchPortal = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/itr/launch`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (res.data.success && res.data.redirect_url) {
                toast.success("ITR portal link generated successfully! Redirecting...");
                // Open in new tab
                window.open(res.data.redirect_url, '_blank');
            } else {
                toast.error(res.data.message || "Failed to launch ITR portal.");
            }
        } catch (error) {
            console.error("ITR Launch Error:", error);
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(
                err.response?.data?.message || 
                "An error occurred while generating the ITR portal URL."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                    <FileText className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        ITR Filing Services
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Seamlessly submit and manage Income Tax Returns for your clients.
                    </p>
                </div>
            </div>

            {/* Main Section Grid */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Launch Card */}
                <div className="md:col-span-2 glass-card p-8 rounded-3xl relative overflow-hidden flex flex-col justify-between min-h-[320px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-30 pointer-events-none"></div>
                    
                    <div className="relative z-10 space-y-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Partner Integration
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Launch ITR Filing Portal
                        </h2>
                        <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
                            Click below to open the secure eSevaTech ITR module. All charges will be verified against your Main Wallet. Make sure you have sufficient balance before starting an application.
                        </p>
                    </div>

                    <div className="relative z-10 pt-6">
                        <button
                            onClick={handleLaunchPortal}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-3.5 px-8 rounded-2xl shadow-lg transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                                    <span>Generating secure link...</span>
                                </>
                            ) : (
                                <>
                                    <span>Open Filing Module</span>
                                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Instructions Card */}
                <div className="glass-card p-6 rounded-3xl flex flex-col justify-between border-indigo-500/10 bg-indigo-500/[0.02]">
                    <h3 className="font-bold text-lg text-foreground mb-4">Guidelines & Rules</h3>
                    <ul className="space-y-4 flex-1">
                        <li className="flex gap-3 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span>Wallet balance checks will run automatically during submission.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span>Each single-use token generated is valid for 15 minutes.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span>Ensure you validate information carefully before submitting the form.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-muted-foreground">
                            <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span>Refunds for rejected requests will automatically credit your Main Wallet.</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ITR;
