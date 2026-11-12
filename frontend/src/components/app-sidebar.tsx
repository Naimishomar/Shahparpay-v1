import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar"
import { Link, useLocation } from "react-router-dom"
import { useState } from "react"
import {
  History, BookOpen, BarChart3, Send, Smartphone, Receipt, Fingerprint, Landmark, ArrowRightLeft, LayoutDashboard, Users,
  Store, UserPlus, UserCircle, FileText, IdCard, CreditCard, Bell, Headset, UserCheck, Wallet, ChevronDown,
  type LucideIcon,
} from "lucide-react"
import logo from "../assets/logo.png"
import { useAuth } from "../context/AuthContext"
import { isServiceEnabled, type ServiceKey } from "../lib/services"

type NavItem = { name: string; url: string; icon: LucideIcon; service?: ServiceKey };
type NavGroup = { label?: string; items: NavItem[]; collapsible?: boolean };

/** The retailer's pages, grouped by task. Support Center is pinned to the bottom instead. */
const retailerGroups: NavGroup[] = [
  { items: [{ name: "Dashboard", url: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Banking",
    items: [
      { name: "AEPS", url: "/aeps", service: "aeps", icon: Fingerprint },
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
      { name: "Ledgar", url: "/reports/wallet-ledger", icon: BookOpen },
      { name: "All Reports", url: "/reports/ledger", icon: BarChart3 },
      { name: "AEPS Reports", url: "/reports/aeps", icon: Fingerprint },
      { name: "DMT Reports", url: "/reports/dmt", icon: Send },
      { name: "Payout Reports", url: "/reports/payout", icon: Landmark },
      { name: "UPI Reports", url: "/reports/upi", icon: Wallet },
      { name: "PAN Reports", url: "/reports/pan", icon: IdCard },
      { name: "ITR Reports", url: "/reports/itr", icon: FileText },
      { name: "Lead Generation Reports", url: "/reports/lead-generation", icon: UserPlus },
      { name: "Recharge Reports", url: "/reports/recharge", icon: Smartphone },
      { name: "BBPS Reports", url: "/reports/bbps", icon: Receipt },
      { name: "Collect Payment Reports", url: "/reports/collect", icon: Wallet },
    ],
  },
]

const adminGroups: NavGroup[] = [
  { items: [{ name: "Overview", url: "/admin", icon: LayoutDashboard }] },
  {
    label: "Operations",
    items: [
      { name: "Transactions", url: "/admin/transactions", icon: ArrowRightLeft },
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
  'Support Center': 3, 'Customer Support': 3,
};
const iconTone = (name: string) =>
  ICON_TONES[NAME_TONE[name] ?? [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ICON_TONES.length];

const NavLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.url}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[1.04rem] transition-colors focus-visible:outline-2 focus-visible:outline-foreground ${
        active
          ? 'tint-lavender font-semibold'
          : 'text-foreground/70 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]'
      }`}
    >
      {/* The active page: colour, weight and a bar, so it never rests on colour alone. */}
      {active && <span aria-hidden="true" className="absolute -left-3 top-2.5 bottom-2.5 w-[3px] rounded-r bg-foreground" />}
      <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${iconTone(item.name)}`} strokeWidth={active ? 2.2 : 1.8} />
      <span className="truncate">{item.name}</span>
    </Link>
  );
};

const Group = ({ group, isActive }: { group: NavGroup; isActive: (url: string) => boolean }) => {
  const hasActive = group.items.some((i) => isActive(i.url));
  // A collapsible group starts open only when the current page is in it.
  const [open, setOpen] = useState(!group.collapsible || hasActive);
  const shown = open || hasActive;

  return (
    <div>
      {group.label && (
        group.collapsible ? (
          <button
            type="button"
            onClick={() => setOpen(!shown)}
            aria-expanded={shown}
            className="flex w-full items-center justify-between rounded-md px-3 pt-5 pb-2 text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/80 hover:text-foreground"
          >
            {group.label}
            <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${shown ? '' : '-rotate-90'}`} />
          </button>
        ) : (
          <p className="px-3 pt-5 pb-2 text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/80">{group.label}</p>
        )
      )}
      {shown && (
        <div className="flex flex-col gap-0.5">
          {group.items.map((item) => <NavLink key={item.url} item={item} active={isActive(item.url)} />)}
        </div>
      )}
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
    <Sidebar className="border-r border-border">
      <SidebarHeader className="bg-card px-6 pt-6 pb-8">
        <Link to={groups[0]?.items[0]?.url || '/'} className="mx-auto block w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-foreground" aria-label="Shahparpay home">
          <img src={logo} alt="Shahparpay" className="mx-auto h-auto w-[200px] max-w-full object-contain dark:brightness-0 dark:invert dark:opacity-90" />
        </Link>
      </SidebarHeader>
      <SidebarContent className="bg-card px-3 pb-3 no-scrollbar">
        <nav aria-label="Main" className="flex flex-col">
          {groups.map((g, i) => <Group key={g.label || i} group={g} isActive={isActive} />)}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-border bg-card px-3 py-3">
        <NavLink item={support} active={isActive(support.url)} />
      </SidebarFooter>
    </Sidebar>
  );
}
