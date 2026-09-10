"use client"

import { cn } from '@/lib/utils'

export interface CardProps extends React.ComponentProps<'div'> {
  interactive?: boolean
}

const Card = ({ className, interactive = false, ...props }: CardProps) => (
  <div
    className={cn(
      // A hairline and the white fill against the warm canvas are enough to
      // separate a card; the extra shadow on every block made the UI boxy.
      'rounded-xl border border-ink/[0.08] bg-surface text-ink',
      interactive && 'transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-ink/20 hover:shadow-card-hover motion-reduce:transform-none motion-reduce:transition-none',
      className
    )}
    {...props}
  />
);

Card.displayName = 'Card';

export default Card;
