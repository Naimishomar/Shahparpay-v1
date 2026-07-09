import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Zap, Flame, Shield, CreditCard, Droplet, Smartphone, XCircle, ReceiptText } from "lucide-react";
import axios from "axios";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import logo from '../assets/logo.png';

const bbpsServices = [
    { id: "electricity", name: "Ebill", icon: Zap, color: "text-yellow-500", border: "border-yellow-500/20" },
    { id: "gas", name: "Gas", icon: Flame, color: "text-orange-500", border: "border-orange-500/20" },
    { id: "insurance", name: "Ins", icon: Shield, color: "text-red-400", border: "border-red-400/20" },
    { id: "loan", name: "Loan", icon: CreditCard, color: "text-blue-500", border: "border-blue-500/20" },
    { id: "lpg", name: "Lpg", icon: Flame, color: "text-red-500", border: "border-red-500/20" },
    { id: "postpaid", name: "Postpaid", icon: Smartphone, color: "text-primary", border: "border-primary/20" },
    { id: "water", name: "Water", icon: Droplet, color: "text-cyan-400", border: "border-cyan-400/20" },
];

const BBPS = () => {
    const [selectedService, setSelectedService] = useState<any>(null);
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [operatorId, setOperatorId] = useState("");
    const [consumerNumber, setConsumerNumber] = useState("");
    const [amount, setAmount] = useState("");
    const [pin, setPin] = useState("");

    const [fetchedBill, setFetchedBill] = useState<any>(null);
    const [fetchingBill, setFetchingBill] = useState(false);

    const { user } = useAuth();

    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    const fetchOperators = async (type: string) => {
        try {
            const apiType = type === 'lpg' ? 'gas' : type;
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/operators/${apiType}`);
            if (res.data.success) {
                setOperators(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch operators", error);
            setOperators([]);
        }
    };

    const handleServiceClick = (service: any) => {
        setSelectedService(service);
        setOperatorId("");
        setConsumerNumber("");
        setAmount("");
        setPin("");
        setFetchedBill(null);
        fetchOperators(service.id);
    };

    const handleFetchBill = async () => {
        if (!operatorId || !consumerNumber) {
            alert("Please select an operator and enter the consumer number");
            return;
        }

        setFetchingBill(true);
        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/fetch-bill`, {
                operator: operatorId,
                caNumber: consumerNumber
            });

            if (response.data.success) {
                setFetchedBill(response.data.data);
                // Pre-fill the amount
                const fetchedAmt = response.data.data.amount || response.data.data.Amount || response.data.data.billAmount;
                if (fetchedAmt) setAmount(fetchedAmt.toString());
            } else {
                alert(response.data.message || "Failed to fetch bill details");
            }
        } catch (error: any) {
            alert(error.response?.data?.message || "Error fetching bill");
        } finally {
            setFetchingBill(false);
        }
    };

    const handlePayment = async () => {
        if (!operatorId || !consumerNumber || !amount || !pin) {
            alert("Please fill all fields");
            return;
        }

        setLoading(true);
        try {
            const apiType = selectedService.id === 'lpg' ? 'gas' : selectedService.id;
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/do-recharge`, {
                userId: user?.id || user?._id,
                type: apiType,
                number: consumerNumber,
                operator: operatorId,
                amount: amount,
                pin: pin,
                circle: 1
            });

            if (response.data.success) {
                setReceiptData({ ...response.data.data, isSuccess: true });
                setShowReceiptModal(true);
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
                                        onChange={(e) => setOperatorId(e.target.value)}
                                    >
                                        <option value="">Select Biller</option>
                                        {operators.map((op: any) => (
                                            <option key={op.id} value={op.id}>{op.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Consumer / Account Number</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-background border border-border rounded-xl p-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                        placeholder="Enter number"
                                        value={consumerNumber}
                                        onChange={(e) => setConsumerNumber(e.target.value)}
                                        readOnly={!!fetchedBill}
                                    />
                                </div>

                                {!fetchedBill ? (
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
                                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 space-y-2 mb-4">
                                            <p className="text-sm text-foreground/80"><strong>Customer Name:</strong> {fetchedBill.name || fetchedBill.CustomerName || fetchedBill.userName || 'N/A'}</p>
                                            <p className="text-sm text-foreground/80"><strong>Due Date:</strong> {fetchedBill.duedate || fetchedBill.DueDate || fetchedBill.dueDate || 'N/A'}</p>
                                            <p className="text-sm text-foreground/80"><strong>Amount Due:</strong> ₹{fetchedBill.amount || fetchedBill.Amount || fetchedBill.billAmount || amount}</p>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-foreground">Amount (₹)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                                                <input 
                                                    type="number"
                                                    className="w-full bg-background border border-border rounded-xl py-3.5 pl-8 pr-4 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                                    placeholder="0.00"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    readOnly={!!(fetchedBill.amount || fetchedBill.Amount || fetchedBill.billAmount)}
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
                                                onChange={(e) => setPin(e.target.value)}
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
                                                "Pay Bill Securely"
                                            )}
                                        </button>
                                        
                                        <button 
                                            onClick={() => setFetchedBill(null)}
                                            className="w-full bg-transparent hover:bg-muted text-muted-foreground font-medium py-2 rounded-xl transition-all mt-2 text-sm"
                                        >
                                            Fetch Different Bill
                                        </button>
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
                            <h3 className={`text-xl font-bold flex items-center gap-2 ${receiptData.isSuccess ? 'text-emerald-500' : 'text-destructive'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${receiptData.isSuccess ? 'bg-emerald-500/20' : 'bg-destructive/20'}`}>
                                    <div className={`w-3 h-3 rounded-full ${receiptData.isSuccess ? 'bg-emerald-500' : 'bg-destructive'}`}></div>
                                </div>
                                {receiptData.isSuccess ? 'Payment Successful!' : 'Payment Failed!'}
                            </h3>
                            <button onClick={() => setShowReceiptModal(false)} className="text-muted-foreground hover:text-destructive transition-colors bg-background/50 p-2 rounded-full">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div id="receipt-content" className="bg-background p-6 rounded-xl border border-border mb-6 relative overflow-hidden shadow-inner">
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${receiptData.isSuccess ? 'from-emerald-400 to-emerald-600' : 'from-red-400 to-red-600'}`}></div>
                            
                            <div className="flex flex-col items-center text-center mb-6 pb-6 border-b border-border border-dashed">
                                <img src={logo} alt="Shahparpay" className="w-32 h-auto max-h-24 object-contain mb-2" crossOrigin="anonymous" />
                                <div className="text-sm text-muted-foreground mt-1">BBPS Transaction Receipt</div>
                            </div>
                            
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Service</span> 
                                    <span className="font-semibold capitalize text-foreground bg-secondary px-3 py-1 rounded-full">{receiptData.type}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Consumer No</span> 
                                    <span className="font-medium text-foreground tracking-wide">{receiptData.number}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Transaction ID</span> 
                                    <span className="font-medium text-foreground text-xs bg-muted px-2 py-1 rounded">{receiptData.transactionId}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Operator Ref</span> 
                                    <span className="font-medium text-foreground">{receiptData.operatorRef || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Status</span> 
                                    <span className={`font-bold ${receiptData.isSuccess ? 'text-emerald-500' : 'text-destructive'}`}>{receiptData.status}</span>
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