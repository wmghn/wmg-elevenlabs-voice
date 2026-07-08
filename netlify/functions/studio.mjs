/**
 * ElevenLabs Studio Proxy — Netlify Function v2 (streaming)
 * Path: /v1/studio/*  (khai báo qua config.path, không cần redirect trong netlify.toml)
 *
 * Dùng Functions v2 + stream response để byte từ ElevenLabs về trình duyệt ngay
 * khi có — tránh lỗi "Inactivity Timeout" của gateway Netlify (function chỉ được
 * chạy 10s) và nâng trần response từ ~4.5MB (base64) lên 20MB (stream).
 *
 * Chặn GET /v1/studio/projects (liệt kê toàn bộ project) để không lộ
 * Studio của các bên khác đang dùng chung API key.
 */

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const subpath = url.pathname.replace(
    /^\/(?:v1\/studio|\.netlify\/functions\/studio)\/?/,
    ""
  );
  if (!subpath) {
    return jsonError(400, "Missing Studio path");
  }

  // Không cho liệt kê danh sách projects — chỉ được thao tác trên project cụ thể
  if (req.method === "GET" && subpath.replace(/\/+$/, "") === "projects") {
    return jsonError(403, "Listing Studio projects is disabled on this proxy");
  }

  const apiKey =
    req.headers.get("xi-api-key") ||
    (req.headers.get("authorization") || "").replace("Bearer ", "");

  if (!apiKey) {
    return jsonError(401, "Missing xi-api-key");
  }

  const headers = {
    "xi-api-key": apiKey,
    accept: req.headers.get("accept") || "*/*",
  };
  // content-type phải giữ nguyên (multipart cần boundary)
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  // Request body nhỏ (text/JSON) — buffer cho đơn giản; chỉ response mới cần stream
  const body = ["GET", "HEAD"].includes(req.method)
    ? undefined
    : await req.arrayBuffer();

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/studio/${subpath}${url.search}`,
      {
        method: req.method,
        headers,
        body: body && body.byteLength > 0 ? body : undefined,
      }
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "content-type":
          upstream.headers.get("content-type") || "application/octet-stream",
      },
    });
  } catch (err) {
    return jsonError(502, "Proxy error", err.message);
  }
};

export const config = {
  path: "/v1/studio/*",
};

function jsonError(status, error, detail) {
  return new Response(JSON.stringify(detail ? { error, detail } : { error }), {
    status,
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, xi-api-key, authorization, accept",
  };
}
