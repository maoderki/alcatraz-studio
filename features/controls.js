function colorRow(value, layerId, prop, inputId, onChangeFn = null, toolPresetKey = '') {
    const pickrId = 'pickr_' + inputId;

    setTimeout(() => {
        const el = document.getElementById(pickrId);
        if (!el || el._pickrInit) return;
        el._pickrInit = true;

        const pickr = Pickr.create({
            el,
            theme: 'nano',
            default: value || '#ffffff',
            defaultRepresentation: 'HEX',
            components: {
                preview: true,
                opacity: false,
                hue: true,
                interaction: { hex: true, input: true, save: false }
            }
        });

        pickr.on('change', (color) => {
            const hex = color.toHEXA().toString();
            if (onChangeFn) {
                onChangeFn(hex);
            } else {
                updateContextValue(layerId, toolPresetKey, prop, hex);
            }
        });

    }, 0);

    return `<div id="${pickrId}"></div>`;
}

function stepper(inputId, className, value, min, max, prop, layerId, toolPresetKey = '') {
    return `
        <div class="number-stepper">
          <input class="${className}" id="${inputId}" type="number" min="${min}" max="${max}" value="${value}" oninput="updateContextValue('${layerId}', '${toolPresetKey}', '${prop}', +this.value || ${min})">
          <div class="stepper-buttons">
            <button class="step-btn" onclick="stepNumber('${inputId}',1,${min},${max},'${layerId}','${prop}','${toolPresetKey}')"><i class="fa-solid fa-chevron-up"></i></button>
            <button class="step-btn" onclick="stepNumber('${inputId}',-1,${min},${max},'${layerId}','${prop}','${toolPresetKey}')"><i class="fa-solid fa-chevron-down"></i></button>
          </div>
        </div>
      `;
}

function customSelect({ value, options, onChange, searchable = false, placeholder = 'Seç', inputId = '' }) {
    const id = inputId || ('ts_' + Math.random().toString(36).slice(2, 10));
    const optionMap = new Map((options || []).map(opt => [String(opt.value), opt]));
    const optionsHtml = options.map(opt =>
        `<option value="${esc(String(opt.value))}" ${String(opt.value) === String(value) ? 'selected' : ''}>${esc(opt.label)}</option>`
    ).join('');

    const handlerName = 'tsHandler_' + id;
    window[handlerName] = (val) => {
        try {
            if (typeof onChange === 'function') {
                onChange(val);
                return;
            }
            if (typeof onChange === 'string') {
                const code = onChange.replace(/__VALUE__/g, val);
                eval(code);
            }
        } catch (e) {
            console.error(e);
        }
    };

    setTimeout(() => {
        const el = document.getElementById(id);
        if (!el) return;
        new TomSelect(el, {
            placeholder,
            dropdownParent: 'body',
            plugins: searchable ? [] : [],
            searchField: ['text'],
            ...(searchable ? {} : { controlInput: null }),
            onChange: window[handlerName],
            render: {
                option_create: () => '',
                option: (data, escape) => {
                    const original = optionMap.get(String(data.value));
                    const fontFamily = original?.fontFamily;
                    const label = escape(data.text);
                    if (!fontFamily) {
                        return `<div>${label}</div>`;
                    }
                    return `<div style="font-family:'${escape(fontFamily)}', Arial, sans-serif;">${label}</div>`;
                },
                item: (data, escape) => {
                    const original = optionMap.get(String(data.value));
                    const fontFamily = original?.fontFamily;
                    const label = escape(data.text);
                    if (!fontFamily) {
                        return `<div>${label}</div>`;
                    }
                    return `<div style="font-family:'${escape(fontFamily)}', Arial, sans-serif;">${label}</div>`;
                }
            }
        });
    }, 0);

    return `<select id="${id}">${optionsHtml}</select>`;
}

let activeInspectorPanel = '';

function releaseInspectorFlyoutWidgets() {
    if (!flyoutBody || !inspectorDock) return;
    if (flyoutBody.contains(layersWidget)) {
        inspectorDock.appendChild(layersWidget);
    }
    if (flyoutBody.contains(swatchesWidget)) {
        inspectorDock.appendChild(swatchesWidget);
    }
}

function openInspectorFlyout(type) {
    activeInspectorPanel = type;
    const panel = getFlyoutPanelByKey(type);

    if (!panel) {
        closeInspectorFlyout();
        return;
    }

    flyoutTitle.textContent = getFlyoutPanelDisplayTitle(panel);
    releaseInspectorFlyoutWidgets();
    flyoutBody.innerHTML = '';

    if (panel.type === 'layers') {
        layersWidget.hidden = false;
        flyoutBody.appendChild(layersWidget);
        renderLayerList();
    } else if (panel.type === 'swatches') {
        swatchesWidget.hidden = false;
        renderWorkspaceSwatchesWidget();
        flyoutBody.appendChild(swatchesWidget);
    } else if (panel.type === 'plugin' && panel.pluginId) {
        const plugin = window.getStudioPlugins?.().find(item => item.id === panel.pluginId);
        const mountResult = window.mountStudioPluginSurfaceById?.(panel.pluginId, {
            root: flyoutBody,
            close: closeInspectorFlyout
        });

        if (!mountResult) {
            flyoutBody.innerHTML = `<div class="flyout-placeholder">${plugin ? 'Plugin yüklenemedi.' : 'Plugin bulunamadı.'}</div>`;
        }
    }

    inspectorFlyout.classList.add('open');
    getInspectorToolButtons().forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === type);
    });
}

function closeInspectorFlyout() {
    const activeColorInput = inspectorFlyout.querySelector('input[type="color"]:focus');
    if (activeColorInput) return;
    if (!inspectorFlyout.classList.contains('open')) return;
    inspectorFlyout.classList.remove('open');
    releaseInspectorFlyoutWidgets();
    renderWorkspaceDock();
    getInspectorToolButtons().forEach(btn => btn.classList.remove('active'));
}

function toggleInspectorFlyout(type) {
    const isSame = activeInspectorPanel === type && inspectorFlyout.classList.contains('open');
    if (isSame) { closeInspectorFlyout(); return; }
    openInspectorFlyout(type);
}

function refreshInspectorFlyoutIfNeeded() {
    if (!inspectorFlyout.classList.contains('open')) return;
    if (String(activeInspectorPanel || '').startsWith('plugin:')) return;
    openInspectorFlyout(activeInspectorPanel);
}

function applyLayerPatchViaEngine(layerId, patch, options = {}) {
    if (!layerId || !patch || typeof patch !== 'object') return false;

    const result = window.StudioEngine?.applyCommand?.({
        action: 'update_layer',
        target: layerId,
        patch,
        autoFitText: options.autoFitText !== false
    }, {
        commitHistory: false,
        includeContext: false
    });

    if (result?.errors?.length) return false;

    if (options.refreshLayerList) renderLayerList();
    if (options.refreshContextBar) renderContextBar();
    if (options.refreshInspector) refreshInspectorFlyoutIfNeeded();

    if (options.historyMode === 'immediate') commitHistory();
    else if (options.skipHistory !== true) scheduleHistoryCommit();

    return true;
}

function applySelectedLayerPatch(patch, options = {}) {
    if (!selectedId) return false;
    return applyLayerPatchViaEngine(selectedId, patch, options);
}

function selectLayerViaEngine(layerId, options = {}) {
    if (!layerId) return false;

    const result = window.StudioEngine?.applyCommand?.({
        action: 'select_layer',
        target: layerId
    }, {
        commitHistory: false,
        includeContext: false
    });

    if (result?.errors?.length) return false;

    syncColorWidgetFromLayer(layerId);
    if (options.refreshContextBar !== false) renderContextBar();
    if (options.refreshInspector !== false) refreshInspectorFlyoutIfNeeded();
    return true;
}

function updateContextValue(layerId, toolPresetKey, prop, value) {
    if (toolPresetKey) {
        updateToolPreset(toolPresetKey, { [prop]: value });
        return;
    }
    applyLayerPatchViaEngine(layerId, { [prop]: value }, {
        refreshInspector: true
    });
}

function stepNumber(inputId, delta, min, max, layerId, prop, toolPresetKey = '') {
    const input = document.getElementById(inputId);
    if (!input) return;
    let next = Number(input.value || 0) + delta;
    next = Math.max(min, Math.min(max, next));
    input.value = next;
    updateContextValue(layerId, toolPresetKey, prop, next);
    refreshInspectorFlyoutIfNeeded();
}

function syncHexInput(colorInput, targetId) {
    const target = document.getElementById(targetId);
    if (target) target.value = colorInput.value.toUpperCase();
}

function applyHexColor(layerId, value, prop = 'color') {
    const v = String(value).trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
        applyLayerPatchViaEngine(layerId, { [prop]: v }, {
            refreshInspector: true
        });
        refreshInspectorFlyoutIfNeeded();
    }
}
