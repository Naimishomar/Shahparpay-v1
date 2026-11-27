import { Link, useLocation } from "react-router-dom"
import { BarChart3, Fingerprint, LayoutDashboard, Send, UserCircle, type LucideIcon } from "lucide-react"
import {
  BottomNavigation, BottomNavigationHighlight, BottomNavigationHighlightItem, BottomNavigationItem, BottomNavigationLabel,
} from "@animate-ui/react/primitives/bottom-navigation"
import { useAuth } from "../context/AuthContext"
import { isServiceEnabled, type ServiceKey } from "../lib/services"

type Item = { value: string; label: string; to: string; icon: LucideIcon; service?: ServiceKey; match: string };

const ITEMS: Item[] = [
  { value: "home", label: "Home", to: "/dashboard", icon: LayoutDashboard, match: "/dashboard" },
  { value: "aeps", label: "AEPS", to: "/aeps", icon: Fingerprint, service: "aeps", match: "/aeps" },
  { value: "dmt", label: "DMT", to: "/dmt", icon: Send, service: "dmt", match: "/dmt" },
  { value: "reports", label: "Reports", to: "/reports/ledger", icon: BarChart3, match: "/reports/" },
  { value: "profile", label: "Profile", to: "/profile", icon: UserCircle, match: "/profile" },
]

/** Retailer phones (below md): the main pages under the thumb. The lavender pill slides to the page open. */
export default function RetailerBottomNav() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const items = ITEMS.filter((i) => isServiceEnabled(user, i.service))
  // "/aeps" must not light up on "/aeps-settlement".
  const active = items.find((i) => pathname === i.match || pathname.startsWith(i.match.endsWith("/") ? i.match : `${i.match}/`))?.value

  return (
    <BottomNavigation
      value={active}
      aria-label="Quick navigation"
      className="fixed inset-x-3 z-[60] rounded-2xl border bg-card/90 p-1.5 shadow-lg backdrop-blur-md md:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <BottomNavigationHighlight className="tint-lavender rounded-xl">
        <div className="flex items-stretch justify-around">
          {items.map(({ value, label, to, icon: Icon }) => (
            <BottomNavigationHighlightItem key={value} value={value} className="flex-1">
              <BottomNavigationItem asChild value={value}>
                <Link
                  to={to}
                  className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium text-foreground/70 data-[state=active]:font-semibold data-[state=active]:text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
                >
                  <Icon aria-hidden className="h-5 w-5" />
                  <BottomNavigationLabel show="always">{label}</BottomNavigationLabel>
                </Link>
              </BottomNavigationItem>
            </BottomNavigationHighlightItem>
          ))}
        </div>
      </BottomNavigationHighlight>
    </BottomNavigation>
  )
}
