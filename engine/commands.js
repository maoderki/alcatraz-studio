function studioEngineGenerateLayerId() {
    return `layer_engine_${Math.random().toString(36).slice(2, 10)}`;
}

function studioEngineNormalizeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function studioEngineNormalizeLayerStyle(style) {
    return mergeLayerStyle(createDefaultLayerStyle(), style || {});
}

function studioEngineNormalizeTemplateFunctions(value) {
    return (Array.isArray(value) ? value : [])
        .map(item => {
            if (!item || typeof item !== 'object') return null;
            const type = typeof item.type === 'string' ? item.type.trim() : '';
            const textLayerId = typeof item.textLayerId === 'string' ? item.textLayerId.trim() : '';
            const shapeLayerId = typeof item.shapeLayerId === 'string' ? item.shapeLayerId.trim() : '';
            if (type !== 'shrink_shape_by_text_width' || !textLayerId || !shapeLayerId) return null;

            return {
                id: typeof item.id === 'string' && item.id.trim()
                    ? item.id.trim()
                    : `template_fn_${Math.random().toString(36).slice(2, 10)}`,
                name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Shape metne gore kisalsin',
                type,
                enabled: item.enabled !== false,
                textLayerId,
                shapeLayerId,
                targetProperty: ['auto', 'height', 'width'].includes(item.targetProperty) ? item.targetProperty : 'auto',
                baseSize: Math.max(1, Math.round(studioEngineNormalizeNumber(item.baseSize, 1))),
                minSize: Math.max(1, Math.round(studioEngineNormalizeNumber(item.minSize, 1))),
                gap: Math.max(0, Math.round(studioEngineNormalizeNumber(item.gap, 0)))
            };
        })
        .filter(Boolean);
}

function studioEngineGetTemplateFunctions() {
    return studioEngineClone(templateFunctions || []);
}

function studioEngineSetTemplateFunctions(value, options = {}) {
    templateFunctions = studioEngineNormalizeTemplateFunctions(value);

    if (options.commitHistory !== false && !options.skipHistory && typeof commitHistory === 'function') {
        commitHistory();
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studio:template-functions-changed', {
            detail: {
                templateFunctions: studioEngineGetTemplateFunctions()
            }
        }));
    }

    return studioEngineGetTemplateFunctions();
}

function studioEngineDispatchTemplateFunctionsEvent(results = []) {
    if (!Array.isArray(templateFunctions) || !templateFunctions.length || typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent('studio:layers-changed', {
        detail: {
            revision: window.StudioEngineSession.getRevision(),
            applied: studioEngineClone(results),
            templateFunctions: studioEngineGetTemplateFunctions()
        }
    }));
}

function studioEngineGetChildLayerIds(groupId) {
    return layers
        .filter(layer => layer.parentId === groupId)
        .map(layer => layer.id);
}

function studioEngineGetDescendantLayerIds(groupId) {
    const output = [];
    const visit = id => {
        studioEngineGetChildLayerIds(id).forEach(childId => {
            output.push(childId);
            const child = layers.find(layer => layer.id === childId);
            if (child?.type === 'group') visit(childId);
        });
    };
    visit(groupId);
    return output;
}

function studioEngineNormalizeImportedLayer(layer = {}, index = 0) {
    if (!layer || typeof layer !== 'object') return null;
    const normalized = studioEngineCreateLayer({
        ...layer,
        id: typeof layer.id === 'string' && layer.id.trim() ? layer.id.trim() : studioEngineGenerateLayerId()
    });
    if (!normalized) return null;
    normalized.z = index + 1;
    return normalized;
}

function studioEngineNormalizeSelection(ids = []) {
    const existing = new Set(layers.map(layer => layer.id));
    const seen = new Set();
    return (Array.isArray(ids) ? ids : [ids])
        .filter(id => typeof id === 'string' && existing.has(id))
        .filter(id => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
}

function studioEngineSetSelection(ids = [], anchorId = null) {
    selectedIds = studioEngineNormalizeSelection(ids);
    selectedId = selectedIds.at(-1) || null;
    layerSelectionAnchorId = anchorId && selectedIds.includes(anchorId)
        ? anchorId
        : (selectedId || null);
}

function studioEngineCreateLayer(payload = {}) {
    const type = payload.type;
    if (!['text', 'shape', 'raster', 'group'].includes(type)) return null;

    const defaults = {
        group: {
            name: 'Group',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            children: []
        },
        text: {
            name: 'Text Layer',
            x: 120,
            y: 120,
            width: 300,
            height: 120,
            text: 'Yeni metin',
            color: cwFgColor,
            fontSize: 42,
            fontWeight: 400,
            fontStyle: 'normal',
            textAlign: 'left',
            textDecoration: 'none',
            fontFamily: 'Inter'
        },
        shape: {
            name: 'Shape Layer',
            x: 160,
            y: 160,
            width: 240,
            height: 240,
            fill: cwFgColor,
            shapeType: 'rect',
            aspectLocked: true,
            radius: 0
        },
        raster: {
            name: 'Raster Layer',
            x: 0,
            y: 0,
            width: 400,
            height: 400,
            src: null,
            aspectLocked: true,
            canvasData: null
        }
    };

    const layer = {
        id: typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : studioEngineGenerateLayerId(),
        type,
        rotation: studioEngineNormalizeNumber(payload.rotation, 0),
        opacity: Math.max(0, Math.min(1, studioEngineNormalizeNumber(payload.opacity, 1))),
        visible: payload.visible !== false,
        locked: payload.locked === true,
        z: layers.length + 1,
        radius: Math.max(0, studioEngineNormalizeNumber(payload.radius, defaults[type].radius || 0)),
        layerStyle: studioEngineNormalizeLayerStyle(payload.layerStyle),
        ...defaults[type],
        ...payload
    };

    if (type === 'text') {
        layer.text = typeof layer.text === 'string' ? layer.text : 'Yeni metin';
        layer.verticalAlign = ['top', 'middle', 'bottom'].includes(layer.verticalAlign) ? layer.verticalAlign : 'top';
        layer.autoFitText = layer.autoFitText !== false;
    }

    return layer;
}

function studioEngineRenderAndCommit(options = {}) {
    normalizeZ();
    if (options.render !== false && typeof render === 'function') render();
    if (options.render !== false && typeof refreshInspectorFlyoutIfNeeded === 'function') refreshInspectorFlyoutIfNeeded();

    if (options.commitHistory !== false && typeof commitHistory === 'function') {
        commitHistory();
    }
}

function studioEngineApplyAddLayer(command) {
    const sourceLayer = command.layer || {};
    const layer = studioEngineCreateLayer(sourceLayer);
    if (!layer) throw new Error('Gecersiz add_layer payload.');

    layers.push(layer);
    studioEngineSetSelection([layer.id], layer.id);

    const hasExplicitTextBox = sourceLayer.width !== undefined || sourceLayer.height !== undefined;
    if (layer.type === 'text' && !hasExplicitTextBox && typeof syncTextLayerSize === 'function') {
        syncTextLayerSize(layer.id, layer.text || '');
    }

    return {
        action: 'add_layer',
        targetId: layer.id
    };
}

function studioEngineApplyUpdateLayer(command) {
    const layer = window.StudioEngineTargets.resolveLayer(command.target);
    if (!layer) throw new Error('Hedef katman bulunamadi.');

    const patch = command.patch && typeof command.patch === 'object' ? { ...command.patch } : {};
    if (patch.layerStyle) {
        patch.layerStyle = studioEngineNormalizeLayerStyle(patch.layerStyle);
    }
    Object.assign(layer, patch);

    if (layer.type === 'text' && typeof syncTextLayerSize === 'function' && command.autoFitText !== false && layer.autoFitText !== false && (layer.verticalAlign || 'top') === 'top') {
        syncTextLayerSize(layer.id, layer.text || '');
    }

    return {
        action: 'update_layer',
        targetId: layer.id
    };
}

function studioEngineApplyCommitCanvas(command) {
    const layer = window.StudioEngineTargets.resolveLayer(command.target);
    if (!layer) throw new Error('Hedef katman bulunamadi.');
    if (layer.type !== 'raster') throw new Error('Canvas islemi sadece raster katmana uygulanabilir.');

    const canvasData = typeof command.canvasData === 'string' && command.canvasData.trim()
        ? command.canvasData
        : '';
    if (!canvasData) throw new Error('Canvas verisi bos olamaz.');

    layer.canvasData = canvasData;
    if (command.src !== undefined) {
        layer.src = command.src || null;
    }

    return {
        action: 'commit_canvas',
        targetId: layer.id
    };
}

function studioEngineApplyMoveLayer(command) {
    const layer = window.StudioEngineTargets.resolveLayer(command.target);
    if (!layer) throw new Error('Hedef katman bulunamadi.');

    layer.x = Math.round((Number(layer.x) || 0) + studioEngineNormalizeNumber(command.dx, 0));
    layer.y = Math.round((Number(layer.y) || 0) + studioEngineNormalizeNumber(command.dy, 0));

    return {
        action: 'move_layer',
        targetId: layer.id
    };
}

function studioEngineApplyResizeLayer(command) {
    const layer = window.StudioEngineTargets.resolveLayer(command.target);
    if (!layer) throw new Error('Hedef katman bulunamadi.');

    if (command.width !== undefined) {
        layer.width = Math.max(1, Math.round(studioEngineNormalizeNumber(command.width, layer.width)));
    }
    if (command.height !== undefined) {
        layer.height = Math.max(1, Math.round(studioEngineNormalizeNumber(command.height, layer.height)));
    }

    if (layer.type === 'text' && typeof syncTextLayerSize === 'function' && command.autoFitText) {
        syncTextLayerSize(layer.id, layer.text || '');
    }

    return {
        action: 'resize_layer',
        targetId: layer.id
    };
}

function studioEngineApplyRemoveLayer(command) {
    const targetId = window.StudioEngineTargets.resolveTargetId(command.target);
    if (!targetId) throw new Error('Hedef katman bulunamadi.');

    const removeIds = new Set([targetId, ...studioEngineGetDescendantLayerIds(targetId)]);
    layers = layers.filter(layer => !removeIds.has(layer.id));
    layers.forEach(layer => {
        if (removeIds.has(layer.parentId)) delete layer.parentId;
    });
    studioEngineSetSelection(selectedIds.filter(id => !removeIds.has(id)));
    if (!selectedId && layers.length) studioEngineSetSelection([layers.at(-1).id]);

    return {
        action: 'remove_layer',
        targetId
    };
}

function studioEngineApplyRemoveLayers(command) {
    const targetIds = studioEngineNormalizeSelection(command.targets || command.target || []);
    if (!targetIds.length) throw new Error('Silinecek katman bulunamadi.');

    const removeSet = new Set(targetIds);
    targetIds.forEach(id => {
        studioEngineGetDescendantLayerIds(id).forEach(childId => removeSet.add(childId));
    });
    layers = layers.filter(layer => !removeSet.has(layer.id));
    layers.forEach(layer => {
        if (removeSet.has(layer.parentId)) delete layer.parentId;
    });
    studioEngineSetSelection(selectedIds.filter(id => !removeSet.has(id)));
    if (!selectedId && layers.length) studioEngineSetSelection([layers.at(-1).id]);

    return {
        action: 'remove_layers',
        targetId: selectedId,
        targetIds
    };
}

function studioEngineApplyGroupLayers(command) {
    const targetIds = studioEngineNormalizeSelection(command.targets || command.target || selectedIds || [])
        .filter(id => {
            const layer = layers.find(item => item.id === id);
            return layer && layer.type !== 'group' && !layer.parentId;
        });
    if (targetIds.length < 2) throw new Error('Grup icin en az iki katman sec.');

    const targetSet = new Set(targetIds);
    const topIndex = Math.max(...targetIds.map(id => layers.findIndex(layer => layer.id === id)));
    const group = studioEngineCreateLayer({
        id: typeof command.id === 'string' && command.id.trim() ? command.id.trim() : studioEngineGenerateLayerId(),
        type: 'group',
        name: typeof command.name === 'string' && command.name.trim() ? command.name.trim() : 'Group',
        children: targetIds
    });
    if (!group) throw new Error('Grup olusturulamadi.');

    layers.forEach(layer => {
        if (targetSet.has(layer.id)) layer.parentId = group.id;
    });

    layers.splice(topIndex + 1, 0, group);
    studioEngineSetSelection([group.id], group.id);

    return {
        action: 'group_layers',
        targetId: group.id,
        targetIds
    };
}

function studioEngineApplyUngroupLayer(command) {
    const group = window.StudioEngineTargets.resolveLayer(command.target || selectedId);
    if (!group || group.type !== 'group') throw new Error('Hedef grup bulunamadi.');

    const childIds = studioEngineGetChildLayerIds(group.id);
    layers.forEach(layer => {
        if (layer.parentId === group.id) delete layer.parentId;
    });
    layers = layers.filter(layer => layer.id !== group.id);
    studioEngineSetSelection(childIds, childIds.at(-1));

    return {
        action: 'ungroup_layer',
        targetId: childIds.at(-1) || null,
        targetIds: childIds
    };
}

function studioEngineApplyMoveToGroup(command) {
    const layer = window.StudioEngineTargets.resolveLayer(command.target);
    if (!layer) throw new Error('Hedef katman bulunamadi.');
    if (layer.type === 'group') throw new Error('Grup baska bir gruba tasinamaz.');

    const groupId = command.groupId || command.parentId || null;
    if (layer.parentId) {
        const oldGroup = layers.find(item => item.id === layer.parentId);
        if (Array.isArray(oldGroup?.children)) {
            oldGroup.children = oldGroup.children.filter(id => id !== layer.id);
        }
    }

    if (!groupId) {
        delete layer.parentId;
        return {
            action: 'move_to_group',
            targetId: layer.id,
            groupId: null
        };
    }

    const group = window.StudioEngineTargets.resolveLayer(groupId);
    if (!group || group.type !== 'group') throw new Error('Hedef grup bulunamadi.');

    layer.parentId = group.id;
    if (!Array.isArray(group.children)) group.children = [];
    if (!group.children.includes(layer.id)) group.children.push(layer.id);

    return {
        action: 'move_to_group',
        targetId: layer.id,
        groupId: group.id
    };
}

function studioEngineApplySelectLayer(command) {
    const targetId = window.StudioEngineTargets.resolveTargetId(command.target);
    if (!targetId) throw new Error('Hedef katman bulunamadi.');
    studioEngineSetSelection([targetId], targetId);
    return {
        action: 'select_layer',
        targetId
    };
}

function studioEngineApplySelectLayers(command) {
    const targetIds = studioEngineNormalizeSelection(command.targets || command.target || []);
    if (!targetIds.length) throw new Error('Hedef katman bulunamadi.');
    studioEngineSetSelection(targetIds, command.anchorId || targetIds.at(-1));
    return {
        action: 'select_layers',
        targetId: selectedId,
        targetIds
    };
}

function studioEngineApplyClearSelection() {
    studioEngineSetSelection([]);
    return {
        action: 'clear_selection',
        targetId: null
    };
}

function studioEngineApplyToggleVisibility(command) {
    const layer = window.StudioEngineTargets.resolveLayer(command.target);
    if (!layer) throw new Error('Hedef katman bulunamadi.');
    layer.visible = typeof command.visible === 'boolean' ? command.visible : !layer.visible;
    return {
        action: 'toggle_visibility',
        targetId: layer.id
    };
}

function studioEngineApplyToggleLock(command) {
    const layer = window.StudioEngineTargets.resolveLayer(command.target);
    if (!layer) throw new Error('Hedef katman bulunamadi.');
    layer.locked = typeof command.locked === 'boolean' ? command.locked : !layer.locked;
    return {
        action: 'toggle_lock',
        targetId: layer.id
    };
}

function studioEngineApplyReorderLayer(command) {
    const targetId = window.StudioEngineTargets.resolveTargetId(command.target);
    if (!targetId) throw new Error('Hedef katman bulunamadi.');

    const currentIndex = layers.findIndex(layer => layer.id === targetId);
    if (currentIndex === -1) throw new Error('Hedef katman bulunamadi.');

    const [layer] = layers.splice(currentIndex, 1);
    let nextIndex = currentIndex;

    if (typeof command.toIndex === 'number') {
        nextIndex = Math.max(0, Math.min(layers.length, Math.round(command.toIndex)));
    } else if (command.position === 'front') {
        nextIndex = layers.length;
    } else if (command.position === 'back') {
        nextIndex = 0;
    }

    layers.splice(nextIndex, 0, layer);

    return {
        action: 'reorder_layer',
        targetId
    };
}

function studioEngineApplyReorderLayers(command) {
    const order = Array.isArray(command.order) ? command.order : [];
    if (!order.length) throw new Error('Yeni katman sirasi bos olamaz.');

    const nextLayers = order
        .map(id => layers.find(layer => layer.id === id))
        .filter(Boolean);

    if (nextLayers.length !== layers.length) {
        throw new Error('Katman sirasi eksik veya gecersiz.');
    }

    layers = nextLayers;

    return {
        action: 'reorder_layers',
        targetId: null
    };
}

function studioEngineApplyReplaceLayers(command) {
    const sourceLayers = Array.isArray(command.layers) ? command.layers : [];
    const nextLayers = sourceLayers.length
        ? sourceLayers.map(studioEngineNormalizeImportedLayer).filter(Boolean)
        : [];

    layers = nextLayers;
    studioEngineSetSelection(command.selectedIds || (command.selectedId ? [command.selectedId] : []));

    layers.forEach((layer, index) => {
        const sourceLayer = sourceLayers[index] || {};
        const hasExplicitTextBox = sourceLayer.width !== undefined || sourceLayer.height !== undefined;
        if (layer.type === 'text' && !hasExplicitTextBox && typeof syncTextLayerSize === 'function') {
            syncTextLayerSize(layer.id, layer.text || '');
        }
    });

    return {
        action: 'replace_layers',
        targetId: selectedId
    };
}

function studioEngineApplyCommand(command) {
    if (!command || typeof command !== 'object') {
        throw new Error('Komut nesnesi gecersiz.');
    }

    switch (command.action) {
        case 'add_layer':
            return studioEngineApplyAddLayer(command);
        case 'update_layer':
        case 'style_layer':
            return studioEngineApplyUpdateLayer(command);
        case 'commit_canvas':
            return studioEngineApplyCommitCanvas(command);
        case 'move_layer':
            return studioEngineApplyMoveLayer(command);
        case 'resize_layer':
            return studioEngineApplyResizeLayer(command);
        case 'remove_layer':
            return studioEngineApplyRemoveLayer(command);
        case 'remove_layers':
            return studioEngineApplyRemoveLayers(command);
        case 'group_layers':
            return studioEngineApplyGroupLayers(command);
        case 'ungroup_layer':
            return studioEngineApplyUngroupLayer(command);
        case 'move_to_group':
            return studioEngineApplyMoveToGroup(command);
        case 'select_layer':
            return studioEngineApplySelectLayer(command);
        case 'select_layers':
            return studioEngineApplySelectLayers(command);
        case 'clear_selection':
            return studioEngineApplyClearSelection(command);
        case 'toggle_visibility':
            return studioEngineApplyToggleVisibility(command);
        case 'toggle_lock':
            return studioEngineApplyToggleLock(command);
        case 'reorder_layer':
            return studioEngineApplyReorderLayer(command);
        case 'reorder_layers':
            return studioEngineApplyReorderLayers(command);
        case 'replace_layers':
            return studioEngineApplyReplaceLayers(command);
        default:
            throw new Error(`Bilinmeyen action: ${command.action}`);
    }
}

function studioEngineApplyCommands(commands, options = {}) {
    const list = Array.isArray(commands) ? commands : [];
    const results = [];
    const errors = [];

    list.forEach((command, index) => {
        try {
            results.push(studioEngineApplyCommand(command));
        } catch (error) {
            errors.push({
                index,
                action: command?.action || 'unknown',
                message: error.message
            });
        }
    });

    if (results.length) {
        window.StudioEngineSession.bumpRevision();
        studioEngineRenderAndCommit(options);
        studioEngineDispatchTemplateFunctionsEvent(results);
    }

    return {
        ok: errors.length === 0,
        revision: window.StudioEngineSession.getRevision(),
        applied: results,
        errors,
        context: options.includeContext === false
            ? undefined
            : window.StudioEngineSession.getContext({ level: options.contextLevel || 'index' })
    };
}

function studioEngineNormalizePayload(input) {
    if (typeof input === 'string') {
        return studioEngineNormalizePayload(JSON.parse(input));
    }

    if (Array.isArray(input)) {
        return { commands: input };
    }

    return input && typeof input === 'object' ? input : {};
}

function studioEngineGetProjectPayload(options = {}) {
    const includeLegacyFields = options.includeLegacyFields === true;
    const payload = {
        type: 'alcatraz.studio.project',
        version: 1,
        engineVersion: STUDIO_ENGINE_VERSION,
        projectName,
        canvas: {
            width: canvasWidth,
            height: canvasHeight
        },
        selection: {
            selectedId,
            selectedIds: studioEngineClone(selectedIds || [])
        },
        layers: studioEngineClone(layers)
    };

    const projectTemplateFunctions = studioEngineGetTemplateFunctions();
    if (projectTemplateFunctions.length) {
        payload.templateFunctions = projectTemplateFunctions;
    }

    if (includeLegacyFields) {
        payload.canvasWidth = canvasWidth;
        payload.canvasHeight = canvasHeight;
        payload.selectedId = selectedId;
        payload.selectedIds = studioEngineClone(selectedIds || []);
    }

    return payload;
}

function studioEngineApplyPayload(input, options = {}) {
    const payload = studioEngineNormalizePayload(input);
    const width = payload.canvas?.width || payload.canvasWidth;
    const height = payload.canvas?.height || payload.canvasHeight;
    const selectedLayerIds = Array.isArray(payload.selection?.selectedIds)
        ? payload.selection.selectedIds
        : payload.selectedIds;
    const shouldReplaceLayers = options.reset !== false || Array.isArray(payload.layers);
    let result = null;

    if (typeof payload.projectName === 'string' && payload.projectName.trim()) {
        projectName = payload.projectName.trim();
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'templateFunctions')) {
        templateFunctions = studioEngineNormalizeTemplateFunctions(payload.templateFunctions);
    } else if (options.reset === true && Array.isArray(payload.layers)) {
        templateFunctions = [];
    }

    if (width && height) {
        setCanvasSize(width, height);
    }

    if (shouldReplaceLayers) {
        result = studioEngineApplyCommands([{
            action: 'replace_layers',
            layers: Array.isArray(payload.layers) ? payload.layers : [],
            selectedIds: Array.isArray(selectedLayerIds) ? selectedLayerIds : [],
            selectedId: payload.selection?.selectedId || payload.selectedId || null
        }], options);
    }

    if (Array.isArray(payload.commands) && payload.commands.length) {
        result = studioEngineApplyCommands(payload.commands, options);
    }

    if (!result) {
        result = {
            ok: true,
            revision: window.StudioEngineSession.getRevision(),
            applied: [],
            errors: [],
            context: options.includeContext === false
                ? undefined
                : window.StudioEngineSession.getContext({ level: options.contextLevel || 'index' })
        };
    }

    return {
        ...result,
        project: {
            projectName,
            canvas: {
                width: canvasWidth,
                height: canvasHeight
            },
            layers: studioEngineClone(layers)
        }
    };
}

function studioEngineLoadProject(input, options = {}) {
    return studioEngineApplyPayload(input, {
        reset: true,
        render: options.render !== false,
        commitHistory: !options.skipHistory,
        includeContext: options.includeContext,
        contextLevel: options.contextLevel
    });
}

window.StudioEngineCommands = {
    applyCommands: studioEngineApplyCommands,
    applyCommand(command, options = {}) {
        return studioEngineApplyCommands([command], options);
    },
    applyPayload: studioEngineApplyPayload,
    getProjectPayload: studioEngineGetProjectPayload,
    loadProject: studioEngineLoadProject,
    getTemplateFunctions: studioEngineGetTemplateFunctions,
    setTemplateFunctions: studioEngineSetTemplateFunctions
};

window.StudioEngine = {
    version: STUDIO_ENGINE_VERSION,
    startSession(options = {}) {
        return window.StudioEngineSession.start(options);
    },
    getContext(options = {}) {
        return window.StudioEngineSession.getContext(options);
    },
    resolveTarget(target) {
        return window.StudioEngineTargets.resolveTargetId(target);
    },
    applyCommands(commands, options = {}) {
        return window.StudioEngineCommands.applyCommands(commands, options);
    },
    applyCommand(command, options = {}) {
        return window.StudioEngineCommands.applyCommand(command, options);
    },
    applyPayload(payload, options = {}) {
        return window.StudioEngineCommands.applyPayload(payload, options);
    },
    run(payload, options = {}) {
        return window.StudioEngineCommands.applyPayload(payload, options);
    },
    getProject(options = {}) {
        return window.StudioEngineCommands.getProjectPayload(options);
    },
    exportProject(options = {}) {
        return window.StudioEngineCommands.getProjectPayload(options);
    },
    getTemplateFunctions() {
        return window.StudioEngineCommands.getTemplateFunctions();
    },
    setTemplateFunctions(value, options = {}) {
        return window.StudioEngineCommands.setTemplateFunctions(value, options);
    },
    loadProject(payload, options = {}) {
        return window.StudioEngineCommands.loadProject(payload, options);
    },
    hydrateProject(data, options = {}) {
        return window.StudioEngineState.hydrateProject(data, options);
    },
    createNewProject(payload, options = {}) {
        return window.StudioEngineState.createNewProject(payload, options);
    }
};
