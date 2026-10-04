import crypto from 'crypto';
import slugify from 'slugify';
import XLSX from 'xlsx';
import { Property } from '../models/index.js';

const SOURCE_NAMES = new Set(['redfin', 'zillow']);
const REDFIN_TABLE_HEADERS = ['Role', 'Address', 'City', 'State', 'ZIP'];
const LEGACY_REDFIN_HEADERS = ['ID', 'Status', 'Address', 'City', 'State', 'ZIP', 'Price'];

export class WorkbookImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkbookImportError';
    this.statusCode = 422;
  }
}

const text = value => value == null ? '' : String(value).trim();
const numeric = value => {
  if (value === '' || value == null) return undefined;
  const parsed = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};
const dateValue = value => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
};

export function normalizeAddress({ street = '', city = '', state = '', zip = '' } = {}) {
  return [street, city, state, zip].join('').toLowerCase().replace(/\W/g, '');
}

function streetCityKey({ street = '', city = '' } = {}) {
  return [street, city].join('').toLowerCase().replace(/\W/g, '');
}

function findHeaderRow(rows, requiredHeaders) {
  return rows.findIndex(row => requiredHeaders.every(header => row.some(value => text(value) === header)));
}

function headerIndex(row) {
  return Object.fromEntries(row.map((value, index) => [text(value), index]).filter(([key]) => key));
}

function addressFrom(row, indices) {
  return {
    street: text(row[indices.Address]),
    city: text(row[indices.City]),
    state: text(row[indices.State]),
    zip: text(row[indices.ZIP]),
  };
}

function makeRecord({ source, address, price, status, beds, baths, sqft, soldDate, side, verification, notes, url, externalId }) {
  const normalized = normalizeAddress(address);
  const key = streetCityKey(address) || normalized;
  if (!address.street || !address.city || !key) return null;

  const description = [
    side && `Transaction side: ${side}.`,
    verification,
    notes,
  ].filter(Boolean).join(' ');

  return {
    key,
    title: [address.street, address.city].filter(Boolean).join(', '),
    address: { ...address, normalized },
    price,
    beds,
    baths,
    sqft,
    status,
    description,
    images: [],
    featured: false,
    source: {
      name: source,
      externalId: externalId || `${source}-${normalized || key}`,
      url,
      lastSyncedAt: new Date(),
    },
    transaction: {
      soldDate,
      side,
      verification,
      notes,
    },
  };
}

function rowsAfterHeader(rows, index) {
  if (index < 0) return [];
  return rows.slice(index + 1);
}

function parseStructuredRedfinSheet(rows, options = {}) {
  const headerRowIndex = findHeaderRow(rows, REDFIN_TABLE_HEADERS);
  if (headerRowIndex < 0) return [];
  const indices = headerIndex(rows[headerRowIndex]);
  const records = [];
  for (const row of rowsAfterHeader(rows, headerRowIndex)) {
    if (!row.some(value => text(value))) break;
    const address = addressFrom(row, indices);
    if (!address.street) continue;
    records.push(makeRecord({
      source: 'redfin',
      address,
      price: numeric(row[indices['Sold price (USD)']]),
      status: options.status || 'Sold',
      beds: numeric(row[indices.Beds]),
      baths: numeric(row[indices.Baths]),
      sqft: numeric(row[indices['Sq ft']]),
      soldDate: dateValue(row[indices['Sold date']]),
      side: text(row[indices.Role]),
      verification: text(row[indices['Verification note']]),
      url: text(row[indices['Source URL']]),
    }));
  }
  return records.filter(Boolean);
}

function parseActiveRedfinSummary(rows) {
  const records = [];
  for (const row of rows) {
    const value = text(row[0]);
    const match = value.match(/Active listings:\s*(.+)$/i);
    if (!match) continue;
    const summary = match[1].replace(/\.\s*Source:.*$/i, '');
    for (const item of summary.split(';')) {
      const listing = item.trim().match(/^(.+?),\s*([^()]+?)\s*\(\$([\d,]+)\)$/);
      if (!listing) continue;
      records.push(makeRecord({
        source: 'redfin',
        address: { street: listing[1].trim(), city: listing[2].trim(), state: 'CA', zip: '' },
        price: numeric(listing[3]),
        status: 'Active',
        verification: 'Active listing from Redfin profile summary',
        url: 'https://www.redfin.com/real-estate-agents/gurmeet-singh',
      }));
    }
  }
  return records.filter(Boolean);
}

function parseLegacyRedfin(rows) {
  const headerRowIndex = findHeaderRow(rows, LEGACY_REDFIN_HEADERS);
  if (headerRowIndex < 0) return [];
  const indices = headerIndex(rows[headerRowIndex]);
  const records = [];
  for (const row of rowsAfterHeader(rows, headerRowIndex)) {
    if (!row.some(value => text(value))) continue;
    const address = addressFrom(row, indices);
    if (!address.street) continue;
    const statusValue = text(row[indices.Status]).toLowerCase();
    records.push(makeRecord({
      source: 'redfin',
      address,
      price: numeric(row[indices.Price]),
      status: statusValue.startsWith('active') ? 'Active' : statusValue.startsWith('pending') ? 'Pending' : 'Sold',
      beds: numeric(row[indices.Beds]),
      baths: numeric(row[indices.Baths]),
      sqft: numeric(row[indices['Sq Ft']]),
      soldDate: dateValue(row[indices['Sold Date']]),
      side: text(row[indices.Side]),
      verification: text(row[indices.Verification]),
      notes: text(row[indices.Notes]),
      url: text(row[indices['Primary Source URL']]),
      externalId: `redfin-workbook-${text(row[indices.ID])}`,
    }));
  }
  return records.filter(Boolean);
}

function parseRedfin(workbook) {
  const records = [];
  if (workbook.SheetNames.includes('Transactions')) {
    records.push(...parseLegacyRedfin(XLSX.utils.sheet_to_json(workbook.Sheets.Transactions, { header: 1, defval: '', raw: true })));
  } else {
    for (const sheetName of ['Current Redfin', 'Earlier workbook rows']) {
      if (!workbook.SheetNames.includes(sheetName)) continue;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
      records.push(...parseStructuredRedfinSheet(rows));
      if (sheetName === 'Current Redfin') records.push(...parseActiveRedfinSummary(rows));
    }
  }
  if (!records.length) throw new WorkbookImportError('The Redfin workbook contains no recognizable listing rows.');
  return records;
}

function parseBathsAndSqft(value) {
  const [baths, sqft] = text(value).split('/').map(item => item.trim());
  return { baths: numeric(baths), sqft: numeric(sqft) };
}

function parseZillow(workbook) {
  const sheet = workbook.Sheets['Profile and activity'];
  if (!sheet) throw new WorkbookImportError('The Zillow workbook must include a Profile and activity sheet.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  const records = [];

  const soldHeaderIndex = rows.findIndex(row => text(row[0]) === 'Address' && text(row[1]) === 'City');
  if (soldHeaderIndex >= 0) {
    const indices = headerIndex(rows[soldHeaderIndex]);
    for (const row of rowsAfterHeader(rows, soldHeaderIndex)) {
      if (!row.some(value => text(value)) || text(row[0]) === 'Active listing') break;
      const address = addressFrom(row, indices);
      const parsed = parseBathsAndSqft(row[indices['Baths / Sq ft']]);
      records.push(makeRecord({
        source: 'zillow',
        address,
        price: numeric(row[indices['Sold price (USD)']]),
        status: 'Sold',
        beds: numeric(row[indices.Beds]),
        baths: numeric(row[indices['Baths / Sq ft']]) ?? parsed.baths,
        sqft: parsed.sqft,
        side: text(row[indices['Role / relative timing']]),
        url: 'https://www.zillow.com/profile/Gurmeet%20Singh',
      }));
    }
  }

  const activeHeaderIndex = rows.findIndex(row => text(row[0]) === 'Active listing' && text(row[1]) === 'City');
  if (activeHeaderIndex >= 0) {
    const indices = headerIndex(rows[activeHeaderIndex]);
    for (const row of rowsAfterHeader(rows, activeHeaderIndex)) {
      if (!row.some(value => text(value))) break;
      const address = addressFrom(row, { ...indices, Address: 0 });
      const parsed = parseBathsAndSqft(row[indices['Baths / Sq ft']]);
      records.push(makeRecord({
        source: 'zillow',
        address,
        price: numeric(row[indices['Ask (USD)']]),
        status: text(row[indices.Status]).toLowerCase().includes('pending') ? 'Pending' : 'Active',
        beds: numeric(row[indices.Beds]),
        baths: parsed.baths,
        sqft: parsed.sqft,
        url: 'https://www.zillow.com/profile/Gurmeet%20Singh',
      }));
    }
  }

  if (!records.length) throw new WorkbookImportError('The Zillow workbook contains no recognizable listing rows.');
  return records.filter(Boolean);
}

export function detectWorkbookSource(workbook) {
  if (workbook.SheetNames.includes('Profile and activity')) return 'zillow';
  if (workbook.SheetNames.includes('Current Redfin') || workbook.SheetNames.includes('Earlier workbook rows') || workbook.SheetNames.includes('Transactions')) return 'redfin';
  throw new WorkbookImportError('Unsupported workbook. Upload a Redfin or Zillow workbook with the expected sheets.');
}

export function parseWorkbook(buffer, filename = 'uploaded.xlsx') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new WorkbookImportError('The uploaded workbook is empty.');
  let workbook;
  try {
    workbook = XLSX.read(buffer, { cellDates: true });
  } catch {
    throw new WorkbookImportError('The uploaded file is not a readable .xlsx workbook.');
  }
  const source = detectWorkbookSource(workbook);
  const rows = source === 'redfin' ? parseRedfin(workbook) : parseZillow(workbook);
  const uniqueRows = new Map();
  for (const row of rows) uniqueRows.set(row.key, row);
  if (!uniqueRows.size) throw new WorkbookImportError('The workbook contains no valid listing addresses.');
  return {
    source,
    filename,
    checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
    rows: [...uniqueRows.values()],
  };
}

function mergeRecord(primary, supplement) {
  const merged = {
    ...primary,
    address: {
      street: primary.address.street || supplement.address.street,
      city: primary.address.city || supplement.address.city,
      state: primary.address.state || supplement.address.state,
      zip: primary.address.zip || supplement.address.zip,
    },
    price: primary.price ?? supplement.price,
    beds: primary.beds ?? supplement.beds,
    baths: primary.baths ?? supplement.baths,
    sqft: primary.sqft ?? supplement.sqft,
    description: primary.description || supplement.description,
    transaction: { ...supplement.transaction, ...primary.transaction },
    source: { ...supplement.source, ...primary.source },
    providers: [...new Set([...(primary.providers || [primary.source.name]), supplement.source.name])],
  };
  merged.address.normalized = normalizeAddress(merged.address);
  merged.key = streetCityKey(merged.address) || merged.address.normalized;
  return merged;
}

export function mergeWorkbookRows(redfinRows = [], zillowRows = []) {
  const merged = new Map();
  const add = (row, primary) => {
    const keys = [row.key, normalizeAddress(row.address)].filter(Boolean);
    const existingKey = keys.find(key => merged.has(key));
    if (!existingKey) {
      const record = { ...row, providers: [row.source.name], source: { ...row.source } };
      for (const key of keys) merged.set(key, record);
      return;
    }
    const existing = merged.get(existingKey);
    const combined = primary ? mergeRecord(row, existing) : mergeRecord(existing, row);
    for (const key of [...keys, existing.key, normalizeAddress(existing.address)]) merged.set(key, combined);
  };
  redfinRows.forEach(row => add(row, true));
  zillowRows.forEach(row => add(row, false));

  const unique = [...new Set(merged.values())];
  const usedSlugs = new Set();
  return unique.map((row, index) => {
    const baseSlug = slugify(`${row.address.street}-${row.address.city}-${row.address.state}-${row.address.zip}`, { lower: true, strict: true }) || `property-${index + 1}`;
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    usedSlugs.add(slug);
    return {
      ...row,
      slug,
      source: {
        name: 'workbook',
        externalId: row.source.externalId,
        url: row.source.url,
        lastSyncedAt: new Date(),
        providers: row.providers,
      },
      images: [],
      featured: false,
      manualOverrides: { price: false, description: false, images: false },
      createdBy: undefined,
    };
  });
}

export function snapshotForDocument(parsed) {
  return {
    source: parsed.source,
    filename: parsed.filename,
    checksum: parsed.checksum,
    rowCount: parsed.rows.length,
    rows: parsed.rows,
    uploadedAt: new Date(),
  };
}

export function sourceIsValid(source) {
  return SOURCE_NAMES.has(source);
}

function cleanValue(value) {
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined).map(([key, nested]) => [key, cleanValue(nested)]));
  }
  return value;
}

function propertyMatchKeys(property) {
  const address = property.address || {};
  return [address.normalized, streetCityKey(address)].filter(Boolean);
}

export async function rebuildProperties(listings) {
  const existing = await Property.find().lean();
  const existingByKey = new Map();
  for (const property of existing) {
    for (const key of propertyMatchKeys(property)) {
      if (!existingByKey.has(key)) existingByKey.set(key, property);
    }
  }

  const matchedIds = new Set();
  const operations = [];
  let updated = 0;
  let created = 0;
  for (const listing of listings) {
    const match = [listing.key, normalizeAddress(listing.address)]
      .map(key => existingByKey.get(key))
      .find(property => property && !matchedIds.has(String(property._id)));
    const payload = cleanValue({
      title: listing.title,
      slug: listing.slug,
      address: listing.address,
      price: listing.price,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      description: listing.description,
      status: listing.status,
      featured: false,
      images: [],
      source: listing.source,
      transaction: listing.transaction,
      manualOverrides: { price: false, description: false, images: false },
    });
    if (match) {
      matchedIds.add(String(match._id));
      updated++;
      operations.push({ updateOne: { filter: { _id: match._id }, update: { $set: payload, $unset: { coordinates: 1, createdBy: 1, scraped: 1 } } } });
    } else {
      created++;
      operations.push({ insertOne: { document: payload } });
    }
  }

  const removeIds = existing.filter(property => !matchedIds.has(String(property._id))).map(property => property._id);
  if (removeIds.length) await Property.deleteMany({ _id: { $in: removeIds } });
  if (operations.length) await Property.bulkWrite(operations, { ordered: true });
  return { created, updated, removed: removeIds.length, totalListings: listings.length };
}
