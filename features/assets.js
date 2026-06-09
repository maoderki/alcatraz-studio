// ── Layer management ───────────────────────────────────────────────────────
function addRasterFromFile(file, fallbackName = 'Raster Layer') {
    if (!file || !file.type.startsWith('image/')) return false;
    const reader = new FileReader();
    reader.onload = (ev) => {
        addRasterFromImage(ev.target.result, file.name || fallbackName);
    };
    reader.readAsDataURL(file);
    return true;
}

function extractImageFile(listLike) {
    return Array.from(listLike || []).find(file => file?.type?.startsWith('image/')) || null;
}

function hasImageTransferPayload(dataTransfer) {
    if (!dataTransfer) return false;
    if (extractImageFile(dataTransfer.files)) return true;
    return Array.from(dataTransfer.items || []).some(item =>
        item.type?.startsWith('image/') ||
        item.type === 'text/uri-list' ||
        item.type === 'text/html' ||
        item.type === 'text/plain'
    );
}

function addRasterFromUrl(src, fallbackName = 'Raster Layer') {
    if (!src) return false;
    const cleanSrc = String(src).trim();
    if (!cleanSrc) return false;

    let name = fallbackName;
    try {
        const url = new URL(cleanSrc, window.location.href);
        const pathName = url.pathname.split('/').filter(Boolean).pop();
        if (pathName) name = decodeURIComponent(pathName);
    } catch (_) {
        // URL parse edilemezse fallback adı koru.
    }

    addRasterFromImage(cleanSrc, name);
    return true;
}

function isLikelyImageUrl(value) {
    if (!value) return false;
    const normalized = String(value).trim();
    if (!normalized) return false;
    if (/^data:image\//i.test(normalized) || /^blob:/i.test(normalized)) return true;

    try {
        const url = new URL(normalized, window.location.href);
        return /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i.test(url.pathname);
    } catch (_) {
        return false;
    }
}

function getTransferString(dataTransfer, type) {
    try {
        return dataTransfer?.getData?.(type) || '';
    } catch (_) {
        return '';
    }
}

function getItemAsString(item) {
    return new Promise(resolve => {
        if (!item?.getAsString) {
            resolve('');
            return;
        }
        item.getAsString(value => resolve(value || ''));
    });
}

async function extractImageSourceFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return false;

    const fileFromFiles = extractImageFile(dataTransfer.files);
    if (fileFromFiles) return fileFromFiles;

    const imageItem = Array.from(dataTransfer.items || []).find(item => item.type?.startsWith('image/'));
    const fileFromItems = imageItem?.getAsFile?.() || null;
    if (fileFromItems) return fileFromItems;

    const directUri = getTransferString(dataTransfer, 'text/uri-list');
    if (isLikelyImageUrl(directUri)) return directUri.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#')) || '';

    const directText = getTransferString(dataTransfer, 'text/plain');
    if (isLikelyImageUrl(directText)) return directText.trim();

    const directHtml = getTransferString(dataTransfer, 'text/html');
    if (directHtml) {
        const doc = new DOMParser().parseFromString(directHtml, 'text/html');
        const htmlImageSrc = doc.querySelector('img')?.src || '';
        if (isLikelyImageUrl(htmlImageSrc)) return htmlImageSrc;
    }

    const items = Array.from(dataTransfer.items || []);
    for (const item of items) {
        if (item.kind !== 'string') continue;
        const value = await getItemAsString(item);
        if (!value) continue;

        if (item.type === 'text/html') {
            const doc = new DOMParser().parseFromString(value, 'text/html');
            const htmlImageSrc = doc.querySelector('img')?.src || '';
            if (isLikelyImageUrl(htmlImageSrc)) return htmlImageSrc;
        }

        if ((item.type === 'text/uri-list' || item.type === 'text/plain') && isLikelyImageUrl(value)) {
            return value.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#')) || '';
        }
    }

    return null;
}

async function addRasterFromDataTransfer(dataTransfer, fallbackName = 'Pasted Image') {
    const source = await extractImageSourceFromDataTransfer(dataTransfer);
    if (!source) return false;
    if (source instanceof File) return addRasterFromFile(source, fallbackName);
    return addRasterFromUrl(source, fallbackName);
}

async function pasteFromClipboard() {
    if (!navigator.clipboard?.read) {
        alert('Tarayıcı bu yapıştırma yöntemini desteklemiyor. Cmd/Ctrl+V kullanabilirsin.');
        return;
    }

    try {
        const items = await navigator.clipboard.read();

        for (const item of items) {
            const imageType = item.types.find(type => type.startsWith('image/'));
            if (imageType) {
                const blob = await item.getType(imageType);
                const ext = imageType.split('/')[1] || 'png';
                const file = new File([blob], `clipboard-image.${ext}`, { type: imageType });
                addRasterFromFile(file, 'Pasted Image');
                return;
            }

            if (item.types.includes('text/plain')) {
                const textBlob = await item.getType('text/plain');
                const text = await textBlob.text();
                if (text && isLikelyImageUrl(text.trim())) {
                    await addRasterFromUrl(text.trim(), 'Pasted Image');
                    return;
                }
            }
        }

        alert('Panoda yapıştırılabilir bir görsel bulunamadı.');
    } catch (error) {
        alert('Yapıştırma başarısız: ' + error.message);
    }
}

function getStagePointFromEvent(event) {
    const rect = stage.getBoundingClientRect();
    return {
        x: clamp(((event.clientX - rect.left) / rect.width) * canvasWidth, 0, canvasWidth),
        y: clamp(((event.clientY - rect.top) / rect.height) * canvasHeight, 0, canvasHeight)
    };
}

document.getElementById('createBtn').addEventListener('click', () => {
    window.StudioEngine?.applyCommand?.({
        action: 'add_layer',
        layer: {
            type: 'raster',
            name: 'Yeni Katman',
            width: canvasWidth,
            height: canvasHeight,
            x: 0,
            y: 0
        }
    }, {
        includeContext: false
    });
});

stageWrap.addEventListener('dragover', (e) => {
    if (!hasImageTransferPayload(e.dataTransfer)) return;
    e.preventDefault();
    stageWrap.style.border = '1px dashed rgba(96,165,250,.6)';
});

stageWrap.addEventListener('dragleave', () => {
    stageWrap.style.border = '';
});

stageWrap.addEventListener('drop', (e) => {
    e.preventDefault();
    stageWrap.style.border = '';
    void (async () => {
        if (!await addRasterFromDataTransfer(e.dataTransfer, 'Dropped Image')) {
            alert('Sadece görsel dosyası bırakabilirsin.');
        }
    })();
});
