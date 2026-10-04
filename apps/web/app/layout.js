import './globals.css';
import AnalyticsTracker from '../components/AnalyticsTracker';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'Homes By Gurmeet';
const brandOwner = process.env.NEXT_PUBLIC_BRAND_OWNER || 'Gurmeet Singh';
export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${brandName} | Luxury Real Estate`, template: `%s | ${brandName}` },
  description: `Exceptional residential real estate service with ${brandOwner}.`,
  alternates: { canonical: '/' },
  icons: {
    icon: '/HMG.png',
    shortcut: '/HMG.png',
    apple: '/HMG.png',
  },
  openGraph: { type: 'website', siteName: brandName, title: `${brandName} | Luxury Real Estate`, description: `Exceptional residential real estate service with ${brandOwner}.` },
};
export default function Layout({ children }) { return <html lang="en"><body><AnalyticsTracker />{children}</body></html>; }
