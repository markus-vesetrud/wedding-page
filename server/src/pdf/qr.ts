import QRCode from 'qrcode';

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export function isQrErrorCorrectionLevel(value: string): value is QrErrorCorrectionLevel {
  return value === 'L' || value === 'M' || value === 'Q' || value === 'H';
}

/** Renders a QR code as PNG bytes, encoding `url`. */
export async function renderQrCodePng(
  url: string,
  errorCorrectionLevel: QrErrorCorrectionLevel
): Promise<Uint8Array> {
  const buffer = await QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel,
    margin: 0,
    width: 512,
    color: {
      dark: '#1f3326ff',
      light: '#00000000'
    }
  });
  return new Uint8Array(buffer);
}
