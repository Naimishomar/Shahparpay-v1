import React from 'react';
import { Link } from 'react-router-dom';
import {
    ShieldCheck,
    Fingerprint,
    CheckCircle2,
    FileText,
    AlertCircle,
    Building2,
    Lock,
    Phone,
    Mail,
    Scale,
    FileCode,
} from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import './landing.css';

const AepsPermission: React.FC = () => {
    return (
        <div className="landing-page relative overflow-x-clip bg-white text-slate-900 font-sans">
            <LandingNav />

            {/* HERO HEADER */}
            <section className="relative w-full border-b border-slate-100 bg-gradient-to-b from-[#f7fee7]/80 via-[#ecfccb]/30 to-white px-4 sm:px-6 py-14 sm:py-20">
                <div className="mx-auto max-w-4xl text-center">
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 sm:px-4 py-1.5 rounded-full text-[0.7rem] sm:text-xs font-bold mb-4 shadow-2xs">
                        <Fingerprint className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>UIDAI &amp; NPCI Compliance Directives</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                        AEPS Permission &amp; <span className="text-[#008c46]">Declaration</span>
                    </h1>
                    <p className="mt-4 text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-3xl mx-auto">
                        Official Retailer Undertaking, Biometric Consent, NPCI Compliance Directives, and Aadhaar Enabled
                        Payment System (AEPS) Operational Standards for Shahparpay Solutions Private Limited.
                    </p>
                </div>
            </section>

            {/* CONTENT BODY */}
            <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
                <div className="mx-auto max-w-5xl space-y-8">
                    {/* ZERO BIOMETRIC STORAGE NOTICE */}
                    <div className="p-6 rounded-[24px] bg-emerald-50 border border-emerald-200 text-emerald-950 shadow-xs flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white text-[#008c46] border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold text-emerald-900">Zero Raw Biometric Storage Declaration</h3>
                            <p className="text-xs sm:text-sm text-emerald-800 mt-1 leading-relaxed">
                                Shahparpay strictly complies with UIDAI Regulations and the Aadhaar Act. Raw biometric data
                                (fingerprint scans) is encrypted inside STQC-certified L1 biometric device hardware at the time of capture
                                and is <strong>NEVER</strong> stored on retailer devices, mobile apps, desktop computers, or Shahparpay servers.
                            </p>
                        </div>
                    </div>

                    {/* VERBATIM AEPS PERMISSION DOCUMENT COPY CARD */}
                    <div className="bg-white rounded-[28px] border border-[#bbf7d0] p-6 sm:p-8 shadow-sm space-y-4 bg-gradient-to-br from-white via-[#f0fdf4]/40 to-white">
                        <div className="flex items-center gap-2 border-b border-emerald-100 pb-3">
                            <FileText className="w-5 h-5 text-[#008c46]" />
                            <h3 className="text-lg font-extrabold text-slate-900">Official Biometric &amp; Aadhaar Consent Statement (AEPS PERMISSION)</h3>
                        </div>
                        <div className="p-5 rounded-2xl bg-white border border-emerald-200 text-xs sm:text-sm text-slate-800 leading-relaxed font-mono shadow-2xs space-y-2">
                            <p className="font-bold text-[#008c46] uppercase text-xs tracking-wider">Aadhaar Holder Consent Form:</p>
                            <p className="italic">
                                "I, the undersigned, the holder of the AADHAAR Number hereby give my consent to SHAHPARPAY SOLUTIONS PRIVATE LIMITED to obtain my Aadhaar Number and biometrics for authentication with Unique Identification Authority of India (UIDAI). SHAHPARPAY SOLUTIONS PRIVATE LIMITED has informed me that my identity information will be used only for AEPS (Aadhaar Enabled Payment System) Cash Withdrawal, Cash Deposit, Balance Enquiry and Mini Statement Enquiry purpose and that my biometrics will not be stored/shared by SHAHPARPAY SOLUTIONS PRIVATE LIMITED and will be submitted to Central Identity Data Repository (CIDR) only for purpose of authenticating my identity."
                            </p>
                        </div>
                    </div>

                    {/* MAIN DECLARATION CARD */}
                    <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8">
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight border-l-4 border-[#008c46] pl-3">
                                Retailer Undertaking &amp; Declaration Form
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Every registered merchant or agent operating AEPS services on Shahparpay must abide by the following undertaking:
                            </p>
                        </div>

                        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> 1. Operational &amp; Legal Compliance
                                </h3>
                                <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
                                    <li>
                                        I hereby declare that I will operate AEPS cash withdrawal, balance inquiry, mini statement, and Aadhaar Pay strictly in accordance with NPCI, RBI, and UIDAI guidelines.
                                    </li>
                                    <li>
                                        I agree to capture explicit verbal or written customer consent before asking the customer to place their finger on the biometric scanner.
                                    </li>
                                    <li>
                                        I will maintain a physical transaction logbook/register at my retail shop detailing: Date, Customer Name, Aadhaar Last 4 Digits, Bank Name, RRN / Txn ID, Amount, and Customer Signature/Thumbprint.
                                    </li>
                                </ul>
                            </div>

                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> 2. Prohibition of Fraudulent Practices
                                </h3>
                                <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
                                    <li>
                                        <strong>No Split Transactions:</strong> I will never split a customer’s single withdrawal into multiple transactions to claim higher slab commission or bypass daily transaction limits.
                                    </li>
                                    <li>
                                        <strong>No Extra Cash Surcharge:</strong> I will not demand or collect any extra unauthorized cash fee from customers beyond the transaction debit amount.
                                    </li>
                                    <li>
                                        <strong>No Fake Biometric Scans:</strong> Using silicone fingerprints, latent print copies, or unauthorized biometric clone software is a non-bailable criminal offense under the Information Technology Act &amp; Indian Penal Code.
                                    </li>
                                </ul>
                            </div>

                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> 3. Cooperation with Verification &amp; Audits
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600">
                                    I agree to allow physical inspection of my shop premises and verification of physical registers by Shahparpay bank auditors, NPCI field supervisors, or law enforcement authorities. Failure to produce physical transaction registers during an audit will lead to immediate wallet freeze and agent terminal deactivation.
                                </p>
                            </div>

                            {/* REPORT UNAUTHORIZED TRANSACTION CARD */}
                            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
                                <div className="font-extrabold text-amber-900 flex items-center gap-2 text-sm">
                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                    To Block &amp; Report Unauthorized AEPS Transactions:
                                </div>
                                <p className="text-xs sm:text-sm text-amber-900">
                                    If you suspect any unauthorized transaction or fraudulent activity on your Shahparpay account, immediately contact our 24/7 helpline:
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-xs font-bold pt-1">
                                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-[#008c46]" /> +91 8240039776</span>
                                    <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-[#008c46]" /> shahparpay@gmail.com</span>
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
                            <Link to="/aeps-permission" className="p-3 rounded-xl bg-[#008c46] text-white border border-[#008c46] text-center shadow-xs">AEPS Declaration</Link>
                            <Link to="/refund-policy" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">Refund Policy</Link>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default AepsPermission;
