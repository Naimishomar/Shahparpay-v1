import { useState, useEffect, useMemo } from "react"
import { FileText, Search, Download, FileDown, Loader2, ChevronLeft, ChevronRight, Landmark, Receipt, CalendarClock } from "lucide-react"
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
import { useAuth } from '../context/AuthContext'

interface Transaction {
    _id: string;
    transactionId: string;
    amount: number;
    status: string;
    createdAt: string;
    metadata?: {
        application_id?: number;
        eseva_fee?: number;
        partner_margin?: number;
        gst_amount?: number;
        late_fee?: number;
        timestamp?: string;
        message?: string;
        refund_amount?: number;
        agent_charge_amount?: number;
        applicant_name?: string;
        pan_number?: string;
        service_type?: string;
    };
}

const getStatusColor = (status: string) => {
    if (status === 'SUCCESS') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20';
    if (status === 'FAILED') return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20';
    if (status === 'REFUNDED') return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20';
    if (status === 'PROCESSING' || status === 'PENDING') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20';
    return 'bg-gray-500/10 text-gray-500';
};

const ItrReport = () => {
    const { token } = useAuth();
    const [history, setHistory] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/itr/history`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setHistory(res.data.transactions || []);
                }
            } catch (error) {
                console.error("Failed to fetch ITR history:", error);
            } finally {
                setLoading(false);
            }
        };
        if (token) {
            fetchHistory();
        }
    }, [token]);

    const filteredHistory = useMemo(() => {
        return history.filter(txn => {
            const matchesSearch =
                txn.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(txn.metadata?.application_id || '').includes(searchTerm) ||
                txn.metadata?.applicant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                txn.metadata?.pan_number?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'ALL' || txn.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [history, searchTerm, statusFilter]);

    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

    const paginatedHistory = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredHistory.slice(start, start + itemsPerPage);
    }, [filteredHistory, currentPage]);

    const handleDownloadCSV = () => {
        const headers = ["S.No.", "Application ID", "Transaction ID", "Applicant", "PAN", "Amount (₹)", "Status", "Date", "Details"];
        const csvRows = [headers.join(",")];

        filteredHistory.forEach((txn, idx) => {
            const row = [
                idx + 1,
                txn.metadata?.application_id || "N/A",
                txn.transactionId || "N/A",
                txn.metadata?.applicant_name || "N/A",
                txn.metadata?.pan_number || "N/A",
                txn.amount || 0,
                txn.status || "UNKNOWN",
                txn.createdAt ? new Date(txn.createdAt).toLocaleString() : "N/A",
                txn.metadata?.message || `Fee: ₹${txn.metadata?.eseva_fee || 0} | Margin: ₹${txn.metadata?.partner_margin || 0} | GST: ₹${txn.metadata?.gst_amount || 0}`
            ];
            const escapedRow = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
            csvRows.push(escapedRow.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ItrReport_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text("ITR Filing Reports", 14, 15);

        const tableColumn = ["S.No.", "App ID", "Txn ID", "Amount", "Status", "Date"];
        const tableRows: (string | number)[][] = [];

        filteredHistory.forEach((txn, idx) => {
            const txData = [
                idx + 1,
                txn.metadata?.application_id || "N/A",
                txn.transactionId || "N/A",
                `₹ ${txn.amount || 0}`,
                txn.status || "UNKNOWN",
                txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : "N/A"
            ];
            tableRows.push(txData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`ItrReport_${new Date().getTime()}.pdf`);
    };

    const totalAmount = history.reduce((sum, t) => sum + (t.amount || 0), 0);
    const successCount = history.filter(t => t.status === 'SUCCESS').length;
    const refundedCount = history.filter(t => t.status === 'REFUNDED').length;

    return (
        <div className="flex-1 w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="relative isolate overflow-hidden flex flex-col gap-4 w-full shrink-0 rounded-3xl border bg-card p-4 md:p-5 shadow-sm"><div aria-hidden className="pointer-events-none absolute -top-32 -right-24 -z-10 h-72 w-72 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" /><div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 -z-10 h-72 w-72 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <FileText className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">ITR Filing Reports</h1>
                            <p className="text-xs md:text-sm text-muted-foreground">View all Income Tax Return filings and transactions.</p>
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
                                    placeholder="Search App ID, Txn ID, PAN..." 
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-9 pr-4 py-2 w-full bg-background border rounded-xl text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500"
                                />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 bg-background border rounded-xl text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 whitespace-nowrap"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="SUCCESS">SUCCESS</option>
                                <option value="FAILED">FAILED</option>
                                <option value="REFUNDED">REFUNDED</option>
                                <option value="PROCESSING">PROCESSING</option>
                                <option value="PENDING">PENDING</option>
                            </select>

                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <Landmark className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Filings</p>
                                <p className="text-xl font-bold text-foreground">{history.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <Receipt className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Successful</p>
                                <p className="text-xl font-bold text-foreground">{successCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <CalendarClock className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Refunded</p>
                                <p className="text-xl font-bold text-foreground">{refundedCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <FileText className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Amount</p>
                                <p className="text-xl font-bold text-foreground">₹ {totalAmount.toLocaleString('en-IN')}</p>
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
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[100px]">App ID</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[140px]">Txn ID</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[120px]">Applicant</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[110px]">PAN</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right">Amount (₹)</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[100px]">Date</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-center">Status</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[180px]">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                                <span>Loading ITR filings...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedHistory.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-64 text-center text-muted-foreground">
                                            No ITR filings found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedHistory.map((txn, idx) => {
                                        const serialNumber = ((currentPage - 1) * itemsPerPage) + idx + 1;
                                        return (
                                            <TableRow key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                                <TableCell className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">
                                                    {serialNumber}
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-sm font-semibold text-foreground">#{txn.metadata?.application_id || 'N/A'}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="font-medium text-xs text-foreground/80 truncate max-w-[140px] block">{txn.transactionId || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-sm text-foreground truncate max-w-[140px] block">{txn.metadata?.applicant_name || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs font-mono text-foreground/80 uppercase">{txn.metadata?.pan_number || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="text-sm font-bold text-right px-4 py-2">
                                                    ₹ {txn.amount.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-[11px] text-muted-foreground">{txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(txn.status)}`}>
                                                        {txn.status || "UNKNOWN"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-[11px] text-muted-foreground truncate max-w-[180px] block">
                                                        {txn.metadata?.message ||
                                                         `Fee: ₹${txn.metadata?.eseva_fee || 0} | Margin: ₹${txn.metadata?.partner_margin || 0} | GST: ₹${txn.metadata?.gst_amount || 0}`}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Footer */}
                    {!loading && filteredHistory.length > 0 && (
                        <div className="p-3 border-t flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
                            <span className="text-xs text-muted-foreground hidden sm:block">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredHistory.length)} of {filteredHistory.length} entries
                            </span>
                            <span className="text-xs text-muted-foreground sm:hidden">
                                {filteredHistory.length} total
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

export default ItrReport;