import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../assets');

export const fontBytes = {
  cormorantRegular: readFileSync(path.join(assetsDir, 'fonts/CormorantGaramond-Regular.ttf')),
  cormorantMedium: readFileSync(path.join(assetsDir, 'fonts/CormorantGaramond-Medium.ttf')),
  cormorantItalic: readFileSync(path.join(assetsDir, 'fonts/CormorantGaramond-Italic.ttf')),
  karlaRegular: readFileSync(path.join(assetsDir, 'fonts/Karla-Regular.ttf')),
  karlaMedium: readFileSync(path.join(assetsDir, 'fonts/Karla-Medium.ttf')),
  karlaSemiBold: readFileSync(path.join(assetsDir, 'fonts/Karla-SemiBold.ttf'))
};

export const frontImageBytes = readFileSync(path.join(assetsDir, 'images/gran-canaria-portrait-square.jpg'));
export const backImageBytes = readFileSync(path.join(assetsDir, 'images/atumn-walking-square.jpg'));
