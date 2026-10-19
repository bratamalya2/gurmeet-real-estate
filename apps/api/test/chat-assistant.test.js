import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPropertySearchFilter, chatRequestSchema, createAssistantReply, detectChatIntent, extractPropertyCriteria, searchChatProperties } from '../src/services/chat-assistant.js';

test('validates bounded public chat requests', () => {
  assert.equal(chatRequestSchema.safeParse({ message: 'Homes in Fremont' }).success, true);
  assert.equal(chatRequestSchema.safeParse({ message: '' }).success, false);
  assert.equal(chatRequestSchema.safeParse({ message: 'x'.repeat(1201) }).success, false);
  assert.equal(chatRequestSchema.safeParse({ message: 'Hello', history: Array.from({ length: 7 }, () => ({ role: 'user', content: 'Too many' })) }).success, false);
  assert.equal(chatRequestSchema.safeParse({ message: 'Hello', history: [{ role: 'system', content: 'Invalid' }] }).success, false);
});

test('detects valuation, contact, and property-search intent without model output', () => {
  assert.deepEqual(detectChatIntent('What is my home worth?'), { action: 'valuation', propertySearch: false });
  assert.deepEqual(detectChatIntent('Please contact Gurmeet'), { action: 'contact', propertySearch: false });
  assert.deepEqual(detectChatIntent('Find a 3 bedroom home in Fremont'), { action: null, propertySearch: true });
});

test('extracts safe city, bedroom, price, and address property criteria', () => {
  const criteria = extractPropertyCriteria('Find a 3 bedroom home in Fremont under $1.2m', ['Fremont', 'San Jose']);
  assert.deepEqual(criteria, { city: 'Fremont', bedrooms: 3, maxPrice: 1200000, address: undefined });
  const filter = buildPropertySearchFilter(criteria);
  assert.equal(filter['address.city'].test('Fremont'), true);
  assert.deepEqual(filter.beds, { $gte: 3 });
  assert.deepEqual(filter.price, { $lte: 1200000 });
  assert.equal(buildPropertySearchFilter(extractPropertyCriteria('123 Main St', [])).$or[0].title.test('123 Main St'), true);
});

test('searches live property records using only safe public card fields', async () => {
  let receivedFilter;
  const rows = [{
    _id: 'property-id', title: '1 Main St, Fremont', slug: '1-main-st-fremont',
    address: { city: 'Fremont' }, price: 950000, beds: 3, baths: 2, status: 'Sold', images: ['/uploads/main.jpg'],
  }];
  const chain = {
    select() { return this; },
    sort() { return this; },
    limit(value) { assert.equal(value, 4); return this; },
    lean: async () => rows,
  };
  const PropertyModel = {
    distinct: async () => ['Fremont', 'Hayward'],
    find(filter) { receivedFilter = filter; return chain; },
  };
  const result = await searchChatProperties(PropertyModel, 'Show 3 bedroom homes in Fremont under $1m');
  assert.equal(receivedFilter['address.city'].test('Fremont'), true);
  assert.deepEqual(receivedFilter.beds, { $gte: 3 });
  assert.deepEqual(receivedFilter.price, { $lte: 1000000 });
  assert.deepEqual(result, [{ id: 'property-id', title: '1 Main St, Fremont', slug: '1-main-st-fremont', price: 950000, city: 'Fremont', beds: 3, baths: 2, status: 'Sold', image: '/uploads/main.jpg' }]);
});

test('uses the OpenAI Responses API without storing responses', async () => {
  let request;
  const result = await createAssistantReply({
    message: 'Tell me about a Fremont home',
    history: [{ role: 'user', content: 'Hi' }],
    properties: [{ title: '1 Main St', slug: '1-main', city: 'Fremont', price: 900000 }],
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'A concise, grounded reply.' }] }] }) };
    },
  });
  assert.equal(result.provider, 'openai');
  assert.equal(result.reply, 'A concise, grounded reply.');
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'test-model');
  assert.equal(body.store, false);
  assert.match(body.instructions, /never invent property details/i);
});

test('falls back safely when an API key is unavailable or an upstream request fails', async () => {
  const missingKey = await createAssistantReply({ message: 'What is my home worth?', action: 'valuation', apiKey: '' });
  assert.equal(missingKey.provider, 'fallback');
  assert.match(missingKey.reply, /valuation/i);
  const failedRequest = await createAssistantReply({
    message: 'Show homes',
    properties: [{ title: '1 Main St', slug: '1-main' }],
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  assert.equal(failedRequest.provider, 'fallback');
  assert.match(failedRequest.reply, /found 1 portfolio home/i);
});
