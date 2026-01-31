import type { Step, ComponentType } from "@/lib/types";

/**
 * Step definitions for 7.1 Home Cinema with ceiling surrounds
 */
export const STEPS_HOME_CINEMA_7_1: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "avr",
    label: "AV Receiver",
    description: "7.1+ channel receiver with room correction and HDMI 2.1",
    searchQuery: "denon marantz yamaha av receiver 7.1 surround atmos",
    budget: { min: 15000, max: 60000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "fronts",
    label: "Front Speakers",
    description: "Floorstanding or bookshelf speakers for left/right channels",
    searchQuery: "floorstanding speakers home cinema pair",
    budget: { min: 15000, max: 80000 },
    quantity: 1, // 1 pair
    packageCovers: ["fronts", "center", "surrounds"] as ComponentType[],
  },
  {
    id: 3,
    component: "center",
    label: "Center Channel",
    description: "Center speaker for clear dialogue (should match front speakers)",
    searchQuery: "center channel speaker home cinema",
    budget: { min: 5000, max: 25000 },
    quantity: 1,
    skipIfPackage: true,
  },
  {
    id: 4,
    component: "surrounds",
    label: "Surround Speakers",
    description: "4 surround speakers for immersive sound (2 pairs)",
    searchQuery: "surround speaker ceiling in-ceiling bookshelf",
    budget: { min: 6000, max: 30000 },
    quantity: 2, // 2 pairs for 7.1
    skipIfPackage: true,
  },
  {
    id: 5,
    component: "subwoofer",
    label: "Subwoofer",
    description: "Powered subwoofer for deep bass",
    searchQuery: "subwoofer powered home cinema",
    budget: { min: 8000, max: 35000 },
    quantity: 1,
  },
];

/**
 * Step definitions for 5.1 Home Cinema
 */
export const STEPS_HOME_CINEMA_5_1: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "avr",
    label: "AV Receiver",
    description: "5.1 channel receiver with room correction",
    searchQuery: "denon marantz yamaha av receiver 5.1 surround",
    budget: { min: 8000, max: 35000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "fronts",
    label: "Front Speakers",
    description: "Floorstanding or bookshelf speakers for left/right channels",
    searchQuery: "floorstanding speakers home cinema pair",
    budget: { min: 10000, max: 50000 },
    quantity: 1,
    packageCovers: ["fronts", "center", "surrounds"] as ComponentType[],
  },
  {
    id: 3,
    component: "center",
    label: "Center Channel",
    description: "Center speaker for clear dialogue",
    searchQuery: "center channel speaker home cinema",
    budget: { min: 3000, max: 20000 },
    quantity: 1,
    skipIfPackage: true,
  },
  {
    id: 4,
    component: "surrounds",
    label: "Surround Speakers",
    description: "2 surround speakers for rear channels (1 pair)",
    searchQuery: "surround speaker bookshelf satellite",
    budget: { min: 3000, max: 15000 },
    quantity: 1, // 1 pair for 5.1
    skipIfPackage: true,
  },
  {
    id: 5,
    component: "subwoofer",
    label: "Subwoofer",
    description: "Powered subwoofer for bass",
    searchQuery: "subwoofer powered home cinema",
    budget: { min: 5000, max: 25000 },
    quantity: 1,
  },
];

/**
 * Step definitions for 5.1.2 Home Cinema (Dolby Atmos with 2 height speakers)
 */
export const STEPS_HOME_CINEMA_5_1_2: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "avr",
    label: "AV Receiver",
    description: "7+ channel receiver with Dolby Atmos support for 5.1.2 configuration",
    searchQuery: "denon marantz yamaha av receiver atmos 7.1 dolby",
    budget: { min: 12000, max: 45000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "fronts",
    label: "Front Speakers",
    description: "Floorstanding or bookshelf speakers for left/right channels",
    searchQuery: "floorstanding speakers home cinema pair",
    budget: { min: 10000, max: 50000 },
    quantity: 1,
    packageCovers: ["fronts", "center", "surrounds"] as ComponentType[],
  },
  {
    id: 3,
    component: "center",
    label: "Center Channel",
    description: "Center speaker for clear dialogue",
    searchQuery: "center channel speaker home cinema",
    budget: { min: 3000, max: 20000 },
    quantity: 1,
    skipIfPackage: true,
  },
  {
    id: 4,
    component: "surrounds",
    label: "Surround Speakers",
    description: "2 surround speakers for rear channels (1 pair)",
    searchQuery: "surround speaker bookshelf satellite",
    budget: { min: 3000, max: 15000 },
    quantity: 1,
    skipIfPackage: true,
  },
  {
    id: 5,
    component: "subwoofer",
    label: "Subwoofer",
    description: "Powered subwoofer for bass",
    searchQuery: "subwoofer powered home cinema",
    budget: { min: 5000, max: 25000 },
    quantity: 1,
  },
  {
    id: 6,
    component: "height",
    label: "Height/Atmos Speakers",
    description: "2 height speakers for overhead Dolby Atmos effects (1 pair)",
    searchQuery: "atmos height speaker ceiling in-ceiling dolby overhead",
    budget: { min: 3000, max: 15000 },
    quantity: 1, // 1 pair = 2 speakers
  },
];

/**
 * Step definitions for 5.1.4 Home Cinema (Dolby Atmos with 4 height speakers)
 */
export const STEPS_HOME_CINEMA_5_1_4: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "avr",
    label: "AV Receiver",
    description: "9+ channel receiver with Dolby Atmos support for 5.1.4 configuration",
    searchQuery: "denon marantz yamaha av receiver atmos 9.1 dolby 11 channel",
    budget: { min: 18000, max: 80000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "fronts",
    label: "Front Speakers",
    description: "Floorstanding or bookshelf speakers for left/right channels",
    searchQuery: "floorstanding speakers home cinema pair",
    budget: { min: 15000, max: 60000 },
    quantity: 1,
    packageCovers: ["fronts", "center", "surrounds"] as ComponentType[],
  },
  {
    id: 3,
    component: "center",
    label: "Center Channel",
    description: "Center speaker for clear dialogue",
    searchQuery: "center channel speaker home cinema",
    budget: { min: 5000, max: 25000 },
    quantity: 1,
    skipIfPackage: true,
  },
  {
    id: 4,
    component: "surrounds",
    label: "Surround Speakers",
    description: "2 surround speakers for rear channels (1 pair)",
    searchQuery: "surround speaker bookshelf satellite",
    budget: { min: 4000, max: 18000 },
    quantity: 1,
    skipIfPackage: true,
  },
  {
    id: 5,
    component: "subwoofer",
    label: "Subwoofer",
    description: "Powered subwoofer for bass",
    searchQuery: "subwoofer powered home cinema",
    budget: { min: 8000, max: 35000 },
    quantity: 1,
  },
  {
    id: 6,
    component: "height",
    label: "Height/Atmos Speakers",
    description: "4 height speakers for overhead Dolby Atmos effects (2 pairs)",
    searchQuery: "atmos height speaker ceiling in-ceiling dolby overhead",
    budget: { min: 6000, max: 25000 },
    quantity: 2, // 2 pairs = 4 speakers
  },
];

/**
 * Step definitions for 7.1.2 Home Cinema (Dolby Atmos with 2 height speakers)
 */
export const STEPS_HOME_CINEMA_7_1_2: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "avr",
    label: "AV Receiver",
    description: "9+ channel receiver with Dolby Atmos support for 7.1.2 configuration",
    searchQuery: "denon marantz yamaha av receiver atmos 9.1 dolby",
    budget: { min: 18000, max: 70000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "fronts",
    label: "Front Speakers",
    description: "Floorstanding or bookshelf speakers for left/right channels",
    searchQuery: "floorstanding speakers home cinema pair",
    budget: { min: 15000, max: 80000 },
    quantity: 1,
    packageCovers: ["fronts", "center", "surrounds"] as ComponentType[],
  },
  {
    id: 3,
    component: "center",
    label: "Center Channel",
    description: "Center speaker for clear dialogue",
    searchQuery: "center channel speaker home cinema",
    budget: { min: 5000, max: 25000 },
    quantity: 1,
    skipIfPackage: true,
  },
  {
    id: 4,
    component: "surrounds",
    label: "Surround Speakers",
    description: "4 surround speakers for immersive sound (2 pairs)",
    searchQuery: "surround speaker ceiling in-ceiling bookshelf",
    budget: { min: 6000, max: 30000 },
    quantity: 2,
    skipIfPackage: true,
  },
  {
    id: 5,
    component: "subwoofer",
    label: "Subwoofer",
    description: "Powered subwoofer for deep bass",
    searchQuery: "subwoofer powered home cinema",
    budget: { min: 8000, max: 35000 },
    quantity: 1,
  },
  {
    id: 6,
    component: "height",
    label: "Height/Atmos Speakers",
    description: "2 height speakers for overhead Dolby Atmos effects (1 pair)",
    searchQuery: "atmos height speaker ceiling in-ceiling dolby overhead",
    budget: { min: 4000, max: 18000 },
    quantity: 1, // 1 pair = 2 speakers
  },
];

/**
 * Step definitions for 7.1.4 Home Cinema (Dolby Atmos with 4 height speakers)
 */
export const STEPS_HOME_CINEMA_7_1_4: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "avr",
    label: "AV Receiver",
    description: "11+ channel receiver with Dolby Atmos support for 7.1.4 configuration",
    searchQuery: "denon marantz yamaha av receiver atmos 11 channel dolby premium",
    budget: { min: 25000, max: 100000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "fronts",
    label: "Front Speakers",
    description: "Floorstanding speakers for left/right channels (premium)",
    searchQuery: "floorstanding speakers home cinema pair premium tower",
    budget: { min: 20000, max: 100000 },
    quantity: 1,
    packageCovers: ["fronts", "center", "surrounds"] as ComponentType[],
  },
  {
    id: 3,
    component: "center",
    label: "Center Channel",
    description: "Center speaker for clear dialogue (should match fronts)",
    searchQuery: "center channel speaker home cinema premium",
    budget: { min: 8000, max: 35000 },
    quantity: 1,
    skipIfPackage: true,
  },
  {
    id: 4,
    component: "surrounds",
    label: "Surround Speakers",
    description: "4 surround speakers for immersive sound (2 pairs)",
    searchQuery: "surround speaker ceiling in-ceiling bookshelf premium",
    budget: { min: 8000, max: 40000 },
    quantity: 2,
    skipIfPackage: true,
  },
  {
    id: 5,
    component: "subwoofer",
    label: "Subwoofer",
    description: "Powered subwoofer for deep bass",
    searchQuery: "subwoofer powered home cinema premium",
    budget: { min: 12000, max: 50000 },
    quantity: 1,
  },
  {
    id: 6,
    component: "height",
    label: "Height/Atmos Speakers",
    description: "4 height speakers for overhead Dolby Atmos effects (2 pairs)",
    searchQuery: "atmos height speaker ceiling in-ceiling dolby overhead premium",
    budget: { min: 8000, max: 35000 },
    quantity: 2, // 2 pairs = 4 speakers
  },
];

/**
 * Step definitions for Commercial Background Music (Single Zone)
 */
export const STEPS_COMMERCIAL_BGM_SINGLE: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "amp",
    label: "Amplifier",
    description: "Streaming amplifier for your venue. Modern amps like Sonos Amp have WiFi/Bluetooth built-in.",
    searchQuery: "sonos amp amplifier yamaha musiccast streaming",
    budget: { min: 5000, max: 25000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "ceiling_speakers",
    label: "Ceiling Speakers",
    description: "In-ceiling or pendant speakers for background music",
    searchQuery: "ceiling speaker in-ceiling pendant bose tannoy",
    budget: { min: 3000, max: 20000 },
    quantity: 2, // 2 pairs for small venue
  },
];

/**
 * Step definitions for Commercial Background Music (Multi-Zone with Indoor + Outdoor)
 * NOTE: For 2 zones with separate control, you need EITHER:
 * - 2x Sonos Amps (each drives one zone)
 * - OR 1x multi-channel amp with A/B outputs
 * - OR 1x 100V line amp with volume controllers per zone
 */
export const STEPS_COMMERCIAL_BGM_MULTIZONE: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "amp",
    label: "Zone 1 Amplifier (Indoor)",
    description: "Amplifier for your main indoor zone. For independent zone control, you'll need a second amp for outdoor.",
    searchQuery: "sonos amp amplifier yamaha musiccast",
    budget: { min: 10000, max: 30000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "amp",
    label: "Zone 2 Amplifier (Outdoor)",
    description: "Second amplifier for your outdoor zone. This gives you independent volume and source control per zone.",
    searchQuery: "sonos amp amplifier yamaha musiccast",
    budget: { min: 10000, max: 30000 },
    quantity: 1,
  },
  {
    id: 3,
    component: "ceiling_speakers",
    label: "Indoor Speakers",
    description: "Ceiling or pendant speakers for the main indoor zone",
    searchQuery: "ceiling speaker in-ceiling pendant bose tannoy",
    budget: { min: 5000, max: 25000 },
    quantity: 2, // 2 pairs
  },
  {
    id: 4,
    component: "outdoor_speakers",
    label: "Outdoor Speakers",
    description: "Weatherproof speakers for patio/outdoor zone",
    searchQuery: "outdoor speaker weatherproof patio sonos klipsch",
    budget: { min: 5000, max: 20000 },
    quantity: 1, // 1 pair
  },
];

/**
 * Step definitions for Commercial Background Music (Indoor only, Multi-Zone)
 * For separate indoor zones, you need separate amps per zone
 */
export const STEPS_COMMERCIAL_BGM_MULTIZONE_INDOOR: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "amp",
    label: "Zone 1 Amplifier",
    description: "Amplifier for your main zone. Each zone needs its own amp for independent control.",
    searchQuery: "sonos amp amplifier yamaha musiccast",
    budget: { min: 10000, max: 30000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "amp",
    label: "Zone 2 Amplifier",
    description: "Second amplifier for independent zone control.",
    searchQuery: "sonos amp amplifier yamaha musiccast",
    budget: { min: 10000, max: 30000 },
    quantity: 1,
  },
  {
    id: 3,
    component: "ceiling_speakers",
    label: "Zone 1 Speakers",
    description: "Ceiling or pendant speakers for the main zone",
    searchQuery: "ceiling speaker in-ceiling pendant bose tannoy",
    budget: { min: 5000, max: 25000 },
    quantity: 2,
  },
  {
    id: 4,
    component: "ceiling_speakers_z2",
    label: "Zone 2 Speakers",
    description: "Speakers for the second zone (can match zone 1 or be different)",
    searchQuery: "ceiling speaker in-ceiling bose tannoy",
    budget: { min: 3000, max: 15000 },
    quantity: 2,
  },
];

/**
 * Legacy single step set (for backward compatibility)
 */
export const STEPS_COMMERCIAL_BGM = STEPS_COMMERCIAL_BGM_SINGLE;

/**
 * Step definitions for Gym/Club (High Power)
 */
export const STEPS_COMMERCIAL_LOUD: Omit<Step, "status">[] = [
  {
    id: 1,
    component: "amp",
    label: "Power Amplifier",
    description: "High-power amplifier for loud playback",
    searchQuery: "power amplifier professional PA commercial high power",
    budget: { min: 10000, max: 50000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "wall_speakers",
    label: "Main Speakers",
    description: "PA speakers or high-output wall speakers",
    searchQuery: "PA speaker professional wall mount high power",
    budget: { min: 15000, max: 60000 },
    quantity: 2, // Pairs
  },
  {
    id: 3,
    component: "subwoofer",
    label: "Subwoofer",
    description: "Professional subwoofer for deep bass",
    searchQuery: "subwoofer professional PA commercial powered",
    budget: { min: 10000, max: 40000 },
    quantity: 1,
  },
  {
    id: 4,
    component: "source",
    label: "Audio Source",
    description: "DJ mixer or media player",
    searchQuery: "DJ mixer media player commercial bluetooth",
    budget: { min: 3000, max: 20000 },
    quantity: 1,
  },
];

/**
 * Options for commercial BGM scenario
 */
export interface CommercialBGMOptions {
  zoneCount?: number;
  hasOutdoor?: boolean;
  venueSize?: "small" | "medium" | "large";
}

/**
 * Get step definitions for a given scenario
 */
export function getStepsForScenario(
  type: string,
  channels?: string,
  commercialOptions?: CommercialBGMOptions
): Omit<Step, "status">[] {
  switch (type) {
    case "home_cinema":
      // Check for Atmos configs first (with height speakers)
      if (channels === "7.1.4") {
        return STEPS_HOME_CINEMA_7_1_4;
      } else if (channels === "7.1.2") {
        return STEPS_HOME_CINEMA_7_1_2;
      } else if (channels === "5.1.4") {
        return STEPS_HOME_CINEMA_5_1_4;
      } else if (channels === "5.1.2") {
        return STEPS_HOME_CINEMA_5_1_2;
      } else if (channels === "7.1" || channels === "9.1") {
        return STEPS_HOME_CINEMA_7_1;
      }
      return STEPS_HOME_CINEMA_5_1;

    case "commercial_bgm":
    case "commercial_bgm_details":
      // Select steps based on zone configuration
      const zones = commercialOptions?.zoneCount || 1;
      const hasOutdoor = commercialOptions?.hasOutdoor || false;

      if (zones >= 2 && hasOutdoor) {
        // Multi-zone with outdoor (e.g., restaurant with patio)
        return STEPS_COMMERCIAL_BGM_MULTIZONE;
      } else if (zones >= 2) {
        // Multi-zone indoor only
        return STEPS_COMMERCIAL_BGM_MULTIZONE_INDOOR;
      } else {
        // Single zone
        return STEPS_COMMERCIAL_BGM_SINGLE;
      }

    case "commercial_loud":
      return STEPS_COMMERCIAL_LOUD;

    default:
      return STEPS_HOME_CINEMA_5_1;
  }
}

/**
 * Initialize steps with status
 */
export function initializeSteps(
  stepDefinitions: Omit<Step, "status">[]
): Step[] {
  return stepDefinitions.map((step, index) => ({
    ...step,
    status: index === 0 ? "current" : "pending",
  }));
}
