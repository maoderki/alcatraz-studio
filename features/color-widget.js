// ── Color Widget ───────────────────────────────────────────────────────────
function initColorWidget() {
    const cwFg = document.getElementById('cwFg');
    const cwBg = document.getElementById('cwBg');
    const cwSwap = document.getElementById('cwSwap');
    const cwFgInput = document.getElementById('cwFgInput');
    const cwBgInput = document.getElementById('cwBgInput');
    if (!cwFg || !cwBg || !cwSwap || !cwFgInput || !cwBgInput) return;

    updateColorWidget();

    cwFg.addEventListener('click', (e) => {
        e.stopPropagation();
        cwActiveSlot = 'fg';
        updateColorWidget();
        cwFgInput.value = cwFgColor;
        cwFgInput.click();
    });

    cwBg.addEventListener('click', (e) => {
        e.stopPropagation();
        cwActiveSlot = 'bg';
        updateColorWidget();
        cwBgInput.value = cwBgColor;
        cwBgInput.click();
    });

    cwFgInput.addEventListener('input', () => {
        cwFgColor = cwFgInput.value;
        cwActiveSlot = 'fg';
        updateColorWidget();
        applyColorWidgetToLayer();
    });

    cwBgInput.addEventListener('input', () => {
        cwBgColor = cwBgInput.value;
        cwActiveSlot = 'bg';
        updateColorWidget();
        applyColorWidgetToLayer();
    });

    cwSwap.addEventListener('click', (e) => {
        e.stopPropagation();
        [cwFgColor, cwBgColor] = [cwBgColor, cwFgColor];
        updateColorWidget();
        applyColorWidgetToLayer();
    });
}

function updateColorWidget() {
    const cwFg = document.getElementById('cwFg');
    const cwBg = document.getElementById('cwBg');
    const cwFgInput = document.getElementById('cwFgInput');
    const cwBgInput = document.getElementById('cwBgInput');
    if (!cwFg || !cwBg) return;
    cwFg.style.background = cwFgColor;
    cwBg.style.background = cwBgColor;
    if (cwFgInput) cwFgInput.value = cwFgColor;
    if (cwBgInput) cwBgInput.value = cwBgColor;
    cwFg.classList.toggle('active-slot', cwActiveSlot === 'fg');
    cwBg.classList.toggle('active-slot', cwActiveSlot === 'bg');
}

function applyColorWidgetToLayer() {
    const color = cwActiveSlot === 'fg' ? cwFgColor : cwBgColor;
    const activeTool = allTools.find(t => t.key === currentTool);
    const l = getContextBarSubject(activeTool, getLayer());
    if (!l) return;

    syncGradientToolPresetFromColorWidget();

    if (l.__toolPresetKey) {
        if (l.type === 'text') updateToolPreset(l.__toolPresetKey, { color });
        if (l.type === 'shape') updateToolPreset(l.__toolPresetKey, { fill: color });
        return;
    }

    if (l.type === 'text') applyLayerPatchViaEngine(l.id, { color }, { refreshInspector: true });
    if (l.type === 'shape') applyLayerPatchViaEngine(l.id, { fill: color }, { refreshInspector: true });
    refreshInspectorFlyoutIfNeeded();
}

function syncColorWidgetFromLayer(id) {
    const l = getLayer(id);
    if (!l) return;
    const color = l.type === 'text' ? l.color : l.type === 'shape' ? l.fill : null;
    if (color && !color.includes('gradient') && color !== 'transparent') {
        if (cwActiveSlot === 'fg') cwFgColor = color;
        else cwBgColor = color;
        syncGradientToolPresetFromColorWidget();
        updateColorWidget();
    }
}
