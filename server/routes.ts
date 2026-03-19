import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

// Art Pipeline JSONBlob URLs (REBUILT 2026-03-18 — previous blobs expired)
const SNAPSHOT_BLOB = "https://jsonblob.com/api/jsonBlob/019d0383-2640-745f-84c7-25cb0c2b5c22";
const CHANGES_BLOB = "https://jsonblob.com/api/jsonBlob/019d0383-29d9-701c-9d19-80d8ad7b90b0";

// Business Pipeline JSONBlob URLs (REBUILT 2026-03-18)
const BIZ_SNAPSHOT_BLOB = "https://jsonblob.com/api/jsonBlob/019d0383-3260-7552-9484-ebcfdac9f3d6";
const BIZ_CHANGES_BLOB = "https://jsonblob.com/api/jsonBlob/019d0383-343a-75d1-b335-8d64f823e6b7";

// Family Pipeline JSONBlob URLs (REBUILT 2026-03-18)
const FAM_SNAPSHOT_BLOB = "https://jsonblob.com/api/jsonBlob/019d0383-2d1c-725f-a620-562275328269";
const FAM_CHANGES_BLOB = "https://jsonblob.com/api/jsonBlob/019d0383-2f00-7716-82a8-333126e6cb6e";

// Helper: proxy GET from JSONBlob
async function proxyGet(blobUrl: string, res: any, label: string) {
  try {
    const resp = await fetch(blobUrl, { headers: { Accept: "application/json" } });
    if (!resp.ok) return res.status(resp.status).json({ error: `Failed to fetch ${label}` });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: `${label} fetch failed` });
  }
}

// Helper: proxy PUT to JSONBlob
async function proxyPut(blobUrl: string, req: any, res: any, label: string) {
  try {
    const resp = await fetch(blobUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(req.body),
    });
    if (!resp.ok) return res.status(resp.status).json({ error: `Failed to write ${label}` });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: `${label} write failed` });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── Art Pipeline ──
  app.get("/api/pipeline/snapshot", (req, res) => proxyGet(SNAPSHOT_BLOB, res, "art snapshot"));
  app.get("/api/pipeline/changes", (req, res) => proxyGet(CHANGES_BLOB, res, "art changes"));
  app.put("/api/pipeline/snapshot", (req, res) => proxyPut(SNAPSHOT_BLOB, req, res, "art snapshot"));
  app.put("/api/pipeline/changes", (req, res) => proxyPut(CHANGES_BLOB, req, res, "art changes"));

  // ── Business Pipeline ──
  app.get("/api/business/snapshot", (req, res) => proxyGet(BIZ_SNAPSHOT_BLOB, res, "biz snapshot"));
  app.get("/api/business/changes", (req, res) => proxyGet(BIZ_CHANGES_BLOB, res, "biz changes"));
  app.put("/api/business/snapshot", (req, res) => proxyPut(BIZ_SNAPSHOT_BLOB, req, res, "biz snapshot"));
  app.put("/api/business/changes", (req, res) => proxyPut(BIZ_CHANGES_BLOB, req, res, "biz changes"));

  // ── Family Pipeline ──
  app.get("/api/family/snapshot", (req, res) => proxyGet(FAM_SNAPSHOT_BLOB, res, "family snapshot"));
  app.get("/api/family/changes", (req, res) => proxyGet(FAM_CHANGES_BLOB, res, "family changes"));
  app.put("/api/family/snapshot", (req, res) => proxyPut(FAM_SNAPSHOT_BLOB, req, res, "family snapshot"));
  app.put("/api/family/changes", (req, res) => proxyPut(FAM_CHANGES_BLOB, req, res, "family changes"));

  return httpServer;
}
