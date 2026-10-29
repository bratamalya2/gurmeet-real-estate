import assert from 'node:assert/strict';
import test from 'node:test';
import { describeDescription, descriptionMetaText, descriptionPlainText,descriptionToEditorHtml, isDescriptionHtml } from '../lib/property-description.mjs';

test('classifies rich HTML, legacy plain text, and empty descriptions', () => {
  assert.equal(describeDescription(''), null);
  assert.equal(describeDescription('   '), null);
  assert.equal(describeDescription(undefined), null);
  assert.deepEqual(describeDescription('<p>Hello <strong>there</strong></p>'), { kind: 'html', html: '<p>Hello <strong>there</strong></p>' });
  assert.deepEqual(describeDescription('Transaction side: Buyer.'), { kind: 'text', paragraphs: [['Transaction side: Buyer.']] });
});

test('keeps legacy text with a literal angle bracket as text', () => {
  assert.equal(isDescriptionHtml('Lot < 5000 sqft and > 2 baths'), false);
  assert.deepEqual(describeDescription('Lot < 5000 sqft'), { kind: 'text', paragraphs: [['Lot < 5000 sqft']] });
});

test('splits legacy newlines into paragraphs and line breaks', () => {
  assert.deepEqual(describeDescription('Line one\r\nline two\n\n\nSecond paragraph'), { kind: 'text', paragraphs: [['Line one', 'line two'], ['Second paragraph']] });
});

test('derives plain text for meta descriptions and structured data', () => {
  assert.equal(descriptionPlainText('<h2>Overview</h2><p>Chef&#39;s kitchen &amp; <strong>pool</strong></p><ul><li>3 beds</li><li>2 baths</li></ul>'), "Overview Chef's kitchen & pool 3 beds 2 baths");
  assert.equal(descriptionPlainText('<p>Line<br>break</p><p>&lt;tag&gt; &quot;quoted&quot; &nbsp;space</p>'), 'Line break <tag> "quoted" space');
  assert.equal(descriptionPlainText('Plain\n\ntext   here'), 'Plain text here');
  assert.equal(descriptionPlainText(''), '');
  assert.equal(descriptionPlainText(null), '');
});

test('truncates meta descriptions on a word boundary', () => {
  assert.equal(descriptionMetaText('<p>Short and sweet.</p>'), 'Short and sweet.');
  const long = descriptionMetaText(`<p>${'spacious '.repeat(40)}</p>`);
  assert.ok(long.length <= 160);
  assert.match(long, /spacious…$/);
  assert.equal(descriptionMetaText(''), '');
});

test('converts legacy plain text into escaped editor paragraphs', () => {
  assert.equal(descriptionToEditorHtml('Line one\nline two\n\nLot < 5 & up'), '<p>Line one<br>line two</p><p>Lot &lt; 5 &amp; up</p>');
  assert.equal(descriptionToEditorHtml('<p>Already rich</p>'), '<p>Already rich</p>');
  assert.equal(descriptionToEditorHtml(''), '');
});
