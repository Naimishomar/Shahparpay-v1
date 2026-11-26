import { useEffect, useMemo, useState, type ReactNode } from "react"
import axios from "axios"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BookOpen, ChevronDown } from "lucide-react"
import { Segmented } from "../components/distributor/ui"
import {
    DayList, FIELD, Figures, PeriodPicker, ReportHeader, SearchBox, StatusPill, Toolbar,
    dateTimeOf, downloadCsv, downloadPdf, money, plain, rangeOf, timeOf,
    type Figure, type Period, type Range,
} from "../components/reports/kit"

/*
 * The wallet ledger, read like a bank passbook: one line per movement, grouped
 * by day, each saying what happened, how much the wallet actually changed by
 * (commission and TDS included) and the balance it left. Opening + money in −
 * money out = closing, shown above the list for one wallet at a time.
 */

interface LedgerRow {
    UTR: string;
    WALLET: string;
    OPENING: number;
    AMOUNT: number;
    COMMISSION: number;
    TDS: number;
    GST: number;
    CLOSING: number;
    TYPE: "credit" | "debit" | "transfer";
    NARRATION: string;
    TXNTYPE: string;
    DATE: string;
    remarks?: string;
    REASON?: string;
}

type WalletKey = "ALL" | "AEPS" | "MAIN";
type Direction = "all" | "in" | "out";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
/** What the row did to the balance it shows: closing minus opening. */
const changeOf = (r: LedgerRow) => r2(num(r.CLOSING) - num(r.OPENING));
const isFailed = (r: LedgerRow) => /FAIL|REJECT/i.test(r.remarks || "");
const walletName = (w: string) => (w || "Utility").replace(/→/g, " → ");

const PAGE = 40;

const WalletLedger = () => {
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [balances, setBalances] = useState({ main: 0, aeps: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [wallet, setWallet] = useState<WalletKey>("ALL");
    const [period, setPeriod] = useState<Period>("30");
    const [custom, setCustom] = useState<Range>({ start: "", end: "" });
    const [search, setSearch] = useState("");
    const [direction, setDirection] = useState<Direction>("all");
    const [txnType, setTxnType] = useState("ALL");
    const [shown, setShown] = useState(PAGE);
    const [open, setOpen] = useState<string | null>(null);

    const range = rangeOf(period, custom);

    useEffect(() => {
        if (period === "custom" && !(custom.start && custom.end)) return;
        let live = true;
        setLoading(true);
        const params = new URLSearchParams();
        if (wallet !== "ALL") params.set("wallet", wallet);
        if (range.start && range.end) { params.set("startDate", range.start); params.set("endDate", range.end); }
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/wallet/ledger?${params}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        })
            .then((res) => {
                if (!live || !res.data.success) return;
                setRows(res.data.data || []);
                setBalances({ main: num(res.data.currentMain), aeps: num(res.data.currentAeps) });
                setError("");
            })
            .catch(() => { if (live) { setRows([]); setError("The ledger could not be loaded. Check your connection and try again."); } })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [wallet, range.start, range.end, period, custom.start, custom.end]);

    // A new filter starts the list from the top.
    useEffect(() => { setShown(PAGE); setOpen(null); }, [wallet, range.start, range.end, search, direction, txnType]);

    const txnTypes = useMemo(() => [...new Set(rows.map((r) => r.TXNTYPE).filter(Boolean))].sort(), [rows]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return rows.filter((r) => {
            const c = changeOf(r);
            if (direction === "in" && !(c > 0)) return false;
            if (direction === "out" && !(c < 0)) return false;
            if (txnType !== "ALL" && r.TXNTYPE !== txnType) return false;
            return !term || [r.UTR, r.TXNTYPE, r.NARRATION, r.REASON, r.WALLET].join(" ").toLowerCase().includes(term);
        });
    }, [rows, search, direction, txnType]);

    // The period's statement comes from every row in the period, not the searched subset.
    const figures: Figure[] = useMemo(() => {
        let moneyIn = 0, moneyOut = 0, earned = 0;
        for (const r of rows) {
            const c = changeOf(r);
            if (c > 0) moneyIn += c; else moneyOut -= c;
            earned += num(r.COMMISSION) - num(r.TDS);
        }
        const inHint = earned > 0 ? `Includes ${money(earned)} commission after TDS` : "Credits to the wallet";
        if (wallet === "ALL") {
            return [
                { label: "Trade Wallet balance", value: money(balances.aeps), hint: "Withdrawals and settlements" },
                { label: "Utility Wallet balance", value: money(balances.main), hint: "Recharge, bills, PAN and other services" },
                { label: "Money in", value: money(moneyIn), hint: inHint, tone: "in" },
                { label: "Money out", value: money(moneyOut), hint: "Debits from the wallet" },
            ];
        }
        // Rows are newest first: the last row opened the period, the first closed it.
        // With no entries the balance is unknown for a past period; only an open-ended one ends today.
        const current = wallet === "AEPS" ? balances.aeps : balances.main;
        const today = new Date().toISOString().slice(0, 10);
        const idle = !range.end || range.end >= today ? money(current) : "—";
        const opening = rows.length ? money(rows[rows.length - 1].OPENING) : idle;
        const closing = rows.length ? money(rows[0].CLOSING) : idle;
        return [
            { label: "Opening balance", value: opening, hint: range.start ? `On ${range.start}` : "Before the first entry" },
            { label: "Money in", value: money(moneyIn), hint: inHint, tone: "in" },
            { label: "Money out", value: money(moneyOut), hint: "Debits from the wallet" },
            { label: "Closing balance", value: closing, hint: "Opening + in − out" },
        ];
    }, [rows, wallet, balances, range.start, range.end]);

    const exportRows = () => filtered.map((r) => [
        dateTimeOf(r.DATE), r.UTR, walletName(r.WALLET), r.TXNTYPE, r.NARRATION, r.remarks || "", r.REASON || "",
        plain(r.OPENING), plain(r.AMOUNT), plain(r.COMMISSION), plain(r.TDS), plain(r.GST), plain(changeOf(r)), plain(r.CLOSING),
    ]);
    const HEAD = ["Date", "Reference", "Wallet", "Transaction", "Details", "Status", "Reason", "Opening", "Amount", "Commission", "TDS", "GST", "Change", "Closing"];
    const periodText = range.start ? `${range.start} to ${range.end}` : "All time";
    const walletText = wallet === "ALL" ? "All wallets" : wallet === "AEPS" ? "Trade Wallet" : "Utility Wallet";

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
            <ReportHeader
                icon={<BookOpen className="h-6 w-6" />}
                title="Wallet Ledger"
                description="Every rupee in and out of your Trade and Utility wallets, with the balance after each entry."
                onCsv={() => downloadCsv("WalletLedger", HEAD, exportRows())}
                onPdf={() => downloadPdf("Wallet Ledger", `${walletText} · ${periodText}`, HEAD, exportRows())}
            />

            <Figures items={figures} loading={loading && rows.length === 0} />

            <Toolbar>
                <div className="flex flex-wrap items-center gap-2">
                    <Segmented label="Wallet" value={wallet} onChange={setWallet} options={[["ALL", "All wallets"], ["AEPS", "Trade Wallet"], ["MAIN", "Utility Wallet"]] as const} />
                    <Segmented label="Direction" value={direction} onChange={setDirection} options={[["all", "All"], ["in", "Money in"], ["out", "Money out"]] as const} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <SearchBox value={search} onChange={setSearch} placeholder="Search reference, details, service" />
                    <select aria-label="Service" value={txnType} onChange={(e) => setTxnType(e.target.value)} className={FIELD}>
                        <option value="ALL">All services</option>
                        {txnTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <PeriodPicker period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom} />
                </div>
            </Toolbar>

            <DayList
                rows={filtered.slice(0, shown)}
                loading={loading && rows.length === 0}
                empty={error || "No entries in this period."}
                dateOf={(r) => r.DATE}
                keyOf={(r, i) => `${r.UTR}-${r.DATE}-${i}`}
                render={(r) => {
                    const key = `${r.UTR}-${r.DATE}`;
                    return <Entry row={r} open={open === key} onToggle={() => setOpen(open === key ? null : key)} />;
                }}
            />

            {filtered.length > shown && (
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mx-auto flex h-9 items-center gap-1.5 rounded-xl border bg-background px-4 text-sm font-medium shadow-sm hover:bg-black/5 dark:hover:bg-white/5">
                    Show {Math.min(PAGE, filtered.length - shown)} more <span className="text-muted-foreground">of {filtered.length - shown}</span>
                </button>
            )}
        </div>
    );
};

/** One ledger line, and its full breakdown when opened. */
const Entry = ({ row: r, open, onToggle }: { row: LedgerRow; open: boolean; onToggle: () => void }) => {
    const change = changeOf(r);
    const dir = change > 0 ? "in" : change < 0 ? "out" : "none";
    const transfer = r.TYPE === "transfer";
    const Icon = transfer ? ArrowLeftRight : dir === "in" ? ArrowDownLeft : ArrowUpRight;
    const tile = transfer
        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : dir === "in" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-foreground/70";
    const commission = num(r.COMMISSION);
    const status = String(r.remarks || "SUCCESS").toUpperCase();

    return (
        <div>
            <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tile}`}>
                    <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{r.TXNTYPE || "Transaction"}</span>
                        {status !== "SUCCESS" && <StatusPill status={status} />}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{r.NARRATION || "—"}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="tabular-nums">{timeOf(r.DATE)}</span>
                        <span aria-hidden>·</span>
                        <span>{walletName(r.WALLET)} Wallet</span>
                        {commission > 0 && (
                            <>
                                <span aria-hidden>·</span>
                                <span className="tabular-nums">
                                    {money(r.AMOUNT)} <span className="text-emerald-600 dark:text-emerald-400">+ {money(commission)} commission</span>
                                    {num(r.TDS) > 0 && <> − {money(r.TDS)} TDS</>}
                                </span>
                            </>
                        )}
                    </span>
                    {isFailed(r) && r.REASON && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{r.REASON}</span>}
                </span>
                <span className="shrink-0 text-right">
                    <span className={`block text-[15px] font-semibold tabular-nums ${dir === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                        {dir === "in" ? "+" : dir === "out" ? "−" : ""}{money(Math.abs(change))}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">Bal {money(r.CLOSING)}</span>
                </span>
                <ChevronDown aria-hidden className={`mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.45, 0, 0.1, 1] }}
                        className="overflow-hidden"
                    >
                        <dl className="mx-4 mb-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-4 sm:ml-[68px]">
                            <Item label="Balance before" value={money(r.OPENING)} />
                            <Item label="Transaction amount" value={money(r.AMOUNT)} />
                            <Item label="Commission" value={commission ? `+ ${money(commission)}` : "—"} />
                            <Item label="TDS" value={num(r.TDS) ? `− ${money(r.TDS)}` : "—"} />
                            {num(r.GST) > 0 && <Item label="GST" value={money(r.GST)} />}
                            <Item label="Wallet change" value={`${change > 0 ? "+ " : change < 0 ? "− " : ""}${money(Math.abs(change))}`} />
                            <Item label="Balance after" value={money(r.CLOSING)} strong />
                            <Item label="Status" value={<StatusPill status={status} />} />
                            <Item label="Date" value={dateTimeOf(r.DATE)} />
                            <div className="col-span-2">
                                <dt className="text-xs text-muted-foreground">Reference</dt>
                                <dd className="mt-0.5 break-all font-mono text-[13px]">{r.UTR || "—"}</dd>
                            </div>
                        </dl>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Item = ({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) => (
    <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={`mt-0.5 tabular-nums ${strong ? "font-semibold text-foreground" : "text-foreground/90"}`}>{value}</dd>
    </div>
);

export default WalletLedger;
