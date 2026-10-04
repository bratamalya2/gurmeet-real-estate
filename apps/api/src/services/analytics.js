import { AnalyticsEvent, Lead, Property, SystemLog, WorkbookImport } from '../models/index.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

export class AnalyticsRangeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalyticsRangeError';
    this.statusCode = 422;
  }
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value, label) {
  if (!value) return undefined;
  if (!DATE_PATTERN.test(value)) throw new AnalyticsRangeError(`${label} must use YYYY-MM-DD format.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || dateString(date) !== value) throw new AnalyticsRangeError(`${label} is not a valid calendar date.`);
  return date;
}

export function parseAnalyticsRange({ from, to, range, now = new Date() } = {}) {
  if (range === 'all') return { from: undefined, to: undefined, fromDate: null, toDate: null };
  const today = startOfUtcDay(now);
  const explicitEnd = parseDate(to, 'The end date');
  const end = explicitEnd || new Date(today.getTime() + DAY_MS - 1);
  const start = parseDate(from, 'The start date') || new Date(today.getTime() - ((DEFAULT_RANGE_DAYS - 1) * DAY_MS));
  if (start > end) throw new AnalyticsRangeError('The start date must be on or before the end date.');
  const endExclusive = explicitEnd ? new Date(end.getTime() + DAY_MS) : new Date(end.getTime() + 1);
  return {
    from: start.toISOString(),
    to: endExclusive.toISOString(),
    fromDate: start,
    toDate: endExclusive,
  };
}

function dateFilter(range) {
  if (!range.from && !range.to) return {};
  return { createdAt: { $gte: new Date(range.from), $lt: new Date(range.to) } };
}

function groupByDate(rows, key = 'count') {
  return rows.reduce((result, row) => {
    result[row._id] = row[key];
    return result;
  }, {});
}

function trendDates(range, eventDates, leadDates) {
  if (range.fromDate && range.toDate) {
    const dates = [];
    for (let cursor = range.fromDate; cursor < range.toDate; cursor = new Date(cursor.getTime() + DAY_MS)) dates.push(dateString(cursor));
    return dates;
  }
  return [...new Set([...eventDates, ...leadDates])].sort();
}

function round(value) {
  return value == null ? 0 : Math.round(value * 100) / 100;
}

function countBy(values) {
  return Object.entries(values).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function listingIdentity(property) {
  if (!property) return null;
  return { propertyId: String(property._id), slug: property.slug, title: property.title || property.address?.street || 'Untitled property' };
}

async function eventMetrics(filter) {
  const [counts, trend, topPages, topListings] = await Promise.all([
    AnalyticsEvent.aggregate([{ $match: filter }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    AnalyticsEvent.aggregate([{ $match: filter }, { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' }, count: { $sum: 1 } } }, { $sort: { '_id.date': 1 } }]),
    AnalyticsEvent.aggregate([{ $match: { ...filter, type: 'page_view' } }, { $group: { _id: '$path', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 10 }]),
    AnalyticsEvent.aggregate([{ $match: { ...filter, type: 'listing_view', property: { $ne: null } } }, { $group: { _id: '$property', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 10 }]),
  ]);
  const propertyIds = topListings.map(row => row._id);
  const properties = await Property.find({ _id: { $in: propertyIds } }).select('title slug address').lean();
  const propertyMap = new Map(properties.map(property => [String(property._id), property]));
  const countMap = Object.fromEntries(counts.map(row => [row._id, row.count]));
  return {
    pageViews: countMap.page_view || 0,
    listingViews: countMap.listing_view || 0,
    trend,
    topPages: topPages.map(row => ({ path: row._id, views: row.count })),
    topListings: topListings.map(row => ({ ...listingIdentity(propertyMap.get(String(row._id))), views: row.count })).filter(row => row.propertyId),
  };
}

async function leadMetrics(filter) {
  const [trend, byType, byListing] = await Promise.all([
    Lead.aggregate([{ $match: filter }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Lead.aggregate([{ $match: filter }, { $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
    Lead.aggregate([{ $match: { ...filter, property: { $ne: null } } }, { $group: { _id: '$property', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 10 }]),
  ]);
  const propertyIds = byListing.map(row => row._id);
  const properties = await Property.find({ _id: { $in: propertyIds } }).select('title slug address').lean();
  const propertyMap = new Map(properties.map(property => [String(property._id), property]));
  return {
    total: trend.reduce((sum, row) => sum + row.count, 0),
    trend,
    byType: byType.map(row => ({ type: row._id, count: row.count })),
    byListing: byListing.map(row => ({ ...listingIdentity(propertyMap.get(String(row._id))), leads: row.count })).filter(row => row.propertyId),
  };
}

export function inventoryMetrics(properties) {
  const statuses = { Active: 0, Pending: 0, Sold: 0 };
  const cities = {};
  const sources = {};
  const prices = [];
  let withImages = 0;
  properties.forEach(property => {
    if (statuses[property.status] !== undefined) statuses[property.status]++;
    const city = property.address?.city || 'Unknown';
    cities[city] = (cities[city] || 0) + 1;
    const providers = property.source?.providers?.length ? property.source.providers : [property.source?.name || 'unknown'];
    providers.forEach(source => { sources[source] = (sources[source] || 0) + 1; });
    if (property.images?.length) withImages++;
    if (property.status === 'Active' && Number.isFinite(property.price)) prices.push(property.price);
  });
  return {
    byStatus: Object.entries(statuses).map(([status, count]) => ({ status, count })),
    byCity: countBy(cities),
    price: { average: round(prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0), minimum: prices.length ? Math.min(...prices) : 0, maximum: prices.length ? Math.max(...prices) : 0 },
    imageCoverage: { withImages, withoutImages: properties.length - withImages },
    sourceCoverage: countBy(sources),
  };
}

async function dataHealth() {
  const [imports, logs, lastActivity] = await Promise.all([
    WorkbookImport.find().select('source filename rowCount uploadedAt checksum').sort({ uploadedAt: -1 }).lean(),
    SystemLog.find({ source: /^workbook:/ }).sort({ createdAt: -1 }).limit(20).lean(),
    SystemLog.findOne().sort({ createdAt: -1 }).select('source status created updated removed filename createdAt completedAt error').lean(),
  ]);
  const latestBySource = new Map();
  logs.forEach(log => {
    const source = log.source.split(':')[1];
    if (source && !latestBySource.has(source)) latestBySource.set(source, log);
  });
  return {
    latestImports: imports.map(item => ({ ...item, source: item.source, status: latestBySource.get(item.source)?.status || 'success', lastActivity: latestBySource.get(item.source)?.completedAt || item.uploadedAt })),
    lastActivity,
  };
}

export async function getAnalytics(query = {}) {
  const range = parseAnalyticsRange(query);
  const filter = dateFilter(range);
  const [events, leads, properties, health] = await Promise.all([
    eventMetrics(filter),
    leadMetrics(filter),
    Property.find().select('status price images address.city source.name source.providers').lean(),
    dataHealth(),
  ]);
  const eventTrend = events.trend.reduce((result, row) => {
    const date = row._id.date;
    result[date] ||= { pageViews: 0, listingViews: 0 };
    result[date][row._id.type === 'page_view' ? 'pageViews' : 'listingViews'] = row.count;
    return result;
  }, {});
  const leadTrend = groupByDate(leads.trend);
  const dates = trendDates(range, Object.keys(eventTrend), Object.keys(leadTrend));
  return {
    range: { from: range.fromDate ? dateString(range.fromDate) : null, to: range.toDate ? dateString(new Date(range.toDate.getTime() - 1)) : null },
    overview: { pageViews: events.pageViews, listingViews: events.listingViews, leads: leads.total, totalListings: properties.length, activeListings: properties.filter(property => property.status === 'Active').length, pendingListings: properties.filter(property => property.status === 'Pending').length, soldListings: properties.filter(property => property.status === 'Sold').length, activeAveragePrice: inventoryMetrics(properties).price.average },
    traffic: { trend: dates.map(date => ({ date, pageViews: eventTrend[date]?.pageViews || 0, listingViews: eventTrend[date]?.listingViews || 0 })), topPages: events.topPages, topListings: events.topListings },
    leads: { trend: dates.map(date => ({ date, count: leadTrend[date] || 0 })), byType: leads.byType, byListing: leads.byListing },
    inventory: inventoryMetrics(properties),
    dataHealth: health,
  };
}
