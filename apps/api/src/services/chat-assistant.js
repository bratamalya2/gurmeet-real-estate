import { z } from 'zod';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../constants/property-assets.js';

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 6;
const PROPERTY_TERMS = /\b(property|properties|home|homes|house|houses|listing|listings|buy|buying|search|showing|tour|bed|bedroom|br)\b/i;
const EXPLICIT_SEARCH_TERMS = /\b(show|find|search|browse|available|matching|listings?|properties)\b|\bhomes?\s+(?:in|under|below)\b/i;
const ASSISTANT_GUIDANCE_TERMS = /\b(i\s+(?:want|would like)|how can i|what are the steps|tell me how|help me|financ|mortgage|loan|pre-approval|preapproval)\b/i;
const VALUATION_TERMS = /\b(worth|value|valuation|cma|appraisal|estimate|price my home|sell my home|selling)\b/i;
const CONTACT_TERMS = /\b(contact|call|phone|email|speak|talk|consultation|showing|tour|visit)\b/i;
const BUYER_SIDE_TERMS = /\b(bought|purchased|buyer representation|buyer side)\b/i;
const SELLER_SIDE_TERMS = /\b(sold by gurmeet|seller representation|seller side)\b/i;

const filtersSchema = z.object({
  city: z.preprocess(value => String(value || '').trim() || undefined, z.string().max(80).optional()),
  beds: z.preprocess(value => value === '' || value == null ? undefined : Number(value), z.number().int().min(1).max(20).optional()),
  maxPrice: z.preprocess(value => value === '' || value == null ? undefined : Number(value), z.number().positive().max(100000000).optional()),
}).strict().default({});

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, 'Enter a message.').max(MAX_MESSAGE_LENGTH, `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  })).max(MAX_HISTORY_MESSAGES, `Send no more than ${MAX_HISTORY_MESSAGES} recent messages.`).default([]),
  mode: z.enum(['database', 'assistant']).default('database'),
  filters: filtersSchema,
});

const cleanText = value => String(value || '').trim();
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function detectChatIntent(message = '') {
  const value = cleanText(message);
  const valuation = VALUATION_TERMS.test(value);
  const contact = !valuation && CONTACT_TERMS.test(value);
  return {
    action: valuation ? 'valuation' : contact ? 'contact' : null,
    propertySearch: !valuation && (PROPERTY_TERMS.test(value) || /\b\d+\s*(bed|bedroom|br)\b/i.test(value)),
  };
}

export function extractPropertyCriteria(message = '', cities = [], filters = {}) {
  const value = cleanText(message);
  const lower = value.toLowerCase();
  const city = cleanText(filters.city) || [...cities]
    .map(candidate => cleanText(candidate))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find(candidate => lower.includes(candidate.toLowerCase()));

  const bedrooms = filters.beds || Number(lower.match(/\b(\d+(?:\.5)?)\s*(?:bed|bedroom|br)\b/)?.[1]) || undefined;
  const priceMatch = lower.match(/\b(?:under|below|less than|budget(?:\s+of)?|up to|max(?:imum)?)\s*\$?([\d,.]+)\s*(m|million|k|thousand)?\b/i);
  let maxPrice = filters.maxPrice;
  if (!maxPrice && priceMatch) {
    const parsed = Number(priceMatch[1].replace(/,/g, ''));
    const unit = priceMatch[2]?.toLowerCase();
    if (Number.isFinite(parsed) && parsed > 0) {
      maxPrice = unit === 'm' || unit === 'million' ? parsed * 1000000
        : unit === 'k' || unit === 'thousand' ? parsed * 1000
          : parsed < 100 ? parsed * 1000000 : parsed;
    }
  }

  const address = value.match(/\b\d{1,6}\s+[\w\s.'#-]+(?:street|st|avenue|ave|road|rd|drive|dr|court|ct|lane|ln|way|place|pl|boulevard|blvd)\b/i)?.[0];
  const stopWords = new Set(['a', 'an', 'and', 'are', 'bed', 'beds', 'bedroom', 'bedrooms', 'br', 'bought', 'buy', 'buyer', 'buying', 'ca', 'california', 'completed', 'find', 'for', 'home', 'homes', 'house', 'houses', 'in', 'listing', 'listings', 'me', 'of', 'on', 'portfolio', 'property', 'properties', 'purchased', 'representation', 'sale', 'seller', 'side', 'sold', 'search', 'show', 'the', 'under', 'with']);
  const text = value
    .replace(/\$?[\d,.]+\s*(?:m|million|k|thousand)?/gi, ' ')
    .split(/[^a-zA-Z0-9]+/)
    .map(token => token.toLowerCase())
    .filter(token => token.length > 2 && !stopWords.has(token) && !/^\d+$/.test(token) && token !== city?.toLowerCase())
    .slice(0, 4)
    .join(' ');
  const side = BUYER_SIDE_TERMS.test(value) ? 'buyer' : SELLER_SIDE_TERMS.test(value) ? 'seller' : undefined;
  return { city, bedrooms, maxPrice, side, address: address || undefined, ...(address || !text ? {} : { text }) };
}

export function buildPropertySearchFilter(criteria = {}) {
  const filter = {};
  if (criteria.city) filter['address.city'] = new RegExp(`^${escapeRegex(criteria.city)}$`, 'i');
  if (criteria.bedrooms) filter.beds = { $gte: criteria.bedrooms };
  if (criteria.maxPrice) filter.price = { $lte: criteria.maxPrice };
  if (criteria.side) filter['transaction.side'] = criteria.side === 'buyer' ? /Buyer/i : /Seller/i;
  if (criteria.address || criteria.text) {
    const addressExpression = new RegExp(escapeRegex(criteria.address || criteria.text), 'i');
    filter.$or = [{ title: addressExpression }, { 'address.street': addressExpression }];
    if (!criteria.address) filter.$or.push({ 'address.city': addressExpression });
  }
  return filter;
}

export function chatPropertyDocument(property = {}) {
  const images = Array.isArray(property.images) ? property.images : [];
  return {
    id: String(property._id || property.id || ''),
    title: property.title || property.address?.street || 'Property',
    slug: property.slug,
    price: Number.isFinite(Number(property.price)) && Number(property.price) > 0 ? Number(property.price) : null,
    city: property.address?.city || null,
    beds: Number.isFinite(Number(property.beds)) ? Number(property.beds) : null,
    baths: Number.isFinite(Number(property.baths)) ? Number(property.baths) : null,
    sqft: Number.isFinite(Number(property.sqft)) ? Number(property.sqft) : null,
    status: property.status || 'Sold',
    image: images.find(path => typeof path === 'string' && path.trim()) || PROPERTY_PLACEHOLDER_IMAGE,
  };
}

export async function searchChatProperties(PropertyModel, message, filters = {}, maxResults = 4, mode = 'database') {
  const intent = detectChatIntent(message);
  const shouldSearch = mode === 'database'
    ? intent.propertySearch || filters.city || filters.beds || filters.maxPrice
    : (!ASSISTANT_GUIDANCE_TERMS.test(message) && EXPLICIT_SEARCH_TERMS.test(message)) || filters.city || filters.beds || filters.maxPrice;
  if (!shouldSearch) return [];
  const cities = await PropertyModel.distinct('address.city', { 'address.city': { $exists: true, $ne: '' } });
  const criteria = extractPropertyCriteria(message, cities, filters);
  const properties = await PropertyModel.find(buildPropertySearchFilter(criteria))
    .select('title slug address price beds baths sqft status images transaction.soldDate updatedAt')
    .sort({ 'transaction.soldDate': -1, updatedAt: -1, _id: 1 })
    .limit(Math.min(250, Math.max(1, maxResults)))
    .lean();
  return properties.map(chatPropertyDocument).filter(property => property.slug);
}

export function fallbackReply({ message, properties = [], action, mode = 'database' } = {}) {
  if (action === 'valuation') return 'Gurmeet can prepare a complimentary home valuation based on your property and current local context. Use the Home Valuation form to get started, or contact Gurmeet directly for a conversation.';
  if (action === 'contact') return 'Gurmeet would be glad to help with your question or arrange a conversation. Use the Contact page to share the best way to reach you.';
  if (properties.length) return `I found ${properties.length} portfolio ${properties.length === 1 ? 'home' : 'homes'} that may be relevant. Open a property card for its available details, or contact Gurmeet for tailored guidance.`;
  if (mode === 'assistant') {
    if (/\b(financ|mortgage|loan|pre-approval|preapproval)\b/i.test(message)) return 'A typical purchase starts with clarifying your goals, speaking with a licensed lender about pre-approval, reviewing suitable homes, and then moving through offer, inspection, appraisal, and closing steps. Financing terms depend on your lender and situation, so Gurmeet can coordinate the home-search process while a lender answers loan-specific questions.';
    if (/\b(buy|buying|purchase|purchasing)\b/i.test(message)) return 'Buying generally starts with your priorities and budget, followed by lender pre-approval, a focused home search, property review, offer strategy, inspections, and closing. Gurmeet can help you navigate the property and offer process; use Contact to begin a conversation.';
    if (/\b(sell|selling)\b/i.test(message)) return 'Selling generally starts with a property review and valuation, followed by preparation, pricing, marketing, showing management, negotiation, and closing coordination. Use Home Valuation to request a personalized starting point from Gurmeet.';
    return 'I can explain the buying, selling, and valuation process using Homes By Gurmeet’s services. Ask about a specific step, or use Contact to speak with Gurmeet directly.';
  }
  if (detectChatIntent(message).propertySearch) return 'I could not find a direct portfolio match for that request. Gurmeet can help you explore comparable homes and off-market opportunities.';
  return 'I can help with Homes By Gurmeet portfolio homes, buying or selling guidance, and home valuation requests. What would you like to explore?';
}

export function assistantInstructions(properties = [], mode = 'database') {
  const propertyContext = properties.length
    ? JSON.stringify(properties.map(({ title, slug, price, city, beds, baths, sqft, status }) => ({ title, slug, price, city, beds, baths, sqft, status })))
    : 'No matching portfolio properties were found.';
  const modeGuidance = mode === 'database'
    ? 'The visitor is using portfolio search. Describe only the matching records supplied below and encourage them to open a result card for details.'
    : 'The visitor is using the conversational assistant. Give general buying, selling, or valuation process guidance, but use the supplied records for any property-specific answer.';
  return `You are Gurmeet Singh's assistant for Homes By Gurmeet, a California real estate website. Respond in 2-4 concise, warm sentences. ${modeGuidance} Never invent property details, MLS availability, real-time market data, demographics, schools, crime, or investment returns. Treat the portfolio context below as the only property data available. Do not give legal, tax, lending, or financial advice; suggest an appropriate professional where needed. Follow Fair Housing principles: do not make recommendations or claims based on protected characteristics. Encourage the visitor to use the Contact or Home Valuation page when appropriate.\n\nPortfolio context: ${propertyContext}`;
}

export function chatCompletionMessages({ message, history = [], properties = [], mode = 'database' } = {}) {
  return [
    { role: 'system', content: assistantInstructions(properties, mode) },
    ...history.map(turn => ({ role: turn.role, content: turn.content })),
    { role: 'user', content: message },
  ];
}

export async function createAssistantReply({ message, history = [], properties = [], contextProperties = properties.slice(0, 4), action = null, mode = 'database', apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini', fetchImpl = fetch } = {}) {
  const fallback = fallbackReply({ message, properties, action, mode });
  if (!apiKey) return { reply: fallback, provider: 'local_fallback' };
  try {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: chatCompletionMessages({ message, history, properties: contextProperties, mode }),
        store: false,
        max_completion_tokens: 450,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const data = await response.json();
    const reply = cleanText(data.choices?.[0]?.message?.content);
    return reply ? { reply, provider: 'openai' } : { reply: fallback, provider: 'local_fallback' };
  } catch (error) {
    console.warn(`AI chat fallback: ${error.message}`);
    return { reply: fallback, provider: 'local_fallback' };
  }
}
