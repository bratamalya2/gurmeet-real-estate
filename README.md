# HomesByGurmeet

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then run `npm.cmd install` and `npm.cmd run dev`. For Docker, run `docker compose up --build`.

The API is at `http://localhost:4000`; the web app is at `http://localhost:3000`. Add the bootstrap admin values before signing in.

## API documentation

The backend OpenAPI 3.0 document is at `apps/api/openapi.yaml`. Import it into [Swagger Editor](https://editor.swagger.io/) or your preferred API client to browse and test the API. For authenticated endpoints, sign in through `POST /api/auth/login` first so the client retains the `hbg_session` cookie.

## Authorized Decodo scraping

`POST /api/admin/scrape` uses Decodo Scraper API only for HTTPS hosts explicitly listed in the backend `AUTHORIZED_SCRAPE_HOSTS` environment variable. Set `DECODO_SCRAPER_BASIC_TOKEN` to the rotated Basic-auth token value supplied by Decodo, without the `Basic ` prefix. The raw provider response is never stored in MongoDB; the endpoint returns a bounded preview for an administrator to inspect.

## Workbook import

The Docker MongoDB service runs as a one-node replica set (`rs0`) so the complete listing replacement is transactional. Set `MONGODB_URI=mongodb://mongo:27017/homesbygurmeet?replicaSet=rs0` in the API environment before starting the stack.

The command-line importer uses the same parser and replacement logic: `docker compose run --rm api npm run import:workbook -- "/app/data/Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx"`.

The Admin dashboard **Sync** tab accepts `Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx`. The workbook is validated completely before one transaction stores its snapshot and replaces the public `Property` collection. Every valid portfolio row is retained, including distinct rows with the same address. Properties absent from the workbook are removed.

For matching properties, the import preserves listing fields that are not present in the workbook, such as price, dimensions, coordinates, descriptions, and transaction dates. Unmatched rows are created as sold properties with empty unavailable fields. The workbook supplies the title, address, image, buyer/seller classification, verification metadata, and portfolio source information.

The Admin dashboard **Sync** tab also accepts `real_estate_transactions_data.xlsx` through **Add sold portfolio data**. This is an additive, administrator-only import: it enriches matching sold properties by normalized address, creates new sold records for new addresses, and never removes existing listings. It parses the `Sales Transactions` sheet, including Buyer, Seller, and Both rows; imports recorded sale dates exactly; and reports skipped summary or incomplete rows. Legacy `Sold Properties` workbooks with relative timelines remain supported. New records receive the standard property placeholder until images are connected.

The Admin dashboard **Analytics** tab reports current inventory, pricing, lead activity, workbook freshness, and first-party page/listing views. Traffic events are anonymous, contain no query strings or personal data, and are retained for 24 months.

## AI property assistant

The public site includes a full-page Gurmeet AI Mode assistant at `/ai-search`. The full-page experience has two modes: **Website Search** searches the public site content as well as the live portfolio, while **Gurmeet AI Mode** provides conversational buying, selling, and valuation guidance. Both modes use the live portfolio when a property search is requested, return public property cards, and direct visitors to the existing Contact and Home Valuation forms. Chats stay in the visitor's browser; no transcript is stored in MongoDB. Previous messages remain visible locally for reference, but each new request is evaluated from the latest prompt only.

The public endpoints are `POST /api/chat` for the floating widget and `POST /api/ai-search` for the full-page client. Both validate a maximum 1,200-character message, six history turns, bounded city/bedroom/price filters, and share a public rate limit of 24 requests per IP per 15 minutes. Website Search can also return matching public-page links and live Market Insights data. The floating widget shows up to four matches; the full-page assistant returns the complete matching public portfolio and links to `/property-catalogue`, where visitors can browse and filter the catalogue. Set `OPENAI_API_KEY` only in `apps/api/.env`; never expose it in the web environment. `OPENAI_CHAT_MODEL` defaults to `gpt-5-mini` and can be overridden for the API container. The API sends grounded messages to OpenAI Chat Completions with `store: false`; `Gurmeet AI Mode · OpenAI` indicates a successful model response, while `Gurmeet AI Mode · Local fallback` indicates that the configured key is missing or the upstream request failed. In assistant mode, buying, selling, valuation, and financing questions receive structured multi-step guidance; explicit property searches still return live property cards, while conversational financing questions do not. If the key is missing or OpenAI is unavailable, the local fallback returns the same detailed guidance without writing transcripts to MongoDB.

On EC2, add the server-only key to `apps/api/.env` and restart only the API after changing it:

```bash
cd ~/gurmeet-real-estate
docker compose up -d --force-recreate --no-deps api
```

Never put `OPENAI_API_KEY` in the web app environment or a `NEXT_PUBLIC_*` variable. You can verify the provider without exposing secrets by posting to `/api/ai-search` and inspecting the response's `provider` field.

## Updating property images from Google Drive

The Admin dashboard **Sync** tab includes **Download folder images**. The folder must be publicly accessible, and image filenames should contain the matching property slug or normalized address. Supported formats are JPEG, PNG, WebP, and GIF; subfolders are scanned recursively. Workbook-stored Google Drive file IDs are matched first, so one shared Drive file can be attached to every property that explicitly references it. Only matched properties are updated, and manually uploaded images are preserved.

Configure the Google Drive API key only in the backend environment as `GOOGLE_DRIVE_API_KEY` (for Docker, `apps/api/.env`). Do not add it to the web environment or commit it to Git. After changing the backend environment, recreate only the API service:

```bash
cd ~/gurmeet-real-estate
docker compose up -d --force-recreate api
```

Downloaded images are persisted in `apps/api/uploads`, which is mounted into the API container at `/app/uploads`. A normal image refresh does not require rebuilding the API or web images. Verify downloaded files with:

```bash
find apps/api/uploads -maxdepth 1 -type f -name 'drive-*' | wc -l
docker compose exec api sh -lc "find /app/uploads -maxdepth 1 -type f -name 'drive-*' | wc -l"
```

The Sync tab also includes **Connect uploaded images**. This scans existing supported images in `apps/api/uploads` and attaches them to properties whose filenames match an exact property slug or normalized address. Existing images are preserved; unmatched and ambiguous filenames are reported without being assigned.

Administrators can also use **Remove all duplicate properties** in the Sync tab. It groups records by normalized address, keeps the most complete record, merges available images and metadata, reassigns linked leads to the retained property, and removes the duplicates. Records without a normalized address are skipped. The cleanup is transactional and is recorded in the system activity history.
