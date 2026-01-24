"use strict";
/**
 * Product Auto-Tagging for Consultation Mode
 * Automatically tags products during sync with scenario_tags, mounting_type, and exclusion flags
 *
 * Build #10: Sustainable auto-tagging (no manual curation needed!)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductAutoTagger = void 0;
class ProductAutoTagger {
    /**
     * Tag product scenarios based on name, description, and category
     * Returns: ['commercial_bgm', 'home_cinema', 'conference', etc.]
     */
    static tagScenarios(product) {
        const tags = [];
        const nameUpper = product.product_name.toUpperCase();
        const descUpper = (product.description || '').toUpperCase();
        const categoryUpper = (product.category_name || '').toUpperCase();
        const combined = `${nameUpper} ${descUpper} ${categoryUpper}`;
        // Commercial BGM (Background Music) - 70V/100V systems
        if (combined.includes('70V') ||
            combined.includes('100V') ||
            combined.includes('COMMERCIAL') ||
            combined.includes('BACKGROUND MUSIC') ||
            combined.includes('BGM')) {
            tags.push('commercial_bgm');
        }
        // Home Cinema - Surround sound systems
        if (combined.includes('SURROUND') ||
            combined.includes('5.1') ||
            combined.includes('7.1') ||
            combined.includes('ATMOS') ||
            combined.includes('AV RECEIVER') ||
            combined.includes('AVR') ||
            combined.includes('HOME THEATER') ||
            combined.includes('HOME THEATRE') ||
            combined.includes('CINEMA') ||
            combined.includes('BOOKSHELF') ||
            combined.includes('FLOORSTAND') ||
            combined.includes('CENTER CHANNEL') ||
            combined.includes('SUBWOOFER')) {
            tags.push('home_cinema');
        }
        // Conference Room - Business AV
        if (combined.includes('CONFERENCE') ||
            combined.includes('MEETING') ||
            combined.includes('VIDEO CONFERENC') ||
            combined.includes('MIC ARRAY') ||
            combined.includes('PTZ CAMERA') ||
            combined.includes('SOUNDBAR') ||
            combined.includes('SPEAKERPHONE') ||
            combined.includes('COLLABORATION')) {
            tags.push('conference');
        }
        // Worship - Houses of worship audio
        if (combined.includes('WORSHIP') ||
            combined.includes('CHURCH') ||
            combined.includes('SANCTUARY') ||
            combined.includes('CHOIR') ||
            combined.includes('PULPIT')) {
            tags.push('worship');
        }
        // Restaurant - Specifically for food service
        if (combined.includes('RESTAURANT') ||
            combined.includes('CAFÉ') ||
            combined.includes('CAFE') ||
            combined.includes('DINING')) {
            tags.push('restaurant');
        }
        // Gym/Fitness
        if (combined.includes('GYM') ||
            combined.includes('FITNESS') ||
            combined.includes('WORKOUT') ||
            combined.includes('TRAINING')) {
            tags.push('gym');
        }
        // Club/Event - DJ, nightclub, live sound
        if (combined.includes('DJ') ||
            combined.includes('CLUB') ||
            combined.includes('EVENT') ||
            combined.includes('STAGE') ||
            combined.includes('LIVE SOUND') ||
            combined.includes('PA SYSTEM')) {
            tags.push('club');
        }
        return tags;
    }
    /**
     * Detect mounting type from product name/description
     * Returns: 'ceiling' | 'wall' | 'floor' | 'in-wall' | null
     */
    static detectMountingType(product) {
        const nameUpper = product.product_name.toUpperCase();
        const descUpper = (product.description || '').toUpperCase();
        const combined = `${nameUpper} ${descUpper}`;
        // Ceiling mounted
        if (combined.includes('CEILING') ||
            combined.includes('IN-CEILING') ||
            combined.includes('IN CEILING')) {
            return 'ceiling';
        }
        // Wall mounted
        if (combined.includes('WALL MOUNT') ||
            combined.includes('IN-WALL') ||
            combined.includes('IN WALL') ||
            combined.includes('ON-WALL') ||
            combined.includes('ON WALL')) {
            return 'wall';
        }
        // Floor standing
        if (combined.includes('FLOORSTAND') ||
            combined.includes('FLOOR STAND') ||
            combined.includes('TOWER') ||
            combined.includes('FLOOR SPEAKER')) {
            return 'floor';
        }
        // In-wall (different from wall-mount)
        if (combined.includes('IN-WALL') ||
            combined.includes('FLUSH MOUNT')) {
            return 'in-wall';
        }
        return null;
    }
    /**
     * Determine if product should be excluded from consultation mode
     * Excludes: brackets, cables, car audio, bluetooth party speakers, accessories
     */
    static shouldExcludeFromConsultation(product) {
        const nameUpper = product.product_name.toUpperCase();
        const descUpper = (product.description || '').toUpperCase();
        const categoryUpper = (product.category_name || '').toUpperCase();
        const combined = `${nameUpper} ${descUpper} ${categoryUpper}`;
        // Exclude mounting hardware
        if (combined.includes('BRACKET') ||
            combined.includes('MOUNT KIT') ||
            combined.includes('MOUNTING KIT') ||
            combined.includes('MOUNTING PLATE') ||
            combined.includes('WALL PLATE')) {
            return true;
        }
        // Exclude cables and connectors
        if (combined.includes('CABLE') ||
            combined.includes('WIRE') ||
            combined.includes('CONNECTOR') ||
            combined.includes('ADAPTER') ||
            combined.includes('PATCH CORD')) {
            return true;
        }
        // Exclude car audio
        if (categoryUpper.includes('CAR AUDIO') ||
            combined.includes('CAR AUDIO') ||
            combined.includes('AUTOMOTIVE') ||
            combined.includes('VEHICLE')) {
            return true;
        }
        // Exclude bluetooth party speakers (not professional)
        if (combined.includes('BLUETOOTH PARTY') ||
            combined.includes('PARTY SPEAKER') ||
            combined.includes('PORTABLE PARTY')) {
            return true;
        }
        // Exclude generic accessories
        // 🚨 FIX: Use word boundaries to avoid matching "STAND" in "FLOORSTANDING"
        if (combined.includes('COVER') ||
            combined.includes('DUST COVER') ||
            combined.includes('CHARGER') ||
            combined.includes('POWER SUPPLY')) {
            return true;
        }
        // Exclude speaker stands (but NOT floorstanding speakers!)
        // Must check that "STAND" is not part of "FLOORSTANDING" or "STANDMOUNT"
        if (combined.includes('STAND') &&
            !combined.includes('FLOORSTAND') &&
            !combined.includes('STANDMOUNT') &&
            !combined.includes('FLOOR STAND')) {
            return true;
        }
        return false;
    }
    /**
     * Auto-tag a product with all consultation mode fields
     * Call this during product sync in MCP servers
     */
    static autoTag(product) {
        return {
            scenario_tags: this.tagScenarios(product),
            mounting_type: this.detectMountingType(product),
            exclude_from_consultation: this.shouldExcludeFromConsultation(product),
        };
    }
}
exports.ProductAutoTagger = ProductAutoTagger;
exports.default = ProductAutoTagger;
//# sourceMappingURL=auto-tagger.js.map