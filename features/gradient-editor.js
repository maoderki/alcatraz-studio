// ── Gradient with opacity ──────────────────────────────────────────────────
function updateGradient(layerId, prop, type, angle, c1, c2, toolPresetKey = '') {
    const val = type === 'radial'
        ? `radial-gradient(circle, ${c1}, ${c2})`
        : `linear-gradient(${angle}deg, ${c1}, ${c2})`;
    if (toolPresetKey) {
        updateToolPreset(toolPresetKey, { [prop]: val });
    } else {
        applyLayerPatchViaEngine(layerId, { [prop]: val }, { refreshInspector: true });
    }
}

function setGradientType(layerId, type, prop, c1, c2, angle, toolPresetKey = '') {
    updateGradient(layerId, prop, type, angle, c1, c2, toolPresetKey);
    refreshInspectorFlyoutIfNeeded();
}

function getGradientEditorTargetKey(mode, layerId = '', prop = '', toolPresetKey = '') {
    return [mode, toolPresetKey || layerId || 'gradient', prop || 'fill'].join('|');
}

function ensureGradientEditorUiTarget(mode, layerId = '', prop = '', toolPresetKey = '', stopCount = 2) {
    const targetKey = getGradientEditorTargetKey(mode, layerId, prop, toolPresetKey);
    if (gradientEditorUiState.targetKey !== targetKey) {
        gradientEditorUiState.targetKey = targetKey;
        gradientEditorUiState.selectedStopIndex = 0;
        gradientEditorUiState.selectedHandle = 'color';
    }

    const maxIndex = Math.max(0, stopCount - 1);
    gradientEditorUiState.selectedStopIndex = clamp(numberOr(gradientEditorUiState.selectedStopIndex, 0), 0, maxIndex);
    if (gradientEditorUiState.selectedHandle !== 'opacity') {
        gradientEditorUiState.selectedHandle = 'color';
    }

    return targetKey;
}

function getGradientEditorCurrentValue(mode, layerId = '', prop = 'fill', toolPresetKey = '') {
    if (mode === 'tool') {
        return buildGradientCssValue(getGradientToolPreset());
    }

    if (mode === 'layerStyle') {
        const layer = getLayer(layerId);
        const overlay = layer?.layerStyle?.gradientOverlay;
        if (!overlay) return '';
        const overlayStops = normalizeGradientPresetStops(
            overlay.stops,
            [overlay.color1 || '#3b82f6', overlay.color2 || '#8b5cf6']
        ).map(stop => ({
            color: typeof multiplyAlpha === 'function'
                ? multiplyAlpha(stop.color, overlay.opacity ?? 100)
                : withAlpha(stop.color, overlay.opacity ?? 100),
            pos: stop.pos
        }));
        return buildGradientCssValue({
            gradientType: overlay.gradientType || 'linear',
            angle: overlay.angle ?? 90,
            stops: overlayStops
        });
    }

    if (toolPresetKey) {
        return TOOL_PRESETS[toolPresetKey]?.[prop] || '';
    }

    return layers.find(layer => layer.id === layerId)?.[prop] || '';
}

function readGradientEditorPreset(mode, layerId = '', prop = 'fill', toolPresetKey = '') {
    if (mode === 'tool') {
        return getGradientToolPreset();
    }

    if (mode === 'layerStyle') {
        const layer = getLayer(layerId);
        const overlay = layer?.layerStyle?.gradientOverlay || createDefaultLayerStyle().gradientOverlay;
        const fallback = [overlay.color1 || '#3b82f6', overlay.color2 || '#8b5cf6'];
        const stops = normalizeGradientPresetStops(overlay.stops, fallback);
        return {
            gradientType: overlay.gradientType === 'radial' ? 'radial' : 'linear',
            angle: clamp(numberOr(overlay.angle, 90), 0, 360),
            colors: stops.map(stop => stop.color),
            stops
        };
    }

    const currentValue = getGradientEditorCurrentValue(mode, layerId, prop, toolPresetKey);
    const fallbackColors = parseGradientColors(currentValue);
    const solidFallback = typeof currentValue === 'string' && currentValue.trim() && !currentValue.includes('gradient') && currentValue !== 'transparent'
        ? [normalizeGradientStopColor(currentValue), normalizeGradientStopColor(currentValue)]
        : [cwFgColor, cwBgColor];
    return parseGradientPresetFromCss(currentValue, fallbackColors.length ? fallbackColors : solidFallback);
}

function applyGradientEditorPreset(mode, preset, layerId = '', prop = 'fill', toolPresetKey = '', options = {}) {
    const normalized = {
        gradientType: preset.gradientType === 'radial' ? 'radial' : 'linear',
        angle: clamp(numberOr(preset.angle, 135), 0, 360),
        stops: normalizeGradientPresetStops(preset.stops, preset.colors)
    };
    if (normalized.stops.length < 2) return false;

    if (mode === 'tool') {
        const applied = setGradientToolPreset(normalized, {
            skipRender: !!options.skipContextRender
        });
        if (applied && options.skipContextRender) {
            syncGradientToolContextEditor();
        }
        return applied;
    }

    if (mode === 'layerStyle') {
        const layer = getLayer(layerId);
        if (!layer) return false;
        if (!layer.layerStyle) layer.layerStyle = createDefaultLayerStyle();
        const overlay = layer.layerStyle.gradientOverlay || createDefaultLayerStyle().gradientOverlay;
        const stops = normalizeGradientPresetStops(normalized.stops, normalized.colors);
        layer.layerStyle.gradientOverlay = {
            ...overlay,
            gradientType: normalized.gradientType,
            angle: normalized.angle,
            color1: stops[0]?.color || overlay.color1,
            color2: stops[1]?.color || overlay.color2,
            stops
        };
        patchLayerElement(layer.id);
        if (options.skipContextRender) {
            syncLayerStyleGradientEditor(layer.id);
            scheduleHistoryCommit();
            return true;
        }
        renderLayerStyleModal();
        scheduleHistoryCommit();
        return true;
    }

    const cssValue = buildGradientCssValue(normalized);
    if (!cssValue) return false;

    if (toolPresetKey) {
        updateToolPreset(toolPresetKey, { [prop]: cssValue });
    } else {
        applyLayerPatchViaEngine(layerId, { [prop]: cssValue }, { refreshInspector: true });
    }

    renderContextBar();
    refreshInspectorFlyoutIfNeeded();
    return true;
}

function updateGradientEditorUiSelection(mode, layerId = '', prop = 'fill', toolPresetKey = '', stopIndex = 0, handle = 'color') {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    ensureGradientEditorUiTarget(mode, layerId, prop, toolPresetKey, preset.stops.length);
    gradientEditorUiState.selectedStopIndex = clamp(numberOr(stopIndex, 0), 0, Math.max(0, preset.stops.length - 1));
    gradientEditorUiState.selectedHandle = handle === 'opacity' ? 'opacity' : 'color';
}

function rerenderGradientEditorSurfaces() {
    renderContextBar();
    refreshInspectorFlyoutIfNeeded();
    if (layerStyleModal && !layerStyleModal.hasAttribute('hidden') && activeLayerStyleSection === 'gradientOverlay') {
        renderLayerStyleModal();
    }
}

function syncGradientToolContextEditor() {
    const host = document.querySelector('.ctx-gradient-popover .gradient-editor');
    const contextButtonPreview = document.querySelector('[data-ctx-gradient-preview]');
    const contextStopCount = document.querySelector('[data-ctx-gradient-stop-count]');
    const angleReadout = document.querySelector('[data-ctx-gradient-angle-readout]');
    const angleNumber = document.querySelector('[data-ctx-gradient-angle-number]');
    const buttonPreview = buildGradientCssValue({
        gradientType: 'linear',
        angle: 90,
        stops: getGradientToolPreset().stops
    });
    if (!host) {
        if (contextButtonPreview) {
            contextButtonPreview.style.background = buttonPreview;
        }
        if (contextStopCount) {
            contextStopCount.textContent = `${getGradientToolPreset()?.stops?.length || 2} durak`;
        }
        if (angleReadout) {
            angleReadout.textContent = `${Math.round(getGradientToolPreset()?.angle ?? 135)}°`;
        }
        if (angleNumber) {
            angleNumber.value = String(Math.round(getGradientToolPreset()?.angle ?? 135));
        }
        return;
    }

    const preset = getGradientToolPreset();
    const preview = buildGradientCssValue(preset);
    const railPreview = buildGradientCssValue({
        gradientType: 'linear',
        angle: 90,
        stops: preset.stops
    });
    const displayStops = getGradientEditorDisplayStops(preset.stops);
    const selectedIndex = clamp(numberOr(gradientEditorUiState.selectedStopIndex, 0), 0, Math.max(0, preset.stops.length - 1));
    const selectedHandle = gradientEditorUiState.selectedHandle === 'opacity' ? 'opacity' : 'color';
    const selectedStop = preset.stops[selectedIndex] || preset.stops[0];
    const selectedColor = parseColor(selectedStop.color);
    const selectedOpacity = Math.round((selectedColor.a / 255) * 100);
    const selectedHex = `#${[selectedColor.r, selectedColor.g, selectedColor.b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    const angle = Math.round(preset.angle ?? 135);

    host.querySelectorAll('[data-gradient-preview]').forEach(el => {
        el.style.background = railPreview;
    });
    host.querySelectorAll('[data-gradient-stop]').forEach(el => {
        const index = clamp(numberOr(el.dataset.stopIndex, 0), 0, Math.max(0, preset.stops.length - 1));
        const stop = preset.stops[index];
        const displayStop = displayStops[index];
        if (!stop) return;
        el.style.left = `${displayStop ? displayStop.__uiPos : stop.pos}%`;
        const handle = el.dataset.stopHandle === 'opacity' ? 'opacity' : 'color';
        el.classList.toggle('active', index === selectedIndex && handle === selectedHandle);
        if (handle === 'opacity') {
            const opacity = Math.round((parseColor(stop.color).a / 255) * 100);
            el.title = `Opaklik stop ${index + 1} - ${opacity}%`;
        } else {
            const stopColor = parseColor(stop.color);
            const stopHex = `#${[stopColor.r, stopColor.g, stopColor.b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
            el.style.setProperty('--gradient-stop-color', stopHex);
            el.title = `Renk stop ${index + 1}`;
        }
    });

    const metaLabel = host.querySelector('[data-gradient-selected-label]');
    const metaPos = host.querySelector('[data-gradient-selected-pos]');
    if (metaLabel) metaLabel.textContent = `Seçili: ${selectedHandle === 'opacity' ? 'Opacity stop' : 'Renk stop'} ${selectedIndex + 1}`;
    if (metaPos) metaPos.textContent = `${Math.round(selectedStop.pos)}%`;

    const angleRange = host.querySelector('[data-gradient-angle-range]');
    const angleInput = host.querySelector('[data-gradient-angle-input]');
    const locRange = host.querySelector('[data-gradient-loc-range]');
    const locInput = host.querySelector('[data-gradient-loc-input]');
    const opRange = host.querySelector('[data-gradient-op-range]');
    const opInput = host.querySelector('[data-gradient-op-input]');
    const colorInput = host.querySelector('[data-gradient-color-input]');

    if (angleRange) angleRange.value = String(angle);
    if (angleInput && document.activeElement !== angleInput) angleInput.value = String(angle);
    if (locRange) locRange.value = String(Math.round(selectedStop.pos));
    if (locInput && document.activeElement !== locInput) locInput.value = String(Math.round(selectedStop.pos));
    if (opRange) opRange.value = String(selectedOpacity);
    if (opInput && document.activeElement !== opInput) opInput.value = String(selectedOpacity);
    if (colorInput) colorInput.dataset.currentHex = selectedHex;

    if (contextButtonPreview) contextButtonPreview.style.background = buttonPreview;
    if (contextStopCount) contextStopCount.textContent = `${preset.stops.length} durak`;
    if (angleReadout) angleReadout.textContent = `${angle}°`;
    if (angleNumber && document.activeElement !== angleNumber) angleNumber.value = String(angle);
}

function syncLayerStyleGradientEditor(layerId) {
    const host = layerStyleModalBody?.querySelector('.gradient-editor');
    if (!host) return;
    const preset = readGradientEditorPreset('layerStyle', layerId);
    const displayStops = getGradientEditorDisplayStops(preset.stops);
    const selectedIndex = clamp(numberOr(gradientEditorUiState.selectedStopIndex, 0), 0, Math.max(0, preset.stops.length - 1));
    const selectedHandle = gradientEditorUiState.selectedHandle === 'opacity' ? 'opacity' : 'color';
    const selectedStop = preset.stops[selectedIndex] || preset.stops[0];
    const selectedColor = parseColor(selectedStop.color);
    const selectedOpacity = Math.round((selectedColor.a / 255) * 100);
    const angle = Math.round(preset.angle ?? 90);
    const railPreview = buildGradientCssValue({
        gradientType: 'linear',
        angle: 90,
        stops: preset.stops
    });

    host.querySelectorAll('[data-gradient-preview]').forEach(el => {
        el.style.background = railPreview;
    });
    host.querySelectorAll('[data-gradient-stop]').forEach(el => {
        const index = clamp(numberOr(el.dataset.stopIndex, 0), 0, Math.max(0, preset.stops.length - 1));
        const stop = preset.stops[index];
        const displayStop = displayStops[index];
        if (!stop) return;
        el.style.left = `${displayStop ? displayStop.__uiPos : stop.pos}%`;
        const handle = el.dataset.stopHandle === 'opacity' ? 'opacity' : 'color';
        el.classList.toggle('active', index === selectedIndex && handle === selectedHandle);
    });
    const metaLabel = host.querySelector('[data-gradient-selected-label]');
    const metaPos = host.querySelector('[data-gradient-selected-pos]');
    if (metaLabel) metaLabel.textContent = `Seçili: ${selectedHandle === 'opacity' ? 'Opacity stop' : 'Renk stop'} ${selectedIndex + 1}`;
    if (metaPos) metaPos.textContent = `${Math.round(selectedStop.pos)}%`;
    const angleRange = host.querySelector('[data-gradient-angle-range]');
    const angleInput = host.querySelector('[data-gradient-angle-input]');
    const locRange = host.querySelector('[data-gradient-loc-range]');
    const locInput = host.querySelector('[data-gradient-loc-input]');
    const opRange = host.querySelector('[data-gradient-op-range]');
    const opInput = host.querySelector('[data-gradient-op-input]');
    if (angleRange) angleRange.value = String(angle);
    if (angleInput && document.activeElement !== angleInput) angleInput.value = String(angle);
    if (locRange) locRange.value = String(Math.round(selectedStop.pos));
    if (locInput && document.activeElement !== locInput) locInput.value = String(Math.round(selectedStop.pos));
    if (opRange) opRange.value = String(selectedOpacity);
    if (opInput && document.activeElement !== opInput) opInput.value = String(selectedOpacity);
}

function openContextGradientPopover() {
    gradientEditorUiState.contextOpen = true;
    renderContextBar();
}

function closeContextGradientPopover() {
    if (!gradientEditorUiState.contextOpen) return;
    gradientEditorUiState.contextOpen = false;
    renderContextBar();
}

function toggleContextGradientPopover() {
    gradientEditorUiState.contextOpen = !gradientEditorUiState.contextOpen;
    renderContextBar();
}

function selectGradientEditorStop(mode, layerId = '', prop = 'fill', toolPresetKey = '', stopIndex = 0, handle = 'color') {
    updateGradientEditorUiSelection(mode, layerId, prop, toolPresetKey, stopIndex, handle);
    rerenderGradientEditorSurfaces();
}

function setGradientEditorType(mode, layerId = '', prop = 'fill', toolPresetKey = '', type = 'linear') {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    preset.gradientType = type === 'radial' ? 'radial' : 'linear';
    applyGradientEditorPreset(mode, preset, layerId, prop, toolPresetKey);
}

function setGradientEditorAngle(mode, layerId = '', prop = 'fill', toolPresetKey = '', angle = 135, live = false) {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    preset.angle = clamp(numberOr(angle, 135), 0, 360);
    applyGradientEditorPreset(mode, preset, layerId, prop, toolPresetKey, {
        skipContextRender: live && (mode === 'tool' || mode === 'layerStyle')
    });
}

function updateGradientEditorStop(mode, layerId = '', prop = 'fill', toolPresetKey = '', stopIndex = 0, patch = {}) {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    const stops = preset.stops.map(stop => ({ ...stop }));
    const index = clamp(numberOr(stopIndex, 0), 0, Math.max(0, stops.length - 1));
    if (!stops[index]) return;

    const nextStop = { ...stops[index] };
    if (patch.color) nextStop.color = normalizeGradientStopColor(patch.color);
    if (patch.pos !== undefined) nextStop.pos = clamp(numberOr(patch.pos, nextStop.pos), 0, 100);
    stops[index] = nextStop;
    stops.sort((a, b) => a.pos - b.pos);

    preset.stops = stops;
    const skipContextRender = !!patch.live && (mode === 'tool' || mode === 'layerStyle');
    applyGradientEditorPreset(mode, preset, layerId, prop, toolPresetKey, {
        skipContextRender
    });
    const nextIndex = stops.findIndex(stop => stop === nextStop);
    updateGradientEditorUiSelection(mode, layerId, prop, toolPresetKey, nextIndex === -1 ? index : nextIndex, gradientEditorUiState.selectedHandle);
    if (skipContextRender) {
        if (mode === 'tool') syncGradientToolContextEditor();
        if (mode === 'layerStyle') syncLayerStyleGradientEditor(layerId);
        return;
    }
    rerenderGradientEditorSurfaces();
}

function setGradientEditorSelectedColor(mode, layerId = '', prop = 'fill', toolPresetKey = '', hex = '#3b82f6') {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    ensureGradientEditorUiTarget(mode, layerId, prop, toolPresetKey, preset.stops.length);
    const stop = preset.stops[gradientEditorUiState.selectedStopIndex];
    if (!stop) return;
    const alpha = Math.round((parseColor(stop.color).a / 255) * 100);
    const color = parseColor(hex);
    color.a = Math.round((clamp(alpha, 0, 100) / 100) * 255);
    updateGradientEditorStop(mode, layerId, prop, toolPresetKey, gradientEditorUiState.selectedStopIndex, {
        color: colorToCSSRgba(color)
    });
}

function setGradientEditorSelectedOpacity(mode, layerId = '', prop = 'fill', toolPresetKey = '', opacity = 100, live = false) {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    ensureGradientEditorUiTarget(mode, layerId, prop, toolPresetKey, preset.stops.length);
    const stop = preset.stops[gradientEditorUiState.selectedStopIndex];
    if (!stop) return;
    const color = parseColor(stop.color);
    color.a = Math.round((clamp(numberOr(opacity, 100), 0, 100) / 100) * 255);
    updateGradientEditorStop(mode, layerId, prop, toolPresetKey, gradientEditorUiState.selectedStopIndex, {
        color: colorToCSSRgba(color),
        live
    });
}

function setGradientEditorSelectedLocation(mode, layerId = '', prop = 'fill', toolPresetKey = '', location = 0, live = false) {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    ensureGradientEditorUiTarget(mode, layerId, prop, toolPresetKey, preset.stops.length);
    updateGradientEditorStop(mode, layerId, prop, toolPresetKey, gradientEditorUiState.selectedStopIndex, {
        pos: clamp(numberOr(location, 0), 0, 100),
        live
    });
}

function addGradientEditorStop(mode, layerId = '', prop = 'fill', toolPresetKey = '', location = null) {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    const stops = preset.stops.map(stop => ({ ...stop }));
    const currentIndex = clamp(numberOr(gradientEditorUiState.selectedStopIndex, 0), 0, Math.max(0, stops.length - 1));
    const baseStop = stops[currentIndex] || stops[0];
    const nextLocation = clamp(numberOr(location, baseStop ? baseStop.pos : 50), 0, 100);
    stops.push({
        color: baseStop ? baseStop.color : colorToCSSRgba(cwFgColor),
        pos: nextLocation
    });
    stops.sort((a, b) => a.pos - b.pos);
    preset.stops = stops;
    applyGradientEditorPreset(mode, preset, layerId, prop, toolPresetKey);
    const insertedIndex = stops.findIndex(stop => stop.pos === nextLocation && stop.color === (baseStop ? baseStop.color : colorToCSSRgba(cwFgColor)));
    updateGradientEditorUiSelection(mode, layerId, prop, toolPresetKey, insertedIndex === -1 ? stops.length - 1 : insertedIndex, 'color');
    rerenderGradientEditorSurfaces();
}

function removeGradientEditorSelectedStop(mode, layerId = '', prop = 'fill', toolPresetKey = '') {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    if (preset.stops.length <= 2) return;
    ensureGradientEditorUiTarget(mode, layerId, prop, toolPresetKey, preset.stops.length);
    preset.stops.splice(gradientEditorUiState.selectedStopIndex, 1);
    applyGradientEditorPreset(mode, preset, layerId, prop, toolPresetKey);
    updateGradientEditorUiSelection(mode, layerId, prop, toolPresetKey, Math.max(0, gradientEditorUiState.selectedStopIndex - 1), 'color');
    rerenderGradientEditorSurfaces();
}

function buildGradientEditorMarkup({
    mode = 'layer',
    layerId = '',
    prop = 'fill',
    toolPresetKey = '',
    compact = false,
    showTypeControls = true,
    showAngleControl = true
} = {}) {
    const preset = readGradientEditorPreset(mode, layerId, prop, toolPresetKey);
    const targetKey = ensureGradientEditorUiTarget(mode, layerId, prop, toolPresetKey, preset.stops.length);
    const stops = preset.stops;
    const selectedIndex = gradientEditorUiState.targetKey === targetKey ? gradientEditorUiState.selectedStopIndex : 0;
    const selectedHandle = gradientEditorUiState.targetKey === targetKey ? gradientEditorUiState.selectedHandle : 'color';
    const selectedStop = stops[selectedIndex] || stops[0];
    const selectedColor = parseColor(selectedStop.color);
    const selectedHex = `#${[selectedColor.r, selectedColor.g, selectedColor.b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
    const selectedOpacity = Math.round((selectedColor.a / 255) * 100);
    const preview = buildGradientCssValue(preset);
    const railPreview = buildGradientCssValue({
        gradientType: 'linear',
        angle: 90,
        stops: preset.stops
    });
    const displayStops = getGradientEditorDisplayStops(stops);
    const opacityButtons = stops.map((stop, index) => {
        const stopColor = parseColor(stop.color);
        const opacity = Math.round((stopColor.a / 255) * 100);
        const offset = `left:${displayStops[index].__uiPos}%;`;
        const opacityActive = index === selectedIndex && selectedHandle === 'opacity';
        return `
            <button type="button" class="gradient-stop gradient-stop-opacity ${opacityActive ? 'active' : ''}" style="${offset}"
                data-gradient-stop data-stop-index="${index}" data-stop-handle="opacity"
                onclick="selectGradientEditorStop('${mode}','${layerId}','${prop}','${toolPresetKey}',${index},'opacity')"
                title="Opaklik stop ${index + 1} - ${opacity}%"></button>
        `;
    }).join('');
    const colorButtons = stops.map((stop, index) => {
        const stopColor = parseColor(stop.color);
        const stopHex = `#${[stopColor.r, stopColor.g, stopColor.b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
        const offset = `left:${displayStops[index].__uiPos}%;`;
        const colorActive = index === selectedIndex && selectedHandle === 'color';
        return `
            <button type="button" class="gradient-stop gradient-stop-color ${colorActive ? 'active' : ''}" style="${offset};--gradient-stop-color:${stopHex};"
                data-gradient-stop data-stop-index="${index}" data-stop-handle="color"
                onclick="selectGradientEditorStop('${mode}','${layerId}','${prop}','${toolPresetKey}',${index},'color')"
                title="Renk stop ${index + 1}">${index + 1}</button>
        `;
    }).join('');

    return `
        <div class="gradient-editor ${compact ? 'compact' : ''}" data-gradient-target="${targetKey}">
            <div class="gradient-editor-top">
                ${showTypeControls ? `
                    <div class="gradient-mode-switch">
                        <button type="button" class="icon-btn ${preset.gradientType === 'linear' ? 'active' : ''}"
                            onclick="setGradientEditorType('${mode}','${layerId}','${prop}','${toolPresetKey}','linear')">
                            <i class="fa-solid fa-arrows-left-right"></i> Linear
                        </button>
                        <button type="button" class="icon-btn ${preset.gradientType === 'radial' ? 'active' : ''}"
                            onclick="setGradientEditorType('${mode}','${layerId}','${prop}','${toolPresetKey}','radial')">
                            <i class="fa-solid fa-circle-half-stroke"></i> Radial
                        </button>
                    </div>
                ` : '<div></div>'}
                <div class="gradient-editor-actions">
                    <button type="button" class="ctx-btn" onclick="addGradientEditorStop('${mode}','${layerId}','${prop}','${toolPresetKey}',50)">
                        <i class="fa-solid fa-plus"></i> Durak Ekle
                    </button>
                    <button type="button" class="ctx-btn" ${stops.length <= 2 ? 'disabled' : ''}
                        onclick="removeGradientEditorSelectedStop('${mode}','${layerId}','${prop}','${toolPresetKey}')">
                        <i class="fa-solid fa-trash"></i> Durak Sil
                    </button>
                </div>
            </div>

            <div class="gradient-editor-stage">
                <div class="gradient-editor-stop-lane gradient-editor-stop-lane-top">${opacityButtons}</div>
                <div class="gradient-editor-preview" data-gradient-preview style="background:${railPreview};"></div>
                <div class="gradient-editor-stop-lane gradient-editor-stop-lane-bottom">${colorButtons}</div>
            </div>

            <div class="gradient-editor-meta">
                <span data-gradient-selected-label>Seçili: ${selectedHandle === 'opacity' ? 'Opacity stop' : 'Renk stop'} ${selectedIndex + 1}</span>
                <span data-gradient-selected-pos>${Math.round(selectedStop.pos)}%</span>
            </div>

            ${showAngleControl && preset.gradientType === 'linear' ? `
                <div class="field">
                    <label>Açı</label>
                    <div class="gradient-input-row">
                        <input type="range" min="0" max="360" value="${Math.round(preset.angle)}"
                            data-gradient-angle-range
                            oninput="setGradientEditorAngle('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value,true)">
                        <input type="number" min="0" max="360" value="${Math.round(preset.angle)}"
                            data-gradient-angle-input
                            onfocus="this.select()"
                            onchange="setGradientEditorAngle('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value)"
                            onblur="setGradientEditorAngle('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value)">
                    </div>
                </div>
            ` : ''}

            <div class="gradient-editor-grid">
                <div class="field">
                    <label>Location</label>
                    <div class="gradient-input-row">
                        <input type="range" min="0" max="100" value="${Math.round(selectedStop.pos)}"
                            data-gradient-loc-range
                            oninput="setGradientEditorSelectedLocation('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value,true)">
                        <input type="number" min="0" max="100" value="${Math.round(selectedStop.pos)}"
                            data-gradient-loc-input
                            onfocus="this.select()"
                            onchange="setGradientEditorSelectedLocation('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value)"
                            onblur="setGradientEditorSelectedLocation('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value)">
                    </div>
                </div>
                <div class="field">
                    <label>Opacity</label>
                    <div class="gradient-input-row">
                        <input type="range" min="0" max="100" value="${selectedOpacity}"
                            data-gradient-op-range
                            oninput="setGradientEditorSelectedOpacity('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value,true)">
                        <input type="number" min="0" max="100" value="${selectedOpacity}"
                            data-gradient-op-input
                            onfocus="this.select()"
                            onchange="setGradientEditorSelectedOpacity('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value)"
                            onblur="setGradientEditorSelectedOpacity('${mode}','${layerId}','${prop}','${toolPresetKey}',this.value)">
                    </div>
                </div>
            </div>

            <div class="gradient-editor-grid">
                <div class="field">
                    <label>Renk</label>
                    ${buildGradientPickrControl(mode, layerId, prop, toolPresetKey, targetKey, selectedHex)}
                </div>
            </div>
        </div>
    `;
}

function buildGradientPickrControl(mode, layerId, prop, toolPresetKey, targetKey, selectedHex) {
    const pickrId = `gradient_pickr_${targetKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    setTimeout(() => {
        const el = document.getElementById(pickrId);
        if (!el || el._pickrInit) return;
        el._pickrInit = true;

        const pickr = Pickr.create({
            el,
            theme: 'nano',
            default: selectedHex,
            defaultRepresentation: 'HEX',
            components: {
                preview: true,
                opacity: false,
                hue: true,
                interaction: { hex: true, input: true, save: false }
            }
        });

        pickr.on('change', color => {
            const hex = color.toHEXA().toString().slice(0, 7);
            setGradientEditorSelectedColor(mode, layerId, prop, toolPresetKey, hex);
        });
    }, 0);

    return `<div id="${pickrId}" class="gradient-pickr-host" data-gradient-color-input data-current-hex="${selectedHex}"></div>`;
}

// rgba slider — gradient panel'de renklere opacity ekler
function buildRgbaColorRow(label, currentColorStr, onChangeJs, pickrId) {
    const c = parseColor(currentColorStr);
    const opacity = Math.round((c.a / 255) * 100);
    const hexOnly = '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');

    setTimeout(() => {
        const el = document.getElementById(pickrId);
        if (!el || el._pickrInit) return;
        el._pickrInit = true;

        const pickr = Pickr.create({
            el,
            theme: 'nano',
            default: hexOnly,
            defaultRepresentation: 'HEX',
            components: {
                preview: true,
                opacity: false,
                hue: true,
                interaction: { hex: true, input: true, save: false }
            }
        });

        pickr.on('change', (color) => {
            const hex = color.toHEXA().toString().slice(0, 7); // sadece #rrggbb
            el.dataset.currentHex = hex;
            // Mevcut opacity'yi koru
            const currentOpSlider = document.getElementById(pickrId + '_op');
            const op = currentOpSlider ? parseInt(currentOpSlider.value) : opacity;
            const alpha = Math.round((op / 100) * 255);
            const rgba = colorToCSSRgba({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a: alpha });
            try { eval(onChangeJs.replace(/__COLOR__/g, rgba)); } catch(err) { console.error(err); }
            refreshInspectorFlyoutIfNeeded();
        });
    }, 0);

    return `
        <div id="${pickrId}" data-current-hex="${hexOnly}"></div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
            <span style="font-size:11px;color:var(--muted);">Opaklık</span>
            <input id="${pickrId}_op" type="range" min="0" max="100" value="${opacity}" style="flex:1;"
                oninput="
                    var pickerEl = document.getElementById('${pickrId}');
                    var hex = pickerEl?.dataset?.currentHex || '${hexOnly}';
                    var alpha = Math.round((+this.value/100)*255);
                    var c = parseColor(hex);
                    c.a = alpha;
                    var rgba = colorToCSSRgba(c);
                    this.nextElementSibling.textContent = this.value + '%';
                    try { ${onChangeJs.replace(/__COLOR__/g, 'rgba')} } catch(e){}
                    refreshInspectorFlyoutIfNeeded();
                ">
            <span style="font-size:11px;color:var(--muted);min-width:32px;">${opacity}%</span>
        </div>
    `;
}

function updateToolPreset(toolKey, patch) {
    const preset = TOOL_PRESETS[toolKey];
    if (!preset) return;
    Object.assign(preset, patch);
    renderContextBar();
}
