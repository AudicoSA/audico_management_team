/**
 * Product Knowledge Base
 * Contains structured knowledge about audio equipment categories,
 * compatibility rules, and use case recommendations.
 * This helps the specialist agent make informed recommendations.
 */

export const PRODUCT_KNOWLEDGE = {
  /**
   * Component type definitions
   * Describes what each component type IS and ISN'T
   */
  componentTypes: {
    avr: {
      description: "AV Receivers - Multi-channel receivers for home cinema with HDMI inputs, surround sound decoding (Dolby Atmos, DTS:X), and room correction.",
      examples: ["Denon AVR-X2800H", "Marantz Cinema 70s", "Yamaha RX-V6A", "Denon AVR-S760H"],
      NOT: ["stereo amplifiers", "soundbars", "streaming amplifiers", "commercial amplifiers"],
      compatibility: "Works with passive speakers (4-16 ohm). Connect subwoofer via LFE output. HDMI 2.1 for 4K/120Hz gaming.",
    },
    amp: {
      description: "Streaming Amplifiers - Compact amplifiers with built-in WiFi/Bluetooth for powering passive speakers in single or multi-room setups.",
      examples: ["Sonos Amp", "Yamaha WXA-50", "Yamaha MusicCast Amp", "Denon HEOS Amp"],
      NOT: ["AV receivers", "active speakers", "PA amplifiers", "headphone amplifiers"],
      compatibility: "Typically 2-channel. Drives 4-8 ohm passive speakers. Most have 50-125W per channel. Can bridge for mono in some models.",
    },
    fronts: {
      description: "Front Speakers - Floorstanding or bookshelf speakers for the main left/right channels. The most important speakers in a home cinema system.",
      examples: ["Klipsch RP-8000F", "Bowers & Wilkins 603", "KEF Q950", "DALI Oberon 7"],
      NOT: ["center speakers", "surround speakers", "ceiling speakers", "subwoofers", "outdoor speakers"],
      compatibility: "Match impedance (usually 4-8 ohm) with AVR. For best results, keep same brand/series for all speakers.",
    },
    center: {
      description: "Center Channel Speakers - Dedicated speaker for dialogue in movies/TV. Should match the timbre of front speakers.",
      examples: ["Klipsch RP-504C", "Bowers & Wilkins HTM6", "KEF Q650c", "DALI Oberon Vokal"],
      NOT: ["floorstanding speakers", "bookshelf speakers", "soundbars", "subwoofers"],
      compatibility: "MUST match brand/series with front speakers for consistent sound. Place above or below TV, angled toward listening position.",
    },
    surrounds: {
      description: "Surround Speakers - Speakers for side/rear channels. Can be bookshelf, in-ceiling, or dedicated surround speakers.",
      examples: ["Klipsch RP-502S", "Bowers & Wilkins M-1", "KEF Q150", "DALI Oberon On-Wall"],
      NOT: ["center speakers", "floorstanding speakers", "subwoofers", "main speakers"],
      compatibility: "Match brand with fronts. Monopole for direct sound, bipole/dipole for diffuse. In-ceiling works well for Atmos height channels.",
    },
    subwoofer: {
      description: "Powered Subwoofers - Active subwoofers with built-in amplification for deep bass. Essential for home cinema LFE channel.",
      examples: ["SVS PB-1000 Pro", "REL T/7i", "Klipsch SPL-120", "BK Electronics Gemini II"],
      NOT: ["passive subwoofers", "Sonos Sub (wireless)", "Denon Home Subwoofer (wireless)", "soundbar subs"],
      compatibility: "Connect via LFE cable from AVR. Match power to room size. For home cinema, avoid wireless/smart subs that only work with specific ecosystems.",
    },
    ceiling_speakers: {
      description: "In-Ceiling Speakers - Architectural speakers that mount flush in the ceiling for discreet background music or Atmos height channels.",
      examples: ["Bose FS2CE", "Sonance VP66R", "Klipsch CDT-5650-C II", "JBL Control 26CT"],
      NOT: ["outdoor speakers", "floorstanding speakers", "PA speakers", "active speakers"],
      compatibility: "Most are passive (need amplifier). 8-ohm standard. For commercial, consider 70V/100V line for long cable runs. Backboxes recommended for fire-rated ceilings.",
    },
    ceiling_speakers_z2: {
      description: "Zone 2 Ceiling Speakers - Same as ceiling_speakers, for a secondary zone.",
      examples: ["Bose FS2CE", "Sonance VP66R", "Klipsch CDT-5650-C II", "JBL Control 26CT"],
      NOT: ["outdoor speakers", "floorstanding speakers", "PA speakers", "active speakers"],
      compatibility: "Most are passive (need amplifier). 8-ohm standard. For commercial, consider 70V/100V line for long cable runs.",
    },
    outdoor_speakers: {
      description: "Outdoor/Weatherproof Speakers - Speakers rated for outdoor use with UV and moisture resistance.",
      examples: ["Sonos Outdoor", "Klipsch AWR-650-SM", "Sonance Mariner", "JBL Control 25-1"],
      NOT: ["ceiling speakers", "indoor speakers", "home cinema speakers"],
      compatibility: "Must be weatherproof rated. Consider 70V for commercial. Use outdoor-rated speaker cable. Some are active (Sonos Outdoor) and don't need separate amp.",
    },
    wall_speakers: {
      description: "On-Wall/Surface Mount Speakers - Speakers that mount on walls for commercial or home installations.",
      examples: ["JBL Control 28-1", "Bose DS 40SE", "QSC AD-S82", "Tannoy DVS 4"],
      NOT: ["in-ceiling speakers", "floorstanding speakers", "PA speakers on stands"],
      compatibility: "Most are passive. Check mounting brackets included. Consider cable routing before installation.",
    },
    source: {
      description: "Network Streamers/Sources - Devices that stream music from services or local files, outputting to an amplifier.",
      examples: ["WiiM Pro Plus", "Bluesound Node", "Sonos Port", "Cambridge Audio CXN"],
      NOT: ["amplifiers", "speakers", "DACs without streaming", "CD players"],
      compatibility: "Output via analog RCA, digital coax/optical, or HDMI. WiiM and Bluesound have excellent app support. Consider if you need built-in DAC or external.",
    },
  },

  /**
   * Brand ecosystem rules
   * Which brands work well together
   */
  brandEcosystems: {
    sonos: {
      compatible: ["Sonos", "Sonance (architectural)"],
      notes: "Sonos Amp works with any passive speakers. Sonos ecosystem speakers (Era, Move, etc.) are standalone.",
    },
    klipsch: {
      compatible: ["Klipsch", "Onkyo", "Pioneer"],
      notes: "Klipsch speakers have high sensitivity, work well with most receivers. Reference Premiere series is flagship.",
    },
    bw: {
      compatible: ["Bowers & Wilkins", "Rotel", "Classé"],
      notes: "Premium brand. 600/700 series for home cinema. Formation for wireless.",
    },
    denon: {
      compatible: ["Denon", "Marantz", "Polk", "Definitive Technology"],
      notes: "Denon and Marantz are same company (Sound United). HEOS ecosystem for multi-room.",
    },
    yamaha: {
      compatible: ["Yamaha", "NS series speakers"],
      notes: "MusicCast ecosystem for multi-room. YPAO room correction in AVRs.",
    },
  },

  /**
   * Use case specific recommendations
   */
  useCases: {
    home_cinema_51: {
      description: "5.1 Home Cinema System",
      components: ["avr", "fronts", "center", "surrounds", "subwoofer"],
      budgetSplit: {
        avr: 0.25,
        fronts: 0.30,
        center: 0.10,
        surrounds: 0.10,
        subwoofer: 0.25,
      },
      tips: [
        "Match all speaker brands for consistent timbre",
        "AVR should have room correction (Audyssey, YPAO, Dirac)",
        "Subwoofer placement matters - corner loading increases bass",
      ],
    },
    home_cinema_71: {
      description: "7.1 Home Cinema System",
      components: ["avr", "fronts", "center", "surrounds", "surrounds", "subwoofer"],
      budgetSplit: {
        avr: 0.25,
        fronts: 0.25,
        center: 0.10,
        surrounds: 0.15,
        subwoofer: 0.25,
      },
      tips: [
        "Need AVR with 7+ channels",
        "Side and rear surrounds for full immersion",
        "Consider Atmos height speakers for future expansion",
      ],
    },
    commercial_bgm_single: {
      description: "Single Zone Commercial Background Music",
      components: ["amp", "ceiling_speakers"],
      budgetSplit: {
        amp: 0.40,
        ceiling_speakers: 0.60,
      },
      tips: [
        "Sonos Amp is popular for ease of use",
        "2-4 ceiling speakers for small cafe/shop",
        "Consider power handling and SPL for venue size",
      ],
    },
    commercial_bgm_multizone: {
      description: "Multi-Zone Commercial Background Music",
      components: ["amp", "amp", "ceiling_speakers", "outdoor_speakers"],
      budgetSplit: {
        amp: 0.40,
        ceiling_speakers: 0.30,
        outdoor_speakers: 0.30,
      },
      tips: [
        "Each zone needs separate amp for independent control",
        "Consider 70V/100V for large venues",
        "Outdoor speakers must be weatherproof rated",
      ],
    },
  },
};
