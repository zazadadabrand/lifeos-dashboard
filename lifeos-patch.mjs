#!/usr/bin/env node
/**
 * LifeOS Dashboard Patch Script
 * ==============================
 * Run from the repo root:  node lifeos-patch.mjs
 *
 * Changes:
 * 1. Remove sections: Quick Notes, Stats, Saturday Review, Hub & Connectors, Credit Usage
 * 2. Remove Finance + Connectors cards from "At a Glance"
 * 3. Up art scout batch from 5 → 10 artists
 */

import fs from "fs";
import path from "path";

const REPO = process.cwd();
const DASH = path.join(REPO, "client/src/pages/Dashboard.tsx");
const AGENTS = path.join(REPO, ".github/workflows/agents.yml");

let changeCount = 0;
const log = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);

// ─────────────────────────────────────────────────
// 1. DASHBOARD.TSX
// ─────────────────────────────────────────────────
console.log("\n📦 Patching Dashboard.tsx...\n");

if (!fs.existsSync(DASH)) {
  console.error(`❌ File not found: ${DASH}`);
  console.error("   Make sure you run this script from the repo root.");
  process.exit(1);
}

let dash = fs.readFileSync(DASH, "utf-8");
const originalDash = dash;

// --- 1a. Remove sections from DEFAULT_SECTIONS array ---
const sectionsToRemove = [
  "quick-notes",
  "kpis",
  "saturday-review",
  "hub-connectors",
  "credits",
];

for (const id of sectionsToRemove) {
  // Match the full line:  { id: "xxx", label: "Yyy" },  (with optional whitespace)
  const regex = new RegExp(
    `\\s*\\{\\s*id:\\s*"${id}"\\s*,\\s*label:\\s*"[^"]*"\\s*\\},?\\n?`,
    "g"
  );
  const before = dash.length;
  dash = dash.replace(regex, "\n");
  if (dash.length !== before) {
    log(`Removed "${id}" from DEFAULT_SECTIONS`);
    changeCount++;
  } else {
    warn(`Could not find "${id}" in DEFAULT_SECTIONS — may need manual removal`);
  }
}

// --- 1b. Remove switch cases for removed sections in renderSection ---
// Each case block looks like:
//   case "section-id":
//     return (...);    OR    return <Component />;
// We need to remove from `case "xxx":` to just before the next `case` or `default`
for (const id of sectionsToRemove) {
  // Match:  case "id": ... (everything until the next case or default or closing brace of switch)
  const caseRegex = new RegExp(
    `(\\s*)case\\s+"${id}":\\s*\\n(?:(?!\\s*case\\s+"|\\s*default:)[^\\n]*\\n)*`,
    "g"
  );
  const before = dash.length;
  dash = dash.replace(caseRegex, "");
  if (dash.length !== before) {
    log(`Removed renderSection case "${id}"`);
    changeCount++;
  } else {
    warn(`Could not find renderSection case "${id}" — may need manual removal`);
  }
}

// --- 1c. Remove Finance card from At a Glance section ---
// The Finance card in the tldr/at-a-glance section. Look for a block containing
// "Finance" near words like "Planned", "Finance Agent", "Crypto Scanner", "queued"
// It's typically a card/div block. We'll match the common patterns.

// Pattern: a card block that mentions Finance in the At A Glance area
// Try to find and remove the Finance status card
const financePatterns = [
  // Full card div with Finance label
  /\s*<div[^>]*>\s*\n(?:[^]*?Finance(?:(?!<\/div>\s*\n\s*<div|<\/section|<\/[A-Z]).)*?)<\/div>\s*\n/g,
];

// More targeted: find lines near "Finance" in the glance section
// The At a Glance section has status cards. We'll remove the Finance one.
// Look for pattern like: title/label containing "Finance" wrapped in a card
const financeCardRegex = /(\s*(?:<[^>]+>\s*\n)*\s*(?:<[^>]+>)*\s*Finance\s*(?:<\/[^>]+>)*\s*\n(?:(?!^\s*<(?:\/section|section|h[1-6]))[^\n]*\n){0,15}?\s*(?:Planned|queued|v2\.0)[^\n]*\n(?:(?!^\s*<(?:\/section|section|h[1-6]))[^\n]*\n){0,8})/gm;

// Simpler approach: find blocks between markers
// Let's search for the Finance status card and the Connectors status card
// These are typically in a grid of status cards in the "at a glance" / "tldr" section

// Strategy: Find the specific JSX blocks. We'll look for recognizable text patterns.
let financeRemoved = false;
let connectorsRemoved = false;

// Remove Finance status card — look for the div/card containing "Finance" + "Planned"
{
  // Find index of "Finance" that's near "Planned" or "v2.0" (the At A Glance card)
  const lines = dash.split("\n");
  let financeStart = -1;
  let financeEnd = -1;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    // Look for a line with "Finance" that's part of the At a Glance section
    // (not the DEFAULT_SECTIONS or renderSection we already modified)
    if (
      lines[i].includes("Finance") &&
      !lines[i].includes("case") &&
      !lines[i].includes("id:") &&
      !lines[i].includes("//")
    ) {
      // Check nearby lines for "Planned" or "queued" or "v2.0" — confirming it's the at-a-glance card
      const nearby = lines.slice(Math.max(0, i - 3), i + 8).join(" ");
      if (nearby.includes("Planned") || nearby.includes("queued") || nearby.includes("v2.0") || nearby.includes("Crypto")) {
        // Found the Finance card. Now find the card boundaries.
        // Walk backwards to find the opening of this card container
        financeStart = i;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (lines[j].match(/<div\b/) || lines[j].match(/<Card\b/) || lines[j].match(/\{\/\*.*Finance/)) {
            financeStart = j;
            break;
          }
        }
        // Walk forward to find closing
        let depth = 0;
        for (let j = financeStart; j < Math.min(lines.length, financeStart + 25); j++) {
          const opens = (lines[j].match(/<(?:div|Card|section)\b/g) || []).length;
          const closes = (lines[j].match(/<\/(?:div|Card|section)\b/g) || []).length;
          depth += opens - closes;
          if (depth <= 0 && j > financeStart) {
            financeEnd = j;
            break;
          }
        }
        if (financeEnd === -1) financeEnd = financeStart + 15;
        break;
      }
    }
  }

  if (financeStart !== -1) {
    lines.splice(financeStart, financeEnd - financeStart + 1);
    dash = lines.join("\n");
    log(`Removed Finance card from At a Glance (lines ${financeStart + 1}–${financeEnd + 1})`);
    financeRemoved = true;
    changeCount++;
  }
}

// Remove Connectors status card from At a Glance — similar approach
{
  const lines = dash.split("\n");
  let connStart = -1;
  let connEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("Connector") &&
      !lines[i].includes("case") &&
      !lines[i].includes("id:") &&
      !lines[i].includes("//") &&
      !lines[i].includes("import")
    ) {
      const nearby = lines.slice(Math.max(0, i - 3), i + 8).join(" ");
      if (nearby.includes("connected") || nearby.includes("Sheets") || nearby.includes("Drive") || nearby.includes("linked") || nearby.includes("Gmail")) {
        connStart = i;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (lines[j].match(/<div\b/) || lines[j].match(/<Card\b/)) {
            connStart = j;
            break;
          }
        }
        let depth = 0;
        for (let j = connStart; j < Math.min(lines.length, connStart + 25); j++) {
          const opens = (lines[j].match(/<(?:div|Card|section)\b/g) || []).length;
          const closes = (lines[j].match(/<\/(?:div|Card|section)\b/g) || []).length;
          depth += opens - closes;
          if (depth <= 0 && j > connStart) {
            connEnd = j;
            break;
          }
        }
        if (connEnd === -1) connEnd = connStart + 15;
        break;
      }
    }
  }

  if (connStart !== -1) {
    lines.splice(connStart, connEnd - connStart + 1);
    dash = lines.join("\n");
    log(`Removed Connectors card from At a Glance (lines ${connStart + 1}–${connEnd + 1})`);
    connectorsRemoved = true;
    changeCount++;
  }
}

if (!financeRemoved) warn("Finance card not auto-removed from At a Glance — manual edit needed (search for 'Finance' near 'Planned')");
if (!connectorsRemoved) warn("Connectors card not auto-removed from At a Glance — manual edit needed (search for 'Connector' near 'connected')");

// Write Dashboard.tsx
if (dash !== originalDash) {
  fs.writeFileSync(DASH, dash, "utf-8");
  console.log(`\n  💾 Dashboard.tsx saved (${originalDash.split("\n").length} → ${dash.split("\n").length} lines)\n`);
} else {
  warn("No changes made to Dashboard.tsx");
}

// ─────────────────────────────────────────────────
// 2. AGENTS.YML — Art Scout 5 → 10
// ─────────────────────────────────────────────────
console.log("📦 Patching agents.yml...\n");

if (!fs.existsSync(AGENTS)) {
  warn(`agents.yml not found at ${AGENTS} — skipping`);
} else {
  let yml = fs.readFileSync(AGENTS, "utf-8");
  const originalYml = yml;

  // Change the job name
  yml = yml.replace(
    /Art Scout \(5 artists\)/g,
    "Art Scout (10 artists)"
  );

  // If there's a num_artists or similar env/param, update it
  yml = yml.replace(/num_artists=5/g, "num_artists=10");
  yml = yml.replace(/NUM_ARTISTS=5/g, "NUM_ARTISTS=10");
  yml = yml.replace(/artists_per_batch=5/g, "artists_per_batch=10");
  yml = yml.replace(/count=5/g, "count=10");

  if (yml !== originalYml) {
    fs.writeFileSync(AGENTS, yml, "utf-8");
    log("Updated art scout batch size: 5 → 10 artists");
    changeCount++;
  } else {
    warn("No numeric changes in agents.yml — the count may be set server-side");
  }
}

// ─────────────────────────────────────────────────
// 3. SEARCH FOR ARTIST COUNT IN OTHER FILES
// ─────────────────────────────────────────────────
console.log("\n🔍 Searching for artist count config in other files...\n");

const searchDirs = ["server", "api", "client/src/lib", "client/src/hooks"];
const searchPatterns = [/num.*artist/i, /artist.*count/i, /artist.*per/i, /batch.*size/i, /= 5;?\s*\/\/.*artist/i, /= 5;?\s*\/\/.*scout/i];

for (const dir of searchDirs) {
  const fullDir = path.join(REPO, dir);
  if (!fs.existsSync(fullDir)) continue;

  const files = getAllFiles(fullDir);
  for (const file of files) {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx") && !file.endsWith(".js")) continue;
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      for (const pat of searchPatterns) {
        if (pat.test(lines[i])) {
          console.log(`  📍 ${path.relative(REPO, file)}:${i + 1} → ${lines[i].trim().substring(0, 80)}`);
        }
      }
    }
  }
}

// Also search Dashboard.tsx for the count
{
  const dashLines = dash.split("\n");
  for (let i = 0; i < dashLines.length; i++) {
    for (const pat of searchPatterns) {
      if (pat.test(dashLines[i])) {
        console.log(`  📍 Dashboard.tsx:${i + 1} → ${dashLines[i].trim().substring(0, 80)}`);
      }
    }
  }
}

// ─────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`✅ ${changeCount} changes applied.`);
console.log(`${"═".repeat(50)}`);
console.log(`\nNext steps:`);
console.log(`  1. Review the diff:  git diff`);
console.log(`  2. Test locally:     npm run dev`);
console.log(`  3. If the Finance/Connectors cards weren't auto-removed,`);
console.log(`     search Dashboard.tsx for "Finance" and "Connector" in the`);
console.log(`     "at a glance" / "tldr" section and remove those card blocks.`);
console.log(`  4. For the artist count (5→10), check if there's a server-side`);
console.log(`     config or OpenAI/Anthropic prompt that specifies the count.\n`);

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function getAllFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllFiles(full));
    else files.push(full);
  }
  return files;
}
