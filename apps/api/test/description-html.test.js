import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_DESCRIPTION_LENGTH, plainTextToDescriptionHtml, sanitizeDescription, validateDescriptionLength } from '../src/services/description-html.js';

test('removes scripts, event handlers, styles, and embedded content', () => {
  assert.equal(sanitizeDescription('<p onclick="alert(1)">hi</p><script>alert(2)</script>'), '<p>hi</p>');
  assert.equal(sanitizeDescription('<p style="color:red" class="x" id="y">styled</p>'), '<p>styled</p>');
  assert.equal(sanitizeDescription('<iframe src="https://evil.test">bad</iframe><object>bad</object>ok'), 'ok');
  assert.equal(sanitizeDescription('<img src=x onerror=alert(1)><svg onload=alert(1)></svg>text'), 'text');
});

test('neutralizes parser-confusion payloads', () => {
  for (const payload of [
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    '<!--><script>alert(1)</script>-->',
    '<svg><style><img src=x onerror=alert(1)></style></svg>',
    '<a href="  java&#09;script:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
  ]) assert.doesNotMatch(sanitizeDescription(payload), /<script|onerror|javascript:|<img|<svg/i, payload);
});

test('allows only safe link schemes and forces new-tab link attributes', () => {
  assert.equal(sanitizeDescription('<p><a href="javascript:alert(1)">x</a></p>'), '<p>x</p>');
  assert.equal(sanitizeDescription('<p><a href="//evil.test">x</a></p>'), '<p>x</p>');
  assert.equal(sanitizeDescription('<p><a href="data:text/html,hi">x</a></p>'), '<p>x</p>');
  assert.equal(sanitizeDescription('<a href="tel:+15102097718">call</a>'), '<a href="tel:+15102097718" target="_blank" rel="noreferrer noopener">call</a>');
  assert.equal(sanitizeDescription('<a href="https://example.com" target="_self" rel="opener">x</a>'), '<a href="https://example.com" target="_blank" rel="noreferrer noopener">x</a>');
  assert.equal(sanitizeDescription('<a href="mailto:a@example.com">mail</a>'), '<a href="mailto:a@example.com" target="_blank" rel="noreferrer noopener">mail</a>');
});

test('keeps editor formatting and maps browser markup onto the allowlist', () => {
  const rich = '<h2>Overview</h2><p><strong>Bold</strong> <em>italic</em> <u>under</u><br>next</p><ul><li>One</li></ul><ol><li>Two</li></ol>';
  assert.equal(sanitizeDescription(rich), rich);
  assert.equal(sanitizeDescription('<div><b>Bold</b> and <i>it</i></div><h1>Big</h1><h4>Small</h4>'), '<p><strong>Bold</strong> and <em>it</em></p><h2>Big</h2><h3>Small</h3>');
  assert.equal(sanitizeDescription('<p><span style="font-family:Arial">pasted</span></p>'), '<p>pasted</p>');
});

test('converts legacy plain text into escaped paragraphs', () => {
  assert.equal(sanitizeDescription('Transaction side: Buyer. Lot < 5000 sqft & more'), '<p>Transaction side: Buyer. Lot &lt; 5000 sqft &amp; more</p>');
  assert.equal(sanitizeDescription('Line one\r\nline two\n\nSecond paragraph'), '<p>Line one<br>line two</p><p>Second paragraph</p>');
  assert.equal(plainTextToDescriptionHtml('  \n\n  '), '');
});

test('normalizes empty values and trailing blank paragraphs', () => {
  assert.equal(sanitizeDescription(undefined), '');
  assert.equal(sanitizeDescription(null), '');
  assert.equal(sanitizeDescription({ $ne: 1 }), '');
  assert.equal(sanitizeDescription(['<p>x</p>']), '');
  assert.equal(sanitizeDescription(42), '');
  assert.equal(sanitizeDescription('   '), '');
  assert.equal(sanitizeDescription('<p>Text</p><p><br></p>'), '<p>Text</p>');
  assert.equal(sanitizeDescription('<p><strong></strong>keep</p>'), '<p>keep</p>');
});

test('enforces the description length cap', () => {
  assert.equal(validateDescriptionLength(undefined), true);
  assert.equal(validateDescriptionLength('a'.repeat(MAX_DESCRIPTION_LENGTH)), true);
  assert.equal(validateDescriptionLength('a'.repeat(MAX_DESCRIPTION_LENGTH + 1)), false);
});
