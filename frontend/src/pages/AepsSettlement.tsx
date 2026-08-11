import { useState, useEffect } from 'react';
import { Send, Plus, Building2, Clock, Trash2, RefreshCw, SearchCheck, FileUp } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const isSettlementWindow = () => {
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return mins >= 9 * 60 && mins < 21 * 60;
};

const SETTLEMENT_BASE_CHARGE = 5;
const SETTLEMENT_GST_RATE = 18;
const SETTLEMENT_GST_AMOUNT = Math.round(SETTLEMENT_BASE_CHARGE * (SETTLEMENT_GST_RATE / 100) * 100) / 100;
const SETTLEMENT_FEE = SETTLEMENT_BASE_CHARGE + SETTLEMENT_GST_AMOUNT;
const SETTLEMENT_MIN = 100;
const SETTLEMENT_MAX = 25000;

const AepsSettlement = () => {
    const { token } = useAuth();
    const [savedBanks, setSavedBanks] = useState<any[]>([]);
    const [availableBanks, setAvailableBanks] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedBankId, setSelectedBankId] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [checkingId, setCheckingId] = useState('');
    const [checkingBankStatusId, setCheckingBankStatusId] = useState('');
    const [uploadDocBankId, setUploadDocBankId] = useState<string | null>(null);
    const [docType, setDocType] = useState<'PAN' | 'AADHAAR'>('PAN');
    const [docFiles, setDocFiles] = useState<{ passbook?: File; panimage?: File; front_aadhar?: File; back_aadhar?: File }>({});
    const [uploading, setUploading] = useState(false);

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
        ifscCode: '',
        accountHolderName: ''
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
                const banks: any[] = res.data.data;
                setSavedBanks(banks);
                setSelectedBankId(prevId => {
                    if (banks.length === 0) return '';
                    if (prevId && banks.some(b => b._id === prevId)) return prevId;
                    return banks[0]._id;
                });
            }
        } catch (error) {
            console.error("Failed to fetch saved banks", error);
        }
    };

    const handleSyncBanks = async () => {
        setSyncing(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/sync-banks`, getHeaders());
            if (res.data.success) {
                toast.success(`Synced ${res.data.synced ?? 0} bank account(s) from PaySprint`);
                fetchSavedBanks();
            } else {
                toast.error(res.data.message || "Failed to sync banks");
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || "Failed to sync banks");
        }
        setSyncing(false);
    };

    const handleCheckStatus = async (txnId: string) => {
        setCheckingId(txnId);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/status`, { transactionId: txnId }, getHeaders());
            if (res.data.success) {
                const msg = res.data.message || "Status checked";
                toast.success(msg);
            } else {
                toast.error(res.data.message || "Status enquiry failed");
            }
            fetchHistory();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || "Failed to check settlement status");
        }
        setCheckingId('');
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

    const handleCheckBankStatus = async (id: string) => {
        setCheckingBankStatusId(id);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/account-status/${id}`, getHeaders());
            if (res.data.success) {
                toast.success(res.data.message || "Account status checked");
            } else {
                toast.error(res.data.message || "Failed to check account status");
            }
            fetchSavedBanks();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to check account status");
        }
        setCheckingBankStatusId('');
    };

    const handleUploadDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadDocBankId) return;

        if (!docFiles.passbook) return toast.error("Please upload the passbook / bank statement image (required for all accounts)");
        const hasFile = docFiles.passbook || docFiles.panimage || docFiles.front_aadhar || docFiles.back_aadhar;
        if (!hasFile) return toast.error("Please select at least one document file");

        setUploading(true);
        const formData = new FormData();
        formData.append('bankId', uploadDocBankId);
        formData.append('doctype', docType);
        if (docFiles.passbook) formData.append('passbook', docFiles.passbook);
        if (docFiles.panimage) formData.append('panimage', docFiles.panimage);
        if (docFiles.front_aadhar) formData.append('front_aadhar', docFiles.front_aadhar);
        if (docFiles.back_aadhar) formData.append('back_aadhar', docFiles.back_aadhar);

        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/upload-document`, formData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                toast.success(res.data.message || "Document uploaded successfully");
                setUploadDocBankId(null);
                setDocFiles({});
                fetchSavedBanks();
            } else {
                toast.error(res.data.message || "Failed to upload document");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to upload document");
        }
        setUploading(false);
    };

    const handleAddBank = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/add-bank`, bankData, getHeaders());
            if (res.data.success) {
                toast.success("Bank account added successfully!");
                setShowAddBank(false);
                setBankData({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '' });
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

        const amt = Number(amount);
        if (amt < SETTLEMENT_MIN || amt > SETTLEMENT_MAX) {
            return toast.error(`Settlement amount must be between ₹${SETTLEMENT_MIN} and ₹${SETTLEMENT_MAX}`);
        }

        if (!isSettlementWindow()) {
            return toast.error("AEPS Settlement is available from 9 AM to 9 PM IST only. Please try again during service hours.");
        }
        
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/initiate`, {
                bankId: selectedBankId,
                amount: amt,
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
    const uploadDocBank = uploadDocBankId ? savedBanks.find(b => b._id === uploadDocBankId) : null;

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
                        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-border/50 pb-2">
                            <h2 className="text-lg font-bold text-foreground">Transfer to Bank</h2>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleSyncBanks}
                                    disabled={syncing}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                                    title="Sync settlement accounts from PaySprint"
                                >
                                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                    {syncing ? 'Syncing...' : 'Sync Banks'}
                                </button>
                                <button 
                                    onClick={() => setShowAddBank(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-medium transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Bank
                                </button>
                            </div>
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
                                                    <option key={bank._id} value={bank._id}>
                                                        {bank.status === 'VERIFIED' ? '✓ ' : bank.status === 'PENDING' ? '⏳ ' : '✗ '}{bank.bankName}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                        {selectedBankId && (
                                            <>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleCheckBankStatus(selectedBankId)}
                                                    disabled={checkingBankStatusId === selectedBankId || !selectedBank?.beneId}
                                                    className="px-3 py-2 text-primary hover:text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-md transition-colors flex items-center justify-center shrink-0 disabled:opacity-50"
                                                    title="Check activation status on PaySprint"
                                                >
                                                    <SearchCheck className={`w-4 h-4 ${checkingBankStatusId === selectedBankId ? 'animate-pulse' : ''}`} />
                                                </button>
                                                {selectedBank && selectedBank.status !== 'VERIFIED' && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => { setUploadDocBankId(selectedBank._id); setDocType('PAN'); setDocFiles({}); }}
                                                        className="px-3 py-2 text-yellow-600 hover:text-yellow-700 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-md transition-colors flex items-center justify-center shrink-0"
                                                        title="Upload supportive document to activate account"
                                                    >
                                                        <FileUp className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleDeleteBank(selectedBankId)}
                                                    className="px-3 py-2 text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md transition-colors flex items-center justify-center shrink-0"
                                                    title="Delete Bank Account"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
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
                                    {selectedBank && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            selectedBank.status === 'VERIFIED' ? 'bg-green-500/10 text-green-500' :
                                            selectedBank.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-600' :
                                            'bg-red-500/10 text-red-500'
                                        }`}>
                                            {selectedBank.status === 'VERIFIED' ? '● Active' :
                                             selectedBank.status === 'PENDING' ? '● Pending Activation' : '● Rejected'}
                                        </span>
                                    )}
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
                                            min={SETTLEMENT_MIN}
                                            max={SETTLEMENT_MAX}
                                            className="w-full pl-8 pr-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                        />
                                    </div>
                                    {Number(amount) >= SETTLEMENT_MIN && Number(amount) <= SETTLEMENT_MAX && (
                                        <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                                            <div className="flex justify-between">
                                                <span>Amount credited to bank</span>
                                                <span className="text-foreground font-medium">₹{Number(amount).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Settlement charge (₹{SETTLEMENT_BASE_CHARGE} + {SETTLEMENT_GST_RATE}% GST)</span>
                                                <span className="text-foreground font-medium">₹{SETTLEMENT_FEE.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-border/40 pt-1 font-semibold">
                                                <span>Total deduction from AEPS Wallet</span>
                                                <span className="text-primary">₹{(Number(amount) + SETTLEMENT_FEE).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
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
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 rounded-tr-lg">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
                                                <div className="flex flex-col">
                                                    <span>{tx.transactionId}</span>
                                                    {tx.metadata?.utr && (
                                                        <span className="text-green-600/80">UTR: {tx.metadata.utr}</span>
                                                    )}
                                                </div>
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
                                            <td className="px-4 py-3">
                                                {(tx.status === 'PROCESSING' || tx.status === 'PENDING') && (
                                                    <button
                                                        onClick={() => handleCheckStatus(tx.transactionId)}
                                                        disabled={checkingId === tx.transactionId}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        <SearchCheck className="w-3.5 h-3.5" />
                                                        {checkingId === tx.transactionId ? 'Checking...' : 'Check Status'}
                                                    </button>
                                                )}
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
                                        <strong>NPCI Strict Rule:</strong> For self (savings) accounts the Account Holder Name must match your official KYC PAN/Aadhaar Name and is used automatically.
                                    </p>
                                    <p className="text-xs text-primary leading-relaxed">
                                        For a business / current account, enter the exact Account Holder Name below (as per bank records) so the penny-drop validates it.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Account Holder Name <span className="text-muted-foreground">(current/business accounts)</span></label>
                                    <input
                                        type="text"
                                        value={bankData.accountHolderName}
                                        onChange={e => setBankData({...bankData, accountHolderName: e.target.value})}
                                        placeholder="Leave blank for self (KYC name) account"
                                        className="w-full px-3 py-2 bg-background border border-border rounded-md focus:border-primary outline-none text-foreground"
                                    />
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

            {/* Upload Supportive Document Modal */}
            {uploadDocBank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-foreground mb-1 border-b border-border/50 pb-2 flex items-center gap-2">
                                <FileUp className="w-5 h-5 text-yellow-500" />
                                Upload Supportive Document
                            </h3>
                            <div className="mb-4 text-sm">
                                <p className="font-medium text-foreground">{uploadDocBank.bankName}</p>
                                <p className="text-xs text-muted-foreground">A/C: {uploadDocBank.accountNumber}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    This account requires a supportive document to activate. Once verified, it will become eligible for settlement.
                                </p>
                            </div>
                            <form onSubmit={handleUploadDocument} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Document Type</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setDocType('PAN')}
                                            className={`flex-1 py-2 rounded-lg font-medium transition-colors border ${
                                                docType === 'PAN'
                                                    ? 'bg-primary/10 text-primary border-primary/40'
                                                    : 'bg-background border-border text-foreground hover:bg-muted'
                                            }`}
                                        >
                                            PAN / Passbook
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDocType('AADHAAR')}
                                            className={`flex-1 py-2 rounded-lg font-medium transition-colors border ${
                                                docType === 'AADHAAR'
                                                    ? 'bg-primary/10 text-primary border-primary/40'
                                                    : 'bg-background border-border text-foreground hover:bg-muted'
                                            }`}
                                        >
                                            Aadhaar
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Passbook / Bank Statement Image (required)</label>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpg,image/jpeg"
                                        onChange={e => setDocFiles({ ...docFiles, passbook: e.target.files?.[0] || undefined })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Savings: upload passbook page. Current account: upload first page of account statement or a cancelled cheque.
                                    </p>
                                </div>

                                {docType === 'PAN' ? (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-foreground">PAN Image (optional)</label>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpg,image/jpeg"
                                            onChange={e => setDocFiles({ ...docFiles, panimage: e.target.files?.[0] || undefined })}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-foreground">Aadhaar Front</label>
                                            <input
                                                type="file"
                                                accept="image/png,image/jpg,image/jpeg"
                                                onChange={e => setDocFiles({ ...docFiles, front_aadhar: e.target.files?.[0] || undefined })}
                                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-foreground">Aadhaar Back</label>
                                            <input
                                                type="file"
                                                accept="image/png,image/jpg,image/jpeg"
                                                onChange={e => setDocFiles({ ...docFiles, back_aadhar: e.target.files?.[0] || undefined })}
                                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3 pt-4 border-t border-border/50">
                                    <button
                                        type="button"
                                        onClick={() => { setUploadDocBankId(null); setDocFiles({}); }}
                                        className="flex-1 py-2 bg-background border border-border hover:bg-muted text-foreground rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={uploading}
                                        className="flex-1 py-2 bg-white text-black hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        {uploading ? 'Uploading...' : 'Upload Document'}
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
