import { useState } from "react"
import { FileText, Search, Download } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const LedgerReport = () => {
    // Dummy Data based on user requirements
    const [transactions] = useState([
        {
            id: "DGFINPAY844f08416f",
            customerName: "John Doe",
            mobile: "9876543210",
            amount: "156,510.34",
            balance: "156,000.00",
            bankName: "State Bank of India",
            aadhaar: "********7984",
            dateTime: "2026-07-10 12:26:10",
            status: "SUCCESS",
            utr: "619409045419"
        },
        {
            id: "DGFINPAYb659030e7c",
            customerName: "Jane Smith",
            mobile: "8765432109",
            amount: "25,000.00",
            balance: "131,503.27",
            bankName: "HDFC Bank",
            aadhaar: "********1234",
            dateTime: "2026-07-10 12:00:08",
            status: "FAILED",
            utr: "619409045420"
        },
        {
            id: "DGFINBE1179bffd71",
            customerName: "Alice Johnson",
            mobile: "7654321098",
            amount: "7,000.00",
            balance: "124,491.51",
            bankName: "ICICI Bank",
            aadhaar: "********5678",
            dateTime: "2026-07-10 11:21:18",
            status: "PENDING",
            utr: "619409045421"
        },
        {
            id: "DGFINCWd2a2860e12",
            customerName: "Bob Williams",
            mobile: "6543210987",
            amount: "100.00",
            balance: "124,391.51",
            bankName: "Axis Bank",
            aadhaar: "********9012",
            dateTime: "2026-07-10 11:19:52",
            status: "SUCCESS",
            utr: "619409045422"
        },
        {
            id: "DGFINBE3648612eb1",
            customerName: "Charlie Brown",
            mobile: "5432109876",
            amount: "3,000.00",
            balance: "121,381.22",
            bankName: "Kotak Mahindra",
            aadhaar: "********3456",
            dateTime: "2026-07-10 10:46:11",
            status: "SUCCESS",
            utr: "619409045423"
        }
    ]);

    return (
        <div className="flex-1 w-full flex flex-col p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Ledger Reports</h1>
                            <p className="text-sm text-muted-foreground">View your comprehensive transaction history and balances.</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input 
                                type="text" 
                                placeholder="Search by ID or Mobile..." 
                                className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
                            />
                        </div>
                        <button className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>
                
                {/* Table Container */}
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-gray-50/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3">Transaction ID</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3">Date & Time</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3">Customer</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3">Mobile No</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3">Bank</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3">Aadhar No</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3 text-right">Txn Amount</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3 text-right">Balance</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3">UTR No</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((tx, idx) => (
                                    <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="font-medium text-xs text-slate-600 px-4 py-3 whitespace-nowrap">{tx.id}</TableCell>
                                        <TableCell className="text-xs text-slate-500 px-4 py-3 whitespace-nowrap">{tx.dateTime}</TableCell>
                                        <TableCell className="text-sm font-medium text-slate-700 px-4 py-3 whitespace-nowrap">{tx.customerName}</TableCell>
                                        <TableCell className="text-xs text-slate-600 px-4 py-3 whitespace-nowrap">{tx.mobile}</TableCell>
                                        <TableCell className="text-xs font-medium text-primary px-4 py-3 whitespace-nowrap">{tx.bankName}</TableCell>
                                        <TableCell className="text-xs text-slate-500 tracking-wider px-4 py-3 whitespace-nowrap">{tx.aadhaar}</TableCell>
                                        <TableCell className="text-sm font-bold text-slate-700 text-right px-4 py-3 whitespace-nowrap">₹ {tx.amount}</TableCell>
                                        <TableCell className="text-sm font-bold text-slate-700 text-right px-4 py-3 whitespace-nowrap">₹ {tx.balance}</TableCell>
                                        <TableCell className="text-xs text-slate-500 px-4 py-3 whitespace-nowrap">{tx.utr}</TableCell>
                                        <TableCell className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                tx.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 
                                                tx.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {tx.status}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    
                    {/* Pagination Placeholder */}
                    <div className="p-4 border-t border-border flex items-center justify-between bg-gray-50/30">
                        <span className="text-xs text-muted-foreground">Showing 1 to {transactions.length} of {transactions.length} entries</span>
                        <div className="flex gap-1">
                            <button className="px-3 py-1 border border-border rounded text-xs text-muted-foreground hover:bg-gray-100" disabled>Previous</button>
                            <button className="px-3 py-1 border border-primary bg-primary text-primary-foreground rounded text-xs">1</button>
                            <button className="px-3 py-1 border border-border rounded text-xs text-muted-foreground hover:bg-gray-100" disabled>Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LedgerReport;
