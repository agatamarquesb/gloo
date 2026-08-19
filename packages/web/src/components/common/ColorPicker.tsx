import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { LABEL_COLORS, isHexColor, type HexColor, type PaletteColor } from '@gloo/shared';

import { colorFill } from '@/theme/labelColors';
import { modalDivider } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/**
 * Where the colours a user mixed are kept.
 *
 * `localStorage` rather than a table: a colour is not a thing in this product —
 * a label is, an agenda is — and every one of these is already saved on the
 * object wearing it. What this list adds is only the ability to reach for the
 * same colour twice, which is a convenience of the browser you are sitting at.
 */
const STORE_KEY = 'gloo-custom-colors';

/**
 * How many are kept. The tenth does not extend the row — it takes the place of
 * the first, so the grid stays two rows of five with the "+" at the end and
 * never grows into the panel below it.
 */
const MAX_CUSTOM = 9;

function readStore(): HexColor[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(isHexColor) : [];
  } catch {
    // Private mode, a corrupt entry — the palette is a convenience, not the data.
    return [];
  }
}

/**
 * The saved colours, plus whichever one is currently in use.
 *
 * A label wearing a hex that this browser has never seen — because a colleague
 * chose it — still has to appear under "Cores personalizadas", or opening that
 * label would show a swatch selected that is nowhere in the grid.
 */
export function useCustomColors(current?: PaletteColor) {
  const [stored, setStored] = useState<HexColor[]>(readStore);

  const write = useCallback((next: HexColor[]) => {
    setStored(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      // As above: losing the list costs the user nothing they cannot redo.
    }
  }, []);

  /** A new colour joins the end of the row — or, once full, takes the first place. */
  const add = useCallback(
    (color: HexColor) => {
      setStored((list) => {
        if (list.includes(color)) return list;
        const next =
          list.length < MAX_CUSTOM
            ? [...list, color]
            : [color, ...list.slice(1)];
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(next));
        } catch {
          // As above.
        }
        return next;
      });
    },
    [],
  );

  /** One saved colour becomes another, in the place it already occupies. */
  const replace = useCallback(
    (from: HexColor, to: HexColor) => {
      setStored((list) => {
        const next = list.map((color) => (color === from ? to : color));
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(next));
        } catch {
          // As above.
        }
        return next;
      });
    },
    [],
  );

  const remove = useCallback(
    (color: HexColor) => write(stored.filter((existing) => existing !== color)),
    [stored, write],
  );

  const colors =
    current && isHexColor(current) && !stored.includes(current) ? [current, ...stored] : stored;

  return { colors, add, replace, remove };
}

/* ------------------------------------------------------------------ *
 * HSV ↔ hex. The square is saturation across and value down, which is
 * how a colour is picked by eye; hex is how it is written down.
 * ------------------------------------------------------------------ */

interface Hsv {
  h: number;
  s: number;
  v: number;
}

function hsvToHex({ h, s, v }: Hsv): HexColor {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

function hexToHsv(hex: string): Hsv {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;

  let h = 0;
  if (span !== 0) {
    if (max === r) h = 60 * (((g - b) / span) % 6);
    else if (max === g) h = 60 * ((b - r) / span + 2);
    else h = 60 * ((r - g) / span + 4);
  }

  return { h: (h + 360) % 360, s: max === 0 ? 0 : span / max, v: max };
}

export const SWATCH = 'h-8 w-full rounded-lg transition-transform hover:scale-105';

/**
 * The same palette in a panel that hangs off a property row rather than filling
 * a dialog — the event's "Cor do card".
 *
 * Square and small: the swatches carry the panel's whole size, so a fixed 24px
 * cell is what takes the popover down to the width of five of them and the
 * height of two rows. `aspect-square` rather than a second height, so the two
 * numbers cannot drift apart.
 */
export const SWATCH_COMPACT = 'size-6 aspect-square rounded-md transition-transform hover:scale-105';

/** Where the mixer opens when there is nothing to edit — a mid orange. */
const DEFAULT_MIX: HexColor = '#bf8756';
export const SWATCH_SELECTED = 'ring-2 ring-foreground ring-offset-2 ring-offset-surface';
export const SECTION_TITLE = 'text-xs font-medium text-muted';

/**
 * The mixer: a saturation/value square over the chosen hue, a hue slider under
 * it, and the hex it comes to — which can also be typed, since a colour is
 * often something you already have the code for.
 */
function ColorMixer({
  initial,
  onPick,
  onLive,
}: {
  /** What it opens on: a colour being edited, or a starting point for a new one. */
  initial: HexColor;
  onPick: (color: HexColor) => void;
  /**
   * What the square is on right now, reported as it moves — so the dashed "+"
   * at the end of the saved row can add the colour being mixed, which is where
   * a hand goes as often as the one inside the mixer itself.
   */
  onLive?: (color: HexColor) => void;
}) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(initial));
  const [typed, setTyped] = useState<string>(initial);
  const areaRef = useRef<HTMLDivElement>(null);

  const hex = hsvToHex(hsv);
  // The field follows the square unless the field is what moved.
  useEffect(() => setTyped(hex), [hex]);
  useEffect(() => onLive?.(hex), [hex, onLive]);

  function moveTo(event: React.PointerEvent<HTMLDivElement>) {
    const box = areaRef.current?.getBoundingClientRect();
    if (!box) return;
    const s = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const v = 1 - Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    setHsv((current) => ({ ...current, s, v }));
  }

  function handleTyped(next: string) {
    // Typed with or without the hash, and accepted the moment it is complete.
    const candidate = next.startsWith('#') ? next : `#${next}`;
    setTyped(candidate);
    if (isHexColor(candidate)) setHsv(hexToHsv(candidate));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* White to the right, black to the bottom, over the hue itself — the
          standard square, and the one the OS pickers use, so it needs no
          explaining. Pointer capture keeps the drag alive outside the box. */}
      {/* The square is a value, not a control the keyboard can reach — the hex
          field beside it is that, and it can express every colour this can. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={areaRef}
        className="relative h-28 w-full cursor-crosshair rounded-lg"
        style={{
          backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
          backgroundImage:
            'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          moveTo(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) moveTo(event);
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        aria-label={strings.color.hue}
        onChange={(event) => setHsv((current) => ({ ...current, h: Number(event.target.value) }))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow"
        style={{
          backgroundImage:
            'linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)',
        }}
      />

      {/* One field, not three controls: the colour it comes to, the code for
          it, and the way to keep it. The preview is what the square and the
          field agree on, so a code typed by hand is answered before it is
          added; the "+" sits inside the same box because it is that field's own
          verb, and outside it took a third of the row. */}
      <div className="flex items-center gap-1.5 rounded-md border border-outline-control px-1.5 py-1">
        <span
          aria-hidden
          className="size-4 shrink-0 rounded-sm border border-black/10"
          style={{ backgroundColor: isHexColor(typed) ? typed : hex }}
        />
        <input
          type="text"
          aria-label={strings.color.hex}
          value={typed}
          onChange={(event) => handleTyped(event.target.value)}
          placeholder="#000000"
          className="min-w-0 flex-1 bg-transparent p-0 text-[12px] outline-none placeholder:text-muted"
        />
        <button
          type="button"
          aria-label={strings.common.add}
          disabled={!isHexColor(typed)}
          onClick={() => isHexColor(typed) && onPick(typed)}
          className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted hover:text-foreground disabled:cursor-default disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * What the mixer is open for: nothing, a colour being made, or one being changed.
 */
type Mixing = null | { mode: 'create' } | { mode: 'edit'; color: HexColor };

/**
 * The app's one way of choosing a colour — a label's, an agenda's.
 *
 * Two sections: the ten the app ships with, and the ones this browser has mixed,
 * with a rule between them. The "+" at the end of the second opens the mixer;
 * whatever it produces is selected and remembered, so the next thing that needs
 * that colour can be given it in one press.
 *
 * A custom colour is also a way back into the mixer: pressing one selects it and
 * opens it for changing, in the place it already holds. Pressing any *other*
 * swatch while the mixer is open closes it — you have chosen, and the panel that
 * was asking has nothing left to ask.
 */
export function ColorPicker({
  value,
  onChange,
  compact = false,
}: {
  value: PaletteColor;
  onChange: (color: PaletteColor) => void;
  /** The small square grid a property row opens — see SWATCH_COMPACT. */
  compact?: boolean;
}) {
  const { colors, add, replace, remove } = useCustomColors(value);
  const [mixing, setMixing] = useState<Mixing>(null);
  /**
   * What the open mixer is currently on. Held here so the dashed "+" at the end
   * of the saved row can add it: with the mixer open that button is the nearest
   * thing to the colour on screen, and pressing it to close the panel instead of
   * keeping the colour was the panel arguing with the hand.
   */
  const [mixed, setMixed] = useState<HexColor | null>(null);

  const swatch = compact ? SWATCH_COMPACT : SWATCH;
  // Compact, the grid is as wide as its five squares and no wider: the panel
  // takes its width from here, which is the point of the smaller cell.
  // Six across compact, five at full size: the small panel is as wide as its
  // widest line, and a sixth column spends that width on colours rather than
  // leaving it empty beside them.
  const grid = compact ? 'grid w-fit grid-cols-6 gap-1.5' : 'grid grid-cols-5 gap-2';

  /** Choosing any swatch is an answer, so it also puts the mixer away. */
  function pick(color: PaletteColor) {
    onChange(color);
    setMixing(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={SECTION_TITLE}>{strings.color.palette}</span>
      <div className={grid}>
        {LABEL_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={value === color}
            onClick={() => pick(color)}
            {...colorFill(color, `${swatch} ${value === color ? SWATCH_SELECTED : ''}`)}
          />
        ))}
      </div>

      <div className={`${modalDivider} my-1`} />

      <span className={SECTION_TITLE}>{strings.color.custom}</span>
      <div className={grid}>
        {colors.map((color) => {
          const isEditing = mixing?.mode === 'edit' && mixing.color === color;
          return (
            // The swatch and its × are siblings inside the cell rather than one
            // inside the other: a button cannot contain a button.
            <span key={color} className="group relative">
              <button
                type="button"
                aria-label={color}
                aria-pressed={value === color}
                onClick={() =>
                  isEditing ? setMixing(null) : (onChange(color), setMixing({ mode: 'edit', color }))
                }
                {...colorFill(
                  color,
                  `${swatch} ${value === color ? SWATCH_SELECTED : ''}`,
                )}
              />

              {/* Only under the cursor: a row of ×s over a row of colours reads
                  as a row of controls rather than a palette. */}
              <button
                type="button"
                aria-label={`${strings.common.delete} ${color}`}
                onClick={() => {
                  remove(color);
                  if (isEditing) setMixing(null);
                }}
                className="absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full bg-overlay text-muted shadow-sm group-hover:flex hover:text-foreground focus-visible:flex"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}

        {/* The way to mix one, at the end of the row it will join. Dashed and
            empty: it is the only square in either grid that is not itself a
            colour. */}
        <button
          type="button"
          aria-label={strings.color.add}
          aria-expanded={mixing?.mode === 'create'}
          onClick={() => {
            // Open, it keeps what is being mixed — the same thing the "+" inside
            // the mixer's own field does. Shut, it opens the mixer.
            if (mixing?.mode === 'create' && mixed) {
              add(mixed);
              onChange(mixed);
              setMixing(null);
              return;
            }
            setMixing((open) => (open?.mode === 'create' ? null : { mode: 'create' }));
          }}
          className={`${swatch} flex items-center justify-center border border-dashed border-outline-control text-muted hover:text-foreground`}
        >
          <Plus className="size-4" />
        </button>
      </div>

      {mixing ? (
        <ColorMixer
          // Remounted per colour, so opening one to change it starts on that
          // colour rather than on wherever the square was left.
          key={mixing.mode === 'edit' ? mixing.color : 'new'}
          initial={mixing.mode === 'edit' ? mixing.color : DEFAULT_MIX}
          onLive={setMixed}
          onPick={(color) => {
            if (mixing.mode === 'edit') replace(mixing.color, color);
            else add(color);
            onChange(color);
            setMixing(null);
          }}
        />
      ) : null}
    </div>
  );
}
