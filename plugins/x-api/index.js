const X_API_STYLE_ID = 'studio-plugin-x-api-style';

function ensureXApiStyles(app) {
    if (document.getElementById(X_API_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = X_API_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function xApiEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function xApiGetBadgeMarkup(badge) {
    if (badge === 'gold') {
        return `
            <span class="x-api-badge x-api-badge-gold" title="Dogrulanmis kurumsal hesap">
                <svg viewBox="0 0 22 22" aria-label="Onaylanmis hesap" role="img" class="x-api-badge-svg">
                    <g>
                        <linearGradient gradientUnits="userSpaceOnUse" id="x-api-gold-a" x1="4.411" x2="18.083" y1="2.495" y2="21.508">
                            <stop offset="0" stop-color="#f4e72a"></stop>
                            <stop offset=".539" stop-color="#cd8105"></stop>
                            <stop offset=".68" stop-color="#cb7b00"></stop>
                            <stop offset="1" stop-color="#f4ec26"></stop>
                            <stop offset="1" stop-color="#f4e72a"></stop>
                        </linearGradient>
                        <linearGradient gradientUnits="userSpaceOnUse" id="x-api-gold-b" x1="5.355" x2="16.361" y1="3.395" y2="19.133">
                            <stop offset="0" stop-color="#f9e87f"></stop>
                            <stop offset=".406" stop-color="#e2b719"></stop>
                            <stop offset=".989" stop-color="#e2b719"></stop>
                        </linearGradient>
                        <g clip-rule="evenodd" fill-rule="evenodd">
                            <path d="M13.324 3.848L11 1.6 8.676 3.848l-3.201-.453-.559 3.184L2.06 8.095 3.48 11l-1.42 2.904 2.856 1.516.559 3.184 3.201-.452L11 20.4l2.324-2.248 3.201.452.559-3.184 2.856-1.516L18.52 11l1.42-2.905-2.856-1.516-.559-3.184zm-7.09 7.575l3.428 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z" fill="url(#x-api-gold-a)"></path>
                            <path d="M13.101 4.533L11 2.5 8.899 4.533l-2.895-.41-.505 2.88-2.583 1.37L4.2 11l-1.284 2.627 2.583 1.37.505 2.88 2.895-.41L11 19.5l2.101-2.033 2.895.41.505-2.88 2.583-1.37L17.8 11l1.284-2.627-2.583-1.37-.505-2.88zm-6.868 6.89l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z" fill="url(#x-api-gold-b)"></path>
                            <path d="M6.233 11.423l3.429 3.428 5.65-6.17.038-.033-.005 1.398-5.683 6.206-3.429-3.429-.003-1.405.005.003z" fill="#d18800"></path>
                        </g>
                    </g>
                </svg>
            </span>
        `;
    }
    if (badge === 'blue') {
        return `
            <span class="x-api-badge x-api-badge-blue" title="Mavi tikli hesap">
                <svg viewBox="0 0 22 22" aria-label="Onaylanmis hesap" role="img" class="x-api-badge-svg">
                    <g>
                        <path fill="#1d9bf0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816z"></path>
                        <path fill="#ffffff" d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"></path>
                    </g>
                </svg>
            </span>
        `;
    }
    if (badge === 'gray') {
        return `
            <span class="x-api-badge x-api-badge-gray" title="Resmi / kurumsal kamu hesabi">
                <svg viewBox="0 0 22 22" aria-label="Onaylanmis hesap" role="img" class="x-api-badge-svg">
                    <g>
                        <path clip-rule="evenodd" d="M12.05 2.056c-.568-.608-1.532-.608-2.1 0l-1.393 1.49c-.284.303-.685.47-1.1.455L5.42 3.932c-.832-.028-1.514.654-1.486 1.486l.069 2.039c.014.415-.152.816-.456 1.1l-1.49 1.392c-.608.568-.608 1.533 0 2.101l1.49 1.393c.304.284.47.684.456 1.1l-.07 2.038c-.027.832.655 1.514 1.487 1.486l2.038-.069c.415-.014.816.152 1.1.455l1.392 1.49c.569.609 1.533.609 2.102 0l1.393-1.49c.283-.303.684-.47 1.099-.455l2.038.069c.832.028 1.515-.654 1.486-1.486L18 14.542c-.015-.415.152-.815.455-1.099l1.49-1.393c.608-.568.608-1.533 0-2.101l-1.49-1.393c-.303-.283-.47-.684-.455-1.1l.068-2.038c.029-.832-.654-1.514-1.486-1.486l-2.038.07c-.415.013-.816-.153-1.1-.456zm-5.817 9.367l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z" fill="#829aab" fill-rule="evenodd"></path>
                    </g>
                </svg>
            </span>
        `;
    }
    return '';
}

function xApiBuildBadgeSvg(badge) {
    if (badge === 'gold') {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22">
                <defs>
                    <linearGradient gradientUnits="userSpaceOnUse" id="gold-a" x1="4.411" x2="18.083" y1="2.495" y2="21.508">
                        <stop offset="0" stop-color="#f4e72a"/>
                        <stop offset=".539" stop-color="#cd8105"/>
                        <stop offset=".68" stop-color="#cb7b00"/>
                        <stop offset="1" stop-color="#f4ec26"/>
                        <stop offset="1" stop-color="#f4e72a"/>
                    </linearGradient>
                    <linearGradient gradientUnits="userSpaceOnUse" id="gold-b" x1="5.355" x2="16.361" y1="3.395" y2="19.133">
                        <stop offset="0" stop-color="#f9e87f"/>
                        <stop offset=".406" stop-color="#e2b719"/>
                        <stop offset=".989" stop-color="#e2b719"/>
                    </linearGradient>
                </defs>
                <g clip-rule="evenodd" fill-rule="evenodd">
                    <path d="M13.324 3.848L11 1.6 8.676 3.848l-3.201-.453-.559 3.184L2.06 8.095 3.48 11l-1.42 2.904 2.856 1.516.559 3.184 3.201-.452L11 20.4l2.324-2.248 3.201.452.559-3.184 2.856-1.516L18.52 11l1.42-2.905-2.856-1.516-.559-3.184zm-7.09 7.575l3.428 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z" fill="url(#gold-a)"/>
                    <path d="M13.101 4.533L11 2.5 8.899 4.533l-2.895-.41-.505 2.88-2.583 1.37L4.2 11l-1.284 2.627 2.583 1.37.505 2.88 2.895-.41L11 19.5l2.101-2.033 2.895.41.505-2.88 2.583-1.37L17.8 11l1.284-2.627-2.583-1.37-.505-2.88zm-6.868 6.89l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z" fill="url(#gold-b)"/>
                    <path d="M6.233 11.423l3.429 3.428 5.65-6.17.038-.033-.005 1.398-5.683 6.206-3.429-3.429-.003-1.405.005.003z" fill="#d18800"/>
                </g>
            </svg>
        `;
    }
    if (badge === 'blue') {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22">
                <g>
                    <path fill="#1d9bf0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816z"/>
                    <path fill="#fff" d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>
                </g>
            </svg>
        `;
    }
    if (badge === 'gray') {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22">
                <g>
                    <path clip-rule="evenodd" d="M12.05 2.056c-.568-.608-1.532-.608-2.1 0l-1.393 1.49c-.284.303-.685.47-1.1.455L5.42 3.932c-.832-.028-1.514.654-1.486 1.486l.069 2.039c.014.415-.152.816-.456 1.1l-1.49 1.392c-.608.568-.608 1.533 0 2.101l1.49 1.393c.304.284.47.684.456 1.1l-.07 2.038c-.027.832.655 1.514 1.487 1.486l2.038-.069c.415-.014.816.152 1.1.455l1.392 1.49c.569.609 1.533.609 2.102 0l1.393-1.49c.283-.303.684-.47 1.099-.455l2.038.069c.832.028 1.515-.654 1.486-1.486L18 14.542c-.015-.415.152-.815.455-1.099l1.49-1.393c.608-.568.608-1.533 0-2.101l-1.49-1.393c-.303-.283-.47-.684-.455-1.1l.068-2.038c.029-.832-.654-1.514-1.486-1.486l-2.038.07c-.415.013-.816-.153-1.1-.456zm-5.817 9.367l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z" fill="#829aab" fill-rule="evenodd"/>
                </g>
            </svg>
        `;
    }
    return '';
}

function xApiNormalizeImage(url) {
    const src = String(url || '').trim();
    return src || '';
}

function xApiProxyAssetUrl(src, app) {
    const url = String(src || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) return url;
    return `${app.getBackendUrl('x-api.php')}?asset=${encodeURIComponent(url)}`;
}

function xApiComputeCoverPlacement(imageWidth, imageHeight, canvasSize) {
    const safeWidth = Math.max(1, Number(imageWidth) || canvasSize.width);
    const safeHeight = Math.max(1, Number(imageHeight) || canvasSize.height);
    const scale = Math.max(canvasSize.width / safeWidth, canvasSize.height / safeHeight);

    return {
        width: Math.max(1, Math.round(safeWidth * scale)),
        height: Math.max(1, Math.round(safeHeight * scale)),
        x: Math.round((canvasSize.width - (safeWidth * scale)) / 2),
        y: Math.round((canvasSize.height - (safeHeight * scale)) / 2)
    };
}

function xApiComputeCenteredPlacement(imageWidth, imageHeight, canvasSize) {
    const safeWidth = Math.max(1, Number(imageWidth) || 1);
    const safeHeight = Math.max(1, Number(imageHeight) || 1);

    return {
        width: safeWidth,
        height: safeHeight,
        x: Math.round((canvasSize.width - safeWidth) / 2),
        y: Math.round((canvasSize.height - safeHeight) / 2)
    };
}

function xApiLoadImageMeta(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (/^https?:\/\//i.test(src)) img.crossOrigin = 'anonymous';
        img.onload = () => resolve({
            width: img.naturalWidth || img.width || 1,
            height: img.naturalHeight || img.height || 1
        });
        img.onerror = () => reject(new Error('Gorsel yuklenemedi.'));
        img.src = src;
    });
}

function xApiWrapText(text, maxLineLength = 34) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';

    const lines = [];
    let current = '';

    words.forEach(word => {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxLineLength) {
            current = next;
            return;
        }
        if (current) lines.push(current);
        current = word;
    });

    if (current) lines.push(current);
    return lines.join('\n');
}

function xApiEstimateTextWidth(text, fontSize, weight = 400) {
    const value = String(text || '');
    if (!value) return 0;

    const baseFactor = weight >= 700 ? 0.62 : 0.58;
    return Math.round(value.length * fontSize * baseFactor);
}

function xApiGetAvatarRadius(size, avatarShape, badge) {
    if (avatarShape === 'square' || badge === 'gold') {
        return Math.max(5, Math.round(size * 0.11));
    }
    return Math.round(size / 2);
}

function xApiResolveAvatarShape(selectedShape, badge) {
    if (badge === 'gold') return 'square';
    return selectedShape === 'square' ? 'square' : 'round';
}

function xApiFindTargetTextLayer(app) {
    const selectedLayer = app.getSelectedLayer?.();
    if (selectedLayer?.type === 'text') return selectedLayer;

    const layers = app.getLayers?.() || [];
    return layers.find(layer => layer?.type === 'text' && layer.visible !== false) || null;
}

function xApiApplyTextToExistingLayer(app, text) {
    const targetLayer = xApiFindTargetTextLayer(app);
    if (!targetLayer?.id) return false;
    return !!app.updateLayer?.(targetLayer.id, { text: String(text || '') }, { autoFitText: false });
}

function xApiNormalizeImageList(data) {
    const items = Array.isArray(data?.images) ? data.images : [];
    const normalized = items
        .map(item => xApiNormalizeImage(item))
        .filter(Boolean);
    const primary = xApiNormalizeImage(data?.image);
    if (primary && !normalized.includes(primary)) normalized.unshift(primary);
    return [...new Set(normalized)];
}

async function xApiFetchPostData(url, app) {
    const response = await fetch(app.getBackendUrl('x-api.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
        throw new Error(data.error || `Istek basarisiz oldu (${response.status})`);
    }

    const imageOptions = xApiNormalizeImageList(data);
    return {
        ...data,
        images: imageOptions,
        image: xApiNormalizeImage(data.image || imageOptions[0] || '')
    };
}

async function xApiApplyLoadedData(data, app, options = {}) {
    const workingData = {
        ...data,
        image: xApiNormalizeImage(options.image || data.image || ''),
        fitShortSideToCanvas: options.fitShortSideToCanvas !== false
    };

    const appliedToExistingText = xApiApplyTextToExistingLayer(app, workingData.text || '');
    const layers = await xApiBuildLayers(workingData, app);
    if (!layers.length) {
        throw new Error('Kart icin yeterli veri olusmadi.');
    }

    let backgroundLayerId = null;
    layers.forEach(layer => {
        if (typeof window.addLayer !== 'function') return;
        const createdLayer = window.addLayer(layer.type === 'raster' ? 'raster' : layer.type, layer);
        if (!backgroundLayerId && layer.name === 'X Background' && createdLayer?.id) {
            backgroundLayerId = createdLayer.id;
        }
    });

    if (backgroundLayerId) {
        window.StudioEngine?.applyCommand?.({
            action: 'reorder_layer',
            target: backgroundLayerId,
            position: 'back'
        }, {
            includeContext: false
        });
    }

    return {
        message: `X karti canvas'a eklendi${appliedToExistingText ? ', metin mevcut text layera yazildi.' : '.'}`,
        data: workingData
    };
}

async function xApiLoadUrl(url, options = {}) {
    const app = window.createStudioPluginAppApiById?.('x-api');
    if (!app) {
        throw new Error('X API hazir degil.');
    }

    const data = await xApiFetchPostData(url, app);
    return await xApiApplyLoadedData(data, app, options);
}

window.StudioXApi = {
    loadUrl: xApiLoadUrl,
    fetchPostData: async (url) => {
        const app = window.createStudioPluginAppApiById?.('x-api');
        if (!app) throw new Error('X API hazir degil.');
        return xApiFetchPostData(url, app);
    },
    applyPostData: async (data, options = {}) => {
        const app = window.createStudioPluginAppApiById?.('x-api');
        if (!app) throw new Error('X API hazir degil.');
        return xApiApplyLoadedData(data, app, options);
    },
    getPreviewSrc: (url) => {
        const app = window.createStudioPluginAppApiById?.('x-api');
        if (!app) return xApiNormalizeImage(url);
        return xApiProxyAssetUrl(url, app);
    }
};

async function xApiBuildLayers(data, app) {
    const canvasSize = app.getCanvasSize();
    const shortSide = Math.min(canvasSize.width, canvasSize.height);
    const margin = Math.round(shortSide * 0.06);
    const cardWidth = Math.round(canvasSize.width - margin * 2);
    const cardHeight = Math.round(canvasSize.height - margin * 2);
    const cardX = margin;
    const cardY = margin;
    const textX = cardX + Math.round(cardWidth * 0.07);
    const textWidth = Math.round(cardWidth * 0.86);
    const backgroundSrc = xApiNormalizeImage(data.image);
    const backgroundExportSrc = xApiProxyAssetUrl(data.image, app);
    const backgroundLayerSrc = backgroundExportSrc || backgroundSrc;

    const layers = [];

    if (backgroundSrc) {
        try {
            const meta = await xApiLoadImageMeta(backgroundLayerSrc);
            const cover = data.fitShortSideToCanvas !== false
                ? xApiComputeCoverPlacement(meta.width, meta.height, canvasSize)
                : xApiComputeCenteredPlacement(meta.width, meta.height, canvasSize);
            layers.push({
                type: 'raster',
                name: 'X Background',
                src: backgroundLayerSrc,
                originalSrc: backgroundSrc,
                exportSrc: backgroundLayerSrc,
                width: cover.width,
                height: cover.height,
                x: cover.x,
                y: cover.y,
                aspectLocked: true,
                opacity: 1,
                radius: 0
            });
        } catch (_) {
            // Background gorseli yuklenemezse kart yine uretilsin.
        }
    }

    return layers;
}

registerStudioPlugin({
    id: 'x-api',
    name: 'X API',
    menuLabel: 'X API',
    icon: 'fa-brands fa-x-twitter',
    init(app) {
        ensureXApiStyles(app);
    },
    openModal(app) {
        return {
            title: 'X API',
            subtitle: 'X linki gir, public posttan kart uretmeyi deneyelim.',
            html: `
                <div class="plugin-form x-api-plugin">
                    <div class="field">
                        <label for="xApiUrl">X post linki</label>
                        <div class="x-api-search-row">
                            <input id="xApiUrl" class="x-api-search-input" type="url" placeholder="https://x.com/.../status/...">
                            <button id="xApiPaste" class="mini-btn x-api-paste-btn" type="button" title="Panodan yapistir" aria-label="Panodan yapistir">
                                <i class="fa-solid fa-paste"></i>
                            </button>
                            <button id="xApiRun" class="plugin-primary-btn x-api-run-btn" type="button">
                                <i class="fa-brands fa-x-twitter"></i> Yükle
                            </button>
                        </div>
                    </div>

                    <label class="x-api-option-row" for="xApiFitShortSide">
                        <input id="xApiFitShortSide" type="checkbox" checked>
                        <span>Resmi Sığdır</span>
                    </label>

                    <div id="xApiStatus" class="plugin-status" hidden></div>
                    <div id="xApiPreview" class="x-api-preview" hidden></div>
                </div>
            `,
            onOpen({ root }) {
                ensureXApiStyles(app);

                const urlInput = root.querySelector('#xApiUrl');
                const pasteButton = root.querySelector('#xApiPaste');
                const runButton = root.querySelector('#xApiRun');
                const fitShortSideInput = root.querySelector('#xApiFitShortSide');
                const status = root.querySelector('#xApiStatus');
                const preview = root.querySelector('#xApiPreview');
                let loadedData = null;
                let selectedImage = '';
                let isApplyingSelection = false;

                const renderPreview = (data) => {
                    if (!preview) return;
                    if (!data) {
                        preview.hidden = true;
                        preview.innerHTML = '';
                        return;
                    }

                    preview.hidden = false;
                    const imageOptions = xApiNormalizeImageList(data);
                    const activeImage = xApiNormalizeImage(selectedImage || data.image || imageOptions[0] || '');
                    preview.innerHTML = `
                        <div class="x-api-preview-surface">
                            ${imageOptions.length > 1 ? `
                                <div class="x-api-preview-label">Bir gorsel sec</div>
                                <div class="x-api-image-grid">
                                    ${imageOptions.map((image, index) => `
                                        <button
                                            type="button"
                                            class="x-api-image-choice ${image === activeImage ? 'is-active' : ''}"
                                            data-x-api-image="${xApiEscapeHtml(image)}"
                                            aria-label="Gorsel ${index + 1}">
                                            <img src="${xApiEscapeHtml(xApiProxyAssetUrl(image, app))}" alt="Gorsel ${index + 1}">
                                        </button>
                                    `).join('')}
                                </div>
                            ` : ''}
                            <div class="x-api-preview-text">${xApiEscapeHtml(data.text || '')}</div>
                        </div>
                    `;

                    preview.querySelectorAll('[data-x-api-image]').forEach(button => {
                        button.addEventListener('click', async () => {
                            if (isApplyingSelection) return;
                            selectedImage = button.getAttribute('data-x-api-image') || '';
                            if (loadedData) {
                                loadedData.image = selectedImage || loadedData.image || '';
                                renderPreview(loadedData);
                                status.hidden = false;
                                status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Secilen gorsel yukleniyor...';
                                isApplyingSelection = true;
                                runButton.disabled = true;
                                try {
                                    await applyLoadedData(loadedData);
                                } catch (error) {
                                    status.hidden = false;
                                    status.textContent = 'Hata: ' + error.message;
                                } finally {
                                    isApplyingSelection = false;
                                    runButton.disabled = false;
                                }
                            }
                        });
                    });
                };

                const applyLoadedData = async (data) => {
                    const result = await xApiApplyLoadedData(data, app, {
                        image: selectedImage || data.image || '',
                        fitShortSideToCanvas: fitShortSideInput?.checked !== false
                    });

                    status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${result.message}`;
                    app.closeModal();
                };

                urlInput?.addEventListener('keydown', event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        runButton?.click();
                    }
                });

                pasteButton?.addEventListener('click', async () => {
                    try {
                        if (!navigator.clipboard?.readText) {
                            throw new Error('Tarayici pano okumayi desteklemiyor.');
                        }
                        const text = await navigator.clipboard.readText();
                        if (!text.trim()) {
                            throw new Error('Panoda yapistirilacak metin bulunamadi.');
                        }
                        if (urlInput) {
                            urlInput.value = text.trim();
                            urlInput.focus();
                            urlInput.select?.();
                        }
                    } catch (error) {
                        if (!status) return;
                        status.hidden = false;
                        status.textContent = 'Yapistirma hatasi: ' + error.message;
                    }
                });

                runButton?.addEventListener('click', async () => {
                    const url = urlInput?.value.trim() || '';
                    if (!status) return;

                    if (!url) {
                        status.hidden = false;
                        status.textContent = 'Bir X post linki gir.';
                        renderPreview(null);
                        return;
                    }

                    status.hidden = false;
                    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> X icerigi okunuyor...';
                    runButton.disabled = true;

                    try {
                        if (loadedData) {
                            await applyLoadedData(loadedData);
                            return;
                        }

                        const data = await xApiFetchPostData(url, app);
                        const imageOptions = xApiNormalizeImageList(data);
                        selectedImage = xApiNormalizeImage(data.image || imageOptions[0] || '');
                        loadedData = {
                            ...data,
                            images: imageOptions,
                            image: selectedImage,
                            fitShortSideToCanvas: fitShortSideInput?.checked !== false
                        };

                        renderPreview(loadedData);

                        if (imageOptions.length > 1) {
                            status.hidden = false;
                            status.innerHTML = '<i class="fa-regular fa-images"></i> Bir gorsel sec; tiklayinca otomatik yuklenecek.';
                            return;
                        }

                        await applyLoadedData(loadedData);
                    } catch (error) {
                        renderPreview(null);
                        loadedData = null;
                        selectedImage = '';
                        runButton.innerHTML = '<i class="fa-brands fa-x-twitter"></i> Yükle';
                        status.hidden = false;
                        status.textContent = 'Hata: ' + error.message;
                    } finally {
                        runButton.disabled = false;
                    }
                });
            }
        };
    }
});
