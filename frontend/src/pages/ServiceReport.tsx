import { useEffect, useMemo, useState } from "react";
import { Download, FileDown, FileText, Loader2, Search } from "lucide-react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "../context/AuthContext";

type ServiceKind = "recharge" | "bbps";

interface ServiceReportProps {
    kind: ServiceKind;
    title: string;
    description: string;
}

const money = (value: unknown) => `₹ ${Number(value || 0).toFixed(2)}`;

const statusClass = (status: string) => {
    if (status === "SUCCESS") return "bg-emerald-500/10 text-emerald-500";
    if (status === "FAILED") return "bg-rose-500/10 text-rose-500";
    if (status === "REFUNDED") return "bg-sky-500/10 text-sky-500";
    return "bg-yellow-500/10 text-yellow-500";
};

const reasonOf = (tx: any) =>
    tx?.metadata?.gatewayMessage || tx?.metadata?.apiMessage || tx?.metadata?.message || "";

const ServiceReport = ({ kind, title, description }: ServiceReportProps) => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("ALL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    type: kind === "recharge" ? "RECHARGE" : "BILL_PAYMENT",
                    limit: "1000",
                });
                if (startDate && endDate) {
                    params.set("startDate", startDate);
                    params.set("endDate", endDate);
                }
                const response = await axios.get(
                    `${import.meta.env.VITE_BACKEND_URL}/api/dashboard/recent-transactions?${params}`,
                    { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
                );
                setTransactions(response.data.success ? response.data.data || [] : []);
            } catch (error) {
                console.error(`Failed to fetch ${kind} report`, error);
                setTransactions([]);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
        setPage(1);
    }, [kind, startDate, endDate]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return transactions.filter((tx) => {
            const searchable = [
                tx.transactionId,
                tx.metadata?.caNumber,
                tx.metadata?.mobile,
                tx.metadata?.operator,
                tx.metadata?.mode,
            ].filter(Boolean).join(" ").toLowerCase();
            return (!term || searchable.includes(term)) && (status === "ALL" || tx.status === status);
        });
    }, [transactions, search, status]);

    const totals = useMemo(() => ({
        amount: filtered.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
        commission: filtered.reduce((sum, tx) => sum + Number(tx.commissions?.retailerEarned || 0), 0),
        success: filtered.filter((tx) => tx.status === "SUCCESS").length,
    }), [filtered]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

    const exportRows = filtered.map((tx, index) => ({
        no: index + 1,
        id: tx.transactionId || tx._id || "N/A",
        date: new Date(tx.createdAt).toLocaleString(),
        service: tx.metadata?.mode || (kind === "recharge" ? "Recharge" : "BBPS"),
        operator: tx.metadata?.operator || "N/A",
        number: tx.metadata?.caNumber || tx.metadata?.mobile || "N/A",
        amount: Number(tx.amount || 0).toFixed(2),
        commission: Number(tx.commissions?.retailerEarned || 0).toFixed(2),
        status: tx.status || "UNKNOWN",
    }));

    const downloadCsv = () => {
        const headers = ["S.No.", "Transaction ID", "Date", "Service", "Operator", "Number", "Amount", "Commission", "Status"];
        const lines = [headers, ...exportRows.map((row) => Object.values(row))].map((row) =>
            row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
        );
        const link = document.createElement("a");
        link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
        link.download = `${kind === "recharge" ? "Recharge" : "BBPS"}Report_${Date.now()}.csv`;
        link.click();
    };

    const downloadPdf = () => {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.text(`${title} - ${user?.name || "Retailer"}`, 14, 15);
        autoTable(doc, {
            startY: 22,
            head: [["S.No.", "Transaction ID", "Date", "Service", "Operator", "Number", "Amount", "Commission", "Status"]],
            body: exportRows.map((row) => Object.values(row)),
        });
        doc.save(`${kind === "recharge" ? "Recharge" : "BBPS"}Report_${Date.now()}.pdf`);
    };

    return (
        <div className="flex-1 w-full flex flex-col p-4 md:p-6 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-5 h-full">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg"><FileText className="w-6 h-6 text-primary" /></div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
                            <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[190px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search ID, number, operator" className="pl-9 pr-3 py-2 w-full bg-card border border-border rounded-lg text-sm" />
                        </div>
                        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 bg-card border border-border rounded-lg text-sm">
                            <option value="ALL">All Status</option>
                            <option value="SUCCESS">Success</option>
                            <option value="PROCESSING">Pending</option>
                            <option value="FAILED">Failed</option>
                            <option value="REFUNDED">Refunded</option>
                        </select>
                        <button onClick={downloadCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium"><Download className="w-4 h-4" /> CSV</button>
                        <button onClick={downloadPdf} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500 text-white text-sm font-medium"><FileDown className="w-4 h-4" /> PDF</button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 bg-card border border-border rounded-lg text-sm" />
                    <span className="text-muted-foreground">to</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 bg-card border border-border rounded-lg text-sm" />
                    <div className="ml-auto flex gap-3 text-sm">
                        <span className="px-3 py-2 rounded-lg bg-card border border-border">Transactions: <b>{filtered.length}</b></span>
                        <span className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Success: <b>{totals.success}</b></span>
                        <span className="px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20">Commission: <b>{money(totals.commission)}</b></span>
                    </div>
                </div>

                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                                <tr className="text-left">
                                    {['S.No.', 'Transaction', 'Date', 'Service', 'Operator / Biller', 'Customer Number', 'Amount', 'Commission', 'Status'].map((heading) => <th key={heading} className="px-4 py-3 font-semibold whitespace-nowrap">{heading}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? <tr><td colSpan={9} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary inline" /></td></tr> : rows.length === 0 ? <tr><td colSpan={9} className="h-64 text-center text-muted-foreground">No {kind} transactions found.</td></tr> : rows.map((tx, index) => (
                                    <tr key={tx._id || tx.transactionId} className="border-t border-border hover:bg-muted/40">
                                        <td className="px-4 py-3 text-muted-foreground">{(page - 1) * pageSize + index + 1}</td>
                                        <td className="px-4 py-3 font-medium">{tx.transactionId || tx._id}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</td>
                                        <td className="px-4 py-3 uppercase">{tx.metadata?.mode || (kind === "recharge" ? "Recharge" : "BBPS")}</td>
                                        <td className="px-4 py-3">{tx.metadata?.operator || "N/A"}</td>
                                        <td className="px-4 py-3">{tx.metadata?.caNumber || tx.metadata?.mobile || "N/A"}</td>
                                        <td className="px-4 py-3 font-semibold">{money(tx.amount)}</td>
                                        <td className="px-4 py-3 text-emerald-500 font-semibold">{money(tx.commissions?.retailerEarned)}</td>
                                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${statusClass(tx.status)}`}>{tx.status || "UNKNOWN"}</span>{reasonOf(tx) && tx.status === "FAILED" && <span className="block text-[11px] text-rose-500 mt-1 max-w-[180px]">{reasonOf(tx)}</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!loading && filtered.length > 0 && <div className="p-3 border-t border-border flex items-center justify-between bg-muted/30">
                        <span className="text-xs text-muted-foreground">Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
                        <div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Previous</button><span className="text-xs">Page {page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Next</button></div>
                    </div>}
                </div>
            </div>
        </div>
    );
};

export default ServiceReport;
