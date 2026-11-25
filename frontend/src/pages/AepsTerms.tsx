import React from 'react';
import {
    Fingerprint,
    ShieldCheck,
    Scale,
    FileText,
} from 'lucide-react';
import LegalLayout from '@/components/landing/LegalLayout';

const AepsTerms: React.FC = () => {
    return (
        <LegalLayout eyebrow="Aadhaar Enabled Payment System" title="AEPS terms and conditions" lead={<>Specific Terms, Operating Rules, Transaction Limits, Biometric Authentication Guidelines, and Fraud Mitigation Requirements for AEPS Services.</>}>

                    {/* RULES SUMMARY GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-border)] text-center">
                            <div className="w-10 h-10 rounded-xl bg-[var(--lp-accent-soft)] text-[var(--lp-accent-ink)] flex items-center justify-center mx-auto mb-3">
                                <Fingerprint className="w-5 h-5" />
                            </div>
                            <h3 className="font-medium text-[var(--lp-fg)] text-sm">Customer Biometric Consent</h3>
                            <p className="text-sm text-[var(--lp-muted)] mt-1">
                                Fingerprint scan must only be triggered after customer explicitly requests cash withdrawal or balance inquiry.
                            </p>
                        </div>
                        <div className="p-5 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-border)] text-center">
                            <div className="w-10 h-10 rounded-xl bg-[var(--lp-accent-soft)] text-[var(--lp-accent-ink)] flex items-center justify-center mx-auto mb-3">
                                <Scale className="w-5 h-5" />
                            </div>
                            <h3 className="font-medium text-[var(--lp-fg)] text-sm">NPCI Limit Caps</h3>
                            <p className="text-sm text-[var(--lp-muted)] mt-1">
                                Transactions subject to per-transaction (max ₹10,000) and daily withdrawal limits set by issuer bank and NPCI.
                            </p>
                        </div>
                        <div className="p-5 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-border)] text-center">
                            <div className="w-10 h-10 rounded-xl bg-[var(--lp-accent-soft)] text-[var(--lp-accent-ink)] flex items-center justify-center mx-auto mb-3">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h3 className="font-medium text-[var(--lp-fg)] text-sm">L1 Device Encryption</h3>
                            <p className="text-sm text-[var(--lp-muted)] mt-1">
                                Devices must be STQC certified L1 biometric scanners using PID block hardware encryption.
                            </p>
                        </div>
                    </div>

                    {/* VERBATIM AEPS TERM AND COND DOCUMENT COPY CARD */}
                    <div className="bg-[var(--lp-card)] rounded-2xl border border-[var(--lp-border)] p-6 sm:p-8 space-y-4">
                        <div className="flex items-center gap-2 border-b border-[var(--lp-border)] pb-3">
                            <FileText className="w-5 h-5 text-[var(--lp-accent-ink)]" />
                            <h3 className="text-lg font-medium text-[var(--lp-fg)]">Official Biometric &amp; Aadhaar Consent Statement (AEPS term and cond)</h3>
                        </div>
                        <div className="p-5 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-border)] text-sm sm:text-[15px] text-[var(--lp-fg)] leading-relaxed space-y-2">
                            <p className="font-medium text-[var(--lp-accent-ink)] text-sm">Aadhaar &amp; Biometric Consent Agreement:</p>
                            <p className="italic">
                                "I, the undersigned, the holder of the AADHAAR Number hereby give my consent to SHAHPARPAY SOLUTIONS PRIVATE LIMITED and A2Z CLICK SOLUTIONS to obtain my Aadhaar Number and biometrics for authentication with Unique Identification Authority of India (UIDAI). SOLUTIONS PRIVATE LIMITED and A2Z CLICK SOLUTIONS has informed me that my identity information will be used only for AEPS (Aadhaar Enabled Payment System) Balance Enquiry and Mini Statement Enquiry purpose and that my biometrics will not be stored/shared by SOLUTIONS PRIVATE LIMITED and A2Z CLICK SOLUTIONS and will be submitted to Central Identity Data Repository (CIDR) only for purpose of authenticating my identity."
                            </p>
                        </div>
                    </div>

                    {/* MAIN AEPS TERMS CARD */}
                    <div className="bg-[var(--lp-card)] rounded-2xl border border-[var(--lp-border)] p-6 sm:p-10 space-y-8">
                        <div>
                            <h2 className="text-2xl font-medium text-[var(--lp-fg)] tracking-tight border-l-4 border-[var(--lp-accent)] pl-3">
                                AEPS Service Operating Guidelines
                            </h2>
                            <p className="text-sm sm:text-[15px] text-[var(--lp-muted)] mt-1">
                                Terms governing Cash Withdrawal, Balance Inquiry, Mini Statement, Aadhaar Pay, and AEPS Cash Deposit.
                            </p>
                        </div>

                        <div className="space-y-6 text-sm text-[var(--lp-fg-2)] leading-relaxed">
                            <div className="space-y-3">
                                <h3 className="font-medium text-[var(--lp-fg)] text-base border-b border-[var(--lp-border)] pb-2">
                                    1. Customer Authentication &amp; Biometric Scan Guidelines
                                </h3>
                                <p className="text-sm sm:text-[15px] text-[var(--lp-fg-2)]">
                                    The Retailer shall initiate AEPS transactions only upon physical presence of the customer at the counter. The Retailer shall verify the Aadhaar number entered against the customer’s original document or card. Under no circumstances shall a transaction be executed remotely or without live customer presence.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-medium text-[var(--lp-fg)] text-base border-b border-[var(--lp-border)] pb-2">
                                    2. Prohibition of Split Transactions &amp; Extra Surcharges
                                </h3>
                                <p className="text-sm sm:text-[15px] text-[var(--lp-fg-2)]">
                                    Splitting a customer’s cash withdrawal into multiple smaller transactions (e.g. 2 x ₹5,000 instead of 1 x ₹10,000) to claim double commission or circumvent NPCI daily caps is strictly illegal. Any retailer detected committing split transactions will face instant wallet freeze, forfeiture of commission, and permanent account ban.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-medium text-[var(--lp-fg)] text-base border-b border-[var(--lp-border)] pb-2">
                                    3. Settlement &amp; Wallet Reconciliation
                                </h3>
                                <p className="text-sm sm:text-[15px] text-[var(--lp-fg-2)]">
                                    AEPS cash withdrawal amounts and commissions are credited to the retailer’s Shahparpay wallet ledger instantly upon bank authorization. Retailers can transfer wallet funds to their registered bank account 24x7. Shahparpay digital logs shall serve as final proof in case of ledger discrepancies.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-medium text-[var(--lp-fg)] text-base border-b border-[var(--lp-border)] pb-2">
                                    4. Fraud Liability &amp; Customer Chargebacks
                                </h3>
                                <div className="p-5 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] text-sm sm:text-[15px] text-[var(--lp-fg-2)] space-y-2">
                                    <p className="font-medium text-[var(--lp-fg)]">Chargeback Procedure:</p>
                                    <p className="text-sm text-[var(--lp-fg-2)]">
                                        If a customer reports an unauthorized debit to their bank, NPCI issues a chargeback notice. The Retailer must provide the physical logbook entry (with customer signature and RRN) within 48 hours. If the retailer fails to produce valid proof, the chargeback amount will be debited from the retailer’s wallet trading balance.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
        </LegalLayout>
    );
};

export default AepsTerms;
