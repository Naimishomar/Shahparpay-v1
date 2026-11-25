import React from 'react';
import {
    ShieldCheck,
    CheckCircle2,
    FileText,
    AlertCircle,
    Phone,
    Mail,
} from 'lucide-react';
import LegalLayout from '@/components/landing/LegalLayout';

const AepsPermission: React.FC = () => {
    return (
        <LegalLayout eyebrow="UIDAI and NPCI compliance" title="AEPS permission and declaration" lead={<>Official Retailer Undertaking, Biometric Consent, NPCI Compliance Directives, and Aadhaar Enabled Payment System (AEPS) Operational Standards for Shahparpay Solutions Private Limited.</>}>

                    {/* ZERO BIOMETRIC STORAGE NOTICE */}
                    <div className="p-6 rounded-2xl bg-[var(--lp-accent-soft)] border border-[var(--lp-border)] text-[var(--lp-fg)] flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--lp-card)] text-[var(--lp-accent-ink)] border border-[var(--lp-border)] flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-[var(--lp-fg)]">Zero Raw Biometric Storage Declaration</h3>
                            <p className="text-sm sm:text-[15px] text-[var(--lp-fg-2)] mt-1 leading-relaxed">
                                Shahparpay strictly complies with UIDAI Regulations and the Aadhaar Act. Raw biometric data
                                (fingerprint scans) is encrypted inside STQC-certified L1 biometric device hardware at the time of capture
                                and is <strong>NEVER</strong> stored on retailer devices, mobile apps, desktop computers, or Shahparpay servers.
                            </p>
                        </div>
                    </div>

                    {/* VERBATIM AEPS PERMISSION DOCUMENT COPY CARD */}
                    <div className="bg-[var(--lp-card)] rounded-2xl border border-[var(--lp-border)] p-6 sm:p-8 space-y-4">
                        <div className="flex items-center gap-2 border-b border-[var(--lp-border)] pb-3">
                            <FileText className="w-5 h-5 text-[var(--lp-accent-ink)]" />
                            <h3 className="text-lg font-medium text-[var(--lp-fg)]">Official Biometric &amp; Aadhaar Consent Statement (AEPS PERMISSION)</h3>
                        </div>
                        <div className="p-5 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-border)] text-sm sm:text-[15px] text-[var(--lp-fg)] leading-relaxed space-y-2">
                            <p className="font-medium text-[var(--lp-accent-ink)] text-sm">Aadhaar Holder Consent Form:</p>
                            <p className="italic">
                                "I, the undersigned, the holder of the AADHAAR Number hereby give my consent to SHAHPARPAY SOLUTIONS PRIVATE LIMITED to obtain my Aadhaar Number and biometrics for authentication with Unique Identification Authority of India (UIDAI). SHAHPARPAY SOLUTIONS PRIVATE LIMITED has informed me that my identity information will be used only for AEPS (Aadhaar Enabled Payment System) Cash Withdrawal, Cash Deposit, Balance Enquiry and Mini Statement Enquiry purpose and that my biometrics will not be stored/shared by SHAHPARPAY SOLUTIONS PRIVATE LIMITED and will be submitted to Central Identity Data Repository (CIDR) only for purpose of authenticating my identity."
                            </p>
                        </div>
                    </div>

                    {/* MAIN DECLARATION CARD */}
                    <div className="bg-[var(--lp-card)] rounded-2xl border border-[var(--lp-border)] p-6 sm:p-10 space-y-8">
                        <div>
                            <h2 className="text-2xl font-medium text-[var(--lp-fg)] tracking-tight border-l-4 border-[var(--lp-accent)] pl-3">
                                Retailer Undertaking &amp; Declaration Form
                            </h2>
                            <p className="text-sm sm:text-[15px] text-[var(--lp-muted)] mt-1">
                                Every registered merchant or agent operating AEPS services on Shahparpay must abide by the following undertaking:
                            </p>
                        </div>

                        <div className="space-y-6 text-sm text-[var(--lp-fg-2)] leading-relaxed">
                            <div className="p-5 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] space-y-3">
                                <h3 className="font-medium text-[var(--lp-fg)] text-base flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-[var(--lp-accent-ink)]" /> 1. Operational &amp; Legal Compliance
                                </h3>
                                <ul className="list-disc pl-5 space-y-2 text-sm sm:text-[15px] text-[var(--lp-fg-2)]">
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

                            <div className="p-5 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] space-y-3">
                                <h3 className="font-medium text-[var(--lp-fg)] text-base flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-[var(--lp-accent-ink)]" /> 2. Prohibition of Fraudulent Practices
                                </h3>
                                <ul className="list-disc pl-5 space-y-2 text-sm sm:text-[15px] text-[var(--lp-fg-2)]">
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

                            <div className="p-5 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] space-y-3">
                                <h3 className="font-medium text-[var(--lp-fg)] text-base flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-[var(--lp-accent-ink)]" /> 3. Cooperation with Verification &amp; Audits
                                </h3>
                                <p className="text-sm sm:text-[15px] text-[var(--lp-fg-2)]">
                                    I agree to allow physical inspection of my shop premises and verification of physical registers by Shahparpay bank auditors, NPCI field supervisors, or law enforcement authorities. Failure to produce physical transaction registers during an audit will lead to immediate wallet freeze and agent terminal deactivation.
                                </p>
                            </div>

                            {/* REPORT UNAUTHORIZED TRANSACTION CARD */}
                            <div className="p-6 rounded-2xl bg-[var(--lp-warn-soft)] border border-[var(--lp-warn-line)] text-[var(--lp-fg)] space-y-2">
                                <div className="font-medium text-[var(--lp-fg)] flex items-center gap-2 text-sm">
                                    <AlertCircle className="w-5 h-5 text-[var(--lp-warn)] shrink-0" />
                                    To Block &amp; Report Unauthorized AEPS Transactions:
                                </div>
                                <p className="text-sm sm:text-[15px] text-[var(--lp-fg)]">
                                    If you suspect any unauthorized transaction or fraudulent activity on your Shahparpay account, immediately contact our 24/7 helpline:
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-sm font-medium pt-1">
                                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-[var(--lp-accent-ink)]" /> +91 8240039776</span>
                                    <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-[var(--lp-accent-ink)]" /> shahparpay@gmail.com</span>
                                </div>
                            </div>
                        </div>
                    </div>
        </LegalLayout>
    );
};

export default AepsPermission;
