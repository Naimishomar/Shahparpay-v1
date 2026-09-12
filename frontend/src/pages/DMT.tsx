import { useState } from 'react';
import { Search, UserPlus, Send, Plus, CreditCard, Lock, CheckCircle2, X, Trash, ShieldCheck, Clock } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

/**
 * Domestic money transfer.
 *
 * There is no remitter to register on this rail: a beneficiary carries the
 * sender's mobile number itself and is activated by an OTP sent to that number.
 * Only a verified beneficiary can be paid, so the OTP step is part of adding
 * one rather than a separate screen.
 */
const DMT = () => {
    const { token } = useAuth();

    const [mobile, setMobile] = useState('');
    // The sender the list below belongs to. Set once the mobile is searched, so
    // typing a new number does not silently repoint an open transfer.
    const [sender, setSender] = useState('');
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [showAddBene, setShowAddBene] = useState(false);
    const [beneData, setBeneData] = useState({ benename: '', beneaccount: '', confirmAccount: '', ifsc: '' });

    // The beneficiary an OTP is currently being collected for, and what that OTP
    // is meant to do — activating a new one, or authorising a deletion.
    const [otpFor, setOtpFor] = useState<{ bene: any; action: 'verify' | 'delete' } | null>(null);
    const [otp, setOtp] = useState('');

    const [transferBene, setTransferBene] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [transferMode, setTransferMode] = useState('IMPS');
    const [pin, setPin] = useState('');
    const [successTxn, setSuccessTxn] = useState<any>(null);
    const [bankVerification, setBankVerification] = useState<any>(null);

    const api = `${import.meta.env.VITE_BACKEND_URL}/api/dmt`;
    const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    const fetchBeneficiaries = async (mob: string) => {
        try {
            const res = await axios.post(`${api}/beneficiary/fetch`, { mobile: mob }, getHeaders());
            setBeneficiaries(res.data.success ? res.data.data || [] : []);
            return res.data.success;
        } catch (error: any) {
            setBeneficiaries([]);
            toast.error(error.response?.data?.message || 'Failed to fetch beneficiaries');
            return false;
        }
    };

    const handleSearch = async () => {
        if (mobile.length !== 10) return toast.error('Enter valid 10-digit mobile number');
        setLoading(true);
        const ok = await fetchBeneficiaries(mobile);
        if (ok) setSender(mobile);
        setLoading(false);
    };

    const handleAddBeneficiary = async () => {
        const { benename, beneaccount, confirmAccount, ifsc } = beneData;
        if (!benename || !beneaccount || !ifsc) return toast.error('Please fill all beneficiary details');
        // Caught here rather than at the bank: a typo in an account number sends
        // the money to a real stranger, and no refund follows.
        if (beneaccount !== confirmAccount) return toast.error('Account numbers do not match');
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return toast.error('Enter a valid IFSC code');

        setLoading(true);
        try {
            const res = await axios.post(`${api}/beneficiary/add`, { mobile: sender, benename, beneaccount, ifsc }, getHeaders());
            if (res.data.success) {
                toast.success(res.data.message || 'Beneficiary added');
                setBankVerification(res.data.data?.bankVerification || null);
                setShowAddBene(false);
                setBeneData({ benename: '', beneaccount: '', confirmAccount: '', ifsc: '' });
                await fetchBeneficiaries(sender);
                // A beneficiary is not payable until it is verified, so the OTP is
                // requested straight away rather than left for the retailer to find.
                if (res.data.data?.id) requestOtp({ ...res.data.data }, 'verify');
            } else {
                toast.error(res.data.message || 'Failed to add beneficiary');
            }
        } catch (error: any) {
            setBankVerification(error.response?.data?.data?.bankVerification || null);
            toast.error(error.response?.data?.message || 'Failed to add beneficiary');
        } finally {
            setLoading(false);
        }
    };

    const requestOtp = async (bene: any, action: 'verify' | 'delete') => {
        setOtp('');
        setOtpFor({ bene, action });
        try {
            const otpPath = action === 'delete' ? 'beneficiary/delete-otp' : 'beneficiary/otp';
            const body = { beneficiary_id: bene.id };
            const res = await axios.post(`${api}/${otpPath}`, body, getHeaders());
            if (res.data.success) {
                const expiry = res.data.expiresIn ? ` Valid for ${Math.ceil(Number(res.data.expiresIn) / 60)} minutes.` : '';
                toast.success(`${res.data.message || 'OTP sent'}${expiry}`);
            }
            else toast.error(res.data.message || 'Failed to send OTP');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to send OTP');
        }
    };

    const handleOtpSubmit = async () => {
        if (!otpFor || otp.length !== 6) return toast.error('Enter the 6-digit OTP');
        const { bene, action } = otpFor;
        setLoading(true);
        try {
            const path = action === 'verify' ? 'beneficiary/verify' : 'beneficiary/delete';
            const res = await axios.post(`${api}/${path}`, { beneficiary_id: bene.id, otp }, getHeaders());
            if (res.data.success) {
                toast.success(res.data.message || (action === 'verify' ? 'Beneficiary verified' : 'Beneficiary deleted'));
                setOtpFor(null);
                setOtp('');
                await fetchBeneficiaries(sender);
            } else {
                toast.error(res.data.message || 'That OTP was not accepted');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'That OTP was not accepted');
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!amount || Number(amount) < 10 || pin.length !== 4) return toast.error('Enter an amount of at least ₹10 and a 4-digit PIN');
        setLoading(true);
        try {
            const res = await axios.post(`${api}/transfer`, {
                mobile: sender,
                beneficiary_id: transferBene.id,
                beneaccount: transferBene.account,
                ifsc: transferBene.ifsc,
                amount: Number(amount),
                transfer_mode: transferMode,
                pin,
            }, getHeaders());

            if (res.data.success) {
                // A transfer is accepted before the beneficiary bank confirms it, so
                // the receipt must not claim it landed while it is still pending.
                setSuccessTxn({
                    ...res.data.data,
                    amount: Number(amount),
                    beneficiaryName: transferBene.name,
                    beneficiaryAccount: transferBene.account,
                    pending: !!res.data.pending,
                    message: res.data.message,
                });
                setTransferBene(null);
                setAmount('');
                setPin('');
                window.dispatchEvent(new Event('wallet-updated'));
            } else {
                toast.error(res.data.message || 'Transfer failed');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Transfer failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Send className="w-8 h-8 text-primary" />
                        Domestic Money Transfer (DMT)
                    </h1>
                    <p className="text-muted-foreground">Instantly transfer funds to any bank account in India.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: sender */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-xl font-bold text-foreground mb-4">Sender Details</h2>

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
                                            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
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
                                    {loading ? 'Searching...' : 'Find Beneficiaries'}
                                </button>
                            </div>

                            {sender && (
                                <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-full">
                                            <UserPlus className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Sending as +91 {sender}</p>
                                            <p className="text-xs text-muted-foreground">{beneficiaries.length} saved beneficiar{beneficiaries.length === 1 ? 'y' : 'ies'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: beneficiaries */}
                    <div className="lg:col-span-2">
                        {sender ? (
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
                                        {beneficiaries.map((bene) => (
                                            <div key={bene.id} className="p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="font-bold text-foreground">{bene.name}</h3>
                                                        <p className="text-xs text-muted-foreground">{bene.bank || 'Bank'} {bene.branch ? `· ${bene.branch}` : ''}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => requestOtp(bene, 'delete')}
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
                                                    <p className="text-sm font-medium text-foreground">{bene.account}</p>
                                                    <p className="text-xs text-muted-foreground uppercase">{bene.ifsc}</p>
                                                </div>

                                                {bene.verified ? (
                                                    <button
                                                        onClick={() => setTransferBene(bene)}
                                                        className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                                    >
                                                        Transfer Now
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => requestOtp(bene, 'verify')}
                                                        className="w-full py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <ShieldCheck className="w-4 h-4" />
                                                        Verify with OTP
                                                    </button>
                                                )}
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
                                <p className="text-muted-foreground max-w-md">Enter the sender's mobile number to see their saved beneficiaries and send money.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {bankVerification && (
                <div className="bg-card border border-green-500/30 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="font-bold text-foreground">Bank account verification</h2>
                            <p className="text-xs text-muted-foreground">Verification response for the newly added beneficiary</p>
                        </div>
                        <button onClick={() => setBankVerification(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {[
                            ['Transaction ID', bankVerification.txnid], ['Status', bankVerification.status],
                            ['Account Name', bankVerification.AccountName], ['Account Number', bankVerification.AccountNumber],
                            ['Account Status', bankVerification.accountStatus], ['Bank', bankVerification.bank_name],
                            ['UTR', bankVerification.utr], ['City', bankVerification.city],
                            ['Branch', bankVerification.branch], ['MICR', bankVerification.micr],
                            ['Response', bankVerification.resText], ['Name Match', bankVerification.nameMatch ? 'YES' : 'NO'],
                            ['Account Match', bankVerification.accountMatch ? 'YES' : 'NO'],
                        ].map(([label, value]) => <div key={label}><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium text-foreground break-words">{String(value ?? '—')}</div></div>)}
                    </div>
                </div>
            )}

            {/* Add Beneficiary */}
            {showAddBene && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl w-full max-w-md relative">
                        <button onClick={() => setShowAddBene(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-foreground mb-1">Add Beneficiary</h2>
                        <p className="text-sm text-muted-foreground mb-4">For sender +91 {sender}</p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-foreground mb-1 block">Account Holder Name</label>
                                <input type="text" value={beneData.benename} onChange={e => setBeneData({ ...beneData, benename: e.target.value })} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="text-sm text-foreground mb-1 block">Account Number</label>
                                <input type="text" value={beneData.beneaccount} onChange={e => setBeneData({ ...beneData, beneaccount: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="text-sm text-foreground mb-1 block">Confirm Account Number</label>
                                <input type="text" value={beneData.confirmAccount} onChange={e => setBeneData({ ...beneData, confirmAccount: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="text-sm text-foreground mb-1 block">IFSC Code</label>
                                <input type="text" value={beneData.ifsc} onChange={e => setBeneData({ ...beneData, ifsc: e.target.value.toUpperCase() })} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 uppercase" />
                            </div>
                            <button onClick={handleAddBeneficiary} disabled={loading} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium mt-4 disabled:opacity-50">
                                {loading ? 'Adding...' : 'Add Beneficiary'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OTP — activation or deletion */}
            {otpFor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl w-full max-w-sm relative">
                        <button onClick={() => { setOtpFor(null); setOtp(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-foreground mb-1">
                            {otpFor.action === 'verify' ? 'Verify Beneficiary' : 'Confirm Deletion'}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            {otpFor.action === 'verify'
                                ? `Enter the OTP sent to +91 ${sender} to activate ${otpFor.bene.name}.`
                                : `Enter the OTP sent to +91 ${sender} to delete ${otpFor.bene.name}.`}
                        </p>
                        <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className="w-full px-4 py-3 text-center tracking-[0.5em] text-2xl font-bold bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20"
                        />
                        <button onClick={handleOtpSubmit} disabled={loading || otp.length !== 6} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium mt-4 disabled:opacity-50">
                            {loading ? 'Processing...' : otpFor.action === 'verify' ? 'Verify' : 'Delete Beneficiary'}
                        </button>
                        <button onClick={() => requestOtp(otpFor.bene, otpFor.action)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground mt-2">
                            Resend OTP
                        </button>
                    </div>
                </div>
            )}

            {/* Transfer */}
            {transferBene && !successTxn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl w-full max-w-md relative">
                        <button onClick={() => { setTransferBene(null); setPin(''); setAmount(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-foreground mb-1">Send Money</h2>
                        <p className="text-sm text-muted-foreground mb-6">To {transferBene.name} ({transferBene.account})</p>

                        <div className="space-y-5">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Amount (₹)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    min="10"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))}
                                    placeholder="0"
                                    className="w-full px-4 py-3 text-2xl font-bold bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Transfer Mode</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['IMPS', 'NEFT'].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setTransferMode(m)}
                                            className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${transferMode === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border/50 hover:border-primary/40'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
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

                            <button onClick={handleTransfer} disabled={loading || !amount || Number(amount) < 10 || pin.length !== 4} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                                {loading ? 'Processing...' : 'Confirm Transfer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt */}
            {successTxn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-xl w-full max-w-sm text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${successTxn.pending ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
                            {successTxn.pending
                                ? <Clock className="w-8 h-8 text-amber-500" />
                                : <CheckCircle2 className="w-8 h-8 text-green-500" />}
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            {successTxn.pending ? 'Transfer Pending' : 'Transfer Successful'}
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            {successTxn.message || (successTxn.pending ? 'The bank has not confirmed it yet.' : 'Your money is on its way!')}
                        </p>

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
                                <span className="text-sm font-medium text-foreground">{successTxn.rrn || successTxn.txnid || successTxn.transactionId}</span>
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
