import Link from "next/link";
import { publicAssetUrl } from "../lib/api";
import { relativeTransactionLabel } from "../lib/transaction.mjs";
import { propertyStatusLabel } from "../lib/property-labels.mjs";

export default function PropertyCard({ p, portfolioSide }) {
  const photo = p.images?.[0];
  const propertyName = p.title || p.address?.street || "this property";
  const transactionLabel = p.status === "Sold" ? relativeTransactionLabel(p.transaction) : "";
  return (
    <article className="card property-card">
      <Link
        href={`/properties/${p.slug}`}
        aria-label={`View ${propertyName}`}
      >
        <div className="imagewrap">
          {photo ? <img src={publicAssetUrl(photo)} alt={propertyName} /> : <div className="property-photo-placeholder"><svg aria-hidden="true" viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="40" rx="3" /><circle cx="24" cy="26" r="5" /><path d="m12 47 14-13 9 8 6-5 11 10" /></svg><strong>Photos needed</strong><span>Ask the owner for images of this property.</span></div>}
          <span className="badge">
            {propertyStatusLabel({ status: p.status, portfolioSide })}
          </span>
        </div>
        <div className="card-body">
          <h3>
            {p.price ? `$${p.price.toLocaleString()}` : "Price upon request"}
          </h3>
          <p>{p.address?.street || p.title}</p>
          <small className="muted">
            {[
              p.beds && `${p.beds} Beds`,
              p.baths && `${p.baths} Baths`,
              p.sqft && `${p.sqft.toLocaleString()} Sq Ft`,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </small>
          {transactionLabel && <small className="transaction-age">{transactionLabel}</small>}
        </div>
      </Link>
    </article>
  );
}
