import { useEffect, useState, type ComponentType } from "react"
import axios from "axios"
import {
    BarChart3, Building2, FileText, Fingerprint, IdCard, Receipt, Send, Smartphone, Wallet,
    ArrowDownLeft, ArrowUpRight, QrCode, Banknote, type LucideProps,
} from "lucide-react"
import TransactionDetailModal, { reasonOf } from "../components/TransactionDetailModal"
import { useAuth } from "../context/AuthContext"
import {
    DayList, Seg, Figures, Pager, PeriodPicker, ReportHeader, SearchBox, StatusPill, Toolbar,
    dateTimeOf, downloadCsv, downloadPdf, money, plain, rangeOf, timeOf, useDebounced,
    type Period, type Range,
} from "../components/reports/kit"

/*
 * Every transaction report on one screen: the kind decides which transaction
 * types it lists and how a row names its customer. Filtering, search and the
 * period totals happen on the server (paged mode of /api/dashboard/recent-transactions).
 */

type Icon = ComponentType<LucideProps>;
type Tx = any;

export type ReportKind = "all" | "aeps" | "dmt" | "payout" | "upi" | "upiCashWithdrawal" | "pan" | "itr" | "recharge" | "bbps" | "collect";

const m = (tx: Tx) => tx.metadata || {};
const last4 = (v: unknown) => { const d = String(v ?? "").replace(/\D/g, ""); return d.length >= 4 ? d.slice(-4) : ""; };
const join = (...parts: unknown[]) => parts.filter((p) => p !== undefined && p !== null && String(p).trim() !== "").join(" · ");

/** A transaction's own name, whatever report it is in. */
const LABEL: Record<string, string> = {
    AEPS_WITHDRAWAL: "AEPS Withdrawal", AEPS_BALANCE_ENQUIRY: "Balance Enquiry", AEPS_MINI_STATEMENT: "Mini Statement",
    AADHAAR_PAY: "Aadhaar Pay", AEPS_DEPOSIT: "Cash Deposit", AEPS_DEPOSIT_REFUND: "Cash Deposit Refund", MATM: "Micro ATM Withdrawal",
    UPI_CASH_WITHDRAWAL: "UPI Cash Withdrawal", WALLET_TOPUP: "UPI Wallet Top-up", PG_COLLECTION: "Payment Collected",
    DMT: "Money Transfer", AEPS_SETTLEMENT: "Settlement to Bank", DIRECT_PAYOUT: "Direct Payout", DIRECT_PAYOUT_REFUND: "Payout Refund",
    RECHARGE: "Recharge", BILL_PAYMENT: "Bill Payment", PAN_CARD: "PAN Card", STD_PAN_CARD: "PAN Card", PAN_SERVICE: "PAN Service", PAN_COUPON: "PAN Coupon",
    ITR: "TaxSuite Filing", GST_REGISTRATION: "GST Registration", LEAD: "Lead Commission", SIGNUP_FEE: "Onboarding Credit",
    DAILY_AUTH_CHARGE: "Daily AEPS Login", MERCHANT_ONBOARDING_CHARGE: "Onboarding Charge", ACCOUNT_VERIFICATION: "Account Verification",
    AEPSTOMAIN: "Trade → Utility Transfer", QRTO_MAIN: "QR Wallet Transfer", FUND_REQUEST: "Fund Request", FUND_TRANSFER: "Fund Transfer",
};
const labelOf = (tx: Tx) => LABEL[tx.type] || String(tx.type || "Transaction").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** Who or what the transaction was for, in one line. */
const detailOf = (tx: Tx) => {
    const d = m(tx);
    switch (tx.type) {
        case "AEPS_WITHDRAWAL": case "AEPS_BALANCE_ENQUIRY": case "AEPS_MINI_STATEMENT": case "AADHAAR_PAY": case "AEPS_DEPOSIT": {
            const a = last4(d.aadhaar || d.aadhar) || d.aadhaarLast4;
            return join(d.name || d.customerName, a && `Aadhaar ••${a}`, d.bankName);
        }
        case "MATM": return join(d.name || d.customerName, d.bankName, d.cardNumber && `Card ••${last4(d.cardNumber)}`);
        case "DMT": return join(d.beneficiaryName || d.benename || d.name, d.beneficiaryAccount && `A/C ••${last4(d.beneficiaryAccount)}`, d.bankName, d.transferMode);
        case "AEPS_SETTLEMENT": case "DIRECT_PAYOUT": {
            const ac = d.bankAccount || d.accountNumber;
            return join(d.beneficiaryName, d.bankName, ac && `A/C ••${last4(ac)}`, d.mode);
        }
        case "UPI_CASH_WITHDRAWAL": return join(d.payerName || d.name, d.mobile || d.customerMobile);
        case "WALLET_TOPUP": return join(d.payerName || d.payerVpa, d.utr && `UTR ${d.utr}`);
        case "PG_COLLECTION": return join(d.payerName, d.payerMobile, d.collectionChannel === "QR" ? "By QR" : "By link");
        case "RECHARGE": return join(d.operatorName || d.operator, d.caNumber || d.mobile);
        case "BILL_PAYMENT": return join(d.mode, d.operatorName || d.operator, d.caNumber);
        case "PAN_CARD": case "STD_PAN_CARD": case "PAN_SERVICE": case "PAN_COUPON":
            return join(d.name || d.shop_name || d.customerName, d.application_number ? `App ${d.application_number}` : d.psa_id && `PSA ${d.psa_id}`);
        case "ITR": return join(d.applicant_name || d.name, d.pan_number && `PAN ${d.pan_number}`, d.application_id && `App #${d.application_id}`);
        default: return join(d.name || d.customerName, d.mobile);
    }
};

/** Money the wallet received; everything else that moves money is paid out of it. */
const INFLOW = new Set(["AEPS_WITHDRAWAL", "AADHAAR_PAY", "MATM", "UPI_CASH_WITHDRAWAL", "WALLET_TOPUP", "PG_COLLECTION", "FUND_REQUEST", "SIGNUP_FEE", "LEAD", "DIRECT_PAYOUT_REFUND", "AEPS_DEPOSIT_REFUND"]);
/** Only a successful transaction moved money; a failed or pending one did not (and a refund gave it back). */
const directionOf = (tx: Tx): "in" | "out" | "none" =>
    tx.status !== "SUCCESS" || !Number(tx.amount) ? "none" : INFLOW.has(tx.type) ? "in" : "out";

const statusOf = (tx: Tx) => {
    const s = String(m(tx).eseva_status || tx.status || "PENDING").toUpperCase();
    // An AEPS withdrawal that did not succeed never reached the wallet; say so.
    if (tx.type === "AEPS_WITHDRAWAL" && s !== "SUCCESS") return { s, label: s === "PROCESSING" || s === "PENDING" ? "Pending · not credited" : "Declined · not credited" };
    return { s, label: undefined };
};

const ICON: Record<string, Icon> = {
    AEPS_WITHDRAWAL: Fingerprint, AEPS_BALANCE_ENQUIRY: Fingerprint, AEPS_MINI_STATEMENT: Fingerprint, AADHAAR_PAY: Fingerprint, AEPS_DEPOSIT: Fingerprint,
    MATM: Banknote, DMT: Send, AEPS_SETTLEMENT: Building2, DIRECT_PAYOUT: Building2, UPI_CASH_WITHDRAWAL: Wallet, WALLET_TOPUP: Wallet,
    PG_COLLECTION: QrCode, ITR: FileText, RECHARGE: Smartphone, BILL_PAYMENT: Receipt, PAN_CARD: IdCard, STD_PAN_CARD: IdCard, PAN_SERVICE: IdCard, PAN_COUPON: IdCard,
};

const KINDS: Record<ReportKind, { type: string; title: string; description: string; icon: Icon; search: string; commission: boolean }> = {
    all: { type: "", title: "All Transactions", description: "Every transaction from every service, newest first.", icon: BarChart3, search: "Search ID, name, mobile, number", commission: true },
    aeps: { type: "AEPS_WITHDRAWAL,AEPS_BALANCE_ENQUIRY,AEPS_MINI_STATEMENT,AADHAAR_PAY,AEPS_DEPOSIT", title: "AEPS Reports", description: "Aadhaar withdrawals, balance enquiries, mini statements and cash deposits.", icon: Fingerprint, search: "Search ID, customer, mobile", commission: true },
    dmt: { type: "DMT", title: "DMT Reports", description: "Money transfers to bank accounts, with the fee charged on each.", icon: Send, search: "Search ID, beneficiary, account", commission: false },
    payout: { type: "AEPS_SETTLEMENT,DIRECT_PAYOUT", title: "Payout Reports", description: "Money settled from your Trade Wallet to your bank account.", icon: Building2, search: "Search ID, bank, account", commission: false },
    upi: { type: "WALLET_TOPUP", title: "UPI Reports", description: "Money added to your wallet by UPI.", icon: Wallet, search: "Search ID, UTR", commission: false },
    upiCashWithdrawal: { type: "UPI_CASH_WITHDRAWAL", title: "UPI Cash Withdrawal Reports", description: "Cash given to customers who paid you by UPI, and the commission on each.", icon: Wallet, search: "Search ID, customer, mobile", commission: true },
    pan: { type: "PAN_CARD,STD_PAN_CARD,PAN_SERVICE,PAN_COUPON", title: "PAN Reports", description: "PAN card applications and coupons, with their status.", icon: IdCard, search: "Search ID, applicant, application no.", commission: true },
    itr: { type: "ITR", title: "ITR Reports", description: "Income tax returns filed through TaxSuite, with their status and fee.", icon: FileText, search: "Search ID, applicant, PAN", commission: false },
    recharge: { type: "RECHARGE", title: "Recharge Reports", description: "Mobile prepaid and DTH recharges, with the commission on each.", icon: Smartphone, search: "Search ID, number, operator", commission: true },
    bbps: { type: "BILL_PAYMENT", title: "BBPS Reports", description: "Bill payments, with their status and commission.", icon: Receipt, search: "Search ID, bill number, biller", commission: true },
    collect: { type: "PG_COLLECTION", title: "Collect Payment Reports", description: "Payments customers made to you by link or QR.", icon: QrCode, search: "Search ID, customer, mobile", commission: false },
};

type Summary = { count: number; volume: number; success: number; failed: number; commission?: number };
const PAGE_SIZE = 25;
const API = import.meta.env.VITE_BACKEND_URL;

const TxnReport = ({ kind }: { kind: ReportKind }) => {
    const cfg = KINDS[kind];
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const [rows, setRows] = useState<Tx[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("ALL");
    const [period, setPeriod] = useState<Period>("30");
    const [custom, setCustom] = useState<Range>({ start: "", end: "" });
    const [search, setSearch] = useState("");
    const term = useDebounced(search.trim());
    const [selected, setSelected] = useState<Tx>(null);
    const [exporting, setExporting] = useState(false);

    const range = rangeOf(period, custom);

    const paramsFor = (extra: Record<string, string>) => {
        const p = new URLSearchParams(extra);
        if (cfg.type) p.set("type", cfg.type);
        if (range.start && range.end) { p.set("startDate", range.start); p.set("endDate", range.end); }
        return p;
    };

    // Any filter change starts again from page 1.
    useEffect(() => { setPage(1); }, [kind, status, term, range.start, range.end]);

    useEffect(() => {
        if (period === "custom" && !(custom.start && custom.end)) return;
        let live = true;
        setLoading(true);
        const p = paramsFor({ page: String(page), limit: String(PAGE_SIZE) });
        if (status !== "ALL") p.set("status", status);
        if (term) p.set("search", term);
        axios.get(`${API}/api/dashboard/recent-transactions?${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
            .then((res) => {
                if (!live) return;
                setRows(res.data.data || []);
                setHasMore(!!res.data.hasMore);
                if (res.data.summary) setSummary(res.data.summary);
                setError("");
            })
            .catch(() => { if (live) { setRows([]); setError("The report could not be loaded. Check your connection and try again."); } })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, page, status, term, range.start, range.end, period, custom.start, custom.end]);

    const HEAD = ["Date", "Transaction ID", "Service", "Details", ...(isAdmin ? ["Outlet"] : []), "Amount", "Commission", "Status", "Reason"];

    /** Exports take every matching row, not just the page on screen. */
    const exportAll = async (to: "csv" | "pdf") => {
        setExporting(true);
        try {
            const p = paramsFor({ page: "1", limit: "100" });
            if (status !== "ALL") p.set("status", status);
            if (term) p.set("search", term);
            const all: Tx[] = [];
            // Paged by 100, capped at 2,000 rows so an export never runs away.
            for (let n = 1; n <= 20; n++) {
                p.set("page", String(n));
                const res = await axios.get(`${API}/api/dashboard/recent-transactions?${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
                all.push(...(res.data.data || []));
                if (!res.data.hasMore) break;
            }
            const body = all.map((tx) => [
                dateTimeOf(tx.createdAt), tx.transactionId || tx._id, labelOf(tx), detailOf(tx),
                ...(isAdmin ? [tx.userId?.businessName || tx.userId?.name || ""] : []),
                plain(tx.amount), plain(tx.commissions?.retailerEarned), statusOf(tx).label || statusOf(tx).s, reasonOf(tx),
            ]);
            const periodText = range.start ? `${range.start} to ${range.end}` : "All time";
            if (to === "csv") downloadCsv(cfg.title.replace(/\s+/g, ""), HEAD, body);
            else downloadPdf(cfg.title, `${user?.name || ""} · ${periodText} · ${body.length} transactions`, HEAD, body);
        } finally {
            setExporting(false);
        }
    };

    const figures = [
        { label: "Transactions", value: (summary?.count ?? 0).toLocaleString("en-IN"), hint: summary?.failed ? `${summary.failed.toLocaleString("en-IN")} failed` : "In this period" },
        { label: "Successful amount", value: money(summary?.success), hint: `Of ${money(summary?.volume)} attempted` },
        ...(cfg.commission ? [{ label: "Commission earned", value: money(summary?.commission), hint: "Gross, on successful transactions", tone: "in" as const }] : []),
    ];

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
            <TransactionDetailModal tx={selected} onClose={() => setSelected(null)} />
            <ReportHeader
                icon={<cfg.icon className="h-6 w-6" />}
                title={cfg.title}
                description={cfg.description}
                onCsv={() => exportAll("csv")}
                onPdf={() => exportAll("pdf")}
                exporting={exporting}
            />

            <Figures items={figures} loading={!summary} />

            <Toolbar>
                <div className="flex flex-wrap items-center gap-2">
                    <SearchBox value={search} onChange={setSearch} placeholder={cfg.search} />
                    <Seg label="Status" value={status} onChange={setStatus} options={[["ALL", "All"], ["SUCCESS", "Success"], ["PENDING", "Pending"], ["FAILED", "Failed"], ["REFUNDED", "Refunded"]] as const} />
                </div>
                <PeriodPicker period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom} />
            </Toolbar>

            <DayList
                rows={rows}
                loading={loading && rows.length === 0}
                empty={error || (term || status !== "ALL" ? "Nothing matches these filters." : "No transactions in this period.")}
                dateOf={(tx) => tx.createdAt}
                keyOf={(tx, i) => String(tx._id || tx.transactionId || i)}
                render={(tx) => <Line tx={tx} showOutlet={isAdmin} onOpen={() => setSelected(tx)} />}
            />

            <Pager page={page} onPage={setPage} shown={rows.length} total={summary?.count} hasMore={hasMore} pageSize={PAGE_SIZE} />
        </div>
    );
};

/** One transaction: what, for whom, when, and what it did to the wallet. */
const Line = ({ tx, showOutlet, onOpen }: { tx: Tx; showOutlet: boolean; onOpen: () => void }) => {
    const dir = directionOf(tx);
    const Icon = ICON[tx.type] || (dir === "in" ? ArrowDownLeft : ArrowUpRight);
    const tile = dir === "in" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-foreground/70";
    const { s, label } = statusOf(tx);
    const commission = Number(tx.commissions?.retailerEarned) || 0;
    const reason = /FAIL|REJECT|DECLIN/.test(s) ? reasonOf(tx) : "";
    const bankBalance = Number.isFinite(Number(m(tx).bankBalance)) && m(tx).bankBalance !== null && m(tx).bankBalance !== "" ? Number(m(tx).bankBalance) : null;

    return (
        <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
            <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tile}`}>
                <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{labelOf(tx)}</span>
                    <StatusPill status={s} label={label} />
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{detailOf(tx) || "—"}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">{timeOf(tx.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono">{tx.transactionId || tx._id}</span>
                    {showOutlet && tx.userId && <><span aria-hidden>·</span><span>{tx.userId.businessName || tx.userId.name}</span></>}
                    {bankBalance !== null && <><span aria-hidden>·</span><span className="tabular-nums">Bank bal {money(bankBalance)}</span></>}
                </span>
                {reason && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{reason}</span>}
            </span>
            <span className="shrink-0 text-right">
                <span className={`block text-[15px] font-semibold tabular-nums ${dir === "in" ? "text-emerald-600 dark:text-emerald-400" : dir === "out" ? "text-foreground" : "text-muted-foreground"}`}>
                    {dir === "in" ? "+" : dir === "out" ? "−" : ""}{money(tx.amount)}
                </span>
                {commission > 0 && tx.status === "SUCCESS" && (
                    <span className="mt-0.5 block text-xs text-emerald-600 tabular-nums dark:text-emerald-400">+{money(commission)} commission</span>
                )}
            </span>
        </button>
    );
};

export default TxnReport;
