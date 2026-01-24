"use strict";
/**
 * Use Case Classifier for Products
 * Automatically categorizes products based on name, category, and brand
 *
 * Use Cases:
 * - Home: Residential/consumer products
 * - Commercial: Business/retail/hospitality
 * - Office: Conference/boardroom
 * - Club: DJ/PA/nightclub
 * - Both: Works in multiple contexts
 * - car_audio: Always excluded from consultations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyUseCase = classifyUseCase;
exports.shouldExcludeFromConsultation = shouldExcludeFromConsultation;
// Keywords for each use case category
const USE_CASE_KEYWORDS = {
    car_audio: [
        // Must check first - always excluded
        'car ', 'car-', 'vehicle', 'marine', 'boat', 'automotive',
        'car speaker', 'car amp', 'car subwoofer', 'car audio',
        'marine speaker', 'boat speaker', '12v', 'car stereo',
        'head unit', 'car receiver', 'car component', 'coaxial car',
        'underseat', 'under-seat', 'car tweeter', 'car woofer'
    ],
    Office: [
        // Video conferencing and boardroom
        'conference', 'conferencing', 'video bar', 'videobar',
        'speakerphone', 'speaker phone', 'usb microphone', 'usb mic',
        'webcam', 'boardroom', 'meeting room', 'huddle',
        'teams', 'zoom', 'webex', 'collaboration',
        'ptz camera', 'ptz', 'document camera',
        'logitech rally', 'logitech meetup', 'poly', 'polycom',
        'yealink', 'jabra speak', 'jabra panacast',
        'neat bar', 'owl', 'meeting owl'
    ],
    Club: [
        // PA, DJ, and nightclub
        'pa speaker', 'pa system', 'powered speaker', 'active speaker',
        'dj ', 'dj-', 'party speaker', 'partybox', 'party box',
        'club speaker', 'nightclub', 'disco', 'stage monitor',
        'line array', 'subwoofer 18', 'subwoofer 15', 'sub 18', 'sub 15',
        'jbl eon', 'jbl prx', 'jbl srx', 'jbl vrx',
        'qsc k', 'qsc kw', 'qsc ks', 'ev elx', 'ev zlx', 'ev etx',
        'electro-voice', 'electrovoice', 'rcf art', 'rcf nx',
        'yamaha dxr', 'yamaha dxs', 'yamaha dbr',
        'mackie srm', 'mackie thump', 'behringer eurolive',
        'alto ts', 'alto truesonic', 'pioneer dj', 'denon dj',
        'numark', 'rane', 'serato', 'mixer dj', 'dj controller',
        'cdj', 'turntable', 'scratch', 'battle mixer'
    ],
    Commercial: [
        // Ceiling, 70V/100V, retail/restaurant
        'ceiling speaker', 'in-ceiling', 'in ceiling', 'inceiling',
        'pendant speaker', 'pendant mount', 'surface mount speaker',
        '70v', '100v', '70 volt', '100 volt', 'constant voltage',
        'commercial amplifier', 'commercial amp', 'mixer amplifier',
        'paging', 'paging system', 'background music', 'bgm',
        'restaurant', 'retail', 'hospitality', 'shop speaker',
        'store speaker', 'gym speaker', 'fitness',
        'outdoor speaker', 'garden speaker', 'patio speaker',
        'weatherproof', 'weather-proof', 'ip65', 'ip66', 'ip67',
        'jbl control', 'jbl css', 'jbl vma', 'bose ds',
        'bose freespace', 'bose edgemax', 'bose designmax',
        'toa', 'atlas', 'community', 'apart', 'audac',
        'install speaker', 'installation speaker', 'fixed install'
    ],
    Home: [
        // Consumer/residential
        'floorstanding', 'floor standing', 'tower speaker', 'floor-standing',
        'bookshelf speaker', 'bookshelf', 'shelf speaker',
        'av receiver', 'a/v receiver', 'home theater', 'home theatre',
        'home cinema', 'surround sound', '5.1', '7.1', '5.1.2', '7.1.4',
        'atmos', 'dolby atmos', 'dtsx', 'dts:x',
        'soundbar', 'sound bar', 'soundbase',
        'subwoofer home', 'home subwoofer', 'powered sub',
        'center channel', 'centre channel', 'center speaker',
        'satellite speaker', 'surround speaker',
        'denon avr', 'marantz', 'yamaha rx', 'onkyo',
        'klipsch', 'kef', 'bowers', 'b&w', 'focal', 'dali',
        'svs', 'rel', 'monitor audio', 'wharfedale', 'q acoustics',
        'sonos', 'heos', 'musiccast', 'hi-fi', 'hifi', 'hi fi',
        'stereo receiver', 'integrated amplifier', 'turntable',
        'vinyl', 'record player', 'phono'
    ],
    Both: [
        // Versatile - can work in multiple contexts
        'portable speaker', 'bluetooth speaker', 'wireless speaker',
        'powered monitor', 'studio monitor', 'near field',
        'multimedia speaker', 'desktop speaker', 'computer speaker',
        'all-in-one', 'smart speaker'
    ]
};
// Brand associations for tie-breaking
const BRAND_USE_CASE = {
    // Home audio brands
    'denon': 'Home',
    'marantz': 'Home',
    'onkyo': 'Home',
    'klipsch': 'Home',
    'kef': 'Home',
    'bowers & wilkins': 'Home',
    'b&w': 'Home',
    'focal': 'Home',
    'dali': 'Home',
    'svs': 'Home',
    'rel': 'Home',
    'monitor audio': 'Home',
    'wharfedale': 'Home',
    'q acoustics': 'Home',
    'sonos': 'Home',
    'cambridge audio': 'Home',
    'nad': 'Home',
    'rotel': 'Home',
    'arcam': 'Home',
    // Office/conferencing brands
    'logitech': 'Office',
    'poly': 'Office',
    'polycom': 'Office',
    'yealink': 'Office',
    'jabra': 'Office',
    'neat': 'Office',
    'owl labs': 'Office',
    'crestron': 'Office',
    'extron': 'Office',
    // DJ/Club brands
    'pioneer dj': 'Club',
    'denon dj': 'Club',
    'numark': 'Club',
    'rane': 'Club',
    'allen & heath': 'Club',
    // Commercial install brands
    'toa': 'Commercial',
    'atlas': 'Commercial',
    'community': 'Commercial',
    'apart': 'Commercial',
    'audac': 'Commercial',
    // Car audio brands
    'jl audio': 'car_audio',
    'kicker': 'car_audio',
    'rockford fosgate': 'car_audio',
    'alpine': 'car_audio',
    'kenwood': 'car_audio',
    'pioneer car': 'car_audio',
    'jvc': 'car_audio',
    'hertz': 'car_audio',
    'focal car': 'car_audio'
};
// Category name mappings
const CATEGORY_USE_CASE = {
    'car audio': 'car_audio',
    'marine audio': 'car_audio',
    'vehicle audio': 'car_audio',
    'conferencing': 'Office',
    'video conferencing': 'Office',
    'collaboration': 'Office',
    'boardroom': 'Office',
    'pa speakers': 'Club',
    'dj equipment': 'Club',
    'live sound': 'Club',
    'pro audio': 'Club',
    'ceiling speakers': 'Commercial',
    'installation': 'Commercial',
    'commercial audio': 'Commercial',
    '70v': 'Commercial',
    '100v': 'Commercial',
    'home theater': 'Home',
    'home cinema': 'Home',
    'hi-fi': 'Home',
    'floorstanding': 'Home',
    'bookshelf': 'Home',
    'av receivers': 'Home',
    'soundbars': 'Home',
    'turntables': 'Home'
};
/**
 * Classify a product into a use case category
 */
function classifyUseCase(input) {
    const searchText = [
        input.productName,
        input.categoryName,
        input.description
    ].filter(Boolean).join(' ').toLowerCase();
    const brand = (input.brand || '').toLowerCase();
    const category = (input.categoryName || '').toLowerCase();
    // 1. Check category name first (most reliable)
    for (const [catKey, useCase] of Object.entries(CATEGORY_USE_CASE)) {
        if (category.includes(catKey)) {
            return useCase;
        }
    }
    // 2. Check for car_audio first (always excluded)
    for (const keyword of USE_CASE_KEYWORDS.car_audio) {
        if (searchText.includes(keyword.toLowerCase())) {
            return 'car_audio';
        }
    }
    // 3. Check brand associations
    for (const [brandKey, useCase] of Object.entries(BRAND_USE_CASE)) {
        if (brand.includes(brandKey) || searchText.includes(brandKey)) {
            return useCase;
        }
    }
    // 4. Score each use case by keyword matches
    const scores = {
        Home: 0,
        Commercial: 0,
        Office: 0,
        Club: 0,
        Both: 0,
        car_audio: 0
    };
    for (const [useCase, keywords] of Object.entries(USE_CASE_KEYWORDS)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword.toLowerCase())) {
                scores[useCase] += 1;
            }
        }
    }
    // Find highest scoring use case
    let maxScore = 0;
    let result = 'Home'; // Default to Home if no matches
    for (const [useCase, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            result = useCase;
        }
    }
    // If no strong signal, default to Home (consumer products)
    if (maxScore === 0) {
        return 'Home';
    }
    return result;
}
/**
 * Check if a product should be excluded from AI consultations
 * (car_audio products are always excluded)
 */
function shouldExcludeFromConsultation(useCase) {
    return useCase === 'car_audio';
}
exports.default = { classifyUseCase, shouldExcludeFromConsultation };
//# sourceMappingURL=use-case-classifier.js.map