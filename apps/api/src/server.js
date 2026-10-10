import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import slugify from 'slugify';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { User, Property, Lead, SystemLog, WorkbookImport, AnalyticsEvent } from './models/index.js';
import { syncSource } from './services/scraper.js';
import { scrapeAuthorizedUrl } from './services/decodo-scraper.js';
import { sendLeadNotification } from './services/mail.js';
import { WorkbookImportError, buildWorkbookListings, parseWorkbook, rebuildProperties, snapshotForDocument, validateExpectedWorkbookSource } from './services/workbook-import.js';
import { AnalyticsRangeError, getAnalytics } from './services/analytics.js';
import { propertySideFilter, propertySourceFilter } from './services/property-filters.js';
import { getMarketInsights } from './services/market-insights.js';
import { featuredPropertyFilter, featuredPropertySort } from './services/featured-properties.js';

const app = express();
app.set('trust proxy', 1);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.resolve(__dirname, '../uploads');
const publicFields = 'title slug address price beds baths sqft description status featured images coordinates source createdAt updatedAt transaction.soldDate transaction.side transaction.verification';

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDirectory));
app.get('/api/openapi.yaml', (req, res) => res.sendFile(path.resolve(__dirname, '../openapi.yaml')));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(null, { swaggerOptions: { url: '/api/openapi.yaml' }, customSiteTitle: 'HomesByGurmeet API Docs' }));

const sign = user => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'development-only-secret', { expiresIn: '8h' });
const auth = (roles = []) => (req, res, next) => {
  try {
    const user = jwt.verify(req.cookies.hbg_session, process.env.JWT_SECRET || 'development-only-secret');
    if (roles.length && !roles.includes(user.role)) return res.sendStatus(403);
    req.user = user;
    return next();
  } catch { return res.sendStatus(401); }
};
const upload = multer({
  dest: uploadsDirectory,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)),
});
const workbookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, callback) => {
    if (/\.xlsx$/i.test(file.originalname) || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return callback(null, true);
    const error = new Error('Only .xlsx workbook files are allowed.');
    error.statusCode = 422;
    return callback(error);
  },
});
const numberQuery = value => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const blankToUndefined = value => typeof value === 'string' && !value.trim() ? undefined : value;
const optionalText = schema => z.preprocess(blankToUndefined, schema.optional());
const optionalNumber = schema => z.preprocess(value => value === '' || value == null ? undefined : value, schema.optional());
const leadSchema = z.object({
  type: z.enum(['inquiry', 'showing', 'valuation', 'contact']),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6).max(40),
  message: optionalText(z.string().trim().max(2000)),
  property: optionalText(z.string().regex(/^[a-fA-F0-9]{24}$/)),
  preferredDate: optionalText(z.string().min(1).max(100)),
  propertyAddress: optionalText(z.string().trim().max(300)),
  squareFootage: optionalNumber(z.coerce.number().positive().max(100000)),
  condition: optionalText(z.string().trim().max(100)),
  turnstileToken: optionalText(z.string().min(1)),
}).superRefine((lead, ctx) => {
  if (lead.type === 'showing' && !lead.preferredDate) ctx.addIssue({ code: 'custom', path: ['preferredDate'], message: 'Choose a preferred date and time.' });
  if (lead.type === 'valuation' && !lead.propertyAddress) ctx.addIssue({ code: 'custom', path: ['propertyAddress'], message: 'Enter the property address.' });
});
const analyticsEventSchema = z.object({
  type: z.enum(['page_view', 'listing_view']),
  path: z.string().trim().min(1).max(300).regex(/^\//, 'Path must begin with /.').refine(path => !path.includes('?') && !path.includes('#'), 'Path must not include a query string or hash.'),
  propertyId: z.preprocess(value => value === '' || value == null ? undefined : value, z.string().regex(/^[a-fA-F0-9]{24}$/).optional()),
}).superRefine((event, ctx) => {
  if (event.type === 'listing_view' && !event.propertyId) ctx.addIssue({ code: 'custom', path: ['propertyId'], message: 'A listing view requires a property ID.' });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.post('/api/analytics/events', rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
  try {
    const parsed = analyticsEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || 'Invalid analytics event.' });
    await AnalyticsEvent.create({ type: parsed.data.type, path: parsed.data.path, property: parsed.data.propertyId });
    return res.sendStatus(204);
  } catch (error) { return next(error); }
});
app.get('/api/properties', async (req, res, next) => {
  try {
    const status = ['Active', 'Pending', 'Sold'].includes(req.query.status) ? req.query.status : undefined;
    const side = ['buyer', 'seller'].includes(req.query.side) ? req.query.side : undefined;
    const source = ['redfin', 'zillow'].includes(req.query.source) ? req.query.source : undefined;
    const sort = ['price_desc', 'price_asc'].includes(req.query.sort) ? req.query.sort : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 9));
    const minPrice = numberQuery(req.query.minPrice), maxPrice = numberQuery(req.query.maxPrice), beds = numberQuery(req.query.beds), baths = numberQuery(req.query.baths);
    const city = String(req.query.city || '').trim(), term = String(req.query.q || '').trim();
    const filter = {};
    if (status) filter.status = status;
    const sideFilter = propertySideFilter(side);
    if (sideFilter) Object.assign(filter, sideFilter);
    const sourceFilter = propertySourceFilter(source);
    const compoundFilters = [];
    if (sourceFilter) compoundFilters.push(sourceFilter);
    if (minPrice !== undefined || maxPrice !== undefined) filter.price = { ...(minPrice !== undefined ? { $gte: minPrice } : {}), ...(maxPrice !== undefined ? { $lte: maxPrice } : {}) };
    if (beds !== undefined) filter.beds = { $gte: beds };
    if (baths !== undefined) filter.baths = { $gte: baths };
    if (city) filter['address.city'] = new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (term) {
      const termExpression = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      compoundFilters.push({ $or: [{ title: termExpression }, { 'address.street': termExpression }, { 'address.city': termExpression }, { 'address.zip': termExpression }] });
    }
    if (compoundFilters.length) filter.$and = compoundFilters;
    const [items, total] = await Promise.all([
      sort
        ? Property.aggregate([
          { $match: filter },
          { $addFields: { _missingPrice: { $cond: [{ $gt: [{ $ifNull: ['$price', 0] }, 0] }, 0, 1] } } },
          { $sort: { _missingPrice: 1, price: sort === 'price_asc' ? 1 : -1, updatedAt: -1, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { title: 1, slug: 1, address: 1, price: 1, beds: 1, baths: 1, sqft: 1, description: 1, status: 1, featured: 1, images: 1, coordinates: 1, source: 1, createdAt: 1, updatedAt: 1, 'transaction.soldDate': 1, 'transaction.side': 1, 'transaction.verification': 1 } },
        ])
        : Property.find(filter).select(publicFields).sort({ featured: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Property.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit), limit });
  } catch (error) { next(error); }
});
app.get('/api/market-insights', async (req, res, next) => { try { return res.json(await getMarketInsights()); } catch (error) { return next(error); } });
app.get('/api/properties/featured', async (req, res, next) => {
  try {
    const properties = await Property.find(featuredPropertyFilter).select(publicFields).sort(featuredPropertySort).limit(10);
    return res.json(properties);
  } catch (error) { return next(error); }
});
app.get('/api/properties/map', async (req, res, next) => { try { res.json(await Property.find({ status: { $in: ['Active', 'Pending'] }, 'coordinates.lat': { $ne: null }, 'coordinates.lng': { $ne: null } }).select('title slug address price status coordinates').limit(250)); } catch (error) { next(error); } });
app.get('/api/properties/:slug', async (req, res, next) => { try { const property = await Property.findOne({ slug: req.params.slug }).select(publicFields); return property ? res.json(property) : res.sendStatus(404); } catch (error) { return next(error); } });

app.post('/api/leads', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
  try {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || 'Please complete all required fields.' });
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!parsed.data.turnstileToken) return res.status(422).json({ error: 'Complete the anti-spam verification.' });
      const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: parsed.data.turnstileToken, remoteip: req.ip }) }).then(response => response.json()).catch(() => ({ success: false }));
      if (!verification.success) return res.status(422).json({ error: 'Anti-spam verification failed. Please try again.' });
    }
    const { turnstileToken, ...lead } = parsed.data;
    const savedLead = await Lead.create(lead);
    try {
      const notification = await sendLeadNotification(savedLead);
      if (!notification.sent) console.warn(`Lead ${savedLead.id} saved without email notification: ${notification.reason}`);
    } catch (mailError) {
      // Preserve the lead even if email delivery is temporarily unavailable.
      console.error(`Lead ${savedLead.id} email notification failed:`, mailError.message);
    }
    return res.status(201).json({ ok: true });
  } catch (error) { return next(error); }
});

app.post('/api/auth/login', async (req, res, next) => { try { const user = await User.findOne({ email: req.body.email?.toLowerCase(), active: true }); if (!user || !await bcrypt.compare(req.body.password || '', user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' }); return res.cookie('hbg_session', sign(user), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 28_800_000 }).json({ user: { email: user.email, role: user.role } }); } catch (error) { return next(error); } });
app.post('/api/auth/logout', (req, res) => res.clearCookie('hbg_session').json({ ok: true }));
app.get('/api/auth/me', auth(), async (req, res, next) => { try { res.json(await User.findById(req.user.id).select('email role active')); } catch (error) { next(error); } });

app.get('/api/admin/properties', auth(), async (req, res, next) => { try { res.json(await Property.find().sort({ createdAt: -1 })); } catch (error) { next(error); } });
app.post('/api/admin/properties', auth(), async (req, res, next) => { try { const property = { ...req.body }; property.slug = property.slug || slugify(property.title || property.address?.street, { lower: true, strict: true }); property.address = { ...property.address, normalized: `${property.address?.street || ''}${property.address?.city || ''}${property.address?.state || ''}${property.address?.zip || ''}`.toLowerCase().replace(/\W/g, '') }; property.createdBy = req.user.id; res.status(201).json(await Property.create(property)); } catch (error) { next(error); } });
app.patch('/api/admin/properties/:id', auth(), async (req, res, next) => { try { const property = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); return property ? res.json(property) : res.sendStatus(404); } catch (error) { return next(error); } });
app.delete('/api/admin/properties/:id', auth(), async (req, res, next) => { try { const property = await Property.findByIdAndDelete(req.params.id); return property ? res.sendStatus(204) : res.sendStatus(404); } catch (error) { return next(error); } });
app.post('/api/admin/uploads', auth(), upload.array('images', 12), (req, res) => res.json({ paths: req.files.map(file => `/uploads/${file.filename}`) }));
app.delete('/api/admin/uploads/:filename', auth(), async (req, res, next) => { try { const filename = path.basename(req.params.filename); if (filename !== req.params.filename) return res.sendStatus(400); const target = path.resolve(uploadsDirectory, filename); if (!target.startsWith(`${uploadsDirectory}${path.sep}`)) return res.sendStatus(400); await fs.unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; }); await Property.updateMany({ images: `/uploads/${filename}` }, { $pull: { images: `/uploads/${filename}` } }); return res.sendStatus(204); } catch (error) { return next(error); } });
app.get('/api/admin/leads', auth(), async (req, res, next) => { try { res.json(await Lead.find().populate('property', 'title slug').sort({ createdAt: -1 })); } catch (error) { next(error); } });
app.get('/api/admin/logs', auth(), async (req, res, next) => { try { res.json(await SystemLog.find().sort({ createdAt: -1 }).limit(30)); } catch (error) { next(error); } });
app.post('/api/admin/listings/import', auth(['admin']), workbookUpload.fields([{ name: 'redfinFile', maxCount: 1 }, { name: 'zillowFile', maxCount: 1 }]), async (req, res, next) => {
  const redfinFile = req.files?.redfinFile?.[0];
  const zillowFile = req.files?.zillowFile?.[0];
  if (!redfinFile || !zillowFile) return res.status(422).json({ error: 'Choose both a Redfin and a Zillow .xlsx workbook.' });
  const log = await SystemLog.create({ source: 'workbook:paired', status: 'running', startedAt: new Date(), filename: `${redfinFile.originalname}, ${zillowFile.originalname}` });
  let parsed;
  let session;
  try {
    const redfin = parseWorkbook(redfinFile.buffer, redfinFile.originalname);
    const zillow = parseWorkbook(zillowFile.buffer, zillowFile.originalname);
    validateExpectedWorkbookSource(redfin.source, 'redfin');
    validateExpectedWorkbookSource(zillow.source, 'zillow');
    parsed = { redfin, zillow };
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      await WorkbookImport.findOneAndUpdate({ source: 'redfin' }, snapshotForDocument(redfin), { upsert: true, new: true, setDefaultsOnInsert: true, session });
      await WorkbookImport.findOneAndUpdate({ source: 'zillow' }, snapshotForDocument(zillow), { upsert: true, new: true, setDefaultsOnInsert: true, session });
      result = await rebuildProperties(buildWorkbookListings(redfin.rows, zillow.rows), { session });
    });
    await SystemLog.findByIdAndUpdate(log.id, { status: 'success', completedAt: new Date(), created: result.created, updated: result.updated, removed: result.removed, sourceRows: redfin.rows.length + zillow.rows.length, totalListings: result.totalListings });
    return res.status(200).json({ ok: true, sources: [{ source: 'redfin', filename: redfin.filename, sourceRows: redfin.rows.length }, { source: 'zillow', filename: zillow.filename, sourceRows: zillow.rows.length }], ...result });
  } catch (error) {
    await SystemLog.findByIdAndUpdate(log.id, { status: 'failed', completedAt: new Date(), error: String(error.message || error).slice(0, 1000) }).catch(() => {});
    if (error instanceof WorkbookImportError) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  } finally {
    await session?.endSession();
  }
});
app.post('/api/admin/scrape', auth(['admin']), async (req, res, next) => { const parsed = z.object({ url: z.string().url() }).safeParse(req.body); if (!parsed.success) return res.status(422).json({ error: 'Provide a valid URL.' }); const log = await SystemLog.create({ source: 'decodo', startedAt: new Date(), status: 'running', created: 0, updated: 0 }); try { const result = await scrapeAuthorizedUrl(parsed.data.url); await SystemLog.findByIdAndUpdate(log.id, { status: 'success', completedAt: new Date() }); return res.json(result); } catch (error) { const message = error.response?.status ? `Decodo request failed with status ${error.response.status}` : error.message; await SystemLog.findByIdAndUpdate(log.id, { status: 'failed', completedAt: new Date(), error: String(message).slice(0, 1000) }); return res.status(error.response?.status || 422).json({ error: message }); } });
app.get('/api/admin/analytics', auth(), async (req, res, next) => {
  try { return res.json(await getAnalytics(req.query)); } catch (error) { if (error instanceof AnalyticsRangeError) return res.status(error.statusCode).json({ error: error.message }); return next(error); }
});
app.get('/api/admin/users', auth(['admin']), async (req, res, next) => { try { res.json(await User.find().select('email role active createdAt')); } catch (error) { next(error); } });
app.post('/api/admin/users', auth(['admin']), async (req, res, next) => { try { const user = await User.create({ email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12), role: req.body.role || 'editor' }); res.status(201).json({ id: user.id, email: user.email, role: user.role }); } catch (error) { next(error); } });
app.patch('/api/admin/users/:id', auth(['admin']), async (req, res, next) => { try { const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role, active: req.body.active }, { new: true, runValidators: true }).select('email role active'); return user ? res.json(user) : res.sendStatus(404); } catch (error) { return next(error); } });
app.post('/api/admin/sync', auth(['admin']), async (req, res, next) => { try { const log = await SystemLog.create({ source: 'manual', startedAt: new Date(), status: 'running', created: 0, updated: 0 }); let created = 0; let updated = 0; const failed = []; for (const source of ['zillow', 'redfin']) { try { const result = await syncSource(source); created += result.created; updated += result.updated; } catch (error) { failed.push(`${source}: ${error.message}`); } } await SystemLog.findByIdAndUpdate(log.id, { status: failed.length ? (created || updated ? 'partial' : 'failed') : 'success', completedAt: new Date(), created, updated, error: failed.join('; ').slice(0, 1000) }); return res.json({ created, updated, failed }); } catch (error) { return next(error); } });

app.use((error, req, res, next) => { if (error instanceof multer.MulterError) return res.status(422).json({ error: error.code === 'LIMIT_FILE_SIZE' ? (['redfinFile', 'zillowFile'].includes(error.field) ? 'Each workbook must be 16 MB or smaller.' : 'Each image must be 8 MB or smaller.') : error.message }); if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message }); if (error?.code === 11000) return res.status(409).json({ error: 'A record with that unique value already exists.' }); console.error(error); return res.status(500).json({ error: 'An unexpected server error occurred.' }); });
async function bootstrap() { await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homesbygurmeet'); if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD && !await User.exists({ email: process.env.BOOTSTRAP_ADMIN_EMAIL })) await User.create({ email: process.env.BOOTSTRAP_ADMIN_EMAIL, passwordHash: await bcrypt.hash(process.env.BOOTSTRAP_ADMIN_PASSWORD, 12), role: 'admin' }); app.listen(process.env.PORT || 4000, () => console.log('API ready')); }
bootstrap().catch(error => { console.error(error); process.exit(1); });
