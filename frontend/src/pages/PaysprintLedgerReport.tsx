import { useState, useEffect, useMemo } from "react"
import { Search, Download, FileDown, Loader2, ChevronLeft, ChevronRight, BookOpen } from "lucide-react"
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

interface LedgerRow {
  SNO: string;
  USERNAME: string;
  OPENING: number;
  AMOUNT: number;
  COMMISSION: number;
  TDS: number;
  GST: number;
  CLOSING: number;
  TYPE: string;
  NARRATION: string;
  remarks: string;
  TXNTYPE: string;
  DATE: string;
}

const getTxnTypeColor = (type: string) => {
    const map: Record<string, string> = {
        'Commission': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
        'AEPS Wallet': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
        'AadhaarPay': 'bg-purple-500/10 text-purple-500 border-purple-500/30',
        'Aadharpay Charges': 'bg-rose-500/10 text-rose-500 border-rose-500/30',
        'Settlement': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
        'Merchant Two Factor Authentication Charges': 'bg-orange-500/10 text-orange-500 border-orange-500/30',
        'Ministatement': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
    };
    return map[type] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
};

const toNum = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

const fmt = (v: unknown) => toNum(v).toFixed(2);

const PaysprintLedgerReport = () => {
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState<'live' | 'demo'>('demo');
    const [message, setMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [txnTypeFilter, setTxnTypeFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchLedger = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                let url = `${import.meta.env.VITE_BACKEND_URL}/api/paysprint/credit-ledger`;
                const params = new URLSearchParams();
                if (startDate) params.set('startDate', startDate);
                if (endDate) params.set('endDate', endDate);
                const qs = params.toString();
                if (qs) url += `?${qs}`;
                const res = await axios.get(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data.success) {
                    setRows(res.data.data || []);
                    setSource(res.data.source === 'live' ? 'live' : 'demo');
                    setMessage(res.data.message || "");
                }
            } catch (error) {
                console.error("Failed to fetch Paysprint credit ledger:", error);
                setRows([]);
                setMessage("Failed to fetch the credit ledger from the server.");
            } finally {
                setLoading(false);
            }
        };
        fetchLedger();
    }, [startDate, endDate]);

    const txnTypes = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => { if (r.TXNTYPE) set.add(r.TXNTYPE); });
        return Array.from(set).sort();
    }, [rows]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = !term ||
                r.SNO.toLowerCase().includes(term) ||
                r.USERNAME.toLowerCase().includes(term) ||
                r.NARRATION.toLowerCase().includes(term) ||
                r.TXNTYPE.toLowerCase().includes(term);
            const matchesTxn = txnTypeFilter === 'ALL' || r.TXNTYPE === txnTypeFilter;
            const matchesType = typeFilter === 'ALL' || r.TYPE === typeFilter;
            return matchesSearch && matchesTxn && matchesType;
        });
    }, [rows, searchTerm, txnTypeFilter, typeFilter]);

    const totalPages = Math.ceil(filteredRows.length / itemsPerPage);

    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRows.slice(start, start + itemsPerPage);
    }, [filteredRows, currentPage]);

    const totals = useMemo(() => {
        return filteredRows.reduce((acc, r) => ({
            amount: acc.amount + toNum(r.AMOUNT),
            commission: acc.commission + toNum(r.COMMISSION),
            tds: acc.tds + toNum(r.TDS),
            gst: acc.gst + toNum(r.GST),
        }), { amount: 0, commission: 0, tds: 0, gst: 0 });
    }, [filteredRows]);

    const handleDownloadCSV = () => {
        const headers = ["SNO", "USERNAME", "OPENING", "AMOUNT", "COMMISSION", "TDS", "GST", "CLOSING", "TYPE", "NARRATION", "remarks", "TXNTYPE", "DATE"];
        const csvRows = [headers.join(",")];
        filteredRows.forEach(r => {
            const row = [r.SNO, r.USERNAME, fmt(r.OPENING), fmt(r.AMOUNT), fmt(r.COMMISSION), fmt(r.TDS), fmt(r.GST), fmt(r.CLOSING), r.TYPE, r.NARRATION, r.remarks, r.TXNTYPE, r.DATE];
            csvRows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
        });
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `PaysprintCreditLedger_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Paysprint Credit Ledger", 14, 15);
        const tableColumn = ["SNO", "USERNAME", "OPENING", "AMOUNT", "COMMISSION", "TDS", "GST", "CLOSING", "TYPE", "NARRATION", "TXNTYPE", "DATE"];
        const tableRows: (string | number)[][] = [];
        filteredRows.forEach(r => {
            tableRows.push([
                r.SNO, r.USERNAME, fmt(r.OPENING), fmt(r.AMOUNT), fmt(r.COMMISSION), fmt(r.TDS), fmt(r.GST), fmt(r.CLOSING), r.TYPE, r.NARRATION, r.TXNTYPE, r.DATE
            ]);
        });
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [37, 99, 235] },
        });
        doc.save(`PaysprintCreditLedger_${new Date().getTime()}.pdf`);
    };

    return (
        <div className="flex-1 w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <BookOpen className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Paysprint Credit Ledger</h1>
                            <p className="text-xs md:text-sm text-muted-foreground">Opening, amount, commission, TDS, GST and closing balance per transaction.</p>
                            {message && (
                                <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-semibold gap-1 ${
                                    source === 'live' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500'
                                }`}>
                                    {source === 'live' ? 'LIVE DATA' : 'DEMO DATA'}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto">
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full justify-end">
                            <div className="relative flex-1 min-w-[200px] md:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search SNO, narration, txn type..."
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    className="pl-9 pr-4 py-2 w-full bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <select
                                value={txnTypeFilter}
                                onChange={(e) => { setTxnTypeFilter(e.target.value); setCurrentPage(1); }}
                                className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                            >
                                <option value="ALL">All Txn Types</option>
                                {txnTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                                className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                            >
                                <option value="ALL">All Types</option>
                                <option value="credit">Credit</option>
                                <option value="debit">Debit</option>
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
                        <div className="flex items-center gap-2 w-full justify-end">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                                className="flex-1 md:flex-none px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                            />
                            <span className="text-muted-foreground">to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                                className="flex-1 md:flex-none px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Amount</p>
                        <p className="text-lg font-bold text-foreground">₹ {fmt(totals.amount)}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Commission</p>
                        <p className="text-lg font-bold text-emerald-500">₹ {fmt(totals.commission)}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">TDS</p>
                        <p className="text-lg font-bold text-rose-500">₹ {fmt(totals.tds)}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">GST</p>
                        <p className="text-lg font-bold text-rose-500">₹ {fmt(totals.gst)}</p>
                    </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 w-16 text-center">SNO</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[90px]">Username</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right min-w-[90px]">Opening</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right min-w-[90px]">Amount</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right min-w-[90px]">Commission</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right min-w-[70px]">TDS</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right min-w-[70px]">GST</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-right min-w-[90px]">Closing</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-center min-w-[70px]">Type</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[220px]">Narration</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[150px]">Txn Type</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[130px]">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                <span>Loading credit ledger...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-64 text-center text-muted-foreground">
                                            {message && source === 'demo' ? message : "No ledger entries found."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRows.map((r, idx) => {
                                        const serialNumber = ((currentPage - 1) * itemsPerPage) + idx + 1;
                                        const isCredit = r.TYPE === 'credit';
                                        return (
                                            <TableRow key={`${r.SNO}-${idx}`} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">{serialNumber}</TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-sm font-mono text-foreground/80 truncate block max-w-[100px]">{r.USERNAME || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="text-sm font-medium text-right px-4 py-2 text-foreground/80">{fmt(r.OPENING)}</TableCell>
                                                <TableCell className={`text-sm font-bold text-right px-4 py-2 ${isCredit ? 'text-emerald-500' : 'text-rose-500'}`}>{isCredit ? '+' : '-'} {fmt(r.AMOUNT)}</TableCell>
                                                <TableCell className="text-sm font-medium text-right px-4 py-2 text-emerald-600">{r.COMMISSION ? fmt(r.COMMISSION) : '-'}</TableCell>
                                                <TableCell className="text-sm font-medium text-right px-4 py-2 text-rose-500">{r.TDS ? fmt(r.TDS) : '-'}</TableCell>
                                                <TableCell className="text-sm font-medium text-right px-4 py-2 text-rose-500">{r.GST ? fmt(r.GST) : '-'}</TableCell>
                                                <TableCell className="text-sm font-bold text-right px-4 py-2 text-foreground">{fmt(r.CLOSING)}</TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                                        isCredit ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                                                    }`}>
                                                        {r.TYPE}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs text-foreground/80 block line-clamp-2 max-w-[220px]">{r.NARRATION || "-"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getTxnTypeColor(r.TXNTYPE)}`}>
                                                        {r.TXNTYPE || "N/A"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs text-foreground/80">{r.DATE || "N/A"}</span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Footer */}
                    {!loading && filteredRows.length > 0 && (
                        <div className="p-3 border-t border-border flex items-center justify-between bg-muted/30">
                            <span className="text-xs text-muted-foreground hidden sm:block">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length} entries
                            </span>
                            <span className="text-xs text-muted-foreground sm:hidden">
                                {filteredRows.length} total
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
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
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

export default PaysprintLedgerReport;
