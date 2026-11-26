import type { CSSProperties, HTMLAttributes } from 'react';
import { useTheme } from 'next-themes';
import SpotlightCard from './SpotlightCard';

/**
 * React Bits' SpotlightCard dressed as a portal card: the card colour, border
 * and shadow are the theme's own, and the light that follows the pointer is
 * the brand lavender. Give it the radius and padding the card had.
 */
const PortalSpotlight = ({ style, ...rest }: HTMLAttributes<HTMLDivElement>) => {
    const { resolvedTheme } = useTheme();
    const dark = resolvedTheme === 'dark';
    return (
        <SpotlightCard
            theme={dark ? 'dark' : 'light'}
            spotlightColor={dark ? '#B9A8F0' : '#7C6BD6'}
            intensity={dark ? 0.14 : 0.5}
            spotlightSize={260}
            borderGlow={0.9}
            proximity={60}
            style={{
                '--spotlight-card-surface': 'var(--card)',
                '--spotlight-card-border': 'var(--border)',
                '--spotlight-card-shadow': '0 1px 2px rgb(0 0 0 / 0.05)',
                ...style,
            } as CSSProperties}
            {...rest}
        />
    );
};

export default PortalSpotlight;
