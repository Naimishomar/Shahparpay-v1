import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { toast } from "sonner"
import { ExternalLink, Loader2, RefreshCw, UserPlus } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import {
    DayList, Seg, FIELD, Figures, PeriodPicker, ReportHeader, SearchBox, StatusPill, Toolbar,
    dateTimeOf, downloadCsv, downloadPdf, rangeOf, timeOf,
    type Period, type Range,
} from "../components/reports/kit"

const PRODUCTS: Record<string, string> = { CC: "Credit Card", PL: "Personal Loan", BL: "Business Loan", IL: "Instant Loan", SA: "Savings Account" };

interface Lead {
    _id?: string;
    refid: string;
    name?: string;
    mobile_no?: string;
    email?: string;
    product: string;
    pincode?: string;
    state?: string;
    executive_status?: string;
    url?: string;
    createdAt?: string;
}

/** The bank's word for a lead, folded into three outcomes a retailer acts on. */
const outcomeOf = (l: Lead) => {
    const s = String(l.executive_status || "PENDING").toUpperCase();
    return s === "APPROVED" ? "APPROVED" : s === "REJECTED" || s === "NOT_INTERESTED" ? "REJECTED" : "PENDING";
};

/** Lead links carry their payload as `encdata`, which the bank expects POSTed. */
const openLink = (url: string) => {
    try {
        const u = new URL(url);
        const encdata = u.searchParams.get("encdata");
        if (!encdata) { window.open(url, "_blank", "noopener"); return; }
        const form = document.createElement("form");
        form.method = "POST";
        form.action = url.split("?")[0];
        form.target = "_blank";
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "encdata";
        input.value = encdata;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        form.remove();
    } catch {
        window.open(url, "_blank", "noopener");
    }
};

const LeadGenerationReport = () => {
    const { token } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [outcome, setOutcome] = useState("ALL");
    const [product, setProduct] = useState("ALL");
    const [period, setPeriod] = useState<Period>("all");
    const [custom, setCustom] = useState<Range>({ start: "", end: "" });

    const load = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/lead/history`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setLeads(res.data.data || []);
        } catch {
            toast.error("Could not load your leads.");
        } finally {
            setLoading(false);
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (token) load(); }, [token]);

    const checkStatus = async (refid: string) => {
        setChecking(refid);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/lead/status/${refid}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                toast.success(`Status: ${res.data.data?.executive_status || "Pending"}`);
                await load();
            } else toast.error(res.data.message || "Could not check the status.");
        } catch {
            toast.error("Could not check the status.");
        } finally {
            setChecking(null);
        }
    };

    const range = rangeOf(period, custom);
    const inPeriod = useMemo(() => leads.filter((l) => {
        if (!range.start || !l.createdAt) return true;
        const d = l.createdAt.slice(0, 10);
        return d >= range.start && d <= range.end;
    }), [leads, range.start, range.end]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return inPeriod.filter((l) =>
            (outcome === "ALL" || outcomeOf(l) === outcome) &&
            (product === "ALL" || l.product === product) &&
            (!term || [l.name, l.mobile_no, l.refid, l.email].join(" ").toLowerCase().includes(term)));
    }, [inPeriod, search, outcome, product]);

    const count = (o: string) => inPeriod.filter((l) => outcomeOf(l) === o).length;
    const figures = [
        { label: "Leads submitted", value: inPeriod.length.toLocaleString("en-IN"), hint: "In this period" },
        { label: "Approved", value: count("APPROVED").toLocaleString("en-IN"), hint: "Commission is credited on approval", tone: "in" as const },
        { label: "In progress", value: count("PENDING").toLocaleString("en-IN"), hint: "Use Check status to refresh" },
        { label: "Not approved", value: count("REJECTED").toLocaleString("en-IN"), hint: "Rejected or not interested" },
    ];

    const HEAD = ["Date", "Customer", "Mobile", "Email", "Product", "Ref ID", "Pincode", "State", "Status"];
    const body = () => filtered.map((l) => [dateTimeOf(l.createdAt || ""), l.name || "", l.mobile_no || "", l.email || "", PRODUCTS[l.product] || l.product, l.refid, l.pincode || "", l.state || "", l.executive_status || "PENDING"]);

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
            <ReportHeader
                icon={<UserPlus className="h-6 w-6" />}
                title="Lead Generation Reports"
                description="Customers you referred for cards, loans and accounts, and where each application stands."
                onCsv={() => downloadCsv("LeadReport", HEAD, body())}
                onPdf={() => downloadPdf("Lead Generation Report", `${filtered.length} leads`, HEAD, body())}
            />

            <Figures items={figures} loading={loading} />

            <Toolbar>
                <div className="flex flex-wrap items-center gap-2">
                    <SearchBox value={search} onChange={setSearch} placeholder="Search name, mobile, ref ID" />
                    <Seg label="Status" value={outcome} onChange={setOutcome} options={[["ALL", "All"], ["APPROVED", "Approved"], ["PENDING", "In progress"], ["REJECTED", "Not approved"]] as const} />
                    <select aria-label="Product" value={product} onChange={(e) => setProduct(e.target.value)} className={FIELD}>
                        <option value="ALL">All products</option>
                        {Object.entries(PRODUCTS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                </div>
                <PeriodPicker period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom} />
            </Toolbar>

            <DayList
                rows={filtered}
                loading={loading}
                empty={leads.length ? "Nothing matches these filters." : "You have not submitted any leads yet."}
                dateOf={(l) => l.createdAt || ""}
                keyOf={(l, i) => l._id || l.refid || String(i)}
                render={(l) => (
                    <div className="flex items-start gap-3 px-4 py-3.5">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70">
                            <UserPlus className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">{PRODUCTS[l.product] || l.product}</span>
                                <StatusPill status={outcomeOf(l) === "PENDING" ? "PENDING" : outcomeOf(l)} label={l.executive_status ? l.executive_status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "Pending"} />
                            </div>
                            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{[l.name, l.mobile_no, l.state].filter(Boolean).join(" · ") || "—"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                <span className="tabular-nums">{timeOf(l.createdAt || "")}</span> · <span className="font-mono">{l.refid}</span>
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button type="button" onClick={() => checkStatus(l.refid)} disabled={checking === l.refid} className="flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5">
                                {checking === l.refid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">Check status</span>
                            </button>
                            {l.url && (
                                <button type="button" onClick={() => openLink(l.url!)} className="flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
                                    <ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Open</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            />
        </div>
    );
};

export default LeadGenerationReport;
