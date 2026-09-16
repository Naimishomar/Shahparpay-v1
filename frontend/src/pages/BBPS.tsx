import { useState, useEffect } from "react";
import { Zap, Flame, Shield, CreditCard, Droplet, Smartphone, XCircle, ReceiptText, Car, Wifi, Tv, Building2 } from "lucide-react";
import axios from "axios";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import logo from '../assets/logo.png';
import { toast } from "sonner";

/**
 * The tiles are whatever the provider currently bills for, not a list of our
 * own: a category we invent has no biller registry behind it, and a category
 * they add would be invisible until someone edited this file. Only the look is
 * decided here, matched on the category name with a plain fallback.
 */
const CATEGORY_STYLE: { match: RegExp; icon: any; color: string; border: string }[] = [
    { match: /electric/i, icon: Zap, color: "text-yellow-500", border: "border-yellow-500/20" },
    { match: /fastag/i, icon: Car, color: "text-emerald-500", border: "border-emerald-500/20" },
    { match: /lpg/i, icon: Flame, color: "text-red-500", border: "border-red-500/20" },
    { match: /gas/i, icon: Flame, color: "text-orange-500", border: "border-orange-500/20" },
    { match: /water/i, icon: Droplet, color: "text-cyan-400", border: "border-cyan-400/20" },
    { match: /insur/i, icon: Shield, color: "text-red-400", border: "border-red-400/20" },
    { match: /loan|emi|credit/i, icon: CreditCard, color: "text-blue-500", border: "border-blue-500/20" },
    { match: /broadband|internet|wifi/i, icon: Wifi, color: "text-sky-400", border: "border-sky-400/20" },
    { match: /dth|cable|tv/i, icon: Tv, color: "text-violet-400", border: "border-violet-400/20" },
    { match: /postpaid|mobile|landline/i, icon: Smartphone, color: "text-primary", border: "border-primary/20" },
    { match: /mun[i]?cipal|tax|housing/i, icon: Building2, color: "text-amber-500", border: "border-amber-500/20" },
];

const styleFor = (name: string) =>
    CATEGORY_STYLE.find((s) => s.match.test(name)) ||
    { icon: ReceiptText, color: "text-muted-foreground", border: "border-border" };

const BBPS = () => {
    const [bbpsServices, setBbpsServices] = useState<any[]>([]);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [operators, setOperators] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [operatorId, setOperatorId] = useState("");
    const [consumerNumber, setConsumerNumber] = useState("");
    const [customerMobile, setCustomerMobile] = useState("");
    const [amount, setAmount] = useState("");
    const [pin, setPin] = useState("");
    
    const [fetchedBill, setFetchedBill] = useState<any>(null);
    const [fetchingBill, setFetchingBill] = useState(false);

    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/bill-categories`);
                if (!res.data.success) {
                    toast.error(res.data.message || 'Could not load bill categories');
                    return;
                }
                // `id` is the provider's own category name, verbatim: it is the
                // only string their biller registry answers to, so every later
                // call sends it back unchanged.
                setBbpsServices((res.data.data || []).map((cat: any) => ({
                    id: cat.id || cat.category,
                    name: cat.name || cat.category,
                    label: cat.label || null,
                    providerCategory: cat.providerCategory || cat.category || cat.id,
                    image: cat.image || null,
                    ...styleFor(cat.name || cat.category || ''),
                })));
            } catch (error) {
                console.error("Failed to fetch bill categories", error);
                toast.error('Could not load bill categories');
            }
        };
        fetchCategories();
    }, []);

    const selectedOperator = operators.find(
        (op: any) => String(op.id) === String(operatorId)
    );

    const fetchOperators = async (type: string) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/operators/${encodeURIComponent(type)}`);
            if (!res.data.success) {
                toast.error(res.data.message || 'Could not load billers');
                setOperators([]);
                return;
            }
            setOperators(res.data.data);
            if (!res.data.data?.length) toast.info('No billers are available for this category right now');
        } catch (error: any) {
            console.error("Failed to fetch operators", error);
            toast.error(error.response?.data?.message || 'Could not load billers');
            setOperators([]);
        }
    };

    const handleServiceClick = (service: any) => {
        setSelectedService(service);
        setOperatorId("");
        setConsumerNumber("");
        setCustomerMobile("");
        setAmount("");
        setPin("");
        setFetchedBill(null);
        fetchOperators(service.providerCategory || service.id);
    };

    const handleFetchBill = async () => {
        if (!operatorId || !consumerNumber) {
            toast.error("Please select an operator and enter the consumer number");
            return;
        }

        setFetchingBill(true);
        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/fetch-bill`, {
                operator: operatorId,
                caNumber: consumerNumber,
                type: selectedService?.id,
                category: selectedService?.providerCategory,
                customerMobile: customerMobile || undefined,
            });

            if (response.data.success) {
                setFetchedBill(response.data.data);
                // Pre-fill the amount
                const fetchedAmt = response.data.data.amount || response.data.data.Amount || response.data.data.billAmount;
                if (fetchedAmt) setAmount(fetchedAmt.toString());
            } else {
                toast.error(response.data.message || "Failed to fetch bill details");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error fetching bill");
        } finally {
            setFetchingBill(false);
        }
    };

    const handlePayment = async () => {
        if (!selectedService || !operatorId || !consumerNumber.trim() || !amount || Number(amount) < 10 || pin.length !== 4) {
            toast.error("Please fill all fields");
            return;
        }
        if (selectedOperator?.viewbill === "true" && !fetchedBill) {
            toast.error("Fetch the bill details before making a payment");
            return;
        }

        setLoading(true);
        try {
            const apiType = selectedService.id;
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/do-recharge`, {
                type: apiType,
                number: consumerNumber.trim(),
                operator: operatorId,
                amount: amount,
                pin: pin,
                customerName: fetchedBill?.customerName || undefined,
                customerMobile: customerMobile || undefined,
                billDetails: fetchedBill || undefined,
            });

            if (response.data.success) {
                const pending = Boolean(response.data.pending || String(response.data.data?.status || '').toUpperCase() === 'PENDING');
                setReceiptData({
                    ...response.data.data,
                    billDetails: response.data.data?.billDetails || fetchedBill,
                    billerName: selectedOperator?.name,
                    customerName: response.data.data?.customerName || fetchedBill?.customerName,
                    customerMobile: response.data.data?.customerMobile || customerMobile,
                    status: pending ? 'PENDING' : 'SUCCESS',
                    isSuccess: !pending,
                });
                setShowReceiptModal(true);
                window.dispatchEvent(new Event('wallet-updated'));
                setSelectedService(null);
            } else {
                const msg = response.data.message;
                const errorMsg = (msg && msg.trim() !== '') ? msg : "Payment Failed";
                setReceiptData({
                    status: response.data?.data?.Status || 'FAILED',
                    transactionId: response.data?.data?.ApiTransID || 'N/A',
                    operatorRef: response.data?.data?.OperatorRef || 'N/A',
                    date: response.data?.data?.TransactionDate || new Date().toLocaleString(),
                    amount: amount,
                    number: consumerNumber,
                    operator: operatorId,
                    billerName: selectedOperator?.name,
                    customerName: fetchedBill?.customerName,
                    customerMobile,
                    billDetails: fetchedBill,
                    type: apiType,
                    errorReason: errorMsg,
                    isSuccess: false
                });
                setShowReceiptModal(true);
            }
        } catch (error: any) {
            const errorMsg = error.response?.data?.message;
            const finalMsg = (errorMsg && errorMsg.trim() !== '') ? errorMsg : "Payment Failed";
            setReceiptData({
                status: 'FAILED',
                transactionId: error.response?.data?.data?.ApiTransID || 'N/A',
                operatorRef: 'N/A',
                date: new Date().toLocaleString(),
                amount: amount,
                number: consumerNumber,
                operator: operatorId,
                billerName: selectedOperator?.name,
                customerName: fetchedBill?.customerName,
                customerMobile,
                billDetails: fetchedBill,
                type: selectedService?.id || 'unknown',
                errorReason: finalMsg,
                isSuccess: false
            });
            setShowReceiptModal(true);
        } finally {
            setLoading(false);
        }
    };

    const downloadReceipt = () => {
        const receiptElement = document.getElementById('receipt-content');
        if (!receiptElement) return;

        html2canvas(receiptElement).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('BBPS_Receipt.pdf');
        });
    };

    const receiptIsPending = receiptData?.status === 'PENDING';
    const receiptIsSuccess = Boolean(receiptData?.isSuccess) && !receiptIsPending;
    const receiptBill = receiptData?.billDetails || {};

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                            <ReceiptText className="text-primary" size={28} />
                            BBPS Transaction
                        </h1>
                        <p className="text-sm text-muted-foreground hidden md:block">
                            Bharat Bill Payment System for instant bill payments.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Container */}
            <div className="flex flex-col glass-card rounded-2xl relative overflow-hidden group border border-border pb-12">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10 p-6">
                    <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-8">
                        <h2 className="text-xl font-bold text-foreground">BBPS Services</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {bbpsServices.map((service) => (
                            <div 
                                key={service.id}
                                onClick={() => handleServiceClick(service)}
                                className={`flex flex-col items-center justify-center aspect-square border ${service.border} rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 hover:scale-105 hover:shadow-[0_0_15px_rgba(var(--primary),0.2)] transition-all bg-background/50 backdrop-blur-sm group/card`}
                            >
                                <div className={`p-4 rounded-full bg-background mb-3 shadow-inner group-hover/card:scale-110 transition-transform ${service.color}`}>
                                    <service.icon className="w-8 h-8" />
                                </div>
                                <span className="text-sm font-semibold capitalize text-foreground">{service.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Footer Logo Removed */}
            </div>

            {/* Service Form Modal */}
            {selectedService && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="glass-card p-6 rounded-2xl w-full max-w-md border border-border shadow-2xl relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 pointer-events-none rounded-2xl"></div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-6 border-b border-border/50 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-background shadow-inner ${selectedService.color}`}>
                                        <selectedService.icon className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-xl font-bold capitalize text-foreground">{selectedService.name} Payment</h2>
                                </div>
                                <button onClick={() => setSelectedService(null)} className="text-muted-foreground hover:text-destructive transition-colors bg-background/50 p-2 rounded-full hover:bg-destructive/10">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Operator / Biller</label>
                                    <select 
                                        className="w-full bg-background border border-border rounded-xl p-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none"
                                        value={operatorId}
                                        onChange={(e) => {
                                            setOperatorId(e.target.value);
                                            setConsumerNumber("");
                                            setCustomerMobile("");
                                            setAmount("");
                                            setFetchedBill(null);
                                        }}
                                    >
                                        <option value="">Select Biller</option>
                                        {operators.map((op: any) => (
                                            <option key={op.id} value={op.id}>{op.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5 mt-4">
                                    <label className="text-sm font-medium text-foreground">
                                        {selectedOperator?.label || "Consumer / Account Number"}
                                    </label>
                                    <input 
                                        type="text"
                                        className="w-full bg-background border border-border rounded-xl p-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                        placeholder={selectedOperator?.label ? `Enter ${selectedOperator.label}` : "Enter number"}
                                        value={consumerNumber}
                                        onChange={(e) => setConsumerNumber(e.target.value.slice(0, 40))}
                                        readOnly={!!fetchedBill}
                                    />
                                </div>

                                <div className="space-y-1.5 mt-4">
                                    <label className="text-sm font-medium text-foreground">Customer Mobile (optional)</label>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={10}
                                        className="w-full bg-background border border-border rounded-xl p-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                        placeholder="10-digit mobile number"
                                        value={customerMobile}
                                        onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        readOnly={!!fetchedBill}
                                    />
                                </div>

                                {!fetchedBill && selectedOperator?.viewbill === "true" ? (
                                    <button 
                                        onClick={handleFetchBill}
                                        disabled={fetchingBill}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed mt-2"
                                    >
                                        {fetchingBill ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Fetching...
                                            </div>
                                        ) : (
                                            "Fetch Bill Details"
                                        )}
                                    </button>
                                ) : (
                                    <>
                                        {fetchedBill && <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 space-y-2 mb-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <p className="text-sm text-foreground/80"><strong>Customer:</strong> {fetchedBill.customerName || 'N/A'}</p>
                                                <p className="text-sm text-foreground/80"><strong>Account:</strong> {fetchedBill.account || consumerNumber}</p>
                                                <p className="text-sm text-foreground/80"><strong>Bill number:</strong> {fetchedBill.billNumber || 'N/A'}</p>
                                                <p className="text-sm text-foreground/80"><strong>Bill date:</strong> {fetchedBill.billDate || 'N/A'}</p>
                                                <p className="text-sm text-foreground/80"><strong>Due date:</strong> {fetchedBill.dueDate || 'N/A'}</p>
                                                <p className="text-sm text-foreground/80"><strong>Bill period:</strong> {fetchedBill.billPeriod || 'N/A'}</p>
                                                <p className="text-sm text-foreground/80"><strong>Amount due:</strong> ₹{fetchedBill.dueAmount ?? fetchedBill.amount ?? amount}</p>
                                                <p className="text-sm text-foreground/80"><strong>Fetch reference:</strong> {fetchedBill.fetchRefId || fetchedBill.fetchBillId || 'N/A'}</p>
                                            </div>
                                        </div>}

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-foreground">Amount (₹)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                                                <input 
                                                    type="number"
                                                    min="10"
                                                    step="1"
                                                    inputMode="numeric"
                                                    className="w-full bg-background border border-border rounded-xl py-3.5 pl-8 pr-4 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                                    placeholder="0.00"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    readOnly={!!(fetchedBill?.amount || fetchedBill?.Amount || fetchedBill?.billAmount)}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-foreground">T-PIN</label>
                                            <input 
                                                type="password"
                                                className="w-full bg-background border border-border rounded-xl p-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all tracking-widest"
                                                placeholder="••••"
                                                value={pin}
                                                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                maxLength={4}
                                            />
                                        </div>

                                        <button 
                                            onClick={handlePayment}
                                            disabled={loading}
                                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed mt-2"
                                        >
                                            {loading ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    Processing...
                                                </div>
                                            ) : (
                                                selectedOperator?.viewbill === "true" ? "Pay Bill Securely" : "Pay Securely"
                                            )}
                                        </button>
                                        
                                        {!!fetchedBill && <button 
                                            onClick={() => setFetchedBill(null)}
                                            className="w-full bg-transparent hover:bg-muted text-muted-foreground font-medium py-2 rounded-xl transition-all mt-2 text-sm"
                                        >
                                            Fetch Different Bill
                                        </button>}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {showReceiptModal && receiptData && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in zoom-in-95 duration-300">
                    <div className="glass-card rounded-2xl w-full max-w-md p-6 border border-border shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`text-xl font-bold flex items-center gap-2 ${receiptIsPending ? 'text-amber-500' : receiptIsSuccess ? 'text-emerald-500' : 'text-destructive'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${receiptIsPending ? 'bg-amber-500/20' : receiptIsSuccess ? 'bg-emerald-500/20' : 'bg-destructive/20'}`}>
                                    <div className={`w-3 h-3 rounded-full ${receiptIsPending ? 'bg-amber-500' : receiptIsSuccess ? 'bg-emerald-500' : 'bg-destructive'}`}></div>
                                </div>
                                {receiptIsPending ? 'Payment Pending' : receiptIsSuccess ? 'Payment Successful!' : 'Payment Failed!'}
                            </h3>
                            <button onClick={() => setShowReceiptModal(false)} className="text-muted-foreground hover:text-destructive transition-colors bg-background/50 p-2 rounded-full">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div id="receipt-content" className="bg-background p-6 rounded-xl border border-border mb-6 relative overflow-hidden shadow-inner">
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${receiptIsPending ? 'from-amber-400 to-amber-600' : receiptIsSuccess ? 'from-emerald-400 to-emerald-600' : 'from-red-400 to-red-600'}`}></div>
                            
                            <div className="flex flex-col items-center text-center mb-6 pb-6 border-b border-border border-dashed">
                                <img src={logo} alt="Shahparpay" className="w-32 h-auto max-h-24 object-contain mb-2" crossOrigin="anonymous" />
                                <div className="text-sm text-muted-foreground mt-1">BBPS Transaction Receipt</div>
                            </div>
                            
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Service</span>
                                    <span className="font-semibold capitalize text-right text-foreground">{receiptData.type || 'BBPS'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Biller</span>
                                    <span className="font-semibold text-right text-foreground">{receiptData.billerName || receiptData.operator || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Customer name</span>
                                    <span className="font-semibold text-right text-foreground">{receiptData.customerName || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Customer mobile</span>
                                    <span className="font-medium text-right text-foreground">{receiptData.customerMobile || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Consumer / account no.</span>
                                    <span className="font-medium text-right text-foreground tracking-wide">{receiptData.number || receiptBill.account || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Bill number</span>
                                    <span className="font-medium text-right text-foreground">{receiptBill.billNumber || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Bill date</span>
                                    <span className="font-medium text-right text-foreground">{receiptBill.billDate || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Due date</span>
                                    <span className="font-medium text-right text-foreground">{receiptBill.dueDate || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Fetch reference</span>
                                    <span className="font-medium text-right text-foreground">{receiptBill.fetchRefId || receiptBill.fetchBillId || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Transaction ID</span>
                                    <span className="font-medium text-right text-foreground text-xs break-all">{receiptData.transactionId || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Operator reference</span>
                                    <span className="font-medium text-right text-foreground">{receiptData.operatorRef || receiptData.txnId || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className={`font-bold ${receiptIsPending ? 'text-amber-500' : receiptIsSuccess ? 'text-emerald-500' : 'text-destructive'}`}>{receiptData.status}</span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-muted-foreground">Date & time</span>
                                    <span className="font-medium text-right text-foreground">{receiptData.date || receiptData.transactionDate || new Date().toLocaleString()}</span>
                                </div>
                                
                                {!receiptData.isSuccess && receiptData.errorReason && (
                                    <div className="flex flex-col gap-1 mt-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                                        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Reason for failure</span>
                                        <span className="font-medium text-destructive">{receiptData.errorReason}</span>
                                    </div>
                                )}
                                
                                <div className="pt-4 border-t border-border border-dashed mt-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-muted-foreground">Amount</span> 
                                        <span className="font-bold text-3xl text-foreground">₹{receiptData.amount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={downloadReceipt}
                            className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold py-4 rounded-xl transition-all border border-border flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            Download PDF Receipt
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BBPS;
