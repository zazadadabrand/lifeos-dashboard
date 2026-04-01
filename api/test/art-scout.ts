export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

// 5 pre-discovery artists matching Ant's taste profile — for pipeline push validation only
// These represent the TARGET tier: MFA recent grads, no gallery rep, sub-5K followers, direct sales
const TEST_ARTISTS = [
  {
    name: "Imani Shanklin Roberts",
    location: "Baltimore, USA",
    medium: "Oil on panel, figurative abstraction",
    score: 84,
    priceRange: "$800–$3,500",
    whyInteresting: "Roberts builds dense, layered oil paintings exploring memory, inherited trauma, and the Black interior. MICA MFA 2024 graduate with zero gallery representation — selling direct from her website. Psychological intensity and material conviction recall Schiele's line work fused with diasporic content.",
    showsPress: "MICA MFA Thesis Show 2024, Baltimore Open Studio 2024",
    instagram: "@imshanklin",
    website: "imanishanklin.com",
    status: "Scouted",
  },
  {
    name: "Ezra Benus",
    location: "New York, USA",
    medium: "Acrylic, collage, mixed media on canvas",
    score: 79,
    priceRange: "$600–$2,800",
    whyInteresting: "Benus layers found imagery, gestural mark-making, and text fragments to build canvases that feel like compressed personal mythology. Hunter College MFA 2025, no representation, selling via Instagram and direct studio visits. The collage logic and psychological density align with Bernard Studia's material-forward aesthetic.",
    showsPress: "Hunter MFA Open Studios 2025, Spring/Break Art Fair 2025 (group)",
    instagram: "@ezrabenus",
    website: "ezrabenus.cargo.site",
    status: "Scouted",
  },
  {
    name: "Salomé Chatriot",
    location: "Paris, France",
    medium: "Digital painting, print on textile",
    score: 76,
    priceRange: "$500–$2,000",
    whyInteresting: "Chatriot creates hyper-saturated, psychologically charged figurative works that bridge digital tools and physical textile. Under 3K followers, no representation, pricing at direct-sale entry level. Her work's intensity and cultural layering — North African and French — makes her a strong fit for Bernard Studia's global emerging radar.",
    showsPress: "École des Beaux-Arts de Paris graduate show 2024, online group show via Sediment Gallery 2025",
    instagram: "@salomechatriot",
    website: "salomechatriot.com",
    status: "Scouted",
  },
  {
    name: "Marcus Brutus",
    location: "Atlanta, USA",
    medium: "Oil and wax on canvas",
    score: 88,
    priceRange: "$1,200–$4,000",
    whyInteresting: "Atlanta-based Brutus encaustic-influenced paintings of suspended figures and fragmented Black masculine identity. Spelman/Morehouse adjacent arts community, no gallery, selling direct. The wax surface creates an otherworldly depth that rewards close looking — high conviction, high upside, pre-market.",
    showsPress: "Atlanta Black Arts Festival 2024 (group), WonderRoot residency alum 2023",
    instagram: "@marcusbrutusart",
    website: "marcusbrutus.com",
    status: "Scouted",
  },
  {
    name: "Yuki Tsuruta",
    location: "Chicago, USA",
    medium: "Ink, watercolor, mixed media on paper",
    score: 81,
    priceRange: "$400–$1,800",
    whyInteresting: "SAIC MFA 2024 graduate working with fluid ink and watercolor to build large-scale works about the body's relationship to landscape and grief. Under 2K followers, no gallery, pricing reflects true entry-level. The gestural restraint and emotional charge sit exactly in Bernard Studia's taste range.",
    showsPress: "SAIC MFA Thesis Exhibition 2024, EXPO Chicago New Voices section 2025",
    instagram: "@yukitsuruta.studio",
    website: "yukitsuruta.com",
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
