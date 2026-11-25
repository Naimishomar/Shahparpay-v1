import { AppSidebar } from "@/components/app-sidebar"
import Header from "@/components/Header"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Suspense, useEffect, useRef, useState } from "react"
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
                <div className="sticky top-0 z-50 bg-background/70 backdrop-blur-md border-b border-border">
                    <Header trigger={<SidebarTrigger className="shrink-0 text-foreground transition-transform hover:scale-105"/>}/>
                </div>
                <div className="w-full p-8 flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain no-scrollbar relative">
                    <Suspense fallback={null}>
                        <Outlet />
                    </Suspense>
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
        ...(user?.signupSource === 'self' ? [{ label: 'Registration fee', note: feeDue ? '₹199 by UPI, due now' : '₹199 paid', state: (feeDue ? 'current' : 'done') as StepState }] : []),
        {
            label: 'Admin approval',
            note: rejected ? 'Not approved' : feeDue ? 'Starts once the fee is paid' : 'An admin is checking your documents',
            state: rejected ? 'failed' : feeDue ? 'todo' : 'current',
        },
    ];

    const title = rejected ? 'Account not approved' : feeDue ? 'One step left' : 'Under review';
    const lead = rejected
        ? 'An admin reviewed your signup and could not approve it.'
        : feeDue
        ? `Your details are saved${firstName ? `, ${firstName}` : ''}. Pay the ₹199 registration fee and your signup goes to an admin for approval.`
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

            <main className={`${WRAP} grid gap-10 py-12 sm:py-16 ${feeDue ? 'lg:grid-cols-12 lg:items-start' : ''}`}>
                {/* Intro, then on a phone the payment card straight after it; on a wide screen the card takes the right column. */}
                <div className={feeDue ? 'lg:col-span-6' : ''}>
                    <p className="lp-eyebrow">Retailer signup</p>
                    <h1 className="lp-serif mt-3 text-[44px] leading-[1.02] text-[var(--lp-fg)] sm:text-[60px]">{title}</h1>
                    <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--lp-fg-2)] sm:text-lg">{lead}</p>
                </div>

                {feeDue && (
                    <div className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
                        <SignupFee onPaid={checkSession} />
                    </div>
                )}

                <div className={feeDue ? 'lg:col-span-6' : ''}>
                    <ol className="max-w-md">
                        {steps.map((st, i) => (
                            <li key={st.label} className="relative flex gap-4 pb-7 last:pb-0">
                                {i < steps.length - 1 && (
                                    <span aria-hidden className={`absolute left-[13px] top-8 bottom-1 w-px ${st.state === 'done' ? 'bg-[var(--lp-fg)]' : 'bg-[var(--lp-border-strong)]'}`} />
                                )}
                                <span
                                    className={`relative flex size-7 flex-none items-center justify-center rounded-full text-[13px] ${
                                        st.state === 'done' ? 'bg-[var(--lp-fg)] text-[var(--lp-bg)]'
                                        : st.state === 'current' ? 'bg-[var(--lp-accent)] text-white'
                                        : st.state === 'failed' ? 'bg-[var(--lp-danger)] text-white'
                                        : 'border border-[var(--lp-border-strong)] text-[var(--lp-muted)]'
                                    }`}
                                >
                                    {st.state === 'done' ? <Check aria-hidden size={14} strokeWidth={2.5} /> : st.state === 'failed' ? <XCircle aria-hidden size={14} strokeWidth={2} /> : i + 1}
                                </span>
                                <div className="pt-0.5">
                                    <p className={`text-[15px] ${st.state === 'todo' ? 'text-[var(--lp-muted)]' : 'text-[var(--lp-fg)]'}`}>{st.label}</p>
                                    <p className="mt-0.5 text-sm text-[var(--lp-muted)]">{st.note}</p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    {feeDue && (
                        <p className="mt-10 max-w-md border-l-2 border-[var(--lp-warn-line)] pl-4 text-sm leading-relaxed text-[var(--lp-fg-2)]">
                            Until the fee is paid, your signup is not sent for approval and your account stays inactive.
                        </p>
                    )}

                    {rejected && (
                        <div className="mt-10 max-w-md space-y-4">
                            {user?.verificationNote && (
                                <div className={ALERT_ERROR}>
                                    <p className="text-xs opacity-80">Reason</p>
                                    <p className="mt-1 whitespace-pre-wrap">{user.verificationNote}</p>
                                </div>
                            )}
                            <p className="text-[15px] leading-relaxed text-[var(--lp-fg-2)]">
                                Call <a href="tel:+918240039776" className="lp-figure text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">+91 8240039776</a> or write to{' '}
                                <a href="mailto:shahparpay@gmail.com" className="text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">shahparpay@gmail.com</a>.
                            </p>
                        </div>
                    )}

                    {!feeDue && !rejected && (
                        <button type="button" onClick={checkAgain} disabled={checking} className={`${BTN_PRIMARY} mt-10`}>
                            {checking ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <RefreshCcw aria-hidden size={16} strokeWidth={1.75} />}
                            {checking ? 'Checking…' : 'Check again'}
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
};

type FeeQr = { transactionId: string; qrImage: string; qrUpi?: string | null; amount: number };

/** The ₹199 signup fee, paid by UPI QR; ₹10 of it lands in the Utility Wallet. */
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
        <section aria-label="Pay the registration fee" className="hd-window overflow-hidden rounded-2xl bg-[var(--hd-surface)]">
            <div className="flex items-end justify-between gap-4 border-b border-[var(--hd-line)] px-6 py-5">
                <div>
                    <p className="text-sm text-[var(--hd-ink-3)]">Registration fee</p>
                    <p className="lp-figure mt-1 text-[32px] leading-none tracking-[-0.02em] text-[var(--hd-ink)]">₹199</p>
                </div>
                <p className="text-sm text-[var(--hd-ink-2)]">Any UPI app</p>
            </div>

            <div className="px-6 py-6">
                {qr ? (
                    <div className="flex flex-col items-center">
                        <div className="rounded-xl bg-white p-3 ring-1 ring-[var(--hd-line)]">
                            {qr.qrUpi
                                ? <QRCodeSVG value={qr.qrUpi} size={208} fgColor="#16142e" bgColor="#ffffff" />
                                : <img src={qr.qrImage} alt="UPI QR for the ₹199 registration fee" className="h-auto w-52" />}
                        </div>
                        <p className="mt-4 flex items-center gap-2 text-sm text-[var(--hd-ink-2)]">
                            <Loader2 aria-hidden size={14} className="animate-spin" /> Waiting for payment
                        </p>
                        {/* On a phone the QR cannot be scanned from its own screen; open the UPI app instead. */}
                        {qr.qrUpi && (
                            <a href={qr.qrUpi} className={`${BTN_PRIMARY} mt-5 w-full sm:hidden`}>
                                <Smartphone aria-hidden size={16} strokeWidth={1.75} /> Pay with a UPI app
                            </a>
                        )}
                    </div>
                ) : (
                    <button type="button" onClick={start} disabled={loading} className={`${BTN_PRIMARY} w-full`}>
                        {loading ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <QrCode aria-hidden size={16} strokeWidth={1.75} />}
                        {loading ? 'Generating QR…' : 'Generate payment QR'}
                    </button>
                )}
            </div>

            <div className="border-t border-[var(--hd-line)] px-6 py-4 text-sm leading-relaxed text-[var(--hd-ink-2)]">
                Your signup goes to an admin the moment the payment lands. ₹10 of it is added to your Utility Wallet for the AEPS onboarding fee.
                {qr && <p className="lp-figure mt-2 text-xs text-[var(--hd-ink-3)]">Ref {qr.transactionId}</p>}
            </div>
        </section>
    );
};

export default Layout
