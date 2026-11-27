import { useEffect, useRef } from 'react';

/*
 * The empty-state picture: a magnifier searching a page, from LottieFiles
 * ("Search file", Lottie Simple License), recoloured to the portal's lavender
 * (src/assets/lottie/empty-search.json). The player and the animation load
 * only when an empty state shows. With reduced motion it holds one frame.
 */
export default function LottieEmpty({ size = 112 }: { size?: number }) {
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let anim: { destroy: () => void } | undefined;
        let gone = false;
        Promise.all([
            import('lottie-web/build/player/lottie_light'),
            import('../assets/lottie/empty-search.json'),
        ]).then(([{ default: lottie }, { default: animationData }]) => {
            if (gone || !box.current) return;
            const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const a = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop: !still, autoplay: !still, animationData });
            if (still) a.goToAndStop(60, true);
            anim = a;
        }).catch(() => { /* no picture is fine; the message still shows */ });
        return () => { gone = true; anim?.destroy(); };
    }, []);
    return <div ref={box} aria-hidden style={{ width: size, height: size }} />;
}
