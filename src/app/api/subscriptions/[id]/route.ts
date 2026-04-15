import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cancelPayPalSubscription } from "@/lib/paypal";

/** Cancel subscription in PayPal + update Supabase status. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();

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

    await cancelPayPalSubscription(sub.paypal_subscription_id);

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ status: "CANCELLED" })
      .eq("id", params.id);

    if (updateError) {
      throw new Error(`Supabase update error: ${updateError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Delete row from Supabase only (does not touch PayPal). */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action !== "delete-row") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", params.id);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
