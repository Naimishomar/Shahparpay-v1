import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, CheckCircle2, Fingerprint, Loader2, Wallet } from 'lucide-react';

/**
 * The landing hero: an AEPS cash withdrawal in the retailer portal, told as one
 * loop. The retailer types the amount, the customer scans a finger, the slip
 * prints and the commission lands in the wallet. Illustration only; nothing here
 * talks to the backend. Figures follow the rate card: ₹3,000 earns ₹11.
 */

const WIDE = { w: 720, h: 460 };
const COMPACT = { w: 358, h: 600 };
const AMOUNT = '3000';
const COMMISSION = 11;
const START_BALANCE = 48250;
const TRAVEL = [0.45, 0, 0.1, 1] as const;
const ARRIVE = [0.25, 0.8, 0.25, 1] as const;

type Btn = 'idle' | 'scanning' | 'done';
type Scene = { amount: string; focused: boolean; btn: Btn; slip: boolean; balance: number };

const POSTER: Scene = { amount: AMOUNT, focused: false, btn: 'done', slip: true, balance: START_BALANCE + COMMISSION };
const OPENING: Scene = { amount: '', focused: false, btn: 'idle', slip: false, balance: START_BALANCE };

const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const grouped = (digits: string) => (digits ? Number(digits).toLocaleString('en-IN') : '');

/** Changed digits roll; unchanged ones stay still. Keyed from the right so places line up. */
function Roll({ value }: { value: string }) {
    const chars = value.split('');
    return (
        <span className="inline-flex overflow-hidden align-bottom">
            {chars.map((c, i) => (
                <span key={chars.length - i} className="relative inline-block">
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.span
                            key={c}
                            className="inline-block"
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '-100%', opacity: 0 }}
                            transition={{ duration: 0.45, ease: TRAVEL, delay: (chars.length - i) * 0.04 }}
                        >
                            {c}
                        </motion.span>
                    </AnimatePresence>
                </span>
            ))}
        </span>
    );
}

const Bar = ({ w, className = '' }: { w: number; className?: string }) => (
    <span aria-hidden className={`block h-[6px] rounded-full bg-[var(--hd-bar)] ${className}`} style={{ width: w }} />
);

function Cursor({ x, y, pressed, visible }: { x: number; y: number; pressed: boolean; visible: boolean }) {
    return (
        <motion.div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-30"
            initial={false}
            animate={{ x, y, opacity: visible ? 1 : 0, scale: pressed ? 0.88 : 1 }}
            transition={{ x: { duration: 0.75, ease: TRAVEL }, y: { duration: 0.75, ease: TRAVEL }, scale: { duration: 0.12 }, opacity: { duration: 0.3 } }}
            style={{ transformOrigin: '2px 2px' }}
        >
            <svg width="22" height="22" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.25))' }}>
                <path d="M3 2.5v17.2l4.6-4.4 2.9 6.6 3-1.3-2.9-6.5h6.3z" fill="#16142e" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
        </motion.div>
    );
}

const Field = ({ label, children, focused = false, fieldRef }: { label: string; children: React.ReactNode; focused?: boolean; fieldRef?: React.Ref<HTMLDivElement> }) => (
    <div>
        <div className="text-[12px] leading-[1.3] text-[var(--hd-ink-3)]">{label}</div>
        <div
            ref={fieldRef}
            className={`mt-1.5 flex h-10 items-center rounded-[9px] border bg-white px-3 text-[14px] text-[var(--hd-ink)] transition-[border-color,box-shadow] duration-150 ${
                focused ? 'border-[var(--hd-primary)] shadow-[0_0_0_3px_rgba(22,20,46,0.08)]' : 'border-[var(--hd-line-strong)]'
            }`}
        >
            {children}
        </div>
    </div>
);

/** The slip a customer takes home, arriving as the satellite. */
function Slip({ compact }: { compact: boolean }) {
    return (
        <div className="lp-receipt-wrap">
            <div className="lp-receipt rounded-t-[12px] px-4 pt-4" style={{ width: compact ? 230 : 228 }}>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-[var(--hd-ink-3)]">AEPS · SBI</span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--lp-positive)]">
                        <CheckCircle2 aria-hidden className="size-3.5" strokeWidth={2} /> Success
                    </span>
                </div>
                <div className="lp-figure mt-3 text-[26px] leading-none tracking-[-0.02em] text-[var(--hd-ink)]">₹3,000.00</div>
                <div className="mt-1.5 text-[12px] text-[var(--hd-ink-2)]">Paid to Sunita Devi</div>
                <hr className="lp-tear my-3.5" />
                <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="text-[var(--hd-ink-2)]">Your commission</span>
                    <span className="lp-figure text-[13px] text-[var(--lp-accent-ink)]">+₹{COMMISSION}.00</span>
                </div>
            </div>
        </div>
    );
}

export default function HeroDemo() {
    const hostRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const amountRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const againRef = useRef<HTMLButtonElement>(null);

    const [hostW, setHostW] = useState(0);
    const [inView, setInView] = useState(false);
    const reduced = useReducedMotion() ?? false;
    const [scene, setScene] = useState<Scene>(POSTER);
    const [cursor, setCursor] = useState({ x: 0, y: 0, pressed: false, visible: false });

    const compact = hostW > 0 && hostW < 560;
    const D = compact ? COMPACT : WIDE;
    const scale = hostW ? hostW / D.w : 1;

    useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setHostW(e.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
        if (hostRef.current) io.observe(hostRef.current);
        return () => io.disconnect();
    }, []);

    // The script. Runs only on screen and only when motion is welcome; otherwise the poster holds.
    useEffect(() => {
        if (!inView || reduced || !hostW) return;
        let alive = true;
        const wait = (ms: number) => new Promise<void>((r, j) => setTimeout(() => (alive ? r() : j(new Error('stop'))), ms));
        const at = (el: HTMLElement | null, fx: number, fy: number) => {
            const s = stageRef.current?.getBoundingClientRect();
            const r = el?.getBoundingClientRect();
            if (!s || !r) return { x: 0, y: 0 };
            return { x: (r.left - s.left + r.width * fx) / scale, y: (r.top - s.top + r.height * fy) / scale };
        };
        const move = async (p: { x: number; y: number }) => { setCursor((c) => ({ ...c, ...p, visible: true })); await wait(800); };
        const press = async () => { setCursor((c) => ({ ...c, pressed: true })); await wait(130); setCursor((c) => ({ ...c, pressed: false })); };
        const rest = compact ? { x: 322, y: 556 } : { x: 650, y: 262 };

        (async () => {
            setScene((s) => ({ ...OPENING, balance: s.balance }));
            setCursor({ ...rest, pressed: false, visible: true });
            await wait(900);
            for (;;) {
                await move(at(amountRef.current, 0.78, 0.6));
                await press();
                setScene((s) => ({ ...s, focused: true }));
                for (let i = 1; i <= AMOUNT.length; i++) {
                    await wait(120);
                    setScene((s) => ({ ...s, amount: AMOUNT.slice(0, i) }));
                }
                await wait(350);
                setScene((s) => ({ ...s, focused: false }));
                await move(at(buttonRef.current, 0.93, 0.72));
                await press();
                setScene((s) => ({ ...s, btn: 'scanning' }));
                await wait(1500);
                setScene((s) => ({ ...s, btn: 'done' }));
                await wait(300);
                setScene((s) => ({ ...s, slip: true }));
                await move(rest);
                setScene((s) => ({ ...s, balance: s.balance + COMMISSION }));
                await wait(2400);
                // Seen reset: the retailer starts the next customer's withdrawal.
                await move(at(againRef.current, 0.7, 0.6));
                await press();
                setScene((s) => ({ ...s, slip: false, btn: 'idle', amount: '' }));
                await wait(700);
            }
        })().catch(() => {});

        return () => {
            alive = false;
            setScene(POSTER);
            setCursor((c) => ({ ...c, visible: false }));
        };
    }, [inView, reduced, hostW, scale, compact, D.w]);

    const { amount, focused, btn, slip, balance } = scene;

    // Corner bleed: the window starts a gutter in (plus half the slip in the wide design) and runs off right and bottom.
    const win = compact ? { left: 16, top: 16, width: 420, height: 640 } : { left: 140, top: 36, width: 720, height: 520 };

    return (
        <div ref={hostRef} className="hero-demo relative w-full" style={{ height: D.h * scale || undefined, aspectRatio: hostW ? undefined : `${WIDE.w} / ${WIDE.h}` }}>
            <div
                ref={stageRef}
                role="img"
                aria-label="Retailer portal: an AEPS cash withdrawal of ₹3,000 succeeds and ₹11 commission is credited to the wallet."
                className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-[20px]"
                style={{ width: D.w, height: D.h, transform: `scale(${scale})` }}
            >
                {/* Window */}
                <div className="hd-window absolute flex flex-col overflow-hidden rounded-[14px] bg-white" style={win}>
                    <div className="flex h-[38px] flex-none items-center gap-2 border-b border-[var(--hd-line)] bg-[#f7f6f3] px-3.5">
                        <span className="flex gap-1.5" aria-hidden>
                            {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} className="size-[10px] rounded-full" style={{ background: c }} />)}
                        </span>
                        <span className="mx-auto flex h-[22px] w-[200px] items-center justify-center rounded-md bg-white text-[11px] text-[var(--hd-ink-3)] ring-1 ring-[var(--hd-line)]" style={{ marginLeft: compact ? 24 : 140 }}>
                            shahparpay.com/aeps
                        </span>
                    </div>

                    <div className="flex min-h-0 flex-1">
                        {!compact && (
                            <div className="flex w-[150px] flex-none flex-col gap-1 border-r border-[var(--hd-line)] bg-[#fbfaf8] px-2.5 py-4">
                                <div className="flex h-8 items-center px-2.5"><Bar w={64} /></div>
                                <div className="flex h-8 items-center gap-2 rounded-lg bg-[var(--hd-primary)] px-2.5 text-[13px] text-white">
                                    <Fingerprint aria-hidden className="size-4" strokeWidth={1.75} /> AEPS
                                </div>
                                {[86, 58, 44, 70, 52, 62].map((w, i) => (
                                    <div key={i} className="flex h-8 items-center px-2.5"><Bar w={w} /></div>
                                ))}
                            </div>
                        )}

                        <div className="min-w-0 flex-1 px-6 pt-5">
                            <div className="flex items-center justify-between gap-4" style={{ maxWidth: compact ? 302 : 382 }}>
                                <div className="text-[18px] font-medium tracking-[-0.01em] text-[var(--hd-ink)]">Cash withdrawal</div>
                                <div className="flex h-8 flex-none items-center gap-1.5 rounded-full bg-[#f2f0eb] px-3 text-[13px] text-[var(--hd-ink)]">
                                    <Wallet aria-hidden className="size-3.5 text-[var(--hd-ink-3)]" strokeWidth={1.75} />
                                    <span className="lp-figure">₹<Roll value={inr(balance)} /></span>
                                </div>
                            </div>

                            <div className="mt-4 flex gap-1.5" aria-hidden>
                                <span className="flex h-7 items-center rounded-md bg-[#f2f0eb] px-2.5"><Bar w={52} /></span>
                                <span className="flex h-7 items-center rounded-md bg-white px-2.5 text-[12px] text-[var(--hd-ink)] ring-1 ring-[var(--hd-line-strong)]">Withdraw</span>
                                <span className="flex h-7 items-center rounded-md bg-[#f2f0eb] px-2.5"><Bar w={40} /></span>
                                {!compact && <span className="flex h-7 items-center rounded-md bg-[#f2f0eb] px-2.5"><Bar w={46} /></span>}
                            </div>

                            <div className="mt-5 grid gap-3.5" style={{ width: compact ? 290 : 300 }}>
                                <Field label="Customer Aadhaar"><span className="lp-figure">XXXX XXXX 4410</span></Field>
                                <Field label="Bank">State Bank of India</Field>
                                <Field label="Amount" focused={focused} fieldRef={amountRef}>
                                    <span className="lp-figure">{amount ? `₹${grouped(amount)}` : <span className="text-[var(--hd-ink-3)]">₹0</span>}</span>
                                    {focused && <span aria-hidden className="hd-caret ml-px h-[18px] w-px bg-[var(--hd-ink)]" />}
                                </Field>

                                <div className="mt-1 flex items-center gap-3">
                                    <button
                                        ref={buttonRef}
                                        type="button"
                                        tabIndex={-1}
                                        className={`relative grid h-10 flex-none place-items-center rounded-[9px] px-4 text-[14px] font-medium text-white transition-colors duration-200 ${btn === 'done' ? 'bg-[#15803d]' : 'bg-[var(--hd-primary)]'}`}
                                    >
                                        {/* All three labels share one slot; the widest sets the footprint. */}
                                        {([
                                            ['idle', <><Fingerprint aria-hidden className="size-4" strokeWidth={1.75} /> Scan fingerprint</>],
                                            ['scanning', <><Loader2 aria-hidden className="size-4 animate-spin" strokeWidth={2} /> Matching…</>],
                                            ['done', <><Check aria-hidden className="size-4" strokeWidth={2.25} /> Cash paid</>],
                                        ] as const).map(([k, label]) => (
                                            <span
                                                key={k}
                                                className="col-start-1 row-start-1 inline-flex items-center gap-2 transition-[opacity,transform] duration-200"
                                                style={{ opacity: btn === k ? 1 : 0, transform: btn === k ? 'none' : 'translateY(4px)' }}
                                            >
                                                {label}
                                            </span>
                                        ))}
                                    </button>
                                    <button
                                        ref={againRef}
                                        type="button"
                                        tabIndex={-1}
                                        className="h-10 rounded-[9px] px-2 text-[13px] text-[var(--hd-ink-2)] transition-opacity duration-300"
                                        style={{ opacity: btn === 'done' ? 1 : 0 }}
                                    >
                                        Next customer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Satellite: the slip, straddling the window's sidebar edge (wide) or rising over the empty foot (compact). */}
                <AnimatePresence>
                    {slip && (
                        <motion.div
                            key="slip"
                            className="absolute z-20"
                            style={compact ? { left: 64, top: 432 } : { left: 24, top: 248 }}
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 320, transition: { duration: 0.55, ease: [0.55, 0, 0.75, 0.2] } }}
                            transition={{ duration: 0.9, ease: ARRIVE }}
                        >
                            <Slip compact={compact} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <Cursor {...cursor} />
            </div>
        </div>
    );
}
