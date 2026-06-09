// ── Tool system ────────────────────────────────────────────────────────────
const SELECTION_TOOL_KEYS = ['select-rect', 'select-ellipse', 'select-lasso'];
const SHAPE_TOOL_KEYS = ['shape', 'shape-rounded', 'shape-circle', 'shape-triangle', 'shape-hexagon'];
const FILL_TOOL_KEYS = ['bucket', 'gradient'];
const MOBILE_TOOLS_FAB_TOP_KEY = 'alcatraz_studio_mobile_tools_fab_top';
const MOBILE_TOOLS_FAB_POSITION_KEY = 'alcatraz_studio_mobile_tools_fab_position';
const STUDIO_TOOLS = [
    {
        key: 'move',
        label: 'Seç / Taşı',
        icon: 'fa-arrow-pointer',
        group: 'select',
        cursor: 'default',
        shortcut: 'V',
        contextBarType: 'transform',
        action: null,
        capabilities: {
            canSelect: true,
            canMove: true,
            canResize: true,
            canRotate: true,
            worksOn: ['shape', 'text', 'image']
        }
    },
    {
        key: 'select-rect',
        label: 'Kare Seçim',
        icon: 'fa-regular fa-square',
        group: 'select',
        cursor: 'crosshair',
        shortcut: null,
        contextBarType: 'draw-props',
        action: null,
        capabilities: {
            selectsArea: true,
            worksOn: ['raster'],
            contextBarProps: []
        }
    },
    {
        key: 'select-ellipse',
        label: 'Oval Seçim',
        icon: 'fa-regular fa-circle',
        group: 'select',
        cursor: 'crosshair',
        shortcut: null,
        contextBarType: 'draw-props',
        action: null,
        capabilities: {
            selectsArea: true,
            worksOn: ['raster'],
            contextBarProps: []
        }
    },
    {
        key: 'select-lasso',
        label: 'Lasso',
        icon: 'fa-solid fa-draw-polygon',
        group: 'select',
        cursor: 'crosshair',
        shortcut: null,
        contextBarType: 'draw-props',
        action: null,
        capabilities: {
            selectsArea: true,
            worksOn: ['raster'],
            contextBarProps: []
        }
    },
    {
        key: 'text',
        label: 'Metin Ekle',
        icon: 'fa-font',
        group: 'add',
        cursor: 'text',
        shortcut: 'T',
        contextBarType: 'layer-props',
        action: null,
        capabilities: {
            creates: 'text',
            canInlineEdit: true,
            worksOn: ['text'],
            contextBarProps: ['fontFamily', 'fontWeight', 'fontSize', 'textAlign', 'verticalAlign', 'textDecoration']
        }
    },
    {
        key: 'shape',
        label: 'Kare',
        icon: 'fa-solid fa-square',
        group: 'add',
        cursor: 'crosshair',
        shortcut: 'H',
        contextBarType: 'layer-props',
        action: null,
        capabilities: {
            creates: 'shape',
            shapeType: 'rect',
            worksOn: ['shape'],
            contextBarProps: ['radius', 'opacity']
        }
    },
    {
        key: 'shape-rounded',
        label: 'Radiuslu Kare',
        icon: 'fa-solid fa-square',
        group: 'add',
        cursor: 'crosshair',
        shortcut: null,
        contextBarType: 'layer-props',
        action: null,
        capabilities: {
            creates: 'shape',
            shapeType: 'rounded-rect',
            worksOn: ['shape'],
            contextBarProps: ['radius', 'opacity']
        }
    },
    {
        key: 'shape-circle',
        label: 'Yuvarlak',
        icon: 'fa-solid fa-circle',
        group: 'add',
        cursor: 'crosshair',
        shortcut: null,
        contextBarType: 'layer-props',
        action: null,
        capabilities: {
            creates: 'shape',
            shapeType: 'circle',
            worksOn: ['shape'],
            contextBarProps: ['opacity']
        }
    },
    {
        key: 'shape-triangle',
        label: 'Ucgen',
        icon: 'fa-solid fa-play',
        group: 'add',
        cursor: 'crosshair',
        shortcut: null,
        contextBarType: 'layer-props',
        action: null,
        capabilities: {
            creates: 'shape',
            shapeType: 'triangle',
            worksOn: ['shape'],
            contextBarProps: ['opacity']
        }
    },
    {
        key: 'shape-hexagon',
        label: 'Altigen',
        icon: 'fa-solid fa-stop',
        group: 'add',
        cursor: 'crosshair',
        shortcut: null,
        contextBarType: 'layer-props',
        action: null,
        capabilities: {
            creates: 'shape',
            shapeType: 'hexagon',
            worksOn: ['shape'],
            contextBarProps: ['opacity']
        }
    },
    {
        key: 'image',
        label: 'Görsel Ekle',
        icon: 'fa-regular fa-image',
        group: 'add',
        cursor: 'default',
        shortcut: 'I',
        contextBarType: 'layer-props',
        action: 'openImagePicker',
        capabilities: {
            creates: 'raster',
            worksOn: ['raster'],
            contextBarProps: ['radius', 'opacity'],
            acceptsFiles: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
        }
    },
    {
        key: 'eyedropper',
        label: 'Renk Damlalığı',
        icon: 'fa-eye-dropper',
        group: 'select',
        cursor: 'crosshair',
        shortcut: 'O',
        contextBarType: 'eyedropper',
        action: null,
        capabilities: {
            picksColor: true,
            worksOn: ['shape', 'text', 'raster'],
            usesColor: 'fg'
        }
    },
    {
        key: 'brush',
        label: 'Fırça',
        icon: 'fa-paintbrush',
        group: 'draw',
        cursor: 'none',
        shortcut: 'B',
        contextBarType: 'draw-props',
        action: null,
        capabilities: {
            drawsOnCanvas: true,
            worksOn: ['raster'],
            contextBarProps: ['brushSize', 'hardness', 'opacity'],
            usesColor: 'fg'
        }
    },
    {
        key: 'eraser',
        label: 'Silgi',
        icon: 'fa-eraser',
        group: 'draw',
        cursor: 'none',
        shortcut: 'E',
        contextBarType: 'draw-props',
        action: null,
        capabilities: {
            erasesPixels: true,
            worksOn: ['raster'],
            contextBarProps: ['brushSize', 'eraserMode'],
            modes: ['pixel', 'layer']
        }
    },
    {
        key: 'bucket',
        label: 'Boya Kovası',
        icon: 'fa-fill-drip',
        group: 'draw',
        cursor: 'crosshair',
        shortcut: 'G',
        contextBarType: 'draw-props',
        action: null,
        capabilities: {
            fillsArea: true,
            worksOn: ['raster'],
            contextBarProps: ['tolerance', 'contiguous'],
            usesColor: 'fg'
        }
    },
    {
        key: 'gradient',
        label: 'Gradient',
        icon: 'fa-swatchbook',
        group: 'draw',
        cursor: 'crosshair',
        shortcut: null,
        contextBarType: 'draw-props',
        action: null,
        capabilities: {
            fillsArea: true,
            worksOn: ['raster'],
            contextBarProps: [],
            usesColor: 'both'
        }
    },
    {
        key: 'blur',
        label: 'Blur',
        icon: 'fa-droplet',
        group: 'draw',
        cursor: 'none',
        shortcut: null,
        contextBarType: 'draw-props',
        action: null,
        capabilities: {
            blursPixels: true,
            worksOn: ['raster'],
            contextBarProps: ['brushSize', 'blurStrength']
        }
    }
];
let toolbarSubmenuEl = null;
let mobileToolsFabDrag = null;
let mobileToolsFabSuppressClick = false;

function isSelectionToolKey(toolKey) {
    return SELECTION_TOOL_KEYS.includes(toolKey);
}

function isShapeToolKey(toolKey) {
    return SHAPE_TOOL_KEYS.includes(toolKey);
}

function isFillToolKey(toolKey) {
    return FILL_TOOL_KEYS.includes(toolKey);
}

function closeToolbarSubmenu() {
    if (toolbarSubmenuEl) {
        toolbarSubmenuEl.remove();
        toolbarSubmenuEl = null;
    }
}

function openToolMenu(anchorBtn, toolKeys) {
    closeToolbarSubmenu();

    const tools = allTools.filter(tool => toolKeys.includes(tool.key));
    if (!tools.length || !anchorBtn) return;

    const rect = anchorBtn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'tool-submenu';
    menu.innerHTML = tools.map(tool => {
        const iconClass = tool.icon.includes(' ') ? tool.icon : `fa-solid ${tool.icon}`;
        return `
            <button class="tool-submenu-item ${currentTool === tool.key ? 'active' : ''}" type="button" data-tool="${tool.key}" title="${tool.label}" aria-label="${tool.label}">
                <i class="${iconClass}"></i>
            </button>
        `;
    }).join('');

    menu.style.left = `${rect.right + 10}px`;
    menu.style.top = `${rect.top}px`;

    menu.addEventListener('click', event => {
        const button = event.target.closest('[data-tool]');
        if (!button) return;
        selectTool(button.dataset.tool);
        closeToolbarSubmenu();
    });

    document.body.appendChild(menu);
    toolbarSubmenuEl = menu;
}

function buildGroupedToolButton({ toolbar, anchor, activeToolKey, groupKey, title, toolKeys }) {
    const activeTool = allTools.find(item => item.key === activeToolKey) || allTools.find(item => item.key === toolKeys[0]);
    if (!activeTool) return;

    const group = document.createElement('div');
    group.className = 'tool-btn-group';
    group.dataset.dynamic = 'true';

    const groupBtn = document.createElement('button');
    groupBtn.className = 'tool-btn';
    groupBtn.dataset.tool = groupKey;
    groupBtn.title = title;
    const activeIconClass = activeTool.icon.includes(' ') ? activeTool.icon : `fa-solid ${activeTool.icon}`;
    groupBtn.innerHTML = `<i class="${activeIconClass}"></i><span class="tool-btn-badge"><i class="fa-solid fa-caret-right"></i></span>`;
    if (toolKeys.includes(currentTool)) {
        groupBtn.classList.add('active');
    }
    groupBtn.onclick = () => selectTool(activeTool.key);
    groupBtn.oncontextmenu = event => {
        event.preventDefault();
        openToolMenu(groupBtn, toolKeys);
    };

    group.appendChild(groupBtn);
    toolbar.insertBefore(group, anchor);
}

function loadTools() {
    allTools = STUDIO_TOOLS.map(tool => ({
        ...tool,
        capabilities: {
            ...(tool.capabilities || {}),
            contextBarProps: [...(tool.capabilities?.contextBarProps || [])],
            worksOn: [...(tool.capabilities?.worksOn || [])],
            acceptsFiles: tool.capabilities?.acceptsFiles ? [...tool.capabilities.acceptsFiles] : undefined,
            modes: tool.capabilities?.modes ? [...tool.capabilities.modes] : undefined
        }
    }));
    renderToolbar();
    selectTool('move');
}

function renderToolbar() {
    const toolbar = document.querySelector('.shell.toolbar');
    const anchor = toolbar.querySelector('.toolbar-static-anchor');
    const oldDynamicNodes = toolbar.querySelectorAll('[data-dynamic="true"]');
    oldDynamicNodes.forEach(node => node.remove());
    closeToolbarSubmenu();

    const selectionTools = allTools.filter(tool => isSelectionToolKey(tool.key));
    const shapeTools = allTools.filter(tool => isShapeToolKey(tool.key));
    const fillTools = allTools.filter(tool => isFillToolKey(tool.key));
    const toolsToRender = allTools
        .filter(tool => !isSelectionToolKey(tool.key) && !isShapeToolKey(tool.key) && !isFillToolKey(tool.key))
        .sort((a, b) => {
            if (a.key === 'eyedropper') return 1;
            if (b.key === 'eyedropper') return -1;
            return 0;
        });

    toolsToRender.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'tool-btn';
        btn.dataset.tool = tool.key;
        btn.dataset.dynamic = 'true';
        btn.title = `${tool.label} ${tool.shortcut ? '(' + tool.shortcut + ')' : ''}`;
        const iconClass = tool.icon.includes(' ') ? tool.icon : `fa-solid ${tool.icon}`;
        btn.innerHTML = `<i class="${iconClass}"></i>`;
        if (currentTool === tool.key) {
            btn.classList.add('active');
        }
        btn.onclick = () => selectTool(tool.key);
        toolbar.insertBefore(btn, anchor);

        if (tool.key === 'move' && selectionTools.length) {
            buildGroupedToolButton({
                toolbar,
                anchor,
                activeToolKey: activeSelectionTool,
                groupKey: 'selection-group',
                title: 'Secim Araclari',
                toolKeys: SELECTION_TOOL_KEYS
            });
        }

        if (tool.key === 'text' && shapeTools.length) {
            buildGroupedToolButton({
                toolbar,
                anchor,
                activeToolKey: activeShapeTool,
                groupKey: 'shape-group',
                title: 'Sekil Araclari',
                toolKeys: SHAPE_TOOL_KEYS
            });
        }

        if (tool.key === 'image' && fillTools.length) {
            buildGroupedToolButton({
                toolbar,
                anchor,
                activeToolKey: activeFillTool,
                groupKey: 'fill-group',
                title: 'Doldurma Araclari',
                toolKeys: FILL_TOOL_KEYS
            });
        }
    });
    renderMobileToolsGrid();
    syncMobileToolsFabUi();
}

function getToolIconClass(tool) {
    return tool?.icon?.includes(' ') ? tool.icon : `fa-solid ${tool?.icon || 'fa-arrow-pointer'}`;
}

function getMobileToolsFabTop() {
    const saved = Number(localStorage.getItem(MOBILE_TOOLS_FAB_TOP_KEY));
    return Number.isFinite(saved) ? saved : 96;
}

function getMobileToolsFabPosition() {
    try {
        const parsed = JSON.parse(localStorage.getItem(MOBILE_TOOLS_FAB_POSITION_KEY) || 'null');
        if (parsed && Number.isFinite(Number(parsed.x)) && Number.isFinite(Number(parsed.y))) {
            return { x: Number(parsed.x), y: Number(parsed.y) };
        }
    } catch (_) {
        // Fall through to the legacy top-only value.
    }
    return { x: 10, y: getMobileToolsFabTop() };
}

function getCurrentMobileToolsFabPosition() {
    const rawLeft = workspaceShell?.style.getPropertyValue('--mobile-tools-fab-left') || '';
    const rawTop = workspaceShell?.style.getPropertyValue('--mobile-tools-fab-top') || '';
    const currentLeft = Number.parseFloat(rawLeft);
    const currentTop = Number.parseFloat(rawTop);
    if (Number.isFinite(currentLeft) && Number.isFinite(currentTop)) {
        return { x: currentLeft, y: currentTop };
    }
    return getMobileToolsFabPosition();
}

function clampMobileToolsFabPosition(position) {
    const workspaceRect = workspaceShell?.getBoundingClientRect?.();
    const width = workspaceRect?.width || window.innerWidth || 390;
    const height = workspaceRect?.height || window.innerHeight || 700;
    return {
        x: Math.min(Math.max(8, Number(position?.x) || 10), Math.max(8, width - 60)),
        y: Math.min(Math.max(58, Number(position?.y) || 96), Math.max(58, height - 64))
    };
}

function setMobileToolsFabPosition(position, shouldPersist = false) {
    if (!mobileToolsFab || !workspaceShell) return;
    const nextPosition = clampMobileToolsFabPosition(position);
    workspaceShell.style.setProperty('--mobile-tools-fab-left', `${nextPosition.x}px`);
    workspaceShell.style.setProperty('--mobile-tools-fab-top', `${nextPosition.y}px`);
    if (shouldPersist) {
        localStorage.setItem(MOBILE_TOOLS_FAB_POSITION_KEY, JSON.stringify({
            x: Math.round(nextPosition.x),
            y: Math.round(nextPosition.y)
        }));
    }
}

function renderMobileToolsGrid() {
    if (!mobileToolsGrid) return;
    mobileToolsGrid.innerHTML = allTools.map(tool => `
        <button class="mobile-tool-option ${currentTool === tool.key ? 'active' : ''}" type="button" data-tool="${tool.key}">
            <i class="${getToolIconClass(tool)}" aria-hidden="true"></i>
            <span>${tool.label}</span>
        </button>
    `).join('');
}

function syncMobileToolsFabUi() {
    if (!mobileToolsFab || !mobileToolsFabIcon) return;
    const isMobile = currentWorkspaceLayout?.shellStyle === 'mobile' || appShell?.classList.contains('ui-style-mobile');
    mobileToolsFab.hidden = !isMobile;

    const activeTool = allTools.find(tool => tool.key === currentTool) || allTools[0];
    mobileToolsFabIcon.className = getToolIconClass(activeTool);
    mobileToolsFab.title = activeTool ? `Araçlar: ${activeTool.label}` : 'Araçlar';
    mobileToolsFab.setAttribute('aria-label', mobileToolsFab.title);

    if (isMobile) {
        setMobileToolsFabPosition(getMobileToolsFabPosition(), false);
    }

    if (!mobileToolsGrid) return;
    mobileToolsGrid.querySelectorAll('.mobile-tool-option').forEach(button => {
        button.classList.toggle('active', button.dataset.tool === currentTool);
    });
}

function openMobileToolsModal() {
    if (!mobileToolsModal) return;
    renderMobileToolsGrid();
    mobileToolsModal.removeAttribute('hidden');
}

function closeMobileToolsModal() {
    mobileToolsModal?.setAttribute('hidden', '');
}

function initMobileToolsFab() {
    if (!mobileToolsFab) return;

    setMobileToolsFabPosition(getMobileToolsFabPosition(), false);

    mobileToolsFab.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;
        const rect = mobileToolsFab.getBoundingClientRect();
        const workspaceRect = workspaceShell?.getBoundingClientRect?.();
        mobileToolsFabDrag = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            workspaceLeft: workspaceRect?.left || 0,
            workspaceTop: workspaceRect?.top || 0,
            didMove: false
        };
        mobileToolsFab.classList.add('is-dragging');
        mobileToolsFab.setPointerCapture?.(event.pointerId);
    });

    mobileToolsFab.addEventListener('pointermove', event => {
        if (!mobileToolsFabDrag || mobileToolsFabDrag.pointerId !== event.pointerId) return;
        const delta = Math.hypot(
            event.clientX - mobileToolsFabDrag.startClientX,
            event.clientY - mobileToolsFabDrag.startClientY
        );
        if (delta > 4) {
            mobileToolsFabDrag.didMove = true;
            mobileToolsFabSuppressClick = true;
        }
        setMobileToolsFabPosition({
            x: event.clientX - mobileToolsFabDrag.workspaceLeft - mobileToolsFabDrag.offsetX,
            y: event.clientY - mobileToolsFabDrag.workspaceTop - mobileToolsFabDrag.offsetY
        }, false);
    });

    mobileToolsFab.addEventListener('pointerup', event => {
        if (!mobileToolsFabDrag || mobileToolsFabDrag.pointerId !== event.pointerId) return;
        const wasDragging = mobileToolsFabDrag.didMove;
        mobileToolsFabDrag = null;
        mobileToolsFab.classList.remove('is-dragging');
        mobileToolsFab.releasePointerCapture?.(event.pointerId);
        setMobileToolsFabPosition(getCurrentMobileToolsFabPosition(), true);
        if (wasDragging) {
            setTimeout(() => {
                mobileToolsFabSuppressClick = false;
            }, 0);
        }
    });

    mobileToolsFab.addEventListener('pointercancel', event => {
        if (!mobileToolsFabDrag || mobileToolsFabDrag.pointerId !== event.pointerId) return;
        mobileToolsFabDrag = null;
        mobileToolsFab.classList.remove('is-dragging');
        mobileToolsFabSuppressClick = false;
        setMobileToolsFabPosition(getCurrentMobileToolsFabPosition(), true);
    });

    mobileToolsFab.addEventListener('click', () => {
        if (mobileToolsFabSuppressClick) {
            mobileToolsFabSuppressClick = false;
            return;
        }
        openMobileToolsModal();
    });

    window.addEventListener('resize', () => {
        setMobileToolsFabPosition(getMobileToolsFabPosition(), true);
    });
}

mobileToolsModalClose?.addEventListener('click', closeMobileToolsModal);
mobileToolsModal?.addEventListener('click', event => {
    if (event.target === mobileToolsModal) closeMobileToolsModal();
});
mobileToolsGrid?.addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (!button) return;
    selectTool(button.dataset.tool);
    closeMobileToolsModal();
});

function selectTool(toolKey) {
    const config = allTools.find(t => t.key === toolKey);
    if (!config) return;
    const previousTool = currentTool;
    if (isSelectionToolKey(toolKey)) {
        activeSelectionTool = toolKey;
    }
    if (isShapeToolKey(toolKey)) {
        activeShapeTool = toolKey;
    }
    if (isFillToolKey(toolKey)) {
        activeFillTool = toolKey;
    }

    const shouldRerenderStage = toolKey !== 'move' && isTransformEditMode;
    if (shouldRerenderStage) {
        isTransformEditMode = false;
    }

    currentTool = toolKey;

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle(
            'active',
            btn.dataset.tool === toolKey ||
            (btn.dataset.tool === 'selection-group' && isSelectionToolKey(toolKey)) ||
            (btn.dataset.tool === 'shape-group' && isShapeToolKey(toolKey)) ||
            (btn.dataset.tool === 'fill-group' && isFillToolKey(toolKey))
        );
    });
    syncMobileToolsFabUi();
    closeToolbarSubmenu();

    if (typeof config.action === 'string' && typeof window[config.action] === 'function') {
        window[config.action]();
    }

    // Brush cursor göster/gizle
    if (config.key === 'brush' || config.key === 'eraser' || config.key === 'blur') {
        // Cursor none — custom cursor göster
        stage.style.cursor = 'none';
        stageWrap.classList.add('cursor-hidden');
        document.addEventListener('mousemove', updateBrushCursor);
    } else {
        hideBrushCursor();
        stage.style.cursor = config.cursor || 'default';
        stageWrap.classList.remove('cursor-hidden');
        document.removeEventListener('mousemove', updateBrushCursor);
    }

    // Eyedropper: canvas snapshot hazırla
    if (config.key === 'eyedropper') {
        startEyedropper();
    }

    if (shouldRerenderStage) {
        render();
        return;
    }

    if (previousTool === 'text' || toolKey === 'text') {
        render();
        renderToolbar();
        return;
    }

    if (
        isSelectionToolKey(toolKey) || isSelectionToolKey(previousTool) ||
        isShapeToolKey(toolKey) || isShapeToolKey(previousTool) ||
        isFillToolKey(toolKey) || isFillToolKey(previousTool)
    ) {
        renderToolbar();
    }
    renderContextBar();
}

window.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    const isEditingText = document.activeElement.isContentEditable ||
                          document.activeElement.closest('[contenteditable="true"]');
    if (isInput || isEditingText) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const key = e.key.toUpperCase();
    const targetTool = allTools.find(t => t.shortcut === key);
    if (targetTool) {
        e.preventDefault();
        selectTool(targetTool.key);
    }
});

document.addEventListener('mousedown', event => {
    if (!toolbarSubmenuEl) return;
    if (toolbarSubmenuEl.contains(event.target)) return;
    if (event.target.closest('.tool-btn-group')) return;
    closeToolbarSubmenu();
});

document.addEventListener('DOMContentLoaded', () => {
    initStudioTheme();
    initStudioWorkspace();
    initializeProjectState();
    loadTools();
    loadStudioPlugins();
    initMobileToolsFab();
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileToolsModal && !mobileToolsModal.hasAttribute('hidden')) {
        closeMobileToolsModal();
    }
});

canvasContextMenuEditBtn?.addEventListener('click', () => {
    closeCanvasContextMenu();
    openTransformEditMode();
});

canvasContextMenuPasteBtn?.addEventListener('click', async () => {
    closeCanvasContextMenu();
    await pasteFromClipboard();
});

canvasContextMenuClearSelectionBtn?.addEventListener('click', () => {
    closeCanvasContextMenu();
    clearRasterSelection();
});
