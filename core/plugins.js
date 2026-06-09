const studioPlugins = new Map();
let pluginMenuContainer = null;
let pluginModalBackdrop = null;
let pluginModalTitle = null;
let pluginModalSubtitle = null;
let pluginModalBody = null;
let pluginModalClose = null;
let pluginModalEventsBound = false;

function clonePluginValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergePluginLayerStyle(base, patch) {
    const output = clonePluginValue(base);
    Object.keys(base || {}).forEach(key => {
        const baseValue = base[key];
        const patchValue = patch?.[key];
        if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
            output[key] = {
                ...baseValue,
                ...(patchValue && typeof patchValue === 'object' ? patchValue : {})
            };
            return;
        }
        if (patchValue !== undefined) output[key] = patchValue;
    });
    return output;
}

function normalizePluginLayerNumber(value, fallback) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.endsWith('%')) {
            const percent = Number(trimmed.slice(0, -1));
            return Number.isFinite(percent) ? percent / 100 : fallback;
        }
        const match = trimmed.match(/-?\d+(?:\.\d+)?/);
        if (match) {
            const num = Number(match[0]);
            return Number.isFinite(num) ? num : fallback;
        }
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function getPluginLayerFallbackFrame(type, index) {
    const insetX = Math.round(canvasWidth * 0.08);
    const insetY = Math.round(canvasHeight * 0.08);
    const stepY = Math.max(32, Math.round(canvasHeight * 0.08));
    const staggerX = Math.round((index % 3) * Math.max(24, canvasWidth * 0.03));

    if (type === 'text') {
        return {
            x: insetX + staggerX,
            y: insetY + (index * stepY),
            width: Math.max(220, Math.round(canvasWidth * 0.54)),
            height: Math.max(80, Math.round(canvasHeight * 0.16))
        };
    }

    if (type === 'shape') {
        return index === 0
            ? { x: 0, y: 0, width: canvasWidth, height: canvasHeight }
            : {
                x: insetX + staggerX,
                y: insetY + (index * stepY),
                width: Math.max(160, Math.round(canvasWidth * 0.32)),
                height: Math.max(160, Math.round(canvasHeight * 0.22))
            };
    }

    return index === 0
        ? { x: 0, y: 0, width: canvasWidth, height: canvasHeight }
        : {
            x: insetX + staggerX,
            y: insetY + Math.round(index * stepY * 0.8),
            width: Math.max(220, Math.round(canvasWidth * 0.42)),
            height: Math.max(220, Math.round(canvasHeight * 0.32))
        };
}

function normalizePluginLayerBase(layer, index, type) {
    const fallbackFrame = getPluginLayerFallbackFrame(type, index);

    return {
        id: typeof layer?.id === 'string' && layer.id.trim() ? layer.id : `layer_plugin_${Math.random().toString(36).slice(2, 10)}`,
        name: typeof layer?.name === 'string' && layer.name.trim() ? layer.name : 'Layer',
        x: Math.round(normalizePluginLayerNumber(layer?.x, fallbackFrame.x)),
        y: Math.round(normalizePluginLayerNumber(layer?.y, fallbackFrame.y)),
        width: Math.max(1, Math.round(normalizePluginLayerNumber(layer?.width, fallbackFrame.width))),
        height: Math.max(1, Math.round(normalizePluginLayerNumber(layer?.height, fallbackFrame.height))),
        rotation: normalizePluginLayerNumber(layer?.rotation, 0),
        opacity: Math.min(1, Math.max(0, normalizePluginLayerNumber(layer?.opacity, 1))),
        visible: layer?.visible !== false,
        locked: layer?.locked === true,
        z: index + 1,
        radius: Math.max(0, Math.round(normalizePluginLayerNumber(layer?.radius, 0)))
    };
}

function normalizePluginLayer(layer, index) {
    if (!layer || typeof layer !== 'object') return null;

    const type = layer.type;
    if (!['text', 'shape', 'raster'].includes(type)) return null;

    const base = normalizePluginLayerBase(layer, index, type);
    const layerStyle = typeof layer?.layerStyle === 'object' && layer.layerStyle
        ? mergePluginLayerStyle(
            typeof createDefaultLayerStyle === 'function' ? createDefaultLayerStyle() : {},
            layer.layerStyle
        )
        : (typeof createDefaultLayerStyle === 'function' ? createDefaultLayerStyle() : undefined);

    if (type === 'text') {
        const textValue = typeof layer.text === 'string' && layer.text.trim()
            ? layer.text
            : (typeof layer.name === 'string' && layer.name.trim() ? layer.name : 'Başlık');

        return {
            ...base,
            type: 'text',
            text: textValue,
            color: typeof layer.color === 'string' && layer.color.trim() ? layer.color : '#ffffff',
            fontSize: Math.max(14, Math.round(normalizePluginLayerNumber(layer.fontSize, Math.max(28, canvasWidth * 0.04)))),
            fontWeight: Math.max(100, Math.min(900, Math.round(normalizePluginLayerNumber(layer.fontWeight, 700)))),
            fontStyle: typeof layer.fontStyle === 'string' && layer.fontStyle.trim() ? layer.fontStyle : 'normal',
            textAlign: ['left', 'center', 'right', 'justify'].includes(layer.textAlign) ? layer.textAlign : 'left',
            verticalAlign: ['top', 'middle', 'bottom'].includes(layer.verticalAlign) ? layer.verticalAlign : 'top',
            textDecoration: typeof layer.textDecoration === 'string' && layer.textDecoration.trim() ? layer.textDecoration : 'none',
            fontFamily: typeof layer.fontFamily === 'string' && layer.fontFamily.trim() ? layer.fontFamily : 'Inter',
            autoFitText: layer.autoFitText !== false,
            fontAwesomeClass: typeof layer.fontAwesomeClass === 'string' && layer.fontAwesomeClass.trim() ? layer.fontAwesomeClass.trim() : undefined,
            layerStyle
        };
    }

    if (type === 'shape') {
        return {
            ...base,
            type: 'shape',
            fill: typeof layer.fill === 'string' && layer.fill.trim() ? layer.fill : '#3b82f6',
            aspectLocked: layer?.aspectLocked !== false,
            shapeType: typeof layer.shapeType === 'string' && layer.shapeType.trim() ? layer.shapeType.trim() : 'rect',
            layerStyle
        };
    }

    return {
        ...base,
        type: 'raster',
        src: typeof layer.src === 'string' && layer.src.trim() ? layer.src : null,
        exportSrc: typeof layer.exportSrc === 'string' && layer.exportSrc.trim() ? layer.exportSrc : undefined,
        aspectLocked: layer?.aspectLocked !== false,
        canvasData: typeof layer.canvasData === 'string' && layer.canvasData.trim() ? layer.canvasData : null,
        drawOps: Array.isArray(layer.drawOps) ? layer.drawOps : [],
        imagePrompt: typeof layer.imagePrompt === 'string' ? layer.imagePrompt : undefined,
        imageBackground: typeof layer.imageBackground === 'string' ? layer.imageBackground : undefined,
        imageQuality: typeof layer.imageQuality === 'string' ? layer.imageQuality : undefined,
        layerStyle
    };
}

function syncPluginTextLayers() {
    if (typeof window.syncTextLayerSize !== 'function') return;
    layers.forEach(layer => {
        if (layer?.type === 'text') {
            window.syncTextLayerSize(layer.id, layer.text || '');
        }
    });
}

function getStudioAppVersion() {
    return String(window.__STUDIO_APP_VERSION || '1.0.0').trim() || '1.0.0';
}

function getStudioAssetUrl(path) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}v=${encodeURIComponent(getStudioAppVersion())}`;
}

function getPluginAppApi(plugin) {
    return {
        plugin,
        getCanvasSize() {
            return { width: canvasWidth, height: canvasHeight };
        },
        getLayers() {
            return clonePluginValue(layers);
        },
        getTemplateFunctions() {
            return window.StudioEngine?.getTemplateFunctions?.() || [];
        },
        setTemplateFunctions(functions, options = {}) {
            if (typeof window.StudioEngine?.setTemplateFunctions !== 'function') return [];
            return window.StudioEngine.setTemplateFunctions(functions, options);
        },
        getProjectData() {
            const project = window.StudioEngine?.exportProject?.() || {
                projectName,
                canvas: {
                    width: canvasWidth,
                    height: canvasHeight
                },
                selection: {
                    selectedId,
                    selectedIds
                },
                layers
            };
            return {
                ...clonePluginValue(project),
                selectedLayerId: project.selection?.selectedId || project.selectedId || null,
                selectedLayerIds: clonePluginValue(project.selection?.selectedIds || project.selectedIds || [])
            };
        },
        getSelectedLayer() {
            const layer = layers.find(item => item.id === selectedId) || null;
            return layer ? clonePluginValue(layer) : null;
        },
        selectLayer(id) {
            const result = window.StudioEngine?.applyCommand?.({
                action: 'select_layer',
                target: id
            }, {
                commitHistory: false,
                includeContext: false
            });
            return !!result?.ok;
        },
        updateLayer(id, patch, options = {}) {
            if (!id || !patch || typeof patch !== 'object') return false;
            const result = window.StudioEngine?.applyCommand?.({
                action: 'update_layer',
                target: id,
                patch,
                autoFitText: options.autoFitText !== false
            }, {
                commitHistory: options.commitHistory !== false && options.skipHistory !== true && options.historyMode !== 'immediate',
                includeContext: false,
                render: options.render !== false
            });
            if (!result?.ok) return false;
            if (options.patchElement && typeof window.patchLayerElement === 'function') {
                window.patchLayerElement(id);
            }
            if (options.refreshLayerList && typeof renderLayerList === 'function') renderLayerList();
            if (options.historyMode === 'immediate' && typeof commitHistory === 'function') commitHistory();
            return true;
        },
        getBackendUrl(fileName) {
            return `${plugin.baseUrl}/${fileName}`;
        },
        getAssetUrl(fileName) {
            return getStudioAssetUrl(`${plugin.baseUrl}/${fileName}`);
        },
        async replaceLayers(nextLayers) {
            const normalizedLayers = Array.isArray(nextLayers)
                ? nextLayers.map((layer, index) => normalizePluginLayer(layer, index)).filter(Boolean)
                : [];
            window.StudioEngine?.applyPayload?.({
                layers: normalizedLayers,
                selectedIds: []
            }, {
                reset: true,
                commitHistory: false,
                includeContext: false
            });
            await applyAiRasterOpsToLayers();
            commitHistory();
        },
        closeModal() {
            closePluginModal();
        },
        closeMenus() {
            closeFileMenu();
        }
    };
}

function registerStudioPlugin(definition) {
    const loadMeta = window.__studioPluginLoadMeta || null;
    if (!definition || !definition.id || !loadMeta) {
        throw new Error('Plugin registration failed.');
    }

    const plugin = {
        ...definition,
        path: loadMeta.path,
        baseUrl: loadMeta.baseUrl,
        manifest: loadMeta.manifest
    };

    studioPlugins.set(plugin.id, plugin);

    if (typeof plugin.init === 'function') {
        plugin.init(getPluginAppApi(plugin));
    }
}

window.registerStudioPlugin = registerStudioPlugin;

function getStudioPlugins() {
    return [...studioPlugins.values()];
}

window.getStudioPlugins = getStudioPlugins;

function createStudioPluginAppApiById(pluginId) {
    const plugin = studioPlugins.get(pluginId);
    return plugin ? getPluginAppApi(plugin) : null;
}

window.createStudioPluginAppApiById = createStudioPluginAppApiById;

function getPluginMenuGroup(plugin) {
    const id = plugin?.id || '';

    if (['unsplash', 'pexels', 'fontawesome', 'brandfetch', 'football-teams', 'country-flags'].includes(id)) {
        return 'Stock';
    }

    if (['image-upscale', 'voice-command', 'act-ai'].includes(id)) {
        return 'Yapay Zeka';
    }

    if (id === 'x-api') {
        return 'Veri';
    }

    return 'Grafik';
}

function sortPluginsForMenu(group, items) {
    const orderMap = {
        Stock: ['unsplash', 'pexels', 'fontawesome', 'brandfetch', 'football-teams', 'country-flags'],
        Grafik: ['colormind', 'web-gradients', 'hero-patterns', 'google-fonts']
    };

    const preferredOrder = orderMap[group] || [];
    const rank = new Map(preferredOrder.map((id, index) => [id, index]));

    return [...items].sort((a, b) => {
        const aRank = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bRank = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;

        if (aRank !== bRank) return aRank - bRank;
        return (a.menuLabel || a.name || '').localeCompare((b.menuLabel || b.name || ''), 'tr');
    });
}

function renderPluginsMenu() {
    pluginMenuContainer = pluginMenuContainer || document.getElementById('pluginsMenuItems');
    if (!pluginMenuContainer) return;

    const plugins = getStudioPlugins();
    if (!plugins.length) {
        pluginMenuContainer.innerHTML = `
            <div class="file-item" style="color:var(--muted);cursor:default;">
                <i class="fa-solid fa-puzzle-piece"></i> Yüklü eklenti yok
            </div>
        `;
        return;
    }

    const groupOrder = ['Stock', 'Grafik', 'Yapay Zeka', 'Veri'];
    const groups = new Map(groupOrder.map(group => [group, []]));

    plugins.forEach(plugin => {
        const group = getPluginMenuGroup(plugin);
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(plugin);
    });

    pluginMenuContainer.innerHTML = `
        <div class="plugins-megamenu">
            ${groupOrder.map(group => {
                const items = sortPluginsForMenu(group, groups.get(group) || []);
                return `
                    <section class="plugins-megacol">
                        <div class="plugins-megacol-title">${group}</div>
                        <div class="plugins-megacol-list">
                            ${items.length ? items.map(plugin => `
                                <button class="file-item plugins-mega-item" type="button" onclick="openPluginModalById('${plugin.id}')">
                                    <i class="${plugin.icon || 'fa-solid fa-puzzle-piece'}"></i>
                                    <span>${plugin.menuLabel || plugin.name}</span>
                                </button>
                            `).join('') : `<div class="plugins-mega-empty">Bu kategoride eklenti yok</div>`}
                        </div>
                    </section>
                `;
            }).join('')}
        </div>
    `;
}

function ensurePluginModalRefs() {
    pluginModalBackdrop = pluginModalBackdrop || document.getElementById('pluginModal');
    pluginModalTitle = pluginModalTitle || document.getElementById('pluginModalTitle');
    pluginModalSubtitle = pluginModalSubtitle || document.getElementById('pluginModalSubtitle');
    pluginModalBody = pluginModalBody || document.getElementById('pluginModalBody');
    pluginModalClose = pluginModalClose || document.getElementById('pluginModalClose');

    if (!pluginModalEventsBound) {
        pluginModalClose?.addEventListener('click', closePluginModal);
        pluginModalBackdrop?.addEventListener('click', (e) => {
            if (e.target === pluginModalBackdrop) closePluginModal();
        });
        pluginModalEventsBound = true;
    }
}

function mountStudioPluginSurfaceById(pluginId, options = {}) {
    const plugin = studioPlugins.get(pluginId);
    if (!plugin || typeof plugin.openModal !== 'function') return;

    const root = options.root;
    if (!(root instanceof HTMLElement)) return null;

    const app = getPluginAppApi(plugin);
    const surfaceConfig = plugin.openModal(app) || {};
    const title = surfaceConfig.title || plugin.name;
    const subtitle = surfaceConfig.subtitle || '';

    if (options.titleEl) {
        options.titleEl.textContent = title;
    }

    if (options.subtitleEl) {
        options.subtitleEl.textContent = subtitle;
    }

    root.innerHTML = surfaceConfig.html || '';

    if (typeof surfaceConfig.onOpen === 'function') {
        surfaceConfig.onOpen({
            plugin,
            root,
            close: typeof options.close === 'function' ? options.close : closePluginModal,
            app
        });
    }

    return {
        plugin,
        title,
        subtitle
    };
}

window.mountStudioPluginSurfaceById = mountStudioPluginSurfaceById;

function openPluginModalById(pluginId) {
    ensurePluginModalRefs();
    if (!pluginModalBackdrop || !pluginModalBody || !pluginModalTitle || !pluginModalSubtitle) return;

    const mounted = mountStudioPluginSurfaceById(pluginId, {
        root: pluginModalBody,
        titleEl: pluginModalTitle,
        subtitleEl: pluginModalSubtitle,
        close: closePluginModal
    });

    if (!mounted) return;

    pluginModalBackdrop.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeFileMenu();
}

window.openPluginModalById = openPluginModalById;

function closePluginModal() {
    ensurePluginModalRefs();
    if (!pluginModalBackdrop || !pluginModalBody) return;
    pluginModalBackdrop.setAttribute('hidden', '');
    pluginModalBody.innerHTML = '';
    document.body.style.overflow = '';
}

window.closePluginModal = closePluginModal;

async function loadStudioPlugins() {
    let config;
    try {
        const response = await fetch(getStudioAssetUrl('plugins/plugins.json'));
        config = await response.json();
    } catch (error) {
        console.warn('Plugin registry could not be loaded:', error);
        renderPluginsMenu();
        return;
    }

    const pluginDefs = Array.isArray(config?.plugins) ? config.plugins : [];

    for (const item of pluginDefs) {
        if (!item?.path || item.enabled === false) continue;

        try {
            const baseUrl = `plugins/${item.path}`;
            const manifestResponse = await fetch(getStudioAssetUrl(`${baseUrl}/manifest.json`));
            const manifest = await manifestResponse.json();
            const entry = manifest.entry || 'index.js';
            const entryUrl = getStudioAssetUrl(`${baseUrl}/${entry}`);

            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = entryUrl;
                script.onload = resolve;
                script.onerror = reject;
                window.__studioPluginLoadMeta = { path: item.path, baseUrl, manifest };
                document.body.appendChild(script);
            });
        } catch (error) {
            console.warn(`Plugin load failed: ${item.path}`, error);
        } finally {
            window.__studioPluginLoadMeta = null;
        }
    }

    renderPluginsMenu();
    window.dispatchEvent(new CustomEvent('studio:plugins-loaded'));
}

window.loadStudioPlugins = loadStudioPlugins;
