import { Footer, Header } from '../../components/SiteChrome';
import AiSearchClient from '../../components/AiSearchClient';

export const metadata = {
  title: 'AI Property Assistant',
  description: 'Explore the Homes By Gurmeet portfolio with an AI-assisted property search.',
};

export default function AiSearchPage() {
  return <><Header /><AiSearchClient /><Footer /></>;
}
