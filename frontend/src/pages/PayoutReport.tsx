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

const getCrDr = (type: string) => {
    const credits = ['AEPS_WITHDRAWAL', 'WALLET_TOPUP'];
    const debits = ['BILL_PAYMENT', 'RECHARGE', 'AEPS_SETTLEMENT', 'DMT'];
    if (credits.includes(type)) return 'CR';
    if (debits.includes(type)) return 'DR';
    return 'CR'; // Default fallback
};

const PayoutReport = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const token = localStorage.getItem('token');
                const typeQuery = "&type=AEPS_SETTLEMENT";
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/dashboard/recent-transactions?limit=1000${typeQuery}`, {
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
            tx.metadata?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [transactions, searchTerm]);

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage]);

    const handleDownloadCSV = () => {
        const headers = ["Transaction ID", "Date", "Customer", "Mobile", "Credit", "Debit", "Status"];
        const csvRows = [headers.join(",")];
        
        filteredTransactions.forEach(tx => {
            const isCr = getCrDr(tx.type) === 'CR';
            const row = [
                tx.transactionId || tx._id || "N/A",
                new Date(tx.createdAt).toLocaleString(),
                tx.metadata?.name || tx.metadata?.customerName || "N/A",
                tx.metadata?.mobile || "N/A",
                isCr ? tx.amount || 0 : 0,
                !isCr ? tx.amount || 0 : 0,
                tx.status || "UNKNOWN"
            ];
            const escapedRow = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
            csvRows.push(escapedRow.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `PayoutReport_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text("Payout Reports", 14, 15);
        
        const tableColumn = ["ID", "Date", "Customer", "Credit", "Debit", "Status"];
        const tableRows: any[] = [];

        filteredTransactions.forEach(tx => {
            const isCr = getCrDr(tx.type) === 'CR';
            const txData = [
                tx.transactionId || tx._id || "N/A",
                new Date(tx.createdAt).toLocaleDateString(),
                tx.metadata?.name || tx.metadata?.customerName || "N/A",
                isCr ? tx.amount || 0 : "-",
                !isCr ? tx.amount || 0 : "-",
                tx.status || "UNKNOWN"
            ];
            tableRows.push(txData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`PayoutReport_${new Date().getTime()}.pdf`);
    };

    return (
        <div className="flex-1 w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-4 h-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Payout Reports</h1>
                            <p className="text-xs md:text-sm text-muted-foreground">View your Direct Payout settlements and transfers.</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <div className="relative w-full md:w-auto">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input 
                                type="text" 
                                placeholder="Search ID or Mobile..." 
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-9 pr-4 py-2 w-full bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 md:w-64"
                            />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={handleDownloadCSV} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Export CSV</span>
                                <span className="sm:hidden">CSV</span>
                            </button>
                            <button onClick={handleDownloadPDF} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                                <FileDown className="w-4 h-4" />
                                <span className="hidden sm:inline">Export PDF</span>
                                <span className="sm:hidden">PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Table Container */}
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[140px]">Txn Details</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[140px]">Customer</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[120px]">Bank / Mobile</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right">Credit (₹)</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right">Debit (₹)</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                <span>Loading transactions...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedTransactions.map((tx, idx) => {
                                        const isCr = getCrDr(tx.type) === 'CR';
                                        return (
                                            <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="px-4 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-xs text-foreground/80 truncate max-w-[160px]">{tx.transactionId || tx._id || "N/A"}</span>
                                                        <span className="text-[11px] text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-sm font-medium text-foreground truncate max-w-[140px] block">{tx.metadata?.name || tx.metadata?.customerName || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-medium text-primary truncate max-w-[140px]">{tx.metadata?.bankName || "N/A"}</span>
                                                        <span className="text-xs text-foreground/80">{tx.metadata?.mobile || "N/A"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm font-bold text-emerald-500 text-right px-4 py-2">
                                                    {isCr ? `₹ ${tx.amount || 0}` : "-"}
                                                </TableCell>
                                                <TableCell className="text-sm font-bold text-rose-500 text-right px-4 py-2">
                                                    {!isCr ? `₹ ${tx.amount || 0}` : "-"}
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                        tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 
                                                        tx.status === 'FAILED' ? 'bg-rose-500/10 text-rose-500' : 
                                                        'bg-yellow-500/10 text-yellow-500'
                                                    }`}>
                                                        {tx.status || "UNKNOWN"}
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
                    {!loading && filteredTransactions.length > 0 && (
                        <div className="p-3 border-t border-border flex items-center justify-between bg-muted/30">
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
                                    className="p-1 border border-border rounded text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
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
                                                    ? "bg-primary text-primary-foreground" 
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
                                    className="p-1 border border-border rounded text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
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

export default PayoutReport;
