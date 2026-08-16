import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Fingerprint, Clock, CheckCircle2, XCircle, RefreshCcw, ShieldCheck, KeyRound, Wallet, FileText, IndianRupee, CreditCard, Loader2, Store, Phone, Printer } from "lucide-react";
import logo from "../assets/logo.png";
import MerchantKycModal from "../components/MerchantKycModal";
import DailyAuthModal from "../components/DailyAuthModal";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { useLocationContext } from "../context/LocationContext";
import { z } from "zod";

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
                    if (!data.data.isDailyAuthDoneToday) {
                        setShowDailyAuthModal(true);
                    }
                }
            })
            .catch(err => console.error("Failed to fetch merchant status", err))
            .finally(() => setIsLoadingStatus(false));
    }, [merchantCode, selectedPipe]);
    
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
            // High-security L1 options package (fType="2")
            // WADH is intentionally NOT sent for AEPS transactions — including it causes
            // "WADH validation failed in RD(WW)" because PaySprint's transaction PID block
            // uses an empty wadh (see PaySprint docs). Bank 2 strictly rejects fType="0" (FIR+FMR).
            // The customer's AEPS transaction OTP is passed via the `otp` attribute so it gets
            // bound inside the captured PID data (required only for withdrawals >= ₹5000).
            const otpAttr = (activeTab === 'cash_withdrawal' && Number(amount) > AEPS_OTP_THRESHOLD && otp) ? ` otp="${otp}"` : "";
            const captureXml = `<?xml version="1.0"?>
            <PidOptions ver="1.0">
            <Opts fCount="1" fType="2" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" env="P" posh="UNKNOWN"${otpAttr} />
            <CustOpts>
                <Param name="Param1" value="" />
            </CustOpts>
            </PidOptions>
            `;
            // Common ports used by RD Services
            const portsToTry = Array.from({length: 21}, (_, i) => 11100 + i); // 11100 to 11120
            const protocols = window.location.protocol === 'https:' ? ['https', 'http'] : ['http', 'https'];
            const hosts = ['127.0.0.1', 'localhost'];
            
            let activeUrl = null;

            // Step 1: Discover the active RD Service port
            for (const host of hosts) {
                for (const protocol of protocols) {
                    for (const port of portsToTry) {
                        if (activeUrl) break;
                        try {
                            const testUrl = `${protocol}://${host}:${port}`;
                            // UIDAI specifies RDSERVICE method to check status
                            const response = await fetch(`${testUrl}/rd/info`, { method: 'RDSERVICE', headers: { 'Accept': 'text/xml' }, signal: AbortSignal.timeout(500) });
                            
                            if (response.ok) {
                                const text = await response.text();
                                if (text && text.includes('status="READY"')) {
                                    activeUrl = testUrl;
                                }
                            }
                        } catch (e) {
                            const err = e as Error;
                            console.log(`Port ${port} on ${protocol}://${host} failed:`, err.message);
                            // ignore and try next port
                        }
                    }
                }
            }

            if (!activeUrl) {
                throw new Error("RD Service not found on ports 11100-11120. Please ensure Mantra/Morpho RD Service is installed, running, and the device is connected.");
            }

            // Step 2: Capture Biometrics on the discovered port
            const captureResponse = await fetch(`${activeUrl}/rd/capture`, {
                method: 'CAPTURE', // UIDAI strict specification verb
                body: captureXml,
                headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' }
            });
            
            const capturedData = await captureResponse.text();
            console.log('RD Capture Response:', capturedData);

            // Check for RD Service errors in the XML response
            const errCodeMatch = capturedData.match(/errCode="([^"]*)"/);
            const errInfoMatch = capturedData.match(/errInfo="([^"]*)"/);
            const errCode = errCodeMatch ? errCodeMatch[1] : null;
            const errInfo = errInfoMatch ? errInfoMatch[1] : null;

            if (errCode === '0' && capturedData.includes('PidData')) {
                setPidData(capturedData);
            } else {
                let errorMsg = "Biometric capture failed. Please clean the scanner and try again.";
                if (errCode && errInfo) {
                    errorMsg = `RD Service Error (${errCode}): ${errInfo}`;
                } else if (capturedData.includes('init')) {
                    errorMsg = "RD Service initialization error. Please restart the RD Service (Mantra/Morpho) and try again.";
                }
                toast.error(errorMsg);
                setPidData(null);
            }
        } catch (error) {
            console.error("RD Service Error:", error);
            toast.error(`Could not connect to ${selectedDevice}. Ensure RD Service is running and ad-blockers are disabled.`);
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
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col gap-4">
                {/* Title and Tabs Row */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-8">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                        <Fingerprint className="text-primary" size={28} />
                        AEPS
                    </h1>
                    <div className="flex items-center gap-6 border-b border-border hidden md:flex">
                        <button 
                            onClick={() => { invalidateOtp(); setActiveTab('balance_enquiry'); }}
                            className={`pb-2 px-2 font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'balance_enquiry' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Wallet size={16} />
                            Balance Enquiry
                        </button>
                        <button 
                            onClick={() => { invalidateOtp(); setActiveTab('mini_statement'); }}
                            className={`pb-2 px-2 font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'mini_statement' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <FileText size={16} />
                            Mini Statement
                        </button>
                        <button 
                            onClick={() => { invalidateOtp(); setActiveTab('cash_withdrawal'); }}
                            className={`pb-2 px-2 font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'cash_withdrawal' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <IndianRupee size={16} />
                            Cash Withdrawal
                        </button>
                        <button 
                            onClick={() => { invalidateOtp(); setActiveTab('cash_deposit'); }}
                            className={`pb-2 px-2 font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'cash_deposit' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <CreditCard size={16} />
                            Cash Deposit
                        </button>
                        {/* <button 
                            onClick={() => setActiveTab('aadhaar_pay')}
                            className={`pb-2 px-2 font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'aadhaar_pay' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <CreditCard size={16} />
                            Aadhaar Pay
                        </button> */}
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex flex-wrap items-center justify-end w-full gap-3">
                    <div className="flex flex-wrap gap-2">
                        {/* Tracker UI logic: Hides KYC if complete, changes Daily Auth appearance if done */}
                        {isLoadingStatus ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-400 border border-gray-200 text-sm font-semibold shadow-sm animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading Status...
                            </div>
                        ) : (
                            <>
                                {!merchantStatus.isDailyAuthDoneToday && (
                                    <button 
                                        onClick={() => setShowDailyAuthModal(true)} 
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-all text-sm font-semibold shadow-sm animate-pulse"
                                        title="Daily 2FA Authentication Needed"
                                    >
                                        <KeyRound size={16} />
                                        Pending Daily Auth
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/* Main Form Container */}
            <div className="flex flex-col gap-6 glass-card p-6 rounded-2xl relative overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col gap-6">
                    
                    <div className="flex flex-col xl:flex-row justify-between gap-6 w-full">
{/* Inputs Row */}
                    <div className="flex flex-col gap-4 bg-primary/5 p-5 border-l-4 border-primary rounded-lg flex-1">
                        <h2 className="text-lg font-bold text-foreground border-b border-border/50 pb-2">
                            {activeTab === 'balance_enquiry' ? 'Balance Enquiry' : activeTab === 'mini_statement' ? 'Mini Statement' : activeTab === 'cash_deposit' ? 'Cash Deposit' : activeTab === 'aadhaar_pay' ? 'Aadhaar Pay' : 'Cash Withdrawal'}
                        </h2>
                        
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Customer Name</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter customer name" 
                                    className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors" 
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Aadhaar Number</label>
                                <input 
                                    type="text" 
                                    value={aadhaarNo}
                                    onChange={(e) => setAadhaarNo(e.target.value)}
                                    placeholder="Enter your aadhaar number" 
                                    className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors" 
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Customer Bank Name</label>
                                <select 
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
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

                            {activeTab !== 'balance_enquiry' && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Mobile Number</label>
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
                                        className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors" 
                                    />
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
                                            className="w-full pl-8 p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors" 
                                        />
                                    </div>
                                    {amount && Number(amount) > 0 && (
                                        <span className="text-xs font-semibold text-emerald-600 mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1">
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
                                                className="px-3 py-1.5 text-xs font-medium rounded-md border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-colors"
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
                                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    {/* AEPS Transaction OTP - required only for withdrawals > ₹5000 */}
                                    {activeTab === 'cash_withdrawal' && Number(amount) > AEPS_OTP_THRESHOLD && (
                                        <div className="flex flex-col gap-2 mt-2 border-t border-border/60 pt-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                                    <KeyRound size={14} className="text-primary" />
                                                    AEPS Transaction OTP
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={handleSendOtp}
                                                    disabled={sendingOtp}
                                                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                                                >
                                                    {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : (otpSent ? "Resend OTP" : "Send OTP")}
                                                </button>
                                            </div>
                                            {otpSent && (
                                                <>
                                                    <p className="text-xs text-emerald-600 font-medium">
                                                        OTP sent to the customer's registered mobile number.
                                                    </p>
                                                    <input
                                                        type="text"
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        placeholder="Enter 6-digit OTP"
                                                        className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors text-center tracking-[0.4em] font-bold"
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
                    </div>

                        {/* Right Column: Scan & Action Area */}
                        <div className="flex flex-col items-center justify-center gap-6 bg-primary/5 p-5 border-r-4 border-primary rounded-lg w-full lg:w-[400px]">
                            {/* Consent */}
                            <label className="flex items-start gap-3 cursor-pointer group w-full bg-background p-4 rounded-xl border border-border">
                                <input 
                                    type="checkbox" 
                                    checked={consent}
                                    onChange={(e) => setConsent(e.target.checked)}
                                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary mt-1 cursor-pointer shrink-0" 
                                />
                                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                                    I hereby provide my consent to CSP to use my Aadhaar number/ VID to complete AEPS transaction authorisation.
                                </span>
                            </label>

                            {/* Scan Button */}
                            <button 
                                onClick={captureFingerprint} 
                                disabled={isScanning || !!pidData}
                                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all w-full
                                    ${pidData 
                                        ? 'border-green-500 bg-green-50 dark:bg-green-500/10' 
                                        : 'border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 cursor-pointer bg-background'}`}
                            >
                                <div className="relative">
                                    <Fingerprint className={`w-12 h-12 ${pidData ? 'text-green-500' : 'text-primary'} ${isScanning ? 'animate-pulse' : ''}`} />
                                    {isScanning && (
                                        <div className="absolute inset-0 bg-primary/20 animate-ping rounded-full"></div>
                                    )}
                                </div>
                                <div className="text-center">
                                    <h3 className={`font-semibold ${pidData ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
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
                            <div className="flex gap-4 w-full">
                                <button onClick={() => {
                                    setAadhaarNo('');
                                    setMobileNo('');
                                    setAmount('');
                                    setPidData(null);
                                    setBankName('');
                                    invalidateOtp();
                                }} className="flex-1 py-3 rounded-lg border border-border hover:bg-muted font-medium transition-colors">
                                    Clear
                                </button>
                                <button onClick={handleSubmit} disabled={loading || !pidData} className="flex-1 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] transition-all duration-300 disabled:opacity-50">
                                    {loading ? <RefreshCcw className="animate-spin mx-auto" size={20} /> : "Submit"}
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Popular Banks Selection */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        {banks.map((bank) => (
                            <label 
                                key={bank.name} 
                                className={`flex flex-col items-center justify-between p-4 border rounded-xl cursor-pointer transition-all duration-300 gap-3 bg-background/50 hover:-translate-y-1 ${selectedBank === bank.name ? 'border-primary ring-1 ring-primary shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'border-border hover:border-primary/50 hover:shadow-md'}`}
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
                                        className="w-3.5 h-3.5 text-primary focus:ring-primary accent-primary"
                                    />
                                    <span className="text-xs font-semibold text-center text-foreground">{bank.displayName}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    {/* Device Selection and Reset */}
                    <div className="flex items-center justify-between gap-4 border border-border p-4 rounded-xl bg-background/30 backdrop-blur-sm flex-wrap">
                        <div className="flex flex-wrap gap-8">
                            {[
                                { name: 'Mantra', logo: 'Mantra' },
                                { name: 'Morpho', logo: 'Morpho' },
                                { name: 'Startek', logo: 'Startek' }
                            ].map((device) => (
                                <label key={device.name} className={`flex items-center gap-3 p-2 pr-4 rounded-lg cursor-pointer transition-all border ${selectedDevice === device.name.toLowerCase() ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'} group`}>
                                    <input 
                                        type="radio" 
                                        name="device" 
                                        value={device.name.toLowerCase()}
                                        checked={selectedDevice === device.name.toLowerCase()}
                                        onChange={() => setSelectedDevice(device.name.toLowerCase())}
                                        className="w-4 h-4 text-primary focus:ring-primary accent-primary" 
                                    />
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/50 dark:bg-black/20 rounded-md flex items-center justify-center shadow-sm overflow-hidden border border-border/50 p-1 text-primary">
                                            <Fingerprint className="w-6 h-6 opacity-80" />
                                        </div>
                                        <span className={`font-medium transition-colors ${selectedDevice === device.name.toLowerCase() ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                            {device.name}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <button 
                            onClick={handleReset} 
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 border border-red-200 transition-all text-sm font-semibold shadow-sm h-fit"
                            title="Reset all fields"
                        >
                            <RefreshCcw size={16} />
                            Reset
                        </button>
                    </div>

                    {/* Recent Transactions Section */}
                    <div className="mt-8 pt-6 border-t border-border">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold text-foreground">Recent Transactions</h3>
                            <Link to="/reports" className="ml-auto text-sm text-primary hover:underline bg-primary/10 px-3 py-1 rounded-full font-medium transition-colors">
                                View More
                            </Link>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recentTransactions.map((tx) => (
                                <div 
                                    key={tx._id} 
                                    onClick={() => loadTransactionToForm(tx)}
                                    className="flex flex-col p-4 rounded-xl border border-border bg-background/30 hover:bg-background/80 hover:border-primary/50 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{tx.metadata?.name || 'Customer'}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                                        </div>
                                        {tx.status === 'SUCCESS' ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        ) : tx.status === 'PENDING' ? (
                                            <RefreshCcw className="w-5 h-5 text-yellow-500 animate-spin" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500" />
                                        )}
                                    </div>
                                    
                                    <div className="flex justify-between items-end mt-auto pt-2 border-t border-border/50">
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
                                                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded w-max">
                                                    {tx.metadata?.bankName || 'AEPS'}
                                                </span>
                                            </div>
                                            <span className="text-xs text-muted-foreground tracking-wider">
                                                **** {(tx.metadata?.aadhaar || 'XXXX').slice(-4)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-sm text-foreground">₹ {tx.amount.toFixed(2)}</p>
                                            <p className={`text-[10px] font-bold ${tx.status === 'SUCCESS' ? 'text-emerald-500' : tx.status === 'PENDING' ? 'text-yellow-500' : 'text-red-500'}`}>{tx.status}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

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
                    latitude={location?.latitude?.toString()}
                    longitude={location?.longitude?.toString()}
                    onClose={() => {
                        setShowDailyAuthModal(false);
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
