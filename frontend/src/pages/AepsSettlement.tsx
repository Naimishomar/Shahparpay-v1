import { useState, useEffect } from 'react';
import { Send, Plus, Building2, Clock, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AepsSettlement = () => {
    const { token } = useAuth();
    const [savedBanks, setSavedBanks] = useState<any[]>([]);
    const [availableBanks, setAvailableBanks] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedBankId, setSelectedBankId] = useState('');
    const [loading, setLoading] = useState(false);

    // Form states
    const [beneficiaryMobile, setBeneficiaryMobile] = useState('');
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [mode, setMode] = useState('IMPS');

    // Add Bank Modal state
    const [showAddBank, setShowAddBank] = useState(false);
    const [bankData, setBankData] = useState({
        bankName: '',
        accountNumber: '',
        ifscCode: ''
    });

    const getHeaders = () => ({ headers: { 'Authorization': `Bearer ${token}` } });

    useEffect(() => {
        fetchSavedBanks();
        fetchAvailableBanks();
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/history`, getHeaders());
            if (res.data.success) {
                setHistory(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch settlement history", error);
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

    const fetchSavedBanks = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/saved-banks`, getHeaders());
            if (res.data.success) {
                setSavedBanks(res.data.data);
                if (res.data.data.length > 0) {
                    setSelectedBankId(res.data.data[0]._id);
                } else {
                    setSelectedBankId('');
                }
            }
        } catch (error) {
            console.error("Failed to fetch saved banks", error);
        }
    };

    const handleDeleteBank = async (id: string) => {
        if (!confirm("Are you sure you want to remove this bank account?")) return;
        
        try {
            const res = await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/bank/${id}`, getHeaders());
            if (res.data.success) {
                toast.success("Bank account removed successfully!");
                fetchSavedBanks();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to remove bank account");
        }
    };

    const handleAddBank = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/add-bank`, bankData, getHeaders());
            if (res.data.success) {
                toast.success("Bank account added successfully!");
                setShowAddBank(false);
                setBankData({ bankName: '', accountNumber: '', ifscCode: '' });
                fetchSavedBanks();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to add bank account");
        }
        setLoading(false);
    };

    const handleSettlement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBankId || !amount || !pin) {
            return toast.error("Please fill all required fields");
        }
        
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/initiate`, {
                bankId: selectedBankId,
                amount: Number(amount),
                pin,
                mode,
                beneficiaryMobile
            }, getHeaders());

            if (res.data.success) {
                toast.success("Settlement request submitted successfully!");
                setAmount('');
                setPin('');
                fetchHistory(); // refresh history after settlement
            } else {
                toast.error(res.data.message || "Settlement failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to initiate settlement");
        }
        window.dispatchEvent(new Event('wallet-updated'));
        setLoading(false);
    };

    const selectedBank = savedBanks.find(b => b._id === selectedBankId);

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-3">
                        <Building2 className="w-7 h-7 text-primary" />
                        AEPS Settlement
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
                            <h2 className="text-lg font-bold text-foreground">Transfer to Bank</h2>
                            <button 
                                onClick={() => setShowAddBank(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Bank
                            </button>
                        </div>

                        <form onSubmit={handleSettlement} className="space-y-6 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Row 1 */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground flex justify-between">
                                        <span>Bank Name</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <select 
                                            value={selectedBankId}
                                            onChange={(e) => setSelectedBankId(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                        >
                                            {savedBanks.length === 0 ? (
                                                <option value="">No banks added</option>
                                            ) : (
                                                savedBanks.map(bank => (
                                                    <option key={bank._id} value={bank._id}>{bank.bankName}</option>
                                                ))
                                            )}
                                        </select>
                                        {selectedBankId && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleDeleteBank(selectedBankId)}
                                                className="px-3 py-2 text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md transition-colors flex items-center justify-center shrink-0"
                                                title="Delete Bank Account"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Account Number</label>
                                    <input 
                                        type="text" 
                                        disabled
                                        value={selectedBank?.accountNumber || ''}
                                        placeholder="Account Number"
                                        className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-md text-muted-foreground cursor-not-allowed shadow-sm"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">IFSC Code</label>
                                    <input 
                                        type="text" 
                                        disabled
                                        value={selectedBank?.ifscCode || ''}
                                        placeholder="IFSC Code"
                                        className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-md text-muted-foreground cursor-not-allowed shadow-sm"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Beneficiary Name</label>
                                    <input 
                                        type="text" 
                                        disabled
                                        value={selectedBank?.accountHolderName || ''}
                                        placeholder="Beneficiary Name"
                                        className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-md text-muted-foreground cursor-not-allowed shadow-sm"
                                    />
                                </div>

                                {/* Row 2 */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Beneficiary Mobile</label>
                                    <input 
                                        type="text" 
                                        value={beneficiaryMobile}
                                        onChange={(e) => setBeneficiaryMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="Enter Mobile"
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Amount</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-muted-foreground">₹</span>
                                        </div>
                                        <input 
                                            type="number" 
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            placeholder="0.00"
                                            required
                                            className="w-full pl-8 pr-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Transaction PIN</label>
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
                                    disabled={loading || !selectedBankId}
                                    className="px-10 py-2.5 bg-white text-black hover:bg-gray-100 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    <Send className="w-4 h-4" />
                                    {loading ? 'Processing...' : 'Submit Settlement'}
                                </button>
                            </div>
                        </form>

                        <div className="mt-4 pt-4 border-t border-border/50">
                            <p className="text-sm font-semibold text-foreground/90">Primary</p>
                            <p className="text-sm text-foreground/80 leading-relaxed mt-1">
                                All 6 Auto Settlement will credit in this account without charges.<br/>
                                <strong className="text-foreground">Note :-</strong> 0.2% charges is applicable on each manual settelment transaction.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* History Section */}
            <div className="flex flex-col gap-4 glass-card p-6 rounded-2xl relative overflow-hidden mt-6">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-50 pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border/50 pb-3">
                        <Clock className="w-5 h-5 text-primary" />
                        Settlement History
                    </h2>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Date</th>
                                    <th className="px-4 py-3">Reference ID</th>
                                    <th className="px-4 py-3">Bank Details</th>
                                    <th className="px-4 py-3">Amount</th>
                                    <th className="px-4 py-3 rounded-tr-lg">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            No settlement history found.
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((tx: any, idx) => (
                                        <tr key={idx} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-3 text-foreground">
                                                {new Date(tx.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                {tx.transactionId}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground">{tx.metadata?.bankName}</span>
                                                    <span className="text-xs text-muted-foreground">A/C: {tx.metadata?.bankAccount}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-foreground">
                                                ₹{tx.amount}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                                    tx.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' :
                                                    tx.status === 'FAILED' ? 'bg-red-500/10 text-red-500' :
                                                    'bg-yellow-500/10 text-yellow-500'
                                                }`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Bank Modal */}
            {showAddBank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-foreground mb-4 border-b border-border/50 pb-2">Add Bank Account</h3>
                            <form onSubmit={handleAddBank} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Bank Name</label>
                                    <select
                                        value={bankData.bankName}
                                        onChange={e => setBankData({...bankData, bankName: e.target.value})}
                                        required
                                        className="w-full px-3 py-2 bg-background border border-border rounded-md focus:border-primary outline-none text-foreground"
                                    >
                                        <option value="">Select a Bank</option>
                                        {availableBanks.map((bank: any, idx) => (
                                            <option key={idx} value={bank.bankName || bank.name}>
                                                {bank.bankName || bank.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5 p-3 bg-primary/10 border border-primary/20 rounded-md">
                                    <p className="text-xs text-primary leading-relaxed">
                                        <strong>NPCI Strict Rule:</strong> To prevent fraud, the Account Holder Name will automatically be populated from your official KYC PAN/Aadhaar Name.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Account Number</label>
                                    <input
                                        type="text"
                                        value={bankData.accountNumber}
                                        onChange={e => setBankData({...bankData, accountNumber: e.target.value.replace(/\D/g, '')})}
                                        placeholder="Account Number"
                                        required
                                        className="w-full px-3 py-2 bg-background border border-border rounded-md focus:border-primary outline-none text-foreground"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">IFSC Code</label>
                                    <input
                                        type="text"
                                        value={bankData.ifscCode}
                                        onChange={e => setBankData({...bankData, ifscCode: e.target.value.toUpperCase()})}
                                        placeholder="e.g. SBIN0001234"
                                        required
                                        className="w-full px-3 py-2 bg-background border border-border rounded-md focus:border-primary outline-none text-foreground"
                                    />
                                </div>
                                
                                <div className="flex gap-3 pt-4 border-t border-border/50">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddBank(false)}
                                        className="flex-1 py-2 bg-background border border-border hover:bg-muted text-foreground rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 py-2 bg-white text-black hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        {loading ? 'Adding...' : 'Add Bank'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AepsSettlement;
