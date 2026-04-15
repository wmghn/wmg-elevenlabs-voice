/**
 * ElevenLabs TTS Proxy — Netlify Function
 * Path: /v1/text-to-speech/:voiceId  (qua redirect trong netlify.toml)
 */

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Lấy voiceId từ path: /v1/text-to-speech/:voiceId
  const match = event.path.match(/\/v1\/text-to-speech\/([^/?]+)/);
  const voiceId = match ? match[1] : null;
  if (!voiceId) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Missing voiceId" }),
    };
  }

  const apiKey =
    event.headers["xi-api-key"] ||
    (event.headers["authorization"] || "").replace("Bearer ", "");

  if (!apiKey) {
    return {
      statusCode: 401,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Missing xi-api-key" }),
    };
  }

  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body || "";

  const query = event.rawQuery ? `?${event.rawQuery}` : "";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}${query}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: event.headers["accept"] || "audio/mpeg",
      },
      body,
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";

    return {
      statusCode: upstream.status,
      headers: {
        ...corsHeaders(),
        "content-type": contentType,
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Proxy error", detail: err.message }),
    };
  }
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, xi-api-key, authorization, accept",
  };
}
