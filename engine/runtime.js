(function () {
    const defaults = {
        stage: document.createElement('div'),
        layers: [],
        selectedId: null,
        selectedIds: [],
        layerSelectionAnchorId: null,
        canvasWidth: 1080,
        canvasHeight: 1080,
        projectName: 'Adsiz Proje',
        cwFgColor: '#000000',
        cwBgColor: '#ffffff',
        gradientToolPreset: {
            gradientType: 'linear',
            angle: 135,
            colors: ['#000000', '#ffffff'],
            stops: [
                { color: '#000000', pos: 0 },
                { color: '#ffffff', pos: 100 }
            ]
        },
        allTools: [],
        currentTool: 'move',
        rasterSelectionState: null,
        drawState: {
            brushSize: 35,
            hardness: 100,
            blurStrength: 1,
            tolerance: 30,
            contiguous: true,
            eraserMode: 'pixel',
            isDrawing: false,
            isSelecting: false,
            lastX: 0,
            lastY: 0,
            selectionStartX: 0,
            selectionStartY: 0,
            selectionPoints: []
        }
    };

    Object.keys(defaults).forEach(key => {
        if (typeof window[key] === 'undefined') window[key] = defaults[key];
    });

    if (typeof window.setCanvasSize !== 'function') {
        window.setCanvasSize = function setCanvasSize(width, height) {
            canvasWidth = Math.max(100, Math.round(Number(width) || 1080));
            canvasHeight = Math.max(100, Math.round(Number(height) || 1080));
            if (stage?.style) {
                stage.style.width = `${canvasWidth}px`;
                stage.style.height = `${canvasHeight}px`;
            }
        };
    }

    if (typeof window.createDefaultLayerStyle !== 'function') {
        window.createDefaultLayerStyle = function createDefaultLayerStyle() {
            return {
                blendMode: 'normal',
                fillOpacity: 100,
                stroke: {
                    enabled: false,
                    color: '#ffffff',
                    opacity: 100,
                    size: 4,
                    position: 'inside',
                    blendMode: 'normal'
                },
                colorOverlay: {
                    enabled: false,
                    color: '#3b82f6',
                    opacity: 100,
                    blendMode: 'normal'
                },
                gradientOverlay: {
                    enabled: false,
                    gradientType: 'linear',
                    angle: 90,
                    color1: '#3b82f6',
                    color2: '#8b5cf6',
                    stops: [
                        { color: '#3b82f6', pos: 0 },
                        { color: '#8b5cf6', pos: 100 }
                    ],
                    opacity: 100,
                    blendMode: 'normal'
                },
                patternOverlay: {
                    enabled: false,
                    pattern: 'dots',
                    foreground: '#ffffff',
                    background: '#0f172a',
                    opacity: 32,
                    scale: 24,
                    blendMode: 'overlay'
                },
                innerShadow: {
                    enabled: false,
                    color: '#000000',
                    opacity: 45,
                    angle: 120,
                    distance: 8,
                    blur: 18,
                    spread: 0,
                    blendMode: 'multiply'
                },
                outerGlow: {
                    enabled: false,
                    color: '#60a5fa',
                    opacity: 70,
                    size: 18,
                    blendMode: 'screen'
                },
                dropShadow: {
                    enabled: false,
                    color: '#000000',
                    opacity: 45,
                    angle: 120,
                    distance: 12,
                    blur: 18,
                    spread: 0,
                    blendMode: 'multiply'
                }
            };
        };
    }

    if (typeof window.createCanvasRasterLayer !== 'function') {
        window.createCanvasRasterLayer = function createCanvasRasterLayer(overrides = {}) {
            return {
                id: `layer_engine_${Math.random().toString(36).slice(2, 10)}`,
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
        };
    }

    [
        'render',
        'updateDocumentTitle',
        'commitHistory',
        'refreshInspectorFlyoutIfNeeded',
        'syncTextLayerSize'
    ].forEach(name => {
        if (typeof window[name] !== 'function') window[name] = function noop() {};
    });
}());
