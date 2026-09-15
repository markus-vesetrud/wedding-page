import { ops, rgb, type Color, type EmbeddedFont, type PDF, type PDFImage, type PDFPage } from '@libpdf/core';
import { buildVerticalGradientPng } from './gradient-png.js';

/** Points per millimetre (1in = 72pt = 25.4mm). */
export const MM = 72 / 25.4;

export function mm(value: number): number {
  return value * MM;
}

export function hex(value: string): Color {
  const clean = value.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draws an image into `rect` using `object-fit: cover` semantics, cropped
 * around a focal point (`focusX`/`focusY`, 0-1, matching CSS object-position).
 */
export function drawCoverImage(
  page: PDFPage,
  image: PDFImage,
  rect: Rect,
  focus: { x: number; y: number } = { x: 0.5, y: 0.5 }
): void {
  const scale = Math.max(rect.width / image.widthInPoints, rect.height / image.heightInPoints);
  const drawWidth = image.widthInPoints * scale;
  const drawHeight = image.heightInPoints * scale;
  const offsetX = (drawWidth - rect.width) * focus.x;
  const offsetY = (drawHeight - rect.height) * (1 - focus.y);

  page.drawOperators([
    ops.pushGraphicsState(),
    ops.rectangle(rect.x, rect.y, rect.width, rect.height),
    ops.clip(),
    ops.endPath()
  ]);
  page.drawImage(image, {
    x: rect.x - offsetX,
    y: rect.y - offsetY,
    width: drawWidth,
    height: drawHeight
  });
  page.drawOperators([ops.popGraphicsState()]);
}

export interface GradientStop {
  /** 0 = top of the box, 1 = bottom (matches CSS linear-gradient direction). */
  offset: number;
  color: [number, number, number];
  alpha: number;
}

/**
 * Embeds a CSS-style top-to-bottom linear-gradient (with per-stop alpha) as
 * a 1px-wide PNG.
 *
 * @libpdf/core's shading API (`createAxialShading`) only takes solid colors
 * per stop — no alpha — and rectangle/path fills only take one constant
 * opacity for the whole shape, so there's no direct way to draw a smoothly
 * *varying* alpha fill. Approximating it by stacking many thin, differently
 * -opaque rectangles works, but adjacent rectangles get anti-aliased against
 * the content beneath at their shared edge, leaving faint seams ("banding").
 * A PNG's alpha channel doesn't have that problem — embedPng turns it into a
 * real PDF soft mask — so baking the gradient into an image (via the pure
 * hand-rolled PNG encoder in ./gradient-png.ts, no image-library dependency)
 * and drawing that gives a genuinely smooth result instead.
 */
export function createVerticalGradientImage(pdf: PDF, stops: GradientStop[]): PDFImage {
  return pdf.embedPng(buildVerticalGradientPng(stops));
}

/** Draws a gradient image (from {@link createVerticalGradientImage}) stretched to fill `rect`. */
export function drawGradientOverlay(page: PDFPage, image: PDFImage, rect: Rect): void {
  page.drawImage(image, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

/**
 * Draws single-line, letter-spaced (tracked) text centered horizontally on
 * `centerX`, approximating CSS `letter-spacing` (which the underlying PDF
 * text drawing API has no direct equivalent for).
 */
export function drawTrackedTextCentered(
  page: PDFPage,
  text: string,
  options: {
    centerX: number;
    y: number;
    font: EmbeddedFont;
    size: number;
    color: Color;
    trackingEm: number;
    opacity?: number;
  }
): void {
  const tracking = options.trackingEm * options.size;
  const chars = [...text];
  const widths = chars.map((c) => options.font.getTextWidth(c, options.size));
  const totalWidth = widths.reduce((sum, w) => sum + w, 0) + tracking * (chars.length - 1);

  let x = options.centerX - totalWidth / 2;
  for (let i = 0; i < chars.length; i++) {
    page.drawText(chars[i], {
      x,
      y: options.y,
      font: options.font,
      size: options.size,
      color: options.color,
      opacity: options.opacity
    });
    x += widths[i] + tracking;
  }
}
