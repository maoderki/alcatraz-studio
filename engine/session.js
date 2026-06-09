const STUDIO_ENGINE_VERSION = '0.1.1';

let studioEngineRevision = 0;
let studioEngineSessionSeed = 0;
const studioEngineSessions = new Map();

function studioEngineClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function studioEngineMakeSessionId() {
    studioEngineSessionSeed += 1;
    return `sess_${Date.now().toString(36)}_${studioEngineSessionSeed.toString(36)}`;
}

function studioEngineGetLayerIndexItem(layer) {
    if (!layer) return null;
    const item = {
        id: layer.id,
        type: layer.type,
        name: layer.name || layer.id,
        x: Math.round(Number(layer.x) || 0),
        y: Math.round(Number(layer.y) || 0),
        w: Math.round(Number(layer.width) || 0),
        h: Math.round(Number(layer.height) || 0),
        visible: layer.visible !== false,
        locked: layer.locked === true
    };

    if (layer.type === 'text') item.text = String(layer.text || '').slice(0, 120);
    if (layer.type === 'shape') item.fill = layer.fill || '';
    if (layer.type === 'raster') item.src = layer.src ? '[asset]' : '';

    return item;
}

function studioEngineBuildAliases() {
    const aliasMap = {};
    const selectedLayer = layers.find(layer => layer.id === selectedId) || null;
    const lastText = [...layers].reverse().find(layer => layer.type === 'text') || null;
    const lastShape = [...layers].reverse().find(layer => layer.type === 'shape') || null;
    const lastRaster = [...layers].reverse().find(layer => layer.type === 'raster') || null;
    const topmost = layers.at(-1) || null;
    const bottommost = layers[0] || null;
    const background = layers.find(layer => {
        const name = String(layer.name || '').toLowerCase();
        return name.includes('background') || name.includes('arka plan') || name.includes('bg');
    }) || bottommost || null;

    if (selectedLayer) aliasMap.selected = selectedLayer.id;
    if (lastText) aliasMap.last_text = lastText.id;
    if (lastShape) aliasMap.last_shape = lastShape.id;
    if (lastRaster) aliasMap.last_raster = lastRaster.id;
    if (topmost) aliasMap.topmost = topmost.id;
    if (topmost) aliasMap.top_layer = topmost.id;
    if (topmost) aliasMap.last_layer = topmost.id;
    if (bottommost) aliasMap.bottommost = bottommost.id;
    if (bottommost) aliasMap.bottom_layer = bottommost.id;
    if (bottommost) aliasMap.first_layer = bottommost.id;
    if (background) aliasMap.background = background.id;

    return aliasMap;
}

function studioEngineGetContext(options = {}) {
    const level = options.level || 'index';
    const aliases = studioEngineBuildAliases();
    const base = {
        engineVersion: STUDIO_ENGINE_VERSION,
        revision: studioEngineRevision,
        projectName,
        canvas: {
            width: canvasWidth,
            height: canvasHeight
        },
        selection: {
            selectedId,
            selectedIds: studioEngineClone(selectedIds || [])
        },
        aliases
    };

    if (level === 'full') {
        return {
            ...base,
            layers: studioEngineClone(layers)
        };
    }

    if (level === 'targets') {
        const rawTargets = Array.isArray(options.targets) ? options.targets : [];
        const targetIds = new Set();
        rawTargets.forEach(target => {
            if (typeof target === 'string' && aliases[target]) {
                targetIds.add(aliases[target]);
                return;
            }
            if (typeof target === 'string') {
                targetIds.add(target);
            }
        });

        return {
            ...base,
            layers: layers
                .filter(layer => targetIds.has(layer.id))
                .map(layer => studioEngineClone(layer))
        };
    }

    return {
        ...base,
        layerIndex: layers.map(studioEngineGetLayerIndexItem).filter(Boolean)
    };
}

function studioEngineStartSession(options = {}) {
    const sessionId = studioEngineMakeSessionId();
    const session = {
        id: sessionId,
        client: options.client || 'internal',
        createdAt: new Date().toISOString(),
        lastRevision: studioEngineRevision
    };

    studioEngineSessions.set(sessionId, session);

    return {
        sessionId,
        context: studioEngineGetContext({ level: options.level || 'index' })
    };
}

function studioEngineBumpRevision() {
    studioEngineRevision += 1;
    return studioEngineRevision;
}

function studioEngineSetRevision(nextRevision) {
    studioEngineRevision = Math.max(0, Number(nextRevision) || 0);
}

window.StudioEngineSession = {
    start: studioEngineStartSession,
    getContext: studioEngineGetContext,
    getRevision() {
        return studioEngineRevision;
    },
    setRevision: studioEngineSetRevision,
    bumpRevision: studioEngineBumpRevision,
    buildAliases: studioEngineBuildAliases
};
