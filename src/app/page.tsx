import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Plan, Subscription } from "@/types";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { paypal?: string };
}) {
  const supabase = createSupabaseServerClient();

  const [{ data: plans }, { data: subscriptions }] = await Promise.all([
    supabase
      .from("plans")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("*, plans(name, price_usd, billing_frequency_months)")
      .order("created_at", { ascending: false }),
  ]);

  const paypalStatus = searchParams?.paypal ?? null;

  return (
    <Dashboard
      initialPlans={(plans as Plan[]) ?? []}
      initialSubscriptions={(subscriptions as Subscription[]) ?? []}
      paypalStatus={paypalStatus}
    />
  );
}
