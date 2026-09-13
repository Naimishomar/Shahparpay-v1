import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { Link, useLocation } from "react-router-dom"
import { BarChart3, Wallet, Send, Zap, ScanFace, Landmark, LayoutDashboard, Users, Store, UserPlus, UserCircle, FileText, QrCode, CreditCard, Bell, Headset, ShieldCheck } from "lucide-react"
import logo from "../assets/logo.png"
import { useAuth } from "../context/AuthContext"

const retailerProjects = [
  { name: "Dashboard", url: "/", icon: BarChart3 },
  { name: "AEPS", url: "/aeps", icon: ScanFace },
  { name: "AEPS Settlement", url: "/aeps-settlement", icon: Landmark },
  { name: "MATM", url: "/matm", icon: CreditCard },
  { name: "PAN Card", url: "/pan", icon: FileText },
  { name: "Lead Generation", url: "/lead-generation", icon: UserPlus },
  { name: "ITR Filing", url: "/itr", icon: FileText },
  { name: "UPI Payments", url: "/upi-payments", icon: Wallet },
  { name: "DMT", url: "/dmt", icon: Send },
  { name: "Recharge", url: "/recharge", icon: Zap },
  { name: "BBPS", url: "/bbps", icon: Zap },
  { name: "Collect Payments", url: "/payments/collect", icon: QrCode },
  { name: "Wallet Transfer", url: "/wallet-transfer", icon: Wallet },
  // { name: "Direct Payout", url: "/direct-payout", icon: ArrowRightLeft },
  {
    name: "Reports",
    icon: BarChart3,
    subItems: [
      { name: "Ledgar", url: "/reports/wallet-ledger" },
      { name: "All Reports", url: "/reports/ledger" },
      { name: "AEPS Reports", url: "/reports/aeps" },
      { name: "DMT Reports", url: "/reports/dmt" },
      { name: "Payout Reports", url: "/reports/payout" },
      { name: "UPI Reports", url: "/reports/upi" },
      { name: "PAN Reports", url: "/reports/pan" },
      { name: "ITR Reports", url: "/reports/itr" },
      { name: "Lead Generation Reports", url: "/reports/lead-generation" },
      { name: "Recharge Reports", url: "/reports/recharge" },
      { name: "BBPS Reports", url: "/reports/bbps" },
    ]
  },
  { name: "Fund Request", url: "/fund-request", icon: Send },
  { name: "AEPS Pipe Status", url: "/aeps/pipes", icon: ScanFace },
  { name: "Biometric Support", url: "/biometric-support", icon: ScanFace },
  { name: "Support Center", url: "/support", icon: Headset },
]

const adminProjects = [
  { name: "Overview", url: "/admin", icon: LayoutDashboard },
  { name: "Distributors", url: "/admin/distributors", icon: Users },
  { name: "Fund Requests", url: "/admin/fund-requests", icon: Store },
  { name: "Add New", url: "/admin/create", icon: UserPlus },
  { name: "Commissions", url: "/admin/commissions", icon: FileText },
  { name: "Notifications", url: "/admin/notifications", icon: Bell },
  { name: "Customer Support", url: "/admin/support", icon: Headset },
  { name: "Ledger", url: "/reports/ledger", icon: FileText },
  { name: "Lead Generation", url: "/lead-generation", icon: UserPlus },
]

const distributorProjects = [
  { name: "Overview", url: "/distributor", icon: LayoutDashboard },
  { name: "Retailers", url: "/distributor/retailers", icon: Users },
  { name: "Fund Requests", url: "/distributor/fund-requests", icon: Store },
  { name: "Add New", url: "/distributor/create", icon: UserPlus },
  { name: "My Profile", url: "/distributor/profile", icon: UserCircle },
  { name: "Support Center", url: "/support", icon: Headset },
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
    <Sidebar className="border-r border-slate-800/80 !bg-slate-950">
      <SidebarContent className="bg-transparent text-slate-100">
        <div className="p-5 pb-3 flex flex-col items-center justify-center relative">
            <div className="absolute top-0 left-0 w-full h-[130px] bg-teal-500/20 blur-[55px] -z-10 rounded-full"></div>
            <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-2xl shadow-teal-950/20">
              <img src={logo} alt="logo" className="w-full object-contain brightness-0 invert opacity-95" />
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              Digital finance platform
            </div>
        </div>
        <SidebarMenu className="px-3 py-5 gap-1.5 mt-2">
          {projects.map((project: any) => {
            const Icon = project.icon
            
            if (project.subItems) {
              const isSubActive = project.subItems.some((item: any) => location.pathname.startsWith(item.url));
              return (
                  <SidebarMenuItem key={project.name}>
                      <Collapsible defaultOpen={isSubActive} className="group/collapsible w-full">
                          <CollapsibleTrigger asChild>
                              <SidebarMenuButton className={`p-0 h-auto hover:bg-transparent ${isSubActive ? 'bg-gray-500/20 text-white border border-white rounded-xl' : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground border border-transparent rounded-xl'}`}>
                                  <div className="flex items-center justify-between w-full py-3 px-3.5 transition-all duration-300">
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
                                                      className={`block py-2 px-3 w-full rounded-lg transition-all duration-300 text-sm ${isItemActive ? 'bg-teal-400/15 text-teal-200 font-semibold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
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
                    className={`flex items-center gap-3 py-3 px-3.5 w-full rounded-xl transition-all duration-300 ${
                        isActive 
                        ? 'bg-gradient-to-r from-teal-400/20 to-blue-400/10 text-white border border-teal-300/20 shadow-lg shadow-teal-950/20'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
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
        <div className="mt-auto px-4 pb-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4 text-teal-300" />
              Platform protected
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">Secure payments and services for your business.</p>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}
