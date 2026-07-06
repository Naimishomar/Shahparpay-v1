import { useState, useEffect } from 'react';
import { Send, Plus, X, Search, FileText, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const FundRequest = () => {
    const { token } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Form States
    const [formData, setFormData] = useState({
        transactionMode: '',
        amount: '',
        bankUtr: '',
        depositDate: '',
        remarks: ''
    });
    const [depositSlip, setDepositSlip] = useState<File | null>(null);

    const fetchRequests = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/retailer`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                setRequests(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch fund requests", error);
        }
    };

    useEffect(() => {
        if (token) fetchRequests();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.transactionMode || !formData.amount || !formData.bankUtr || !formData.depositDate) {
            return toast.error("Please fill all required fields");
        }

        const data = new FormData();
        data.append('transactionMode', formData.transactionMode);
        data.append('amount', formData.amount);
        data.append('bankUtr', formData.bankUtr);
        data.append('depositDate', formData.depositDate);
        data.append('remarks', formData.remarks);
        if (depositSlip) {
            data.append('depositSlip', depositSlip);
        }

        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/create`, data, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (res.data.success) {
                toast.success("Fund request submitted successfully");
                setShowAddModal(false);
                setFormData({ transactionMode: '', amount: '', bankUtr: '', depositDate: '', remarks: '' });
                setDepositSlip(null);
                fetchRequests();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to submit fund request");
        }
        setLoading(false);
    };

    const handleDeleteRequest = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this fund request?")) return;
        
        try {
            const res = await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/delete/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                toast.success("Fund request deleted successfully");
                fetchRequests();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to delete fund request");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'REJECTED': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                        <Send className="text-primary" size={28} />
                        Fund Request
                    </h1>
                    <p className="text-sm text-muted-foreground hidden md:block">
                        Request Main Wallet funds from your Distributor.
                    </p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/25"
                >
                    <Plus className="w-5 h-5" />
                    Create Request
                </button>
            </div>

            {/* Main Container */}
            <div className="flex flex-col glass-card rounded-2xl relative overflow-hidden group border border-border">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>
                
                <div className="relative z-10 p-6">
                    {/* Filters (Mock UI) */}
                    <div className="flex gap-4 mb-6">
                        <input type="date" className="bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors" />
                        <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Filter</button>
                        <button className="px-6 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors">Reset</button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-border bg-background/50">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                                    <th className="p-4 font-medium text-sm">#</th>
                                    <th className="p-4 font-medium text-sm">Txn Mode</th>
                                    <th className="p-4 font-medium text-sm">Amount</th>
                                    <th className="p-4 font-medium text-sm">Bank UTR</th>
                                    <th className="p-4 font-medium text-sm">Deposit Date</th>
                                    <th className="p-4 font-medium text-sm">Deposit Slip</th>
                                    <th className="p-4 font-medium text-sm">Remarks</th>
                                    <th className="p-4 font-medium text-sm">Status</th>
                                    <th className="p-4 font-medium text-sm">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                            No fund requests found.
                                        </td>
                                    </tr>
                                ) : (
                                    requests.map((req, index) => (
                                        <tr key={req._id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-4 text-sm text-foreground/80">{index + 1}</td>
                                            <td className="p-4 font-medium text-foreground">{req.transactionMode}</td>
                                            <td className="p-4 font-bold text-foreground">₹{req.amount}</td>
                                            <td className="p-4 font-mono text-sm text-primary">{req.bankUtr}</td>
                                            <td className="p-4 text-sm text-foreground/70">{new Date(req.depositDate).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                {req.depositSlipUrl ? (
                                                    <a href={req.depositSlipUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline text-sm">
                                                        <FileText className="w-4 h-4" /> View
                                                    </a>
                                                ) : <span className="text-muted-foreground text-sm">N/A</span>}
                                            </td>
                                            <td className="p-4 text-sm text-foreground/70 truncate max-w-[150px]" title={req.remarks}>{req.remarks || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(req.status)}`}>
                                                    {req.status}
                                                </span>
                                                {req.adminRemarks && <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[120px]" title={req.adminRemarks}>{req.adminRemarks}</div>}
                                            </td>
                                            <td className="p-4">
                                                {req.status === 'PENDING' && (
                                                    <button 
                                                        onClick={() => handleDeleteRequest(req._id)}
                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Delete Request"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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

            {/* Add Fund Request Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-border">
                        
                        <div className="flex justify-between items-center p-6 border-b border-border bg-muted/30">
                            <h2 className="text-xl font-semibold text-foreground">Add Fund Request</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Transaction Mode *</label>
                                    <select 
                                        required
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        value={formData.transactionMode}
                                        onChange={(e) => setFormData({...formData, transactionMode: e.target.value})}
                                    >
                                        <option value="">Select mode</option>
                                        <option value="IMPS">IMPS</option>
                                        <option value="NEFT">NEFT</option>
                                        <option value="RTGS">RTGS</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Cash Deposit">Cash Deposit</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Deposit Amount *</label>
                                    <input 
                                        type="number" 
                                        required min="1"
                                        placeholder="Enter amount" 
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Bank UTR / Ref ID *</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="Enter UTR" 
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        value={formData.bankUtr}
                                        onChange={(e) => setFormData({...formData, bankUtr: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Deposit Date *</label>
                                    <input 
                                        type="date" 
                                        required
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        value={formData.depositDate}
                                        onChange={(e) => setFormData({...formData, depositDate: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium text-foreground">Upload Deposit Slip</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,.pdf"
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                        onChange={(e) => setDepositSlip(e.target.files ? e.target.files[0] : null)}
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium text-foreground">Remark</label>
                                    <textarea 
                                        rows={3}
                                        placeholder="Optional remarks..."
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                                    />
                                </div>

                            </div>

                            <div className="mt-8 flex justify-center">
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="px-12 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
                                >
                                    {loading ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FundRequest;