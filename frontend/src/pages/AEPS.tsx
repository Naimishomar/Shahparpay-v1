import { useState, useEffect } from "react";
import { Fingerprint, Clock, CheckCircle2, XCircle } from "lucide-react";
import logo from "../assets/logo.png";

const banks = [
    { name: 'ICICI Bank', logo: 'https://www.google.com/s2/favicons?domain=icicibank.com&sz=128' },
    { name: 'SBI', logo: 'https://www.google.com/s2/favicons?domain=onlinesbi.sbi&sz=128' },
    { name: 'PNB', logo: 'https://www.google.com/s2/favicons?domain=pnbindia.in&sz=128' },
    { name: 'HDFC BANK', logo: 'https://www.google.com/s2/favicons?domain=hdfcbank.com&sz=128' },
    { name: 'Kotak', logo: 'https://www.google.com/s2/favicons?domain=kotak.com&sz=128' },
    { name: 'AXIS BANK', logo: 'https://www.google.com/s2/favicons?domain=axisbank.com&sz=128' },
    { name: 'Bank of India', logo: 'https://www.google.com/s2/favicons?domain=bankofindia.co.in&sz=128' },
    { name: 'BoB', logo: 'https://www.google.com/s2/favicons?domain=bankofbaroda.in&sz=128' },
];

const mockRecentTransactions = [
    { id: 1, name: 'Rahul Kumar', aadhaarNo: '123456789012', bankName: 'SBI', mobileNo: '9876543210', date: '2026-06-08 14:30', status: 'Success', amount: '₹ 500.00' },
    { id: 2, name: 'Anjali Sharma', aadhaarNo: '987654321098', bankName: 'HDFC BANK', mobileNo: '8765432109', date: '2026-06-08 11:15', status: 'Success', amount: '₹ 2,000.00' },
    { id: 3, name: 'Vikram Singh', aadhaarNo: '567890123456', bankName: 'ICICI Bank', mobileNo: '7654321098', date: '2026-06-07 09:45', status: 'Failed', amount: '₹ 1,500.00' },
];

const AEPS = () => {
    // UI State
    const [activeTab, setActiveTab] = useState("cash_withdrawal");
    const [selectedDevice, setSelectedDevice] = useState("mantra");
    
    // Form Field State
    const [name, setName] = useState("");
    const [aadhaarNo, setAadhaarNo] = useState("");
    const [bankName, setBankName] = useState("");
    const [mobileNo, setMobileNo] = useState("");
    const [amount, setAmount] = useState("");
    const [selectedBank, setSelectedBank] = useState("");
    const [consent, setConsent] = useState(false);

    // Modal State
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);
    
    // Biometric Capture State
    const [pidData, setPidData] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    // Sync dropdown with grid selection if desired
    const handleGridBankSelect = (bank: string) => {
        setSelectedBank(bank);
        setBankName(bank.toLowerCase()); 
    };

    const [dynamicBanks, setDynamicBanks] = useState<any[]>([]);

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/aeps/banks');
                const data = await res.json();
                if (data.success && data.data) {
                    setDynamicBanks(data.data);
                }
            } catch(err) {
                console.error("Failed to fetch bank list", err);
            }
        };
        fetchBanks();
    }, []);

    // Load transaction data into form
    const loadTransactionToForm = (tx: typeof mockRecentTransactions[0]) => {
        setName(tx.name);
        setAadhaarNo(tx.aadhaarNo);
        setMobileNo(tx.mobileNo);
        handleGridBankSelect(tx.bankName);
    };

    const [loading, setLoading] = useState(false);

    const captureFingerprint = async () => {
        if (isScanning) return;
        setIsScanning(true);
        try {
            const captureXml = `<PidOptions ver="1.0"><Opts fCount="1" fType="2" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" otp="" wadh="" posh=""/></PidOptions>`;
            
            // Common ports used by RD Services (Mantra, Morpho, Startek, etc.)
            const portsToTry = [11100, 11101, 11102, 11103, 11104, 11105];
            let capturedData = null;
            let successPort = null;

            // Try each port until one responds
            for (const port of portsToTry) {
                try {
                    const response = await fetch(`http://127.0.0.1:${port}/rd/capture`, {
                        method: 'POST',
                        body: captureXml,
                        headers: { 'Content-Type': 'text/xml' }
                    });
                    
                    if (response.ok) {
                        const text = await response.text();
                        if (text && text.includes('<PidData')) {
                            capturedData = text;
                            successPort = port;
                            break; // Stop trying ports if we got a successful response
                        }
                    }
                } catch (e) {
                    // Fetch failed for this port, continue to the next one
                    console.log(`Port ${port} failed, trying next...`);
                }
            }

            if (capturedData && capturedData.includes('errCode="0"')) {
                setPidData(capturedData);
                alert(`Fingerprint captured successfully! (Port: ${successPort})`);
            } else if (capturedData && !capturedData.includes('errCode="0"')) {
                alert(`Device found on port ${successPort}, but capture failed or timed out. Please wipe the scanner and try again.`);
                setPidData(null);
            } else {
                throw new Error("No RD service found on any port.");
            }
        } catch (error) {
            console.error("RD Service Error:", error);
            alert(`Make sure your ${selectedDevice} biometric device is connected, the cable is secure, and the background RD Service app is actively running on your PC.`);
            setPidData(null);
        } finally {
            setIsScanning(false);
        }
    };

    const handleSubmit = async () => {
        if (!aadhaarNo || !bankName || !mobileNo) {
            alert("Please fill all required fields.");
            return;
        }
        if (!consent) {
            alert("Please check the consent box.");
            return;
        }
        if (!pidData) {
            alert("Please scan fingerprint first!");
            return;
        }

        setLoading(true);

        try {
            // Find the selected bank from dynamic list to get the actual IIN, fallback to 607152 if not found
            const selectedBankObj = dynamicBanks.find((b: any) => 
                (b.bankName || "").toLowerCase() === bankName.toLowerCase() || 
                (b.bank_name || "").toLowerCase() === bankName.toLowerCase()
            );
            const actualIIN = selectedBankObj?.iinno || selectedBankObj?.bank_iin || '607152';

            const apiPayload: any = {
                mobileNumber: mobileNo,
                aadhaarNumber: aadhaarNo,
                bankIIN: actualIIN,
                pidData: pidData
            };

            let endpoint = '';
            if (activeTab === 'balance_enquiry') {
                endpoint = 'http://localhost:3000/api/aeps/balance-enquiry';
            } else if (activeTab === 'cash_withdrawal') {
                endpoint = 'http://localhost:3000/api/aeps/cash-withdrawal';
                apiPayload.amount = amount;
                
                if (!amount) {
                    alert("Please enter the amount to withdraw.");
                    setLoading(false);
                    return;
                }
            } else {
                endpoint = 'http://localhost:3000/api/aeps/other'; // Mini statement fallback
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload)
            });

            const result = await response.json();
            
            if (result.success) {
                const data = {
                    dateTime: new Date().toLocaleString(),
                    bankName: bankName ? bankName.toUpperCase() : 'BANK',
                    agentName: 'RETAILER', 
                    aadhaarNo: '********' + (aadhaarNo.slice(-4) || ''),
                    rrn: result.data?.data?.rrn || 'N/A',
                    stan: result.data?.data?.stan || 'N/A',
                    txnStatus: 'SUCCESS',
                    amount: result.data?.data?.balanceamount || '0.00'
                };
                setReceiptData(data);
                setShowReceiptModal(true);
            } else {
                alert("Transaction Failed: " + (result.message || "Unknown error"));
            }
            setPidData(null); // Reset fingerprint after successful submission
        } catch (error) {
            console.error(error);
            alert("Failed to connect to the server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-bold text-glow">AEPS</h1>
                    <div className="flex items-center gap-6 border-b border-border">
                        <button 
                            onClick={() => setActiveTab('balance_enquiry')}
                            className={`pb-2 font-medium transition-colors ${activeTab === 'balance_enquiry' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Balance Enquiry
                        </button>
                        <button 
                            onClick={() => setActiveTab('mini_statement')}
                            className={`pb-2 font-medium transition-colors ${activeTab === 'mini_statement' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Mini Statement
                        </button>
                        <button 
                            onClick={() => setActiveTab('cash_withdrawal')}
                            className={`pb-2 font-medium transition-colors ${activeTab === 'cash_withdrawal' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Cash Withdrawal
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Form Container */}
            <div className="flex flex-col gap-6 glass-card p-6 rounded-2xl relative overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col gap-6">
                    {/* Inputs Row */}
                    <div className="flex flex-col gap-4 bg-primary/5 p-5 border-l-4 border-primary rounded-lg">
                        <h2 className="text-lg font-bold text-foreground border-b border-border/50 pb-2">
                            {activeTab === 'balance_enquiry' ? 'Balance Enquiry' : activeTab === 'mini_statement' ? 'Mini Statement' : 'Cash Withdrawal'}
                        </h2>
                        
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Name</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your Name" 
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
                                <label className="text-sm font-medium text-foreground">Bank Name</label>
                                <select 
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors"
                                >
                                    <option value="">Choose Your Bank</option>
                                    {(dynamicBanks.length > 0 ? dynamicBanks : banks).map((b: any) => {
                                        const bName = b.name || b.bankName || b.bank_name;
                                        return (
                                            <option key={bName} value={bName.toLowerCase()}>
                                                {bName}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Mobile Number</label>
                                <input 
                                    type="text" 
                                    value={mobileNo}
                                    onChange={(e) => setMobileNo(e.target.value)}
                                    placeholder="Enter your mobile number" 
                                    className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors" 
                                />
                            </div>

                            {activeTab === 'cash_withdrawal' && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Amount</label>
                                    <input 
                                        type="number" 
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="Enter amount to withdraw" 
                                        className="w-full p-2.5 border border-border rounded-md focus:border-primary outline-none bg-background shadow-sm transition-colors" 
                                    />
                                </div>
                            )}
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
                                        alt={bank.name} 
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
                                    <span className="text-xs font-semibold text-center text-foreground">{bank.name}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    {/* Device Selection */}
                    <div className="flex flex-col gap-4 border border-border p-4 rounded-xl bg-background/30 backdrop-blur-sm">
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
                                            {/* Replace this icon with your local <img> asset when available */}
                                            <Fingerprint className="w-6 h-6 opacity-80" />
                                        </div>
                                        <span className={`font-medium transition-colors ${selectedDevice === device.name.toLowerCase() ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                            {device.name}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Consent */}
                    <label className="flex items-start md:items-center gap-3 cursor-pointer mt-2 group">
                        <input 
                            type="checkbox" 
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary mt-1 md:mt-0" 
                        />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            I hereby provide my consent to CSP to use my Aadhaar number/ VID to complete AEPS transaction authorisation.
                        </span>
                    </label>

                    {/* Actions */}
                    <div className="flex flex-col md:flex-row justify-center gap-4 mt-4">
                        <button 
                            onClick={(e) => { e.preventDefault(); captureFingerprint(); }}
                            disabled={isScanning}
                            className={`flex items-center justify-center gap-2 px-6 py-2.5 bg-background border rounded-lg font-bold transition-all duration-300 ${
                                pidData 
                                    ? 'border-primary text-primary shadow-[0_0_15px_rgba(139,92,246,0.15)] hover:bg-primary/5' 
                                    : 'border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                            }`}
                        >
                            {pidData ? <CheckCircle2 size={20} /> : <Fingerprint size={20} />}
                            {isScanning ? "Scanning..." : pidData ? "Fingerprint Scanned" : "Scan Finger Print"}
                        </button>
                        <button onClick={handleSubmit} disabled={loading || !pidData} className="px-10 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] transition-all duration-300 disabled:opacity-50">
                            {loading ? "Processing..." : "Submit"}
                        </button>
                    </div>

                    {/* Recent Transactions Section */}
                    <div className="mt-8 pt-6 border-t border-border">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold text-foreground">Recent Transactions</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {mockRecentTransactions.map((tx) => (
                                <div 
                                    key={tx.id} 
                                    onClick={() => loadTransactionToForm(tx)}
                                    className="flex flex-col p-4 rounded-xl border border-border bg-background/30 hover:bg-background/80 hover:border-primary/50 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{tx.name}</p>
                                            <p className="text-xs text-muted-foreground">{tx.date}</p>
                                        </div>
                                        {tx.status === 'Success' ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500" />
                                        )}
                                    </div>
                                    
                                    <div className="flex justify-between items-end mt-auto pt-2 border-t border-border/50">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <img 
                                                    src={banks.find(b => b.name.toLowerCase() === tx.bankName.toLowerCase())?.logo || 'https://www.google.com/s2/favicons?domain=bank.com&sz=128'} 
                                                    alt={tx.bankName} 
                                                    className="w-5 h-5 object-contain rounded-sm"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded w-max">
                                                    {tx.bankName}
                                                </span>
                                            </div>
                                            <span className="text-xs text-muted-foreground tracking-wider">
                                                **** {tx.aadhaarNo.slice(-4)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-sm text-foreground">{tx.amount}</p>
                                            <p className={`text-[10px] font-bold ${tx.status === 'Success' ? 'text-emerald-500' : 'text-red-500'}`}>{tx.status}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Receipt Modal */}
            {showReceiptModal && receiptData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-border flex justify-between items-start bg-muted/30">
                            <div className="flex flex-col gap-2">
                                <img src={logo} alt="Shahparpay Logo" className="h-14 object-contain w-max dark:brightness-0 dark:invert" />
                                <h3 className="font-semibold text-lg text-foreground">Customer Copy - Cash Withdrawal</h3>
                            </div>
                            <button onClick={() => setShowReceiptModal(false)} className="text-muted-foreground hover:text-foreground transition-colors mt-1">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <table className="w-full text-sm border-collapse border border-border">
                                <tbody>
                                    {[
                                        { label: 'Date & Time', value: receiptData.dateTime },
                                        { label: 'Bank Name', value: receiptData.bankName },
                                        { label: 'Agent Name', value: receiptData.agentName },
                                        { label: 'Aadhaar No.', value: receiptData.aadhaarNo },
                                        { label: 'RRN', value: receiptData.rrn },
                                        { label: 'STAN', value: receiptData.stan },
                                        { label: 'Txn Status', value: receiptData.txnStatus },
                                        { label: 'Amount', value: receiptData.amount },
                                    ].map((row, idx) => (
                                        <tr key={row.label} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                                            <td className="p-3 font-medium text-muted-foreground border-r border-border w-[40%] bg-muted/5">{row.label}</td>
                                            <td className="p-3 text-foreground break-all">{row.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-muted/30 flex justify-end gap-3 border-t border-border">
                            <button onClick={() => setShowReceiptModal(false)} className="px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors text-sm font-medium">Close</button>
                            <button onClick={() => window.print()} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors text-sm font-medium">Print</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AEPS;