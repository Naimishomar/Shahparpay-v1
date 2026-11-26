import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationControls, useDragControls, useReducedMotion } from 'motion/react';
import { ChevronsUp, X } from 'lucide-react';

/*
 * A receipt that prints. Our own take on a thermal printer: the head sits on
 * top with its slot and status light, the paper feeds out line by line with a
 * torn bottom edge, the actions arrive once it has printed, and closing tears
 * the slip off upwards (pull the perforated strip, press X or Esc, or click
 * outside). Under reduced motion it simply appears and disappears.
 *
 * The receipt content is the caller's: keep a ref on it for PDF/PNG export,
 * since the paper wrapper moves while printing.
 */

type Props = {
    label: string;
    onClose: () => void;
    children: ReactNode;
    /** Buttons under the paper, shown once printing is done. */
    actions?: ReactNode;
    /** Tailwind max-width for the slip. */
    width?: string;
};

const FEED = [0.32, 0, 0.18, 1] as const;
const TEAR = [0.55, 0, 0.75, 0.2] as const;

const ReceiptPrinter = ({ label, onClose, children, actions, width = 'max-w-md' }: Props) => {
    const reduced = useReducedMotion() ?? false;
    const paper = useAnimationControls();
    const drag = useDragControls();
    const [printed, setPrinted] = useState(reduced);
    const [tearing, setTearing] = useState(false);

    useEffect(() => {
        if (reduced) return;
        let alive = true;
        // A short pause while the head warms up, then the slip feeds out.
        paper.start({ y: '0%', transition: { duration: 1.5, ease: FEED, delay: 0.35 } }).then(() => { if (alive) setPrinted(true); });
        return () => { alive = false; };
    }, [paper, reduced]);

    const tear = async () => {
        if (tearing) return;
        setTearing(true);
        if (!reduced) await paper.start({ y: -60, rotate: -2.5, opacity: 0, transition: { duration: 0.42, ease: TEAR } });
        onClose();
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') tear(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tearing]);

    return (
        <div role="dialog" aria-modal="true" aria-label={label} onClick={tear} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center">
            <div onClick={(e) => e.stopPropagation()} className={`relative w-full ${width}`}>
                {/* The printer head: slot, status light, close. */}
                <motion.div
                    initial={reduced ? false : { y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.45, ease: [0.25, 0.8, 0.25, 1] }}
                    className="relative z-10 rounded-2xl bg-gradient-to-b from-[#3a3946] to-[#24232c] px-4 pb-4 pt-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
                >
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
                            <span className={`h-2 w-2 rounded-full ${printed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]' : 'animate-pulse bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]'}`} />
                            {printed ? 'Printed' : 'Printing…'}
                        </span>
                        <button type="button" onClick={tear} aria-label="Close" className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    {/* The slot the paper comes out of. */}
                    <div className="mt-3 h-2 rounded-full bg-black/70 shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)]" />
                </motion.div>

                {/* Paper: clipped under the slot so it reads as coming out of it. */}
                <div className="relative -mt-2 overflow-hidden px-3 pt-2">
                    <div aria-hidden className="pointer-events-none absolute inset-x-3 top-2 z-10 h-4 bg-gradient-to-b from-black/25 to-transparent" />
                    <motion.div
                        animate={paper}
                        initial={reduced ? false : { y: '-100%' }}
                        drag={printed && !tearing ? 'y' : false}
                        dragListener={false}
                        dragControls={drag}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0.6, bottom: 0.05 }}
                        onDragEnd={(_, info) => { if (info.offset.y < -70 || info.velocity.y < -500) tear(); }}
                        className="receipt-paper relative bg-white text-slate-800 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
                    >
                        {/* Perforation: pull it up to tear the slip off. */}
                        <button
                            type="button"
                            onPointerDown={(e) => printed && drag.start(e)}
                            onClick={tear}
                            aria-label="Tear off the receipt"
                            className="flex w-full touch-none select-none items-center justify-center gap-1.5 border-b border-dashed border-slate-300 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
                        >
                            <ChevronsUp className="h-3 w-3" /> Pull up to tear
                        </button>
                        <div className="max-h-[62vh] overflow-y-auto no-scrollbar">{children}</div>
                    </motion.div>
                </div>

                <AnimatePresence>
                    {printed && actions && !tearing && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35, ease: [0.25, 0.8, 0.25, 1] }}
                            className="mt-4 flex flex-wrap justify-center gap-3 px-3"
                        >
                            {actions}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ReceiptPrinter;
