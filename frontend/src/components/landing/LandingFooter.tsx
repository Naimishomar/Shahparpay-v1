import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Globe, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import whiteLogo from '../../assets/shahparpay-white-logo.png';

/**
 * The public site's footer, shared by every public page. Carries the #contact
 * anchor that the address links on the landing page point at.
 */
const LandingFooter: React.FC = () => {
    return (
    <footer id="contact" className="scroll-mt-20 bg-[#0c120e] text-slate-300 border-t border-slate-800 relative z-10 overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-6 py-16">
            {/* Top 4 Navigation Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
                {/* Column 1: Brand Info */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-3">
                        <img src={whiteLogo} alt="Shahparpay Logo" className="h-9 w-auto object-contain" />
                        <span className="text-xl font-extrabold text-white tracking-tight">Shahparpay</span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                        Shahparpay Solutions Private Limited equips shop owners across India to offer banking, bill payment and document services to their customers, and to earn on every transaction.
                    </p>
                    <div className="pt-2 text-xs font-semibold text-[#a3e635] flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Services delivered over NPCI rails through licensed banking partners
                    </div>
                </div>

                {/* Column 2: Products */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Banking Services</h4>
                    <ul className="space-y-2 text-xs font-medium text-slate-400">
                        <li><a href="#products" className="hover:text-white transition-colors">AEPS Cash Withdrawal</a></li>
                        <li><a href="#products" className="hover:text-white transition-colors">Balance &amp; Mini Statement</a></li>
                        <li><a href="#products" className="hover:text-white transition-colors">Micro ATM</a></li>
                        <li><a href="#products" className="hover:text-white transition-colors">Money Transfer (DMT)</a></li>
                        <li><a href="#products" className="hover:text-white transition-colors">UPI QR Collection</a></li>
                        <li><a href="#products" className="hover:text-white transition-colors">Aadhaar Pay</a></li>
                    </ul>
                </div>

                {/* Column 3: Payouts & Verification */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Bills &amp; Documents</h4>
                    <ul className="space-y-2 text-xs font-medium text-slate-400">
                        <li><a href="#payouts" className="hover:text-white transition-colors">Mobile &amp; DTH Recharge</a></li>
                        <li><a href="#payouts" className="hover:text-white transition-colors">BBPS Bill Payments</a></li>
                        <li><a href="#payouts" className="hover:text-white transition-colors">FASTag Recharge</a></li>
                        <li><a href="#identity" className="hover:text-white transition-colors">PAN Card Services</a></li>
                        <li><a href="#identity" className="hover:text-white transition-colors">ITR Filing</a></li>
                        <li><a href="#identity" className="hover:text-white transition-colors">Lead Generation</a></li>
                    </ul>
                </div>

                {/* Column 4: Official Contact */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Official Contact</h4>
                    <ul className="space-y-3 text-xs text-slate-400 font-medium">
                        <li className="flex items-center gap-2.5">
                            <Phone className="h-4 w-4 text-[#a3e635] shrink-0" />
                            <a href="tel:+918240039776" className="hover:text-white transition-colors font-bold">+91 8240039776</a>
                        </li>
                        <li className="flex items-center gap-2.5">
                            <Mail className="h-4 w-4 text-[#a3e635] shrink-0" />
                            <a href="mailto:shahparpay@gmail.com" className="hover:text-white transition-colors">shahparpay@gmail.com</a>
                        </li>
                        <li className="flex items-start gap-2.5">
                            <MapPin className="h-4 w-4 text-[#a3e635] shrink-0 mt-0.5" />
                            <span>4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, West Bengal - 712125</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* GIANT FULL-WIDTH BRAND LOGO BANNER (MATCHING CASHFREE FOOTER SCREENSHOT) */}
            <div className="w-full pt-12 sm:pt-16 pb-8 border-t border-slate-800/80 my-8 sm:my-12 flex items-center justify-center overflow-hidden">
                <div className="w-full flex items-center justify-center gap-2 sm:gap-4 md:gap-2 select-none group cursor-pointer">
                    {/* <img
                        src={whiteLogo}
                        alt="Shahparpay"
                        className="h-[8.5vw] max-h-40 min-h-10 w-auto object-contain transition-transform group-hover:scale-105 duration-300 shrink-0"
                    /> */}
                    <h2 className="text-[11.5vw] sm:text-[13vw] xl:text-[13.5vw] font-black text-white tracking-tighter leading-none text-center transition-colors group-hover:text-[#ccf788] whitespace-nowrap">
                        Shahparpay
                    </h2>
                </div>
            </div>

            {/* BOTTOM BAR WITH SOCIAL ICONS AND COPYRIGHT */}
            <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-400 font-medium">
                {/* Social Links Row */}
                <div className="flex items-center gap-3">
                    <a href="#contact" aria-label="WhatsApp Support" className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-[#008c46] hover:text-white text-slate-300 transition-all flex items-center justify-center">
                        <MessageCircle className="w-4 h-4" />
                    </a>
                    <a href="#contact" aria-label="Email Support" className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-[#008c46] hover:text-white text-slate-300 transition-all flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                    </a>
                    <a href="#contact" aria-label="Official Phone" className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-[#008c46] hover:text-white text-slate-300 transition-all flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                    </a>
                    <a href="#contact" aria-label="Location" className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-[#008c46] hover:text-white text-slate-300 transition-all flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                    </a>
                </div>

                {/* Copyright & Legal Links */}
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4 text-slate-400 text-xs font-semibold">
                    <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
                    <span>•</span>
                    <Link to="/terms" className="hover:text-white transition-colors">General Terms</Link>
                    <span>•</span>
                    <Link to="/retailer-terms" className="hover:text-white transition-colors">Retailer Terms</Link>
                    <span>•</span>
                    <Link to="/aeps-terms" className="hover:text-white transition-colors">AEPS Terms</Link>
                    <span>•</span>
                    <Link to="/aeps-permission" className="hover:text-white transition-colors">AEPS Declaration</Link>
                    <span>•</span>
                    <Link to="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
                    <span>•</span>
                    <span>© {new Date().getFullYear()} Shahparpay Solutions Private Limited</span>
                </div>
            </div>
        </div>
    </footer>
    );
};

export default LandingFooter;
