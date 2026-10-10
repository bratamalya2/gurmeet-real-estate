import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { WorkbookImport } from '../src/models/index.js';
import { buildWorkbookListings, parseWorkbook, rebuildProperties, snapshotForDocument, validateExpectedWorkbookSource } from '../src/services/workbook-import.js';

const [redfinPath, zillowPath] = process.argv.slice(2);
if (!redfinPath || !zillowPath) throw new Error('Usage: npm run import:workbook -- /app/data/redfin.xlsx /app/data/zillow.xlsx');

async function run() {
  const [redfin, zillow] = await Promise.all([
    fs.readFile(path.resolve(redfinPath)).then(buffer => parseWorkbook(buffer, path.basename(redfinPath))),
    fs.readFile(path.resolve(zillowPath)).then(buffer => parseWorkbook(buffer, path.basename(zillowPath))),
  ]);
  validateExpectedWorkbookSource(redfin.source, 'redfin');
  validateExpectedWorkbookSource(zillow.source, 'zillow');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homesbygurmeet?replicaSet=rs0');
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      await WorkbookImport.findOneAndUpdate({ source: 'redfin' }, snapshotForDocument(redfin), { upsert: true, new: true, setDefaultsOnInsert: true, session });
      await WorkbookImport.findOneAndUpdate({ source: 'zillow' }, snapshotForDocument(zillow), { upsert: true, new: true, setDefaultsOnInsert: true, session });
      const photos = await WorkbookImport.findOne({ source: 'photos' }).session(session).lean();
      result = await rebuildProperties(buildWorkbookListings(redfin.rows, zillow.rows, photos?.rows || []), { session });
    });
    console.log(JSON.stringify({ redfinRows: redfin.rows.length, zillowRows: zillow.rows.length, ...result }, null, 2));
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

run().catch(error => {
  console.error(error.message);
  process.exit(1);
});
