import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import whiteLogo from '../../assets/shahparpay-white-logo.png';
import { WRAP } from './ui';

const BANKING = ['AEPS Cash Withdrawal', 'Balance & Mini Statement', 'Micro ATM', 'Money Transfer (DMT)', 'UPI QR Collection', 'Aadhaar Pay'];
const BILLS: [string, string][] = [
    ['Mobile & DTH Recharge', '#payouts'],
    ['BBPS Bill Payments', '#payouts'],
    ['FASTag Recharge', '#payouts'],
    ['PAN Card Services', '#identity'],
    ['ITR Filing', '#identity'],
    ['Lead Generation', '#identity'],
];
const LEGAL: [string, string][] = [
    ['About us', '/about'],
    ['General terms', '/terms'],
    ['Retailer terms', '/retailer-terms'],
    ['AEPS terms', '/aeps-terms'],
    ['AEPS declaration', '/aeps-permission'],
    ['Refund policy', '/refund-policy'],
];

const HEAD = 'text-sm text-white';
const ITEM = 'inline-block py-1.5 text-sm text-[#a39c90] transition-colors hover:text-white';
const ICON = 'size-4 shrink-0 text-[#8a847a]';
const SOCIAL = 'flex size-10 items-center justify-center rounded-lg border border-white/10 text-[#a39c90] transition-colors hover:bg-white/5 hover:text-white';

/**
 * The public site's footer, shared by every public page. Carries the #contact
 * anchor that the address links on the landing page point at.
 */
const LandingFooter: React.FC = () => (
    <footer id="contact" className="relative z-10 scroll-mt-16 bg-[#161513] text-[#a39c90]">
        <div className={`${WRAP} py-16`}>
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-4 lg:col-span-2">
                    <img src={whiteLogo} alt="Shahparpay" className="h-9 w-auto object-contain" />
                    <p className="max-w-sm text-sm leading-relaxed">
                        Shahparpay Solutions Private Limited equips shop owners across India to offer banking, bill payment and document services to their customers, and to earn on every transaction.
                    </p>
                    <p className="text-sm text-[#8a847a]">Services delivered over NPCI rails through licensed banking partners</p>
                </div>

                <div>
                    <p className={HEAD}>Banking services</p>
                    <ul className="mt-3">
                        {BANKING.map((label) => (
                            <li key={label}><a href="#products" className={ITEM}>{label}</a></li>
                        ))}
                    </ul>
                </div>

                <div>
                    <p className={HEAD}>Bills and documents</p>
                    <ul className="mt-3">
                        {BILLS.map(([label, href]) => (
                            <li key={label}><a href={href} className={ITEM}>{label}</a></li>
                        ))}
                    </ul>
                </div>

                <div>
                    <p className={HEAD}>Official contact</p>
                    <ul className="mt-3 space-y-3 text-sm">
                        <li className="flex items-center gap-2.5">
                            <Phone aria-hidden strokeWidth={1.5} className={ICON} />
                            <a href="tel:+918240039776" className="font-mono tabular-nums transition-colors hover:text-white">+91 8240039776</a>
                        </li>
                        <li className="flex items-center gap-2.5">
                            <Mail aria-hidden strokeWidth={1.5} className={ICON} />
                            <a href="mailto:shahparpay@gmail.com" className="transition-colors hover:text-white">shahparpay@gmail.com</a>
                        </li>
                        <li className="flex items-start gap-2.5">
                            <MapPin aria-hidden strokeWidth={1.5} className={`${ICON} mt-0.5`} />
                            <span>4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, West Bengal - 712125</span>
                        </li>
                    </ul>
                </div>
            </div>

            <p aria-hidden className="mt-16 select-none overflow-hidden whitespace-nowrap border-t border-white/10 pt-12 text-center text-[13vw] font-medium leading-none tracking-[-0.04em] text-white/90 xl:text-[168px]">
                Shahparpay
            </p>

            <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-white/10 pt-6 sm:flex-row">
                <div className="flex items-center gap-2">
                    <a href="https://wa.me/918240039776?text=Hi%20Shahparpay%2C%20I%20need%20help%20with%20my%20retailer%20account." target="_blank" rel="noopener noreferrer" aria-label="WhatsApp support" className={SOCIAL}>
                        <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
                    </a>
                    <a href="mailto:shahparpay@gmail.com" aria-label="Email support" className={SOCIAL}>
                        <Mail aria-hidden strokeWidth={1.5} className="size-4" />
                    </a>
                    <a href="tel:+918240039776" aria-label="Call support" className={SOCIAL}>
                        <Phone aria-hidden strokeWidth={1.5} className="size-4" />
                    </a>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm sm:justify-end">
                    {LEGAL.map(([label, to]) => (
                        <Link key={to} to={to} className="inline-block py-2 transition-colors hover:text-white">{label}</Link>
                    ))}
                    <span className="py-2 text-[#8a847a]">© {new Date().getFullYear()} Shahparpay Solutions Private Limited</span>
                </div>
            </div>
        </div>
    </footer>
);

export default LandingFooter;
