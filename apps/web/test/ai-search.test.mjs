import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAiSearchRequest, GURMEET_AI_LABEL, providerLabel } from '../lib/ai-search.mjs';

test('preserves conversation history while sending the selected Gurmeet AI mode', () => {
  const request = buildAiSearchRequest({
    message: 'I want to buy a home in Fremont',
    mode: 'assistant',
    history: Array.from({ length: 7 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `Turn ${index}` })),
    filters: { city: '', beds: '', maxPrice: '' },
  });
  assert.equal(request.mode, 'assistant');
  assert.deepEqual(request.history, [
    { role: 'assistant', content: 'Turn 1' },
    { role: 'user', content: 'Turn 2' },
    { role: 'assistant', content: 'Turn 3' },
    { role: 'user', content: 'Turn 4' },
    { role: 'assistant', content: 'Turn 5' },
    { role: 'user', content: 'Turn 6' },
  ]);
  assert.deepEqual(request.filters, {});
});

test('uses the Gurmeet AI public label', () => {
  assert.equal(GURMEET_AI_LABEL, 'Gurmeet AI');
});

test('labels the actual AI provider transparently', () => {
  assert.equal(providerLabel('openai'), 'Gurmeet AI · OpenAI');
  assert.equal(providerLabel('local_fallback'), 'Gurmeet AI · Local fallback');
  assert.equal(providerLabel(undefined), GURMEET_AI_LABEL);
});
