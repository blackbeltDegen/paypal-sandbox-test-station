"use client";

import { useState } from "react";
import type { Plan, Subscription } from "@/types";

interface Props {
  initialSubscriptions: Subscription[];
  plans: Plan[];
  onLog: (msg: string) => void;
}

export default function SubscriptionsPanel({
  initialSubscriptions,
  plans,
  onLog,
}: Props) {
  const [subs, setSubs] = useState<Subscription[]>(initialSubscriptions);
  const [loading, setLoading] = useState<string | null>(null);
  const [reviseSubId, setReviseSubId] = useState<string | null>(null);
  const [selectedNewPlan, setSelectedNewPlan] = useState("");
  const [reviseError, setReviseError] = useState<string | null>(null);
  const [reviseLoading, setReviseLoading] = useState(false);

  const activePlans = plans.filter((p) => p.status === "ACTIVE");

  async function handleRefreshStatus(sub: Subscription) {
    setLoading(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/status`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed");
      setSubs((prev) => prev.map((s) => (s.id === sub.id ? data : s)));
      onLog(`Status refreshed for ${sub.paypal_subscription_id}: ${data.status}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error refreshing status");
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel(sub: Subscription) {
    if (
      !confirm(
        `Cancel subscription ${sub.paypal_subscription_id}? This will cancel it in PayPal.`
      )
    )
      return;
    setLoading(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cancel failed");
      setSubs((prev) =>
        prev.map((s) =>
          s.id === sub.id ? { ...s, status: "CANCELLED" } : s
        )
      );
      onLog(`Subscription cancelled: ${sub.paypal_subscription_id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error cancelling");
    } finally {
      setLoading(null);
    }
  }

  async function handleDeleteRow(sub: Subscription) {
    if (
      !confirm(
        `Remove ${sub.paypal_subscription_id} from Supabase? (PayPal subscription untouched)`
      )
    )
      return;
    setLoading(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-row" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setSubs((prev) => prev.filter((s) => s.id !== sub.id));
      onLog(`Subscription row deleted: ${sub.paypal_subscription_id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting row");
    } finally {
      setLoading(null);
    }
  }

  async function handleRevise(subId: string) {
    setReviseError(null);
    if (!selectedNewPlan) {
      setReviseError("Please select a plan.");
      return;
    }
    setReviseLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPlanId: selectedNewPlan,
          startTime: new Date(Date.now() + 60_000).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revise failed");
      const sub = subs.find((s) => s.id === subId);
      onLog(`Revision started for: ${sub?.paypal_subscription_id ?? subId}`);
      window.location.href = data.approvalUrl;
    } catch (err) {
      setReviseError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setReviseLoading(false);
    }
  }

  function statusColor(status: string | null) {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/10 text-green-400";
      case "CANCELLED":
        return "bg-red-500/10 text-red-400";
      case "SUSPENDED":
        return "bg-yellow-500/10 text-yellow-400";
      default:
        return "bg-white/5 text-white/40";
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-dark-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Active Subscriptions</h2>
        <span className="text-xs text-white/30">{subs.length} record(s)</span>
      </div>

      {subs.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/30">
          No subscriptions yet. Test a checkout to create one.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/40">
                <th className="pb-3 pr-4 font-medium">Label</th>
                <th className="pb-3 pr-4 font-medium">Subscription ID</th>
                <th className="pb-3 pr-4 font-medium">Plan</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Next Billing</th>
                <th className="pb-3 pr-4 font-medium">Created</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => {
                const plan = plans.find((p) => p.id === sub.plan_id);
                return (
                  <tr
                    key={sub.id}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="py-3 pr-4 text-white/70">
                      {sub.user_label ?? (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-gold-400">
                        {sub.paypal_subscription_id}
                      </code>
                    </td>
                    <td className="py-3 pr-4 text-white/70">
                      {plan ? (
                        <span>
                          {plan.name}{" "}
                          <span className="text-white/40">
                            (${Number(plan.price_usd).toFixed(2)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-white/30">Unknown</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(sub.status)}`}
                      >
                        {sub.status ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-white/70">
                      {sub.next_billing_time ? (
                        <span className="text-gold-400">
                          {new Date(sub.next_billing_time).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </span>
                      ) : (
                        <span className="text-white/30">— click Refresh</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-white/40">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRefreshStatus(sub)}
                          disabled={loading === sub.id}
                          className="rounded bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          {loading === sub.id ? "…" : "Refresh"}
                        </button>
                        {sub.status === "ACTIVE" && (
                          <button
                            onClick={() => {
                              setReviseSubId(sub.id);
                              setSelectedNewPlan("");
                              setReviseError(null);
                            }}
                            disabled={loading === sub.id}
                            className="rounded bg-purple-500/10 px-2.5 py-1 text-xs text-purple-400 transition hover:bg-purple-500/20 disabled:opacity-50"
                          >
                            Upgrade / Downgrade
                          </button>
                        )}
                        {sub.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancel(sub)}
                            disabled={loading === sub.id}
                            className="rounded bg-orange-500/10 px-2.5 py-1 text-xs text-orange-400 transition hover:bg-orange-500/20 disabled:opacity-50"
                          >
                            {loading === sub.id ? "…" : "Cancel"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRow(sub)}
                          disabled={loading === sub.id}
                          className="rounded bg-red-500/10 px-2.5 py-1 text-xs text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {loading === sub.id ? "…" : "Delete Row"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Revise Modal */}
      {reviseSubId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReviseSubId(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-dark-800 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Upgrade / Downgrade
              </h3>
              <button
                onClick={() => setReviseSubId(null)}
                className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {reviseError && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {reviseError}
              </div>
            )}

            <p className="mb-4 text-sm text-white/60">
              Select the new plan to revise to. The user will be redirected to
              PayPal to approve the change.
            </p>

            <select
              value={selectedNewPlan}
              onChange={(e) => setSelectedNewPlan(e.target.value)}
              className="mb-4 w-full rounded-lg border border-white/10 bg-dark-700 px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
            >
              <option value="">Select a plan…</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${Number(p.price_usd).toFixed(2)}/
                  {p.billing_frequency_months === 1
                    ? "mo"
                    : `${p.billing_frequency_months}mo`}
                </option>
              ))}
            </select>

            <button
              onClick={() => handleRevise(reviseSubId)}
              disabled={reviseLoading || !selectedNewPlan}
              className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-semibold text-dark-950 transition hover:bg-gold-400 disabled:opacity-60"
            >
              {reviseLoading ? "Redirecting to PayPal…" : "Revise Subscription"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
