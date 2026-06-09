const COUNTRY_FLAGS_STYLE_ID = 'studio-plugin-country-flags-style';

function ensureCountryFlagsStyles(app) {
    if (document.getElementById(COUNTRY_FLAGS_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = COUNTRY_FLAGS_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function countryFlagsEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function countryFlagsNormalize(value) {
    return String(value ?? '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i');
}

function countryFlagsBuildSearchText(flag) {
    return countryFlagsNormalize([
        flag.country_name,
        flag.alpha2,
        flag.alpha3
    ].join(' '));
}

async function countryFlagsFetchList(app) {
    const response = await fetch(app.getAssetUrl('flags.json'));
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(`Bayrak verisi alınamadı (${response.status})`);
    }

    const countries = Array.isArray(data.countries) ? data.countries : [];
    return countries.map(item => ({
        ...item,
        searchText: countryFlagsBuildSearchText(item)
    }));
}

function countryFlagsFilter(flags, query) {
    const normalizedQuery = countryFlagsNormalize(query).trim();
    if (!normalizedQuery) return flags;
    return flags.filter(flag => flag.searchText.includes(normalizedQuery));
}

function countryFlagsComputePlacement(imageWidth, imageHeight, canvasSize) {
    const safeWidth = Math.max(1, Number(imageWidth) || 1);
    const safeHeight = Math.max(1, Number(imageHeight) || 1);
    const targetShortSide = Math.max(
        1,
        Math.max(Number(canvasSize?.width) || 0, Number(canvasSize?.height) || 0)
    );
    const scale = targetShortSide / Math.min(safeWidth, safeHeight);
    const width = Math.max(1, Math.round(safeWidth * scale));
    const height = Math.max(1, Math.round(safeHeight * scale));

    return {
        width,
        height,
        shortSide: Math.min(width, height),
        x: Math.round((canvasSize.width - width) / 2),
        y: Math.round((canvasSize.height - height) / 2)
    };
}

function countryFlagsLoadImageMeta(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({
            width: img.naturalWidth || img.width || 1,
            height: img.naturalHeight || img.height || 1
        });
        img.onerror = () => reject(new Error('Bayrak görseli yüklenemedi.'));
        img.src = src;
    });
}

function countryFlagsRenderResults(root, flags) {
    const results = root.querySelector('#countryFlagsResults');
    if (!results) return;

    if (!flags.length) {
        results.innerHTML = '<div class="muted-box">Sonuç bulunamadı. Farklı bir ülke adı ya da kod deneyebilirsin.</div>';
        return;
    }

    results.innerHTML = `
        <div class="country-flags-grid">
            ${flags.map(flag => `
                <button class="country-flag-card" type="button" data-country-flag="${countryFlagsEscapeHtml(flag.alpha2)}">
                    <div class="country-flag-thumb-wrap">
                        <img
                            class="country-flag-thumb"
                            src="${countryFlagsEscapeHtml(flag.png_1280 || flag.svg || '')}"
                            alt="${countryFlagsEscapeHtml(flag.country_name)} bayrağı"
                            loading="lazy"
                        >
                    </div>
                    <div class="country-flag-body">
                        <div class="country-flag-name">${countryFlagsEscapeHtml(flag.country_name)}</div>
                        <div class="country-flag-meta">${countryFlagsEscapeHtml(flag.alpha2)} · ${countryFlagsEscapeHtml(flag.alpha3)}</div>
                    </div>
                </button>
            `).join('')}
        </div>
    `;
}

function countryFlagsAttachInsertHandlers(root, state, app) {
    const buttons = root.querySelectorAll('[data-country-flag]');
    const status = root.querySelector('#countryFlagsStatus');

    buttons.forEach(button => {
        button.addEventListener('click', async () => {
            const alpha2 = button.dataset.countryFlag;
            const flag = state.filtered.find(item => item.alpha2 === alpha2);
            if (!flag || !status) return;

            const src = flag.png_1280 || flag.svg || '';
            if (!src) {
                status.hidden = false;
                status.textContent = 'Bu bayrak için uygun görsel bulunamadı.';
                return;
            }

            const canvasSize = app.getCanvasSize();
            status.hidden = false;
            status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bayrak canvas\'a ekleniyor...';
            button.disabled = true;

            try {
                const imageMeta = await countryFlagsLoadImageMeta(src);
                const placement = countryFlagsComputePlacement(imageMeta.width, imageMeta.height, canvasSize);

                if (typeof window.addLayer !== 'function') {
                    throw new Error('Katman ekleme fonksiyonu bulunamadı.');
                }

                window.addLayer('raster', {
                    name: `${flag.country_name} Bayrağı`,
                    src,
                    aspectLocked: true,
                    width: placement.width,
                    height: placement.height,
                    x: placement.x,
                    y: placement.y
                });

                status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${flag.country_name} bayrağı eklendi. Kısa kenar ${placement.shortSide}px olarak ayarlandı.`;
                app.closeModal();
            } catch (error) {
                status.hidden = false;
                status.textContent = 'Ekleme hatası: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
    });
}

function countryFlagsRefresh(root, state, app) {
    const query = root.querySelector('#countryFlagsQuery')?.value || '';
    state.filtered = countryFlagsFilter(state.flags, query);
    countryFlagsRenderResults(root, state.filtered);
    countryFlagsAttachInsertHandlers(root, state, app);

    const count = root.querySelector('#countryFlagsCount');
    if (count) {
        count.textContent = `${state.filtered.length} ülke`;
    }
}

registerStudioPlugin({
    id: 'country-flags',
    name: 'Ülke Bayrakları',
    menuLabel: 'Ülke Bayrakları',
    icon: 'fa-solid fa-flag',
    init(app) {
        ensureCountryFlagsStyles(app);
    },
    openModal(app) {
        return {
            title: 'Ülke Bayrakları',
            subtitle: 'Bir ülke seç, bayrak kısa kenarı canvasın uzun kenarına göre otomatik yerleşsin.',
            html: `
                <div class="plugin-form country-flags-plugin">
                    <div class="field">
                        <label for="countryFlagsQuery">Ülke ara</label>
                        <input id="countryFlagsQuery" class="country-flags-search-input" type="text" placeholder="Örn: Türkiye, TR, United States">
                    </div>

                    <div class="country-flags-toolbar">
                        <div id="countryFlagsCount" class="country-flags-count">Yükleniyor...</div>
                    </div>

                    <div id="countryFlagsStatus" class="plugin-status" hidden></div>
                    <div id="countryFlagsResults" class="country-flags-results">
                        <div class="muted-box">Bayraklar yükleniyor...</div>
                    </div>
                </div>
            `,
            onOpen({ root, app }) {
                ensureCountryFlagsStyles(app);

                const state = {
                    flags: [],
                    filtered: []
                };

                const queryInput = root.querySelector('#countryFlagsQuery');
                const status = root.querySelector('#countryFlagsStatus');

                requestAnimationFrame(() => {
                    queryInput?.focus();
                    queryInput?.select?.();
                });

                queryInput?.addEventListener('input', () => {
                    countryFlagsRefresh(root, state, app);
                });

                countryFlagsFetchList(app)
                    .then(flags => {
                        state.flags = flags;
                        countryFlagsRefresh(root, state, app);
                        if (status) {
                            status.hidden = true;
                            status.textContent = '';
                        }
                    })
                    .catch(error => {
                        if (status) {
                            status.hidden = false;
                            status.textContent = 'Veri hatası: ' + error.message;
                        }
                        const results = root.querySelector('#countryFlagsResults');
                        if (results) {
                            results.innerHTML = '<div class="muted-box">Bayrak listesi yüklenemedi.</div>';
                        }
                        const count = root.querySelector('#countryFlagsCount');
                        if (count) {
                            count.textContent = '0 ülke';
                        }
                    });
            }
        };
    }
});
