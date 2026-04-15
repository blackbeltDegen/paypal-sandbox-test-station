import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Updates the plan_id on a subscription after a revision is approved. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { newPlanId } = (await req.json()) as { newPlanId: string };

    if (!newPlanId) {
      return NextResponse.json({ error: "newPlanId is required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("subscriptions")
      .update({ plan_id: newPlanId })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
