import { Header, Footer } from '../../components/SiteChrome';
import PropertyGrid from '../../components/PropertyGrid';
export const metadata = { title: 'Homes for Sale' };
export default function Sale() { return <><Header /><section className="page-hero"><p className="eyebrow">Discover your next address</p><h1>Homes for Sale</h1></section><main className="container section"><div className="feature-head"><div><h2 style={{ fontSize: 34 }}>Available Properties</h2><p className="muted">Explore residences represented by Gurmeet.</p></div></div><PropertyGrid status="Active" showFilters /></main><Footer /></>; }
