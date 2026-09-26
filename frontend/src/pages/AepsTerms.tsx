import React from 'react';
import { Link } from 'react-router-dom';
import {
    Fingerprint,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    Building2,
    Lock,
    Phone,
    Mail,
    Scale,
    FileText,
} from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import './landing.css';

const AepsTerms: React.FC = () => {
    return (
        <div className="landing-page relative overflow-x-clip bg-white text-slate-900 font-sans">
            <LandingNav />

            {/* HERO HEADER */}
            <section className="relative w-full border-b border-slate-100 bg-gradient-to-b from-[#f7fee7]/80 via-[#ecfccb]/30 to-white px-4 sm:px-6 py-14 sm:py-20">
                <div className="mx-auto max-w-4xl text-center">
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 sm:px-4 py-1.5 rounded-full text-[0.7rem] sm:text-xs font-bold mb-4 shadow-2xs">
                        <Fingerprint className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>Aadhaar Enabled Payment System</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                        AEPS Terms &amp; <span className="text-[#008c46]">Conditions</span>
                    </h1>
                    <p className="mt-4 text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-3xl mx-auto">
                        Specific Terms, Operating Rules, Transaction Limits, Biometric Authentication Guidelines, and Fraud Mitigation Requirements for AEPS Services.
                    </p>
                </div>
            </section>

            {/* CONTENT BODY */}
            <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
                <div className="mx-auto max-w-5xl space-y-8">
                    {/* RULES SUMMARY GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-[24px] bg-white border border-slate-200 shadow-sm text-center">
                            <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] text-[#008c46] flex items-center justify-center mx-auto mb-3">
                                <Fingerprint className="w-5 h-5" />
                            </div>
                            <h3 className="font-extrabold text-slate-900 text-sm">Customer Biometric Consent</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Fingerprint scan must only be triggered after customer explicitly requests cash withdrawal or balance inquiry.
                            </p>
                        </div>
                        <div className="p-5 rounded-[24px] bg-white border border-slate-200 shadow-sm text-center">
                            <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] text-[#008c46] flex items-center justify-center mx-auto mb-3">
                                <Scale className="w-5 h-5" />
                            </div>
                            <h3 className="font-extrabold text-slate-900 text-sm">NPCI Limit Caps</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Transactions subject to per-transaction (max ₹10,000) and daily withdrawal limits set by issuer bank and NPCI.
                            </p>
                        </div>
                        <div className="p-5 rounded-[24px] bg-white border border-slate-200 shadow-sm text-center">
                            <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] text-[#008c46] flex items-center justify-center mx-auto mb-3">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h3 className="font-extrabold text-slate-900 text-sm">L1 Device Encryption</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Devices must be STQC certified L1 biometric scanners using PID block hardware encryption.
                            </p>
                        </div>
                    </div>

                    {/* VERBATIM AEPS TERM AND COND DOCUMENT COPY CARD */}
                    <div className="bg-white rounded-[28px] border border-[#bbf7d0] p-6 sm:p-8 shadow-sm space-y-4 bg-gradient-to-br from-white via-[#f0fdf4]/40 to-white">
                        <div className="flex items-center gap-2 border-b border-emerald-100 pb-3">
                            <FileText className="w-5 h-5 text-[#008c46]" />
                            <h3 className="text-lg font-extrabold text-slate-900">Official Biometric &amp; Aadhaar Consent Statement (AEPS term and cond)</h3>
                        </div>
                        <div className="p-5 rounded-2xl bg-white border border-emerald-200 text-xs sm:text-sm text-slate-800 leading-relaxed font-mono shadow-2xs space-y-2">
                            <p className="font-bold text-[#008c46] uppercase text-xs tracking-wider">Aadhaar &amp; Biometric Consent Agreement:</p>
                            <p className="italic">
                                "I, the undersigned, the holder of the AADHAAR Number hereby give my consent to SHAHPARPAY SOLUTIONS PRIVATE LIMITED and A2Z CLICK SOLUTIONS to obtain my Aadhaar Number and biometrics for authentication with Unique Identification Authority of India (UIDAI). SOLUTIONS PRIVATE LIMITED and A2Z CLICK SOLUTIONS has informed me that my identity information will be used only for AEPS (Aadhaar Enabled Payment System) Balance Enquiry and Mini Statement Enquiry purpose and that my biometrics will not be stored/shared by SOLUTIONS PRIVATE LIMITED and A2Z CLICK SOLUTIONS and will be submitted to Central Identity Data Repository (CIDR) only for purpose of authenticating my identity."
                            </p>
                        </div>
                    </div>

                    {/* MAIN AEPS TERMS CARD */}
                    <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8">
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight border-l-4 border-[#008c46] pl-3">
                                AEPS Service Operating Guidelines
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Terms governing Cash Withdrawal, Balance Inquiry, Mini Statement, Aadhaar Pay, and AEPS Cash Deposit.
                            </p>
                        </div>

                        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
                            <div className="space-y-3">
                                <h3 className="font-extrabold text-slate-900 text-base border-b border-slate-100 pb-2">
                                    1. Customer Authentication &amp; Biometric Scan Guidelines
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600">
                                    The Retailer shall initiate AEPS transactions only upon physical presence of the customer at the counter. The Retailer shall verify the Aadhaar number entered against the customer’s original document or card. Under no circumstances shall a transaction be executed remotely or without live customer presence.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-extrabold text-slate-900 text-base border-b border-slate-100 pb-2">
                                    2. Prohibition of Split Transactions &amp; Extra Surcharges
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600">
                                    Splitting a customer’s cash withdrawal into multiple smaller transactions (e.g. 2 x ₹5,000 instead of 1 x ₹10,000) to claim double commission or circumvent NPCI daily caps is strictly illegal. Any retailer detected committing split transactions will face instant wallet freeze, forfeiture of commission, and permanent account ban.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-extrabold text-slate-900 text-base border-b border-slate-100 pb-2">
                                    3. Settlement &amp; Wallet Reconciliation
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600">
                                    AEPS cash withdrawal amounts and commissions are credited to the retailer’s Shahparpay wallet ledger instantly upon bank authorization. Retailers can transfer wallet funds to their registered bank account 24x7. Shahparpay digital logs shall serve as final proof in case of ledger discrepancies.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-extrabold text-slate-900 text-base border-b border-slate-100 pb-2">
                                    4. Fraud Liability &amp; Customer Chargebacks
                                </h3>
                                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-2">
                                    <p className="font-bold text-slate-900">Chargeback Procedure:</p>
                                    <p className="text-xs text-slate-600">
                                        If a customer reports an unauthorized debit to their bank, NPCI issues a chargeback notice. The Retailer must provide the physical logbook entry (with customer signature and RRN) within 48 hours. If the retailer fails to produce valid proof, the chargeback amount will be debited from the retailer’s wallet trading balance.
                                    </p>
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
                            <Link to="/aeps-terms" className="p-3 rounded-xl bg-[#008c46] text-white border border-[#008c46] text-center shadow-xs">AEPS Terms</Link>
                            <Link to="/aeps-permission" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">AEPS Declaration</Link>
                            <Link to="/refund-policy" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">Refund Policy</Link>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default AepsTerms;
