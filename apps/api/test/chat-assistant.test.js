import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPropertySearchFilter, chatCompletionMessages, chatRequestSchema, createAssistantReply, detectChatIntent, extractPropertyCriteria, fallbackReply, searchChatProperties } from '../src/services/chat-assistant.js';

test('validates bounded public chat requests', () => {
  assert.equal(chatRequestSchema.safeParse({ message: 'Homes in Fremont' }).success, true);
  assert.equal(chatRequestSchema.parse({ message: 'Homes', mode: 'assistant', filters: { city: 'Fremont', beds: '3', maxPrice: '1200000' } }).filters.beds, 3);
  assert.equal(chatRequestSchema.safeParse({ message: 'Hello', mode: 'invalid' }).success, false);
  assert.equal(chatRequestSchema.safeParse({ message: '' }).success, false);
  assert.equal(chatRequestSchema.safeParse({ message: 'x'.repeat(1201) }).success, false);
  assert.equal(chatRequestSchema.safeParse({ message: 'Hello', history: [{ role: 'user', content: 'x'.repeat(1201) }] }).success, false);
  assert.equal(chatRequestSchema.safeParse({ message: 'Hello', history: [{ role: 'assistant', content: 'x'.repeat(1201) }] }).success, true);
  assert.equal(chatRequestSchema.safeParse({ message: 'Hello', history: [{ role: 'assistant', content: 'x'.repeat(6001) }] }).success, false);
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
  assert.deepEqual(criteria, { city: 'Fremont', bedrooms: 3, maxPrice: 1200000, side: undefined, address: undefined });
  const filter = buildPropertySearchFilter(criteria);
  assert.equal(filter['address.city'].test('Fremont'), true);
  assert.deepEqual(filter.beds, { $gte: 3 });
  assert.deepEqual(filter.price, { $lte: 1200000 });
  assert.equal(buildPropertySearchFilter(extractPropertyCriteria('123 Main St', [])).$or[0].title.test('123 Main St'), true);
  const textFilter = buildPropertySearchFilter(extractPropertyCriteria('Show Eleanor homes', []));
  assert.equal(textFilter.$or[0].title.test('1995 Eleanor Loop'), true);
  const portfolioFilter = buildPropertySearchFilter(extractPropertyCriteria('Homes bought in Fremont', ['Fremont']));
  assert.equal(portfolioFilter['address.city'].test('Fremont'), true);
  assert.equal(portfolioFilter['transaction.side'].test('Buyer & Seller'), true);
  assert.equal(portfolioFilter.$or, undefined);
});

test('searches live property records using only safe public card fields', async () => {
  let receivedFilter;
  const rows = [{
    _id: 'property-id', title: '1 Main St, Fremont', slug: '1-main-st-fremont',
    address: { city: 'Fremont' }, price: 950000, beds: 3, baths: 2, sqft: 1800, status: 'Sold', images: ['/uploads/main.jpg'],
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
  assert.deepEqual(result, [{ id: 'property-id', title: '1 Main St, Fremont', slug: '1-main-st-fremont', price: 950000, city: 'Fremont', beds: 3, baths: 2, sqft: 1800, status: 'Sold', image: '/uploads/main.jpg' }]);
});

test('AI Assistant mode gives process guidance unless the visitor explicitly asks to search', async () => {
  let queried = false;
  const PropertyModel = {
    distinct: async () => [],
    find() { queried = true; throw new Error('should not search'); },
  };
  assert.deepEqual(await searchChatProperties(PropertyModel, 'I want to buy a home in Fremont. What are the steps?', {}, 250, 'assistant'), []);
  assert.equal(queried, false);
  const reply = await createAssistantReply({ message: 'I want to buy a home. How can I finance it?', mode: 'assistant', apiKey: '' });
  assert.equal(reply.provider, 'local_fallback');
  assert.match(reply.reply, /## Financing a home purchase/);
  assert.match(reply.reply, /pre-approval|lender/i);
  assert.match(reply.reply, /loan-specific questions/i);
});

test('local AI Search fallback gives detailed buying, selling, and valuation guidance', () => {
  const buying = fallbackReply({ message: 'I want to buy a home', mode: 'assistant' });
  assert.match(buying, /## Buying a home with Gurmeet/);
  assert.match(buying, /Prepare for closing/);

  const selling = fallbackReply({ message: 'How can I sell my home?', mode: 'assistant', action: 'valuation' });
  assert.match(selling, /## Selling a home with Gurmeet/);
  assert.match(selling, /Evaluate offers carefully/);

  const valuation = fallbackReply({ message: 'What is my home worth?', mode: 'assistant', action: 'valuation' });
  assert.match(valuation, /## Starting a home valuation/);
  assert.match(valuation, /Submit the property address/);
});

test('AI Search mode searches when the visitor explicitly asks for homes', async () => {
  const chain = {
    select() { return this; },
    sort() { return this; },
    limit(value) { assert.equal(value, 250); return this; },
    lean: async () => [{ _id: 'property-id', title: '1 Main St, Fremont', slug: '1-main-st-fremont', address: { city: 'Fremont' }, status: 'Sold' }],
  };
  const PropertyModel = {
    distinct: async () => ['Fremont'],
    find(filter) { assert.equal(filter['address.city'].test('Fremont'), true); return chain; },
  };
  const result = await searchChatProperties(PropertyModel, 'Show homes in Fremont', {}, 250, 'assistant');
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, '1-main-st-fremont');
});

test('builds grounded Chat Completions messages from sanitized context', () => {
  const messages = chatCompletionMessages({
    message: 'Tell me about a Fremont home',
    history: [{ role: 'user', content: 'Hi' }],
    properties: [{ title: '1 Main St', slug: '1-main', city: 'Fremont', price: 900000 }],
    mode: 'assistant',
  });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /never invent property details/i);
  assert.equal(messages.length, 2);
  assert.equal(messages.some(message => message.content === 'Hi'), false);
  assert.deepEqual(messages.at(-1), { role: 'user', content: 'Tell me about a Fremont home' });
});

test('uses the OpenAI Chat Completions API without storing responses', async () => {
  let request;
  const result = await createAssistantReply({
    message: 'Tell me about a Fremont home',
    history: [{ role: 'user', content: 'Hi' }],
    properties: [{ title: '1 Main St', slug: '1-main', city: 'Fremont', price: 900000 }],
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'A concise, grounded reply.' } }] }) };
    },
  });
  assert.equal(result.provider, 'openai');
  assert.equal(result.reply, 'A concise, grounded reply.');
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'test-model');
  assert.equal(body.store, false);
  assert.equal(body.messages.at(-1).content, 'Tell me about a Fremont home');
  assert.match(body.messages[0].content, /never invent property details/i);
  assert.equal(body.max_completion_tokens, 2400);
});

test('falls back safely when an API key is unavailable or an upstream request fails', async () => {
  const missingKey = await createAssistantReply({ message: 'What is my home worth?', action: 'valuation', apiKey: '' });
  assert.equal(missingKey.provider, 'local_fallback');
  assert.match(missingKey.reply, /valuation/i);
  const failedRequest = await createAssistantReply({
    message: 'Show homes',
    properties: [{ title: '1 Main St', slug: '1-main' }],
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  assert.equal(failedRequest.provider, 'local_fallback');
  assert.match(failedRequest.reply, /found 1 portfolio home/i);
});
