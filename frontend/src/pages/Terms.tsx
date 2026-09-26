import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    Scale,
    FileText,
    ShieldAlert,
    RefreshCw,
    Fingerprint,
    CheckCircle2,
    AlertCircle,
    Phone,
    Mail,
    MapPin,
    Building2,
    Lock,
    ShieldCheck,
    Clock,
    HelpCircle,
    ChevronRight,
    Search,
    BookOpen,
    AlertTriangle,
} from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import './landing.css';

type TabKey = 'general' | 'retailer' | 'aeps' | 'refund' | 'grievance';

interface TabItem {
    id: TabKey;
    label: string;
    badge: string;
    icon: React.ElementType;
    desc: string;
}

const TABS: TabItem[] = [
    {
        id: 'general',
        label: 'General Terms & Rules',
        badge: 'Website & App',
        icon: Scale,
        desc: 'General terms of use, platform intermediary disclaimers, disclaimers on payments, and legal jurisdiction.',
    },
    {
        id: 'retailer',
        label: 'Retailer Master Agreement',
        badge: 'Partner / Retailer',
        icon: FileText,
        desc: 'Master agreement for retailers & distributors, wallet balance rules, e-KYC consent, and termination terms.',
    },
    {
        id: 'aeps',
        label: 'AEPS Terms & Declaration',
        badge: 'Aadhaar Banking',
        icon: Fingerprint,
        desc: 'Aadhaar Enabled Payment System guidelines, biometric consent, NPCI/UIDAI compliance, and register maintenance.',
    },
    {
        id: 'refund',
        label: 'Refund & Cancellation Policy',
        badge: 'Transactions',
        icon: RefreshCw,
        desc: 'Failed transaction auto-reversal timelines, DMT refund OTP process, recharge finality, and 7-day dispute window.',
    },
    {
        id: 'grievance',
        label: 'Grievance & Fraud Advisory',
        badge: 'Customer Redressal',
        icon: ShieldAlert,
        desc: 'Two-tier grievance redressal procedure, Grievance Officer contacts, escalation matrix, and fraud prevention warning.',
    },
];

const Terms: React.FC<{ defaultTab?: TabKey }> = ({ defaultTab = 'general' }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab') as TabKey | null;
    const [activeTab, setActiveTab] = useState<TabKey>(tabParam || defaultTab);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (tabParam && TABS.some((t) => t.id === tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleTabChange = (tab: TabKey) => {
        setActiveTab(tab);
        setSearchParams({ tab });
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    return (
        <div className="landing-page relative overflow-x-clip bg-white text-slate-900 font-sans">
            <LandingNav />

            {/* ------------------------------------------------------------- HEADER BAND */}
            <section className="relative w-full border-b border-slate-100 bg-gradient-to-b from-[#f7fee7]/80 via-[#ecfccb]/30 to-white px-4 sm:px-6 py-12 sm:py-16">
                <div className="mx-auto max-w-4xl text-center">
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 sm:px-4 py-1.5 rounded-full text-[0.7rem] sm:text-xs font-bold mb-4 shadow-2xs">
                        <Scale className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>Shahparpay Solutions Private Limited • Terms & Policies</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                        Terms & <span className="text-[#008c46]">Conditions</span>
                    </h1>
                    <p className="mt-4 text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-3xl mx-auto">
                        Official Terms of Service, Retailer Master Agreement, AEPS Guidelines, Refund &amp; Cancellation
                        Policy, and Customer Grievance Mechanism for Shahparpay Solutions Private Limited.
                    </p>

                    {/* Search bar inside header */}
                    <div className="mt-8 max-w-md mx-auto relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search within terms (e.g. refund, AEPS, wallet, grievance)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#008c46] focus:ring-2 focus:ring-[#008c46]/20 transition-all"
                        />
                    </div>
                </div>
            </section>

            {/* ------------------------------------------------------------- MAIN CONTENT AREA */}
            <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-12 sm:py-16 border-b border-slate-100">
                <div className="mx-auto max-w-7xl">
                    {/* TABS NAVIGATION */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-10">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                                        isActive
                                            ? 'bg-[#008c46] text-white border-[#008c46] shadow-md scale-[1.02]'
                                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div
                                            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                                isActive ? 'bg-white/20 text-white' : 'bg-[#f0fdf4] text-[#008c46]'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <span
                                            className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {tab.badge}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className={`text-sm font-extrabold ${isActive ? 'text-white' : 'text-slate-900'}`}>
                                            {tab.label}
                                        </h3>
                                        <p
                                            className={`text-[0.7rem] mt-1 line-clamp-2 leading-relaxed ${
                                                isActive ? 'text-white/80' : 'text-slate-500'
                                            }`}
                                        >
                                            {tab.desc}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* TAB CONTENT CARDS */}
                    <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-10 shadow-sm">
                        {/* ========================================================================= TAB 1: GENERAL TERMS */}
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in duration-200">
                                <div className="border-b border-slate-100 pb-6 flex items-start justify-between gap-4">
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008c46] bg-[#f0fdf4] px-3 py-1 rounded-full border border-[#bbf7d0] mb-2">
                                            <Scale className="w-3.5 h-3.5" /> General Website &amp; Application Terms
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                                            General Terms &amp; Conditions
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Applicable to all users, visitors, retailers, and partner establishments on
                                            shahparpay.in and mobile applications.
                                        </p>
                                    </div>
                                    <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] items-center justify-center text-[#008c46]">
                                        <Scale className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8 bg-slate-50/70 p-6 rounded-2xl border border-slate-200">
                                    <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                                        <FileText className="w-5 h-5 text-[#008c46]" />
                                        <h3 className="text-lg font-extrabold text-slate-900">
                                            Complete Official Document Record (TERMS AND CONDITION.docx - All 93 Paragraphs)
                                        </h3>
                                    </div>
                                    <div className="space-y-4 max-h-[650px] overflow-y-auto pr-2 text-slate-800 font-mono text-xs sm:text-sm">
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">By accessing and using Shahparpay Solutions Private Limited, YOU accept and agree to the terms, conditions and rules without limitation and or qualification.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">We reserve the right to modify the terms at any time without giving YOU any prior notice. Your use of Shahparpay Solutions Private Limited following any such modification constitutes your agreement to follow and be bound by the terms as modified. Any additional terms and conditions, disclaimers, privacy policies and other policies applicable in general and/ or to specific areas of this website, shahparpay.in or to a particular service are also considered as terms.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Shahparpay Solutions Private Limited does not at any point of time during any transaction between the USER and partner/merchant/vendor and or service provider take the ownership of any of the products/services provided by the partner/merchant. Nor does shahparpay.in at any point asserts any rights or claims over the products/services offered by the partner/merchant to the USER. The cancellation/refund, if any, will be governed as per the terms and conditions of the aggregator or of the partner/merchant/vendor. shahparpay.in has no role in governing refund/cancellation charges shahparpay.in, will not be responsible for refund/cancellation including any charges arising therefrom.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In the event, YOU erroneously send a payment to a wrong party or have sent a payment for a wrong amount, shahparpay.in shall have no liability in this regard and your only recourse will be to contact such third party to whom such payment was sent and seek a refund (if any). shahparpay.in will not refund or reverse a payment erroneously made by YOU.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">All sales of prepaid recharge on the shahparpay.in platform is final with no refund or exchange permitted. YOU are responsible for the mobile number or DTH account number for which YOU purchased the prepaid recharge and all charges that result from those purchases. YOU are also responsible for the information relating to data card and similar recharge services and all charges that result from those purchases. shahparpay.in is not responsible for any purchase of prepaid recharge for an incorrect mobile number or DTH account number or incorrect data card information and or similar services.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">shahparpay.in disclaims any accountability, legal, losses/damages or else, that might arise because of the act, omission or otherwise of any USER on its website/mobile application or caused by the same. USER/YOU expressly admit that shahparpay.in is only a payment facilitator &amp; intermediary, and as such, stands indemnified from any accountability that might arise because of the same. YOU (USER) moreover acknowledge that visiting/using shahparpay.in website/mobile application is an implicit reception/confirmation of this disclaimer on your part.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">YOU are requested to go through the partner/merchant/vendor provided terms and conditions on their website and or platform. shahparpay.in is not responsible for your inability to access such terms and conditions or for any loss resulting from such terms and conditions or lack thereof. YOU agree and acknowledge that the actual contract for sale is directly between YOU and the partner/merchant/vendor. shahparpay.in does not control or prevent changes in the published details and descriptions of websites/apps operated by the aggregator or the partner/merchant/vendor and is not responsible for any content therein. shahparpay.in has no control over the existence, quality, safety or legality of items displayed; the accuracy of the aggregator’s content or listings; the ability of the aggregator and partner/merchant/vendor to sell items or provide services. shahparpay.in does not at any point of time during any transaction between YOU and aggregator/ partner/merchant/vendor, take the ownership of any of the listing, bookings or services offered by the aggregator/ partner/merchant/vendor. Nor does shahparpay.in at any point asserts any rights or claims over the same offered by the aggregator/partner/merchant/vendor to YOU. The aggregator or the partner/merchant/vendor is solely responsible for the content/listings/bookings made available by it through the shahparpay.in platform and YOU should contact the respective aggregator or partner/merchant/vendor directly. For more information, we request YOU to contact the vendor/partner/merchant/ service provider in order to get further clarifications and confirmation or the same can be confirmed on their websites as well.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">shahparpay.in is not a warrantor of the content/listings/bookings/services being offered on shahparpay.in by various aggregators or partner/merchant/vendors. YOU understand that any issue or disputes regarding the warranty, guarantee, quality, and service will be addressed as per the terms and conditions of the aggregator or the partner/merchant/vendors, and YOU agree to handle such issues and disputes directly between YOU and the aggregator or partner/merchant/vendor.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">shahparpay.in is not responsible for any warranty, guarantee, post-sale claims, genuineness of listings/bookings, content, products and services. shahparpay.in will not be liable for any claims including but not limited to any misrepresentation by the aggregator or the partner/merchant/vendor in its content/listings/bookings.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Notwithstanding anything contrary contained herein, the service, the interface and API work, and their respective information, pricing and data, and availability are subject at any time and from time to time to human, mechanical , typographic, or other errors, oversights, mistakes, limitations, delays, service interruptions, including, without limitation, as may be due in whole or in part to, related to or arising out of (i) computer hardware and software, telecommunication and operating systems, databases, or business processes and procedures, other problems inherent in, or which may be associated with, the use of the internet and electronic communications including, without limitation, force majeure event, government / regulatory actions, orders, notifications etc. And / or and acts and omissions of third parties etc.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Any amount transferred erroneously or for any reason by the USER shall not be refunded to the USER in any circumstances.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER understands and agrees that shahparpay.in is not a party to the contract between the USER and the partner/merchant establishment. shahparpay.in does not endorse any advertiser or partner/merchant linked to its website. Furthermore, shahparpay.in is under no obligation to monitor the partner/merchant establishment's service/products used by the USER. The partner/merchant establishment alone will be responsible for all obligations under the contract including (without limitation) warranties or guarantees. Any dispute with or complaint against any partner/merchant establishment must be directly resolved by the USER with the partner/merchant establishment. It is clarified that shahparpay.in shall not be responsible or liable for any deficiency in goods and/or services purchased using shahparpay.in wallet.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Any payment made erroneously by the USER to any partner/merchant establishment or any erroneous transfer to any person shall not be refunded to the USER by shahparpay.in in any circumstances.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Any web-link on the platform to a third-party site is not an endorsement of that web-link. By using or browsing any such other web-link, the USER shall be subject to the terms and conditions in relation to that web-link.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In the event of any dispute (defined below), shahparpay.in records shall be binding as the conclusive evidence of the transactions carried out through use of the wallet.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">shahparpay.in will not be responsible for recovering the money in case the account holder initiates fund transfer to an unintended or incorrect account.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">These following terms and conditions shall be applicable to the provision of any fund transfer and fund collection facility provided / facilitated by shahparpay.in. The USER shall provide correct beneficiary details to shahparpay.in at the time of availing the said facility. The USER shall be solely responsible for entering wrong beneficiary details like incorrect virtual payment address or incorrect mobile number or account no or IFSC code, due to which the fund is transferred to an incorrect beneficiary. The USER agrees that the payment order shall become irrevocable when it is executed by shahparpay.in.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER is responsible for the accuracy and authenticity of the instructions provided to shahparpay.in and the same, if is in the form and manner prescribed by shahparpay.in, shall be considered to be sufficient to operate the said facility. shahparpay.in shall not be required to independently verify the instructions. shahparpay.in has no liability if it does not or is unable to stop or prevent the implementation of any payment order issued by the USER. Once a payment order is issued by the USER the same cannot be subsequently revoked by the USER.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">All instructions, requests, directives, orders, directions, entered by the USER, are based upon the USER’s decisions and are the sole responsibility of the USER. Refunds (if any) will be credited to your shahparpay.in wallet account.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Grievance Policy</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Preamble</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">SHAHPARPAY. (the Company) is engaged in the following business segment</p>
<h4 className="text-sm font-extrabold text-slate-900 mt-4 border-b border-slate-200 pb-1">SEGMENT A:</h4>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Semi-Closed prepaid Wallet business: Issuance of multipurpose prepaid shahparpay.in Wallet as a payment option alternative to cash for large segment of population in the country that is unable to use e-payment / m-payment facility since they do not have debit/credit cards.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">(Semi-Closed prepaid shahparpay.in Wallet business is governed by the PSS Act and the RBI Guidelines).</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company offers safe and easy payment option to every customer for seamless transactions. The Company has introduced multi-purpose prepaid shahparpay.in Wallet (known as "shahparpay.in eWallet") which can be used to purchase various goods and services Online/On-mobile/IVRS from affiliated merchants based on "anywhere-anytime" concept which would result in increased sales for all affiliated merchants and safety and convenience for the customer. The Company is helping business organizations to expand markets by supporting sales channels convergence with its payment’s options.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">As a service provider in the industry, customer service and customer satisfaction are the prime concerns of the company, and the object of this policy is to minimise instances of customer complaints through proper service delivery and review mechanisms and prompt redressal of various types of customer grievances.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Reserve Bank of India (RBI) has authorised the company to operate a payment system in its semi-closed prepaid shahparpay.in wallet business. It is governed by the Payment and Settlement Systems Act, 2007 ("the PSS Act"), Regulations made under it, and the Issuance and Operation of Prepaid Payment Instruments in India (Reserve Bank) Directions, 2009 ("the RBI Guidelines") laid down by the RBI.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">As required under Clause 12.2 of the said RBI Guidelines, the company has developed a procedure for promptly attending to the grievances of the customers in respect of various issues pertaining to shahparpay.in Wallet as an online payment mode. This is done by setting up an internal two-tier system in the form of "customer support" and a grievance redressal mechanism in the form of a "customers grievance redressal committee," as hereinafter provided.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">This policy is called the "Customer Grievance Redressal Policy.".It shall apply to the business of the company in India.It shall come into force on the 1st day of December, 2013.It shall apply only to semi-closed prepaid shahparpay.in wallet businesses, as mentioned under point 3 above.It is available on the website of the company: https://www.shahparpay.in.</p>
<h4 className="text-sm font-extrabold text-slate-900 mt-4 border-b border-slate-200 pb-1">Section 1 - Definitions</h4>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">'Company' shall mean Shahparpay Solutions Private Limited, which is carrying on the business of issuance of Prepaid Payment Instruments, payment processing, payment collection, and related services by facilitating payment solutions to the customer for buying goods and services through any digital or electronic medium.'Complainant' shall mean the customer who has a grievance.'Customer' shall mean the holder and/or user of shahparpay.in Wallet and/or any of the system participants of the company.'Grievance' shall mean communication in any form by a customer that expresses dissatisfaction about an action or lack of action by, or about the standard of service of the company and/or its representative, in relation to use of shahparpay.in Wallet.'shahparpay.in Wallet' shall mean the activated and valid semi-closed prepaid wallet and all variants of the same issued by the company.'Payment System' means a system that enables payment to be effected between a payer and a beneficiary involving clearing, payment, settlement service, or all of them, but the Customer Grievance Redressal Policy does not include a stock exchange.'Redressal' shall mean the final disposal of the grievance of the complainant by the company.'System Participant' shall mean Bank or any other person participating in a payment system and includes the system provider as per the PSS Act.'System Provider' shall mean a person who operates and authorises payment systems.'Week' shall mean consecutive seven working days.'Working Day' shall mean any day (other than Sunday &amp; Public Holiday) on which the Company's Corporate Office is open for business. Section 2 - Principles Governing Company's policy</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company's policy on grievance redressal is governed by the following principles: Customer shall be treated fairly at all times.Complaints raised by customers shall be attended with courtesy and in time.The Company's Officer-in-Charge of Customer Support must work in good faith keeping in mind this policy of the Company.</p>
<h4 className="text-sm font-extrabold text-slate-900 mt-4 border-b border-slate-200 pb-1">Section 2: Principles Governing the Company's Policy</h4>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The company's policy on grievance redressal is governed by the following principles: customers shall be treated fairly at all times.Complaints raised by customers shall be attended to with courtesy and on time.Customers shall be fully informed of avenues for grievance redressal within the organisation and their right to approach the Customer Grievance Redressal Committee in case they are not fully satisfied with the response of Customer Support.The company's officer-in-charge of customer support must work in good faith, keeping in mind this policy of the company</p>
<h4 className="text-sm font-extrabold text-slate-900 mt-4 border-b border-slate-200 pb-1">Section 3: Process to Handle Customer Grievances</h4>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Grievances by the holder and/or user of shahparpay.in Wallet:3.1 Two-Tier Grievance Redressal SystemThe company has established customer grievance redressal machinery functioning at two levels:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Legal</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Shahparpay Solutions Private Limited is involved in activities such as Information service activities Ministry of Electronics &amp; Information Technology Government of India.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Partner/Retailer PolicyOnce the partner/retailer ID is created, the retailer cannot delete or suspend that ID. The company has full rights to all of these. If the company feels that deleting or suspending the person's ID is correct, then the company can follow this process. If the partner or retailer completes his KYC, then the right is completely taken away from the partner or retailer to get his ID deleted or terminated. The reason for all this is common: all the wrong and right actions done by the partner/retailer are completely deleted. If the company feels that there is nothing wrong or cyber fraud-like activity by the person, the company can remove the existing ID after 1-2 years. It is applicable only if the person has not done any work or logged in for 90 days.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Banking Ombudsman SchemeIf you are not satisfied with the redressal of the complaint provided by shahparpay.in or if you have not received a response from shaparpay.in within one month, i.e., 30 days of logging a complaint with us, you may approach the Reserve Bank of India, Office of Banking Ombudsman, for Grievance Redressal. The complaint can be made to the Office of Banking Ombudsman with the complete transaction and other requisite details. (The 30-day period will be reckoned after all the necessary information sought from the customer is received.) You may refer to https://www.rbi.org.in/Scripts/bs_viewcontent.aspx?Id=3631. for details about this scheme</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Function and Authority</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The functions of the committee are as follows:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">a. The committee will address the grievance of the customer if he or she is not satisfied with the decision of customer support.b. The Committee will be responsible for ensuring the timely and effective implementation of all regulatory requirements regarding customer service.c. The committee shall have the right to ask for all records from customer support and the customer.d. The Committee will look into the simplification of procedures and practices prevailing in the company with a view to safeguarding the interests of customers of the company.e. The Committee will review the regulations and procedures prescribed by RBI for customer service and determine whether they are adopted in spirit and intent by the company and make suitable recommendations for rationalisation of the same.f. The Committee will review the practices and procedures prevalent in the prepaid payment solutions industry and take necessary corrective action on an ongoing basis.g. The committee will endeavour to proactively advise customer support on pending complaints.Grievance Redressal Procedurea. A grievance may be communicated by the complainant to the committee as per the convenience of the complainant in physical or electronic mode in the form provided in Schedule 'A' hereto to ShahparPay Solutions Helpdesk.b. Upon receipt of a grievance, the concerned officer shall enter the details thereof in the Grievance Redressal Register.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">c. All grievances received shall be acknowledged within three working days from the receipt of the grievance by the Committee.d. The Committee shall resolve every grievance within 21 working days from the date of receipt of the grievance.Final Redressal and Closure of Grievance.Grievance shall be treated as finally redressed and closed in any of the following circumstances:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Where the complainant has communicated his acceptance of the company's decision on redressal of grievance communicated by customer supportorb. Where the complainant has not communicated his acceptance of the company's decision within one (1) month from the date of communication of the decision by customer support or the committee, as the case may be.Implementation of the decisionThe management shall take all necessary steps to implement the decision of the committee.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Grievances by a person other than the holder and/or user of shahparpay.in Wallet (System Participant):</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Grievances between system participants in respect of any matter connected with the operation of the payment system shall be resolved in accordance with the relevant provisions of the Payment and Settlement Systems Act, 2007, as may be amended from time to time.</p>
<h4 className="text-sm font-extrabold text-slate-900 mt-4 border-b border-slate-200 pb-1">Schedule 'A':</h4>
<h4 className="text-sm font-extrabold text-slate-900 mt-4 border-b border-slate-200 pb-1">APPLICATION TO COMPANY BY CUSTOMER FOR REDRESSAL OF GRIEVANCE</h4>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">(All fields are mandatory)</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">NAME OF THE CUSTOMERFULL ADDRESS OF THE CUSTOMER ( With Email Id and Mobile N0 )shahparpay.in Wallet IDDETAILS OF THE GRIEVANCE,(If space is not sufficient, please enclose separate sheet)DATE OF ORIGINAL INTIMATION OF GRIEVANCE BY THE CUSTOMER TO THE CUSTOMER SUPPORTREMEDY PROVIDED BY THE CUSTOMER SUPPORT, IF ANY(If remedy has been provided, please enclose relevant communication from the Customer Care Centre)LIST OF DOCUMENTS ENCLOSED(Please enclose copies of any relevant documents which support the facts giving rise to the Grievance)</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">DECLARATIONI/ We, the customer/s herein declare that:the information furnished hereinabove is true and correct; andI/ We have not concealed or misrepresented any fact stated hereinabove and the documents submitted herewith.The present Grievance has been intimated to Committee in the prescribed form and manner prescribed by the Company and I/We am/are not satisfied by the remedy provided by the Customer SupportORno remedy was provided within a period of (__) days/weeks/months from the date of original intimation.The subject matter of the present Grievance has never been submitted to the Company by me or by any one of us or by any of the parties concerned with the subject matter to the best of my/our knowledge.The subject matter of my/our Grievance has not been settled by the Company/ Customer Support in any previous proceedings.The subject matter of my/our Grievance has not been decided by any competent authority/court/arbitrator and is not pending before any such authority/court/arbitrator.Yours faithfully</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">(Signature)(Customer's name in block letter)</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">To Block and Report Unauthorized Transaction on your shahparpay.in Wallet Account</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Report via shahparpay.in Website or App</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">To report Fraud on your shahparpay.in account please keep the transaction details (Order Id, Amount, Date and Time) handy for quick assistance.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Customer Protection – Limiting Liability of Customers in Unauthorised Electronic Payment Transactions in Prepaid Payment Instruments (PPIs) issued by Authorised Non-banks</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">https://www.rbi.org.in/scripts/BS_CircularIndexDisplay.aspx?Id=11446</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Customer Liability in the event of unauthorized Payment Transaction In accordance and subject to RBI guidelines and directions made available at https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11446&amp;Mode=0, a customer’s liability arising out of an unauthorized payment transaction will be limited to:Customer liability in case of unauthorized electronic payment transactions through a PPI</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">S. No. Particulars Maximum liability for customers.(a) Contributory fraud, negligence, or deficiency on the part of the PPI issuer, including the PPI-MTS issuer (irrespective of whether or not the transaction is reported by the customer) Zero(b) third-party breach where the deficiency lies neither with the PPI issuer nor with the customer but lies elsewhere in the system, and the customer notifies the PPI issuer regarding the unauthorised payment transaction. The per-transaction customer liability in such cases will depend on the number of days lapsed between the receipt of transaction communication by the customer from the PPI issuer and the reporting of an unauthorised transaction by the customer to the PPI issuer. i. Within three days, zeroii. Within four to seven days, the transaction value or ₹ 10,000 per transaction, whichever is loweriii. Beyond seven days, as per the board-approved policy of the PPI issuer(c) In cases where the loss is due to negligence by a customer, such as where he or she has shared the payment credentials, the customer will bear the entire loss until he or she reports the unauthorised transaction to the PPI issuer. Any loss occurring after the reporting of the unauthorised transaction shall be borne by the PPI issuer.(d) PPI issuers may also, at their discretion, decide to waive off any customer liability in cases of unauthorised electronic payment transactions, even in cases of customer negligence.# The number of days mentioned above shall be counted, excluding the date of receiving the communication from the PPI issuer.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">We at One Shahparpay Solutions Pvt. Ltd. caution the members of the public and our users not to fall prey to fictitious offers or unsolicited phone calls or emails asking for financial information or any other type of personal information. It has been observed that fraudsters have resorted to defrauding the susceptible public by convincing them over a phone call to divulge details of their debit or credit card or their bank account information in order to commit cybercrimes. Recipients of such communication fall prey to frauds or scams perpetrated by individuals who impersonate themselves as employees of various financial institutions and end up compromising their confidential information, which is later used by such fraudsters on e-commerce and m-commerce platforms. We assure you that shahparpay.in will never ask for the details of your account, PIN, password, full debit, credit card number, expiration date, OTP, CVV, confidential bank account details, or any other security or personnel information.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In case you fall prey to such a fraud or scam, kindly use the link provided to you by us, write to us at aepspe.com@gmail.com, or follow our grievance policy in order to report the same to avoid further loss.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Shahparpay Solutions Private Limited has implemented a highly secured environment in order to avoid and check fraudulent transactions; however, it is important for customers to ensure that they exercise caution and refrain from compromising sensitive and personal information.</p>
<h4 className="text-sm font-extrabold text-slate-900 mt-4 border-b border-slate-200 pb-1">PRODUCT / SERVICE &amp; SERVICE CHARGES</h4>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">---------------------------------------------------------------------</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">01: You get PAN card services on the existing portal, through which you can submit a new application for a PAN card (NSDL), If you are a partner or retailer, then this service is provided to you free of charge. Actual cost of activation is Rs. 500/-+gst.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">02: On the existing portal, you get Aadhaar Enabled Payment (AEPS) service, through which you can withdraw money from your account and give it to your customer through fingerprint verification from the Aadhaar number of any Indian citizen with your ID. If you are a partner or retailer, then this service is provided to you free of cost. Actual cost of activation is Rs. 500/-+gst.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">03: On the existing portal, you get the Aadhaar Enabled Payment (AEPS) Cash Deposit Service through your customer's fingerprint verification self-account. If you are a partner or retailer, then this service is provided to you free of charge. Actual cost of activation is Rs. 500/-+gst. *NOT LIVE YET</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">04: On the existing portal, you get MICRO ATM service, through which you can withdraw money from your customer through DEBIT CARD (ATM). If you are a partner or retailer, then this service is provided to you free of cost. Actual cost of activation is Rs. 500/-+gst</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">05: On the existing portal, you get domestic money transfer service on the existing portal, through which you can transfer money from your ID to any Indian citizen's account, if you are a partner /retailer, then this service is provided to you free of cost. Actual cost of activation is Rs. 500/-+gst.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">06: On the existing portal, you get courier services facilities on the portal fully free. Actual cost of activation is Rs. 500/-+gst. * Live very soon</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">07: On the existing portal, you get Zero Balance - Airtel Payments Bank AND Kotak 811 (Rs. 25,00 Funding) services both Digital Saving and Current Account facilities. This service is provided free of cost. Actual cost of activation is Rs. 1000/-+gst.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">08 : You get Bharat Bill Payment services on Current portal, through which you can provide mobile recharge and BBPS related services, if you are a partner /retailer then this service is provided to you free of cost.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">09: Partner/merchant onboarding and complete its full KYC with account verification charge of Rs. 10/- only.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">10. On the existing portal, you get Generation Lead of Personal Loan, Instant Loan, Business Loan facilities. This service is provided free of cost. Actual cost of activation is Rs. 1000/-+</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">11. On the existing portal, you get Bajaj Credit Card, Credit Card Life Time Free apply facilities. This service is provided free of cost. Actual cost of activation is Rs. 1000/-+</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">12. On the existing portal, you get ITR Services Like ITR Registration, ITR Filing, GST Registration, GST Filing, PF, ESI, FSSAI, IEC Registration and eWay Bill Registration facilities. This service is provided free of cost. Actual cost of activation is Rs. 5000/-+ * same are live rest live very soon</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Check the existing link for product and service changes and other information: https://shahparpay.in/</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">JURISDICTION ACTIVITIES &amp; PROCESSES---------------------------------------------------------------------</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In any event of dispute, the area of ​​jurisdiction shall be Kolkata. If the customer and other person has any problem with the website, then he has to choose Kolkata High Court. Apart from this, first the company has to be told where the company is making a mistake. After that the company will take the time to correct the mistake. The person can take recourse to the law only after the expiry of the given time limit of the company. In this, if the person takes recourse to the law without the knowledge of the company for any reason, then such process will be counted in the activities like fraud / loss to the company by the customer or other person.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">You may face legal action for uploading wrong documents, as it can be a major act of harming national security.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Partner/Retailer Support</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company has a Partner/Retailer Support facility (09.00 Hrs to 22.00 Hrs Monday to Saturday) for effective resolution for operational issues and all the grievances referred to it.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">For quick reference, the contact details are provided herein below:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">- Partner/Retailer Support:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">- mail id: shahparpay@gmail.com</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">- Support Care Number - +91 8240039776</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">-(Monday to Saturday 9:00 AM to 10.00 PM)</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Sunday only WhatsApp Service WhatsApp No. 8240039776</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">If any transactions failed due to server errors or other reasons, then send a complaint to the support email ID.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">To Block and Report Unauthorized Transaction on your shahparpay.in Wallet Account</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Report via Call: +91 8240039776</p>
                                    </div>
                                </div>

                                <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                        <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                                            <BookOpen className="w-4 h-4 text-[#008c46]" /> Preamble &amp; Acceptance
                                        </h3>
                                        <p>
                                            By accessing and using Shahparpay Solutions Private Limited (including{' '}
                                            <a href="https://shahparpay.in" className="text-[#008c46] font-semibold underline">
                                                shahparpay.in
                                            </a>
                                            , its sub-domains, and mobile applications), YOU accept and agree to the terms,
                                            conditions and rules contained herein without limitation or qualification. We reserve
                                            the right to modify these terms at any time without prior notice. Your continued use of
                                            Shahparpay Solutions Private Limited following any modification constitutes your
                                            agreement to follow and be bound by the terms as modified.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            1. Intermediary Status &amp; Disclaimer of Liability
                                        </h3>
                                        <p>
                                            Shahparpay Solutions Private Limited acts strictly as an electronic payment facilitator
                                            and intermediary platform. Shahparpay does not at any point of time take ownership of any
                                            products or services offered by third-party partner merchants, aggregators, banks, or
                                            biller establishments.
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2">
                                            <li>
                                                <strong>No Warranty on Third-Party Products:</strong> Shahparpay is not a warrantor of
                                                services, travel bookings, bill pay aggregators, or product quality offered by third
                                                parties. Disputes regarding warranties, guarantees, or service quality must be handled
                                                directly between YOU and the aggregator/merchant.
                                            </li>
                                            <li>
                                                <strong>Sales Finality:</strong> All sales of prepaid mobile, DTH, and data recharges on
                                                the shahparpay.in platform are final with no refund or exchange permitted once processed
                                                successfully. YOU are solely responsible for ensuring correct mobile numbers, DTH subscriber
                                                IDs, and bill account details.
                                            </li>
                                            <li>
                                                <strong>Erroneous Transfers:</strong> In the event YOU erroneously send a payment or fund
                                                transfer to a wrong party or incorrect bank account/VPA/IFSC, Shahparpay shall have no
                                                liability to reverse or refund the funds. Your only recourse is to contact the recipient.
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            2. Fund Transfer &amp; Collection Facility Terms
                                        </h3>
                                        <p>
                                            The following terms apply to Domestic Money Transfers (DMT), Payouts, and UPI QR collections
                                            facilitated via Shahparpay:
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3">
                                            <div className="p-4 rounded-xl border border-slate-200 bg-white">
                                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[#008c46]">
                                                    Accuracy of Instructions
                                                </h4>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    The USER is solely responsible for entering exact beneficiary details (Account Number,
                                                    IFSC Code, VPA, Mobile Number). Payment orders become irrevocable once executed.
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-xl border border-slate-200 bg-white">
                                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[#008c46]">
                                                    Verification &amp; Records
                                                </h4>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    Shahparpay is not required to independently verify beneficiary details. Shahparpay digital
                                                    ledger records shall be binding as conclusive evidence of transactions.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            3. Platform Security &amp; Limitation of System Errors
                                        </h3>
                                        <p>
                                            Shahparpay implements bank-grade 256-bit encryption and security safeguards. However, platform
                                            availability and API performance remain subject to telecommunication network stability, banking
                                            host uptime, maintenance schedules, and third-party NPCI switch availability. Shahparpay is not
                                            liable for indirect or consequential damages arising from temporary service interruptions or
                                            force majeure events.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            4. Jurisdiction &amp; Legal Dispute Resolution
                                        </h3>
                                        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                                            <div className="flex items-center gap-2 font-bold text-amber-900 mb-2">
                                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                                Jurisdiction Notice (Kolkata High Court)
                                            </div>
                                            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                                                In any event of dispute or legal claim against Shahparpay Solutions Private Limited, the
                                                sole area of jurisdiction shall be <strong>Kolkata</strong>. Any legal proceedings must be
                                                filed in the <strong>Kolkata High Court</strong>. Before resorting to legal recourse, the user
                                                must submit a formal written notice to Shahparpay detailing the issue and allow a mandatory
                                                30-day resolution window for company review. Initiating legal proceedings without prior formal
                                                written notice may be classified as malicious activity causing damages to the company.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= TAB 2: RETAILER AGREEMENT */}
                        {activeTab === 'retailer' && (
                            <div className="space-y-8 animate-in fade-in duration-200">
                                <div className="border-b border-slate-100 pb-6 flex items-start justify-between gap-4">
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008c46] bg-[#f0fdf4] px-3 py-1 rounded-full border border-[#bbf7d0] mb-2">
                                            <FileText className="w-3.5 h-3.5" /> B2B Partner &amp; Retailer License
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                                            Shahparpay Retailer Master Agreement
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Terms governing Retailers, Distributors, and Master Distributors operating on the Shahparpay B2B platform.
                                        </p>
                                    </div>
                                    <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] items-center justify-center text-[#008c46]">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                            <div className="font-extrabold text-slate-900 text-sm mb-1">Eligibility Criteria</div>
                                            <p className="text-xs text-slate-500">
                                                Must be 18+ years of age, legally competent, and possess valid PAN, Aadhaar, and shop physical location proof.
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                            <div className="font-extrabold text-slate-900 text-sm mb-1">Wallet Trading Balance</div>
                                            <p className="text-xs text-slate-500">
                                                Retailers must maintain sufficient wallet balance through authorized distributors or direct bank fund requests.
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                            <div className="font-extrabold text-slate-900 text-sm mb-1">Termination Notice</div>
                                            <p className="text-xs text-slate-500">
                                                Agreement may be terminated by Retailer via 60 days written notice, or instantly by Company on misuse/fraud.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-4 pt-4 border-t border-slate-200 mb-6">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3 mb-2">
                                            Complete Official User Agreement Document (All 235 Paragraphs)
                                        </h3>
                                        <div className="space-y-4 max-h-[650px] overflow-y-auto pr-2 border border-slate-200 p-6 rounded-2xl bg-slate-50/70 text-slate-800 font-mono text-xs sm:text-sm">
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">USER AGREEMENT</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">IMPORTANT: THIS USER AGREEMENT (HEREINAFTER REFERRED TO AS “AGREEMENT”) IS A LEGAL AGREEMENT BETWEEN YOU (EITHER AN INDIVIDUAL OR, IF PURCHASED OR OTHERWISE ACQUIRED BY OR FOR AN ENTITY, AN ENTITY) (HEREINAFTER REFERRED TO AS “USER") AND SHAPARPAY SOLUTIONS PRIVATE.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">THIS AGREEMENT IS AN ELECTRONIC RECORD IN TERMS OF INFORMATION TECHNOLOGY ACT, 2000 AND RULES THEREUNDER AS APPLICABLE AND THE AMENDED PROVISIONS PERTAINING TO ELECTRONIC RECORD/DOCUMENT IN VARIOUS STATUTES AS AMENDED BY THE INFORMATION TECHNOLOGY ACT, 2000. THIS IS A COMPUTER-GENERATED ELECTRONIC RECORD AND DOES NOT REQUIRE ANY PHYSICAL OR DIGITAL SIGNATURE.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">PLEASE READ THE TERMS AND CONDITIONS OF THIS AGREEMENT CAREFULLY BEFORE COMPLETING THE LOGIN, PROCESS AND USING THE WEBSITE AND/OR APPLICATIONS. THE USE OF THIS WEBSITE AND/OR APPLICATION AND THE CONTENT CONTAINED THEREIN IS GOVERNED BY THE FOLLOWING TERMS OF USE. WHEN YOU USE THIS PLATFORM, YOU ACKNOWLEDGE THAT YOU HAVE READ THE TERMS OF USE AND THAT YOU ACCEPT AND WILL BE BOUND BY THE TERMS AND CONDITIONS HEREOF. IF YOU DO NOT AGREE TO OR WISH TO BE BOUND BY THE TERMS OF USE, YOU MAY NOT ACCESS OR OTHERWISE USE THE WEB SITE. THESE TERMS MAY BE MODIFIED FROM TIME TO TIME WITHOUT NOTICE TO YOU BY POSTING REVISED TERMS ON OUR PLATFORM. IN ORDER TO USE THIS WEBSITE AND/OR APPLICATION, YOU MUST FIRST READ AND ACCEPT THE TERMS OF USE.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In order to use Website and/or applications, you must first read and accept the terms of this license.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">WHEREAS:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company is in the business of electronic transaction processing and online transactions of various services like Money Transfer, AEPS, Cash Withdrawal, Balance Inquiry, Mini Statement, Aadhaar Pay, AEPS Cash Deposit, Account Opening (IndusInd Bank), and Courier Services. (In future we are added recharge (mobile network, DTH, Digital Wallet Top ups), bill payments, cash management service (cash point), E-shopping, IRCTC) and other related business on real time basis through its network under B2B Model across the Republic of India (hereinafter referred to as ‘Services’) and owns a software which is a flexible and secure solution for payments, cash collections, validation and settlements (hereinafter referred to as ‘Software’).</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER is desired to offer the above-mentioned Services to the Customer from its locations situated within the Territory and desired to uses the Shahparpay Solutions Private Limited application which is operational on Desktops, Laptops and Mobile phones vide Android, Windows, iOS &amp; Java platforms.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company has developed its official website and/or application (Android and/or IOS) namely shahparpay.in and its subsites (hereinafter referred to as ‘Platform’) which has the features or offers to operate the business of Shahparpay Solutions Private Limited.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER has approached the Company and requested the Company to provide Service to the USER intending to purchase or inquiring for any products and/ or services of the Company by using Company's Platform or using any other customer interface channels of Company which includes its advertisements, information campaigns etc. to permit them to use of the Platform.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company has accepted the offer of USER and wishes to have a business relationship as subject to the following terms and conditions.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">USER and Company/ Shahparpay Solutions Private Limited shall jointly be referred to as “Parties” and individually as the “Party” as per the context.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">NOW THEREFORE IN CONSIDERATION OF THE PREMISE AND THE MUTUAL RIGHTS AND OBLIGATIONS HEREIN SET FORTH, THE PARTIES HERETO AGREE AS FOLLOWS:</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">DEFINITIONS:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Unless the contrary intention appears:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">“Applicable Laws” shall mean all laws of Republic of India, including ordinance, statutes, rules, orders, decrees, injunctions, licenses, permits, approvals, authorisations, consents, waivers, privileges, agreements and regulations of any governmental authority having jurisdiction over the relevant matter as such are in effect as of the Effective Date or as may be amended, modified, enacted or revoked from time to time in future;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Authorization" includes an authorization, consent, clearance, approval, permission, resolution, license, exemption, filing and registration;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">“Confidential Information” means any and all information in whatever form whether disclosed orally or in writing or whether eye readable, machine readable or in any other form including, without limitation, the form, materials and design of any relevant equipment or any part thereof, the methods of operation and the various applications thereof, processes, formulae, plans, strategies, data, know how, designs, photographs, drawings, specifications, technical literature and any other material made available by one Party to the other Party or gained by the visit by one Party to any establishment of the other Party whether before or after this Agreement is entered into, for the purpose of considering, advising in relation to or furthering the negotiations (and any information derived from such information).</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Content" means the text, documents, information, data, articles, images, photographs, graphics, software, applications, video recordings, audio recordings, sounds, designs, features, and other materials that are available on the Platform;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">“Customer” shall mean any person availing Services from the USER registered on the Platform;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">“Business Partner” shall mean the person/entity authorised by the Company to appoint the Marchant for the purposes of this Agreement.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">“Encumbrance” includes Any mortgage, charge (whether fixed or floating), pledge, equitable interest, lien, hypothecation, assignment, deed of trust, title retention, security interest, encumbrance of any kind securing or conferring any priority of payment in respect of any obligation of any Person, including any right granted by a transaction which, in legal terms is not the granting of security but which has an economic or financial effect similar to the granting of security under Applicable Law;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Any proxy, power of attorney, voting trust, contract, interest, option, right of other Persons, right of set off, right of first offer, refusal or transfer restriction in favour of any Person;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Any adverse claim as to title, possession or use, conditional sale contract, co-sale contract, trust (or other title exception of whatsoever nature);</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Other commitment, restriction, limitation or encumbrance of any kind or nature whatsoever including restriction on use, voting rights, transfer, receipt of income or exercise of any other attribute of ownership; and</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">A contract, whether conditional or otherwise, to give or refrain from giving any of the foregoing.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">“Intellectual Property Rights” means, without limitation, Content, Software, trademarks, service marks, trade names, word marks, registered and unregistered design rights, copyrights (including rights in computer software), database rights and all other similar rights, title and interest which may subsist in any part of the world now or in the future (including know-how constituting a trade secret) under any statute or under common law and where such rights are obtained or enhanced by registration together with any extensions or renewals, any registration of such rights and applications and rights to apply for such registrations;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Member" means an individual who has registered with the Platform and have created a Member ID and a password on the Platform;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Member ID" means the unique IDUSER uses (with password) to login to the Platform;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Person" includes an individual, statutory corporation, body corporate, partnership, joint venture, association of persons, Hindu Undivided Family (HUF), societies (including co-operative societies), trust, unincorporated organization, government (central, state or otherwise), sovereign state, or any agency, department, authority or political subdivision thereof, international organization, agency or authority (in each case, whether or not having separate legal personality) and shall include their respective successors and assigns and in case of an individual shall include his legal representatives, administrators, executors and heirs and in case of a trust shall include the trustee or the trustees for the time being;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Platform" means the shahparpay.in website and/or applications, and their respective subsites, computer or mobile running applications (Android and/or IOS) together with the respective Content, Intellectual Property Rights of Shahparpay Solutions Private Limited, Products and Services available from these sites/ subsites or applications;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Products and Services" means the services and products offered by the Shahparpay Solutions Private Limited (as specified in Recital A) under B2B model through the Platform;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Provider" means the ultimate suppliers, information providers, and other service providers whose product/services are being offered by the Shahparpay Solutions Private Limited;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Purchase" means to book, reserve, or purchase. The terms "Platform", "Intellectual Property Rights", "Content" and "Products and Services" do not include the sites, marks, content, products or services that are provided by third parties, and that are available through a link from the Platform. Their use is subject to the terms set forth by their respective owners or operations, on the third party's website and/or application;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Territory" shall mean the territory as selected by the User while registering on the Company's Platform;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">"Trading Balance" shall mean the amount to be deposited by User in advance with the Company's bank account as designated by the Company from time to time for the purpose of day-to-day trade and fulfilling its obligations as specified herein under this Agreement.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">INTERPRETATION</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The words “include” or “including” shall be construed without limitation;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">a gender shall include references to the female, male and neuter genders;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">a "month" is a reference to a period starting on one day in a calendar month and ending on the date immediately before the numerically corresponding day in the next calendar month, except that if there is no numerically corresponding day in the month in which that period ends, that period shall end on the last day in that calendar month;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The singular includes the plural (and vice versa);</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">SCOPE OF THE AGREEMENT:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company agrees to permit the User to register its details in the Company’s Platform. The USER shall choose a password and shall be solely responsible to maintain the confidentiality of its password and account. The USER is fully responsible for all activities that occur while using their password or account. It is the duty of the USER to notify the Company immediately of any unauthorized use of their password or account or any other breach of security. The Company shall not be liable for any loss that may be incurred by the USER as a result of unauthorized use of their password or account, either with or without their knowledge.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Additionally, the Company itself may provide terms and guidelines that govern particular features, offers or the operating rules and policies applicable to each Product or Service of the Company. The User shall be responsible for ensuring compliance with the terms and guidelines or operating rules and policies of the Provider with whom the USER elects to deal, including terms and conditions set forth in a Providers' fare rules, contract of carriage or other rules.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees that they shall not distribute exchange, modify, sell or transmit anything from the Company’s Platform, including but not limited to any text, images, audio and video, for any business, commercial or public purpose.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company reserves the right, in its sole discretion, to terminate the access to any or all Company’s Platform or its other sales channels and the related services or any portion thereof at any time, without notice, for general maintenance or any reason what so ever.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It is agreed between the Parties that, as long as the USER comply with the terms of this Agreement, the Company agrees to provide a non–exclusive, non–transferable, limited right to enter, view and use its Platform to the USER. The USER agrees not to interrupt or attempt to interrupt the operation of the Platform in any manner.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Access to certain areas of the Company’s Platform may only be available to registered Members. To become a registered Member, the USER shall be required to answer certain questions at the request of the Company. Answers to such questions may be mandatory and/or optional. The USER represents and warrants that all information provided to the Company whether while answering such questions or otherwise are true and accurate.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Some or all Products and Services displayed on the Platform may not be available for purchase in particular country or locality of the USER. The reference to such products and services on the Platform does not imply or warrant that these products or services shall be available at any time in particular geographical location. The USER shall check with Company’s local authorized representative for the availability of specific Products and Services in the USER area.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In addition to this Agreement, there are certain terms of service specific to the Services rendered/ products provided by the Company, such terms of service shall be provided/ updated by the Company from time to time which shall be deemed to be a part of this Agreement and in the event of a conflict between such terms of service and this Agreement, the terms of this Agreement shall prevail.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company’s Services are offered to the USER subject to its acceptance without modification of all the terms, conditions and notices contained in this Agreement and the terms of service, as may be applicable from time to time. For the removal of doubts, it is clarified that availing of the Services by the User constitutes an acknowledgement and acceptance by the USER of this Agreement and the terms of service. If the USER does not agree with any part of such terms, conditions and notices, the User must not avail the Company’s Services.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">TERMS OF ELIGIBILITYFOR PLATFORM USER(S):</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">USERS mean any person who uses and has the right to use the Services provided by Shahparpay Solutions Private Limited on the Platform.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Services are available to those persons who can form legally binding contracts under the Applicable Laws. Therefore, USER should not be a minor or otherwise incompetent as per Applicable Laws; i.e. USER must have completed the age of 18 years of age to be eligible to use Services.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">USER shall; while accessing the Platform, they must follow/abide by the Applicable Laws. Shahparpay Solutions Private Limited is not responsible for the possible consequences caused by your act/behaviour during the use of Platform. Shahparpay Solutions Private Limited may, in its sole discretion, refuse the Service to anyone at any time without assigning any reason.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">TERM AND TERMINATION:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">This Agreement shall take effect and become binding upon the Parties immediately after the User has signed up and created an account on the Platform and remain in force until it is terminated by either of the Parties in accordance with the terms of the Agreement.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">This Agreement may be terminated by Company immediately without any reason thereof, if the USER misuses the Platform or fails to comply with the terms and conditions of this Agreement.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">This Agreement may be terminated by USER by serving 60 days written notice in advance by his/her registered mobile number and/or email id either to the Company or through Distributor to the Company, if applicable.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Upon termination of this Agreement for whatever reason, all the rights and obligations of the Parties hereunder shall cease.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">USER’S RESPONSIBILITY OF CONGNIZANCE OF THIS AGREEMENT:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees that if the USER downloads any Content from Platform, the USER will not remove any Intellectual Property notices or other notices that go with it.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company agrees to make every effort to ensure that the description and content on each page of the Platform is correct, it does not, however, take responsibility for changes that may occur due to human/ data entry errors or for any loss or damages suffered by any USER due to any information contained therein. Also, the Company does not own or operate the services of service Provider and cannot therefore control or prevent changes in the published descriptions. The Company reserves the right to make changes therein from time to time.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall ensure that sufficient Trading Balance is maintained by the USER and the same can be taken/maintained through their, authorized Distributor or Sub-Distributor or Business Partner or directly from Shahparpay Solutions Private Limited.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER should not take any action based on information on the Platform until it receives a confirmation of such transaction. If the USER does not receive a confirmation of the purchase on Platform via e-mail or SMS, (check in "spam" or "junk" folder to verify that it has not been misdirected), and if still not found, USER shall contact customer service department of the Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company agrees to take all measures to exclude viruses from the Platform but does not ensure that the Platform will be at all times free from viruses or other destructive software(S). The USER shall take appropriate safeguards before downloading information from the Platform. The Company shall not be responsible for any loss/damages to computer equipment or other property resulting from the use of the Platform or due to any downloads from the Platform.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees and acknowledges that the Company’s Platform may contain links to other website and/or applications. The said other website and/or applications are not under the control of the Company and hence, the Company is not responsible for the content of any other website and/or applications, or any changes and updates to other website and/or applications. The Company is providing these links toother website and/or applications to the USER only as a convenience, and their inclusion does not entail endorsement by the Company of the other website and/or applications or any association with its operators or owners.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees and acknowledges that on accepting the terms and conditions of this Agreement, the User gives the right to the Company to collect the data relating tohis/her/its location (at a GPS level), browser details, capturing photograph (for the purposes of the Agreement only) and any other details as Company may require from time to time for the purposes of this Agreement. The USER also allows Company to send SMS, email and/or messages on WhatsApp messenger to the Marchant in relation to the services at the registered mobile number and email address as provided by the USER while registration on the Platform in accordance with Applicable Laws including but not limited to Information Technology Act, 2000.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company acts only as a business agent and accepts no liability whatsoever for any part of the arrangements between the Provider and the Customer with regard to the standard of service. In no circumstances the Company shall be liable for the services provided by the Provider/third party.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">If the Platform contains bulletin boards, chat rooms, access to mailing lists or other message or communication facilities, the USER agrees to use the same only to send and receive messages and materials that are proper and related thereto. The USER agrees that when using the Platform or any facility available there from, shall not do any of the following:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Defame, abuse, harass, stalk, threaten or otherwise violate the legal rights (such as rights of privacy and publicity) of others.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Publish, post, distribute or disseminate any defamatory, infringing, obscene, indecent or unlawful material or information.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Upload or attach files that contain software or other material protected by Intellectual Property laws (or by rights of privacy and publicity) unless the USER owns or controls the rights thereto or has received all consents therefor as may be required by Applicable Law.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Upload or attach files that contain viruses, corrupted files or any other similar software or programs that may damage the operation of another’s computer.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Delete any author attributions, legal notices or proprietary designations or labels in any file that is uploaded.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Falsify the origin or source of software or other material contained in a file that is uploaded.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Advertise or offer to sell any goods or services, or conduct or forward surveys, contests or chain letters, or download any file posted by another user of a forum that the USER knows, or reasonably should know, cannot be legally distributed in such manner.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees that, it shall not post or transmit any defamatory, libellous, obscene, pornographic, profane, threatening or unlawful material or any material that could constitute or encourage conduct that would be considered a criminal offense or give rise to civil liability, or otherwise violate any Applicable Laws. The Company assumes no liability or responsibility arising from the contents of any communications containing any defamatory, erroneous, inaccurate, libellous, obscene or profane material. The Company may change, edit, or remove any user material or conversations that are illegal, indecent, obscene or offensive, or that violates the Company’s policies in any manner way.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company agrees to fully cooperate with any law enforcement authorities or court order requesting or directing the Company to disclose the identity of anyone posting such materials.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Any communications or materials send by the USER to the Platform by electronic mail or otherwise, including any comments, data, questions, suggestions or the like, all such communications are, and will be treated by the Company, as non–confidential. The USER hereby gives up any and all claim that any use of such material violates any of rights including moral rights, privacy rights, proprietary or other property rights, publicity rights, rights to credit for material or ideas, or any other right, including the right to approve the way the Company uses such material. Further, any material submitted to this Platform may be adapted, broadcast, changed, copied, disclosed, licensed, performed, posted, published, sold, transmitted or used by the Company.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">REPRESENTATION AND WARRANTIES</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER represents and warrants to the Company that:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It will submit all the details as requested by the Company including but not limited to KYC information along with proof of the location of office/shop in a true, correct &amp; accurate manner and shall not make any false and/or misleading representation in relation to the same. User understands that any false and/or misrepresentation including submission of false documents can lead to suspension/termination of the registration on the Platform and the USER shall be liable to bear all/any legal consequences arising thereto;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It validly exists and in good standing under the Applicable Laws and it has the power and authority to enter into and fully perform the obligations under this Agreement;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It has all requisite power and authority to execute, deliver and perform its obligations under this Agreement and has been fully authorized by all requisite corporate actions to do so;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It has the necessary skills, knowledge, experience, equipment’s, resources, expertise, the required capital, net worth, adequate and capability to duly perform its obligations in accordance with the terms of this Agreement and to the satisfaction of Shahparpay Solutions Private Limited;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">There are no criminal complaints or other proceedings pending against the USER with the police, courts or other authorities which may hamper in fulfilling its obligations under this Agreement;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It has obtained and will maintain all necessary approvals, permits, waivers, consents and licenses from the relevant authorities for it to perform all its obligations under this Agreement;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It shall not use the Services for any improper or unlawful purposes;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It will not knowingly make any false or misleading representation with regard to the Services to the Merchant;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It shall not undertake any activity while providing services which is infringing any third-party rights including third party Intellectual Property Rights;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The execution and performance of this Agreement by the USER does not and shall not violate any provision of any existing arrangement, law, rule, regulation, any order or judicial pronouncement;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It will comply with the provisions of all the Applicable Laws, concerning or in relation to rendering of Services by the USER as envisaged under this Agreement;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It shall be solely liable and responsible for compliance of Applicable Laws in respect of its employees, agents and representatives and including laws relating to terminal benefits such as pension, gratuity, provident fund, bonus or other benefits to which its employees, agents and representatives may be entitled and the Company shall have no liability in this regard.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">OWNERSHIP:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">It is agreed between the Parties that, all materials on Platform, including but not limited to audio, images, software, text, icons and such like (the “Content”), belongs to the Shahparpay Solutions Private Limited. The USER shall not use the Content, except as specified therein. The USER agrees to follow all instructions on Platform limiting the way USER may use the Content. The Platform is the sole and exclusive property of the Company or its licensors. The Company and its licensors retain all right, title and interest (including all copyright, trademark, patent, trade secrets, and all other Intellectual Property Rights) in the Platform. Any unauthorized use, reproduction or modification of the Platform may violate the Applicable Laws.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">There are a number of Intellectual Property Laws including but not limited to proprietary logos, service marks and trademarks found on Platform whether owned/used by the Company or otherwise. By displaying them on the website and/or application, the Company is not granting the USER any license to utilize those Intellectual Property Laws, proprietary logos, service marks, or trademarks. Any unauthorized use of the Content may violate the laws of privacy and publicity.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">FEES PAYMENT&amp; TAXES:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company reserves the right to charge transaction fees from the USER based on certain completed transactions using the Services.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">All the applicable charges (as decided by PDSPL from time to time) along with the applicable taxes on the said charges for the usage of Merchant Panel and its associated application shall be deducted by PDSPL from the Trading Balance of the Merchant on monthly basis against which PDSPL shall raise an invoice for amount payable by the Merchant by the end of the next month.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company further reserves the right to alter any and all type of fees/renewal charges/usage charges etc from time to time, without notice. The USER shall be completely responsible for all charges, fees, duties, taxes, and assessments arising out of the use of the Services.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In the rare possibilities of the transaction not initiated or confirmed, the Company shall not be under any obligation to make another transaction in lieu of or to compensate/ replace the unconfirmed one. All subsequent further transactions will be treated as new transactions with no reference to the earlier unconfirmed reservation.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The User understands and acknowledges that the Company will settle the Payments to Provider Account only upon actual receipt of the Payments in the Bank Account of the company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall be liable for all applicable taxes including not limited to GST with respect to the Services rendered. Any applicable indirect taxes under Applicable Laws on supply of Services shall be in addition and USER shall be liable for the same.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In case USER fails to pay any applicable taxes or liabilities required under Applicable Laws, statutory and government regulations and accordingly if Company is made liable to pay the same; by virtue of such arrangement, the USER acknowledges that Company shall have the right to adjust such amount against the subsequent net payables.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall be required to indemnify and hold harmless the Company, its promoters, officers, directors, employees, affiliates, agents, sub-contractors and other representatives from any losses including loss of input tax credit, claims, demands, liabilities, suits, proceedings, penalties, costs or expenses of any kind (including, attorneys fees and expenses) on account of violation of applicable tax laws by the User (including but not limited to non-filing of the requisite forms with the tax authorities to claim tax credit, incorrect SAC codes, incorrect tax rates etc.).</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall fully indemnify the Company for any claim, liability, damages and costs arising out of any non-compliance of applicable GST and other applicable taxation laws.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">DATA PROTECTION</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">For the purpose of this Agreement, data protection legislation means the legislation and regulations relating to the protection of personal data of the Customers and Company and processing, storage, usage, collection and/or application of personal data or privacy of an individual under the Applicable Laws including (without limitation):</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">the Information Technology Act, 2000 (as amended from time to time), including the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (Privacy Rules) and any other applicable rules framed thereunder;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">all other banking industry guidelines (whether statutory or non-statutory) or codes of conduct relating to the protection of personal data and processing, storage, usage, collection and/or application of personal data or privacy of an individual issued by any regulator to the Company; and</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">any other Applicable Law solely relating to the protection of personal data and processing, storage, usage, collection and/or application of personal data or privacy of an individual.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER and its affiliates shall comply with all data protection laws under the Applicable Laws and such compliance shall include, but not be limited to, maintaining a valid and up to date registration or notification (where applicable) under the data protection laws.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall only undertake the processing of personal data: -</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">reasonably required in connection with the performance of its obligations under this Agreement; and</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">in accordance with Company’s written instructions, and</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">in accordance with Applicable Law.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Company hereby instructs the USER to take such steps in the processing of personal data on behalf of Company as are reasonably necessary for performance of its obligations under this Agreement.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall not process or transfer any personal data outside India without the prior written consent of Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall at all times have appropriate technical and organisational measures in place acceptable to Company:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">to prevent unauthorised or unlawful processing of any personal data of the Customers;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">to protect any personal data against accidental loss, destruction or damage;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">to ensure the reliability of its employees/contractor having access to the personal data;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">On Company’s request, the USER shall provide a detailed, written description of the measures undertaken by the USER and the USER’s compliance with those measures; and allow Company to access USER’s premises to inspect its procedures for the processing of personal data;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">If the USER receives a request from any person for access to personal data or any other request relating to Company’s obligations under the data protection laws, or any complaint or allegation that Company is not complying with the data protection laws the USER shall:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">immediately notify Company; and</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">provide full co-operation and assistance to the Company in relation to any such complaint or request including, without limitation;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">providing Company with full details of any such request;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">providing Company with any personal data it holds in relation to any person in a form specified by Company within ten (10) days of receipt of the request from any person or as otherwise stipulated by Company and comply with the data access request within the relevant timescales set out in the data protection legislation and in accordance with explicit Authorisation to do so from Company;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">assist the Company in taking any action that deems appropriate to deal with such complaint or allegation;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER understands that in case the USER shares any personal information (including biometrics) and/or any information relating to its account on Shahparpay Solutions Private Limited with any third party (any person other than authorised personnel of the Company) or shares any OTP (One Time Password) with any third party, the USER shall be solely responsible for any losses/damages that it may incur from the same. The Company shall not be responsible for any such losses/damages incurred by the USER due to any unauthorised access to the account of the USER registered on the Platform.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall not sub-contract to any third party any of its obligations to process personal data on behalf of Company unless all of the following provisions of this Clause have first been complied with: -</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER has provided Company with such information and Company may require to ascertain that such sub-contractor has the ability to comply with the provisions of this Agreement; and</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER has obtained the prior written consent of Company; and</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">the proposed sub-contractor has entered into a contract with Company on the same terms and conditions contained herein;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Upon expiry or termination of this Agreement for any reason the USER shall immediately return any personal data, destroy any personal data held by it or its affiliates or subcontractors and issue a confirmation of compliance in this regard to Company.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">SUB-CONTRACTING AND ASSIGNMENT</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER shall itself perform its obligations under this Agreement and shall not assign, transfer or sub-contract any of its rights and obligations in relation to all or part of the Service or related thereto, under this Agreement, except with the prior written permission of the Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In the event of sub-contracting, the USER shall at all times remain responsible and liable to Company for all the actions of the sub-agents/ sub-contractors, assignee, or transferee, as the case may be, with no dilution or diminution of Service, controls, penalties, etc.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Notwithstanding anything contained in the terms of this Agreement, the USER shall ensure that such sub-agent, sub-contractor, assignee or transferee, as the case may be, under the provisions of this clause as agreed under this Agreement, are bound by the terms of this Agreement</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">If such assignment is as a result of operation of any Applicable Laws, then the Company shall have the option on such assignment to forthwith terminate this Agreement.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company shall be entitled to assign/transfer part / all of its rights and benefits under this Agreement to any person or entity with intimation or notice to the USER.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">AUDIT AND INSPECTION</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The CP hereby agrees and acknowledges that-</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company shall be entitled to access the USER’s records of transactions and other necessary information given to, stored or processed by the User relating to the Services rendered under this Agreement;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Following a reasonable notice period of 2 days, Company/Service Provider shall be entitled to conduct audits/inspection by its internal or external auditors, or by agents appointed to act on its behalf and to obtain copies of any audit or review reports and findings made on the USER in connections with the Services undertaken for / on behalf of Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Statutory body/Government Authority or any other competent authority or persons authorised by it shall be entitled to access the documents, records of transactions, and other necessary information given to, stored or processed by the USER within a reasonable time.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Statutory body/Government Authority shall be entitled to cause an inspection to be made on the USER and its books and account by one or more of its officers or employees or other persons.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">USAGE OF MOBILE NUMBER OF THE USER BY THE COMPANY:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company agrees to send transaction confirmation &amp; other information to update the USER on the transaction status and any further information via SMS (short messaging service) and/or Whatsapp messages on the mobile number provided by the USER at the time of purchase of Product or Services. The USER hereby unconditionally consents such intimation via SMS/Whatsapp messages by the Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">However, if the USER, does not want to receive mailers, SMS/Whatsapp messages/E-mail, can unsubscribe (opt out), For unsubscribing user can either email the Company at shahparpay@gmail.com, by providing USE</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">R details and other information as requested (for e.g. username, registered email &amp; SMS) or by using such other mode to unsubscribe as communicated by the Company to USER from time to time. USER can be rest assured their email id &amp; mobile number will not be shared with third party and will be exclusively kept confidential for internal use.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">CONTESTS AND INTERACTIONS:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Parties agree that Platform may contain certain contests which may require the USER to send Company some material and/or information about the USER or offer prizes. Each contest shall contain its own rules, which USER shall be required to read and accept before participating in the same.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">RIGHT TO CANCELLATION BY THE COMPANY IN CASE OF INVALID INFORMATION FROM THE USER:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER expressly undertakes to provide to the Company only correct and valid information while requesting for any Services under this Agreement, and not to make any misrepresentation of facts at all. Any default on part of the User would vitiate this Agreement and shall disentitle the USER from availing the Services from the Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In case if the Company discovers or has reasons to believe at any time during or after receiving a request for Services from the USER that the request for Services is either unauthorized or the information provided by the USER or any of them is not correct or that any fact has been misrepresented by them, the Company in its sole discretion shall have the unrestricted right to take any steps against the USER, including cancellation of the transactions, etc. without any prior intimation to the USER. In such an event, the Company shall not be responsible or liable for any loss or damage that may be caused to the USER or any of them as a consequence of such cancellation of transaction or Services.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER unequivocally indemnifies the Company of any such claim or liability and shall not hold the Company responsible for any loss or damage arising out of measures taken by Company for safeguarding its own interest and that of its genuine customers. This would also include Company denying/cancelling any transaction on account of suspected fraud transactions.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">PRIVACY AND SECURITY:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The User hereby consents, expresses and agrees that they have read and fully understands the Privacy Policy of the Company contained in the Company’s Platform and hereby consents that the terms and contents of such Privacy Policy are acceptable to them.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">DISCLAIMER OF WARRANTY:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company and its Providers make no warranty of any kind regarding the Platform, Content, Products or Services, all of which are provided on an "as is" basis. The Company and its Providers expressly disclaim any representation or warranty that the Platform will be free from errors, viruses or other harmful components, that communications to or from the Platform will be secure and not intercepted and that the Services and other capabilities offered from/on the Platform will be uninterrupted, or that its Content will be accurate, complete or timely. The fact that the Company is including or offering any Product or Service on the Platform is not an endorsement or a recommendation of the Product or Service.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Other than those warranties which, under the Applicable Laws are applicable to these terms, are implied by laws, and are incapable of exclusion, restriction or modification, the Company and its providers expressly disclaim all warranties and conditions, including implied warranties and conditions of merchantability, fitness for a particular purpose, title, non-infringement, and those arising by statute or otherwise in Applicable laws or from a course of dealing or usage of trade.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">LIMITATION OF LIABILITY:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Subject to Applicable Law, use of the Platform and its Content is at USER’s own risk. Services and Products made available on the Platform are subject to conditions imposed by the Providers, including but not limited to tariffs, conditions of carriage, international conventions and arrangements, and federal government regulations. Providers who furnish products or Services through the Platform are independent contractors, and not agents or employees of the Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In no event the Company or its Providers shall be liable to any USER for any direct, indirect, special or other consequential damages for any use of the Platform, any hyper linked website, the acts or omissions of providers who furnish products or Services through the Platform, or the Products or Services offered by Providers through the Platform, including, without limitation, whether based in contract, tort, negligence, strict liability or otherwise, that arises out of or is in any way connected with(i) any use of, browsing or downloading of any part of Platform or Content, (ii) any failure or delay (including without limitation the use of or inability to use any component of the Platform for transaction), or (iii) the performance or non-performance by Shahparpay Solutions Private Limited or any Provider, or (iv) any damages or injury caused by any failure of performance, error, omission, interruption, deletion, defect, delay in operation or transmission, computer virus, communication line failure, theft or destruction or unauthorized access to, alteration of, or use of record, even if the Company and the Provider(s) have been advised of the possibility of damages to such parties or any other party.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">User hereby acknowledge that the Company is not the seller of the Products and the Services and the Company shall in no manner be deemed to be the seller of the Products or Services, Company is only facilitating purchase of the Products or Services from the service Provider/vendor by providing the Services Platform of the Company. Hence, if there is any defect/deficiency in the Product Services of any nature whatsoever, then the Company may advise the User to contact the respective Provider and if there is any loss, cost, damage and liability which may incur or arise on the USER due to termination of relation/arrangement between the Company and the service Provider on account of any reason whatsoever than the Company shall not be held responsible, in any manner, to refund any amount in full or in part which has been paid by the USER while subscribing to the service of such service Provider at Company’s Platform.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">CONFIDENTIALITY:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Each of the Party recognizes, accepts and agrees that all information obtained or disclosed, including but not limited to all data, documents, applications, papers, statements, slips, programmes, plans and/or any business/ customer information, marketing strategies/plans and any and all other trade secrets, confidential knowledge or information of either Party relating to its business, practices and procedures (hereinafter collectively referred to as “Confidential Information”) which may be provided or communicated by one Party to the other Party in connection with this Agreement and/or in the course of performance under this Agreement, shall be and shall remain the sole property of the Party providing such Confidential Information and shall be of a strictly private and confidential in nature and shall be treated as confidential by the other Party.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">During the Term of this Agreement and thereafter, neither Party shall make use of any such Confidential Information for any purpose whatsoever which is not necessary for the discharge of its obligations under this Agreement, or to the disadvantage of the Party providing such Confidential Information, nor shall the Party receiving such Confidential Information divulge it to anyone other than the Party providing the Confidential Information or persons designated by such Party.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">All Confidential Information shall be returned forthwith by the Party receiving such Confidential Information to the Party providing the Confidential Information upon the expiry or termination of this Agreement:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The obligations of each of the Party contained in this Clause shall continue for the Term of this Agreement and five (5) years after the termination of this Agreement but shall not apply to any information which: (a) is or hereafter comes into the public domain otherwise than through a breach by any Party of its obligations under this Agreement; (b) is, at the time of disclosure, already known to the Party receiving the Information as evidenced by such Party’s written documentation; (c) is independently developed by employees of the Party receiving the information who have not had access to or received any such Information under this Agreement; or (d) is required to be disclosed for the purpose of providing assistance hereunder subject to the other Party’s prior consent to the same: Provided, however, that nothing contained in this Clause shall prevent any Party from disclosing such Confidential Information to the extent required in or in connection with legal proceedings arising out of this Agreement or any matter relating to or in connection therewith.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Neither Party shall issue any public statement concerning these arrangements or disclose the contents hereof or matters related thereto to the public or any third party except with the express prior written approval of the other Party or except as required under Applicable Law.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The provisions of this Clause shall survive the termination or expiry of this Agreement.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">INTELELCTUAL PROPERTY RIGHTS</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">All Intellectual Property Rights of the Company in the Platform and the publicity material shall remain the property of the Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Except as expressly set out in this Agreement no assignment of or license under any Intellectual Property Right or trade mark or service mark, whether registered or not, owned or controlled by the Company is granted to the USER by this Agreement.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">USER shall not use the Intellectual Property Rights or adopt any Intellectual Property Rights identical or similar to any of the Intellectual Property Right of the Company on or in relation to any Products or Services unless authorized by Company in writing. If the USER comes to know of any instances of misuse of any of the Intellectual Property Right of Company by third parties in its Territory, it shall forthwith notify Company and render all reasonable assistance to the Company in any proceedings that Company may take to prevent such misuses.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">During the Term of this Agreement and thereafter, the USER recognizes that Company is the sole owner of all Intellectual Property Rights, tile in the Services offered by Company including the technology and Software related thereto and all advertising and promotional material and Customer information related to provision of Services, and the goodwill which is or which shall become attached to any of the foregoing (hereinafter collectively known as “Company Intellectual Property"). The USER hereby knowledges that it shall have no right, title or interest, whatsoever in the Company Intellectual Property except expressly provided herein.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees, warrants and undertakes that it shall take all necessary measures to ensure that the Company Intellectual Property, Intellectual Property Rights of the service Providers are not infringed, passed off, diluted, reverse-engineered, hacked into misappropriated, tampered with and/or copied for any other reason by any of its employees, agents, consultants, representatives except expressly provided herein.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">RIGHT TO REFUSE:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Without prejudice to the other remedies available to the Company under this Agreement, the terms of Service or under Applicable Law, the Company may limit the USER’s activity, or end the USER's listing, warn other users of the USER's actions, immediately temporarily/indefinitely suspend or terminate the USER's registration, and/or refuse to provide the USER with access to the Platform if:</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER is in breach of this agreement, the terms of Service and/or the documents it incorporates by reference;</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company is unable to verify or authenticate any information provided by the USER; or</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company believes that the USER's actions may infringe on any third-party rights or breach any Applicable Law or otherwise result in any liability for the USER, other users of the Platform and/or the Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company may at any time in its sole discretion reinstate suspended USER. Once the USER has been indefinitely suspended the USER shall not register or attempt to register with the Company or use the Platform in any manner whatsoever until such time that the USER is reinstated by the Company.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Notwithstanding the foregoing, if the USER breaches this Agreement, the Terms of Service or the documents it incorporates by reference, the Company reserves the right to recover any amounts due and owing by the USER to the Company and/or the service Provider and to take strict legal action as the Company deems necessary.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">FORCE MAJURE:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees that there can be exceptional circumstances where the service Providers may be unable to honour the confirmed bookings/purchases made by a USER on the Platform due to various reasons like climatic conditions, labour unrest, insolvency, business exigencies, government decisions, operational and technical issues, route and flight cancellations etc. If the Company is informed in advance of such situations where dishonour of bookings may happen, it will make its best efforts to provide similar alternative to its customer’s or refund the booking amount after reasonable service charges, if supported and refunded by that respective service Providers. The USER agrees that the Company being an agent for facilitating the booking services shall not be responsible for any such circumstances and the Customers have to contact that service Provider directly for any further resolutions and refunds.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees that in situations due to any technical or other failure in the Company, Services committed earlier may not be provided or may involve substantial modification. In such cases, the Company shall refund the entire amount received from the Customer for availing such Services minus the applicable cancellation, refund or other charges, which shall completely discharge any and all liabilities of the Company against such non-provision of Services or deficiencies. Additional liabilities, if any, shall be borne by the USER.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company shall not be liable for delays or inabilities in performance or non-performance in whole or in part of its obligations due to any causes that are not due to its acts or omissions and are beyond its reasonable control, such as acts of God, epidemic, pandemic (including Covid-19) fire, strikes, embargo, acts of government, acts of terrorism or other similar causes, problems at airlines, rails, buses, hotels or transporters end. In such event, the user affected will be promptly given notice as the situation permits.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Without prejudice to whatever is stated above, the maximum liability on part of the Company arising under any circumstances, in respect of any Services offered on the site, shall be limited to the refund of total amount received from the Customer for availing the Services less any cancellation, refund or others charges, as may be applicable. In no case the liability shall include any loss, damage or additional expense whatsoever beyond the amount charged by the Company for its Services.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">In no event shall the Company and/or its Providers be liable for any direct, indirect, punitive, incidental, special, consequential damages or any damages whatsoever including, without limitation, damages for loss of use, data or profits, arising out of or in any way connected with the use or performance of the Company’s Platform or any other channel. Neither shall Company be responsible for the delay or inability to use the Company Platform or related services, the provision of or failure to provide Services, or for any information, Software, products, services and related graphics obtained through the Company website and/or application(s), or otherwise arising out of the use of the Company website and/or application(s), whether based on contract, tort, negligence, strict liability or otherwise.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company is not responsible for any errors, omissions or representations on any of its pages or on any links or on any of the third-party website and/or application pages.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">INDEMNIFICATION:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER agrees to indemnify, defend and hold harmless the Company and/or its affiliates, their Platform and their respective lawful successors and assigns from and against any and all losses, liabilities, claims, damages, costs and expenses (including reasonable legal fees and disbursements in connection therewith and interest chargeable thereon) asserted against or incurred by the Company and/or its affiliates, partner Platform and their respective lawful successors and assigns that arise out of, result from, or may be payable by virtue of, any fraud or breach, or non-performance of any representation, warranty, covenant or Agreement made or obligation to be performed by the USER pursuant to this Agreement. The USER shall be solely and exclusively liable for any breach of any country specific rules and regulations or general code of conduct and Company cannot be held responsible for the same</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">RELATIONSHIP:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">None of the provisions of any Agreement, terms and conditions, notices, or the right to use the Platform by the User contained herein or any other section or pages of the Company Platform or its partner website and/or applications, shall be deemed to constitute a partnership between the USER and the Company and no Party shall have any authority to bind or shall be deemed to be the agent of the other in any way</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">NOTICE:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">All notices, requests, consents, approvals, agreements, authorizations, acknowledgements, waivers and other communications required or permitted hereunder shall be in writing and in the English language and shall be sent by either internationally recognized courier or by email address or facsimile transmission (with confirming facsimile receipt) addressed to the address of each Party set forth below, or to such other address as such other Party shall have communicated to the other Party in writing. Notice shall be deemed to have been served when received (and in case of a facsimile transmission, provided that a confirming copy is sent to the other Party, in accordance with the non-facsimile notice delivery requirements).</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Shahparpay Solutions Private Limited:Address: 4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, West Bengal - 712125E-mail: - shahparpay@gmail.com, Office Phone +91 8240039776</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">SEVERABILITY:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The various provisions of this Agreement are severable and if any such provision or part thereof is held to be void, voidable, invalid, unlawful or unenforceable by any Court of competent jurisdiction such void, voidable, invalid, unlawful or unenforceable provision shall be deemed severed from this Agreement and shall not affect the remaining provisions of this Agreement or as the case may be, the remainder of the relevant provisions which shall remain in full force and effect and in substitution for any such provision held to be void, voidable, invalid, unlawful or unenforceable, there shall be substituted by mutual consultation and agreement of the Parties a provision of similar import reflecting the original intent of the Parties to the extent permissible under Applicable Laws.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">UPDATION OF THE INFORMATION BY THE COMPANY:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER acknowledges that the Company provides Services with reasonable diligence and care. It endeavours its best to ensure that USER does not face any inconvenience. However, sometimes, the information, Software, Products, and Services included in or available through the Company Platform or other sales channels and ad materials may include inaccuracies or typographical errors which will be immediately corrected as soon as the Company notices them. Changes are/may be periodically made/added to the information provided such. The Company may make improvements and/or changes in the Company Platform at any time without any notice to the USER. Any advice received except through an authorized representative of the Company via the Company Platform should not be relied upon for any decisions.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">NO WAIVER:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Save where this Agreement expressly provides, neither Party shall be deemed to have waived any right, power, privilege or remedy under this Agreement unless such Party shall have delivered to the other Party a written waiver signed by an authorised officer of such waiving Party. No failure or delay on the part of either Party in exercising any right, power, privilege or remedy hereunder shall operate as a waiver, default or acquiescence thereof, nor shall any waiver on the part of either Party of any right, power, privilege or remedy hereunder operate as a waiver of any other right, power, privilege or remedy, nor shall any single or partial exercise of any right, power, privilege or remedy hereunder preclude any other or further exercise thereof or the exercise of any other right, power, privilege or remedy hereunder.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">AMENDMENTS AND MODIFICATIONS:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company reserves the right to change the terms, conditions, and notices under which the Company’s Platform is offered, including but not limited to the charges. The USER is responsible for regularly reviewing these terms and conditions.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">JURISDICTION:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The Company hereby expressly disclaims any implied warranties imputed by the laws of any jurisdiction or country other than those where it is operating its offices. The Company considers itself and intends to be subject to the jurisdiction only of the courts of Delhi, India.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">GOVERNING LAWS AND ARBITRATION:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Any dispute, difference, controversy or claim (“Dispute”) arising between the Parties out of or in relation to or in connection with this Agreement, of the breach, termination, effect, validity, interpretation or application of this Agreement or as to their rights, duties or liabilities thereunder, or as to any act, matter or thing arising out of, consequent to or in connection with this Agreement, shall be settled by the Parties by mutual negotiations and agreement. If, for any reason, such Dispute cannot be resolved amicably by the Parties, the same shall then be referred to and settled by way of arbitration proceedings in accordance with the Arbitration and Conciliation Act, 1996 or any subsequent enactment or amendment thereto (the “Arbitration Act”). A sole Arbitrator shall be appointed by the Company. The decision of the Arbitrator shall be final and binding upon the Parties. The venue of arbitration proceedings shall be Delhi. The language of the arbitration and the award shall be English. This Agreement shall be construed in accordance with the laws of India.</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">MISCELLANEOUS:</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">This Agreement represent the entire Agreement between the Parties as to the subject matter hereof and supersede all prior understandings between the Parties on the subject-matter hereof.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">No amendments and/or modifications to this Agreement shall be valid unless executed in writing and signed by authorized persons of both the Parties.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Termination of this Agreement for any because whatsoever shall not release a Party from any liability which, at the time of termination, has already accrued to the other Party or which may thereafter accrue in respect of any act or omission prior to such termination.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Article headings are inserted for convenience of reference only and shall not be deemed to affect the interpretation of this Agreement or of any clause.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Each Party shall co-operate with the other and execute and deliver to the other such instruments and documents and take such other actions as may be reasonably requested from time to time in order to carry out, give effect to and confirm their rights and the intended purpose of this Agreement.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">No remedy conferred by any of the provisions of this Agreement is intended to be exclusive of any other remedy which is otherwise available at law, in equity, by statute or otherwise, or any other remedy given hereunder or now or hereafter existing at law, in equity, by statute, or otherwise, except as stated to the contrary in this Agreement. The election of any one or more of such remedies by any of the Parties hereto shall not constitute a waiver by such Party of the right to pursue any other available remedy.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The provisions of the following clauses of this Agreement shall survive the termination or expiry hereof.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">IN WITNESS WHEREOF the Parties hereto have hereunto executed these presents on the day and the date first hereinafter written.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">The USER hereby agrees to ensure to isolate and clearly identify all Customer information, documents (in hard copies or soft files), computerized data/information, records and assets to protect the confidentiality of the Customers information. BY CLICKING I ACCEPT, USER (INCLUDING PERSON ACTING ON BEHALF OF USER) CONFIRMS THAT THE USER OR ANY OTHER LEGAL ENTITY AS THE CASE MAY BE, HAS NECESSARY AUTHORITY TO ACCEPT THIS AGREEMENT ON ITS BEHALF.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Personal Details</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Personal Name</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">WAHAJUL HAQUE</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Business Name</p>
<h3 className="text-base font-extrabold text-slate-900 mt-6 border-b border-slate-200 pb-1">SHAHPARPAY SOLUTIONS PVT LTD</h3>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Business Add.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, West Bengal 712125, Burdwan Division, West Bengal</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Business Area.</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Bhadreswar</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">Hooghly</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">kindly sign here</p>
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-mono">I Accept</p>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            1. Scope of Services &amp; Platform Access
                                        </h3>
                                        <p>
                                            Shahparpay Solutions Private Limited grants the Retailer a non-exclusive, non-transferable,
                                            revocable license to access the Shahparpay Web Portal and Android/iOS Mobile Applications for
                                            delivering fintech services to customers in India, including:
                                        </p>
                                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> AEPS Cash Withdrawal &amp; Mini Statement
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> Micro-ATM Debit Card Withdrawal
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> Domestic Money Transfer (DMT) &amp; Payouts
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> BBPS Utility Bills &amp; Mobile/DTH Recharge
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> PAN Card (NSDL) Applications &amp; Reprints
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-[#008c46]" /> Savings Account Opening &amp; ITR / GST Filing
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            2. Retailer Responsibilities &amp; Credentials Security
                                        </h3>
                                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-2">
                                            <p className="font-bold text-sm">Strict Security Mandate:</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                <li>
                                                    Retailer must keep User ID, Password, Transaction PIN (MPIN), and OTPs strictly confidential.
                                                    Never share credentials with any caller claiming to be Shahparpay support.
                                                </li>
                                                <li>
                                                    Retailer consents to location/GPS data capture, browser telemetry, and photograph capture
                                                    during login and e-KYC onboarding as mandated by RBI/NPCI guidelines.
                                                </li>
                                                <li>
                                                    Retailer must verify customer identity prior to executing cash withdrawals or transfers.
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            3. Product &amp; Service Activation Fee Schedule
                                        </h3>
                                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                                    <tr>
                                                        <th className="p-3">Service Name</th>
                                                        <th className="p-3">Standard Activation Cost</th>
                                                        <th className="p-3">Retailer / Partner Pricing</th>
                                                        <th className="p-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-slate-600">
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">PAN Card Services (NSDL)</td>
                                                        <td className="p-3">₹500 + GST</td>
                                                        <td className="p-3 font-bold text-[#008c46]">FREE</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">AEPS Cash Withdrawal</td>
                                                        <td className="p-3">₹500 + GST</td>
                                                        <td className="p-3 font-bold text-[#008c46]">FREE</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">Micro ATM Service</td>
                                                        <td className="p-3">₹500 + GST</td>
                                                        <td className="p-3 font-bold text-[#008c46]">FREE</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">Domestic Money Transfer (DMT)</td>
                                                        <td className="p-3">₹500 + GST</td>
                                                        <td className="p-3 font-bold text-[#008c46]">FREE</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">Digital Savings / Current Account</td>
                                                        <td className="p-3">₹1,000 + GST</td>
                                                        <td className="p-3 font-bold text-[#008c46]">FREE</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">BBPS &amp; Mobile/DTH Recharge</td>
                                                        <td className="p-3">₹500 + GST</td>
                                                        <td className="p-3 font-bold text-[#008c46]">FREE</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">e-KYC Onboarding &amp; Bank Verify</td>
                                                        <td className="p-3">₹50</td>
                                                        <td className="p-3 font-bold text-slate-900">₹10 Only</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">Loan &amp; Credit Card Lead Gen</td>
                                                        <td className="p-3">₹1,000 + GST</td>
                                                        <td className="p-3 font-bold text-[#008c46]">FREE</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="p-3 font-semibold text-slate-900">ITR &amp; Tax Registration Suite</td>
                                                        <td className="p-3">₹5,000 + GST</td>
                                                        <td className="p-3 font-bold text-[#008c46]">FREE / Discounted</td>
                                                        <td className="p-3">Live</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= TAB 3: AEPS TERMS */}
                        {activeTab === 'aeps' && (
                            <div className="space-y-8 animate-in fade-in duration-200">
                                <div className="border-b border-slate-100 pb-6 flex items-start justify-between gap-4">
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008c46] bg-[#f0fdf4] px-3 py-1 rounded-full border border-[#bbf7d0] mb-2">
                                            <Fingerprint className="w-3.5 h-3.5" /> NPCI &amp; UIDAI Compliance
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                                            AEPS Usage Terms &amp; Biometric Declaration
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Mandatory guidelines for conducting Aadhaar Enabled Payment System (AEPS) transactions at retailer counters.
                                        </p>
                                    </div>
                                    <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] items-center justify-center text-[#008c46]">
                                        <Fingerprint className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
                                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                                        <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-[#008c46]" /> Zero Raw Biometric Storage Guarantee
                                        </h3>
                                        <p className="text-xs text-emerald-800 leading-relaxed">
                                            Shahparpay strictly complies with UIDAI and Aadhaar Act rules. Raw biometric data (fingerprint scans)
                                            is encrypted inside STQC-certified L1 biometric device hardware at the time of capture and is never stored
                                            on retailer devices, Shahparpay servers, or any intermediary database.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            1. Mandatory Retailer Rules for AEPS
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                                                <h4 className="font-bold text-slate-900 text-sm mb-1">Customer Explicit Consent</h4>
                                                <p className="text-xs text-slate-600">
                                                    Retailer must take explicit verbal/written consent from the customer before initiating any
                                                    biometric scan for cash withdrawal, balance inquiry, or Aadhaar Pay.
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                                                <h4 className="font-bold text-slate-900 text-sm mb-1">Physical Register Maintenance</h4>
                                                <p className="text-xs text-slate-600">
                                                    As per NPCI directives, retailers must maintain a physical paper register capturing Transaction Date,
                                                    RRN, Customer Name, Aadhaar last 4 digits, Amount, and Customer Signature/Thumbprint.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            2. Prohibited Practices &amp; Fraud Warnings
                                        </h3>
                                        <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-950 space-y-3">
                                            <div className="flex items-center gap-2 font-extrabold text-red-900">
                                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                                                Strictly Forbidden AEPS Offenses:
                                            </div>
                                            <ul className="list-disc pl-5 space-y-1.5 text-xs text-red-900 font-medium">
                                                <li>
                                                    <strong>Split Transactions:</strong> Splitting a customer’s withdrawal into multiple smaller
                                                    transactions to earn higher slab commission or bypass daily limits is strictly prohibited.
                                                </li>
                                                <li>
                                                    <strong>Surcharge / Extra Fee Collection:</strong> Charging customers any unauthorized extra cash fee
                                                    beyond the official transaction amount is illegal under NPCI regulations.
                                                </li>
                                                <li>
                                                    <strong>Biometric Misuse:</strong> Attempting to capture or reuse fingerprints using silicone molds or
                                                    fake biometric devices constitutes a non-bailable criminal offense under the Aadhaar &amp; IT Act.
                                                </li>
                                                <li>
                                                    <strong>Physical Location Audits:</strong> Shahparpay field teams perform unannounced shop audits.
                                                    Non-compliance will result in instant account block and freezing of trading balance.
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= TAB 4: REFUND POLICY */}
                        {activeTab === 'refund' && (
                            <div className="space-y-8 animate-in fade-in duration-200">
                                <div className="border-b border-slate-100 pb-6 flex items-start justify-between gap-4">
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008c46] bg-[#f0fdf4] px-3 py-1 rounded-full border border-[#bbf7d0] mb-2">
                                            <RefreshCw className="w-3.5 h-3.5" /> Failed Transactions &amp; Cancellations
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                                            Refund &amp; Cancellation Policy
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Clear timelines and mechanisms for failed transactions, money transfers, bill payments, and chargebacks.
                                        </p>
                                    </div>
                                    <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] items-center justify-center text-[#008c46]">
                                        <RefreshCw className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                                            <div className="text-xl font-extrabold text-[#008c46]">24 - 72 Hrs</div>
                                            <div className="text-xs font-bold text-slate-800 mt-1">Auto Bank Reversal</div>
                                            <p className="text-[0.75rem] text-slate-500 mt-1">
                                                For server timeouts, money debited from retailer wallet without banking confirmation reverses automatically.
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                                            <div className="text-xl font-extrabold text-[#008c46]">OTP Validation</div>
                                            <p className="text-xs font-bold text-slate-800 mt-1">DMT / Payout Refunds</p>
                                            <p className="text-[0.75rem] text-slate-500 mt-1">
                                                Failed DMT transfers require sender OTP authorization to claim refund back into wallet or cash.
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                                            <div className="text-xl font-extrabold text-[#008c46]">7 Days</div>
                                            <p className="text-xs font-bold text-slate-800 mt-1">Dispute Raise Window</p>
                                            <p className="text-[0.75rem] text-slate-500 mt-1">
                                                All transaction discrepancies must be logged with support ticket within 7 days of transaction date.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            1. Category-Wise Refund Rules
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="p-4 rounded-xl border border-slate-200 bg-white">
                                                <h4 className="font-bold text-slate-900 text-sm text-[#008c46]">
                                                    Mobile &amp; DTH Prepaid Recharges
                                                </h4>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    Recharge transactions are instant and final. If a recharge status is returned as SUCCESS by the operator,
                                                    no refund can be issued even if an incorrect mobile number or subscriber ID was entered by the user. If the
                                                    operator status returns FAILED, funds auto-credit back to retailer wallet immediately.
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-xl border border-slate-200 bg-white">
                                                <h4 className="font-bold text-slate-900 text-sm text-[#008c46]">
                                                    BBPS Utility Bill Payments
                                                </h4>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    Bill payments pushed to billers (Electricity, Water, Gas, FASTag) can take up to 2-3 business days for biller
                                                    reconciliation. In case of biller rejection or payment failure, the debited amount is returned to the retailer wallet.
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-xl border border-slate-200 bg-white">
                                                <h4 className="font-bold text-slate-900 text-sm text-[#008c46]">
                                                    Domestic Money Transfer (DMT) &amp; Payouts
                                                </h4>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    If a DMT IMPS/NEFT transaction fails at the destination bank, a refund OTP is sent to the sender’s mobile number.
                                                    The retailer must enter the OTP on the portal to claim the refund ledger credit.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= TAB 5: GRIEVANCE POLICY */}
                        {activeTab === 'grievance' && (
                            <div className="space-y-8 animate-in fade-in duration-200">
                                <div className="border-b border-slate-100 pb-6 flex items-start justify-between gap-4">
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008c46] bg-[#f0fdf4] px-3 py-1 rounded-full border border-[#bbf7d0] mb-2">
                                            <ShieldAlert className="w-3.5 h-3.5" /> Customer Redressal &amp; Grievance Policy
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                                            Customer Grievance Redressal Policy &amp; Anti-Fraud Warning
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Framework under RBI Payment &amp; Settlement Systems Act (PSS Act) for resolving customer complaints.
                                        </p>
                                    </div>
                                    <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] items-center justify-center text-[#008c46]">
                                        <ShieldAlert className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
                                    {/* Fraud warning card */}
                                    <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                                        <div className="flex items-center gap-2 font-extrabold text-amber-900 text-sm">
                                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                            Public Security Notice &amp; Caution Against Fraudsters
                                        </div>
                                        <p className="text-xs text-amber-800 leading-relaxed">
                                            Shahparpay Solutions Private Limited cautions the public and retailers to never divulge confidential details
                                            such as debit card numbers, PINs, OTPs, or wallet passwords over phone calls or emails. Shahparpay support staff
                                            <strong> WILL NEVER ASK YOU </strong> for your MPIN, OTP, password, or full bank details.
                                        </p>
                                    </div>

                                    {/* 2-Tier grievance mechanism */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-extrabold text-slate-900 border-l-4 border-[#008c46] pl-3">
                                            Two-Tier Grievance Escalation Matrix
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Tier 1 */}
                                            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f0fdf4] text-[#008c46] text-xs font-bold border border-[#bbf7d0]">
                                                    Tier 1: Customer Support Care
                                                </div>
                                                <p className="text-xs text-slate-600">
                                                    For transaction issues, pending statuses, or general queries, contact our dedicated support desk:
                                                </p>
                                                <div className="space-y-1.5 text-xs font-medium text-slate-800 pt-2 border-t border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-3.5 h-3.5 text-[#008c46]" /> +91 8240039776
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-3.5 h-3.5 text-[#008c46]" /> shahparpay@gmail.com
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5 text-[#008c46]" /> Mon-Sat (9:00 AM to 10:00 PM)
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tier 2 */}
                                            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
                                                    Tier 2: Nodal Grievance Redressal Officer
                                                </div>
                                                <p className="text-xs text-slate-600">
                                                    If your query is not resolved within 7 business days by Tier 1, escalate to the Grievance Officer:
                                                </p>
                                                <div className="space-y-1.5 text-xs font-medium text-slate-800 pt-2 border-t border-slate-100">
                                                    <div>
                                                        <strong>Grievance Officer:</strong> Customer Nodal Officer
                                                    </div>
                                                    <div>
                                                        <strong>Company:</strong> Shahparpay Solutions Private Limited
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-3.5 h-3.5 text-[#008c46]" /> Hooghly, West Bengal - 712125
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* LEGAL HUB QUICK NAV GRID */}
                    <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm mt-8">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Legal &amp; Compliance Network</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-bold text-slate-700">
                            <Link to="/about" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">About Us</Link>
                            <Link to="/terms" className="p-3 rounded-xl bg-[#008c46] text-white border border-[#008c46] text-center shadow-xs">General Terms</Link>
                            <Link to="/retailer-terms" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">Retailer Terms</Link>
                            <Link to="/aeps-terms" className="p-3 rounded-xl bg-slate-50 hover:bg-[#f0fdf4] hover:text-[#008c46] border border-slate-200 text-center transition-colors">AEPS Terms</Link>
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

export default Terms;
