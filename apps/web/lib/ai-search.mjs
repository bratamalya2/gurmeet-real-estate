export const AI_SEARCH_LABEL = 'Gurmeet AI Mode';

export function providerLabel(provider) {
  if (provider === 'openai') return `${AI_SEARCH_LABEL} · OpenAI`;
  if (provider === 'local_fallback') return `${AI_SEARCH_LABEL} · Local fallback`;
  return AI_SEARCH_LABEL;
}

export function buildAiSearchRequest({ message, mode = 'database', history = [], filters = {} } = {}) {
  const normalizedFilters = {
    city: filters.city || undefined,
    beds: filters.beds || undefined,
    maxPrice: filters.maxPrice || undefined,
  };
  return {
    message: String(message || '').trim(),
    mode,
    history: [],
    filters: Object.fromEntries(Object.entries(normalizedFilters).filter(([, value]) => value !== undefined)),
  };
}
