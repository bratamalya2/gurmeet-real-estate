import { Header, Footer } from '../../components/SiteChrome';
import PropertyGrid from '../../components/PropertyGrid';

export const metadata = {
  title: 'Bought with Gurmeet',
  description: 'Homes purchased with representation from Gurmeet Singh.',
};

export default function BoughtWithGurmeetPage() {
  return <>
    <Header />
    <main>
      <section className="page-hero"><div className="container"><p className="eyebrow">A record of representation</p><h1>Bought with Gurmeet</h1><p>Explore homes purchased with thoughtful guidance, local expertise, and a steady hand from search through closing.</p></div></section>
      <section className="container section"><div className="section-heading"><div><p className="eyebrow">Buyer representation</p><h2>Homes Bought with Gurmeet</h2></div><p>A selection of sold homes where Gurmeet represented the buyer.</p></div><PropertyGrid status="Sold" side="buyer" showFilters showSourceFilters /></section>
    </main>
    <Footer />
  </>;
}
