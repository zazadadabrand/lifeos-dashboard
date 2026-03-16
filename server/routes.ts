import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

// ═══════════════════════════════════════════
// VETTING PIPELINE TYPES
// ═══════════════════════════════════════════
// Stage 1: Scouted (default) → approve → Stage 2: Deep Dive → shortlist → Stage 3: Shortlisted → outreach → Stage 4: In Conversation
type VettingStage = "scouted" | "deep-dive" | "shortlisted" | "in-conversation" | "declined";

interface ArtistVetting {
  stage: VettingStage;
  updatedAt: string;
  deepDive?: DeepDiveData;
}

interface DeepDiveData {
  fetchedAt: string;
  status: "pending" | "complete" | "error";
  fullExhibitionHistory?: string[];
  secondaryMarket?: string;
  representationDetails?: string;
  socialMetrics?: { followers?: string; engagement?: string; collectorActivity?: string };
  pressClippings?: PressClipping[];
  characterSignals?: CharacterSignals;
  artistStatement?: string;
  redFlags?: string[];
  draftOutreach?: { dm?: string; email?: string };
}

interface PressClipping {
  title: string;
  source: string;
  url?: string;
  date?: string;
  excerpt: string;
  relevance?: string; // How it relates to alignment assessment
}

interface CharacterSignals {
  workEthic?: string;
  processPhilosophy?: string;
  spiritualReligious?: string;
  communityInvolvement?: string;
  collaborationReadiness?: string;
  personalValues?: string;
  overallAlignment?: string; // Summary assessment
}

// In-memory stores
const artistRatings: Record<string, "approved" | "declined" | "pending"> = {};
const artistVetting: Record<string, ArtistVetting> = {};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ─── Legacy rating endpoints ───
  app.get("/api/artist-ratings", async (_req, res) => {
    res.json({ success: true, ratings: artistRatings });
  });

  app.post("/api/rate-artist", async (req, res) => {
    const { artistName, rating } = req.body;
    if (!artistName || !rating) {
      return res.status(400).json({ success: false, error: "Missing artistName or rating" });
    }
    artistRatings[artistName] = rating;
    res.json({ success: true });
  });

  // ─── Vetting Pipeline endpoints ───

  // Get all vetting data
  app.get("/api/vetting", async (_req, res) => {
    res.json({ success: true, vetting: artistVetting });
  });

  // Get single artist vetting
  app.get("/api/vetting/:artistName", async (req, res) => {
    const name = decodeURIComponent(req.params.artistName);
    const data = artistVetting[name];
    if (!data) {
      return res.json({ success: true, vetting: null });
    }
    res.json({ success: true, vetting: data });
  });

  // Advance artist stage (approve → deep-dive, deep-dive → shortlisted, etc.)
  app.post("/api/vetting/advance", async (req, res) => {
    const { artistName, targetStage } = req.body;
    if (!artistName || !targetStage) {
      return res.status(400).json({ success: false, error: "Missing artistName or targetStage" });
    }

    const validStages: VettingStage[] = ["scouted", "deep-dive", "shortlisted", "in-conversation", "declined"];
    if (!validStages.includes(targetStage)) {
      return res.status(400).json({ success: false, error: "Invalid stage" });
    }

    const existing = artistVetting[artistName];
    const now = new Date().toISOString();

    if (targetStage === "deep-dive") {
      // When moving to deep-dive, init with pending status
      artistVetting[artistName] = {
        stage: "deep-dive",
        updatedAt: now,
        deepDive: existing?.deepDive || { fetchedAt: now, status: "pending" },
      };
      // Also update legacy rating
      artistRatings[artistName] = "approved";
    } else if (targetStage === "declined") {
      artistVetting[artistName] = { stage: "declined", updatedAt: now };
      artistRatings[artistName] = "declined";
    } else if (targetStage === "scouted") {
      // Revert to scouted (undo)
      delete artistVetting[artistName];
      delete artistRatings[artistName];
    } else {
      artistVetting[artistName] = {
        ...existing,
        stage: targetStage,
        updatedAt: now,
      } as ArtistVetting;
      artistRatings[artistName] = "approved";
    }

    res.json({ success: true, vetting: artistVetting[artistName] || null });
  });

  // Save deep dive data for an artist
  app.post("/api/vetting/deep-dive", async (req, res) => {
    const { artistName, deepDive } = req.body;
    if (!artistName || !deepDive) {
      return res.status(400).json({ success: false, error: "Missing artistName or deepDive" });
    }

    const existing = artistVetting[artistName];
    if (!existing) {
      artistVetting[artistName] = {
        stage: "deep-dive",
        updatedAt: new Date().toISOString(),
        deepDive: { ...deepDive, fetchedAt: new Date().toISOString(), status: "complete" },
      };
    } else {
      existing.deepDive = { ...deepDive, fetchedAt: new Date().toISOString(), status: "complete" };
      existing.updatedAt = new Date().toISOString();
    }

    res.json({ success: true, vetting: artistVetting[artistName] });
  });

  return httpServer;
}
