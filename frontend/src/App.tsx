import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom"
import Layout from "./pages/Layout"
import Dashboard from "./pages/Dashboard"
import AEPS from "./pages/AEPS"
import AEPS_Settlement from "./pages/AEPS_Settlement"
import DirectPayout from "./pages/DirectPayout"
import DMT from "./pages/DMT"
import Recharge from "./pages/Recharge"
import WalletTransfer from "./pages/WalletTransfer"
import BBPS from "./pages/BBPS"
import UPI_Payments from "./pages/UPI_Payments"
import Reports from "./pages/Reports"
import FundRequest from "./pages/FundRequest"
import BiometricSupport from "./pages/BiometricSupport"

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<Layout/>}>
        <Route index element={<Dashboard/>}/>
        <Route path="/aeps" element={<AEPS/>}/>
        <Route path="/aeps-settlement" element={<AEPS_Settlement/>}/>
        <Route path="/direct-payout" element={<DirectPayout/>}/>
        <Route path="/dmt" element={<DMT/>}/>
        <Route path="/recharge" element={<Recharge/>}/>
        <Route path="/wallet-transfer" element={<WalletTransfer/>}/>
        <Route path="/bbps" element={<BBPS/>}/>
        <Route path="/upi-payments" element={<UPI_Payments/>}/>
        <Route path="/reports" element={<Reports/>}/>
        <Route path="/fund-request" element={<FundRequest/>}/>
        <Route path="/biometric-support" element={<BiometricSupport/>}/>
      </Route>
    )
  )
  return (
    <>
    <RouterProvider router={router} />
    </>
  )
}

export default App
