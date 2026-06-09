function studioEngineNormalizeTargetKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function studioEngineFindLayerByName(name) {
    const normalized = studioEngineNormalizeTargetKey(name);
    if (!normalized) return null;

    return [...layers].reverse().find(layer => {
        const layerName = studioEngineNormalizeTargetKey(layer.name || '');
        return layerName === normalized;
    }) || null;
}

function studioEngineResolveTargetId(target) {
    if (!target && target !== 0) return null;

    if (typeof target === 'object' && typeof target.id === 'string') {
        return layers.some(layer => layer.id === target.id) ? target.id : null;
    }

    const input = String(target).trim();
    if (!input) return null;

    if (layers.some(layer => layer.id === input)) {
        return input;
    }

    const aliases = window.StudioEngineSession?.buildAliases?.() || {};
    const normalized = studioEngineNormalizeTargetKey(input);

    if (aliases[normalized]) return aliases[normalized];
    if (aliases[input]) return aliases[input];

    const byName = studioEngineFindLayerByName(input);
    if (byName) return byName.id;

    return null;
}

function studioEngineResolveLayer(target) {
    const layerId = studioEngineResolveTargetId(target);
    if (!layerId) return null;
    return layers.find(layer => layer.id === layerId) || null;
}

window.StudioEngineTargets = {
    resolveTargetId: studioEngineResolveTargetId,
    resolveLayer: studioEngineResolveLayer
};
