import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { Link, useLocation } from "react-router-dom"
import { History, BarChart3, Send, Zap, ScanFace, Landmark, ArrowRightLeft, LayoutDashboard, Users, Store, UserPlus, UserCircle, FileText, QrCode, Link2, CreditCard, Bell, Headset } from "lucide-react"
import logo from "../assets/logo.png"
import { useAuth } from "../context/AuthContext"
import { isServiceEnabled } from "../lib/services"

const retailerProjects = [
  { name: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { name: "AEPS", url: "/aeps", service: "aeps", icon: ScanFace },
  { name: "AEPS Settlement", url: "/aeps-settlement", icon: Landmark },
  { name: "Micro ATM", url: "/matm", service: "matm", icon: CreditCard },
  { name: "PAN Card", url: "/pan", service: "pan", icon: FileText },
  { name: "Lead Generation", url: "/lead-generation", service: "lead", icon: UserPlus },
  { name: "ITR Filing", url: "/itr", service: "itr", icon: FileText },
  { name: "DMT", url: "/dmt", service: "dmt", icon: Send },
  { name: "Recharge", url: "/recharge", service: "recharge", icon: Zap },
  { name: "BBPS", url: "/bbps", service: "bbps", icon: Zap },
  { name: "Collect Payments", url: "/payments/collect", service: "collect", icon: Link2 },
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
  { name: "Add Money", url: "/add-money", icon: QrCode },
  { name: "Fund Request", url: "/fund-request", icon: Send },
  { name: "Support Center", url: "/support", icon: Headset },
]

const adminProjects = [
  { name: "Overview", url: "/admin", icon: LayoutDashboard },
  { name: "Transactions", url: "/admin/transactions", icon: ArrowRightLeft },
  { name: "Users", url: "/admin/users", icon: Users },
  { name: "Activity Log", url: "/admin/activity", icon: History },
  { name: "Fund Requests", url: "/admin/fund-requests", icon: Store },
  { name: "Add New", url: "/admin/create", icon: UserPlus },
  { name: "Notifications", url: "/admin/notifications", icon: Bell },
  { name: "Customer Support", url: "/admin/support", icon: Headset },
  { name: "Ledger", url: "/reports/ledger", icon: FileText },
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
                   retailerProjects.filter((item: any) => isServiceEnabled(user, item.service));

  return (
    <Sidebar className="border-r border-border">
      <SidebarContent className="bg-transparent text-foreground">
        <div className="p-6 pb-2 flex flex-col items-center justify-center relative">
                        <img src={logo} alt="logo" className="w-[80%] object-contain dark:brightness-0 dark:invert dark:opacity-90" />
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
                              <SidebarMenuButton className={`p-0 h-auto hover:bg-transparent ${isSubActive ? 'text-foreground border border-transparent rounded-xl' : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent rounded-xl'}`}>
                                  <div className="flex items-center justify-between w-full py-3 px-4 transition-all duration-300">
                                      <div className="flex items-center gap-3">
                                          <Icon className={`w-5 h-5 transition-transform ${isSubActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                          <span className="font-medium text-sm">{project.name}</span>
                                      </div>
                                      <ChevronRight className="w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                  </div>
                              </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                              <SidebarMenuSub className="mt-2 pr-0 mr-0 border-l border-border ml-6 pl-4 space-y-1">
                                  {project.subItems.map((subItem: any) => {
                                      const isItemActive = location.pathname === subItem.url;
                                      return (
                                          <SidebarMenuSubItem key={subItem.name}>
                                              <SidebarMenuSubButton asChild className="p-0 h-auto hover:bg-transparent">
                                                  <Link
                                                      to={subItem.url}
                                                      className={`block py-2 px-3 w-full rounded-lg transition-all duration-300 text-sm ${isItemActive ? 'bg-primary/10 text-brand font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
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
                        ? 'bg-primary/10 text-brand font-semibold border border-transparent'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                    }`}
                  >
                    <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
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
