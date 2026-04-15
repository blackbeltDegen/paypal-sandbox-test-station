import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const { planId } = (await req.json()) as { planId: string };

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    // If it looks like a UUID, resolve it to a PayPal plan ID
    if (UUID_REGEX.test(planId)) {
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase
        .from("plans")
        .select("paypal_plan_id")
        .eq("id", planId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      return NextResponse.json({ planId: data.paypal_plan_id });
    }

    // Otherwise, assume it's already a raw PayPal plan ID
    return NextResponse.json({ planId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
