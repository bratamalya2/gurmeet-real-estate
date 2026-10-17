export function groupTopCities(items = [], limit = 8) {
  const sorted = [...items]
    .map(item => ({ ...item, count: Number(item.count) || 0 }))
    .sort((left, right) => right.count - left.count || String(left.city).localeCompare(String(right.city)));
  const visible = sorted.slice(0, limit);
  const othersCount = sorted.slice(limit).reduce((sum, item) => sum + item.count, 0);
  return othersCount ? [...visible, { city: 'Others', count: othersCount }] : visible;
}

export function buildPrimaryMetrics(data = {}) {
  return {
    medianSalePrice: Number(data.medianSalePrice) || 0,
    averageSalePrice: Number(data.averageSalePrice) || 0,
    averagePricePerSqft: Number(data.averagePricePerSqft) || 0,
    totalSalesVolume: Number(data.totalSalesVolume) || 0,
  };
}

export function buildPortfolioScope(data = {}) {
  const soldHomes = Number(data.soldCount) || 0;
  const cities = new Set(
    (data.byCity || [])
      .map(item => String(item.city || '').trim())
      .filter(Boolean),
  );
  const coverage = data.coverage || {};

  return {
    soldHomes,
    cityCount: cities.size,
    pricedHomes: Number(coverage.priced) || 0,
    datedHomes: Number(coverage.withSoldDate) || 0,
  };
}

export function projectCaliforniaMapPoints(points = [], width = 320, height = 480) {
  const bounds = { minLat: 32.4, maxLat: 42.1, minLng: -124.6, maxLng: -114.0 };
  const padding = { top: 22, right: 36, bottom: 24, left: 36 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  return points
    .filter(point => {
      const lat = Number(point?.latitude);
      const lng = Number(point?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
    })
    .map(point => ({
      ...point,
      x: padding.left + (Number(point.longitude) - bounds.minLng) / (bounds.maxLng - bounds.minLng) * plotWidth,
      y: padding.top + (bounds.maxLat - Number(point.latitude)) / (bounds.maxLat - bounds.minLat) * plotHeight,
    }));
}

export function buildMappableCities(cities = [], points = []) {
  const coordinateGroups = new Map();

  points.forEach(point => {
    const city = String(point?.city || '').trim();
    const latitude = Number(point?.latitude);
    const longitude = Number(point?.longitude);
    if (!city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const key = city.toLocaleLowerCase();
    const group = coordinateGroups.get(key) || { latitude: 0, longitude: 0, coordinateCount: 0, approximate: false };
    group.latitude += latitude;
    group.longitude += longitude;
    group.coordinateCount += 1;
    group.approximate = group.approximate || Boolean(point?.approximate);
    coordinateGroups.set(key, group);
  });

  return cities.map(city => {
    const key = String(city?.city || '').trim().toLocaleLowerCase();
    const group = coordinateGroups.get(key);
    const result = {
      ...city,
      latitude: group ? group.latitude / group.coordinateCount : null,
      longitude: group ? group.longitude / group.coordinateCount : null,
      coordinateCount: group?.coordinateCount || 0,
    };
    if (group?.approximate) result.approximate = true;
    return result;
  });
}

export function buildYearChartData(items = [], width = 920, height = 300) {
  const data = [...items].sort((left, right) => Number(left.year) - Number(right.year));
  const padding = { top: 28, right: 72, bottom: 48, left: 54 };
  const chartWidth = Math.max(width - padding.left - padding.right, 1);
  const chartHeight = Math.max(height - padding.top - padding.bottom, 1);
  const maxCount = Math.max(...data.map(item => Number(item.count) || 0), 1);
  const maxAveragePrice = Math.max(...data.map(item => Number(item.averageSalePrice) || 0), 1);
  const step = data.length > 1 ? chartWidth / data.length : chartWidth / 2;
  const barWidth = Math.min(64, step * 0.58);
  const points = data.map((item, index) => {
    const count = Number(item.count) || 0;
    const averageSalePrice = Number(item.averageSalePrice) || 0;
    const x = padding.left + (data.length > 1 ? step * index + step / 2 : chartWidth / 2);
    const barHeight = count / maxCount * chartHeight;
    return {
      year: item.year,
      count,
      averageSalePrice,
      x,
      barX: x - barWidth / 2,
      barY: padding.top + chartHeight - barHeight,
      barWidth,
      barHeight,
      lineY: padding.top + chartHeight - averageSalePrice / maxAveragePrice * chartHeight,
    };
  });
  return { points, maxCount, maxAveragePrice, padding, chartWidth, chartHeight, width, height };
}
