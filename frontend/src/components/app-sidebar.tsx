import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { Link, useLocation } from "react-router-dom"
import { BarChart3, Wallet, Send, Zap, ScanFace, Landmark, ArrowRightLeft, LayoutDashboard, Users, Store, UserPlus, UserCircle, FileText } from "lucide-react"
import logo from "../assets/logo.png"
import { useAuth } from "../context/AuthContext"

const retailerProjects = [
  { name: "Dashboard", url: "/", icon: BarChart3 },
  { name: "Wallet Transfer", url: "/wallet-transfer", icon: Wallet },
  { name: "DMT", url: "/dmt", icon: Send },
  { name: "Recharge", url: "/recharge", icon: Zap },
  { name: "AEPS", url: "/aeps", icon: ScanFace },
  { name: "AEPS Settlement", url: "/aeps-settlement", icon: Landmark },
  { name: "Direct Payout", url: "/direct-payout", icon: ArrowRightLeft },
  { name: "BBPS", url: "/bbps", icon: Zap },
  { name: "UPI Payments", url: "/upi-payments", icon: Wallet },
  { name: "Lead Generation", url: "/lead-generation", icon: UserPlus },
  {
    name: "Reports",
    icon: BarChart3,
    subItems: [
      { name: "Ledgar", url: "/reports/ledger" },
      { name: "DMT Reports", url: "/reports/dmt" },
      { name: "Payout Reports", url: "/reports/payout" },
      { name: "UPI Reports", url: "/reports/upi" },
    ]
  },
  { name: "Fund Request", url: "/fund-request", icon: Send },
  { name: "Biometric Support", url: "/biometric-support", icon: ScanFace },
]

const adminProjects = [
  { name: "Overview", url: "/admin", icon: LayoutDashboard },
  { name: "Distributors", url: "/admin/distributors", icon: Users },
  { name: "Fund Requests", url: "/admin/fund-requests", icon: Store },
  { name: "Add New", url: "/admin/create", icon: UserPlus },
  { name: "Commissions", url: "/admin/commissions", icon: FileText },
  { name: "Ledger", url: "/reports/ledger", icon: FileText },
  { name: "Lead Generation", url: "/lead-generation", icon: UserPlus },
]

const distributorProjects = [
  { name: "Overview", url: "/distributor", icon: LayoutDashboard },
  { name: "Retailers", url: "/distributor/retailers", icon: Users },
  { name: "Fund Requests", url: "/distributor/fund-requests", icon: Store },
  { name: "Add New", url: "/distributor/create", icon: UserPlus },
  { name: "My Profile", url: "/distributor/profile", icon: UserCircle },
  { name: "Lead Generation", url: "/lead-generation", icon: UserPlus },
]

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"
import { SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar"

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  
  const projects = user?.role === 'admin' ? adminProjects : 
                   user?.role === 'distributor' ? distributorProjects : 
                   retailerProjects;

  return (
    <Sidebar className="border-r border-black/10 dark:border-white/10 !bg-background/95">
      <SidebarContent className="bg-transparent text-foreground">
        <div className="p-6 pb-2 flex flex-col items-center justify-center relative">
            <div className="absolute top-0 left-0 w-full h-[100px] bg-primary/10 blur-[50px] -z-10 rounded-full"></div>
            <img src={logo} alt="logo" className="w-[80%] object-contain dark:brightness-0 dark:invert dark:opacity-90 dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
        </div>
        <SidebarMenu className="px-4 py-6 gap-3 mt-2">
          {projects.map((project: any) => {
            const Icon = project.icon
            
            if (project.subItems) {
              const isSubActive = project.subItems.some((item: any) => location.pathname.startsWith(item.url));
              return (
                  <SidebarMenuItem key={project.name}>
                      <Collapsible defaultOpen={isSubActive} className="group/collapsible w-full">
                          <CollapsibleTrigger asChild>
                              <SidebarMenuButton className={`p-0 h-auto hover:bg-transparent ${isSubActive ? 'bg-gray-500/20 text-white border border-white rounded-xl' : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground border border-transparent rounded-xl'}`}>
                                  <div className="flex items-center justify-between w-full py-3 px-4 transition-all duration-300">
                                      <div className="flex items-center gap-3">
                                          <Icon className={`w-5 h-5 transition-transform ${isSubActive ? 'drop-shadow-[0_0_5px_rgba(139,92,246,0.5)] dark:drop-shadow-[0_0_8px_rgba(139,92,246,0.8)] scale-110' : 'group-hover:scale-110'}`} />
                                          <span className="font-medium text-sm">{project.name}</span>
                                      </div>
                                      <ChevronRight className="w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                  </div>
                              </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                              <SidebarMenuSub className="mt-2 pr-0 mr-0 border-l border-white/20 ml-6 pl-4 space-y-1">
                                  {project.subItems.map((subItem: any) => {
                                      const isItemActive = location.pathname === subItem.url;
                                      return (
                                          <SidebarMenuSubItem key={subItem.name}>
                                              <SidebarMenuSubButton asChild className="p-0 h-auto hover:bg-transparent">
                                                  <Link 
                                                      to={subItem.url}
                                                      className={`block py-2 px-3 w-full rounded-lg transition-all duration-300 text-sm ${isItemActive ? 'bg-white/10 text-white font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                                                  >
                                                      {subItem.name}
                                                  </Link>
                                              </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                      )
                                  })}
                              </SidebarMenuSub>
                          </CollapsibleContent>
                      </Collapsible>
                  </SidebarMenuItem>
              )
            }

            const isActive = location.pathname === project.url;

            return (
              <SidebarMenuItem key={project.name}>
                <SidebarMenuButton asChild className="p-0 h-auto hover:bg-transparent">
                  <Link 
                    to={project.url!} 
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