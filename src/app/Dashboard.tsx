"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan, Subscription } from "@/types";
import PlansPanel from "@/components/PlansPanel";
import SubscriptionsPanel from "@/components/SubscriptionsPanel";
import ScenarioLog from "@/components/ScenarioLog";

interface Props {
  initialPlans: Plan[];
  initialSubscriptions: Subscription[];
  paypalStatus: string | null;
}

export default function Dashboard({
  initialPlans,
  initialSubscriptions,
  paypalStatus,
}: Props) {
  const router = useRouter();
  const [logs, setLogs] = useState<string[]>([]);
  const [banner, setBanner] = useState<{
    type: "success" | "warning";
    msg: string;
  } | null>(null);
  const [subs, setSubs] = useState<Subscription[]>(initialSubscriptions);
  const [plans] = useState<Plan[]>(initialPlans);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg]);
  }, []);

  // Handle ?paypal= query param
  useEffect(() => {
    if (paypalStatus === "success") {
      setBanner({ type: "success", msg: "Subscription activated successfully!" });
      addLog("PayPal checkout completed — subscription activated.");
      // Auto-dismiss after 8 seconds
      bannerTimer.current = setTimeout(() => setBanner(null), 8000);
      // Clear the query param from the URL
      router.replace("/", { scroll: false });
    } else if (paypalStatus === "cancelled") {
      setBanner({ type: "warning", msg: "Checkout was cancelled." });
      bannerTimer.current = setTimeout(() => setBanner(null), 5000);
      router.replace("/", { scroll: false });
    }
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [paypalStatus, router, addLog]);

  async function refreshSubscriptions() {
    try {
      const res = await fetch("/api/subscriptions/list");
      if (res.ok) {
        const data = await res.json();
        setSubs(data);
      }
    } catch {
      // Silently fail — user can refresh manually
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white">
      {/* Banner */}
      {banner && (
        <div
          className={`sticky top-0 z-40 px-6 py-3 text-sm font-medium ${
            banner.type === "success"
              ? "bg-green-600/90 text-white backdrop-blur"
              : "bg-yellow-500/90 text-dark-950 backdrop-blur"
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <span>{banner.msg}</span>
            <button
              onClick={() => setBanner(null)}
              className="ml-4 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/10 bg-dark-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-dark-950"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">
                PayPal Sandbox Test Station
              </h1>
              <p className="text-xs text-white/40">
                sandbox.paypal.com — test environment
              </p>
            </div>
          </div>
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
            SANDBOX
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* Panel 1: Plans */}
        <PlansPanel
          initialPlans={plans}
          onLog={addLog}
          onRefresh={refreshSubscriptions}
        />

        {/* Panel 2: Subscriptions */}
        <SubscriptionsPanel
          initialSubscriptions={subs}
          plans={plans}
          onLog={addLog}
        />

        {/* Panel 3: Scenario Log */}
        <ScenarioLog logs={logs} onClear={() => setLogs([])} />
      </main>
    </div>
  );
}
