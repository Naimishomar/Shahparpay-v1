import type { ComponentProps } from 'react';
import StarBorder from './StarBorder';
import { LiquidButton } from './animate-ui/primitives/buttons/liquid';

type Props = Omit<ComponentProps<'button'>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'>;

/**
 * The main action on a page. Two library pieces in one button:
 * - animate-ui LiquidButton: a navy button with a thin lavender line along the
 *   bottom that floods it on hover (the text turns navy), with a small press.
 * - React Bits StarBorder: a lavender star lapping the edge, a pulse on click.
 * data-cta lets ClickSpark (Layout) spark on it like any .btn-primary.
 * StarBorder defaults to type="button", so this keeps the native "submit" default.
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
            color="#D9CCFF"
            trailColor="#9F8BEA"
            textColor="#FFFFFF"
            borderColor="rgb(255 255 255 / 0.14)"
            hoverScale={1.02}
            tapScale={0.97}
            delay="0.35s"
            fillHeight="3px"
            data-cta=""
            className={`[--liquid-button-background-color:#16142E] [--liquid-button-color:#E4DAFF] hover:text-[#16142E] shadow-[0_12px_28px_-12px_rgb(70_50_160_/_0.6)] ${className}`}
            {...rest}
        />
    );
}
