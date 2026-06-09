function buildPatternOverlayCss(style) {
    const fg = withAlpha(style.foreground, style.opacity);
    const bg = withAlpha(style.background, Math.max(0, style.opacity * 0.45));
    const scale = Math.max(6, Number(style.scale) || 24);

    if (style.pattern === 'grid') {
        return {
            backgroundImage: `
                linear-gradient(${fg} 1px, transparent 1px),
                linear-gradient(90deg, ${fg} 1px, ${bg} 1px)
            `,
            backgroundSize: `${scale}px ${scale}px`
        };
    }

    if (style.pattern === 'stripes') {
        return {
            backgroundImage: `repeating-linear-gradient(135deg, ${fg} 0 ${Math.max(2, scale * 0.25)}px, transparent ${Math.max(2, scale * 0.25)}px ${scale}px)`,
            backgroundSize: `${scale}px ${scale}px`
        };
    }

    if (style.pattern === 'cross') {
        return {
            backgroundImage: `
                repeating-linear-gradient(0deg, transparent 0 ${Math.max(2, scale - 2)}px, ${fg} ${Math.max(2, scale - 2)}px ${scale}px),
                repeating-linear-gradient(90deg, transparent 0 ${Math.max(2, scale - 2)}px, ${fg} ${Math.max(2, scale - 2)}px ${scale}px)
            `,
            backgroundSize: `${scale}px ${scale}px`
        };
    }

    return {
        backgroundImage: `radial-gradient(circle, ${fg} 0 18%, transparent 20%)`,
        backgroundSize: `${scale}px ${scale}px`
    };
}

function getLayerClipPath(layer) {
    const shapeType = layer?.shapeType || 'rect';
    if (layer?.type !== 'shape') return '';
    if (shapeType === 'triangle') return 'polygon(50% 0%, 0% 100%, 100% 100%)';
    if (shapeType === 'hexagon') return 'polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)';
    return '';
}

function getRasterLayerMaskSource(layer) {
    if (!layer || layer.type !== 'raster') return '';
    return layer.canvasData || layer.src || layer.exportSrc || '';
}

function isLayerVisibleInTree(layer) {
    if (!layer || layer.visible === false) return false;
    let parentId = layer.parentId;
    while (parentId) {
        const parent = getLayer(parentId);
        if (!parent || parent.visible === false) return false;
        parentId = parent.parentId;
    }
    return true;
}

function isLayerLockedInTree(layer) {
    if (!layer) return false;
    if (layer.locked) return true;
    let parentId = layer.parentId;
    while (parentId) {
        const parent = getLayer(parentId);
        if (parent?.locked) return true;
        parentId = parent?.parentId;
    }
    return false;
}

function toCssUrl(value) {
    return `url("${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
}

function applyLayerContentMask(overlay, layer) {
    if (!overlay || !layer) return false;

    if (layer.type === 'raster') {
        const maskSource = getRasterLayerMaskSource(layer);
        if (!maskSource) return false;
        overlay.style.webkitMaskImage = toCssUrl(maskSource);
        overlay.style.maskImage = toCssUrl(maskSource);
        overlay.style.webkitMaskSize = '100% 100%';
        overlay.style.maskSize = '100% 100%';
        overlay.style.webkitMaskRepeat = 'no-repeat';
        overlay.style.maskRepeat = 'no-repeat';
        overlay.style.webkitMaskPosition = 'center';
        overlay.style.maskPosition = 'center';
        return true;
    }

    return false;
}

function createTextStyleOverlay(layer, background, blendMode) {
    const overlay = document.createElement('div');
    overlay.className = 'layer-style-text-overlay layer-text';
    applyTextLayerVisual(overlay, layer);
    overlay.textContent = layer.text || '';
    overlay.style.background = background;
    overlay.style.webkitBackgroundClip = 'text';
    overlay.style.backgroundClip = 'text';
    overlay.style.webkitTextFillColor = 'transparent';
    overlay.style.color = 'transparent';
    overlay.style.mixBlendMode = blendMode || 'normal';
    overlay.style.pointerEvents = 'none';
    return overlay;
}

function getShapeStrokeSvgPath(layer) {
    const shapeType = layer?.shapeType || 'rect';
    if (shapeType === 'triangle') return 'M 50 0 L 0 100 L 100 100 Z';
    if (shapeType === 'hexagon') return 'M 25 6 L 75 6 L 100 50 L 75 94 L 25 94 L 0 50 Z';
    return '';
}

function createShapeStrokeOverlay(layer, strokeStyle) {
    const path = getShapeStrokeSvgPath(layer);
    if (!path) return null;

    const strokeSize = Math.max(1, Number(strokeStyle.size) || 1);
    const strokePosition = ['inside', 'center', 'outside'].includes(strokeStyle.position)
        ? strokeStyle.position
        : 'inside';
    const strokeWidth = strokePosition === 'center' ? strokeSize : strokeSize * 2;
    const strokeColor = withAlpha(strokeStyle.color, strokeStyle.opacity);
    const idBase = `shape_stroke_${String(layer.id || uid()).replace(/[^a-zA-Z0-9_-]/g, '_')}_${Math.random().toString(36).slice(2, 7)}`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('layer-style-overlay', 'layer-style-shape-stroke-overlay');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.overflow = 'visible';
    svg.style.mixBlendMode = strokeStyle.blendMode || 'normal';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const shapePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shapePath.setAttribute('id', `${idBase}_path`);
    shapePath.setAttribute('d', path);
    defs.appendChild(shapePath);

    if (strokePosition === 'inside') {
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clip.setAttribute('id', `${idBase}_clip`);
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#${idBase}_path`);
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${idBase}_path`);
        clip.appendChild(use);
        defs.appendChild(clip);
    }

    if (strokePosition === 'outside') {
        const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        mask.setAttribute('id', `${idBase}_mask`);
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('x', '-100');
        mask.setAttribute('y', '-100');
        mask.setAttribute('width', '300');
        mask.setAttribute('height', '300');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '-100');
        rect.setAttribute('y', '-100');
        rect.setAttribute('width', '300');
        rect.setAttribute('height', '300');
        rect.setAttribute('fill', 'white');
        const cutout = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        cutout.setAttribute('href', `#${idBase}_path`);
        cutout.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${idBase}_path`);
        cutout.setAttribute('fill', 'black');
        mask.appendChild(rect);
        mask.appendChild(cutout);
        defs.appendChild(mask);
    }

    svg.appendChild(defs);

    const strokePath = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    strokePath.setAttribute('href', `#${idBase}_path`);
    strokePath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${idBase}_path`);
    strokePath.setAttribute('fill', 'none');
    strokePath.setAttribute('stroke', strokeColor);
    strokePath.setAttribute('stroke-width', String(strokeWidth));
    strokePath.setAttribute('stroke-linejoin', 'round');
    strokePath.setAttribute('stroke-linecap', 'round');
    strokePath.setAttribute('vector-effect', 'non-scaling-stroke');
    if (strokePosition === 'inside') strokePath.setAttribute('clip-path', `url(#${idBase}_clip)`);
    if (strokePosition === 'outside') strokePath.setAttribute('mask', `url(#${idBase}_mask)`);
    svg.appendChild(strokePath);

    return svg;
}

function applyLayerStyleVisuals(el, inner, content, fx, layer) {
    if (!el || !inner || !content || !fx || !layer) return;
    const style = getLayerStyle(layer);
    const clipPath = getLayerClipPath(layer);

    el.style.mixBlendMode = style.blendMode || 'normal';
    el.style.filter = '';
    inner.style.overflow = 'visible';
    content.style.opacity = String((Math.max(0, Math.min(100, Number(style.fillOpacity) || 0)) / 100));
    fx.innerHTML = '';
    fx.style.borderRadius = inner.style.borderRadius || '0px';
    fx.style.clipPath = '';
    const textContent = layer.type === 'text' ? content.querySelector('.layer-text') : null;
    if (textContent) {
        textContent.style.webkitTextStroke = '';
        textContent.style.textStroke = '';
        textContent.style.paintOrder = '';
        textContent.style.mixBlendMode = '';
        textContent.style.filter = '';
    }

    const filterParts = [];

    if (style.dropShadow?.enabled) {
        const angle = ((Number(style.dropShadow.angle) || 0) * Math.PI) / 180;
        const distance = Number(style.dropShadow.distance) || 0;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const blur = Number(style.dropShadow.blur) || 0;
        filterParts.push(`drop-shadow(${x}px ${y}px ${blur}px ${withAlpha(style.dropShadow.color, style.dropShadow.opacity)})`);
    }

    if (style.outerGlow?.enabled) {
        const glow = Number(style.outerGlow.size) || 0;
        filterParts.push(`drop-shadow(0 0 ${glow}px ${withAlpha(style.outerGlow.color, style.outerGlow.opacity)})`);
        filterParts.push(`drop-shadow(0 0 ${Math.max(1, glow * 0.55)}px ${withAlpha(style.outerGlow.color, Math.max(0, style.outerGlow.opacity * 0.65))})`);
    }

    if (filterParts.length) {
        el.style.filter = filterParts.join(' ');
    }

    if (style.stroke?.enabled && layer.type === 'text' && textContent) {
        const strokeSize = Math.max(1, Number(style.stroke.size) || 1);
        const strokeColor = withAlpha(style.stroke.color, style.stroke.opacity);
        textContent.style.webkitTextStroke = `${strokeSize}px ${strokeColor}`;
        textContent.style.textStroke = `${strokeSize}px ${strokeColor}`;
        textContent.style.paintOrder = 'stroke fill';
        textContent.style.overflow = 'visible';
        textContent.style.filter = `drop-shadow(0 0 ${Math.max(0.35, strokeSize * 0.08)}px ${strokeColor})`;
    } else if (style.stroke?.enabled) {
        const shapeStrokeOverlay = layer.type === 'shape'
            ? createShapeStrokeOverlay(layer, style.stroke)
            : null;
        if (shapeStrokeOverlay) {
            fx.appendChild(shapeStrokeOverlay);
        } else {
            const strokeSize = Math.max(1, Number(style.stroke.size) || 1);
            const strokePosition = ['inside', 'center', 'outside'].includes(style.stroke.position)
                ? style.stroke.position
                : 'inside';
            const strokeInset = strokePosition === 'outside'
                ? -strokeSize
                : strokePosition === 'center'
                    ? -(strokeSize / 2)
                    : 0;
            const overlay = document.createElement('div');
            overlay.className = 'layer-style-overlay layer-style-stroke-overlay';
            overlay.style.inset = `${strokeInset}px`;
            overlay.style.border = `${strokeSize}px solid ${withAlpha(style.stroke.color, style.stroke.opacity)}`;
            const radius = Number(layer.radius) || 0;
            const radiusOffset = strokePosition === 'outside'
                ? strokeSize
                : strokePosition === 'center'
                    ? strokeSize / 2
                    : 0;
            overlay.style.borderRadius = layer.shapeType === 'circle'
                ? '999px'
                : radius
                    ? `${radius + radiusOffset}px`
                    : fx.style.borderRadius;
            overlay.style.boxSizing = 'border-box';
            overlay.style.mixBlendMode = style.stroke.blendMode || 'normal';
            overlay.style.clipPath = strokePosition === 'inside' ? clipPath : '';
            fx.appendChild(overlay);
        }
    }

    if (style.colorOverlay?.enabled) {
        if (layer.type === 'text') {
            fx.appendChild(createTextStyleOverlay(
                layer,
                withAlpha(style.colorOverlay.color, style.colorOverlay.opacity),
                style.colorOverlay.blendMode
            ));
        } else {
            const overlay = document.createElement('div');
            overlay.className = 'layer-style-overlay layer-style-color-overlay';
            overlay.style.background = withAlpha(style.colorOverlay.color, style.colorOverlay.opacity);
            overlay.style.mixBlendMode = style.colorOverlay.blendMode || 'normal';
            overlay.style.borderRadius = fx.style.borderRadius;
            overlay.style.clipPath = clipPath;
            applyLayerContentMask(overlay, layer);
            fx.appendChild(overlay);
        }
    }

    if (style.gradientOverlay?.enabled) {
        const stops = normalizeGradientPresetStops(
            style.gradientOverlay.stops,
            [style.gradientOverlay.color1, style.gradientOverlay.color2]
        ).map(stop => ({
            color: multiplyAlpha(stop.color, style.gradientOverlay.opacity),
            pos: stop.pos
        }));
        const background = buildGradientCssValue({
            gradientType: style.gradientOverlay.gradientType || 'linear',
            angle: Number(style.gradientOverlay.angle) || 0,
            stops
        });
        if (layer.type === 'text') {
            fx.appendChild(createTextStyleOverlay(
                layer,
                background,
                style.gradientOverlay.blendMode
            ));
        } else {
            const overlay = document.createElement('div');
            overlay.className = 'layer-style-overlay layer-style-gradient-overlay';
            overlay.style.background = background;
            overlay.style.mixBlendMode = style.gradientOverlay.blendMode || 'normal';
            overlay.style.borderRadius = fx.style.borderRadius;
            overlay.style.clipPath = clipPath;
            applyLayerContentMask(overlay, layer);
            fx.appendChild(overlay);
        }
    }

    if (style.patternOverlay?.enabled) {
        const overlay = document.createElement('div');
        overlay.className = 'layer-style-overlay layer-style-pattern-overlay';
        const patternCss = buildPatternOverlayCss(style.patternOverlay);
        overlay.style.backgroundImage = patternCss.backgroundImage;
        overlay.style.backgroundSize = patternCss.backgroundSize;
        overlay.style.backgroundColor = 'transparent';
        overlay.style.mixBlendMode = style.patternOverlay.blendMode || 'overlay';
        overlay.style.borderRadius = fx.style.borderRadius;
        overlay.style.clipPath = clipPath;
        applyLayerContentMask(overlay, layer);
        fx.appendChild(overlay);
    }

    if (style.innerShadow?.enabled) {
        const overlay = document.createElement('div');
        overlay.className = 'layer-style-overlay layer-style-inner-shadow';
        const angle = ((Number(style.innerShadow.angle) || 0) * Math.PI) / 180;
        const distance = Number(style.innerShadow.distance) || 0;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const blur = Number(style.innerShadow.blur) || 0;
        const spread = Number(style.innerShadow.spread) || 0;
        overlay.style.boxShadow = `inset ${x}px ${y}px ${blur}px ${spread}px ${withAlpha(style.innerShadow.color, style.innerShadow.opacity)}`;
        overlay.style.mixBlendMode = style.innerShadow.blendMode || 'multiply';
        overlay.style.borderRadius = fx.style.borderRadius;
        overlay.style.clipPath = clipPath;
        fx.appendChild(overlay);
    }
}

function applyShapeLayerVisual(shapeEl, layer) {
    if (!shapeEl || !layer) return;

    shapeEl.style.background = layer.fill;
    shapeEl.style.border = 'none';
    shapeEl.style.borderRadius = '0px';
    shapeEl.style.clipPath = '';

    if (layer.stroke && String(layer.stroke).trim() && String(layer.stroke).trim() !== 'transparent') {
        shapeEl.style.border = `${Math.max(0, Number(layer.strokeWidth) || 1)}px solid ${layer.stroke}`;
        shapeEl.style.boxSizing = 'border-box';
    }

    const shapeType = layer.shapeType || 'rect';
    if (shapeType === 'rounded-rect' || layer.radius) {
        shapeEl.style.borderRadius = (layer.radius || 28) + 'px';
        return;
    }
    if (shapeType === 'circle') {
        shapeEl.style.borderRadius = '999px';
        return;
    }
    if (shapeType === 'triangle') {
        shapeEl.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
        return;
    }
    if (shapeType === 'hexagon') {
        shapeEl.style.clipPath = 'polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)';
    }
}

function applyTextLayerVisual(textEl, layer) {
    if (!textEl || !layer) return;
    const verticalAlign = ['top', 'middle', 'bottom'].includes(layer.verticalAlign) ? layer.verticalAlign : 'top';
    const justifyContent = verticalAlign === 'bottom'
        ? 'flex-end'
        : verticalAlign === 'middle'
            ? 'center'
            : 'flex-start';

    if (isFontAwesomeLayer(layer)) {
        textEl.innerHTML = `<i class="${esc(layer.fontAwesomeClass)}" aria-hidden="true"></i>`;
        textEl.style.display = 'flex';
        textEl.style.alignItems = 'center';
        textEl.style.justifyContent = 'center';
        textEl.style.padding = '0';
        textEl.style.overflow = 'visible';
        textEl.style.lineHeight = '1';
        textEl.style.whiteSpace = 'nowrap';
        textEl.style.wordBreak = 'normal';
    } else if (document.activeElement !== textEl) {
        textEl.textContent = layer.text;
        textEl.style.display = 'flex';
        textEl.style.flexDirection = 'column';
        textEl.style.alignItems = 'stretch';
        textEl.style.justifyContent = justifyContent;
        textEl.style.padding = '';
        textEl.style.overflow = 'hidden';
        textEl.style.lineHeight = '1.15';
        textEl.style.whiteSpace = 'pre-wrap';
        textEl.style.wordBreak = 'break-word';
        textEl.style.overflowWrap = 'anywhere';
    }

    textEl.style.fontSize = layer.fontSize + 'px';
    textEl.style.fontWeight = layer.fontWeight;
    textEl.style.textAlign = layer.textAlign;
    textEl.style.fontFamily = (layer.fontFamily || 'Inter') + ', Arial, sans-serif';
    textEl.style.fontStyle = layer.fontStyle || 'normal';
    textEl.style.textDecoration = layer.textDecoration || 'none';
    textEl.style.letterSpacing = layer.letterSpacing !== undefined ? `${Number(layer.letterSpacing) || 0}px` : '';
    textEl.style.padding = '0';
    textEl.style.boxSizing = 'border-box';
    textEl.style.maxWidth = '100%';
    textEl.style.width = '100%';
    textEl.style.height = '100%';
    textEl.style.justifyContent = isFontAwesomeLayer(layer) ? 'center' : justifyContent;

    if (layer.color && layer.color.includes('gradient')) {
        textEl.style.background = layer.color;
        textEl.style.webkitBackgroundClip = 'text';
        textEl.style.webkitTextFillColor = 'transparent';
        textEl.style.color = '';
    } else {
        textEl.style.background = '';
        textEl.style.webkitBackgroundClip = '';
        textEl.style.webkitTextFillColor = '';
        textEl.style.color = layer.color;
    }
}

function addLayer(type, overrides = {}) {
    if (!['text', 'shape', 'raster'].includes(type)) {
        console.warn('addLayer: bilinmeyen tip:', type);
        return null;
    }

    const result = window.StudioEngine?.applyCommand?.({
        action: 'add_layer',
        layer: {
            id: overrides.id || uid(),
            type,
            ...overrides
        }
    }, {
        includeContext: false
    });

    const targetId = result?.applied?.[0]?.targetId || null;
    return targetId ? getLayer(targetId) : null;
}

function createCanvasRasterLayer(overrides = {}) {
    return {
        id: uid(),
        type: 'raster',
        name: 'Raster Layer',
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        z: layers.length + 1,
        radius: 0,
        src: null,
        aspectLocked: true,
        canvasData: null,
        layerStyle: createDefaultLayerStyle(),
        ...overrides
    };
}

function addLayerFromTool(toolKey = currentTool, point = null) {
    const tool = allTools.find(item => item.key === toolKey) || null;
    if (!tool?.capabilities?.creates) return null;

    const x = point ? Math.round(Number(point.x) || 0) : undefined;
    const y = point ? Math.round(Number(point.y) || 0) : undefined;

    if (tool.capabilities.creates === 'text') {
        const result = window.StudioEngine?.applyCommand?.({
            action: 'add_layer',
            layer: {
                id: uid(),
                type: 'text',
                ...TOOL_PRESETS.text,
                ...(point ? { x, y } : {})
            }
        }, {
            includeContext: false
        });
        const layerId = result?.applied?.[0]?.targetId || null;
        const layer = layerId ? getLayer(layerId) : null;
        if (!layer) return null;

        requestAnimationFrame(() => {
            syncTextLayerSize(layer.id);
            const textEl = stage.querySelector(`.layer[data-id="${layer.id}"] .layer-text`);
            if (!textEl) return;
            textEl.focus();

            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(textEl);
            selection.removeAllRanges();
            selection.addRange(range);
        });

        return layer;
    }

    if (tool.capabilities.creates === 'shape') {
        const shapeType = tool.capabilities?.shapeType || 'rect';
        const radius = shapeType === 'rounded-rect' ? 28 : 0;
        const width = shapeType === 'circle' ? 220 : 240;
        const height = shapeType === 'circle' ? 220 : 240;
        const result = window.StudioEngine?.applyCommand?.({
            action: 'add_layer',
            layer: {
                id: uid(),
                type: 'shape',
                ...TOOL_PRESETS.shape,
                shapeType,
                radius,
                width,
                height,
                ...(point ? {
                    x: x - Math.round(width / 2),
                    y: y - Math.round(height / 2)
                } : {})
            }
        }, {
            includeContext: false
        });
        const layerId = result?.applied?.[0]?.targetId || null;
        return layerId ? getLayer(layerId) : null;
    }

    return null;
}

function focusTextLayerEditor(layerId, options = {}) {
    const { selectAll = false, placeCaretAtEnd = false } = options;
    const layer = getLayer(layerId);
    if (!layer || layer.type !== 'text') return;

    activeTextEditorId = layer.id;
    selectLayerViaEngine(layer.id);

    requestAnimationFrame(() => {
        const textEl = stage.querySelector(`.layer[data-id="${layer.id}"] .layer-text`);
        if (!textEl) return;

        textEl.focus();

        const selection = window.getSelection();
        if (!selection) return;

        if (selectAll) {
            const range = document.createRange();
            range.selectNodeContents(textEl);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }

        if (placeCaretAtEnd) {
            const range = document.createRange();
            range.selectNodeContents(textEl);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    });
}

function getRasterInsertPosition(width, height) {
    return {
        x: Math.max(0, Math.round((canvasWidth - width) / 2)),
        y: Math.max(0, Math.round((canvasHeight - height) / 2)),
    };
}

function addRasterFromImage(src, name = 'Raster Layer') {
    const img = new Image();
    img.onload = () => {
        const w = img.width;
        const h = img.height;
        const pos = getRasterInsertPosition(w, h);
        window.StudioEngine?.applyCommand?.({
            action: 'add_layer',
            layer: {
                id: uid(),
                type: 'raster',
                ...TOOL_PRESETS.image,
                aspectLocked: true,
                name,
                src,
                width: w,
                height: h,
                x: pos.x,
                y: pos.y
            }
        }, {
            includeContext: false
        });
    };
    img.src = src;
}

window.addLayer = addLayer;
window.addLayerFromTool = addLayerFromTool;
window.focusTextLayerEditor = focusTextLayerEditor;
window.syncTextLayerSize = syncTextLayerSize;
window.patchLayerElement = patchLayerElement;

function patchLayerElement(id) {
    const layer = getLayer(id);
    const el = stage.querySelector(`.layer[data-id="${id}"]`);
    if (!layer || !el) return;

    el.style.left = layer.x + 'px';
    el.style.top = layer.y + 'px';
    el.style.width = layer.width + 'px';
    el.style.height = layer.height + 'px';
    el.style.opacity = layer.opacity;
    el.style.zIndex = layer.z;
    el.style.transform = `rotate(${layer.rotation}deg)`;
    el.style.borderRadius = (layer.radius || 0) + 'px';

    const inner = el.querySelector('.layer-inner');
    if (inner) inner.style.borderRadius = (layer.radius || 0) + 'px';
    const content = el.querySelector('.layer-content');
    const fx = el.querySelector('.layer-fx');

    if (layer.type === 'shape') {
        const shape = el.querySelector('.layer-shape');
        if (shape) {
            applyShapeLayerVisual(shape, layer);
        }
    }

    if (layer.type === 'raster') {
        const img = el.querySelector('.layer-image');
        if (img && layer.src) {
            if (/^https?:\/\//i.test(layer.src)) img.crossOrigin = 'anonymous';
            img.src = layer.src;
        }
    }

    if (layer.type === 'text') {
        const text = el.querySelector('.layer-text');
        if (text) {
            applyTextLayerVisual(text, layer);
        }
    }

    if (inner && content && fx) {
        applyLayerStyleVisuals(el, inner, content, fx, layer);
    }
}

function measureTextLayerSize(layer, textValue) {
    const probe = document.createElement('div');
    const content = typeof textValue === 'string' ? textValue : (layer.text || '');

    probe.style.position = 'fixed';
    probe.style.left = '-99999px';
    probe.style.top = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.whiteSpace = 'pre-wrap';
    probe.style.wordBreak = 'break-word';
    probe.style.overflowWrap = 'anywhere';
    probe.style.lineHeight = '1.15';
    probe.style.padding = '0';
    probe.style.border = 'none';
    probe.style.outline = 'none';
    const maxTextWidth = Math.max(40, canvasWidth - (Number(layer.x) || 0));
    probe.style.width = `${maxTextWidth}px`;
    probe.style.maxWidth = `${maxTextWidth}px`;
    probe.style.minWidth = '0';
    probe.style.minHeight = '0';
    probe.style.fontSize = layer.fontSize + 'px';
    probe.style.fontWeight = layer.fontWeight;
    probe.style.textAlign = layer.textAlign;
    probe.style.fontFamily = (layer.fontFamily || 'Inter') + ', Arial, sans-serif';
    probe.style.fontStyle = layer.fontStyle || 'normal';
    probe.style.textDecoration = layer.textDecoration || 'none';
    if (isFontAwesomeLayer(layer)) {
        probe.innerHTML = `<i class="${esc(layer.fontAwesomeClass)}" aria-hidden="true"></i>`;
    } else {
        probe.textContent = content || ' ';
    }

    document.body.appendChild(probe);
    const width = Math.max(40, Math.min(maxTextWidth, Math.ceil(probe.getBoundingClientRect().width)));
    const height = Math.max(Math.ceil(layer.fontSize * 1.4), Math.ceil(probe.getBoundingClientRect().height));
    probe.remove();

    if (isFontAwesomeLayer(layer)) {
        const safePadding = Math.max(12, Math.ceil(layer.fontSize * 0.18));
        return {
            width: Math.max(40, width + safePadding * 2),
            height: Math.max(40, height + safePadding * 2)
        };
    }

    return { width, height };
}

function syncTextLayerSize(layerId, textValue = null) {
    const layer = getLayer(layerId);
    if (!layer || layer.type !== 'text') return;

    const size = measureTextLayerSize(layer, textValue);
    layer.width = size.width;
    layer.height = size.height;
    patchLayerElement(layerId);
}

function updateLayer(id, patch, options = {}) {
    const layer = getLayer(id);
    if (!layer) return;
    const result = window.StudioEngine?.applyCommand?.({
        action: 'update_layer',
        target: id,
        patch
    }, {
        commitHistory: false,
        includeContext: false
    });

    if (result?.errors?.length) return;
    if (options.refreshLayerList) renderLayerList();
    if (options.skipHistory) return;
    if (options.historyMode === 'immediate') commitHistory();
    else scheduleHistoryCommit();
}

function duplicateSelected() {
    const ids = getSelectedLayerIds();
    const targetLayers = ids.length ? ids.map(id => getLayer(id)).filter(Boolean) : [getLayer()].filter(Boolean);
    if (!targetLayers.length) return;

    const commands = targetLayers.map(layer => {
        const copy = JSON.parse(JSON.stringify(layer));
        copy.id = uid();
        copy.name = layer.name + ' Copy';
        copy.x += 24;
        copy.y += 24;
        return {
            action: 'add_layer',
            layer: copy
        };
    });

    const result = window.StudioEngine?.applyCommands?.(commands, {
        includeContext: false
    });
    const copyIds = (result?.applied || []).map(item => item.targetId).filter(Boolean);
    if (copyIds.length) applyLayerSelection(copyIds, copyIds.at(-1));
}

function removeSelected() {
    const ids = getSelectedLayerIds();
    if (!ids.length) return;
    window.StudioEngine?.applyCommand?.({
        action: 'remove_layers',
        targets: ids
    }, {
        includeContext: false
    });
}

function toggleVisibility(id) {
    const layer = getLayer(id);
    if (!layer) return;
    window.StudioEngine?.applyCommand?.({
        action: 'toggle_visibility',
        target: id
    }, {
        includeContext: false
    });
}

function toggleLock(id) {
    const layer = getLayer(id);
    if (!layer) return;
    window.StudioEngine?.applyCommand?.({
        action: 'toggle_lock',
        target: id
    }, {
        includeContext: false
    });
}

function removeLayerById(id) {
    window.StudioEngine?.applyCommand?.({
        action: 'remove_layer',
        target: id
    }, {
        includeContext: false
    });
}

function getLayerPanelOrderIds() {
    return [...layers].reverse().map(layer => layer.id);
}

function applyLayerSelection(ids = [], anchorId = null, options = {}) {
    const normalizedIds = studioEngineNormalizeSelection(ids);
    if (!normalizedIds.length) {
        window.StudioEngine?.applyCommand?.({ action: 'clear_selection' }, {
            commitHistory: false,
            includeContext: false,
            render: options.render !== false
        });
        return;
    }

    window.StudioEngine?.applyCommand?.({
        action: 'select_layers',
        targets: normalizedIds,
        anchorId: anchorId || normalizedIds.at(-1)
    }, {
        commitHistory: false,
        includeContext: false,
        render: options.render !== false
    });

    if (selectedId && typeof syncColorWidgetFromLayer === 'function') syncColorWidgetFromLayer(selectedId);
    if (options.refreshContextBar !== false && typeof renderContextBar === 'function') renderContextBar();
    if (options.refreshInspector !== false && typeof refreshInspectorFlyoutIfNeeded === 'function') refreshInspectorFlyoutIfNeeded();
}

function selectLayerFromPanel(id, event = null) {
    if (!id) return;

    const panelOrder = getLayerPanelOrderIds();
    const currentSelection = getSelectedLayerIds();
    const isToggle = !!(event?.metaKey || event?.ctrlKey);
    const isRange = !!event?.shiftKey;
    let nextSelection = [id];
    let anchorId = layerSelectionAnchorId || selectedId || id;

    if (isRange) {
        const anchorIndex = panelOrder.indexOf(anchorId);
        const targetIndex = panelOrder.indexOf(id);
        if (anchorIndex !== -1 && targetIndex !== -1) {
            const start = Math.min(anchorIndex, targetIndex);
            const end = Math.max(anchorIndex, targetIndex);
            nextSelection = panelOrder.slice(start, end + 1);
        }
    } else if (isToggle) {
        anchorId = id;
        nextSelection = currentSelection.includes(id)
            ? currentSelection.filter(item => item !== id)
            : [...currentSelection, id];
    } else {
        anchorId = id;
        nextSelection = [id];
    }

    if (!nextSelection.length) {
        applyLayerSelection([]);
        return;
    }

    applyLayerSelection(nextSelection, anchorId);
}

function applyLayerBox(el, l) {
    el.style.left = l.x + 'px';
    el.style.top = l.y + 'px';
    el.style.width = l.width + 'px';
    el.style.height = l.height + 'px';
    el.style.opacity = l.opacity;
    el.style.zIndex = l.z;
    el.style.transform = `rotate(${l.rotation}deg)`;
    el.style.borderRadius = (l.radius || 0) + 'px';
}

function renderStage() {
    stage.innerHTML = '';
    stage.classList.toggle('empty', layers.length === 0);

    layers.forEach(l => {
        if (l.type === 'group') return;
        const isSelected = getSelectedLayerIds().includes(l.id);
        const showTextFrame = l.type === 'text' && (currentTool === 'text' || activeTextEditorId === l.id || isSelected);
        const item = document.createElement('div');
        item.className =
            'layer' +
            (isSelected ? ' selected' : '') +
            (showTextFrame ? ' text-frame-visible' : '') +
            (isLayerLockedInTree(l) ? ' locked' : '') +
            (!isLayerVisibleInTree(l) ? ' hidden' : '');
        item.dataset.id = l.id;
        item.dataset.type = l.type;
        applyLayerBox(item, l);
        if (currentTool === 'move' && !isAutoSelectEnabled && selectedId && !isAutoSelectModifierPressed) {
            item.style.pointerEvents = isSelected ? '' : 'none';
        } else {
            item.style.pointerEvents = '';
        }

        const inner = document.createElement('div');
        inner.className = 'layer-inner';
        inner.style.borderRadius = (l.radius || 0) + 'px';
        const content = document.createElement('div');
        content.className = 'layer-content';

        if (l.type === 'raster') {
            if (l.src) {
                const img = document.createElement('img');
                img.className = 'layer-image';
                if (/^https?:\/\//i.test(l.src)) img.crossOrigin = 'anonymous';
                img.src = l.src;
                img.style.cssText = 'width:100%;height:100%;display:block;object-fit:fill;';
                content.appendChild(img);
            } else {
                const canvas = document.createElement('canvas');
                canvas.className = 'layer-canvas';
                canvas.width = Math.round(l.width);
                canvas.height = Math.round(l.height);
                canvas.style.cssText = 'width:100%;height:100%;display:block;';
                if (l.canvasData) {
                    const tempImg = new Image();
                    tempImg.onload = () => canvas.getContext('2d').drawImage(tempImg, 0, 0);
                    tempImg.src = l.canvasData;
                }
                content.appendChild(canvas);
            }
        }

        if (l.type === 'shape') {
            const shape = document.createElement('div');
            shape.className = 'layer-shape';
            applyShapeLayerVisual(shape, l);
            content.appendChild(shape);
        }

        if (l.type === 'text') {
            const iconLayer = isFontAwesomeLayer(l);
            const isTextEditable = !iconLayer && (currentTool === 'text' || activeTextEditorId === l.id);
            const text = document.createElement('div');
            text.className = 'layer-text';
            text.contentEditable = isTextEditable ? 'true' : 'false';
            text.spellcheck = false;
            text.style.pointerEvents = isTextEditable ? 'auto' : 'none';
            applyTextLayerVisual(text, l);
            text.addEventListener('mousedown', e => {
                if (isTextEditable) e.stopPropagation();
            });
            if (!iconLayer) {
                text.addEventListener('focus', () => {
                    activeTextEditorId = l.id;
                    window.StudioEngine?.applyCommand?.({
                        action: 'select_layer',
                        target: l.id
                    }, {
                        commitHistory: false,
                        includeContext: false,
                        render: false
                    });
                    textEditSnapshot = text.innerText.replace(/\r/g, '');
                    renderLayerList();
                });
                text.addEventListener('input', () => {
                    const current = getLayer(l.id);
                    if (current) {
                        const nextText = text.innerText.replace(/\r/g, '');
                        const shouldAutoFit = (current.autoFitText !== false) && (current.verticalAlign || 'top') === 'top';
                        const size = shouldAutoFit ? measureTextLayerSize(current, nextText) : null;
                        window.StudioEngine?.applyCommand?.({
                            action: 'update_layer',
                            target: l.id,
                            patch: {
                                text: nextText,
                                ...(size ? { width: size.width, height: size.height } : {})
                            },
                            autoFitText: shouldAutoFit
                        }, {
                            commitHistory: false,
                            includeContext: false,
                            render: false
                        });
                    }
                });
                text.addEventListener('blur', () => {
                    activeTextEditorId = null;
                    const nextText = text.innerText.replace(/\r/g, '');
                    const current = getLayer(l.id);
                    const shouldAutoFit = current ? ((current.autoFitText !== false) && (current.verticalAlign || 'top') === 'top') : false;
                    const size = current && shouldAutoFit ? measureTextLayerSize(current, nextText) : null;
                    if (textEditSnapshot !== null && textEditSnapshot !== nextText) {
                        applyLayerPatchViaEngine(l.id, {
                            text: nextText,
                            ...(size ? { width: size.width, height: size.height } : {})
                        }, {
                            autoFitText: shouldAutoFit,
                            historyMode: 'immediate',
                            refreshInspector: true
                        });
                    } else {
                        render();
                    }
                    textEditSnapshot = null;
                });
            }
            content.appendChild(text);
        }

        inner.appendChild(content);
        const fx = document.createElement('div');
        fx.className = 'layer-fx';
        inner.appendChild(fx);

        item.appendChild(inner);
        applyLayerStyleVisuals(item, inner, content, fx, l);

        item.addEventListener('click', e => {
            if (e.target.classList.contains('layer-text')) return;
            const modifierSelect = currentTool === 'move' && !isAutoSelectEnabled && (e.metaKey || e.ctrlKey);
            if (currentTool === 'move' && !isAutoSelectEnabled && !modifierSelect) return;
            if (selectedId !== l.id) {
                applyLayerSelection([l.id], l.id);
            }
        });

        stage.appendChild(item);
    });

    bindInteractions();
    bindDrawEvents();
    renderTransformOverlay();
    updateStageOverflow();
}

let sortableInstance = null;
const collapsedGroupIds = new Set();

function startLayerNameEdit(id) {
    const layer = getLayer(id);
    if (!layer) return;
    selectLayerViaEngine(id);
    activeInlineEditorId = id;
    layerNameEditSnapshot = layer.name;
    renderLayerList();
    refreshInspectorFlyoutIfNeeded();
}

function handleLayerNameInput(id, value) {
    const layer = getLayer(id);
    if (!layer) return;
    layer.name = value;
    refreshInspectorFlyoutIfNeeded();
}

function finishLayerNameEdit(id, options = {}) {
    const { commit = true, restore = false } = options;
    const layer = getLayer(id);
    if (!layer) return;

    if (restore && layerNameEditSnapshot !== null) {
        layer.name = layerNameEditSnapshot;
    }

    const didChange = layerNameEditSnapshot !== null && layer.name !== layerNameEditSnapshot;
    activeInlineEditorId = null;
    layerNameEditSnapshot = null;
    renderLayerList();
    refreshInspectorFlyoutIfNeeded();

    if (commit && didChange) {
        applyLayerPatchViaEngine(id, { name: layer.name }, {
            historyMode: 'immediate',
            refreshLayerList: true,
            refreshInspector: true
        });
    }
}

function renderLayerList() {
    updateLayerActionButtons();

    if (!layers.length) {
        layerList.innerHTML = '<div class="muted-box">Henüz katman yok. Sol araç çubuğundan yeni katman ekle.</div>';
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
        return;
    }

    const selectedLayerIds = getSelectedLayerIds();
    const renderLayerRow = (l, depth = 0) => `
        <div class="layer-row ${l.type === 'group' ? 'is-group' : ''} ${selectedLayerIds.includes(l.id) ? 'active' : ''}" data-id="${l.id}" data-depth="${depth}" style="--layer-depth:${depth}">
            <div class="layer-row-top">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    ${l.type === 'group' ? `
                    <button
                        class="layer-collapse-btn"
                        type="button"
                        title="${collapsedGroupIds.has(l.id) ? 'Grubu Aç' : 'Grubu Kapat'}"
                        onclick="event.stopPropagation(); toggleGroupCollapse('${l.id}')">
                        <i class="fa-solid ${collapsedGroupIds.has(l.id) ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>
                    </button>
                    ` : depth > 0 ? `<span class="layer-collapse-spacer"></span>` : ''}
                    <span class="layer-type-icon" title="${esc(l.type)}" ondblclick="event.stopPropagation(); openLayerStyleModal('${l.id}')">
                        <i class="fa-solid ${getLayerTypeIcon(l.type)}"></i>
                    </span>
                    <div>
                        ${activeInlineEditorId === l.id ? `
                        <input
                            id="layerNameEditor_${l.id}"
                            class="layer-name-input"
                            type="text"
                            value="${esc(l.name)}"
                            onclick="event.stopPropagation()"
                            onmousedown="event.stopPropagation()"
                            oninput="handleLayerNameInput('${l.id}', this.value)"
                            onkeydown="if(event.key === 'Enter'){ event.preventDefault(); this.blur(); } if(event.key === 'Escape'){ event.preventDefault(); finishLayerNameEdit('${l.id}', { commit: false, restore: true }); }"
                            onblur="if(activeInlineEditorId === '${l.id}') finishLayerNameEdit('${l.id}')">
                        ` : `
                        <button
                            class="layer-name-button"
                            type="button"
                            onclick="event.stopPropagation(); selectLayerFromPanel('${l.id}', event)"
                            ondblclick="event.stopPropagation(); startLayerNameEdit('${l.id}')">
                            <span class="layer-name">${esc(l.name.length > 15 ? l.name.slice(0, 15) : l.name)}</span>
                        </button>
                        `}
                    </div>
                </div>
                <div class="layer-row-meta">
                    ${!l.visible ? '<span class="layer-status-chip" title="Gizli"><i class="fa-solid fa-eye-slash"></i></span>' : ''}
                    ${l.locked ? '<span class="layer-status-chip" title="Kilitli"><i class="fa-solid fa-lock"></i></span>' : ''}
                </div>
            </div>
        </div>
    `;
    const topLevelLayers = [...layers].reverse().filter(layer => !layer.parentId);

    layerList.innerHTML = topLevelLayers.map(l => {
        if (l.type !== 'group') return renderLayerRow(l);
        const children = [...layers].reverse().filter(child => child.parentId === l.id);
        return renderLayerRow(l) + (collapsedGroupIds.has(l.id) ? '' : children.map(child => renderLayerRow(child, 1)).join(''));
    }).join('');

    layerList.querySelectorAll('.layer-row[data-id]').forEach(row => {
        row.addEventListener('click', event => {
            if (event.target.closest('input, button')) return;
            selectLayerFromPanel(row.dataset.id, event);
        });
    });

    if (sortableInstance) {
        sortableInstance.destroy();
    }

    sortableInstance = Sortable.create(layerList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        filter: 'input, button',
        preventOnFilter: false,
        onEnd(event) {
            const draggedId = event.item?.dataset?.id;
            const draggedLayer = getLayer(draggedId);
            const prevRow = event.item?.previousElementSibling;
            const prevLayer = prevRow ? getLayer(prevRow.dataset.id) : null;
            const nextRow = event.item?.nextElementSibling;
            const nextLayer = nextRow ? getLayer(nextRow.dataset.id) : null;
            let nextParentId = null;

            if (draggedLayer?.type !== 'group') {
                if (prevLayer?.type === 'group') {
                    nextParentId = prevLayer.id;
                } else if (prevLayer?.parentId) {
                    nextParentId = prevLayer.parentId;
                } else if (nextLayer?.parentId) {
                    nextParentId = nextLayer.parentId;
                }
            }

            const reversedIds = [...layerList.querySelectorAll('.layer-row')].map(el => el.dataset.id);
            const orderedIds = [...reversedIds].reverse();
            const commands = orderedIds.length === layers.length
                ? [{
                    action: 'reorder_layers',
                    order: orderedIds
                }]
                : [];

            if (draggedLayer && draggedLayer.type !== 'group' && (draggedLayer.parentId || null) !== nextParentId) {
                commands.push({
                    action: 'move_to_group',
                    target: draggedLayer.id,
                    groupId: nextParentId
                });
            }

            if (commands.length) {
                window.StudioEngine?.applyCommands?.(commands, {
                    includeContext: false
                });
            } else {
                renderLayerList();
            }
        }
    });

    if (activeInlineEditorId) {
        requestAnimationFrame(() => {
            const input = document.getElementById(`layerNameEditor_${activeInlineEditorId}`);
            if (!input) return;
            input.focus();
            input.select();
        });
    }
}

function toggleGroupCollapse(id) {
    if (collapsedGroupIds.has(id)) collapsedGroupIds.delete(id);
    else collapsedGroupIds.add(id);
    renderLayerList();
}

function groupSelectedLayers() {
    const selected = getSelectedLayerIds();
    if (selected.length === 1 && getLayer(selected[0])?.type === 'group') {
        window.StudioEngine?.applyCommand?.({
            action: 'ungroup_layer',
            target: selected[0]
        }, {
            includeContext: false
        });
        return;
    }

    const ids = selected.filter(id => getLayer(id)?.type !== 'group');
    if (ids.length < 2) return;
    window.StudioEngine?.applyCommand?.({
        action: 'group_layers',
        targets: ids,
        name: 'Group'
    }, {
        includeContext: false
    });
}

function updateLayerActionButtons() {
    const layer = getLayer();
    const ids = getSelectedLayerIds();
    const hasSelection = ids.length > 0;

    if (duplicateBtn) duplicateBtn.disabled = !hasSelection || ids.some(id => getLayer(id)?.type === 'group');
    if (groupBtn) {
        const selectedGroup = ids.length === 1 && getLayer(ids[0])?.type === 'group';
        const groupableCount = ids.filter(id => getLayer(id)?.type !== 'group').length;
        groupBtn.disabled = !selectedGroup && groupableCount < 2;
        groupBtn.title = selectedGroup ? 'Grubu Çöz' : 'Grupla';
    }
    if (deleteBtn) deleteBtn.disabled = !hasSelection;
    if (visibilityBtn) {
        visibilityBtn.disabled = !hasSelection;
        visibilityBtn.title = hasSelection ? (layer.visible ? 'Gizle' : 'Göster') : 'Gizle / Göster';
    }
    if (visibilityBtnIcon) {
        visibilityBtnIcon.className = `fa-regular ${hasSelection && !layer.visible ? 'fa-eye-slash' : 'fa-eye'}`;
    }
    if (lockBtn) {
        lockBtn.disabled = !hasSelection;
        lockBtn.title = hasSelection ? (layer.locked ? 'Kilidi Aç' : 'Kilitle') : 'Kilitle / Kilidi Aç';
    }
    if (lockBtnIcon) {
        lockBtnIcon.className = `fa-solid ${hasSelection && layer.locked ? 'fa-lock' : 'fa-lock-open'}`;
    }
}
