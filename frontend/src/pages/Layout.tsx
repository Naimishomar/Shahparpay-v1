import { AppSidebar } from "@/components/app-sidebar"
import Header from "@/components/Header"
import News from "@/components/News"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
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

    return (
        <LocationProvider>
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 h-svh min-h-0 bg-background text-foreground flex flex-col overflow-hidden w-full relative">
                <div className="sticky top-0 z-50 flex items-center justify-between p-5 bg-background/80 backdrop-blur-md border-b border-black/10 dark:border-white/10 shadow-sm">
                    <SidebarTrigger className="text-foreground transition-transform hover:scale-105"/>
                    <Header/>
                </div>
                <News/>
                <div className="w-full p-8 flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain no-scrollbar relative">
                    <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-white/5 to-transparent pointer-events-none -z-10 rounded-full blur-3xl opacity-50 translate-x-[-10%] translate-y-[-20%]"></div>
                    <div className="absolute bottom-0 right-0 w-full h-[500px] bg-gradient-to-t from-white/5 to-transparent pointer-events-none -z-10 rounded-full blur-3xl opacity-30 translate-x-[10%] translate-y-[20%]"></div>
                    <Outlet />
                </div>
                <SupportWidget />
            </main>
        </SidebarProvider>
        </LocationProvider>
    )
}

export default Layout
