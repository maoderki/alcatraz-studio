// ── Drawing: Canvas helpers ────────────────────────────────────────────────
function getActiveCanvas() {
    const l = getLayer();
    if (!l || l.type !== 'raster') return null;
    const el = stage.querySelector(`.layer[data-id="${l.id}"] canvas.layer-canvas`);
    return el || null;
}

function ensureEditableRasterCanvas(layer) {
    if (!layer || layer.type !== 'raster') return null;

    let canvasEl = stage.querySelector(`.layer[data-id="${layer.id}"] canvas.layer-canvas`);
    if (canvasEl) return canvasEl;

    const imageEl = stage.querySelector(`.layer[data-id="${layer.id}"] img.layer-image`);
    if (!imageEl) return null;

    canvasEl = document.createElement('canvas');
    canvasEl.className = 'layer-canvas';
    canvasEl.width = Math.max(1, Math.round(layer.width));
    canvasEl.height = Math.max(1, Math.round(layer.height));
    canvasEl.style.cssText = 'width:100%;height:100%;display:block;';

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(imageEl, 0, 0, canvasEl.width, canvasEl.height);

    const imageHost = imageEl.parentElement;
    if (!imageHost) return null;
    imageHost.replaceChild(canvasEl, imageEl);

    window.StudioEngine?.applyCommand?.({
        action: 'commit_canvas',
        target: layer.id,
        canvasData: canvasEl.toDataURL(),
        src: null
    }, {
        commitHistory: false,
        includeContext: false,
        render: false
    });
    return canvasEl;
}

function getSelectedRasterLayerForCanvasTool() {
    const layer = getLayer();
    if (!layer || layer.type !== 'raster') return null;
    return layer;
}

function getStagePointerCoords(e) {
    const rect = stage.getBoundingClientRect();
    return {
        x: clamp(((e.clientX - rect.left) / rect.width) * canvasWidth, 0, canvasWidth),
        y: clamp(((e.clientY - rect.top) / rect.height) * canvasHeight, 0, canvasHeight)
    };
}

function buildSelectionBounds(points = []) {
    if (!points.length) return null;
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY)
    };
}

function getSelectionSvgMarkup(selection) {
    if (!selection) return '';

    if (selection.mode === 'rect') {
        const bounds = buildSelectionBounds(selection.points);
        if (!bounds) return '';
        return `<rect class="raster-selection-shape" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" />`;
    }

    if (selection.mode === 'ellipse') {
        const bounds = buildSelectionBounds(selection.points);
        if (!bounds) return '';
        return `<ellipse class="raster-selection-shape" cx="${bounds.x + (bounds.width / 2)}" cy="${bounds.y + (bounds.height / 2)}" rx="${bounds.width / 2}" ry="${bounds.height / 2}" />`;
    }

    if (selection.mode === 'lasso' && Array.isArray(selection.points) && selection.points.length >= 2) {
        const path = selection.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ') + ' Z';
        return `<path class="raster-selection-shape" d="${path}" />`;
    }

    return '';
}

function renderRasterSelectionOverlay() {
    stage.querySelectorAll('.raster-selection-overlay').forEach(node => node.remove());
    if (!rasterSelectionState?.layerId) return;

    const markup = getSelectionSvgMarkup(rasterSelectionState);
    if (!markup) return;

    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'raster-selection-overlay');
    overlay.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
    overlay.setAttribute('preserveAspectRatio', 'none');
    overlay.innerHTML = markup;
    stage.appendChild(overlay);
}

function applySelectionMaskPath(ctx, selection, offsetX = 0, offsetY = 0) {
    if (!selection) return;

    if (selection.mode === 'rect') {
        const bounds = buildSelectionBounds(selection.points);
        if (!bounds) return;
        ctx.rect(bounds.x - offsetX, bounds.y - offsetY, bounds.width, bounds.height);
        return;
    }

    if (selection.mode === 'ellipse') {
        const bounds = buildSelectionBounds(selection.points);
        if (!bounds) return;
        ctx.ellipse(
            bounds.x + (bounds.width / 2) - offsetX,
            bounds.y + (bounds.height / 2) - offsetY,
            Math.max(1, bounds.width / 2),
            Math.max(1, bounds.height / 2),
            0,
            0,
            Math.PI * 2
        );
        return;
    }

    if (selection.mode === 'lasso' && Array.isArray(selection.points) && selection.points.length >= 2) {
        selection.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x - offsetX, point.y - offsetY);
            else ctx.lineTo(point.x - offsetX, point.y - offsetY);
        });
        ctx.closePath();
    }
}

function clearRasterSelection() {
    rasterSelectionState = null;
    drawState.isSelecting = false;
    drawState.selectionPoints = [];
    renderRasterSelectionOverlay();
}

function runRasterOperationWithSelection(ctx, layer, applyOperation) {
    const selection = rasterSelectionState?.layerId === layer.id ? rasterSelectionState : null;
    if (!selection) {
        applyOperation(ctx, ctx.canvas);
        return;
    }

    const canvas = ctx.canvas;
    const sourceCanvas = createTempCanvas(canvas.width, canvas.height);
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) return;
    sourceCtx.drawImage(canvas, 0, 0);

    const workCanvas = createTempCanvas(canvas.width, canvas.height);
    const workCtx = workCanvas.getContext('2d');
    if (!workCtx) return;
    workCtx.drawImage(sourceCanvas, 0, 0);
    applyOperation(workCtx, workCanvas);

    const maskCanvas = createTempCanvas(canvas.width, canvas.height);
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;
    maskCtx.beginPath();
    applySelectionMaskPath(maskCtx, selection, layer.x, layer.y);
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fill();

    const maskedCanvas = createTempCanvas(canvas.width, canvas.height);
    const maskedCtx = maskedCanvas.getContext('2d');
    if (!maskedCtx) return;
    maskedCtx.drawImage(workCanvas, 0, 0);
    maskedCtx.globalCompositeOperation = 'destination-in';
    maskedCtx.drawImage(maskCanvas, 0, 0);
    maskedCtx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.drawImage(maskedCanvas, 0, 0);
}

function deleteSelectedRasterArea() {
    const layer = getSelectedRasterLayerForCanvasTool();
    const selection = rasterSelectionState?.layerId === layer?.id ? rasterSelectionState : null;
    if (!layer || !selection) return false;

    const canvasEl = getActiveCanvas() || ensureEditableRasterCanvas(layer);
    if (!canvasEl) return false;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return false;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    applySelectionMaskPath(ctx, selection, layer.x, layer.y);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fill();
    ctx.restore();

    saveCanvasToLayer(layer.id, canvasEl);
    commitHistory();
    return true;
}

function getCanvasCoords(e, canvasEl) {
    const rect = canvasEl.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) / zoom * (canvasEl.width / canvasEl.offsetWidth),
        y: (e.clientY - rect.top) / zoom * (canvasEl.height / canvasEl.offsetHeight)
    };
}

// ── Drawing: Brush ─────────────────────────────────────────────────────────
function brushDraw(ctx, x, y, px, py) {
    const size = drawState.brushSize;
    const hardness = drawState.hardness / 100;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;

    // Hardness → radial gradient brush veya solid
    if (hardness >= 0.99) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = cwFgColor;
        ctx.shadowBlur = 0;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        const softness = (1 - hardness) * size;
        ctx.shadowBlur = softness;
        ctx.shadowColor = cwFgColor;
        ctx.strokeStyle = cwFgColor;
    }

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// ── Drawing: Eraser ────────────────────────────────────────────────────────
function eraserDraw(ctx, x, y, px, py) {
    const size = drawState.brushSize;

    if (drawState.eraserMode === 'pixel') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    } else {
        // Layer mode: tüm katmanı temizle
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
}

function createTempCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
}

function blurDraw(ctx, x, y, px, py) {
    const canvas = ctx.canvas;
    const size = clamp(numberOr(drawState.brushSize, 12), 1, 200);
    const blurStrength = clamp(numberOr(drawState.blurStrength, 14), 1, 40);

    const sourceCanvas = createTempCanvas(canvas.width, canvas.height);
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) return;
    sourceCtx.drawImage(canvas, 0, 0);

    const blurredCanvas = createTempCanvas(canvas.width, canvas.height);
    const blurredCtx = blurredCanvas.getContext('2d');
    if (!blurredCtx) return;
    blurredCtx.filter = `blur(${blurStrength}px)`;
    blurredCtx.drawImage(sourceCanvas, 0, 0);
    blurredCtx.filter = 'none';

    const maskCanvas = createTempCanvas(canvas.width, canvas.height);
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.lineWidth = size;
    maskCtx.strokeStyle = '#ffffff';
    maskCtx.beginPath();
    maskCtx.moveTo(px, py);
    maskCtx.lineTo(x, y);
    maskCtx.stroke();

    const resultCanvas = createTempCanvas(canvas.width, canvas.height);
    const resultCtx = resultCanvas.getContext('2d');
    if (!resultCtx) return;
    resultCtx.drawImage(blurredCanvas, 0, 0);
    resultCtx.globalCompositeOperation = 'destination-in';
    resultCtx.drawImage(maskCanvas, 0, 0);
    resultCtx.globalCompositeOperation = 'destination-over';
    resultCtx.drawImage(sourceCanvas, 0, 0);
    resultCtx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(resultCanvas, 0, 0);
}

// ── Drawing: Flood Fill (Boya Kovası) ─────────────────────────────────────
function floodFill(canvas, startX, startY, fillColorStr) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

    const fillColor = parseColor(fillColorStr);
    const targetIdx = (sy * w + sx) * 4;
    const tr = data[targetIdx];
    const tg = data[targetIdx + 1];
    const tb = data[targetIdx + 2];
    const ta = data[targetIdx + 3];

    // Aynı renkteyse doldurma
    if (tr === fillColor.r && tg === fillColor.g && tb === fillColor.b && ta === fillColor.a) return;

    const tolerance = (drawState.tolerance / 100) * 255;

    function matchColor(idx) {
        return Math.abs(data[idx] - tr) <= tolerance &&
            Math.abs(data[idx + 1] - tg) <= tolerance &&
            Math.abs(data[idx + 2] - tb) <= tolerance &&
            Math.abs(data[idx + 3] - ta) <= tolerance;
    }

    function setColor(idx) {
        data[idx] = fillColor.r;
        data[idx + 1] = fillColor.g;
        data[idx + 2] = fillColor.b;
        data[idx + 3] = fillColor.a;
    }

    if (drawState.contiguous) {
        // BFS flood fill
        const visited = new Uint8Array(w * h);
        const stack = [sx + sy * w];
        visited[sx + sy * w] = 1;

        while (stack.length) {
            const pos = stack.pop();
            const x = pos % w;
            const y = Math.floor(pos / w);
            const idx = pos * 4;

            setColor(idx);

            const neighbors = [
                x > 0 ? pos - 1 : -1,
                x < w - 1 ? pos + 1 : -1,
                y > 0 ? pos - w : -1,
                y < h - 1 ? pos + w : -1
            ];

            for (const n of neighbors) {
                if (n >= 0 && !visited[n] && matchColor(n * 4)) {
                    visited[n] = 1;
                    stack.push(n);
                }
            }
        }
    } else {
        // Tüm eşleşen pikselleri doldur
        for (let i = 0; i < w * h; i++) {
            if (matchColor(i * 4)) setColor(i * 4);
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

// ── Drawing: Event binders ─────────────────────────────────────────────────
function bindDrawEvents() {
    // Önce eski event'leri temizle
    stage.removeEventListener('mousedown', onDrawMouseDown);
    stage.removeEventListener('mousemove', onDrawMouseMove);
    document.removeEventListener('mouseup', onDrawMouseUp);
    stage.removeEventListener('mouseleave', onDrawMouseLeave);

    stage.addEventListener('mousedown', onDrawMouseDown);
    stage.addEventListener('mousemove', onDrawMouseMove);
    document.addEventListener('mouseup', onDrawMouseUp);
    stage.addEventListener('mouseleave', onDrawMouseLeave);
}

function onDrawMouseDown(e) {
    const tool = allTools.find(t => t.key === currentTool);
    if (!tool) return;

    if (isSelectionToolKey(tool.key)) {
        const layer = getSelectedRasterLayerForCanvasTool();
        if (!layer) return;

        const coords = getStagePointerCoords(e);
        if (!coords) return;

        drawState.isSelecting = true;
        drawState.selectionStartX = coords.x;
        drawState.selectionStartY = coords.y;
        drawState.selectionPoints = [{ x: coords.x, y: coords.y }];

        rasterSelectionState = {
            layerId: layer.id,
            mode: tool.key === 'select-ellipse' ? 'ellipse' : tool.key === 'select-lasso' ? 'lasso' : 'rect',
            points: [{ x: coords.x, y: coords.y }]
        };
        renderRasterSelectionOverlay();
        return;
    }

    if (tool.key === 'eyedropper') {
        pickColorFromStage(e);
        return;
    }

    if (tool.key === 'bucket') {
        const l = getSelectedRasterLayerForCanvasTool();
        if (!l) return;

        const canvasEl = getActiveCanvas() || ensureEditableRasterCanvas(l);
        if (!canvasEl) return;

        const coords = getCanvasCoords(e, canvasEl);
        runRasterOperationWithSelection(canvasEl.getContext('2d'), l, (_, targetCanvas) => {
            floodFill(targetCanvas, coords.x, coords.y, cwFgColor);
        });
        saveCanvasToLayer(l.id, canvasEl);
        commitHistory();
        return;
    }

    if (tool.key === 'gradient') {
        const l = getSelectedRasterLayerForCanvasTool();
        if (!l) return;

        const canvasEl = getActiveCanvas() || ensureEditableRasterCanvas(l);
        if (!canvasEl) return;

        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;

        runRasterOperationWithSelection(ctx, l, (workCtx, workCanvas) => {
            applyAiGradientOp(workCtx, workCanvas, {
                ...getGradientToolPreset(),
                opacity: 1
            });
        });
        saveCanvasToLayer(l.id, canvasEl);
        commitHistory();
        return;
    }

    if (tool.key === 'brush' || tool.key === 'eraser' || tool.key === 'blur') {
        const l = getSelectedRasterLayerForCanvasTool();
        if (!l) return;

        const canvasEl = getActiveCanvas() || ensureEditableRasterCanvas(l);
        if (!canvasEl) return;

        drawState.isDrawing = true;
        const coords = getCanvasCoords(e, canvasEl);
        drawState.lastX = coords.x;
        drawState.lastY = coords.y;

        // Tek nokta için de çiz
        const ctx = canvasEl.getContext('2d');
        if (tool.key === 'brush') {
            runRasterOperationWithSelection(ctx, l, workCtx => {
                brushDraw(workCtx, coords.x, coords.y, coords.x, coords.y);
            });
        } else if (tool.key === 'eraser') {
            runRasterOperationWithSelection(ctx, l, workCtx => {
                eraserDraw(workCtx, coords.x, coords.y, coords.x, coords.y);
            });
        } else {
            runRasterOperationWithSelection(ctx, l, workCtx => {
                blurDraw(workCtx, coords.x, coords.y, coords.x, coords.y);
            });
        }
        return;
    }
}

function onDrawMouseMove(e) {
    const tool = allTools.find(t => t.key === currentTool);
    if (!tool) return;

    if (drawState.isSelecting && isSelectionToolKey(tool.key)) {
        const layer = getSelectedRasterLayerForCanvasTool();
        if (!layer) return;
        const coords = getStagePointerCoords(e);
        if (!coords) return;

        if (tool.key === 'select-lasso') {
            drawState.selectionPoints.push({ x: coords.x, y: coords.y });
            rasterSelectionState = {
                layerId: layer.id,
                mode: 'lasso',
                points: [...drawState.selectionPoints]
            };
        } else {
            rasterSelectionState = {
                layerId: layer.id,
                mode: tool.key === 'select-ellipse' ? 'ellipse' : 'rect',
                points: [
                    { x: drawState.selectionStartX, y: drawState.selectionStartY },
                    { x: coords.x, y: coords.y }
                ]
            };
        }
        renderRasterSelectionOverlay();
        return;
    }

    // Brush cursor göster
    if (tool.key === 'brush' || tool.key === 'eraser' || tool.key === 'blur') {
        updateBrushCursor(e);
    }

    if (!drawState.isDrawing) return;
    if (tool.key !== 'brush' && tool.key !== 'eraser' && tool.key !== 'blur') return;

    const l = getSelectedRasterLayerForCanvasTool();
    if (!l) return;

    const canvasEl = getActiveCanvas() || ensureEditableRasterCanvas(l);
    if (!canvasEl) return;

    const coords = getCanvasCoords(e, canvasEl);
    const ctx = canvasEl.getContext('2d');

    if (tool.key === 'brush') {
        runRasterOperationWithSelection(ctx, l, workCtx => {
            brushDraw(workCtx, coords.x, coords.y, drawState.lastX, drawState.lastY);
        });
    } else if (tool.key === 'eraser') {
        runRasterOperationWithSelection(ctx, l, workCtx => {
            eraserDraw(workCtx, coords.x, coords.y, drawState.lastX, drawState.lastY);
        });
    } else {
        runRasterOperationWithSelection(ctx, l, workCtx => {
            blurDraw(workCtx, coords.x, coords.y, drawState.lastX, drawState.lastY);
        });
    }

    drawState.lastX = coords.x;
    drawState.lastY = coords.y;
}

function onDrawMouseUp(e) {
    if (drawState.isSelecting) {
        drawState.isSelecting = false;
        drawState.selectionPoints = [];
        renderRasterSelectionOverlay();
        return;
    }

    if (!drawState.isDrawing) return;
    drawState.isDrawing = false;

    const l = getSelectedRasterLayerForCanvasTool();
    if (!l) return;

    const canvasEl = getActiveCanvas() || ensureEditableRasterCanvas(l);
    if (!canvasEl) return;

    if (saveCanvasToLayer(l.id, canvasEl)) {
        commitHistory();
    }
}

function onDrawMouseLeave() {
    hideBrushCursor();
}

function saveCanvasToLayer(id, canvasEl) {
    if (!id || !canvasEl) return false;
    const result = window.StudioEngine?.applyCommand?.({
        action: 'commit_canvas',
        target: id,
        canvasData: canvasEl.toDataURL(),
        src: null
    }, {
        commitHistory: false,
        includeContext: false
    });
    return !!result?.ok;
}

function getGradientEditorDisplayStops(stops = []) {
    const normalized = (Array.isArray(stops) ? stops : []).map((stop, index) => ({
        ...stop,
        __index: index,
        __uiPos: clamp(numberOr(stop?.pos, 0), 0, 100)
    }));

    const groups = new Map();
    normalized.forEach(stop => {
        const key = String(Math.round(stop.__uiPos * 1000) / 1000);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(stop);
    });

    groups.forEach(group => {
        if (group.length <= 1) return;
        const step = 2.4;
        const start = -((group.length - 1) * step) / 2;
        group.forEach((stop, idx) => {
            stop.__uiPos = clamp(stop.__uiPos + start + (idx * step), 0, 100);
        });
    });

    return normalized;
}

function buildGradientCssValue({ gradientType = 'linear', angle = 135, colors = [], stops = [] } = {}) {
    const normalizedStops = normalizeGradientPresetStops(stops, colors);
    if (normalizedStops.length < 2) return '';

    const stopString = normalizedStops
        .map(stop => `${stop.color} ${Math.round(stop.pos * 100) / 100}%`)
        .join(', ');

    if (gradientType === 'radial') {
        return `radial-gradient(circle, ${stopString})`;
    }

    return `linear-gradient(${clamp(numberOr(angle, 135), 0, 360)}deg, ${stopString})`;
}

function getGradientToolPreset() {
    const preset = gradientToolPreset || {};
    const gradientType = preset.gradientType === 'radial' ? 'radial' : 'linear';
    const angle = clamp(numberOr(preset.angle, 135), 0, 360);
    const fallbackColors = Array.isArray(preset.colors) && preset.colors.length
        ? preset.colors
        : [cwFgColor, cwBgColor];
    const stops = normalizeGradientPresetStops(preset.stops, fallbackColors);

    return {
        gradientType,
        angle,
        colors: stops.map(stop => stop.color),
        stops
    };
}

function syncGradientToolPresetFromColorWidget() {
    gradientToolPreset = {
        gradientType: 'linear',
        angle: 135,
        colors: [cwFgColor, cwBgColor],
        stops: [
            { color: cwFgColor, pos: 0 },
            { color: cwBgColor, pos: 100 }
        ]
    };
}

function setGradientToolPreset(preset = {}, options = {}) {
    const gradientType = preset.gradientType === 'radial' ? 'radial' : 'linear';
    const angle = clamp(numberOr(preset.angle, 135), 0, 360);
    const providedColors = Array.isArray(preset.colors)
        ? preset.colors.filter(color => typeof color === 'string' && color.trim())
        : [];
    const stops = normalizeGradientPresetStops(preset.stops, providedColors);

    if (stops.length < 2) return false;

    gradientToolPreset = {
        gradientType,
        angle,
        colors: stops.map(stop => stop.color),
        stops
    };

    cwFgColor = stops[0].color;
    cwBgColor = (stops[1] || stops[0]).color;
    updateColorWidget();
    if (!options.skipRender) {
        renderContextBar();
        refreshInspectorFlyoutIfNeeded();
    }
    return true;
}

function normalizeAiPoint(point, width, height) {
    return {
        x: clamp(numberOr(point?.x, 0), 0, width),
        y: clamp(numberOr(point?.y, 0), 0, height)
    };
}

function applyAiBrushOp(ctx, canvas, op) {
    const points = Array.isArray(op.points) ? op.points : [];
    if (!points.length) return;

    const color = typeof op.color === 'string' ? op.color : '#000000';
    const size = clamp(numberOr(op.size, 1), 1, 200);
    const hardness = clamp(numberOr(op.hardness, 100), 0, 100) / 100;
    const opacity = clamp(numberOr(op.opacity, 1), 0, 1);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.globalCompositeOperation = 'source-over';

    if (hardness >= 0.99) {
        ctx.strokeStyle = color;
        ctx.shadowBlur = 0;
    } else {
        const softness = (1 - hardness) * size;
        ctx.strokeStyle = color;
        ctx.shadowBlur = softness;
        ctx.shadowColor = color;
    }

    const first = normalizeAiPoint(points[0], canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    if (points.length === 1) {
        ctx.lineTo(first.x, first.y);
    } else {
        points.slice(1).forEach(point => {
            const next = normalizeAiPoint(point, canvas.width, canvas.height);
            ctx.lineTo(next.x, next.y);
        });
    }

    ctx.stroke();
    ctx.restore();
}

function applyAiEraserOp(ctx, canvas, op) {
    const mode = op.mode === 'layer' ? 'layer' : 'pixel';
    if (mode === 'layer') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const points = Array.isArray(op.points) ? op.points : [];
    if (!points.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = clamp(numberOr(op.size, 1), 1, 200);
    ctx.strokeStyle = 'rgba(0,0,0,1)';

    const first = normalizeAiPoint(points[0], canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    if (points.length === 1) {
        ctx.lineTo(first.x, first.y);
    } else {
        points.slice(1).forEach(point => {
            const next = normalizeAiPoint(point, canvas.width, canvas.height);
            ctx.lineTo(next.x, next.y);
        });
    }

    ctx.stroke();
    ctx.restore();
}

function applyAiBucketOp(canvas, op) {
    const prevTolerance = drawState.tolerance;
    const prevContiguous = drawState.contiguous;

    drawState.tolerance = clamp(numberOr(op.tolerance, 30), 0, 100);
    drawState.contiguous = op.contiguous !== false;

    floodFill(
        canvas,
        clamp(numberOr(op.x, 0), 0, canvas.width - 1),
        clamp(numberOr(op.y, 0), 0, canvas.height - 1),
        typeof op.color === 'string' ? op.color : '#000000'
    );

    drawState.tolerance = prevTolerance;
    drawState.contiguous = prevContiguous;
}

function applyAiGradientOp(ctx, canvas, op) {
    const colors = Array.isArray(op.colors)
        ? op.colors.filter(color => typeof color === 'string' && color.trim())
        : [];
    const stops = normalizeGradientPresetStops(op.stops, colors);
    if (stops.length < 2) return;

    const gradientType = op.gradientType === 'radial' ? 'radial' : 'linear';
    let gradient;

    if (gradientType === 'radial') {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.max(canvas.width, canvas.height) / 2;
        gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    } else {
        const angle = (numberOr(op.angle, 0) * Math.PI) / 180;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const len = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height) / 2;
        const dx = Math.cos(angle) * len;
        const dy = Math.sin(angle) * len;
        gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    }

    stops.forEach(stop => {
        gradient.addColorStop(clamp(stop.pos / 100, 0, 1), stop.color);
    });

    ctx.save();
    ctx.globalAlpha = clamp(numberOr(op.opacity, 1), 0, 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function applyAiRasterOpsToLayer(layer) {
    if (!layer || layer.type !== 'raster') return false;

    const ops = Array.isArray(layer.drawOps) ? layer.drawOps : [];
    if (!ops.length || layer.src) return false;

    const canvasEl = stage.querySelector(`.layer[data-id="${layer.id}"] canvas.layer-canvas`);
    if (!canvasEl) return false;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return false;

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    ops.forEach(op => {
        if (!op || typeof op !== 'object') return;
        if (op.tool === 'brush') applyAiBrushOp(ctx, canvasEl, op);
        if (op.tool === 'eraser') applyAiEraserOp(ctx, canvasEl, op);
        if (op.tool === 'bucket') applyAiBucketOp(canvasEl, op);
        if (op.tool === 'gradient') applyAiGradientOp(ctx, canvasEl, op);
    });

    saveCanvasToLayer(layer.id, canvasEl);
    return true;
}

async function applyAiRasterOpsToLayers() {
    await new Promise(resolve => requestAnimationFrame(resolve));
    let changed = false;

    layers.forEach(layer => {
        if (applyAiRasterOpsToLayer(layer)) changed = true;
    });

    return changed;
}

window.applyAiBrushOp = applyAiBrushOp;
window.applyAiRasterOpsToLayer = applyAiRasterOpsToLayer;
window.applyAiRasterOpsToLayers = applyAiRasterOpsToLayers;
