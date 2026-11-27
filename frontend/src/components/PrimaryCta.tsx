import type { ComponentProps } from 'react';
import StarBorder from './StarBorder';
import { LiquidButton } from './animate-ui/primitives/buttons/liquid';
import { ShimmeringText } from './animate-ui/primitives/texts/shimmering';

type Props = Omit<ComponentProps<'button'>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'>;

/**
 * The main action on a page. Two library pieces in one button:
 * - animate-ui LiquidButton: a solid button (system blue in the retailer portal) with a
 *   thin line of fill along the bottom that floods it on hover, with a small press.
 * - React Bits StarBorder: a star lapping the edge, a pulse on click.
 * Every other .btn-primary in the portal wears the same colours and fill
 * (index.css, html.rp-motion .btn-primary). data-cta lets ClickSpark (Layout)
 * spark on it. StarBorder defaults to type="button"; this keeps "submit".
 */
export default function PrimaryCta({ type = 'submit', className = '', ...rest }: Props) {
    return (
        <StarBorder
            as={LiquidButton}
            type={type}
            theme="dark"
            radius={14}
            duration={5}
            glow={0.9}
            sparkle
            // StarBorder draws on a canvas, so its star needs real colours, not CSS variables.
            color="#BFDBFF"
            trailColor="#5AC8FA"
            textColor="var(--primary-foreground)"
            borderColor="rgb(255 255 255 / 0.18)"
            hoverScale={1.02}
            tapScale={0.97}
            delay="0.35s"
            fillHeight="3px"
            data-cta=""
            className={`[--liquid-button-background-color:var(--primary)] [--liquid-button-color:var(--cta-fill)] hover:text-[color:var(--cta-fg-hover)] shadow-[0_10px_22px_-12px_rgb(0_122_255_/_0.6)] ${className}`}
            {...rest}
        />
    );
}

/** A busy label inside a button: animate-ui ShimmeringText in the button's own colour. */
export const Busy = ({ text }: { text: string }) => (
    <ShimmeringText text={text} duration={1.2} color="currentColor" shimmeringColor="var(--cta-shimmer)" />
);

/** The selected pill for animate-ui Highlight tab rows: the primary button's colour, sliding between tabs. */
export const PILL_HIGHLIGHT = 'inset-0 rounded-xl bg-primary shadow-[0_10px_22px_-12px_rgb(0_122_255_/_0.6)]';
