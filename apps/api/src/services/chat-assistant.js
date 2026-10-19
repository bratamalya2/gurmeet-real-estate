import { z } from 'zod';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../constants/property-assets.js';

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 6;
const PROPERTY_TERMS = /\b(property|properties|home|homes|house|houses|listing|listings|buy|buying|search|showing|tour|bed|bedroom|br)\b/i;
const VALUATION_TERMS = /\b(worth|value|valuation|cma|appraisal|estimate|price my home|sell my home|selling)\b/i;
const CONTACT_TERMS = /\b(contact|call|phone|email|speak|talk|consultation|showing|tour|visit)\b/i;

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, 'Enter a message.').max(MAX_MESSAGE_LENGTH, `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  })).max(MAX_HISTORY_MESSAGES, `Send no more than ${MAX_HISTORY_MESSAGES} recent messages.`).default([]),
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

export function extractPropertyCriteria(message = '', cities = []) {
  const value = cleanText(message);
  const lower = value.toLowerCase();
  const city = [...cities]
    .map(candidate => cleanText(candidate))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find(candidate => lower.includes(candidate.toLowerCase()));

  const bedrooms = Number(lower.match(/\b(\d+(?:\.5)?)\s*(?:bed|bedroom|br)\b/)?.[1]) || undefined;
  const priceMatch = lower.match(/\b(?:under|below|less than|budget(?:\s+of)?|up to|max(?:imum)?)\s*\$?([\d,.]+)\s*(m|million|k|thousand)?\b/i);
  let maxPrice;
  if (priceMatch) {
    const parsed = Number(priceMatch[1].replace(/,/g, ''));
    const unit = priceMatch[2]?.toLowerCase();
    if (Number.isFinite(parsed) && parsed > 0) {
      maxPrice = unit === 'm' || unit === 'million' ? parsed * 1000000
        : unit === 'k' || unit === 'thousand' ? parsed * 1000
          : parsed < 100 ? parsed * 1000000 : parsed;
    }
  }

  const address = value.match(/\b\d{1,6}\s+[\w\s.'#-]+(?:street|st|avenue|ave|road|rd|drive|dr|court|ct|lane|ln|way|place|pl|boulevard|blvd)\b/i)?.[0];
  return { city, bedrooms, maxPrice, address: address || undefined };
}

export function buildPropertySearchFilter(criteria = {}) {
  const filter = {};
  if (criteria.city) filter['address.city'] = new RegExp(`^${escapeRegex(criteria.city)}$`, 'i');
  if (criteria.bedrooms) filter.beds = { $gte: criteria.bedrooms };
  if (criteria.maxPrice) filter.price = { $lte: criteria.maxPrice };
  if (criteria.address) {
    const addressExpression = new RegExp(escapeRegex(criteria.address), 'i');
    filter.$or = [{ title: addressExpression }, { 'address.street': addressExpression }];
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
    status: property.status || 'Sold',
    image: images.find(path => typeof path === 'string' && path.trim()) || PROPERTY_PLACEHOLDER_IMAGE,
  };
}

export async function searchChatProperties(PropertyModel, message) {
  const intent = detectChatIntent(message);
  if (!intent.propertySearch) return [];
  const cities = await PropertyModel.distinct('address.city', { 'address.city': { $exists: true, $ne: '' } });
  const criteria = extractPropertyCriteria(message, cities);
  const properties = await PropertyModel.find(buildPropertySearchFilter(criteria))
    .select('title slug address price beds baths status images transaction.soldDate updatedAt')
    .sort({ 'transaction.soldDate': -1, updatedAt: -1, _id: 1 })
    .limit(4)
    .lean();
  return properties.map(chatPropertyDocument).filter(property => property.slug);
}

export function fallbackReply({ message, properties = [], action } = {}) {
  if (action === 'valuation') return 'Gurmeet can prepare a complimentary home valuation based on your property and current local context. Use the Home Valuation form to get started, or contact Gurmeet directly for a conversation.';
  if (action === 'contact') return 'Gurmeet would be glad to help with your question or arrange a conversation. Use the Contact page to share the best way to reach you.';
  if (properties.length) return `I found ${properties.length} portfolio ${properties.length === 1 ? 'home' : 'homes'} that may be relevant. Open a property card for its available details, or contact Gurmeet for tailored guidance.`;
  if (detectChatIntent(message).propertySearch) return 'I could not find a direct portfolio match for that request. Gurmeet can help you explore comparable homes and off-market opportunities.';
  return 'I can help with Homes By Gurmeet portfolio homes, buying or selling guidance, and home valuation requests. What would you like to explore?';
}

export function assistantInstructions(properties = []) {
  const propertyContext = properties.length
    ? JSON.stringify(properties.map(({ title, slug, price, city, beds, baths, status }) => ({ title, slug, price, city, beds, baths, status })))
    : 'No matching portfolio properties were found.';
  return `You are Gurmeet Singh's assistant for Homes By Gurmeet, a California real estate website. Respond in 2-4 concise, warm sentences. You may discuss general buying, selling, and home-valuation process guidance, but never invent property details, MLS availability, real-time market data, demographics, schools, crime, or investment returns. Treat the portfolio context below as the only property data available. Do not give legal, tax, lending, or financial advice; suggest an appropriate professional where needed. Follow Fair Housing principles: do not make recommendations or claims based on protected characteristics. Encourage the visitor to use the Contact or Home Valuation page when appropriate.\n\nPortfolio context: ${propertyContext}`;
}

function outputText(payload = {}) {
  if (cleanText(payload.output_text)) return cleanText(payload.output_text);
  return (payload.output || [])
    .flatMap(item => item.content || [])
    .filter(content => content.type === 'output_text')
    .map(content => cleanText(content.text))
    .filter(Boolean)
    .join('\n');
}

export async function createAssistantReply({ message, history = [], properties = [], action = null, apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini', fetchImpl = fetch } = {}) {
  const fallback = fallbackReply({ message, properties, action });
  if (!apiKey) return { reply: fallback, provider: 'fallback' };
  const transcript = history.map(turn => `${turn.role === 'assistant' ? 'Assistant' : 'Visitor'}: ${turn.content}`).join('\n');
  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        store: false,
        instructions: assistantInstructions(properties),
        input: `${transcript ? `${transcript}\n` : ''}Visitor: ${message}`,
        max_output_tokens: 350,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const reply = outputText(await response.json());
    return reply ? { reply, provider: 'openai' } : { reply: fallback, provider: 'fallback' };
  } catch (error) {
    console.warn(`AI chat fallback: ${error.message}`);
    return { reply: fallback, provider: 'fallback' };
  }
}
