#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const css = readFileSync(join(root, 'src', 'styles', 'global.css'), 'utf8');
const errors = [];

function rgb(hex) { return hex.match(/[a-f\d]{2}/gi).map((part) => Number.parseInt(part, 16)); }
function luminance(hex) {
  const channels = rgb(hex).map((channel) => channel / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
function worstBrightImageAfterBlackOverlay(alpha) {
  const channel = Math.round(255 * (1 - alpha)).toString(16).padStart(2, '0');
  return `${channel}${channel}${channel}`;
}

// Desktop combines the weakest points of both declared black gradients:
// 78% horizontal overlay and 8% vertical overlay. The source art is treated
// as pure white, which is brighter than any real pixel and gives a conservative floor.
const desktopOverlay = 1 - (1 - .78) * (1 - .08);
const mobileOverlay = .94;
const surfaces = {
  desktop: worstBrightImageAfterBlackOverlay(desktopOverlay),
  mobile: worstBrightImageAfterBlackOverlay(mobileOverlay),
};
const colors = {
  primary_text: 'f0f5f1',
  body_text: 'c8d2ca',
  verification_date: 'aeb9b0',
  development_teaser: 'b8c3ba',
  accent_text: 'ffb020',
};
const ratios = {};

for (const [viewport, background] of Object.entries(surfaces)) {
  ratios[viewport] = {};
  for (const [label, foreground] of Object.entries(colors)) {
    const ratio = contrast(foreground, background);
    ratios[viewport][label] = Number(ratio.toFixed(2));
    if (ratio < 4.5) errors.push(`${viewport} ${label}: ${ratio.toFixed(2)}:1`);
  }
}
ratios.filled_cta = Number(contrast('18130a', 'ffb020').toFixed(2));
if (ratios.filled_cta < 4.5) errors.push(`filled CTA: ${ratios.filled_cta}:1`);

for (const required of ['rgba(5, 9, 7, .78)', 'rgba(5, 9, 7, .08)', 'rgba(5, 9, 7, .94)', '#aeb9b0', '#ffb020']) {
  if (!css.includes(required)) errors.push(`declared contrast input missing from CSS: ${required}`);
}

const result = {
  status: errors.length ? 'FAIL' : 'PASS',
  standard: 'WCAG AA normal text (4.5:1)',
  method: 'conservative pure-white source image behind the weakest declared black overlay',
  worst_case_backgrounds: surfaces,
  ratios,
  minimum_ratio: Math.min(...Object.values(ratios.desktop), ...Object.values(ratios.mobile), ratios.filled_cta),
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
