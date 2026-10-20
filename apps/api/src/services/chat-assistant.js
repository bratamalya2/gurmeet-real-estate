import { z } from 'zod';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../constants/property-assets.js';

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 6;
const PROPERTY_TERMS = /\b(property|properties|home|homes|house|houses|listing|listings|buy|buying|search|showing|tour|bed|bedroom|br)\b/i;
const EXPLICIT_SEARCH_TERMS = /\b(show|find|search|browse|available|matching|listings?|properties)\b|\bhomes?\s+(?:in|under|below)\b/i;
const ASSISTANT_GUIDANCE_TERMS = /\b(i\s+(?:want|would like)|how can i|what are the steps|tell me how|help me|finance|financing|mortgage|loan|pre-approval|preapproval)\b/i;
const VALUATION_TERMS = /\b(worth|value|valuation|cma|appraisal|estimate|price my home|sell my home|selling)\b/i;
const CONTACT_TERMS = /\b(contact|call|phone|email|speak|talk|consultation|showing|tour|visit)\b/i;
const BUYER_SIDE_TERMS = /\b(bought|purchased|buyer representation|buyer side)\b/i;
const SELLER_SIDE_TERMS = /\b(sold by gurmeet|seller representation|seller side)\b/i;
const FINANCING_TERMS = /\b(finance|financing|mortgage|loan|pre-approval|preapproval|lender|down payment|interest rate)\b/i;
const BUYING_GUIDANCE_TERMS = /\b(buy|buying|purchase|purchasing|buyer)\b/i;
const SELLING_GUIDANCE_TERMS = /\b(sell|selling|seller|list my home|list a home)\b/i;
const VALUATION_GUIDANCE_TERMS = /\b(worth|value|valuation|cma|appraisal|estimate|price my home)\b/i;

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
  if (properties.length) return `I found ${properties.length} portfolio ${properties.length === 1 ? 'home' : 'homes'} that may be relevant. Open a property card for its available details, or contact Gurmeet for tailored guidance.`;
  if (mode === 'assistant') {
    if (FINANCING_TERMS.test(message)) return `## Financing a home purchase

1. **Set a comfortable budget.** Consider the purchase price, down payment, closing costs, taxes, insurance, and a reserve for ongoing ownership costs.
2. **Gather your financial documents.** A lender may ask for income, employment, asset, debt, and tax information so they can evaluate your application.
3. **Compare licensed lenders.** Ask about loan programs, rates, fees, minimum down payment, estimated monthly payment, and prepayment terms.
4. **Request pre-approval.** A pre-approval helps establish a working budget and shows sellers that a lender has reviewed your initial information.
5. **Keep your finances stable.** Avoid major new credit, large unexplained transfers, or job changes while your loan is being reviewed unless you discuss them with your lender first.
6. **Search within the approved range.** Gurmeet can help you compare portfolio homes and coordinate the property-search and offer process.
7. **Review the full cost of an offer.** Before making a decision, discuss contingencies, inspections, appraisal requirements, and estimated cash to close with the appropriate professionals.
8. **Complete underwriting and closing.** Your lender will verify the file and provide final loan disclosures; review those documents carefully before signing.

Loan qualification, rates, and terms depend on your lender and personal circumstances. Gurmeet can help with the real-estate process, while a licensed lender should answer loan-specific questions.`;
    if (SELLING_GUIDANCE_TERMS.test(message)) return `## Selling a home with Gurmeet

1. **Clarify your goals and timeline.** Decide whether your priority is timing, convenience, pricing, a move, or another personal objective.
2. **Request a home valuation.** Share the address, size, condition, improvements, and any relevant property details so Gurmeet can prepare a useful starting point.
3. **Review preparation options.** Identify repairs, cleaning, staging, photography, and other presentation choices that fit your timeline and budget.
4. **Set a pricing strategy.** Discuss available comparable information, property condition, competition, and the tradeoffs between price and timing.
5. **Prepare the launch.** Organize disclosures and listing information, then coordinate photography, marketing, showing access, and communication preferences.
6. **Evaluate offers carefully.** Compare price, financing, contingencies, timing, credits, and the overall strength of each offer.
7. **Manage inspections and negotiations.** Work through requests and required disclosures with the relevant licensed professionals and keep the transaction on schedule.
8. **Coordinate closing.** Confirm agreed repairs, dates, documents, possession details, and final walkthrough responsibilities before the transaction closes.

Use the Home Valuation page to begin a property-specific conversation. Estimates are planning guidance, not a guarantee of a future sale price.`;
    if (VALUATION_GUIDANCE_TERMS.test(message) || action === 'valuation') return `## Starting a home valuation

1. **Submit the property address.** Include the complete address so Gurmeet can understand which home you would like to discuss.
2. **Share useful context.** Note the bed and bath count, approximate size, condition, renovations, special features, and any timing considerations.
3. **Discuss the property’s presentation.** A review can identify updates or preparation steps that may affect how buyers experience the home.
4. **Review available comparable information.** Gurmeet can discuss relevant portfolio and local context where available, while being clear about which information is verified.
5. **Align the strategy with your goals.** Timing, convenience, preparation budget, and pricing expectations should be considered together.
6. **Choose next steps.** If you decide to proceed, Gurmeet can help plan preparation, marketing, showings, offer review, and transaction coordination.

Start with the Home Valuation form or use Contact to speak with Gurmeet. A valuation is an informed planning estimate and is not a guarantee of a sale price or lending value.`;
    if (action === 'contact') return `## How Gurmeet AI can help

1. **Buying:** organize your priorities, search the portfolio, and prepare questions for a property conversation.
2. **Selling:** start with a valuation, discuss preparation, and plan a listing strategy around your timeline.
3. **Valuation:** provide property details so Gurmeet can begin a focused review.
4. **Next step:** use the Contact page to share what you need and the best way to reach you.

Gurmeet can provide real-estate process guidance, while licensed lenders, attorneys, tax professionals, and other specialists should answer questions in their areas of practice.`;
    if (BUYING_GUIDANCE_TERMS.test(message)) return `## Buying a home with Gurmeet

1. **Define your priorities.** Identify the areas, home type, size, timing, and features that matter most to you.
2. **Set a realistic budget.** Review your cash reserves and expected ownership costs, then speak with a licensed lender about pre-approval.
3. **Build a focused search.** Gurmeet can help you compare portfolio homes and organize questions about each property.
4. **Review each home carefully.** Consider condition, disclosures, inspections, location information, and fit with your goals.
5. **Plan the offer.** Discuss price, contingencies, financing, timing, and negotiation strategy before submitting an offer.
6. **Complete due diligence.** Coordinate inspections, appraisal, lender underwriting, and required documents with the appropriate professionals.
7. **Prepare for closing.** Review final disclosures, confirm the walkthrough and closing timeline, and arrange funds and signing details.

Financing terms and qualification depend on your lender, so a licensed lender should answer loan-specific questions. Use Contact when you are ready to discuss your search with Gurmeet.`;
    return `## How Gurmeet AI can help

1. Ask about buying, selling, home valuation, or a specific property in the Homes By Gurmeet portfolio.
2. For a property search, use an explicit request such as “show homes in Fremont” so matching cards can be returned.
3. For a valuation, provide the property address and any known details about size, condition, and improvements.
4. For financing, speak with a licensed lender about qualification, rates, loan programs, and terms.
5. Use Contact when you want Gurmeet to understand your goals and coordinate a next conversation.

Responses are general guidance and property information should be verified before you make a decision.`;
  }
  if (action === 'valuation') return 'Gurmeet can prepare a complimentary home valuation based on your property and current local context. Use the Home Valuation form to get started, or contact Gurmeet directly for a conversation.';
  if (action === 'contact') return 'Gurmeet would be glad to help with your question or arrange a conversation. Use the Contact page to share the best way to reach you.';
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
  const responseGuidance = mode === 'assistant'
    ? 'For buying, selling, valuation, and financing questions, provide structured guidance with a short markdown heading and approximately 6-10 concise numbered steps. Financing guidance must remain general and direct the visitor to a licensed lender for qualification, rates, and loan terms.'
    : 'Respond in 2-4 concise, warm sentences focused on the matching portfolio records.';
  return `You are Gurmeet Singh's assistant for Homes By Gurmeet, a California real estate website. ${responseGuidance} ${modeGuidance} Never invent property details, MLS availability, real-time market data, demographics, schools, crime, or investment returns. Treat the portfolio context below as the only property data available. Do not provide legal, tax, or personalized lending/financial advice; provide general educational guidance and suggest an appropriate licensed professional where needed. Follow Fair Housing principles: do not make recommendations or claims based on protected characteristics. Encourage the visitor to use the Contact or Home Valuation page when appropriate.\n\nPortfolio context: ${propertyContext}`;
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
        max_completion_tokens: 900,
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
