import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deactivatePayPalBillingPlan } from "@/lib/paypal";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();

    // Look up plan
    const { data: plan, error: fetchError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Deactivate in PayPal
    await deactivatePayPalBillingPlan(plan.paypal_plan_id);

    // Update status in Supabase
    const { error: updateError } = await supabase
      .from("plans")
      .update({ status: "INACTIVE" })
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

/** Delete the row from Supabase only (does not touch PayPal). */
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
    const { error } = await supabase.from("plans").delete().eq("id", params.id);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
