import type { CSSProperties } from 'react';

import { isHexColor, toHex, type LabelColor, type PaletteColor } from '@gloo/shared';

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
 * The same ten, as the border of a calendar event card. Written out longhand
 * for the same reason LABEL_BG_CLASS is, and kept beside it so a colour added
 * to one is obviously missing from the other.
 */
export const LABEL_EDGE_CLASS: Record<LabelColor, string> = {
  green: 'border-label-green-edge',
  lime: 'border-label-lime-edge',
  yellow: 'border-label-yellow-edge',
  orange: 'border-label-orange-edge',
  red: 'border-label-red-edge',
  pink: 'border-label-pink-edge',
  purple: 'border-label-purple-edge',
  blue: 'border-label-blue-edge',
  teal: 'border-label-teal-edge',
  gray: 'border-label-gray-edge',
};

/**
 * What a colour actually paints with — the two kinds in one call.
 *
 * A palette key is a Tailwind class, because the value behind it lives in
 * globals.css and follows the theme. A colour the user mixed is a hex and can
 * only be an inline value: Tailwind cannot emit a class for something that did
 * not exist when it compiled.
 *
 * So every caller takes both back: the classes to put on the element and a style
 * to spread beside them. `extra` is folded in so a call site stays one
 * expression rather than three.
 */
export interface ColorPaint {
  className: string;
  style?: CSSProperties;
}

/**
 * Black or white, whichever can be read on the colour behind it.
 *
 * The ten palette colours are pastels and all carry black, which is why
 * LABEL_PILL could simply say so. A user may pick anything at all, including
 * navy, so the text has to follow the fill. The weights are the sRGB luminance
 * coefficients; the 0.6 threshold is where a mid grey stops being a light one.
 */
function readableInk(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}

/** A colour as a background — a tag, a swatch, an agenda's dot. */
export function colorFill(color: PaletteColor, extra = ''): ColorPaint {
  if (!isHexColor(color)) {
    return { className: `${extra} ${LABEL_BG_CLASS[color] ?? LABEL_BG_CLASS.gray}`.trim() };
  }
  return { className: extra, style: { backgroundColor: color, color: readableInk(color) } };
}

/** And as an edge — a calendar event's border, which is a darker step of the fill. */
export function colorEdge(color: PaletteColor, extra = ''): ColorPaint {
  if (!isHexColor(color)) {
    return { className: `${extra} ${LABEL_EDGE_CLASS[color] ?? LABEL_EDGE_CLASS.gray}`.trim() };
  }
  // No darker step to reach for on a colour we have never seen: the fill itself,
  // which still reads as an edge against the card's own ground.
  return { className: extra, style: { borderColor: color } };
}

/** Both at once, for the event cards, which carry a fill and an edge. */
export function colorBlock(color: PaletteColor, extra = ''): ColorPaint {
  const fill = colorFill(color, extra);
  const edge = colorEdge(color);
  return { className: `${fill.className} ${edge.className}`.trim(), style: { ...fill.style, ...edge.style } };
}

/**
 * How wide the agenda's stripe is on an event that carries a colour of its own.
 *
 * Drawn as the block's own left border rather than as a child: every one of the
 * three things that paint an event — the timed block, the all-day bar, the
 * month's chip — already has a border and already spreads a style, so this costs
 * them nothing and cannot be forgotten by one of them. 4px is Google's own
 * weight for it, and the smallest that still reads as a stripe on a block thirty
 * pixels tall.
 */
const AGENDA_STRIPE = '4px';

/**
 * An event card, in the colour it should actually be.
 *
 * Two colours are in play and only sometimes: an event usually wears its
 * agenda's, and an event given one of its own wears that instead — with a stripe
 * of the agenda's down its left edge, so a card singled out still says which
 * calendar it came from. Exactly how Google Calendar draws the same distinction,
 * which is where most of these colours arrive from (see GOOGLE_EVENT_COLORS).
 *
 * The stripe is the fill of the agenda's colour rather than its darker edge
 * step: it is standing in for the whole card the event would otherwise have
 * been, not for that card's outline.
 */
export function colorEventBlock(
  agendaColor: PaletteColor,
  /** Null for the ordinary case — no colour of its own, so no stripe. */
  eventColor: PaletteColor | null | undefined,
  extra = '',
): ColorPaint {
  const paint = colorBlock(eventColor ?? agendaColor, extra);
  if (!eventColor) return paint;

  return {
    className: paint.className,
    style: {
      ...paint.style,
      borderLeftWidth: AGENDA_STRIPE,
      // A hex whichever kind the agenda wears: a border colour is one value, and
      // there is no class to reach for on the two-colour case.
      borderLeftColor: toHex(agendaColor),
    },
  };
}

/**
 * The app's tag pill.
 *
 * Only the geometry: each caller adds its own foreground, since a colour the
 * user mixed carries black or white depending on itself (see colorFill) while
 * the palette's ten are light enough for black in either theme.
 *
 * Small on purpose. A tag is a mark on a routine, read alongside its title
 * rather than instead of it — a pill as tall as the title weighed as much as it.
 * 13px is where it stops being a whisper: the same size a status pill carries.
 */
export const PILL_SHAPE = 'rounded-md px-2 py-1 text-[13px] leading-4';

/**
 * A label pill. Shared so the ones under a routine's title in the modal and the
 * ones on its Dashboard row are the same object, not two lookalikes.
 */
export const LABEL_PILL = `${PILL_SHAPE} text-black`;
