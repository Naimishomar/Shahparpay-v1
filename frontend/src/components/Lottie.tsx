import { useEffect, useRef, useState, type CSSProperties } from 'react';

/*
 * The portal's Lottie animations, all from LottieFiles under the Lottie Simple
 * License, kept as JSON in src/assets/lottie:
 *   empty    "Search file", recoloured lavender: empty lists
 *   loading  "Loading": a page on its way
 *   payment  "Payment successful": a payment that went through
 *   confetti "Success confetti": one burst over a success
 *   update   "App update": a service not switched on yet
 * The player and each animation load only when shown. Under reduced motion an
 * animation holds a still frame and a one-shot one is skipped (onComplete).
 */
const FILES = {
    empty: () => import('../assets/lottie/empty-search.json'),
    loading: () => import('../assets/lottie/loading.json'),
    payment: () => import('../assets/lottie/payment-success.json'),
    confetti: () => import('../assets/lottie/confetti.json'),
    update: () => import('../assets/lottie/app-update.json'),
};

type Props = {
    name: keyof typeof FILES;
    size?: number | string;
    loop?: boolean;
    onComplete?: () => void;
    className?: string;
    style?: CSSProperties;
};

export default function Lottie({ name, size = 112, loop = true, onComplete, className, style }: Props) {
    const box = useRef<HTMLDivElement>(null);
    const done = useRef(onComplete);
    useEffect(() => { done.current = onComplete; });
    useEffect(() => {
        let anim: { destroy: () => void } | undefined;
        let gone = false;
        Promise.all([import('lottie-web/build/player/lottie_light'), FILES[name]()])
            .then(([{ default: lottie }, { default: animationData }]) => {
                if (gone || !box.current) return;
                const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (still && !loop) { done.current?.(); return; }
                const a = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop: loop && !still, autoplay: !still, animationData });
                if (still) a.goToAndStop(a.totalFrames / 2, true);
                a.addEventListener('complete', () => done.current?.());
                anim = a;
            })
            .catch(() => done.current?.()); // no picture is fine; whatever it decorates still shows
        return () => { gone = true; anim?.destroy(); };
    }, [name, loop]);
    return <div ref={box} aria-hidden className={className} style={{ width: size, height: size, ...style }} />;
}

/** One confetti burst over the whole screen, once per mount; it removes itself when done. */
export function Confetti() {
    const [on, setOn] = useState(true);
    if (!on) return null;
    return <Lottie name="confetti" loop={false} onComplete={() => setOn(false)} size="min(100vw, 100vh)" style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 110, pointerEvents: 'none' }} />;
}
