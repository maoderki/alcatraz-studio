const HERO_PATTERNS_STYLE_ID = 'studio-plugin-hero-patterns-style';
const HERO_PATTERNS_DEFAULT_COLOR = '#0f172a';
const HERO_PATTERNS_DEFAULT_BG = 'transparent';
const HERO_PATTERNS_DEFAULT_DENSITY = 100;

function ensureHeroPatternsStyles(app) {
    if (document.getElementById(HERO_PATTERNS_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = HERO_PATTERNS_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function heroPatternsEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function heroPatternsNormalize(value) {
    return String(value ?? '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function heroPatternsNormalizeItem(item) {
    const name = String(item?.name || '').trim();
    const path = String(item?.path || '').trim();
    const width = Math.max(1, Number(item?.width) || 0);
    const height = Math.max(1, Number(item?.height) || 0);
    if (!name || !path || !width || !height) return null;

    return {
        name,
        path,
        width,
        height,
        searchText: heroPatternsNormalize(name)
    };
}

async function heroPatternsFetchList(app) {
    const response = await fetch(app.getAssetUrl('patterns.json'));
    const data = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(`Pattern listesi alinamadi (${response.status})`);
    }

    const items = (Array.isArray(data) ? data : [])
        .map(heroPatternsNormalizeItem)
        .filter(Boolean);

    if (!items.length) {
        throw new Error('Kullanilabilir pattern bulunamadi.');
    }

    return items;
}

function heroPatternsFilter(items, query) {
    const normalizedQuery = heroPatternsNormalize(query);
    if (!normalizedQuery) return items;
    return items.filter(item => item.searchText.includes(normalizedQuery));
}

function heroPatternsBuildSvg(pattern, options = {}) {
    const canvasWidth = Math.max(1, Number(options.canvasWidth) || 1);
    const canvasHeight = Math.max(1, Number(options.canvasHeight) || 1);
    const patternColor = String(options.patternColor || HERO_PATTERNS_DEFAULT_COLOR).trim() || HERO_PATTERNS_DEFAULT_COLOR;
    const backgroundColor = String(options.backgroundColor || HERO_PATTERNS_DEFAULT_BG).trim() || HERO_PATTERNS_DEFAULT_BG;
    const density = Math.max(20, Math.min(220, Number(options.density) || HERO_PATTERNS_DEFAULT_DENSITY));
    const tileScale = HERO_PATTERNS_DEFAULT_DENSITY / density;
    const tileWidth = Math.max(1, Math.round(pattern.width * tileScale * 100) / 100);
    const tileHeight = Math.max(1, Math.round(pattern.height * tileScale * 100) / 100);

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" fill="none">
            <defs>
                <pattern id="hero-pattern" width="${tileWidth}" height="${tileHeight}" patternUnits="userSpaceOnUse">
                    <path d="${pattern.path}" fill="${patternColor}" stroke="${patternColor}" stroke-width="1"/>
                </pattern>
            </defs>
            <rect width="${canvasWidth}" height="${canvasHeight}" fill="${backgroundColor}"/>
            <rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#hero-pattern)"/>
        </svg>
    `.replace(/\s+/g, ' ').trim();
}

function heroPatternsBuildDataUrl(svgText) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

function heroPatternsRenderResults(root, state) {
    const results = root.querySelector('#heroPatternsResults');
    const count = root.querySelector('#heroPatternsCount');
    if (!results || !count) return;

    count.textContent = `${state.filtered.length} pattern`;

    if (!state.filtered.length) {
        results.innerHTML = '<div class="muted-box">Sonuc bulunamadi. Farkli bir pattern adi deneyebilirsin.</div>';
        return;
    }

    results.innerHTML = `
        <div class="hero-patterns-grid">
            ${state.filtered.map(item => {
                const previewSvg = heroPatternsBuildSvg(item, {
                    canvasWidth: 220,
                    canvasHeight: 128,
                    patternColor: state.patternColor,
                    backgroundColor: state.backgroundColor,
                    density: state.density
                });

                return `
                    <button class="hero-patterns-card" type="button" data-hero-pattern="${heroPatternsEscapeHtml(item.name)}">
                        <div class="hero-patterns-card-preview" style="background-image:url('${heroPatternsBuildDataUrl(previewSvg)}');"></div>
                        <div class="hero-patterns-card-body">
                            <div class="hero-patterns-card-title">${heroPatternsEscapeHtml(item.name)}</div>
                            <div class="hero-patterns-card-meta">${item.width}x${item.height} tile · ${state.density}% yogunluk</div>
                        </div>
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function heroPatternsAttachHandlers(root, state, app) {
    const status = root.querySelector('#heroPatternsStatus');

    root.querySelectorAll('[data-hero-pattern]').forEach(button => {
        button.addEventListener('click', () => {
            const pattern = state.filtered.find(item => item.name === button.dataset.heroPattern);
            if (!pattern || !status) return;

            const canvasSize = app.getCanvasSize();
            const svgText = heroPatternsBuildSvg(pattern, {
                canvasWidth: canvasSize.width,
                canvasHeight: canvasSize.height,
                patternColor: state.patternColor,
                backgroundColor: state.backgroundColor,
                density: state.density
            });
            const src = heroPatternsBuildDataUrl(svgText);

            if (typeof window.addLayer !== 'function') {
                status.hidden = false;
                status.textContent = 'Katman ekleme fonksiyonu bulunamadi.';
                return;
            }

            window.addLayer('raster', {
                ...TOOL_PRESETS.image,
                name: `Pattern - ${pattern.name}`,
                src,
                width: canvasSize.width,
                height: canvasSize.height,
                x: 0,
                y: 0,
                aspectLocked: true
            });

            status.hidden = false;
            status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${heroPatternsEscapeHtml(pattern.name)} pattern eklendi.`;
            app.closeModal();
        });
    });
}

function heroPatternsRefresh(root, state, app) {
    state.filtered = heroPatternsFilter(state.items, state.query);
    heroPatternsRenderResults(root, state);
    heroPatternsAttachHandlers(root, state, app);
}

registerStudioPlugin({
    id: 'hero-patterns',
    name: 'Hero Patterns',
    menuLabel: 'Hero Patterns',
    icon: 'fa-solid fa-border-all',
    init(app) {
        ensureHeroPatternsStyles(app);
    },
    openModal(app) {
        return {
            title: 'Hero Patterns',
            subtitle: 'SVG pattern sec, renklerini ayarla ve canvasa raster olarak ekle.',
            html: `
                <div class="plugin-form hero-patterns-plugin">
                    <div class="field">
                        <label for="heroPatternsQuery">Pattern ara</label>
                        <input id="heroPatternsQuery" class="hero-patterns-search-input" type="text" placeholder="Orn: dots, graph, rain, zig zag">
                    </div>

                    <div class="two-col hero-patterns-controls">
                        <div class="field">
                            <label for="heroPatternsColor">Pattern rengi</label>
                            <input id="heroPatternsColor" class="hero-patterns-color-input" type="color" value="${HERO_PATTERNS_DEFAULT_COLOR}">
                        </div>
                        <div class="field">
                            <label for="heroPatternsBackground">Arka plan</label>
                            <select id="heroPatternsBackgroundMode" class="plugin-select">
                                <option value="transparent" selected>Seffaf</option>
                                <option value="solid">Dolu renk</option>
                            </select>
                            <input id="heroPatternsBackground" class="hero-patterns-color-input hero-patterns-bg-color" type="color" value="#ffffff" hidden>
                        </div>
                    </div>

                    <div class="field">
                        <label for="heroPatternsDensity">Yogunluk - ${HERO_PATTERNS_DEFAULT_DENSITY}%</label>
                        <input id="heroPatternsDensity" type="range" min="20" max="220" step="5" value="${HERO_PATTERNS_DEFAULT_DENSITY}">
                    </div>

                    <div class="hero-patterns-toolbar">
                        <div id="heroPatternsCount" class="hero-patterns-count">0 pattern</div>
                    </div>

                    <div id="heroPatternsStatus" class="plugin-status" hidden></div>
                    <div id="heroPatternsResults" class="hero-patterns-results">
                        <div class="muted-box">Patternler hazirlaniyor...</div>
                    </div>
                </div>
            `,
            onOpen({ root, app }) {
                ensureHeroPatternsStyles(app);

                const state = {
                    items: [],
                    filtered: [],
                    query: '',
                    patternColor: HERO_PATTERNS_DEFAULT_COLOR,
                    backgroundColor: HERO_PATTERNS_DEFAULT_BG,
                    density: HERO_PATTERNS_DEFAULT_DENSITY
                };

                const queryInput = root.querySelector('#heroPatternsQuery');
                const colorInput = root.querySelector('#heroPatternsColor');
                const backgroundModeInput = root.querySelector('#heroPatternsBackgroundMode');
                const backgroundInput = root.querySelector('#heroPatternsBackground');
                const densityInput = root.querySelector('#heroPatternsDensity');
                const status = root.querySelector('#heroPatternsStatus');

                const refresh = () => {
                    heroPatternsRefresh(root, state, app);
                };

                const syncBackgroundMode = () => {
                    const mode = backgroundModeInput?.value === 'solid' ? 'solid' : 'transparent';
                    if (backgroundInput) {
                        backgroundInput.hidden = mode !== 'solid';
                    }
                    state.backgroundColor = mode === 'solid'
                        ? (backgroundInput?.value || '#ffffff')
                        : 'transparent';
                    refresh();
                };

                const loadItems = async () => {
                    if (status) {
                        status.hidden = false;
                        status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hero Patterns listesi yukleniyor...';
                    }

                    try {
                        state.items = await heroPatternsFetchList(app);
                        refresh();

                        if (status) {
                            status.hidden = false;
                            status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${state.items.length} pattern hazir.`;
                        }
                    } catch (error) {
                        if (status) {
                            status.hidden = false;
                            status.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i> Liste yuklenemedi: ${heroPatternsEscapeHtml(error.message)}`;
                        }
                    }
                };

                requestAnimationFrame(() => {
                    queryInput?.focus();
                    queryInput?.select?.();
                });

                queryInput?.addEventListener('input', () => {
                    state.query = queryInput.value || '';
                    refresh();
                });

                colorInput?.addEventListener('input', () => {
                    state.patternColor = colorInput.value || HERO_PATTERNS_DEFAULT_COLOR;
                    refresh();
                });

                densityInput?.addEventListener('input', () => {
                    state.density = Math.max(20, Math.min(220, Number(densityInput.value) || HERO_PATTERNS_DEFAULT_DENSITY));
                    const label = root.querySelector('label[for="heroPatternsDensity"]');
                    if (label) {
                        label.textContent = `Yogunluk - ${state.density}%`;
                    }
                    refresh();
                });

                backgroundModeInput?.addEventListener('change', syncBackgroundMode);
                backgroundInput?.addEventListener('input', syncBackgroundMode);

                syncBackgroundMode();
                void loadItems();
            }
        };
    }
});
