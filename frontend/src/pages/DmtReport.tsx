import { useState, useEffect } from "react"
import { FileText, Search, Download, FileDown, Loader2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import axios from "axios"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const DmtReport = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const token = localStorage.getItem('token');
                const typeQuery = "DMT" ? `&type=DMT` : "";
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/dashboard/recent-transactions?limit=100${typeQuery}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data.success) {
                    setTransactions(res.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch transactions:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, []);

    const filteredTransactions = transactions.filter(tx => 
        tx.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        tx.metadata?.mobile?.includes(searchTerm) ||
        tx.metadata?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDownloadCSV = () => {
        const headers = ["Transaction ID", "Date & Time", "Customer", "Mobile", "Bank", "Amount", "Status"];
        const csvRows = [headers.join(",")];
        
        filteredTransactions.forEach(tx => {
            const row = [
                tx.transactionId || tx._id || "N/A",
                new Date(tx.createdAt).toLocaleString(),
                tx.metadata?.name || tx.metadata?.customerName || "N/A",
                tx.metadata?.mobile || "N/A",
                tx.metadata?.bankName || "N/A",
                tx.amount || 0,
                tx.status || "UNKNOWN"
            ];
            // Escape commas in strings
            const escapedRow = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
            csvRows.push(escapedRow.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `DmtReport_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text("DMT Reports", 14, 15);
        
        const tableColumn = ["ID", "Date", "Customer", "Mobile", "Bank", "Amount", "Status"];
        const tableRows: any[] = [];

        filteredTransactions.forEach(tx => {
            const txData = [
                tx.transactionId || tx._id || "N/A",
                new Date(tx.createdAt).toLocaleString(),
                tx.metadata?.name || tx.metadata?.customerName || "N/A",
                tx.metadata?.mobile || "N/A",
                tx.metadata?.bankName || "N/A",
                tx.amount || 0,
                tx.status || "UNKNOWN"
            ];
            tableRows.push(txData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`DmtReport_${new Date().getTime()}.pdf`);
    };

    return (
        <div className="flex-1 w-full flex flex-col p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">DMT Reports</h1>
                            <p className="text-sm text-muted-foreground">View your Domestic Money Transfer transactions.</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input 
                                type="text" 
                                placeholder="Search by ID or Mobile..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
                            />
                        </div>
                        <button onClick={handleDownloadCSV} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                        <button onClick={handleDownloadPDF} className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                            <FileDown className="w-4 h-4" />
                            Export PDF
                        </button>
                    </div>
                </div>
                
                {/* Table Container */}
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="font-semibold text-foreground whitespace-nowrap px-4 py-3">Transaction ID</TableHead>
                                    <TableHead className="font-semibold text-foreground whitespace-nowrap px-4 py-3">Date & Time</TableHead>
                                    <TableHead className="font-semibold text-foreground whitespace-nowrap px-4 py-3">Customer</TableHead>
                                    <TableHead className="font-semibold text-foreground whitespace-nowrap px-4 py-3">Mobile No</TableHead>
                                    <TableHead className="font-semibold text-foreground whitespace-nowrap px-4 py-3">Bank</TableHead>
                                    <TableHead className="font-semibold text-foreground whitespace-nowrap px-4 py-3 text-right">Amount</TableHead>
                                    <TableHead className="font-semibold text-foreground whitespace-nowrap px-4 py-3 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                <span>Loading transactions...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTransactions.map((tx, idx) => (
                                        <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-medium text-xs text-foreground/80 px-4 py-3 whitespace-nowrap">{tx.transactionId || tx._id || "N/A"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground px-4 py-3 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm font-medium text-foreground px-4 py-3 whitespace-nowrap">{tx.metadata?.name || tx.metadata?.customerName || "N/A"}</TableCell>
                                            <TableCell className="text-xs text-foreground/80 px-4 py-3 whitespace-nowrap">{tx.metadata?.mobile || "N/A"}</TableCell>
                                            <TableCell className="text-xs font-medium text-primary px-4 py-3 whitespace-nowrap">{tx.metadata?.bankName || "N/A"}</TableCell>
                                            <TableCell className="text-sm font-bold text-foreground text-right px-4 py-3 whitespace-nowrap">₹ {tx.amount || 0}</TableCell>
                                            <TableCell className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 
                                                    tx.status === 'FAILED' ? 'bg-rose-500/10 text-rose-500' : 
                                                    'bg-yellow-500/10 text-yellow-500'
                                                }`}>
                                                    {tx.status || "UNKNOWN"}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    
                    {/* Footer */}
                    <div className="p-4 border-t border-border flex items-center justify-between bg-muted/30">
                        <span className="text-xs text-muted-foreground">Showing {filteredTransactions.length} entries</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DmtReport;
