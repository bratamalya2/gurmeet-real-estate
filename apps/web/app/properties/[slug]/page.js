import Link from "next/link";
import { notFound } from "next/navigation";
import { Header, Footer } from "../../../components/SiteChrome";
import LeadForm from "../../../components/LeadForm";
import AnalyticsTracker from "../../../components/AnalyticsTracker";
import { publicAssetUrl, serverApiUrl } from "../../../lib/api";
import { PROPERTY_PLACEHOLDER_IMAGE } from "../../../lib/property-assets";
import PropertyImage from "../../../components/PropertyImage";

export const dynamic = "force-dynamic";

async function getProperty(slug) {
  try {
    const response = await fetch(serverApiUrl(`properties/${slug}`), {
      cache: "no-store",
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

const cleanJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function soldPortfolioHref(property) {
  const side = String(property.transaction?.side || '').toLowerCase();
  return side.includes('buyer') && !side.includes('seller')
    ? '/bought-with-gurmeet'
    : '/sold-by-gurmeet';
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property) return { title: "Property not found" };
  const address = [
    property.address?.street,
    property.address?.city,
    property.address?.state,
    property.address?.zip,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    title: property.title || address,
    description:
      property.description || `${address} represented by HomesByGurmeet.`,
  };
}

export default async function Detail({ params }) {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property) notFound();
  const address = [
    property.address?.street,
    property.address?.city,
    property.address?.state,
    property.address?.zip,
  ]
    .filter(Boolean)
    .join(", ");
  const photos = property.images?.length ? property.images.map(publicAssetUrl) : [PROPERTY_PLACEHOLDER_IMAGE];
  const mapQuery = encodeURIComponent(
    property.coordinates?.lat
      ? `${property.coordinates.lat},${property.coordinates.lng}`
      : address,
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title || address,
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/properties/${property.slug}`,
    description: property.description,
    datePosted: property.createdAt,
    offers: property.price
      ? {
          "@type": "Offer",
          price: property.price,
          priceCurrency: "USD",
          availability:
            property.status === "Sold"
              ? "https://schema.org/SoldOut"
              : "https://schema.org/InStock",
        }
      : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: property.address?.street,
      addressLocality: property.address?.city,
      addressRegion: property.address?.state,
      postalCode: property.address?.zip,
      addressCountry: "US",
    },
    numberOfBedrooms: property.beds,
    numberOfBathroomsTotal: property.baths,
    floorSize: property.sqft
      ? { "@type": "QuantitativeValue", value: property.sqft, unitCode: "FTK" }
      : undefined,
  };
  return (
    <>
      <Header />
      <main>
        <AnalyticsTracker type="listing_view" propertyId={property._id} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: cleanJson(jsonLd) }}
        />
        <div className="container detail-back">
          <Link
            className="muted"
            href={property.status === "Sold" ? soldPortfolioHref(property) : "/homes-for-sale"}
          >
            ← Back to listings
          </Link>
        </div>
        <section className="container section detail-layout">
          <div>
            <div className="property-gallery">
              {photos.length ? photos.map((photo, index) => (
                <PropertyImage
                  key={photo}
                  className={index === 0 ? "primary-photo" : ""}
                  src={photo}
                  alt={`${property.title || address}${index ? `, photo ${index + 1}` : ""}`}
                />
              )) : <div className="property-photo-placeholder detail-photo-placeholder"><svg aria-hidden="true" viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="40" rx="3" /><circle cx="24" cy="26" r="5" /><path d="m12 47 14-13 9 8 6-5 11 10" /></svg><strong>Photos needed</strong><span>Ask the owner for images of this property.</span></div>}
            </div>
          </div>
          <div className="property-summary">
            <span className="badge">
              {property.status === "Sold" ? "SOLD" : property.status}
            </span>
            <h1>
              {property.price
                ? `$${property.price.toLocaleString()}`
                : "Price upon request"}
            </h1>
            <p className="property-address">{address}</p>
            <p className="muted property-specs">
              {[
                property.beds && `${property.beds} Beds`,
                property.baths && `${property.baths} Baths`,
                property.sqft && `${property.sqft.toLocaleString()} Sq Ft`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="gold-line" />
            <p className="muted property-description">
              {property.description ||
                "Contact Gurmeet for complete property details and a private showing."}
            </p>
            {property.transaction?.soldDate && (
              <p className="transaction-note">
                Closed{" "}
                {new Date(property.transaction.soldDate).toLocaleDateString(
                  "en-US",
                  { month: "long", year: "numeric" },
                )}
              </p>
            )}
            <a
              className="map-link"
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
            >
              View location on Google Maps ↗
            </a>
          </div>
        </section>
        <section className="dark-section section">
          <div className="container">
            <div className="property-forms-heading">
              <div>
                <p className="eyebrow">Private consultation</p>
                <h2>Interested in this property?</h2>
              </div>
              <p>
                Request more information or select a preferred time for a
                private viewing.
              </p>
            </div>
            <div className="property-actions">
              <div className="lead-panel">
                <h3>Request information</h3>
                <LeadForm type="inquiry" property={property._id} />
              </div>
              <div className="lead-panel">
                <h3>Schedule a showing</h3>
                <LeadForm type="showing" property={property._id} />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
