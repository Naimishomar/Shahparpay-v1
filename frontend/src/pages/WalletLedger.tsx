import { useState, useEffect, useMemo } from "react"
import { Search, Download, FileDown, Loader2, ChevronLeft, ChevronRight, Wallet as WalletIcon } from "lucide-react"
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
    UTR: string;
    WALLET: string;
    OPENING: number;
    AMOUNT: number;
    COMMISSION: number;
    TDS: number;
    GST: number;
    CLOSING: number;
    TYPE: string;
    NARRATION: string;
    TXNTYPE: string;
    DATE: string;
    /** Transaction status: a ledger row's TYPE is its direction, not its outcome. */
    remarks?: string;
    /** Why the gateway rejected it, when it did. */
    REASON?: string;
}

/** Rows the gateway rejected — the ones whose REASON is worth showing. */
const isFailed = (r: LedgerRow) => /FAIL|REJECT/i.test(r.remarks || '');

const getTxnTypeColor = (type: string) => {
    const map: Record<string, string> = {
        'AEPS Wallet': 'bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20 border-blue-500/30',
        'AadhaarPay': 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30',
        'Recharge': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
        'BBPS': 'bg-teal-500/10 text-teal-500 border-teal-500/30',
        'DMT': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30',
        'Settlement': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20 border-amber-500/30',
        'Direct Payout': 'bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-orange-500/20 border-orange-500/30',
        'AEPS Deposit': 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/30',
        'PAN Card': 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20 border-rose-500/30',
        'PAN Service': 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20 border-rose-500/30',
        'PAN Coupon': 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20 border-rose-500/30',
        'Wallet Topup': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20 border-emerald-500/30',
        'ITR': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20 border-yellow-500/30',
        'Refund': 'bg-gray-500/10 text-gray-500 border-gray-500/30',
        'Wallet Transfer': 'bg-sky-500/10 text-sky-500 border-sky-500/30',
    };
    return map[type] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
};

const getWalletColor = (wallet: string) => {
    if (wallet === 'AEPS') return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20 border-blue-500/30';
    if (wallet === 'AEPS→Main') return 'bg-sky-500/10 text-sky-500 border-sky-500/30';
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
};

const toNum = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

const fmt = (v: unknown) => toNum(v).toFixed(2);

const WalletLedger = () => {
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [currentMain, setCurrentMain] = useState(0);
    const [currentAeps, setCurrentAeps] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [walletFilter, setWalletFilter] = useState("ALL");
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
                let url = `${import.meta.env.VITE_BACKEND_URL}/api/wallet/ledger`;
                const params = new URLSearchParams();
                if (walletFilter !== 'ALL') params.set('wallet', walletFilter);
                if (startDate) params.set('startDate', startDate);
                if (endDate) params.set('endDate', endDate);
                const qs = params.toString();
                if (qs) url += `?${qs}`;
                const res = await axios.get(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data.success) {
                    setRows(res.data.data || []);
                    setCurrentMain(toNum(res.data.currentMain));
                    setCurrentAeps(toNum(res.data.currentAeps ?? 0));
                    setMessage("");
                }
            } catch (error) {
                console.error("Failed to fetch wallet ledger:", error);
                setRows([]);
                setMessage("Failed to fetch the wallet ledger from the server.");
            } finally {
                setLoading(false);
            }
        };
        fetchLedger();
    }, [startDate, endDate, walletFilter]);

    const txnTypes = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => { if (r.TXNTYPE) set.add(r.TXNTYPE); });
        return Array.from(set).sort();
    }, [rows]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = !term ||
                r.UTR.toLowerCase().includes(term) ||
                r.NARRATION.toLowerCase().includes(term) ||
                (r.REASON || '').toLowerCase().includes(term) ||
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
            amount: acc.amount + (r.TYPE === 'debit' ? -toNum(r.AMOUNT) : toNum(r.AMOUNT)),
            commission: acc.commission + toNum(r.COMMISSION),
            tds: acc.tds + toNum(r.TDS),
            gst: acc.gst + toNum(r.GST),
        }), { amount: 0, commission: 0, tds: 0, gst: 0 });
    }, [filteredRows]);

    const handleDownloadCSV = () => {
        const headers = ["UTR", "WALLET", "OPENING", "AMOUNT", "COMMISSION", "TDS", "GST", "CLOSING", "TYPE", "NARRATION", "TXNTYPE", "STATUS", "REASON", "DATE"];
        const csvRows = [headers.join(",")];
        filteredRows.forEach(r => {
            const row = [r.UTR, r.WALLET, fmt(r.OPENING), fmt(r.AMOUNT), fmt(r.COMMISSION), fmt(r.TDS), fmt(r.GST), fmt(r.CLOSING), r.TYPE, r.NARRATION, r.TXNTYPE, r.remarks || "", r.REASON || "", r.DATE];
            csvRows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
        });
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `WalletLedger_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Wallet Ledger", 14, 15);
        const tableColumn = ["UTR", "WALLET", "OPENING", "AMOUNT", "COMMISSION", "TDS", "GST", "CLOSING", "TYPE", "NARRATION", "TXNTYPE", "STATUS", "REASON", "DATE"];
        const tableRows: (string | number)[][] = [];
        filteredRows.forEach(r => {
            tableRows.push([
                r.UTR, r.WALLET, fmt(r.OPENING), fmt(r.AMOUNT), fmt(r.COMMISSION), fmt(r.TDS), fmt(r.GST), fmt(r.CLOSING), r.TYPE, r.NARRATION, r.TXNTYPE, r.remarks || "-", r.REASON || "-", r.DATE
            ]);
        });
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [37, 99, 235] },
        });
        doc.save(`WalletLedger_${new Date().getTime()}.pdf`);
    };

    return (
        <div className="flex-1 w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="relative isolate overflow-hidden flex flex-col gap-4 w-full shrink-0 rounded-3xl border bg-card p-4 md:p-5 shadow-sm"><div aria-hidden className="pointer-events-none absolute -top-32 -right-24 -z-10 h-72 w-72 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" /><div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 -z-10 h-72 w-72 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30">
                            <WalletIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Wallet Ledger</h1>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20 border border-blue-500/30">
                                    AEPS ₹{fmt(currentAeps)}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                                    Main ₹{fmt(currentMain)}
                                </span>
                            </div>
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
                                    placeholder="Search UTR, narration, txn type..."
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    className="pl-9 pr-4 py-2 w-full bg-background border rounded-xl text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500"
                                />
                            </div>
                        </div>
                        <div className="contents">
                            <select
                                value={walletFilter}
                                onChange={(e) => { setWalletFilter(e.target.value); setCurrentPage(1); }}
                                className="flex-1 md:flex-none px-3 py-2 bg-background border rounded-xl text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500"
                            >
                                <option value="ALL">All Wallets</option>
                                <option value="AEPS">AEPS Wallet</option>
                                <option value="MAIN">Main Wallet</option>
                            </select>
                            <select
                                value={txnTypeFilter}
                                onChange={(e) => { setTxnTypeFilter(e.target.value); setCurrentPage(1); }}
                                className="flex-1 md:flex-none px-3 py-2 bg-background border rounded-xl text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500"
                            >
                                <option value="ALL">All Txn Types</option>
                                {txnTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                                className="flex-1 md:flex-none px-3 py-2 bg-background border rounded-xl text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500"
                            >
                                <option value="ALL">All Types</option>
                                <option value="credit">Credit</option>
                                <option value="debit">Debit</option>
                                <option value="transfer">Transfer</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                                className="flex-1 md:flex-none px-3 py-2 bg-background border rounded-xl text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500"
                            />
                            <span className="text-muted-foreground">to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                                className="flex-1 md:flex-none px-3 py-2 bg-background border rounded-xl text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-16 text-center">SNO</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[130px]">UTR No</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-center min-w-[70px]">Wallet</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right min-w-[90px]">Opening</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right min-w-[90px]">Amount</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right min-w-[90px]">Commission</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right min-w-[70px]">TDS</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right min-w-[70px]">GST</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-right min-w-[90px]">Closing</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-center min-w-[70px]">Type</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[220px]">Narration</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[120px]">Txn Type</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 min-w-[130px]">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={13} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                                <span>Loading wallet ledger...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={13} className="h-64 text-center text-muted-foreground">
                                            {message || "No ledger entries found."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRows.map((r, idx) => {
                                        const serialNumber = ((currentPage - 1) * itemsPerPage) + idx + 1;
                                        const isCredit = r.TYPE === 'credit';
                                        const isTransfer = r.TYPE === 'transfer';
                                        return (
                                            <TableRow key={`${r.UTR}-${idx}`} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                                <TableCell className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">{serialNumber}</TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-sm font-mono text-foreground/80 truncate block max-w-[130px]">{r.UTR || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold uppercase tracking-wider border ${getWalletColor(r.WALLET)}`}>
                                                        {r.WALLET || "Main"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm font-medium text-right px-4 py-2 text-foreground/80">{fmt(r.OPENING)}</TableCell>
                                                <TableCell className={`text-sm font-bold text-right px-4 py-2 ${isCredit ? 'text-emerald-500' : isTransfer ? 'text-sky-500' : 'text-rose-500'}`}>{isCredit ? '+' : isTransfer ? '' : '-'} {fmt(r.AMOUNT)}</TableCell>
                                                <TableCell className="text-sm font-medium text-right px-4 py-2 text-emerald-600">{r.COMMISSION ? fmt(r.COMMISSION) : '-'}</TableCell>
                                                <TableCell className="text-sm font-medium text-right px-4 py-2 text-rose-500">{r.TDS ? fmt(r.TDS) : '-'}</TableCell>
                                                <TableCell className="text-sm font-medium text-right px-4 py-2 text-rose-500">{r.GST ? fmt(r.GST) : '-'}</TableCell>
                                                <TableCell className="text-sm font-bold text-right px-4 py-2 text-foreground">{fmt(r.CLOSING)}</TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold uppercase tracking-wider border ${isCredit ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20 border-emerald-500/30' : isTransfer ? 'bg-sky-500/10 text-sky-500 border-sky-500/30' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20 border-rose-500/30'
                                                        }`}>
                                                        {r.TYPE}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs text-foreground/80 block line-clamp-2 max-w-[220px]">{r.NARRATION || "-"}</span>
                                                    {isFailed(r) && r.REASON && (
                                                        <span className="text-[11px] text-rose-500 block line-clamp-2 max-w-[220px]">{r.REASON}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold uppercase tracking-wider border ${getTxnTypeColor(r.TXNTYPE)}`}>
                                                        {r.TXNTYPE || "N/A"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs text-foreground/80">{r.DATE ? new Date(r.DATE).toLocaleString() : "N/A"}</span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Summary Footer */}
                    {!loading && filteredRows.length > 0 && (
                        <div className="p-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/30">
                            <div className="flex items-center justify-between px-3 py-2 bg-card rounded-lg border border-border/50">
                                <span className="text-[11px] text-muted-foreground font-medium">Net Amount</span>
                                <span className={`text-sm font-bold ${totals.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>₹ {totals.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 bg-card rounded-lg border border-border/50">
                                <span className="text-[11px] text-muted-foreground font-medium">Commission</span>
                                <span className="text-sm font-bold text-emerald-600">₹ {totals.commission.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 bg-card rounded-lg border border-border/50">
                                <span className="text-[11px] text-muted-foreground font-medium">TDS</span>
                                <span className="text-sm font-bold text-rose-600">₹ {totals.tds.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 bg-card rounded-lg border border-border/50">
                                <span className="text-[11px] text-muted-foreground font-medium">GST (18%)</span>
                                <span className="text-sm font-bold text-rose-600">₹ {totals.gst.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Pagination Footer */}
                    {!loading && filteredRows.length > 0 && (
                        <div className="p-3 border-t flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
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
                                    className="p-1.5 border rounded-lg text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
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
                                                className={`w-7 h-7 rounded text-xs font-medium flex items-center justify-center transition-colors ${currentPage === pageNum
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

export default WalletLedger;
