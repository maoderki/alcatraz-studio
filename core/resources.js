const CUSTOM_FONT_STORAGE_KEY = 'alcatraz_custom_google_fonts';
const GOOGLE_FONT_LINK_ID = 'studioGoogleFontsLink';

let SYSTEM_FONTS = [];
let FONTS = [];

function normalizeFontWeight(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.max(100, Math.min(900, Math.round(num / 100) * 100));
}

function normalizeFontEntry(font) {
    if (!font || typeof font !== 'object') return null;
    const family = typeof font.family === 'string' ? font.family.trim() : '';
    if (!family) return null;

    const weights = Array.isArray(font.weights)
        ? [...new Set(font.weights.map(normalizeFontWeight).filter(Boolean))].sort((a, b) => a - b)
        : [400];

    return {
        family,
        weights: weights.length ? weights : [400],
        category: typeof font.category === 'string' ? font.category : '',
        source: typeof font.source === 'string' ? font.source : 'local',
        previewText: typeof font.previewText === 'string' ? font.previewText : '',
        subsets: Array.isArray(font.subsets) ? [...new Set(font.subsets.filter(Boolean))] : []
    };
}

function mergeFontLists(...lists) {
    const merged = new Map();

    lists.flat().forEach(font => {
        const normalized = normalizeFontEntry(font);
        if (!normalized) return;
        const key = normalized.family.toLowerCase();
        const existing = merged.get(key);
        if (!existing) {
            merged.set(key, normalized);
            return;
        }

        existing.weights = [...new Set([...existing.weights, ...normalized.weights])].sort((a, b) => a - b);
        existing.subsets = [...new Set([...(existing.subsets || []), ...(normalized.subsets || [])])];
        if (!existing.category && normalized.category) existing.category = normalized.category;
        if ((!existing.previewText || !existing.previewText.trim()) && normalized.previewText) existing.previewText = normalized.previewText;
        if (existing.source !== 'custom' && normalized.source === 'custom') existing.source = 'custom';
    });

    return [...merged.values()].sort((a, b) => a.family.localeCompare(b.family, 'tr'));
}

function readCustomFonts() {
    try {
        const raw = localStorage.getItem(CUSTOM_FONT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(normalizeFontEntry).filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function writeCustomFonts(fonts) {
    localStorage.setItem(CUSTOM_FONT_STORAGE_KEY, JSON.stringify(fonts));
}

function syncFontRegistry() {
    const customFonts = readCustomFonts();
    FONTS = mergeFontLists(SYSTEM_FONTS, customFonts);
    injectGoogleFonts();
}

fetch('data/fonts.json').then(r => r.json()).then(data => {
    SYSTEM_FONTS = Array.isArray(data) ? data.map(normalizeFontEntry).filter(Boolean) : [];
    syncFontRegistry();
});

let SWATCHES = [];
fetch('data/swatches.json').then(r => r.json()).then(data => {
    SWATCHES = data;
});

function injectGoogleFonts() {
    const existingLink = document.getElementById(GOOGLE_FONT_LINK_ID);
    if (existingLink) existingLink.remove();
    if (!FONTS.length) return;

    const families = FONTS.map(f => {
        const weights = f.weights.join(';');
        return `family=${encodeURIComponent(f.family)}:wght@${weights}`;
    }).join('&');
    const link = document.createElement('link');
    link.id = GOOGLE_FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
}

function getFontWeightOptions(fontFamily) {
    const font = FONTS.find(f => f.family === fontFamily);
    if (!font) return [{ value: 400, label: 'Regular' }];
    const labels = { 100:'Thin',200:'ExtraLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold',900:'Black' };
    return font.weights.map(w => ({ value: w, label: labels[w] || String(w) }));
}

function addCustomGoogleFont(font) {
    const normalized = normalizeFontEntry({
        ...font,
        source: 'custom'
    });
    if (!normalized) return false;

    const customFonts = readCustomFonts();
    const merged = mergeFontLists(customFonts, [normalized]).filter(item => item.source === 'custom');
    writeCustomFonts(merged);
    syncFontRegistry();

    if (typeof renderContextBar === 'function') renderContextBar();
    if (typeof refreshInspectorFlyoutIfNeeded === 'function') refreshInspectorFlyoutIfNeeded();
    return true;
}

function getCustomGoogleFonts() {
    return readCustomFonts();
}

window.addCustomGoogleFont = addCustomGoogleFont;
window.getCustomGoogleFonts = getCustomGoogleFonts;
