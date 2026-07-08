import { AppSidebar } from "@/components/app-sidebar"
import Header from "@/components/Header"
import News from "@/components/News"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Outlet, Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useEffect, useState } from "react"
import axios from "axios"
import toast from "react-hot-toast"
import { ShieldCheck, LogOut } from "lucide-react"

const Layout = () => {
    const { user, token, logout } = useAuth();
    const [showKyc, setShowKyc] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (user && user.role === 'retailer' && user.isMerchantKycComplete === false) {
            setShowKyc(true);
        } else {
            setShowKyc(false);
        }
    }, [user]);

    const handleCompleteKyc = async () => {
        if (!user || !user._id) return;
        setIsGenerating(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/auth/paysprint/get-onboard-url`, {
                merchantId: user._id,
                isNew: true,
                callbackUrl: window.location.origin + '/kyc-status'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                window.location.href = res.data.url;
            } else {
                toast.error(res.data.message || "Failed to generate KYC link.");
                setIsGenerating(false);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to generate KYC link.");
            setIsGenerating(false);
        }
    };

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'distributor') return <Navigate to="/distributor" replace />;

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 bg-background text-foreground flex flex-col min-h-screen overflow-x-hidden w-full relative">
                <div className="sticky top-0 z-50 flex items-center justify-between p-5 bg-background/80 backdrop-blur-md border-b border-black/10 dark:border-white/10 shadow-sm">
                    <SidebarTrigger className="text-foreground transition-transform hover:scale-105"/>
                    <Header/>
                </div>
                <News/>
                <div className="w-full p-8 flex-1 overflow-x-hidden overflow-y-auto no-scrollbar relative">
                    <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-white/5 to-transparent pointer-events-none -z-10 rounded-full blur-3xl opacity-50 translate-x-[-10%] translate-y-[-20%]"></div>
                    <div className="absolute bottom-0 right-0 w-full h-[500px] bg-gradient-to-t from-white/5 to-transparent pointer-events-none -z-10 rounded-full blur-3xl opacity-30 translate-x-[10%] translate-y-[20%]"></div>
                    <Outlet />
                </div>
                
                {/* Forced KYC Modal for new Retailers */}
                {showKyc && (
                    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-background border border-border shadow-2xl rounded-3xl p-8 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
                                <ShieldCheck size={40} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold mb-2">Mandatory KYC Verification</h2>
                                <p className="text-muted-foreground text-sm">
                                    To access your dashboard and start processing transactions, you must first complete your identity verification.
                                </p>
                            </div>
                            
                            <div className="space-y-3 pt-4">
                                <button 
                                    onClick={handleCompleteKyc}
                                    disabled={isGenerating}
                                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? "Redirecting..." : "Complete KYC Now"}
                                </button>
                                <button 
                                    onClick={() => logout && logout()}
                                    className="w-full py-3 px-4 bg-transparent border border-border hover:bg-muted text-foreground rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut size={18} /> Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </SidebarProvider>
    )
}

export default Layout