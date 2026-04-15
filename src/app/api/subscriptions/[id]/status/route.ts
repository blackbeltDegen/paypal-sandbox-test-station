import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPayPalSubscription } from "@/lib/paypal";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();

    // Fetch subscription row from Supabase
    const { data: sub, error: fetchError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Fetch live status from PayPal
    const paypalSub = await getPayPalSubscription(sub.paypal_subscription_id);
    const newStatus = (paypalSub.status as string) ?? sub.status;

    // Update Supabase
    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update({ status: newStatus })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Supabase update error: ${updateError.message}`);
    }

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
