import React from 'react';
import {
    AlertCircle,
    Clock,
    KeyRound,
    Phone,
    Mail,
    FileText,
    Receipt,
    Send,
} from 'lucide-react';
import LegalLayout from '@/components/landing/LegalLayout';

const RefundPolicy: React.FC = () => {
    return (
        <LegalLayout eyebrow="Transaction reversals and disputes" title="Refund and cancellation policy" lead={<>Official Policy governing Failed Transactions, Mobile/DTH Recharges, Domestic Money Transfers (DMT), BBPS Bill Payments, Reversal Timelines, and Dispute Escalation.</>}>

                    {/* TIMELINE HIGHLIGHT CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-6 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-border)] text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--lp-accent-soft)] text-[var(--lp-accent-ink)] border border-[var(--lp-border)] flex items-center justify-center mx-auto mb-3">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div className="text-2xl font-medium text-[var(--lp-accent-ink)]">24 - 72 Hrs</div>
                            <h3 className="font-medium text-[var(--lp-fg)] text-sm mt-1">Auto Bank Reversal</h3>
                            <p className="text-sm text-[var(--lp-muted)] mt-1">
                                Money debited from retailer wallet during bank network timeouts reverses automatically to wallet within 24-72 hours.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-border)] text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--lp-accent-soft)] text-[var(--lp-accent-ink)] border border-[var(--lp-border)] flex items-center justify-center mx-auto mb-3">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <div className="text-2xl font-medium text-[var(--lp-accent-ink)]">OTP Claim</div>
                            <h3 className="font-medium text-[var(--lp-fg)] text-sm mt-1">DMT / Payout Refunds</h3>
                            <p className="text-sm text-[var(--lp-muted)] mt-1">
                                Failed money transfers require sender OTP validation on the portal to credit funds back to wallet or cash.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-border)] text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--lp-accent-soft)] text-[var(--lp-accent-ink)] border border-[var(--lp-border)] flex items-center justify-center mx-auto mb-3">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div className="text-2xl font-medium text-[var(--lp-accent-ink)]">7 Days</div>
                            <h3 className="font-medium text-[var(--lp-fg)] text-sm mt-1">Dispute Window</h3>
                            <p className="text-sm text-[var(--lp-muted)] mt-1">
                                All transaction queries or discrepancies must be reported to support within 7 days of transaction date.
                            </p>
                        </div>
                    </div>

                    {/* VERBATIM REFUND & CANCELLATION POLICY DOCUMENT COPY CARD */}
                    <div className="bg-[var(--lp-card)] rounded-2xl border border-[var(--lp-border)] p-6 sm:p-8 space-y-4">
                        <div className="flex items-center gap-2 border-b border-[var(--lp-border)] pb-3">
                            <FileText className="w-5 h-5 text-[var(--lp-accent-ink)]" />
                            <h3 className="text-lg font-medium text-[var(--lp-fg)]">Official Document Record (Refund and Cancellation Policy)</h3>
                        </div>
                        <div className="p-5 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] text-sm sm:text-[15px] text-[var(--lp-fg-2)] leading-relaxed space-y-4">
                            <p className="font-medium text-[var(--lp-fg)] text-center text-sm">
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
                            <p className="italic text-[var(--lp-fg-2)]">
                                Note: Please note that only the actual transaction amount will be refunded, excluding payment gateway charges and all applicable taxes.
                            </p>
                            <p>
                                However, for cases where the user has received a successful completion confirmation but has yet to receive services, the user can submit a complaint via the Email ID mentioned on this website. Shahparpay Solutions Private Limited Ltd. instantly enquires about the matter after receiving criticism from any of our users. In an extreme case, Shahparpay Solutions Private Limited may refund the payment deducting necessary professional service charges based on the inquiry.
                            </p>
                            <p>
                                Shahparpay Solutions Private Limited's liability will be restricted to providing the user with a valid refund to the extent of the corresponding payment received by the company concerning a particular transaction. The company shall not be responsible for any other claim or consequential liability arising from failed assistance on our system.
                            </p>
                            <p className="font-semibold text-[var(--lp-fg)] border-t border-[var(--lp-border)] pt-3">
                                User accepts that this refund policy is subject to all the terms and conditions stated in the Agreement of the User/business associate/retailer/distributor/master distributor/stated head with Shahparpay Solutions Private Limited.
                            </p>
                        </div>
                    </div>

                    {/* MAIN REFUND POLICY CARD */}
                    <div className="bg-[var(--lp-card)] rounded-2xl border border-[var(--lp-border)] p-6 sm:p-10 space-y-8">
                        <div>
                            <h2 className="text-2xl font-medium text-[var(--lp-fg)] tracking-tight border-l-4 border-[var(--lp-accent)] pl-3">
                                Category-Wise Refund &amp; Cancellation Rules
                            </h2>
                            <p className="text-sm sm:text-[15px] text-[var(--lp-muted)] mt-1">
                                Detailed terms governing each service type offered on the Shahparpay portal.
                            </p>
                        </div>

                        <div className="space-y-6 text-sm text-[var(--lp-fg-2)] leading-relaxed">
                            {/* Recharge Policy */}
                            <div className="p-5 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] space-y-2">
                                <div className="flex items-center gap-2 font-medium text-[var(--lp-fg)] text-base">
                                    <Receipt className="w-5 h-5 text-[var(--lp-accent-ink)]" /> Mobile &amp; DTH Prepaid Recharge Policy
                                </div>
                                <p className="text-sm sm:text-[15px] text-[var(--lp-fg-2)]">
                                    All sales of prepaid recharge on the shahparpay.in platform are final with no refund or exchange permitted once the operator returns a <strong>SUCCESS</strong> status. The user/retailer is solely responsible for verifying the mobile number or DTH subscriber ID prior to confirmation. If a recharge attempt fails at the operator switch, the debited amount is returned to the retailer wallet immediately.
                                </p>
                            </div>

                            {/* DMT Policy */}
                            <div className="p-5 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] space-y-2">
                                <div className="flex items-center gap-2 font-medium text-[var(--lp-fg)] text-base">
                                    <Send className="w-5 h-5 text-[var(--lp-accent-ink)]" /> Domestic Money Transfer (DMT) &amp; Payouts
                                </div>
                                <p className="text-sm sm:text-[15px] text-[var(--lp-fg-2)]">
                                    In case a money transfer fails due to destination bank rejection or account freeze, a 6-digit refund OTP is generated by the NPCI switch and sent to the sender’s mobile number. The retailer must enter the refund OTP in the portal report section to claim the instant wallet ledger credit.
                                </p>
                            </div>

                            {/* Wrong Transfer Disclaimer */}
                            <div className="p-5 rounded-2xl bg-[var(--lp-warn-soft)] border border-[var(--lp-warn-line)] text-[var(--lp-fg)] space-y-2">
                                <div className="flex items-center gap-2 font-medium text-[var(--lp-fg)] text-sm">
                                    <AlertCircle className="w-5 h-5 text-[var(--lp-warn)] shrink-0" />
                                    Erroneous Payment &amp; Wrong Beneficiary Disclaimer
                                </div>
                                <p className="text-sm sm:text-[15px] text-[var(--lp-fg)] leading-relaxed">
                                    In the event YOU erroneously send a payment to a wrong party or enter an incorrect bank account number/IFSC code, Shahparpay shall have no liability in this regard. Payment orders become irrevocable once executed by the banking switch. Your only recourse is to contact the recipient directly.
                                </p>
                            </div>

                            {/* Support Ticket Dispute Raising */}
                            <div className="p-5 rounded-2xl bg-[var(--lp-accent-soft)] border border-[var(--lp-border)] text-[var(--lp-fg)] space-y-2">
                                <div className="font-medium text-sm text-[var(--lp-fg)]">How to Log a Support Complaint:</div>
                                <p className="text-sm text-[var(--lp-fg-2)]">
                                    If any transaction fails due to server errors or network timeouts without wallet reversal within 24 hours, email your Transaction ID / RRN to support:
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-sm font-medium pt-1 text-[var(--lp-fg)]">
                                    <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-[var(--lp-accent-ink)]" /> shahparpay@gmail.com</span>
                                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-[var(--lp-accent-ink)]" /> +91 8240039776</span>
                                </div>
                            </div>
                        </div>
                    </div>
        </LegalLayout>
    );
};

export default RefundPolicy;
