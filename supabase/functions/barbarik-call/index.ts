// BARBARIK secure outbound-call endpoint for Supabase Edge Functions.
// Secrets stay server-side. Configure them in Supabase project secrets.
// Exotel endpoint/parameters follow Exotel's documented Calls/connect API.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function cleanPhone(value: unknown): string {
  const raw = String(value ?? "").trim().replace(/[^0-9+]/g, "");
  if (/^\+91\d{10}$/.test(raw)) return raw;
  if (/^91\d{10}$/.test(raw)) return `+${raw}`;
  if (/^\d{10}$/.test(raw)) return `+91${raw}`;
  throw new Error("Invalid Indian mobile number");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  try {
    const body = await req.json();
    const to = cleanPhone(body.to);
    const message = String(body.message ?? "BARBARIK calling. Your money briefing is ready.").slice(0, 1200);

    const apiKey = Deno.env.get("EXOTEL_API_KEY");
    const apiToken = Deno.env.get("EXOTEL_API_TOKEN");
    const accountSid = Deno.env.get("EXOTEL_ACCOUNT_SID");
    const callerId = Deno.env.get("EXOTEL_CALLER_ID");
    const flowUrl = Deno.env.get("EXOTEL_FLOW_URL");
    const region = Deno.env.get("EXOTEL_REGION") || "api.in.exotel.com";

    if (!apiKey || !apiToken || !accountSid || !callerId || !flowUrl) {
      return json({ ok: false, error: "Calling backend is not configured yet. Add Exotel secrets in Supabase." }, 503);
    }

    // Exotel's Calls/connect first dials the From number. The flow then controls
    // what the user hears. custom_field carries BARBARIK's generated briefing
    // into the configured flow/Passthru integration.
    const endpoint = `https://${region}/v1/Accounts/${encodeURIComponent(accountSid)}/Calls/connect`;
    const form = new URLSearchParams();
    form.set("From", to);
    form.set("CallerId", callerId);
    form.set("Url", flowUrl);
    form.set("CallType", "trans");
    form.set("TimeLimit", "300");
    form.set("TimeOut", "45");
    form.set("CustomField", JSON.stringify({ source: "BARBARIK", language: body.language || "mr-IN", message }));

    const auth = btoa(`${apiKey}:${apiToken}`);
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return json({ ok: false, error: "Exotel rejected the call request", upstream_status: upstream.status, details: text.slice(0, 1000) }, 502);
    }

    return json({
      ok: true,
      message: "BARBARIK call request accepted by telephony backend.",
      exotel_response: text.slice(0, 4000),
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unexpected server error" }, 400);
  }
});
