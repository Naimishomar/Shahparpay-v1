import { useState, useEffect, useCallback } from 'react';
import { ScanFace, Loader2, RefreshCw, CheckCircle2, XCircle, Hourglass, Ban, AlertTriangle, ShieldCheck, Info, Rocket, type LucideIcon } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import PipeOnboardingModal from '../components/PipeOnboardingModal';

type PipeStatus = 'ACCEPTED' | 'PENDING' | 'REJECTED' | 'NOT_ONBOARDED' | 'ERROR' | 'UNKNOWN';

interface PipeResult {
    pipe: string;
    label: string;
    status: PipeStatus;
    is_approved: string | null;
    onboarded: boolean;
    message: string | null;
}

interface PipesData {
    merchantCode: string;
    mobile: string;
    pipes: PipeResult[];
    activePipes: string[];
    lastCheckedAt: string;
}

const STATUS_CONFIG: Record<PipeStatus, { label: string; icon: LucideIcon; badge: string; text: string }> = {
    ACCEPTED: {
        label: 'Active',
        icon: CheckCircle2,
        badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
        text: 'text-emerald-500'
    },
    PENDING: {
        label: 'Pending Verification',
        icon: Hourglass,
        badge: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
        text: 'text-yellow-500'
    },
    REJECTED: {
        label: 'Rejected',
        icon: XCircle,
        badge: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
        text: 'text-rose-500'
    },
    NOT_ONBOARDED: {
        label: 'Not Onboarded',
        icon: Ban,
        badge: 'bg-muted-foreground/10 text-muted-foreground border border-border',
        text: 'text-muted-foreground'
    },
    ERROR: {
        label: 'Check Failed',
        icon: AlertTriangle,
        badge: 'bg-orange-500/10 text-orange-500 border border-orange-500/20',
        text: 'text-orange-500'
    },
    UNKNOWN: {
        label: 'Unknown',
        icon: AlertTriangle,
        badge: 'bg-muted-foreground/10 text-muted-foreground border border-border',
        text: 'text-muted-foreground'
    }
};

const PipeStatusPage = () => {
    const { token, user } = useAuth();

    const [data, setData] = useState<PipesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [onboardingPipe, setOnboardingPipe] = useState<string | null>(null);

    const fetchPipes = useCallback(async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/pipes/verify`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data?.success) {
                setData(res.data.data);
            } else {
                toast.error(res.data?.message || 'Failed to fetch pipe status');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to fetch pipe status');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchPipes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleVerify = async () => {
        setVerifying(true);
        try {
            await fetchPipes(false);
            toast.success('All bank pipes verified against PaySprint');
        } finally {
            setVerifying(false);
        }
    };

    const activeCount = data?.pipes.filter(p => p.status === 'ACCEPTED').length ?? 0;
    const pendingCount = data?.pipes.filter(p => p.status === 'PENDING').length ?? 0;
    const rejectedCount = data?.pipes.filter(p => p.status === 'REJECTED').length ?? 0;

    const summaryCards = [
        { label: 'Active Pipes', value: activeCount, icon: CheckCircle2, classes: 'text-emerald-500 bg-emerald-500/10' },
        { label: 'Pending', value: pendingCount, icon: Hourglass, classes: 'text-yellow-500 bg-yellow-500/10' },
        { label: 'Rejected', value: rejectedCount, icon: XCircle, classes: 'text-rose-500 bg-rose-500/10' },
        { label: 'Total Pipes', value: data?.pipes.length ?? 0, icon: ShieldCheck, classes: 'text-primary bg-primary/10' }
    ];

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                        <ScanFace className="text-primary" size={28} />
                        AEPS Pipe Status
                    </h1>
                    <p className="text-sm text-muted-foreground hidden md:block">
                        Verify your merchant onboarding on all bank pipes.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground font-mono">
                        {user?.retailerId || user?.distributorId || ''}
                    </span>
                    <button
                        onClick={handleVerify}
                        disabled={verifying}
                        className="px-6 py-2.5 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                        {verifying ? 'Verifying...' : 'Verify All Pipes'}
                    </button>
                </div>
            </div>

            {/* Main Container */}
            <div className="flex flex-col gap-6 glass-card rounded-2xl relative overflow-hidden group border border-border">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10 p-6 md:p-8">
                    {loading && !data ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                            <Loader2 className="w-5 h-5 animate-spin" /> Checking pipe status with PaySprint...
                        </div>
                    ) : data && data.pipes.length > 0 ? (
                        <>
                            {/* Summary strip */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                {summaryCards.map((card) => {
                                    const Icon = card.icon;
                                    return (
                                        <div key={card.label} className="bg-background/50 border border-border hover:border-primary/50 transition-all rounded-2xl p-5 flex items-center gap-4">
                                            <div className={`p-4 bg-muted/30 rounded-2xl ${card.classes}`}>
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-2xl font-bold text-foreground">{card.value}</span>
                                                <span className="text-xs text-muted-foreground">{card.label}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pipe cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {data.pipes.map((pipe) => {
                                    const cfg = STATUS_CONFIG[pipe.status];
                                    const Icon = cfg.icon;
                                    return (
                                        <div key={pipe.pipe} className="bg-background/50 border border-border hover:border-primary/50 transition-all rounded-2xl p-6 flex flex-col gap-4 group/card">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-4 bg-muted/30 rounded-2xl group-hover/card:scale-110 transition-transform duration-300 ${cfg.text}`}>
                                                        <Icon className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-lg font-bold text-foreground">{pipe.label}</span>
                                                        <span className="text-xs font-mono text-muted-foreground">{pipe.pipe}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-3 py-1 rounded-full font-medium ${cfg.badge}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-2 mt-auto">
                                                {pipe.is_approved && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span className="font-medium">PaySprint:</span>
                                                        <span>{pipe.is_approved}</span>
                                                    </div>
                                                )}

                                                {pipe.message && (
                                                    <p className="text-xs text-muted-foreground/90 leading-relaxed">
                                                        {pipe.message}
                                                    </p>
                                                )}

                                                {pipe.status !== 'ACCEPTED' && (
                                                    <button
                                                        onClick={() => setOnboardingPipe(pipe.pipe)}
                                                        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg font-medium text-sm hover:bg-primary/20 transition-all"
                                                    >
                                                        <Rocket className="w-4 h-4" />
                                                        Onboard this pipe
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {data?.lastCheckedAt && (
                                <div className="flex justify-end mt-8">
                                    <span className="text-xs text-muted-foreground">
                                        Last verified: {new Date(data.lastCheckedAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center text-sm text-muted-foreground py-10">
                            No pipe status available.
                        </div>
                    )}
                </div>
            </div>

            {/* Info note */}
            <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-4">
                <div className="p-2 bg-primary/20 rounded-lg text-primary mt-0.5">
                    <Info className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-foreground mb-1">What do the pipe statuses mean?</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        <span className="text-emerald-500 font-medium">Active</span> pipes are ready for AEPS transactions.
                        <span className="text-yellow-500 font-medium"> Pending</span> means onboarding is in progress or awaiting eKYC activation.
                        <span className="text-rose-500 font-medium"> Rejected</span> means the bank declined onboarding.
                        Some services (like UPI Cashout) require a specific pipe — use this page to confirm your merchant is onboarded on the right one.
                        Not onboarded yet? Use the <span className="text-primary font-medium">Onboard this pipe</span> button to start that pipe's onboarding flow.
                    </p>
                </div>
            </div>

            {/* Onboarding Modal */}
            {onboardingPipe && (
                <PipeOnboardingModal
                    pipe={onboardingPipe}
                    onClose={() => setOnboardingPipe(null)}
                    onComplete={fetchPipes}
                />
            )}
        </div>
    );
};

export default PipeStatusPage;
