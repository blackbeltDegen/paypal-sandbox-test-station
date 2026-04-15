# PayPal Sandbox Test Station

A standalone Next.js app for testing PayPal subscription flows end-to-end using the PayPal sandbox environment, backed by Supabase.

---

## What it does

- **Plans Manager** — create PayPal billing plans (products + plans via the REST API), deactivate them, or clean up test data
- **Subscriptions** — trigger test checkouts, view subscription status, upgrade/downgrade between plans, cancel, or delete rows
- **Scenario Log** — in-session event log so you can trace what happened during a test run

---

## Setup

### 1. Clone & install

```bash
git clone <your-repo>
cd paypal-sandbox-test-station
npm install
```

### 2. Create PayPal sandbox credentials

1. Go to [developer.paypal.com](https://developer.paypal.com)
2. Log in with your PayPal account
3. Navigate to **My Apps & Credentials** → **Sandbox** tab
4. Click **Create App** — give it a name (e.g. "Sandbox Test Station")
5. Copy the **Client ID** and **Secret**

### 3. Create Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project
2. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Run the migration in **SQL Editor**:
   ```sql
   -- Paste contents of supabase/migrations/001_init.sql
   ```

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in all values in `.env.local`:

```env
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<your sandbox client ID>
PAYPAL_CLIENT_SECRET=<your sandbox secret>
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Testing a subscription flow

1. **Create a Plan** — click "Create Plan", fill in name, price, and billing frequency. This calls the PayPal API to create a product + billing plan and stores the plan ID in Supabase.

2. **Test Checkout** — click "Test Checkout" on any active plan. A modal opens with the real PayPal Buttons SDK. Use a [PayPal sandbox buyer account](https://developer.paypal.com/dashboard/accounts) to complete the checkout.

3. **Verify** — after approval, the subscription appears in the Subscriptions panel. Click "Refresh Status" to sync the latest status from PayPal.

4. **Upgrade / Downgrade** — click "Upgrade / Downgrade" on an active subscription to test plan revision. You'll be redirected to PayPal to approve the change.

5. **Cancel** — click "Cancel" to cancel the subscription in PayPal and update the status in Supabase.

---

## Sandbox buyer accounts

PayPal requires you to log in with a **sandbox buyer account** (not your real PayPal account) when testing checkouts.

To create sandbox accounts:
1. Go to [developer.paypal.com/dashboard/accounts](https://developer.paypal.com/dashboard/accounts)
2. Click **Create account** → Personal (buyer)
3. Use those credentials when the PayPal login dialog appears during checkout

---

## Deploy to Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod
```

Or connect the repo to Netlify via the dashboard. The `netlify.toml` is already configured.

Make sure to set all environment variables in **Netlify → Site Settings → Environment Variables**.

---

## Project structure

```
src/
  app/
    api/
      plans/             POST (create), DELETE /:id (deactivate), POST /:id (delete-row)
      paypal/
        get-plan-id/     POST — resolve Supabase UUID → PayPal plan ID
        activate/        POST — save activated subscription to Supabase
      subscriptions/
        list/            GET  — list all subscriptions
        [id]/
          status/        GET  — refresh status from PayPal
          revise/        POST — revise to new plan
          route.ts       DELETE (cancel), POST (delete-row)
    page.tsx             Server component — fetches data, renders Dashboard
    Dashboard.tsx        Client component — handles banners, logging, refresh
  components/
    PayPalCheckoutModal.tsx   PayPal Buttons SDK integration
    PlansPanel.tsx            Plans table + create modal
    SubscriptionsPanel.tsx    Subscriptions table + revise modal
    ScenarioLog.tsx           Event log panel
  lib/
    paypal.ts            All PayPal REST API helpers
    supabase/
      server.ts          Supabase server client (service role)
      client.ts          Supabase browser client (anon)
  types/
    index.ts             Shared TypeScript types
supabase/
  migrations/
    001_init.sql         plans + subscriptions schema
```
