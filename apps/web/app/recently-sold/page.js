import { Header, Footer } from '../../components/SiteChrome';
import PropertyGrid from '../../components/PropertyGrid';
export const metadata = { title: 'Recently Sold' };
export default function Sold() { return <><Header /><section className="page-hero"><p className="eyebrow">A record of results</p><h1>Recently Sold</h1></section><main className="container section"><div className="feature-head"><div><h2 style={{ fontSize: 34 }}>Successful Closings</h2><p className="muted">A selection of homes entrusted to Gurmeet.</p></div></div><PropertyGrid status="Sold" showFilters /></main><Footer /></>; }
