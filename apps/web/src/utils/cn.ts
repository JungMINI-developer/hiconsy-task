import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * 기본 크기(text-sm 등)를 지우고 용도 이름(text-body 등)으로 바꿨으므로,
 * tailwind-merge가 text-body를 색이 아니라 크기로 인식하도록 알려 준다.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['title', 'heading', 'body', 'label', 'caption'] }],
      shadow: [{ shadow: ['overlay'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
