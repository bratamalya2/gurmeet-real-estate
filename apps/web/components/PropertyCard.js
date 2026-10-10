import Link from "next/link";
import { publicAssetUrl } from "../lib/api";
import { PROPERTY_PLACEHOLDER_IMAGE } from "../lib/property-assets";
import { relativeTransactionLabel } from "../lib/transaction.mjs";
import { propertyStatusLabel } from "../lib/property-labels.mjs";
import PropertyImage from "./PropertyImage";

export default function PropertyCard({ p, portfolioSide }) {
  const photo = p.images?.[0] || PROPERTY_PLACEHOLDER_IMAGE;
  const propertyName = p.title || p.address?.street || "this property";
  const transactionLabel = p.status === "Sold" ? relativeTransactionLabel(p.transaction) : "";
  return (
    <article className="card property-card">
      <Link
        href={`/properties/${p.slug}`}
        aria-label={`View ${propertyName}`}
      >
        <div className="imagewrap">
          <PropertyImage src={publicAssetUrl(photo)} alt={propertyName} />
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
