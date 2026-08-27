import { Header, Footer } from '../../components/SiteChrome';
import LeadForm from '../../components/LeadForm';

export const metadata = { title: 'Home Valuation', description: 'Request a complimentary home valuation from HomesByGurmeet.' };

export default function HomeValuation() {
  return <><Header /><main><section className="page-hero"><p className="eyebrow">For homeowners</p><h1>Discover Your Home’s Value</h1></section><section className="container section two"><div><p className="eyebrow">Complimentary valuation</p><h2 style={{ fontSize: 42, margin: '12px 0' }}>A considered view of your next move.</h2><p className="muted" style={{ lineHeight: 1.8 }}>Share a few details about your property and Gurmeet will prepare a personalized perspective on its current market position.</p></div><div className="card"><div className="card-body"><LeadForm type="valuation" /></div></div></section></main><Footer /></>;
}
