async function startEyedropper() {
    const allLayers = [...layers].sort((a, b) => a.z - b.z);
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasWidth;
    offscreen.height = canvasHeight;
    const ctx = offscreen.getContext('2d');

    for (const layer of allLayers) {
        try {
            await drawLayerToContext(ctx, layer);
        } catch (error) {
            console.warn('Eyedropper snapshot layer draw failed:', layer?.id, error);
        }
    }

    window._eyedropperCanvas = offscreen;
    return offscreen;
}

async function pickColorFromStage(e) {
    const stageRect = stage.getBoundingClientRect();
    const x = (e.clientX - stageRect.left) / zoom;
    const y = (e.clientY - stageRect.top) / zoom;

    if (x < 0 || y < 0 || x > canvasWidth || y > canvasHeight) return;

    if (!window._eyedropperCanvas) {
        await startEyedropper();
    }

    const ctx = window._eyedropperCanvas.getContext('2d');
    const px = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const hex = '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('');

    cwFgColor = hex;
    syncGradientToolPresetFromColorWidget();
    updateColorWidget();
    renderContextBar();

    // Seçili katmana da uygula
    const l = getLayer();
    if (l) {
        if (l.type === 'text') applyLayerPatchViaEngine(l.id, { color: hex }, { refreshInspector: true });
        if (l.type === 'shape') applyLayerPatchViaEngine(l.id, { fill: hex }, { refreshInspector: true });
        refreshInspectorFlyoutIfNeeded();
    }

}
