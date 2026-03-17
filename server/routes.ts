import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

// Art Pipeline JSONBlob URLs (UPDATED — old 019cf4cc/019cf4b1 expired)
const SNAPSHOT_BLOB = "https://jsonblob.com/api/jsonBlob/019cfa10-d033-7e2e-abb8-e71299184f97";
const CHANGES_BLOB = "https://jsonblob.com/api/jsonBlob/019cfa10-d1b2-7c2c-a1c1-933fb5230183";

// Business Pipeline JSONBlob URLs
const BIZ_SNAPSHOT_BLOB = "https://jsonblob.com/api/jsonBlob/019cf9f2-9b92-7ea3-9756-7c79e04f3116";
const BIZ_CHANGES_BLOB = "https://jsonblob.com/api/jsonBlob/019cf9f2-ad2d-73e5-ad98-24e81efa3e98";

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

  return httpServer;
}
