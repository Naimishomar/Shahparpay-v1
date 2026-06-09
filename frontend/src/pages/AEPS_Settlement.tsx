import { useState, useEffect } from "react";
import { Search, Download, RotateCcw } from "lucide-react";

// Mock Data representing the table structure
const mockReports = [
    { id: 1, orderId: "260609496296", txnId: "DGFINCW533590e697", dateTime: "2026-06-09 20:11:08", service: "Cash Withdrawal", bank: "Bank of India", accountNo: "XXXX1234", amount: "300.00", rrn: "616020792528" },
    { id: 2, orderId: "260609370160", txnId: "DGFINBEddfe213ef9", dateTime: "2026-06-09 20:07:29", service: "Balance Enquiry", bank: "Bank of India", accountNo: "XXXX5678", amount: "0.00", rrn: "616020784855" },
    { id: 3, orderId: "260609271291", txnId: "DGFINBE91421ddb28", dateTime: "2026-06-09 19:46:35", service: "Balance Enquiry", bank: "Bank of India", accountNo: "XXXX9012", amount: "0.00", rrn: "616019733248" },
    { id: 4, orderId: "260609582785", txnId: "DGFINBE4ba491df14", dateTime: "2026-06-09 19:39:45", service: "Balance Enquiry", bank: "Punjab National Bank", accountNo: "XXXX3456", amount: "0.00", rrn: "616019713843" },
    { id: 5, orderId: "260609753866", txnId: "DGFINCW778e7aa3bb", dateTime: "2026-06-09 19:36:47", service: "Cash Withdrawal", bank: "Bank of India", accountNo: "XXXX7890", amount: "100.00", rrn: "616019705373" },
    { id: 6, orderId: "260609240393", txnId: "DGFINBE65d767df94", dateTime: "2026-06-09 19:35:05", service: "Balance Enquiry", bank: "State Bank of India", accountNo: "XXXX2345", amount: "0.00", rrn: "N/A" },
];

const AEPS_Settlement = () => {
    const [reports, setReports] = useState(mockReports);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [status, setStatus] = useState("");

    // ============================================================================
    // BACKEND INTEGRATION INSTRUCTIONS:
    // 1. Write an async function to fetch data from your API.
    // 2. Pass `fromDate`, `toDate`, and `status` as query parameters.
    // 3. Call this function in the `useEffect` for the initial load.
    // 4. Call it inside `handleSearch` whenever the user clicks the "Search" button.
    // ============================================================================
    
    /* 
    // Example Integration Code:
    const fetchReports = async () => {
        try {
            // Replace with your actual backend URL:
            const queryParams = new URLSearchParams({
                startDate: fromDate,
                endDate: toDate,
                status: status
            }).toString();

            const response = await fetch(`/api/aeps/reports?${queryParams}`);
            const data = await response.json();
            
            // Assuming your backend returns an array of reports:
            setReports(data.reports);
        } catch (error) {
            console.error("Failed to fetch reports:", error);
        }
    };

    // Run when the component mounts
    useEffect(() => {
        fetchReports();
    }, []);
    */

    const handleSearch = () => {
        // UNCOMMENT WHEN READY TO FETCH:
        // fetchReports();
        console.log("Searching with:", { fromDate, toDate, status });
    };

    const handleReset = () => {
        setFromDate("");
        setToDate("");
        setStatus("");
        
        // UNCOMMENT TO RE-FETCH ALL DATA ON RESET:
        // fetchReports(); 
    };

    return (
        <div className="flex flex-col gap-6 w-full p-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <h1 className="text-2xl font-bold text-foreground">Aeps Reports</h1>

            {/* Filters Section */}
            <div className="flex flex-wrap items-center gap-4 bg-background p-4 rounded-lg border border-border shadow-sm">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">From</label>
                    <input 
                        type="date" 
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="p-2 border border-border rounded-md focus:border-primary outline-none bg-background text-sm text-foreground"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">To</label>
                    <input 
                        type="date" 
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="p-2 border border-border rounded-md focus:border-primary outline-none bg-background text-sm text-foreground"
                    />
                </div>
                
                <div className="flex items-center gap-2 min-w-[150px]">
                    <select 
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full p-2 border border-border rounded-md focus:border-primary outline-none bg-background text-sm text-foreground"
                    >
                        <option value="">Choose Status</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-3 ml-auto mt-2 md:mt-0">
                    <button 
                        onClick={handleSearch}
                        className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-all duration-300 text-sm font-medium shadow-[0_0_10px_rgba(139,92,246,0.2)] hover:shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                    >
                        <Search className="w-4 h-4" />
                        Search
                    </button>
                    <button 
                        className="flex items-center gap-2 px-5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-md transition-all duration-300 text-sm font-medium shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button 
                        onClick={handleReset}
                        className="flex items-center gap-2 px-5 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-md transition-all duration-300 text-sm font-medium"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 border-b border-border text-foreground font-semibold">
                        <tr>
                            <th className="p-4 py-3 whitespace-nowrap">No.</th>
                            <th className="p-4 py-3 whitespace-nowrap">Order ID</th>
                            <th className="p-4 py-3 whitespace-nowrap">Txn ID</th>
                            <th className="p-4 py-3 whitespace-nowrap">Date Time</th>
                            <th className="p-4 py-3 whitespace-nowrap">Service</th>
                            <th className="p-4 py-3 whitespace-nowrap">Bank</th>
                            <th className="p-4 py-3 whitespace-nowrap">Account No.</th>
                            <th className="p-4 py-3 whitespace-nowrap text-right">Amount</th>
                            <th className="p-4 py-3 whitespace-nowrap">Bank RRN</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((report, index) => (
                            <tr key={report.id} className="border-b border-border hover:bg-muted/30 transition-colors last:border-0 text-muted-foreground group">
                                <td className="p-4 py-3 font-medium text-foreground">{index + 1}</td>
                                <td className="p-4 py-3 text-orange-500 font-medium group-hover:text-orange-600 transition-colors">{report.orderId}</td>
                                <td className="p-4 py-3 text-foreground/80">{report.txnId}</td>
                                <td className="p-4 py-3">{report.dateTime}</td>
                                <td className="p-4 py-3 text-foreground/90">{report.service}</td>
                                <td className="p-4 py-3">{report.bank}</td>
                                <td className="p-4 py-3 text-foreground/80">{report.accountNo}</td>
                                <td className="p-4 py-3 text-right font-semibold text-foreground">₹ {report.amount}</td>
                                <td className="p-4 py-3">{report.rrn}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {reports.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        No reports found for the selected filters.
                    </div>
                )}
            </div>
        </div>
    )
}

export default AEPS_Settlement;