let layers = [];
let selectedId = null;
let selectedIds = [];
let layerSelectionAnchorId = null;
let zoom = 1;
let rotateState = null;
let activeTextEditorId = null;
let activeInlineEditorId = null;
let layerNameEditSnapshot = null;
let canvasWidth = 1080;
let canvasHeight = 1080;
let projectName = 'Adsız Proje';
let templateFunctions = [];
let isTransformEditMode = false;
let isAutoSelectEnabled = false;
let isAutoSelectModifierPressed = false;

let cwFgColor = '#000000';
let cwBgColor = '#ffffff';
let cwActiveSlot = 'fg';
let gradientToolPreset = {
    gradientType: 'linear',
    angle: 135,
    colors: [cwFgColor, cwBgColor],
    stops: [
        { color: cwFgColor, pos: 0 },
        { color: cwBgColor, pos: 100 }
    ]
};
let gradientEditorUiState = {
    contextOpen: false,
    targetKey: '',
    selectedStopIndex: 0,
    selectedHandle: 'color'
};
let isSpacePanMode = false;
let spacePanSession = null;

let allTools = [];
let currentTool = 'move';
let activeSelectionTool = 'select-rect';
let activeShapeTool = 'shape';
let activeFillTool = 'bucket';
let textEditSnapshot = null;
let rasterSelectionState = null;
let activeLayerStyleSection = 'blending';

function createDefaultLayerStyle() {
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
}

const TOOL_PRESETS = {
    text: {
        name: 'Text Layer',
        text: 'Yeni metin',
        color: cwFgColor,
        fontSize: 42,
        fontWeight: 400,
        fontStyle: 'normal',
        textAlign: 'left',
        verticalAlign: 'top',
        textDecoration: 'none',
        fontFamily: 'Inter',
        autoFitText: true,
        opacity: 1,
        radius: 0,
    },
    shape: {
        name: 'Shape Layer',
        fill: cwFgColor,
        shapeType: 'rect',
        aspectLocked: true,
        radius: 0,
        opacity: 1,
    },
    image: {
        name: 'Raster Layer',
        aspectLocked: true,
        radius: 0,
        opacity: 1,
    }
};

const drawState = {
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
};
