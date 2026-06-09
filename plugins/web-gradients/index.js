const WEBGRADIENTS_STYLE_ID = 'studio-plugin-webgradients-style';

function ensureWebGradientsStyles(app) {
    if (document.getElementById(WEBGRADIENTS_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = WEBGRADIENTS_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function webGradientsEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function webGradientsNormalize(value) {
    return String(value ?? '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function webGradientsNormalizeItem(item) {
    const stops = Array.isArray(item?.gradient)
        ? item.gradient
            .map(stop => {
                const color = typeof stop?.color === 'string' ? stop.color.trim() : '';
                if (!color) return null;

                return {
                    color,
                    pos: Math.max(0, Math.min(100, Number(stop?.pos) || 0))
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.pos - b.pos)
        : [];

    if (stops.length < 2) return null;

    const angle = Math.max(0, Math.min(360, Number(item?.deg) || 0));
    const name = String(item?.name || 'Untitled Gradient').trim();
    const searchText = webGradientsNormalize([
        name,
        item?.index,
        ...(Array.isArray(item?.group) ? item.group : []),
        item?.favorite ? 'favorite favori' : ''
    ].join(' '));

    return {
        name,
        angle,
        index: String(item?.index || '').trim(),
        favorite: item?.favorite === true,
        group: Array.isArray(item?.group) ? item.group : [],
        stops,
        preview: window.buildGradientCssValue({
            gradientType: 'linear',
            angle,
            stops
        }),
        searchText
    };
}

async function webGradientsFetchList(app) {
    const response = await fetch(app.getAssetUrl('gradients.json'));
    const data = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(`Gradient listesi alinamadi (${response.status})`);
    }

    const items = (Array.isArray(data) ? data : [])
        .map(webGradientsNormalizeItem)
        .filter(Boolean);

    if (!items.length) {
        throw new Error('Kullanilabilir gradient bulunamadi.');
    }

    return items;
}

function webGradientsFilterItems(items, query, favoritesOnly) {
    const normalizedQuery = webGradientsNormalize(query);

    return items.filter(item => {
        if (favoritesOnly && !item.favorite) return false;
        if (!normalizedQuery) return true;
        return item.searchText.includes(normalizedQuery);
    });
}

function webGradientsRenderResults(root, state) {
    const results = root.querySelector('#webGradientsResults');
    const count = root.querySelector('#webGradientsCount');
    if (!results || !count) return;

    count.textContent = `${state.filtered.length} gradient`;

    if (!state.filtered.length) {
        results.innerHTML = '<div class="muted-box">Sonuc bulunamadi. Farkli bir isim deneyebilirsin.</div>';
        return;
    }

    results.innerHTML = `
        <div class="webgradients-grid">
            ${state.filtered.map(item => `
                <button class="webgradients-card" type="button" data-webgradient-name="${webGradientsEscapeHtml(item.name)}">
                    <div class="webgradients-card-preview" style="background:${item.preview};"></div>
                    <div class="webgradients-card-body">
                        <div class="webgradients-card-title-row">
                            <div class="webgradients-card-title">${webGradientsEscapeHtml(item.name)}</div>
                            ${item.favorite ? '<span class="webgradients-favorite">Fav</span>' : ''}
                        </div>
                        <div class="webgradients-card-meta">#${webGradientsEscapeHtml(item.index || '---')} · ${item.stops.length} durak · ${item.angle}deg</div>
                    </div>
                </button>
            `).join('')}
        </div>
    `;
}

function webGradientsAttachHandlers(root, state, app) {
    const status = root.querySelector('#webGradientsStatus');

    root.querySelectorAll('[data-webgradient-name]').forEach(button => {
        button.addEventListener('click', () => {
            const item = state.filtered.find(entry => entry.name === button.dataset.webgradientName);
            if (!item || !status) return;

            const applied = typeof window.setGradientToolPreset === 'function'
                ? window.setGradientToolPreset({
                    gradientType: 'linear',
                    angle: item.angle,
                    stops: item.stops
                })
                : false;

            if (!applied) {
                status.hidden = false;
                status.textContent = 'Gradient araci guncellenemedi.';
                return;
            }

            if (typeof window.selectTool === 'function') {
                window.selectTool('gradient');
            }

            status.hidden = false;
            status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${webGradientsEscapeHtml(item.name)} gradient aracina aktarıldı.`;
            app.closeModal();
        });
    });
}

function webGradientsRefresh(root, state, app) {
    state.filtered = webGradientsFilterItems(state.items, state.query, state.favoritesOnly);
    webGradientsRenderResults(root, state);
    webGradientsAttachHandlers(root, state, app);
}

registerStudioPlugin({
    id: 'web-gradients',
    name: 'Web Gradients',
    menuLabel: 'Web Gradients',
    icon: 'fa-solid fa-fill-drip',
    init(app) {
        ensureWebGradientsStyles(app);
    },
    openModal(app) {
        return {
            title: 'Web Gradients',
            subtitle: 'Hazir gradient sec, gradient aracina tek tikla aktar.',
            html: `
                <div class="plugin-form webgradients-plugin">
                    <div class="field">
                        <label for="webGradientsQuery">Gradient ara</label>
                        <div class="webgradients-toolbar">
                            <input id="webGradientsQuery" class="webgradients-search-input" type="text" placeholder="Orn: Warm Flame, Peach, Night">
                        </div>
                    </div>

                    <div class="webgradients-toolbar webgradients-toolbar-secondary">
                        <label class="webgradients-toggle">
                            <input id="webGradientsFavorites" type="checkbox">
                            <span>Sadece favoriler</span>
                        </label>
                        <div id="webGradientsCount" class="webgradients-count">0 gradient</div>
                    </div>

                    <div id="webGradientsStatus" class="plugin-status" hidden></div>
                    <div id="webGradientsResults" class="webgradients-results">
                        <div class="muted-box">Gradientler hazirlaniyor...</div>
                    </div>
                </div>
            `,
            onOpen({ root, app }) {
                ensureWebGradientsStyles(app);

                const state = {
                    items: [],
                    filtered: [],
                    query: '',
                    favoritesOnly: false
                };

                const queryInput = root.querySelector('#webGradientsQuery');
                const favoritesInput = root.querySelector('#webGradientsFavorites');
                const status = root.querySelector('#webGradientsStatus');

                const loadItems = async () => {
                    if (status) {
                        status.hidden = false;
                        status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> WebGradients listesi yukleniyor...';
                    }

                    try {
                        state.items = await webGradientsFetchList(app);
                        webGradientsRefresh(root, state, app);

                        if (status) {
                            status.hidden = false;
                            status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${state.items.length} gradient hazir.`;
                        }
                    } catch (error) {
                        if (status) {
                            status.hidden = false;
                            status.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i> Liste yuklenemedi: ${webGradientsEscapeHtml(error.message)}`;
                        }
                    } finally {
                    }
                };

                requestAnimationFrame(() => {
                    queryInput?.focus();
                    queryInput?.select?.();
                });

                queryInput?.addEventListener('input', () => {
                    state.query = queryInput.value || '';
                    webGradientsRefresh(root, state, app);
                });

                favoritesInput?.addEventListener('change', () => {
                    state.favoritesOnly = favoritesInput.checked;
                    webGradientsRefresh(root, state, app);
                });

                void loadItems();
            }
        };
    }
});
