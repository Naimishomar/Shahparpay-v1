import { useRef } from "react"
import html2canvas from "html2canvas-pro"
import { jsPDF } from "jspdf"
import { Download, Printer, X } from "lucide-react"
import { toast } from "sonner"
import logo from "../assets/logo.png"

/** Why the gateway ended the transaction the way it did. */
export const reasonOf = (tx: any) =>
    tx?.metadata?.gatewayMessage || tx?.metadata?.apiMessage || tx?.metadata?.message || tx?.metadata?.note || "";

/** Only the last four digits may be displayed back at an outlet. */
const maskAadhaar = (v: any) => {
    const digits = String(v ?? "").replace(/\D/g, "");
    return digits.length >= 4 ? `XXXX-XXXX-${digits.slice(-4)}` : "";
};

/** camelCase / snake_case key to a readable label. */
const labelOf = (key: string) =>
    key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/** Metadata already shown above, or never shown to the outlet. */
const HIDDEN = new Set([
    "name", "customerName", "mobile", "bankName", "rrn", "bankRRN", "utr", "orderId", "apiProvider",
    "aadhaar", "aadhar", "aadhaarLast4", "bankBalance", "charges",
    "gatewayMessage", "apiMessage", "message", "note",
    "latitude", "longitude", "qrImageUrl", "paymentUrl",
]);

const statusTone = (s: string) =>
    s === "SUCCESS" ? "text-emerald-600" : /FAIL|REJECT/i.test(s) ? "text-rose-600" : "text-amber-600";

/** Full detail of one wallet transaction, shared by every report that lists them. */
const TransactionDetailModal = ({ tx, onClose }: { tx: any; onClose: () => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    if (!tx) return null;

    const m = tx.metadata || {};
    const id = tx.transactionId || tx._id;
    const status = tx.status || "UNKNOWN";
    const aadhaar = maskAadhaar(m.aadhaar || m.aadhar) || (m.aadhaarLast4 ? `XXXX-XXXX-${m.aadhaarLast4}` : "");
    const rows: [string, any][] = [
        ["Txn ID", id],
        ["Order ID", m.orderId],
        ["RRN", m.rrn || m.bankRRN || m.utr],
        ["Provider", m.apiProvider],
        ["Type", tx.type?.replace(/_/g, " ")],
        ["Date & Time", new Date(tx.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
        ["Customer", m.name || m.customerName],
        ["Mobile", m.mobile],
        ["Aadhaar", aadhaar],
        ["Bank", m.bankName],
        ["Amount", `₹ ${tx.amount || 0}`],
        ["Charges", m.charges != null ? `₹ ${m.charges}` : null],
        ["Bank Balance", m.bankBalance != null ? `₹ ${m.bankBalance}` : null],
        ["Transaction Status", status],
        ...Object.entries(m)
            .filter(([k, v]) => !HIDDEN.has(k) && v !== "" && v != null && typeof v !== "object")
            .map(([k, v]) => [labelOf(k), String(v)] as [string, any]),
    ];
    const shown = rows.filter(([, v]) => v != null && v !== "");

    const pdf = async () => {
        const canvas = await html2canvas(ref.current!, { scale: 2, backgroundColor: "#ffffff" });
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const w = doc.internal.pageSize.getWidth() - 20;
        doc.addImage(canvas.toDataURL("image/png"), "PNG", 10, 10, w, (canvas.height * w) / canvas.width);
        return doc;
    };
    const download = async () => {
        try { (await pdf()).save(`Receipt_${id}.pdf`); } catch { toast.error("Could not download the receipt."); }
    };
    const print = async () => {
        try {
            const doc = await pdf();
            doc.autoPrint();
            window.open(doc.output("bloburl"), "_blank");
        } catch { toast.error("Could not print the receipt."); }
    };

    return (
        <div role="dialog" aria-modal="true" aria-label="Transaction details" onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between btn-primary px-5 py-3">
                    <h3 className="text-lg font-bold">Transaction Details</h3>
                    <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <div ref={ref} className="bg-white p-6 text-slate-800">
                        <img src={logo} alt="Shahparpay" className="mx-auto mb-5 h-12 w-auto object-contain" />
                        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                            {shown.map(([k, v]) => (
                                <div key={k}>
                                    <dt className="text-sm font-semibold text-slate-900">{k}</dt>
                                    <dd className={`break-all text-sm ${k === "Transaction Status" ? `font-bold ${statusTone(status)}` : "text-slate-600"}`}>{v}</dd>
                                </div>
                            ))}
                        </dl>
                        {Array.isArray(m.ministatement) && m.ministatement.length > 0 && (
                            <div className="mt-5">
                                <p className="mb-2 text-sm font-semibold text-slate-900">Mini Statement</p>
                                <table className="w-full text-left text-xs">
                                    <tbody className="divide-y divide-slate-100">
                                        {m.ministatement.map((row: any, i: number) => (
                                            <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="p-1.5">{String(v ?? "")}</td>)}</tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {reasonOf(tx) && (
                            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm font-semibold text-slate-900">Message</p>
                                <p className="text-sm text-slate-600">{reasonOf(tx)}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-3">
                    <button onClick={print} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"><Printer className="h-4 w-4" /> Print</button>
                    <button onClick={download} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"><Download className="h-4 w-4" /> Download PDF</button>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
