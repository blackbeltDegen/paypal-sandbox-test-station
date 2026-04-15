import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revisePayPalSubscription } from "@/lib/paypal";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as {
      newPlanId: string;
      startTime?: string;
    };

    const { newPlanId, startTime } = body;

    if (!newPlanId) {
      return NextResponse.json(
        { error: "newPlanId is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Look up the subscription
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (subError || !sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Look up the new plan to get its PayPal plan ID
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", newPlanId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "New plan not found" },
        { status: 404 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (req.headers.get("origin") || "http://localhost:3000");

    const approvalUrl = await revisePayPalSubscription(
      sub.paypal_subscription_id,
      plan.paypal_plan_id,
      startTime ?? new Date(Date.now() + 60_000).toISOString(),
      `${baseUrl}/?paypal=success`,
      `${baseUrl}/?paypal=cancelled`
    );

    return NextResponse.json({ approvalUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
