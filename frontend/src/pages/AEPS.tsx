import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Fingerprint, Clock, CheckCircle2, XCircle, RefreshCcw, ShieldCheck, KeyRound, Wallet, FileText, IndianRupee, CreditCard, Loader2, Store, Phone, Printer, User, IdCard, Landmark } from "lucide-react";
import logo from "../assets/logo.png";
import MerchantKycModal from "../components/MerchantKycModal";
import DailyAuthModal from "../components/DailyAuthModal";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { useLocationContext } from "../context/LocationContext";
import { z } from "zod";
import { captureBiometric, DEVICE_LABELS, type DeviceBrand } from "../utils/rdService";

const banks = [
    { name: 'SBI', displayName: 'State Bank of India (SBI)', logo: 'https://www.google.com/s2/favicons?domain=onlinesbi.sbi&sz=128' },
    { name: 'PNB', displayName: 'Punjab National Bank (PNB)', logo: 'https://www.google.com/s2/favicons?domain=pnbindia.in&sz=128' },
    { name: 'BoB', displayName: 'Bank of Baroda (BoB)', logo: 'https://www.google.com/s2/favicons?domain=bankofbaroda.in&sz=128' },
    { name: 'Canara Bank', displayName: 'Canara Bank', logo: 'https://www.google.com/s2/favicons?domain=canarabank.com&sz=128' },
    { name: 'Union Bank of India', displayName: 'Union Bank of India', logo: 'https://www.google.com/s2/favicons?domain=unionbankofindia.co.in&sz=128' },
    { name: 'Bank of India', displayName: 'Bank of India (BoI)', logo: 'https://www.google.com/s2/favicons?domain=bankofindia.co.in&sz=128' },
    { name: 'Indian Bank', displayName: 'Indian Bank', logo: 'https://www.google.com/s2/favicons?domain=indianbank.in&sz=128' },
    { name: 'Central Bank of India', displayName: 'Central Bank of India', logo: 'https://www.google.com/s2/favicons?domain=centralbankofindia.co.in&sz=128' }
];

// AEPS transaction OTP is required only when the withdrawal amount is >= this
// threshold. Below it, no OTP is needed.
const AEPS_OTP_THRESHOLD = 5000;

// Same black (light) / silver (dark) treatment as the active sidebar item and dashboard.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';
const AEPS_TABS = [
    { key: 'balance_enquiry', label: 'Balance Enquiry', icon: Wallet, hint: "Check the balance in the customer's Aadhaar-linked bank account." },
    { key: 'mini_statement', label: 'Mini Statement', icon: FileText, hint: "Show the customer's last few transactions from their bank." },
    { key: 'cash_withdrawal', label: 'Cash Withdrawal', icon: IndianRupee, hint: "Withdraw cash from the customer's bank account using Aadhaar." },
    { key: 'cash_deposit', label: 'Cash Deposit', icon: CreditCard, hint: "Deposit cash into the customer's Aadhaar-linked bank account." },
    // { key: 'aadhaar_pay', label: 'Aadhaar Pay', icon: CreditCard },
] as const;

const numberToWords = (num: string | number) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    let nNum = parseInt(num.toString(), 10);
    if (isNaN(nNum) || nNum <= 0) return '';
    if (nNum.toString().length > 9) return 'Amount too large';
    
    const n = ('000000000' + nNum).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    
    let str = '';
    str += (n[1] != '00') ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
    str += (n[2] != '00') ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
    str += (n[3] != '00') ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
    str += (n[4] != '0') ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
    str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Only' : 'Only';
    
    return str.replace(/Only$/, 'Only').trim();
};

// Extracts the most descriptive error text from a failed AEPS/PaySprint response.
const extractPaySprintError = (result: any) => {
    const raw = result?.data || result?.error || {};
    const candidates = [
        raw?.statusDescription,
        raw?.statusdescription,
        raw?.message,
        raw?.response_description,
        raw?.errmsg,
        raw?.reason,
        result?.message,
        result?.error,
    ];
    return candidates.find((c: any) => c && typeof c === 'string' && c.trim()) || "Transaction failed. Please try again.";
};


// Removed mock transactions

const AEPS = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { location } = useLocationContext();
    const actualMerchantCode = user?.retailerId || user?.distributorId || user?.adminId || "";
    // UI State
    const [activeTab, setActiveTab] = useState("balance_enquiry");
    const [selectedDevice, setSelectedDevice] = useState("mantra");
    
    // Form Field State
    const [name, setName] = useState("");
    const [aadhaarNo, setAadhaarNo] = useState("");
    const [bankName, setBankName] = useState("");
    const [mobileNo, setMobileNo] = useState("");
    const [amount, setAmount] = useState("");
    const [selectedBank, setSelectedBank] = useState("");
    const [consent, setConsent] = useState(true);

    // AEPS Transaction OTP state - required only for withdrawals > ₹5000
    const [otp, setOtp] = useState("");
    const [otpRefId, setOtpRefId] = useState("");
    const [otpTxnReference, setOtpTxnReference] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);

    // Clears the AEPS transaction OTP flow (used on reset / tab switch / retry)
    const invalidateOtp = () => {
        setOtp("");
        setOtpRefId("");
        setOtpTxnReference("");
        setOtpSent(false);
    };

    // Modal State
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [showFailureModal, setShowFailureModal] = useState(false);
    const [failureData, setFailureData] = useState<any>(null);
    const [showKycModal, setShowKycModal] = useState(false);
    const [showDailyAuthModal, setShowDailyAuthModal] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // Merchant DB Tracker State
    const [merchantCode, setMerchantCode] = useState(actualMerchantCode);
    const [merchantStatus, setMerchantStatus] = useState({
        isMerchantKycComplete: false,
        isDailyAuthDoneToday: false,
        lastDailyAuthDate: null,
        activePipes: [] as string[]
    });
    const [selectedPipe, setSelectedPipe] = useState('');
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);

    // Fetch Merchant Status on Load
    useEffect(() => {
        if (!merchantCode) return;
        setIsLoadingStatus(true);
        let url = `${import.meta.env.VITE_BACKEND_URL}/api/aeps/merchant-status?merchantcode=${merchantCode}`;
        if (selectedPipe) url += `&pipe=${selectedPipe}`;
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setMerchantStatus(data.data);
                    if (!selectedPipe && data.data.activePipes && data.data.activePipes.length > 0) {
                        setSelectedPipe(data.data.activePipes[0]);
                    }
                    // AEPS onboarding is required only when the retailer opens AEPS.
                    // Do not block the rest of the application from Layout.tsx.
                    if (user?.role === 'retailer' && !data.data.isMerchantKycComplete) {
                        setShowKycModal(true);
                    } else if (!data.data.isDailyAuthDoneToday) {
                        setShowDailyAuthModal(true);
                    }
                }
            })
            .catch(err => console.error("Failed to fetch merchant status", err))
            .finally(() => setIsLoadingStatus(false));
    }, [merchantCode, selectedPipe, user?.role]);
    
    // Biometric Capture State
    const [pidData, setPidData] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    // Sync dropdown with grid selection if desired
    const handleGridBankSelect = (bank: string) => {
        const matchedBank = banks.find((entry) =>
            entry.name.toLowerCase() === bank.toLowerCase() ||
            entry.displayName.toLowerCase() === bank.toLowerCase()
        );
        const bankValue = matchedBank?.name || bank;
        setSelectedBank(bankValue);
        setBankName(bankValue);
    };

    const handleReset = () => {
        setName("");
        setAadhaarNo("");
        setBankName("");
        setMobileNo("");
        setAmount("");
        setSelectedBank("");
        setPidData(null);
        invalidateOtp();
    };

    const [dynamicBanks, setDynamicBanks] = useState<any[]>([]);

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/banks`);
                const data = await res.json();
                if (data.success && data.data) {
                    const popularBanks = [
                        "State Bank", 
                        "Bank of Baroda", 
                        "Punjab National Bank", 
                        "HDFC", 
                        "ICICI", 
                        "Union Bank", 
                        "Axis Bank", 
                        "Canara Bank", 
                        "Bank of India", 
                        "Central Bank"
                    ];
                    
                    const sortedBanks = [...data.data].sort((a, b) => {
                        const aName = (a.name || a.bankName || a.bank_name || "").toLowerCase();
                        const bName = (b.name || b.bankName || b.bank_name || "").toLowerCase();
                        
                        const aIndex = popularBanks.findIndex(pb => aName.includes(pb.toLowerCase()));
                        const bIndex = popularBanks.findIndex(pb => bName.includes(pb.toLowerCase()));
                        
                        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                        if (aIndex !== -1) return -1;
                        if (bIndex !== -1) return 1;
                        
                        return aName.localeCompare(bName);
                    });
                    
                    setDynamicBanks(sortedBanks);
                }
            } catch(err) {
                console.error("Failed to fetch bank list", err);
            }
        };
        fetchBanks();
    }, []);

    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    useEffect(() => {
        if (!user) return;
        const fetchRecentTxns = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/dashboard/recent-transactions?type=AEPS&limit=6`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    setRecentTransactions(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch recent txns:", err);
            }
        };
        fetchRecentTxns();
    }, [user]);

    // Load transaction data into form
    const loadTransactionToForm = (tx: any) => {
        setName(tx.metadata?.name || "");
        setAadhaarNo(tx.metadata?.aadhaar || "");
        setMobileNo(tx.metadata?.mobile || "");
        if (tx.metadata?.bankName) {
            handleGridBankSelect(tx.metadata.bankName);
        }
    };

    const [loading, setLoading] = useState(false);

    const captureFingerprint = async () => {
        if (!aadhaarNo || !bankName) {
            toast.error("Please fill Aadhaar Number and Bank Name before scanning your fingerprint.");
            return;
        }

        // AEPS transaction OTP is required only for withdrawals above ₹5000.
        // The customer's OTP must be embedded in the captured PID block.
        if (activeTab === 'cash_withdrawal' && Number(amount) > AEPS_OTP_THRESHOLD) {
            if (!otpSent || !otp || !otpRefId) {
                toast.error("Please send the AEPS transaction OTP and enter it before scanning the customer's fingerprint.");
                return;
            }
        }
        
        const proceed = window.confirm("CUSTOMER must place their finger on the scanner.");
        if (!proceed) return;

        if (isScanning) return;
        setIsScanning(true);
        try {
            // The customer's AEPS transaction OTP is passed via the `otp` option so it
            // gets bound inside the captured PID data (required only for
            // withdrawals >= ₹5000). WADH is intentionally NOT sent for AEPS
            // transactions (see rdService.ts).
            const otpValue = (activeTab === 'cash_withdrawal' && Number(amount) > AEPS_OTP_THRESHOLD && otp) ? otp : undefined;
            const { pidData: capturedPid } = await captureBiometric({ otp: otpValue, device: selectedDevice as DeviceBrand });
            setPidData(capturedPid);
        } catch (error) {
            console.error("RD Service Error:", error);
            const err = error as Error;
            toast.error(err?.message || `Could not connect to ${selectedDevice}. Ensure RD Service is running and ad-blockers are disabled.`);
            setPidData(null);
        } finally {
            setIsScanning(false);
        }
    };

    const handleSendOtp = async () => {
        if (activeTab !== 'cash_withdrawal') return;
        if (!aadhaarNo || !bankName || !mobileNo) {
            toast.error("Please fill Aadhaar Number, Bank Name, and Mobile Number before sending OTP.");
            return;
        }
        if (!amount || Number(amount) <= 0) {
            toast.error("Please enter a valid withdrawal amount before sending OTP.");
            return;
        }
        if (sendingOtp) return;
        setSendingOtp(true);
        try {
            const selectedBankObj = dynamicBanks.find((b: any) => 
                (b.bankName || "").toLowerCase() === bankName.toLowerCase() || 
                (b.bank_name || "").toLowerCase() === bankName.toLowerCase()
            );
            const actualIIN = selectedBankObj?.iinno || selectedBankObj?.bank_iin || '607152';

            const payload: any = {
                latitude: location?.latitude?.toString(),
                longitude: location?.longitude?.toString(),
                aadhaarNumber: aadhaarNo,
                bankIIN: actualIIN,
                mobileNumber: mobileNo,
                amount: Number(amount),
                pipe: selectedPipe
            };
            // Reuse the reference on resend so we don't leave orphaned PENDING transactions
            if (otpTxnReference) payload.referenceNo = otpTxnReference;

            const token = localStorage.getItem('token');
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/aeps/initiate-otp`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const result = res.data;

            if (result.success && result.data?.otpRefId) {
                setOtpRefId(result.data.otpRefId);
                setOtpTxnReference(result.data.referenceNo);
                setOtpSent(true);
                setOtp("");
                toast.success("OTP sent to the customer's registered mobile number.");
            } else {
                toast.error(extractPaySprintError(result) || "Failed to send OTP. Please try again.");
            }
        } catch (error: any) {
            console.error("Failed to send AEPS transaction OTP", error);
            toast.error(extractPaySprintError(error?.response?.data) || "Failed to send OTP. Please try again.");
        } finally {
            setSendingOtp(false);
        }
    };

    const handleSubmit = async () => {
        const isBalanceEnquiry = activeTab === 'balance_enquiry';

        if (!aadhaarNo || !bankName || (!isBalanceEnquiry && !mobileNo)) {
            toast.error("Please fill all required fields.");
            return;
        }
        if (!consent) {
            toast.error("Please check the consent box.");
            return;
        }

        // Zod validation for 12 digit Aadhaar and 10 digit Mobile
        const validationSchema = z.object({
            aadhaarNo: z.string().regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits."),
            ...(isBalanceEnquiry ? {} : {
                mobileNo: z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits.")
            })
        });

        const validationResult = validationSchema.safeParse({ aadhaarNo, ...(isBalanceEnquiry ? {} : { mobileNo }) });
        if (!validationResult.success) {
            toast.error(validationResult.error.issues[0].message);
            return;
        }

        
        if (!pidData) {
            toast.error("Please capture Customer fingerprint.");
            return;
        }

        setLoading(true);
        let succeeded = false;

        try {
            // Find the selected bank from dynamic list to get the actual IIN, fallback to 607152 if not found
            const selectedBankObj = dynamicBanks.find((b: any) => 
                (b.bankName || "").toLowerCase() === bankName.toLowerCase() || 
                (b.bank_name || "").toLowerCase() === bankName.toLowerCase()
            );
            const actualIIN = selectedBankObj?.iinno || selectedBankObj?.bank_iin || '607152';

            const apiPayload: any = {
                latitude: location?.latitude?.toString(),
                longitude: location?.longitude?.toString(),
                aadhaarNumber: aadhaarNo,
                bankIIN: actualIIN,
                pidData: pidData,
                bankName: bankName,
                customerName: name,
                pipe: selectedPipe
            };

            if (!isBalanceEnquiry) {
                apiPayload.mobileNumber = mobileNo;
            }

            let res;
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            if (activeTab === 'balance_enquiry') {
                // PaySprint rejects BE without today's 2FA too (response_code 23).
                if (!merchantStatus.isDailyAuthDoneToday) {
                    toast.error("Daily Biometric Authentication is required. Please complete it now.");
                    setShowDailyAuthModal(true);
                    setLoading(false);
                    return;
                }
                res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/balance-enquiry`, apiPayload, config);
            } else if (activeTab === 'cash_withdrawal') {
                // Intercept logic for DB tracker
                if (!merchantStatus.isMerchantKycComplete) {
                    toast.error("Mandatory eKYC is incomplete. Please complete it first.");
                    setShowKycModal(true);
                    setLoading(false);
                    return;
                }
                if (!merchantStatus.isDailyAuthDoneToday) {
                    toast.error("Daily Biometric Authentication is required. Please complete it now.");
                    setShowDailyAuthModal(true);
                    setLoading(false);
                    return;
                }
                if (Number(amount) > AEPS_OTP_THRESHOLD) {
                    if (!otpSent || !otp || !otpRefId || !otpTxnReference) {
                        toast.error(`AEPS transaction OTP is mandatory for withdrawals above ₹${AEPS_OTP_THRESHOLD}. Please send OTP and enter it.`);
                        setLoading(false);
                        return;
                    }
                    apiPayload.referenceNo = otpTxnReference;
                    apiPayload.otpRefId = otpRefId;
                }
                apiPayload.amount = amount;
                res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/cash-withdrawal`, apiPayload, config);
            } else if (activeTab === 'aadhaar_pay') {
                // Intercept logic for DB tracker
                if (!merchantStatus.isMerchantKycComplete) {
                    toast.error("Mandatory eKYC is incomplete. Please complete it first.");
                    setShowKycModal(true);
                    setLoading(false);
                    return;
                }
                if (!merchantStatus.isDailyAuthDoneToday) {
                    toast.error("Daily Biometric Authentication is required. Please complete it now.");
                    setShowDailyAuthModal(true);
                    setLoading(false);
                    return;
                }
                apiPayload.amount = amount;
                res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/aadhaar-pay`, apiPayload, config);
            } else if (activeTab === 'cash_deposit') {
                apiPayload.amount = amount;
                res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/cash-deposit`, apiPayload, config);
            } else if (activeTab === 'mini_statement') {
                res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/mini-statement`, apiPayload, config);
            } else {
                res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/balance-enquiry`, apiPayload, config);
            }

            const result = res.data;
            
            if (result.success) {
                const data = {
                    agentName: user?.name || 'Agent',
                    agentMobile: user?.contactNumber || '', 
                    customerName: name || 'Customer',
                    aadhaarNo: '********' + (aadhaarNo.slice(-4) || ''),
                    txnAmount: (activeTab !== 'balance_enquiry' && activeTab !== 'mini_statement') ? amount : '0.00',
                    balanceAmount: ((bankName?.toLowerCase() === 'sbi' || bankName?.toLowerCase() === 'state bank of india') && (activeTab === 'cash_withdrawal' || activeTab === 'mini_statement')) ? 'N/A' : (result.data?.balanceamount || result.data?.balanceAmount || result.data?.balance || result.data?.data?.balanceamount || result.data?.data?.balanceAmount || result.data?.data?.balance || result.data?.amount || '0.00'),
                    bankName: bankName ? bankName.toUpperCase() : 'BANK',
                    dateTime: new Date().toLocaleString(),
                    message: 'SUCCESS',
                    mobileNo: mobileNo || '',
                    txnStatus: 'SUCCESS',
                    rrn: result.data?.rrn || result.data?.bankrrn || result.data?.data?.rrn || 'N/A',
                    stan: result.data?.stan || result.data?.ackno || result.data?.data?.stan || 'N/A',
                    ministatementlist: result.data?.ministatement || []
                };
                setReceiptData(data);
                setShowReceiptModal(true);
                succeeded = true;
            } else {
                const paysprintError = extractPaySprintError(result);
                setFailureData({
                    title: "Transaction Failed",
                    message: paysprintError,
                    paysprintMessage: paysprintError,
                    rrn: result.data?.rrn || result.data?.bankrrn || result.data?.data?.rrn || 'N/A',
                    stan: result.data?.stan || result.data?.ackno || result.data?.data?.stan || 'N/A',
                    aadhaarNo: '********' + (aadhaarNo.slice(-4) || ''),
                    bankName: bankName ? bankName.toUpperCase() : 'BANK',
                    txnAmount: (activeTab !== 'balance_enquiry' && activeTab !== 'mini_statement') ? amount : '0.00',
                    mobileNo: mobileNo || '',
                    dateTime: new Date().toLocaleString(),
                });
                setShowFailureModal(true);
            }
        } catch (error: any) {
            console.error(error);
            const paysprintError = extractPaySprintError(error?.response?.data);
            setFailureData({
                title: "Transaction Failed",
                message: paysprintError,
                paysprintMessage: paysprintError,
                rrn: error?.response?.data?.data?.rrn || error?.response?.data?.data?.bankrrn || 'N/A',
                stan: error?.response?.data?.data?.stan || error?.response?.data?.data?.ackno || 'N/A',
                aadhaarNo: '********' + (aadhaarNo.slice(-4) || ''),
                bankName: bankName ? bankName.toUpperCase() : 'BANK',
                txnAmount: (activeTab !== 'balance_enquiry' && activeTab !== 'mini_statement') ? amount : '0.00',
                mobileNo: mobileNo || '',
                dateTime: new Date().toLocaleString(),
            });
            setShowFailureModal(true);
        } finally {
            window.dispatchEvent(new Event('wallet-updated'));
            setLoading(false);
            if (succeeded) {
                if (activeTab !== 'balance_enquiry') {
                    handleReset();
                } else {
                    setPidData(null);
                }
            } else {
                setPidData(null);
                invalidateOtp();
            }
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero: title, daily auth status, service tabs */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`rounded-2xl p-3 ring-1 ${SILVER_TILE}`}>
                                <Fingerprint className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AEPS</h1>
                                <p className="text-sm text-muted-foreground">Aadhaar Enabled Payment System</p>
                            </div>
                        </div>

                        {isLoadingStatus ? (
                            <div className="flex items-center gap-2 self-start sm:self-auto rounded-full border bg-background/70 backdrop-blur px-4 py-2 text-sm font-medium text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading status...
                            </div>
                        ) : merchantStatus.isDailyAuthDoneToday ? (
                            <div className="flex items-center gap-2 self-start sm:self-auto rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                                <ShieldCheck className="w-4 h-4" />
                                Daily auth done
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowDailyAuthModal(true)}
                                className="flex items-center gap-2 self-start sm:self-auto rounded-full bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30 hover:bg-amber-500/20"
                                title="Daily 2FA Authentication Needed"
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                                </span>
                                <KeyRound size={16} />
                                Pending Daily Auth
                            </button>
                        )}
                    </div>

                    <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border bg-background/60 backdrop-blur p-1.5 w-full md:w-max">
                        {AEPS_TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => { invalidateOtp(); setActiveTab(key); }}
                                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all ${activeTab === key ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                <Icon size={16} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
                {/* Customer details */}
                <section className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
                    {(() => {
                        const tab = AEPS_TABS.find((t) => t.key === activeTab) || AEPS_TABS[0];
                        const TabIcon = tab.icon;
                        return (
                            <div className="mb-6 flex items-start gap-4 border-b pb-5">
                                <div className={`rounded-2xl p-3 ring-1 ${SILVER_TILE}`}>
                                    <TabIcon className="h-6 w-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <h2 className="text-lg font-semibold">{tab.label}</h2>
                                        <span className="hidden sm:inline text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer details</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{tab.hint}</p>
                                </div>
                            </div>
                        );
                    })()}

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Customer Name</label>
                            <div className="relative">
                                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter customer name"
                                    className={`${INPUT} pl-10`}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Aadhaar Number</label>
                            <div className="relative">
                                <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={aadhaarNo}
                                    onChange={(e) => setAadhaarNo(e.target.value)}
                                    placeholder="Enter your aadhaar number"
                                    className={`${INPUT} pl-10 tracking-wider`}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Customer Bank Name</label>
                            <div className="relative">
                            <Landmark className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <select
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className={`${INPUT} pl-10`}
                            >
                                <option value="">Choose Your Bank</option>
                                {(dynamicBanks.length > 0 ? dynamicBanks : banks).map((b: any) => {
                                    const bName = b.displayName || b.name || b.bankName || b.bank_name;
                                    const optionValue = b.name || b.bankName || b.bank_name || bName;
                                    return (
                                        <option key={optionValue} value={optionValue}>
                                            {bName}
                                        </option>
                                    );
                                })}
                            </select>
                            </div>
                        </div>

                        {activeTab !== 'balance_enquiry' && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Mobile Number</label>
                                <div className="relative">
                                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={mobileNo}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, ''); // Ensure only digits
                                            if (val.length > 10) {
                                                toast.error("Mobile number cannot exceed 10 digits");
                                                return;
                                            }
                                            setMobileNo(val);
                                        }}
                                        placeholder="Enter your mobile number"
                                        className={`${INPUT} pl-10`}
                                    />
                                </div>
                            </div>
                        )}

                        {(activeTab === 'cash_withdrawal' || activeTab === 'cash_deposit' || activeTab === 'aadhaar_pay') && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Amount</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <span className="text-muted-foreground font-semibold">₹</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (otpSent && val !== amount) {
                                                invalidateOtp();
                                            }
                                            setAmount(val);
                                        }}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        placeholder="Enter amount"
                                        className={`${INPUT} pl-8 text-lg font-semibold tabular-nums`}
                                    />
                                </div>
                                {amount && Number(amount) > 0 && (
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1">
                                        {numberToWords(amount)}
                                    </span>
                                )}

                                {/* Quick Amount Buttons */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {[100, 200, 500, 1000, 2000, 3000, 5000, 10000].map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => {
                                                if (otpSent) invalidateOtp();
                                                setAmount(prev => (Number(prev) || 0) + val + "");
                                            }}
                                            className="rounded-full border bg-background px-3 py-1.5 text-xs font-semibold tabular-nums text-foreground hover:bg-zinc-900 hover:text-white hover:border-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-900 dark:hover:border-zinc-200"
                                        >
                                            +₹{val}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (otpSent) invalidateOtp();
                                            setAmount("");
                                        }}
                                        className="rounded-full border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white"
                                    >
                                        Clear
                                    </button>
                                </div>

                                {/* AEPS Transaction OTP - required only for withdrawals > ₹5000 */}
                                {activeTab === 'cash_withdrawal' && Number(amount) > AEPS_OTP_THRESHOLD && (
                                    <div className="flex flex-col gap-2 mt-3 rounded-xl border bg-background/50 p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                                <KeyRound size={14} className="text-muted-foreground" />
                                                AEPS Transaction OTP
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                disabled={sendingOtp}
                                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${ACTIVE_BUTTON}`}
                                            >
                                                {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : (otpSent ? "Resend OTP" : "Send OTP")}
                                            </button>
                                        </div>
                                        {otpSent && (
                                            <>
                                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                    OTP sent to the customer's registered mobile number.
                                                </p>
                                                <input
                                                    type="text"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="Enter 6-digit OTP"
                                                    className={`${INPUT} text-center tracking-[0.4em] font-bold`}
                                                />
                                                <p className="text-[11px] text-muted-foreground">
                                                    The OTP is bound to the customer's fingerprint capture and is required by the bank for this withdrawal.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                                {activeTab === 'cash_withdrawal' && amount && Number(amount) > 0 && Number(amount) <= AEPS_OTP_THRESHOLD && (
                                    <p className="text-[11px] text-muted-foreground mt-2">
                                        No transaction OTP required for amounts up to ₹{AEPS_OTP_THRESHOLD}.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Live checklist: mirrors what handleSubmit will insist on. */}
                    {(() => {
                        const needsAmount = activeTab === 'cash_withdrawal' || activeTab === 'cash_deposit' || activeTab === 'aadhaar_pay';
                        const steps = [
                            { label: 'Customer details', done: /^\d{12}$/.test(aadhaarNo) && (activeTab === 'balance_enquiry' || /^\d{10}$/.test(mobileNo)) && (!needsAmount || Number(amount) > 0) },
                            { label: 'Bank selected', done: !!bankName },
                            { label: 'Fingerprint', done: !!pidData },
                        ];
                        const doneCount = steps.filter((st) => st.done).length;
                        return (
                            <div className="mt-auto pt-6">
                                <div className="rounded-2xl border bg-background/50 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ready to submit</span>
                                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">{doneCount}/{steps.length}</span>
                                    </div>
                                    <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                                        <div className="h-full rounded-full bg-gradient-to-r from-zinc-400 via-zinc-600 to-zinc-400 dark:from-zinc-500 dark:via-zinc-200 dark:to-zinc-500 transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {steps.map((st, i) => (
                                            <div key={st.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ring-1 transition-colors ${st.done ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' : 'text-muted-foreground ring-border'}`}>
                                                {st.done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]">{i + 1}</span>}
                                                {st.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </section>

                {/* Scan & submit */}
                <section className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm">
                    {/* Consent */}
                    <label className="flex items-start gap-3 cursor-pointer group w-full rounded-xl border bg-background/50 p-4">
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="w-5 h-5 rounded border-border accent-zinc-900 dark:accent-zinc-300 mt-0.5 cursor-pointer shrink-0"
                        />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                            I hereby provide my consent to CSP to use my Aadhaar number/ VID to complete AEPS transaction authorisation.
                        </span>
                    </label>

                    {/* Scan Button */}
                    <button
                        onClick={captureFingerprint}
                        disabled={isScanning || !!pidData}
                        className={`relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 p-8 transition-all w-full
                            ${pidData
                                ? 'border-emerald-500/60 bg-emerald-500/5'
                                : 'border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-400 bg-background/50 cursor-pointer'}`}
                    >
                        <div className="relative">
                            {isScanning && <div className="absolute inset-0 rounded-full bg-zinc-400/30 animate-ping" />}
                            <div className={`relative rounded-full p-5 ring-1 ${pidData ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30' : SILVER_TILE}`}>
                                {pidData ? <CheckCircle2 className="w-10 h-10" /> : <Fingerprint className={`w-10 h-10 ${isScanning ? 'animate-pulse' : ''}`} />}
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className={`font-semibold ${pidData ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                                {isScanning ? 'Scanning...' : (pidData ? 'Fingerprint Captured' : 'Scan Fingerprint')}
                            </h3>
                            {!pidData && !isScanning && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Click to capture customer biometric
                                </p>
                            )}
                        </div>
                    </button>

                    {/* Clear/Submit Buttons */}
                    <div className="flex gap-3 w-full">
                        <button onClick={() => {
                            setAadhaarNo('');
                            setMobileNo('');
                            setAmount('');
                            setPidData(null);
                            setBankName('');
                            invalidateOtp();
                        }} className="flex-1 rounded-xl border py-3 font-medium hover:bg-black/5 dark:hover:bg-white/5">
                            Clear
                        </button>
                        <button onClick={handleSubmit} disabled={loading || !pidData} className={`flex-[2] rounded-xl py-3 font-bold disabled:opacity-50 disabled:shadow-none ${ACTIVE_BUTTON}`}>
                            {loading ? <RefreshCcw className="animate-spin mx-auto" size={20} /> : "Submit"}
                        </button>
                    </div>
                </section>
            </div>

            {/* Popular banks, device, reset */}
            <section className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Popular banks</h3>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white"
                        title="Reset all fields"
                    >
                        <RefreshCcw size={16} />
                        Reset
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {banks.map((bank) => (
                        <label
                            key={bank.name}
                            className={`flex flex-col items-center justify-between gap-3 rounded-xl border bg-background/50 p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${selectedBank === bank.name ? 'border-zinc-900 ring-2 ring-zinc-900/10 dark:border-zinc-300 dark:ring-zinc-300/20 shadow-md' : 'hover:border-zinc-400 dark:hover:border-zinc-600'}`}
                        >
                            <div className="h-10 flex items-center justify-center">
                                <img
                                    src={bank.logo}
                                    alt={bank.displayName}
                                    className="max-h-8 object-contain drop-shadow-sm rounded-sm"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="bank"
                                    value={bank.name}
                                    checked={selectedBank === bank.name}
                                    onChange={() => handleGridBankSelect(bank.name)}
                                    className="w-3.5 h-3.5 accent-zinc-900 dark:accent-zinc-300"
                                />
                                <span className="text-xs font-semibold text-center text-foreground">{bank.displayName}</span>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="mt-6 border-t pt-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Biometric device</h3>
                    <div className="flex flex-wrap gap-3">
                        {['Mantra', 'Morpho', 'Startek'].map((device) => {
                            const value = device.toLowerCase();
                            const active = selectedDevice === value;
                            return (
                                <label key={device} className={`flex items-center gap-3 rounded-xl border p-2 pr-5 cursor-pointer transition-all ${active ? 'border-zinc-900 bg-zinc-900/[0.03] dark:border-zinc-300 dark:bg-white/5 shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                    <input
                                        type="radio"
                                        name="device"
                                        value={value}
                                        checked={active}
                                        onChange={() => setSelectedDevice(value)}
                                        className="sr-only"
                                    />
                                    <div className={`rounded-lg p-2 ring-1 ${active ? SILVER_TILE : 'bg-black/5 dark:bg-white/10 text-muted-foreground ring-transparent'}`}>
                                        <Fingerprint className="w-5 h-5" />
                                    </div>
                                    <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{device}</span>
                                    {active && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                </label>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Recent Transactions Section */}
            <section className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
                    <Link to="/reports" className="ml-auto rounded-full border px-3 py-1 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
                        View More
                    </Link>
                </div>

                {recentTransactions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No AEPS transactions yet</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentTransactions.map((tx) => (
                            <div
                                key={tx._id}
                                onClick={() => loadTransactionToForm(tx)}
                                className="group flex flex-col rounded-xl border bg-background/50 p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-zinc-400 dark:hover:border-zinc-600"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-foreground">{tx.metadata?.name || 'Customer'}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' : tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20'}`}>
                                        {tx.status}
                                    </span>
                                </div>

                                <div className="flex justify-between items-end mt-auto pt-3 border-t">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={banks.find(b => b.name.toLowerCase() === (tx.metadata?.bankName || '').toLowerCase())?.logo || 'https://www.google.com/s2/favicons?domain=bank.com&sz=128'}
                                                alt={tx.metadata?.bankName || 'Bank'}
                                                className="w-5 h-5 object-contain rounded-sm"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                            <span className="text-xs font-medium text-foreground">
                                                {tx.metadata?.bankName || 'AEPS'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground tracking-wider">
                                            **** {(tx.metadata?.aadhaar || 'XXXX').slice(-4)}
                                        </span>
                                    </div>
                                    <p className="font-bold text-base tabular-nums text-foreground">₹ {tx.amount.toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Receipt Modal */}
            {showReceiptModal && receiptData && (() => {
                const hasMiniStatement = receiptData.ministatementlist && receiptData.ministatementlist.length > 0;
                return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div id="printable-receipt" className={`bg-white rounded-lg shadow-2xl w-full ${hasMiniStatement ? 'max-w-3xl' : 'max-w-md'} overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800`}>
                        {/* Header */}
                        <div className="flex justify-between items-start p-4 bg-white border-b border-gray-100">
                            <div>
                                <img src={logo} alt="Logo" className="h-10 object-contain dark:brightness-0 dark:invert" />
                            </div>
                            <div className="flex flex-col items-end text-xs text-slate-600 gap-1 relative pr-8">
                                <button 
                                    onClick={() => setShowReceiptModal(false)} 
                                    className="absolute -top-2 -right-2 text-primary hover:text-primary/80 transition-colors bg-white rounded-full p-1"
                                >
                                    <XCircle className="w-6 h-6 fill-primary text-white" />
                                </button>
                                <div className="flex items-center gap-1.5 font-medium uppercase text-slate-700">
                                    <Store className="w-3.5 h-3.5 text-primary" />
                                    {receiptData.agentName}
                                </div>
                                {receiptData.agentMobile && (
                                    <div className="flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-primary" />
                                        {receiptData.agentMobile}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Area */}
                        <div className="flex flex-col items-center justify-center py-6 bg-white">
                            <h2 className={`font-bold text-lg mb-4 uppercase tracking-wide ${receiptData.txnStatus === 'SUCCESS' ? 'text-emerald-500' : receiptData.txnStatus === 'FAILED' ? 'text-rose-500' : 'text-yellow-500'}`}>
                                TRANSACTION {receiptData.txnStatus}
                            </h2>
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg relative ${receiptData.txnStatus === 'SUCCESS' ? 'bg-emerald-500 shadow-emerald-500/20' : receiptData.txnStatus === 'FAILED' ? 'bg-rose-500 shadow-rose-500/20' : 'bg-yellow-500 shadow-yellow-500/20'}`}>
                                <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${receiptData.txnStatus === 'SUCCESS' ? 'bg-emerald-500' : receiptData.txnStatus === 'FAILED' ? 'bg-rose-500' : 'bg-yellow-500'}`}></div>
                                {receiptData.txnStatus === 'SUCCESS' ? (
                                    <CheckCircle2 className="w-12 h-12 text-white" />
                                ) : receiptData.txnStatus === 'FAILED' ? (
                                    <XCircle className="w-12 h-12 text-white" />
                                ) : (
                                    <RefreshCcw className="w-12 h-12 text-white animate-spin" />
                                )}
                            </div>
                        </div>

                        {/* Details List */}
                        <div className={`p-5 bg-white ${hasMiniStatement ? 'flex gap-6 items-start' : ''}`}>
                            <div className={`flex flex-col gap-2.5 ${hasMiniStatement ? 'w-1/2 border-r border-dashed border-gray-200 pr-6' : ''}`}>
                                {[
                                    { label: 'Customer Name', value: receiptData.customerName },
                                    { label: 'Customer Mobile No', value: receiptData.mobileNo },
                                    ...(receiptData.txnAmount !== '0.00' ? [{ label: 'Withdrawal Amount', value: `₹ ${receiptData.txnAmount}`, isBold: true }] : []),
                                    { label: 'Balance Amount', value: `₹ ${receiptData.balanceAmount}`, isBold: true },
                                    { label: 'Bank Name', value: receiptData.bankName },
                                    { label: 'Aadhar No', value: receiptData.aadhaarNo },
                                    { label: 'Transaction Date & Time', value: receiptData.dateTime },
                                    { label: 'Status', value: receiptData.txnStatus, isStatus: true },
                                    { label: 'Utr No', value: receiptData.rrn },
                                ].map((row: any) => (
                                    <div key={row.label} className="flex justify-between items-start text-[13px] border-b border-dashed border-gray-200 pb-2 last:border-0 last:pb-0">
                                        <span className={`font-semibold text-slate-700 ${row.isBold ? 'text-black text-[14px]' : ''}`}>{row.label}</span>
                                        <span className={`text-right max-w-[60%] break-all ${row.isBold ? 'font-bold text-black text-[15px]' : row.isStatus ? (row.value === 'SUCCESS' ? 'font-bold text-emerald-600' : row.value === 'FAILED' ? 'font-bold text-rose-600' : 'font-bold text-yellow-600') : 'text-slate-600'}`}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                            
                            {hasMiniStatement && (
                                <div className="w-1/2">
                                    <h4 className="font-semibold text-sm text-slate-700 mb-3">Mini Statement Details</h4>
                                    <div className="overflow-visible">
                                        <table className="w-full text-xs border-collapse">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="p-2 border text-left font-semibold text-slate-700">Date</th>
                                                    <th className="p-2 border text-left font-semibold text-slate-700">Narration</th>
                                                    <th className="p-2 border text-left font-semibold text-slate-700">Type</th>
                                                    <th className="p-2 border text-right font-semibold text-slate-700">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {receiptData.ministatementlist.map((item: any, i: number) => (
                                                    <tr key={i} className="border-b">
                                                        <td className="p-2 border text-slate-600 whitespace-nowrap">{item.date || 'N/A'}</td>
                                                        <td className="p-2 border text-slate-600 text-[10px]">{item.narration || '-'}</td>
                                                        <td className={`p-2 border font-bold ${item.txnType === 'Cr' ? 'text-emerald-600' : 'text-rose-600'}`}>{item.txnType}</td>
                                                        <td className="p-2 border text-right text-slate-600">{item.amount}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-[10px] text-amber-500/80 text-center pb-4 bg-white">
                            Note*: This is a system generated receipt and it does not require signature.
                        </p>

                        {/* Actions */}
                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-center print:hidden gap-4">
                            <button onClick={() => window.print()} className="flex items-center gap-2 px-8 py-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 shadow-md transition-colors text-sm font-semibold">
                                <Printer size={16} />
                                Print
                            </button>
                            <button onClick={() => setShowReceiptModal(false)} className="flex items-center gap-2 px-8 py-2.5 rounded-full bg-primary text-white hover:bg-primary/90 shadow-md transition-colors text-sm font-semibold">
                                Next Txn
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Transaction Failed Modal */}
            {showFailureModal && failureData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800">
                        {/* Header */}
                        <div className="flex justify-between items-start p-4 bg-white border-b border-gray-100">
                            <div>
                                <img src={logo} alt="Logo" className="h-10 object-contain dark:brightness-0 dark:invert" />
                            </div>
                            <div className="flex flex-col items-end text-xs text-slate-600 gap-1 relative pr-8">
                                <button 
                                    onClick={() => { setShowFailureModal(false); setFailureData(null); }} 
                                    className="absolute -top-2 -right-2 text-primary hover:text-primary/80 transition-colors bg-white rounded-full p-1"
                                >
                                    <XCircle className="w-6 h-6 fill-primary text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Status Area */}
                        <div className="flex flex-col items-center justify-center py-6 bg-white">
                            <h2 className={`font-bold text-lg mb-4 uppercase tracking-wide text-rose-500`}>
                                {failureData.title}
                            </h2>
                            <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg relative bg-rose-500 shadow-rose-500/20">
                                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-rose-500"></div>
                                <XCircle className="w-12 h-12 text-white" />
                            </div>
                        </div>

                        {/* Paysprint Error Message */}
                        <div className="px-5">
                            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 p-4">
                                <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-rose-600">Response from PaySprint</p>
                                    <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{failureData.paysprintMessage}</p>
                                </div>
                            </div>
                        </div>

                        {/* Details List */}
                        <div className="p-5 bg-white">
                            <div className="flex flex-col gap-2.5">
                                {[
                                    ...(failureData.txnAmount !== '0.00' ? [{ label: 'Transaction Amount', value: `₹ ${failureData.txnAmount}`, isBold: true }] : []),
                                    { label: 'Customer Mobile No', value: failureData.mobileNo },
                                    { label: 'Bank Name', value: failureData.bankName },
                                    { label: 'Aadhaar No', value: failureData.aadhaarNo },
                                    { label: 'Transaction Date & Time', value: failureData.dateTime },
                                    { label: 'Utr No', value: failureData.rrn },
                                ].map((row: any) => (
                                    <div key={row.label} className="flex justify-between items-start text-[13px] border-b border-dashed border-gray-200 pb-2 last:border-0 last:pb-0">
                                        <span className={`font-semibold text-slate-700 ${row.isBold ? 'text-black text-[14px]' : ''}`}>{row.label}</span>
                                        <span className={`text-right max-w-[60%] break-all ${row.isBold ? 'font-bold text-black text-[15px]' : 'text-slate-600'}`}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <p className="text-[10px] text-amber-500/80 text-center pb-4 bg-white">
                            Your entered details have been preserved. Please review and re-scan to retry.
                        </p>

                        {/* Actions */}
                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-center print:hidden gap-4">
                            <button 
                                onClick={() => { setShowFailureModal(false); setFailureData(null); }}
                                className="flex items-center gap-2 px-8 py-2.5 rounded-full bg-rose-500 text-white hover:bg-rose-600 shadow-md transition-colors text-sm font-semibold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Merchant KYC Modal */}
            {showKycModal && (
                <MerchantKycModal 
                    latitude={location?.latitude?.toString()}
                    longitude={location?.longitude?.toString()}
                    onBack={() => navigate(-1)}
                    onClose={() => {
                        setShowKycModal(false);
                        // Force refresh status
                        setMerchantCode(prev => prev + " ");
                        setTimeout(() => setMerchantCode(prev => prev.trim()), 100);
                    }} 
                />
            )}

            {/* Daily 2FA Auth Modal */}
            {showDailyAuthModal && (
                <DailyAuthModal 
                    activePipes={merchantStatus.activePipes || []}
                    pipe={selectedPipe}
                    latitude={location?.latitude?.toString()}
                    longitude={location?.longitude?.toString()}
                    onClose={(authedPipe) => {
                        setShowDailyAuthModal(false);
                        // daily-auth falls through to the next pipe when one is
                        // unusable; transact on the pipe that actually logged in.
                        if (authedPipe) setSelectedPipe(authedPipe);
                        // Force refresh status
                        setMerchantCode(prev => prev + " ");
                        setTimeout(() => setMerchantCode(prev => prev.trim()), 100);
                    }} 
                />
            )}
        </div>
    )
}

export default AEPS;
