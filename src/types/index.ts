export interface Plan {
  id: string;
  paypal_plan_id: string;
  name: string;
  description: string | null;
  price_usd: number;
  billing_frequency_months: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
}

export interface Subscription {
  id: string;
  paypal_subscription_id: string;
  plan_id: string | null;
  user_label: string | null;
  status: string | null;
  next_billing_time: string | null;
  created_at: string;
  updated_at: string;
  plans?: Pick<Plan, "name" | "price_usd"> | null;
}
