// ── Eyedropper Tool ────────────────────────────────────────────────────────
function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (/^https?:\/\//i.test(src)) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Gorsel yuklenemedi: ${src}`));
        img.src = src;
    });
}

function getRadialGradientCenter(gradientString, layer) {
    const match = String(gradientString || '').match(/circle\s+at\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/i);
    if (!match) {
        return {
            x: layer.x + layer.width / 2,
            y: layer.y + layer.height / 2
        };
    }

    return {
        x: layer.x + (layer.width * (Number(match[1]) / 100)),
        y: layer.y + (layer.height * (Number(match[2]) / 100))
    };
}

function cssGradientAngleToCanvasRadians(angle) {
    return (((Number(angle) || 0) - 90) * Math.PI) / 180;
}

function isLayerVisibleForRender(layer) {
    if (!layer || layer.visible === false) return false;
    let parentId = layer.parentId;
    while (parentId) {
        const parent = Array.isArray(layers) ? layers.find(item => item.id === parentId) : null;
        if (!parent || parent.visible === false) return false;
        parentId = parent.parentId;
    }
    return true;
}

function shouldPreferCanvasStyledExport() {
    if (typeof navigator === 'undefined') return false;
    const ua = String(navigator.userAgent || navigator.vendor || '');
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const isTouchMac = /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
    return isMobile || isTouchMac;
}

function layerHasGradientBasedStyling(layer, style) {
    if (!layer) return false;
    if (typeof layer.fill === 'string' && layer.fill.includes('gradient(')) return true;
    if (typeof layer.color === 'string' && layer.color.includes('gradient(')) return true;
    return !!style?.gradientOverlay?.enabled;
}

function fillShapeToContext(ctx, layer) {
    const hasStroke = layer.stroke && String(layer.stroke).trim() && String(layer.stroke).trim() !== 'transparent';
    const strokeWidth = Math.max(0, Number(layer.strokeWidth) || 0);

    if (layer.fill && layer.fill.includes('gradient')) {
        const colors = parseGradientColors(layer.fill);
        const isRadial = layer.fill.includes('radial');
        let fill = layer.fill;

        if (colors.length >= 2) {
            if (isRadial) {
                const center = getRadialGradientCenter(layer.fill, layer);
                const cx = center.x;
                const cy = center.y;
                const radius = Math.max(layer.width, layer.height) / 2;
                fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            } else {
                const angleMatch = layer.fill.match(/(\d+)deg/);
                const angle = cssGradientAngleToCanvasRadians(Number(angleMatch?.[1]) || 0);
                const cx = layer.x + layer.width / 2;
                const cy = layer.y + layer.height / 2;
                const len = Math.sqrt(layer.width * layer.width + layer.height * layer.height) / 2;
                const dx = Math.cos(angle) * len;
                const dy = Math.sin(angle) * len;
                fill = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
            }

            colors.forEach((color, index) => {
                fill.addColorStop(index / (colors.length - 1), color);
            });
        }

        ctx.fillStyle = fill;
    } else {
        ctx.fillStyle = layer.fill || 'transparent';
    }

    const shapeType = layer.shapeType || 'rect';
    const paint = () => {
        ctx.fill();
        if (hasStroke && strokeWidth > 0) {
            ctx.strokeStyle = layer.stroke;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
        }
    };

    if (shapeType === 'circle') {
        ctx.beginPath();
        ctx.ellipse(
            layer.x + (layer.width / 2),
            layer.y + (layer.height / 2),
            layer.width / 2,
            layer.height / 2,
            0,
            0,
            Math.PI * 2
        );
        paint();
        return;
    }

    if (shapeType === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(layer.x + (layer.width / 2), layer.y);
        ctx.lineTo(layer.x, layer.y + layer.height);
        ctx.lineTo(layer.x + layer.width, layer.y + layer.height);
        ctx.closePath();
        paint();
        return;
    }

    if (shapeType === 'hexagon') {
        const x = layer.x;
        const y = layer.y;
        const w = layer.width;
        const h = layer.height;
        ctx.beginPath();
        ctx.moveTo(x + (w * 0.25), y + (h * 0.06));
        ctx.lineTo(x + (w * 0.75), y + (h * 0.06));
        ctx.lineTo(x + w, y + (h * 0.5));
        ctx.lineTo(x + (w * 0.75), y + (h * 0.94));
        ctx.lineTo(x + (w * 0.25), y + (h * 0.94));
        ctx.lineTo(x, y + (h * 0.5));
        ctx.closePath();
        paint();
        return;
    }

    if (shapeType === 'rounded-rect' || layer.radius) {
        roundRect(ctx, layer.x, layer.y, layer.width, layer.height, layer.radius);
        paint();
    } else {
        ctx.beginPath();
        ctx.rect(layer.x, layer.y, layer.width, layer.height);
        paint();
    }
}

function paintTextGlyph(ctx, text, x, y, paintMode) {
    if (paintMode === 'stroke') {
        ctx.strokeText(text, x, y);
        return;
    }
    ctx.fillText(text, x, y);
}

function fillTextToContext(ctx, layer, paintMode = 'fill') {
    ctx.font = `${layer.fontStyle || 'normal'} ${layer.fontWeight || 400} ${layer.fontSize || 42}px ${layer.fontFamily || 'Inter'}, Arial`;
    const isFontAwesomeLayer = typeof layer.fontAwesomeClass === 'string' && layer.fontAwesomeClass.trim();
    ctx.textAlign = isFontAwesomeLayer ? 'center' : (layer.textAlign || 'left');
    ctx.textBaseline = isFontAwesomeLayer ? 'middle' : 'alphabetic';

    if (layer.color && layer.color.includes('gradient')) {
        const colors = parseGradientColors(layer.color);
        const isRadial = layer.color.includes('radial');
        let fill = layer.color;

        if (colors.length >= 2) {
            if (isRadial) {
                const cx = layer.x + layer.width / 2;
                const cy = layer.y + layer.height / 2;
                const radius = Math.max(layer.width, layer.height) / 2;
                fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            } else {
                const angleMatch = layer.color.match(/(\d+)deg/);
                const angle = cssGradientAngleToCanvasRadians(Number(angleMatch?.[1]) || 0);
                const cx = layer.x + layer.width / 2;
                const cy = layer.y + layer.height / 2;
                const len = Math.sqrt(layer.width * layer.width + layer.height * layer.height) / 2;
                const dx = Math.cos(angle) * len;
                const dy = Math.sin(angle) * len;
                fill = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
            }

            colors.forEach((color, index) => {
                fill.addColorStop(index / (colors.length - 1), color);
            });
        }

        ctx.fillStyle = fill;
    } else {
        ctx.fillStyle = layer.color || '#fff';
    }

    if (isFontAwesomeLayer) {
        paintTextGlyph(ctx, layer.text || '', layer.x + (layer.width / 2), layer.y + (layer.height / 2), paintMode);
        return;
    }

    const fontSize = layer.fontSize || 42;
    const lineHeight = Math.round(fontSize * 1.15);
    const letterSpacing = Number(layer.letterSpacing) || 0;
    const maxWidth = Math.max(1, Number(layer.width) || 1);
    const maxHeight = Math.max(lineHeight, Number(layer.height) || lineHeight);
    const lines = wrapTextLines(ctx, String(layer.text || ''), maxWidth, letterSpacing);
    const verticalAlign = ['top', 'middle', 'bottom'].includes(layer.verticalAlign) ? layer.verticalAlign : 'top';
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight);
    const verticalOffset = verticalAlign === 'bottom'
        ? (maxHeight - blockHeight)
        : verticalAlign === 'middle'
            ? Math.round((maxHeight - blockHeight) / 2)
            : 0;
    let textX = layer.x;
    if ((layer.textAlign || 'left') === 'center') textX = layer.x + (layer.width / 2);
    if ((layer.textAlign || 'left') === 'right') textX = layer.x + layer.width;

    ctx.save();
    ctx.beginPath();
    ctx.rect(layer.x, layer.y, maxWidth, maxHeight);
    ctx.clip();

    lines.forEach((line, index) => {
        const y = layer.y + verticalOffset + fontSize + (index * lineHeight);
        if (y > layer.y + maxHeight) return;

        if (!letterSpacing || !line) {
            paintTextGlyph(ctx, line, textX, y, paintMode);
            return;
        }

        const chars = [...line];
        const totalWidth = chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + (letterSpacing * Math.max(0, chars.length - 1));
        let cursorX = textX;
        if ((layer.textAlign || 'left') === 'center') cursorX -= totalWidth / 2;
        if ((layer.textAlign || 'left') === 'right') cursorX -= totalWidth;

        chars.forEach(char => {
            paintTextGlyph(ctx, char, cursorX, y, paintMode);
            cursorX += ctx.measureText(char).width + letterSpacing;
        });
    });

    ctx.restore();
}

function measureTextWithLetterSpacing(ctx, text, letterSpacing = 0) {
    const chars = [...String(text || '')];
    if (!chars.length) return 0;
    return chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + (letterSpacing * Math.max(0, chars.length - 1));
}

function splitLongWord(ctx, word, maxWidth, letterSpacing = 0) {
    const chunks = [];
    let current = '';

    [...String(word || '')].forEach(char => {
        const next = current + char;
        if (current && measureTextWithLetterSpacing(ctx, next, letterSpacing) > maxWidth) {
            chunks.push(current);
            current = char;
            return;
        }
        current = next;
    });

    if (current) chunks.push(current);
    return chunks;
}

function wrapTextParagraph(ctx, paragraph, maxWidth, letterSpacing = 0) {
    const words = String(paragraph || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];

    const lines = [];
    let current = '';

    words.forEach(word => {
        const wordChunks = measureTextWithLetterSpacing(ctx, word, letterSpacing) > maxWidth
            ? splitLongWord(ctx, word, maxWidth, letterSpacing)
            : [word];

        wordChunks.forEach(chunk => {
            const next = current ? `${current} ${chunk}` : chunk;
            if (current && measureTextWithLetterSpacing(ctx, next, letterSpacing) > maxWidth) {
                lines.push(current);
                current = chunk;
                return;
            }
            current = next;
        });
    });

    if (current) lines.push(current);
    return lines;
}

function wrapTextLines(ctx, text, maxWidth, letterSpacing = 0) {
    return String(text || '')
        .split('\n')
        .flatMap(paragraph => wrapTextParagraph(ctx, paragraph, maxWidth, letterSpacing));
}

async function drawLayerToContext(ctx, layer) {
    if (!isLayerVisibleForRender(layer)) return;
    if (layer.type === 'group') return;

    ctx.save();
    const style = typeof getLayerStyle === 'function' ? getLayerStyle(layer) : createDefaultLayerStyle();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = getCanvasBlendMode(style?.blendMode || 'normal');

    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    try {
        const fillOpacity = clamp(numberOr(style.fillOpacity, 100), 0, 100);
        const needsStyleComposite =
            fillOpacity < 100 ||
            !!style.stroke?.enabled ||
            !!style.colorOverlay?.enabled ||
            !!style.gradientOverlay?.enabled;

        // Export path: when layer styles are active, DOM rasterization preserves
        // CSS blend/overlay behavior (especially gradient overlays) one-to-one.
        const mobileCanvasFallback = shouldPreferCanvasStyledExport() && layerHasGradientBasedStyling(layer, style);

        if (needsStyleComposite && !mobileCanvasFallback) {
            const handledByDomRaster = await drawStyledLayerFromStage(ctx, layer);
            if (handledByDomRaster) {
                return;
            }
        }

        if (needsStyleComposite) {
            const composed = await renderLayerToStyledCanvas(layer, style);
            if (composed) {
                const drawX = Number.isFinite(composed._studioDrawX) ? composed._studioDrawX : layer.x;
                const drawY = Number.isFinite(composed._studioDrawY) ? composed._studioDrawY : layer.y;
                ctx.drawImage(composed, drawX, drawY);
                return;
            }
        }

        await drawLayerBaseToContext(ctx, layer);
    } finally {
        ctx.restore();
    }
}

function getCanvasBlendMode(mode = 'normal') {
    const normalized = String(mode || 'normal').trim().toLowerCase();
    const supported = new Set([
        'source-over',
        'multiply',
        'screen',
        'overlay',
        'soft-light',
        'hard-light',
        'color-dodge',
        'color-burn',
        'difference',
        'exclusion',
        'luminosity'
    ]);
    if (normalized === 'normal') return 'source-over';
    return supported.has(normalized) ? normalized : 'source-over';
}

function traceLayerLocalPath(ctx, layer, width, height) {
    const shapeType = layer?.type === 'shape' ? (layer.shapeType || 'rect') : 'rect';
    const x = Number(layer?.x) || 0;
    const y = Number(layer?.y) || 0;
    const w = Math.max(1, Number(layer?.width) || width || 1);
    const h = Math.max(1, Number(layer?.height) || height || 1);
    const radius = Math.max(0, Math.min(Number(layer?.radius) || 0, w / 2, h / 2));

    ctx.beginPath();

    if (shapeType === 'circle') {
        ctx.ellipse(x + (w / 2), y + (h / 2), w / 2, h / 2, 0, 0, Math.PI * 2);
        return;
    }

    if (shapeType === 'triangle') {
        ctx.moveTo(x + (w / 2), y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
        return;
    }

    if (shapeType === 'hexagon') {
        ctx.moveTo(x + (w * 0.25), y + (h * 0.06));
        ctx.lineTo(x + (w * 0.75), y + (h * 0.06));
        ctx.lineTo(x + w, y + (h * 0.5));
        ctx.lineTo(x + (w * 0.75), y + (h * 0.94));
        ctx.lineTo(x + (w * 0.25), y + (h * 0.94));
        ctx.lineTo(x, y + (h * 0.5));
        ctx.closePath();
        return;
    }

    roundRect(ctx, x, y, w, h, radius);
}

async function drawLayerBaseToContext(ctx, layer) {
    if (layer.type === 'shape') {
        fillShapeToContext(ctx, layer);
        return;
    }

    if (layer.type === 'raster') {
        const src = layer.exportSrc || layer.src || layer.canvasData;
        if (!src) return;
        const img = await loadImageElement(src);
        ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
        return;
    }

    if (layer.type === 'text') {
        const handledByRaster = layer.fontAwesomeClass
            ? await drawFontAwesomeLayerFromStage(ctx, layer)
            : false;

        if (!handledByRaster) {
            fillTextToContext(ctx, layer);
        }
    }
}

function paintGradientOverlayToLocalContext(ctx, overlayStyle, width, height) {
    const stops = normalizeGradientPresetStops(
        overlayStyle?.stops,
        [overlayStyle?.color1, overlayStyle?.color2]
    ).map(stop => ({
        color: typeof multiplyAlpha === 'function'
            ? multiplyAlpha(stop.color, overlayStyle?.opacity ?? 100)
            : withAlpha(stop.color, overlayStyle?.opacity ?? 100),
        pos: stop.pos
    }));
    if (stops.length < 2) return;

    let gradient;
    if ((overlayStyle?.gradientType || 'linear') === 'radial') {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.max(width, height) / 2;
        gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    } else {
        const angle = cssGradientAngleToCanvasRadians(clamp(numberOr(overlayStyle?.angle, 0), 0, 360));
        const cx = width / 2;
        const cy = height / 2;
        const len = Math.sqrt((width * width) + (height * height)) / 2;
        const dx = Math.cos(angle) * len;
        const dy = Math.sin(angle) * len;
        gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    }

    stops.forEach(stop => {
        gradient.addColorStop(clamp(stop.pos / 100, 0, 1), stop.color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function createLayerAlphaMaskCanvas(sourceCanvas) {
    if (!sourceCanvas) return null;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = sourceCanvas.width;
    maskCanvas.height = sourceCanvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return null;
    maskCtx.drawImage(sourceCanvas, 0, 0);
    return maskCanvas;
}

async function createLayerContentMaskCanvas(layer, width, height) {
    if (!layer) return null;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return null;

    maskCtx.save();
    maskCtx.fillStyle = '#000';
    maskCtx.strokeStyle = '#000';

    if (layer.type === 'shape') {
        traceLayerLocalPath(maskCtx, layer, width, height);
        maskCtx.fill();
        maskCtx.restore();
        return maskCanvas;
    }

    if (layer.type === 'text') {
        const handledByRaster = layer.fontAwesomeClass
            ? await drawFontAwesomeLayerFromStage(maskCtx, layer)
            : false;

        if (!handledByRaster) {
            fillTextToContext(maskCtx, { ...layer, color: '#000000' });
        }

        maskCtx.restore();
        return maskCanvas;
    }

    if (layer.type === 'raster') {
        const src = layer.exportSrc || layer.src || layer.canvasData;
        if (!src) {
            maskCtx.restore();
            return maskCanvas;
        }
        const img = await loadImageElement(src);
        maskCtx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
        maskCtx.restore();
        return maskCanvas;
    }

    maskCtx.restore();
    return maskCanvas;
}

function paintMaskedStyleOverlay(targetCtx, maskCanvas, width, height, blendMode, paintOverlay) {
    if (!targetCtx || !maskCanvas || typeof paintOverlay !== 'function') return;

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;

    paintOverlay(overlayCtx);
    overlayCtx.globalCompositeOperation = 'destination-in';
    overlayCtx.drawImage(maskCanvas, 0, 0);

    targetCtx.save();
    targetCtx.globalCompositeOperation = getCanvasBlendMode(blendMode);
    targetCtx.drawImage(overlayCanvas, 0, 0);
    targetCtx.restore();
}

function paintPatternOverlayToLocalContext(ctx, patternStyle, width, height) {
    if (!ctx || !patternStyle) return;

    const scale = Math.max(6, Number(patternStyle.scale) || 24);
    const fg = withAlpha(patternStyle.foreground, patternStyle.opacity);
    const bg = withAlpha(patternStyle.background, Math.max(0, (Number(patternStyle.opacity) || 0) * 0.45));
    const tile = document.createElement('canvas');
    tile.width = scale;
    tile.height = scale;
    const tileCtx = tile.getContext('2d');
    if (!tileCtx) return;

    tileCtx.clearRect(0, 0, scale, scale);

    if (patternStyle.pattern === 'grid') {
        tileCtx.fillStyle = bg;
        tileCtx.fillRect(0, 0, scale, scale);
        tileCtx.fillStyle = fg;
        tileCtx.fillRect(0, 0, scale, 1);
        tileCtx.fillRect(0, 0, 1, scale);
    } else if (patternStyle.pattern === 'stripes') {
        tileCtx.strokeStyle = fg;
        tileCtx.lineWidth = Math.max(2, scale * 0.25);
        tileCtx.beginPath();
        tileCtx.moveTo(-scale * 0.2, scale);
        tileCtx.lineTo(scale, -scale * 0.2);
        tileCtx.stroke();
    } else if (patternStyle.pattern === 'cross') {
        tileCtx.strokeStyle = fg;
        tileCtx.lineWidth = 1;
        tileCtx.beginPath();
        tileCtx.moveTo(0, scale - 1);
        tileCtx.lineTo(scale, scale - 1);
        tileCtx.moveTo(scale - 1, 0);
        tileCtx.lineTo(scale - 1, scale);
        tileCtx.stroke();
    } else {
        tileCtx.fillStyle = fg;
        tileCtx.beginPath();
        tileCtx.arc(scale / 2, scale / 2, Math.max(1, scale * 0.18), 0, Math.PI * 2);
        tileCtx.fill();
    }

    const pattern = ctx.createPattern(tile, 'repeat');
    if (!pattern) return;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
}

function drawShadowOnlyFromCanvas(sourceCanvas, shadowOptions = {}) {
    if (!sourceCanvas) return null;
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = sourceCanvas.width;
    shadowCanvas.height = sourceCanvas.height;
    const shadowCtx = shadowCanvas.getContext('2d');
    if (!shadowCtx) return null;

    shadowCtx.save();
    shadowCtx.shadowColor = shadowOptions.color || 'rgba(0,0,0,0.5)';
    shadowCtx.shadowBlur = Math.max(0, Number(shadowOptions.blur) || 0);
    shadowCtx.shadowOffsetX = Number(shadowOptions.x) || 0;
    shadowCtx.shadowOffsetY = Number(shadowOptions.y) || 0;
    shadowCtx.drawImage(sourceCanvas, 0, 0);
    shadowCtx.restore();
    shadowCtx.globalCompositeOperation = 'destination-out';
    shadowCtx.drawImage(sourceCanvas, 0, 0);
    return shadowCanvas;
}

function estimateStyledEffectPadding(style) {
    let padding = style?.stroke?.enabled ? Math.ceil(Math.max(1, Number(style.stroke.size) || 1) + 4) : 0;

    if (style?.dropShadow?.enabled) {
        const distance = Math.max(0, Number(style.dropShadow.distance) || 0);
        const blur = Math.max(0, Number(style.dropShadow.blur) || 0);
        const spread = Math.max(0, Number(style.dropShadow.spread) || 0);
        padding = Math.max(padding, Math.ceil(distance + blur + spread + 8));
    }

    if (style?.outerGlow?.enabled) {
        const glow = Math.max(0, Number(style.outerGlow.size) || 0);
        padding = Math.max(padding, Math.ceil((glow * 2) + 8));
    }

    return padding;
}

async function renderLayerToStyledCanvas(layer, style) {
    const baseWidth = Math.max(1, Math.round(layer.width));
    const baseHeight = Math.max(1, Math.round(layer.height));
    const effectPadding = estimateStyledEffectPadding(style);
    const width = baseWidth + (effectPadding * 2);
    const height = baseHeight + (effectPadding * 2);
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    offscreen._studioDrawX = layer.x - effectPadding;
    offscreen._studioDrawY = layer.y - effectPadding;

    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return null;

    const localLayer = { ...layer, x: effectPadding, y: effectPadding, width: baseWidth, height: baseHeight };
    const fillOpacity = clamp(numberOr(style?.fillOpacity, 100) / 100, 0, 1);

    offCtx.save();
    offCtx.globalAlpha = fillOpacity;
    await drawLayerBaseToContext(offCtx, localLayer);
    offCtx.restore();

    const alphaMask = await createLayerContentMaskCanvas(localLayer, width, height)
        || createLayerAlphaMaskCanvas(offscreen);

    if (style?.stroke?.enabled) {
        paintStrokeToStyledCanvas(offCtx, localLayer, style.stroke, width, height);
    }

    if (style?.colorOverlay?.enabled) {
        paintMaskedStyleOverlay(offCtx, alphaMask, width, height, style.colorOverlay.blendMode, overlayCtx => {
            overlayCtx.fillStyle = withAlpha(style.colorOverlay.color, style.colorOverlay.opacity);
            overlayCtx.fillRect(0, 0, width, height);
        });
    }

    if (style?.gradientOverlay?.enabled) {
        paintMaskedStyleOverlay(offCtx, alphaMask, width, height, style.gradientOverlay.blendMode, overlayCtx => {
            paintGradientOverlayToLocalContext(overlayCtx, style.gradientOverlay, width, height);
        });
    }

    if (style?.patternOverlay?.enabled) {
        paintMaskedStyleOverlay(offCtx, alphaMask, width, height, style.patternOverlay.blendMode, overlayCtx => {
            paintPatternOverlayToLocalContext(overlayCtx, style.patternOverlay, width, height);
        });
    }

    const compositeSnapshot = document.createElement('canvas');
    compositeSnapshot.width = width;
    compositeSnapshot.height = height;
    const compositeCtx = compositeSnapshot.getContext('2d');
    if (compositeCtx) {
        compositeCtx.drawImage(offscreen, 0, 0);
    }

    if (style?.dropShadow?.enabled && compositeCtx) {
        const angle = ((Number(style.dropShadow.angle) || 0) * Math.PI) / 180;
        const distance = Number(style.dropShadow.distance) || 0;
        const shadowOnly = drawShadowOnlyFromCanvas(compositeSnapshot, {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            blur: Number(style.dropShadow.blur) || 0,
            color: withAlpha(style.dropShadow.color, style.dropShadow.opacity)
        });
        if (shadowOnly) {
            offCtx.save();
            offCtx.globalCompositeOperation = getCanvasBlendMode(style.dropShadow.blendMode || 'normal');
            offCtx.drawImage(shadowOnly, 0, 0);
            offCtx.restore();
        }
    }

    if (style?.outerGlow?.enabled && compositeCtx) {
        const primaryGlow = drawShadowOnlyFromCanvas(compositeSnapshot, {
            x: 0,
            y: 0,
            blur: Number(style.outerGlow.size) || 0,
            color: withAlpha(style.outerGlow.color, style.outerGlow.opacity)
        });
        const secondaryGlow = drawShadowOnlyFromCanvas(compositeSnapshot, {
            x: 0,
            y: 0,
            blur: Math.max(1, (Number(style.outerGlow.size) || 0) * 0.55),
            color: withAlpha(style.outerGlow.color, Math.max(0, (Number(style.outerGlow.opacity) || 0) * 0.65))
        });
        offCtx.save();
        offCtx.globalCompositeOperation = getCanvasBlendMode(style.outerGlow.blendMode || 'screen');
        if (primaryGlow) offCtx.drawImage(primaryGlow, 0, 0);
        if (secondaryGlow) offCtx.drawImage(secondaryGlow, 0, 0);
        offCtx.restore();
    }

    return offscreen;
}

function paintStrokeToStyledCanvas(ctx, layer, strokeStyle, width, height) {
    const size = Math.max(1, Number(strokeStyle?.size) || 1);
    if (layer?.type === 'text') {
        ctx.save();
        const blendMode = strokeStyle?.blendMode || 'normal';
        ctx.globalCompositeOperation = blendMode === 'normal'
            ? 'destination-over'
            : getCanvasBlendMode(blendMode);
        ctx.strokeStyle = withAlpha(strokeStyle?.color || '#ffffff', strokeStyle?.opacity ?? 100);
        ctx.lineWidth = size;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.miterLimit = 2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = Math.max(0.35, size * 0.08);
        fillTextToContext(ctx, layer, 'stroke');
        ctx.restore();
        return;
    }

    const position = ['inside', 'center', 'outside'].includes(strokeStyle?.position)
        ? strokeStyle.position
        : 'inside';
    const lineWidth = position === 'inside' ? size * 2 : position === 'outside' ? size * 2 : size;
    const strokeCanvas = document.createElement('canvas');
    strokeCanvas.width = width;
    strokeCanvas.height = height;
    const strokeCtx = strokeCanvas.getContext('2d');
    if (!strokeCtx) return;

    strokeCtx.save();
    strokeCtx.strokeStyle = withAlpha(strokeStyle?.color || '#ffffff', strokeStyle?.opacity ?? 100);
    strokeCtx.lineWidth = lineWidth;
    strokeCtx.lineJoin = 'round';
    strokeCtx.lineCap = 'round';
    strokeCtx.miterLimit = 2;
    traceLayerLocalPath(strokeCtx, layer, width, height);
    strokeCtx.stroke();

    if (position === 'inside' || position === 'outside') {
        strokeCtx.globalCompositeOperation = position === 'inside' ? 'destination-in' : 'destination-out';
        traceLayerLocalPath(strokeCtx, layer, width, height);
        strokeCtx.fillStyle = '#000';
        strokeCtx.fill();
    }
    strokeCtx.restore();

    ctx.save();
    ctx.globalCompositeOperation = getCanvasBlendMode(strokeStyle?.blendMode || 'normal');
    ctx.drawImage(strokeCanvas, 0, 0);
    ctx.restore();
}

async function drawFontAwesomeLayerFromStage(ctx, layer) {
    if (typeof stage === 'undefined') return false;
    const liveNode = stage.querySelector(`.layer[data-id="${layer.id}"] .layer-text`);
    if (!liveNode || typeof domtoimage?.toPng !== 'function') return false;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        width: ${Math.max(1, Math.round(layer.width))}px;
        height: ${Math.max(1, Math.round(layer.height))}px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        pointer-events: none;
        overflow: visible;
    `;

    const clone = liveNode.cloneNode(true);
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.display = 'flex';
    clone.style.alignItems = 'center';
    clone.style.justifyContent = 'center';
    clone.style.padding = '0';
    clone.style.overflow = 'visible';
    clone.style.whiteSpace = 'nowrap';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
        const dataUrl = await domtoimage.toPng(wrapper, {
            width: Math.max(1, Math.round(layer.width)),
            height: Math.max(1, Math.round(layer.height)),
            bgcolor: null
        });
        const img = await loadImageElement(dataUrl);
        ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
        return true;
    } catch (error) {
        console.warn('Font Awesome export rasterize warning:', error);
        return false;
    } finally {
        wrapper.remove();
    }
}

async function drawStyledLayerFromStage(ctx, layer) {
    if (typeof stage === 'undefined') return false;
    const liveNode = stage.querySelector(`.layer[data-id="${layer.id}"]`);
    if (!liveNode || typeof domtoimage?.toPng !== 'function') return false;

    const width = Math.max(1, Math.round(layer.width));
    const height = Math.max(1, Math.round(layer.height));

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        width: ${width}px;
        height: ${height}px;
        display: block;
        background: transparent;
        pointer-events: none;
        overflow: visible;
    `;

    const clone = liveNode.cloneNode(true);
    clone.style.left = '0px';
    clone.style.top = '0px';
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.transform = 'none';
    clone.style.opacity = '1';
    clone.classList.remove('selected');
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
        const dataUrl = await domtoimage.toPng(wrapper, {
            width,
            height,
            bgcolor: null
        });
        const img = await loadImageElement(dataUrl);
        ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
        return true;
    } catch (error) {
        console.warn('Styled layer export rasterize warning:', error);
        return false;
    } finally {
        wrapper.remove();
    }
}

async function ensureExportFontsReady() {
    if (!document.fonts?.load) return;

    const fontLoads = layers
        .filter(layer => layer?.type === 'text' && layer.visible !== false)
        .map(layer => document.fonts.load(
            `${layer.fontStyle || 'normal'} ${layer.fontWeight || 400} ${layer.fontSize || 42}px "${layer.fontFamily || 'Inter'}"`,
            layer.text || ' '
        ).catch(() => []));

    await Promise.all(fontLoads);
    if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => {});
    }
}

window.drawLayerToContext = drawLayerToContext;
window.ensureExportFontsReady = ensureExportFontsReady;
