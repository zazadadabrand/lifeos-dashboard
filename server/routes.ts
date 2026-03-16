import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const SNAPSHOT_BLOB = "https://jsonblob.com/api/jsonBlob/019cf4cc-d5b8-705a-97d6-502d72422549";
const CHANGES_BLOB = "https://jsonblob.com/api/jsonBlob/019cf4b1-c056-7145-8ce7-165cc8918236";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Pipeline snapshot proxy — GET reads from JSONBlob
  app.get("/api/pipeline/snapshot", async (_req, res) => {
    try {
      const resp = await fetch(SNAPSHOT_BLOB, {
        headers: { "Accept": "application/json" },
      });
      if (!resp.ok) return res.status(resp.status).json({ error: "Failed to fetch snapshot" });
      const data = await resp.json();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Snapshot fetch failed" });
    }
  });

  // Pipeline changes proxy — GET reads, PUT writes to JSONBlob
  app.get("/api/pipeline/changes", async (_req, res) => {
    try {
      const resp = await fetch(CHANGES_BLOB, {
        headers: { "Accept": "application/json" },
      });
      if (!resp.ok) return res.status(resp.status).json({ error: "Failed to fetch changes" });
      const data = await resp.json();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Changes fetch failed" });
    }
  });

  app.put("/api/pipeline/changes", async (req, res) => {
    try {
      const resp = await fetch(CHANGES_BLOB, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(req.body),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: "Failed to write changes" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Changes write failed" });
    }
  });

  return httpServer;
}
