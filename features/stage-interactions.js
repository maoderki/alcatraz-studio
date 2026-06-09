function render() {
    window._eyedropperCanvas = null;
    renderStage();
    renderRasterSelectionOverlay();
    renderLayerList();
    renderContextBar();
    renderWorkspaceSwatchesWidget();
}

function canTransformSelectedLayer() {
    if (!selectedId) return false;
    const layer = getLayer(selectedId);
    if (!layer) return false;
    if (currentTool === 'move') return isTransformEditMode;
    if (currentTool === 'text' && layer.type === 'text') return true;
    return false;
}

function canDragSelectedLayer() {
    return currentTool === 'move' && !!selectedId;
}

function isEventInsideStageWrap(target) {
    return !!(target instanceof Element && target.closest('#stageWrap'));
}

function isEditablePasteContext(event) {
    if (isEditableEventTarget(event?.target) || isEditableEventTarget(document.activeElement)) {
        return true;
    }

    const selection = window.getSelection?.();
    const anchorNode = selection?.anchorNode || null;
    const focusNode = selection?.focusNode || null;
    return isEditableEventTarget(anchorNode) || isEditableEventTarget(focusNode);
}

function isIosDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = String(navigator.userAgent || navigator.vendor || '');
    return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

function isShareSupportedForFile(file) {
    if (!navigator?.share || !file) return false;
    if (typeof navigator.canShare !== 'function') return true;
    try {
        return navigator.canShare({ files: [file] });
    } catch (_) {
        return false;
    }
}

let exportPreviewObjectUrl = null;
let exportPreviewFile = null;
let exportPreviewFilename = '';

let drawingSession = null;
let lastDrawingEndTime = 0;
let mobileContextMenuLongPress = null;
let suppressStageClickAfterLongPress = false;

function closeExportPreviewModal() {
    exportPreviewModal?.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (exportPreviewObjectUrl) {
        URL.revokeObjectURL(exportPreviewObjectUrl);
        exportPreviewObjectUrl = null;
    }
    exportPreviewFile = null;
    exportPreviewFilename = '';
    exportPreviewImage?.removeAttribute('src');
}

async function shareExportedFile(file) {
    if (!isShareSupportedForFile(file)) return false;
    try {
        await navigator.share({
            files: [file],
            title: file.name
        });
        return true;
    } catch (_) {
        return false;
    }
}

function downloadExportedFile(file, filename) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openExportPreviewModal(file, filename) {
    if (!exportPreviewModal || !exportPreviewImage) {
        downloadExportedFile(file, filename);
        return;
    }

    if (exportPreviewObjectUrl) {
        URL.revokeObjectURL(exportPreviewObjectUrl);
    }

    exportPreviewFile = file;
    exportPreviewFilename = filename;
    exportPreviewObjectUrl = URL.createObjectURL(file);
    exportPreviewImage.src = exportPreviewObjectUrl;
    exportPreviewModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    exportPreviewShareBtn?.toggleAttribute('hidden', !isShareSupportedForFile(file));
}

function waitForImageElement(img) {
    return new Promise(resolve => {
        if (!img) {
            resolve();
            return;
        }

        if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
        }

        const done = () => {
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            resolve();
        };

        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
    });
}

async function ensureStageAssetsReady() {
    if (!stage) return;

    const images = Array.from(stage.querySelectorAll('img.layer-image, .layer-text img, .mobile-chat-toast-action img'));
    await Promise.all(images.map(waitForImageElement));

    await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
    }));
}

async function exportStageDomSnapshotBlob() {
    if (typeof domtoimage?.toBlob !== 'function' || !stage) {
        throw new Error('Stage snapshot kullanilamadi.');
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        width: ${canvasWidth}px;
        height: ${canvasHeight}px;
        overflow: hidden;
        background: transparent;
        pointer-events: none;
        z-index: -1;
    `;

    const clone = stage.cloneNode(true);
    clone.classList.add('exporting');
    clone.classList.remove('empty');
    clone.style.width = `${canvasWidth}px`;
    clone.style.height = `${canvasHeight}px`;
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'center center';
    clone.querySelectorAll('.selected, .text-frame-visible').forEach(node => {
        node.classList.remove('selected');
        node.classList.remove('text-frame-visible');
    });

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
        return await domtoimage.toBlob(clone, {
            width: canvasWidth,
            height: canvasHeight,
            bgcolor: null,
            style: {
                transform: 'none',
                transformOrigin: 'center center'
            }
        });
    } finally {
        wrapper.remove();
    }
}

function endSpacePan() {
    if (!spacePanSession) return;
    spacePanSession = null;
    stageWrap.classList.remove('is-panning');
}

function setSpacePanMode(enabled) {
    isSpacePanMode = enabled;
    stageWrap.classList.toggle('pan-mode', enabled);

    if (enabled) {
        document.removeEventListener('mousemove', updateBrushCursor);
        hideBrushCursor();
    } else if (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'blur') {
        document.addEventListener('mousemove', updateBrushCursor);
    }

    if (!enabled) {
        endSpacePan();
    }
}

function renderTransformOverlay() {
    if (!transformOverlay) return;

    transformOverlay.innerHTML = '';
    transformOverlay.style.left = '0px';
    transformOverlay.style.top = '0px';
    transformOverlay.style.width = '100%';
    transformOverlay.style.height = '100%';
    transformOverlay.style.userSelect = 'none'; // Transform sırasında metin seçimini engelle

    if (!canTransformSelectedLayer()) return;

    const layer = getLayer();
    const layerEl = layer ? stage.querySelector(`.layer[data-id="${layer.id}"]`) : null;
    if (!layer || !layerEl) return;

    const wrapRect = stageWrap.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const layerRect = layerEl.getBoundingClientRect();
    const margin = 96;
    const minLeft = Math.min(stageRect.left, layerRect.left - margin);
    const minTop = Math.min(stageRect.top, layerRect.top - margin);
    const maxRight = Math.max(stageRect.right, layerRect.right + margin);
    const maxBottom = Math.max(stageRect.bottom, layerRect.bottom + margin);
    const overlayLeft = minLeft - wrapRect.left;
    const overlayTop = minTop - wrapRect.top;
    const overlayWidth = maxRight - minLeft;
    const overlayHeight = maxBottom - minTop;
    const centerX = (layerRect.left - wrapRect.left) + (layerRect.width / 2);
    const centerY = (layerRect.top - wrapRect.top) + (layerRect.height / 2);
    const boxWidth = Math.max(0.000001, layer.width * zoom);
    const boxHeight = Math.max(0.000001, layer.height * zoom);

    transformOverlay.style.left = overlayLeft + 'px';
    transformOverlay.style.top = overlayTop + 'px';
    transformOverlay.style.width = overlayWidth + 'px';
    transformOverlay.style.height = overlayHeight + 'px';

    const box = document.createElement('div');
    box.className = 'transform-box';
    box.dataset.id = layer.id;
    box.style.width = boxWidth + 'px';
    box.style.height = boxHeight + 'px';
    box.style.left = (centerX - boxWidth / 2 - overlayLeft) + 'px';
    box.style.top = (centerY - boxHeight / 2 - overlayTop) + 'px';
    box.style.transform = `rotate(${layer.rotation}deg)`;
    box.style.transformOrigin = 'center center';

    ['tl', 'tr', 'bl', 'br'].forEach(pos => {
        const h = document.createElement('div');
        h.className = 'resize-handle ' + pos;
        box.appendChild(h);
    });

    const r = document.createElement('div');
    r.className = 'rotate-handle';
    box.appendChild(r);

    transformOverlay.appendChild(box);
    bindTransformOverlayInteractions();
}

function syncTransformOverlayBox(box, layer) {
    if (!transformOverlay || !box || !layer) return;

    // Transform sırasında parent (transformOverlay) yerini değiştirmemek kritik.
    // Sadece kutunun (box) kendi iç koordinatlarını güncelliyoruz.
    const wrapRect = stageWrap.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    
    // Overlay'in mevcut başlangıç noktası (renderTransformOverlay'den gelen)
    const overlayLeft = parseFloat(transformOverlay.style.left) || 0;
    const overlayTop = parseFloat(transformOverlay.style.top) || 0;

    // Katmanın sahnedeki görsel pozisyonu (zoom dahil)
    const visualX = (layer.x * zoom) + (stageRect.left - wrapRect.left);
    const visualY = (layer.y * zoom) + (stageRect.top - wrapRect.top);
    
    const boxWidth = Math.max(1, layer.width * zoom);
    const boxHeight = Math.max(1, layer.height * zoom);
    const centerX = visualX + (boxWidth / 2);
    const centerY = visualY + (boxHeight / 2);

    box.style.width = boxWidth + 'px';
    box.style.height = boxHeight + 'px';
    box.style.left = (centerX - boxWidth / 2 - overlayLeft) + 'px';
    box.style.top = (centerY - boxHeight / 2 - overlayTop) + 'px';
    box.style.transform = `rotate(${layer.rotation}deg)`;
}

function closeCanvasContextMenu() {
    canvasContextMenu?.setAttribute('hidden', '');
}

function positionContextMenu(menu, x, y) {
    if (!menu) return;

    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.removeAttribute('hidden');

    const rect = menu.getBoundingClientRect();
    const nextLeft = Math.min(x, window.innerWidth - rect.width - 10);
    const nextTop = Math.min(y, window.innerHeight - rect.height - 10);

    menu.style.left = Math.max(10, nextLeft) + 'px';
    menu.style.top = Math.max(10, nextTop) + 'px';
}

function positionCanvasContextMenu(x, y) {
    if (!canvasContextMenu) return;
    positionContextMenu(canvasContextMenu, x, y);
}

function openCanvasContextMenuAt(x, y, target) {
    const clickedLayer = target?.closest?.('.layer') || null;
    const clickedInsideStage = target === stage || !!clickedLayer || !!target?.closest?.('.layer-inner');
    if (!clickedInsideStage) return false;

    if (clickedLayer && currentTool === 'move' && isAutoSelectEnabled && selectedId !== clickedLayer.dataset.id) {
        selectLayerViaEngine(clickedLayer.dataset.id);
    }

    if (canvasContextMenuEditBtn) {
        canvasContextMenuEditBtn.disabled = !selectedId;
    }
    if (canvasContextMenuClearSelectionBtn) {
        canvasContextMenuClearSelectionBtn.disabled = !rasterSelectionState;
    }

    positionCanvasContextMenu(x, y);
    return true;
}

function cancelMobileContextMenuLongPress() {
    if (!mobileContextMenuLongPress) return;
    clearTimeout(mobileContextMenuLongPress.timer);
    mobileContextMenuLongPress = null;
}

function setTransformEditMode(enabled, options = {}) {
    const { forceMoveTool = false, keepSelection = true } = options;

    if (enabled && forceMoveTool && currentTool !== 'move') {
        selectTool('move');
    }

    if (enabled && !selectedId) return;

    isTransformEditMode = enabled;
    if (!enabled && !keepSelection) {
        window.StudioEngine?.applyCommand?.({
            action: 'clear_selection'
        }, {
            commitHistory: false,
            includeContext: false,
            render: false
        });
    }
    render();
}

function openTransformEditMode(options = {}) {
    setTransformEditMode(true, { forceMoveTool: true, keepSelection: true, ...options });
}

function closeTransformEditMode(options = {}) {
    setTransformEditMode(false, { keepSelection: true, ...options });
}

function setZoom(v) {
    zoom = Math.max(.25, Math.min(2, v));
    const translateY = zoom < 1 ? ((zoom - 1) * canvasHeight) / 2 : 0;
    stage.style.transform = `translateY(${translateY}px) scale(${zoom})`;
    zoomResetBtn.innerText = Math.round(zoom * 100) + '%';
    renderTransformOverlay();
    updateStageOverflow();
}

function zoomStageAtPoint(nextZoom, clientX, clientY) {
    const clampedZoom = Math.max(.25, Math.min(2, nextZoom));
    if (Math.abs(clampedZoom - zoom) < 0.0001) return;

    const beforeRect = stage.getBoundingClientRect();
    const pointX = (clientX - beforeRect.left) / zoom;
    const pointY = (clientY - beforeRect.top) / zoom;

    setZoom(clampedZoom);

    const afterRect = stage.getBoundingClientRect();
    const deltaX = (afterRect.left + pointX * clampedZoom) - clientX;
    const deltaY = (afterRect.top + pointY * clampedZoom) - clientY;

    stageWrap.scrollLeft += deltaX;
    stageWrap.scrollTop += deltaY;
    renderTransformOverlay();
}

function bindInteractions() {
    interact('.layer').unset();
    interact('.transform-box').unset();

    interact('.layer')
        .draggable({
            allowFrom: '.layer.selected',
            ignoreFrom: '.resize-handle,.rotate-handle,.layer-text',
            listeners: {
                start(e) {
                    const id = e.target.dataset.id;
                    const layer = getLayer(id);
                    if (!e.target.classList.contains('selected')) {
                        e.preventDefault();
                        return false;
                    }
                    if (selectedId !== id) {
                        e.preventDefault();
                        return false;
                    }
                    if (layer && layer.type === 'text') e.target.classList.add('text-dragging');
                    if (!canDragSelectedLayer()) {
                        e.preventDefault();
                        return false;
                    }

                    // Çizim araçları aktifken sürüklemeyi engelle
                    const tool = allTools.find(t => t.key === currentTool);
                    if (tool && (tool.group === 'draw' || tool.key === 'eyedropper')) {
                        e.preventDefault();
                        return false;
                    }
                },
                move(e) {
                    if (!e.target.classList.contains('selected')) return;
                    if (!canDragSelectedLayer()) return;
                    const tool = allTools.find(t => t.key === currentTool);
                    if (tool && (tool.group === 'draw' || tool.key === 'eyedropper')) return;

                    const id = e.target.dataset.id;
                    if (selectedId !== id) return;
                    const layer = getLayer(id);
                    if (!layer || layer.locked) return;
                    layer.x += e.dx / zoom;
                    layer.y += e.dy / zoom;
                    applyLayerBox(e.target, layer);
                    renderTransformOverlay();
                },
                end(e) {
                    e.target.classList.remove('text-dragging');
                    renderLayerList();
                    renderTransformOverlay();
                    updateStageOverflow();
                    commitHistory();
                }
            }
        });

}

function bindTransformOverlayInteractions() {
    interact('.transform-box').unset();

    interact('.transform-box')
        .resizable({
            edges: { left: '.tl, .bl', right: '.tr, .br', bottom: '.bl, .br', top: '.tl, .tr' },
            invert: 'none', // Kutunun ters dönmesini engelle
            listeners: {
                start() { document.body.style.userSelect = 'none'; },
                end() { document.body.style.userSelect = ''; }
            },
            listeners: {
                move(e) {
                    if (!canTransformSelectedLayer()) return;
                    const id = e.target.dataset.id;
                    const layer = getLayer(id);
                    if (!layer || layer.locked) return;

                    // Değişim miktarlarını zoom faktörüne bölerek sahne ölçeğine indiriyoruz
                    const dx = e.deltaRect.left / zoom;
                    const dy = e.deltaRect.top / zoom;
                    const dw = e.deltaRect.width / zoom;
                    const dh = e.deltaRect.height / zoom;

                    if ((layer.type === 'raster' || layer.type === 'shape') && layer.aspectLocked) {
                        const ratio = layer.width / layer.height || 1;
                        // Hangi eksende daha fazla hareket varsa oranı oradan kilitliyoruz
                        if (Math.abs(dw) > Math.abs(dh)) {
                            const targetW = layer.width + dw;
                            const targetH = targetW / ratio;
                            if (e.edges.top) layer.y -= (targetH - layer.height);
                            layer.width = targetW;
                            layer.height = targetH;
                        } else {
                            const targetH = layer.height + dh;
                            const targetW = targetH * ratio;
                            if (e.edges.left) layer.x -= (targetW - layer.width);
                            layer.height = targetH;
                            layer.width = targetW;
                        }
                        if (e.edges.left && Math.abs(dw) > Math.abs(dh)) layer.x += dx;
                        if (e.edges.top && Math.abs(dh) > Math.abs(dw)) layer.y += dy;
                    } else {
                        layer.width += dw;
                        layer.height += dh;
                        layer.x += dx;
                        layer.y += dy;
                    }

                    patchLayerElement(id);
                    syncTransformOverlayBox(e.target, layer);
                },
                end() {
                    renderTransformOverlay();
                    renderLayerList();
                    updateStageOverflow();
                    commitHistory();
                }
            },
            modifiers: [interact.modifiers.restrictSize({ min: { width: 0.000001, height: 0.000001 } })]
        });

    document.querySelectorAll('.transform-box .rotate-handle').forEach(handle => {
        handle.onmousedown = function (e) {
            const el = e.target.closest('.transform-box');
            const id = el.dataset.id;
            const layer = getLayer(id);
            if (!canTransformSelectedLayer()) return;
            if (!layer || layer.locked) return;
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            rotateState = { id, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
            document.onmousemove = function (ev) {
                if (!rotateState) return;
                const current = getLayer(rotateState.id);
                const angle = Math.atan2(ev.clientY - rotateState.cy, ev.clientX - rotateState.cx) * 180 / Math.PI;
                current.rotation = angle + 90;
                render();
            };
            document.onmouseup = function () {
                commitHistory();
                rotateState = null;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    });
}

async function exportPNG() {
    try {
        await ensureExportFontsReady();
        await ensureStageAssetsReady();

        const createCanvasExportBlob = async () => {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvasWidth;
            exportCanvas.height = canvasHeight;
            const ctx = exportCanvas.getContext('2d');
            if (!ctx) {
                throw new Error('Export canvas context oluşturulamadı.');
            }

            const orderedLayers = [...layers].sort((a, b) => a.z - b.z);
            for (const layer of orderedLayers) {
                await drawLayerToContext(ctx, layer);
            }

            return await new Promise((resolve, reject) => {
                if (typeof exportCanvas.toBlob === 'function') {
                    exportCanvas.toBlob(nextBlob => {
                        if (nextBlob) resolve(nextBlob);
                        else reject(new Error('PNG blob oluşturulamadı.'));
                    }, 'image/png');
                    return;
                }

                const dataUrl = exportCanvas.toDataURL('image/png');
                fetch(dataUrl)
                    .then(response => response.blob())
                    .then(resolve)
                    .catch(reject);
            });
        };

        let blob = null;
        try {
            blob = await createCanvasExportBlob();
        } catch (canvasError) {
            if (!isIosDevice()) throw canvasError;
            console.warn('iOS canvas export warning:', canvasError);
            blob = await exportStageDomSnapshotBlob();
        }

        const filename = `design-${canvasWidth}x${canvasHeight}-${Date.now()}.png`;
        const file = new File([blob], filename, { type: 'image/png' });

        if (isIosDevice()) {
            openExportPreviewModal(file, filename);
            return;
        }

        downloadExportedFile(file, filename);
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : (typeof error === 'string' && error.trim() ? error : 'Bilinmeyen hata');
        alert('Dışa aktarma hatası: ' + message);
    }
}

exportBtn.addEventListener('click', () => {
    closeFileMenu();
    exportPNG();
});
exportPreviewModalClose?.addEventListener('click', closeExportPreviewModal);
exportPreviewModal?.addEventListener('click', e => {
    if (e.target === exportPreviewModal) {
        closeExportPreviewModal();
    }
});
exportPreviewShareBtn?.addEventListener('click', async () => {
    if (!exportPreviewFile) return;
    await shareExportedFile(exportPreviewFile);
});
exportPreviewDownloadBtn?.addEventListener('click', () => {
    if (!exportPreviewFile || !exportPreviewFilename) return;
    downloadExportedFile(exportPreviewFile, exportPreviewFilename);
});
duplicateBtn.addEventListener('click', duplicateSelected);
groupBtn?.addEventListener('click', groupSelectedLayers);
visibilityBtn?.addEventListener('click', () => {
    const ids = getSelectedLayerIds();
    if (!ids.length) return;
    window.StudioEngine?.applyCommands?.(ids.map(id => ({
        action: 'toggle_visibility',
        target: id
    })), { includeContext: false });
});
lockBtn?.addEventListener('click', () => {
    const ids = getSelectedLayerIds();
    if (!ids.length) return;
    window.StudioEngine?.applyCommands?.(ids.map(id => ({
        action: 'toggle_lock',
        target: id
    })), { includeContext: false });
});
deleteBtn.addEventListener('click', removeSelected);
zoomInBtn.addEventListener('click', () => setZoom(zoom + .1));
zoomOutBtn.addEventListener('click', () => setZoom(zoom - .1));
zoomResetBtn.addEventListener('click', () => setZoom(1));
zoomFitBtn.addEventListener('click', fitStageToView);

document.querySelectorAll('[data-canvas-size-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
        const [w, h] = btn.dataset.canvasSizePreset.split('x').map(Number);
        if (newProjectWidthInput) newProjectWidthInput.value = w;
        if (newProjectHeightInput) newProjectHeightInput.value = h;
        document.querySelectorAll('[data-canvas-size-preset]').forEach(chip => {
            chip.classList.toggle('active', chip === btn);
        });
    });
});

imageInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    addRasterFromFile(file);
    e.target.value = '';
});

document.addEventListener('paste', e => {
    if (isEditablePasteContext(e)) {
        return;
    }
    if (!hasImageTransferPayload(e.clipboardData)) return;
    e.preventDefault();
    void (async () => {
        await addRasterFromDataTransfer(e.clipboardData, 'Pasted Image');
    })();
});

document.addEventListener('dragover', e => {
    if (!hasImageTransferPayload(e.dataTransfer)) return;
    e.preventDefault();
});

document.addEventListener('drop', e => {
    if (e.target.closest('#stageWrap')) return;
    if (!hasImageTransferPayload(e.dataTransfer)) return;
    e.preventDefault();
    stageWrap.style.border = '';
    void addRasterFromDataTransfer(e.dataTransfer, 'Dropped Image');
});

stage.addEventListener('mousedown', e => {
    if (e.button !== 0) return; // Sadece sol tık
    const activeTool = allTools.find(t => t.key === currentTool);
    const isShapeTool = activeTool?.group === 'add' && activeTool?.capabilities?.creates === 'shape';

    if (isShapeTool) {
        // Eğer bir katmanın üzerine tıklandıysa çizim başlatma (seçim yapmak istiyor olabilir)
        if (e.target.closest('.layer')) return;

        e.preventDefault();
        const point = getStagePointFromEvent(e);
        
        drawingSession = {
            tool: activeTool,
            startX: point.x,
            startY: point.y,
            ghostEl: null,
            isDragging: false
        };
    }
});

document.addEventListener('mousemove', e => {
    if (!drawingSession) return;

    const point = getStagePointFromEvent(e);
    const dx = point.x - drawingSession.startX;
    const dy = point.y - drawingSession.startY;

    // Minimum 3 piksel hareket varsa çizimi başlat (kazara tıklamaları engellemek için)
    if (!drawingSession.isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        drawingSession.isDragging = true;
        drawingSession.ghostEl = document.createElement('div');
        drawingSession.ghostEl.className = 'drawing-ghost';
        // Dinamik stil: Figma mavisi transparan kutu
        Object.assign(drawingSession.ghostEl.style, {
            position: 'absolute',
            border: '1px solid #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
            zIndex: '9999'
        });
        stage.appendChild(drawingSession.ghostEl);
    }

    if (drawingSession.isDragging) {
        const x = Math.min(drawingSession.startX, point.x);
        const y = Math.min(drawingSession.startY, point.y);
        const w = Math.abs(dx);
        const h = Math.abs(dy);

        drawingSession.ghostEl.style.left = x + 'px';
        drawingSession.ghostEl.style.top = y + 'px';
        drawingSession.ghostEl.style.width = w + 'px';
        drawingSession.ghostEl.style.height = h + 'px';
        drawingSession.finalRect = { x, y, w, h };
    }
});

document.addEventListener('mouseup', e => {
    if (!drawingSession) return;

    if (drawingSession.isDragging && drawingSession.finalRect) {
        const { x, y, w, h } = drawingSession.finalRect;
        const tool = drawingSession.tool;

        // Motor üzerinden katmanı oluştur
        window.StudioEngine?.applyCommand({
            action: 'add_layer',
            layer: {
                ...TOOL_PRESETS.shape,
                id: 'layer_' + Math.random().toString(36).slice(2, 10),
                x, y, width: w, height: h,
                shapeType: tool.capabilities?.shapeType || 'rect',
                name: tool.label
            }
        });
        lastDrawingEndTime = Date.now();
    } else {
        // Sürükleme yapılmadıysa (sadece tıklandıysa) eski varsayılan davranışı çalıştır
        const point = { x: drawingSession.startX, y: drawingSession.startY };
        window.addLayerFromTool?.(drawingSession.tool.key, point);
    }

    drawingSession.ghostEl?.remove();
    drawingSession = null;
});

stage.addEventListener('click', e => {
    if (suppressStageClickAfterLongPress) {
        e.preventDefault();
        e.stopPropagation();
        suppressStageClickAfterLongPress = false;
        return;
    }

    if (Date.now() - lastDrawingEndTime < 100) return; // Az önce çizim yapıldıysa tıklamayı yoksay

    closeCanvasContextMenu();
    const activeTool = allTools.find(t => t.key === currentTool);
    const clickedLayer = e.target.closest('.layer');

    if (activeTool?.key === 'eyedropper') {
        pickColorFromStage(e);
        return;
    }

    if (activeTool?.key === 'text' && clickedLayer?.dataset.type === 'text') {
        if (!e.target.classList.contains('layer-text')) {
            window.focusTextLayerEditor?.(clickedLayer.dataset.id, { placeCaretAtEnd: true });
        }
        return;
    }

    if (activeTool?.group === 'add' && activeTool?.capabilities?.creates === 'text') {
        const point = getStagePointFromEvent(e);
        window.addLayerFromTool?.(activeTool.key, point);
        return;
    }

    if (e.target === stage) {
        if (isSelectionToolKey(activeTool?.key)) {
            return;
        }
        closeTransformEditMode({ keepSelection: true });
        activeInlineEditorId = null;
        render();
    }
});

stageWrap.addEventListener('contextmenu', e => {
    if (!openCanvasContextMenuAt(e.clientX, e.clientY, e.target)) return;
    e.preventDefault();
});

stageWrap.addEventListener('pointerdown', e => {
    if (currentWorkspaceLayout?.shellStyle !== 'mobile') return;
    if (!['touch', 'pen'].includes(e.pointerType)) return;
    if (e.target.closest('#canvasContextMenu, button, input, textarea, select, [contenteditable="true"]')) return;

    const clickedLayer = e.target.closest('.layer');
    const clickedInsideStage = e.target === stage || !!clickedLayer || !!e.target.closest('.layer-inner');
    if (!clickedInsideStage) return;

    cancelMobileContextMenuLongPress();
    mobileContextMenuLongPress = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        target: e.target,
        timer: setTimeout(() => {
            if (!mobileContextMenuLongPress || mobileContextMenuLongPress.pointerId !== e.pointerId) return;
            const opened = openCanvasContextMenuAt(
                mobileContextMenuLongPress.startX,
                mobileContextMenuLongPress.startY,
                mobileContextMenuLongPress.target
            );
            if (opened) {
                suppressStageClickAfterLongPress = true;
                e.preventDefault();
            }
            mobileContextMenuLongPress = null;
        }, 560)
    };
}, { passive: false });

stageWrap.addEventListener('pointermove', e => {
    if (!mobileContextMenuLongPress || mobileContextMenuLongPress.pointerId !== e.pointerId) return;
    const moved = Math.hypot(
        e.clientX - mobileContextMenuLongPress.startX,
        e.clientY - mobileContextMenuLongPress.startY
    );
    if (moved > 10) {
        cancelMobileContextMenuLongPress();
    }
});

stageWrap.addEventListener('pointerup', cancelMobileContextMenuLongPress);
stageWrap.addEventListener('pointercancel', cancelMobileContextMenuLongPress);

stageWrap.addEventListener('scroll', () => {
    renderTransformOverlay();
});

stageWrap.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();

    const delta = Math.max(-40, Math.min(40, e.deltaY));
    const zoomStep = 0.0015;
    zoomStageAtPoint(zoom - (delta * zoomStep), e.clientX, e.clientY);
}, { passive: false });

document.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (isEventInsideStageWrap(e.target)) return;
    e.preventDefault();
}, { passive: false, capture: true });

document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
}, { passive: false });

document.addEventListener('gesturechange', (e) => {
    e.preventDefault();
}, { passive: false });

document.addEventListener('gestureend', (e) => {
    e.preventDefault();
}, { passive: false });

stageWrap.addEventListener('mousedown', (e) => {
    if (!isSpacePanMode) return;
    if (e.button !== 0) return;

    e.preventDefault();
    stageWrap.classList.add('is-panning');
    spacePanSession = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: stageWrap.scrollLeft,
        scrollTop: stageWrap.scrollTop
    };
});

document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.classList?.contains('layer-text');
    const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
    const isRedo = (e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y');
    const isTransformShortcut = e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyT';
    const modalOpen =
        (shortcutsModal && !shortcutsModal.hasAttribute('hidden')) ||
        (apiDocsModal && !apiDocsModal.hasAttribute('hidden')) ||
        (newProjectModal && !newProjectModal.hasAttribute('hidden')) ||
        (templatesModal && !templatesModal.hasAttribute('hidden')) ||
        (pluginModal && !pluginModal.hasAttribute('hidden')) ||
        (exportPreviewModal && !exportPreviewModal.hasAttribute('hidden'));
    if (!typing && e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpacePanMode(true);
        return;
    }
    if (!typing && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const step = e.shiftKey ? 10 : 1;
        let didMove = false;

        if (e.key === 'ArrowLeft') didMove = nudgeSelectedLayer(-step, 0);
        if (e.key === 'ArrowRight') didMove = nudgeSelectedLayer(step, 0);
        if (e.key === 'ArrowUp') didMove = nudgeSelectedLayer(0, -step);
        if (e.key === 'ArrowDown') didMove = nudgeSelectedLayer(0, step);

        if (didMove) {
            e.preventDefault();
            return;
        }
    }
    if (!typing && isUndo) {
        e.preventDefault();
        undoHistory();
        return;
    }
    if (!typing && isRedo) {
        e.preventDefault();
        redoHistory();
        return;
    }
    if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (deleteSelectedRasterArea()) {
            return;
        }
        const ids = getSelectedLayerIds();
        if (ids.length) {
            window.StudioEngine?.applyCommand?.({
                action: 'remove_layers',
                targets: ids
            }, { includeContext: false });
        }
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const layer = getLayer();
        if (layer) {
            const copy = JSON.parse(JSON.stringify(layer));
            copy.id = 'layer_' + Math.random().toString(36).slice(2, 10);
            copy.name = layer.name + ' Copy';
            copy.x += 24;
            copy.y += 24;
            window.StudioEngine?.applyCommand?.({
                action: 'add_layer',
                layer: copy
            }, { includeContext: false });
        }
    }
    if (!typing && isTransformShortcut) {
        e.preventDefault();
        openTransformEditMode();
        return;
    }
    if (!typing && e.key === 'Enter' && isTransformEditMode) {
        e.preventDefault();
        closeTransformEditMode();
        return;
    }
    if (e.key === 'Escape' && shortcutsModal && !shortcutsModal.hasAttribute('hidden')) {
        e.preventDefault();
        closeShortcutsModal();
        return;
    }
    if (e.key === 'Escape' && apiDocsModal && !apiDocsModal.hasAttribute('hidden')) {
        e.preventDefault();
        closeApiDocsModal();
        return;
    }
    if (e.key === 'Escape' && newProjectModal && !newProjectModal.hasAttribute('hidden')) {
        e.preventDefault();
        closeNewProjectModal();
        return;
    }
    if (e.key === 'Escape' && templatesModal && !templatesModal.hasAttribute('hidden')) {
        e.preventDefault();
        closeTemplatesModal();
        return;
    }
    if (e.key === 'Escape' && pluginModal && !pluginModal.hasAttribute('hidden')) {
        e.preventDefault();
        closePluginModal();
        return;
    }
    if (e.key === 'Escape' && workspaceModal && !workspaceModal.hasAttribute('hidden')) {
        e.preventDefault();
        closeWorkspaceModal();
        return;
    }
    if (e.key === 'Escape' && layerStyleModal && !layerStyleModal.hasAttribute('hidden')) {
        e.preventDefault();
        closeLayerStyleModal();
        return;
    }
    if (e.key === 'Escape' && exportPreviewModal && !exportPreviewModal.hasAttribute('hidden')) {
        e.preventDefault();
        closeExportPreviewModal();
        return;
    }
    if (e.key === 'Escape' && !typing) {
        closeCanvasContextMenu();
        if (isTransformEditMode) closeTransformEditMode();
    }
});

document.addEventListener('keyup', e => {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.classList?.contains('layer-text');
    if (!e.metaKey && !e.ctrlKey && isAutoSelectModifierPressed) {
        isAutoSelectModifierPressed = false;
        render();
    }
    if (!typing && e.code === 'Space') {
        setSpacePanMode(false);
    }
});

window.addEventListener('keydown', e => {
    const nextModifierState = !!(e.metaKey || e.ctrlKey || e.key === 'Meta' || e.key === 'Control');
    if (nextModifierState !== isAutoSelectModifierPressed) {
        isAutoSelectModifierPressed = nextModifierState;
        render();
    }
});

window.addEventListener('blur', () => {
    if (!isAutoSelectModifierPressed) return;
    isAutoSelectModifierPressed = false;
    render();
});

document.addEventListener('mousemove', e => {
    if (!spacePanSession) return;
    const dx = e.clientX - spacePanSession.startX;
    const dy = e.clientY - spacePanSession.startY;
    stageWrap.scrollLeft = spacePanSession.scrollLeft - dx;
    stageWrap.scrollTop = spacePanSession.scrollTop - dy;
    renderTransformOverlay();
});

document.addEventListener('mouseup', () => {
    endSpacePan();
});

window.addEventListener('resize', () => {
    if (currentWorkspaceLayout?.shellStyle === 'mobile') {
        fitStageToView();
        stageWrap.scrollLeft = 0;
        stageWrap.scrollTop = 0;
    }
    renderTransformOverlay();
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#canvasContextMenu')) {
        closeCanvasContextMenu();
    }
    const clickedInsideFlyout = e.target.closest('#inspectorFlyout');
    const clickedTool = e.target.closest('.inspector-tool-btn');
    const clickedPickr = e.target.closest('.pcr-app, .pickr');
    if (!clickedInsideFlyout && !clickedTool && !clickedPickr) {
        closeInspectorFlyout();
    }
    if (!e.target.closest('.ctx-gradient-popover') && !e.target.closest('[data-open-gradient-popover]') && !clickedPickr) {
        closeContextGradientPopover();
    }
});

inspectorTools?.addEventListener('click', (e) => {
    const button = e.target.closest('.inspector-tool-btn');
    if (!button) return;
    e.stopPropagation();
    toggleInspectorFlyout(button.dataset.panel);
});

flyoutClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeInspectorFlyout();
});

inspectorFlyout.addEventListener('click', (e) => {
    e.stopPropagation();
});

shortcutsModalClose?.addEventListener('click', closeShortcutsModal);

shortcutsModal?.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) closeShortcutsModal();
});
apiDocsModalClose?.addEventListener('click', closeApiDocsModal);
apiDocsModal?.addEventListener('click', (e) => {
    if (e.target === apiDocsModal) closeApiDocsModal();
});

newProjectModalClose?.addEventListener('click', closeNewProjectModal);
newProjectCancelBtn?.addEventListener('click', closeNewProjectModal);
newProjectModal?.addEventListener('click', (e) => {
    if (e.target === newProjectModal) closeNewProjectModal();
});
templatesModalClose?.addEventListener('click', closeTemplatesModal);
templatesModal?.addEventListener('click', (e) => {
    if (e.target === templatesModal) closeTemplatesModal();
});
layerStyleModalClose?.addEventListener('click', closeLayerStyleModal);
layerStyleModal?.addEventListener('click', (e) => {
    if (e.target === layerStyleModal) closeLayerStyleModal();
});
newProjectWidthInput?.addEventListener('input', () => syncNewProjectPresetState());
newProjectHeightInput?.addEventListener('input', () => syncNewProjectPresetState());
newProjectWidthInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    createNewProjectWithSize(newProjectWidthInput.value, newProjectHeightInput?.value);
});
newProjectHeightInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    createNewProjectWithSize(newProjectWidthInput?.value, newProjectHeightInput.value);
});
newProjectCreateBtn?.addEventListener('click', () => {
    const w = Number(newProjectWidthInput?.value);
    const h = Number(newProjectHeightInput?.value);
    createNewProjectWithSize(w, h);
});

function setColorMode(layerId, mode, prop, lastColor, toolPresetKey = '') {
    if (mode === 'transparent') {
        if (toolPresetKey) updateToolPreset(toolPresetKey, { [prop]: 'transparent' });
        else applyLayerPatchViaEngine(layerId, { [prop]: 'transparent' }, { refreshInspector: true });
    } else {
        if (toolPresetKey) updateToolPreset(toolPresetKey, { [prop]: lastColor });
        else applyLayerPatchViaEngine(layerId, { [prop]: lastColor }, { refreshInspector: true });
    }
    refreshInspectorFlyoutIfNeeded();
}
