import assert from 'node:assert/strict';
import test from 'node:test';
import { buildYearChartData, groupTopCities } from '../lib/market-insights.mjs';

test('builds yearly bar and average-price line points in chronological order', () => {
  const chart = buildYearChartData([
    { year: 2025, count: 4, averageSalePrice: 800000 },
    { year: 2024, count: 2, averageSalePrice: 500000 },
  ]);
  assert.deepEqual(chart.points.map(point => point.year), [2024, 2025]);
  assert.deepEqual(chart.points.map(point => point.count), [2, 4]);
  assert.deepEqual(chart.points.map(point => point.averageSalePrice), [500000, 800000]);
  assert.equal(chart.points[0].barHeight < chart.points[1].barHeight, true);
  assert.equal(chart.points[0].lineY > chart.points[1].lineY, true);
});

test('returns an empty yearly chart for missing data', () => {
  const chart = buildYearChartData([]);
  assert.deepEqual(chart.points, []);
  assert.equal(chart.maxCount, 1);
  assert.equal(chart.maxAveragePrice, 1);
});

test('keeps the eight largest cities and aggregates remaining cities as Others', () => {
  const cities = Array.from({ length: 10 }, (_, index) => ({ city: `City ${index + 1}`, count: 10 - index }));
  const grouped = groupTopCities(cities);
  assert.deepEqual(grouped.slice(0, 8).map(item => item.city), ['City 1', 'City 2', 'City 3', 'City 4', 'City 5', 'City 6', 'City 7', 'City 8']);
  assert.deepEqual(grouped.at(-1), { city: 'Others', count: 3 });
});

test('does not add Others when there are eight or fewer cities', () => {
  const grouped = groupTopCities([{ city: 'Fremont', count: 4 }, { city: 'Hayward', count: 2 }]);
  assert.deepEqual(grouped, [{ city: 'Fremont', count: 4 }, { city: 'Hayward', count: 2 }]);
});
