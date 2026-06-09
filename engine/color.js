// ── Color helpers ──────────────────────────────────────────────────────────

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function numberOr(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

/** hex veya rgba string → {r,g,b,a} objesi */
function parseColor(colorStr) {
    if (!colorStr) return { r: 0, g: 0, b: 0, a: 255 };
    const c = colorStr.trim();
    // rgba(r,g,b,a)
    const rgbaMatch = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1]),
            g: parseInt(rgbaMatch[2]),
            b: parseInt(rgbaMatch[3]),
            a: rgbaMatch[4] !== undefined ? Math.round(parseFloat(rgbaMatch[4]) * 255) : 255
        };
    }
    // #rrggbb veya #rrggbbaa
    const hexMatch = c.match(/^#([0-9a-fA-F]{6,8})$/);
    if (hexMatch) {
        const h = hexMatch[1];
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
            a: h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255
        };
    }
    return { r: 0, g: 0, b: 0, a: 255 };
}

/** {r,g,b,a} → #rrggbbaa hex */
function colorToHex8(c) {
    const toH = v => v.toString(16).padStart(2, '0');
    return '#' + toH(c.r) + toH(c.g) + toH(c.b) + toH(c.a);
}

/** #rrggbbaa veya rgba → CSS rgba() string */
function colorToCSSRgba(c) {
    if (typeof c === 'string') c = parseColor(c);
    return `rgba(${c.r},${c.g},${c.b},${(c.a / 255).toFixed(3)})`;
}

/** Gradient string içindeki renkleri rgba destekli parse eder */
function parseGradientColors(gradStr) {
    if (!gradStr) return [];
    const colorRe = /rgba?\([^)]+\)|#[0-9a-fA-F]{6,8}/g;
    return gradStr.match(colorRe) || [];
}

function splitGradientArgs(input) {
    const parts = [];
    let current = '';
    let depth = 0;

    for (const char of String(input || '')) {
        if (char === '(') depth += 1;
        if (char === ')') depth = Math.max(0, depth - 1);

        if (char === ',' && depth === 0) {
            if (current.trim()) parts.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
}

function normalizeGradientStopColor(color) {
    if (typeof color !== 'string' || !color.trim()) return colorToCSSRgba('#3b82f6');
    const trimmed = color.trim();
    return trimmed.startsWith('#') ? colorToCSSRgba(trimmed) : trimmed;
}

function normalizeGradientPresetStops(stops, fallbackColors = [cwFgColor, cwBgColor]) {
    const normalizedStops = (Array.isArray(stops) ? stops : [])
        .map(stop => {
            const color = typeof stop?.color === 'string' ? stop.color.trim() : '';
            if (!color) return null;

            return {
                color,
                pos: clamp(numberOr(stop?.pos, 0), 0, 100)
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.pos - b.pos);

    if (normalizedStops.length >= 2) {
        return normalizedStops;
    }

    const fallback = (Array.isArray(fallbackColors) ? fallbackColors : [])
        .filter(color => typeof color === 'string' && color.trim())
        .slice(0, 2);

    if (fallback.length >= 2) {
        return [
            { color: fallback[0], pos: 0 },
            { color: fallback[1], pos: 100 }
        ];
    }

    return [];
}

function parseGradientPresetFromCss(gradStr, fallbackColors = [cwFgColor, cwBgColor]) {
    const fallback = normalizeGradientPresetStops([], fallbackColors);
    if (typeof gradStr !== 'string' || !gradStr.includes('gradient(')) {
        return {
            gradientType: 'linear',
            angle: 135,
            colors: fallback.map(stop => stop.color),
            stops: fallback
        };
    }

    const gradientType = gradStr.trim().startsWith('radial') ? 'radial' : 'linear';
    const openIndex = gradStr.indexOf('(');
    const closeIndex = gradStr.lastIndexOf(')');
    if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) {
        return {
            gradientType,
            angle: 135,
            colors: fallback.map(stop => stop.color),
            stops: fallback
        };
    }

    const inner = gradStr.slice(openIndex + 1, closeIndex);
    const args = splitGradientArgs(inner);
    let angle = 135;
    let stopArgs = args.slice();

    if (gradientType === 'linear' && stopArgs[0] && /deg/i.test(stopArgs[0])) {
        angle = clamp(numberOr(parseFloat(stopArgs[0]), 135), 0, 360);
        stopArgs = stopArgs.slice(1);
    } else if (gradientType === 'radial' && stopArgs[0]) {
        const firstPartHasColor = /rgba?\([^)]+\)|#[0-9a-fA-F]{6,8}/.test(stopArgs[0]);
        if (!firstPartHasColor) stopArgs = stopArgs.slice(1);
    }

    const rawStops = stopArgs.map((item, index) => {
        const colorMatch = item.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{6,8}/);
        if (!colorMatch) return null;
        const posMatch = item.match(/(-?\d+(?:\.\d+)?)%/);
        return {
            color: normalizeGradientStopColor(colorMatch[0]),
            pos: posMatch ? clamp(parseFloat(posMatch[1]), 0, 100) : null,
            index
        };
    }).filter(Boolean);

    if (rawStops.length < 2) {
        return {
            gradientType,
            angle,
            colors: fallback.map(stop => stop.color),
            stops: fallback
        };
    }

    const total = rawStops.length;
    const normalized = rawStops.map((stop, index) => ({
        color: stop.color,
        pos: stop.pos == null ? (total === 1 ? 0 : (index / (total - 1)) * 100) : stop.pos
    }));

    normalized.sort((a, b) => a.pos - b.pos);

    return {
        gradientType,
        angle,
        colors: normalized.map(stop => stop.color),
        stops: normalized
    };
}
