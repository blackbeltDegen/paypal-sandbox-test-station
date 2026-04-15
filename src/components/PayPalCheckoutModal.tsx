"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/types";

interface Props {
  plan: Plan;
  onClose: () => void;
  onActivated?: (subscriptionId: string) => void;
  onLog?: (msg: string) => void;
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: PayPalButtonsOptions) => { render: (selector: string) => void };
    };
  }
}

interface PayPalButtonsOptions {
  style: {
    layout: string;
    color: string;
    shape: string;
    label: string;
  };
  createSubscription: (
    _data: unknown,
    actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } }
  ) => Promise<string>;
  onApprove: (data: { subscriptionID: string }) => void;
  onError: (err: unknown) => void;
  onCancel: () => void;
}

export default function PayPalCheckoutModal({
  plan,
  onClose,
  onActivated,
  onLog,
}: Props) {
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRendered = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  // Load the PayPal SDK if not already present
  useEffect(() => {
    if (window.paypal) {
      setSdkReady(true);
      return;
    }

    if (!clientId) {
      setError("NEXT_PUBLIC_PAYPAL_CLIENT_ID is not configured.");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription&components=buttons`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Failed to load PayPal SDK.");
    document.body.appendChild(script);

    return () => {
      // Only remove if we added it and it's still there
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render PayPal Buttons once SDK is ready
  useEffect(() => {
    if (!sdkReady || !window.paypal || !containerRef.current) return;
    if (buttonsRendered.current) return;
    buttonsRendered.current = true;

    window.paypal
      .Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "subscribe",
        },
        createSubscription: async (_data, actions) => {
          // Resolve PayPal plan ID via our API
          const res = await fetch("/api/paypal/get-plan-id", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId: plan.id }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Failed to get plan ID");
          return actions.subscription.create({ plan_id: json.planId });
        },
        onApprove: async (data) => {
          setLoading(true);
          try {
            const res = await fetch("/api/paypal/activate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscriptionId: data.subscriptionID,
                planId: plan.paypal_plan_id,
              }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Activation failed");
            onLog?.(`Subscription activated: ${data.subscriptionID}`);
            onActivated?.(data.subscriptionID);
            window.location.href = "/?paypal=success";
          } catch (err) {
            setError(err instanceof Error ? err.message : "Activation failed");
            setLoading(false);
          }
        },
        onError: (err) => {
          const msg =
            err instanceof Error ? err.message : "PayPal encountered an error.";
          setError(msg);
        },
        onCancel: () => {
          onLog?.(`Checkout cancelled for plan: ${plan.name}`);
          onClose();
        },
      })
      .render("#paypal-button-container");
  }, [sdkReady, plan, onClose, onActivated, onLog]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-dark-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
            <p className="text-sm text-gold-400">
              ${Number(plan.price_usd).toFixed(2)} /{" "}
              {plan.billing_frequency_months === 1
                ? "month"
                : `${plan.billing_frequency_months} months`}{" "}
              · billed indefinitely
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {loading && (
            <div className="mb-4 flex items-center gap-2 text-sm text-white/60">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Activating subscription…
            </div>
          )}

          {!sdkReady && !error && (
            <div className="flex items-center justify-center py-8 text-white/40">
              <svg
                className="mr-2 h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Loading PayPal…
            </div>
          )}

          <div
            id="paypal-button-container"
            ref={containerRef}
            className={sdkReady && !loading ? "block" : "hidden"}
          />

          {plan.description && (
            <p className="mt-4 text-xs text-white/40">{plan.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
