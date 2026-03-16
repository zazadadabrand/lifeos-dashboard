import { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ═══════════════════════════════════════════
// API BASE — proxied through deploy, localhost for dev
// ═══════════════════════════════════════════
const _API_RAW = "__PORT_8000__";
const API_BASE = _API_RAW.startsWith("__") ? "http://localhost:8000" : _API_RAW;

// ═══════════════════════════════════════════
// COLOR VARIANTS (8 environments)
// ═══════════════════════════════════════════
interface ColorBlob {
  color: string;
  position: string;
  size: string;
}

interface ColorVariant {
  label: string;
  bg: string;
  blobs: ColorBlob[];
  shadowTint: { r: number; g: number; b: number };
}

const COLOR_VARIANTS: Record<string, ColorVariant> = {
  "deep-space": {
    label: "Deep Space",
    bg: "#08080c",
    blobs: [
      { color: "rgba(62,200,214,0.10)", position: "25% 40%", size: "80% 60%" },
      { color: "rgba(163,98,224,0.08)", position: "75% 60%", size: "60% 80%" },
      { color: "rgba(229,168,33,0.05)", position: "50% 80%", size: "50% 50%" },
    ],
    shadowTint: { r: 180, g: 190, b: 220 },
  },
  "northern-lights": {
    label: "Northern Lights",
    bg: "#060a0e",
    blobs: [
      { color: "rgba(40,220,180,0.14)", position: "20% 30%", size: "90% 70%" },
      { color: "rgba(80,160,255,0.10)", position: "70% 50%", size: "70% 60%" },
      { color: "rgba(160,80,255,0.08)", position: "50% 70%", size: "50% 50%" },
    ],
    shadowTint: { r: 160, g: 210, b: 200 },
  },
  "desert-dusk": {
    label: "Desert Dusk",
    bg: "#0e0a08",
    blobs: [
      { color: "rgba(229,140,50,0.12)", position: "30% 40%", size: "80% 60%" },
      { color: "rgba(200,80,60,0.08)", position: "70% 50%", size: "60% 70%" },
      { color: "rgba(180,120,200,0.06)", position: "50% 80%", size: "50% 50%" },
    ],
    shadowTint: { r: 210, g: 180, b: 160 },
  },
  "deep-ocean": {
    label: "Deep Ocean",
    bg: "#060a10",
    blobs: [
      { color: "rgba(30,100,200,0.12)", position: "25% 45%", size: "80% 60%" },
      { color: "rgba(20,180,180,0.08)", position: "75% 35%", size: "60% 70%" },
      { color: "rgba(60,60,180,0.06)", position: "50% 75%", size: "50% 50%" },
    ],
    shadowTint: { r: 160, g: 180, b: 220 },
  },
  "tokyo-neon": {
    label: "Tokyo Neon",
    bg: "#0a080e",
    blobs: [
      { color: "rgba(255,50,120,0.10)", position: "20% 40%", size: "70% 60%" },
      { color: "rgba(80,120,255,0.10)", position: "80% 50%", size: "60% 70%" },
      { color: "rgba(255,200,50,0.06)", position: "50% 80%", size: "40% 40%" },
    ],
    shadowTint: { r: 200, g: 170, b: 210 },
  },
  overcast: {
    label: "Overcast",
    bg: "#0a0b0e",
    blobs: [
      { color: "rgba(160,170,190,0.08)", position: "30% 40%", size: "90% 70%" },
      { color: "rgba(140,150,180,0.06)", position: "70% 50%", size: "70% 60%" },
      { color: "rgba(120,130,160,0.04)", position: "50% 80%", size: "50% 50%" },
    ],
    shadowTint: { r: 180, g: 185, b: 195 },
  },
  "jungle-canopy": {
    label: "Jungle Canopy",
    bg: "#080c08",
    blobs: [
      { color: "rgba(40,180,80,0.12)", position: "25% 35%", size: "80% 60%" },
      { color: "rgba(100,200,60,0.08)", position: "75% 55%", size: "60% 70%" },
      { color: "rgba(30,120,100,0.06)", position: "50% 80%", size: "50% 50%" },
    ],
    shadowTint: { r: 170, g: 200, b: 175 },
  },
  volcanic: {
    label: "Volcanic",
    bg: "#0c0808",
    blobs: [
      { color: "rgba(255,80,30,0.12)", position: "30% 50%", size: "80% 60%" },
      { color: "rgba(255,160,40,0.08)", position: "70% 40%", size: "60% 70%" },
      { color: "rgba(200,40,30,0.06)", position: "50% 75%", size: "50% 50%" },
    ],
    shadowTint: { r: 210, g: 175, b: 160 },
  },
};

// ═══════════════════════════════════════════
// THEME CONSTANTS
// ═══════════════════════════════════════════
const COLORS = {
  // Accent palette
  teal: "#3ec8d6",
  gold: "#e5a821",
  coral: "#e06840",
  purple: "#a362e0",
  green: "#4fba5e",
  chartRed: "#d94f63",
  // Background — very deep, near-black with cool undertone
  bg: "#08080c",
  bgAlt: "#0b0b10",
  // Text — LIGHT on dark frost
  textPrimary: "rgba(220,220,235,0.92)",
  textSecondary: "rgba(200,200,220,0.7)",
  textMuted: "rgba(200,200,220,0.55)",
  textFaint: "rgba(200,200,220,0.42)",
  // Light text for use on dark bg directly (section headers etc)
  textOnDark: "#c8c8d6",
  textOnDarkMuted: "#777790",
  // Glass borders
  border: "rgba(255, 255, 255, 0.18)",
  borderSubtle: "rgba(255, 255, 255, 0.10)",
  // Surface hover for drag handle
  surfaceHover: "rgba(255,255,255,0.06)",
};

// ─── Frosted Glass Panels ───
const GLASS = {
  background: "rgba(200,210,220,0.08)",
  backdropFilter: "blur(50px) saturate(1.8) brightness(1.4)",
  WebkitBackdropFilter: "blur(50px) saturate(1.8) brightness(1.4)",
  borderColor: "rgba(255,255,255,0.08)",
  boxShadow: "0 1px 0 0 rgba(255,255,255,0.06), inset 0 1px 0 0 rgba(255,255,255,0.08)",
} as const;

// Inner cards within glass panels
const GLASS_ALT = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  borderColor: "rgba(255,255,255,0.06)",
  boxShadow: "0 1px 0 0 rgba(255,255,255,0.06), inset 0 1px 0 0 rgba(255,255,255,0.08)",
} as const;

// ═══════════════════════════════════════════
// SHADOW FIGURES — Canvas-based background layer
// ═══════════════════════════════════════════
interface ShadowFigure {
  x: number;
  y: number;
  speed: number;
  swayAmplitude: number;
  swayFrequency: number;
  bobAmplitude: number;
  bobFrequency: number;
  brightness: number;
  scale: number;
  phase: number;
}

function initShadowFigures(canvasWidth: number, canvasHeight: number): ShadowFigure[] {
  const count = 7;
  const figures: ShadowFigure[] = [];
  for (let i = 0; i < count; i++) {
    const startOnScreen = i < Math.ceil(count * 0.6);
    figures.push({
      x: startOnScreen
        ? Math.random() * canvasWidth
        : canvasWidth + Math.random() * 400 + 100,
      y: canvasHeight * 0.3 + Math.random() * canvasHeight * 0.5,
      speed: 0.15 + Math.random() * 0.25,
      swayAmplitude: 2 + Math.random() * 2,
      swayFrequency: 0.003 + Math.random() * 0.004,
      bobAmplitude: 3 + Math.random() * 2,
      bobFrequency: 0.004 + Math.random() * 0.003,
      brightness: 0.30 + Math.random() * 0.25,
      scale: 0.7 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return figures;
}

function drawShadowFigures(
  ctx: CanvasRenderingContext2D,
  figures: ShadowFigure[],
  tint: { r: number; g: number; b: number },
  canvasWidth: number,
  canvasHeight: number,
  time: number
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.filter = "blur(30px)";

  const fadeZone = 250;

  for (const fig of figures) {
    const swayX = Math.sin(time * fig.swayFrequency + fig.phase) * fig.swayAmplitude;
    const bobY = Math.sin(time * fig.bobFrequency + fig.phase + 1) * fig.bobAmplitude;
    const cx = fig.x + swayX;
    const cy = fig.y + bobY;

    // Edge fade
    let edgeAlpha = 1;
    if (cx < fadeZone) edgeAlpha = Math.max(0, cx / fadeZone);
    else if (cx > canvasWidth - fadeZone) edgeAlpha = Math.max(0, (canvasWidth - cx) / fadeZone);

    const alpha = fig.brightness * edgeAlpha;
    if (alpha < 0.01) continue;

    const s = fig.scale;
    const r = tint.r;
    const g = tint.g;
    const b = tint.b;

    // Head
    const headRadius = 12 * s;
    const headGrad = ctx.createRadialGradient(cx, cy - 50 * s, 0, cx, cy - 50 * s, headRadius);
    headGrad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.7})`);
    headGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy - 50 * s, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.fill();

    // Torso
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14 * s, 35 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.5})`;
    ctx.fill();

    // Left leg
    ctx.beginPath();
    ctx.ellipse(cx - 6 * s, cy + 45 * s, 6 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.35})`;
    ctx.fill();

    // Right leg
    ctx.beginPath();
    ctx.ellipse(cx + 6 * s, cy + 45 * s, 6 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.35})`;
    ctx.fill();
  }

  ctx.filter = "none";
}

function useShadowFigures(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  tint: { r: number; g: number; b: number }
) {
  const figuresRef = useRef<ShadowFigure[]>([]);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
      if (figuresRef.current.length === 0) {
        figuresRef.current = initShadowFigures(window.innerWidth, window.innerHeight);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      timeRef.current++;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Move figures
      for (const fig of figuresRef.current) {
        fig.x += fig.speed;
        // Wrap around when fully off screen
        if (fig.x > w + 300) {
          fig.x = -200;
          fig.y = h * 0.3 + Math.random() * h * 0.5;
        }
      }

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawShadowFigures(ctx, figuresRef.current, tint, w, h, timeRef.current);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [canvasRef, tint]);
}

// ═══════════════════════════════════════════
// SVG ICON SYSTEM (replacing all emojis)
// ═══════════════════════════════════════════
function AgentIcon({ type, color, size = 18 }: { type: string; color: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 18 18", fill: "none" };

  switch (type) {
    // Lane icons
    case "palette":
      return (
        <svg {...props}>
          <circle cx="9" cy="9" r="7" stroke={color} strokeWidth="1.5" />
          <circle cx="6" cy="7" r="1.5" fill={color} opacity="0.7" />
          <circle cx="11" cy="6" r="1.2" fill={color} opacity="0.5" />
          <circle cx="12" cy="10" r="1" fill={color} opacity="0.8" />
          <circle cx="7" cy="11" r="1.3" fill={color} opacity="0.6" />
        </svg>
      );
    case "heart":
      return (
        <svg {...props}>
          <path d="M9 15s-6-4.35-6-7.5A3.5 3.5 0 0 1 9 5.08 3.5 3.5 0 0 1 15 7.5C15 10.65 9 15 9 15z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...props}>
          <rect x="2" y="6" width="14" height="9" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M6 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke={color} strokeWidth="1.5" />
          <line x1="2" y1="10" x2="16" y2="10" stroke={color} strokeWidth="1.5" opacity="0.4" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props}>
          <polyline points="2,14 6,8 10,11 16,3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="3" r="1.5" fill={color} opacity="0.6" />
        </svg>
      );

    // Agent icons
    case "telescope":
      return (
        <svg {...props}>
          <line x1="3" y1="15" x2="8" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="6" y1="15" x2="8" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <circle cx="11" cy="5" r="4" stroke={color} strokeWidth="1.5" />
          <circle cx="11" cy="5" r="1.5" fill={color} opacity="0.4" />
        </svg>
      );
    case "target":
      return (
        <svg {...props}>
          <circle cx="9" cy="9" r="7" stroke={color} strokeWidth="1.2" />
          <circle cx="9" cy="9" r="4" stroke={color} strokeWidth="1.2" />
          <circle cx="9" cy="9" r="1.5" fill={color} />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="M2 9l14-6-6 14-2-6z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="10" y1="8" x2="8" y2="11" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "gem":
      return (
        <svg {...props}>
          <polygon points="9,2 15,7 9,16 3,7" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="3" y1="7" x2="15" y2="7" stroke={color} strokeWidth="1.2" opacity="0.5" />
          <line x1="9" y1="2" x2="9" y2="16" stroke={color} strokeWidth="1" opacity="0.3" />
        </svg>
      );
    case "person":
      return (
        <svg {...props}>
          <circle cx="9" cy="6" r="3" stroke={color} strokeWidth="1.5" />
          <path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "people":
      return (
        <svg {...props}>
          <circle cx="7" cy="5" r="2.5" stroke={color} strokeWidth="1.3" />
          <path d="M2 15c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="13" cy="6" r="2" stroke={color} strokeWidth="1.2" opacity="0.5" />
          <path d="M12 15c0-2 1-3.5 2.5-4.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    case "handshake":
      return (
        <svg {...props}>
          <path d="M2 9h3l3 3 4-4h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 12l-1 3" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          <path d="M12 8l1-3" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        </svg>
      );
    case "pulse":
      return (
        <svg {...props}>
          <polyline points="1,9 4,9 6,4 8,14 10,6 12,9 17,9" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...props}>
          <rect x="3" y="2" width="12" height="14" rx="2" stroke={color} strokeWidth="1.5" />
          <line x1="6" y1="6" x2="12" y2="6" stroke={color} strokeWidth="1.2" opacity="0.5" />
          <line x1="6" y1="9" x2="11" y2="9" stroke={color} strokeWidth="1.2" opacity="0.4" />
          <line x1="6" y1="12" x2="9" y2="12" stroke={color} strokeWidth="1.2" opacity="0.3" />
        </svg>
      );
    case "scissors":
      return (
        <svg {...props}>
          <circle cx="5" cy="5" r="2.5" stroke={color} strokeWidth="1.3" />
          <circle cx="5" cy="13" r="2.5" stroke={color} strokeWidth="1.3" />
          <line x1="7" y1="6.5" x2="16" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="11.5" x2="16" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...props}>
          <rect x="2" y="4" width="14" height="11" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M2 7h14" stroke={color} strokeWidth="1.2" opacity="0.4" />
          <circle cx="13" cy="11" r="1" fill={color} />
        </svg>
      );
    case "signal":
      return (
        <svg {...props}>
          <rect x="2" y="12" width="2.5" height="4" rx="0.5" fill={color} opacity="0.4" />
          <rect x="5.8" y="9" width="2.5" height="7" rx="0.5" fill={color} opacity="0.6" />
          <rect x="9.6" y="5.5" width="2.5" height="10.5" rx="0.5" fill={color} opacity="0.8" />
          <rect x="13.4" y="2" width="2.5" height="14" rx="0.5" fill={color} />
        </svg>
      );

    // Hub icons
    case "sunrise":
      return (
        <svg {...props}>
          <path d="M1 13h16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 13a6 6 0 0 1 12 0" stroke={color} strokeWidth="1.5" />
          <line x1="9" y1="1" x2="9" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3" y1="5" x2="4.5" y2="6.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <line x1="15" y1="5" x2="13.5" y2="6.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...props}>
          <polygon points="10,1 4,10 8,10 7,17 14,7 10,7" stroke={color} strokeWidth="1.3" strokeLinejoin="round" fill={`${color}15`} />
        </svg>
      );
    case "moon":
      return (
        <svg {...props}>
          <path d="M14 10A6 6 0 1 1 8 4a5 5 0 0 0 6 6z" stroke={color} strokeWidth="1.5" />
        </svg>
      );

    // Misc
    case "hub":
      return (
        <svg {...props}>
          <circle cx="9" cy="9" r="7" stroke={color} strokeWidth="1.5" />
          <circle cx="9" cy="9" r="2.5" fill={color} />
          <path d="M9 2v2M9 14v2M2 9h2M14 9h2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "bars":
      return (
        <svg {...props}>
          <rect x="2" y="10" width="3" height="6" rx="1" fill={color} opacity="0.5" />
          <rect x="7.5" y="6" width="3" height="10" rx="1" fill={color} opacity="0.7" />
          <rect x="13" y="2" width="3" height="14" rx="1" fill={color} />
        </svg>
      );
    case "grip":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="5" cy="3" r="1.2" fill={color} />
          <circle cx="11" cy="3" r="1.2" fill={color} />
          <circle cx="5" cy="8" r="1.2" fill={color} />
          <circle cx="11" cy="8" r="1.2" fill={color} />
          <circle cx="5" cy="13" r="1.2" fill={color} />
          <circle cx="11" cy="13" r="1.2" fill={color} />
        </svg>
      );
    case "clock":
      return (
        <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
          <circle cx="5" cy="5" r="4" stroke={color} strokeWidth="1" />
          <path d="M5 3v2.5l1.5 1" stroke={color} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="9" cy="9" r="7" stroke={color} strokeWidth="1.5" />
          <circle cx="9" cy="9" r="2" fill={color} opacity="0.5" />
        </svg>
      );
  }
}

// ═══════════════════════════════════════════
// AGENT DATA MODEL
// ═══════════════════════════════════════════
type AgentStatus = "active" | "planned" | "paused";

interface Agent {
  id: string;
  name: string;
  codename: string;
  role: string;
  description: string;
  status: AgentStatus;
  schedule?: string;
  icon: string;
}

interface Lane {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  agents: Agent[];
  status: "active" | "planned";
}

const LANES: Lane[] = [
  {
    id: "art",
    name: "Art Advisory",
    color: COLORS.teal,
    icon: "palette",
    description: "Emerging artist scouting, taste learning, HNWI pipeline",
    status: "active",
    agents: [
      {
        id: "art-scout",
        name: "Art Scout",
        codename: "Scout",
        role: "Artist Discovery",
        description: "Finds unsigned emerging artists globally, scores them 0-100 on taste fit, market pricing, upside potential, and show history",
        status: "active",
        schedule: "Weekly (Mon 8 AM)",
        icon: "telescope",
      },
      {
        id: "art-taste",
        name: "Taste Engine",
        codename: "Curator",
        role: "Preference Learning",
        description: "Learns your aesthetic preferences from thumbs up/down feedback, refining future recommendations",
        status: "active",
        schedule: "Continuous",
        icon: "target",
      },
      {
        id: "art-outreach",
        name: "Artist Outreach",
        codename: "Connector",
        role: "Pipeline Management",
        description: "Manages outreach to approved artists — drafts DMs, emails, and schedules intro calls",
        status: "planned",
        icon: "send",
      },
      {
        id: "art-sales",
        name: "HNWI Sales",
        codename: "Dealer",
        role: "Collector Pipeline",
        description: "Prospects high-net-worth collectors and interior designers, matches them with curated artists",
        status: "planned",
        icon: "gem",
      },
    ],
  },
  {
    id: "family",
    name: "Family & Life",
    color: COLORS.gold,
    icon: "heart",
    description: "Siyah, Zoey, Kel'li coordination, wellness tracking",
    status: "active",
    agents: [
      {
        id: "siyah",
        name: "Siyah Agent",
        codename: "Siyah",
        role: "Son (20)",
        description: "Proactively plans activities, conversation topics, and milestone moments. Tracks Saturday calls and bi-weekly visits",
        status: "active",
        schedule: "Saturdays",
        icon: "person",
      },
      {
        id: "zoey",
        name: "Zoey Agent",
        codename: "Zoey",
        role: "Daughter (13)",
        description: "Plans age-appropriate activities, school milestones, conversation starters. Manages near-daily calls and visits",
        status: "active",
        schedule: "Daily",
        icon: "person",
      },
      {
        id: "kelli",
        name: "Kel'li Agent",
        codename: "Sherrene",
        role: "Partner Coordination",
        description: "Improves communication, aligns business goals during the day, plans couple activities and family summits",
        status: "active",
        schedule: "Daily",
        icon: "handshake",
      },
      {
        id: "wellness",
        name: "Wellness",
        codename: "Heath",
        role: "Health & Fitness",
        description: "Tracks Oura ring data, drives dietary decisions, suggests recipes, coordinates exercise planning",
        status: "active",
        schedule: "Daily",
        icon: "pulse",
      },
    ],
  },
  {
    id: "business",
    name: "Business",
    color: COLORS.coral,
    icon: "briefcase",
    description: "Bernard Studia ops, content strategy, distribution",
    status: "planned",
    agents: [
      {
        id: "dot",
        name: "Studio Admin",
        codename: "Dot",
        role: "Business Operations",
        description: "Manages artist pipeline, content clipping campaigns, client relationships, and deal flow for Bernard Studia",
        status: "planned",
        icon: "clipboard",
      },
      {
        id: "content",
        name: "Content Engine",
        codename: "Clip",
        role: "Distribution & Clipping",
        description: "Automates content distribution, manages clipping campaigns, tracks performance metrics across platforms",
        status: "planned",
        icon: "scissors",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    color: COLORS.green,
    icon: "chart",
    description: "Crypto scanning, DCA strategy, budget tracking",
    status: "planned",
    agents: [
      {
        id: "eb",
        name: "Finance Agent",
        codename: "Eb",
        role: "Money & Markets",
        description: "Tracks spending, manages budgets based on inflows/outflows, monitors crypto markets and DCA strategies",
        status: "planned",
        icon: "wallet",
      },
      {
        id: "crypto",
        name: "Crypto Scanner",
        codename: "Alpha",
        role: "Market Intelligence",
        description: "Scans BTC, TAO, LIQ positions, tracks theses, identifies favorable opportunities in the crypto market",
        status: "planned",
        icon: "signal",
      },
    ],
  },
];

// ═══════════════════════════════════════════
// CREDIT USAGE DATA — last 24 hours
// ═══════════════════════════════════════════
interface CreditEntry {
  agentId: string;
  agentName: string;
  icon: string;
  laneColor: string;
  laneName: string;
  creditsUsed: number;
}

const CREDIT_DATA_24H: CreditEntry[] = [
  { agentId: "interactive", agentName: "Interactive Sessions", icon: "hub", laneColor: COLORS.coral, laneName: "System", creditsUsed: 2840 },
  { agentId: "dashboard-build", agentName: "Dashboard Build", icon: "signal", laneColor: COLORS.teal, laneName: "System", creditsUsed: 1200 },
  { agentId: "art-scout", agentName: "Art Scout", icon: "telescope", laneColor: COLORS.teal, laneName: "Art Advisory", creditsUsed: 935 },
  { agentId: "morning", agentName: "Morning Brief", icon: "sunrise", laneColor: COLORS.purple, laneName: "Hub", creditsUsed: 110 },
  { agentId: "evening", agentName: "Evening Review", icon: "moon", laneColor: COLORS.purple, laneName: "Hub", creditsUsed: 85 },
  { agentId: "midday", agentName: "Midday Pulse", icon: "bolt", laneColor: COLORS.purple, laneName: "Hub", creditsUsed: 45 },
  { agentId: "design-critic", agentName: "Design Critic", icon: "telescope", laneColor: COLORS.teal, laneName: "System", creditsUsed: 0 },
  { agentId: "midnight-catalog", agentName: "Midnight Catalog", icon: "clipboard", laneColor: COLORS.teal, laneName: "System", creditsUsed: 25 },
].filter(c => c.creditsUsed > 0);

const TOTAL_CREDITS_24H = CREDIT_DATA_24H.reduce((sum, c) => sum + c.creditsUsed, 0);

// Hub agents (not lane-specific)
const HUB_AGENTS: Agent[] = [
  {
    id: "morning",
    name: "Morning Brief",
    codename: "Dawn",
    role: "Daily Kickoff",
    description: "Full briefing: markets, art radar, schedule, family reminders, top priorities",
    status: "active",
    schedule: "Daily 7:30 AM",
    icon: "sunrise",
  },
  {
    id: "midday",
    name: "Midday Pulse",
    codename: "Pulse",
    role: "Progress Check",
    description: "Market movers, time-sensitive opportunities, afternoon focus, family reminders",
    status: "active",
    schedule: "Daily 12:30 PM",
    icon: "bolt",
  },
  {
    id: "evening",
    name: "Evening Review",
    codename: "Dusk",
    role: "Day Close",
    description: "Day recap, tomorrow preview, family check, weekly reflection on Fridays",
    status: "active",
    schedule: "Daily 8:30 PM",
    icon: "moon",
  },
];

// ═══════════════════════════════════════════
// SVG LOGO
// ═══════════════════════════════════════════
function LifeOSLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="LifeOS Logo">
      <rect x="2" y="2" width="28" height="28" rx="7" stroke={COLORS.teal} strokeWidth="2" />
      <path d="M8 18 L12 14 L15 17 L20 10 L24 16" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="16" r="2" fill={COLORS.teal} />
    </svg>
  );
}

// ═══════════════════════════════════════════
// ANIMATED NUMBER
// ═══════════════════════════════════════════
function AnimatedNumber({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 600;
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <span className="tabular-nums" style={{ color, fontSize: "2.75rem", fontWeight: 700, lineHeight: 1 }}>
      {display}
    </span>
  );
}

// ═══════════════════════════════════════════
// PROGRESS RING
// ═══════════════════════════════════════════
function ProgressRing({ progress, color, size = 40, strokeWidth = 3 }: { progress: number; color: string; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (progress / 100) * circumference);
    }, 400);
    return () => clearTimeout(timer);
  }, [progress, circumference]);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={COLORS.border} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }} />
    </svg>
  );
}

// ═══════════════════════════════════════════
// SPARKLINE
// ═══════════════════════════════════════════
function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="opacity-0 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ═══════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════
function KPICard({ label, value, subtitle, color, ring, sparkData, delay }: { label: string; value: number; subtitle: string; color: string; ring?: number; sparkData?: number[]; delay: number }) {
  return (
    <div className="animate-fade-in-up rounded-xl border p-5 flex flex-col gap-3 relative overflow-hidden transition-colors" style={{ ...GLASS, animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: COLORS.textMuted }}>{label}</span>
        {ring !== undefined && <ProgressRing progress={ring} color={color} size={36} strokeWidth={3} />}
        {sparkData && <Sparkline data={sparkData} color={color} />}
      </div>
      <div className="flex items-baseline gap-2">
        <AnimatedNumber value={value} color={color} delay={delay + 200} />
      </div>
      <span className="text-xs" style={{ color: COLORS.textFaint }}>{subtitle}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════
function StatusBadge({ status, color }: { status: AgentStatus; color: string }) {
  const configs = {
    active: { label: "Active", bg: `${color}18`, text: color, dot: color },
    planned: { label: "Planned", bg: `${COLORS.textFaint}15`, text: COLORS.textFaint, dot: COLORS.textFaint },
    paused: { label: "Paused", bg: `${COLORS.gold}15`, text: COLORS.gold, dot: COLORS.gold },
  };
  const c = configs[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot, boxShadow: status === "active" ? `0 0 6px ${c.dot}60` : "none" }} />
      {c.label}
    </span>
  );
}

// ═══════════════════════════════════════════
// AGENT CARD (individual agent within a lane)
// ═══════════════════════════════════════════
function AgentCard({ agent, laneColor, delay }: { agent: Agent; laneColor: string; delay: number }) {
  return (
    <div
      className="animate-fade-in-up rounded-lg border p-4 flex flex-col gap-2 transition-all duration-200 hover:border-opacity-60 group"
      style={{
        ...GLASS_ALT,
        borderColor: agent.status === "active" ? `${laneColor}30` : COLORS.borderSubtle,
        animationDelay: `${delay}ms`,
      }}
      data-testid={`agent-${agent.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${laneColor}10` }}>
            <AgentIcon type={agent.icon} color={agent.status === "active" ? laneColor : COLORS.textFaint} size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: agent.status === "active" ? COLORS.textPrimary : COLORS.textMuted }}>
                {agent.name}
              </span>
              <StatusBadge status={agent.status} color={laneColor} />
            </div>
            <span className="text-[11px] font-medium" style={{ color: laneColor, opacity: agent.status === "active" ? 1 : 0.5 }}>
              {agent.codename} — {agent.role}
            </span>
          </div>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: COLORS.textFaint }}>
        {agent.description}
      </p>
      {agent.schedule && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <AgentIcon type="clock" color={COLORS.textFaint} size={10} />
          <span className="text-[11px] tabular-nums" style={{ color: COLORS.textFaint }}>{agent.schedule}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SCORE RING (reusable)
// ═══════════════════════════════════════════
function ScoreRing({ score, size = 36 }: { score: number; size?: number }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? COLORS.green : score >= 65 ? COLORS.gold : COLORS.coral;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={COLORS.border} strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={3} strokeDasharray={`${circumference}`} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <span className="absolute text-[11px] font-bold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// ARTIST PIPELINE — GLOBAL SYNC SYSTEM
// ═══════════════════════════════════════════
// JSONBlob IDs
// Pipeline API — proxied via Vercel Edge Functions (JSONBlob lacks CORS)
const SNAPSHOT_BLOB_URL = "/api/pipeline/snapshot";
const WRITE_BLOB_URL = "/api/pipeline/changes";

// Pipeline stages in order
type VettingStage = "Scouted" | "Deep Dive" | "Shortlisted" | "In Conversation" | "Active" | "Declined";
const PIPELINE_STAGES: VettingStage[] = ["Scouted", "Deep Dive", "Shortlisted", "In Conversation", "Active", "Declined"];
const STAGE_COLORS: Record<VettingStage, string> = {
  "Scouted": COLORS.textMuted,
  "Deep Dive": COLORS.teal,
  "Shortlisted": COLORS.gold,
  "In Conversation": COLORS.purple,
  "Active": COLORS.green,
  "Declined": COLORS.chartRed,
};

interface PipelineArtist {
  sheetRow: number;
  dateScouted: string;
  batch: string;
  name: string;
  location: string;
  medium: string;
  score: number;
  priceRange: string;
  whyInteresting: string;
  showsPress: string;
  link: string;
  instagram: string;
  website: string;
  status: VettingStage;
  antRating: string;
  hasDeepDive: boolean;
  deepDive: any | null;
}

// Module-level state — survives React re-renders
let _pipelineArtists: PipelineArtist[] = [];
let _pipelineLoaded = false;
let _lastSyncTime: string | null = null;
// Track local changes that haven't been confirmed by the Sheet yet
const _pendingChanges: Record<string, VettingStage> = {};

async function fetchPipelineSnapshot(): Promise<{ artists: PipelineArtist[]; snapshotAt: string } | null> {
  try {
    // Fetch both snapshot and changes blobs in parallel
    const [snapshotRes, changesRes] = await Promise.all([
      fetch(SNAPSHOT_BLOB_URL, { cache: "no-store", headers: { Accept: "application/json" } }),
      fetch(WRITE_BLOB_URL, { cache: "no-store", headers: { Accept: "application/json" } }),
    ]);
    if (!snapshotRes.ok) return null;
    const data = await snapshotRes.json();
    if (!data.artists || !Array.isArray(data.artists)) return null;

    // Merge persisted changes on top of snapshot so reloads are consistent
    let artists: PipelineArtist[] = data.artists;
    if (changesRes.ok) {
      try {
        const changesData = await changesRes.json();
        const changes: { artistName: string; newStage: VettingStage }[] = Array.isArray(changesData?.changes) ? changesData.changes : [];
        if (changes.length > 0) {
          const changeMap = new Map(changes.map(c => [c.artistName, c.newStage]));
          artists = artists.map(a => {
            const newStatus = changeMap.get(a.name);
            return newStatus ? { ...a, status: newStatus } : a;
          });
        }
      } catch { /* ignore parse errors on changes blob */ }
    }

    return { artists, snapshotAt: data.snapshotAt };
  } catch {
    return null;
  }
}

async function pushStageChange(artistName: string, newStage: VettingStage, sheetRow: number): Promise<boolean> {
  try {
    // Read current write blob
    const readRes = await fetch(WRITE_BLOB_URL, { cache: "no-store", headers: { Accept: "application/json" } });
    const current = readRes.ok ? await readRes.json() : { syncedAt: null, changes: [] };
    
    // Add/update the change
    const changes = Array.isArray(current.changes) ? current.changes : [];
    const existing = changes.findIndex((c: any) => c.artistName === artistName);
    const change = {
      artistName,
      newStage,
      sheetRow,
      changedAt: new Date().toISOString(),
    };
    if (existing >= 0) {
      changes[existing] = change;
    } else {
      changes.push(change);
    }
    
    // Write back
    const writeRes = await fetch(WRITE_BLOB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        syncedAt: new Date().toISOString(),
        changes,
      }),
    });
    return writeRes.ok;
  } catch {
    return false;
  }
}

// Write the full artist list (with current statuses) back to the snapshot blob
// so reloads always reflect the latest state even before the cron reconciles.
async function updateSnapshotBlob(artists: PipelineArtist[]) {
  try {
    await fetch(SNAPSHOT_BLOB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        artists,
        snapshotAt: new Date().toISOString(),
      }),
    });
  } catch { /* fire-and-forget */ }
}

function ScoutedArtistsReview() {
  const [artists, setArtists] = useState<PipelineArtist[]>(_pipelineArtists);
  const [filter, setFilter] = useState<"all" | VettingStage>("all");
  const [expanded, setExpanded] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [changingStage, setChangingStage] = useState<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load artists from JSONBlob on mount
  const loadArtists = useCallback(async (showStatus = true) => {
    if (showStatus) {
      setSyncing(true);
      setSyncStatus("syncing");
    }
    const snapshot = await fetchPipelineSnapshot();
    if (snapshot && snapshot.artists.length > 0) {
      // Apply any pending local changes on top of snapshot
      const merged = snapshot.artists.map(a => ({
        ...a,
        status: (_pendingChanges[a.name] || a.status) as VettingStage,
      }));
      _pipelineArtists = merged;
      _lastSyncTime = snapshot.snapshotAt;
      _pipelineLoaded = true;
      setArtists(merged);
      if (showStatus) setSyncStatus("success");
    } else if (!_pipelineLoaded) {
      // Fallback — keep empty state but mark as loaded
      _pipelineLoaded = true;
      if (showStatus) setSyncStatus("error");
    }
    if (showStatus) {
      setSyncing(false);
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  }, []);

  useEffect(() => {
    if (!_pipelineLoaded) {
      loadArtists(true);
    }
    // Auto-sync every 5 minutes
    syncIntervalRef.current = setInterval(() => {
      loadArtists(false);
    }, 5 * 60 * 1000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [loadArtists]);

  const handleStageChange = async (artist: PipelineArtist, newStage: VettingStage) => {
    if (artist.status === newStage) return;
    setChangingStage(artist.name);
    
    // Optimistic update
    _pendingChanges[artist.name] = newStage;
    const updated = artists.map(a =>
      a.name === artist.name ? { ...a, status: newStage } : a
    );
    _pipelineArtists = updated;
    setArtists(updated);
    
    // Push change to changes blob
    const ok = await pushStageChange(artist.name, newStage, artist.sheetRow);
    if (!ok) {
      // Revert on failure
      delete _pendingChanges[artist.name];
      const reverted = artists.map(a =>
        a.name === artist.name ? { ...a, status: artist.status } : a
      );
      _pipelineArtists = reverted;
      setArtists(reverted);
    } else {
      // Also update snapshot blob so it stays in sync for next reload
      updateSnapshotBlob(_pipelineArtists);
    }
    setChangingStage(null);
  };

  const filtered = filter === "all" ? artists : artists.filter(a => a.status === filter);
  
  // Count by stage
  const counts: Record<string, number> = { all: artists.length };
  for (const stage of PIPELINE_STAGES) {
    counts[stage] = artists.filter(a => a.status === stage).length;
  }

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return "never";
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return d.toLocaleDateString();
    } catch {
      return "unknown";
    }
  };

  // Stage selector dropdown for an artist — uses fixed positioning to escape overflow:hidden parents
  const StageSelector = ({ artist }: { artist: PipelineArtist }) => {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (btnRef.current?.contains(e.target as Node)) return;
        if (menuRef.current?.contains(e.target as Node)) return;
        setOpen(false);
      };
      if (open) document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    useEffect(() => {
      if (open && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, left: rect.left });
      }
    }, [open]);

    return (
      <>
        <button
          ref={btnRef}
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-all duration-200 hover:bg-white/[0.04]"
          style={{
            borderColor: `${STAGE_COLORS[artist.status]}40`,
            color: STAGE_COLORS[artist.status],
            background: `${STAGE_COLORS[artist.status]}10`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLORS[artist.status] }} />
          {artist.status}
          {changingStage === artist.name ? (
            <span className="animate-spin text-[10px]">&#9696;</span>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        {open && menuPos && ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="fixed rounded-lg border py-1 min-w-[160px] shadow-xl"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              zIndex: 9999,
              background: "rgba(20,20,30,0.97)",
              borderColor: COLORS.border,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {PIPELINE_STAGES.map(stage => (
              <button
                key={stage}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageChange(artist, stage);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors hover:bg-white/[0.06]"
                style={{ color: artist.status === stage ? STAGE_COLORS[stage] : COLORS.textSecondary }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[stage], opacity: artist.status === stage ? 1 : 0.5 }} />
                {stage}
                {artist.status === stage && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-auto">
                    <path d="M2 6L5 9L10 3" stroke={STAGE_COLORS[stage]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
      </>
    );
  };

  // Helper to extract clean URL from markdown-style links like "[Source](url)"
  const extractUrl = (raw: string) => {
    if (!raw) return "";
    const m = raw.match(/\]\((https?:\/\/[^)]+)\)/);
    return m ? m[1] : raw.startsWith("http") ? raw : "";
  };

  // Solid card style for better readability (replaces frosted glass in slide-out)
  const SOLID_CARD = {
    background: "rgba(18,18,28,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
  } as const;

  // Parse representation status from deep dive data
  const getRepresentation = (artist: PipelineArtist): { status: "unrepresented" | "represented" | "unknown"; detail: string } => {
    const dd = artist.deepDive;
    if (!dd) return { status: "unknown", detail: "Pending research" };

    // Check for representation field if it exists
    if (dd.representation) {
      const r = dd.representation;
      if (typeof r === "string") {
        const lower = r.toLowerCase();
        if (lower.includes("unrep") || lower === "none" || lower === "unrepresented") return { status: "unrepresented", detail: r };
        if (lower.includes("self") || lower.includes("independent")) return { status: "unrepresented", detail: r };
        return { status: "represented", detail: r };
      }
      if (r.status) return { status: r.status === "unrepresented" ? "unrepresented" : "represented", detail: r.detail || r.galleries?.join(", ") || String(r.status) };
    }

    // Fallback: scan deep dive text for gallery representation signals
    const allText = JSON.stringify(dd);
    const repGalleries: string[] = [];
    // Known major galleries
    const majorGalleries = [
      "Jeffrey Deitch", "Gagosian", "Pace", "Hauser & Wirth", "David Zwirner",
      "Ghebaly", "Night Gallery", "Marianne Boesky", "Lehmann Maupin",
      "Perrotin", "Lisson", "White Cube", "Gladstone", "Petzel",
      "Casey Kaplan", "Jack Shainman", "Sean Kelly", "Ross-Sutton",
    ];
    for (const g of majorGalleries) {
      if (allText.includes(g)) repGalleries.push(g);
    }

    // Check for explicit "represented by" language
    const repMatch = allText.match(/represent(?:ed|s|ing)?\s+(?:by\s+)?([A-Z][^.,;"]{3,40})/i);
    if (repMatch) {
      const gallery = repMatch[1].trim();
      if (!gallery.toLowerCase().includes("trauma") && !gallery.toLowerCase().includes("communit")) {
        if (!repGalleries.includes(gallery)) repGalleries.push(gallery);
      }
    }

    if (repGalleries.length > 0) {
      return { status: "represented", detail: repGalleries.join(", ") + " (from exhibition/press data — verify)" };
    }
    return { status: "unknown", detail: "No gallery representation found in research — likely unrepresented" };
  };

  // ── Full slide-out deep dive panel ──
  const DeepDiveSlideOut = ({ artist, onClose }: { artist: PipelineArtist; onClose: () => void }) => {
    const dd = artist.deepDive;
    const stageIndex = (PIPELINE_STAGES.filter(s => s !== "Declined") as string[]).indexOf(artist.status);
    const stages = ["Scouted", "Deep Dive", "Shortlisted", "In Conversation"] as VettingStage[];
    const rep = getRepresentation(artist);

    // Next stage for the CTA button
    const nextStageMap: Partial<Record<VettingStage, VettingStage>> = {
      "Scouted": "Deep Dive",
      "Deep Dive": "Shortlisted",
      "Shortlisted": "In Conversation",
      "In Conversation": "Active",
    };
    const nextStage = nextStageMap[artist.status];
    const nextLabel = nextStage ? `Move to ${nextStage}` : null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[100] transition-opacity duration-300"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        />
        {/* Panel */}
        <div
          className="fixed top-0 right-0 z-[101] overflow-y-auto"
          style={{
            width: "min(520px, 90vw)",
            height: "100vh",
            background: "rgba(12,12,18,0.97)",
            backdropFilter: "blur(40px) saturate(1.6)",
            borderLeft: `1px solid ${COLORS.borderSubtle}`,
            boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
            animation: "slideInRight 0.3s ease-out",
          }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 px-6 pt-6 pb-4" style={{ background: "rgba(12,12,18,0.95)", borderBottom: `1px solid ${COLORS.borderSubtle}` }}>
            <div className="flex items-start gap-4">
              <ScoreRing score={artist.score} size={56} />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>{artist.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[13px]" style={{ color: COLORS.textMuted }}>{artist.location}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: `${STAGE_COLORS[artist.status]}15`, color: STAGE_COLORS[artist.status], border: `1px solid ${STAGE_COLORS[artist.status]}30` }}>
                    {artist.status}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors hover:bg-white/[0.06]"
                style={{ borderColor: COLORS.borderSubtle }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M11 3L3 11" stroke={COLORS.textMuted} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Stage progress bar */}
            <div className="mt-4 flex items-center gap-0">
              {stages.map((stage, i) => {
                const isActive = i <= stageIndex;
                const isCurrent = stage === artist.status;
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full h-[3px] rounded-full transition-all duration-500"
                      style={{
                        background: isActive ? STAGE_COLORS[stage] : COLORS.borderSubtle,
                        opacity: isActive ? 1 : 0.4,
                      }}
                    />
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: isCurrent ? STAGE_COLORS[stage] : isActive ? COLORS.textMuted : COLORS.textFaint }}
                    >
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body content */}
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* REPRESENTATION STATUS — primary callout */}
            <div className="rounded-lg p-4 flex items-start gap-3" style={{
              ...SOLID_CARD,
              borderColor: rep.status === "unrepresented" ? `${COLORS.green}25` : rep.status === "represented" ? `${COLORS.coral}25` : `${COLORS.gold}25`,
            }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{
                background: rep.status === "unrepresented" ? `${COLORS.green}15` : rep.status === "represented" ? `${COLORS.coral}15` : `${COLORS.gold}15`,
              }}>
                {rep.status === "unrepresented" ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 8l3 3 5-6" stroke={COLORS.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : rep.status === "represented" ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke={COLORS.coral} strokeWidth="1.8" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5" stroke={COLORS.gold} strokeWidth="1.5" /><path d="M8 5.5v3M8 10.5v.5" stroke={COLORS.gold} strokeWidth="1.5" strokeLinecap="round" /></svg>
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase mb-1" style={{
                  color: rep.status === "unrepresented" ? COLORS.green : rep.status === "represented" ? COLORS.coral : COLORS.gold,
                }}>
                  {rep.status === "unrepresented" ? "Unrepresented" : rep.status === "represented" ? "Represented" : "Representation Unknown"}
                </div>
                <div className="text-[12px] leading-relaxed" style={{ color: COLORS.textSecondary }}>{rep.detail}</div>
              </div>
            </div>

            {/* ARTIST PROFILE card */}
            <div className="rounded-lg p-5" style={{ ...SOLID_CARD, borderColor: `${COLORS.teal}18` }}>
              <div className="flex items-center gap-2 mb-4">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke={COLORS.teal} strokeWidth="1.3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={COLORS.teal} strokeWidth="1.3" strokeLinecap="round" /></svg>
                <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: COLORS.teal }}>Artist Profile</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <div className="text-[11px] font-medium mb-0.5" style={{ color: COLORS.textFaint }}>Medium</div>
                  <div className="text-[13px]" style={{ color: COLORS.textPrimary }}>{artist.medium}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium mb-0.5" style={{ color: COLORS.textFaint }}>Price Range</div>
                  <div className="text-[13px] font-medium" style={{ color: COLORS.gold }}>{artist.priceRange}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium mb-0.5" style={{ color: COLORS.textFaint }}>Shows / Press</div>
                  <div className="text-[13px]" style={{ color: COLORS.textPrimary }}>{artist.showsPress || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium mb-0.5" style={{ color: COLORS.textFaint }}>Batch</div>
                  <div className="text-[13px]" style={{ color: COLORS.textPrimary }}>{artist.batch} — {artist.dateScouted}</div>
                </div>
              </div>
              {/* Why Interesting */}
              <div className="mt-4 text-[12px] leading-relaxed" style={{ color: COLORS.textMuted }}>
                {artist.whyInteresting}
              </div>
            </div>

            {/* ENRICHMENT — only show if deep dive data exists */}
            {dd ? (
              <>
                {/* Alignment Assessment */}
                {dd.characterSignals?.overallAlignment && (
                  <div className="rounded-lg border p-5" style={{ ...SOLID_CARD, borderColor: `${COLORS.teal}12` }}>
                    <div className="text-[11px] font-bold tracking-wider uppercase mb-3" style={{ color: COLORS.teal }}>Alignment Assessment</div>
                    <p className="text-[12px] leading-relaxed" style={{ color: COLORS.textSecondary }}>
                      {String(dd.characterSignals.overallAlignment)}
                    </p>
                  </div>
                )}

                {/* Character Signals grid */}
                {dd.characterSignals && (
                  <div className="rounded-lg border p-5" style={{ ...SOLID_CARD, borderColor: `${COLORS.purple}12` }}>
                    <div className="text-[11px] font-bold tracking-wider uppercase mb-3" style={{ color: COLORS.purple }}>Character Signals</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {Object.entries(dd.characterSignals).filter(([k]) => k !== "overallAlignment").map(([key, val]) => (
                        <div key={key}>
                          <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: COLORS.textFaint }}>
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <p className="text-[11px] leading-snug" style={{ color: COLORS.textMuted }}>
                            {String(val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PRESS & INTERVIEWS */}
                {dd.pressClippings && dd.pressClippings.length > 0 && (
                  <div className="rounded-lg border p-5" style={{ ...SOLID_CARD, borderColor: `${COLORS.gold}12` }}>
                    <div className="flex items-center gap-2 mb-4">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke={COLORS.gold} strokeWidth="1.2" /><path d="M4 5h6M4 7.5h4" stroke={COLORS.gold} strokeWidth="1" strokeLinecap="round" /></svg>
                      <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: COLORS.gold }}>Press & Interviews</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${COLORS.gold}15`, color: COLORS.gold }}>{dd.pressClippings.length}</span>
                    </div>
                    <div className="flex flex-col gap-4">
                      {dd.pressClippings.map((clip: any, i: number) => {
                        const cleanUrl = extractUrl(clip.url || "");
                        return (
                          <div key={i} className="pb-4" style={{ borderBottom: i < dd.pressClippings.length - 1 ? `1px solid ${COLORS.borderSubtle}` : "none" }}>
                            <div className="flex items-start gap-2 mb-1">
                              <span className="text-[13px] font-semibold" style={{ color: COLORS.textPrimary }}>{clip.title || "Article"}</span>
                              {cleanUrl && (
                                <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 mt-0.5">
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3.5 1.5H10.5V8.5M10.5 1.5L1.5 10.5" stroke={COLORS.textFaint} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[11px] font-semibold" style={{ color: COLORS.purple }}>{clip.source || "Source"}</span>
                              {clip.date && <span className="text-[11px]" style={{ color: COLORS.textFaint }}>{clip.date}</span>}
                            </div>
                            {clip.excerpt && (
                              <p className="text-[11px] leading-relaxed mb-2" style={{ color: COLORS.textMuted }}>{clip.excerpt}</p>
                            )}
                            {clip.relevance && (
                              <p className="text-[11px] leading-relaxed" style={{ color: COLORS.gold, fontStyle: "italic" }}>{clip.relevance}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Red Flags */}
                {dd.redFlags && dd.redFlags.length > 0 && dd.redFlags[0] && (
                  <div className="rounded-lg border p-5" style={{ ...SOLID_CARD, borderColor: `${COLORS.chartRed}15` }}>
                    <div className="text-[11px] font-bold tracking-wider uppercase mb-2" style={{ color: COLORS.chartRed }}>Red Flags</div>
                    {dd.redFlags.filter(Boolean).map((flag: string, i: number) => (
                      <p key={i} className="text-[11px] leading-relaxed" style={{ color: COLORS.textMuted }}>{flag}</p>
                    ))}
                  </div>
                )}

                {/* Exhibition History */}
                {dd.fullExhibitionHistory && dd.fullExhibitionHistory.length > 0 && (
                  <div className="rounded-lg border p-5" style={{ ...SOLID_CARD, borderColor: COLORS.borderSubtle }}>
                    <div className="text-[11px] font-bold tracking-wider uppercase mb-3" style={{ color: COLORS.textMuted }}>Exhibition History</div>
                    <div className="flex flex-col gap-1">
                      {dd.fullExhibitionHistory.map((show: string, i: number) => (
                        <p key={i} className="text-[11px] leading-snug" style={{ color: COLORS.textFaint }}>{show}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Artist Statement */}
                {dd.artistStatement && (
                  <div className="rounded-lg border p-5" style={{ ...SOLID_CARD, borderColor: COLORS.borderSubtle }}>
                    <div className="text-[11px] font-bold tracking-wider uppercase mb-2" style={{ color: COLORS.textMuted }}>Artist Statement</div>
                    <p className="text-[12px] leading-relaxed" style={{ color: COLORS.textSecondary, fontStyle: "italic" }}>{dd.artistStatement}</p>
                  </div>
                )}
              </>
            ) : (
              /* Loading / Researching state */
              <div className="rounded-lg border p-8 flex flex-col items-center justify-center gap-3" style={{ ...SOLID_CARD, borderColor: COLORS.borderSubtle }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="animate-spin" style={{ animationDuration: "2s" }}>
                  <circle cx="16" cy="16" r="12" stroke={COLORS.borderSubtle} strokeWidth="3" />
                  <path d="M16 4a12 12 0 0 1 12 12" stroke={COLORS.purple} strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="text-[13px] font-medium" style={{ color: COLORS.purple }}>Researching artist...</span>
                <span className="text-[11px]" style={{ color: COLORS.textFaint }}>Gathering press clippings, interviews, and character signals</span>
              </div>
            )}
          </div>

          {/* Bottom action bar — sticky */}
          <div className="sticky bottom-0 px-6 py-4 flex items-center gap-3" style={{ background: "rgba(12,12,18,0.95)", borderTop: `1px solid ${COLORS.borderSubtle}` }}>
            {/* Instagram + Website links — show both when available */}
            {(() => {
              const igUrl = artist.instagram || (artist.link?.includes("instagram") ? artist.link.split(" | ")[0] : "");
              const webUrl = artist.website || (artist.link && !artist.link.includes("instagram") ? artist.link.split(" | ")[0] : artist.link?.split(" | ").find((u: string) => !u.includes("instagram")) || "");
              return (
                <>
                  {igUrl && (
                    <a
                      href={igUrl.startsWith("http") ? igUrl : `https://www.instagram.com/${igUrl.replace(/^@/, "")}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[12px] font-medium transition-all duration-200 hover:bg-white/[0.04]"
                      style={{ borderColor: COLORS.borderSubtle, color: COLORS.textMuted }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" /></svg>
                      Instagram
                    </a>
                  )}
                  {webUrl && !webUrl.includes("instagram") && (
                    <a
                      href={webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[12px] font-medium transition-all duration-200 hover:bg-white/[0.04]"
                      style={{ borderColor: COLORS.borderSubtle, color: COLORS.textMuted }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" /><ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeWidth="1.8" /><path d="M2 12h20" stroke="currentColor" strokeWidth="1.8" /></svg>
                      Portfolio
                    </a>
                  )}
                </>
              );
            })()}
            <div className="flex-1" />
            {/* Move to next stage CTA */}
            {nextLabel && artist.status !== "Declined" && (
              <button
                onClick={() => { handleStageChange(artist, nextStage!); onClose(); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-200 hover:brightness-110"
                style={{
                  background: `linear-gradient(135deg, ${STAGE_COLORS[nextStage!]}, ${STAGE_COLORS[nextStage!]}cc)`,
                  color: "#fff",
                  boxShadow: `0 2px 12px ${STAGE_COLORS[nextStage!]}40`,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {nextLabel}
              </button>
            )}
            {/* Decline button */}
            {artist.status !== "Declined" && (
              <button
                onClick={() => { handleStageChange(artist, "Declined"); onClose(); }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-[11px] font-medium transition-all duration-200 hover:bg-red-500/10"
                style={{ borderColor: `${COLORS.chartRed}30`, color: COLORS.chartRed }}
              >
                Decline
              </button>
            )}
          </div>
        </div>

        {/* Slide-in animation keyframe — injected once */}
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </>
    );
  };

  return (
    <div className="mx-4 mb-3 rounded-lg border overflow-hidden" style={{ ...GLASS_ALT, borderColor: `${COLORS.teal}20` }}>
      {/* Section header with sync button */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2.5 transition-colors hover:opacity-80"
        >
          <AgentIcon type="telescope" color={COLORS.teal} size={14} />
          <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: COLORS.teal }}>Artist Pipeline</span>
          <span className="text-[11px] tabular-nums px-1.5 py-px rounded-full" style={{ background: `${COLORS.teal}15`, color: COLORS.teal }}>{artists.length}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            <path d="M3 5.5L7 9.5L11 5.5" stroke={COLORS.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        
        {/* Sync controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums" style={{ color: COLORS.textFaint }}>
            {syncStatus === "syncing" ? "syncing..." : `synced ${formatSyncTime(_lastSyncTime)}`}
          </span>
          <button
            onClick={() => loadArtists(true)}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium transition-all duration-200 hover:bg-white/[0.04]"
            style={{
              borderColor: syncStatus === "success" ? `${COLORS.green}40` : syncStatus === "error" ? `${COLORS.chartRed}40` : COLORS.borderSubtle,
              color: syncStatus === "success" ? COLORS.green : syncStatus === "error" ? COLORS.chartRed : COLORS.textMuted,
              opacity: syncing ? 0.5 : 1,
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 16 16" fill="none"
              className={syncing ? "animate-spin" : ""}
              style={{ animationDuration: "1s" }}
            >
              <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M8 2L10.5 4.5M8 2L5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sync
          </button>
        </div>
      </div>

      {/* Expandable content */}
      <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: expanded ? "6000px" : "0px", opacity: expanded ? 1 : 0 }}>
        {/* Pipeline stage summary bar */}
        <div className="mx-4 mb-2 flex items-center gap-[2px] h-2 rounded-full overflow-hidden" style={{ background: COLORS.borderSubtle }}>
          {PIPELINE_STAGES.filter(s => counts[s] > 0).map(stage => (
            <div
              key={stage}
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(counts[stage] / artists.length) * 100}%`,
                background: STAGE_COLORS[stage],
                opacity: 0.8,
                minWidth: counts[stage] > 0 ? "4px" : "0",
              }}
              title={`${stage}: ${counts[stage]}`}
            />
          ))}
        </div>

        {/* Filter tabs — pipeline stages */}
        <div className="flex items-center gap-1 px-4 pb-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
            style={{
              background: filter === "all" ? `${COLORS.teal}15` : "transparent",
              color: filter === "all" ? COLORS.teal : COLORS.textFaint,
            }}
          >
            All {counts.all > 0 && <span className="tabular-nums ml-0.5">({counts.all})</span>}
          </button>
          {PIPELINE_STAGES.map(stage => (
            counts[stage] > 0 && (
              <button
                key={stage}
                onClick={() => setFilter(stage)}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                style={{
                  background: filter === stage ? `${STAGE_COLORS[stage]}15` : "transparent",
                  color: filter === stage ? STAGE_COLORS[stage] : COLORS.textFaint,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLORS[stage], opacity: filter === stage ? 1 : 0.5 }} />
                {stage}
                <span className="tabular-nums">({counts[stage]})</span>
              </button>
            )
          ))}
        </div>

        {/* Artist cards */}
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {filtered.length === 0 && (
            <div className="text-center py-6 text-[11px]" style={{ color: COLORS.textFaint }}>
              {syncing ? "Loading artists..." : "No artists in this stage"}
            </div>
          )}
          {filtered.map((artist) => (
            <div
              key={`${artist.name}-${artist.sheetRow}`}
              className="rounded-lg border p-3 transition-all duration-200 group"
              style={{
                ...GLASS_ALT,
                borderColor: artist.status === "Active" ? `${COLORS.green}30` : artist.status === "Declined" ? `${COLORS.chartRed}20` : artist.status === "Shortlisted" ? `${COLORS.gold}20` : artist.status === "Deep Dive" ? `${COLORS.teal}20` : COLORS.borderSubtle,
                opacity: artist.status === "Declined" ? 0.5 : 1,
              }}
            >
              <div className="flex gap-3">
                {/* Score ring */}
                <div className="flex-shrink-0 pt-0.5">
                  <ScoreRing score={artist.score} size={40} />
                </div>

                {/* Artist info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: COLORS.textPrimary }}>{artist.name}</span>
                    <span className="text-[11px]" style={{ color: COLORS.textFaint }}>{artist.location}</span>
                    <StageSelector artist={artist} />
                    {artist.hasDeepDive && (
                      <span className="text-[10px] px-1.5 py-px rounded" style={{ background: `${COLORS.teal}10`, color: COLORS.teal }}>enriched</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium" style={{ color: COLORS.teal }}>{artist.medium}</span>
                    <span className="text-[11px] tabular-nums" style={{ color: COLORS.gold }}>{artist.priceRange}</span>
                    <span className="text-[10px]" style={{ color: COLORS.textFaint }}>{artist.batch}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed mb-1" style={{ color: COLORS.textMuted }}>{artist.whyInteresting}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: COLORS.textFaint }}>{artist.showsPress}</span>
                  </div>
                  {/* External links — show both IG and website when available */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {(() => {
                      const igUrl = artist.instagram || (artist.link?.includes("instagram") ? artist.link.split(" | ")[0] : "");
                      const webUrl = artist.website || (artist.link && !artist.link.includes("instagram") ? artist.link.split(" | ")[0] : artist.link?.split(" | ").find((u: string) => !u.includes("instagram")) || "");
                      return (
                        <>
                          {igUrl && (
                            <a
                              href={igUrl.startsWith("http") ? igUrl : `https://www.instagram.com/${igUrl.replace(/^@/, "")}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center w-7 h-7 rounded-md border transition-all duration-200 hover:border-white/20 hover:bg-white/[0.04]"
                              style={{ borderColor: COLORS.borderSubtle }}
                              title="Instagram"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                <rect x="2" y="2" width="20" height="20" rx="5" stroke={COLORS.textFaint} strokeWidth="1.8" />
                                <circle cx="12" cy="12" r="5" stroke={COLORS.textFaint} strokeWidth="1.8" />
                                <circle cx="17.5" cy="6.5" r="1.2" fill={COLORS.textFaint} />
                              </svg>
                            </a>
                          )}
                          {webUrl && !webUrl.includes("instagram") && (
                            <a
                              href={webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center w-7 h-7 rounded-md border transition-all duration-200 hover:border-white/20 hover:bg-white/[0.04]"
                              style={{ borderColor: COLORS.borderSubtle }}
                              title="Portfolio"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke={COLORS.textFaint} strokeWidth="1.8" />
                                <ellipse cx="12" cy="12" rx="4" ry="10" stroke={COLORS.textFaint} strokeWidth="1.8" />
                                <path d="M2 12h20" stroke={COLORS.textFaint} strokeWidth="1.8" />
                              </svg>
                            </a>
                          )}
                        </>
                      );
                    })()}
                    {/* Open deep dive slide-out */}
                    {(artist.hasDeepDive || artist.status === "Deep Dive") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedArtist(artist.name); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-all duration-200 hover:bg-white/[0.04]"
                        style={{ borderColor: `${COLORS.teal}30`, color: COLORS.teal }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1 3.5h8M1 5.5h6M1 7.5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                        </svg>
                        Deep Dive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View on Google Sheets */}
        <div className="px-4 pb-3">
          <a
            href="https://docs.google.com/spreadsheets/d/1LiCWtcIa5cUzUamwg3Q12lrCft9YbDnV89Gcs-dODY8/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border text-[11px] font-medium transition-colors hover:bg-white/[0.03]"
            style={{ borderColor: COLORS.borderSubtle, color: COLORS.textMuted }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3.5 1.5H10.5V8.5M10.5 1.5L1.5 10.5" stroke={COLORS.textMuted} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            View full Art Scout Master Sheet
          </a>
        </div>
      </div>

      {/* Deep Dive Slide-Out — rendered as portal-like overlay */}
      {expandedArtist && (() => {
        const a = artists.find(x => x.name === expandedArtist);
        return a ? <DeepDiveSlideOut artist={a} onClose={() => setExpandedArtist(null)} /> : null;
      })()}
    </div>
  );
}


// ═══════════════════════════════════════════
// LANE GROUP (visual grouping of agents by lane)
// ═══════════════════════════════════════════
function LaneGroup({ lane, delay }: { lane: Lane; delay: number }) {
  const activeCount = lane.agents.filter(a => a.status === "active").length;
  const totalCount = lane.agents.length;

  return (
    <div
      className="animate-fade-in-up rounded-xl border overflow-hidden"
      style={{
        ...GLASS,
        borderColor: lane.status === "active" ? `${lane.color}25` : COLORS.border,
        animationDelay: `${delay}ms`,
      }}
      data-testid={`lane-${lane.id}`}
    >
      {/* Lane header with colored accent bar */}
      <div className="relative px-5 pt-5 pb-3">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(to right, ${lane.color}, ${lane.color}40)` }} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: `${lane.color}12` }}>
              <AgentIcon type={lane.icon} color={lane.color} size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold" style={{ color: lane.color }}>{lane.name}</h3>
                {lane.status === "planned" && (
                  <span className="text-[11px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${COLORS.textFaint}15`, color: COLORS.textFaint }}>
                    Coming Soon
                  </span>
                )}
              </div>
              <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{lane.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums font-medium" style={{ color: lane.color }}>
              {activeCount}/{totalCount}
            </span>
            <ProgressRing progress={(activeCount / totalCount) * 100} color={lane.color} size={28} strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Agent cards grid */}
      <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {lane.agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} laneColor={lane.color} delay={delay + 100 + i * 60} />
        ))}
      </div>

      {/* Scouted artists review — Art Advisory lane only */}
      {lane.id === "art" && <ScoutedArtistsReview />}

      {/* Family ideas pipeline — Family lane only */}
      {lane.id === "family" && <FamilyIdeasPipeline />}

      {/* Collapsible deliverables */}
      <DeliverablesList laneName={lane.name} laneColor={lane.color} />
    </div>
  );
}


// ═══════════════════════════════════════════
// FAMILY IDEAS PIPELINE — GLOBAL SYNC SYSTEM
// ═══════════════════════════════════════════
const FAMILY_SNAPSHOT_URL = "/api/family/snapshot";
const FAMILY_CHANGES_URL = "/api/family/changes";

type FamilyIdeaStage = "Idea" | "Approved" | "Planned" | "Done" | "Declined";
const FAMILY_STAGES: FamilyIdeaStage[] = ["Idea", "Approved", "Planned", "Done", "Declined"];
const FAMILY_STAGE_COLORS: Record<FamilyIdeaStage, string> = {
  "Idea": COLORS.textMuted,
  "Approved": COLORS.teal,
  "Planned": COLORS.gold,
  "Done": COLORS.green,
  "Declined": COLORS.chartRed,
};

type FamilyPerson = "Siyah" | "Zoey" | "Kel'li" | "Family";
const FAMILY_PEOPLE: FamilyPerson[] = ["Siyah", "Zoey", "Kel'li", "Family"];
const PERSON_COLORS: Record<FamilyPerson, string> = {
  "Siyah": COLORS.teal,
  "Zoey": COLORS.purple,
  "Kel'li": COLORS.coral,
  "Family": COLORS.gold,
};

interface FamilyIdea {
  id: string;
  title: string;
  description: string;
  type: string;
  person: FamilyPerson;
  status: FamilyIdeaStage;
  addedAt: string;
  notes: string;
  budget: string;
  dueDate: string;
}

let _familyIdeas: FamilyIdea[] = [];
let _familyLoaded = false;
let _familyLastSync: string | null = null;

async function fetchFamilySnapshot(): Promise<{ ideas: FamilyIdea[]; snapshotAt: string } | null> {
  try {
    const [snapshotRes, changesRes] = await Promise.all([
      fetch(FAMILY_SNAPSHOT_URL, { cache: "no-store", headers: { Accept: "application/json" } }),
      fetch(FAMILY_CHANGES_URL, { cache: "no-store", headers: { Accept: "application/json" } }),
    ]);
    if (!snapshotRes.ok) return null;
    const data = await snapshotRes.json();
    if (!data.ideas || !Array.isArray(data.ideas)) return null;

    let ideas: FamilyIdea[] = data.ideas;
    if (changesRes.ok) {
      try {
        const changesData = await changesRes.json();
        const changes: any[] = Array.isArray(changesData?.changes) ? changesData.changes : [];
        if (changes.length > 0) {
          const statusMap = new Map(changes.filter((c: any) => c.type === "status").map((c: any) => [c.ideaId, c.newStage]));
          const newIdeas: FamilyIdea[] = changes.filter((c: any) => c.type === "add").map((c: any) => c.idea);
          ideas = ideas.map(i => {
            const newStatus = statusMap.get(i.id);
            return newStatus ? { ...i, status: newStatus } : i;
          });
          const existingIds = new Set(ideas.map(i => i.id));
          for (const ni of newIdeas) {
            if (!existingIds.has(ni.id)) ideas.push(ni);
          }
        }
      } catch { /* ignore */ }
    }

    return { ideas, snapshotAt: data.snapshotAt };
  } catch {
    return null;
  }
}

async function pushFamilyChange(change: any): Promise<boolean> {
  try {
    const readRes = await fetch(FAMILY_CHANGES_URL, { cache: "no-store", headers: { Accept: "application/json" } });
    const current = readRes.ok ? await readRes.json() : { syncedAt: null, changes: [] };
    const changes = Array.isArray(current.changes) ? current.changes : [];

    if (change.type === "status") {
      const existing = changes.findIndex((c: any) => c.type === "status" && c.ideaId === change.ideaId);
      if (existing >= 0) changes[existing] = change;
      else changes.push(change);
    } else {
      changes.push(change);
    }

    const writeRes = await fetch(FAMILY_CHANGES_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ syncedAt: new Date().toISOString(), changes }),
    });
    return writeRes.ok;
  } catch {
    return false;
  }
}

async function updateFamilySnapshotBlob(ideas: FamilyIdea[]) {
  try {
    await fetch(FAMILY_SNAPSHOT_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ideas, snapshotAt: new Date().toISOString() }),
    });
  } catch { /* fire-and-forget */ }
}

function FamilyIdeasPipeline() {
  const [ideas, setIdeas] = useState<FamilyIdea[]>(_familyIdeas);
  const [filter, setFilter] = useState<"all" | FamilyIdeaStage>("all");
  const [personFilter, setPersonFilter] = useState<"all" | FamilyPerson>("all");
  const [expanded, setExpanded] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [changingStage, setChangingStage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPerson, setNewPerson] = useState<FamilyPerson>("Family");
  const [newType, setNewType] = useState("Activity");
  const [newDueDate, setNewDueDate] = useState("");
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadIdeas = useCallback(async (showStatus = true) => {
    if (showStatus) { setSyncing(true); setSyncStatus("syncing"); }
    const snapshot = await fetchFamilySnapshot();
    if (snapshot) {
      _familyIdeas = snapshot.ideas;
      _familyLastSync = snapshot.snapshotAt;
      _familyLoaded = true;
      setIdeas(snapshot.ideas);
      if (showStatus) setSyncStatus("success");
    } else if (!_familyLoaded) {
      _familyLoaded = true;
      if (showStatus) setSyncStatus("error");
    }
    if (showStatus) { setSyncing(false); setTimeout(() => setSyncStatus("idle"), 3000); }
  }, []);

  useEffect(() => {
    if (!_familyLoaded) loadIdeas(true);
    syncIntervalRef.current = setInterval(() => loadIdeas(false), 5 * 60 * 1000);
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [loadIdeas]);

  const handleStageChange = async (idea: FamilyIdea, newStage: FamilyIdeaStage) => {
    if (idea.status === newStage) return;
    setChangingStage(idea.id);
    const updated = ideas.map(i => i.id === idea.id ? { ...i, status: newStage } : i);
    _familyIdeas = updated;
    setIdeas(updated);

    const ok = await pushFamilyChange({ type: "status", ideaId: idea.id, newStage, changedAt: new Date().toISOString() });
    if (!ok) {
      const reverted = ideas.map(i => i.id === idea.id ? { ...i, status: idea.status } : i);
      _familyIdeas = reverted;
      setIdeas(reverted);
    } else {
      updateFamilySnapshotBlob(updated);
    }
    setChangingStage(null);
  };

  const handleAddIdea = async () => {
    if (!newTitle.trim()) return;
    const idea: FamilyIdea = {
      id: `idea-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      type: newType,
      person: newPerson,
      status: "Idea",
      addedAt: new Date().toISOString(),
      notes: "",
      budget: "",
      dueDate: newDueDate,
    };
    const updated = [...ideas, idea];
    _familyIdeas = updated;
    setIdeas(updated);
    setShowAddForm(false);
    setNewTitle(""); setNewDescription(""); setNewPerson("Family"); setNewType("Activity"); setNewDueDate("");

    const ok = await pushFamilyChange({ type: "add", idea, changedAt: new Date().toISOString() });
    if (ok) updateFamilySnapshotBlob(updated);
  };

  // Stage selector dropdown for a family idea — uses portal to escape overflow:hidden parents
  const FamilyStageSelector = ({ idea }: { idea: FamilyIdea }) => {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (btnRef.current?.contains(e.target as Node)) return;
        if (menuRef.current?.contains(e.target as Node)) return;
        setOpen(false);
      };
      if (open) document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    useEffect(() => {
      if (open && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, left: rect.left });
      }
    }, [open]);

    return (
      <>
        <button
          ref={btnRef}
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-all duration-200 hover:bg-white/[0.04]"
          style={{
            borderColor: `${FAMILY_STAGE_COLORS[idea.status]}40`,
            color: FAMILY_STAGE_COLORS[idea.status],
            background: `${FAMILY_STAGE_COLORS[idea.status]}10`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: FAMILY_STAGE_COLORS[idea.status] }} />
          {idea.status}
          {changingStage === idea.id ? (
            <span className="animate-spin text-[10px]">&#9696;</span>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        {open && menuPos && ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="fixed rounded-lg border py-1 min-w-[160px] shadow-xl"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              zIndex: 9999,
              background: "rgba(20,20,30,0.97)",
              borderColor: COLORS.border,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {FAMILY_STAGES.map(stage => (
              <button
                key={stage}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageChange(idea, stage);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors hover:bg-white/[0.06]"
                style={{ color: idea.status === stage ? FAMILY_STAGE_COLORS[stage] : COLORS.textSecondary }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FAMILY_STAGE_COLORS[stage], opacity: idea.status === stage ? 1 : 0.5 }} />
                {stage}
                {idea.status === stage && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-auto">
                    <path d="M2 6L5 9L10 3" stroke={FAMILY_STAGE_COLORS[stage]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
      </>
    );
  };

  const filtered = ideas
    .filter(i => filter === "all" ? true : i.status === filter)
    .filter(i => personFilter === "all" ? true : i.person === personFilter);

  const counts: Record<string, number> = { all: ideas.length };
  for (const stage of FAMILY_STAGES) counts[stage] = ideas.filter(i => i.status === stage).length;

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return "never";
    try {
      const d = new Date(iso);
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return d.toLocaleDateString();
    } catch { return "unknown"; }
  };

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (!expanded) {
    return (
      <div className="px-4 pb-3">
        <button onClick={() => setExpanded(true)} className="w-full rounded-lg border px-4 py-2.5 flex items-center justify-between"
          style={{ ...GLASS_ALT, borderColor: GLASS_ALT.borderColor, cursor: "pointer" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: COLORS.gold }}>Ideas Pipeline</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: `${COLORS.gold}18`, color: COLORS.gold }}>{ideas.length}</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: COLORS.textMuted }}><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3">
      <div className="rounded-xl border overflow-hidden" style={{ ...GLASS, borderColor: GLASS.borderColor }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: COLORS.borderSubtle }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setExpanded(false)} className="flex items-center gap-2" style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}>
              <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: COLORS.gold }}>Ideas Pipeline</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: COLORS.textMuted, transform: "rotate(180deg)" }}><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="text-[11px]" style={{ color: COLORS.textFaint }}>synced {formatSyncTime(_familyLastSync)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddForm(!showAddForm)} className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
              style={{ background: showAddForm ? `${COLORS.gold}30` : `${COLORS.gold}15`, color: COLORS.gold, border: "none", cursor: "pointer" }}>
              {showAddForm ? "Cancel" : "+ Add Idea"}
            </button>
            <button onClick={() => loadIdeas(true)} disabled={syncing}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
              style={{ background: syncStatus === "success" ? `${COLORS.green}20` : syncStatus === "error" ? `${COLORS.chartRed}20` : "rgba(255,255,255,0.06)",
                color: syncStatus === "success" ? COLORS.green : syncStatus === "error" ? COLORS.chartRed : COLORS.textMuted,
                border: "none", cursor: syncing ? "wait" : "pointer", opacity: syncing ? 0.6 : 1 }}>
              {syncing ? "Syncing..." : syncStatus === "success" ? "Synced" : syncStatus === "error" ? "Retry" : "Sync"}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="px-4 py-3 border-b" style={{ borderColor: COLORS.borderSubtle, background: "rgba(255,255,255,0.02)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What's the idea?"
                className="text-sm px-3 py-2 rounded-lg border outline-none w-full"
                style={{ background: "rgba(255,255,255,0.05)", borderColor: COLORS.borderSubtle, color: COLORS.textPrimary }} />
              <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Brief description (optional)"
                className="text-sm px-3 py-2 rounded-lg border outline-none w-full"
                style={{ background: "rgba(255,255,255,0.05)", borderColor: COLORS.borderSubtle, color: COLORS.textPrimary }} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {FAMILY_PEOPLE.map(p => (
                <button key={p} onClick={() => setNewPerson(p)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
                  style={{ background: newPerson === p ? `${PERSON_COLORS[p]}25` : "rgba(255,255,255,0.04)",
                    color: newPerson === p ? PERSON_COLORS[p] : COLORS.textMuted,
                    border: `1px solid ${newPerson === p ? `${PERSON_COLORS[p]}40` : COLORS.borderSubtle}`, cursor: "pointer" }}>
                  {p}
                </button>
              ))}
              <span className="w-px h-4 mx-1" style={{ background: COLORS.borderSubtle }} />
              {["Gift", "Activity", "Trip", "Milestone"].map(t => (
                <button key={t} onClick={() => setNewType(t)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
                  style={{ background: newType === t ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                    color: newType === t ? COLORS.textPrimary : COLORS.textMuted,
                    border: `1px solid ${newType === t ? COLORS.border : COLORS.borderSubtle}`, cursor: "pointer" }}>
                  {t}
                </button>
              ))}
              <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                className="text-[11px] px-2 py-1 rounded-lg border outline-none"
                style={{ background: "rgba(255,255,255,0.05)", borderColor: COLORS.borderSubtle, color: COLORS.textMuted, colorScheme: "dark" }} />
              <button onClick={handleAddIdea} disabled={!newTitle.trim()}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg ml-auto transition-all"
                style={{ background: newTitle.trim() ? COLORS.gold : `${COLORS.gold}30`, color: newTitle.trim() ? "#000" : COLORS.textMuted,
                  border: "none", cursor: newTitle.trim() ? "pointer" : "not-allowed" }}>
                Add
              </button>
            </div>
          </div>
        )}

        {/* Stage filter chips */}
        <div className="px-4 py-2.5 flex items-center gap-1.5 flex-wrap border-b" style={{ borderColor: COLORS.borderSubtle }}>
          <button onClick={() => setFilter("all")}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
            style={{ background: filter === "all" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
              color: filter === "all" ? COLORS.textPrimary : COLORS.textMuted,
              border: `1px solid ${filter === "all" ? COLORS.border : "transparent"}`, cursor: "pointer" }}>
            All {counts.all}
          </button>
          {FAMILY_STAGES.filter(s => s !== "Declined").map(stage => (
            <button key={stage} onClick={() => setFilter(stage)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
              style={{ background: filter === stage ? `${FAMILY_STAGE_COLORS[stage]}20` : "rgba(255,255,255,0.04)",
                color: filter === stage ? FAMILY_STAGE_COLORS[stage] : COLORS.textMuted,
                border: `1px solid ${filter === stage ? `${FAMILY_STAGE_COLORS[stage]}40` : "transparent"}`, cursor: "pointer" }}>
              {stage} {counts[stage]}
            </button>
          ))}
          {counts["Declined"] > 0 && (
            <button onClick={() => setFilter("Declined")}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
              style={{ background: filter === "Declined" ? `${COLORS.chartRed}20` : "rgba(255,255,255,0.04)",
                color: filter === "Declined" ? COLORS.chartRed : COLORS.textMuted,
                border: `1px solid ${filter === "Declined" ? `${COLORS.chartRed}40` : "transparent"}`, cursor: "pointer" }}>
              Declined {counts["Declined"]}
            </button>
          )}
          <span className="w-px h-4 mx-1" style={{ background: COLORS.borderSubtle }} />
          <button onClick={() => setPersonFilter("all")}
            className="text-[11px] font-medium px-2 py-1 rounded-full transition-all"
            style={{ background: personFilter === "all" ? "rgba(255,255,255,0.08)" : "transparent",
              color: personFilter === "all" ? COLORS.textPrimary : COLORS.textFaint,
              border: `1px solid ${personFilter === "all" ? COLORS.border : "transparent"}`, cursor: "pointer" }}>
            All
          </button>
          {FAMILY_PEOPLE.map(p => (
            <button key={p} onClick={() => setPersonFilter(p)}
              className="text-[11px] font-medium px-2 py-1 rounded-full transition-all"
              style={{ background: personFilter === p ? `${PERSON_COLORS[p]}15` : "transparent",
                color: personFilter === p ? PERSON_COLORS[p] : COLORS.textFaint,
                border: `1px solid ${personFilter === p ? `${PERSON_COLORS[p]}30` : "transparent"}`, cursor: "pointer" }}>
              {p}
            </button>
          ))}
        </div>

        {/* Ideas list */}
        <div className="max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `${COLORS.textFaint} transparent` }}>
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <span className="text-sm" style={{ color: COLORS.textMuted }}>No ideas yet. Add one above.</span>
            </div>
          )}
          {filtered.map(idea => {
            const daysUntil = getDaysUntilDue(idea.dueDate);
            const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
            return (
              <div key={idea.id} className="px-4 py-3 border-b flex items-start gap-3 transition-all"
                style={{ borderColor: COLORS.borderSubtle, opacity: changingStage === idea.id ? 0.5 : 1,
                  background: isUrgent ? "rgba(229,168,33,0.04)" : "transparent" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>{idea.title}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${PERSON_COLORS[idea.person]}18`, color: PERSON_COLORS[idea.person] }}>{idea.person}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: COLORS.textFaint }}>{idea.type}</span>
                    {daysUntil !== null && daysUntil >= 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: isUrgent ? `${COLORS.gold}20` : "rgba(255,255,255,0.06)",
                        color: isUrgent ? COLORS.gold : COLORS.textFaint }}>
                        {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                      </span>
                    )}
                    {daysUntil !== null && daysUntil < 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${COLORS.chartRed}15`, color: COLORS.chartRed }}>Overdue</span>
                    )}
                  </div>
                  {idea.description && (
                    <p className="text-[11px] mb-1.5" style={{ color: COLORS.textMuted, lineHeight: "1.4" }}>{idea.description}</p>
                  )}
                  {/* Stage selector — portal dropdown matching artist pipeline */}
                  <FamilyStageSelector idea={idea} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// HUB AGENTS (the 3 daily touchpoints)
// ═══════════════════════════════════════════
function HubAgentsCard() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;
  const touchpointMinutes = [7.5 * 60, 12.5 * 60, 20.5 * 60];

  let nextIdx = touchpointMinutes.findIndex((t) => t > currentMinutes);
  if (nextIdx === -1) nextIdx = 0;
  const diff = nextIdx === 0 && currentMinutes > touchpointMinutes[2]
    ? (24 * 60 - currentMinutes + touchpointMinutes[0])
    : touchpointMinutes[nextIdx] - currentMinutes;
  const hoursLeft = Math.floor(Math.abs(diff) / 60);
  const minsLeft = Math.abs(diff) % 60;

  const hubColors = [COLORS.teal, COLORS.gold, COLORS.coral];
  const hubIcons = ["sunrise", "bolt", "moon"];

  return (
    <div
      className="animate-fade-in-up rounded-xl border p-5 flex flex-col gap-4"
      style={{ ...GLASS, animationDelay: "200ms" }}
      data-testid="hub-agents"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${COLORS.purple}12` }}>
            <AgentIcon type="hub" color={COLORS.purple} size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: COLORS.purple }}>Hub — Daily Rhythm</h3>
            <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Orchestrates all lanes with 3 daily touchpoints</p>
          </div>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-md tabular-nums" style={{ background: `${COLORS.teal}12`, color: COLORS.teal }}>
          Next: {HUB_AGENTS[nextIdx].name} in {hoursLeft}h {minsLeft}m
        </span>
      </div>

      {/* Horizontal timeline of hub agents */}
      <div className="relative flex items-start justify-between pt-2 pb-1">
        <div className="absolute top-[1.6rem] left-[15%] right-[15%] h-[2px]" style={{ background: `linear-gradient(to right, ${COLORS.teal}50, ${COLORS.gold}50, ${COLORS.coral}50)` }} />

        {HUB_AGENTS.map((agent, i) => {
          const c = hubColors[i];
          const isNext = i === nextIdx;
          return (
            <div key={agent.id} className="flex flex-col items-center gap-2 relative z-10 flex-1 animate-fade-in-up" style={{ animationDelay: `${400 + i * 100}ms` }}>
              <div className="relative">
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: c, background: isNext ? c : "transparent" }}>
                  {isNext && <div className="w-2 h-2 rounded-full" style={{ background: COLORS.bg }} />}
                  {!isNext && <div className="w-2 h-2 rounded-full" style={{ background: c }} />}
                </div>
                {isNext && (
                  <div className="absolute -inset-1 rounded-full animate-ping" style={{ border: `1px solid ${c}40` }} />
                )}
              </div>
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${c}10` }}>
                <AgentIcon type={hubIcons[i]} color={c} size={16} />
              </div>
              <span className="text-xs font-semibold tabular-nums" style={{ color: c }}>{agent.schedule?.replace("Daily ", "")}</span>
              <span className="text-[11px] font-medium" style={{ color: COLORS.textPrimary }}>{agent.name}</span>
              <span className="text-[11px] text-center max-w-[140px] leading-tight" style={{ color: COLORS.textFaint }}>{agent.role}</span>
            </div>
          );
        })}
      </div>

      {/* Collapsible deliverables */}
      <DeliverablesList laneName="Hub" laneColor={COLORS.purple} />
    </div>
  );
}

// ═══════════════════════════════════════════
// SYSTEM STATUS (connectors)
// ═══════════════════════════════════════════
function SystemStatusCard() {
  const connectors = [
    { name: "Realtime Finance", connected: true },
    { name: "Gmail + Calendar", connected: true },
    { name: "Google Sheets", connected: true },
    { name: "Google Drive", connected: true },
    { name: "GitHub", connected: true },
    { name: "Vercel", connected: true },
    { name: "Slack", connected: false },
  ];

  const connected = connectors.filter(c => c.connected).length;
  const total = connectors.length;

  return (
    <div className="animate-fade-in-up rounded-xl border p-5 flex flex-col gap-4" style={{ ...GLASS, animationDelay: "300ms" }} data-testid="system-status">
      <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Connectors</h3>
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={40} cy={40} r={32} fill="none" stroke={COLORS.border} strokeWidth={8} />
            <circle cx={40} cy={40} r={32} fill="none" stroke={COLORS.green} strokeWidth={8} strokeDasharray={`${(connected / total) * 201} 201`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1)" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold tabular-nums" style={{ color: COLORS.textPrimary }}>{connected}/{total}</span>
          </div>
        </div>
        {/* List */}
        <div className="flex-1 flex flex-col gap-1.5">
          {connectors.map((c) => (
            <div key={c.name} className="flex items-center gap-2 text-[11px]">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.connected ? COLORS.green : COLORS.textFaint }} />
              <span style={{ color: c.connected ? COLORS.textPrimary : COLORS.textMuted }}>{c.name}</span>
              <span className="ml-auto text-[11px]" style={{ color: c.connected ? COLORS.green : COLORS.textFaint }}>
                {c.connected ? "Live" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MINI CALENDAR
// ═══════════════════════════════════════════
function MiniCalendar() {
  const now = new Date();
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const year = etNow.getFullYear();
  const month = etNow.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const today = etNow.getDate();
  const birthday = 25;
  const saturdays = days.filter((d) => new Date(year, month, d).getDay() === 6);

  return (
    <div className="rounded-lg p-3" style={{ ...GLASS_ALT }}>
      <div className="text-[11px] font-semibold mb-2 flex items-center justify-between" style={{ color: COLORS.textMuted }}>
        <span>March 2026</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: COLORS.teal }} /> Today
          <span className="w-2 h-2 rounded-sm" style={{ background: COLORS.gold }} /> Birthday
          <span className="w-2 h-2 rounded-sm" style={{ background: `${COLORS.teal}25` }} /> Siyah Call
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-[11px] py-0.5 font-medium" style={{ color: COLORS.textFaint }}>{d}</div>
        ))}
        {blanks.map((b) => <div key={`b-${b}`} />)}
        {days.map((d) => {
          const isToday = d === today;
          const isBirthday = d === birthday;
          const isSaturday = saturdays.includes(d);
          let bg = "transparent";
          let textColor = COLORS.textMuted;
          let fontWeight = 400;

          if (isToday) { bg = COLORS.teal; textColor = COLORS.bg; fontWeight = 700; }
          else if (isBirthday) { bg = `${COLORS.gold}25`; textColor = COLORS.gold; fontWeight = 700; }
          else if (isSaturday) { bg = `${COLORS.teal}12`; textColor = COLORS.teal; }

          return (
            <div key={d} className="relative text-[11px] tabular-nums rounded-sm py-0.5 leading-tight" style={{ background: bg, color: textColor, fontWeight }}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CREDIT USAGE — LAST 24 HOURS
// ═══════════════════════════════════════════
function CreditUsageCard() {
  const maxCredits = CREDIT_DATA_24H[0]?.creditsUsed || 1;

  // Group by lane for the breakdown
  const laneTotals = CREDIT_DATA_24H.reduce((acc, c) => {
    acc[c.laneName] = (acc[c.laneName] || 0) + c.creditsUsed;
    return acc;
  }, {} as Record<string, number>);

  const laneColors: Record<string, string> = {
    "Hub": COLORS.purple,
    "Art Advisory": COLORS.teal,
    "Family & Life": COLORS.gold,
    "System": COLORS.coral,
  };

  const sortedLanes = Object.entries(laneTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="animate-fade-in-up rounded-xl border overflow-hidden"
      style={{ ...GLASS, animationDelay: "300ms" }}
      data-testid="credit-usage"
    >
      <div className="p-5">
        {/* Header with 24h total */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${COLORS.textMuted}10` }}>
              <AgentIcon type="bars" color={COLORS.textMuted} size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Credits · Last 24h</h3>
              <p className="text-[11px]" style={{ color: COLORS.textFaint }}>{CREDIT_DATA_24H.length} agents active</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold tabular-nums" style={{ color: COLORS.textPrimary }}>{TOTAL_CREDITS_24H.toLocaleString()}</span>
            <span className="text-[11px] block" style={{ color: COLORS.textFaint }}>credits used</span>
          </div>
        </div>

        {/* Lane breakdown — stacked bar */}
        <div className="h-2 rounded-full overflow-hidden flex mb-3" style={{ background: COLORS.border }}>
          {sortedLanes.map(([lane, total]) => (
            <div
              key={lane}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(total / TOTAL_CREDITS_24H) * 100}%`,
                background: laneColors[lane] || COLORS.textFaint,
                opacity: 0.85,
              }}
              title={`${lane}: ${total.toLocaleString()}`}
            />
          ))}
        </div>

        {/* Lane legend */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {sortedLanes.map(([lane, total]) => (
            <div key={lane} className="flex items-center gap-1.5 text-[11px]">
              <div className="w-2 h-2 rounded-sm" style={{ background: laneColors[lane] || COLORS.textFaint }} />
              <span style={{ color: COLORS.textMuted }}>{lane}</span>
              <span className="font-semibold tabular-nums" style={{ color: COLORS.textPrimary }}>{total.toLocaleString()}</span>
              <span style={{ color: COLORS.textFaint }}>({Math.round((total / TOTAL_CREDITS_24H) * 100)}%)</span>
            </div>
          ))}
        </div>

        {/* Top spenders list */}
        <div className="flex flex-col gap-1.5">
          {CREDIT_DATA_24H.slice(0, 5).map((entry, i) => (
            <div key={entry.agentId} className="flex items-center gap-2.5 animate-fade-in-up" style={{ animationDelay: `${350 + i * 40}ms` }}>
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <AgentIcon type={entry.icon} color={entry.laneColor} size={12} />
              </div>
              <span className="text-[11px] font-medium flex-1 min-w-0 truncate" style={{ color: COLORS.textPrimary }}>{entry.agentName}</span>
              <div className="w-24 h-[5px] rounded-full overflow-hidden flex-shrink-0" style={{ background: COLORS.border }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(entry.creditsUsed / maxCredits) * 100}%`,
                    background: entry.laneColor,
                    opacity: 0.75,
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums w-12 text-right" style={{ color: COLORS.textPrimary }}>{entry.creditsUsed.toLocaleString()}</span>
            </div>
          ))}
          {CREDIT_DATA_24H.length > 5 && (
            <div className="text-[11px] pl-6 pt-0.5" style={{ color: COLORS.textFaint }}>
              +{CREDIT_DATA_24H.length - 5} more ({CREDIT_DATA_24H.slice(5).reduce((s, c) => s + c.creditsUsed, 0).toLocaleString()} credits)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// BUILD YOUR LIFEOS — MULTI-USER TEASER
// ═══════════════════════════════════════════
function BuildYourLifeOS() {
  const steps = [
    { num: "01", label: "Tell us about you", desc: "Family, work, goals, interests", color: COLORS.teal },
    { num: "02", label: "Choose your lanes", desc: "Family, business, finance, health, creative", color: COLORS.gold },
    { num: "03", label: "Name your agents", desc: "Personalize each AI agent with a codename", color: COLORS.coral },
    { num: "04", label: "Set your rhythm", desc: "Daily briefs, check-ins, weekly reviews", color: COLORS.purple },
    { num: "05", label: "Go live", desc: "Your LifeOS starts working for you", color: COLORS.green },
  ];

  return (
    <div className="animate-fade-in-up rounded-xl border overflow-hidden" style={{ background: `linear-gradient(135deg, rgba(22,22,30,0.6) 0%, rgba(26,21,40,0.5) 100%)`, backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", borderColor: `${COLORS.purple}25`, animationDelay: "600ms" }} data-testid="build-your-lifeos">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: `${COLORS.purple}18`, color: COLORS.purple }}>
            Coming Soon
          </span>
        </div>
        <h3 className="text-base font-bold mt-2" style={{ color: COLORS.textPrimary }}>Build Your Own LifeOS</h3>
        <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
          Answer a few questions and we'll spin up a personalized system of AI agents tailored to your life — family, career, finances, health, and passions.
        </p>

        <div className="flex items-start gap-3 mt-5 overflow-x-auto pb-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex flex-col items-center gap-2 min-w-[110px] flex-1 animate-fade-in-up" style={{ animationDelay: `${800 + i * 80}ms` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold tabular-nums" style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}30` }}>
                {s.num}
              </div>
              <span className="text-[11px] font-semibold text-center" style={{ color: COLORS.textPrimary }}>{s.label}</span>
              <span className="text-[11px] text-center leading-tight" style={{ color: COLORS.textFaint }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// EVOLUTION ROADMAP
// ═══════════════════════════════════════════
function EvolutionRoadmap() {
  const milestones = [
    { version: "v1.0", timing: "NOW", label: "Art Advisory + Family & Life", color: COLORS.teal, filled: true },
    { version: "v1.1", timing: "NEXT", label: "Connect Gmail, Calendar, Sheets", color: COLORS.gold, filled: false },
    { version: "v2.0", timing: "Q2", label: "Business & Finance Lanes", color: COLORS.coral, filled: false },
    { version: "v2.1", timing: "Q2", label: "Artist Outreach Automation", color: COLORS.purple, filled: false },
    { version: "v3.0", timing: "Q3", label: "Multi-User Onboarding", color: COLORS.green, filled: false },
  ];

  return (
    <div className="animate-fade-in-up rounded-xl border p-5 flex flex-col gap-4" style={{ ...GLASS, animationDelay: "500ms" }} data-testid="evolution-roadmap">
      <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Evolution Roadmap</h3>
      <div className="relative flex items-start justify-between py-4 px-2">
        <div className="absolute top-[2.25rem] left-[10%] right-[10%] h-[2px]" style={{ background: `linear-gradient(to right, ${COLORS.teal}, ${COLORS.gold}, ${COLORS.coral}, ${COLORS.purple}, ${COLORS.green})` }} />
        {milestones.map((m, i) => (
          <div key={m.version} className="flex flex-col items-center gap-2 relative z-10 flex-1 animate-fade-in-up" style={{ animationDelay: `${700 + i * 100}ms` }}>
            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: m.color, background: m.filled ? m.color : "transparent" }}>
              {m.filled && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke={COLORS.bg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${m.color}15`, color: m.color }}>{m.version}</span>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: m.color }}>{m.timing}</span>
            <span className="text-[11px] text-center max-w-[120px] leading-tight" style={{ color: COLORS.textMuted }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════
function SectionHeader({ title, subtitle, count }: { title: string; subtitle: string; count?: string }) {
  return (
    <div className="flex items-end justify-between mb-1">
      <div>
        <h2 className="text-sm font-bold tracking-tight" style={{ color: COLORS.textPrimary }}>{title}</h2>
        <p className="text-[11px]" style={{ color: COLORS.textFaint }}>{subtitle}</p>
      </div>
      {count && (
        <span className="text-xs tabular-nums font-medium" style={{ color: COLORS.textMuted }}>{count}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// HEADER (with color variant toggle)
// ═══════════════════════════════════════════
type DensityLevel = "compact" | "comfortable" | "spacious";
const DENSITY_SCALES: Record<DensityLevel, number> = {
  compact: 0.92,
  comfortable: 1.0,
  spacious: 1.12,
};
const DENSITY_LABELS: Record<DensityLevel, string> = {
  compact: "Compact",
  comfortable: "Comfortable",
  spacious: "Spacious",
};

function DensityToggle({ density, onChange }: { density: DensityLevel; onChange: (d: DensityLevel) => void }) {
  const levels: DensityLevel[] = ["compact", "comfortable", "spacious"];
  return (
    <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
      {levels.map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className="relative px-2 py-0.5 rounded-md text-[11px] font-medium transition-all"
          style={{
            background: density === level ? "rgba(255,255,255,0.08)" : "transparent",
            color: density === level ? COLORS.textPrimary : COLORS.textMuted,
          }}
          title={DENSITY_LABELS[level]}
        >
          {/* Icon representation */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {level === "compact" && (
              <>
                <rect x="2" y="3" width="10" height="1.5" rx="0.5" fill="currentColor" opacity="0.7" />
                <rect x="2" y="6.25" width="10" height="1.5" rx="0.5" fill="currentColor" opacity="0.7" />
                <rect x="2" y="9.5" width="10" height="1.5" rx="0.5" fill="currentColor" opacity="0.7" />
              </>
            )}
            {level === "comfortable" && (
              <>
                <rect x="2" y="2" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
                <rect x="2" y="6" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
                <rect x="2" y="10" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
              </>
            )}
            {level === "spacious" && (
              <>
                <rect x="2" y="1" width="10" height="3" rx="0.75" fill="currentColor" opacity="0.7" />
                <rect x="2" y="5.5" width="10" height="3" rx="0.75" fill="currentColor" opacity="0.7" />
                <rect x="2" y="10" width="10" height="3" rx="0.75" fill="currentColor" opacity="0.7" />
              </>
            )}
          </svg>
        </button>
      ))}
    </div>
  );
}

function Header({ activeVariant, onVariantChange, density, onDensityChange }: { activeVariant: string; onVariantChange: (key: string) => void; density: DensityLevel; onDensityChange: (d: DensityLevel) => void }) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
      style={{
        background: "rgba(22, 22, 30, 0.7)",
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        borderColor: COLORS.border,
        position: "relative",
        zIndex: 10,
      }}
      data-testid="header"
    >
      <div className="flex items-center gap-3">
        <LifeOSLogo size={28} />
        <span className="text-base font-bold tracking-tight" style={{ color: COLORS.textPrimary }}>LifeOS</span>
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${COLORS.teal}15`, color: COLORS.teal }}>v1.0</span>
      </div>
      <div className="flex items-center gap-4">
        {/* Density toggle */}
        <DensityToggle density={density} onChange={onDensityChange} />
        {/* Divider */}
        <div className="w-px h-5" style={{ background: COLORS.borderSubtle }} />
        {/* Color variant toggle */}
        <div className="flex items-center gap-1.5" data-testid="color-variant-toggle">
          {Object.entries(COLOR_VARIANTS).map(([key, v]) => (
            <div key={key} className="relative group">
              <button
                onClick={() => onVariantChange(key)}
                className="w-3 h-3 rounded-full transition-all"
                style={{
                  background: v.blobs[0].color.replace(/[\d.]+\)$/, '1)'),
                  outline: activeVariant === key ? `2px solid rgba(255,255,255,0.6)` : 'none',
                  outlineOffset: '2px',
                }}
                data-testid={`variant-${key}`}
              />
              <span
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: 'rgba(0,0,0,0.85)', color: 'rgba(220,220,235,0.9)', backdropFilter: 'blur(8px)' }}
              >
                {v.label}
              </span>
            </div>
          ))}
        </div>
        <span className="text-sm font-medium hidden sm:inline" style={{ color: COLORS.textMuted }}>Ant Kinnel</span>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${COLORS.teal}20`, color: COLORS.teal }}>AK</div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════
// DRAG & DROP SORTABLE SECTION
// ═══════════════════════════════════════════
interface DashboardSection {
  id: string;
  label: string;
}

function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} data-testid={`section-${id}`}>
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-1 top-2 w-6 h-8 flex items-center justify-center rounded-md cursor-grab active:cursor-grabbing opacity-0 hover:opacity-100 transition-opacity z-20 group/handle"
        style={{ background: COLORS.surfaceHover }}
        title="Drag to reorder"
      >
        <AgentIcon type="grip" color={COLORS.textFaint} size={14} />
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════
// COLLAPSIBLE SECTION
// ═══════════════════════════════════════════
function CollapsibleSection({
  id,
  label,
  defaultOpen = false,
  children,
  dragHandleProps,
}: {
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  dragHandleProps?: Record<string, any>;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div data-testid={`section-${id}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-2 group rounded-md transition-colors hover:bg-white/[0.03]"
        style={{ minHeight: '44px' }}
        data-testid={`toggle-${id}`}
      >
        <div className="flex items-center gap-2.5">
          {dragHandleProps && (
            <span
              {...dragHandleProps}
              className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              style={{ background: COLORS.surfaceHover }}
              onClick={(e) => e.stopPropagation()}
            >
              <AgentIcon type="grip" color={COLORS.textFaint} size={12} />
            </span>
          )}
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: COLORS.textMuted }}>
            {label}
          </span>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M4 7L9 12L14 7" stroke={COLORS.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? '4000px' : '0px',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="pt-2 pb-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// RECENT DELIVERABLES DATA
// ═══════════════════════════════════════════
interface Deliverable {
  id: string;
  lane: string;
  laneColor: string;
  icon: string;
  title: string;
  type: "report" | "brief" | "document" | "scout" | "dashboard" | "deep-dive" | "notification";
  date: string; // ISO date string
  url?: string; // Perplexity conversation URL
  summary: string;
}

const DELIVERABLES: Deliverable[] = [
  {
    id: "d-dashboard",
    lane: "System",
    laneColor: COLORS.teal,
    icon: "hub",
    title: "LifeOS Dashboard v1.0",
    type: "dashboard",
    date: "2026-03-14",
    url: "https://www.perplexity.ai/computer/a/lifeos-dashboard-I6JTszvPQCaG4jBno7e1eA",
    summary: "Live dashboard with shadow figures, 8 color variants, collapsible sections",
  },
  {
    id: "d-brand-blueprint",
    lane: "Art Advisory",
    laneColor: COLORS.teal,
    icon: "palette",
    title: "Bernard Studia Brand Blueprint v1",
    type: "document",
    date: "2026-03-14",
    url: "https://drive.google.com/file/d/1WS5iAIcumexeEVbndnYq6WpPHQhNQxF4/view",
    summary: "20-page brand identity PDF — palette, type, positioning, buyer personas",
  },
  {
    id: "d-taste-bible",
    lane: "Art Advisory",
    laneColor: COLORS.teal,
    icon: "target",
    title: "Taste Bible v1.0",
    type: "document",
    date: "2026-03-14",
    url: "https://drive.google.com/file/d/1dufuvx2ZEA71a-pJ5ujHoBo4qFGrwTpR/view",
    summary: "Reference artists, mediums, price tiers, style preferences for scouting",
  },
  {
    id: "d-taste-bible-sheet",
    lane: "Art Advisory",
    laneColor: COLORS.teal,
    icon: "target",
    title: "Taste Bible — Live Sheet",
    type: "document",
    date: "2026-03-14",
    url: "https://docs.google.com/spreadsheets/d/1jLftOG3_M6nHUB7MqNldZ9Vi7avuShRNBkiPG2tb80w/edit",
    summary: "Living Google Sheet — reference artists, scores, and style tags",
  },
  {
    id: "d-art-scout-batch2",
    lane: "Art Advisory",
    laneColor: COLORS.teal,
    icon: "target",
    title: "Art Scout: Batch #2",
    type: "scout",
    date: "2026-03-14",
    url: "https://perplexity.ai/search/e93b2ecf-df64-4f5d-8ec7-415085694e2a",
    summary: "9 unrepresented artists scored 60-86 — Napoles Marty, Kristy Hughes, Frantz Patrick Henry + 6 more",
  },
  {
    id: "d-art-scout-master",
    lane: "Art Advisory",
    laneColor: COLORS.teal,
    icon: "telescope",
    title: "Art Scout Master — Live Sheet",
    type: "scout",
    date: "2026-03-14",
    url: "https://docs.google.com/spreadsheets/d/1LiCWtcIa5cUzUamwg3Q12lrCft9YbDnV89Gcs-dODY8/edit",
    summary: "Every scouted artist with scores, links, status, and ratings",
  },
  {
    id: "d-morning-brief",
    lane: "Hub",
    laneColor: COLORS.purple,
    icon: "sunrise",
    title: "Morning Brief",
    type: "brief",
    date: "2026-03-14",
    url: "https://docs.google.com/spreadsheets/d/13bHRRz6HOcrGy-xyX-kanP9s4X5RdAm_l33UUIdFWrI/edit",
    summary: "Markets, art radar, priorities, family — delivered 7:30 AM daily",
  },
  {
    id: "d-ai-deep-dive",
    lane: "Hub",
    laneColor: COLORS.purple,
    icon: "bolt",
    title: "AI Deep Dive: Gemini in Workspace",
    type: "deep-dive",
    date: "2026-03-14",
    url: "https://perplexity.ai/search/b17d1884-64de-4fbc-9128-f8d305a7fcc2",
    summary: "Gemini integration across Docs/Sheets/Slides/Drive, workflow recommendations",
  },

  {
    id: "d-learning-brief",
    lane: "Hub",
    laneColor: COLORS.purple,
    icon: "telescope",
    title: "Learning Brief: Negotiation",
    type: "brief",
    date: "2026-03-14",
    url: "https://perplexity.ai/search/1cccebec-d3b2-4ca5-a4de-fb00d06ad74a",
    summary: "Skill spotlight, book rec, 12x12 pipeline challenge, accountability",
  },
  {
    id: "d-ai-briefing",
    lane: "Hub",
    laneColor: COLORS.purple,
    icon: "signal",
    title: "AI & Tech Briefing",
    type: "brief",
    date: "2026-03-14",
    url: "https://perplexity.ai/search/8020ee59-db87-4200-801d-21a02b47b3f3",
    summary: "Gemini Workspace upgrades, state AI bills, Meta Avocado delay",
  },
  {
    id: "d-deliverables-tracker",
    lane: "System",
    laneColor: COLORS.teal,
    icon: "clipboard",
    title: "Deliverables Tracker — Live Sheet",
    type: "document",
    date: "2026-03-14",
    url: "https://docs.google.com/spreadsheets/d/17cvwW4S4pEcbkP6MI5cMVPRJHX_zFIMa6DIPdPpfJYk/edit",
    summary: "Master log of all deliverables with dates, types, and links",
  },
  {
    id: "d-design-critique",
    lane: "System",
    laneColor: COLORS.teal,
    icon: "telescope",
    title: "Design Critique — 62/100",
    type: "report",
    date: "2026-03-14",
    url: "",
    summary: "WCAG contrast, min font sizes, density toggle, stat card unification",
  },
];

// Map deliverables to lane IDs for grouping
const LANE_DELIVERABLE_MAP: Record<string, string> = {
  "Art Advisory": "art",
  "Hub": "hub",
  "Family": "family",
  "Business": "business",
  "System": "system",
  "Finance": "finance",
};

// Only show deliverables from the last 1 day (today + yesterday)
function getDeliverablesByLane(laneName: string): Deliverable[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return DELIVERABLES
    .filter(d => d.lane === laneName && d.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getTypeLabel(type: Deliverable["type"]): string {
  switch (type) {
    case "report": return "Report";
    case "brief": return "Brief";
    case "document": return "Doc";
    case "scout": return "Scout";
    case "dashboard": return "Live";
    case "deep-dive": return "Deep Dive";
    case "notification": return "Update";
    default: return "";
  }
}

function getRelativeDate(dateStr: string): string {
  const now = new Date();
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const date = new Date(dateStr + "T12:00:00");
  const diffDays = Math.floor((etNow.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ═══════════════════════════════════════════
// DELIVERABLES LIST (collapsible per lane)
// ═══════════════════════════════════════════
function DeliverablesList({ laneName, laneColor }: { laneName: string; laneColor: string }) {
  const items = getDeliverablesByLane(laneName);
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="border-t" style={{ borderColor: `${laneColor}12` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-2.5 group transition-colors"
        style={{ background: expanded ? `${laneColor}06` : "transparent" }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = `${laneColor}04`; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        <div className="flex items-center gap-2">
          <AgentIcon type="clipboard" color={laneColor} size={11} />
          <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: laneColor }}>
            Deliverables
          </span>
          <span className="text-[11px] tabular-nums px-1.5 py-px rounded-full" style={{ background: `${laneColor}15`, color: laneColor }}>
            {items.length}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className="transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke={laneColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? `${items.length * 70 + 16}px` : "0px", opacity: expanded ? 1 : 0 }}
      >
        <div className="px-4 pb-3 flex flex-col gap-1">
          {items.map((d) => {
            const Wrapper = d.url ? "a" : "div";
            const wrapperProps = d.url ? { href: d.url, target: "_blank", rel: "noopener noreferrer" } : {};
            return (
              <Wrapper
                key={d.id}
                {...(wrapperProps as any)}
                className={`flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors ${d.url ? "cursor-pointer" : ""}`}
                style={{ background: "rgba(255,255,255,0.02)", borderLeft: `2px solid ${laneColor}25` }}
                onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
              >
                <div className="pt-0.5 shrink-0">
                  <AgentIcon type={d.icon} color={laneColor} size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium truncate" style={{ color: COLORS.textPrimary }}>
                      {d.title}
                    </span>
                    {d.url && (
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0 opacity-40">
                        <path d="M3 1h6v6M9 1L4 6" stroke={COLORS.textMuted} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[11px] font-medium px-1.5 py-px rounded"
                      style={{ background: `${laneColor}12`, color: laneColor }}
                    >
                      {getTypeLabel(d.type)}
                    </span>
                    <span className="text-[11px]" style={{ color: COLORS.textFaint }}>
                      {getRelativeDate(d.date)}
                    </span>
                    {d.url && d.url.includes("drive.google.com") && (
                      <span className="text-[11px] px-1 py-px rounded" style={{ background: "rgba(66,133,244,0.12)", color: "#4285f4" }}>PDF</span>
                    )}
                    {d.url && d.url.includes("docs.google.com/spreadsheets") && (
                      <span className="text-[11px] px-1 py-px rounded" style={{ background: "rgba(52,168,83,0.12)", color: "#34a853" }}>Sheet</span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5 leading-relaxed line-clamp-1" style={{ color: COLORS.textMuted }}>
                    {d.summary}
                  </p>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TL;DR DIGEST
// ═══════════════════════════════════════════
interface DigestLine {
  icon: string;
  label: string;
  color: string;
  status: string;
  detail: string;
  urgent?: boolean;
  lane?: string; // maps to deliverable lane name for expand/collapse
}

function TLDRDigest() {
  const now = new Date();
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = etNow.getHours();
  const dayOfWeek = etNow.getDay();
  const dayOfMonth = etNow.getDate();
  const month = etNow.getMonth();

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Next agent
  const agentSchedule = [
    { name: "Morning Brief", hour: 7, minute: 30, icon: "sunrise", color: COLORS.teal },
    { name: "Midday Pulse", hour: 12, minute: 30, icon: "bolt", color: COLORS.gold },
    { name: "Evening Review", hour: 20, minute: 30, icon: "moon", color: COLORS.purple },
  ];
  const currentMinutes = hour * 60 + etNow.getMinutes();
  const nextAgent = agentSchedule.find(a => a.hour * 60 + a.minute > currentMinutes) || agentSchedule[0];
  const nextAgentMinutes = (nextAgent.hour * 60 + nextAgent.minute) - currentMinutes;
  const nextAgentTime = nextAgentMinutes > 0
    ? `${Math.floor(nextAgentMinutes / 60)}h ${nextAgentMinutes % 60}m`
    : "tomorrow 7:30 AM";

  // Birthday countdown
  const daysUntilBirthday = (month === 2) ? (25 - dayOfMonth) : -1;

  // Build status lines
  const lines: DigestLine[] = [];

  // Hub
  lines.push({
    icon: "hub",
    label: "Hub",
    color: COLORS.purple,
    status: "7 scheduled tasks running",
    detail: `Next: ${nextAgent.name} in ${nextAgentTime}`,
    lane: "Hub",
  });

  // Art Advisory
  const artStatus = dayOfWeek === 1
    ? "Scout batch incoming — 5 artists to review"
    : "2 active / 2 planned";
  const daysUntilMonday = ((1 - dayOfWeek) + 7) % 7;
  const artDetail = dayOfWeek === 1
    ? "Taste Engine learning from last week's ratings"
    : daysUntilMonday === 1
    ? "Scout batch arrives tomorrow"
    : `Next scout: Monday · Outreach + Sales planned`;
  lines.push({
    icon: "palette",
    label: "Art Advisory",
    color: COLORS.teal,
    status: artStatus,
    detail: artDetail,
    lane: "Art Advisory",
  });

  // Family & Life
  const familyNotes: string[] = [];
  if (daysUntilBirthday === 0) {
    familyNotes.push("Siyah's 20th birthday TODAY");
  } else if (daysUntilBirthday === 1) {
    familyNotes.push("Siyah's birthday tomorrow");
  } else if (daysUntilBirthday > 0 && daysUntilBirthday <= 7) {
    familyNotes.push(`Siyah's 20th in ${daysUntilBirthday}d`);
  }
  if (dayOfWeek === 6) familyNotes.push("Siyah call day");
  familyNotes.push("Zoey call");

  lines.push({
    icon: "heart",
    label: "Family",
    color: COLORS.gold,
    status: familyNotes.join(" · "),
    detail: "4 agents active — Siyah, Zoey, Kel'li, Wellness",
    urgent: daysUntilBirthday >= 0 && daysUntilBirthday <= 2,
    lane: "Family",
  });

  // Business
  lines.push({
    icon: "briefcase",
    label: "Business",
    color: COLORS.coral,
    status: "Planned",
    detail: "Studio Admin + Content Engine queued for v1.1",
    lane: "Business",
  });

  // Finance
  lines.push({
    icon: "chart",
    label: "Finance",
    color: COLORS.green,
    status: "Planned",
    detail: "Finance Agent + Crypto Scanner queued for v2.0",
    lane: "Finance",
  });

  // Connectors
  lines.push({
    icon: "signal",
    label: "Connectors",
    color: COLORS.textMuted,
    status: "7 connected",
    detail: "Sheets, Drive, GitHub, Finance, Gmail, Calendar, Vercel — all live",
  });

  // Credits
  lines.push({
    icon: "bars",
    label: "Credits",
    color: COLORS.textMuted,
    status: `${TOTAL_CREDITS_24H.toLocaleString()} last 24h`,
    detail: `Top: ${CREDIT_DATA_24H[0]?.agentName || ""} (${CREDIT_DATA_24H[0]?.creditsUsed.toLocaleString() || 0}) · ${CREDIT_DATA_24H.length} agents active`,
  });

  const [expandedLane, setExpandedLane] = useState<string | null>(null);

  const toggleLane = (laneName: string | undefined) => {
    if (!laneName) return;
    const items = getDeliverablesByLane(laneName);
    if (items.length === 0) return;
    setExpandedLane(expandedLane === laneName ? null : laneName);
  };

  const now2 = new Date();
  const cutoff2 = new Date(now2.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentDeliverables = DELIVERABLES.filter(d => d.date >= cutoff2);
  const totalDeliverables = recentDeliverables.length;
  const totalLanes = new Set(recentDeliverables.map(d => d.lane)).size;

  return (
    <div
      className="rounded-xl border p-5"
      style={{ ...GLASS, borderColor: GLASS.borderColor }}
      data-testid="tldr-digest"
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: COLORS.textPrimary }}>
            {greeting}, Ant
          </h2>
          <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
            {etNow.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — at a glance
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{ background: `${nextAgent.color}15`, color: nextAgent.color }}
        >
          <AgentIcon type={nextAgent.icon} color={nextAgent.color} size={11} />
          {nextAgent.name} in {nextAgentTime}
        </div>
      </div>

      {/* Status lines with inline deliverables */}
      <div className="flex flex-col">
        {lines.map((line, i) => {
          const laneItems = line.lane ? getDeliverablesByLane(line.lane) : [];
          const hasItems = laneItems.length > 0;
          const isExpanded = expandedLane === line.lane;

          return (
            <div key={i}>
              {/* Lane row */}
              <div
                className={`flex items-start gap-2.5 min-h-[20px] py-1.5 rounded-md px-1.5 -mx-1.5 transition-colors ${hasItems ? "cursor-pointer" : ""}`}
                style={{ background: isExpanded ? `${line.color}08` : "transparent" }}
                onClick={() => hasItems && toggleLane(line.lane)}
                onMouseEnter={(e) => { if (hasItems && !isExpanded) e.currentTarget.style.background = `${line.color}05`; }}
                onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
              >
                <div className="flex items-center gap-1.5 w-[110px] shrink-0 pt-px">
                  <AgentIcon type={line.icon} color={line.color} size={12} />
                  <span className="text-[11px] font-semibold" style={{ color: line.color }}>
                    {line.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs" style={{ color: line.urgent ? COLORS.gold : COLORS.textPrimary }}>
                    {line.status}
                  </span>
                  <span className="text-[11px] ml-2" style={{ color: COLORS.textMuted }}>
                    {line.detail}
                  </span>
                </div>
                {hasItems && (
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <span className="text-[11px] tabular-nums" style={{ color: `${line.color}90` }}>
                      {laneItems.length}
                    </span>
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="none"
                      className="transition-transform duration-200"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke={`${line.color}70`} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Expandable deliverables drawer */}
              {hasItems && (
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{
                    maxHeight: isExpanded ? `${laneItems.length * 56 + 12}px` : "0px",
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div className="pl-[110px] pr-1 pb-2 flex flex-col gap-0.5">
                    {laneItems.map((d) => {
                      const isLink = !!d.url;
                      return (
                        <a
                          key={d.id}
                          href={d.url || undefined}
                          target={isLink ? "_blank" : undefined}
                          rel={isLink ? "noopener noreferrer" : undefined}
                          className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 transition-colors group ${isLink ? "cursor-pointer" : "cursor-default"}`}
                          style={{ background: "rgba(255,255,255,0.02)", borderLeft: `2px solid ${line.color}20` }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AgentIcon type={d.icon} color={line.color} size={10} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium truncate" style={{ color: COLORS.textPrimary }}>
                                {d.title}
                              </span>
                              {isLink && (
                                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
                                  <path d="M3 1h6v6M9 1L4 6" stroke={COLORS.textMuted} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-px">
                              <span className="text-[11px] font-medium px-1 py-px rounded" style={{ background: `${line.color}12`, color: line.color }}>
                                {getTypeLabel(d.type)}
                              </span>
                              <span className="text-[11px]" style={{ color: COLORS.textFaint }}>{getRelativeDate(d.date)}</span>
                              {d.url && d.url.includes("drive.google.com") && (
                                <span className="text-[11px] px-1 py-px rounded" style={{ background: "rgba(66,133,244,0.12)", color: "#4285f4" }}>PDF</span>
                              )}
                              {d.url && d.url.includes("docs.google.com/spreadsheets") && (
                                <span className="text-[11px] px-1 py-px rounded" style={{ background: "rgba(52,168,83,0.12)", color: "#34a853" }}>Sheet</span>
                              )}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Divider + Deliverables summary */}
      <div className="mt-2 mb-1.5" style={{ borderTop: `1px solid ${COLORS.borderSubtle}` }} />
      <div className="flex items-center gap-2">
        <AgentIcon type="clipboard" color={COLORS.textMuted} size={11} />
        <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
          {totalDeliverables} deliverables across {totalLanes} lanes — tap any lane to expand
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// AMBIENT GRADIENT HELPER
// ═══════════════════════════════════════════
function computeAmbientGradient(variant: ColorVariant): string {
  const gradients = variant.blobs.map((blob) => {
    return `radial-gradient(ellipse ${blob.size} at ${blob.position}, ${blob.color}, transparent)`;
  });
  return gradients.join(", ");
}

// ═══════════════════════════════════════════
// MAIN DASHBOARD PAGE
// ═══════════════════════════════════════════
const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: "tldr", label: "At a Glance" },
  { id: "kpis", label: "Stats" },
  { id: "agents-active", label: "Agent Network" },
  { id: "hub-connectors", label: "Hub & Connectors" },
  { id: "credits", label: "Credit Usage" },
  { id: "agents-planned", label: "Planned Lanes" },
  { id: "roadmap", label: "Roadmap" },
];

// Sections that default to expanded
const DEFAULT_OPEN_SECTIONS = new Set(["tldr", "kpis", "agents-active", "hub-connectors"]);

export default function Dashboard() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  const [sections, setSections] = useState<DashboardSection[]>(DEFAULT_SECTIONS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<string>("deep-space");
  const [density, setDensity] = useState<DensityLevel>("comfortable");
  const scale = DENSITY_SCALES[density];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const variant = COLOR_VARIANTS[activeVariant];

  // Shadow figures animation
  useShadowFigures(canvasRef, variant.shadowTint);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      setSections((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id);
        const newIndex = prev.findIndex((s) => s.id === over.id);
        const newOrder = arrayMove(prev, oldIndex, newIndex);
        return newOrder;
      });
    }
  }, []);

  const totalAgents = LANES.reduce((sum, l) => sum + l.agents.length, 0) + HUB_AGENTS.length;
  const activeAgents = LANES.reduce((sum, l) => sum + l.agents.filter(a => a.status === "active").length, 0) + HUB_AGENTS.filter(a => a.status === "active").length;

  const ambientGradient = computeAmbientGradient(variant);

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case "tldr":
        return <TLDRDigest />;
      case "kpis":
        return (
          <div className="animate-fade-in-up rounded-xl border flex items-center justify-between px-5 py-3 flex-wrap gap-y-2" style={{ ...GLASS }}>
            {[
              { label: "Agents", value: `${activeAgents}/${totalAgents}`, color: COLORS.teal, detail: "active" },
              { label: "Lanes", value: "2/4", color: COLORS.gold, detail: "active" },
              { label: "Tasks", value: "7", color: COLORS.purple, detail: "daily/weekly" },
              { label: "Connectors", value: "7/7", color: COLORS.green, detail: "linked" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
                {i > 0 && <div className="hidden sm:block w-px h-6" style={{ background: COLORS.border }} />}
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stat.color, boxShadow: `0 0 6px ${stat.color}50` }} />
                  <span className="text-xs font-medium" style={{ color: COLORS.textMuted }}>{stat.label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</span>
                  <span className="text-[11px] hidden sm:inline" style={{ color: COLORS.textFaint }}>{stat.detail}</span>
                </div>
              </div>
            ))}
          </div>
        );
      case "hub-connectors":
        return (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <HubAgentsCard />
              </div>
              <div className="lg:col-span-2 flex flex-col gap-4">
                <SystemStatusCard />
                <MiniCalendar />
              </div>
            </div>
            {/* System deliverables */}
            {getDeliverablesByLane("System").length > 0 && (
              <div className="rounded-xl border overflow-hidden" style={{ ...GLASS, borderColor: `${COLORS.teal}15` }}>
                <div className="px-5 pt-4 pb-2 relative">
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(to right, ${COLORS.teal}60, ${COLORS.teal}20)` }} />
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${COLORS.teal}10` }}>
                      <AgentIcon type="hub" color={COLORS.teal} size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold" style={{ color: COLORS.teal }}>System</h3>
                      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Core infrastructure and tracking</p>
                    </div>
                  </div>
                </div>
                <DeliverablesList laneName="System" laneColor={COLORS.teal} />
              </div>
            )}
          </div>
        );
      case "credits":
        return (
          <div className="max-w-2xl">
            <CreditUsageCard />
          </div>
        );
      case "agents-active":
        return (
          <div>
            <SectionHeader title="Agent Network" subtitle="Active lanes and their specialized agents" count={`${activeAgents} active / ${totalAgents} total`} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-3">
              {LANES.filter(l => l.status === "active").map((lane, i) => (
                <LaneGroup key={lane.id} lane={lane} delay={200 + i * 150} />
              ))}
            </div>
          </div>
        );
      case "agents-planned":
        return (
          <div>
            <SectionHeader title="Planned Lanes" subtitle="Coming in future versions" count={`${LANES.filter(l => l.status === "planned").length} lanes queued`} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-3">
              {LANES.filter(l => l.status === "planned").map((lane, i) => (
                <LaneGroup key={lane.id} lane={lane} delay={200 + i * 150} />
              ))}
            </div>
          </div>
        );
      case "roadmap":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BuildYourLifeOS />
            <EvolutionRoadmap />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: variant.bg }}>
      {/* Ambient gradient blobs — fixed behind everything */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: ambientGradient }} />

      {/* Shadow figures canvas — fixed, z-index 1 */}
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}
      />

      {/* Header — z-index 10 */}
      <Header activeVariant={activeVariant} onVariantChange={setActiveVariant} density={density} onDensityChange={setDensity} />

      {/* Main content — z-index 2, relative */}
      <main className="flex-1 overflow-y-auto p-6" style={{ position: "relative", zIndex: 2, overscrollBehavior: "contain" }}>
        <div className="max-w-[1400px] mx-auto flex flex-col transition-all duration-300" style={{ gap: `${scale * 16}px`, paddingLeft: `${scale * 16}px` }}>
          {/* Collapsible sections */}
          {sections.map((section) => (
            <CollapsibleSection
              key={section.id}
              id={section.id}
              label={section.label}
              defaultOpen={DEFAULT_OPEN_SECTIONS.has(section.id)}
            >
              {renderSection(section.id)}
            </CollapsibleSection>
          ))}

          {/* Footer */}
          <footer className="text-center py-4">
            <span className="text-[11px]" style={{ color: COLORS.textFaint }}>
              LifeOS v1.0 | Powered by{" "}
              <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: COLORS.textMuted }}>
                Perplexity Computer
              </a>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
