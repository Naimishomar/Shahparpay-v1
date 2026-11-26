import { AppSidebar } from "@/components/app-sidebar"
import Header from "@/components/Header"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Suspense, useEffect, useRef, useState } from "react"
import { MotionConfig } from "motion/react"
import axios from "axios"
import { Check, Loader2, LogOut, QrCode, RefreshCcw, Smartphone, XCircle } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { ALERT_ERROR, BTN_PRIMARY, BTN_SECONDARY, WRAP } from "../components/landing/ui"
import ThemeToggle from "../components/landing/ThemeToggle"
import logo from "../assets/logo.png"
import "./landing.css"
import { Outlet, Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import SupportWidget from "../components/SupportWidget"
import { LocationProvider } from "../context/LocationContext"

const Layout = () => {
    const { user, token } = useAuth();

    const location = useLocation();

    // Admin and distributor portals take the public site's look (index.css, html.lp-portal).
    // On <html> so dialogs and popovers rendered outside this tree get it too.
    const pro = user?.role === 'admin' || user?.role === 'distributor';
    useEffect(() => {
        document.documentElement.classList.toggle('lp-portal', pro);
        return () => document.documentElement.classList.remove('lp-portal');
    }, [pro]);

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (user?.role === 'admin' && !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/reports/')) return <Navigate to="/admin" replace />;
    if (user?.role === 'distributor' && !location.pathname.startsWith('/distributor') && location.pathname !== '/support') return <Navigate to="/distributor" replace />;
    // A self-signed-up retailer sees nothing else until an admin approves them.
    if (user?.role === 'retailer' && (user.verificationStatus === 'pending' || user.verificationStatus === 'rejected')) return <UnderVerification />;

    return (
        // Only retailers move money; admins and distributors are never asked for location.
        <LocationProvider required={user?.role === 'retailer'}>
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 h-svh min-h-0 bg-background top-glow text-foreground flex flex-col overflow-hidden w-full relative">
                {/* Ambient glows behind every retailer page (index.css, .portal-ambient). */}
                {user?.role === 'retailer' && <div aria-hidden className="portal-ambient"><span /><span /><span /></div>}
                <div className="sticky top-0 z-50 bg-background/70 backdrop-blur-md border-b border-border">
                    <Header trigger={<SidebarTrigger className="shrink-0 text-foreground transition-transform hover:scale-105"/>}/>
                </div>
                <div className="w-full p-8 flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain no-scrollbar relative">
                    {/* Retailer pages arrive in stageshow beats (index.css, .stage-page). */}
                    <div className={user?.role === 'retailer' ? 'stage-page' : undefined}>
                        {/* Motion follows the reduce-motion setting everywhere in the portal. */}
                        <MotionConfig reducedMotion="user">
                            <Suspense fallback={null}>
                                <Outlet />
                            </Suspense>
                        </MotionConfig>
                    </div>
                </div>
                <SupportWidget />
            </main>
        </SidebarProvider>
        </LocationProvider>
    )
}

/*
 * The screens a self-signed-up retailer sees before approval. They are still
 * outside the portal, so they wear the public site: its tokens, its theme
 * switch, its controls. One status timeline on the left, the one thing to do
 * on the right.
 */
type StepState = 'done' | 'current' | 'todo' | 'failed';

const UnderVerification = () => {
    const { user, checkSession, logout } = useAuth();
    const [checking, setChecking] = useState(false);
    const rejected = user?.verificationStatus === 'rejected';
    const feeDue = !rejected && user?.signupSource === 'self' && !user.signupFeePaidAt;
    const firstName = user?.name?.split(' ')[0];

    const checkAgain = async () => {
        setChecking(true);
        // Refreshing the session re-reads the user, verification status included.
        await checkSession();
        setChecking(false);
        const fresh = JSON.parse(localStorage.getItem('user') || 'null');
        if (fresh?.verificationStatus === 'pending') toast.info('Still under review. We will let you in as soon as an admin approves your account.');
        else if (fresh?.verificationStatus === 'rejected') toast.error('Your account was not approved.');
    };

    const steps: { label: string; note: string; state: StepState }[] = [
        { label: 'Details', note: 'Account, KYC and shop saved', state: 'done' },
        // Only a self signup pays the fee; a retailer added by a distributor skips it.
        ...(user?.signupSource === 'self' ? [{ label: 'Onboarding charge', note: feeDue ? '₹99 by UPI, due now' : '₹99 paid', state: (feeDue ? 'current' : 'done') as StepState }] : []),
        {
            label: 'Admin approval',
            note: rejected ? 'Not approved' : feeDue ? 'Starts once the fee is paid' : 'An admin is checking your documents',
            state: rejected ? 'failed' : feeDue ? 'todo' : 'current',
        },
    ];

    const title = rejected ? 'Account not approved' : feeDue ? 'Pay the ₹99 onboarding charge' : 'Under review';
    const lead = rejected
        ? 'An admin reviewed your signup and could not approve it.'
        : feeDue
        ? `Your details are saved${firstName ? `, ${firstName}` : ''}. Pay the one-time onboarding charge below and your signup goes to an admin for approval.`
        : `Thanks for signing up${firstName ? `, ${firstName}` : ''}. An admin is checking your details and documents; you can use the portal once they approve your account.`;

    return (
        <div className="landing-page min-h-screen">
            <header className="border-b border-[var(--lp-border)]">
                <div className={`${WRAP} flex h-16 items-center justify-between gap-4`}>
                    <img src={logo} alt="Shahparpay" className="lp-logo h-8 w-auto object-contain sm:h-9" />
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button type="button" onClick={() => logout()} className={`${BTN_SECONDARY} h-10 px-3.5 text-sm`}>
                            <LogOut aria-hidden strokeWidth={1.5} className="size-4" /> Log out
                        </button>
                    </div>
                </div>
            </header>

            {/* One centred column: where the signup stands, then the one thing to do. */}
            <main className="mx-auto w-full max-w-xl px-4 py-10 text-center sm:py-14">
                <ol aria-label="Signup progress" className="flex items-center justify-center gap-2">
                    {steps.map((st, i) => (
                        <li key={st.label} className="flex items-center gap-2">
                            <span
                                aria-current={st.state === 'current' ? 'step' : undefined}
                                className={`flex size-6 flex-none items-center justify-center rounded-full text-[12px] ${
                                    st.state === 'done' ? 'bg-[var(--lp-fg)] text-[var(--lp-bg)]'
                                    : st.state === 'current' ? 'bg-[var(--lp-accent)] text-white'
                                    : st.state === 'failed' ? 'bg-[var(--lp-danger)] text-white'
                                    : 'border border-[var(--lp-border-strong)] text-[var(--lp-muted)]'
                                }`}
                            >
                                {st.state === 'done' ? <Check aria-hidden size={12} strokeWidth={3} /> : st.state === 'failed' ? <XCircle aria-hidden size={12} strokeWidth={2.5} /> : i + 1}
                            </span>
                            <span className={`whitespace-nowrap text-[13px] ${st.state === 'current' ? '' : 'hidden sm:inline'} ${st.state === 'todo' ? 'text-[var(--lp-muted)]' : 'text-[var(--lp-fg)]'}`}>{st.label}</span>
                            {i < steps.length - 1 && <span aria-hidden className={`h-px w-4 flex-none sm:w-10 ${st.state === 'done' ? 'bg-[var(--lp-fg)]' : 'bg-[var(--lp-border-strong)]'}`} />}
                        </li>
                    ))}
                </ol>

                <h1 className="lp-serif mt-10 text-balance text-[40px] leading-[1.04] text-[var(--lp-fg)] sm:text-[52px]">{title}</h1>
                <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[var(--lp-fg-2)]">{lead}</p>

                {feeDue && (
                    <div className="mt-8">
                        <SignupFee onPaid={checkSession} />
                        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[var(--lp-muted)]">
                            Until the onboarding charge is paid, your signup is not sent for approval and your account stays inactive.
                        </p>
                    </div>
                )}

                {rejected && (
                    <div className="mx-auto mt-8 max-w-md space-y-4 text-left">
                        {user?.verificationNote && (
                            <div className={ALERT_ERROR}>
                                <p className="text-xs opacity-80">Reason</p>
                                <p className="mt-1 whitespace-pre-wrap">{user.verificationNote}</p>
                            </div>
                        )}
                        <p className="text-center text-[15px] leading-relaxed text-[var(--lp-fg-2)]">
                            Call <a href="tel:+918240039776" className="lp-figure text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">+91 8240039776</a> or write to{' '}
                            <a href="mailto:shahparpay@gmail.com" className="text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">shahparpay@gmail.com</a>.
                        </p>
                    </div>
                )}

                {!feeDue && !rejected && (
                    <button type="button" onClick={checkAgain} disabled={checking} className={`${BTN_PRIMARY} mt-8`}>
                        {checking ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <RefreshCcw aria-hidden size={16} strokeWidth={1.75} />}
                        {checking ? 'Checking…' : 'Check again'}
                    </button>
                )}
            </main>
        </div>
    );
};

type FeeQr = { transactionId: string; qrImage: string; qrUpi?: string | null; amount: number };

/** The ₹99 onboarding charge, paid by UPI QR; ₹10 of it lands in the Utility Wallet. */
const SignupFee = ({ onPaid }: { onPaid: () => Promise<void> }) => {
    const api = import.meta.env.VITE_BACKEND_URL;
    const [qr, setQr] = useState<FeeQr | null>(null);
    const [loading, setLoading] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const paid = async () => {
        if (pollRef.current) clearInterval(pollRef.current);
        toast.success('Payment received. Your registration is sent to the admin for approval, and ₹10 is added to your Utility Wallet.');
        await onPaid();
    };

    const start = async () => {
        setLoading(true);
        try {
            const { data } = await axios.post(`${api}/api/auth/signup-fee/qr`);
            if (data.data.status === 'SUCCESS') return paid();
            setQr(data.data);
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = setInterval(async () => {
                try {
                    const res = await axios.get(`${api}/api/auth/signup-fee/status/${data.data.transactionId}`);
                    const status = res.data?.data?.status;
                    if (status === 'SUCCESS') paid();
                    else if (status === 'FAILED') {
                        if (pollRef.current) clearInterval(pollRef.current);
                        setQr(null);
                        toast.error('The QR expired. Generate a new one.');
                    }
                } catch { /* a dropped poll is not a failed payment; the webhook still settles it */ }
            }, 4000);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Could not generate the payment QR.');
        } finally {
            setLoading(false);
        }
    };

    // The QR opens with the screen; the button is only for after it expires.
    useEffect(() => {
        start();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    return (
        <section aria-label="Pay the onboarding charge" className="rounded-2xl border border-[var(--lp-border-strong)] bg-[var(--lp-card)] p-6 sm:p-8">
            {qr ? (
                <>
                    <p className="text-[15px] text-[var(--lp-fg)]">Onboarding charge · scan with any UPI app and pay</p>
                    {/* The QR's own amount: one opened before the charge changed still asks for what it was made for. */}
                    <p className="lp-figure mt-1 text-[36px] leading-none tracking-[-0.02em] text-[var(--lp-fg)]">₹{qr.amount || 99}</p>
                    <div className="mx-auto mt-6 w-fit rounded-xl bg-white p-3 ring-1 ring-[var(--lp-border)]">
                        {qr.qrUpi
                            ? <QRCodeSVG value={qr.qrUpi} size={232} fgColor="#16142e" bgColor="#ffffff" />
                            : <img src={qr.qrImage} alt={`UPI QR for the ₹${qr.amount || 99} onboarding charge`} className="h-auto w-[232px]" />}
                    </div>
                    {/* On a phone the QR cannot be scanned from its own screen; open the UPI app instead. */}
                    {qr.qrUpi && (
                        <a href={qr.qrUpi} className={`${BTN_PRIMARY} mt-6 w-full sm:hidden`}>
                            <Smartphone aria-hidden size={16} strokeWidth={1.75} /> Pay ₹{qr.amount || 99} with a UPI app
                        </a>
                    )}
                    <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[var(--lp-fg-2)]">
                        <Loader2 aria-hidden size={14} className="animate-spin" /> Waiting for your payment. This page moves on by itself.
                    </p>
                    <hr className="my-6 border-[var(--lp-border)]" />
                    <p className="text-sm leading-relaxed text-[var(--lp-muted)]">
                        ₹10 of it is added to your Utility Wallet for the AEPS onboarding fee.
                    </p>
                    <p className="lp-figure mt-2 text-xs text-[var(--lp-muted)]">Ref {qr.transactionId}</p>
                </>
            ) : (
                <>
                    <p className="text-[15px] text-[var(--lp-fg)]">Onboarding charge</p>
                    <p className="lp-figure mt-1 text-[36px] leading-none tracking-[-0.02em] text-[var(--lp-fg)]">₹99</p>
                    <button type="button" onClick={start} disabled={loading} className={`${BTN_PRIMARY} mt-6 w-full`}>
                        {loading ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <QrCode aria-hidden size={16} strokeWidth={1.75} />}
                        {loading ? 'Generating QR…' : 'Show payment QR'}
                    </button>
                </>
            )}
        </section>
    );
};

export default Layout
