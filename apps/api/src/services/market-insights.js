import { Property } from '../models/index.js';

const priceBands = [
  { label: 'Under $500K', minimum: 0, maximum: 500000 },
  { label: '$500K–$750K', minimum: 500000, maximum: 750000 },
  { label: '$750K–$1M', minimum: 750000, maximum: 1000000 },
  { label: '$1M+', minimum: 1000000, maximum: Infinity },
];

const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round = value => Math.round(value * 100) / 100;

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validDate(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function metricRecord(property) {
  const price = number(property.price);
  const sqft = number(property.sqft);
  const soldDate = validDate(property.transaction?.soldDate);
  return { price: price !== undefined && price > 0 ? price : undefined, sqft, soldDate, pricePerSqft: price !== undefined && price > 0 && sqft > 0 ? price / sqft : undefined };
}

export function buildMarketInsights(properties = []) {
  const records = properties.map(property => ({ property, metrics: metricRecord(property) }));
  const priced = records.filter(record => record.metrics.price !== undefined);
  const withSquareFootage = records.filter(record => record.metrics.sqft !== undefined && record.metrics.sqft > 0);
  const withSoldDate = records.filter(record => record.metrics.soldDate);
  const prices = priced.map(record => record.metrics.price);
  const pricePerSqft = records.filter(record => record.metrics.pricePerSqft !== undefined).map(record => record.metrics.pricePerSqft);
  const squareFootage = withSquareFootage.map(record => record.metrics.sqft);
  const beds = records.map(record => number(record.property.beds)).filter(value => value !== undefined && value >= 0);
  const baths = records.map(record => number(record.property.baths)).filter(value => value !== undefined && value >= 0);

  const cities = new Map();
  records.forEach(record => {
    const city = String(record.property.address?.city || '').trim();
    if (!city) return;
    if (!cities.has(city)) cities.set(city, []);
    cities.get(city).push(record);
  });
  const byCity = [...cities.entries()].map(([city, cityRecords]) => {
    const cityPrices = cityRecords.map(record => record.metrics.price).filter(value => value !== undefined);
    const cityPpsf = cityRecords.map(record => record.metrics.pricePerSqft).filter(value => value !== undefined);
    return { city, count: cityRecords.length, totalSalesVolume: cityPrices.reduce((sum, value) => sum + value, 0), averageSalePrice: round(average(cityPrices)), averagePricePerSqft: round(average(cityPpsf)) };
  }).sort((a, b) => b.count - a.count || b.totalSalesVolume - a.totalSalesVolume || a.city.localeCompare(b.city));

  const years = new Map();
  withSoldDate.forEach(record => {
    const year = String(record.metrics.soldDate.getUTCFullYear());
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(record);
  });
  const byYear = [...years.entries()].map(([year, yearRecords]) => {
    const yearPrices = yearRecords.map(record => record.metrics.price).filter(value => value !== undefined);
    return { year: Number(year), count: yearRecords.length, totalSalesVolume: yearPrices.reduce((sum, value) => sum + value, 0), averageSalePrice: round(average(yearPrices)) };
  }).sort((a, b) => a.year - b.year);

  const byPriceBand = priceBands.map(band => ({ label: band.label, count: priced.filter(record => record.metrics.price >= band.minimum && record.metrics.price < band.maximum).length }));
  const recentSales = [...records].sort((a, b) => {
    const first = (b.metrics.soldDate || validDate(b.property.updatedAt) || new Date(0)).valueOf();
    const second = (a.metrics.soldDate || validDate(a.property.updatedAt) || new Date(0)).valueOf();
    return first - second;
  }).slice(0, 8).map(record => ({
    propertyId: String(record.property._id),
    title: record.property.title || record.property.address?.street || 'Sold property',
    slug: record.property.slug,
    street: record.property.address?.street || '',
    city: record.property.address?.city || '',
    price: record.metrics.price || 0,
    soldDate: record.metrics.soldDate || null,
  }));

  return {
    soldCount: properties.length,
    totalSalesVolume: prices.reduce((sum, value) => sum + value, 0),
    averageSalePrice: round(average(prices)),
    medianSalePrice: round(median(prices)),
    averagePricePerSqft: round(average(pricePerSqft)),
    averageSqft: round(average(squareFootage)),
    averageBeds: round(average(beds)),
    averageBaths: round(average(baths)),
    coverage: { priced: priced.length, withSquareFootage: withSquareFootage.length, withSoldDate: withSoldDate.length },
    byYear,
    byCity,
    priceBands: byPriceBand,
    recentSales,
  };
}

export async function getMarketInsights() {
  const properties = await Property.find({ status: 'Sold' }).select('title slug address price beds baths sqft transaction.soldDate updatedAt').lean();
  return buildMarketInsights(properties);
}
