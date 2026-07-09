import { useState, useEffect } from "react";
import { XCircle, Clock, Smartphone, Tv, Search } from "lucide-react";
import axios from "axios";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const Recharge = () => {
    const { user } = useAuth();
    // UI State
    const [activeTab, setActiveTab] = useState("prepaid");
    const [loading, setLoading] = useState(false);
    
    // Data State
    const [prepaidOperators, setPrepaidOperators] = useState<any[]>([]);
    const [dthOperators, setDthOperators] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [showPlansModal, setShowPlansModal] = useState(false);
    const [planSearch, setPlanSearch] = useState("");
    const [history, setHistory] = useState<any[]>([]);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // Form State (Prepaid)
    const [mobileNumber, setMobileNumber] = useState("");
    const [prepaidOperator, setPrepaidOperator] = useState("");
    const [circle, setCircle] = useState("Delhi NCR");
    const [prepaidAmount, setPrepaidAmount] = useState("");
    const [prepaidPin, setPrepaidPin] = useState("");

    // Form State (DTH)
    const [dthNumber, setDthNumber] = useState("");
    const [dthOperator, setDthOperator] = useState("");
    const [dthAmount, setDthAmount] = useState("");
    const [dthPin, setDthPin] = useState("");
    const [dthInfo, setDthInfo] = useState<any>(null);

    // Initial Data Fetch
    useEffect(() => {
        fetchOperators('prepaid');
        fetchOperators('dth');
        fetchHistory();
    }, []);

    const fetchOperators = async (type: string) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/operators/${type}`);
            const data = await res.json();
            if (data.success) {
                if (type === 'prepaid') setPrepaidOperators(data.data);
                if (type === 'dth') setDthOperators(data.data);
            }
        } catch (error) {
            console.error(`Failed to fetch ${type} operators`, error);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/history`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    };

    const handleBrowsePlan = async () => {
        if (!mobileNumber || !prepaidOperator) {
            alert("Please enter mobile number and select operator first.");
            return;
        }
        setLoading(true);
        try {
            // Find the selected operator name
            const selectedOp = prepaidOperators.find((op: any) => op.id.toString() === prepaidOperator.toString());
            const operatorName = selectedOp ? selectedOp.name : "";

            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/browse-plan`, { 
                mobileNumber, 
                operator: prepaidOperator,
                operatorName: operatorName,
                circle: circle
            });
            if (response.data && response.data.success) {
                // response.data.data contains the plans object with categories like TOPUP, 3G/4G, etc.
                const plansData = response.data.data || {};
                const flattenedPlans: any[] = [];
                Object.keys(plansData).forEach(category => {
                    const categoryPlans = plansData[category];
                    if (Array.isArray(categoryPlans)) {
                        categoryPlans.forEach((p: any) => {
                            flattenedPlans.push({
                                category,
                                amount: p.rs || p.amount,
                                description: p.desc || p.description,
                                validity: p.validity,
                            });
                        });
                    }
                });
                setPlans(flattenedPlans);
                setShowPlansModal(true);
            }
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || "Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    const downloadReceipt = async () => {
        const element = document.getElementById('receipt-content');
        if (!element) return;
        
        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Receipt_${receiptData?.transactionId || 'Txn'}.pdf`);
        } catch (error: any) {
            console.error("PDF generation failed", error);
            alert(`Failed to generate PDF: ${error?.message || error}`);
        }
    };

    const handleFetchDthInfo = async () => {
        if (!dthNumber || !dthOperator) {
            alert("Please enter DTH number and select operator first.");
            return;
        }
        setLoading(true);
        try {
            const selectedOp = dthOperators.find((op: any) => op.id.toString() === dthOperator.toString());
            let operatorName = selectedOp ? selectedOp.name : "";
            
            // Map UI names to PaySprint required DTH keys
            const opNameLower = operatorName.toLowerCase();
            if (opNameLower.includes("airtel")) operatorName = "Airteldth";
            else if (opNameLower.includes("tata")) operatorName = "TataSky";
            else if (opNameLower.includes("videocon")) operatorName = "Videocon";
            else if (opNameLower.includes("sun")) operatorName = "Sundirect";
            else if (opNameLower.includes("dish")) operatorName = "Dishtv";

            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/dth-info`, { 
                dthNumber, 
                operator: dthOperator,
                operatorName: operatorName
            });
            if (response.data && response.data.success) {
                // If it's an array with 1 item, extract the first item
                let info = response.data.data;
                if (Array.isArray(info) && info.length > 0) info = info[0];
                setDthInfo(info);
            }
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || "Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    const handleRechargeSubmit = async (type: string) => {
        let payload: any = { type, userId: user?.id || user?._id };
        
        if (type === 'prepaid') {
            if (!mobileNumber || !prepaidOperator || !prepaidAmount || !prepaidPin) {
                alert("Please fill all fields.");
                return;
            }
            payload = { ...payload, number: mobileNumber, operator: prepaidOperator, amount: prepaidAmount, pin: prepaidPin };
        } else {
            if (!dthNumber || !dthOperator || !dthAmount || !dthPin) {
                alert("Please fill all fields.");
                return;
            }
            payload = { ...payload, number: dthNumber, operator: dthOperator, amount: dthAmount, pin: dthPin };
        }

        setLoading(true);
        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/do-recharge`, payload);
            
            if (response.data && response.data.success) {
                const opList: any = type === 'prepaid' ? prepaidOperators : dthOperators;
                const opId = type === 'prepaid' ? prepaidOperator : dthOperator;
                const selectedOp = opList.find((op: any) => op.id.toString() === opId?.toString());
                const opName = selectedOp ? selectedOp.name : "Unknown";
                const resData = response.data.data || {};

                setReceiptData({
                    transactionId: resData.ackno || resData.refid || 'TXN' + Date.now(),
                    status: resData.status === false || resData.response_code === 0 ? 'FAILED' : 'SUCCESS',
                    operatorRef: resData.operatorid || resData.operator_ref || 'N/A',
                    date: new Date().toISOString(),
                    amount: type === 'prepaid' ? prepaidAmount : dthAmount,
                    number: type === 'prepaid' ? mobileNumber : dthNumber,
                    operator: opName,
                    type: type
                });
                setShowReceiptModal(true);
                if (type === 'prepaid') {
                    setMobileNumber(""); setPrepaidAmount(""); setPrepaidPin("");
                } else {
                    setDthNumber(""); setDthAmount(""); setDthPin(""); setDthInfo(null);
                }
                // Refresh history after recharge
                fetchHistory();
            }
        } catch (error: any) {
            console.error("AXIOS ERROR:", error);
            console.log("AXIOS RESPONSE:", error.response);
            const errMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to process recharge";
            alert(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                            <Smartphone className="text-primary" size={28} />
                            Recharge Transaction
                        </h1>
                        <p className="text-sm text-muted-foreground hidden md:block">
                            Instant Prepaid Mobile and DTH recharges.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Container */}
            <div className="flex flex-col glass-card rounded-2xl relative overflow-hidden group border border-border">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                {/* Tabs Header */}
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center p-6 pb-0 border-b border-border/50 gap-4">
                    <h2 className="text-xl font-bold text-foreground mb-4 md:mb-0">All Recharge</h2>
                    
                    <div className="flex items-center gap-2 md:gap-6 border-b border-transparent w-full md:w-auto overflow-x-auto">
                        <button 
                            onClick={() => setActiveTab('prepaid')}
                            className={`pb-4 px-2 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'prepaid' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Smartphone size={18} />
                            Prepaid
                        </button>
                        <button 
                            onClick={() => setActiveTab('dth')}
                            className={`pb-4 px-2 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'dth' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Tv size={18} />
                            DTH
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`pb-4 px-2 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Clock size={18} />
                            History
                        </button>
                    </div>
                </div>

                <div className="relative z-10 p-6 flex flex-col gap-6">
                    {/* PREPAID TAB */}
                    {activeTab === 'prepaid' && (
                        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                            {/* Top Bar */}
                            <div className="flex flex-col md:flex-row items-center gap-4 bg-primary/10 p-4 border border-primary/20 rounded-lg border-l-4 border-l-primary">
                                <h3 className="text-lg font-bold text-foreground min-w-[200px]">Mobile Prepaid Recharge</h3>
                                
                                <div className="flex-1 flex flex-col md:flex-row gap-4 w-full">
                                    <input 
                                        type="text" 
                                        placeholder="Enter 10-digit mobile number"
                                        value={mobileNumber}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length > 10) {
                                                toast.error("Mobile number cannot exceed 10 digits");
                                                return;
                                            }
                                            setMobileNumber(val);
                                        }}
                                        className="w-full md:w-1/4 p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    />
                                    <select 
                                        value={prepaidOperator}
                                        onChange={e => setPrepaidOperator(e.target.value)}
                                        className="w-full md:w-1/4 p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    >
                                        <option value="">Select Operator</option>
                                        {prepaidOperators.map((op: any) => (
                                            <option key={op.id} value={op.id}>{op.name}</option>
                                        ))}
                                    </select>
                                    <select 
                                        value={circle}
                                        onChange={e => setCircle(e.target.value)}
                                        className="w-full md:w-1/4 p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    >
                                        {[
                                            "Andhra Pradesh", "Assam", "Bihar Jharkhand", "Chennai", "Delhi NCR", "Gujarat", "Haryana", 
                                            "Himachal Pradesh", "Jammu Kashmir", "Karnataka", "Kerala", "Kolkata", "Madhya Pradesh Chhattisgarh", 
                                            "Maharashtra Goa", "Mumbai", "North East", "Orissa", "Punjab", "Rajasthan", "Tamil Nadu", 
                                            "UP East", "UP West", "West Bengal"
                                        ].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={handleBrowsePlan}
                                        disabled={loading || !mobileNumber || !prepaidOperator}
                                        className="w-full md:w-auto px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md shadow-sm transition-all disabled:opacity-50"
                                    >
                                        {loading ? "Loading..." : "Browse Plan"}
                                    </button>
                                </div>
                            </div>

                            {/* Bottom Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end mt-2">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Amount</label>
                                    <input 
                                        type="number" 
                                        value={prepaidAmount}
                                        onChange={e => setPrepaidAmount(e.target.value)}
                                        className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Transaction PIN</label>
                                    <input 
                                        type="password" 
                                        value={prepaidPin}
                                        onChange={e => setPrepaidPin(e.target.value)}
                                        className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    />
                                </div>
                                <button 
                                    onClick={() => handleRechargeSubmit('prepaid')}
                                    disabled={loading}
                                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md shadow-md hover:shadow-lg transition-all"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    )}

                    {/* DTH TAB */}
                    {activeTab === 'dth' && (
                        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                            {/* Top Bar */}
                            <div className="flex flex-col md:flex-row items-center gap-4 bg-primary/10 p-4 border border-primary/20 rounded-lg border-l-4 border-l-primary">
                                <h3 className="text-lg font-bold text-foreground min-w-[200px]">DTH Recharge</h3>
                                
                                <div className="flex-1 flex flex-col md:flex-row gap-4 w-full">
                                    <input 
                                        type="text" 
                                        placeholder="Enter DTH Number"
                                        value={dthNumber}
                                        onChange={e => setDthNumber(e.target.value)}
                                        className="w-full md:w-1/3 p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    />
                                    <select 
                                        value={dthOperator}
                                        onChange={e => setDthOperator(e.target.value)}
                                        className="w-full md:w-1/3 p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    >
                                        <option value="">Select DTH Operator</option>
                                        {dthOperators.map((op: any) => (
                                            <option key={op.id} value={op.id}>{op.name}</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={handleFetchDthInfo}
                                        disabled={loading}
                                        className="w-full md:w-auto px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md shadow-sm transition-all"
                                    >
                                        {loading ? "Loading..." : "Browse DTH Plan"}
                                    </button>
                                </div>
                            </div>

                            {/* DTH Info Table */}
                            {dthInfo && (
                                <div className="w-full overflow-x-auto border border-border rounded-lg bg-background">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold">Name</th>
                                                <th className="px-4 py-3 font-semibold">Balance</th>
                                                <th className="px-4 py-3 font-semibold">Monthly Recharge</th>
                                                <th className="px-4 py-3 font-semibold">Next Recharge Date</th>
                                                <th className="px-4 py-3 font-semibold">Status</th>
                                                <th className="px-4 py-3 font-semibold">Monthly Recharge</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-border/50 hover:bg-muted/10 font-medium">
                                                <td className="px-4 py-4">{dthInfo.customerName || '-'}</td>
                                                <td className="px-4 py-4 text-primary">₹ {dthInfo.Balance || 0}</td>
                                                <td className="px-4 py-4">₹ {dthInfo.MonthlyRecharge || 0}</td>
                                                <td className="px-4 py-4">{dthInfo.NextRechargeDate || '-'}</td>
                                                <td className="px-4 py-4 text-emerald-500">{dthInfo.status || 'Active'}</td>
                                                <td className="px-4 py-4">₹ {dthInfo.MonthlyRecharge || 0}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Bottom Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end mt-2">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Amount</label>
                                    <input 
                                        type="number" 
                                        value={dthAmount}
                                        onChange={e => setDthAmount(e.target.value)}
                                        className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Transaction PIN</label>
                                    <input 
                                        type="password" 
                                        value={dthPin}
                                        onChange={e => setDthPin(e.target.value)}
                                        className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                    />
                                </div>
                                <button 
                                    onClick={() => handleRechargeSubmit('dth')}
                                    disabled={loading}
                                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md shadow-md hover:shadow-lg transition-all"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                            <h3 className="text-base font-bold text-foreground">Recharge History</h3>
                            <div className="w-full overflow-x-auto border border-border rounded-lg bg-background">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">No.</th>
                                            <th className="px-4 py-3 font-semibold">Date Time</th>
                                            <th className="px-4 py-3 font-semibold">Mobile</th>
                                            <th className="px-4 py-3 font-semibold">Operator</th>
                                            <th className="px-4 py-3 font-semibold">Reference Id</th>
                                            <th className="px-4 py-3 font-semibold">Amount</th>
                                            <th className="px-4 py-3 font-semibold">Discount</th>
                                            <th className="px-4 py-3 font-semibold">Status</th>
                                            <th className="px-4 py-3 font-semibold">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.length > 0 ? history.map((item: any, idx) => (
                                            <tr key={item._id} className="border-b border-border/50 hover:bg-muted/10 font-medium transition-colors">
                                                <td className="px-4 py-3">{idx + 1}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td>
                                                <td className="px-4 py-3">{item.metadata?.number}</td>
                                                <td className="px-4 py-3 text-primary">{item.metadata?.operator}</td>
                                                <td className="px-4 py-3">{item.transactionId}</td>
                                                <td className="px-4 py-3 text-foreground font-bold">₹ {item.amount}</td>
                                                <td className="px-4 py-3">0</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs ${item.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button 
                                                        onClick={() => {
                                                            setReceiptData({
                                                                transactionId: item.transactionId,
                                                                status: item.status,
                                                                operatorRef: item.metadata?.operatorRef,
                                                                date: item.createdAt,
                                                                amount: item.amount,
                                                                number: item.metadata?.number,
                                                                operator: item.metadata?.operator,
                                                                type: item.metadata?.rechargeType?.toLowerCase() === 'dth' ? 'dth' : 'prepaid'
                                                            });
                                                            setShowReceiptModal(true);
                                                        }}
                                                        className="text-primary hover:underline text-xs"
                                                    >
                                                        View Receipt
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground font-semibold">
                                                    No recharge transaction found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Plans Modal */}
            {showPlansModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Smartphone className="text-primary" />
                                Available Plans for {mobileNumber}
                            </h3>
                            <button onClick={() => { setShowPlansModal(false); setPlanSearch(""); }} className="text-muted-foreground hover:text-foreground">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="px-4 pt-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search by amount or validity (e.g., 299 or 28 Days)" 
                                    value={planSearch}
                                    onChange={(e) => setPlanSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                                />
                            </div>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
                            {plans.filter((p: any) => 
                                (p.amount && p.amount.toString().toLowerCase().includes(planSearch.toLowerCase())) || 
                                (p.validity && p.validity.toString().toLowerCase().includes(planSearch.toLowerCase()))
                            ).map((plan: any, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-2xl font-black text-foreground">₹ {plan.amount}</span>
                                        <div className="flex gap-2">
                                            <span className="text-xs font-bold px-2 py-0.5 bg-primary/20 text-primary rounded">{plan.category || 'Plan'}</span>
                                            <span className="text-sm font-semibold text-emerald-500">Validity: {plan.validity}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 text-sm text-muted-foreground">
                                        {plan.description}
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setPrepaidAmount(plan.amount);
                                            setShowPlansModal(false);
                                        }}
                                        className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold rounded-md transition-colors whitespace-nowrap"
                                    >
                                        Select
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {showReceiptModal && receiptData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                Transaction Receipt
                            </h3>
                            <button onClick={() => setShowReceiptModal(false)} className="text-muted-foreground hover:text-foreground">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div id="receipt-content" className="p-6 flex flex-col gap-4" style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif' }}>
                            {/* Receipt content styling */}
                            <div className="flex flex-col items-center gap-2 pb-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <img src={logo} alt="Shahparpay" className="w-48 h-auto max-h-24 object-contain" crossOrigin="anonymous" />
                                <h2 className="text-xl font-bold mt-2" style={{ color: '#1f2937' }}>Shahparpay Pvt. Ltd.</h2>
                                <p className="text-sm" style={{ color: '#6b7280' }}>{receiptData.status === 'PENDING' ? 'Recharge Pending' : 'Recharge Successful'}</p>
                            </div>
                            <div className="flex flex-col gap-3 py-2">
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Status</span>
                                    <span className="font-bold" style={{ color: receiptData.status === 'SUCCESS' ? '#16a34a' : '#ca8a04' }}>{receiptData.status}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Amount</span>
                                    <span className="font-bold" style={{ color: '#1f2937' }}>₹ {receiptData.amount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Number</span>
                                    <span className="font-bold" style={{ color: '#1f2937' }}>{receiptData.number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Operator</span>
                                    <span className="font-bold" style={{ color: '#1f2937' }}>{receiptData.operator}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Transaction ID</span>
                                    <span className="font-bold text-xs my-auto" style={{ color: '#1f2937' }}>{receiptData.transactionId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Operator Ref</span>
                                    <span className="font-bold" style={{ color: '#1f2937' }}>{receiptData.operatorRef || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Date</span>
                                    <span className="font-bold text-xs text-right max-w-[150px]" style={{ color: '#1f2937' }}>{new Date(receiptData.date || Date.now()).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="pt-2 text-center text-xs" style={{ borderTop: '1px solid #e5e7eb', color: '#9ca3af' }}>
                                <p>This is a computer-generated receipt and does not require a physical signature.</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border bg-muted/30 flex gap-4">
                            <button 
                                onClick={() => setShowReceiptModal(false)}
                                className="flex-1 py-2 rounded-lg border border-border bg-background hover:bg-muted font-semibold transition-colors"
                            >
                                Close
                            </button>
                            <button 
                                onClick={downloadReceipt}
                                className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all"
                            >
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recharge;