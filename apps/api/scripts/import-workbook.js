import 'dotenv/config';
import path from 'path';
import mongoose from 'mongoose';
import slugify from 'slugify';
import XLSX from 'xlsx';
import { Property } from '../src/models/index.js';

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error('Usage: npm run import:workbook -- /app/data/Redfin.xlsx');

const requiredColumns = ['ID', 'Status', 'Address', 'City', 'State', 'ZIP', 'Price', 'Beds', 'Baths', 'Sq Ft', 'Primary Source URL'];
const normalizeAddress = value => String(value || '').toLowerCase().replace(/\W/g, '');
const text = value => value == null ? '' : String(value).trim();
const numeric = value => value === '' || value == null ? undefined : Number(value);

function excelDate(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

async function run() {
  const workbook = XLSX.readFile(path.resolve(workbookPath), { cellDates: true });
  const sheet = workbook.Sheets.Transactions;
  if (!sheet) throw new Error('The workbook must include a Transactions sheet.');
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
  if (!rows.length) throw new Error('The Transactions sheet has no data rows.');
  const missing = requiredColumns.filter(column => !(column in rows[0]));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homesbygurmeet');
  let created = 0; let updated = 0; let skipped = 0;
  for (const row of rows) {
    const street = text(row.Address); const city = text(row.City); const state = text(row.State); const zip = text(row.ZIP);
    if (!street || !city || !state) { skipped++; continue; }
    const normalized = normalizeAddress(`${street}${city}${state}${zip}`);
    const externalId = `redfin-workbook-${text(row.ID)}`;
    const status = text(row.Status).toLowerCase().startsWith('active') ? 'Active' : 'Sold';
    const notes = text(row.Notes);
    const side = text(row.Side);
    const payload = {
      title: `${street}, ${city}`,
      slug: slugify(`${street}-${city}-${state}-${zip}`, { lower: true, strict: true }),
      address: { street, city, state, zip, normalized },
      price: numeric(row.Price), beds: numeric(row.Beds), baths: numeric(row.Baths), sqft: numeric(row['Sq Ft']),
      description: [side && `Transaction side: ${side}.`, notes].filter(Boolean).join(' '),
      status, featured: false,
      source: { name: 'manual-workbook', externalId, url: text(row['Primary Source URL']), lastSyncedAt: new Date() },
      manualOverrides: { price: true, description: true, images: true },
      transaction: { soldDate: excelDate(row['Sold Date']), side, verification: text(row.Verification), confidence: text(row['Confidence Level']), notes, imageSearchUrl: text(row['House Image Search URL']) },
    };
    const existing = await Property.findOne({ $or: [{ 'source.externalId': externalId }, { 'address.normalized': normalized }] });
    if (existing) {
      if (existing.images?.length) payload.images = existing.images;
      await Property.updateOne({ _id: existing._id }, { $set: payload });
      updated++;
    } else {
      await Property.create({ ...payload, images: [] });
      created++;
    }
  }
  console.log(JSON.stringify({ imported: rows.length, created, updated, skipped }, null, 2));
  await mongoose.disconnect();
}

run().catch(async error => { console.error(error.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
