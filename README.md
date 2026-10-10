# HomesByGurmeet

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then run `npm.cmd install` and `npm.cmd run dev`. For Docker, run `docker compose up --build`.

The API is at `http://localhost:4000`; the web app is at `http://localhost:3000`. Add the bootstrap admin values before signing in.

## API documentation

The backend OpenAPI 3.0 document is at `apps/api/openapi.yaml`. Import it into [Swagger Editor](https://editor.swagger.io/) or your preferred API client to browse and test the API. For authenticated endpoints, sign in through `POST /api/auth/login` first so the client retains the `hbg_session` cookie.

## Authorized Decodo scraping

`POST /api/admin/scrape` uses Decodo Scraper API only for HTTPS hosts explicitly listed in the backend `AUTHORIZED_SCRAPE_HOSTS` environment variable. Set `DECODO_SCRAPER_BASIC_TOKEN` to the rotated Basic-auth token value supplied by Decodo, without the `Basic ` prefix. The raw provider response is never stored in MongoDB; the endpoint returns a bounded preview for an administrator to inspect.

## Workbook import

The Docker MongoDB service runs as a one-node replica set (`rs0`) so paired workbook imports are transactional. Set `MONGODB_URI=mongodb://mongo:27017/homesbygurmeet?replicaSet=rs0` in the API environment before starting the stack.

To import the supplied Redfin and Zillow workbooks from the command line, run `docker compose run --rm api npm run import:workbook -- /app/data/Gurmeet_Singh_Full_Property_Data_For_Website.xlsx /app/data/Gurmeet_Singh_All_Zillow_Properties.xlsx`.

Administrators can import Redfin and Zillow `.xlsx` workbooks together from the Admin dashboard under **Sync**. Both workbooks are validated first, then their snapshots and the public listing dataset are rebuilt in one transaction. Every valid source row is retained, including duplicate addresses. Listings absent from the paired source data are removed, and workbook data resets manual listing fields such as images and featured status.

The Sync tab also accepts `Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx` as a supplemental photo manifest. It matches existing listings by their source-specific property slug or normalized address, applies the verified Google Drive image and photo metadata, and reports unmatched rows. It does not create or delete listings and does not replace listing prices, statuses, or transaction dates.

The Admin dashboard **Analytics** tab reports current inventory, pricing, lead activity, workbook freshness, and first-party page/listing views. Traffic events are anonymous, contain no query strings or personal data, and are retained for 24 months.
