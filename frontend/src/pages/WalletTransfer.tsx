import { useState, useEffect } from 'react';
import { Wallet, Clock, ArrowRightLeft, CheckCircle2, Lock, X, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const WalletTransfer = () => {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'transfer' | 'history'>('transfer');
    const [aepsBalance, setAepsBalance] = useState<string>("0.0000");
    const [mainBalance, setMainBalance] = useState<string>("0.0000");
    const [amount, setAmount] = useState<string>("");
    const [pin, setPin] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [hasPin, setHasPin] = useState(true);
    const [showSetPinModal, setShowSetPinModal] = useState(false);
    const [showEnterPinModal, setShowEnterPinModal] = useState(false);
    const [newPin, setNewPin] = useState<string>("");
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        fetchBalances();
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab]);

    const fetchBalances = async () => {
        try {
            if (!token) return;
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/wallet/balance`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                setAepsBalance(res.data.data.aepsBalance.toFixed(4));
                setMainBalance(res.data.data.mainBalance.toFixed(4));
                setHasPin(res.data.data.hasPin);
            }
        } catch (error) {
            console.error("Error fetching balances:", error);
        }
    };

    const fetchHistory = async () => {
        try {
            if (!token) return;
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/wallet/history`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                setHistory(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        }
    };

    const handleSetPin = async () => {
        if (!newPin || newPin.length !== 4 || isNaN(Number(newPin))) {
            alert("Please enter a valid 4-digit PIN.");
            return;
        }
        setLoading(true);
        try {
            if (!token) return;
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/wallet/set-pin`, { pin: newPin }, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                alert("PIN set successfully!");
                setHasPin(true);
                setShowSetPinModal(false);
                setNewPin("");
            }
        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to set PIN.");
        } finally {
            setLoading(false);
        }
    };

    const handleTransferClick = () => {
        if (!hasPin) {
            setShowSetPinModal(true);
            return;
        }

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            alert("Please enter a valid amount to transfer.");
            return;
        }
        
        if (Number(amount) > Number(aepsBalance)) {
            alert("Insufficient balance in AEPS Wallet.");
            return;
        }

        setShowEnterPinModal(true);
    };

    const handleConfirmTransfer = async () => {
        if (!pin || pin.length !== 4) {
            alert("Please enter your 4-digit transaction PIN.");
            return;
        }

        setLoading(true);
        try {
            if (!token) return;
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/wallet/transfer`, { 
                amount: Number(amount), 
                pin 
            }, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setAepsBalance(res.data.balances.aepsBalance.toFixed(4));
                setMainBalance(res.data.balances.mainBalance.toFixed(4));
                setAmount("");
                setPin("");
                
                // Dispatch event to update Header balance globally
                window.dispatchEvent(new Event('wallet-updated'));
                
                setShowEnterPinModal(false);
                alert("Wallet Transfer Successful!");
            }
        } catch (error: any) {
            alert(error.response?.data?.message || "Transfer failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                        <Wallet className="text-primary" size={28} />
                        Wallet Transfer
                    </h1>
                </div>
            </div>

            {/* Main Container */}
            <div className="flex flex-col glass-card rounded-2xl relative overflow-hidden group border border-border">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                {/* Tabs Header */}
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center p-6 pb-0 border-b border-border/50 gap-4">
                    <div className="flex items-center gap-2 md:gap-6 border-b border-transparent w-full overflow-x-auto">
                        <button 
                            onClick={() => setActiveTab('transfer')}
                            className={`pb-4 px-4 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'transfer' ? 'text-primary dark:text-white border-b-2 border-primary dark:border-white' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <ArrowRightLeft size={18} />
                            Wallet Transfer
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`pb-4 px-4 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'text-primary dark:text-white border-b-2 border-primary dark:border-white' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Clock size={18} />
                            History
                        </button>
                    </div>
                </div>

                <div className="relative z-10 p-6 flex flex-col gap-6 min-h-[400px]">
                    {/* TRANSFER TAB */}
                    {activeTab === 'transfer' && (
                        <div className="flex flex-col gap-8 animate-in fade-in duration-300 max-w-4xl">
                            
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr] gap-4 md:gap-6 items-end">
                                {/* AEPS Wallet */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-foreground/80 pl-1">AEPS Wallet</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={aepsBalance}
                                            disabled
                                            className="w-full p-3 pl-10 border border-border rounded-xl bg-muted/30 text-foreground font-medium shadow-sm transition-colors cursor-not-allowed opacity-80"
                                        />
                                        <Wallet className="absolute left-3 top-3.5 text-muted-foreground" size={18} />
                                    </div>
                                </div>

                                {/* Arrow Divider */}
                                <div className="hidden md:flex items-center justify-center pb-4 px-2">
                                    <ArrowRight className="text-muted-foreground opacity-50" size={24} />
                                </div>

                                {/* Main Wallet */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-foreground/80 pl-1">Main Wallet</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={mainBalance}
                                            disabled
                                            className="w-full p-3 pl-10 border border-border rounded-xl bg-muted/30 text-foreground font-medium shadow-sm transition-colors cursor-not-allowed opacity-80"
                                        />
                                        <Wallet className="absolute left-3 top-3.5 text-muted-foreground" size={18} />
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-foreground/80 pl-1">Amount</label>
                                    <div className="relative group">
                                        <input 
                                            type="number" 
                                            placeholder="Enter Amount"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            className="w-full p-3 pl-10 border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-background shadow-sm transition-all"
                                        />
                                        <span className="absolute left-4 top-3 text-muted-foreground font-semibold">₹</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-border/30">
                                <button 
                                    onClick={handleTransferClick}
                                    disabled={!amount}
                                    className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95"
                                >
                                    <ArrowRightLeft size={18} />
                                    {hasPin ? "Transfer Now" : "Set PIN to Transfer"}
                                </button>
                            </div>
                            
                            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                                <div className="p-2 rounded-full bg-primary/20 text-primary dark:text-white mt-0.5">
                                    <CheckCircle2 size={16} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-foreground text-sm">Secure Transfer</h4>
                                    <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                                        Wallet transfers from AEPS to Main Wallet are processed instantly. Please ensure you enter the correct amount and your 4-digit security PIN. Once processed, transfers cannot be reversed.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-bold text-foreground">Transfer History</h3>
                                <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full border border-border/50">
                                    Showing latest {history.length} transactions
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">No.</th>
                                            <th className="px-4 py-3 font-semibold">Order Id</th>
                                            <th className="px-4 py-3 font-semibold">Date Time</th>
                                            <th className="px-4 py-3 font-semibold">Operator</th>
                                            <th className="px-4 py-3 font-semibold">Amount</th>
                                            <th className="px-4 py-3 font-semibold">Commission</th>
                                            <th className="px-4 py-3 font-semibold text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.length > 0 ? history.map((item, index) => (
                                            <tr key={index} className="bg-background border-b border-border/50 hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3 font-medium">{index + 1}</td>
                                                <td className="px-4 py-3 font-mono text-xs">{item.transactionId}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-semibold">
                                                        {item.metadata?.operator || item.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-semibold">₹{item.amount}</td>
                                                <td className="px-4 py-3">₹0</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-3 py-1 text-xs font-medium border rounded-full ${
                                                        item.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                                        item.status === 'FAILED' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                                        'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Clock size={24} className="opacity-50" />
                                                        <p>No transaction history found</p>
                                                    </div>
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

            {/* Set PIN Modal */}
            {showSetPinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border p-6 flex flex-col gap-6 relative animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setShowSetPinModal(false)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex flex-col items-center gap-3 text-center pt-2">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                                <Lock size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground">Set Transaction PIN</h2>
                            <p className="text-sm text-muted-foreground">
                                You need to set a 4-digit secure PIN for wallet transfers.
                            </p>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-foreground/80 pl-1">New PIN</label>
                            <input 
                                type="password"
                                maxLength={4}
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                                placeholder="Enter 4-digit PIN"
                                className="w-full p-4 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-background shadow-sm transition-all text-center tracking-[1em] font-mono text-xl"
                            />
                        </div>
                        
                        <button
                            onClick={handleSetPin}
                            disabled={loading || newPin.length !== 4}
                            className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Set PIN"}
                        </button>
                    </div>
                </div>
            )}

            {/* Enter PIN Modal */}
            {showEnterPinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border p-6 flex flex-col gap-6 relative animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => {
                                setShowEnterPinModal(false);
                                setPin("");
                            }}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex flex-col items-center gap-3 text-center pt-2">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                                <Lock size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground">Confirm Transfer</h2>
                            <p className="text-sm text-muted-foreground">
                                Enter your 4-digit PIN to transfer ₹{amount} to your Main Wallet.
                            </p>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-foreground/80 pl-1">Transaction PIN</label>
                            <input 
                                type="password"
                                maxLength={4}
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                placeholder="Enter 4-digit PIN"
                                className="w-full p-4 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-background shadow-sm transition-all text-center tracking-[1em] font-mono text-xl"
                            />
                        </div>
                        
                        <button
                            onClick={handleConfirmTransfer}
                            disabled={loading || pin.length !== 4}
                            className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirm Transfer"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalletTransfer;