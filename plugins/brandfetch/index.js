const BRANDFETCH_CLIENT_ID = '1id3Gf6r0guBje6bvT1';
const BRANDFETCH_STYLE_ID = 'studio-plugin-brandfetch-style';

function ensureBrandfetchStyles(app) {
    if (document.getElementById(BRANDFETCH_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = BRANDFETCH_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function brandfetchEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function brandfetchFetchJson(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => []);

    if (!response.ok) {
        const message = data?.message || data?.error || `Istek basarisiz oldu (${response.status})`;
        throw new Error(message);
    }

    return data;
}

async function brandfetchSearchBrands(query) {
    const normalized = String(query || '').trim();
    if (!normalized) return [];

    const url = `https://api.brandfetch.io/v2/search/${encodeURIComponent(normalized)}?c=${encodeURIComponent(BRANDFETCH_CLIENT_ID)}`;
    const data = await brandfetchFetchJson(url);

    return (Array.isArray(data) ? data : [])
        .map(item => ({
            brandId: item?.brandId || '',
            name: String(item?.name || '').trim(),
            domain: String(item?.domain || '').trim(),
            claimed: item?.claimed === true,
            icon: typeof item?.icon === 'string' ? item.icon.trim() : ''
        }))
        .filter(item => item.name && item.domain);
}

function brandfetchBuildAssetUrl(domain, type = 'logo') {
    const normalizedType = type === 'icon' || type === 'symbol' ? type : 'logo';
    const extension = normalizedType === 'logo' || normalizedType === 'symbol' ? '.svg' : '.png';
    return `https://cdn.brandfetch.io/${encodeURIComponent(domain)}/${normalizedType}${extension}?c=${encodeURIComponent(BRANDFETCH_CLIENT_ID)}`;
}

function brandfetchBuildLogoUrl(domain) {
    return brandfetchBuildAssetUrl(domain, 'logo');
}

function brandfetchFitToCanvas(imageWidth, imageHeight, canvasSize) {
    const safeWidth = Math.max(1, Number(imageWidth) || 1);
    const safeHeight = Math.max(1, Number(imageHeight) || 1);
    const maxWidth = Math.max(1, Math.round(canvasSize.width * 0.92));
    const maxHeight = Math.max(1, Math.round(canvasSize.height * 0.68));
    const minWidth = Math.max(240, Math.round(canvasSize.width * 0.72));
    const minHeight = Math.max(120, Math.round(canvasSize.height * 0.26));
    const scaleToMax = Math.min(maxWidth / safeWidth, maxHeight / safeHeight);
    const scaleToMin = Math.max(minWidth / safeWidth, minHeight / safeHeight);
    const scale = Math.max(0.01, Math.min(scaleToMax, Math.max(scaleToMin, 1)));
    const width = Math.max(1, Math.round(safeWidth * scale));
    const height = Math.max(1, Math.round(safeHeight * scale));

    return {
        width,
        height,
        x: Math.round((canvasSize.width - width) / 2),
        y: Math.round((canvasSize.height - height) / 2)
    };
}

function brandfetchLoadImageMeta(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({
            width: img.naturalWidth || img.width || 1,
            height: img.naturalHeight || img.height || 1
        });
        img.onerror = () => reject(new Error('Logo gorseli yuklenemedi.'));
        img.src = src;
    });
}

function brandfetchRenderResults(root, state) {
    const results = root.querySelector('#brandfetchResults');
    const toolbar = root.querySelector('#brandfetchToolbar');
    const count = root.querySelector('#brandfetchCount');
    if (!results || !toolbar || !count) return;

    count.textContent = `${state.results.length} marka`;

    if (!state.results.length) {
        toolbar.hidden = true;
        results.hidden = true;
        results.innerHTML = '';
        return;
    }

    toolbar.hidden = false;
    results.hidden = false;

    results.innerHTML = `
        <div class="brandfetch-grid">
            ${state.results.map(item => {
                const logoPreview = brandfetchBuildLogoUrl(item.domain);
                const fallbackPreview = item.icon || brandfetchBuildAssetUrl(item.domain, 'icon');

                return `
                    <article class="brandfetch-card">
                        <div class="brandfetch-logo-wrap">
                            <img class="brandfetch-logo" src="${brandfetchEscapeHtml(logoPreview)}" alt="${brandfetchEscapeHtml(item.name)} logosu" loading="lazy" onerror="if(this.dataset.fallbackApplied)return;this.dataset.fallbackApplied='1';this.src='${brandfetchEscapeHtml(fallbackPreview)}';">
                        </div>
                        <div class="brandfetch-card-body">
                            <div class="brandfetch-title-row">
                                <div class="brandfetch-card-title">${brandfetchEscapeHtml(item.name)}</div>
                                ${item.claimed ? '<span class="brandfetch-badge">Claimed</span>' : ''}
                            </div>
                            <div class="brandfetch-card-meta">${brandfetchEscapeHtml(item.domain)}</div>
                            <div class="brandfetch-card-actions">
                                <button class="plugin-primary-btn brandfetch-insert-btn" type="button" data-brandfetch-insert="${brandfetchEscapeHtml(item.domain)}">Ekle</button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function brandfetchAttachHandlers(root, state, app) {
    const status = root.querySelector('#brandfetchStatus');

    root.querySelectorAll('[data-brandfetch-insert]').forEach(button => {
        button.addEventListener('click', async () => {
            const domain = button.dataset.brandfetchInsert;
            const item = state.results.find(entry => entry.domain === domain);
            if (!item || !status) return;

            const src = brandfetchBuildLogoUrl(item.domain);
            status.hidden = false;
            status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logo canvas\'a ekleniyor...';
            button.disabled = true;

            try {
                const meta = await brandfetchLoadImageMeta(src);
                const canvasSize = app.getCanvasSize();
                const placement = brandfetchFitToCanvas(meta.width, meta.height, canvasSize);

                if (typeof window.addLayer !== 'function') {
                    throw new Error('Katman ekleme fonksiyonu bulunamadi.');
                }

                window.addLayer('raster', {
                    name: `Brand - ${item.name}`,
                    src,
                    aspectLocked: true,
                    width: placement.width,
                    height: placement.height,
                    x: placement.x,
                    y: placement.y
                });

                status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${brandfetchEscapeHtml(item.name)} logosu eklendi.`;
                app.closeModal();
            } catch (error) {
                status.hidden = false;
                status.textContent = 'Ekleme hatasi: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
    });
}

function brandfetchRefresh(root, state, app) {
    brandfetchRenderResults(root, state);
    brandfetchAttachHandlers(root, state, app);
}

registerStudioPlugin({
    id: 'brandfetch',
    name: 'Brandfetch',
    menuLabel: 'Brandfetch',
    icon: 'fa-solid fa-building',
    init(app) {
        ensureBrandfetchStyles(app);
    },
    openModal(app) {
        return {
            title: 'Brandfetch',
            subtitle: 'Marka ara, logosunu bul ve dogrudan canvas\'a ekle.',
            html: `
                <div class="plugin-form brandfetch-plugin">
                    <div class="field">
                        <label for="brandfetchQuery">Marka ya da domain</label>
                        <div class="brandfetch-search-row">
                            <input id="brandfetchQuery" class="brandfetch-search-input" type="text" placeholder="Orn: Nike, Airbnb, spotify.com">
                            <button id="brandfetchRun" class="plugin-primary-btn brandfetch-search-btn" type="button">
                                <i class="fa-solid fa-magnifying-glass"></i> Marka Ara
                            </button>
                        </div>
                    </div>

                    <div id="brandfetchToolbar" class="brandfetch-toolbar" hidden>
                        <div id="brandfetchCount" class="brandfetch-count">0 marka</div>
                    </div>

                    <div id="brandfetchStatus" class="plugin-status" hidden></div>
                    <div id="brandfetchResults" class="brandfetch-results" hidden>
                    </div>
                </div>
            `,
            onOpen({ root, app }) {
                ensureBrandfetchStyles(app);

                const state = {
                    results: []
                };

                const queryInput = root.querySelector('#brandfetchQuery');
                const runButton = root.querySelector('#brandfetchRun');
                const status = root.querySelector('#brandfetchStatus');

                requestAnimationFrame(() => {
                    queryInput?.focus();
                    queryInput?.select?.();
                });

                queryInput?.addEventListener('keydown', event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        runButton?.click();
                    }
                });

                runButton?.addEventListener('click', async () => {
                    const query = queryInput?.value.trim() || '';
                    if (!status) return;

                    if (!query) {
                        status.hidden = false;
                        status.textContent = 'Aramak icin bir marka adi ya da domain yaz.';
                        return;
                    }

                    status.hidden = false;
                    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Brandfetch araniyor...';
                    runButton.disabled = true;

                    try {
                        state.results = await brandfetchSearchBrands(query);
                        brandfetchRefresh(root, state, app);
                        status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${state.results.length} sonuc geldi.`;
                    } catch (error) {
                        state.results = [];
                        brandfetchRefresh(root, state, app);
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
