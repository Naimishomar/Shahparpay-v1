import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom"
import Landing from "./pages/Landing"
import ServiceGate from "./components/ServiceGate"

import { Toaster } from 'sonner'
import { useAuth } from './context/AuthContext'
import { aepsProviderOf } from './lib/services'
import { Navigate, useLocation, Outlet } from 'react-router-dom'

// Route-level code splitting: only the landing page ships in the initial bundle.
const Login = lazy(() => import("./pages/Login"))
const Layout = lazy(() => import("./pages/Layout"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const AEPS = lazy(() => import("./pages/AEPS"))
const AepsSettlement = lazy(() => import("./pages/AepsSettlement"))
const PipeStatus = lazy(() => import("./pages/PipeStatus"))
const IcchhamatiAEPS = lazy(() => import("./pages/IcchhamatiAEPS"))

// A retailer sees only the AEPS of the provider they are onboarded with.
const AepsForProvider = () => (aepsProviderOf(useAuth().user) === 'icchhamati' ? <IcchhamatiAEPS /> : <AEPS />)
const PaysprintOnly = ({ children }: { children: React.ReactNode }) =>
  aepsProviderOf(useAuth().user) === 'icchhamati' ? <Navigate to="/aeps" replace /> : <>{children}</>
const DirectPayout = lazy(() => import("./pages/DirectPayout"))
const DMT = lazy(() => import("./pages/DMT"))
const Recharge = lazy(() => import("./pages/Recharge"))
const BBPS = lazy(() => import("./pages/BBPS"))
const Collect = lazy(() => import("./pages/Collect"))
const FundRequest = lazy(() => import("./pages/FundRequest"))
const AddMoney = lazy(() => import("./pages/AddMoney"))
const BiometricSupport = lazy(() => import("./pages/BiometricSupport"))
const LedgerReport = lazy(() => import("./pages/LedgerReport"))
const DmtReport = lazy(() => import("./pages/DmtReport"))
const AepsReport = lazy(() => import("./pages/AepsReport"))
const PayoutReport = lazy(() => import("./pages/PayoutReport"))
const UpiReport = lazy(() => import("./pages/UpiReport"))
const PanReport = lazy(() => import("./pages/PanReport"))
const ItrReport = lazy(() => import("./pages/ItrReport"))
const LeadGenerationReport = lazy(() => import("./pages/LeadGenerationReport"))
const ServiceReport = lazy(() => import("./pages/ServiceReport"))
const WalletLedger = lazy(() => import("./pages/WalletLedger"))
const LeadGeneration = lazy(() => import("./pages/LeadGeneration"))
const PanCard = lazy(() => import("./pages/PanCard"))
const ITR = lazy(() => import("./pages/ITR"))
const AdminPortal = lazy(() => import("./pages/AdminPortal"))
const DistributorPortal = lazy(() => import("./pages/DistributorPortal"))
const KycStatus = lazy(() => import("./pages/KycStatus"))
const Contact = lazy(() => import("./pages/Contact"))
const Commission = lazy(() => import("./pages/Commission"))
const About = lazy(() => import("./pages/About"))
const Terms = lazy(() => import("./pages/Terms"))
const AepsPermission = lazy(() => import("./pages/AepsPermission"))
const AepsTerms = lazy(() => import("./pages/AepsTerms"))
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"))
const RetailerTerms = lazy(() => import("./pages/RetailerTerms"))
const Profile = lazy(() => import("./pages/Profile"))
const MATM = lazy(() => import("./pages/MATM"))
const Support = lazy(() => import("./pages/Support"))
const NotFound = lazy(() => import("./pages/NotFound"))

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
 
        <Route path="/aeps" element={<ServiceGate service="aeps"><AepsForProvider/></ServiceGate>}/>
        <Route path="/aeps/pipes" element={<PaysprintOnly><PipeStatus/></PaysprintOnly>}/>
        <Route path="/aeps-settlement" element={<AepsSettlement/>}/>
        <Route path="/matm" element={<ServiceGate service="matm"><MATM/></ServiceGate>}/>
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
        <Route path="/add-money" element={<AddMoney/>}/>
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
    <RouterProvider router={router} />
    </>
  )
}

export default App
