export const GURMEET_AI_LABEL = 'Gurmeet AI';

export function buildAiSearchRequest({ message, mode = 'database', history = [], filters = {} } = {}) {
  const normalizedFilters = {
    city: filters.city || undefined,
    beds: filters.beds || undefined,
    maxPrice: filters.maxPrice || undefined,
  };
  return {
    message: String(message || '').trim(),
    mode,
    history: history.slice(-6).map(turn => ({ role: turn.role, content: turn.content })),
    filters: Object.fromEntries(Object.entries(normalizedFilters).filter(([, value]) => value !== undefined)),
  };
}
