import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPayPalBillingPlan } from "@/lib/paypal";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, priceUsd, billingFrequencyMonths, existingProductId } =
      body as {
        name: string;
        description?: string;
        priceUsd: number;
        billingFrequencyMonths?: number;
        existingProductId?: string;
      };

    if (!name || !priceUsd) {
      return NextResponse.json(
        { error: "name and priceUsd are required" },
        { status: 400 }
      );
    }

    // Create PayPal billing plan
    const paypalPlanId = await createPayPalBillingPlan(
      name,
      description ?? "",
      Number(priceUsd),
      billingFrequencyMonths ?? 1,
      existingProductId
    );

    // Persist to Supabase
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("plans")
      .insert({
        paypal_plan_id: paypalPlanId,
        name,
        description: description ?? null,
        price_usd: Number(priceUsd),
        billing_frequency_months: billingFrequencyMonths ?? 1,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase insert error: ${error.message}`);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
