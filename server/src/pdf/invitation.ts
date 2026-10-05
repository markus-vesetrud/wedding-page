import { PDF, ops, rgb, type Color, type PDFPage } from '@libpdf/core';
import { fontBytes, frontImageBytes, backImageBytes } from './assets.js';
import { createVerticalGradientImage, drawCoverImage, drawGradientOverlay, drawTrackedTextCentered, hex, mm, type GradientStop } from './draw-helpers.js';
import { renderQrCodePng, type QrErrorCorrectionLevel } from './qr.js';

/** Fixed wedding details from the invitation design. Edit here as details firm up. */
const WEDDING = {
  couple: 'Malin & Markus',
  ceremonyDate: 'Lørdag 31. juli 2027',
  ceremonyTime: 'Vielse kl. 14:00',
  ceremonyLocation: 'Nittedal kirke, Kirkeveien 121, 1480 Slattum',
  rsvpDeadline: 'Svar innen 1. februar 2027',
  qrHelpText: (plural: boolean) => `Skann koden for ${plural ? 'deres' : 'din'} personlige invitasjon.`,
  dateBadge: '31 · 07 · 2027'
};

const COLOR = {
  darkGreen: hex('1f3326'),
  darkerGreen: hex('142219'),
  cream: hex('e4d9bd'),
  white: rgb(1, 1, 1),
  offWhite: hex('fbfcfa'),
  mutedGreen: hex('55604f'),
  goldBrown: hex('7a6a43'),
  qrBoxBorder: hex('d5ded0'),
  qrBoxBg: hex('f2f5ef')
} satisfies Record<string, Color>;

const FRONT_OVERLAY_STOPS: GradientStop[] = [
  { offset: 0.00, color: [33, 41, 51], alpha: 0.60 },
  { offset: 0.05, color: [33, 41, 51], alpha: 0.55 },
  { offset: 0.20, color: [40, 45, 51], alpha: 0.15 },
  { offset: 0.40, color: [40, 45, 51], alpha: 0.20 },
  { offset: 0.60, color: [40, 45, 51], alpha: 0.70 },
  { offset: 0.70, color: [36, 42, 43], alpha: 0.70 },
  { offset: 1.00, color: [25, 30, 31], alpha: 0.85 }
];

const BACK_OVERLAY_STOPS: GradientStop[] = [
  { offset: 0.00, color: [33, 42, 43], alpha: 0.40 },
  { offset: 0.20, color: [33, 43, 34], alpha: 0.30 },
  { offset: 0.45, color: [41, 43, 33], alpha: 0.10 },
  { offset: 0.60, color: [43, 40, 33], alpha: 0.25 },
  { offset: 0.75, color: [43, 40, 33], alpha: 0.75 },
  { offset: 1.00, color: [43, 40, 33], alpha: 0.85 }
];

/** Approximate baseline-from-top-of-line-box ratio, shared by both typefaces at these sizes. */
const ASCENT_RATIO = 0.78;

export interface InvitationPdfOptions {
  /** Displayed as the addressee, e.g. "Anne og Per Hansen". */
  invitationName: string;
  /** Whether the invitation is for several guests, choosing "deres" over "din". */
  plural: boolean;
  /** Full URL encoded into the QR code, e.g. https://bryllup.example.no/invitasjon/abc123. */
  qrTargetUrl: string;
  /** QR code redundancy / error-correction level. Higher survives more damage but is denser. */
  qrErrorCorrectionLevel: QrErrorCorrectionLevel;
  /**
   * `a5`: one A5 card per page. `a4`: the card on the left half of an A4 landscape page, for
   * printing on A4 and cutting out. The back is rotated 180° so that it lands behind the front
   * when duplex-printed with "flip on long edge" (the printer default).
   */
  layout: InvitationPdfLayout;
}

export type InvitationPdfLayout = 'a5' | 'a4';

export function isInvitationPdfLayout(value: string): value is InvitationPdfLayout {
  return value === 'a5' || value === 'a4';
}

export async function generateInvitationPdf(options: InvitationPdfOptions): Promise<Uint8Array> {
  const width = mm(148);
  const height = mm(210);
  const pageSize = options.layout === 'a4' ? { width: mm(297), height } : { width, height };

  const pdf = PDF.create();
  const cormorant = pdf.embedFont(fontBytes.cormorantRegular);
  const cormorantItalic = pdf.embedFont(fontBytes.cormorantItalic);
  const karla = pdf.embedFont(fontBytes.karlaRegular);
  const karlaSemiBold = pdf.embedFont(fontBytes.karlaSemiBold);

  const frontImage = pdf.embedJpeg(frontImageBytes);
  const backImage = pdf.embedJpeg(backImageBytes);
  const frontOverlay = createVerticalGradientImage(pdf, FRONT_OVERLAY_STOPS);
  const backOverlay = createVerticalGradientImage(pdf, BACK_OVERLAY_STOPS);
  const qrPng = await renderQrCodePng(options.qrTargetUrl, options.qrErrorCorrectionLevel);
  const qrImage = pdf.embedPng(qrPng);

  const frontPage = addPage(pdf, pageSize);
  drawFrontPage(frontPage, {
    width,
    height,
    backgroundImage: frontImage,
    overlayImage: frontOverlay,
    qrImage,
    invitationName: options.invitationName,
    plural: options.plural,
    qrTargetUrl: options.qrTargetUrl,
    fonts: { cormorant, cormorantItalic, karla, karlaSemiBold }
  });

  const backPage = addPage(pdf, pageSize);
  // On A4, long-edge duplexing a landscape page mirrors it top-to-bottom, so the back is drawn
  // upside down in the same half to end up behind the front, the right way round
  const backTransform = options.layout === 'a4' ? ([-1, 0, 0, -1, width, height] as const) : null;
  withTransform(backPage, backTransform, () => drawBackPage(backPage, {
    width,
    height,
    backgroundImage: backImage,
    overlayImage: backOverlay,
    fonts: { cormorant, karlaSemiBold }
  }));

  return pdf.save();
}

/**
 * @libpdf/core wraps a page's first content stream in q/Q the first time more content is
 * appended, which would discard any clip or transform pushed by that first stream. Starting
 * with an empty stream makes that wrapping harmless.
 */
function addPage(pdf: PDF, size: { width: number; height: number }): PDFPage {
  const page = pdf.addPage(size);
  page.drawOperators([]);
  return page;
}

type Matrix = readonly [number, number, number, number, number, number];

function withTransform(page: PDFPage, matrix: Matrix | null, draw: () => void): void {
  if (!matrix) {
    draw();
    return;
  }
  page.drawOperators([ops.pushGraphicsState(), ops.concatMatrix(...matrix)]);
  draw();
  page.drawOperators([ops.popGraphicsState()]);
}

interface FrontPageParams {
  width: number;
  height: number;
  backgroundImage: import('@libpdf/core').PDFImage;
  overlayImage: import('@libpdf/core').PDFImage;
  qrImage: import('@libpdf/core').PDFImage;
  invitationName: string;
  plural: boolean;
  qrTargetUrl: string;
  fonts: {
    cormorant: import('@libpdf/core').EmbeddedFont;
    cormorantItalic: import('@libpdf/core').EmbeddedFont;
    karla: import('@libpdf/core').EmbeddedFont;
    karlaSemiBold: import('@libpdf/core').EmbeddedFont;
  };
}

function drawFrontPage(page: import('@libpdf/core').PDFPage, params: FrontPageParams): void {
  const { width, height, backgroundImage, overlayImage, qrImage, invitationName, plural, qrTargetUrl, fonts } = params;
  const marginX = mm(14);
  const centerX = width / 2;
  const hostLabel = new URL(qrTargetUrl).toString().split("://", 2)[1]

  drawCoverImage(page, backgroundImage, { x: 0, y: 0, width, height }, { x: 0.5, y: 0.4 });
  drawGradientOverlay(page, overlayImage, { x: 0, y: 0, width, height });

  // --- "Kjære <name>" box ---
  const topBorderY = height - mm(13);
  const labelSize = 7.5;
  const labelLineHeight = labelSize * 1.2;
  const nameSize = 20;
  const nameLineHeight = nameSize * 1.2;
  const boxPadding = mm(3);
  const boxGap = mm(1.5);
  const topBoxHeight = boxPadding * 2 + labelLineHeight + boxGap + nameLineHeight;
  const bottomBorderY = topBorderY - topBoxHeight;

  page.drawLine({ start: { x: marginX, y: topBorderY }, end: { x: width - marginX, y: topBorderY }, color: COLOR.cream, opacity: 0.6, thickness: 1 });
  page.drawLine({ start: { x: marginX, y: bottomBorderY }, end: { x: width - marginX, y: bottomBorderY }, color: COLOR.cream, opacity: 0.6, thickness: 1 });

  let cursor = topBorderY - boxPadding;
  drawTrackedTextCentered(page, 'KJÆRE', {
    centerX,
    y: cursor - labelSize * ASCENT_RATIO,
    font: fonts.karlaSemiBold,
    size: labelSize,
    color: COLOR.cream,
    trackingEm: 0.28
  });
  cursor -= labelLineHeight + boxGap;
  page.drawText(invitationName, {
    x: marginX,
    y: cursor - nameSize * ASCENT_RATIO,
    maxWidth: width - marginX * 2,
    alignment: 'center',
    font: fonts.cormorant,
    size: nameSize,
    color: COLOR.white,
    lineHeight: nameLineHeight
  });

  // --- QR / RSVP panel, full bleed at the bottom ---
  const qrBoxSize = mm(22);
  const qrPanelPadding = mm(5);
  const qrPanelHeight = qrPanelPadding * 2 + qrBoxSize;
  const qrBoxX = marginX;
  const qrBoxY = (qrPanelHeight - qrBoxSize) / 2;

  // --- Hero block (couple names, ceremony details), anchored just above the QR panel ---
  const heroCoupleSize = 37;
  const heroCoupleLineHeight = heroCoupleSize * 1.06;
  const dividerWidth = mm(42);
  const gifterSegSize = 14;
  const gifterSegLineHeight = gifterSegSize * 1.2;
  const dateSize = 25;
  const dateLineHeight = dateSize * 1.2;
  const ceremonySize = 11;
  const ceremonyLineHeight = ceremonySize * 1.7;

  const heroGapAboveDivider = mm(3);
  const heroGapAboveGifterSeg = mm(3);
  const heroGapAboveDate = mm(1.5);
  const heroGapAboveCeremony = mm(5);

  const heroHeight =
    heroCoupleLineHeight +
    heroGapAboveDivider +
    heroGapAboveGifterSeg +
    gifterSegLineHeight +
    heroGapAboveDate +
    dateLineHeight +
    heroGapAboveCeremony +
    ceremonyLineHeight * 2;

  let heroCursor = qrPanelHeight + mm(9) + heroHeight;

  page.drawText(WEDDING.couple, {
    x: marginX,
    y: heroCursor - heroCoupleSize * ASCENT_RATIO,
    maxWidth: width - marginX * 2,
    alignment: 'center',
    font: fonts.cormorant,
    size: heroCoupleSize,
    color: COLOR.white,
    lineHeight: heroCoupleLineHeight
  });
  heroCursor -= heroCoupleLineHeight + heroGapAboveDivider;

  page.drawLine({
    start: { x: centerX - dividerWidth / 2, y: heroCursor },
    end: { x: centerX + dividerWidth / 2, y: heroCursor },
    color: COLOR.cream,
    opacity: 0.9,
    thickness: 1
  });
  heroCursor -= heroGapAboveGifterSeg;

  page.drawText('gifter seg', {
    x: marginX,
    y: heroCursor - gifterSegSize * ASCENT_RATIO,
    maxWidth: width - marginX * 2,
    alignment: 'center',
    font: fonts.cormorantItalic,
    size: gifterSegSize,
    color: COLOR.cream
  });
  heroCursor -= gifterSegLineHeight + heroGapAboveDate;

  page.drawText(WEDDING.ceremonyDate, {
    x: marginX,
    y: heroCursor - dateSize * ASCENT_RATIO,
    maxWidth: width - marginX * 2,
    alignment: 'center',
    font: fonts.cormorant,
    size: dateSize,
    color: COLOR.white
  });
  heroCursor -= dateLineHeight + heroGapAboveCeremony;

  page.drawText(`${WEDDING.ceremonyTime}\n${WEDDING.ceremonyLocation}`, {
    x: marginX,
    y: heroCursor - ceremonySize * ASCENT_RATIO,
    maxWidth: width - marginX * 2,
    alignment: 'center',
    lineHeight: ceremonyLineHeight,
    font: fonts.karla,
    size: ceremonySize,
    color: COLOR.white
  });

  page.drawRectangle({ x: 0, y: 0, width, height: qrPanelHeight, color: COLOR.offWhite, opacity: 0.96 });
  page.drawRectangle({
    x: qrBoxX,
    y: qrBoxY,
    width: qrBoxSize,
    height: qrBoxSize,
    color: COLOR.qrBoxBg,
    borderColor: COLOR.qrBoxBorder,
    borderWidth: 1,
    cornerRadius: 2
  });
  const qrInset = mm(1.5);
  page.drawImage(qrImage, {
    x: qrBoxX + qrInset,
    y: qrBoxY + qrInset,
    width: qrBoxSize - qrInset * 2,
    height: qrBoxSize - qrInset * 2
  });

  const textX = qrBoxX + qrBoxSize + mm(5);
  const textMaxWidth = width - marginX - textX;
  let textCursor = qrPanelHeight - mm(6.5);

  const titleSize = 10.5;
  page.drawText(WEDDING.rsvpDeadline, {
    x: textX,
    y: textCursor - titleSize * ASCENT_RATIO,
    font: fonts.karlaSemiBold,
    size: titleSize,
    color: COLOR.darkGreen
  });
  textCursor -= titleSize * 1.3;

  const descSize = 9.5;
  const descLineHeight = descSize * 1.5;
  page.drawText(WEDDING.qrHelpText(plural), {
    x: textX,
    y: textCursor - descSize * ASCENT_RATIO,
    maxWidth: textMaxWidth,
    lineHeight: descLineHeight,
    font: fonts.karla,
    size: descSize,
    color: COLOR.mutedGreen
  });
  textCursor -= descLineHeight + mm(1);

  const urlSize = 9;
  page.drawText(hostLabel, {
    x: textX,
    y: textCursor - urlSize * ASCENT_RATIO,
    font: fonts.karla,
    size: urlSize,
    color: COLOR.goldBrown
  });
}

interface BackPageParams {
  width: number;
  height: number;
  backgroundImage: import('@libpdf/core').PDFImage;
  overlayImage: import('@libpdf/core').PDFImage;
  fonts: {
    cormorant: import('@libpdf/core').EmbeddedFont;
    karlaSemiBold: import('@libpdf/core').EmbeddedFont;
  };
}

function drawBackPage(page: import('@libpdf/core').PDFPage, params: BackPageParams): void {
  const { width, height, backgroundImage, overlayImage, fonts } = params;
  const centerX = width / 2;

  drawCoverImage(page, backgroundImage, { x: 0, y: 0, width, height }, { x: 0.5, y: 0.42 });
  drawGradientOverlay(page, overlayImage, { x: 0, y: 0, width, height });

  const outerPadding = mm(14);
  const innerPaddingY = mm(7);
  const titleSize = 30;
  const titleLineHeight = titleSize * 1.1;
  const badgeSize = 9;
  const badgeGap = mm(3);

  const boxHeight = innerPaddingY * 2 + titleLineHeight + badgeGap + badgeSize * 1.2;
  const boxX = outerPadding;
  const boxY = outerPadding;
  const boxWidth = width - outerPadding * 2;

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    borderColor: COLOR.cream,
    borderOpacity: 0.75,
    borderWidth: 1
  });

  let cursor = boxY + boxHeight - innerPaddingY;
  page.drawText(WEDDING.couple, {
    x: boxX,
    y: cursor - titleSize * ASCENT_RATIO,
    maxWidth: boxWidth,
    alignment: 'center',
    font: fonts.cormorant,
    size: titleSize,
    color: COLOR.white
  });
  cursor -= titleLineHeight + badgeGap;

  drawTrackedTextCentered(page, WEDDING.dateBadge, {
    centerX,
    y: cursor - badgeSize * ASCENT_RATIO,
    font: fonts.karlaSemiBold,
    size: badgeSize,
    color: COLOR.cream,
    trackingEm: 0.3
  });
}
