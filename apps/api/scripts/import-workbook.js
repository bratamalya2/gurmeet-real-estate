import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import slugify from 'slugify';
import { Property } from '../src/models/index.js';
import { parseWorkbook } from '../src/services/workbook-import.js';

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error('Usage: npm run import:workbook -- /app/data/Redfin.xlsx');

async function run() {
  const absolutePath = path.resolve(workbookPath);
  const parsed = parseWorkbook(await fs.readFile(absolutePath), path.basename(absolutePath));
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homesbygurmeet');

  let created = 0;
  let updated = 0;
  for (const row of parsed.rows) {
    const externalId = row.source.externalId;
    const payload = {
      title: row.title,
      slug: slugify(`${row.address.street}-${row.address.city}-${row.address.state}-${row.address.zip}`, { lower: true, strict: true }),
      address: row.address,
      price: row.price,
      beds: row.beds,
      baths: row.baths,
      sqft: row.sqft,
      description: row.description,
      status: row.status,
      featured: false,
      source: { ...row.source, name: 'manual-workbook' },
      manualOverrides: { price: true, description: true, images: true },
      transaction: row.transaction,
    };
    const existing = await Property.findOne({ $or: [{ 'source.externalId': externalId }, { 'address.normalized': row.address.normalized }] });
    if (existing) {
      payload.images = existing.images || [];
      await Property.updateOne({ _id: existing._id }, { $set: payload });
      updated++;
    } else {
      await Property.create({ ...payload, images: [] });
      created++;
    }
  }
  console.log(JSON.stringify({ imported: parsed.rows.length, created, updated, source: parsed.source }, null, 2));
  await mongoose.disconnect();
}

run().catch(async error => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
