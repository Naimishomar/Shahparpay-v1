import { AnimatePresence, motion } from 'motion/react';
import { TRAVEL } from './beats';


/** Changed characters roll; unchanged ones stay still. Keyed from the right so places line up. */
export function Roll({ value }: { value: string }) {
    const chars = value.split('');
    return (
        <span className="inline-flex overflow-hidden align-bottom">
            {chars.map((c, i) => (
                <span key={chars.length - i} className="relative inline-block whitespace-pre">
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

/** Several states of one control in one slot: the largest sets the footprint, the live one fades in. */
export function Slot<K extends string | number>({ at, states, className = '' }: { at: K; states: [K, React.ReactNode][]; className?: string }) {
    return (
        <span className={`grid ${className}`}>
            {states.map(([k, node]) => (
                <span
                    key={k}
                    aria-hidden={k !== at}
                    className="col-start-1 row-start-1 inline-flex items-center gap-1.5 transition-[opacity,transform] duration-300"
                    style={{ opacity: k === at ? 1 : 0, transform: k === at ? 'none' : 'translateY(4px)' }}
                >
                    {node}
                </span>
            ))}
        </span>
    );
}
