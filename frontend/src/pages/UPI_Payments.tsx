import { useState } from 'react';
import { QrCode, Download, Loader2, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

/**
 * A standing UPI QR for the counter.
 *
 * The retailer names the account the money should settle to, that account is
 * verified against the bank before anything is printed — a QR pointing at a
 * mistyped account number sends every customer's payment somewhere else, and it
 * is printed and stuck to a counter, so there is no second chance to catch it —
 * and the confirmed QR is then issued against the platform's Icchhamati
 * merchant account.
 *
 * Proceeds are NOT credited automatically. Icchhamati issues one virtual
 * account per merchant account rather than per retailer — /api/qr-details
 * returns a single VA for the whole MID and /api/v2/generate-qr takes no
 * retailer identifier — and publishes neither a webhook registration nor a
 * collections feed. So a payment cannot be attributed to the retailer whose QR
 * was scanned, and support reconciles it by hand from the Icchhamati portal.
 * The banner below says so rather than letting the screen imply otherwise.
 */
const UPI_Payments = () => {
    const { token } = useAuth();

    const [qrForm, setQrForm] = useState({ name: '', account_number: '', account_ifsc: '' });
    const [qr, setQr] = useState<any>(null);
    const [bankVerification, setBankVerification] = useState<any>(null);
    const [verifyingBank, setVerifyingBank] = useState(false);
    const [loading, setLoading] = useState(false);

    const api = `${import.meta.env.VITE_BACKEND_URL}/api/collect`;
    const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    const verifyBank = async () => {
        if (!qrForm.name.trim() || !qrForm.account_number || !qrForm.account_ifsc) {
            return toast.error('Enter the account holder name, account number and IFSC');
        }
        setVerifyingBank(true);
        try {
            const res = await axios.post(`${api}/verify-bank-account`, qrForm, getHeaders());
            const details = res.data.data || null;
            setBankVerification(details);
            if (res.data.success) toast.success(res.data.message || 'Bank account verified');
            else toast.error(res.data.message || 'Bank account details did not match');
        } catch (error: any) {
            setBankVerification(error.response?.data?.data || null);
            toast.error(error.response?.data?.message || 'Could not verify the bank account');
        } finally {
            setVerifyingBank(false);
        }
    };

    const generateQr = async () => {
        if (!qrForm.name.trim() || !qrForm.account_number || !qrForm.account_ifsc) {
            return toast.error('Enter the account holder name, account number and IFSC');
        }
        if (!bankVerification?.verified) {
            return toast.error('Verify the bank account before generating the QR code');
        }
        setLoading(true);
        try {
            const res = await axios.post(`${api}/qr`, qrForm, getHeaders());
            if (res.data.success) {
                setQr(res.data.data);
                toast.success(res.data.message || 'QR code generated');
            } else {
                toast.error(res.data.message || 'Could not generate the QR code');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Could not generate the QR code');
        } finally {
            setLoading(false);
        }
    };

    const input = 'w-full px-3 py-2.5 bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

    // Any edit invalidates the verification: a QR must never be issued against
    // an account number that differs from the one the bank confirmed.
    const editQrForm = (patch: Partial<typeof qrForm>) => {
        setQrForm((prev) => ({ ...prev, ...patch }));
        setBankVerification(null);
    };

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <QrCode className="w-8 h-8 text-primary" />
                        UPI Payments
                    </h1>
                    <p className="text-muted-foreground">Generate a printable UPI QR so customers can pay you straight at the counter.</p>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>
                        <span className="font-semibold">Collections are not credited automatically yet.</span>{' '}
                        Payments into this QR reach the company account and are credited to your QR wallet by support, usually within 24 hours.
                        For an instant credit, send the customer a payment link from Collect Payments instead.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
                        <h2 className="text-xl font-bold text-foreground">Generate UPI QR</h2>
                        <p className="text-sm text-muted-foreground">Customer payments are settled through the platform's Icchhamati account, then passed on to your QR wallet by support.</p>

                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Account Holder Name</label>
                            <input type="text" className={input} value={qrForm.name} onChange={e => editQrForm({ name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Account Number</label>
                            <input type="text" className={input} value={qrForm.account_number} onChange={e => editQrForm({ account_number: e.target.value.replace(/\D/g, '') })} />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">IFSC Code</label>
                            <input type="text" className={`${input} uppercase`} value={qrForm.account_ifsc} onChange={e => editQrForm({ account_ifsc: e.target.value.toUpperCase() })} />
                        </div>

                        <button onClick={verifyBank} disabled={verifyingBank} className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-bold hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                            {verifyingBank && <Loader2 className="w-4 h-4 animate-spin" />}
                            {verifyingBank ? 'Verifying...' : 'Verify Bank Account'}
                        </button>

                        {bankVerification && (
                            <div className={`rounded-xl border p-4 text-sm space-y-3 ${bankVerification.verified ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground">Bank verification details</span>
                                    <span className={bankVerification.verified ? 'text-green-600' : 'text-red-600'}>{bankVerification.verified ? 'VERIFIED' : 'NOT VERIFIED'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-left">
                                    {[
                                        ['Transaction ID', bankVerification.txnid], ['Status', bankVerification.status],
                                        ['Account Name', bankVerification.AccountName], ['Account Number', bankVerification.AccountNumber],
                                        ['Account Status', bankVerification.accountStatus], ['Bank', bankVerification.bank_name],
                                        ['UTR', bankVerification.utr], ['City', bankVerification.city],
                                        ['Branch', bankVerification.branch], ['MICR', bankVerification.micr],
                                        ['Response', bankVerification.resText], ['Name Match', bankVerification.nameMatch ? 'YES' : 'NO'],
                                        ['Account Match', bankVerification.accountMatch ? 'YES' : 'NO'],
                                    ].map(([label, value]) => <div key={label} className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium text-foreground break-words">{String(value ?? '—')}</div></div>)}
                                </div>
                            </div>
                        )}

                        <button onClick={generateQr} disabled={loading || !bankVerification?.verified} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {loading ? 'Generating...' : 'Generate QR Code'}
                        </button>
                    </div>

                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                        {qr ? (
                            <div className="space-y-4 w-full">
                                {qr.qrImage && (
                                    <img src={qr.qrImage} alt="UPI QR code" className="w-56 h-56 mx-auto rounded-xl border border-border/50 bg-white p-2" />
                                )}
                                {qr.upiHandle && (
                                    <p className="text-sm font-medium text-foreground break-all">{qr.upiHandle}</p>
                                )}
                                {qr.virtualAccountId && (
                                    <p className="text-xs text-muted-foreground">Virtual account {qr.virtualAccountId} · quote this to support when reconciling</p>
                                )}
                                {qr.qrPdf && (
                                    <a href={qr.qrPdf} download="upi-qr.pdf" className="w-full py-2.5 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
                                        <Download className="w-4 h-4" /> Download Printable QR
                                    </a>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                    <QrCode className="w-8 h-8 text-primary opacity-80" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-1">No QR Yet</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">Enter your settlement account details to generate a QR you can print for the counter.</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UPI_Payments;
