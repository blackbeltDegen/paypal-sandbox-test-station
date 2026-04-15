"use client";

import { useState } from "react";
import type { Plan } from "@/types";
import PayPalCheckoutModal from "./PayPalCheckoutModal";

interface Props {
  initialPlans: Plan[];
  onLog: (msg: string) => void;
  onRefresh: () => void;
}

export default function PlansPanel({ initialPlans, onLog, onRefresh }: Props) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    priceUsd: "",
    billingFrequencyMonths: "1",
    existingProductId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          priceUsd: parseFloat(form.priceUsd),
          billingFrequencyMonths: parseInt(form.billingFrequencyMonths),
          existingProductId: form.existingProductId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create plan");
      setPlans((prev) => [data, ...prev]);
      onLog(`Plan created: ${data.name} (${data.paypal_plan_id})`);
      setShowCreateModal(false);
      setForm({
        name: "",
        description: "",
        priceUsd: "",
        billingFrequencyMonths: "1",
        existingProductId: "",
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeactivate(plan: Plan) {
    if (!confirm(`Deactivate plan "${plan.name}" in PayPal?`)) return;
    setLoading(plan.id);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to deactivate");
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, status: "INACTIVE" } : p))
      );
      onLog(`Plan deactivated: ${plan.name}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deactivating plan");
    } finally {
      setLoading(null);
    }
  }

  async function handleDeleteRow(plan: Plan) {
    if (!confirm(`Remove "${plan.name}" from Supabase? (PayPal plan untouched)`)) return;
    setLoading(plan.id);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-row" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete row");
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      onLog(`Plan row deleted: ${plan.name}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting row");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-dark-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Plans Manager</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-dark-950 transition hover:bg-gold-400"
        >
          + Create Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/30">
          No plans yet. Create one to get started.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/40">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Price</th>
                <th className="pb-3 pr-4 font-medium">Freq.</th>
                <th className="pb-3 pr-4 font-medium">PayPal Plan ID</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b border-white/5 transition hover:bg-white/5"
                >
                  <td className="py-3 pr-4 font-medium text-white">
                    {plan.name}
                  </td>
                  <td className="py-3 pr-4 text-white/70">
                    ${Number(plan.price_usd).toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-white/70">
                    {plan.billing_frequency_months === 1
                      ? "Monthly"
                      : `${plan.billing_frequency_months}mo`}
                  </td>
                  <td className="py-3 pr-4">
                    <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-gold-400">
                      {plan.paypal_plan_id}
                    </code>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.status === "ACTIVE"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-white/5 text-white/40"
                      }`}
                    >
                      {plan.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {plan.status === "ACTIVE" && (
                        <button
                          onClick={() => {
                            setCheckoutPlan(plan);
                            onLog(`Checkout opened for plan: ${plan.name}`);
                          }}
                          className="rounded bg-gold-500/10 px-2.5 py-1 text-xs text-gold-400 transition hover:bg-gold-500/20"
                        >
                          Test Checkout
                        </button>
                      )}
                      {plan.status === "ACTIVE" && (
                        <button
                          onClick={() => handleDeactivate(plan)}
                          disabled={loading === plan.id}
                          className="rounded bg-orange-500/10 px-2.5 py-1 text-xs text-orange-400 transition hover:bg-orange-500/20 disabled:opacity-50"
                        >
                          {loading === plan.id ? "…" : "Deactivate"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteRow(plan)}
                        disabled={loading === plan.id}
                        className="rounded bg-red-500/10 px-2.5 py-1 text-xs text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {loading === plan.id ? "…" : "Delete Row"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-dark-800 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Create Plan</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-dark-700 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-gold-500 focus:outline-none"
                  placeholder="Pro Plan"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Description
                </label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-dark-700 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-gold-500 focus:outline-none"
                  placeholder="Full access to all features"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">
                    Price (USD) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.priceUsd}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priceUsd: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-dark-700 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-gold-500 focus:outline-none"
                    placeholder="9.99"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">
                    Billing (months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={form.billingFrequencyMonths}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        billingFrequencyMonths: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-dark-700 px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Existing Product ID{" "}
                  <span className="text-white/30">(optional)</span>
                </label>
                <input
                  value={form.existingProductId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      existingProductId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-dark-700 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-gold-500 focus:outline-none"
                  placeholder="PROD-XXXX"
                />
              </div>
              <button
                type="submit"
                disabled={formLoading}
                className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-semibold text-dark-950 transition hover:bg-gold-400 disabled:opacity-60"
              >
                {formLoading ? "Creating…" : "Create Plan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutPlan && (
        <PayPalCheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onActivated={(id) => {
            setCheckoutPlan(null);
            onRefresh();
            onLog(`Subscription activated: ${id}`);
          }}
          onLog={onLog}
        />
      )}
    </section>
  );
}
