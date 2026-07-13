import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom"
import Layout from "./pages/Layout"
import Dashboard from "./pages/Dashboard"
import AEPS from "./pages/AEPS"
import AepsSettlement from "./pages/AepsSettlement"
import DirectPayout from "./pages/DirectPayout"
import DMT from "./pages/DMT"
import Recharge from "./pages/Recharge"
import WalletTransfer from "./pages/WalletTransfer"
import BBPS from "./pages/BBPS"
import UPI_Payments from "./pages/UPI_Payments"
import FundRequest from "./pages/FundRequest"
import BiometricSupport from "./pages/BiometricSupport"
import LedgerReport from "./pages/LedgerReport"
import DmtReport from "./pages/DmtReport"
import PayoutReport from "./pages/PayoutReport"
import UpiReport from "./pages/UpiReport"

// New Pages
import Login from "./pages/Login"
import AdminPortal from "./pages/AdminPortal"
import DistributorPortal from "./pages/DistributorPortal"
import KycStatus from "./pages/KycStatus"
import Profile from "./pages/Profile"

import { Toaster } from 'sonner'

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminPortal />} />
      <Route path="/distributor" element={<DistributorPortal />} />
      <Route path="/kyc-status" element={<KycStatus />} />
      <Route path="/" element={<Layout/>}>
        <Route index element={<Dashboard/>}/>
        <Route path="/aeps" element={<AEPS/>}/>
        <Route path="/aeps-settlement" element={<AepsSettlement/>}/>
        <Route path="/direct-payout" element={<DirectPayout/>}/>
        <Route path="/dmt" element={<DMT/>}/>
        <Route path="/recharge" element={<Recharge/>}/>
        <Route path="/wallet-transfer" element={<WalletTransfer/>}/>
        <Route path="/bbps" element={<BBPS/>}/>
        <Route path="/upi-payments" element={<UPI_Payments/>}/>
        
        {/* Reports Routes */}
        <Route path="/reports/ledger" element={<LedgerReport/>}/>
        <Route path="/reports/dmt" element={<DmtReport/>}/>
        <Route path="/reports/payout" element={<PayoutReport/>}/>
        <Route path="/reports/upi" element={<UpiReport/>}/>

        <Route path="/fund-request" element={<FundRequest/>}/>
        <Route path="/biometric-support" element={<BiometricSupport/>}/>
        <Route path="/profile" element={<Profile/>}/>
      </Route>
      </>
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
