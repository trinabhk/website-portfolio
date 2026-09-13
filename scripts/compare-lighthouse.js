#!/usr/bin/env node
'use strict';

// Compare two Lighthouse JSON reports.
//   node scripts/compare-lighthouse.js <baseline.json> <after.json>
//
// Prints category scores, headline metrics and any audit whose score moved.
// Warns when the two runs aren't comparable, because a form-factor or version
// mismatch produces a diff that looks real and isn't.

const fs = require('fs');

const METRICS = [
  ['first-contentful-paint', 'FCP'],
  ['largest-contentful-paint', 'LCP'],
  ['total-blocking-time', 'TBT'],
  ['cumulative-layout-shift', 'CLS'],
  ['speed-index', 'Speed Index'],
  ['interactive', 'TTI'],
  ['bootup-time', 'JS bootup'],
  ['mainthread-work-breakdown', 'Main-thread work'],
  ['total-byte-weight', 'Total bytes'],
];

function load(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`Could not read ${p}: ${e.message}`);
    process.exit(1);
  }
}

function pct(v) {
  return v === null || v === undefined ? null : Math.round(v * 100);
}

function arrow(before, after) {
  if (before === null || after === null) return '';
  if (after > before) return ' ▲';
  if (after < before) return ' ▼';
  return ' =';
}

function numeric(audit) {
  return audit && typeof audit.numericValue === 'number' ? audit.numericValue : null;
}

function fmtDelta(before, after, unit) {
  if (before === null || after === null) return '';
  const d = after - before;
  if (Math.abs(d) < 0.0005) return '  (no change)';
  const sign = d > 0 ? '+' : '';
  if (unit === 'bytes') return `  (${sign}${(d / 1024).toFixed(1)} KiB)`;
  if (unit === '') return `  (${sign}${d.toFixed(3)})`;
  return `  (${sign}${Math.round(d)} ms)`;
}

function unitFor(id) {
  if (id === 'cumulative-layout-shift') return '';
  if (id === 'total-byte-weight') return 'bytes';
  return 'ms';
}

const [, , basePath, afterPath] = process.argv;
if (!basePath || !afterPath) {
  console.error('usage: node scripts/compare-lighthouse.js <baseline.json> <after.json>');
  process.exit(1);
}

const a = load(basePath);
const b = load(afterPath);

const ca = a.configSettings || {};
const cb = b.configSettings || {};

console.log('');
console.log(`baseline : ${basePath}`);
console.log(`           ${a.fetchTime}  ${ca.formFactor}/${ca.throttlingMethod}  LH ${a.lighthouseVersion}`);
console.log(`after    : ${afterPath}`);
console.log(`           ${b.fetchTime}  ${cb.formFactor}/${cb.throttlingMethod}  LH ${b.lighthouseVersion}`);

const warns = [];
if (ca.formFactor !== cb.formFactor) warns.push(`form factor differs (${ca.formFactor} vs ${cb.formFactor}) - not comparable`);
if (ca.throttlingMethod !== cb.throttlingMethod) warns.push(`throttling differs (${ca.throttlingMethod} vs ${cb.throttlingMethod}) - not comparable`);
if (a.lighthouseVersion !== b.lighthouseVersion) warns.push(`Lighthouse version differs (${a.lighthouseVersion} vs ${b.lighthouseVersion}) - scoring curves may have changed`);
const ua = a.finalDisplayedUrl || a.finalUrl;
const ub = b.finalDisplayedUrl || b.finalUrl;
if (ua !== ub) warns.push(`URL differs (${ua} vs ${ub})`);

if (warns.length) {
  console.log('');
  console.log('WARNINGS');
  warns.forEach((w) => console.log(`  ! ${w}`));
}

console.log('');
console.log('CATEGORY SCORES');
const cats = new Set([...Object.keys(a.categories || {}), ...Object.keys(b.categories || {})]);
for (const key of cats) {
  const sa = pct(a.categories?.[key]?.score);
  const sb = pct(b.categories?.[key]?.score);
  const shown = [sa === null ? '--' : sa, '->', sb === null ? '--' : sb].join(' ');
  console.log(`  ${key.padEnd(16)} ${shown}${arrow(sa, sb)}`);
}

console.log('');
console.log('HEADLINE METRICS');
for (const [id, label] of METRICS) {
  const aa = a.audits?.[id];
  const ab = b.audits?.[id];
  if (!aa && !ab) continue;
  const va = aa?.displayValue ?? '--';
  const vb = ab?.displayValue ?? '--';
  const na = numeric(aa);
  const nb = numeric(ab);
  const unit = unitFor(id);
  console.log(`  ${label.padEnd(18)} ${String(va).padStart(10)} -> ${String(vb).padStart(10)}${fmtDelta(na, nb, unit)}`);
}

console.log('');
console.log('AUDITS THAT MOVED');
const ids = new Set([...Object.keys(a.audits || {}), ...Object.keys(b.audits || {})]);
let moved = 0;
for (const id of [...ids].sort()) {
  const sa = a.audits?.[id]?.score;
  const sb = b.audits?.[id]?.score;
  if (sa === null || sa === undefined || sb === null || sb === undefined) continue;
  if (sa === sb) continue;
  moved += 1;
  const dv = b.audits[id].displayValue ? `  ${b.audits[id].displayValue}` : '';
  console.log(`  ${id.padEnd(40)} ${sa.toFixed(2)} -> ${sb.toFixed(2)}${dv}`);
}
if (!moved) console.log('  (none)');

console.log('');
console.log('NOTE: lab Lighthouse does not measure INP. TBT is a load-window proxy,');
console.log('so work removed from scroll handlers will not show up here at all.');
console.log('');
