import * as React from 'react';

import {
  Progress as ProgressPrimitive,
  ProgressIndicator as ProgressIndicatorPrimitive,
  type ProgressProps as ProgressPrimitiveProps,
} from '@/components/animate-ui/primitives/radix/progress';
import { cn } from '@/lib/utils';

type ProgressProps = ProgressPrimitiveProps;

function Progress({ className, ...props }: ProgressProps) {
  return (
    <ProgressPrimitive
      className={cn(
        'bg-primary/20 relative h-2 w-full overflow-hidden rounded-full',
        className,
      )}
      {...props}
    >
      {/* Local change: start empty, so the bar fills up to its value instead of shrinking down from full. */}
      <ProgressIndicatorPrimitive initial={{ x: '-100%' }} className="bg-primary rounded-full h-full w-full flex-1" />
    </ProgressPrimitive>
  );
}

export { Progress, type ProgressProps };
