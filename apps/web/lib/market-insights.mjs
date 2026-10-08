export function groupTopCities(items = [], limit = 8) {
  const sorted = [...items]
    .map(item => ({ ...item, count: Number(item.count) || 0 }))
    .sort((left, right) => right.count - left.count || String(left.city).localeCompare(String(right.city)));
  const visible = sorted.slice(0, limit);
  const othersCount = sorted.slice(limit).reduce((sum, item) => sum + item.count, 0);
  return othersCount ? [...visible, { city: 'Others', count: othersCount }] : visible;
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
