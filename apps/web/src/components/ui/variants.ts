import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-label whitespace-nowrap transition-colors duration-120 ease-standard select-none disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/85',
        secondary: 'border border-line-strong bg-surface text-fg hover:bg-sunken active:bg-line',
        ghost: 'text-fg hover:bg-sunken active:bg-line',
        danger: 'bg-status-danger text-white hover:bg-status-danger/90 active:bg-status-danger/85',
      },
      size: {
        md: 'h-10 px-4',
        sm: 'h-8 px-3',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-caption font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        open: 'bg-status-open/10 text-status-open',
        warn: 'bg-status-warn/10 text-status-warn',
        full: 'bg-status-full/10 text-status-full',
        applied: 'bg-status-applied/10 text-status-applied',
        canceled: 'bg-sunken text-status-canceled',
        ended: 'bg-sunken text-status-ended',
        neutral: 'bg-sunken text-fg-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

/** 입력 컨트롤 공통 (input, select trigger) */
export const controlClass =
  'h-10 w-full rounded-md border border-line-input bg-surface px-3 text-body text-fg transition-colors duration-120 ease-standard placeholder:text-fg-muted hover:border-fg-muted aria-invalid:border-status-danger disabled:cursor-not-allowed disabled:bg-sunken disabled:text-fg-muted';
