const PROP_RENDERERS = {

    fontFamily: (l) => {
        if (!l || l.type !== 'text') return '';
        return customSelect({
            inputId: 'ctx_font_family',
            value: l.fontFamily || 'Inter',
            searchable: true,
            placeholder: 'Font seç',
            options: FONTS.length
                ? FONTS.map(f => ({ value: f.family, label: f.family, fontFamily: f.family }))
                : [{ value: 'Inter', label: 'Inter' }],
            onChange: (value) => {
                const patch = { fontFamily: value };
                if (l.__toolPresetKey) updateToolPreset(l.__toolPresetKey, patch);
                else applyLayerPatchViaEngine(l.id, patch, { refreshInspector: true });
                renderContextBar();
                refreshInspectorFlyoutIfNeeded();
            }
        }) + `<div class="ctx-divider"></div>`;
    },

    fontWeight: (l) => {
        if (!l || l.type !== 'text') return '';
        return customSelect({
            inputId: 'ctx_font_weight',
            value: l.fontWeight,
            searchable: false,
            options: getFontWeightOptions(l.fontFamily || 'Inter'),
            onChange: (value) => {
                const patch = { fontWeight: Number(value) || 400 };
                if (l.__toolPresetKey) updateToolPreset(l.__toolPresetKey, patch);
                else applyLayerPatchViaEngine(l.id, patch, { refreshInspector: true });
                renderContextBar();
                refreshInspectorFlyoutIfNeeded();
            }
        }) + `<div class="ctx-divider"></div>`;
    },

    fontSize: (l) => {
        if (!l || l.type !== 'text') return '';
        return `
            <span class="ctx-label">Boyut</span>
            ${stepper('ctx_font_size', 'ctx-input', l.fontSize, 8, 300, 'fontSize', l.id, l.__toolPresetKey)}
            <div class="ctx-divider"></div>`;
    },

    textAlign: (l) => {
        if (!l || l.type !== 'text') return '';
        return `
            <button class="ctx-btn ${l.textAlign === 'left' ? 'active' : ''}" data-ctx-text-align="left" onclick="${getContextTargetUpdateJs(l, `{textAlign:'left'}`)} renderContextBar()"><i class="fa-solid fa-align-left"></i></button>
            <button class="ctx-btn ${l.textAlign === 'center' ? 'active' : ''}" data-ctx-text-align="center" onclick="${getContextTargetUpdateJs(l, `{textAlign:'center'}`)} renderContextBar()"><i class="fa-solid fa-align-center"></i></button>
            <button class="ctx-btn ${l.textAlign === 'right' ? 'active' : ''}" data-ctx-text-align="right" onclick="${getContextTargetUpdateJs(l, `{textAlign:'right'}`)} renderContextBar()"><i class="fa-solid fa-align-right"></i></button>
            <div class="ctx-divider"></div>`;
    },

    verticalAlign: (l) => {
        if (!l || l.type !== 'text') return '';
        return `
            <button class="ctx-btn ${l.verticalAlign === 'top' ? 'active' : ''}" data-ctx-vertical-align="top" title="Üst hizala" onclick="${getContextTargetUpdateJs(l, `{verticalAlign:'top'}`)} renderContextBar()"><i class="fa-solid fa-arrow-up-short-wide"></i></button>
            <button class="ctx-btn ${l.verticalAlign === 'middle' ? 'active' : ''}" data-ctx-vertical-align="middle" title="Orta hizala" onclick="${getContextTargetUpdateJs(l, `{verticalAlign:'middle'}`)} renderContextBar()"><i class="fa-solid fa-arrows-up-down"></i></button>
            <button class="ctx-btn ${l.verticalAlign === 'bottom' ? 'active' : ''}" data-ctx-vertical-align="bottom" title="Alt hizala" onclick="${getContextTargetUpdateJs(l, `{verticalAlign:'bottom'}`)} renderContextBar()"><i class="fa-solid fa-arrow-down-short-wide"></i></button>
            <div class="ctx-divider"></div>`;
    },

    textDecoration: (l) => {
        if (!l || l.type !== 'text') return '';
        const bold = l.fontWeight >= 700;
        const italic = l.fontStyle === 'italic';
        const under = l.textDecoration === 'underline';
        const strike = l.textDecoration === 'line-through';
        return `
            <button class="ctx-btn ${bold ? 'active' : ''}" data-ctx-text-deco="bold" title="Kalın" onclick="${getContextTargetUpdateJs(l, `{fontWeight: ${bold ? 400 : 700}}`)} renderContextBar()"><i class="fa-solid fa-bold"></i></button>
            <button class="ctx-btn ${italic ? 'active' : ''}" data-ctx-text-deco="italic" title="İtalik" onclick="${getContextTargetUpdateJs(l, `{fontStyle: '${italic ? 'normal' : 'italic'}'}`)} renderContextBar()"><i class="fa-solid fa-italic"></i></button>
            <button class="ctx-btn ${under ? 'active' : ''}" data-ctx-text-deco="underline" title="Altı Çizili" onclick="${getContextTargetUpdateJs(l, `{textDecoration: '${under ? 'none' : 'underline'}'}`)} renderContextBar()"><i class="fa-solid fa-underline"></i></button>
            <button class="ctx-btn ${strike ? 'active' : ''}" data-ctx-text-deco="strike" title="Üstü Çizili" onclick="${getContextTargetUpdateJs(l, `{textDecoration: '${strike ? 'none' : 'line-through'}'}`)} renderContextBar()"><i class="fa-solid fa-strikethrough"></i></button>
            <div class="ctx-divider"></div>`;
    },

    color: (l) => {
        if (!l || l.type !== 'text') return '';
        return '';
    },

    fill: (l) => {
        if (!l || l.type !== 'shape') return '';
        return '';
    },

    radius: (l) => {
        if (!l) return '';
        return `
            <span class="ctx-label">Köşe</span>${stepper('ctx_radius', 'ctx-input', l.radius || 0, 0, 200, 'radius', l.id, l.__toolPresetKey || '')}
            <div class="ctx-divider"></div>`;
    },

    rotation: (l) => {
        if (!l) return '';
        return `
            <label class="ctx-label">Dönme</label>
            <input id="ctx_rotation" class="ctx-input" type="number" value="${Math.round(l.rotation || 0)}" oninput="updateContextValue('${l.id}', '${l.__toolPresetKey || ''}', 'rotation', +this.value || 0)">
            <div class="ctx-divider"></div>`;
    },

    opacity: (l) => {
        if (!l) return '';
        const op = Math.round(l.opacity * 100);
        return `
            <span class="ctx-label">Opaklık</span>
            <input id="ctx_opacity_range" class="ctx-range" type="range" min="0" max="100" value="${op}" oninput="${getContextTargetUpdateJs(l, '{opacity:this.value/100}')} this.nextElementSibling.textContent=this.value+'%'">
            <span id="ctx_opacity_value" class="ctx-label" style="min-width:34px">${op}%</span>`;
    },

    aspectLocked: (l) => {
        if (!l || l.type !== 'raster') return '';
        return `
            <button class="ctx-btn ${l.aspectLocked ? 'active' : ''}" data-ctx-aspect="locked" onclick="${getContextTargetUpdateJs(l, '{aspectLocked:true}')} renderContextBar()">🔒 Kilitli</button>
            <button class="ctx-btn ${!l.aspectLocked ? 'active' : ''}" data-ctx-aspect="free" onclick="${getContextTargetUpdateJs(l, '{aspectLocked:false}')} renderContextBar()">↔ Serbest</button>
            <div class="ctx-divider"></div>`;
    },

    gradientType: (l) => {
        if (!l || (l.type !== 'shape' && l.type !== 'text')) return `<span class="ctx-label" style="color:var(--muted)">Yazı veya şekil katmanı seç</span>`;
        const prop = l.type === 'text' ? 'color' : 'fill';
        const val = l[prop] || '';
        const isRadial = val.includes('radial');
        const colors = parseGradientColors(val);
        const c1 = colors[0] || '#3b82f6';
        const c2 = colors[1] || '#8b5cf6';
        const angleMatch = val.match(/(\d+)deg/);
        const angle = angleMatch ? angleMatch[1] : 135;
        return `
            <button class="ctx-btn ${!isRadial ? 'active' : ''}" onclick="applyLayerPatchViaEngine('${l.id}',{${prop}:'linear-gradient(${angle}deg,${c1},${c2})'},{ refreshInspector: true, refreshContextBar: true })">⇢ Linear</button>
            <button class="ctx-btn ${isRadial ? 'active' : ''}" onclick="applyLayerPatchViaEngine('${l.id}',{${prop}:'radial-gradient(circle,${c1},${c2})'},{ refreshInspector: true, refreshContextBar: true })">◎ Radial</button>
            <div class="ctx-divider"></div>`;
    },

    gradientAngle: (l) => {
        if (!l || (l.type !== 'shape' && l.type !== 'text')) return '';
        const prop = l.type === 'text' ? 'color' : 'fill';
        const val = l[prop] || '';
        if (val.includes('radial')) return '';
        const colors = parseGradientColors(val);
        const c1 = colors[0] || '#3b82f6';
        const c2 = colors[1] || '#8b5cf6';
        const angleMatch = val.match(/(\d+)deg/);
        const angle = angleMatch ? angleMatch[1] : 135;
        return `
            <span class="ctx-label">Açı</span>
            <input class="ctx-range" type="range" min="0" max="360" value="${angle}" style="width:70px"
                oninput="applyLayerPatchViaEngine('${l.id}',{${prop}:'linear-gradient('+this.value+'deg,${c1},${c2})'},{ refreshInspector: true }); this.nextElementSibling.textContent=this.value+'°'">
            <span class="ctx-label" style="min-width:32px">${angle}°</span>
            <div class="ctx-divider"></div>`;
    },

    gradientColor1: (l) => {
        if (!l || (l.type !== 'shape' && l.type !== 'text')) return '';
        const prop = l.type === 'text' ? 'color' : 'fill';
        const colors = parseGradientColors(l[prop] || '');
        return `<div class="ctx-swatch" style="background:${colors[0] || '#3b82f6'}" title="Renk 1" onclick="openInspectorFlyout('gradient')"></div>`;
    },

    gradientColor2: (l) => {
        if (!l || (l.type !== 'shape' && l.type !== 'text')) return '';
        const prop = l.type === 'text' ? 'color' : 'fill';
        const colors = parseGradientColors(l[prop] || '');
        return `<div class="ctx-swatch" style="background:${colors[1] || '#8b5cf6'}" title="Renk 2" onclick="openInspectorFlyout('gradient')"></div>`;
    },

    brushSize: () => `
        <span class="ctx-label">Boyut</span>
        <input id="ctx_brush_size" class="ctx-range" type="range" min="1" max="200" value="${drawState.brushSize}"
            style="width:90px" oninput="drawState.brushSize=+this.value; this.nextElementSibling.textContent=this.value+'px'">
        <span id="ctx_brush_size_value" class="ctx-label" style="min-width:36px">${drawState.brushSize}px</span>
        <div class="ctx-divider"></div>`,

    hardness: () => `
        <span class="ctx-label">Sertlik</span>
        <input id="ctx_hardness" class="ctx-range" type="range" min="0" max="100" value="${drawState.hardness}"
            oninput="drawState.hardness=+this.value; this.nextElementSibling.textContent=this.value+'%'">
        <span id="ctx_hardness_value" class="ctx-label" style="min-width:34px">${drawState.hardness}%</span>
        <div class="ctx-divider"></div>`,

    blurStrength: () => `
        <span class="ctx-label">Blur</span>
        <input id="ctx_blur_strength" class="ctx-range" type="range" min="1" max="40" value="${drawState.blurStrength}"
            oninput="drawState.blurStrength=+this.value; this.nextElementSibling.textContent=this.value+'px'">
        <span id="ctx_blur_strength_value" class="ctx-label" style="min-width:34px">${drawState.blurStrength}px</span>
        <div class="ctx-divider"></div>`,

    tolerance: () => `
        <span class="ctx-label">Tolerans</span>
        <input id="ctx_tolerance" class="ctx-range" type="range" min="0" max="100" value="${drawState.tolerance}"
            oninput="drawState.tolerance=+this.value; this.nextElementSibling.textContent=this.value+'%'">
        <span id="ctx_tolerance_value" class="ctx-label" style="min-width:34px">${drawState.tolerance}%</span>
        <div class="ctx-divider"></div>`,

    contiguous: () => `
        <button class="ctx-btn ${drawState.contiguous ? 'active' : ''}" data-ctx-contiguous="true"
            onclick="drawState.contiguous=true; renderContextBar()">Bitişik</button>
        <button class="ctx-btn ${!drawState.contiguous ? 'active' : ''}" data-ctx-contiguous="false"
            onclick="drawState.contiguous=false; renderContextBar()">Tüm Tuval</button>`,

    eraserMode: () => `
        <button class="ctx-btn ${drawState.eraserMode === 'pixel' ? 'active' : ''}" data-ctx-eraser-mode="pixel"
            onclick="drawState.eraserMode='pixel'; renderContextBar()">Piksel</button>
        <button class="ctx-btn ${drawState.eraserMode === 'layer' ? 'active' : ''}" data-ctx-eraser-mode="layer"
            onclick="drawState.eraserMode='layer'; renderContextBar()">Katman</button>`
};

function renderTransformBar(l) {
    const xv = l ? Math.round(l.x) : 0;
    const yv = l ? Math.round(l.y) : 0;
    const wv = l ? Math.round(l.width) : 0;
    const hv = l ? Math.round(l.height) : 0;
    const op = l ? Math.round(l.opacity * 100) : 100;
    const canToggleAspectLock = l?.type === 'raster' || l?.type === 'shape';
    return `
        <button class="ctx-btn ${isAutoSelectEnabled ? 'active' : ''}" type="button" title="Tuvalde tiklanan katmani otomatik sec"
            onclick="toggleAutoSelect()">
            Oto Seçim
        </button>
        <div class="ctx-divider"></div>
        <span class="ctx-label">Hizala</span>
        <button class="ctx-btn" onclick="alignSelectedToCanvas('left')" title="Sola"><i class="fa-solid fa-align-left"></i></button>
        <button class="ctx-btn" onclick="alignSelectedToCanvas('center')" title="Yatay Ortala"><i class="fa-solid fa-arrows-left-right-to-line"></i></button>
        <button class="ctx-btn" onclick="alignSelectedToCanvas('right')" title="Sağa"><i class="fa-solid fa-align-right"></i></button>
        <div class="ctx-group-gap"></div>
        <button class="ctx-btn" onclick="alignSelectedToCanvas('top')" title="Üste"><i class="fa-solid fa-arrow-up-short-wide"></i></button>
        <button class="ctx-btn" onclick="alignSelectedToCanvas('middle')" title="Dikey Ortala"><i class="fa-solid fa-align-center"></i></button>
        <button class="ctx-btn" onclick="alignSelectedToCanvas('bottom')" title="Alta"><i class="fa-solid fa-arrow-down-wide-short"></i></button>
        <div class="ctx-divider"></div>
        <span class="ctx-label">X</span>
        <input id="ctx_transform_x" class="ctx-input" type="number" value="${xv}" oninput="applySelectedLayerPatch({x:+this.value},{ refreshInspector: true, refreshContextBar: true })">
        <span class="ctx-label">Y</span>
        <input id="ctx_transform_y" class="ctx-input" type="number" value="${yv}" oninput="applySelectedLayerPatch({y:+this.value},{ refreshInspector: true, refreshContextBar: true })">
        <span class="ctx-label">G</span>
        <input id="ctx_transform_width" class="ctx-input" type="number" value="${wv}" oninput="if(selectedId) updateSelectedDimension('width', this.value)" onblur="if(selectedId) finalizeSelectedDimension('width', this.value)">
        <button id="ctx_transform_aspect_lock" class="ctx-btn ${canToggleAspectLock && l.aspectLocked ? 'active' : ''}" ${canToggleAspectLock ? `onclick="toggleSelectedAspectLock()"` : 'disabled'} title="Oranı Kilitle">
            <i id="ctx_transform_aspect_lock_icon" class="fa-solid ${canToggleAspectLock && l.aspectLocked ? 'fa-link' : 'fa-link-slash'}"></i>
        </button>
        <span class="ctx-label">Y</span>
        <input id="ctx_transform_height" class="ctx-input" type="number" value="${hv}" oninput="if(selectedId) updateSelectedDimension('height', this.value)" onblur="if(selectedId) finalizeSelectedDimension('height', this.value)">
        <div class="ctx-divider"></div>
        <span class="ctx-label">Opaklık</span>
        <input id="ctx_transform_opacity" class="ctx-range" type="range" min="0" max="100" value="${op}" oninput="applySelectedLayerPatch({opacity:this.value/100},{ refreshInspector: true }); this.nextElementSibling.textContent=this.value+'%'">
        <span id="ctx_transform_opacity_value" class="ctx-label" style="min-width:34px">${op}%</span>
    `;
}

function renderEyedropperBar() {
    const fgDisplay = cwFgColor;
    return `
        <span class="ctx-label">Seçilen Renk</span>
        <div class="ctx-swatch" style="background:${fgDisplay};width:28px;height:28px;" id="eyedropperResult"></div>
        <span class="ctx-label" style="font-family:monospace;font-size:11px;">${fgDisplay}</span>
    `;
}

function renderGradientToolBar() {
    const hasRaster = !!getSelectedRasterLayerForCanvasTool();
    const preset = typeof getGradientToolPreset === 'function' ? getGradientToolPreset() : null;
    const preview = preset ? buildGradientCssValue({
        gradientType: 'linear',
        angle: 90,
        stops: preset.stops
    }) : `linear-gradient(90deg, ${cwFgColor}, ${cwBgColor})`;
    const stopCount = preset?.stops?.length || 2;
    const gradientType = preset?.gradientType === 'radial' ? 'radial' : 'linear';
    const angle = Math.round(preset?.angle ?? 135);
    const isOpen = !!gradientEditorUiState?.contextOpen;
    const editorMarkup = typeof buildGradientEditorMarkup === 'function'
        ? buildGradientEditorMarkup({
            mode: 'tool',
            compact: true,
            showTypeControls: false,
            showAngleControl: false
        })
        : '';

    return `
        <div class="ctx-gradient-anchor">
            <button class="ctx-btn ${isOpen ? 'active' : ''}" type="button" data-open-gradient-popover onclick="toggleContextGradientPopover()">
                <span>Gradients</span>
                <div class="ctx-swatch" data-ctx-gradient-preview style="background:${preview};width:42px;height:22px;border-radius:8px;" title="Gradient önizleme"></div>
                <span class="ctx-label" data-ctx-gradient-stop-count style="color:inherit;font-size:11px;">${stopCount} durak</span>
                <i class="fa-solid fa-chevron-${isOpen ? 'up' : 'down'}"></i>
            </button>
            ${isOpen ? `<div class="ctx-gradient-popover">${editorMarkup}</div>` : ''}
        </div>
        <div class="ctx-group-gap"></div>
        <button class="ctx-btn ${gradientType === 'linear' ? 'active' : ''}" type="button"
            onclick="setGradientEditorType('tool','','','','linear')">
            <i class="fa-solid fa-arrows-left-right"></i>
            <span>Linear</span>
        </button>
        <button class="ctx-btn ${gradientType === 'radial' ? 'active' : ''}" type="button"
            onclick="setGradientEditorType('tool','','','','radial')">
            <i class="fa-solid fa-circle-half-stroke"></i>
            <span>Radial</span>
        </button>
        ${gradientType === 'linear' ? `
            <div class="ctx-group-gap"></div>
            <span class="ctx-label">Açı</span>
            <input class="ctx-range" type="range" min="0" max="360" value="${angle}"
                oninput="setGradientEditorAngle('tool','','','',this.value,true)">
            <span class="ctx-label" data-ctx-gradient-angle-readout style="min-width:32px">${angle}°</span>
            <input class="ctx-input" data-ctx-gradient-angle-number type="number" min="0" max="360" value="${angle}"
                onfocus="this.select()"
                onchange="setGradientEditorAngle('tool','','','',this.value)"
                onblur="setGradientEditorAngle('tool','','','',this.value)">
        ` : ''}
        <div class="ctx-divider"></div>
    `;
}

function getContextTargetUpdateJs(layer, patchJs) {
    if (layer?.__toolPresetKey) {
        return `updateToolPreset('${layer.__toolPresetKey}', ${patchJs});`;
    }
    return `applyLayerPatchViaEngine('${layer.id}', ${patchJs}, { refreshInspector: true });`;
}

function getToolPresetForTool(toolKey) {
    return TOOL_PRESETS[toolKey] || null;
}

function buildToolPresetLayer(tool) {
    const preset = getToolPresetForTool(tool.key);
    if (!preset) return null;

    const type = tool.capabilities?.creates === 'raster' ? 'raster' : tool.capabilities?.creates;
    if (!type) return null;

    return {
        id: `preset_${tool.key}`,
        type,
        __toolPresetKey: tool.key,
        ...preset
    };
}

function getContextBarSubject(activeTool, selectedLayer) {
    if (!activeTool) return selectedLayer;

    if (activeTool.group === 'add') {
        const expectedType = activeTool.capabilities?.creates === 'raster'
            ? 'raster'
            : activeTool.capabilities?.creates;

        if (selectedLayer && selectedLayer.type === expectedType) {
            return selectedLayer;
        }

        return buildToolPresetLayer(activeTool);
    }

    return selectedLayer;
}

function getInspectorSubject(type) {
    const activeTool = allTools.find(t => t.key === currentTool);
    const selectedLayer = getLayer();
    if (selectedLayer) return selectedLayer;

    if (type === 'color') {
        const activePreset = activeTool ? buildToolPresetLayer(activeTool) : null;
        if (activePreset && (activePreset.type === 'text' || activePreset.type === 'shape')) {
            return activePreset;
        }

        const textTool = allTools.find(t => t.key === 'text');
        const shapeTool = allTools.find(t => t.key === 'shape');
        return buildToolPresetLayer(textTool) || buildToolPresetLayer(shapeTool);
    }

    const contextual = getContextBarSubject(activeTool, null);
    if (contextual) return contextual;

    const textTool = allTools.find(t => t.key === 'text');
    const shapeTool = allTools.find(t => t.key === 'shape');
    const imageTool = allTools.find(t => t.key === 'image');
    return buildToolPresetLayer(textTool) || buildToolPresetLayer(shapeTool) || buildToolPresetLayer(imageTool);
}

function getInspectorTargetUpdateJs(layer, patchJs) {
    return `${getContextTargetUpdateJs(layer, patchJs)} refreshInspectorFlyoutIfNeeded();`;
}

function renderToolContextLead(tool) {
    if (!tool) return '';
    const iconClass = tool.icon.includes(' ') ? tool.icon : `fa-solid ${tool.icon}`;
    return `
        <span class="ctx-tool-lead">
            <i class="${iconClass}"></i>
            <span>${tool.label}</span>
        </span>
        <div class="ctx-divider"></div>
    `;
}

let contextBarSignature = '';

function buildContextBarSignature(activeTool, layer) {
    if (!activeTool) return '';
    const targetKey = layer?.__toolPresetKey || layer?.id || '';
    const targetType = layer?.type || '';
    const props = (activeTool.capabilities?.contextBarProps || []).join(',');
    const gradientPreset = activeTool.key === 'gradient' && typeof getGradientToolPreset === 'function'
        ? getGradientToolPreset()
        : null;
    const dynamicKey = activeTool.key === 'eyedropper'
        ? cwFgColor
        : activeTool.key === 'move'
            ? String(!!isAutoSelectEnabled)
        : activeTool.key === 'gradient'
            ? [
                cwFgColor,
                cwBgColor,
                !!getSelectedRasterLayerForCanvasTool(),
                gradientPreset?.gradientType || 'linear',
                gradientPreset?.angle ?? 135,
                buildGradientCssValue(gradientPreset || {}) || '',
                gradientPreset?.stops?.length || 0,
                gradientEditorUiState?.contextOpen ? '1' : '0',
                gradientEditorUiState?.selectedStopIndex || 0,
                gradientEditorUiState?.selectedHandle || 'color'
            ].join('|')
            : '';
    return [
        activeTool.key,
        activeTool.contextBarType || '',
        targetKey,
        targetType,
        props,
        dynamicKey
    ].join('|');
}

function setInputValueIfNeeded(id, value) {
    const input = document.getElementById(id);
    if (!input) return;
    const next = String(value ?? '');
    if (input.value !== next) input.value = next;
}

function setTextContentIfNeeded(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const next = String(value ?? '');
    if (el.textContent !== next) el.textContent = next;
}

function syncTomSelectControl(id, value, options) {
    const select = document.getElementById(id);
    const instance = select?.tomselect;
    if (!select || !instance) return;

    const normalizedOptions = (options || []).map(opt => ({
        value: String(opt.value),
        text: opt.label
    }));

    instance.clearOptions();
    instance.addOptions(normalizedOptions);
    instance.refreshOptions(false);
    instance.setValue(String(value ?? ''), true);
}

function syncButtonActiveState(selector, isActive) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.toggle('active', !!isActive);
}

function syncButtonGroupState(selector, activeValue) {
    document.querySelectorAll(selector).forEach(el => {
        el.classList.toggle('active', el.dataset.value === String(activeValue));
    });
}

function syncContextBarValues(activeTool, layer) {
    if (!activeTool) return;

    if (activeTool.contextBarType === 'transform') {
        const current = layer || getLayer();
        if (!current) return;
        setInputValueIfNeeded('ctx_transform_x', Math.round(current.x || 0));
        setInputValueIfNeeded('ctx_transform_y', Math.round(current.y || 0));
        setInputValueIfNeeded('ctx_transform_width', Math.round(current.width || 0));
        setInputValueIfNeeded('ctx_transform_height', Math.round(current.height || 0));
        setInputValueIfNeeded('ctx_transform_opacity', Math.round((current.opacity ?? 1) * 100));
        setTextContentIfNeeded('ctx_transform_opacity_value', `${Math.round((current.opacity ?? 1) * 100)}%`);
        const aspectBtn = document.getElementById('ctx_transform_aspect_lock');
        const aspectIcon = document.getElementById('ctx_transform_aspect_lock_icon');
        const canToggle = current.type === 'raster' || current.type === 'shape';
        if (aspectBtn) {
            aspectBtn.disabled = !canToggle;
            aspectBtn.classList.toggle('active', !!(canToggle && current.aspectLocked));
        }
        if (aspectIcon) {
            aspectIcon.className = `fa-solid ${canToggle && current.aspectLocked ? 'fa-link' : 'fa-link-slash'}`;
        }
        return;
    }

    if (activeTool.contextBarType === 'eyedropper') {
        const swatch = document.getElementById('eyedropperResult');
        if (swatch) swatch.style.background = cwFgColor;
        return;
    }

    const current = layer;

    const props = activeTool.capabilities?.contextBarProps || [];
    props.forEach(propKey => {
        if (propKey === 'fontFamily') {
            if (!current) return;
            syncTomSelectControl('ctx_font_family', current.fontFamily || 'Inter', FONTS.length
                ? FONTS.map(f => ({ value: f.family, label: f.family }))
                : [{ value: 'Inter', label: 'Inter' }]);
        }
        if (propKey === 'fontWeight') {
            if (!current) return;
            syncTomSelectControl('ctx_font_weight', current.fontWeight, getFontWeightOptions(current.fontFamily || 'Inter'));
        }
        if (propKey === 'fontSize') {
            if (!current) return;
            setInputValueIfNeeded('ctx_font_size', current.fontSize || 42);
        }
        if (propKey === 'textAlign') {
            if (!current) return;
            document.querySelectorAll('[data-ctx-text-align]').forEach(el => {
                el.classList.toggle('active', el.dataset.ctxTextAlign === String(current.textAlign || 'left'));
            });
        }
        if (propKey === 'verticalAlign') {
            if (!current) return;
            document.querySelectorAll('[data-ctx-vertical-align]').forEach(el => {
                el.classList.toggle('active', el.dataset.ctxVerticalAlign === String(current.verticalAlign || 'top'));
            });
        }
        if (propKey === 'textDecoration') {
            if (!current) return;
            syncButtonActiveState('[data-ctx-text-deco="bold"]', (current.fontWeight || 400) >= 700);
            syncButtonActiveState('[data-ctx-text-deco="italic"]', current.fontStyle === 'italic');
            syncButtonActiveState('[data-ctx-text-deco="underline"]', current.textDecoration === 'underline');
            syncButtonActiveState('[data-ctx-text-deco="strike"]', current.textDecoration === 'line-through');
        }
        if (propKey === 'radius') {
            if (!current) return;
            setInputValueIfNeeded('ctx_radius', current.radius || 0);
        }
        if (propKey === 'rotation') {
            if (!current) return;
            setInputValueIfNeeded('ctx_rotation', Math.round(current.rotation || 0));
        }
        if (propKey === 'opacity') {
            if (!current) return;
            const opacity = Math.round((current.opacity ?? 1) * 100);
            setInputValueIfNeeded('ctx_opacity_range', opacity);
            setTextContentIfNeeded('ctx_opacity_value', `${opacity}%`);
        }
        if (propKey === 'aspectLocked') {
            if (!current) return;
            document.querySelectorAll('[data-ctx-aspect]').forEach(el => {
                const isLocked = el.dataset.ctxAspect === 'locked';
                el.classList.toggle('active', isLocked ? !!current.aspectLocked : !current.aspectLocked);
            });
        }
        if (propKey === 'brushSize') {
            setInputValueIfNeeded('ctx_brush_size', drawState.brushSize);
            setTextContentIfNeeded('ctx_brush_size_value', `${drawState.brushSize}px`);
        }
        if (propKey === 'hardness') {
            setInputValueIfNeeded('ctx_hardness', drawState.hardness);
            setTextContentIfNeeded('ctx_hardness_value', `${drawState.hardness}%`);
        }
        if (propKey === 'blurStrength') {
            setInputValueIfNeeded('ctx_blur_strength', drawState.blurStrength);
            setTextContentIfNeeded('ctx_blur_strength_value', `${drawState.blurStrength}px`);
        }
        if (propKey === 'tolerance') {
            setInputValueIfNeeded('ctx_tolerance', drawState.tolerance);
            setTextContentIfNeeded('ctx_tolerance_value', `${drawState.tolerance}%`);
        }
        if (propKey === 'contiguous') {
            document.querySelectorAll('[data-ctx-contiguous]').forEach(el => {
                el.classList.toggle('active', String(drawState.contiguous) === el.dataset.ctxContiguous);
            });
        }
        if (propKey === 'eraserMode') {
            document.querySelectorAll('[data-ctx-eraser-mode]').forEach(el => {
                el.classList.toggle('active', drawState.eraserMode === el.dataset.ctxEraserMode);
            });
        }
    });
}

function renderContextBar() {
    const activeTool = allTools.find(t => t.key === currentTool);
    const l = getContextBarSubject(activeTool, getLayer());
    const signature = buildContextBarSignature(activeTool, l);

    if (!activeTool) {
        contextBar.innerHTML = '';
        contextBarSignature = '';
        return;
    }

    if (signature && signature === contextBarSignature) {
        syncContextBarValues(activeTool, l);
        return;
    }

    if (activeTool.contextBarType === 'transform') {
        contextBar.innerHTML = renderToolContextLead(activeTool) + renderTransformBar(l);
        contextBarSignature = signature;
        return;
    }

    if (activeTool.contextBarType === 'eyedropper') {
        contextBar.innerHTML = renderToolContextLead(activeTool) + renderEyedropperBar();
        contextBarSignature = signature;
        return;
    }

    if (activeTool.key === 'gradient') {
        contextBar.innerHTML = renderToolContextLead(activeTool) + renderGradientToolBar();
        contextBarSignature = signature;
        return;
    }

    const props = activeTool.capabilities?.contextBarProps;
    if (!props || !props.length) {
        contextBar.innerHTML = renderToolContextLead(activeTool);
        contextBarSignature = signature;
        return;
    }

    if (activeTool.contextBarType === 'layer-props' && !l) {
        contextBar.innerHTML = renderToolContextLead(activeTool) + `<span class="ctx-label" style="color:var(--muted)">Katman seç</span>`;
        contextBarSignature = signature;
        return;
    }

    contextBar.innerHTML = renderToolContextLead(activeTool) + props
        .map(propKey => {
            const renderer = PROP_RENDERERS[propKey];
            if (!renderer) return `<!-- renderer yok: ${propKey} -->`;
            return renderer(l);
        })
        .join('');
    contextBarSignature = signature;
}

function toggleAutoSelect() {
    isAutoSelectEnabled = !isAutoSelectEnabled;
    renderContextBar();
}

window.renderContextBar = renderContextBar;
window.toggleAutoSelect = toggleAutoSelect;
