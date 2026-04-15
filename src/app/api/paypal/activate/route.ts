import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPayPalSubscription } from "@/lib/paypal";

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId, planId } = (await req.json()) as {
      subscriptionId: string;
      planId: string;
    };

    if (!subscriptionId || !planId) {
      return NextResponse.json(
        { error: "subscriptionId and planId are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Verify subscription with PayPal
    const paypalSub = await getPayPalSubscription(subscriptionId);
    const status = (paypalSub.status as string) ?? "UNKNOWN";

    // Resolve Supabase plan UUID from paypal_plan_id
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id")
      .eq("paypal_plan_id", planId)
      .single();

    if (planError || !plan) {
      // Plan may not exist if user passed a raw PayPal plan ID without saving it
      // Insert subscription without plan_id linkage
      const { data: sub, error: insertError } = await supabase
        .from("subscriptions")
        .insert({
          paypal_subscription_id: subscriptionId,
          plan_id: null,
          status,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Supabase insert error: ${insertError.message}`);
      }

      return NextResponse.json({ success: true, subscription: sub });
    }

    // Insert subscription row
    const { data: sub, error: insertError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          paypal_subscription_id: subscriptionId,
          plan_id: plan.id,
          status,
        },
        { onConflict: "paypal_subscription_id" }
      )
      .select()
      .single();

    if (insertError) {
      throw new Error(`Supabase upsert error: ${insertError.message}`);
    }

    return NextResponse.json({ success: true, subscription: sub });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
