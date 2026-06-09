function openImagePicker() {
    const input = document.getElementById('imageInput');
    if (input) {
        input.click();
    }
}

const LAYER_STYLE_SECTIONS = [
    { key: 'blending', label: 'Blending Options', icon: 'fa-sliders' },
    { key: 'stroke', label: 'Stroke', icon: 'fa-square-full' },
    { key: 'colorOverlay', label: 'Color Overlay', icon: 'fa-fill-drip' },
    { key: 'gradientOverlay', label: 'Gradient Overlay', icon: 'fa-swatchbook' },
    { key: 'patternOverlay', label: 'Pattern Overlay', icon: 'fa-chess-board' },
    { key: 'innerShadow', label: 'Inner Shadow', icon: 'fa-circle-chevron-down' },
    { key: 'outerGlow', label: 'Outer Glow', icon: 'fa-sun' },
    { key: 'dropShadow', label: 'Drop Shadow', icon: 'fa-cloud-moon' }
];

function getLayerStyleModalTarget(layerId = selectedId) {
    return getLayer(layerId);
}

function getLayerStyleValue(layer, path) {
    return String(path).split('.').reduce((acc, key) => acc?.[key], layer?.layerStyle);
}

function ensureLayerStyle(layer) {
    if (!layer) return createDefaultLayerStyle();
    layer.layerStyle = mergeLayerStyle(createDefaultLayerStyle(), layer.layerStyle || {});
    return layer.layerStyle;
}

function setLayerStyleValue(layer, path, value) {
    const parts = String(path).split('.');
    let cursor = layer.layerStyle;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key];
    }
    cursor[parts.at(-1)] = value;
}

function formatLayerStyleColor(value) {
    const parsed = parseColor(value || '#000000');
    return '#' + [parsed.r, parsed.g, parsed.b].map(part => part.toString(16).padStart(2, '0')).join('');
}

function renderLayerStyleField(label, inputHtml, hint = '') {
    return `
        <div class="layer-style-field">
            <label>${label}</label>
            ${inputHtml}
            ${hint ? `<div class="layer-style-hint">${hint}</div>` : ''}
        </div>
    `;
}

function renderLayerStyleRangeField(label, path, value, min, max, step = 1, suffix = '', layerId = selectedId) {
    return renderLayerStyleField(label, `
        <div class="gradient-input-row">
            <input type="range" min="${min}" max="${max}" step="${step}" value="${value}"
                oninput="updateLayerStyleField('${layerId}','${path}', this.value, 'number', false)">
            <input type="number" min="${min}" max="${max}" step="${step}" value="${value}"
                onfocus="this.select()"
                onchange="updateLayerStyleField('${layerId}','${path}', this.value, 'number', false)"
                onblur="updateLayerStyleField('${layerId}','${path}', this.value, 'number', false)">
            <span class="layer-style-suffix">${suffix}</span>
        </div>
    `);
}

function renderLayerStyleColorField(label, path, value, layerId = selectedId) {
    const pickrId = `layer_style_pickr_${layerId}_${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const inputId = `layer_style_input_${layerId}_${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const initialHex = formatLayerStyleColor(value);

    setTimeout(() => {
        const el = document.getElementById(pickrId);
        const input = document.getElementById(inputId);
        if (!el || el._pickrInit) return;
        el._pickrInit = true;

        const pickr = Pickr.create({
            el,
            theme: 'nano',
            default: initialHex,
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
            if (input) input.value = hex.toUpperCase();
            updateLayerStyleField(layerId, path, hex, 'string', false);
        });
    }, 0);

    return renderLayerStyleField(label, `
        <div class="layer-style-color-row">
            <div id="${pickrId}" class="layer-style-pickr-host"></div>
            <input id="${inputId}" type="text" value="${initialHex}"
                onfocus="this.select()"
                onchange="updateLayerStyleField('${layerId}','${path}', this.value, 'string', false)"
                onblur="updateLayerStyleField('${layerId}','${path}', this.value, 'string', false)">
        </div>
    `);
}

function renderLayerStyleToggle(path, checked, layerId = selectedId) {
    return `
        <label class="layer-style-toggle">
            <input type="checkbox" ${checked ? 'checked' : ''} onchange="updateLayerStyleField('${layerId}','${path}', this.checked, 'boolean', true)">
            <span>Açık</span>
        </label>
    `;
}

function renderLayerStyleSectionContent(layer, sectionKey) {
    const style = ensureLayerStyle(layer);

    if (sectionKey === 'blending') {
        return `
            <div class="layer-style-card">
                ${renderLayerStyleField('Blend Mode', `
                    <select onchange="updateLayerStyleField('${layer.id}','blendMode', this.value, 'string', false)">
                        ${['normal','multiply','screen','overlay','soft-light','hard-light','color-dodge','color-burn','difference','exclusion','luminosity'].map(mode => `
                            <option value="${mode}" ${style.blendMode === mode ? 'selected' : ''}>${mode}</option>
                        `).join('')}
                    </select>
                `)}
                ${renderLayerStyleRangeField('Fill Opacity', 'fillOpacity', style.fillOpacity, 0, 100, 1, '%', layer.id)}
                ${renderLayerStyleRangeField('Katman Opacity', 'opacity', Math.round((layer.opacity ?? 1) * 100), 0, 100, 1, '%', layer.id)}
            </div>
        `;
    }

    if (sectionKey === 'stroke') {
        return `
            <div class="layer-style-card">
                <div class="layer-style-card-head">
                    <div class="layer-style-card-title">Stroke</div>
                    ${renderLayerStyleToggle('stroke.enabled', style.stroke.enabled, layer.id)}
                </div>
                ${renderLayerStyleColorField('Renk', 'stroke.color', style.stroke.color, layer.id)}
                ${renderLayerStyleRangeField('Opacity', 'stroke.opacity', style.stroke.opacity, 0, 100, 1, '%', layer.id)}
                ${renderLayerStyleRangeField('Size', 'stroke.size', style.stroke.size, 1, 80, 1, 'px', layer.id)}
                ${renderLayerStyleField('Position', `
                    <select onchange="updateLayerStyleField('${layer.id}','stroke.position', this.value, 'string', false)">
                        ${['inside','center','outside'].map(position => `
                            <option value="${position}" ${style.stroke.position === position ? 'selected' : ''}>${position}</option>
                        `).join('')}
                    </select>
                `)}
                ${renderLayerStyleField('Blend Mode', `
                    <select onchange="updateLayerStyleField('${layer.id}','stroke.blendMode', this.value, 'string', false)">
                        ${['normal','multiply','screen','overlay','soft-light','hard-light','difference'].map(mode => `
                            <option value="${mode}" ${style.stroke.blendMode === mode ? 'selected' : ''}>${mode}</option>
                        `).join('')}
                    </select>
                `)}
            </div>
        `;
    }

    if (sectionKey === 'colorOverlay') {
        return `
            <div class="layer-style-card">
                <div class="layer-style-card-head">
                    <div class="layer-style-card-title">Color Overlay</div>
                    ${renderLayerStyleToggle('colorOverlay.enabled', style.colorOverlay.enabled, layer.id)}
                </div>
                ${renderLayerStyleColorField('Renk', 'colorOverlay.color', style.colorOverlay.color, layer.id)}
                ${renderLayerStyleRangeField('Opacity', 'colorOverlay.opacity', style.colorOverlay.opacity, 0, 100, 1, '%', layer.id)}
                ${renderLayerStyleField('Blend Mode', `
                    <select onchange="updateLayerStyleField('${layer.id}','colorOverlay.blendMode', this.value, 'string', false)">
                        ${['normal','multiply','screen','overlay','soft-light','hard-light','color-dodge','color-burn','difference'].map(mode => `
                            <option value="${mode}" ${style.colorOverlay.blendMode === mode ? 'selected' : ''}>${mode}</option>
                        `).join('')}
                    </select>
                `)}
            </div>
        `;
    }

    if (sectionKey === 'gradientOverlay') {
        return `
            <div class="layer-style-card">
                <div class="layer-style-card-head">
                    <div class="layer-style-card-title">Gradient Overlay</div>
                    ${renderLayerStyleToggle('gradientOverlay.enabled', style.gradientOverlay.enabled, layer.id)}
                </div>
                ${buildGradientEditorMarkup({
                    mode: 'layerStyle',
                    layerId: layer.id,
                    compact: true,
                    showTypeControls: true,
                    showAngleControl: true
                })}
                ${renderLayerStyleRangeField('Opacity', 'gradientOverlay.opacity', style.gradientOverlay.opacity, 0, 100, 1, '%', layer.id)}
                ${renderLayerStyleField('Blend Mode', `
                    <select onchange="updateLayerStyleField('${layer.id}','gradientOverlay.blendMode', this.value, 'string', false)">
                        ${['normal','multiply','screen','overlay','soft-light','hard-light','difference'].map(mode => `
                            <option value="${mode}" ${style.gradientOverlay.blendMode === mode ? 'selected' : ''}>${mode}</option>
                        `).join('')}
                    </select>
                `)}
            </div>
        `;
    }

    if (sectionKey === 'patternOverlay') {
        return `
            <div class="layer-style-card">
                <div class="layer-style-card-head">
                    <div class="layer-style-card-title">Pattern Overlay</div>
                    ${renderLayerStyleToggle('patternOverlay.enabled', style.patternOverlay.enabled, layer.id)}
                </div>
                ${renderLayerStyleField('Pattern', `
                    <select onchange="updateLayerStyleField('${layer.id}','patternOverlay.pattern', this.value, 'string', true)">
                        ${[
                            ['dots','Dots'],
                            ['grid','Grid'],
                            ['stripes','Stripes'],
                            ['cross','Cross']
                        ].map(([value, label]) => `<option value="${value}" ${style.patternOverlay.pattern === value ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                `)}
                ${renderLayerStyleColorField('Ön Renk', 'patternOverlay.foreground', style.patternOverlay.foreground, layer.id)}
                ${renderLayerStyleColorField('Arka Renk', 'patternOverlay.background', style.patternOverlay.background, layer.id)}
                ${renderLayerStyleRangeField('Opacity', 'patternOverlay.opacity', style.patternOverlay.opacity, 0, 100, 1, '%', layer.id)}
                ${renderLayerStyleRangeField('Scale', 'patternOverlay.scale', style.patternOverlay.scale, 6, 80, 1, 'px', layer.id)}
                ${renderLayerStyleField('Blend Mode', `
                    <select onchange="updateLayerStyleField('${layer.id}','patternOverlay.blendMode', this.value, 'string', false)">
                        ${['normal','overlay','soft-light','multiply','screen','difference'].map(mode => `
                            <option value="${mode}" ${style.patternOverlay.blendMode === mode ? 'selected' : ''}>${mode}</option>
                        `).join('')}
                    </select>
                `)}
            </div>
        `;
    }

    if (sectionKey === 'innerShadow') {
        return `
            <div class="layer-style-card">
                <div class="layer-style-card-head">
                    <div class="layer-style-card-title">Inner Shadow</div>
                    ${renderLayerStyleToggle('innerShadow.enabled', style.innerShadow.enabled, layer.id)}
                </div>
                ${renderLayerStyleColorField('Renk', 'innerShadow.color', style.innerShadow.color, layer.id)}
                ${renderLayerStyleRangeField('Opacity', 'innerShadow.opacity', style.innerShadow.opacity, 0, 100, 1, '%', layer.id)}
                ${renderLayerStyleRangeField('Açı', 'innerShadow.angle', style.innerShadow.angle, 0, 360, 1, 'deg', layer.id)}
                ${renderLayerStyleRangeField('Distance', 'innerShadow.distance', style.innerShadow.distance, 0, 100, 1, 'px', layer.id)}
                ${renderLayerStyleRangeField('Blur', 'innerShadow.blur', style.innerShadow.blur, 0, 120, 1, 'px', layer.id)}
                ${renderLayerStyleRangeField('Spread', 'innerShadow.spread', style.innerShadow.spread, -40, 40, 1, 'px', layer.id)}
            </div>
        `;
    }

    if (sectionKey === 'outerGlow') {
        return `
            <div class="layer-style-card">
                <div class="layer-style-card-head">
                    <div class="layer-style-card-title">Outer Glow</div>
                    ${renderLayerStyleToggle('outerGlow.enabled', style.outerGlow.enabled, layer.id)}
                </div>
                ${renderLayerStyleColorField('Renk', 'outerGlow.color', style.outerGlow.color, layer.id)}
                ${renderLayerStyleRangeField('Opacity', 'outerGlow.opacity', style.outerGlow.opacity, 0, 100, 1, '%', layer.id)}
                ${renderLayerStyleRangeField('Size', 'outerGlow.size', style.outerGlow.size, 0, 120, 1, 'px', layer.id)}
            </div>
        `;
    }

    return `
        <div class="layer-style-card">
            <div class="layer-style-card-head">
                <div class="layer-style-card-title">Drop Shadow</div>
                ${renderLayerStyleToggle('dropShadow.enabled', style.dropShadow.enabled, layer.id)}
            </div>
            ${renderLayerStyleColorField('Renk', 'dropShadow.color', style.dropShadow.color, layer.id)}
            ${renderLayerStyleRangeField('Opacity', 'dropShadow.opacity', style.dropShadow.opacity, 0, 100, 1, '%', layer.id)}
            ${renderLayerStyleRangeField('Açı', 'dropShadow.angle', style.dropShadow.angle, 0, 360, 1, 'deg', layer.id)}
            ${renderLayerStyleRangeField('Distance', 'dropShadow.distance', style.dropShadow.distance, 0, 120, 1, 'px', layer.id)}
            ${renderLayerStyleRangeField('Blur', 'dropShadow.blur', style.dropShadow.blur, 0, 120, 1, 'px', layer.id)}
            ${renderLayerStyleRangeField('Spread', 'dropShadow.spread', style.dropShadow.spread, -40, 40, 1, 'px', layer.id)}
        </div>
    `;
}

function renderLayerStyleModal() {
    const layer = getLayerStyleModalTarget();
    if (!layer || !layerStyleModalBody || !layerStyleModalTitle || !layerStyleModalSubtitle) return;
    ensureLayerStyle(layer);

    layerStyleModalTitle.textContent = `${layer.name} · Katman Stili`;
    layerStyleModalSubtitle.textContent = 'Photoshop benzeri katman efektleri ve blending kontrolleri';

    layerStyleModalBody.innerHTML = `
        <div class="layer-style-layout">
            <aside class="layer-style-sidebar">
                ${LAYER_STYLE_SECTIONS.map(section => `
                    <button type="button" class="layer-style-nav-btn ${activeLayerStyleSection === section.key ? 'active' : ''}"
                        onclick="setLayerStyleSection('${section.key}')">
                        <i class="fa-solid ${section.icon}"></i>
                        <span>${section.label}</span>
                    </button>
                `).join('')}
            </aside>
            <section class="layer-style-content">
                ${renderLayerStyleSectionContent(layer, activeLayerStyleSection)}
            </section>
        </div>
    `;
}

function openLayerStyleModal(layerId = selectedId) {
    const layer = getLayerStyleModalTarget(layerId);
    if (!layer || !layerStyleModal) return;
    ensureLayerStyle(layer);
    selectLayerViaEngine(layer.id);
    renderLayerStyleModal();
    layerStyleModal.removeAttribute('hidden');
}

function closeLayerStyleModal() {
    if (!layerStyleModal) return;
    layerStyleModal.setAttribute('hidden', '');
}

function setLayerStyleSection(sectionKey) {
    activeLayerStyleSection = sectionKey;
    renderLayerStyleModal();
}

function updateLayerStyleField(layerId, path, rawValue, valueType = 'string', rerenderModal = false) {
    const layer = getLayer(layerId);
    if (!layer) return;
    ensureLayerStyle(layer);

    if (path === 'opacity') {
        applyLayerPatchViaEngine(layer.id, { opacity: clamp(numberOr(rawValue, 100), 0, 100) / 100 }, {
            skipHistory: true,
            refreshInspector: true
        });
        return;
    }

    let nextValue = rawValue;
    if (valueType === 'number') nextValue = numberOr(rawValue, 0);
    if (valueType === 'boolean') nextValue = !!rawValue;
    if (valueType === 'string' && typeof rawValue === 'string' && rawValue.startsWith('#')) {
        nextValue = /^#[0-9A-Fa-f]{6}$/.test(rawValue) ? rawValue : formatLayerStyleColor(rawValue);
    }

    const nextLayerStyle = mergeLayerStyle(createDefaultLayerStyle(), layer.layerStyle || {});
    setLayerStyleValue({ layerStyle: nextLayerStyle }, path, nextValue);
    applyLayerPatchViaEngine(layer.id, { layerStyle: nextLayerStyle }, {
        skipHistory: true,
        refreshInspector: true
    });
    if (rerenderModal) {
        renderLayerStyleModal();
    }
    scheduleHistoryCommit();
}

window.openImagePicker = openImagePicker;
window.openLayerStyleModal = openLayerStyleModal;
window.closeLayerStyleModal = closeLayerStyleModal;
window.setLayerStyleSection = setLayerStyleSection;
window.updateLayerStyleField = updateLayerStyleField;

window.toggleFileMenu = toggleFileMenu;
window.newProject = newProject;
window.exportProject = exportProject;
window.openProject = openProject;
