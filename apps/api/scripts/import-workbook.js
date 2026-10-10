import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { WorkbookImport } from '../src/models/index.js';
import { parseWorkbook, rebuildManifestProperties, snapshotForDocument } from '../src/services/workbook-import.js';

const [workbookPath] = process.argv.slice(2);
if (!workbookPath) throw new Error('Usage: npm run import:workbook -- "/app/data/Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx"');

async function run() {
  const parsed = await fs.readFile(path.resolve(workbookPath)).then(buffer => parseWorkbook(buffer, path.basename(workbookPath)));
  if (parsed.source !== 'workbook') throw new Error('The supplied file is not the Homes By Gurmeet portfolio workbook.');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homesbygurmeet?replicaSet=rs0');
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      await WorkbookImport.findOneAndUpdate({ source: 'workbook' }, snapshotForDocument(parsed), { upsert: true, new: true, setDefaultsOnInsert: true, session });
      result = await rebuildManifestProperties(parsed.rows, { session });
    });
    console.log(JSON.stringify({ sourceRows: parsed.rows.length, ...result }, null, 2));
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

run().catch(error => {
  console.error(error.message);
  process.exit(1);
});
