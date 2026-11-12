import React from 'react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import './landing.css';

// Play Store links here as the app's privacy policy; keep it in step with the
// app's permissions (app/app.json) and the Data Safety form.
const SECTIONS: { title: string; items: string[] }[] = [
    {
        title: '1. Who we are',
        items: [
            'Shahparpay Solutions Private Limited ("Shahparpay", "we") runs the Shahparpay website (shahparpay.in) and the Shahparpay Android app, used by retailers and distributors to offer AEPS, Micro ATM, money transfer (DMT), payout, bill payment (BBPS), recharge, PAN and related services.',
            'This policy explains what personal data we collect, why, who we share it with, and the rights you have under the Digital Personal Data Protection Act, 2023.',
        ],
    },
    {
        title: '2. Data we collect',
        items: [
            'Account and KYC data: name, mobile number, email, date of birth, shop name and address, PAN, Aadhaar number, GSTIN, bank account details, and photos of KYC documents you upload.',
            'Transaction data: amounts, beneficiary and customer details you enter (for example the customer\'s Aadhaar number, bank or mobile number), status, commissions and wallet ledger.',
            'Location: your device\'s precise location, read when you onboard a service and with each AEPS, Micro ATM and DMT transaction, because NPCI and our banking partners require the shop location on these transactions. We read it only while you use the app, never in the background.',
            'Camera, microphone and photos: only when you choose to photograph or attach a deposit slip, KYC document or profile photo, or record or upload the short video required for video KYC (camera and microphone).',
            'Biometric data: a fingerprint captured by a UIDAI-certified RD Service device is encrypted by that device and passed straight to the bank/UIDAI for authentication. Shahparpay cannot read it and does not store it.',
            'Bluetooth: used only to connect your Micro ATM or biometric device. We do not collect data about other nearby devices.',
            'Device and log data: device model, OS version, app version, IP address and error logs, used for security, fraud prevention and fixing problems.',
        ],
    },
    {
        title: '3. Why we use it',
        items: [
            'To create and verify your account (KYC) as banks, NPCI and RBI rules require.',
            'To process the transactions you request and to settle commissions and wallet balances.',
            'To detect and prevent fraud, money laundering and misuse.',
            'To give support, send transaction and service messages, and meet legal and regulatory obligations.',
            'We do not sell your personal data and do not use it for third-party advertising.',
        ],
    },
    {
        title: '4. Who we share it with',
        items: [
            'Banking and service partners that carry out your transactions (such as PaySprint, Fingpay/Icchhamati, sponsor banks, NPCI, UIDAI and BBPS billers), only the data each transaction needs.',
            'Cloud hosting and SMS/email providers that process data on our behalf under confidentiality obligations.',
            'Government, regulators or law-enforcement agencies when the law requires it.',
        ],
    },
    {
        title: '5. How long we keep it',
        items: [
            'We keep account, KYC and transaction records while your account is active and for the period the Prevention of Money Laundering Act, 2002, RBI directions and tax laws require after it closes (generally five years), after which we delete or anonymise them.',
        ],
    },
    {
        title: '6. Deleting your account',
        items: [
            'You can ask us to delete your account and personal data by emailing shahparpay@gmail.com from your registered email, or by calling +91 8240039776, with your registered mobile number and the subject "Account deletion".',
            'We confirm the request within 3 working days and close the account once any wallet balance is settled to your bank. Data we must keep by law (see section 5) is retained only for that purpose and then deleted; everything else is deleted.',
        ],
    },
    {
        title: '7. Security',
        items: [
            'Data travels over encrypted connections (HTTPS/TLS). Access to personal data is limited to staff and partners who need it, and passwords and PINs are stored hashed.',
        ],
    },
    {
        title: '8. Your rights',
        items: [
            'You can ask to see, correct or update your personal data, withdraw consent (which may stop us providing a service), nominate someone to exercise your rights, and raise a grievance. Write to the Grievance Officer below.',
            'The app and services are meant for adults running a business; we do not knowingly collect data from children under 18.',
        ],
    },
    {
        title: '9. Grievance Officer',
        items: [
            'Customer Nodal Officer, Shahparpay Solutions Private Limited, Hooghly, West Bengal - 712125. Email: shahparpay@gmail.com. Phone: +91 8240039776.',
            'We may update this policy; the date below shows the latest version.',
        ],
    },
];

const PrivacyPolicy: React.FC = () => (
    <div className="landing-page relative overflow-x-clip bg-white text-slate-900 font-sans">
        <LandingNav />
        <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
            <div className="mx-auto max-w-4xl space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                        Privacy <span className="text-[#008c46]">Policy</span>
                    </h1>
                    <p className="mt-3 text-sm text-slate-500">Last updated: 12 November 2026</p>
                </div>
                {SECTIONS.map((s) => (
                    <div key={s.title} className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-extrabold text-slate-900 mb-3">{s.title}</h2>
                        <ul className="space-y-2 list-disc pl-5 text-sm text-slate-700 leading-relaxed">
                            {s.items.map((i) => <li key={i}>{i}</li>)}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
        <LandingFooter />
    </div>
);

export default PrivacyPolicy;
