import React from 'react';
import { Link } from 'react-router-dom';
import {
    RefreshCw,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    Clock,
    KeyRound,
    Phone,
    Mail,
    Scale,
    FileText,
    Receipt,
    Send,
} from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import './landing.css';

const RefundPolicy: React.FC = () => {
    return (
        <div className="landing-page relative overflow-x-clip bg-white text-slate-900 font-sans">
            <LandingNav />

            {/* HERO HEADER */}
            <section className="relative w-full border-b border-slate-100 bg-gradient-to-b from-[#f7fee7]/80 via-[#ecfccb]/30 to-white px-4 sm:px-6 py-14 sm:py-20">
                <div className="mx-auto max-w-4xl text-center">
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 sm:px-4 py-1.5 rounded-full text-[0.7rem] sm:text-xs font-bold mb-4 shadow-2xs">
                        <RefreshCw className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>Transaction Reversals &amp; Dispute Resolution</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                        Refund &amp; Cancellation <span className="text-[#008c46]">Policy</span>
                    </h1>
                    <p className="mt-4 text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-3xl mx-auto">
                        Official Policy governing Failed Transactions, Mobile/DTH Recharges, Domestic Money Transfers (DMT), BBPS Bill Payments, Reversal Timelines, and Dispute Escalation.
                    </p>
                </div>
            </section>

            {/* CONTENT BODY */}
            <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
                <div className="mx-auto max-w-5xl space-y-8">
                    {/* TIMELINE HIGHLIGHT CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] flex items-center justify-center mx-auto mb-3">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div className="text-2xl font-extrabold text-[#008c46]">24 - 72 Hrs</div>
                            <h3 className="font-extrabold text-slate-900 text-sm mt-1">Auto Bank Reversal</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Money debited from retailer wallet during bank network timeouts reverses automatically to wallet within 24-72 hours.
                            </p>
                        </div>

                        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] flex items-center justify-center mx-auto mb-3">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <div className="text-2xl font-extrabold text-[#008c46]">OTP Claim</div>
                            <h3 className="font-extrabold text-slate-900 text-sm mt-1">DMT / Payout Refunds</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Failed money transfers require sender OTP validation on the portal to credit funds back to wallet or cash.
                            </p>
                        </div>

                        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] flex items-center justify-center mx-auto mb-3">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div className="text-2xl font-extrabold text-[#008c46]">7 Days</div>
                            <h3 className="font-extrabold text-slate-900 text-sm mt-1">Dispute Window</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                All transaction queries or discrepancies must be reported to support within 7 days of transaction date.
                            </p>
                        </div>
                    </div>

                    {/* VERBATIM REFUND & CANCELLATION POLICY DOCUMENT COPY CARD */}
                    <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <FileText className="w-5 h-5 text-[#008c46]" />
                            <h3 className="text-lg font-extrabold text-slate-900">Official Document Record (Refund and Cancellation Policy)</h3>
                        </div>
                        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-mono space-y-4">
                            <p className="font-bold text-slate-900 text-center uppercase tracking-wider text-sm">
                                REFUND AND CANCELLATION POLICY
                            </p>
                            <p>
                                Once a User chooses to avail of any subscription plan/offer announced by Shahparpay Solutions Private Limited and agrees to buy that deal by due payment, such payment by the User shall not be refunded by the entitled under any circumstances whatsoever. Please note that the act of buying a plan by Shahparpay Solutions Private Limited is irreversible under the applicable law.
                            </p>
                            <p>
                                After receipt of payment from the user for any of the plans mentioned above and successful KYC verification of the user, Shahparpay Solutions Private Limited shall create a user ID in their mobile application or website for the respective. Suppose if, the user is unable to get successful KYC done, Shahparpay Solutions Private Limited shall not be able to allow availing the services mentioned for that particular subscription plan. No existing balance will be refunded to the user in case of unsuccessful KYC verification. Thus, to avail of Shahparpay Solutions Private Limited Ltd. services on its Mobile App / Website, the user must obtain a successful KYC verification to proceed further.
                            </p>
                            <p>
                                Post User Id creation, while availing various services Shahparpay Solutions Private Limited Mobile App / Website, transactions which have failed for any reason directly attributable to Shahparpay Solutions Private Limited and we receive corresponding confirmation from the payment gateway will be automatically refunded* to user's bank account within 3-15 working days from the date of transaction. A confirmation mail will be sent to the user's registered Email ID along with the refund.
                            </p>
                            <p className="italic text-slate-600">
                                Note: Please note that only the actual transaction amount will be refunded, excluding payment gateway charges and all applicable taxes.
                            </p>
                            <p>
                                However, for cases where the user has received a successful completion confirmation but has yet to receive services, the user can submit a complaint via the Email ID mentioned on this website. Shahparpay Solutions Private Limited Ltd. instantly enquires about the matter after receiving criticism from any of our users. In an extreme case, Shahparpay Solutions Private Limited may refund the payment deducting necessary professional service charges based on the inquiry.
                            </p>
                            <p>
                                Shahparpay Solutions Private Limited's liability will be restricted to providing the user with a valid refund to the extent of the corresponding payment received by the company concerning a particular transaction. The company shall not be responsible for any other claim or consequential liability arising from failed assistance on our system.
                            </p>
                            <p className="font-semibold text-slate-900 border-t border-slate-200 pt-3">
                                User accepts that this refund policy is subject to all the terms and conditions stated in the Agreement of the User/business associate/retailer/distributor/master distributor/stated head with Shahparpay Solutions Private Limited.
                            </p>
                        </div>
                    </div>

                    {/* MAIN REFUND POLICY CARD */}
                    <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8">
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight border-l-4 border-[#008c46] pl-3">
                                Category-Wise Refund &amp; Cancellation Rules
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Detailed terms governing each service type offered on the Shahparpay portal.
                            </p>
                        </div>

                        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
                            {/* Recharge Policy */}
                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="flex items-center gap-2 font-extrabold text-slate-900 text-base">
                                    <Receipt className="w-5 h-5 text-[#008c46]" /> Mobile &amp; DTH Prepaid Recharge Policy
                                </div>
                                <p className="text-xs sm:text-sm text-slate-600">
                                    All sales of prepaid recharge on the shahparpay.in platform are final with no refund or exchange permitted once the operator returns a <strong>SUCCESS</strong> status. The user/retailer is solely responsible for verifying the mobile number or DTH subscriber ID prior to confirmation. If a recharge attempt fails at the operator switch, the debited amount is returned to the retailer wallet immediately.
                                </p>
                            </div>

                            {/* DMT Policy */}
                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="flex items-center gap-2 font-extrabold text-slate-900 text-base">
                                    <Send className="w-5 h-5 text-[#008c46]" /> Domestic Money Transfer (DMT) &amp; Payouts
                                </div>
                                <p className="text-xs sm:text-sm text-slate-600">
                                    In case a money transfer fails due to destination bank rejection or account freeze, a 6-digit refund OTP is generated by the NPCI switch and sent to the sender’s mobile number. The retailer must enter the refund OTP in the portal report section to claim the instant wallet ledger credit.
                                </p>
                            </div>

                            {/* Wrong Transfer Disclaimer */}
                            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
                                <div className="flex items-center gap-2 font-extrabold text-amber-900 text-sm">
                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                    Erroneous Payment &amp; Wrong Beneficiary Disclaimer
                                </div>
                                <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                                    In the event YOU erroneously send a payment to a wrong party or enter an incorrect bank account number/IFSC code, Shahparpay shall have no liability in this regard. Payment orders become irrevocable once executed by the banking switch. Your only recourse is to contact the recipient directly.
                                </p>
                            </div>

                            {/* Support Ticket Dispute Raising */}
                            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                                <div className="font-bold text-sm text-emerald-900">How to Log a Support Complaint:</div>
                                <p className="text-xs text-emerald-800">
                                    If any transaction fails due to server errors or network timeouts without wallet reversal within 24 hours, email your Transaction ID / RRN to support:
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-xs font-bold pt-1 text-emerald-900">
                                    <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-[#008c46]" /> shahparpay@gmail.com</span>
                                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-[#008c46]" /> +91 8240039776</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* LEGAL HUB QUICK NAV GRID */}
                    <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Legal &amp; Compliance Network</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-bold text-slate-700">
                            <Link to="/about" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">About Us</Link>
                            <Link to="/terms" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">General Terms</Link>
                            <Link to="/retailer-terms" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">Retailer Terms</Link>
                            <Link to="/aeps-terms" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">AEPS Terms</Link>
                            <Link to="/aeps-permission" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">AEPS Declaration</Link>
                            <Link to="/refund-policy" className="p-3 rounded-xl bg-[#008c46] text-white border border-[#008c46] text-center shadow-xs">Refund Policy</Link>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default RefundPolicy;
