function updateDocumentTitle() {
    document.title = projectName + ' — Alcatraz Studio';
}

const STUDIO_THEME_STORAGE_KEY = 'alcatraz_studio_theme';
const STUDIO_WORKSPACE_STORAGE_KEY = 'alcatraz_studio_workspace';
const STUDIO_MOBILE_FLOATING_POSITIONS_KEY = 'alcatraz_studio_mobile_floating_positions';
const STUDIO_THEME_OPTIONS = [
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'graphite', label: 'Graphite' },
    { id: 'ocean', label: 'Ocean' }
];
const STUDIO_SHELL_STYLE_OPTIONS = [
    { id: 'desktop', label: 'Masaustu' },
    { id: 'mobile', label: 'Mobil' }
];
const STUDIO_TOOLBAR_POSITION_OPTIONS = [
    { id: 'left', label: 'Solda' },
    { id: 'right', label: 'Sağda' },
    { id: 'top', label: 'Üstte' }
];
const STUDIO_WIDGET_TYPE_LABELS = {
    layers: 'Katmanlar',
    swatches: 'Swatches',
    plugin: 'Plugin'
};
const STUDIO_FLYOUT_TYPE_LABELS = {
    plugin: 'Plugin'
};

let studioWorkspacePresets = [];
let currentWorkspaceLayout = null;
let workspaceEditorState = null;
let workspacePluginWidgetSeed = 0;
let workspaceBuilderSortables = [];
let workspaceDockSearchTerm = '';
let mobileVoiceFabUnsubscribe = null;
let mobileVoiceFabFeedbackTimer = null;
let mobileFloatingDrag = null;
let mobileFloatingSuppressClick = false;
let mobilePanelRestoreState = null;

function cloneStudioData(value) {
    return JSON.parse(JSON.stringify(value));
}

function clampStudioNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

function resolveStudioTheme(theme) {
    return STUDIO_THEME_OPTIONS.some(option => option.id === theme) ? theme : getPreferredStudioTheme();
}

function createDefaultWorkspaceLayout() {
    return {
        shellStyle: 'desktop',
        toolbarPosition: 'left',
        inspectorWidth: 320,
        bottomDockHeight: 220,
        theme: getPreferredStudioTheme(),
        flyoutPanels: [],
        widgets: [
            { id: 'layers', type: 'layers', title: 'Katmanlar', enabled: true, region: 'right' },
            { id: 'swatches', type: 'swatches', title: 'Swatches', enabled: false, region: 'right' }
        ]
    };
}

function normalizeWorkspaceFlyoutPanel(panel, index = 0) {
    if (!panel || typeof panel !== 'object') return null;

    const type = panel.type === 'plugin'
        ? 'plugin'
        : panel.type === 'swatches'
            ? 'swatches'
            : 'layers';
    const pluginId = typeof panel.pluginId === 'string' ? panel.pluginId.trim() : '';
    if (type === 'plugin' && !pluginId) return null;
    const baseId = typeof panel.id === 'string' && panel.id.trim()
        ? panel.id.trim()
        : (type === 'plugin' && pluginId ? `plugin-${pluginId}` : `${type}-${index + 1}`);

    return {
        id: baseId,
        type,
        pluginId,
        title: typeof panel.title === 'string' && panel.title.trim()
            ? panel.title.trim()
            : (type === 'plugin'
                ? (window.getStudioPlugins?.().find(item => item.id === pluginId)?.menuLabel || 'Plugin')
                : (STUDIO_WIDGET_TYPE_LABELS[type] || 'Panel')),
        enabled: panel.enabled !== false
    };
}

function normalizeWorkspaceWidget(widget, index = 0) {
    if (!widget || typeof widget !== 'object') return null;

    const type = widget.type === 'plugin'
        ? 'plugin'
        : widget.type === 'swatches'
            ? 'swatches'
            : 'layers';

    const pluginId = typeof widget.pluginId === 'string' ? widget.pluginId.trim() : '';
    const region = ['right', 'bottom'].includes(widget.region) ? widget.region : 'right';
    const baseId = typeof widget.id === 'string' && widget.id.trim()
        ? widget.id.trim()
        : (type === 'plugin' && pluginId ? `plugin-${pluginId}` : `${type}-${index + 1}`);

    return {
        id: baseId,
        type,
        pluginId,
        title: typeof widget.title === 'string' && widget.title.trim()
            ? widget.title.trim()
            : (type === 'plugin'
                ? (window.getStudioPlugins?.().find(item => item.id === pluginId)?.menuLabel || 'Plugin')
                : (STUDIO_WIDGET_TYPE_LABELS[type] || 'Widget')),
        enabled: widget.enabled !== false,
        region
    };
}

function sanitizeWorkspaceLayout(rawLayout) {
    const base = createDefaultWorkspaceLayout();
    const input = rawLayout && typeof rawLayout === 'object' ? rawLayout : {};
    const widgets = Array.isArray(input.widgets) ? input.widgets.map(normalizeWorkspaceWidget).filter(Boolean) : base.widgets;
    const deduped = [];
    const seen = new Set();

    widgets.forEach((widget, index) => {
        const normalized = normalizeWorkspaceWidget(widget, index);
        if (!normalized) return;
        const uniqueKey = normalized.type === 'plugin' ? `${normalized.type}:${normalized.pluginId}` : normalized.type;
        if (seen.has(uniqueKey)) return;
        seen.add(uniqueKey);
        deduped.push(normalized);
    });

    const flyoutPanels = Array.isArray(input.flyoutPanels)
        ? input.flyoutPanels.map(normalizeWorkspaceFlyoutPanel).filter(Boolean)
        : base.flyoutPanels;
    const dedupedFlyoutPanels = [];
    const flyoutSeen = new Set();

    flyoutPanels.forEach((panel, index) => {
        const normalized = normalizeWorkspaceFlyoutPanel(panel, index);
        if (!normalized) return;
        const uniqueKey = normalized.type === 'plugin' ? `${normalized.type}:${normalized.pluginId}` : normalized.type;
        if (flyoutSeen.has(uniqueKey)) return;
        flyoutSeen.add(uniqueKey);
        dedupedFlyoutPanels.push(normalized);
    });

    if (
        !deduped.some(widget => widget.type === 'layers') &&
        !dedupedFlyoutPanels.some(panel => panel.type === 'layers')
    ) {
        deduped.push(normalizeWorkspaceWidget(base.widgets[0], deduped.length));
    }

    return {
        shellStyle: ['desktop', 'mobile'].includes(input.shellStyle) ? input.shellStyle : base.shellStyle,
        toolbarPosition: ['left', 'right', 'top'].includes(input.toolbarPosition) ? input.toolbarPosition : base.toolbarPosition,
        inspectorWidth: clampStudioNumber(input.inspectorWidth, 260, 520, base.inspectorWidth),
        bottomDockHeight: clampStudioNumber(input.bottomDockHeight, 140, 340, base.bottomDockHeight),
        theme: resolveStudioTheme(input.theme || base.theme),
        flyoutPanels: dedupedFlyoutPanels,
        widgets: deduped
    };
}

function readWorkspaceLayout() {
    try {
        const raw = localStorage.getItem(STUDIO_WORKSPACE_STORAGE_KEY);
        return raw ? sanitizeWorkspaceLayout(JSON.parse(raw)) : null;
    } catch (error) {
        console.warn('Workspace read warning:', error);
        return null;
    }
}

function persistWorkspaceLayout(layout = currentWorkspaceLayout) {
    if (!layout) return;
    try {
        localStorage.setItem(STUDIO_WORKSPACE_STORAGE_KEY, JSON.stringify(sanitizeWorkspaceLayout(layout)));
    } catch (error) {
        console.warn('Workspace persist warning:', error);
    }
}

function syncWorkspaceThemeFromTheme(theme = document.documentElement.dataset.theme) {
    if (!currentWorkspaceLayout) return;
    currentWorkspaceLayout.theme = resolveStudioTheme(theme);
    persistWorkspaceLayout();
    if (workspaceModal && !workspaceModal.hasAttribute('hidden')) {
        renderWorkspaceEditor();
    }
}

window.syncWorkspaceThemeFromTheme = syncWorkspaceThemeFromTheme;

function getPreferredStudioTheme() {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function shouldUseMobileWorkspaceByDefault() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function setStudioTheme(theme, persist = true) {
    const resolvedTheme = resolveStudioTheme(theme);
    document.documentElement.dataset.theme = resolvedTheme;
    const brandLogo = document.getElementById('brandLogo');

    if (themeToggleBtn && themeToggleIcon) {
        const isLight = resolvedTheme === 'light';
        themeToggleBtn.setAttribute('aria-pressed', String(isLight));
        themeToggleBtn.setAttribute('title', isLight ? 'Koyu temaya gec' : 'Acik temaya gec');
        themeToggleBtn.setAttribute('aria-label', isLight ? 'Koyu temaya gec' : 'Acik temaya gec');
        themeToggleIcon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        if (brandLogo) {
            brandLogo.src = isLight ? 'img/logo-light.png' : 'img/logo-dark.png';
        }
    } else if (brandLogo) {
        brandLogo.src = resolvedTheme === 'light' ? 'img/logo-light.png' : 'img/logo-dark.png';
    }

    if (persist) {
        localStorage.setItem(STUDIO_THEME_STORAGE_KEY, resolvedTheme);
    }
}

function initStudioTheme() {
    const savedTheme = localStorage.getItem(STUDIO_THEME_STORAGE_KEY);
    setStudioTheme(savedTheme || document.documentElement.dataset.theme || getPreferredStudioTheme(), false);
    themeToggleBtn?.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        setStudioTheme(nextTheme, true);
        syncWorkspaceThemeFromTheme(nextTheme);
    });
}

function getWorkspacePresetById(presetId) {
    return studioWorkspacePresets.find(item => item.id === presetId) || null;
}

async function loadStudioWorkspacePresets() {
    try {
        const response = await fetch(studioAssetUrl('data/workspace-presets.json'));
        const data = await response.json();
        studioWorkspacePresets = Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Workspace presets could not be loaded:', error);
        studioWorkspacePresets = [];
    }
}

function getWidgetDisplayTitle(widget) {
    if (widget.type === 'plugin') {
        return widget.title || window.getStudioPlugins?.().find(item => item.id === widget.pluginId)?.menuLabel || 'Plugin';
    }
    return widget.title || STUDIO_WIDGET_TYPE_LABELS[widget.type] || 'Widget';
}

function getFlyoutPanelDisplayTitle(panel) {
    if (panel.type === 'plugin') {
        return panel.title || window.getStudioPlugins?.().find(item => item.id === panel.pluginId)?.menuLabel || 'Plugin';
    }
    return panel.title || STUDIO_WIDGET_TYPE_LABELS[panel.type] || STUDIO_FLYOUT_TYPE_LABELS[panel.type] || 'Panel';
}

function getInspectorToolButtons() {
    return [...document.querySelectorAll('.inspector-tool-btn')];
}

function getFlyoutPanelKey(panel) {
    return panel.type === 'plugin' ? `plugin:${panel.pluginId}` : panel.type;
}

function getFlyoutPanelByKey(panelKey) {
    return (currentWorkspaceLayout?.flyoutPanels || []).find(panel => getFlyoutPanelKey(panel) === panelKey) || null;
}

function getFlyoutIconClass(panel) {
    if (panel.type === 'plugin') {
        return window.getStudioPlugins?.().find(item => item.id === panel.pluginId)?.icon || 'fa-solid fa-puzzle-piece';
    }
    if (panel.type === 'layers') return 'fa-solid fa-layer-group';
    if (panel.type === 'swatches') return 'fa-solid fa-swatchbook';
    return 'fa-solid fa-palette';
}

function readMobileFloatingPositions() {
    try {
        const raw = localStorage.getItem(STUDIO_MOBILE_FLOATING_POSITIONS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        console.warn('Mobile floating panel positions could not be read:', error);
        return {};
    }
}

function persistMobileFloatingPositions(positions) {
    try {
        localStorage.setItem(STUDIO_MOBILE_FLOATING_POSITIONS_KEY, JSON.stringify(positions || {}));
    } catch (error) {
        console.warn('Mobile floating panel positions could not be saved:', error);
    }
}

function clampMobileFloatingPosition(position, size = 48) {
    const workspaceRect = workspaceShell?.getBoundingClientRect?.();
    const width = workspaceRect?.width || window.innerWidth || 390;
    const height = workspaceRect?.height || window.innerHeight || 700;
    return {
        x: clampStudioNumber(position?.x, 8, Math.max(8, width - size - 8), 12),
        y: clampStudioNumber(position?.y, 58, Math.max(58, height - size - 12), 160)
    };
}

function getMobileFloatingDefaultPosition(index = 0) {
    return clampMobileFloatingPosition({
        x: 76,
        y: 108 + (index * 58)
    });
}

function getMobileFloatingPanelItems() {
    return (currentWorkspaceLayout?.flyoutPanels || []).filter(panel => panel.enabled !== false);
}

function renderMobileFloatingPanels() {
    if (!mobileFloatingPanels) return;

    const isMobile = currentWorkspaceLayout?.shellStyle === 'mobile';
    mobileFloatingPanels.hidden = !isMobile;
    if (!isMobile) {
        mobileFloatingPanels.innerHTML = '';
        return;
    }

    const positions = readMobileFloatingPositions();
    const panels = getMobileFloatingPanelItems();
    mobileFloatingPanels.innerHTML = panels.map((panel, index) => {
        const panelKey = getFlyoutPanelKey(panel);
        const position = clampMobileFloatingPosition(positions[panelKey] || getMobileFloatingDefaultPosition(index));
        const title = getFlyoutPanelDisplayTitle(panel);
        return `
            <button
                class="mobile-floating-panel-btn"
                type="button"
                data-panel-key="${panelKey}"
                title="${title}"
                aria-label="${title}"
                style="left:${position.x}px;top:${position.y}px">
                <i class="${getFlyoutIconClass(panel)}" aria-hidden="true"></i>
            </button>
        `;
    }).join('');
}

function addMobileFloatingPanel(item) {
    const panel = normalizeWorkspaceFlyoutPanel({
        ...item,
        id: item.type === 'plugin' ? `plugin-${item.pluginId}` : item.type,
        enabled: true
    });
    if (!panel) return;

    const layout = sanitizeWorkspaceLayout(currentWorkspaceLayout || createDefaultWorkspaceLayout());
    const panelKey = getFlyoutPanelKey(panel);
    const existing = layout.flyoutPanels.find(existingPanel => getFlyoutPanelKey(existingPanel) === panelKey);
    if (existing) {
        existing.enabled = true;
    } else {
        layout.flyoutPanels.push(panel);
    }

    applyStudioWorkspaceLayout(layout);
    renderMobileWorkspacePickerList();
}

function removeMobileFloatingPanel(panelKey) {
    const layout = sanitizeWorkspaceLayout(currentWorkspaceLayout || createDefaultWorkspaceLayout());
    layout.flyoutPanels = layout.flyoutPanels.filter(panel => getFlyoutPanelKey(panel) !== panelKey);
    applyStudioWorkspaceLayout(layout);

    const positions = readMobileFloatingPositions();
    delete positions[panelKey];
    persistMobileFloatingPositions(positions);
    renderMobileWorkspacePickerList();
}

function renderMobileWorkspacePickerList() {
    if (!mobileWorkspacePickerList) return;

    const activeKeys = new Set(getMobileFloatingPanelItems().map(getFlyoutPanelKey));
    mobileWorkspacePickerList.innerHTML = getWorkspacePaletteItems().map(item => {
        const panel = normalizeWorkspaceFlyoutPanel(item);
        if (!panel) return '';
        const panelKey = getFlyoutPanelKey(panel);
        const isActive = activeKeys.has(panelKey);
        return `
            <button class="mobile-workspace-picker-item ${isActive ? 'active' : ''}" type="button" data-panel-key="${panelKey}" data-item-json="${encodeWorkspaceBuilderItem(panel)}">
                <i class="mobile-workspace-picker-icon ${getFlyoutIconClass(panel)}" aria-hidden="true"></i>
                <span class="mobile-workspace-picker-text">
                    <strong>${getFlyoutPanelDisplayTitle(panel)}</strong>
                    <span>${panel.type === 'plugin' ? panel.pluginId : (STUDIO_WIDGET_TYPE_LABELS[panel.type] || 'Panel')}</span>
                </span>
                <span class="mobile-workspace-picker-action" aria-label="${isActive ? 'Kaldır' : 'Ekle'}" title="${isActive ? 'Kaldır' : 'Ekle'}">
                    <i class="fa-solid ${isActive ? 'fa-minus' : 'fa-plus'}" aria-hidden="true"></i>
                </span>
            </button>
        `;
    }).join('');
}

function openMobileWorkspacePickerModal() {
    if (!mobileWorkspacePickerModal) {
        openWorkspaceModal();
        return;
    }
    renderMobileWorkspacePickerList();
    mobileWorkspacePickerModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeFileMenu();
}

window.openMobileWorkspacePickerModal = openMobileWorkspacePickerModal;

function closeMobileWorkspacePickerModal() {
    mobileWorkspacePickerModal?.setAttribute('hidden', '');
    document.body.style.overflow = pluginModal && !pluginModal.hasAttribute('hidden') ? 'hidden' : '';
}

function closeMobilePanelModal() {
    if (!mobilePanelModal) return;

    if (mobilePanelRestoreState?.node && mobilePanelRestoreState.parent) {
        mobilePanelRestoreState.node.hidden = mobilePanelRestoreState.hidden;
        mobilePanelRestoreState.node.classList.remove('mobile-panel-mounted-widget');
        mobilePanelRestoreState.parent.insertBefore(mobilePanelRestoreState.node, mobilePanelRestoreState.nextSibling);
        mobilePanelRestoreState = null;
        renderWorkspaceDock();
    }

    mobilePanelModal.setAttribute('hidden', '');
    if (mobilePanelModalBody) mobilePanelModalBody.innerHTML = '';
    document.body.style.overflow = pluginModal && !pluginModal.hasAttribute('hidden') ? 'hidden' : '';
}

function openMobilePanelModal(panelKey) {
    const panel = getFlyoutPanelByKey(panelKey);
    if (!panel) return;

    if (panel.type === 'plugin' && panel.pluginId) {
        openPluginModalById(panel.pluginId);
        return;
    }

    if (!mobilePanelModal || !mobilePanelModalBody) return;
    closeMobilePanelModal();

    const sourceNode = panel.type === 'swatches' ? swatchesWidget : layersWidget;
    if (!sourceNode) return;

    mobilePanelRestoreState = {
        node: sourceNode,
        parent: sourceNode.parentNode,
        nextSibling: sourceNode.nextSibling,
        hidden: sourceNode.hidden
    };

    mobilePanelModalTitle.textContent = getFlyoutPanelDisplayTitle(panel);
    mobilePanelModalSubtitle.textContent = panel.type === 'swatches' ? 'Renk paleti' : 'Katman listesi';
    sourceNode.hidden = false;
    sourceNode.classList.add('mobile-panel-mounted-widget');
    mobilePanelModalBody.appendChild(sourceNode);

    if (panel.type === 'swatches') {
        renderWorkspaceSwatchesWidget();
    } else if (typeof renderLayerList === 'function') {
        renderLayerList();
    }

    mobilePanelModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
}

function initMobileWorkspacePanels() {
    mobileWorkspacePickerModalClose?.addEventListener('click', closeMobileWorkspacePickerModal);
    mobileWorkspacePickerModal?.addEventListener('click', event => {
        if (event.target === mobileWorkspacePickerModal) closeMobileWorkspacePickerModal();

        const itemButton = event.target.closest('.mobile-workspace-picker-item[data-item-json]');
        if (!itemButton) return;

        const item = decodeWorkspaceBuilderItem(itemButton.dataset.itemJson);
        const panelKey = itemButton.dataset.panelKey;
        if (!item || !panelKey) return;

        if (getMobileFloatingPanelItems().some(panel => getFlyoutPanelKey(panel) === panelKey)) {
            removeMobileFloatingPanel(panelKey);
        } else {
            addMobileFloatingPanel(item);
        }
    });

    mobilePanelModalClose?.addEventListener('click', closeMobilePanelModal);
    mobilePanelModal?.addEventListener('click', event => {
        if (event.target === mobilePanelModal) closeMobilePanelModal();
    });

    mobileFloatingPanels?.addEventListener('pointerdown', event => {
        const button = event.target.closest('.mobile-floating-panel-btn[data-panel-key]');
        if (!button || (event.button !== undefined && event.button !== 0)) return;
        const rect = button.getBoundingClientRect();
        const workspaceRect = workspaceShell?.getBoundingClientRect?.();
        mobileFloatingDrag = {
            pointerId: event.pointerId,
            panelKey: button.dataset.panelKey,
            button,
            startClientX: event.clientX,
            startClientY: event.clientY,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            workspaceLeft: workspaceRect?.left || 0,
            workspaceTop: workspaceRect?.top || 0,
            didMove: false
        };
        button.classList.add('is-dragging');
        button.setPointerCapture?.(event.pointerId);
    });

    mobileFloatingPanels?.addEventListener('pointermove', event => {
        if (!mobileFloatingDrag || mobileFloatingDrag.pointerId !== event.pointerId) return;
        const delta = Math.hypot(
            event.clientX - mobileFloatingDrag.startClientX,
            event.clientY - mobileFloatingDrag.startClientY
        );
        if (delta > 4) {
            mobileFloatingDrag.didMove = true;
            mobileFloatingSuppressClick = true;
        }
        const position = clampMobileFloatingPosition({
            x: event.clientX - mobileFloatingDrag.workspaceLeft - mobileFloatingDrag.offsetX,
            y: event.clientY - mobileFloatingDrag.workspaceTop - mobileFloatingDrag.offsetY
        });
        mobileFloatingDrag.button.style.left = `${position.x}px`;
        mobileFloatingDrag.button.style.top = `${position.y}px`;
    });

    const finishMobileFloatingDrag = event => {
        if (!mobileFloatingDrag || mobileFloatingDrag.pointerId !== event.pointerId) return;
        const { button, panelKey, didMove } = mobileFloatingDrag;
        const position = clampMobileFloatingPosition({
            x: Number.parseFloat(button.style.left),
            y: Number.parseFloat(button.style.top)
        });
        const positions = readMobileFloatingPositions();
        positions[panelKey] = position;
        persistMobileFloatingPositions(positions);
        button.classList.remove('is-dragging');
        button.releasePointerCapture?.(event.pointerId);
        mobileFloatingDrag = null;

        if (didMove) {
            setTimeout(() => {
                mobileFloatingSuppressClick = false;
            }, 0);
        }
    };

    mobileFloatingPanels?.addEventListener('pointerup', finishMobileFloatingDrag);
    mobileFloatingPanels?.addEventListener('pointercancel', event => {
        if (!mobileFloatingDrag || mobileFloatingDrag.pointerId !== event.pointerId) return;
        mobileFloatingDrag.button.classList.remove('is-dragging');
        mobileFloatingDrag = null;
        mobileFloatingSuppressClick = false;
    });

    mobileFloatingPanels?.addEventListener('click', event => {
        const button = event.target.closest('.mobile-floating-panel-btn[data-panel-key]');
        if (!button) return;
        if (mobileFloatingSuppressClick) {
            mobileFloatingSuppressClick = false;
            return;
        }
        openMobilePanelModal(button.dataset.panelKey);
    });

    window.addEventListener('resize', renderMobileFloatingPanels);

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (mobileWorkspacePickerModal && !mobileWorkspacePickerModal.hasAttribute('hidden')) {
            closeMobileWorkspacePickerModal();
        }
        if (mobilePanelModal && !mobilePanelModal.hasAttribute('hidden')) {
            closeMobilePanelModal();
        }
    });
}

function applyWorkspaceSwatch(color) {
    if (typeof color !== 'string' || !color.trim()) return;
    cwFgColor = color.trim();
    cwActiveSlot = 'fg';
    updateColorWidget();
    applyColorWidgetToLayer();
}

window.applyWorkspaceSwatch = applyWorkspaceSwatch;

function renderApiDocsModal() {
    if (!apiDocsModalBody) return;

    apiDocsModalBody.innerHTML = `
        <div class="api-docs-layout">
            <section class="api-docs-hero">
                <div class="api-docs-card">
                    <div class="api-docs-eyebrow">Working Draft</div>
                    <h3>Alcatraz Studio icin cekirdek komut motoru ve dis entegrasyon API modeli</h3>
                    <p class="api-docs-lead">
                        Bu yapi sadece AI icin degil, uygulamanin ana motoru icin tasarlaniyor.
                        Disaridan herhangi bir app, webhook, automation ya da AI istemcisi bu motora komut gonderebilsin;
                        motor komutu islesin, state'i guncellesin ve yerine gore sonuc, snapshot, event ya da export ciktisi donsun.
                    </p>
                    <div class="api-docs-tags">
                        <div class="api-docs-tag"><i class="fa-solid fa-bolt"></i> Her istemci ayni komut protokolunu kullansin</div>
                        <div class="api-docs-tag"><i class="fa-solid fa-crosshairs"></i> Hedef katmanlar alias veya id ile cagirilsin</div>
                        <div class="api-docs-tag"><i class="fa-solid fa-layer-group"></i> State manager tek dogru kaynak olsun</div>
                        <div class="api-docs-tag"><i class="fa-solid fa-wand-magic-sparkles"></i> AI sadece istemcilerden biri olsun</div>
                    </div>
                </div>

                <aside class="api-docs-sidecard">
                    <div class="api-docs-section-kicker">Neden</div>
                    <div class="api-docs-stat-grid">
                        <div class="api-docs-stat">
                            <strong>1</strong>
                            UI ile API ayni engine ustunden gecsin.
                        </div>
                        <div class="api-docs-stat">
                            <strong>2</strong>
                            Dis istemci tum canvas'i bilmeden komut verebilsin.
                        </div>
                        <div class="api-docs-stat">
                            <strong>3</strong>
                            Her komut deterministik sekilde state'e uygulansin.
                        </div>
                    </div>
                    <div class="api-docs-note">
                        En kritik karar: dis dunya motorla <code>commands[]</code> uzerinden konussun.
                        Render, export, preview ve event yayinlama bu komutlarin uzerine insa edilsin.
                    </div>
                </aside>
            </section>

            <div class="api-docs-grid">
                <section class="api-docs-section">
                    <div class="api-docs-section-kicker">Temel Yapi</div>
                    <h4>1. Session tabanli engine context</h4>
                    <p>
                        Her dis istemci once bir <code>session</code> acar. Session; canvas ozeti, secim,
                        alias haritasi, revision ve yetki kapsamlarini tutar. Boylece istemci her istekte
                        tum projeyi tekrar tasimaz.
                    </p>
                    <ul class="api-docs-list">
                        <li><code>POST /engine/session/start</code>: engine context, layer index ve alias map doner.</li>
                        <li><code>POST /engine/session/:id/commands</code>: istemci komut paketini gonderir.</li>
                        <li><code>GET /engine/session/:id/context?targets=...</code>: ihtiyac halinde sinirli detay cekilir.</li>
                        <li><code>GET /engine/session/:id/events</code>: revision, warning ve output event'leri akar.</li>
                    </ul>
                    <pre class="api-docs-code"><code>{
  "sessionId": "sess_92fa",
  "revision": 18,
  "canvas": { "width": 1080, "height": 1350 },
  "selection": { "selectedId": "text_headline" },
  "layerIndex": [
    { "id": "bg", "type": "raster", "name": "Background", "x": 0, "y": 0, "w": 1080, "h": 1350 },
    { "id": "text_headline", "type": "text", "name": "Headline", "text": "Yaza Hazir", "x": 96, "y": 120, "w": 640, "h": 120 }
  ],
  "aliases": {
    "selected": "text_headline",
    "last_text": "text_headline",
    "background": "bg"
  }
}</code></pre>
                    <div class="api-docs-code-caption">Bu yapi AI icin de yeterli, normal dis app entegrasyonu icin de yeterli.</div>
                </section>

                <section class="api-docs-section">
                    <div class="api-docs-section-kicker">Action Model</div>
                    <h4>2. Normalize edilmis komut paketi</h4>
                    <p>
                        Dunyaya text DSL vermek yerine normalize JSON komutlari vermek daha saglam.
                        Isterseniz SDK tarafinda <code>moveLayer()</code> gibi helper'lar olur ama engine hep ayni
                        sozluk formatini kabul eder:
                    </p>
                    <ul class="api-docs-mini-list">
                        <li><code>add_layer</code></li>
                        <li><code>update_layer</code></li>
                        <li><code>move_layer</code></li>
                        <li><code>resize_layer</code></li>
                        <li><code>style_layer</code></li>
                        <li><code>reorder_layer</code></li>
                        <li><code>remove_layer</code></li>
                        <li><code>select_layer</code></li>
                        <li><code>batch</code></li>
                    </ul>
                    <pre class="api-docs-code"><code>{
  "sessionId": "sess_92fa",
  "baseRevision": 18,
  "commands": [
    { "action": "add_layer", "layer": { "id": "overlay_1", "type": "shape", "name": "Overlay", "x": 0, "y": 0, "width": 1080, "height": 1350, "fill": "#000000", "opacity": 0.4 } },
    { "action": "move_layer", "target": "last_text", "dx": 30, "dy": 0 },
    { "action": "update_layer", "target": "text_headline", "patch": { "text": "Mehmet", "fontSize": 64 } }
  ]
}</code></pre>
                    <div class="api-docs-callout">
                        Oneri: uygulama ici UI olaylari da uzun vadede ayni command bus'a aksin.
                        Boylece butona basmakla API cagrisi ayni reducer'dan gecer.
                    </div>
                </section>
            </div>

            <section class="api-docs-section">
                <div class="api-docs-section-kicker">Context Katmanlari</div>
                <h4>3. Tum istemciler icin kademeli context modeli</h4>
                <table class="api-docs-table">
                    <thead>
                        <tr>
                            <th>Seviye</th>
                            <th>Ne gider</th>
                            <th>Ne zaman</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>index</code></td>
                            <td>Katman listesi, tip, isim, kaba frame, secili katman, alias'lar</td>
                            <td>Varsayilan. Cogu istemci icin yeterli.</td>
                        </tr>
                        <tr>
                            <td><code>targets</code></td>
                            <td>Sadece ilgili katmanlarin text, fill, opacity, layerStyle ozetleri</td>
                            <td>Belirli katmanlar uzerinde hassas islem varsa.</td>
                        </tr>
                        <tr>
                            <td><code>full</code></td>
                            <td>Tam layer JSON</td>
                            <td>Sadece fallback, migration veya debug icin.</td>
                        </tr>
                    </tbody>
                </table>
                <div class="api-docs-note">
                    Bu katmanli model AI icin token kazandirir; AI disi istemciler icin de gereksiz buyuk payload'i engeller.
                </div>
                    <pre class="api-docs-code"><code>{
  "type": "need_context",
  "targets": ["selected", "background"],
  "fields": ["text", "fill", "opacity", "layerStyle.dropShadow", "layerStyle.gradientOverlay"],
  "reason": "Secili yazi ile arka plan kontrastini gormem gerekiyor"
}</code></pre>
            </section>

            <div class="api-docs-grid">
                <section class="api-docs-section">
                    <div class="api-docs-section-kicker">Referanslama</div>
                    <h4>4. ID yaninda semantic alias tutun</h4>
                    <p>
                        Kullanici dogal dilde genelde <em>son yazi</em>, <em>arka plan</em>, <em>logo</em>,
                        <em>secili katman</em> der. Bu yuzden state manager her revision'da alias tablosu uretsin.
                    </p>
                    <ul class="api-docs-list">
                        <li><code>selected</code></li>
                        <li><code>last_text</code></li>
                        <li><code>last_shape</code></li>
                        <li><code>background</code></li>
                        <li><code>topmost</code>, <code>bottommost</code></li>
                        <li>Istege bagli semantic etiketler: <code>headline</code>, <code>cta</code>, <code>logo</code></li>
                    </ul>
                    <pre class="api-docs-code"><code>{
  "action": "move_layer",
  "target": "last_text",
  "dx": 30,
  "dy": 0
}</code></pre>
                </section>

                <section class="api-docs-section">
                    <div class="api-docs-section-kicker">State Management</div>
                    <h4>5. Her istemci reducer'a komut versin</h4>
                    <p>
                        Sizde zaten katman state'i ve render ayrimi var. Dogru yapi, her komutu once
                        command reducer'dan gecirmek:
                    </p>
                    <ul class="api-docs-list">
                        <li>Command parser / validator</li>
                        <li>Target resolver: alias veya id cozer</li>
                        <li>State reducer: <code>layers</code>, <code>selectedId</code>, revision gunceller</li>
                        <li>Canvas engine: sadece sonucu render eder</li>
                    </ul>
                    <div class="api-docs-callout">
                        Boylece panel butonlari, voice command, webhook, MCP bridge, mobil app ve AI ayni cekirdegi kullanir.
                    </div>
                </section>
            </div>

            <section class="api-docs-section">
                <div class="api-docs-section-kicker">Sistem Katmanlari</div>
                <h4>6. Sizin mevcut mimariye oturan bolumleme</h4>
                <div class="api-docs-flow">
                    <div class="api-docs-flow-step">
                        <i class="fa-solid fa-screwdriver-wrench"></i>
                        <strong>Tool System</strong>
                        UI event'lerini engine command'ine cevirir.
                    </div>
                    <div class="api-docs-flow-step">
                        <i class="fa-solid fa-object-group"></i>
                        <strong>State Management</strong>
                        Alias cozumler, reducer calistirir, revision olusturur.
                    </div>
                    <div class="api-docs-flow-step">
                        <i class="fa-solid fa-vector-square"></i>
                        <strong>Canvas Engine</strong>
                        Sadece guncel state'i render eder.
                    </div>
                    <div class="api-docs-flow-step">
                        <i class="fa-solid fa-image"></i>
                        <strong>Image Pipeline</strong>
                        Raster generate, upscale, mask, export gibi agir islemleri async job olarak ele alir.
                    </div>
                </div>
                <pre class="api-docs-code"><code>{
  "action": "enqueue_image_job",
  "target": "background",
  "job": {
    "type": "generate_fill",
    "prompt": "soft luxury hotel pool at sunset",
    "size": "1080x1350"
  }
}</code></pre>
                <div class="api-docs-code-caption">
                    Agir image islerini command reducer'dan ayri queue'ya ayirmaniz iyi olur.
                </div>
            </section>

            <div class="api-docs-grid">
                <section class="api-docs-section">
                    <div class="api-docs-section-kicker">Public API Onerisi</div>
                    <h4>7. Engine disari nasil acilmali</h4>
                    <ul class="api-docs-list">
                        <li><code>POST /engine/session/start</code></li>
                        <li><code>POST /engine/session/:id/commands</code></li>
                        <li><code>POST /engine/session/:id/output</code></li>
                        <li><code>GET /engine/session/:id/events</code> veya websocket stream</li>
                    </ul>
                    <pre class="api-docs-code"><code>{
  "client": "mobile-app",
  "contextLevel": "index",
  "commands": [
    { "action": "move_layer", "target": "headline", "dx": 30, "dy": 0 },
    { "action": "style_layer", "target": "headline", "patch": { "fontWeight": 700 } }
  ]
}</code></pre>
                    <pre class="api-docs-code"><code>{
  "ok": true,
  "revision": 19,
  "summary": "2 komut uygulandi.",
  "selection": { "selectedId": "text_headline" },
  "outputs": {
    "previewUrl": "/engine/output/sess_92fa/rev_19.png",
    "projectSnapshot": "/engine/output/sess_92fa/rev_19.json"
  }
}</code></pre>
                </section>

                <section class="api-docs-section">
                    <div class="api-docs-section-kicker">Gecis Plani</div>
                    <h4>8. Mevcut uygulamadan buna nasil gecilir</h4>
                    <ul class="api-docs-list">
                        <li>Ilk faz: frontend icinde bir <code>command bus</code> ve <code>applyCommands()</code> katmani kurun.</li>
                        <li>Ikinci faz: mevcut UI aksiyonlarini adim adim bu katmana yonlendirin.</li>
                        <li>Ucuncu faz: dis endpoint'i ayni reducer'a baglayin.</li>
                        <li>Dorduncu faz: plugin ve diger istemcileri bu ortak engine API'ye gecirin.</li>
                        <li>Son faz: export ve image pipeline'i event/job sistemiyle ayirin.</li>
                    </ul>
                    <div class="api-docs-note">
                        Buradaki ana hedef tek bir entegrasyon degil; Studio'nun ic ve dis tum hareketlerini
                        tek bir komut motorunda toplamak.
                    </div>
                </section>
            </div>
        </div>
    `;
}

function openApiDocsModal() {
    renderApiDocsModal();
    apiDocsModal?.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeFileMenu();
}

function closeApiDocsModal() {
    apiDocsModal?.setAttribute('hidden', '');
    document.body.style.overflow =
        (pluginModal && !pluginModal.hasAttribute('hidden')) ||
        (workspaceModal && !workspaceModal.hasAttribute('hidden'))
            ? 'hidden'
            : '';
}

window.openApiDocsModal = openApiDocsModal;
window.closeApiDocsModal = closeApiDocsModal;

function renderWorkspaceSwatchesWidget() {
    if (!swatchesWidgetBody) return;

    if (!SWATCHES.length) {
        swatchesWidgetBody.innerHTML = '<div class="dock-plugin-empty">Swatches yükleniyor...</div>';
        return;
    }

    swatchesWidgetBody.innerHTML = `
        <div class="swatches-widget-groups">
            ${SWATCHES.map(group => `
                <div class="swatches-widget-group">
                    <div class="swatches-widget-title">${group.label || 'Renkler'}</div>
                    <div class="swatches-widget-grid">
                        ${(Array.isArray(group.colors) ? group.colors : []).map(color => `
                            <button
                                class="swatches-widget-btn"
                                type="button"
                                title="${color}"
                                style="background:${color}"
                                onclick="applyWorkspaceSwatch('${color}')"></button>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function removeWorkspaceWidgetById(widgetId, options = {}) {
    const source = options.useEditorState ? workspaceEditorState : currentWorkspaceLayout;
    if (!source?.widgets) return;
    source.widgets = source.widgets.filter(widget => widget.id !== widgetId);
    if (options.useEditorState) {
        renderWorkspaceEditor();
        return;
    }
    applyStudioWorkspaceLayout(source);
}

window.removeWorkspaceWidgetById = removeWorkspaceWidgetById;

function createWorkspaceDockPluginWidget(widget) {
    const dockWidget = document.createElement('section');
    dockWidget.className = 'panel dock-widget dock-plugin-widget';
    dockWidget.dataset.widgetId = widget.id;
    dockWidget.dataset.pluginId = widget.pluginId;

    const title = getWidgetDisplayTitle(widget);
    dockWidget.innerHTML = `
        <div class="dock-widget-header">
            <div>
                <div class="label">${title}</div>
                <div class="dock-widget-subtitle">${widget.pluginId || 'plugin'}</div>
            </div>
            <div class="dock-plugin-actions">
                <button class="dock-plugin-open-btn" type="button" title="Modal olarak aç">
                    <i class="fa-solid fa-up-right-from-square"></i>
                </button>
                <button class="dock-plugin-remove-btn" type="button" title="Docktan kaldır">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>
        <div class="dock-widget-body"></div>
    `;

    const body = dockWidget.querySelector('.dock-widget-body');
    const openBtn = dockWidget.querySelector('.dock-plugin-open-btn');
    const removeBtn = dockWidget.querySelector('.dock-plugin-remove-btn');

    openBtn?.addEventListener('click', () => openPluginModalById(widget.pluginId));
    removeBtn?.addEventListener('click', () => removeWorkspaceWidgetById(widget.id));

    const mounted = window.mountStudioPluginSurfaceById?.(widget.pluginId, {
        root: body,
        close: () => removeWorkspaceWidgetById(widget.id)
    });

    if (!mounted) {
        body.innerHTML = '<div class="dock-plugin-empty">Plugin yükleniyor veya kullanılamıyor.</div>';
    }

    return dockWidget;
}

function renderWorkspaceDock() {
    if (!inspectorDock || !layersWidget || !swatchesWidget || !workspaceBottomDock) return;

    inspectorDock.querySelectorAll('.dock-plugin-widget').forEach(node => node.remove());
    workspaceBottomDock.querySelectorAll('.dock-widget').forEach(node => {
        if (node !== layersWidget && node !== swatchesWidget) node.remove();
    });

    const layout = sanitizeWorkspaceLayout(currentWorkspaceLayout || createDefaultWorkspaceLayout());
    currentWorkspaceLayout = layout;
    const rightFragment = document.createDocumentFragment();
    const bottomFragment = document.createDocumentFragment();

    const appendWidgetToRegion = (widget, element) => {
        if (widget.region === 'bottom') {
            bottomFragment.appendChild(element);
            return;
        }
        rightFragment.appendChild(element);
    };

    layout.widgets.filter(widget => widget.enabled !== false).forEach(widget => {
        if (widget.type === 'layers') {
            layersWidget.hidden = false;
            appendWidgetToRegion(widget, layersWidget);
            return;
        }

        if (widget.type === 'swatches') {
            swatchesWidget.hidden = false;
            renderWorkspaceSwatchesWidget();
            appendWidgetToRegion(widget, swatchesWidget);
            return;
        }

        if (widget.type === 'plugin' && widget.pluginId) {
            appendWidgetToRegion(widget, createWorkspaceDockPluginWidget(widget));
        }
    });

    if (!layout.widgets.some(widget => widget.type === 'layers' && widget.enabled !== false)) {
        layersWidget.hidden = true;
    }

    if (!layout.widgets.some(widget => widget.type === 'swatches' && widget.enabled !== false)) {
        swatchesWidget.hidden = true;
    }

    workspaceBottomDock.hidden = !layout.widgets.some(widget => widget.enabled !== false && widget.region === 'bottom');
    inspectorDock.appendChild(rightFragment);
    workspaceBottomDock.appendChild(bottomFragment);
}

function renderInspectorTools() {
    if (!inspectorTools) return;

    const panels = (currentWorkspaceLayout?.flyoutPanels || []).filter(panel => panel.enabled !== false);
    const hasActivePanel = panels.some(panel => getFlyoutPanelKey(panel) === activeInspectorPanel);
    if (!hasActivePanel) {
        activeInspectorPanel = panels[0] ? getFlyoutPanelKey(panels[0]) : '';
        if (inspectorFlyout?.classList.contains('open')) {
            closeInspectorFlyout();
        }
    }

    inspectorTools.innerHTML = panels.map(panel => {
        const panelKey = getFlyoutPanelKey(panel);
        const isActive = activeInspectorPanel === panelKey && inspectorFlyout?.classList.contains('open');
        return `
            <button class="tool-btn inspector-tool-btn ${isActive ? 'active' : ''}" data-panel="${panelKey}" title="${getFlyoutPanelDisplayTitle(panel)}">
                <i class="${getFlyoutIconClass(panel)}"></i>
            </button>
        `;
    }).join('');
}

function applyStudioWorkspaceLayout(layout, options = {}) {
    const nextLayout = sanitizeWorkspaceLayout(layout);
    currentWorkspaceLayout = nextLayout;

    if (appShell) {
        appShell.classList.toggle('ui-style-mobile', nextLayout.shellStyle === 'mobile');
        appShell.classList.remove('layout-toolbar-left', 'layout-toolbar-right', 'layout-toolbar-top');
        appShell.classList.add(`layout-toolbar-${nextLayout.toolbarPosition}`);
        appShell.style.setProperty('--studio-inspector-width', `${nextLayout.inspectorWidth}px`);
        appShell.style.setProperty('--studio-bottom-dock-height', `${nextLayout.bottomDockHeight}px`);
    }

    if (brandHomeBtn) {
        brandHomeBtn.title = nextLayout.shellStyle === 'mobile'
            ? 'Mobil modda arayuz ayarlarini acmak icin cift tikla'
            : 'Alcatraz Studio';
    }

    setStudioTheme(nextLayout.theme, options.persist !== false);
    renderWorkspaceDock();
    renderInspectorTools();
    renderMobileFloatingPanels();

    if (options.persist !== false) {
        persistWorkspaceLayout(nextLayout);
    }

    if (workspaceModal && !workspaceModal.hasAttribute('hidden')) {
        renderWorkspaceEditor();
    }

    syncMobileVoiceFabUi();
    if (typeof syncMobileToolsFabUi === 'function') {
        syncMobileToolsFabUi();
    }

    if (nextLayout.shellStyle === 'mobile') {
        requestAnimationFrame(() => {
            fitStageToView();
            stageWrap.scrollLeft = 0;
            stageWrap.scrollTop = 0;
        });
    }
}

function syncMobileVoiceFabUi(snapshot = null) {
    if (!mobileVoiceFabWrap || !mobileVoiceFabBtn || !mobileVoiceFabIcon) return;

    const isMobile = currentWorkspaceLayout?.shellStyle === 'mobile';
    mobileVoiceFabWrap.hidden = !isMobile;
    syncMobileChatComposer();
    clearTimeout(mobileVoiceFabFeedbackTimer);

    const phase = snapshot?.phase || 'idle';
    const transcript = snapshot?.transcript?.trim?.() || '';
    const message = snapshot?.message || 'Bas konus';
    mobileVoiceFabBtn.disabled = phase === 'loading' || !isMobile;
    mobileVoiceFabBtn.classList.toggle('is-listening', phase === 'listening');
    mobileVoiceFabBtn.classList.toggle('is-loading', phase === 'loading');
    mobileVoiceFabBtn.classList.toggle('is-error', phase === 'error');

    mobileVoiceFabBtn.title = message;
    mobileVoiceFabBtn.setAttribute('aria-label', message);
    mobileVoiceFabIcon.className = phase === 'loading'
        ? 'fa-solid fa-spinner fa-spin'
        : phase === 'listening'
            ? 'fa-solid fa-wave-square'
            : phase === 'error'
                ? 'fa-solid fa-triangle-exclamation'
                : 'fa-solid fa-microphone';

    if (!mobileVoiceFabFeedback) return;

    const feedbackText = phase === 'listening' && transcript
        ? `Duydum: "${transcript}"`
        : message;
    const shouldShowFeedback = isMobile && (
        phase === 'listening' ||
        phase === 'loading' ||
        phase === 'error' ||
        (phase === 'idle' && snapshot?.message && message !== 'Bas konus')
    );

    mobileVoiceFabFeedback.dataset.phase = phase;
    mobileVoiceFabFeedback.textContent = feedbackText;
    mobileVoiceFabFeedback.hidden = !shouldShowFeedback;

    if (shouldShowFeedback && phase === 'idle') {
        mobileVoiceFabFeedbackTimer = setTimeout(() => {
            if (mobileVoiceFabFeedback) {
                mobileVoiceFabFeedback.hidden = true;
            }
        }, 2600);
    }
}

function resizeMobileChatPrompt() {
    if (!mobileChatPrompt) return;
    mobileChatPrompt.style.height = 'auto';
    mobileChatPrompt.style.height = `${Math.min(mobileChatPrompt.scrollHeight, 108)}px`;
}

function syncMobileChatComposer() {
    if (!mobileChatPrompt || !mobileChatSendBtn) return;

    const isMobile = currentWorkspaceLayout?.shellStyle === 'mobile';
    const hasPrompt = !!mobileChatPrompt.value.trim();
    mobileChatPrompt.disabled = !isMobile;
    mobileChatSendBtn.disabled = !isMobile || !hasPrompt;
    resizeMobileChatPrompt();
}

let mobileChatFocusScrollY = 0;

function setMobileComposerKeyboardState(isOpen) {
    document.body.classList.toggle('mobile-chat-keyboard-open', !!isOpen);
}

function showMobileChatToast(message, role = 'ai', options = {}) {
    if (!mobileChatOverlay || !message) return;

    const toast = document.createElement('div');
    const actions = Array.isArray(options.actions) ? options.actions.filter(Boolean) : [];
    toast.className = `mobile-chat-toast ${role}${options.isError ? ' error' : ''}${actions.length ? ' has-actions' : ''}`;
    const text = document.createElement('div');
    text.className = 'mobile-chat-toast-text';
    text.textContent = String(message || '').trim();
    toast.appendChild(text);

    if (actions.length) {
        const actionRow = document.createElement('div');
        const hasImageActions = actions.some(action => action?.imageSrc);
        actionRow.className = `mobile-chat-toast-actions${hasImageActions ? ' is-gallery' : ''}`;
        actions.forEach(action => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `mobile-chat-toast-action${action?.imageSrc ? ' is-image' : ''}`;
            if (action?.imageSrc) {
                const image = document.createElement('img');
                image.src = action.imageSrc;
                image.alt = action.label || 'Gorsel sec';
                button.appendChild(image);
            } else {
                button.textContent = action.label || 'Sec';
            }
            button.addEventListener('click', async () => {
                try {
                    await action.onClick?.();
                } finally {
                    toast.remove();
                }
            });
            actionRow.appendChild(button);
        });
        toast.appendChild(actionRow);
    }

    mobileChatOverlay.appendChild(toast);

    const removeToast = () => {
        toast.remove();
    };

    if (!actions.length) {
        toast.addEventListener('animationend', event => {
            if (event.animationName === 'mobileChatToastOut') {
                removeToast();
            }
        });
        setTimeout(removeToast, 2400);
    }
}

async function runMobileChatPrompt(prompt) {
    if (typeof window.runActAiPromptSilently !== 'function') {
        throw new Error('Act AI hazir degil.');
    }

    const result = await window.runActAiPromptSilently(prompt);
    const reply = result?.assistantMessage || result?.message || 'Tamam.';

    if (result?.xApiChoice?.images?.length) {
        const choiceData = result.xApiChoice.data || {};
        showMobileChatToast(reply, 'ai', {
            actions: result.xApiChoice.images.map((image, index) => ({
                label: `Gorsel ${index + 1}`,
                imageSrc: window.StudioXApi?.getPreviewSrc?.(image) || image,
                onClick: async () => {
                    if (!window.StudioXApi?.applyPostData) {
                        throw new Error('X API secim araci hazir degil.');
                    }
                    const applied = await window.StudioXApi.applyPostData(choiceData, {
                        image,
                        fitShortSideToCanvas: true
                    });
                    showMobileChatToast(applied?.message || `Gorsel ${index + 1} yuklendi.`, 'ai');
                }
            }))
        });
        return result;
    }

    if (result?.clarification?.candidates?.length) {
        showMobileChatToast(reply, 'ai', {
            actions: result.clarification.candidates.map((candidate, index) => ({
                label: `${index + 1}. ${candidate.label || candidate.name || candidate.id || 'Secim'}`,
                onClick: async () => {
                    await runMobileChatPrompt(candidate.label || candidate.name || candidate.id || String(index + 1));
                }
            }))
        });
        return result;
    }

    if (result?.isManualTrigger || result?.analysis?.isManualTrigger || result?.analysis?.action?.id === 'add_image') {
        showMobileChatToast(reply, 'ai', {
            actions: [{
                label: 'Resim Seç',
                onClick: async () => {
                    const app = window.createStudioPluginAppApiById?.('act-ai');
                    if (!app || !window.StudioActAi?.addImage) {
                        throw new Error('Resim secme araci hazir degil.');
                    }
                    const addImageResult = await window.StudioActAi.addImage(app);
                    showMobileChatToast(addImageResult?.message || 'Resim secildi.', 'ai');
                }
            }]
        });
        return result;
    }

    showMobileChatToast(reply, 'ai');
    return result;
}

async function runMobileQuickChatAction(userLabel, prompt, directAction = null) {
    showMobileChatToast(userLabel, 'user');
    try {
        if (directAction?.id && window.StudioActAi?.applyAgentResponse) {
            const result = await window.StudioActAi.applyAgentResponse({
                type: 'action',
                action: {
                    id: directAction.id,
                    params: directAction.params || {}
                },
                reply: directAction.reply || ''
            }, {
                prompt
            });
            showMobileChatToast(result?.assistantMessage || result?.message || 'Tamam.', 'ai');
            return result;
        }
        return await runMobileChatPrompt(prompt);
    } catch (error) {
        showMobileChatToast(error?.message || 'Komut calismadi.', 'ai', { isError: true });
        return null;
    }
}

async function submitMobileChatComposer() {
    if (!mobileChatPrompt) return;

    const prompt = mobileChatPrompt.value.trim();
    if (!prompt) {
        syncMobileChatComposer();
        mobileChatPrompt.focus();
        return;
    }

    mobileChatPrompt.value = '';
    syncMobileChatComposer();
    showMobileChatToast(prompt, 'user');

    mobileChatSendBtn.disabled = true;

    try {
        await runMobileChatPrompt(prompt);
    } catch (error) {
        showMobileChatToast(error?.message || 'Act AI komutu calismadi.', 'ai', { isError: true });
    } finally {
        syncMobileChatComposer();
    }
}

function initMobileVoiceFab() {
    if (!mobileVoiceFabBtn) return;

    const bindController = () => {
        const controller = window.StudioVoiceCommand?.getController?.('mobile-fab');
        if (!controller) {
            syncMobileVoiceFabUi({
                phase: 'error',
                message: 'Sesli komut plugin yuklenemedi.'
            });
            return;
        }

        mobileVoiceFabUnsubscribe?.();
        mobileVoiceFabUnsubscribe = controller.subscribe(snapshot => {
            syncMobileVoiceFabUi(snapshot);
        });
        syncMobileVoiceFabUi({
            phase: controller.getState?.().phase || 'idle',
            message: 'Bas konus'
        });

        mobileVoiceFabBtn.onclick = () => {
            controller.toggle();
        };
    };

    bindController();
    window.addEventListener('studio:plugins-loaded', bindController);

    mobileChatSendBtn?.addEventListener('click', () => {
        submitMobileChatComposer();
    });

    mobileChatPrompt?.addEventListener('input', () => {
        syncMobileChatComposer();
    });

    mobileChatPrompt?.addEventListener('focus', () => {
        if (currentWorkspaceLayout?.shellStyle !== 'mobile') return;
        mobileChatFocusScrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        setMobileComposerKeyboardState(true);
        requestAnimationFrame(() => {
            window.scrollTo(0, mobileChatFocusScrollY);
        });
    });

    mobileChatPrompt?.addEventListener('blur', () => {
        setMobileComposerKeyboardState(false);
        requestAnimationFrame(() => {
            window.scrollTo(0, mobileChatFocusScrollY);
        });
    });

    mobileChatPrompt?.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        submitMobileChatComposer();
    });

    mobileQuickUploadImageBtn?.addEventListener('click', async () => {
        await runMobileQuickChatAction('resim yükle', 'resim yükle');
    });

    mobileQuickImageResizeBtn?.addEventListener('click', async () => {
        await runMobileQuickChatAction('resmi sığdır', 'resmi sığdır', {
            id: 'cover_image_to_canvas',
            params: { target: 'last_raster' },
            reply: 'Resmi canvasa sığdır.'
        });
    });

    mobileQuickSendBackBtn?.addEventListener('click', async () => {
        await runMobileQuickChatAction('resmi en arkaya gönder', 'resmi en arkaya gönder', {
            id: 'reorder_layer',
            params: { target: 'last_raster', position: 'back' },
            reply: 'Resmi en arkaya gönder.'
        });
    });

    mobileQuickDownloadImageBtn?.addEventListener('click', async () => {
        await runMobileQuickChatAction('tasarımı dışa aktar', 'tasarımı dışa aktar');
    });

    syncMobileChatComposer();
}

function createWorkspacePluginWidget(pluginId) {
    const plugin = window.getStudioPlugins?.().find(item => item.id === pluginId);
    if (!pluginId || !plugin) return null;
    workspacePluginWidgetSeed += 1;
    return normalizeWorkspaceWidget({
        id: `plugin-${pluginId}-${workspacePluginWidgetSeed}`,
        type: 'plugin',
        pluginId,
        title: plugin.menuLabel || plugin.name,
        enabled: true,
        region: 'right'
    }, workspacePluginWidgetSeed);
}

function createWorkspaceFlyoutPlugin(pluginId) {
    const plugin = window.getStudioPlugins?.().find(item => item.id === pluginId);
    if (!pluginId || !plugin) return null;
    workspacePluginWidgetSeed += 1;
    return normalizeWorkspaceFlyoutPanel({
        id: `plugin-${pluginId}-${workspacePluginWidgetSeed}`,
        type: 'plugin',
        pluginId,
        title: plugin.menuLabel || plugin.name,
        enabled: true
    }, workspacePluginWidgetSeed);
}

function createWorkspacePaletteItem(item, index = 0) {
    return normalizeWorkspaceWidget(item, index);
}

function destroyWorkspaceBuilderSortables() {
    workspaceBuilderSortables.forEach(instance => instance?.destroy?.());
    workspaceBuilderSortables = [];
}

function encodeWorkspaceBuilderItem(item) {
    return encodeURIComponent(JSON.stringify(item));
}

function decodeWorkspaceBuilderItem(encoded) {
    try {
        return JSON.parse(decodeURIComponent(encoded));
    } catch (_) {
        return null;
    }
}

function getWorkspaceBuilderCardIcon(item, scope = 'dock') {
    if (item.type === 'plugin') {
        return window.getStudioPlugins?.().find(plugin => plugin.id === item.pluginId)?.icon || 'fa-solid fa-puzzle-piece';
    }

    if (item.type === 'layers') return 'fa-solid fa-layer-group';
    if (item.type === 'swatches') return 'fa-solid fa-swatchbook';
    return 'fa-solid fa-square';
}

function renderWorkspaceBuilderCard(item, scope, options = {}) {
    const title = scope === 'flyout' ? getFlyoutPanelDisplayTitle(item) : getWidgetDisplayTitle(item);
    const meta = item.type === 'plugin'
        ? (item.pluginId || 'plugin')
        : (STUDIO_WIDGET_TYPE_LABELS[item.type] || (scope === 'flyout' ? STUDIO_FLYOUT_TYPE_LABELS[item.type] : '') || 'Widget');
    const isPalette = options.palette === true;
    const region = options.region || item.region || '';

    return `
        <div
            class="workspace-builder-card ${item.enabled === false ? 'is-disabled' : ''} ${isPalette ? 'workspace-builder-card-palette' : ''}"
            data-scope="${scope}"
            data-region="${region}"
            data-item-json="${encodeWorkspaceBuilderItem(item)}">
            <div class="workspace-builder-card-head">
                <div>
                    <div class="workspace-builder-card-title"><i class="${getWorkspaceBuilderCardIcon(item, scope)}"></i> ${title}</div>
                    <div class="workspace-builder-card-meta">${meta}</div>
                </div>
                ${isPalette ? '' : `
                    <div class="workspace-builder-card-actions">
                        <button class="workspace-builder-chip-btn" type="button" data-builder-toggle title="Gizle / Göster">
                            <i class="fa-solid ${item.enabled === false ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        </button>
                        <button class="workspace-builder-chip-btn" type="button" data-builder-remove title="Kaldır">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function getWorkspacePaletteItems() {
    const baseItems = [
        createWorkspacePaletteItem({ id: 'palette-layers', type: 'layers', title: 'Katmanlar', enabled: true, region: 'right' }, 0),
        createWorkspacePaletteItem({ id: 'palette-swatches', type: 'swatches', title: 'Swatches', enabled: true, region: 'right' }, 1)
    ];
    const pluginItems = (window.getStudioPlugins?.() || []).map((plugin, index) => createWorkspacePaletteItem({
        id: `palette-plugin-${plugin.id}`,
        type: 'plugin',
        pluginId: plugin.id,
        title: plugin.menuLabel || plugin.name,
        enabled: true,
        region: 'right'
    }, index + 2));
    return [...baseItems, ...pluginItems];
}

function filterWorkspaceBuilderItems(items, searchTerm, scope = 'dock') {
    const query = String(searchTerm || '').trim().toLocaleLowerCase('tr');
    if (!query) return items;
    return items.filter(item => {
        const title = scope === 'flyout' ? getFlyoutPanelDisplayTitle(item) : getWidgetDisplayTitle(item);
        const meta = item.type === 'plugin'
            ? (item.pluginId || '')
            : (STUDIO_WIDGET_TYPE_LABELS[item.type] || (scope === 'flyout' ? STUDIO_FLYOUT_TYPE_LABELS[item.type] : '') || '');
        return `${title} ${meta}`.toLocaleLowerCase('tr').includes(query);
    });
}

function syncWorkspaceEditorFromBuilder() {
    if (!workspaceEditorState) {
        workspaceEditorState = cloneStudioData(currentWorkspaceLayout || createDefaultWorkspaceLayout());
    }

    const readZoneItems = (container, normalizer, region = '') => {
        if (!container) return [];
        return [...container.querySelectorAll('.workspace-builder-card[data-item-json]')]
            .map(node => decodeWorkspaceBuilderItem(node.dataset.itemJson))
            .filter(Boolean)
            .map((item, index) => normalizer({ ...item, region }, index))
            .filter(Boolean);
    };

    const nextWidgets = [
        ...readZoneItems(workspaceRightZone, normalizeWorkspaceWidget, 'right'),
        ...readZoneItems(workspaceBottomZone, normalizeWorkspaceWidget, 'bottom')
    ];
    const nextFlyoutPanels = readZoneItems(workspaceFlyoutZone, normalizeWorkspaceFlyoutPanel);

    workspaceEditorState.widgets = nextWidgets;
    workspaceEditorState.flyoutPanels = nextFlyoutPanels;
    workspaceEditorState = sanitizeWorkspaceLayout(workspaceEditorState);
    renderWorkspaceEditor();
}

function initWorkspaceBuilderSortables() {
    destroyWorkspaceBuilderSortables();
    if (typeof Sortable === 'undefined') return;

    const workspaceShared = {
        group: { name: 'workspace-builder', pull: true, put: true },
        animation: 160,
        sort: true,
        onAdd: syncWorkspaceEditorFromBuilder,
        onUpdate: syncWorkspaceEditorFromBuilder,
        onSort: syncWorkspaceEditorFromBuilder
    };

    if (workspaceDockPalette) {
        workspaceBuilderSortables.push(Sortable.create(workspaceDockPalette, {
            group: { name: 'workspace-builder', pull: 'clone', put: false },
            sort: false,
            animation: 160
        }));
    }

    if (workspaceRightZone) {
        workspaceBuilderSortables.push(Sortable.create(workspaceRightZone, workspaceShared));
    }

    if (workspaceBottomZone) {
        workspaceBuilderSortables.push(Sortable.create(workspaceBottomZone, workspaceShared));
    }

    if (workspaceFlyoutZone) {
        workspaceBuilderSortables.push(Sortable.create(workspaceFlyoutZone, workspaceShared));
    }
}

function renderWorkspaceEditor() {
    const layout = sanitizeWorkspaceLayout(workspaceEditorState || currentWorkspaceLayout || createDefaultWorkspaceLayout());
    workspaceEditorState = cloneStudioData(layout);

    if (workspaceShellStyle) {
        workspaceShellStyle.innerHTML = STUDIO_SHELL_STYLE_OPTIONS
            .map(option => `<option value="${option.id}">${option.label}</option>`)
            .join('');
        workspaceShellStyle.value = layout.shellStyle;
    }

    if (workspaceToolbarPosition) {
        workspaceToolbarPosition.innerHTML = STUDIO_TOOLBAR_POSITION_OPTIONS
            .map(option => `<option value="${option.id}">${option.label}</option>`)
            .join('');
        workspaceToolbarPosition.value = layout.toolbarPosition;
    }

    if (workspaceThemeSelect) {
        workspaceThemeSelect.innerHTML = STUDIO_THEME_OPTIONS
            .map(option => `<option value="${option.id}">${option.label}</option>`)
            .join('');
        workspaceThemeSelect.value = layout.theme;
    }

    if (workspaceInspectorWidth) {
        workspaceInspectorWidth.value = String(layout.inspectorWidth);
    }

    if (workspaceInspectorWidthValue) {
        workspaceInspectorWidthValue.textContent = `${layout.inspectorWidth} px`;
    }

    if (workspaceBottomDockHeight) {
        workspaceBottomDockHeight.value = String(layout.bottomDockHeight);
    }

    if (workspaceBottomDockHeightValue) {
        workspaceBottomDockHeightValue.textContent = `${layout.bottomDockHeight} px`;
    }

    if (workspacePresetList) {
        workspacePresetList.innerHTML = studioWorkspacePresets.map(preset => `
            <button class="workspace-preset-btn" type="button" data-preset-id="${preset.id}">
                <span>
                    <strong>${preset.label || preset.id}</strong>
                    <small>${preset.description || 'Workspace preset'}</small>
                </span>
                <i class="fa-solid fa-arrow-right"></i>
            </button>
        `).join('') || '<div class="dock-plugin-empty">Preset bulunamadı.</div>';
    }

    if (workspaceDockSearch) {
        workspaceDockSearch.value = workspaceDockSearchTerm;
    }

    if (workspaceDockPalette) {
        workspaceDockPalette.innerHTML = filterWorkspaceBuilderItems(getWorkspacePaletteItems(), workspaceDockSearchTerm, 'dock')
            .map(item => renderWorkspaceBuilderCard(item, 'dock', { palette: true, region: 'palette' }))
            .join('');
    }

    if (workspaceRightZone) {
        workspaceRightZone.innerHTML = `<div class="workspace-builder-zone-title">Sağ Dock</div>` +
            layout.widgets
                .filter(widget => widget.region !== 'bottom')
                .map(widget => renderWorkspaceBuilderCard(widget, 'dock', { region: 'right' }))
                .join('');
    }

    if (workspaceBottomZone) {
        workspaceBottomZone.innerHTML = `<div class="workspace-builder-zone-title">Alt Panel</div>` +
            layout.widgets
                .filter(widget => widget.region === 'bottom')
                .map(widget => renderWorkspaceBuilderCard(widget, 'dock', { region: 'bottom' }))
                .join('');
    }

    if (workspaceFlyoutZone) {
        workspaceFlyoutZone.innerHTML = `<div class="workspace-builder-zone-title">Flyout İkonları</div>` +
            layout.flyoutPanels
                .map(panel => renderWorkspaceBuilderCard(panel, 'flyout', { region: 'flyout' }))
                .join('');
    }

    if (workspaceJsonPreview) {
        workspaceJsonPreview.value = JSON.stringify(layout, null, 2);
    }

    initWorkspaceBuilderSortables();
}

function openWorkspaceModal() {
    if (!workspaceModal) return;
    workspaceEditorState = cloneStudioData(currentWorkspaceLayout || createDefaultWorkspaceLayout());
    renderWorkspaceEditor();
    workspaceModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeFileMenu();
}

window.openWorkspaceModal = openWorkspaceModal;

function closeWorkspaceModal() {
    if (!workspaceModal) return;
    workspaceModal.setAttribute('hidden', '');
    document.body.style.overflow = pluginModal && !pluginModal.hasAttribute('hidden') ? 'hidden' : '';
}

window.closeWorkspaceModal = closeWorkspaceModal;

function applyWorkspacePresetById(presetId) {
    const preset = getWorkspacePresetById(presetId);
    if (!preset?.layout) return;
    applyStudioWorkspaceLayout(preset.layout);
}

window.applyWorkspacePresetById = applyWorkspacePresetById;

function updateWorkspaceEditorField(key, value) {
    if (!workspaceEditorState) {
        workspaceEditorState = cloneStudioData(currentWorkspaceLayout || createDefaultWorkspaceLayout());
    }

    workspaceEditorState[key] = value;
    renderWorkspaceEditor();
}

function initWorkspaceEditor() {
    workspaceModalClose?.addEventListener('click', closeWorkspaceModal);
    workspaceModal?.addEventListener('click', event => {
        if (event.target === workspaceModal) closeWorkspaceModal();
    });

    workspaceToolbarPosition?.addEventListener('change', event => {
        updateWorkspaceEditorField('toolbarPosition', event.target.value);
    });

    workspaceShellStyle?.addEventListener('change', event => {
        updateWorkspaceEditorField('shellStyle', event.target.value);
    });

    workspaceThemeSelect?.addEventListener('change', event => {
        updateWorkspaceEditorField('theme', event.target.value);
    });

    workspaceInspectorWidth?.addEventListener('input', event => {
        updateWorkspaceEditorField('inspectorWidth', clampStudioNumber(event.target.value, 260, 520, 320));
    });

    workspaceBottomDockHeight?.addEventListener('input', event => {
        updateWorkspaceEditorField('bottomDockHeight', clampStudioNumber(event.target.value, 140, 340, 220));
    });

    workspaceDockSearch?.addEventListener('input', event => {
        workspaceDockSearchTerm = event.target.value || '';
        renderWorkspaceEditor();
    });

    workspacePresetList?.addEventListener('click', event => {
        const button = event.target.closest('[data-preset-id]');
        if (!button) return;
        const preset = getWorkspacePresetById(button.dataset.presetId);
        if (!preset?.layout) return;
        workspaceEditorState = sanitizeWorkspaceLayout(preset.layout);
        renderWorkspaceEditor();
    });

    workspaceModal?.addEventListener('click', event => {
        const removeButton = event.target.closest('[data-builder-remove]');
        const toggleButton = event.target.closest('[data-builder-toggle]');
        const card = event.target.closest('.workspace-builder-card[data-item-json]');
        if (!card) return;

        const item = decodeWorkspaceBuilderItem(card.dataset.itemJson);
        if (!item) return;

        if (removeButton) {
            card.remove();
            syncWorkspaceEditorFromBuilder();
            return;
        }

        if (toggleButton) {
            item.enabled = item.enabled === false;
            card.dataset.itemJson = encodeWorkspaceBuilderItem(item);
            card.classList.toggle('is-disabled', item.enabled === false);
            toggleButton.innerHTML = `<i class="fa-solid ${item.enabled === false ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
            syncWorkspaceEditorFromBuilder();
        }
    });

    workspaceApplyBtn?.addEventListener('click', () => {
        applyStudioWorkspaceLayout(workspaceEditorState || currentWorkspaceLayout || createDefaultWorkspaceLayout());
        closeWorkspaceModal();
    });

    workspaceResetBtn?.addEventListener('click', () => {
        workspaceEditorState = createDefaultWorkspaceLayout();
        renderWorkspaceEditor();
    });

    brandHomeBtn?.addEventListener('dblclick', () => {
        if (currentWorkspaceLayout?.shellStyle !== 'mobile') return;
        openWorkspaceModal();
    });

    initMobileWorkspacePanels();

    window.addEventListener('studio:plugins-loaded', () => {
        renderWorkspaceDock();
        renderInspectorTools();
        renderMobileFloatingPanels();
        if (workspaceModal && !workspaceModal.hasAttribute('hidden')) {
            renderWorkspaceEditor();
        }
        if (mobileWorkspacePickerModal && !mobileWorkspacePickerModal.hasAttribute('hidden')) {
            renderMobileWorkspacePickerList();
        }
    });
}

async function initStudioWorkspace() {
    await loadStudioWorkspacePresets();
    const savedLayout = readWorkspaceLayout();
    const fallbackPresetId = shouldUseMobileWorkspaceByDefault() ? 'mobile' : 'default';
    const fallbackLayout = getWorkspacePresetById(fallbackPresetId)?.layout
        || getWorkspacePresetById('default')?.layout
        || createDefaultWorkspaceLayout();
    applyStudioWorkspaceLayout(savedLayout || fallbackLayout, { persist: savedLayout !== null });
    initWorkspaceEditor();
    initMobileVoiceFab();
}
