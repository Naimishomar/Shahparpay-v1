import { useState, useEffect } from 'react';
import { Search, UserPlus, Send, Plus, CreditCard, Lock, CheckCircle2, X, Trash, Fingerprint, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const DMT = () => {
    const { token } = useAuth();
    
    // States
    const [mobile, setMobile] = useState('');
    const [remitter, setRemitter] = useState<any>(null);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Registration States
    const [showEkycModal, setShowEkycModal] = useState(false);
    const [aadhaar, setAadhaar] = useState('');
    const [showRegister, setShowRegister] = useState(false);
    const [regData, setRegData] = useState({ firstName: '', lastName: '', pincode: '' });
    const [showOtp, setShowOtp] = useState(false);
    const [otp, setOtp] = useState('');
    const [stateResp, setStateResp] = useState('');

    // Beneficiary States
    const [beneData, setBeneData] = useState({ bankid: '', benename: '', beneaccount: '', ifsc: '', pincode: '' });
    const [banks, setBanks] = useState<any[]>([]);
    
    const [successTxn, setSuccessTxn] = useState<any>(null);
    const [transferBene, setTransferBene] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [showAddBene, setShowAddBene] = useState(false);

    const getHeaders = () => ({ headers: { 'Authorization': `Bearer ${token}` } });

    // 1. Search Remitter
    const handleSearch = async () => {
        if (!mobile || mobile.length < 10) return toast.error("Enter valid 10-digit mobile number");
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/remitter/query`, { mobile }, getHeaders());
            const paysprintData = res.data.data;

            if (res.data.success && paysprintData?.status) {
                setRemitter(paysprintData.data);
                toast.success("Remitter found");
                fetchBeneficiaries(mobile);
            } else if (paysprintData && (paysprintData.response_code == 0 || paysprintData.response_code === "0")) {
                toast.info("Remitter not found. Aadhaar E-KYC is mandated by RBI.");
                setShowEkycModal(true);
            } else {
                toast.error(paysprintData?.message || "Failed to query remitter");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to query remitter");
        }
        setLoading(false);
    };

    // 1.5. Remitter E-KYC
    const handleCaptureAndEkyc = async () => {
        if (aadhaar.length !== 12) return toast.error("Enter valid 12-digit Aadhaar");
        setLoading(true);
        try {
            const ports = [11100, 11101, 11102];
            let activeUrl = null;
            
            const captureXml = `<?xml version="1.0"?>
                <PidOptions ver="1.0">
                  <Opts fCount="1" fType="2" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" env="P" wadh="E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=" posh="UNKNOWN" />
                </PidOptions>`;

            for (const port of ports) {
                const url = `http://127.0.0.1:${port}`;
                try {
                    const res = await fetch(`${url}/rd/info`, { method: 'RDSERVICE', headers: { 'Accept': 'text/xml' }, signal: AbortSignal.timeout(500) });
                    if (res.ok) { activeUrl = url; break; }
                } catch (e) {
                    try {
                        const urlHttps = `https://127.0.0.1:${port}`;
                        const resHttps = await fetch(`${urlHttps}/rd/info`, { method: 'RDSERVICE', headers: { 'Accept': 'text/xml' }, signal: AbortSignal.timeout(500) });
                        if (resHttps.ok) { activeUrl = urlHttps; break; }
                    } catch (e2) { continue; }
                }
            }

            if (!activeUrl) {
                toast.error("RD Service not found. Please ensure your Biometric scanner is connected.");
                setLoading(false);
                return;
            }

            const captureResponse = await fetch(`${activeUrl}/rd/capture`, {
                method: 'CAPTURE',
                body: captureXml,
                headers: { 'Content-Type': 'text/xml', 'Accept': 'text/xml' }
            });
            const capturedData = await captureResponse.text();

            if (!capturedData.includes('errCode="0"')) {
                toast.error("Biometric capture failed. Please clean the scanner and try again.");
                setLoading(false);
                return;
            }

            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/remitter/ekyc`, {
                mobile,
                aadhaar_number: aadhaar,
                pidData: capturedData
            }, getHeaders());

            if (res.data.success && res.data.data?.status) {
                toast.success("E-KYC successful! Please complete registration.");
                setShowEkycModal(false);
                setShowRegister(true);
            } else {
                toast.error(res.data.data?.message || "E-KYC failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "E-KYC failed");
        }
        setLoading(false);
    };


    // 2. Register Remitter
    const handleRegister = async () => {
        if (!regData.firstName || !regData.lastName || !regData.pincode) return toast.error("All fields are required");
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/remitter/register`, { mobile, ...regData }, getHeaders());
            const paysprintData = res.data.data;

            if (res.data.success && paysprintData?.status) {
                toast.success(paysprintData?.message || "OTP sent successfully");
                setStateResp(paysprintData?.stateresp || paysprintData?.data?.stateresp || '');
                setShowRegister(false);
                setShowOtp(true);
            } else {
                toast.error(paysprintData?.message || "Failed to register remitter");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to register remitter");
        }
        setLoading(false);
    };

    // 3. Verify OTP
    const handleVerify = async () => {
        if (!otp) return toast.error("Enter OTP");
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/remitter/verify`, { mobile, otp, stateresp: stateResp }, getHeaders());
            const paysprintData = res.data.data;

            if (res.data.success && paysprintData?.status) {
                toast.success("Remitter verified successfully!");
                setShowOtp(false);
                setRemitter({ mobile, fname: regData.firstName, lname: regData.lastName });
                fetchBeneficiaries(mobile);
            } else {
                toast.error(paysprintData?.message || "Failed to verify OTP");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to verify OTP");
        }
        setLoading(false);
    };

    // 4. Fetch Beneficiaries
    const fetchBeneficiaries = async (mob: string) => {
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/beneficiary/fetch`, { mobile: mob }, getHeaders());
            const paysprintData = res.data.data;
            if (res.data.success && paysprintData?.status && paysprintData?.data) {
                setBeneficiaries(paysprintData.data);
            } else {
                setBeneficiaries([]);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to fetch beneficiaries");
        }
    };

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/banks`, {}, getHeaders());
                if (res.data.success && res.data.data?.data) {
                    setBanks(res.data.data.data);
                } else {
                    setBanks([]);
                    toast.error("Failed to load bank list");
                }
            } catch (error) {
                console.error("Failed to fetch banks", error);
                setBanks([]);
                toast.error("Failed to load bank list");
            }
        };
        if (token) fetchBanks();
    }, [token]);

    // 5. Add Beneficiary
    const handleAddBeneficiary = async () => {
        if (!beneData.bankid || !beneData.benename || !beneData.beneaccount || !beneData.ifsc || !beneData.pincode) {
            toast.error("Please fill all beneficiary details");
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/beneficiary/add`, {
                mobile,
                ...beneData
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data.success && res.data.data?.status) {
                toast.success("Beneficiary added successfully");
                setShowAddBene(false);
                fetchBeneficiaries(mobile); // Refresh list
            } else {
                toast.error(res.data.data?.message || res.data.message || "Failed to add beneficiary");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to add beneficiary");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBeneficiary = async (beneid: string) => {
        if (!window.confirm("Are you sure you want to delete this beneficiary?")) return;
        
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/beneficiary/delete`, {
                mobile,
                beneid
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data.success && res.data.data?.status) {
                toast.success("Beneficiary deleted successfully");
                fetchBeneficiaries(mobile); // Refresh list
            } else {
                toast.error(res.data.data?.message || res.data.message || "Failed to delete beneficiary");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to delete beneficiary");
        } finally {
            setLoading(false);
        }
    };

    // 6. Transfer Fund
    const handleTransfer = async () => {
        if (!amount || !pin) return toast.error("Enter amount and PIN");
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/dmt/transfer`, {
                mobile,
                beneid: transferBene.beneid,
                beneaccount: transferBene.accno,
                ifsc: transferBene.ifsc,
                amount: Number(amount),
                pin
            }, getHeaders());

            if (res.data.success) {
                toast.success("Transfer successful!");
                setSuccessTxn(res.data.transaction);
                setTransferBene(null);
                setAmount('');
                setPin('');
                window.dispatchEvent(new Event('wallet-updated'));
            } else {
                toast.error(res.data.message || "Transfer failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Transfer failed");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Send className="w-8 h-8 text-primary" />
                        Domestic Money Transfer (DMT)
                    </h1>
                    <p className="text-muted-foreground">Instantly transfer funds to any bank account in India.</p>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column: Remitter Search */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-xl font-bold text-foreground mb-4">Remitter Details</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1.5 block">Mobile Number</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-muted-foreground">+91</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={mobile}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length > 10) {
                                                    toast.error("Mobile number cannot exceed 10 digits");
                                                    return;
                                                }
                                                setMobile(val);
                                            }}
                                            placeholder="Enter 10-digit number"
                                            className="w-full pl-12 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={loading || mobile.length !== 10}
                                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Search className="w-4 h-4" />
                                    {loading ? 'Searching...' : 'Search Remitter'}
                                </button>
                            </div>

                            {/* Found Remitter Info */}
                            {remitter && !showRegister && !showOtp && !showEkycModal && (
                                <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary/10 rounded-full">
                                            <UserPlus className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{remitter.fname} {remitter.lname}</p>
                                            <p className="text-xs text-muted-foreground">+91 {mobile}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-primary/10">
                                        <span className="text-xs text-muted-foreground">Monthly Limit</span>
                                        <span className="text-sm font-bold text-primary dark:text-white">₹ {remitter.limit || 25000}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Beneficiaries & Transfer */}
                    <div className="lg:col-span-2">
                        {remitter && !showRegister && !showOtp && !showEkycModal ? (
                            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm min-h-[400px]">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-foreground">Saved Beneficiaries</h2>
                                    <button 
                                        onClick={() => setShowAddBene(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-medium transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add New
                                    </button>
                                </div>

                                {beneficiaries.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {beneficiaries.map((bene, idx) => (
                                            <div key={idx} className="p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="font-bold text-foreground">{bene.name}</h3>
                                                        <p className="text-xs text-muted-foreground">{bene.bankname}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteBeneficiary(bene.beneid); }}
                                                            className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                                                            title="Delete Beneficiary"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                        <div className="p-1.5 bg-background rounded-lg border border-border/50 shadow-sm">
                                                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 mb-4">
                                                    <p className="text-sm font-medium text-foreground">{bene.accno}</p>
                                                    <p className="text-xs text-muted-foreground uppercase">{bene.ifsc}</p>
                                                </div>
                                                <button 
                                                    onClick={() => setTransferBene(bene)}
                                                    className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                                >
                                                    Transfer Now
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-center">
                                        <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                                            <UserPlus className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground mb-1">No Beneficiaries</h3>
                                        <p className="text-sm text-muted-foreground mb-4 max-w-sm">Add a bank account to start transferring money instantly.</p>
                                        <button 
                                            onClick={() => setShowAddBene(true)}
                                            className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
                                        >
                                            Add Beneficiary
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[400px] text-center">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                    <Send className="w-10 h-10 text-primary opacity-80" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground mb-2">Ready to Transfer</h2>
                                <p className="text-muted-foreground max-w-md">Search for a remitter using their mobile number to view their saved beneficiaries and initiate a transfer.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* E-KYC Modal */}
            {showEkycModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl w-full max-w-md relative">
                        <button onClick={() => setShowEkycModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Fingerprint className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Remitter E-KYC</h2>
                                <p className="text-xs text-muted-foreground">Mandatory per RBI guidelines</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">Aadhaar Number</label>
                                <input 
                                    type="text" 
                                    maxLength={12}
                                    value={aadhaar} 
                                    onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))} 
                                    placeholder="Enter 12-digit Aadhaar"
                                    className="w-full px-3 py-3 bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20" 
                                />
                            </div>

                            <div className="bg-muted/30 border border-border/50 rounded-xl p-4 mt-2">
                                <p className="text-xs text-muted-foreground mb-3 text-center">Place your finger on the scanner and click capture</p>
                                <button 
                                    onClick={handleCaptureAndEkyc} 
                                    disabled={loading || aadhaar.length !== 12} 
                                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
                                    {loading ? 'Processing...' : 'Capture & Verify'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Registration Modal */}
            {showRegister && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl w-full max-w-md relative">
                        <button onClick={() => setShowRegister(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-foreground mb-4">Register Remitter</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-foreground mb-1 block">First Name</label>
                                    <input type="text" value={regData.firstName} onChange={e => setRegData({...regData, firstName: e.target.value})} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="text-sm text-foreground mb-1 block">Last Name</label>
                                    <input type="text" value={regData.lastName} onChange={e => setRegData({...regData, lastName: e.target.value})} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-foreground mb-1 block">Pincode</label>
                                <input type="text" maxLength={6} value={regData.pincode} onChange={e => setRegData({...regData, pincode: e.target.value.replace(/\D/g, '')})} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <button onClick={handleRegister} disabled={loading} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium mt-2">
                                {loading ? 'Sending OTP...' : 'Send OTP'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OTP Modal */}
            {showOtp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl w-full max-w-sm relative text-center">
                        <button onClick={() => setShowOtp(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-foreground mb-2">Verify Mobile</h2>
                        <p className="text-sm text-muted-foreground mb-6">Enter the OTP sent to +91 {mobile}</p>
                        
                        <input 
                            type="text" 
                            maxLength={6}
                            value={otp} 
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 6-digit OTP" 
                            className="w-full px-4 py-3 text-center tracking-widest text-lg font-bold bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20 mb-4" 
                        />
                        <button onClick={handleVerify} disabled={loading || otp.length < 4} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium">
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                    </div>
                </div>
            )}

            {/* Add Beneficiary Modal */}
            {showAddBene && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl w-full max-w-md relative">
                        <button onClick={() => setShowAddBene(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-foreground mb-4">Add Beneficiary</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-foreground mb-1 block">Bank</label>
                                <select 
                                    value={beneData.bankid} 
                                    onChange={e => setBeneData({...beneData, bankid: e.target.value})} 
                                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select Bank</option>
                                    {banks.map((bank: any) => (
                                        <option key={bank.bankid} value={bank.bankid}>{bank.bankname}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-foreground mb-1 block">Account Holder Name</label>
                                <input type="text" value={beneData.benename} onChange={e => setBeneData({...beneData, benename: e.target.value})} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="text-sm text-foreground mb-1 block">Account Number</label>
                                <input type="text" value={beneData.beneaccount} onChange={e => setBeneData({...beneData, beneaccount: e.target.value.replace(/\D/g, '')})} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-foreground mb-1 block">IFSC Code</label>
                                    <input type="text" value={beneData.ifsc} onChange={e => setBeneData({...beneData, ifsc: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 uppercase" />
                                </div>
                                <div>
                                    <label className="text-sm text-foreground mb-1 block">Pincode</label>
                                    <input type="text" maxLength={6} value={beneData.pincode} onChange={e => setBeneData({...beneData, pincode: e.target.value.replace(/\D/g, '')})} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                            <button onClick={handleAddBeneficiary} disabled={loading} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium mt-4">
                                {loading ? 'Adding...' : 'Add Beneficiary'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {transferBene && !successTxn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl w-full max-w-md relative">
                        <button onClick={() => {setTransferBene(null); setPin(''); setAmount('');}} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-foreground mb-1">Send Money</h2>
                        <p className="text-sm text-muted-foreground mb-6">To {transferBene.name} ({transferBene.accno})</p>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Amount (₹)</label>
                                <input 
                                    type="text" 
                                    value={amount} 
                                    onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                                    placeholder="0" 
                                    className="w-full px-4 py-3 text-2xl font-bold bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20" 
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block flex items-center gap-1.5">
                                    <Lock className="w-4 h-4" /> 4-Digit Security PIN
                                </label>
                                <input 
                                    type="password" 
                                    maxLength={4}
                                    value={pin} 
                                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="••••" 
                                    className="w-full px-4 py-3 text-center tracking-[1em] text-2xl font-bold bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20" 
                                />
                            </div>
                            
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex justify-between items-center">
                                <span className="text-sm text-foreground font-medium">Total Deducted</span>
                                <span className="text-lg font-bold text-primary">₹ {amount || '0'}</span>
                            </div>

                            <button onClick={handleTransfer} disabled={loading || !amount || pin.length !== 4} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                                {loading ? 'Processing...' : 'Confirm Transfer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Receipt Modal */}
            {successTxn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-xl w-full max-w-sm text-center">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">Transfer Successful</h2>
                        <p className="text-muted-foreground mb-6">Your money is on its way!</p>
                        
                        <div className="bg-background rounded-xl p-4 border border-border/50 text-left space-y-3 mb-6">
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Amount</span>
                                <span className="text-sm font-bold text-foreground">₹ {successTxn.amount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">To</span>
                                <span className="text-sm font-medium text-foreground">{successTxn.beneficiaryAccount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Ref No</span>
                                <span className="text-sm font-medium text-foreground">{successTxn.apiReference || successTxn.transactionId}</span>
                            </div>
                        </div>

                        <button onClick={() => setSuccessTxn(null)} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium">
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DMT;