// ── Brush cursor overlay ───────────────────────────────────────────────────
let brushCursorEl = null;

function createBrushCursor() {
    if (brushCursorEl) return;
    brushCursorEl = document.createElement('div');
    brushCursorEl.id = 'brushCursor';
    brushCursorEl.style.cssText = `
        position: fixed;
        pointer-events: none;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.9);
        box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
        transform: translate(-50%,-50%);
        z-index: 99999;
        display: none;
        mix-blend-mode: difference;
        transition: width 0.05s, height 0.05s;
    `;
    document.body.appendChild(brushCursorEl);
}

function updateBrushCursor(e) {
    if (!brushCursorEl) return;
    const size = drawState.brushSize * zoom;
    brushCursorEl.style.width = size + 'px';
    brushCursorEl.style.height = size + 'px';
    brushCursorEl.style.left = e.clientX + 'px';
    brushCursorEl.style.top = e.clientY + 'px';
    brushCursorEl.style.display = 'block';
}

function hideBrushCursor() {
    if (brushCursorEl) brushCursorEl.style.display = 'none';
}
