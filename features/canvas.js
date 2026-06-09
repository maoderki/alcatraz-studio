function fitStageToView() {
    const wrapWidth = stageWrap.clientWidth - 44;
    const wrapHeight = stageWrap.clientHeight - 44;
    if (wrapWidth <= 0 || wrapHeight <= 0) return;
    const scaleX = wrapWidth / canvasWidth;
    const scaleY = wrapHeight / canvasHeight;
    const nextZoom = Math.min(scaleX, scaleY, 1);
    setZoom(nextZoom);
}

function setCanvasSize(w, h) {
    canvasWidth = Math.max(100, Math.round(w));
    canvasHeight = Math.max(100, Math.round(h));
    stage.style.width = canvasWidth + 'px';
    stage.style.height = canvasHeight + 'px';
    if (newProjectWidthInput) newProjectWidthInput.value = canvasWidth;
    if (newProjectHeightInput) newProjectHeightInput.value = canvasHeight;
    document.querySelectorAll('[data-canvas-size-preset]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.canvasSizePreset === `${canvasWidth}x${canvasHeight}`);
    });
    updateStageOverflow();
}

function updateStageOverflow() {
    const overlayWidth = transformOverlay ? transformOverlay.offsetWidth : 0;
    const overlayHeight = transformOverlay ? transformOverlay.offsetHeight : 0;
    const needX = Math.max(stage.offsetWidth * zoom, overlayWidth) > stageWrap.clientWidth + 1;
    const needY = Math.max(stage.offsetHeight * zoom, overlayHeight) > stageWrap.clientHeight + 1;
    stageWrap.classList.toggle('fit-view', !needX && !needY);
}
