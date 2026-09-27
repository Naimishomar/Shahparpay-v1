import { useState, useEffect, useMemo } from "react"
import { FileText, Search, Download, FileDown, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import axios from "axios"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const getCrDr = (tx: any) => {
    if (tx.type === 'AEPS_WITHDRAWAL' && tx.status !== 'SUCCESS') return 'NONE';
    const type = tx.type;
    const credits = ['AEPS_WITHDRAWAL', 'WALLET_TOPUP'];
    const debits = ['BILL_PAYMENT', 'RECHARGE', 'AEPS_SETTLEMENT', 'AEPS'];
    if (credits.includes(type)) return 'CR';
    if (debits.includes(type)) return 'DR';
    return 'CR'; // Default fallback
};

const displayStatus = (tx: any) => {
    if (tx.type === 'AEPS_WITHDRAWAL' && tx.status !== 'SUCCESS') {
        return tx.status === 'PROCESSING' ? 'PENDING - NOT CREDITED' : 'DECLINED - NOT CREDITED';
    }
    return tx.status || 'UNKNOWN';
};

/**
 * Why the gateway ended the transaction the way it did. AEPS writes it to
 * metadata.gatewayMessage; resolveTransaction and the reconciliation worker
 * write metadata.apiMessage.
 */
const reasonOf = (tx: any) =>
    tx?.metadata?.gatewayMessage || tx?.metadata?.apiMessage || tx?.metadata?.note || "";

const isFailed = (tx: any) => /FAIL|REJECT/i.test(tx?.status || "");

/** Only the last four digits may be displayed back at an AePS outlet. */
const maskAadhaar = (v: any) => {
    const digits = String(v ?? "").replace(/\D/g, "");
    return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : "";
};

/** The customer's bank balance after the transaction, as the gateway reported it. */
const bankBalanceOf = (tx: any) => {
    const balance = Number(tx?.metadata?.bankBalance);
    return Number.isFinite(balance) ? balance : null;
};

const AepsReport = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const token = localStorage.getItem('token');
                const typeQuery = "&type=AEPS";
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/dashboard/recent-transactions?limit=1000&type=AEPS`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data.success) {
                    setTransactions(res.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch transactions:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, []);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => 
            tx.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            tx.metadata?.mobile?.includes(searchTerm) ||
            tx.metadata?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reasonOf(tx).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [transactions, searchTerm]);

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage]);

    const handleDownloadCSV = () => {
        const headers = ["S.No.", "Transaction ID", "Date", "Customer", "Aadhaar", "Mobile", "Credit", "Debit", "Bank Balance", "Status", "Reason"];
        const csvRows = [headers.join(",")];
        
        filteredTransactions.forEach((tx, idx) => {
            const direction = getCrDr(tx);
            const isCr = direction === 'CR';
            const isDr = direction === 'DR';
            const row = [
                idx + 1,
                tx.transactionId || tx._id || "N/A",
                new Date(tx.createdAt).toLocaleString(),
                tx.metadata?.name || tx.metadata?.customerName || "N/A",
                maskAadhaar(tx.metadata?.aadhaar || tx.metadata?.aadhar) || "N/A",
                tx.metadata?.mobile || "N/A",
                isCr ? tx.amount || 0 : 0,
                isDr ? tx.amount || 0 : 0,
                bankBalanceOf(tx) ?? "N/A",
                displayStatus(tx),
                reasonOf(tx) || "N/A"
            ];
            const escapedRow = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
            csvRows.push(escapedRow.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AepsReport_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text("AEPS Reports", 14, 15);
        
        const tableColumn = ["S.No.", "ID", "Date", "Customer", "Aadhaar", "Credit", "Debit", "Bank Bal.", "Status", "Reason"];
        const tableRows: any[] = [];

        filteredTransactions.forEach((tx, idx) => {
            const direction = getCrDr(tx);
            const isCr = direction === 'CR';
            const isDr = direction === 'DR';
            const txData = [
                idx + 1,
                tx.transactionId || tx._id || "N/A",
                new Date(tx.createdAt).toLocaleDateString(),
                tx.metadata?.name || tx.metadata?.customerName || "N/A",
                maskAadhaar(tx.metadata?.aadhaar || tx.metadata?.aadhar) || "-",
                isCr ? tx.amount || 0 : "-",
                isDr ? tx.amount || 0 : "-",
                bankBalanceOf(tx) ?? "-",
                displayStatus(tx),
                reasonOf(tx) || "-"
            ];
            tableRows.push(txData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`AepsReport_${new Date().getTime()}.pdf`);
    };

    return (
        <div className="flex-1 w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="relative isolate overflow-hidden flex flex-col gap-4 w-full shrink-0 rounded-3xl border bg-card p-4 md:p-5 shadow-sm"><div aria-hidden className="pointer-events-none absolute -top-32 -right-24 -z-10 h-72 w-72 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" /><div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 -z-10 h-72 w-72 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">AEPS Reports</h1>
                            <p className="text-xs md:text-sm text-muted-foreground">View your Aadhaar Enabled Payment System transactions.</p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                                <button onClick={handleDownloadCSV} className="flex items-center justify-center gap-2 border bg-background hover:bg-black/5 dark:hover:bg-white/5 text-foreground px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap">
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export CSV</span>
                                    <span className="sm:hidden">CSV</span>
                                </button>
                                <button onClick={handleDownloadPDF} className="flex items-center justify-center gap-2 bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10 px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap">
                                    <FileDown className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export PDF</span>
                                    <span className="sm:hidden">PDF</span>
                                </button>
                            </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full border-t pt-4">
                        <div className="contents">
                            <div className="relative flex-1 min-w-[220px] md:flex-none md:w-72">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input 
                                    type="text" 
                                    placeholder="Search ID or Mobile..." 
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-9 pr-4 py-2 w-full bg-background border rounded-xl text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Table Container */}
                <div className="flex-1 bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-16 text-center">S.No.</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[140px]">Txn Details</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[140px]">Customer</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[120px]">Bank / Mobile</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right">Credit (₹)</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right">Debit (₹)</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right min-w-[110px]">Bank Balance (₹)</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-center min-w-[180px]">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                                <span>Loading transactions...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-64 text-center text-muted-foreground">
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedTransactions.map((tx, idx) => {
                                        const direction = getCrDr(tx);
                                        const isCr = direction === 'CR';
                                        const isDr = direction === 'DR';
                                        const serialNumber = ((currentPage - 1) * itemsPerPage) + idx + 1;
                                        return (
                                            <TableRow key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                                <TableCell className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">
                                                    {serialNumber}
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-xs text-foreground/80 truncate max-w-[160px]">{tx.transactionId || tx._id || "N/A"}</span>
                                                        <span className="text-[11px] text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-sm font-medium text-foreground truncate max-w-[140px] block">{tx.metadata?.name || tx.metadata?.customerName || "N/A"}</span>
                                                    <span className="text-[11px] font-mono text-muted-foreground">{maskAadhaar(tx.metadata?.aadhaar || tx.metadata?.aadhar) || "-"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-medium text-foreground/70 truncate max-w-[140px]">{tx.metadata?.bankName || "N/A"}</span>
                                                        <span className="text-xs text-foreground/80">{tx.metadata?.mobile || "N/A"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm font-bold text-emerald-500 text-right px-4 py-2">
                                                    {isCr ? `₹ ${tx.amount || 0}` : "-"}
                                                </TableCell>
                                                <TableCell className="text-sm font-bold text-rose-500 text-right px-4 py-2">
                                                    {isDr ? `₹ ${tx.amount || 0}` : "-"}
                                                </TableCell>
                                                <TableCell className="text-sm font-medium text-foreground/80 text-right px-4 py-2">
                                                    {bankBalanceOf(tx) != null ? `₹ ${bankBalanceOf(tx)}` : "-"}
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold uppercase tracking-wider ${
                                                        tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' : 
                                                        tx.status === 'FAILED' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20' : 
                                                        'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20'
                                                    }`}>
                                                        {displayStatus(tx)}
                                                    </span>
                                                    {isFailed(tx) && reasonOf(tx) && (
                                                        <span className="text-[11px] text-rose-500 block mt-1 line-clamp-2">{reasonOf(tx)}</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    
                    {/* Pagination Footer */}
                    {!loading && filteredTransactions.length > 0 && (
                        <div className="p-3 border-t flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
                            <span className="text-xs text-muted-foreground hidden sm:block">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} entries
                            </span>
                            <span className="text-xs text-muted-foreground sm:hidden">
                                {filteredTransactions.length} total
                            </span>
                            
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 border rounded-lg text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                
                                <div className="flex items-center gap-1 px-2">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum = currentPage;
                                        if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;
                                        
                                        if (pageNum < 1 || pageNum > totalPages) return null;
                                        
                                        return (
                                            <button 
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-7 h-7 rounded text-xs font-medium flex items-center justify-center transition-colors ${
                                                    currentPage === pageNum 
                                                    ? "bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10" 
                                                    : "text-muted-foreground hover:bg-muted"
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button 
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="p-1.5 border rounded-lg text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AepsReport;
