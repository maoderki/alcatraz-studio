const UNSPLASH_KEY = 'EEixOfsnmkm8Sx1RBK3UXxhg5Stpie8B50DOSlQ6_Uo';
const UNSPLASH_STYLE_ID = 'studio-plugin-unsplash-style';

function ensureUnsplashStyles(app) {
    if (document.getElementById(UNSPLASH_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = UNSPLASH_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function unsplashEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function unsplashRenderSelect(id, label, options, selected) {
    return `
        <div class="field">
            <label for="${id}">${label}</label>
            <select id="${id}" class="plugin-select">
                ${options.map(option => `
                    <option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.label}</option>
                `).join('')}
            </select>
        </div>
    `;
}

async function unsplashFetchJson(url, options = {}) {
    const response = await fetch(url, options);

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
        throw new Error(data.error || `İstek başarısız oldu (${response.status})`);
    }

    return data;
}

function unsplashBuildHeaders() {
    return {
        'Accept-Version': 'v1',
        'Authorization': `Client-ID ${UNSPLASH_KEY}`
    };
}

async function unsplashSearchPhotos({ query, page, perPage, orientation, orderBy }) {
    const params = new URLSearchParams({
        query,
        page: String(page),
        per_page: String(perPage)
    });

    if (orientation) {
        params.set('orientation', orientation);
    }

    return unsplashFetchJson(`https://api.unsplash.com/search/photos?${params.toString()}`, {
        headers: unsplashBuildHeaders()
    });
}

async function unsplashTrackDownload(downloadLocation) {
    if (!downloadLocation) return;

    await fetch(downloadLocation, {
        headers: unsplashBuildHeaders()
    }).catch(() => {});
}

function unsplashFitPhotoToCanvas(photo, canvasSize) {
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

function unsplashAttachResultHandlers(root, state, app) {
    const resultButtons = root.querySelectorAll('[data-unsplash-insert]');
    resultButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const photoId = button.dataset.unsplashInsert;
            const photo = state.results.find(item => item.id === photoId);
            const status = root.querySelector('#unsplashPluginStatus');
            if (!photo || !status) return;

            const canvasSize = app.getCanvasSize();
            const fitted = unsplashFitPhotoToCanvas(photo, canvasSize);
            const src = photo.urls?.full || photo.urls?.regular || photo.urls?.small;
            if (!src) {
                status.textContent = 'Bu görsel için uygun URL bulunamadı.';
                return;
            }

            button.disabled = true;
            status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Görsel ekleniyor...';

            try {
                if (typeof window.addLayer === 'function') {
                    window.addLayer('raster', {
                        name: `Unsplash - ${(photo.user?.name || 'Photo').slice(0, 32)}`,
                        src,
                        aspectLocked: true,
                        width: fitted.width,
                        height: fitted.height,
                        x: fitted.x,
                        y: fitted.y
                    });
                }

                if (photo.links?.download_location) {
                    void unsplashTrackDownload(photo.links.download_location);
                }

                status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> Görsel canvas'a eklendi.`;
                app.closeModal();
            } catch (error) {
                status.textContent = 'Ekleme hatası: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
    });
}

function unsplashRenderResults(root, state, app) {
    const container = root.querySelector('#unsplashResults');
    const pager = root.querySelector('#unsplashPager');
    if (!container || !pager) return;

    container.hidden = false;

    if (!state.results.length) {
        container.innerHTML = '<div class="muted-box">Sonuç bulunamadı. Farklı bir arama deneyebilirsin.</div>';
        pager.innerHTML = '';
        pager.hidden = true;
        return;
    }

    container.innerHTML = `
        <div class="unsplash-results-grid">
            ${state.results.map(photo => `
                <button class="unsplash-card" type="button" data-unsplash-insert="${unsplashEscapeHtml(photo.id)}" aria-label="${unsplashEscapeHtml(photo.alt_description || photo.description || 'Unsplash photo')}">
                    <div class="unsplash-thumb-wrap">
                        <img class="unsplash-thumb" src="${unsplashEscapeHtml(photo.urls?.small || photo.urls?.thumb || '')}" alt="${unsplashEscapeHtml(photo.alt_description || photo.description || 'Unsplash photo')}">
                    </div>
                </button>
            `).join('')}
        </div>
    `;

    const totalPages = Math.max(1, Math.min(Number(state.totalPages) || 1, 50));
    pager.innerHTML = `
        <button class="mini-btn" type="button" id="unsplashPrevPage" ${state.page <= 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="unsplash-page-label">Sayfa ${state.page} / ${totalPages}</div>
        <button class="mini-btn" type="button" id="unsplashNextPage" ${state.page >= totalPages ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;
    pager.hidden = false;

    root.querySelector('#unsplashPrevPage')?.addEventListener('click', () => {
        if (state.page > 1) {
            state.page -= 1;
            root.querySelector('#unsplashPluginRun')?.click();
        }
    });

    root.querySelector('#unsplashNextPage')?.addEventListener('click', () => {
        if (state.page < totalPages) {
            state.page += 1;
            root.querySelector('#unsplashPluginRun')?.click();
        }
    });

    unsplashAttachResultHandlers(root, state, app);
}

registerStudioPlugin({
    id: 'unsplash',
    name: 'Unsplash',
    menuLabel: 'Unsplash',
    icon: 'fa-solid fa-camera-retro',
    init(app) {
        ensureUnsplashStyles(app);
    },
    openModal(app) {
        return {
            title: 'Unsplash',
            subtitle: 'Fotoğraf ara ve seçtiğin görseli doğrudan canvas’a ekle.',
            html: `
                <div class="plugin-form unsplash-plugin">
                    <div class="field">
                        <label for="unsplashQuery">Arama</label>
                        <div class="unsplash-search-row">
                            <input id="unsplashQuery" class="unsplash-search-input" type="text" placeholder="Örn: modern office desk, luxury hotel lobby, fashion portrait">
                            <button id="unsplashPluginRun" class="plugin-primary-btn unsplash-search-btn" type="button">
                                <i class="fa-solid fa-magnifying-glass"></i> Fotoğraf Ara
                            </button>
                        </div>
                    </div>
                    <div id="unsplashPluginStatus" class="plugin-status" hidden></div>
                    <div id="unsplashResults" hidden></div>
                    <div id="unsplashPager" class="unsplash-pager" hidden></div>
                </div>
            `,
            onOpen({ root, app }) {
                ensureUnsplashStyles(app);
                const state = {
                    page: 1,
                    totalPages: 1,
                    results: [],
                    lastSearchKey: ''
                };

                const queryInput = root.querySelector('#unsplashQuery');
                const orientationInput = root.querySelector('#unsplashOrientation');
                const orderInput = root.querySelector('#unsplashOrder');
                const runButton = root.querySelector('#unsplashPluginRun');
                const status = root.querySelector('#unsplashPluginStatus');

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
                    const orientation = orientationInput?.value || '';
                    const orderBy = orderInput?.value || 'relevant';
                    const searchKey = JSON.stringify({ query, orientation, orderBy });

                    if (!status) return;
                    if (!query) {
                        status.hidden = false;
                        status.textContent = 'Aramak için bir kelime ya da cümle yaz.';
                        return;
                    }

                    if (state.lastSearchKey && state.lastSearchKey !== searchKey) {
                        state.page = 1;
                    }

                    state.lastSearchKey = searchKey;
                    status.hidden = false;
                    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Unsplash aranıyor...';
                    runButton.disabled = true;

                    try {
                        const data = await unsplashSearchPhotos({
                            query,
                            page: state.page,
                            perPage: 12,
                            orientation,
                            orderBy
                        });

                        state.results = Array.isArray(data.results) ? data.results : [];
                        state.totalPages = Number(data.total_pages) || 1;

                        status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${state.results.length} sonuç geldi.`;
                        unsplashRenderResults(root, state, app);
                    } catch (error) {
                        state.results = [];
                        status.hidden = false;
                        status.textContent = 'Hata: ' + error.message;
                        const results = root.querySelector('#unsplashResults');
                        const pager = root.querySelector('#unsplashPager');
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
