import { AppSidebar } from "@/components/app-sidebar"
import Header from "@/components/Header"
import News from "@/components/News"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Outlet, Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import SupportWidget from "../components/SupportWidget"

const Layout = () => {
    const { user, token } = useAuth();

    const location = useLocation();

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (user?.role === 'admin' && !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/reports/')) return <Navigate to="/admin" replace />;
    if (user?.role === 'distributor' && !location.pathname.startsWith('/distributor') && location.pathname !== '/support') return <Navigate to="/distributor" replace />;

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 bg-transparent text-foreground flex flex-col min-h-screen overflow-x-hidden w-full relative">
                <div className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8 bg-background/75 backdrop-blur-2xl border-b border-slate-200/70 dark:border-white/10 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                    <SidebarTrigger className="h-10 w-10 rounded-xl border border-slate-200 bg-white/70 text-foreground shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"/>
                    <Header/>
                </div>
                <News/>
                <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7 flex-1 overflow-x-hidden overflow-y-auto no-scrollbar relative">
                    <div className="absolute top-0 left-0 w-[520px] h-[420px] bg-teal-400/10 pointer-events-none -z-10 rounded-full blur-3xl opacity-70 -translate-x-1/3 -translate-y-1/3"></div>
                    <div className="absolute bottom-0 right-0 w-[520px] h-[420px] bg-blue-500/10 pointer-events-none -z-10 rounded-full blur-3xl opacity-50 translate-x-1/3 translate-y-1/3"></div>
                    <Outlet />
                </div>
                <SupportWidget />
            </main>
        </SidebarProvider>
    )
}

export default Layout
