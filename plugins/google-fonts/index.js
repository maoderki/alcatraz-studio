const GOOGLE_FONTS_DEFAULT_API_KEY = 'AIzaSyCixYVLw5AosxPeDITocD6hVKBRQRGx0us';
const GOOGLE_FONTS_PAGE_SIZE = 18;
const GOOGLE_FONTS_SORT_OPTIONS = [
    { value: 'popularity', label: 'Popüler' },
    { value: 'alpha', label: 'Alfabetik' },
    { value: 'trending', label: 'Trend' },
    { value: 'date', label: 'Yeni' },
    { value: 'style', label: 'Stil Sayısı' }
];

let googleFontsCache = [];
let googleFontsCacheSort = 'popularity';
let googleFontsCurrentPage = 1;
let googleFontsStylesInjected = false;

function googleFontsEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function googleFontsGetApiKey() {
    return GOOGLE_FONTS_DEFAULT_API_KEY;
}

function ensureGoogleFontsStyles() {
    if (googleFontsStylesInjected) return;
    const style = document.createElement('style');
    style.id = 'googleFontsPluginStyles';
    style.textContent = `
        .google-fonts-plugin {
            display: grid;
            gap: 14px;
        }

        .google-fonts-searchbar {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 0;
            align-items: center;
            overflow: hidden;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--control-bg);
        }

        .google-fonts-search-input {
            width: 100%;
            height: 44px;
            min-width: 0;
            border: none;
            background: transparent;
            color: var(--text);
            padding: 0 14px;
            outline: none;
            font-size: 14px;
        }

        .google-fonts-search-meta {
            display: flex;
            align-items: center;
            gap: 0;
            padding: 0 10px 0 0;
        }

        .google-fonts-category {
            width: 168px;
            height: 36px;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: var(--panel-soft);
            color: var(--text);
            padding: 0 12px !important;
            outline: none;
            font-size: 13px;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .google-fonts-sortbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }

        .google-fonts-sortchips {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .google-fonts-sortchip {
            border: 1px solid var(--border);
            background: var(--control-bg);
            color: var(--text);
            border-radius: 999px;
            padding: 8px 12px;
            font-size: 12px;
            line-height: 1;
            cursor: pointer;
            transition: .15s ease;
        }

        .google-fonts-sortchip:hover {
            background: var(--active-control-bg);
            border-color: var(--active-control-border);
            color: var(--text-strong);
        }

        .google-fonts-sortchip.active {
            background: var(--active-control-bg);
            border-color: var(--active-control-border);
            color: var(--text-strong);
        }

        .google-fonts-results {
            display: grid;
            gap: 10px;
            max-height: 420px;
            overflow: auto;
            padding-right: 4px;
        }

        .google-fonts-add-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-width: 96px;
            height: 40px;
            padding: 0 14px;
            border-radius: 12px;
            border: 1px solid var(--border-strong);
            background: var(--control-bg);
            color: var(--text-strong);
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: .18s ease;
            white-space: nowrap;
        }

        .google-fonts-add-btn:hover:not(:disabled) {
            background: var(--control-hover);
            border-color: var(--active-control-border);
        }

        .google-fonts-add-btn:disabled {
            opacity: .72;
            cursor: default;
        }

        .google-fonts-add-btn i {
            font-size: 12px;
        }

        @media (max-width: 640px) {
            .google-fonts-searchbar {
                grid-template-columns: 1fr;
            }

            .google-fonts-search-meta {
                border-left: 0;
                border-top: 1px solid var(--border);
                padding: 10px 12px;
                justify-content: flex-end;
            }

            .google-fonts-category {
                width: auto;
                flex: 1;
            }
        }
    `;
    document.head.appendChild(style);
    googleFontsStylesInjected = true;
}

function googleFontsExtractWeights(font) {
    const weights = new Set();
    const variants = Array.isArray(font?.variants) ? font.variants : [];

    variants.forEach(variant => {
        if (variant === 'regular' || variant === 'italic') {
            weights.add(400);
            return;
        }
        const match = String(variant).match(/\d+/);
        if (match) {
            const num = Number(match[0]);
            if (Number.isFinite(num)) weights.add(Math.max(100, Math.min(900, num)));
        }
    });

    const axes = Array.isArray(font?.axes) ? font.axes : [];
    const weightAxis = axes.find(axis => axis?.tag === 'wght');
    if (weightAxis) {
        const start = Number(weightAxis.start);
        const end = Number(weightAxis.end);
        if (Number.isFinite(start) && Number.isFinite(end)) {
            for (let value = start; value <= end; value += 100) {
                weights.add(Math.max(100, Math.min(900, value)));
            }
        }
    }

    if (!weights.size) weights.add(400);
    return [...weights].sort((a, b) => a - b);
}

function googleFontsMapFont(font) {
    return {
        family: font.family,
        weights: googleFontsExtractWeights(font),
        category: font.category || '',
        subsets: Array.isArray(font.subsets) ? font.subsets : [],
        source: 'custom',
        previewText: 'Ag'
    };
}

function googleFontsIsAdded(family) {
    return typeof window.getCustomGoogleFonts === 'function'
        && window.getCustomGoogleFonts().some(font => font.family === family);
}

function googleFontsBuildResultCard(font) {
    const mapped = googleFontsMapFont(font);
    const added = googleFontsIsAdded(mapped.family);
    const familyEscaped = googleFontsEscapeHtml(mapped.family);
    const meta = [
        mapped.category || 'font',
        `${mapped.weights.length} weight`,
        Array.isArray(mapped.subsets) && mapped.subsets.length ? mapped.subsets.slice(0, 3).join(', ') : ''
    ].filter(Boolean).join(' • ');

    return `
        <div class="plugin-options-card" data-google-font-card="${familyEscaped}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div style="min-width:0;">
                    <div style="font-size:22px;line-height:1.25;margin-top:12px;font-family:'${familyEscaped}', Arial, sans-serif;">${familyEscaped}</div>
                    <div style="font-size:12px;color:var(--muted);margin-top:4px;">${googleFontsEscapeHtml(meta)}</div>
                </div>
                <button
                    class="google-fonts-add-btn"
                    type="button"
                    data-google-font-add="${familyEscaped}"
                    ${added ? 'disabled' : ''}>
                    <i class="fa-solid ${added ? 'fa-check' : 'fa-plus'}" aria-hidden="true"></i>
                    <span>${added ? 'Eklendi' : 'Ekle'}</span>
                </button>
            </div>
        </div>
    `;
}

function googleFontsFilterFonts(root) {
    const query = (root.querySelector('#googleFontsSearch')?.value || '').trim().toLowerCase();
    const category = root.querySelector('#googleFontsCategory')?.value || 'all';

    return googleFontsCache.filter(font => {
        const matchesQuery = !query || String(font.family || '').toLowerCase().includes(query);
        const matchesCategory = category === 'all' || String(font.category || '') === category;
        return matchesQuery && matchesCategory;
    });
}

function googleFontsRenderPagination(root, totalItems) {
    const pagination = root.querySelector('#googleFontsPagination');
    if (!pagination) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / GOOGLE_FONTS_PAGE_SIZE));
    googleFontsCurrentPage = Math.max(1, Math.min(googleFontsCurrentPage, totalPages));

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    const pages = [];
    for (let page = 1; page <= totalPages; page += 1) {
        if (
            page === 1 ||
            page === totalPages ||
            Math.abs(page - googleFontsCurrentPage) <= 1
        ) {
            pages.push(page);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }

    pagination.innerHTML = `
        <button class="mini-btn" type="button" data-google-font-page="${googleFontsCurrentPage - 1}" ${googleFontsCurrentPage <= 1 ? 'disabled' : ''}>Geri</button>
        ${pages.map(item => item === '...'
        ? `<span class="plugin-status" style="min-height:auto;">...</span>`
        : `<button class="mini-btn ${item === googleFontsCurrentPage ? 'active' : ''}" type="button" data-google-font-page="${item}">${item}</button>`
    ).join('')}
        <button class="mini-btn" type="button" data-google-font-page="${googleFontsCurrentPage + 1}" ${googleFontsCurrentPage >= totalPages ? 'disabled' : ''}>İleri</button>
    `;
}

function googleFontsRenderResults(root) {
    const list = root.querySelector('#googleFontsResults');
    const count = root.querySelector('#googleFontsResultCount');
    if (!list || !count) return;

    const filtered = googleFontsFilterFonts(root);
    const totalPages = Math.max(1, Math.ceil(filtered.length / GOOGLE_FONTS_PAGE_SIZE));
    googleFontsCurrentPage = Math.max(1, Math.min(googleFontsCurrentPage, totalPages));
    const start = (googleFontsCurrentPage - 1) * GOOGLE_FONTS_PAGE_SIZE;
    const visible = filtered.slice(start, start + GOOGLE_FONTS_PAGE_SIZE);

    count.textContent = `${filtered.length} font`;

    if (!visible.length) {
        list.innerHTML = '<div class="plugin-status">Sonuç bulunamadı.</div>';
        googleFontsRenderPagination(root, 0);
        return;
    }

    list.innerHTML = visible.map(googleFontsBuildResultCard).join('');
    googleFontsRenderPagination(root, filtered.length);
}

async function googleFontsFetchArchive(apiKey, sort) {
    const url = `https://www.googleapis.com/webfonts/v1/webfonts?sort=${encodeURIComponent(sort)}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || 'Google Fonts listesi alınamadı.');
    }
    return Array.isArray(data?.items) ? data.items : [];
}

registerStudioPlugin({
    id: 'google-fonts',
    name: 'Google Fonts',
    menuLabel: 'Google Fonts',
    icon: 'fa-solid fa-font',
    openModal() {
        return {
            title: 'Google Fonts',
            subtitle: 'Google Fonts arşivinden font ara, ekle ve localStorage ile kalıcı kullan.',
            html: `
                <div class="plugin-form google-fonts-plugin">
                    <div class="field" style="margin-bottom:0;">
                        <div class="google-fonts-searchbar">
                            <input id="googleFontsSearch" class="google-fonts-search-input" type="text" placeholder="Font ara">
                            <div class="google-fonts-search-meta">
                                <select id="googleFontsCategory" class="google-fonts-category">
                                    <option value="all">Tüm Kategoriler</option>
                                    <option value="sans-serif">Sans</option>
                                    <option value="serif">Serif</option>
                                    <option value="display">Display</option>
                                <option value="handwriting">Handwriting</option>
                                <option value="monospace">Monospace</option>
                            </select>
                            </div>
                        </div>
                    </div>

                    <div class="google-fonts-sortbar">
                        <div class="google-fonts-sortchips">
                            ${GOOGLE_FONTS_SORT_OPTIONS.map(option => `
                                <button
                                    class="google-fonts-sortchip ${option.value === googleFontsCacheSort ? 'active' : ''}"
                                    type="button"
                                    data-google-font-sort="${option.value}">
                                    ${option.label}
                                </button>
                            `).join('')}
                        </div>
                        <div id="googleFontsResultCount" class="plugin-status">0 font</div>
                    </div>

                    <div id="googleFontsStatus" class="plugin-status"></div>
                    <div id="googleFontsResults" class="google-fonts-results"></div>
                    <div id="googleFontsPagination" style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;"></div>
                </div>
            `,
            onOpen({ root }) {
                ensureGoogleFontsStyles();
                const searchInput = root.querySelector('#googleFontsSearch');
                const categorySelect = root.querySelector('#googleFontsCategory');
                const status = root.querySelector('#googleFontsStatus');
                const results = root.querySelector('#googleFontsResults');
                const pagination = root.querySelector('#googleFontsPagination');

                const rerender = (resetPage = false) => {
                    if (resetPage) googleFontsCurrentPage = 1;
                    googleFontsRenderResults(root);
                };

                searchInput?.addEventListener('input', () => rerender(true));
                categorySelect?.addEventListener('change', () => rerender(true));

                root.querySelectorAll('[data-google-font-sort]').forEach(button => {
                    button.addEventListener('click', async () => {
                        const sort = button.dataset.googleFontSort || 'popularity';
                        if (sort === googleFontsCacheSort && googleFontsCache.length) return;

                        googleFontsCacheSort = sort;
                        root.querySelectorAll('[data-google-font-sort]').forEach(item => {
                            item.classList.toggle('active', item.dataset.googleFontSort === sort);
                        });

                        status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fontlar sıralanıyor...';
                        try {
                            googleFontsCache = await googleFontsFetchArchive(googleFontsGetApiKey(), googleFontsCacheSort);
                            status.textContent = `${googleFontsCache.length} font bulundu.`;
                            rerender(true);
                        } catch (error) {
                            status.textContent = error.message || 'Google Fonts alınamadı.';
                        }
                    });
                });

                pagination?.addEventListener('click', event => {
                    const button = event.target.closest('[data-google-font-page]');
                    if (!button) return;
                    const page = Number(button.dataset.googleFontPage);
                    if (!Number.isFinite(page) || page < 1) return;
                    googleFontsCurrentPage = page;
                    googleFontsRenderResults(root);
                    results?.scrollTo({ top: 0, behavior: 'smooth' });
                });

                const loadArchive = async (force = false) => {
                    if (googleFontsCache.length && !force) {
                        status.textContent = `${googleFontsCache.length} font hazır.`;
                        rerender(true);
                        return;
                    }

                    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Google Fonts arşivi yükleniyor...';

                    try {
                        googleFontsCache = await googleFontsFetchArchive(googleFontsGetApiKey(), googleFontsCacheSort);
                        status.textContent = `${googleFontsCache.length} font bulundu.`;
                        rerender(true);
                    } catch (error) {
                        googleFontsCache = [];
                        results.innerHTML = '';
                        if (pagination) pagination.innerHTML = '';
                        status.textContent = error.message || 'Google Fonts alınamadı.';
                    }
                };

                results?.addEventListener('click', event => {
                    const button = event.target.closest('[data-google-font-add]');
                    if (!button) return;

                    const family = button.dataset.googleFontAdd;
                    const font = googleFontsCache.find(item => item.family === family);
                    if (!font || typeof window.addCustomGoogleFont !== 'function') return;

                    const added = window.addCustomGoogleFont(googleFontsMapFont(font));
                    if (!added) {
                        status.textContent = 'Font eklenemedi.';
                        return;
                    }

                    button.disabled = true;
                    button.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>Eklendi</span>';
                    status.textContent = `${family} font kütüphanene eklendi.`;
                });

                void loadArchive(false);
            }
        };
    }
});
