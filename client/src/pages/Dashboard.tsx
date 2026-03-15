import { useEffect, useState, useCallback, useRef } from "react";
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
// CREDIT USAGE DATA
// ═══════════════════════════════════════════
interface CreditEntry {
  agentId: string;
  agentName: string;
  icon: string;
  laneColor: string;
  laneName: string;
  creditsUsed: number;
  runs7d: number;
  avgPerRun: number;
  trend: "up" | "down" | "flat";
}

const CREDIT_DATA: CreditEntry[] = [
  { agentId: "interactive", agentName: "Interactive Sessions", icon: "hub", laneColor: COLORS.coral, laneName: "System", creditsUsed: 14200, runs7d: 45, avgPerRun: 316, trend: "up" },
  { agentId: "dashboard-build", agentName: "Dashboard Build", icon: "signal", laneColor: COLORS.teal, laneName: "System", creditsUsed: 4800, runs7d: 12, avgPerRun: 400, trend: "flat" },
  { agentId: "art-scout", agentName: "Art Scout", icon: "telescope", laneColor: COLORS.teal, laneName: "Art Advisory", creditsUsed: 1870, runs7d: 2, avgPerRun: 935, trend: "flat" },
  { agentId: "morning", agentName: "Morning Brief", icon: "sunrise", laneColor: COLORS.purple, laneName: "Hub", creditsUsed: 1540, runs7d: 14, avgPerRun: 110, trend: "down" },
  { agentId: "evening", agentName: "Evening Review", icon: "moon", laneColor: COLORS.purple, laneName: "Hub", creditsUsed: 1190, runs7d: 14, avgPerRun: 85, trend: "flat" },
  { agentId: "midday", agentName: "Midday Pulse", icon: "bolt", laneColor: COLORS.purple, laneName: "Hub", creditsUsed: 630, runs7d: 14, avgPerRun: 45, trend: "down" },
  { agentId: "design-critic", agentName: "Design Critic", icon: "telescope", laneColor: COLORS.teal, laneName: "System", creditsUsed: 450, runs7d: 1, avgPerRun: 450, trend: "flat" },
  { agentId: "art-taste", agentName: "Taste Engine", icon: "target", laneColor: COLORS.teal, laneName: "Art Advisory", creditsUsed: 420, runs7d: 6, avgPerRun: 70, trend: "up" },
  { agentId: "midnight-catalog", agentName: "Midnight Catalog", icon: "clipboard", laneColor: COLORS.teal, laneName: "System", creditsUsed: 350, runs7d: 14, avgPerRun: 25, trend: "flat" },
  { agentId: "siyah", agentName: "Siyah Agent", icon: "person", laneColor: COLORS.gold, laneName: "Family & Life", creditsUsed: 280, runs7d: 4, avgPerRun: 70, trend: "flat" },
  { agentId: "zoey", agentName: "Zoey Agent", icon: "person", laneColor: COLORS.gold, laneName: "Family & Life", creditsUsed: 240, runs7d: 10, avgPerRun: 24, trend: "flat" },
  { agentId: "kelli", agentName: "Kel'li Agent", icon: "handshake", laneColor: COLORS.gold, laneName: "Family & Life", creditsUsed: 180, runs7d: 6, avgPerRun: 30, trend: "flat" },
  { agentId: "wellness", agentName: "Wellness", icon: "pulse", laneColor: COLORS.gold, laneName: "Family & Life", creditsUsed: 120, runs7d: 4, avgPerRun: 30, trend: "flat" },
  { agentId: "sheet-archiver", agentName: "Sheet Archiver", icon: "clipboard", laneColor: COLORS.teal, laneName: "System", creditsUsed: 80, runs7d: 2, avgPerRun: 40, trend: "flat" },
];

const TOTAL_CREDITS_LIFETIME = CREDIT_DATA.reduce((sum, c) => sum + c.creditsUsed, 0);
const TOTAL_CREDITS_7D = Math.round(TOTAL_CREDITS_LIFETIME * 0.35); // ~35% used this week

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
// SCOUTED ARTISTS DATA + REVIEW COMPONENT
// ═══════════════════════════════════════════
interface ScoutedArtist {
  id: string;
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
  batch: string;
  dateScouted: string;
  rating: "approved" | "declined" | "pending";
}

const SCOUTED_ARTISTS_DATA: ScoutedArtist[] = [
  { id: "sa-1", name: "Napoles Marty", location: "Cuba / US", medium: "Sculptor, charred wood", score: 86, priceRange: "$5k–$15k", whyInteresting: "Charred wood guardians. Frieze LA Impact Prize 2026.", showsPress: "Frieze LA Impact Prize 2026, NXTHVN fellow", link: "", instagram: "https://www.instagram.com/napoles_marty/", website: "https://www.napolesmarty.com", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
  { id: "sa-2", name: "Kristy Hughes", location: "US", medium: "Mixed media sculptor", score: 79, priceRange: "$5k–$12k", whyInteresting: "Hispanic/Indigenous mixed media sculptor. Solo at Aldrich Museum.", showsPress: "Aldrich Museum solo, NXTHVN, Rema Hort Mann Grant", link: "", instagram: "", website: "https://www.kristyhughes.com", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
  { id: "sa-3", name: "Frantz Patrick Henry", location: "Haiti / US", medium: "Sculptor, site-specific", score: 73, priceRange: "$5k–$15k", whyInteresting: "Haitian sculptor, site-specific installations. Yale MFA.", showsPress: "Yale MFA, NXTHVN, James Cohan group show", link: "", instagram: "https://www.instagram.com/patrick_f._henry/", website: "https://frantzpatrickhenry.com", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
  { id: "sa-4", name: "Murjoni Merriweather", location: "US", medium: "Ceramic busts", score: 72, priceRange: "$5k–$7k", whyInteresting: "Ceramic busts celebrating Black culture. Christie's at $5K–$7K.", showsPress: "Christie's, Rubell Museum, BMA", link: "", instagram: "https://www.instagram.com/mvrjoni/", website: "https://www.mvrjoni.com", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
  { id: "sa-5", name: "Kayla Mattes", location: "US", medium: "Handwoven tapestries", score: 66, priceRange: "$5k–$12k", whyInteresting: "Handwoven tapestries of memes and digital culture.", showsPress: "Broad Museum solo, Fountainhead residency", link: "", instagram: "https://www.instagram.com/kaylamattes/", website: "https://kaylamattes.com", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
  { id: "sa-6", name: "Kimmah Dennis", location: "Liberia / US", medium: "Painter, displacement", score: 64, priceRange: "$5k–$10k", whyInteresting: "Liberian-Ivorian painter exploring Civil War displacement themes.", showsPress: "American Academy in Rome, Silver Art Projects", link: "", instagram: "https://www.instagram.com/kimmah_dennis/", website: "https://www.artsy.net/artist/kimmah-dennis", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
  { id: "sa-7", name: "Jaiquan Fayson", location: "US", medium: "Oil portraitist", score: 63, priceRange: "$3k–$8k", whyInteresting: "Formerly incarcerated, now art educator. Powerful oil portraits.", showsPress: "Silver Art Projects at WTC", link: "", instagram: "https://www.instagram.com/jaiquan_fayson/", website: "https://www.jaiquanfayson.com", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
  { id: "sa-8", name: "Dana-Marie Bullock", location: "Jamaica / US", medium: "Interdisciplinary, symbolic", score: 61, priceRange: "$3k–$8k", whyInteresting: "Jamaican interdisciplinary artist working with symbolic materials.", showsPress: "Silver Art Projects, Pratt MFA", link: "", instagram: "https://www.instagram.com/danamariebullock", website: "https://www.danamariebullock.com", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
  { id: "sa-9", name: "Delaina Doshi", location: "US", medium: "Tesserae quilts, porcelain", score: 60, priceRange: "$5k–$10k", whyInteresting: "Quilts from smashed porcelain. Fiberart International 2nd place.", showsPress: "Fiberart International 2025, Helen Frankenthaler Award", link: "", instagram: "https://www.instagram.com/delaina_doshi/", website: "https://www.delainadoshi.com/", batch: "Batch #2", dateScouted: "2026-03-14", rating: "pending" },
];

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

function ScoutedArtistsReview() {
  const [artists, setArtists] = useState<ScoutedArtist[]>(SCOUTED_ARTISTS_DATA);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "declined">("all");
  const [expanded, setExpanded] = useState(true);

  const handleRating = (id: string, rating: "approved" | "declined") => {
    setArtists(prev => prev.map(a => a.id === id ? { ...a, rating: a.rating === rating ? "pending" : rating } : a));
  };

  const filtered = filter === "all" ? artists : artists.filter(a => a.rating === filter);
  const counts = {
    all: artists.length,
    pending: artists.filter(a => a.rating === "pending").length,
    approved: artists.filter(a => a.rating === "approved").length,
    declined: artists.filter(a => a.rating === "declined").length,
  };

  return (
    <div className="mx-4 mb-3 rounded-lg border overflow-hidden" style={{ ...GLASS_ALT, borderColor: `${COLORS.teal}20` }}>
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2.5">
          <AgentIcon type="telescope" color={COLORS.teal} size={14} />
          <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: COLORS.teal }}>Scouted Artists</span>
          <span className="text-[11px] tabular-nums px-1.5 py-px rounded-full" style={{ background: `${COLORS.teal}15`, color: COLORS.teal }}>{artists.length}</span>
          {counts.pending > 0 && (
            <span className="text-[11px] px-1.5 py-px rounded-full" style={{ background: `${COLORS.gold}15`, color: COLORS.gold }}>{counts.pending} to review</span>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path d="M3 5.5L7 9.5L11 5.5" stroke={COLORS.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expandable content */}
      <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: expanded ? "3000px" : "0px", opacity: expanded ? 1 : 0 }}>
        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-4 pb-2">
          {(["all", "pending", "approved", "declined"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors capitalize"
              style={{
                background: filter === f ? `${COLORS.teal}15` : "transparent",
                color: filter === f ? COLORS.teal : COLORS.textFaint,
              }}
            >
              {f} {counts[f] > 0 && <span className="tabular-nums ml-0.5">({counts[f]})</span>}
            </button>
          ))}
        </div>

        {/* Artist cards */}
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {filtered.map((artist) => (
            <div
              key={artist.id}
              className="rounded-lg border p-3 flex gap-3 transition-all duration-200 group"
              style={{
                ...GLASS_ALT,
                borderColor: artist.rating === "approved" ? `${COLORS.green}30` : artist.rating === "declined" ? `${COLORS.chartRed}20` : COLORS.borderSubtle,
                opacity: artist.rating === "declined" ? 0.5 : 1,
              }}
            >
              {/* Score ring */}
              <div className="flex-shrink-0 pt-0.5">
                <ScoreRing score={artist.score} size={40} />
              </div>

              {/* Artist info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold" style={{ color: COLORS.textPrimary }}>{artist.name}</span>
                  <span className="text-[11px]" style={{ color: COLORS.textFaint }}>{artist.location}</span>
                  {artist.rating === "approved" && (
                    <span className="text-[11px] font-medium px-1.5 py-px rounded" style={{ background: `${COLORS.green}15`, color: COLORS.green }}>Approved</span>
                  )}
                  {artist.rating === "declined" && (
                    <span className="text-[11px] font-medium px-1.5 py-px rounded" style={{ background: `${COLORS.chartRed}15`, color: COLORS.chartRed }}>Declined</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium" style={{ color: COLORS.teal }}>{artist.medium}</span>
                  <span className="text-[11px] tabular-nums" style={{ color: COLORS.gold }}>{artist.priceRange}</span>
                </div>
                <p className="text-[11px] leading-relaxed mb-1" style={{ color: COLORS.textMuted }}>{artist.whyInteresting}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: COLORS.textFaint }}>{artist.showsPress}</span>
                </div>
                {/* External links */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  {artist.instagram && (
                    <a
                      href={artist.instagram}
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
                  {artist.website && (
                    <a
                      href={artist.website}
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
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-1.5 flex-shrink-0 justify-center">
                <button
                  onClick={() => handleRating(artist.id, "approved")}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200"
                  style={{
                    background: artist.rating === "approved" ? `${COLORS.green}20` : "transparent",
                    borderColor: artist.rating === "approved" ? COLORS.green : COLORS.borderSubtle,
                  }}
                  title="Approve"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8.5L6 12.5L14 4.5" stroke={artist.rating === "approved" ? COLORS.green : COLORS.textFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => handleRating(artist.id, "declined")}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200"
                  style={{
                    background: artist.rating === "declined" ? `${COLORS.chartRed}20` : "transparent",
                    borderColor: artist.rating === "declined" ? COLORS.chartRed : COLORS.borderSubtle,
                  }}
                  title="Decline"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke={artist.rating === "declined" ? COLORS.chartRed : COLORS.textFaint} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
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

      {/* Collapsible deliverables */}
      <DeliverablesList laneName={lane.name} laneColor={lane.color} />
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
// CREDIT USAGE CARD
// ═══════════════════════════════════════════
function CreditUsageCard() {
  const maxCredits = CREDIT_DATA[0].creditsUsed;

  const laneTotals = CREDIT_DATA.reduce((acc, c) => {
    acc[c.laneName] = (acc[c.laneName] || 0) + c.creditsUsed;
    return acc;
  }, {} as Record<string, number>);

  const laneColors: Record<string, string> = {
    "Hub": COLORS.purple,
    "Art Advisory": COLORS.teal,
    "Family & Life": COLORS.gold,
    "System": COLORS.coral,
  };

  return (
    <div
      className="animate-fade-in-up rounded-xl border overflow-hidden"
      style={{ ...GLASS, animationDelay: "300ms" }}
      data-testid="credit-usage"
    >
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${COLORS.chartRed}12` }}>
              <AgentIcon type="bars" color={COLORS.chartRed} size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Credit Usage</h3>
              <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Lifetime usage by category</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold tabular-nums" style={{ color: COLORS.chartRed }}>{TOTAL_CREDITS_LIFETIME.toLocaleString()}</span>
            <span className="text-[11px] block" style={{ color: COLORS.textFaint }}>total credits used</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 mb-4 flex-wrap">
          {Object.entries(laneTotals).sort((a, b) => b[1] - a[1]).map(([lane, total]) => (
            <div key={lane} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md" style={{ background: `${laneColors[lane] || COLORS.textFaint}12`, color: laneColors[lane] || COLORS.textMuted }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: laneColors[lane] || COLORS.textFaint }} />
              {lane}: <span className="font-semibold tabular-nums">{total.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-5 flex flex-col gap-2">
        {CREDIT_DATA.map((entry, i) => (
          <div key={entry.agentId} className="group animate-fade-in-up" style={{ animationDelay: `${400 + i * 50}ms` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <AgentIcon type={entry.icon} color={entry.laneColor} size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium" style={{ color: COLORS.textPrimary }}>{entry.agentName}</span>
                    <span className="text-[11px]" style={{ color: COLORS.textFaint }}>{entry.runs7d} runs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {entry.trend === "up" && <span className="text-[11px]" style={{ color: COLORS.chartRed }}>&#9650;</span>}
                    {entry.trend === "down" && <span className="text-[11px]" style={{ color: COLORS.green }}>&#9660;</span>}
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: COLORS.textPrimary }}>{entry.creditsUsed.toLocaleString()}</span>
                  </div>
                </div>
                <div className="h-[6px] rounded-full overflow-hidden" style={{ background: COLORS.border }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${(entry.creditsUsed / maxCredits) * 100}%`,
                      background: `linear-gradient(90deg, ${entry.laneColor}90, ${entry.laneColor})`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: COLORS.borderSubtle }}>
        <span className="text-[11px]" style={{ color: COLORS.textFaint }}>
          Top: Interactive Sessions ({CREDIT_DATA[0].creditsUsed.toLocaleString()}) · {CREDIT_DATA.length} categories tracked
        </span>
        <span className="text-[11px] font-medium" style={{ color: COLORS.textMuted }}>~{Math.round(TOTAL_CREDITS_7D / 7).toLocaleString()}/day avg</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CREDIT TREND + OPTIMIZATION SIDEBAR
// ═══════════════════════════════════════════
function CreditSidebar() {
  return (
    <div className="flex flex-col gap-4">
      <div className="animate-fade-in-up rounded-xl border p-5 flex flex-col gap-3" style={{ ...GLASS, animationDelay: "350ms" }}>
        <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Credit Trend</h3>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Sparkline data={[2800, 3200, 3600, 4100, 3900, 4200, 4500]} color={COLORS.chartRed} width={200} height={40} />
          </div>
          <div className="text-right">
            <span className="text-[11px] block" style={{ color: COLORS.textFaint }}>7-day trend</span>
            <span className="text-[11px] font-medium" style={{ color: COLORS.chartRed }}>&#9650; 12% vs prior week</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {[{ label: "Daily avg", value: `~${Math.round(TOTAL_CREDITS_7D / 7).toLocaleString()}`, color: COLORS.textPrimary }, { label: "Peak day", value: "Mon", color: COLORS.chartRed }, { label: "Lightest", value: "Sat", color: COLORS.green }].map(s => (
            <div key={s.label} className="flex-1 rounded-lg p-2.5 text-center" style={{ ...GLASS_ALT }}>
              <span className="text-[11px] block" style={{ color: COLORS.textFaint }}>{s.label}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="animate-fade-in-up rounded-xl border p-5" style={{ ...GLASS, animationDelay: "400ms" }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: COLORS.textPrimary }}>Optimization Tips</h3>
        <div className="flex flex-col gap-2">
          {[
            { tip: "Interactive sessions are your largest spend — batch similar tasks to reduce overhead", color: COLORS.coral },
            { tip: "Midday Pulse stays silent when nothing moves — saving ~40% vs always-notify", color: COLORS.green },
            { tip: "Dashboard builds are front-loaded — expect this category to drop as v1 stabilizes", color: COLORS.teal },
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: COLORS.textMuted }}>
              <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: t.color }} />
              {t.tip}
            </div>
          ))}
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
    id: "d-lifeos-concept",
    lane: "System",
    laneColor: COLORS.teal,
    icon: "hub",
    title: "LifeOS Concept & Architecture",
    type: "deep-dive",
    date: "2026-02-14",
    url: "https://perplexity.ai/search/29965905-6704-4f4d-b8bc-4f2532977f5b",
    summary: "Art advisory + crypto + ops lanes — the original LifeOS blueprint",
  },
  {
    id: "d-art-ar-agent",
    lane: "Art Advisory",
    laneColor: COLORS.teal,
    icon: "telescope",
    title: "Art A&R Agent Design",
    type: "deep-dive",
    date: "2026-03-12",
    url: "https://perplexity.ai/search/a7f774f3-bc82-4b15-9230-e8ea6ad765d4",
    summary: "Scoring rubric 0-100, show history weighting, taste learning via feedback",
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
    id: "d-evening-review",
    lane: "Hub",
    laneColor: COLORS.purple,
    icon: "moon",
    title: "Evening Review",
    type: "brief",
    date: "2026-03-13",
    url: "https://docs.google.com/spreadsheets/d/1mC_0HwGj8chqbfhc1rG1Tj6rL61D-aESuMjCUx2sXwk/edit",
    summary: "Day close, tomorrow preview, family check, wind down",
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
  {
    id: "d-finance-meme",
    lane: "Business",
    laneColor: COLORS.coral,
    icon: "signal",
    title: "Finance Meme Seeding Plan",
    type: "document",
    date: "2026-02-20",
    url: "https://perplexity.ai/search/2caff287-b0e5-4f2d-a120-38cf031895d9",
    summary: "Litquidity, OHWS, Trust Fund Terry — brief, asset flow, approval cadence",
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

function getDeliverablesByLane(laneName: string): Deliverable[] {
  return DELIVERABLES.filter(d => d.lane === laneName).sort((a, b) => b.date.localeCompare(a.date));
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
    color: COLORS.chartRed,
    status: `${TOTAL_CREDITS_LIFETIME.toLocaleString()} lifetime`,
    detail: `~${Math.round(TOTAL_CREDITS_7D / 7).toLocaleString()}/day avg · Interactive sessions highest (${CREDIT_DATA[0].creditsUsed.toLocaleString()})`,
  });

  const [expandedLane, setExpandedLane] = useState<string | null>(null);

  const toggleLane = (laneName: string | undefined) => {
    if (!laneName) return;
    const items = getDeliverablesByLane(laneName);
    if (items.length === 0) return;
    setExpandedLane(expandedLane === laneName ? null : laneName);
  };

  const totalDeliverables = DELIVERABLES.length;
  const totalLanes = new Set(DELIVERABLES.map(d => d.lane)).size;

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
  { id: "kpis", label: "Stats" },
  { id: "agents-active", label: "Agent Network" },
  { id: "hub-connectors", label: "Hub & Connectors" },
  { id: "credits", label: "Credit Usage" },
  { id: "agents-planned", label: "Planned Lanes" },
  { id: "roadmap", label: "Roadmap" },
];

// Sections that default to expanded
const DEFAULT_OPEN_SECTIONS = new Set(["kpis", "agents-active", "hub-connectors"]);

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
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <CreditUsageCard />
            </div>
            <div className="lg:col-span-2">
              <CreditSidebar />
            </div>
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
          {/* TL;DR Digest — always visible at top */}
          <TLDRDigest />

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
