import { useState, useEffect, useMemo } from "react"
import { FileText, Search, Download, FileDown, Loader2, ChevronLeft, ChevronRight, CreditCard, Building2 } from "lucide-react"
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
    const credits = ['WALLET_TOPUP'];
    const debits = ['PAN_CARD', 'STD_PAN_CARD', 'RECHARGE', 'BILL_PAYMENT', 'AEPS_SETTLEMENT', 'AEPS', 'DMT'];
    if (credits.includes(type)) return 'CR';
    if (debits.includes(type)) return 'DR';
    return 'DR';
};

const getPanTypeLabel = (type: string) => {
    if (type === 'PAN_CARD') return 'Biometric PSA';
    if (type === 'STD_PAN_CARD') return 'Standard Web PSA';
    return type;
};

const getPanTypeColor = (type: string) => {
    if (type === 'PAN_CARD') return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    if (type === 'STD_PAN_CARD') return 'bg-purple-500/10 text-purple-500 border-purple-500/30';
    return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
};

const PanReport = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [panTypeFilter, setPanTypeFilter] = useState<'ALL' | 'PAN_CARD' | 'STD_PAN_CARD'>('ALL');
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/dashboard/recent-transactions?limit=1000&type=PAN_CARD,STD_PAN_CARD`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data.success) {
                    setTransactions(res.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch PAN transactions:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, []);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const matchesSearch = tx.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                tx.metadata?.mobile?.includes(searchTerm) ||
                tx.metadata?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tx.metadata?.psa_id?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesType = panTypeFilter === 'ALL' || tx.type === panTypeFilter;
            
            return matchesSearch && matchesType;
        });
    }, [transactions, searchTerm, panTypeFilter]);

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage]);

    const handleDownloadCSV = () => {
        const headers = ["S.No.", "Transaction ID", "Date", "PAN Type", "PSA ID", "Customer", "Mobile", "Amount (₹)", "Status"];
        const csvRows = [headers.join(",")];
        
        filteredTransactions.forEach((tx, idx) => {
            const isCr = getCrDr(tx.type) === 'CR';
            const row = [
                idx + 1,
                tx.transactionId || tx._id || "N/A",
                new Date(tx.createdAt).toLocaleString(),
                getPanTypeLabel(tx.type),
                tx.metadata?.psa_id || "N/A",
                tx.metadata?.name || tx.metadata?.shop_name || tx.metadata?.customerName || "N/A",
                tx.metadata?.mobile || "N/A",
                isCr ? tx.amount || 0 : tx.amount || 0,
                tx.status || "UNKNOWN"
            ];
            const escapedRow = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
            csvRows.push(escapedRow.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `PanReport_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text("PAN Card Service Reports", 14, 15);
        
        const tableColumn = ["S.No.", "Txn ID", "Date", "Type", "PSA ID", "Customer", "Amount (₹)", "Status"];
        const tableRows: any[] = [];

        filteredTransactions.forEach((tx, idx) => {
            const isCr = getCrDr(tx.type) === 'CR';
            const txData = [
                idx + 1,
                tx.transactionId || tx._id || "N/A",
                new Date(tx.createdAt).toLocaleDateString(),
                getPanTypeLabel(tx.type),
                tx.metadata?.psa_id || "N/A",
                tx.metadata?.name || tx.metadata?.shop_name || tx.metadata?.customerName || "N/A",
                isCr ? `₹ ${tx.amount || 0}` : `₹ ${tx.amount || 0}`,
                tx.status || "UNKNOWN"
            ];
            tableRows.push(txData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`PanReport_${new Date().getTime()}.pdf`);
    };

    const biometricCount = transactions.filter(t => t.type === 'PAN_CARD').length;
    const standardCount = transactions.filter(t => t.type === 'STD_PAN_CARD').length;
    const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    return (
        <div className="flex-1 w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <CreditCard className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">PAN Reports</h1>
                            <p className="text-xs md:text-sm text-muted-foreground">View all PAN Card service transactions (Biometric & Standard PSA).</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto">
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full justify-end">
                            <div className="relative flex-1 min-w-[200px] md:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input 
                                    type="text" 
                                    placeholder="Search ID, PSA ID, or Mobile..." 
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-9 pr-4 py-2 w-full bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            
                            <select
                                value={panTypeFilter}
                                onChange={(e) => {
                                    setPanTypeFilter(e.target.value as 'ALL' | 'PAN_CARD' | 'STD_PAN_CARD');
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 whitespace-nowrap"
                            >
                                <option value="ALL">All Types</option>
                                <option value="PAN_CARD">Biometric PSA</option>
                                <option value="STD_PAN_CARD">Standard Web PSA</option>
                            </select>
                            
                            <div className="flex gap-2 shrink-0">
                                <button onClick={handleDownloadCSV} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap">
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export CSV</span>
                                    <span className="sm:hidden">CSV</span>
                                </button>
                                <button onClick={handleDownloadPDF} className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap">
                                    <FileDown className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export PDF</span>
                                    <span className="sm:hidden">PDF</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <CreditCard className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Biometric PSA</p>
                                <p className="text-xl font-bold text-foreground">{biometricCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <Building2 className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Standard Web PSA</p>
                                <p className="text-xl font-bold text-foreground">{standardCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <FileText className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Transactions</p>
                                <p className="text-xl font-bold text-foreground">{transactions.length}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Table Container */}
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 w-16 text-center">S.No.</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[120px]">Txn ID</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[100px]">Date</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[130px]">PAN Type</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[140px]">PSA ID</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[140px]">Customer / Shop</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[100px]">Mobile</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right">Amount (₹)</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                <span>Loading PAN transactions...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-64 text-center text-muted-foreground">
                                            No PAN transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedTransactions.map((tx, idx) => {
                                        const isCr = getCrDr(tx.type) === 'CR';
                                        const serialNumber = ((currentPage - 1) * itemsPerPage) + idx + 1;
                                        return (
                                            <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">
                                                    {serialNumber}
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-xs text-foreground/80 truncate max-w-[140px]">{tx.transactionId || tx._id || "N/A"}</span>
                                                        <span className="text-[11px] text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getPanTypeColor(tx.type)}`}>
                                                        {getPanTypeLabel(tx.type)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-sm font-mono text-foreground/80 truncate block max-w-[140px]">{tx.metadata?.psa_id || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-sm font-medium text-foreground truncate max-w-[140px] block">{tx.metadata?.name || tx.metadata?.shop_name || tx.metadata?.customerName || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs text-foreground/80">{tx.metadata?.mobile || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="text-sm font-bold text-right px-4 py-2">
                                                    {isCr ? `₹ ${tx.amount || 0}` : `₹ ${tx.amount || 0}`}
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                        tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 
                                                        tx.status === 'FAILED' ? 'bg-rose-500/10 text-rose-500' : 
                                                        tx.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' :
                                                        'bg-gray-500/10 text-gray-500'
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

export default PanReport;