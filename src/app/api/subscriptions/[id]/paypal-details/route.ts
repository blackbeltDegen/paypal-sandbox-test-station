import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPayPalSubscription } from "@/lib/paypal";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("paypal_subscription_id")
      .eq("id", params.id)
      .single();

    if (error || !sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const paypalData = await getPayPalSubscription(sub.paypal_subscription_id);
    return NextResponse.json(paypalData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
