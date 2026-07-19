import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const assets = [
  'public/fonts/smiley-sans-display.woff2',
  'public/fonts/source-han-sans-sc-regular.woff2',
  'public/fonts/source-han-sans-sc-bold.woff2',
  'public/fonts/source-han-serif-sc-regular.woff2',
  'public/fonts/source-han-serif-sc-semibold.woff2',
  'public/fonts/OFL-Smiley-Sans.txt',
  'public/fonts/OFL-Source-Han-Sans.txt',
  'public/fonts/OFL-Source-Han-Serif.txt',
  'public/brand/relationship-training-logo.svg',
  'public/favicon.svg',
];

describe('brand assets', () => {
  it('ships every self-hosted font, license, logo, and favicon', async () => {
    await Promise.all(assets.map((asset) => access(resolve(asset))));
  });

  it('ships the SIL Open Font License text with each font family', async () => {
    for (const license of assets.filter((asset) => asset.includes('OFL-'))) {
      const text = await readFile(resolve(license), 'utf8');
      expect(text).toContain('SIL OPEN FONT LICENSE');
      expect(text).toContain('Version 1.1');
    }
  });
});
