import { Header, Footer } from '../../components/SiteChrome';
import PropertyGrid from '../../components/PropertyGrid';

export const metadata = {
  title: 'Sold by Gurmeet',
  description: 'Homes sold with representation from Gurmeet Singh.',
};

export default function SoldByGurmeetPage() {
  return <>
    <Header />
    <main>
      <section className="page-hero"><div className="container"><p className="eyebrow">A record of results</p><h1>Sold by Gurmeet</h1><p>Browse homes sold with strategic marketing, clear communication, and expert representation from listing to close.</p></div></section>
      <section className="container section"><div className="section-heading"><div><p className="eyebrow">Seller representation</p><h2>Homes Sold by Gurmeet</h2></div><p>A selection of sold homes where Gurmeet represented the seller.</p></div><PropertyGrid status="Sold" side="seller" showFilters /></section>
    </main>
    <Footer />
  </>;
}
