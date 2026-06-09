const PEXELS_KEY = 'bdX6zdJwiQLP38eAdsgCooiBGAdQjXj5jtIJ02slHywuWgN8ywh4y5RB';
const PEXELS_STYLE_ID = 'studio-plugin-pexels-style';

function ensurePexelsStyles(app) {
    if (document.getElementById(PEXELS_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = PEXELS_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function pexelsEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function pexelsFetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
        throw new Error(data.error || `Istek basarisiz oldu (${response.status})`);
    }

    return data;
}

function pexelsBuildHeaders() {
    return {
        Authorization: PEXELS_KEY
    };
}

function ensurePexelsKey() {
    if (typeof PEXELS_KEY === 'string' && PEXELS_KEY.trim()) return;
    throw new Error('Pexels API key eksik. studio/plugins/pexels/index.js icindeki PEXELS_KEY alanini doldur.');
}

async function pexelsSearchPhotos({ query, page, perPage, orientation }) {
    ensurePexelsKey();

    const params = new URLSearchParams({
        query,
        page: String(page),
        per_page: String(perPage)
    });

    if (orientation) {
        params.set('orientation', orientation);
    }

    return pexelsFetchJson(`https://api.pexels.com/v1/search?${params.toString()}`, {
        headers: pexelsBuildHeaders()
    });
}

function pexelsFitPhotoToCanvas(photo, canvasSize) {
    const photoWidth = Number(photo.width) || canvasSize.width;
    const photoHeight = Number(photo.height) || canvasSize.height;
    const width = Math.max(1, Math.round(photoWidth));
    const height = Math.max(1, Math.round(photoHeight));

    return {
        width,
        height,
        x: Math.round((canvasSize.width - width) / 2),
        y: Math.round((canvasSize.height - height) / 2)
    };
}

function pexelsAttachResultHandlers(root, state, app) {
    const resultButtons = root.querySelectorAll('[data-pexels-insert]');
    resultButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const photoId = button.dataset.pexelsInsert;
            const photo = state.results.find(item => String(item.id) === String(photoId));
            const status = root.querySelector('#pexelsPluginStatus');
            if (!photo || !status) return;

            const canvasSize = app.getCanvasSize();
            const fitted = pexelsFitPhotoToCanvas(photo, canvasSize);
            const src = photo.src?.original || photo.src?.large2x || photo.src?.large || photo.src?.medium;
            if (!src) {
                status.textContent = 'Bu gorsel icin uygun URL bulunamadi.';
                return;
            }

            button.disabled = true;
            status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gorsel ekleniyor...';

            try {
                if (typeof window.addLayer === 'function') {
                    window.addLayer('raster', {
                        name: `Pexels - ${(photo.photographer || 'Photo').slice(0, 32)}`,
                        src,
                        aspectLocked: true,
                        width: fitted.width,
                        height: fitted.height,
                        x: fitted.x,
                        y: fitted.y
                    });
                }

                status.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981"></i> Gorsel canvas\'a eklendi.';
                app.closeModal();
            } catch (error) {
                status.textContent = 'Ekleme hatasi: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
    });
}

function pexelsRenderResults(root, state, app) {
    const container = root.querySelector('#pexelsResults');
    const pager = root.querySelector('#pexelsPager');
    if (!container || !pager) return;

    container.hidden = false;

    if (!state.results.length) {
        container.innerHTML = '<div class="muted-box">Sonuc bulunamadi. Farkli bir arama deneyebilirsin.</div>';
        pager.innerHTML = '';
        pager.hidden = true;
        return;
    }

    container.innerHTML = `
        <div class="pexels-results-grid">
            ${state.results.map(photo => `
                <button class="pexels-card" type="button" data-pexels-insert="${pexelsEscapeHtml(photo.id)}" aria-label="${pexelsEscapeHtml(photo.alt || photo.photographer || 'Pexels photo')}">
                    <div class="pexels-thumb-wrap">
                        <img class="pexels-thumb" src="${pexelsEscapeHtml(photo.src?.medium || photo.src?.small || '')}" alt="${pexelsEscapeHtml(photo.alt || photo.photographer || 'Pexels photo')}">
                    </div>
                </button>
            `).join('')}
        </div>
    `;

    const totalPages = Math.max(1, Math.min(Number(state.totalPages) || 1, 50));
    pager.innerHTML = `
        <button class="mini-btn" type="button" id="pexelsPrevPage" ${state.page <= 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="pexels-page-label">Sayfa ${state.page} / ${totalPages}</div>
        <button class="mini-btn" type="button" id="pexelsNextPage" ${state.page >= totalPages ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;
    pager.hidden = false;

    root.querySelector('#pexelsPrevPage')?.addEventListener('click', () => {
        if (state.page > 1) {
            state.page -= 1;
            root.querySelector('#pexelsPluginRun')?.click();
        }
    });

    root.querySelector('#pexelsNextPage')?.addEventListener('click', () => {
        if (state.page < totalPages) {
            state.page += 1;
            root.querySelector('#pexelsPluginRun')?.click();
        }
    });

    pexelsAttachResultHandlers(root, state, app);
}

registerStudioPlugin({
    id: 'pexels',
    name: 'Pexels',
    menuLabel: 'Pexels',
    icon: 'fa-solid fa-camera',
    init(app) {
        ensurePexelsStyles(app);
    },
    openModal(app) {
        return {
            title: 'Pexels',
            subtitle: 'Fotograf ara ve sectigin gorseli dogrudan canvas\'a ekle.',
            html: `
                <div class="plugin-form pexels-plugin">
                    <div class="field">
                        <label for="pexelsQuery">Arama</label>
                        <div class="pexels-search-row">
                            <input id="pexelsQuery" class="pexels-search-input" type="text" placeholder="Orn: modern office desk, luxury hotel lobby, fashion portrait">
                            <button id="pexelsPluginRun" class="plugin-primary-btn pexels-search-btn" type="button">
                                <i class="fa-solid fa-magnifying-glass"></i> Fotograf Ara
                            </button>
                        </div>
                    </div>
                    <div id="pexelsPluginStatus" class="plugin-status" hidden></div>
                    <div id="pexelsResults" hidden></div>
                    <div id="pexelsPager" class="pexels-pager" hidden></div>
                </div>
            `,
            onOpen({ root, app }) {
                ensurePexelsStyles(app);
                const state = {
                    page: 1,
                    totalPages: 1,
                    results: [],
                    lastSearchKey: ''
                };

                const queryInput = root.querySelector('#pexelsQuery');
                const runButton = root.querySelector('#pexelsPluginRun');
                const status = root.querySelector('#pexelsPluginStatus');

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
                    const searchKey = JSON.stringify({ query });

                    if (!status) return;
                    if (!query) {
                        status.hidden = false;
                        status.textContent = 'Aramak icin bir kelime ya da cumle yaz.';
                        return;
                    }

                    if (state.lastSearchKey && state.lastSearchKey !== searchKey) {
                        state.page = 1;
                    }

                    state.lastSearchKey = searchKey;
                    status.hidden = false;
                    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pexels araniyor...';
                    runButton.disabled = true;

                    try {
                        const data = await pexelsSearchPhotos({
                            query,
                            page: state.page,
                            perPage: 12,
                            orientation: ''
                        });

                        state.results = Array.isArray(data.photos) ? data.photos : [];
                        state.totalPages = Math.max(1, Math.ceil((Number(data.total_results) || state.results.length || 1) / 12));

                        status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${state.results.length} sonuc geldi.`;
                        pexelsRenderResults(root, state, app);
                    } catch (error) {
                        state.results = [];
                        status.hidden = false;
                        status.textContent = 'Hata: ' + error.message;
                        const results = root.querySelector('#pexelsResults');
                        const pager = root.querySelector('#pexelsPager');
                        if (results) {
                            results.innerHTML = '';
                            results.hidden = true;
                        }
                        if (pager) {
                            pager.innerHTML = '';
                            pager.hidden = true;
                        }
                    } finally {
                        runButton.disabled = false;
                    }
                });
            }
        };
    }
});
