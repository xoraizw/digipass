# XtraCup for coffee shops

Wallet loyalty cards for coffee shops. Each shop gets a branded QR sign-up page. Customers enter name, age and
email, and get a loyalty card in **Apple Wallet** or **Google Wallet**, or a web card as a fallback.
Shops can offer two kinds of card: a free stamp-based **loyalty card** and prepaid **coffee packs** (e.g. 10 cups
for $35). Customers can hold several. Shop owners stamp cards, sell packs, deduct cups and see analytics. As the platform admin, you see
every shop and its billing status.

**Stack:** React (Vite) + Supabase (Postgres, Auth, Storage, Edge Functions).

## How it works

| URL | Who | What |
|---|---|---|
| `/` | Shop owners | Marketing page |
| `/login` | Shop owners | Sign up / sign in |
| `/dashboard` | Owner | Onboarding wizard, then analytics |
| `/dashboard/scan` | Owner/staff | Scan a card → +1 stamp / redeem, or sell a pack / use a cup |
| `/dashboard/customers` | Owner | Every card customers hold, filters, CSV export |
| `/dashboard/cards` | Owner | Create loyalty cards and prepaid coffee packs |
| `/dashboard/guide`, `/how-it-works` | Owners / prospects | The owner's guide (also public, for sales) |
| `/dashboard/design` | Owner | Branding, sign-up page copy, current offer |
| `/dashboard/qr` | Owner | Printable QR poster + downloadable QR |
| `/admin` | You | All shops, plan status, setup fee, monthly fee, MRR |
| `/s/:slug` | Customers | Branded sign-up page (what the QR code opens) |
| `/card/:id?t=…` | Customers | Their card; auto-opens Apple/Google Wallet after sign-up |

The barcode on every pass is the customer's id. Staff scan it from the dashboard, which calls `add_stamps`, then
the `pass-updated` function refreshes the pass already sitting in the customer's wallet.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the schema: open **SQL Editor**, paste `supabase/migrations/20261006000000_init.sql`, and run it.
   (Or use the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.)
3. **Authentication → URL Configuration**: set the Site URL to your app URL (e.g. `http://localhost:5173` for dev).
4. Copy `.env.example` to `.env` and fill in the project URL and anon key (Settings → API).

```bash
npm install
npm run dev
```

5. Sign up in the app, then make yourself platform admin (SQL Editor):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'you@example.com';
```

At this point everything works with **web cards**: sign-up, card page with QR, stamping, analytics, admin.

## 2. Deploy the wallet functions

```bash
npx supabase functions deploy apple-wallet --no-verify-jwt
npx supabase functions deploy google-wallet --no-verify-jwt
npx supabase functions deploy pass-updated --no-verify-jwt
npx supabase secrets set PUBLIC_APP_URL=https://your-app-domain.com
```

The wallet buttons only show up once the matching secrets below are set.

### Apple Wallet (needs an Apple Developer account, $99/yr)

1. developer.apple.com → Identifiers → **Pass Type IDs** → create e.g. `pass.com.yourcompany.xtracup`.
2. Create a certificate for it (upload a CSR), download the `.cer`, open it in Keychain, export as `.p12`.
3. Convert to PEM:
   ```bash
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out pass-cert.pem -legacy
   openssl pkcs12 -in pass.p12 -nocerts -out pass-key.pem -legacy   # sets a passphrase
   ```
4. Download the **Apple WWDR G4** intermediate certificate and convert it:
   `openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem`
5. Set the secrets (base64 avoids newline problems):
   ```bash
   npx supabase secrets set \
     APPLE_PASS_TYPE_ID=pass.com.yourcompany.xtracup \
     APPLE_TEAM_ID=ABCDE12345 \
     APPLE_PASS_CERT="$(base64 -w0 pass-cert.pem)" \
     APPLE_PASS_KEY="$(base64 -w0 pass-key.pem)" \
     APPLE_PASS_KEY_PASSPHRASE=your-passphrase \
     APPLE_WWDR_CERT="$(base64 -w0 wwdr.pem)"
   ```

Pass updates use Apple's PassKit web service, which is built into the `apple-wallet` function. Whenever a stamp
is added, the function sends an APNs push and the phone fetches the new pass.

### Google Wallet

1. [pay.google.com/business/console](https://pay.google.com/business/console): create an issuer account and note the **Issuer ID**.
2. In Google Cloud, enable the **Google Wallet API**, create a **service account**, and download its JSON key.
3. In the Wallet console → Users, invite the service account's email as a **Developer**.
4. Set the secrets:
   ```bash
   npx supabase secrets set GOOGLE_ISSUER_ID=3388000000012345678 \
     GOOGLE_SERVICE_ACCOUNT_JSON="$(base64 -w0 service-account.json)"
   ```

New issuer accounts are in demo mode, where only test users you add can save passes. To go public, request
publishing access in the console. Google needs to reach your logo over the internet, so set `PUBLIC_APP_URL`
to a public domain, not localhost.

## 3. Deploy the frontend

Any static host works (Vercel, Netlify, Cloudflare Pages). Build with `npm run build` and serve `dist/`.
Add an SPA fallback so every route serves `index.html`. Set the two `VITE_` env vars on the host.

## Data model

- `shops`: one per owner account. Branding, sign-up page copy, current offer, and billing fields
  (`plan_status`, `setup_fee_paid`, `monthly_fee`; a trigger stops owners editing billing).
- `programs`: the card types a shop offers. `kind = 'loyalty'` (stamps → reward) or
  `kind = 'subscription'` (prepaid pack: `cups_included` for `pack_price`, optional `valid_days`).
  Hide a card with `is_active = false`; deleting is blocked once customers hold it.
- `customers`: **one row per card a person holds** (unique per program + email). Loyalty cards use
  `stamps`; packs use `credits` / `credits_total` / `pack_expires_at`. A person = same email within a shop.
  `pass_token` is the secret used in the card URL and for Apple's auth.
- `events`: signup / stamp / redeem / purchase (with `value` in $) / cup / wallet_added. Feeds analytics.
- `apple_registrations`: devices that added a pass, for push updates.

Customers only go through `get_public_shop`, `join_shop` (one or more programs) and `get_card` (returns the
person's other cards too). Owner-only RPCs: `add_stamps`, `redeem_reward`, `sell_pack` (call after taking
payment at the till; unused, unexpired cups carry over), `use_cup`, `shop_analytics`.

Wallet: one Google Wallet class per program; Apple and Google both add all of a person's cards in one tap
(`.pkpasses` bundle / multi-object save link).

## Known limits / next steps

- Signing up again with the same email returns the existing card, which is useful when someone gets a new phone.
  It also means anyone who knows a customer's email can open that card. To lock this down, add email
  verification (e.g. a magic link) before re-issuing.
- Coffee packs are paid at the shop's till; staff then tap **Sell pack**. Stripe Checkout could let customers buy packs online.
- Billing is tracked manually in `/admin`. Add Stripe subscriptions to charge the setup fee and retainer automatically.
- One shop per owner account. Multi-location chains would need a `locations` table.
- Staff use the owner's login. Add a `staff` role if shops want separate logins.
