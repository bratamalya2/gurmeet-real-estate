# HomesByGurmeet

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then run `npm.cmd install` and `npm.cmd run dev`. For Docker, run `docker compose up --build`.

The API is at `http://localhost:4000`; the web app is at `http://localhost:3000`. Add the bootstrap admin values before signing in.

## API documentation

The backend OpenAPI 3.0 document is at `apps/api/openapi.yaml`. Import it into [Swagger Editor](https://editor.swagger.io/) or your preferred API client to browse and test the API. For authenticated endpoints, sign in through `POST /api/auth/login` first so the client retains the `hbg_session` cookie.

## Authorized Decodo scraping

`POST /api/admin/scrape` uses Decodo Scraper API only for HTTPS hosts explicitly listed in the backend `AUTHORIZED_SCRAPE_HOSTS` environment variable. Set `DECODO_SCRAPER_BASIC_TOKEN` to the rotated Basic-auth token value supplied by Decodo, without the `Basic ` prefix. The raw provider response is never stored in MongoDB; the endpoint returns a bounded preview for an administrator to inspect.

## Workbook import

To import the supplied `data/Redfin.xlsx` transactions workbook into MongoDB, run `docker compose run --rm api npm run import:workbook -- /app/data/Redfin.xlsx`. The importer upserts by workbook ID or normalized address, maps active/sold statuses, and stores confidence, verification, transaction-side, notes, original source URL, and image-search references as metadata.
