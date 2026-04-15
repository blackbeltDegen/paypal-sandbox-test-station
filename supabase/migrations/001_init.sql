-- PayPal Sandbox Test Station — Initial Schema

-- Plans table: mirrors PayPal billing plans
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_plan_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_usd NUMERIC(10, 2) NOT NULL,
  billing_frequency_months INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'INACTIVE'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions table: tracks test subscription instances
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_subscription_id TEXT UNIQUE NOT NULL,
  plan_id UUID REFERENCES plans(id),
  user_label TEXT, -- free text label for test scenario (e.g. "Alice - upgrade test")
  status TEXT,     -- ACTIVE, CANCELLED, SUSPENDED, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at on subscriptions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
