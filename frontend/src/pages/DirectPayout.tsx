import { useState, useEffect } from 'react';
import { Send, Wallet } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const DirectPayout = () => {
    const { token } = useAuth();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [availableBanks, setAvailableBanks] = useState<any[]>([]);

    // Form states
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifscCode, setIfscCode] = useState('');
    const [accountHolderName, setAccountHolderName] = useState('');
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [mode, setMode] = useState('IMPS');

    const getHeaders = () => ({ headers: { 'Authorization': `Bearer ${token}` } });

    useEffect(() => {
        fetchHistory();
        fetchAvailableBanks();
    }, []);

    const fetchHistory = async () => {
        try {
            // Reusing settlement history endpoint but filtering on backend? 
            // Currently our backend getSettlementHistory only fetches AEPS_SETTLEMENT.
            // Let's create a specific fetch if needed, or just let it be empty for now and add a history endpoint later.
            // For now, we'll leave it empty to avoid 404s.
        } catch (error) {
            console.error("Failed to fetch payout history", error);
        }
    };

    const fetchAvailableBanks = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/banks`);
            if (res.data.success && res.data.data) {
                setAvailableBanks(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch available banks", error);
        }
    };

    const handlePayout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accountNumber || !ifscCode || !accountHolderName || !amount || !pin || !bankName) {
            return toast.error("Please fill all required fields");
        }
        
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/direct-payout`, {
                bankName,
                accountNumber,
                ifscCode,
                accountHolderName,
                amount: Number(amount),
                pin,
                mode
            }, getHeaders());

            if (res.data.success) {
                toast.success("Direct payout submitted successfully!");
                setAmount('');
                setPin('');
                setAccountNumber('');
                setIfscCode('');
                setAccountHolderName('');
                setBankName('');
                fetchHistory(); 
                window.dispatchEvent(new Event('wallet-updated'));
            } else {
                toast.error(res.data.message || "Direct payout failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to initiate direct payout");
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-3">
                        <Wallet className="w-7 h-7 text-primary" />
                        Direct Payout (B2B)
                    </h1>
                </div>
            </div>

            {/* Main Container */}
            <div className="flex flex-col gap-6 glass-card p-6 rounded-2xl relative overflow-hidden group border border-border">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col gap-6">
                    <div className="flex flex-col gap-4 bg-primary/5 p-5 border-l-4 border-primary rounded-lg">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                            <h2 className="text-lg font-bold text-foreground">Transfer to Any Beneficiary</h2>
                            <span className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-600 rounded-full font-medium">Deducts from Main Wallet</span>
                        </div>

                        <form onSubmit={handlePayout} className="space-y-6 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Bank Name</label>
                                    <select
                                        value={bankName}
                                        onChange={e => setBankName(e.target.value)}
                                        required
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                    >
                                        <option value="">Select a Bank</option>
                                        {availableBanks.map((bank: any, idx) => (
                                            <option key={idx} value={bank.bankName || bank.name}>
                                                {bank.bankName || bank.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Account Number</label>
                                    <input 
                                        type="text" 
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter Account Number"
                                        required
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">IFSC Code</label>
                                    <input 
                                        type="text" 
                                        value={ifscCode}
                                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. SBIN0001234"
                                        required
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Beneficiary Name</label>
                                    <input 
                                        type="text" 
                                        value={accountHolderName}
                                        onChange={(e) => setAccountHolderName(e.target.value)}
                                        placeholder="Enter Beneficiary Name"
                                        required
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Amount (₹)</label>
                                    <input 
                                        type="number" 
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        required
                                        min="100"
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Wallet PIN</label>
                                    <input 
                                        type="password" 
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Enter 4-6 digit PIN"
                                        required
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Transaction Mode</label>
                                    <select 
                                        value={mode}
                                        onChange={(e) => setMode(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                    >
                                        <option value="IMPS">IMPS</option>
                                        <option value="NEFT">NEFT</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-center pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-10 py-2.5 bg-white text-black hover:bg-gray-100 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    <Send className="w-4 h-4" />
                                    {loading ? 'Processing...' : 'Submit Payout'}
                                </button>
                            </div>
                        </form>

                        <div className="mt-4 pt-4 border-t border-border/50">
                            <p className="text-sm text-foreground/80 leading-relaxed">
                                <strong className="text-foreground">Note (Only For IMPS):</strong> ₹3.00 will be deducted from your Main Wallet for transfers between ₹100 and ₹10,000.<br/>
                                ₹5.00 will be deducted for transfers between ₹10,001 and ₹25,000.<br/>
                                ₹8.00 will be deducted for transfers above ₹25,000 up to ₹500,000.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DirectPayout;