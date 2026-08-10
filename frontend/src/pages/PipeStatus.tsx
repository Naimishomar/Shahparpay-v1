import { useState, useEffect, useCallback } from 'react';
import { ScanFace, Loader2, RefreshCw, CheckCircle2, XCircle, Hourglass, Ban, AlertTriangle, ShieldCheck, type LucideIcon } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

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

const STATUS_CONFIG: Record<PipeStatus, { label: string; icon: LucideIcon; classes: string; badge: string }> = {
    ACCEPTED: {
        label: 'Active',
        icon: CheckCircle2,
        classes: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
        badge: 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
    },
    PENDING: {
        label: 'Pending Verification',
        icon: Hourglass,
        classes: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-600',
        badge: 'bg-yellow-500/20 text-yellow-600 border border-yellow-500/30'
    },
    REJECTED: {
        label: 'Rejected',
        icon: XCircle,
        classes: 'border-rose-500/40 bg-rose-500/10 text-rose-600',
        badge: 'bg-rose-500/20 text-rose-600 border border-rose-500/30'
    },
    NOT_ONBOARDED: {
        label: 'Not Onboarded',
        icon: Ban,
        classes: 'border-muted-foreground/30 bg-muted/20 text-muted-foreground',
        badge: 'bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20'
    },
    ERROR: {
        label: 'Check Failed',
        icon: AlertTriangle,
        classes: 'border-orange-500/40 bg-orange-500/10 text-orange-600',
        badge: 'bg-orange-500/20 text-orange-600 border border-orange-500/30'
    },
    UNKNOWN: {
        label: 'Unknown',
        icon: AlertTriangle,
        classes: 'border-muted-foreground/30 bg-muted/20 text-muted-foreground',
        badge: 'bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20'
    }
};

const PipeStatusPage = () => {
    const { token, user } = useAuth();

    const [data, setData] = useState<PipesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);

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

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-3">
                        <ScanFace className="w-7 h-7 text-primary" />
                        AEPS Pipe Status
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                        {user?.retailerId || user?.distributorId || ''}
                    </span>
                    <button
                        onClick={handleVerify}
                        disabled={verifying}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-md font-medium transition-colors disabled:opacity-50"
                    >
                        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {verifying ? 'Verifying...' : 'Verify All Pipes'}
                    </button>
                </div>
            </div>

            {/* Summary strip */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-emerald-600">{activeCount}</span>
                            <span className="text-xs text-muted-foreground">Active Pipes</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10">
                        <Hourglass className="w-6 h-6 text-yellow-600" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-yellow-600">{pendingCount}</span>
                            <span className="text-xs text-muted-foreground">Pending</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/40 bg-rose-500/10">
                        <XCircle className="w-6 h-6 text-rose-600" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-rose-600">{rejectedCount}</span>
                            <span className="text-xs text-muted-foreground">Rejected</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-background/50">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-primary">{data.pipes.length}</span>
                            <span className="text-xs text-muted-foreground">Total Pipes</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Pipe cards */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group border border-border">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10">
                    {loading && !data ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                            <Loader2 className="w-5 h-5 animate-spin" /> Checking pipe status with PaySprint...
                        </div>
                    ) : data && data.pipes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {data.pipes.map((pipe) => {
                                const cfg = STATUS_CONFIG[pipe.status];
                                const Icon = cfg.icon;
                                return (
                                    <div key={pipe.pipe} className={`flex flex-col gap-3 p-5 rounded-xl border ${cfg.classes}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <Icon className="w-6 h-6 shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold">{pipe.label}</span>
                                                    <span className="text-xs font-mono text-muted-foreground">{pipe.pipe}</span>
                                                </div>
                                            </div>
                                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${cfg.badge}`}>
                                                {cfg.label}
                                            </span>
                                        </div>

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
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center text-sm text-muted-foreground py-10">
                            No pipe status available.
                        </div>
                    )}
                </div>
            </div>

            {data?.lastCheckedAt && (
                <div className="flex justify-end">
                    <span className="text-xs text-muted-foreground">
                        Last verified: {new Date(data.lastCheckedAt).toLocaleString()}
                    </span>
                </div>
            )}
        </div>
    );
};

export default PipeStatusPage;
