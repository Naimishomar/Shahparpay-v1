import { AppSidebar } from "@/components/app-sidebar"
import Header from "@/components/Header"
import News from "@/components/News"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Outlet } from "react-router-dom"

const Layout = () => {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 bg-background text-foreground flex flex-col min-h-screen overflow-x-hidden w-full">
                <div className="sticky top-0 z-50 flex items-center justify-between p-5 bg-background/80 backdrop-blur-md border-b border-black/10 dark:border-white/10 shadow-sm">
                    <SidebarTrigger className="text-foreground transition-transform hover:scale-105"/>
                    <Header/>
                </div>
                <News/>
                <div className="w-full p-8 flex-1 overflow-x-hidden overflow-y-auto no-scrollbar relative">
                    {/* Decorative background gradients */}
                    <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none -z-10 rounded-full blur-3xl opacity-50 translate-x-[-10%] translate-y-[-20%]"></div>
                    <div className="absolute bottom-0 right-0 w-full h-[500px] bg-gradient-to-t from-secondary/10 to-transparent pointer-events-none -z-10 rounded-full blur-3xl opacity-30 translate-x-[10%] translate-y-[20%]"></div>
                    <Outlet />
                </div>
            </main>
        </SidebarProvider>
    )
}

export default Layout