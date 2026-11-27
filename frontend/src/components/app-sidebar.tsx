import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/animate-ui/components/radix/tooltip"
import { Link, useLocation } from "react-router-dom"
import { useState } from "react"
import { motion, MotionConfig } from "motion/react"
import {
  History, BookOpen, BarChart3, Send, Smartphone, Receipt, Fingerprint, Landmark, LayoutDashboard, Users,
  Store, UserPlus, UserCircle, FileText, IdCard, CreditCard, Bell, Headset, UserCheck, Wallet, ChevronDown, Server,
  QrCode, BadgePercent, type LucideIcon,
} from "lucide-react"
import logo from "../assets/logo.png"
import { useAuth } from "../context/AuthContext"
import { isServiceEnabled, type ServiceKey } from "../lib/services"

type NavItem = { name: string; url: string; icon: LucideIcon; service?: ServiceKey };
type NavGroup = { label?: string; items: NavItem[]; collapsible?: boolean };

/** The retailer's pages, grouped by task. Support Center is pinned to the bottom instead. */
const retailerGroups: NavGroup[] = [
  { items: [{ name: "Dashboard", url: "/dashboard", icon: LayoutDashboard }, { name: "Commission Slab", url: "/commission-slab", icon: BadgePercent }] },
  {
    label: "Banking",
    items: [
      { name: "AEPS", url: "/aeps", service: "aeps", icon: Fingerprint },
      { name: "UPI Cash Withdrawal", url: "/upi-cash-withdrawal", service: "aeps", icon: QrCode },
      { name: "Micro ATM", url: "/matm", service: "matm", icon: CreditCard },
      { name: "DMT", url: "/dmt", service: "dmt", icon: Send },
      { name: "Trade Wallet Settlement", url: "/aeps-settlement", icon: Landmark },
    ],
  },
  {
    label: "Payments",
    items: [
      { name: "Recharge", url: "/recharge", service: "recharge", icon: Smartphone },
      { name: "BBPS", url: "/bbps", service: "bbps", icon: Receipt },
      // Add Money (Razorpay) hidden for now; add { name: "Add Money", url: "/add-money", icon: QrCode } to bring it back.
      { name: "Fund Request", url: "/fund-request", icon: Wallet },
    ],
  },
  {
    label: "Services",
    items: [
      { name: "PAN Card", url: "/pan", service: "pan", icon: IdCard },
      { name: "TaxSuite Filing", url: "/itr", service: "itr", icon: FileText },
      { name: "Lead Generation", url: "/lead-generation", service: "lead", icon: UserPlus },
    ],
  },
  {
    label: "Reports",
    collapsible: true,
    items: [
      { name: "Wallet Ledger", url: "/reports/wallet-ledger", icon: BookOpen },
      { name: "All Transactions", url: "/reports/ledger", icon: BarChart3 },
      { name: "AEPS Reports", url: "/reports/aeps", icon: Fingerprint },
      { name: "DMT Reports", url: "/reports/dmt", icon: Send },
      { name: "Payout Reports", url: "/reports/payout", icon: Landmark },
      { name: "UPI Cash Withdrawal Reports", url: "/reports/upi-cash-withdrawal", icon: Wallet },
      { name: "PAN Reports", url: "/reports/pan", icon: IdCard },
      { name: "ITR Reports", url: "/reports/itr", icon: FileText },
      { name: "Lead Generation Reports", url: "/reports/lead-generation", icon: UserPlus },
      { name: "Recharge Reports", url: "/reports/recharge", icon: Smartphone },
      { name: "BBPS Reports", url: "/reports/bbps", icon: Receipt },
      { name: "Collect Payment Reports", url: "/reports/collect", icon: Wallet },
    ],
  },
]

// Admin: daily work first, people next, then the platform itself.
const adminGroups: NavGroup[] = [
  {
    items: [
      { name: "Overview", url: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "Money",
    items: [
      { name: "Fund Requests", url: "/admin/fund-requests", icon: Store },
      { name: "Icchhamati Account", url: "/admin/icchhamati", icon: Landmark },
      { name: "Ledger", url: "/reports/ledger", icon: BookOpen },
    ],
  },
  {
    label: "People",
    items: [
      { name: "Users", url: "/admin/users", icon: Users },
      { name: "Retailer Signups", url: "/admin/signups", icon: UserCheck },
      { name: "Add New", url: "/admin/create", icon: UserPlus },
    ],
  },
  {
    label: "Platform",
    items: [
      { name: "Server", url: "/admin/server", icon: Server },
      { name: "Notifications", url: "/admin/notifications", icon: Bell },
      { name: "Activity Log", url: "/admin/activity", icon: History },
    ],
  },
]

const distributorGroups: NavGroup[] = [
  { items: [{ name: "Overview", url: "/distributor", icon: LayoutDashboard }] },
  {
    label: "Network",
    items: [
      { name: "Retailers", url: "/distributor/retailers", icon: Users },
      { name: "Fund Requests", url: "/distributor/fund-requests", icon: Store },
      { name: "Add New", url: "/distributor/create", icon: UserPlus },
    ],
  },
  { label: "Account", items: [{ name: "My Profile", url: "/distributor/profile", icon: UserCircle }] },
]

type NavUser = Parameters<typeof isServiceEnabled>[0];

const groupsFor = (user: NavUser): NavGroup[] => {
  const groups = user?.role === 'admin' ? adminGroups : user?.role === 'distributor' ? distributorGroups : retailerGroups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => isServiceEnabled(user, i.service)) }))
    .filter((g) => g.items.length > 0);
};

/** Pinned under the list: help is in the same place on every page. */
const supportFor = (user: NavUser): NavItem =>
  user?.role === 'admin'
    ? { name: "Customer Support", url: "/admin/support", icon: Headset }
    : { name: "Support Center", url: "/support", icon: Headset };

/** Every page this user's sidebar links to, flat, for the header search. */
// eslint-disable-next-line react-refresh/only-export-components
export const navLinksFor = (user: NavUser): { name: string; url: string }[] =>
  [...groupsFor(user).flatMap((g) => g.items), supportFor(user)].map(({ name, url }) => ({ name, url }));

// Soft colours for the sidebar icons, picked per page name so a page keeps its colour.
const ICON_TONES = [
  'text-violet-500 dark:text-violet-300',
  'text-sky-500 dark:text-sky-300',
  'text-emerald-500 dark:text-emerald-300',
  'text-orange-500 dark:text-orange-300',
  'text-pink-500 dark:text-pink-300',
  'text-amber-500 dark:text-amber-300',
  'text-teal-500 dark:text-teal-300',
  'text-indigo-500 dark:text-indigo-300',
  'text-rose-500 dark:text-rose-300',
];
// Main pages get a fixed colour each, so neighbours never match; others fall back to a hash.
const NAME_TONE: Record<string, number> = {
  Dashboard: 0, Overview: 0, AEPS: 1, 'Micro ATM': 2, DMT: 3, 'Trade Wallet Settlement': 4,
  Recharge: 5, BBPS: 6, 'Fund Request': 7, 'PAN Card': 8, 'TaxSuite Filing': 1, 'Lead Generation': 2,
  'Support Center': 3, 'Customer Support': 3, Server: 7,
};
const iconTone = (name: string) =>
  ICON_TONES[NAME_TONE[name] ?? [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ICON_TONES.length];

const NAV_SPRING = { type: 'spring', bounce: 0.18, duration: 0.45 } as const;

const NavLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  // Collapsed to icons, each link names itself in an animate-ui tooltip.
  const { state, isMobile } = useSidebar();
  const link = (
    <Link
      to={item.url}
      aria-current={active ? 'page' : undefined}
      aria-label={item.name}
      className={`relative isolate flex min-h-10 items-center gap-3 rounded-lg px-3 group-data-[collapsible=icon]:justify-center text-[1.04rem] transition-[color,background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-foreground ${
        active
          ? 'font-semibold'
          : 'text-foreground/70 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]'
      }`}
    >
      {/* The active page: colour, weight and a bar, so it never rests on colour alone.
          Pill and bar share a layoutId, so they slide from the old link to the new one. */}
      {active && <motion.span layoutId="nav-active" transition={NAV_SPRING} aria-hidden="true" className="tint-lavender absolute inset-0 -z-10 rounded-lg" />}
      {active && <motion.span layoutId="nav-bar" transition={NAV_SPRING} aria-hidden="true" className="absolute -left-3 top-2.5 bottom-2.5 w-[3px] rounded-r bg-foreground" />}
      <Icon aria-hidden="true" className={`nav-icon h-5 w-5 shrink-0 ${iconTone(item.name)}`} strokeWidth={active ? 2.2 : 1.8} />
      <span className="truncate group-data-[collapsible=icon]:hidden">{item.name}</span>
    </Link>
  );
  if (state !== 'collapsed' || isMobile) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>{item.name}</TooltipContent>
    </Tooltip>
  );
};

const Group = ({ group, isActive }: { group: NavGroup; isActive: (url: string) => boolean }) => {
  const hasActive = group.items.some((i) => isActive(i.url));
  // A collapsible group starts open only when the current page is in it.
  const [open, setOpen] = useState(!group.collapsible || hasActive);
  const shown = open || hasActive;
  const { state } = useSidebar();

  return (
    <div>
      {group.label && (
        group.collapsible ? (
          <button
            type="button"
            onClick={() => setOpen(!shown)}
            aria-expanded={shown}
            className="flex w-full items-center justify-between rounded-md px-3 pt-5 group-data-[collapsible=icon]:hidden pb-2 text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/80 hover:text-foreground"
          >
            {group.label}
            <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${shown ? '' : '-rotate-90'}`} />
          </button>
        ) : (
          <p className="group-data-[collapsible=icon]:hidden px-3 pt-5 pb-2 text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/80">{group.label}</p>
        )
      )}
      {/* Opens and closes like a drawer: grid rows 0fr to 1fr, so the height animates without measuring.
          -mx-3/px-3 keeps the active bar (at -left-3) and focus rings inside the clip. Always open when collapsed to icons. */}
      <div
        inert={!shown && state !== 'collapsed'}
        className={`grid transition-[grid-template-rows,opacity] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none group-data-[collapsible=icon]:grid-rows-[1fr] group-data-[collapsible=icon]:opacity-100 ${shown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="-mx-3 -my-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden px-3 py-0.5">
          {group.items.map((item) => <NavLink key={item.url} item={item} active={isActive(item.url)} />)}
        </div>
      </div>
    </div>
  );
};

export function AppSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const groups = groupsFor(user);
  const support = supportFor(user);
  // "/admin" must not light up on every admin page.
  const isActive = (url: string) => pathname === url || (url.split('/').length > 2 && pathname.startsWith(`${url}/`));

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="bg-card px-6 pt-6 pb-8 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-4">
        <Link to={groups[0]?.items[0]?.url || '/'} className="mx-auto block w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-foreground" aria-label="Shahparpay home">
          <img src={logo} alt="Shahparpay" className="mx-auto h-auto w-[200px] max-w-full object-contain group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:object-cover group-data-[collapsible=icon]:object-left dark:brightness-0 dark:invert dark:opacity-90" />
        </Link>
      </SidebarHeader>
      <MotionConfig reducedMotion="user">
      <SidebarContent className="bg-card px-3 pb-3 no-scrollbar">
        <nav aria-label="Main" className="flex flex-col">
          {groups.map((g, i) => <Group key={g.label || i} group={g} isActive={isActive} />)}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-border bg-card px-3 py-3">
        <NavLink item={support} active={isActive(support.url)} />
      </SidebarFooter>
      </MotionConfig>
    </Sidebar>
  );
}
