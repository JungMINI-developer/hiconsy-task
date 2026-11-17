import { cva, type VariantProps } from 'class-variance-authority';

/**
 * 버튼 — TDS Button의 fill/weak 구분과 크기별 모서리(small 8 · medium 10 · large 14)를 따른다.
 * 누름 피드백은 색이 아니라 크기(scale 0.96)로 준다. hover는 데스크톱용으로 한 단계 진하게만.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 text-label whitespace-nowrap transition-[background-color,color,transform] duration-120 ease-standard select-none active:scale-96 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 aria-busy:cursor-progress',
  {
    variants: {
      variant: {
        /** fill · primary */
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
        /** weak · primary */
        weak: 'bg-accent-weak text-accent hover:bg-blue-100 hover:text-blue-800',
        /** weak · 무채색 (흰 면 위의 닫기·보조 동작) */
        secondary: 'bg-grey-100 text-grey-700 hover:bg-grey-200',
        /** light · 회색 페이지 바탕 위에 놓이는 보조 동작 (grey100 위에서는 secondary가 보이지 않음) */
        light: 'bg-surface text-grey-700 hover:bg-grey-50',
        ghost: 'text-fg-muted hover:bg-grey-100 hover:text-fg',
        /** fill · danger */
        danger: 'bg-status-danger text-white hover:bg-red-800',
        /** weak · danger */
        'danger-weak': 'bg-red-50 text-status-danger hover:bg-red-50/70',
      },
      size: {
        sm: 'h-8 rounded-sm px-3',
        md: 'h-10 rounded-md px-4',
        lg: 'h-12 rounded-lg px-5 text-body font-semibold',
        icon: 'size-9 rounded-md',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

/** 배지 — TDS Badge의 weak 스타일 (연한 배경 + 진한 글자). 상태 표시일 뿐 누를 수 없다 */
export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        open: 'bg-green-50 text-status-open',
        full: 'bg-red-50 text-status-full',
        applied: 'bg-blue-50 text-status-applied',
        canceled: 'bg-grey-100 text-status-canceled',
        ended: 'bg-grey-100 text-status-ended',
        neutral: 'bg-grey-100 text-fg-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

/** 입력 컨트롤 공통 (input, select trigger) — 높이 44px, 포커스·에러는 테두리 색으로 */
export const controlClass =
  'h-11 w-full rounded-md border border-line-input bg-surface px-3.5 text-body text-fg transition-colors duration-120 ease-standard placeholder:text-fg-subtle hover:border-grey-600 focus-visible:border-accent aria-invalid:border-status-danger disabled:cursor-not-allowed disabled:border-line disabled:bg-grey-50 disabled:text-fg-subtle';

/** 카드·목록 묶음 — 회색 바탕 위 흰 면. 테두리 없이 면으로 구분한다 */
export const cardClass = 'rounded-xl bg-surface';
