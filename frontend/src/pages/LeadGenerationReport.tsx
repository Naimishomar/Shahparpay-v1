import { useState, useEffect, useMemo } from "react"
import { FileText, Search, Download, FileDown, Loader2, ChevronLeft, ChevronRight, RefreshCw, ExternalLink, Users } from "lucide-react"
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
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'

const PRODUCTS: { id: string; name: string }[] = [
    { id: 'CC', name: 'Credit Card' },
    { id: 'PL', name: 'Personal Loan' },
    { id: 'BL', name: 'Business Loan' },
    { id: 'IL', name: 'Instant Loan' },
    { id: 'SA', name: 'Savings Account' }
];

interface Lead {
    _id?: string;
    refid: string;
    name?: string;
    mobile_no?: string;
    email?: string;
    product: string;
    pincode?: string;
    state?: string;
    executive_status?: string;
    url?: string;
    createdAt?: string;
}

const getProductName = (id: string) => {
    return PRODUCTS.find(p => p.id === id)?.name || id;
};

const getStatusColor = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-500/10 text-emerald-500';
    if (status === 'REJECTED' || status === 'NOT_INTERESTED') return 'bg-rose-500/10 text-rose-500';
    return 'bg-yellow-500/10 text-yellow-500';
};

const LeadGenerationReport = () => {
    const { token } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [productFilter, setProductFilter] = useState('ALL');
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/lead/history`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data.success) {
                    setLeads(res.data.data);
                }
            } catch (error) {
                console.error("Failed to load leads history:", error);
                toast.error("Failed to load leads history.");
            } finally {
                setLoading(false);
            }
        };
        if (token) {
            fetchHistory();
        }
    }, [token]);

    const refreshHistory = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/lead/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                setLeads(res.data.data);
            }
        } catch (error) {
            console.error("Failed to load leads history:", error);
            toast.error("Failed to load leads history.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenLink = (url: string) => {
        try {
            const urlObj = new URL(url);
            const encdata = urlObj.searchParams.get('encdata');

            if (encdata) {
                const baseUrl = url.split('?')[0];
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = baseUrl;
                form.target = '_blank';

                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'encdata';
                input.value = encdata;

                form.appendChild(input);
                document.body.appendChild(form);
                form.submit();
                document.body.removeChild(form);
            } else {
                window.open(url, '_blank');
            }
        } catch {
            window.open(url, '_blank');
        }
    };

    const handleStatusCheck = async (refid: string) => {
        try {
            toast.info(`Checking status for ${refid}...`);
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/lead/status/${refid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = res.data;
            if (data.success) {
                toast.success(`Status updated: ${data.data.executive_status || 'Pending'}`);
                refreshHistory();
            } else {
                toast.error(data.message || "Failed to fetch status.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while checking status.");
        }
    };

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const matchesSearch = lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.mobile_no?.includes(searchTerm) ||
                lead.refid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.email?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'ALL' || lead.executive_status === statusFilter;
            const matchesProduct = productFilter === 'ALL' || lead.product === productFilter;

            return matchesSearch && matchesStatus && matchesProduct;
        });
    }, [leads, searchTerm, statusFilter, productFilter]);

    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredLeads.slice(start, start + itemsPerPage);
    }, [filteredLeads, currentPage]);

    const handleDownloadCSV = () => {
        const headers = ["S.No.", "Customer", "Mobile", "Email", "Product", "Ref ID", "Pincode", "State", "Status", "Date"];
        const csvRows = [headers.join(",")];

        filteredLeads.forEach((lead, idx) => {
            const row = [
                idx + 1,
                lead.name || "N/A",
                lead.mobile_no || "N/A",
                lead.email || "N/A",
                getProductName(lead.product),
                lead.refid || "N/A",
                lead.pincode || "N/A",
                lead.state || "N/A",
                lead.executive_status || "PENDING",
                lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "N/A"
            ];
            const escapedRow = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
            csvRows.push(escapedRow.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `LeadGenerationReport_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text("Lead Generation Reports", 14, 15);

        const tableColumn = ["S.No.", "Customer", "Mobile", "Email", "Product", "Ref ID", "Status", "Date"];
        const tableRows: (string | number)[][] = [];

        filteredLeads.forEach((lead, idx) => {
            const txData = [
                idx + 1,
                lead.name || "N/A",
                lead.mobile_no || "N/A",
                lead.email || "N/A",
                getProductName(lead.product),
                lead.refid || "N/A",
                lead.executive_status || "PENDING",
                lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "N/A"
            ];
            tableRows.push(txData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`LeadGenerationReport_${new Date().getTime()}.pdf`);
    };

    const approvedCount = leads.filter(l => l.executive_status === 'APPROVED').length;
    const rejectedCount = leads.filter(l => l.executive_status === 'REJECTED' || l.executive_status === 'NOT_INTERESTED').length;

    return (
        <div className="flex-1 w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Lead Generation Reports</h1>
                            <p className="text-xs md:text-sm text-muted-foreground">View all generated leads and track their application status.</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto">
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full justify-end">
                            <div className="relative flex-1 min-w-[200px] md:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search name, mobile, ref ID..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-9 pr-4 py-2 w-full bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <select
                                value={productFilter}
                                onChange={(e) => {
                                    setProductFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 whitespace-nowrap"
                            >
                                <option value="ALL">All Products</option>
                                {PRODUCTS.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 whitespace-nowrap"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="PENDING">PENDING</option>
                                <option value="APPROVED">APPROVED</option>
                                <option value="REJECTED">REJECTED</option>
                                <option value="NOT_INTERESTED">NOT INTERESTED</option>
                            </select>

                            <div className="flex gap-2 shrink-0">
                                <button onClick={handleDownloadCSV} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap">
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export CSV</span>
                                    <span className="sm:hidden">CSV</span>
                                </button>
                                <button onClick={handleDownloadPDF} className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap">
                                    <FileDown className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export PDF</span>
                                    <span className="sm:hidden">PDF</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/10 rounded-lg">
                                <FileText className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Leads</p>
                                <p className="text-xl font-bold text-foreground">{leads.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <FileText className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Approved</p>
                                <p className="text-xl font-bold text-foreground">{approvedCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-500/10 rounded-lg">
                                <FileText className="w-5 h-5 text-rose-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Rejected / Not Interested</p>
                                <p className="text-xl font-bold text-foreground">{rejectedCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 w-16 text-center">S.No.</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[140px]">Customer</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[110px]">Mobile</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[130px]">Product</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[140px]">Ref ID</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[100px]">State</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 min-w-[100px]">Date</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-center">Status</TableHead>
                                    <TableHead className="font-semibold text-foreground px-4 py-3 text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                <span>Loading leads...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedLeads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-64 text-center text-muted-foreground">
                                            No leads found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedLeads.map((lead, idx) => {
                                        const serialNumber = ((currentPage - 1) * itemsPerPage) + idx + 1;
                                        return (
                                            <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">
                                                    {serialNumber}
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm text-foreground truncate max-w-[140px]">{lead.name || "N/A"}</span>
                                                        <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{lead.email || ""}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs text-foreground/80">{lead.mobile_no || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-primary/10 text-primary border-primary/30">
                                                        {getProductName(lead.product)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs font-mono text-foreground/80">{lead.refid || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-xs text-foreground/80">{lead.state || "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <span className="text-[11px] text-muted-foreground">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "N/A"}</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(lead.executive_status || 'PENDING')}`}>
                                                        {lead.executive_status || 'PENDING'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                                        <button
                                                            onClick={() => handleStatusCheck(lead.refid)}
                                                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                                                            title="Check Status"
                                                        >
                                                            <RefreshCw className="w-3 h-3" />
                                                        </button>
                                                        {lead.url && (
                                                            <button
                                                                onClick={() => handleOpenLink(lead.url!)}
                                                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
                                                                title="Open Link"
                                                            >
                                                                Link <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Footer */}
                    {!loading && filteredLeads.length > 0 && (
                        <div className="p-3 border-t border-border flex items-center justify-between bg-muted/30">
                            <span className="text-xs text-muted-foreground hidden sm:block">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} entries
                            </span>
                            <span className="text-xs text-muted-foreground sm:hidden">
                                {filteredLeads.length} total
                            </span>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-1 border border-border rounded text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-1 px-2">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum = currentPage;
                                        if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;

                                        if (pageNum < 1 || pageNum > totalPages) return null;

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-7 h-7 rounded text-xs font-medium flex items-center justify-center transition-colors ${
                                                    currentPage === pageNum
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:bg-muted"
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="p-1 border border-border rounded text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default LeadGenerationReport;