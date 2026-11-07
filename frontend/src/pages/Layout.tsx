import { AppSidebar } from "@/components/app-sidebar"
import Header from "@/components/Header"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Suspense, useState } from "react"
import { Clock, Loader2, LogOut, RefreshCcw, XCircle } from "lucide-react"
import { toast } from "sonner"
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../components/distributor/shared"
import { Outlet, Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import SupportWidget from "../components/SupportWidget"
import { LocationProvider } from "../context/LocationContext"

const Layout = () => {
    const { user, token } = useAuth();

    const location = useLocation();

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (user?.role === 'admin' && !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/reports/')) return <Navigate to="/admin" replace />;
    if (user?.role === 'distributor' && !location.pathname.startsWith('/distributor') && location.pathname !== '/support') return <Navigate to="/distributor" replace />;
    // A self-signed-up retailer sees nothing else until an admin approves them.
    if (user?.role === 'retailer' && (user.verificationStatus === 'pending' || user.verificationStatus === 'rejected')) return <UnderVerification />;

    return (
        <LocationProvider>
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 h-svh min-h-0 bg-background top-glow text-foreground flex flex-col overflow-hidden w-full relative">
                <div className="sticky top-0 z-50 bg-background/70 backdrop-blur-md border-b border-border">
                    <Header trigger={<SidebarTrigger className="shrink-0 text-foreground transition-transform hover:scale-105"/>}/>
                </div>
                <div className="w-full p-8 flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain no-scrollbar relative">
                    <Suspense fallback={null}>
                        <Outlet />
                    </Suspense>
                </div>
                <SupportWidget />
            </main>
        </SidebarProvider>
        </LocationProvider>
    )
}

const UnderVerification = () => {
    const { user, checkSession, logout } = useAuth();
    const [checking, setChecking] = useState(false);
    const rejected = user?.verificationStatus === 'rejected';

    const checkAgain = async () => {
        setChecking(true);
        // Refreshing the session re-reads the user, verification status included.
        await checkSession();
        setChecking(false);
        const fresh = JSON.parse(localStorage.getItem('user') || 'null');
        if (fresh?.verificationStatus === 'pending') toast.info('Still under review. We will let you in as soon as an admin approves your account.');
        else if (fresh?.verificationStatus === 'rejected') toast.error('Your account was not approved.');
    };

    return (
        <div className="min-h-screen bg-background top-glow flex items-center justify-center p-4">
            <div className="bg-card border shadow-2xl rounded-3xl p-8 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${rejected ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {rejected ? <XCircle size={40} /> : <Clock size={40} />}
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{rejected ? 'Account not approved' : 'Account under verification'}</h2>
                    <p className="text-muted-foreground text-sm">
                        {rejected
                            ? 'An admin reviewed your signup and could not approve it.'
                            : `Thanks for signing up${user?.name ? `, ${user.name}` : ''}. An admin is checking your details and documents; you can use the portal once they approve your account.`}
                    </p>
                </div>
                {rejected && (
                    <div className="space-y-3 text-left">
                        {user?.verificationNote && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
                                <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Reason</p>
                                <p className="mt-1 whitespace-pre-wrap">{user.verificationNote}</p>
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                            Please contact support at <a href="tel:+918240039776" className="font-semibold text-foreground">+91 8240039776</a> or <a href="mailto:shahparpay@gmail.com" className="font-semibold text-foreground">shahparpay@gmail.com</a>.
                        </p>
                    </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={checkAgain} disabled={checking} className={`${PRIMARY_BUTTON} flex-1`}>
                        {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                        {checking ? 'Checking…' : 'Check again'}
                    </button>
                    <button onClick={() => logout()} className={`${SECONDARY_BUTTON} flex-1 justify-center`}><LogOut size={16} /> Logout</button>
                </div>
            </div>
        </div>
    );
};

export default Layout
