const PAYPAL_BASE_URL =
  process.env.PAYPAL_BASE_URL ?? "https://api-m.sandbox.paypal.com";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Fetches a Bearer token using client credentials flow. */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal token error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

// ---------------------------------------------------------------------------
// Billing Plans
// ---------------------------------------------------------------------------

/**
 * Creates a PayPal product (SERVICE type) then a billing plan on top of it.
 * If existingProductId is supplied, skips product creation and uses it.
 * Returns the new plan ID string.
 */
export async function createPayPalBillingPlan(
  name: string,
  description: string,
  priceUsd: number,
  billingFrequencyMonths: number = 1,
  existingProductId?: string,
  trialDays?: number
): Promise<string> {
  const token = await getPayPalAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // 1. Create product if not provided
  let productId = existingProductId;
  if (!productId) {
    const productRes = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name,
        description: description || name,
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });

    if (!productRes.ok) {
      const body = await productRes.text();
      throw new Error(`PayPal create product error ${productRes.status}: ${body}`);
    }

    const product = await productRes.json();
    productId = product.id as string;
  }

  // 2. Create billing plan
  const planRes = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      product_id: productId,
      name,
      description: description || name,
      status: "ACTIVE",
      billing_cycles: [
        // Optional $0 trial to delay first charge to a specific start date
        ...(trialDays && trialDays > 0
          ? [
              {
                frequency: {
                  interval_unit: "DAY",
                  interval_count: trialDays,
                },
                tenure_type: "TRIAL",
                sequence: 1,
                total_cycles: 1,
                pricing_scheme: {
                  fixed_price: {
                    value: "0.00",
                    currency_code: "USD",
                  },
                },
              },
            ]
          : []),
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: billingFrequencyMonths,
          },
          tenure_type: "REGULAR",
          sequence: trialDays && trialDays > 0 ? 2 : 1,
          total_cycles: 0, // indefinite
          pricing_scheme: {
            fixed_price: {
              value: priceUsd.toFixed(2),
              currency_code: "USD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    }),
  });

  if (!planRes.ok) {
    const body = await planRes.text();
    throw new Error(`PayPal create plan error ${planRes.status}: ${body}`);
  }

  const plan = await planRes.json();
  return plan.id as string;
}

/** Fetches a billing plan's details from PayPal (includes product_id). */
export async function getPayPalBillingPlan(
  planId: string
): Promise<Record<string, unknown>> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal get plan error ${res.status}: ${body}`);
  }

  return res.json();
}

/** Deactivates a billing plan by setting its status to INACTIVE. */
export async function deactivatePayPalBillingPlan(planId: string): Promise<void> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${planId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        op: "replace",
        path: "/status",
        value: "INACTIVE",
      },
    ]),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `PayPal deactivate plan error ${res.status}: ${body}`
    );
  }
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Creates a subscription for the given planId.
 * Returns { id, approvalUrl }.
 */
export async function createPayPalSubscription(
  planId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ id: string; approvalUrl: string }> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      plan_id: planId,
      application_context: {
        brand_name: "PayPal Sandbox Test Station",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
        },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `PayPal create subscription error ${res.status}: ${body}`
    );
  }

  const data = await res.json();
  const approvalLink = (data.links as Array<{ rel: string; href: string }>).find(
    (l) => l.rel === "approve"
  );

  return {
    id: data.id as string,
    approvalUrl: approvalLink?.href ?? "",
  };
}

/** Fetches full subscription details from PayPal. */
export async function getPayPalSubscription(
  subscriptionId: string
): Promise<Record<string, unknown>> {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `PayPal get subscription error ${res.status}: ${body}`
    );
  }

  return res.json();
}

/** Cancels a subscription. */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason = "Cancelled via test dashboard"
): Promise<void> {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    }
  );

  // 204 No Content is success; 422 may mean already cancelled
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(
      `PayPal cancel subscription error ${res.status}: ${body}`
    );
  }
}

/**
 * Revises (upgrades/downgrades) a subscription to a new plan.
 * Returns the approval URL the user must visit to confirm.
 */
export async function revisePayPalSubscription(
  subscriptionId: string,
  newPlanId: string,
  startTime: string,
  returnUrl: string,
  cancelUrl: string
): Promise<string> {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/revise`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: newPlanId,
        effective_time: startTime,
        application_context: {
          brand_name: "PayPal Sandbox Test Station",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `PayPal revise subscription error ${res.status}: ${body}`
    );
  }

  const data = await res.json();
  const approvalLink = (
    data.links as Array<{ rel: string; href: string }>
  ).find((l) => l.rel === "approve");

  return approvalLink?.href ?? "";
}
