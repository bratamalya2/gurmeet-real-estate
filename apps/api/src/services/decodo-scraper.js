import axios from 'axios';

const DECODO_ENDPOINT = 'https://scraper-api.decodo.com/v2/scrape';
const MAX_PREVIEW_CHARS = 50_000;

function configuredHosts() {
  return (process.env.AUTHORIZED_SCRAPE_HOSTS || '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
}

export function assertAuthorizedScrapeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('A valid absolute URL is required.');
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Only credential-free HTTPS URLs are allowed.');
  }

  const hosts = configuredHosts();
  if (!hosts.length) {
    throw new Error('No authorized scrape hosts are configured.');
  }
  if (!hosts.includes(url.hostname.toLowerCase())) {
    throw new Error('This host is not authorized for scraping.');
  }
  return url.toString();
}

function contentFromProviderResponse(data) {
  if (typeof data === 'string') return data;
  const candidate = Array.isArray(data?.results) ? data.results[0] : data;
  return candidate?.content ?? candidate?.body ?? candidate?.html ?? data?.content ?? data?.body ?? data?.html ?? null;
}

export async function scrapeAuthorizedUrl(requestedUrl) {
  const url = assertAuthorizedScrapeUrl(requestedUrl);
  const suppliedToken = (process.env.DECODO_SCRAPER_BASIC_TOKEN || '').trim();
  const token = suppliedToken.replace(/^Basic\s+/i, '');
  if (!token) throw new Error('Decodo scraper credentials are not configured.');

  const response = await axios.post(DECODO_ENDPOINT, {
    url,
    proxy_pool: process.env.DECODO_SCRAPER_PROXY_POOL || 'premium',
  }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${token}`,
    },
    timeout: Number(process.env.DECODO_SCRAPER_TIMEOUT_MS || 60_000),
  });

  const content = contentFromProviderResponse(response.data);
  const text = typeof content === 'string' ? content : content ? JSON.stringify(content) : '';
  return {
    url,
    providerStatus: response.status,
    contentLength: Buffer.byteLength(text, 'utf8'),
    contentPreview: text.slice(0, MAX_PREVIEW_CHARS),
    contentTruncated: text.length > MAX_PREVIEW_CHARS,
  };
}
