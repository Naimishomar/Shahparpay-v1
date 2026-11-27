import type { ComponentProps } from 'react';
import StarBorder from './StarBorder';

/**
 * The one action on a money page (transfer, recharge, pay, settle, add money):
 * React Bits StarBorder in the portal's pastel wash, a lavender star lapping the
 * edge. data-cta lets ClickSpark (Layout) spark on it like any .btn-primary.
 * StarBorder defaults to type="button", so this keeps the native "submit" default.
 */
export default function PrimaryCta({ type = 'submit', className = '', ...rest }: ComponentProps<'button'>) {
    return (
        <StarBorder
            as="button"
            type={type}
            theme="light"
            radius={12}
            duration={5}
            glow={0.7}
            sparkle
            color="#7C6BD6"
            trailColor="#B9A8F0"
            backgroundColor="linear-gradient(135deg, #E4DAFF 0%, #D3E7FB 55%, #FBE2D4 100%)"
            textColor="#16142E"
            borderColor="rgb(22 20 46 / 0.08)"
            data-cta=""
            className={`shadow-[0_8px_20px_-12px_rgb(120_100_200_/_0.45)] ${className}`}
            {...rest}
        />
    );
}
