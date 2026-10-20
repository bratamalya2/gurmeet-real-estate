import { Header, Footer } from '../../components/SiteChrome';
import PropertyGrid from '../../components/PropertyGrid';

export const metadata = {
  title: 'Property Catalogue',
  description: 'Browse the complete Homes By Gurmeet property catalogue.',
};

export default function PropertyCataloguePage() {
  return <>
    <Header />
    <main>
      <section className="page-hero"><div className="container"><p className="eyebrow">Homes By Gurmeet</p><h1>Browse the Property Catalogue</h1><p>Explore the complete public portfolio with address, city, price, status, and property filters.</p></div></section>
      <section className="container section"><div className="section-heading"><div><p className="eyebrow">Complete portfolio</p><h2>All Properties</h2></div><p>Search and filter the current Homes By Gurmeet catalogue.</p></div><PropertyGrid showFilters showSourceFilters showPriceSort /></section>
    </main>
    <Footer />
  </>;
}
