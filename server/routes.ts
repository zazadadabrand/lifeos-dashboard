import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";

// ═══════════════════════════════════════════
// LOCAL DEV STORE — in-memory with file-backed persistence
// No more JSONBlob dependency for local development.
// Production uses Vercel Edge Functions + Upstash Redis (see api/lib/kv.ts).
// ═══════════════════════════════════════════
const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const localStore: Record<string, any> = {};

function loadLocal(key: string): any {
  if (localStore[key] !== undefined) return localStore[key];
  const fp = path.join(DATA_DIR, `${key.replace(/:/g, "_")}.json`);
  if (fs.existsSync(fp)) {
    try {
      localStore[key] = JSON.parse(fs.readFileSync(fp, "utf-8"));
      return localStore[key];
    } catch { /* corrupted file, return null */ }
  }
  return null;
}

function saveLocal(key: string, data: any): boolean {
  try {
    localStore[key] = data;
    const fp = path.join(DATA_DIR, `${key.replace(/:/g, "_")}.json`);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2));
    return true;
  } catch { return false; }
}

// ═══════════════════════════════════════════
// WIPE PROTECTION — hardcoded, no override
// Prevents any PUT from replacing a populated pipeline with empty data.
// Data can only be cleared via manual user action.
// ═══════════════════════════════════════════
const PROTECTED_FIELDS: Record<string, string> = {
  "pipeline:snapshot": "artists",
  "business:snapshot": "deals",
  "family:snapshot": "ideas",
};

function wouldWipePipeline(key: string, newData: any): boolean {
  const field = PROTECTED_FIELDS[key];
  if (!field) return false;

  const existing = loadLocal(key);
  const existingItems = existing?.[field];
  const newItems = newData?.[field];

  if (Array.isArray(existingItems) && existingItems.length > 0) {
    if (!Array.isArray(newItems) || newItems.length === 0) {
      console.error(
        `[WIPE PROTECTION] BLOCKED: Attempted to overwrite ${key} ` +
        `(${existingItems.length} ${field}) with empty data.`
      );
      return true;
    }
  }
  return false;
}

function handleGet(key: string, fallback: any, res: any) {
  const data = loadLocal(key);
  res.json(data ?? fallback);
}

function handlePut(key: string, req: any, res: any) {
  // Wipe protection check
  if (wouldWipePipeline(key, req.body)) {
    return res.status(409).json({
      success: false,
      error: "WIPE_PROTECTION",
      message: "Cannot overwrite non-empty pipeline with empty data. This action requires manual approval.",
    });
  }
  const ok = saveLocal(key, req.body);
  res.status(ok ? 200 : 500).json({ success: ok });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── Art Pipeline ──
  app.get("/api/pipeline/snapshot", (req, res) => handleGet("pipeline:snapshot", { artists: [], snapshotAt: new Date().toISOString() }, res));
  app.get("/api/pipeline/changes", (req, res) => handleGet("pipeline:changes", { syncedAt: null, changes: [] }, res));
  app.put("/api/pipeline/snapshot", (req, res) => handlePut("pipeline:snapshot", req, res));
  app.put("/api/pipeline/changes", (req, res) => handlePut("pipeline:changes", req, res));

  // ── Business Pipeline ──
  app.get("/api/business/snapshot", (req, res) => handleGet("business:snapshot", { deals: [], snapshotAt: new Date().toISOString() }, res));
  app.get("/api/business/changes", (req, res) => handleGet("business:changes", { syncedAt: null, changes: [] }, res));
  app.put("/api/business/snapshot", (req, res) => handlePut("business:snapshot", req, res));
  app.put("/api/business/changes", (req, res) => handlePut("business:changes", req, res));

  // ── Family Pipeline ──
  app.get("/api/family/snapshot", (req, res) => handleGet("family:snapshot", { ideas: [], snapshotAt: new Date().toISOString() }, res));
  app.get("/api/family/changes", (req, res) => handleGet("family:changes", { syncedAt: null, changes: [] }, res));
  app.put("/api/family/snapshot", (req, res) => handlePut("family:snapshot", req, res));
  app.put("/api/family/changes", (req, res) => handlePut("family:changes", req, res));

  // ── Quick Notes ──
  app.get("/api/notes/snapshot", (req, res) => handleGet("notes:snapshot", { notes: "", updatedAt: new Date().toISOString() }, res));
  app.put("/api/notes/snapshot", (req, res) => handlePut("notes:snapshot", req, res));

  return httpServer;
}
