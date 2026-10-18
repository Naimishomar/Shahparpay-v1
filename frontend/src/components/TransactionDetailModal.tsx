import { XCircle } from "lucide-react"

/** Why the gateway ended the transaction the way it did. */
export const reasonOf = (tx: any) =>
    tx?.metadata?.gatewayMessage || tx?.metadata?.apiMessage || tx?.metadata?.message || tx?.metadata?.note || "";

/** Full detail of one wallet transaction, shared by every report that lists them. */
const TransactionDetailModal = ({ tx, onClose }: { tx: any; onClose: () => void }) => {
    if (!tx) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => onClose()}>
            <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-start p-4 bg-muted/30 border-b border-border">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-black text-foreground">Transaction Details</h3>
                        <p className="text-xs text-muted-foreground font-medium">Ref: {tx.transactionId || tx._id}</p>
                    </div>
                    <button onClick={() => onClose()} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Amount & Status */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Amount</p>
                            <p className="text-2xl font-black text-foreground">₹ {tx.amount || 0}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Status</p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20 border border-emerald-500/20' : 
                                tx.status === 'FAILED' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20 border border-rose-500/20' : 
                                'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20 border border-yellow-500/20'
                            }`}>
                                {tx.status || "UNKNOWN"}
                            </span>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Date & Time</p>
                            <p className="text-sm font-medium text-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Type</p>
                            <p className="text-sm font-medium text-foreground">{tx.type?.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Customer Name</p>
                            <p className="text-sm font-medium text-foreground">{tx.metadata?.name || tx.metadata?.customerName || "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Mobile Number</p>
                            <p className="text-sm font-medium text-foreground">{tx.metadata?.mobile || "N/A"}</p>
                        </div>
                        {tx.metadata?.bankName && (
                            <div className="space-y-1 col-span-2">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Bank Name</p>
                                <p className="text-sm font-medium text-foreground">{tx.metadata.bankName}</p>
                            </div>
                        )}
                        {tx.metadata?.rrn && (
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Bank RRN</p>
                                <p className="text-sm font-medium text-foreground">{tx.metadata.rrn}</p>
                            </div>
                        )}
                        {(tx.metadata?.aadhaar || tx.metadata?.aadhar) && (
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Aadhaar (Last 4)</p>
                                <p className="text-sm font-medium text-foreground">**** {String(tx.metadata.aadhaar || tx.metadata.aadhar).slice(-4)}</p>
                            </div>
                        )}
                        {tx.metadata?.bankBalance != null && (
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Bank Balance After</p>
                                <p className="text-sm font-medium text-foreground">₹ {tx.metadata.bankBalance}</p>
                            </div>
                        )}
                    </div>

                    {/* PaySprint / Gateway Message */}
                    {reasonOf(tx) && (
                        <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Message</p>
                            <p className="text-sm font-medium text-foreground">
                                {reasonOf(tx)}
                            </p>
                        </div>
                    )}
                    
                    {/* Metadata Dump (for debugging/extra details) */}
                    {tx.metadata && Object.keys(tx.metadata).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-2">Additional Metadata</p>
                            <div className="bg-muted/50 p-3 rounded-lg overflow-x-auto">
                                <pre className="text-[10px] text-foreground/80 font-mono whitespace-pre-wrap">
                                    {JSON.stringify(
                                        Object.fromEntries(
                                            Object.entries(tx.metadata).filter(
                                                ([k]) => !['name', 'customerName', 'mobile', 'bankName', 'rrn', 'aadhar', 'latitude', 'longitude'].includes(k)
                                            )
                                        ), 
                                        null, 2
                                    )}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                    <button onClick={() => onClose()} className="px-5 py-2 btn-primary rounded-xl text-sm font-semibold transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
