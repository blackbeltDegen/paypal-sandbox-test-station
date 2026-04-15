import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPayPalBillingPlan, getPayPalBillingPlan, revisePayPalSubscription } from "@/lib/paypal";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as {
      planName?: string;
      priceUsd: number;
      billingFrequencyMonths: number;
      startTime?: string;
    };

    const { planName, priceUsd, billingFrequencyMonths, startTime } = body;

    if (!priceUsd || !billingFrequencyMonths) {
      return NextResponse.json(
        { error: "priceUsd and billingFrequencyMonths are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Look up the subscription + its current plan
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("*, plans(name, description)")
      .eq("id", params.id)
      .single();

    if (subError || !sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    const baseName = planName?.trim() || sub.plans?.name || "Updated Plan";
    const freqLabel =
      billingFrequencyMonths === 1
        ? "Monthly"
        : `Every ${billingFrequencyMonths} Months`;
    const newPlanName = `${baseName} — $${Number(priceUsd).toFixed(2)} ${freqLabel}`;

    // Fetch the current plan's product_id from PayPal so the new plan
    // belongs to the same product (required by PayPal for subscription revision)
    const { data: currentPlan } = await supabase
      .from("plans")
      .select("paypal_plan_id")
      .eq("id", sub.plan_id)
      .single();

    let existingProductId: string | undefined;
    if (currentPlan?.paypal_plan_id) {
      const paypalPlan = await getPayPalBillingPlan(currentPlan.paypal_plan_id);
      existingProductId = paypalPlan.product_id as string | undefined;
    }

    // Create a new PayPal billing plan under the same product
    const newPaypalPlanId = await createPayPalBillingPlan(
      newPlanName,
      sub.plans?.description ?? newPlanName,
      Number(priceUsd),
      billingFrequencyMonths,
      existingProductId
    );

    // Save the new plan to Supabase
    const { data: newPlan, error: planInsertError } = await supabase
      .from("plans")
      .insert({
        paypal_plan_id: newPaypalPlanId,
        name: newPlanName,
        description: sub.plans?.description ?? null,
        price_usd: Number(priceUsd),
        billing_frequency_months: billingFrequencyMonths,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (planInsertError || !newPlan) {
      throw new Error(`Failed to save new plan: ${planInsertError?.message}`);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (req.headers.get("origin") || "http://localhost:3000");

    // Revise the subscription to the new plan
    // Encode subId + newPlanId in the return URL so we can update Supabase after approval
    const returnUrl = `${baseUrl}/?paypal=revised&subId=${params.id}&planId=${newPlan.id}`;
    const effectiveTime = startTime ?? new Date(Date.now() + 60_000).toISOString();
    const approvalUrl = await revisePayPalSubscription(
      sub.paypal_subscription_id,
      newPaypalPlanId,
      effectiveTime,
      returnUrl,
      `${baseUrl}/?paypal=cancelled`
    );

    return NextResponse.json({ approvalUrl, newPlan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
