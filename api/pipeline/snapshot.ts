import type { VercelRequest, VercelResponse } from "@vercel/node";

const BLOB_URL = "https://jsonblob.com/api/jsonBlob/019cf4cc-d5b8-705a-97d6-502d72422549";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const resp = await fetch(BLOB_URL, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return res.status(resp.status).json({ error: "Snapshot fetch failed" });
    const data = await resp.json();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Internal error" });
  }
}
