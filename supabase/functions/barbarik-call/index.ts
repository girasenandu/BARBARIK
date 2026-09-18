const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeIndianPhone(phone: string) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) return "0" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return "0" + digits.slice(2);

  return "";
}

function buildBriefing(name: string, message?: string) {
  if (message?.trim()) return message.trim();

  return [
    `Namaskar ${name || "Nandu Dada"}.`,
    "Mi BARBARIK boltoy.",
    "Tumchya money follow-up ani cash-flow cha important update aahe.",
    "BARBARIK dashboard open karun pending entries check kara.",
  ].join(" ");
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Only POST is allowed" }, 405);
  }

  try {
    const body = await req.json();

    const ownerNumber = Deno.env.get("BARBARIK_OWNER_NUMBER") || "";
    const phone = normalizeIndianPhone(body.phone || ownerNumber);
    const name = String(body.name || "Nandu Dada");
    const message = buildBriefing(name, body.message);

    if (!phone) {
      return json({ ok: false, error: "Valid Indian mobile number is required" }, 400);
    }

    const apiKey = Deno.env.get("EXOTEL_API_KEY");
    const apiToken = Deno.env.get("EXOTEL_API_TOKEN");
    const accountSid = Deno.env.get("EXOTEL_ACCOUNT_SID");
    const region = Deno.env.get("EXOTEL_REGION") || "api.in.exotel.com";
    const callerId = Deno.env.get("EXOTEL_CALLER_ID");
    const flowUrl = Deno.env.get("EXOTEL_FLOW_URL");

    if (!apiKey || !apiToken || !accountSid || !callerId || !flowUrl) {
      return json({
        ok: false,
        error: "BARBARIK backend secrets are incomplete",
        required: [
          "EXOTEL_API_KEY",
          "EXOTEL_API_TOKEN",
          "EXOTEL_ACCOUNT_SID",
          "EXOTEL_CALLER_ID",
          "EXOTEL_FLOW_URL",
        ],
      }, 500);
    }

    const endpoint =
      `https://${region}/v1/accounts/${encodeURIComponent(accountSid)}/calls/connect`;

    const form = new URLSearchParams();
    form.set("from", phone);
    form.set("callerid", callerId);
    form.set("calltype", "trans");
    form.set("url", flowUrl);
    form.set("timelimit", "120");
    form.set("timeout", "30");
    form.set("customfield", `BARBARIK|${name}|${message.slice(0, 180)}`);

    const auth = btoa(`${apiKey}:${apiToken}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/xml, application/json",
      },
      body: form.toString(),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Exotel error:", response.status, responseText);
      return json({
        ok: false,
        error: "Exotel rejected the call request",
        provider_status: response.status,
        provider_response: responseText,
      }, 502);
    }

    const sid =
      responseText.match(/<sid>([^<]+)<\/sid>/i)?.[1] ||
      responseText.match(/"sid"\s*:\s*"([^"]+)"/i)?.[1] ||
      null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/call_history`, {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            phone,
            message,
            status: "REQUESTED",
            provider_call_id: sid,
          }),
        });
      } catch (e) {
        console.error("call_history save failed:", e);
      }
    }

    return json({
      ok: true,
      provider: "Exotel",
      status: "REQUESTED",
      call_id: sid,
      message: "BARBARIK call request sent.",
    });
  } catch (error) {
    console.error("BARBARIK error:", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

// Optional flow endpoint for future ExoML use.
// The active Exotel flow should control the voice experience.
export function exomlSay(message: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xmlEscape(message)}</Say></Response>`,
    {
      headers: {
        "Content-Type": "application/xml",
        ...corsHeaders,
      },
    },
  );
}
