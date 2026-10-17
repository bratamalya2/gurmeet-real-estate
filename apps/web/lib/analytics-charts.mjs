export const DOUGHNUT_COLORS = [
  '#2563eb',
  '#22a06b',
  '#c9942f',
  '#7c6ce5',
  '#0f9f9a',
  '#d97745',
];

export function buildDoughnutSegments(items = [], { labelKey = 'label', valueKey = 'count', colors = DOUGHNUT_COLORS } = {}) {
  const normalized = items.map((item, index) => ({
    label: String(item?.[labelKey] ?? 'Unknown'),
    count: Math.max(Number(item?.[valueKey]) || 0, 0),
    color: colors[index % colors.length],
  }));
  const total = normalized.reduce((sum, item) => sum + item.count, 0);
  let accumulated = 0;
  const segments = normalized.map(item => {
    const percentage = total ? (item.count / total) * 100 : 0;
    const segment = {
      ...item,
      percentage,
      startPercentage: accumulated,
      endPercentage: accumulated + percentage,
    };
    accumulated += percentage;
    return segment;
  });
  return { segments, total, empty: total === 0 };
}

export function doughnutSegmentGeometry(segment, circumference = 2 * Math.PI * 42) {
  const length = (segment.percentage / 100) * circumference;
  const gap = Math.max(circumference - length, 0);
  return {
    dashArray: `${length} ${gap}`,
    dashOffset: -((segment.startPercentage / 100) * circumference),
  };
}
