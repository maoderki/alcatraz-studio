function alignSelectedToCanvas(mode) {
    const layer = getLayer();
    if (!layer) return;
    const patch = {};
    if (mode === 'left') patch.x = 0;
    if (mode === 'center') patch.x = Math.round((canvasWidth - layer.width) / 2);
    if (mode === 'right') patch.x = Math.round(canvasWidth - layer.width);
    if (mode === 'top') patch.y = 0;
    if (mode === 'middle') patch.y = Math.round((canvasHeight - layer.height) / 2);
    if (mode === 'bottom') patch.y = Math.round(canvasHeight - layer.height);
    applyLayerPatchViaEngine(layer.id, patch, {
        historyMode: 'immediate',
        refreshLayerList: true,
        refreshInspector: true,
        refreshContextBar: true
    });
    renderContextBar();
}

function nudgeSelectedLayer(dx, dy, options = {}) {
    const layer = getLayer();
    if (!layer) return false;

    const offsetX = Number(dx) || 0;
    const offsetY = Number(dy) || 0;
    if (!offsetX && !offsetY) return false;

    applyLayerPatchViaEngine(layer.id, {
        x: layer.x + offsetX,
        y: layer.y + offsetY
    }, {
        skipHistory: !!options.skipHistory,
        historyMode: options.historyMode,
        refreshInspector: true,
        refreshContextBar: true
    });
    renderTransformOverlay();
    refreshInspectorFlyoutIfNeeded();
    renderContextBar();
    return true;
}

function toggleSelectedAspectLock() {
    const layer = getLayer();
    if (!layer || (layer.type !== 'raster' && layer.type !== 'shape')) return;
    applyLayerPatchViaEngine(layer.id, { aspectLocked: !layer.aspectLocked }, {
        refreshInspector: true,
        refreshContextBar: true
    });
    refreshInspectorFlyoutIfNeeded();
    renderContextBar();
}

function updateSelectedDimension(dimension, rawValue) {
    const layer = getLayer();
    if (!layer || (dimension !== 'width' && dimension !== 'height')) return;

    if (rawValue === '' || rawValue === null || rawValue === undefined) return;

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) return;

    const nextValue = parsedValue;
    const canLockAspect = (layer.type === 'raster' || layer.type === 'shape') && layer.aspectLocked;
    const patch = { [dimension]: nextValue };

    if (canLockAspect) {
        const ratio = layer.width / layer.height || 1;
        if (dimension === 'width') patch.height = nextValue / ratio;
        else patch.width = nextValue * ratio;
    }

    applyLayerPatchViaEngine(layer.id, patch, {
        refreshInspector: true,
        refreshContextBar: true
    });
    renderTransformOverlay();
    refreshInspectorFlyoutIfNeeded();

    const widthInput = document.getElementById('ctx_transform_width');
    const heightInput = document.getElementById('ctx_transform_height');
    if (widthInput) widthInput.value = String(Math.round(layer.width));
    if (heightInput) heightInput.value = String(Math.round(layer.height));
}

function finalizeSelectedDimension(dimension, rawValue) {
    const layer = getLayer();
    if (!layer || (dimension !== 'width' && dimension !== 'height')) return;

    if (rawValue === '' || rawValue === null || rawValue === undefined) {
        const widthInput = document.getElementById('ctx_transform_width');
        const heightInput = document.getElementById('ctx_transform_height');
        if (widthInput) widthInput.value = String(Math.round(layer.width));
        if (heightInput) heightInput.value = String(Math.round(layer.height));
        return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        const widthInput = document.getElementById('ctx_transform_width');
        const heightInput = document.getElementById('ctx_transform_height');
        if (widthInput) widthInput.value = String(Math.round(layer.width));
        if (heightInput) heightInput.value = String(Math.round(layer.height));
        return;
    }

    updateSelectedDimension(dimension, Math.max(0.000001, parsedValue));
}

function selectLayer(id) {
    if (typeof applyLayerSelection === 'function') {
        applyLayerSelection(id ? [id] : [], id);
        return;
    }
    selectLayerViaEngine(id);
}
