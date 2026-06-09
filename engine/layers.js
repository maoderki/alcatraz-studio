const uid = () => 'layer_' + Math.random().toString(36).slice(2, 10);
const getLayer = (id = selectedId) => layers.find(x => x.id === id) || null;
const getSelectedLayerIds = () => studioEngineNormalizeSelection(selectedIds?.length ? selectedIds : (selectedId ? [selectedId] : []));
const normalizeZ = () => layers.forEach((x, i) => x.z = i + 1);
const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getLayerTypeIcon = (type) => ({
    text: 'fa-font',
    shape: 'fa-square',
    raster: 'fa-image',
    group: 'fa-folder',
}[type] || 'fa-layer-group');

function isFontAwesomeLayer(layer) {
    return !!(layer && layer.type === 'text' && typeof layer.fontAwesomeClass === 'string' && layer.fontAwesomeClass.trim());
}

function mergeLayerStyle(base, patch) {
    const output = { ...base };
    Object.keys(base).forEach(key => {
        const baseValue = base[key];
        const patchValue = patch?.[key];
        if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
            output[key] = { ...baseValue, ...(patchValue && typeof patchValue === 'object' ? patchValue : {}) };
        } else if (patchValue !== undefined) {
            output[key] = patchValue;
        }
    });
    return output;
}

function getLayerStyle(layer) {
    return mergeLayerStyle(createDefaultLayerStyle(), layer?.layerStyle || {});
}

function withAlpha(color, opacity = 100) {
    const parsed = typeof parseColor === 'function'
        ? parseColor(color)
        : { r: 59, g: 130, b: 246, a: 255 };
    parsed.a = Math.round((Math.max(0, Math.min(100, Number(opacity) || 0)) / 100) * 255);
    return typeof colorToCSSRgba === 'function'
        ? colorToCSSRgba(parsed)
        : `rgba(${parsed.r},${parsed.g},${parsed.b},${parsed.a / 255})`;
}

function multiplyAlpha(color, opacity = 100) {
    const parsed = typeof parseColor === 'function'
        ? parseColor(color)
        : { r: 59, g: 130, b: 246, a: 255 };
    const baseAlpha = Math.max(0, Math.min(255, Number(parsed.a) || 0));
    const opacityRatio = Math.max(0, Math.min(100, Number(opacity) || 0)) / 100;
    parsed.a = Math.round(baseAlpha * opacityRatio);
    return typeof colorToCSSRgba === 'function'
        ? colorToCSSRgba(parsed)
        : `rgba(${parsed.r},${parsed.g},${parsed.b},${parsed.a / 255})`;
}

function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
