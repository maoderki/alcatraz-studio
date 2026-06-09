const IMAGE_UPSCALE_STYLE_ID = 'studio-plugin-image-upscale-style';

function ensureImageUpscaleStyles(app) {
    if (document.getElementById(IMAGE_UPSCALE_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = IMAGE_UPSCALE_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function formatSize(width, height) {
    return `${Math.round(width)} × ${Math.round(height)}`;
}

function formatMultiplier(scale) {
    return `${scale.toFixed(scale >= 10 ? 1 : 2)}x`;
}

function calculateCoverSize(layer, canvasSize) {
    const width = Math.max(1, Number(layer?.width) || 1);
    const height = Math.max(1, Number(layer?.height) || 1);
    const scale = Math.max(
        canvasSize.width / width,
        canvasSize.height / height
    );

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scale
    };
}

function computeCenteredPlacement(layer, nextSize) {
    const currentCenterX = (Number(layer?.x) || 0) + ((Number(layer?.width) || 0) / 2);
    const currentCenterY = (Number(layer?.y) || 0) + ((Number(layer?.height) || 0) / 2);

    return {
        x: Math.round(currentCenterX - (nextSize.width / 2)),
        y: Math.round(currentCenterY - (nextSize.height / 2))
    };
}

function loadImageFromSource(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Görsel yüklenemedi.'));
        img.src = src;
    });
}

async function resizeDataUrl(dataUrl, width, height) {
    const image = await loadImageFromSource(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
}

registerStudioPlugin({
    id: 'image-upscale',
    name: 'Image Upscale',
    menuLabel: 'Image Upscale',
    icon: 'fa-solid fa-up-right-and-down-left-from-center',
    init(app) {
        ensureImageUpscaleStyles(app);
    },
    openModal(app) {
        const selectedLayer = app.getSelectedLayer();
        const canvasSize = app.getCanvasSize();
        const source = selectedLayer?.src || selectedLayer?.canvasData || '';
        const isRaster = selectedLayer?.type === 'raster' && !!source;
        const targetSize = isRaster ? calculateCoverSize(selectedLayer, canvasSize) : null;
        const nextPlacement = isRaster ? computeCenteredPlacement(selectedLayer, targetSize) : null;

        return {
            title: 'Image Upscale',
            subtitle: 'Seçili raster görseli canvas ölçüsünü cover edecek boyuta AI ile büyüt.',
            html: `
                <div class="plugin-form image-upscale-plugin">
                    ${!isRaster ? `
                        <div class="muted-box">Önce bir raster görsel seç. Bu plugin text veya shape katmanlarda çalışmaz.</div>
                    ` : `
                        <div class="upscale-stats">
                            <div class="upscale-stat">
                                <div class="upscale-stat-label">Mevcut Boyut</div>
                                <div class="upscale-stat-value">${formatSize(selectedLayer.width, selectedLayer.height)}</div>
                            </div>
                            <div class="upscale-stat">
                                <div class="upscale-stat-label">Hedef Boyut</div>
                                <div class="upscale-stat-value">${formatSize(targetSize.width, targetSize.height)}</div>
                            </div>
                            <div class="upscale-stat">
                                <div class="upscale-stat-label">Büyütme</div>
                                <div class="upscale-stat-value">${formatMultiplier(targetSize.scale)}</div>
                            </div>
                        </div>

                        <div class="upscale-meta">
                            <div class="upscale-meta-row">
                                <span>Canvas</span>
                                <strong>${formatSize(canvasSize.width, canvasSize.height)}</strong>
                            </div>
                            <div class="upscale-meta-row">
                                <span>Katman</span>
                                <strong>${selectedLayer.name || 'Raster Layer'}</strong>
                            </div>
                            <div class="upscale-meta-row">
                                <span>Yeni Konum</span>
                                <strong>X: ${nextPlacement.x}, Y: ${nextPlacement.y}</strong>
                            </div>
                        </div>
                    `}

                    <div class="upscale-hint">
                        İşlem bu pluginin kendi backend ayarını kullanır ve seçili katmanı doğrudan günceller.
                    </div>

                    <button id="imageUpscaleRun" class="plugin-primary-btn" type="button" ${!isRaster ? 'disabled' : ''}>
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Upscale Yap
                    </button>
                    <div id="imageUpscaleStatus" class="plugin-status"></div>
                </div>
            `,
            onOpen({ root }) {
                const runButton = root.querySelector('#imageUpscaleRun');
                const status = root.querySelector('#imageUpscaleStatus');

                runButton?.addEventListener('click', async () => {
                    if (!status) return;

                    const latestLayer = app.getSelectedLayer();
                    const latestSource = latestLayer?.src || latestLayer?.canvasData || '';
                    if (latestLayer?.type !== 'raster' || !latestSource) {
                        status.textContent = 'Seçili katman geçerli bir raster görsel değil.';
                        return;
                    }

                    const latestCanvasSize = app.getCanvasSize();
                    const latestTargetSize = calculateCoverSize(latestLayer, latestCanvasSize);
                    const latestPlacement = computeCenteredPlacement(latestLayer, latestTargetSize);

                    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Görsel upscale ediliyor...';
                    runButton.disabled = true;

                    try {
                        const response = await fetch(app.getBackendUrl('upscale.php'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                source: latestSource,
                                targetWidth: latestTargetSize.width,
                                targetHeight: latestTargetSize.height
                            })
                        });

                        const data = await response.json();
                        if (!response.ok || data.error) {
                            throw new Error(data.error || `İstek başarısız oldu (${response.status})`);
                        }

                        if (!data.imageDataUrl) {
                            throw new Error('Upscale görseli dönmedi.');
                        }

                        const exactSizedDataUrl = await resizeDataUrl(
                            data.imageDataUrl,
                            latestTargetSize.width,
                            latestTargetSize.height
                        );

                        app.updateLayer(latestLayer.id, {
                            src: exactSizedDataUrl,
                            canvasData: null,
                            width: latestTargetSize.width,
                            height: latestTargetSize.height,
                            x: latestPlacement.x,
                            y: latestPlacement.y,
                            aspectLocked: true
                        }, {
                            refreshLayerList: true,
                            historyMode: 'immediate'
                        });

                        status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> Görsel ${formatSize(latestTargetSize.width, latestTargetSize.height)} boyutuna büyütüldü.`;
                        app.closeModal();
                    } catch (error) {
                        status.textContent = 'Upscale hatası: ' + error.message;
                    } finally {
                        runButton.disabled = false;
                    }
                });
            }
        };
    }
});
