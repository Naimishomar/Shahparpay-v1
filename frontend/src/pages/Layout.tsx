import { AppSidebar } from "@/components/app-sidebar"
import Header from "@/components/Header"
import News from "@/components/News"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Suspense } from "react"
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
            <main className="flex-1 h-svh min-h-0 bg-background top-glow text-foreground flex flex-col overflow-hidden w-full relative">
                <div className="sticky top-0 z-50 flex items-center justify-between px-5 py-2.5 bg-background/70 backdrop-blur-md border-b border-border">
                    <SidebarTrigger className="text-foreground transition-transform hover:scale-105"/>
                    <Header/>
                </div>
                <News/>
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

export default Layout
