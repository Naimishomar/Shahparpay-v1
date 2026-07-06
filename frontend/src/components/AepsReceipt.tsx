import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, CheckCircle, XCircle } from 'lucide-react';
import logo from '../assets/logo.png';

const AepsReceipt = ({ transactionId, onClose }: { transactionId: string, onClose: () => void }) => {
    const [receiptData, setReceiptData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchReceipt = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/receipt/${transactionId}`);
                if (response.data && response.data.success) {
                    setReceiptData(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching receipt:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReceipt();
    }, [transactionId]);

    const downloadPDF = async () => {
        const input = receiptRef.current;
        if (!input) return;

        try {
            const canvas = await html2canvas(input, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Shahparpay_Receipt_${transactionId}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to download PDF.");
        }
    };

    if (loading) {
        return <div className="text-center p-8 text-white font-bold animate-pulse">Loading Receipt...</div>;
    }

    if (!receiptData) {
        return <div className="text-center p-8 text-red-500 font-bold">Failed to load receipt details.</div>;
    }

    const isSuccess = receiptData.status === 'SUCCESS';
    const dateStr = new Date(receiptData.createdAt).toLocaleString();

    return (
        <div className="flex flex-col items-center max-w-md mx-auto relative animate-in fade-in zoom-in duration-300">
            {/* Close Button */}
            <button 
                onClick={onClose}
                className="absolute -top-4 -right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 transition border border-slate-600 z-10"
            >
                ✕
            </button>

            {/* Receipt Container to Capture */}
            <div 
                ref={receiptRef} 
                className="bg-white text-slate-800 w-full rounded-xl shadow-2xl overflow-hidden border border-slate-200 p-6 flex flex-col gap-4 relative"
            >
                {/* Header Logo */}
                <div className="flex flex-col items-center justify-center pb-4 border-b border-dashed border-slate-300">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-2">
                        <img src={logo} alt="Shahparpay" className="w-32 h-auto max-h-24 object-contain" crossOrigin="anonymous" />
                    </div>
                    <p className="text-xs text-slate-500 text-center uppercase tracking-widest font-semibold">Transaction Receipt</p>
                </div>

                {/* Status Section */}
                <div className="flex flex-col items-center py-4">
                    {isSuccess ? (
                        <CheckCircle className="text-emerald-500 w-12 h-12 mb-2" />
                    ) : (
                        <XCircle className="text-red-500 w-12 h-12 mb-2" />
                    )}
                    <h2 className={`text-xl font-bold ${isSuccess ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isSuccess ? 'Transaction Successful' : 'Transaction Failed'}
                    </h2>
                    <p className="text-sm font-semibold text-slate-500 mt-1">{dateStr}</p>
                </div>

                <div className="flex flex-col gap-3 py-2">
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-sm text-slate-500 font-medium">Transaction ID</span>
                        <span className="text-sm font-bold text-slate-800">{receiptData.transactionId}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-sm text-slate-500 font-medium">Transaction Type</span>
                        <span className="text-sm font-bold text-slate-800">AEPS Cash Withdrawal</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-sm text-slate-500 font-medium">Bank IIN</span>
                        <span className="text-sm font-bold text-slate-800">{receiptData.metadata?.bankIIN || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-sm text-slate-500 font-medium">Aadhaar (Last 4)</span>
                        <span className="text-sm font-bold text-slate-800">XXXX XXXX {receiptData.metadata?.aadhaarLast4 || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-sm text-slate-500 font-medium">Remaining Balance</span>
                        <span className="text-sm font-bold text-slate-800">₹ {receiptData.metadata?.balanceAmount || '0.00'}</span>
                    </div>
                    
                    {/* Amount Banner */}
                    <div className="mt-2 bg-slate-50 rounded-lg p-4 flex justify-between items-center border border-slate-100">
                        <span className="text-slate-600 font-bold uppercase tracking-wide">Amount Withdrawn</span>
                        <span className="text-2xl font-black text-indigo-700">₹ {receiptData.amount?.toFixed(2)}</span>
                    </div>
                </div>

                {/* Footer Message */}
                <div className="mt-4 text-center text-xs text-slate-400 pb-2">
                    <p>Thank you for using Shahparpay!</p>
                    <p className="mt-1">This is a system generated receipt.</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex gap-4 mt-6">
                <button 
                    onClick={downloadPDF}
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                >
                    <Download size={18} />
                    Download PDF
                </button>
            </div>
        </div>
    );
};

export default AepsReceipt;
