import type { VercelRequest, VercelResponse } from "@vercel/node";

const BLOB_URL = "https://jsonblob.com/api/jsonBlob/019cf4b1-c056-7145-8ce7-165cc8918236";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const resp = await fetch(BLOB_URL, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) return res.status(resp.status).json({ error: "Changes fetch failed" });
      const data = await resp.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  }

  if (req.method === "PUT") {
    try {
      const resp = await fetch(BLOB_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(req.body),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: "Changes write failed" });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
