import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * Valid component types for product classification
 */
export const COMPONENT_TYPES = [
  // Home Cinema
  "avr",              // AV Receivers (Denon, Marantz, Yamaha RX)
  "fronts",           // Floorstanding/Bookshelf speakers for L/R
  "center",           // Center channel speakers
  "surrounds",        // Surround/satellite speakers
  "subwoofer",        // Powered subwoofers
  // Amplifiers
  "amp",              // Streaming/Integrated Amplifiers (Sonos Amp, Yamaha WXA)
  "power_amp",        // Power Amplifiers (Crown, QSC, pro amps)
  // Speakers
  "ceiling_speakers", // In-ceiling/architectural speakers
  "outdoor_speakers", // Weatherproof outdoor speakers
  "wall_speakers",    // On-wall/surface mount speakers
  "pa_speakers",      // PA/Live sound speakers
  // Sources
  "source",           // Streamers/Network players (WiiM, Bluesound)
  "turntable",        // Turntables/Record players
  // Personal Audio
  "headphones",       // Headphones (over-ear, on-ear)
  "earphones",        // Earphones/IEMs
  // Pro Audio
  "microphone",       // Microphones (studio, live, wireless)
  "mixer",            // Mixing consoles/DJ mixers
  "interface",        // Audio interfaces
  // Video Conferencing
  "speakerphone",     // Conference speakerphones (Jabra Speak, Poly Sync)
  "conference_camera", // USB/PTZ cameras for conferencing (Logitech, AVer)
  "video_bar",        // All-in-one video bars (Poly Studio, Jabra PanaCast)
  "room_system",      // Complete room systems (Logitech Rally, Poly G7500)
  // Accessories
  "cable",            // Cables and interconnects
  "mount",            // Mounts, brackets, stands
  "accessory",        // General accessories
  // Other
  "lighting",         // Stage/DJ lighting
  "video",            // Video equipment (projectors, screens)
  "other",            // Uncategorized
] as const;

export type ComponentTypeClassification = typeof COMPONENT_TYPES[number];

// Lazy initialization to avoid build-time errors when API key isn't available
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Classify a single product using GPT-4o-mini (fast and cheap)
 */
export async function classifyProduct(
  productName: string,
  brand?: string | null,
  category?: string | null
): Promise<ComponentTypeClassification> {
  const prompt = `Classify this audio/video product. Reply with ONLY one of these exact codes:

avr, fronts, center, surrounds, subwoofer, amp, power_amp, ceiling_speakers, outdoor_speakers, wall_speakers, pa_speakers, source, turntable, headphones, earphones, microphone, mixer, interface, speakerphone, conference_camera, video_bar, room_system, cable, mount, accessory, lighting, video, other

Code meanings:
- avr = AV Receivers (Denon AVR, Marantz, Yamaha RX - home theater receivers with HDMI)
- fronts = Floorstanding/Bookshelf speakers (stereo L/R speakers)
- center = Center channel speakers
- surrounds = Surround/satellite speakers
- subwoofer = Powered subwoofers
- amp = Streaming/integrated amplifiers (Sonos Amp, Yamaha WXA)
- power_amp = Pro power amplifiers (Crown, QSC)
- ceiling_speakers = In-ceiling speakers
- outdoor_speakers = Outdoor speakers
- wall_speakers = On-wall speakers
- pa_speakers = PA/live sound speakers
- source = Network streamers (WiiM, Bluesound, Sonos Port)
- turntable = Turntables
- headphones = Over-ear/on-ear headphones
- earphones = In-ear earphones/IEMs
- microphone = Microphones (any type)
- mixer = Mixing consoles/DJ mixers
- interface = Audio interfaces (Focusrite, PreSonus)
- speakerphone = Conference speakerphones (Jabra Speak, Poly Sync)
- conference_camera = USB/PTZ conference cameras (Logitech Rally Cam, AVer)
- video_bar = All-in-one video bars (Poly Studio, Jabra PanaCast)
- room_system = Complete room conferencing systems
- cable = Cables (HDMI, speaker, RCA, XLR)
- mount = Mounts, brackets, stands
- accessory = Other accessories
- lighting = Stage/DJ lighting
- video = Projectors, screens
- other = None of the above

Product: ${productName}
Brand: ${brand || "Unknown"}

Reply with ONLY the code (e.g., "avr" or "amp" or "speakerphone"). Nothing else.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 20,
      temperature: 0,
    });

    const rawResult = response.choices[0].message.content;
    const result = rawResult?.trim().toLowerCase();

    console.log(`[Classifier] "${productName}" -> raw: "${rawResult}" -> cleaned: "${result}"`);

    // Validate the response is a valid type
    if (result && COMPONENT_TYPES.includes(result as ComponentTypeClassification)) {
      console.log(`[Classifier] ✓ Valid type: ${result}`);
      return result as ComponentTypeClassification;
    }

    console.log(`[Classifier] ✗ Invalid type "${result}", defaulting to "other". Valid types: ${COMPONENT_TYPES.slice(0, 5).join(", ")}...`);
    return "other";
  } catch (error: any) {
    console.error(`[Classifier] API Error for "${productName}":`, error.message || error);
    return "other";
  }
}

/**
 * Batch classify multiple products
 * Uses batching to reduce API calls
 */
export async function classifyProductsBatch(
  products: { id: string; name: string; brand?: string | null; category?: string | null }[]
): Promise<Map<string, ComponentTypeClassification>> {
  const results = new Map<string, ComponentTypeClassification>();

  // Process in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const classifications = await Promise.all(
      batch.map(async (product) => {
        const type = await classifyProduct(product.name, product.brand, product.category);
        return { id: product.id, type };
      })
    );

    for (const { id, type } of classifications) {
      results.set(id, type);
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Update a product's component_type in the database
 */
export async function updateProductComponentType(
  productId: string,
  componentType: ComponentTypeClassification
): Promise<boolean> {
  const supabase = getSupabaseServer();

  const { error } = await supabase
    .from("products")
    .update({ component_type: componentType })
    .eq("id", productId);

  if (error) {
    console.error(`Failed to update product ${productId}:`, error);
    return false;
  }

  return true;
}

/**
 * Classify and update a single product (used by triggers)
 */
export async function classifyAndUpdateProduct(
  productId: string,
  productName: string,
  brand?: string | null,
  category?: string | null
): Promise<ComponentTypeClassification> {
  const componentType = await classifyProduct(productName, brand, category);
  await updateProductComponentType(productId, componentType);
  return componentType;
}
