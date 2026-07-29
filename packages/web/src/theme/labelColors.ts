import type { LabelColor } from '@gloo/shared';

/**
 * Label color key → Tailwind class. Written out rather than interpolated
 * (`bg-label-${color}`) because Tailwind only emits classes it can see as
 * literal strings in the source — a template would compile to nothing.
 *
 * The values themselves live in globals.css as `--label-*`, like every other
 * color in the app.
 */
export const LABEL_BG_CLASS: Record<LabelColor, string> = {
  green: 'bg-label-green',
  lime: 'bg-label-lime',
  yellow: 'bg-label-yellow',
  orange: 'bg-label-orange',
  red: 'bg-label-red',
  pink: 'bg-label-pink',
  purple: 'bg-label-purple',
  blue: 'bg-label-blue',
  teal: 'bg-label-teal',
  gray: 'bg-label-gray',
};

/**
 * A label pill. Shared so the ones under a routine's title in the modal and the
 * ones on its Dashboard row are the same object, not two lookalikes.
 */
export const LABEL_PILL = 'rounded-lg px-2.5 py-1 text-xs text-black';
