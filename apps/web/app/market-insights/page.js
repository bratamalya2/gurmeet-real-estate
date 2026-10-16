import { Header, Footer } from '../../components/SiteChrome';
import MarketInsights from '../../components/MarketInsights';
import { serverApiUrl } from '../../lib/api';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Market & Portfolio Insights',
  description: 'Portfolio insights based on homes sold with Gurmeet.',
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
    <MarketInsights data={data} />
    <Footer />
  </>;
}
