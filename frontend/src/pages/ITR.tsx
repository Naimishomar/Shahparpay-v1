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
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                            <FileText className="text-primary" size={28} />
                            ITR Filing Services
                        </h1>
                        <p className="text-sm text-muted-foreground hidden md:block">
                            Seamlessly submit and manage Income Tax Returns for your clients.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Container */}
            <div className="flex flex-col glass-card rounded-2xl relative overflow-hidden group border border-border">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10 p-6 flex flex-col gap-6">
                    {/* Launch Portal Card */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-foreground">Launch ITR Filing Portal</h2>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                Partner Integration
                            </div>
                        </div>

                        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                            Click below to open the secure eSevaTech ITR module. All charges will be verified against your Main Wallet. Make sure you have sufficient balance before starting an application.
                        </p>

                        <div className="flex justify-end pt-4 border-t border-border/30">
                            <button
                                onClick={handleLaunchPortal}
                                disabled={loading}
                                className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
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

                    {/* Guidelines Card */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Guidelines & Rules
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex gap-3 text-sm text-muted-foreground">
                                <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <span>Wallet balance checks will run automatically during submission.</span>
                            </li>
                            <li className="flex gap-3 text-sm text-muted-foreground">
                                <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <span>Each single-use token generated is valid for 15 minutes.</span>
                            </li>
                            <li className="flex gap-3 text-sm text-muted-foreground">
                                <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <span>Ensure you validate information carefully before submitting the form.</span>
                            </li>
                            <li className="flex gap-3 text-sm text-muted-foreground">
                                <div className="p-1.5 rounded-full bg-amber-500/10 text-amber-500 shrink-0">
                                    <AlertCircle className="h-4 w-4" />
                                </div>
                                <span>Refunds for rejected requests will automatically credit your Main Wallet.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Security Info */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                        <div className="p-2 rounded-full bg-primary/20 text-primary mt-0.5">
                            <CheckCircle2 size={16} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-foreground text-sm">Secure Filing</h4>
                            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                                ITR filing through eSevaTech uses secure single-use tokens. Your Main Wallet is only charged upon successful submission. All transactions are logged in your Wallet Ledger for complete transparency.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ITR;