import { useEffect, useRef, useState } from 'react';
import { Button, Slider } from '@heroui/react';

import { SecondaryButton } from '@/components/common/SecondaryButton';
import { strings } from '@/strings/pt-BR';

/**
 * Square (1:1) crop-and-zoom for a picked image, so what lands on the server
 * already matches the shape every avatar is rendered in.
 *
 * Hand-rolled rather than pulled from a library: this is the one cropping
 * surface in the app, and the whole interaction is a transform on an <img>
 * plus one `drawImage` call.
 *
 * The preview and the export share a single geometry model — a `zoom` factor
 * over a cover-fit baseline, plus an `offset` in viewport pixels — so what the
 * square shows is exactly what gets written.
 */
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.01;

/**
 * Longest edge of the exported image. Avatars render at ≤80px, so this is
 * already generous; it exists to keep a 12MP phone photo from being stored at
 * full size for a 32px circle. Never upscales — a smaller crop stays smaller.
 */
const MAX_OUTPUT_PX = 512;
const OUTPUT_MIME = 'image/jpeg';
const OUTPUT_QUALITY = 0.92;

interface Offset {
  x: number;
  y: number;
}

/**
 * Keeps the image covering the viewport: the crop square can never show a gap,
 * so panning stops at the point where an edge would come into view.
 */
function clampOffset(offset: Offset, displayed: { width: number; height: number }, viewport: number): Offset {
  const maxX = Math.max(0, (displayed.width - viewport) / 2);
  const maxY = Math.max(0, (displayed.height - viewport) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

export function ImageCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null);

  const [source, setSource] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isExporting, setExporting] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The square sizes itself off the modal width, and every bit of geometry here
  // is expressed in its pixels — so it is measured into state rather than read
  // off the ref during render, which would miss both the first paint and any
  // later resize.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => setViewport(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Cover fit: the shorter edge fills the square, which is the baseline the
  // zoom multiplies. Matches how the finished avatar is displayed.
  const baseScale = natural && viewport ? Math.max(viewport / natural.width, viewport / natural.height) : 1;
  const scale = baseScale * zoom;
  const displayed = natural
    ? { width: natural.width * scale, height: natural.height * scale }
    : { width: 0, height: 0 };

  function handlePointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: offset,
    };
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(
      clampOffset(
        {
          x: drag.origin.x + (event.clientX - drag.startX),
          y: drag.origin.y + (event.clientY - drag.startY),
        },
        displayed,
        viewport,
      ),
    );
  }

  function handlePointerUp(event: React.PointerEvent) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function handleZoom(next: number) {
    setZoom(next);
    // Re-clamp against the new size: zooming out can leave the current offset
    // outside the bounds it was valid for, which would expose an edge.
    const rescaled = natural
      ? { width: natural.width * baseScale * next, height: natural.height * baseScale * next }
      : displayed;
    setOffset((current) => clampOffset(current, rescaled, viewport));
  }

  async function handleConfirm() {
    const image = imageRef.current;
    if (!image || !natural || !viewport) return;

    setExporting(true);
    try {
      // The viewport maps back to a square region of the source image: its side
      // is `viewport / scale` source pixels, centred on the image centre shifted
      // by the pan (also converted back to source pixels).
      const sourceSide = viewport / scale;
      const sx = natural.width / 2 - offset.x / scale - sourceSide / 2;
      const sy = natural.height / 2 - offset.y / scale - sourceSide / 2;

      const outputSide = Math.round(Math.min(MAX_OUTPUT_PX, sourceSide));
      const canvas = document.createElement('canvas');
      canvas.width = outputSide;
      canvas.height = outputSide;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, sx, sy, sourceSide, sourceSide, 0, 0, outputSide, outputSide);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, OUTPUT_MIME, OUTPUT_QUALITY),
      );
      if (!blob) return;

      onConfirm(new File([blob], 'avatar.jpg', { type: OUTPUT_MIME }));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Round rather than square: the crop is for an avatar, so the mask shows
          the shape the result will actually be seen in. */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        // touch-none stops the browser from scrolling the modal while dragging.
        className="relative aspect-square w-full max-w-56 cursor-grab touch-none overflow-hidden rounded-full border border-border bg-default active:cursor-grabbing"
      >
        {source ? (
          <img
            ref={imageRef}
            src={source}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const target = event.currentTarget;
              setNatural({ width: target.naturalWidth, height: target.naturalHeight });
              setOffset({ x: 0, y: 0 });
              setZoom(MIN_ZOOM);
            }}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none origin-center select-none"
            style={{
              width: displayed.width || undefined,
              height: displayed.height || undefined,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
        ) : null}
      </div>

      <p className="text-center text-xs text-muted">{strings.profile.cropHint}</p>

      <Slider
        aria-label={strings.profile.zoom}
        value={zoom}
        onChange={(value) => handleZoom(Array.isArray(value) ? value[0] : value)}
        minValue={MIN_ZOOM}
        maxValue={MAX_ZOOM}
        step={ZOOM_STEP}
        className="w-full max-w-56"
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>

      <div className="flex gap-2">
        <SecondaryButton isDisabled={isExporting} onPress={onCancel}>
          {strings.common.cancel}
        </SecondaryButton>
        <Button isDisabled={!natural || isExporting} onPress={handleConfirm}>
          {strings.profile.applyCrop}
        </Button>
      </div>
    </div>
  );
}
