export const config = { maxDuration: 30 };

import { kvGet, kvSet } from '../lib/kv';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

// 5 hardcoded artists matching Ant's taste profile — for pipeline push validation only
const TEST_ARTISTS = [
  {
    name: "Tschabalala Self",
    location: "New York, USA",
    medium: "Painting, mixed media, fabric",
    score: 88,
    priceRange: "$30,000–$80,000",
    whyInteresting: "Self constructs large-scale figures exploring Black female identity through bold color and fabric collage. Her work combines painting with sewn elements, creating physically and psychologically intense portraits that resonate deeply with Bernard Studia's focus on diasporic narratives.",
    showsPress: "Frith Street Gallery (London), Pilar Corrias, exhibitions at ICA London 2023, Kunstmuseum Basel",
    instagram: "@tschabalabaself",
    website: "tschabalalaself.com",
    status: "Scouted",
  },
  {
    name: "Didier William",
    location: "Philadelphia, USA",
    medium: "Oil, acrylic, wood carving",
    score: 85,
    priceRange: "$15,000–$45,000",
    whyInteresting: "William carves directly into wooden panels before painting, creating layered surfaces dense with Haitian symbolism and diasporic memory. The psychological intensity of his multi-eyed figures and material process aligns precisely with Bernard Studia's aesthetic compass.",
    showsPress: "James Cohan Gallery, exhibitions at MoMA PS1, Museum of the African Diaspora 2024",
    instagram: "@didier_william",
    website: "didierwilliam.com",
    status: "Scouted",
  },
  {
    name: "Tomokazu Matsuyama",
    location: "New York, USA",
    medium: "Painting, mixed media",
    score: 81,
    priceRange: "$18,000–$60,000",
    whyInteresting: "Matsuyama fuses Japanese woodblock aesthetics with contemporary figurative painting, exploring cultural collision and identity through gestural, layered canvases. Strong collector base with consistent upward trajectory.",
    showsPress: "Sundaram Tagore Gallery, exhibitions in Tokyo, NYC, Hong Kong 2023–2024",
    instagram: "@matsuyamaart",
    website: "matsuyamaart.com",
    status: "Scouted",
  },
  {
    name: "Allison Gildersleeve",
    location: "New York, USA",
    medium: "Oil on canvas, abstraction",
    score: 77,
    priceRange: "$5,000–$18,000",
    whyInteresting: "Gildersleeve's atmospheric abstractions balance spontaneity and control, with layered fields of color that reward close looking. Early career with strong institutional interest — fits the $5K–$20K entry range with clear upside.",
    showsPress: "Denny Dimin Gallery NYC, exhibitions at NADA 2024, Aqua Art Miami",
    instagram: "@allisongildersleeve",
    website: "allisongildersleeve.com",
    status: "Scouted",
  },
  {
    name: "Calida Rawles",
    location: "Los Angeles, USA",
    medium: "Oil on canvas, figurative",
    score: 91,
    priceRange: "$40,000–$120,000",
    whyInteresting: "Rawles paints Black figures submerged in luminous water, creating transcendent works about freedom, vulnerability, and the body. Rapidly rising market with major institutional interest — worth tracking for advisory relationships even at higher price points.",
    showsPress: "Various gallery shows, Time Magazine coverage 2023, Gagosian radar, LACMA collection",
    instagram: "@calidarawles",
    website: "calidarawles.com",
    status: "Scouted",
  },
];

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!isCronAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    const snapshot = await kvGet('pipeline:snapshot');
    const existingArtists: any[] = snapshot?.artists ?? [];
    const existingNames = new Set(existingArtists.map((a: any) => a.name));

    const today = new Date().toISOString().split('T')[0];
    const newArtists = TEST_ARTISTS
      .filter(a => !existingNames.has(a.name))
      .map(a => ({
        sheetRow: 0,
        dateScouted: today,
        batch: `test-${today}`,
        link: a.website,
        antRating: '',
        hasDeepDive: false,
        deepDive: null,
        ...a,
      }));

    if (newArtists.length === 0) {
      return new Response(JSON.stringify({ success: true, added: 0, message: 'All test artists already in pipeline' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const updatedArtists = [...existingArtists, ...newArtists];
    const ok = await kvSet('pipeline:snapshot', {
      artists: updatedArtists,
      snapshotAt: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: ok, added: newArtists.length, artists: newArtists.map(a => a.name) }), {
      status: ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
