import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

/** Stageshow's two curves: travel, and arrival from nowhere. */
export const TRAVEL = [0.45, 0, 0.1, 1] as const;
export const ARRIVE = [0.25, 0.8, 0.25, 1] as const;

/**
 * A small story told in beats: `step` walks 0..beats.length-1 (each held for its
 * beat in ms) while the element is on screen and motion is welcome; otherwise it
 * holds `poster`, the frame that tells the story on its own. `tick` counts every
 * beat ever played, for stories that accumulate instead of rewinding.
 */
export function useBeats<T extends HTMLElement = HTMLDivElement>(beats: number[], poster: number) {
    const ref = useRef<T>(null);
    const inView = useInView(ref, { amount: 0.4 });
    const reduced = useReducedMotion();
    const live = inView && !reduced;
    const [state, setState] = useState({ step: 0, tick: 0 });
    const key = beats.join(',');

    useEffect(() => {
        if (!live) return;
        const lengths = key.split(',').map(Number);
        let i = 0;
        let t: ReturnType<typeof setTimeout>;
        const next = () => {
            t = setTimeout(() => {
                i = (i + 1) % lengths.length;
                setState((s) => ({ step: i, tick: s.tick + 1 }));
                next();
            }, lengths[i]);
        };
        next();
        return () => {
            clearTimeout(t);
            setState((s) => ({ ...s, step: 0 }));
        };
    }, [live, key]);

    return { ref, live, step: live ? state.step : poster, tick: state.tick };
}
