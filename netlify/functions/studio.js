/**
 * ElevenLabs Studio Proxy — Netlify Function
 * Path: /v1/studio/*  (qua redirect trong netlify.toml)
 *
 * Chặn GET /v1/studio/projects (liệt kê toàn bộ project) để không lộ
 * Studio của các bên khác đang dùng chung API key.
 */

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: "",
    };
  }

  // Lấy subpath sau /v1/studio/ (hoặc sau path function khi gọi trực tiếp)
  const match = event.path.match(
    /\/(?:v1\/studio|\.netlify\/functions\/studio)\/(.+)$/
  );
  const subpath = match ? match[1] : null;
  if (!subpath) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Missing Studio path" }),
    };
  }

  // Không cho liệt kê danh sách projects — chỉ được thao tác trên project cụ thể
  if (event.httpMethod === "GET" && subpath.replace(/\/+$/, "") === "projects") {
    return {
      statusCode: 403,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: "Listing Studio projects is disabled on this proxy",
      }),
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

  // Giữ nguyên body dạng binary (multipart upload) lẫn JSON
  const body = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : event.body
    : undefined;

  const query = event.rawQuery ? `?${event.rawQuery}` : "";
  const url = `https://api.elevenlabs.io/v1/studio/${subpath}${query}`;

  const headers = {
    "xi-api-key": apiKey,
    accept: event.headers["accept"] || "*/*",
  };
  // content-type phải giữ nguyên (multipart cần boundary)
  if (event.headers["content-type"]) {
    headers["content-type"] = event.headers["content-type"];
  }

  try {
    const upstream = await fetch(url, {
      method: event.httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : body,
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
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, xi-api-key, authorization, accept",
  };
}
