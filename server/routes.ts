import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

// In-memory ratings store (persists for the life of the server process)
const artistRatings: Record<string, "approved" | "declined" | "pending"> = {};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all artist ratings
  app.get("/api/artist-ratings", async (_req, res) => {
    res.json({ success: true, ratings: artistRatings });
  });

  // Rate an artist
  app.post("/api/rate-artist", async (req, res) => {
    const { artistName, rating } = req.body;
    if (!artistName || !rating) {
      return res.status(400).json({ success: false, error: "Missing artistName or rating" });
    }
    artistRatings[artistName] = rating;
    res.json({ success: true });
  });

  return httpServer;
}
