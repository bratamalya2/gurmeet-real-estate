const agentPhone = process.env.AGENT_PHONE || process.env.NEXT_PUBLIC_AGENT_PHONE || '(510) 209-7718';
const agentEmail = process.env.AGENT_EMAIL || process.env.NEXT_PUBLIC_AGENT_EMAIL || 'gurmeetrealtor@gmail.com';

const WEBSITE_PAGES = [
  {
    title: 'Homes By Gurmeet',
    path: '/',
    keywords: ['home', 'homes by gurmeet', 'real estate', 'guidance', 'next move', 'featured residences', 'active listings'],
    content: 'Homes By Gurmeet provides thoughtful real estate guidance for buying, selling, home valuation, and exploring residential properties across California communities served by Gurmeet Singh.',
  },
  {
    title: 'About Gurmeet Singh',
    path: '/about',
    keywords: ['about', 'gurmeet', 'experience', 'realtor', 'credentials', 'license', 'dre', 'buyer representation', 'listing strategy', 'multilingual'],
    content: 'Gurmeet Singh is a California Realtor with CA DRE #01479256, licensed since 2007. His services include buyer representation, listing strategy and marketing, short-sale and hardship negotiation, financing coordination, and multilingual service in English, Hindi, Punjabi, and Urdu.',
  },
  {
    title: 'Real Estate Services',
    path: '/services',
    keywords: ['services', 'buying', 'selling', 'buyer', 'seller', 'active listings', 'homes for sale', 'evaluation'],
    content: 'Homes By Gurmeet offers buying guidance, selling strategy, home valuation support, and access to active listings. Buyers can contact Gurmeet to discuss a focused search; sellers can request a home evaluation; currently available properties are listed on the Homes for Sale page.',
  },
  {
    title: 'Bought with Gurmeet',
    path: '/bought-with-gurmeet',
    keywords: ['bought', 'buy', 'buyer', 'buyer representation', 'purchased', 'homes bought', 'transactions'],
    content: 'Bought with Gurmeet is a portfolio of homes purchased with Gurmeet representing the buyer, from search through closing. The page supports city, price, bedroom, source, and time filters for the available portfolio records.',
  },
  {
    title: 'Sold by Gurmeet',
    path: '/sold-by-gurmeet',
    keywords: ['sold', 'sell', 'seller', 'seller representation', 'listing', 'homes sold', 'transactions'],
    content: 'Sold by Gurmeet is a record of homes sold with Gurmeet representing the seller. The page highlights marketing, pricing, communication, negotiation, and sold portfolio records with searchable filters.',
  },
  {
    title: 'Homes for Sale',
    path: '/homes-for-sale',
    keywords: ['active', 'active listings', 'available', 'for sale', 'homes for sale', 'currently available', 'listing'],
    content: 'Homes for Sale shows currently active properties represented by Gurmeet. Visitors can browse available properties and use filters for city, price, bedrooms, baths, and other listing details.',
  },
  {
    title: 'Property Catalogue',
    path: '/property-catalogue',
    keywords: ['catalogue', 'catalog', 'all properties', 'complete portfolio', 'browse', 'property search', 'filter'],
    content: 'The Property Catalogue is the complete public Homes By Gurmeet portfolio. It supports searching and filtering by address, city, price, status, bedrooms, baths, source, and transaction timing.',
  },
  {
    title: 'Market and Portfolio Insights',
    path: '/market-insights',
    keywords: ['market', 'insights', 'portfolio', 'analysis', 'sold homes by city', 'bought homes by city', 'sales', 'price', 'square foot'],
    content: 'Market and Portfolio Insights summarizes verified completed portfolio transactions, including sale prices, price per square foot, annual sales performance, city representation, price bands, home characteristics, and recent sold homes. It represents Gurmeet’s portfolio rather than a general regional market report.',
  },
  {
    title: 'Contact Gurmeet',
    path: '/contact',
    keywords: ['contact', 'call', 'phone', 'email', 'conversation', 'showing', 'tour', 'office', 'availability', 'languages'],
    content: `Visitors can contact Gurmeet about buying, selling, home values, off-market opportunities, or private property showings. Direct phone: ${agentPhone}. Direct email: ${agentEmail}. The Contact page also lists credentials, multilingual support, and office information.`,
  },
  {
    title: 'Home Valuation',
    path: '/home-valuation',
    keywords: ['valuation', 'value', 'cma', 'home value', 'sell my home', 'evaluation', 'property address', 'market position'],
    content: 'The Home Valuation page lets homeowners share property details so Gurmeet can prepare a personalized perspective on the home’s current market position. The form asks for property information and sends the request for follow-up.',
  },
  {
    title: 'AI Search',
    path: '/ai-search',
    keywords: ['ai', 'assistant', 'website search', 'search', 'natural language', 'property search', 'guidance'],
    content: 'AI Search lets visitors search the public Homes By Gurmeet website and property portfolio, or ask for general buying, selling, financing, and home valuation guidance. Property information should be verified and financing-specific questions should be directed to a licensed lender.',
  },
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'about', 'can', 'do', 'does', 'for', 'from', 'get',
  'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to',
  'what', 'where', 'which', 'with', 'you', 'your',
]);

function tokens(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function excerpt(content, queryTokens) {
  const value = String(content || '').trim();
  if (value.length <= 260) return value;
  const lower = value.toLowerCase();
  const match = queryTokens.find(token => lower.includes(token));
  const start = match ? Math.max(0, lower.indexOf(match) - 65) : 0;
  const prefix = start > 0 ? '…' : '';
  const end = Math.min(value.length, start + 260);
  return `${prefix}${value.slice(start, end).trim()}${end < value.length ? '…' : ''}`;
}

export function searchWebsiteContent(query = '', maxResults = 5) {
  const queryValue = String(query || '').trim().toLowerCase();
  const queryTokens = tokens(queryValue);
  if (!queryTokens.length) return [];

  const results = WEBSITE_PAGES.map(page => {
    const keywordText = page.keywords.join(' ').toLowerCase();
    const searchable = `${page.title} ${keywordText} ${page.content}`.toLowerCase();
    let score = queryTokens.reduce((total, token) => total + (searchable.includes(token) ? 1 : 0), 0);
    if (queryValue.includes(page.title.toLowerCase())) score += 4;
    if (page.keywords.some(keyword => queryValue.includes(keyword))) score += 2;
    return { page, score };
  })
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title))
    .slice(0, Math.max(1, Math.min(8, maxResults)));

  return results.map(({ page }) => ({
    title: page.title,
    path: page.path,
    excerpt: excerpt(page.content, queryTokens),
  }));
}

export function websiteSearchContext(results = []) {
  return results.map(({ title, path, excerpt: summary }) => ({ title, path, excerpt: summary }));
}

export function websiteSearchPages() {
  return WEBSITE_PAGES.map(({ title, path, content }) => ({ title, path, content }));
}
