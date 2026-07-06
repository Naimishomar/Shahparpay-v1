import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { Link, useLocation } from "react-router-dom"
import { BarChart3, Wallet, Send, Zap, ScanFace, Landmark, ArrowRightLeft } from "lucide-react"
import logo from "../assets/logo.png"

const projects = [
  {
    name: "Dashboard",
    url: "/",
    icon: BarChart3,
  },
  {
    name: "Wallet Transfer",
    url: "/wallet-transfer",
    icon: Wallet,
  },
  {
    name: "DMT",
    url: "/dmt",
    icon: Send,
  },
  {
    name: "Recharge",
    url: "/recharge",
    icon: Zap,
  },
  {
    name: "AEPS",
    url: "/aeps",
    icon: ScanFace,
  },
  {
    name: "AEPS Settlement",
    url: "/aeps-settlement",
    icon: Landmark,
  },
  {
    name: "Direct Payout",
    url: "/direct-payout",
    icon: ArrowRightLeft,
  },
  {
    name: "BBPS",
    url: "/bbps",
    icon: Zap,
  },
  {
    name: "UPI Payments",
    url: "/upi-payments",
    icon: Wallet,
  },
  {
    name: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    name: "Fund Request",
    url: "/fund-request",
    icon: Send,
  },
  {
    name: "Biometric Support",
    url: "/biometric-support",
    icon: ScanFace,
  },
]

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r border-black/10 dark:border-white/10 !bg-background/95">
      <SidebarContent className="bg-transparent text-foreground">
        <div className="p-6 pb-2 flex flex-col items-center justify-center relative">
            <div className="absolute top-0 left-0 w-full h-[100px] bg-primary/10 blur-[50px] -z-10 rounded-full"></div>
            <img src={logo} alt="logo" className="w-[80%] object-contain dark:brightness-0 dark:invert dark:opacity-90 dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
        </div>
        <SidebarMenu className="px-4 py-6 gap-3 mt-2">
          {projects.map((project) => {
            const Icon = project.icon
            const isActive = location.pathname === project.url;

            return (
              <SidebarMenuItem key={project.name}>
                <SidebarMenuButton asChild className="p-0 h-auto hover:bg-transparent">
                  <Link 
                    to={project.url} 
                    className={`flex items-center gap-3 py-3 px-4 w-full rounded-xl transition-all duration-300 ${
                        isActive 
                        ? 'bg-gray-500/20 text-white border border-white' 
                        : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground border border-transparent'
                    }`}
                  >
                    <Icon className={`w-5 h-5 transition-transform ${isActive ? 'drop-shadow-[0_0_5px_rgba(139,92,246,0.5)] dark:drop-shadow-[0_0_8px_rgba(139,92,246,0.8)] scale-110' : 'group-hover:scale-110'}`} />
                    <span className="font-medium text-sm">{project.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}