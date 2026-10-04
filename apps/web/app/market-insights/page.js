import { Header, Footer } from '../../components/SiteChrome';
import MarketInsights from '../../components/MarketInsights';
import { serverApiUrl } from '../../lib/api';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Market Insights',
  description: 'A market overview based on homes sold with Gurmeet.',
};

async function getInsights() {
  try {
    const response = await fetch(serverApiUrl('market-insights'), { cache: 'no-store' });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export default async function MarketInsightsPage() {
  const data = await getInsights();
  return <>
    <Header />
    <main>
      <section className="page-hero"><div className="container"><p className="eyebrow">Sold market overview</p><h1>Market Insights</h1><p>Explore the patterns behind homes sold with Gurmeet, from pricing and size to the communities represented in this portfolio.</p></div></section>
      <section className="container section"><MarketInsights data={data} /></section>
    </main>
    <Footer />
  </>;
}
