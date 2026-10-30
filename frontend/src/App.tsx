import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom"
import Landing from "./pages/Landing"
import ServiceGate from "./components/ServiceGate"

import { Toaster } from 'sonner'
import { useAuth } from './context/AuthContext'
import { PAYSPRINT_ENABLED, usesAepsProvider } from './lib/services'
import { Navigate, useLocation, Outlet } from 'react-router-dom'

// Route-level code splitting: only the landing page ships in the initial bundle.
// Each page's loader is kept so they can all be fetched in the background once
// the app is idle; otherwise every first click on a sidebar link waits for a
// download behind a blank screen.
const loaders: (() => Promise<unknown>)[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  loaders.push(load)
  return lazy(load)
}
const prefetchPages = () => {
  // One after another, so the background downloads never crowd out the page in use.
  loaders.reduce((chain, load) => chain.then(() => load()).catch(() => {}), Promise.resolve() as Promise<unknown>)
}
const Login = page(() => import("./pages/Login"))
const Layout = page(() => import("./pages/Layout"))
const Dashboard = page(() => import("./pages/Dashboard"))
const AepsSettlement = page(() => import("./pages/AepsSettlement"))
const PipeStatus = page(() => import("./pages/PipeStatus"))
const AepsPage = page(() => import("./pages/AepsPage"))

const PaysprintOnly = ({ children }: { children: React.ReactNode }) =>
  usesAepsProvider(useAuth().user, 'paysprint') ? <>{children}</> : <Navigate to="/aeps" replace />
const DirectPayout = page(() => import("./pages/DirectPayout"))
const DMT = page(() => import("./pages/DMT"))
const Recharge = page(() => import("./pages/Recharge"))
const BBPS = page(() => import("./pages/BBPS"))
const Collect = page(() => import("./pages/Collect"))
const FundRequest = page(() => import("./pages/FundRequest"))
// Add Money (Razorpay) hidden for now; uncomment to bring it back.
// const AddMoney = page(() => import("./pages/AddMoney"))
const BiometricSupport = page(() => import("./pages/BiometricSupport"))
const LedgerReport = page(() => import("./pages/LedgerReport"))
const DmtReport = page(() => import("./pages/DmtReport"))
const AepsReport = page(() => import("./pages/AepsReport"))
const PayoutReport = page(() => import("./pages/PayoutReport"))
const UpiReport = page(() => import("./pages/UpiReport"))
const PanReport = page(() => import("./pages/PanReport"))
const ItrReport = page(() => import("./pages/ItrReport"))
const LeadGenerationReport = page(() => import("./pages/LeadGenerationReport"))
const ServiceReport = page(() => import("./pages/ServiceReport"))
const WalletLedger = page(() => import("./pages/WalletLedger"))
const LeadGeneration = page(() => import("./pages/LeadGeneration"))
const PanCard = page(() => import("./pages/PanCard"))
const ITR = page(() => import("./pages/ITR"))
const AdminPortal = page(() => import("./pages/AdminPortal"))
const DistributorPortal = page(() => import("./pages/DistributorPortal"))
const KycStatus = page(() => import("./pages/KycStatus"))
const Contact = page(() => import("./pages/Contact"))
const Commission = page(() => import("./pages/Commission"))
const About = page(() => import("./pages/About"))
const Terms = page(() => import("./pages/Terms"))
const AepsPermission = page(() => import("./pages/AepsPermission"))
const AepsTerms = page(() => import("./pages/AepsTerms"))
const RefundPolicy = page(() => import("./pages/RefundPolicy"))
const RetailerTerms = page(() => import("./pages/RetailerTerms"))
const Profile = page(() => import("./pages/Profile"))
// PAYSPRINT-DISABLED: PaySprint MATM page; route below uses Icchhamati while PAYSPRINT_ENABLED is false.
const MATM = page(() => import("./pages/MATM"))
const IcchhamatiMATM = page(() => import("./pages/IcchhamatiMATM"))
const Support = page(() => import("./pages/Support"))
const NotFound = page(() => import("./pages/NotFound"))

function ScrollToTopWrapper() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Outlet />
    </Suspense>
  )
}

function LandingRoute() {
  const { token } = useAuth()
  if (token) return <Navigate to="/dashboard" replace />
  return <Landing />
}

function LoginRoute() {
  const { token } = useAuth()
  if (token) return <Navigate to="/dashboard" replace />
  return <Login />
}

/**
 * Signed in: fetches every page in the background shortly after load. Its own
 * component so auth changes re-render only this, not App and its router.
 */
function PrefetchPages() {
  const { token } = useAuth()
  useEffect(() => {
    if (!token) return
    const id = window.setTimeout(prefetchPages, 2000)
    return () => window.clearTimeout(id)
  }, [token])
  return null
}

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route element={<ScrollToTopWrapper />}>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/kyc-status" element={<KycStatus />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/commission" element={<Commission />} />
      <Route path="/about" element={<About />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/terms-and-conditions" element={<Terms />} />
      <Route path="/retailer-terms" element={<RetailerTerms />} />
      <Route path="/aeps-terms" element={<AepsTerms />} />
      <Route path="/aeps-permission" element={<AepsPermission />} />
      <Route path="/refund-policy" element={<RefundPolicy />} />
      <Route path="/privacy-policy" element={<Terms defaultTab="grievance" />} />
      <Route element={<Layout/>}>
        {/* Retailer Dashboard */}
        <Route path="/dashboard" element={<Dashboard/>}/>
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminPortal/>}/>
        <Route path="/admin/:tab" element={<AdminPortal/>}/>
        
        {/* Distributor Routes */}
        <Route path="/distributor" element={<DistributorPortal/>}/>
        <Route path="/distributor/:tab" element={<DistributorPortal/>}/>
 
        <Route path="/aeps" element={<ServiceGate service="aeps"><AepsPage/></ServiceGate>}/>
        <Route path="/aeps/pipes" element={<PaysprintOnly><PipeStatus/></PaysprintOnly>}/>
        <Route path="/aeps-settlement" element={<AepsSettlement/>}/>
        <Route path="/matm" element={<ServiceGate service="matm">{PAYSPRINT_ENABLED ? <MATM/> : <IcchhamatiMATM/>}</ServiceGate>}/>
        <Route path="/direct-payout" element={<ServiceGate service="payout"><DirectPayout/></ServiceGate>}/>
        <Route path="/dmt" element={<ServiceGate service="dmt"><DMT/></ServiceGate>}/>
        <Route path="/recharge" element={<ServiceGate service="recharge"><Recharge/></ServiceGate>}/>
        <Route path="/bbps" element={<ServiceGate service="bbps"><BBPS/></ServiceGate>}/>
        <Route path="/payments/collect" element={<ServiceGate service="collect"><Collect/></ServiceGate>}/>
        <Route path="/lead-generation" element={<ServiceGate service="lead"><LeadGeneration/></ServiceGate>}/>
        <Route path="/pan" element={<ServiceGate service="pan"><PanCard/></ServiceGate>}/>
        <Route path="/itr" element={<ServiceGate service="itr"><ITR/></ServiceGate>}/>
        
        {/* Reports Routes */}
        <Route path="/reports/ledger" element={<LedgerReport/>}/>
        <Route path="/reports/aeps" element={<AepsReport/>}/>
        <Route path="/reports/dmt" element={<DmtReport/>}/>
        <Route path="/reports/payout" element={<PayoutReport/>}/>
        <Route path="/reports/upi" element={<UpiReport/>}/>
        <Route path="/reports/pan" element={<PanReport/>}/>
        <Route path="/reports/itr" element={<ItrReport/>}/>
        <Route path="/reports/lead-generation" element={<LeadGenerationReport/>}/>
        <Route path="/reports/recharge" element={<ServiceReport kind="recharge" title="Recharge Reports" description="Mobile prepaid and DTH recharge transactions and retailer commissions."/>}/>
        <Route path="/reports/bbps" element={<ServiceReport kind="bbps" title="BBPS Reports" description="Bill payment transactions, statuses, amounts, and retailer commissions."/>}/>
        <Route path="/reports/wallet-ledger" element={<WalletLedger/>}/>

        <Route path="/fund-request" element={<FundRequest/>}/>
        {/* <Route path="/add-money" element={<AddMoney/>}/> */}
        <Route path="/biometric-support" element={<BiometricSupport/>}/>
        <Route path="/profile" element={<Profile/>}/>
        <Route path="/support" element={<Support/>}/>
      </Route>
      <Route path="*" element={<NotFound />} />
      </Route>
    )
  )
  return (
    <>
    <Toaster theme="dark" position="top-right" />
    <PrefetchPages />
    <RouterProvider router={router} />
    </>
  )
}

export default App
