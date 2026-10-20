import { Footer, Header } from '../../components/SiteChrome';
import AiSearchClient from '../../components/AiSearchClient';

export const metadata = {
  title: 'Gurmeet AI Mode',
  description: 'Explore Homes By Gurmeet website content and portfolio properties with Gurmeet AI Mode.',
};

export default function AiSearchPage() {
  return <><Header /><AiSearchClient /><Footer /></>;
}
