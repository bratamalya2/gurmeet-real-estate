import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMappableCities, buildPortfolioScope, buildPrimaryMetrics, buildYearChartData, groupTopCities, projectCaliforniaMapPoints } from '../lib/market-insights.mjs';

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

test('builds the four portfolio KPI values and safely defaults unavailable data', () => {
  assert.deepEqual(
    buildPrimaryMetrics({
      medianSalePrice: 1200000,
      averageSalePrice: 1450000,
      averagePricePerSqft: 825,
      totalSalesVolume: 72500000,
    }),
    { medianSalePrice: 1200000, averageSalePrice: 1450000, averagePricePerSqft: 825, totalSalesVolume: 72500000 },
  );
  assert.deepEqual(buildPrimaryMetrics(), { medianSalePrice: 0, averageSalePrice: 0, averagePricePerSqft: 0, totalSalesVolume: 0 });
});

test('builds a truthful portfolio scope summary from available coverage data', () => {
  assert.deepEqual(buildPortfolioScope({
    soldCount: 12,
    byCity: [{ city: 'Fremont', count: 7 }, { city: 'Fremont', count: 2 }, { city: 'Dublin', count: 3 }],
    coverage: { priced: 9, withSoldDate: 10 },
  }), { soldHomes: 12, cityCount: 2, pricedHomes: 9, datedHomes: 10 });
  assert.deepEqual(buildPortfolioScope(), { soldHomes: 0, cityCount: 0, pricedHomes: 0, datedHomes: 0 });
});

test('projects valid California map points and excludes invalid or out-of-state coordinates', () => {
  const points = projectCaliforniaMapPoints([
    { slug: 'fremont', latitude: 37.5485, longitude: -121.9886 },
    { slug: 'outside', latitude: 45.5152, longitude: -122.6784 },
    { slug: 'invalid', latitude: 'x', longitude: -121.8 },
  ]);
  assert.equal(points.length, 1);
  assert.equal(points[0].slug, 'fremont');
  assert.equal(points[0].x > 0 && points[0].x < 320, true);
  assert.equal(points[0].y > 0 && points[0].y < 480, true);
  assert.deepEqual(projectCaliforniaMapPoints([]), []);
});

test('builds city hubs from actual stored coordinate points and preserves unmappable cities', () => {
  const cities = buildMappableCities(
    [{ city: 'Fremont', count: 4 }, { city: 'Dublin', count: 2 }],
    [
      { city: 'Fremont', latitude: 37.5, longitude: -122 },
      { city: 'Fremont', latitude: 37.6, longitude: -121.8 },
    ],
  );
  assert.deepEqual(cities[0], { city: 'Fremont', count: 4, latitude: 37.55, longitude: -121.9, coordinateCount: 2 });
  assert.deepEqual(cities[1], { city: 'Dublin', count: 2, latitude: null, longitude: null, coordinateCount: 0 });
});
