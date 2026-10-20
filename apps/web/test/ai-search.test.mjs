import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_SEARCH_LABEL, buildAiSearchRequest, providerLabel } from '../lib/ai-search.mjs';

test('keeps browser history visible without sending previous context to the API', () => {
  const longAssistantReply = 'A'.repeat(6500);
  const request = buildAiSearchRequest({
    message: 'I want to buy a home in Fremont',
    mode: 'assistant',
    history: [...Array.from({ length: 6 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `Turn ${index}` })), { role: 'assistant', content: longAssistantReply }],
    filters: { city: '', beds: '', maxPrice: '' },
  });
  assert.equal(request.mode, 'assistant');
  assert.deepEqual(request.history, []);
  assert.deepEqual(request.filters, {});
});

test('uses the Gurmeet AI Mode public label', () => {
  assert.equal(AI_SEARCH_LABEL, 'Gurmeet AI Mode');
});

test('labels the actual AI provider transparently', () => {
  assert.equal(providerLabel('openai'), 'Gurmeet AI Mode · OpenAI');
  assert.equal(providerLabel('local_fallback'), 'Gurmeet AI Mode · Local fallback');
  assert.equal(providerLabel(undefined), AI_SEARCH_LABEL);
});
