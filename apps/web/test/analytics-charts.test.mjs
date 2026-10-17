import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDoughnutSegments, doughnutSegmentGeometry } from '../lib/analytics-charts.mjs';

test('builds doughnut segments with totals and percentages', () => {
  const chart = buildDoughnutSegments([{ label: 'Active', count: 3 }, { label: 'Sold', count: 1 }]);
  assert.equal(chart.total, 4);
  assert.equal(chart.empty, false);
  assert.equal(chart.segments[0].percentage, 75);
  assert.equal(chart.segments[1].startPercentage, 75);
  assert.equal(chart.segments[1].endPercentage, 100);
});

test('preserves zero-valued categories and handles empty data', () => {
  const chart = buildDoughnutSegments([{ label: 'Active', count: 0 }, { label: 'Sold', count: 2 }]);
  assert.equal(chart.segments.length, 2);
  assert.equal(chart.segments[0].percentage, 0);
  assert.equal(buildDoughnutSegments([{ label: 'Active', count: 0 }]).empty, true);
  assert.deepEqual(buildDoughnutSegments().segments, []);
});

test('creates SVG dash geometry for a segment', () => {
  const chart = buildDoughnutSegments([{ label: 'Active', count: 1 }, { label: 'Sold', count: 1 }]);
  const geometry = doughnutSegmentGeometry(chart.segments[1], 100);
  assert.equal(geometry.dashArray, '50 50');
  assert.equal(geometry.dashOffset, -50);
});

test('normalizes negative and invalid counts to zero', () => {
  const chart = buildDoughnutSegments([{ label: 'Invalid', count: 'not-a-number' }, { label: 'Negative', count: -4 }]);
  assert.deepEqual(chart.segments.map(segment => segment.count), [0, 0]);
  assert.equal(chart.empty, true);
});
