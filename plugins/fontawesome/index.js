const FONTAWESOME_STYLE_ID = 'studio-plugin-fontawesome-style';
const FONTAWESOME_MAX_RESULTS = 120;
const FONTAWESOME_SVG_BASE_URL = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/svgs';

function ensureFontAwesomeStyles(app) {
    if (document.getElementById(FONTAWESOME_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = FONTAWESOME_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function fontAwesomeEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function fontAwesomeNormalize(value) {
    return String(value ?? '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function fontAwesomeStyleLabel(style) {
    if (style === 'brands') return 'brands';
    if (style === 'regular') return 'regular';
    return 'solid';
}

function fontAwesomeStyleToPrefix(style) {
    if (style === 'brands') return 'fa-brands';
    if (style === 'regular') return 'fa-regular';
    return 'fa-solid';
}

function fontAwesomeStyleToFolder(style) {
    if (style === 'brands') return 'brands';
    if (style === 'regular') return 'regular';
    return 'solid';
}

function fontAwesomeGetFontConfig(style) {
    if (style === 'brands') {
        return { family: 'Font Awesome 6 Brands', weight: 400 };
    }

    return {
        family: 'Font Awesome 6 Free',
        weight: style === 'regular' ? 400 : 900
    };
}

function fontAwesomeUnicodeToChar(unicode) {
    if (!unicode) return '';
    const code = parseInt(String(unicode).trim(), 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : '';
}

async function fontAwesomeFetchSvg(iconId, style) {
    const folder = fontAwesomeStyleToFolder(style);
    const response = await fetch(`${FONTAWESOME_SVG_BASE_URL}/${folder}/${iconId}.svg`);
    const svgText = await response.text();

    if (!response.ok || !svgText.trim()) {
        throw new Error(`SVG alınamadı (${response.status})`);
    }

    return svgText;
}

function fontAwesomeBuildSvgDataUrl(svgText, color = '#ffffff') {
    const svgWithColor = svgText.replace(
        /<svg\b([^>]*)>/i,
        `<svg$1 fill="${color}" color="${color}">`
    );

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgWithColor)}`;
}

function fontAwesomeGetSvgAspectRatio(svgText) {
    const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/i);
    if (!viewBoxMatch) return 1;

    const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length !== 4 || !Number.isFinite(parts[2]) || !Number.isFinite(parts[3]) || parts[3] === 0) {
        return 1;
    }

    return parts[2] / parts[3];
}

function fontAwesomeBuildSearchText(icon) {
    return fontAwesomeNormalize([
        icon.id,
        icon.label,
        ...(Array.isArray(icon.terms) ? icon.terms : [])
    ].join(' '));
}

function fontAwesomeNormalizeIconList(items) {
    return (Array.isArray(items) ? items : [])
        .map(item => {
            const styles = Array.isArray(item?.styles)
                ? item.styles.filter(style => ['solid', 'regular', 'brands'].includes(style))
                : [];
            if (!item?.id || !item?.unicode || !styles.length) return null;

            return {
                id: item.id,
                label: item.label || item.id,
                unicode: item.unicode,
                terms: Array.isArray(item?.terms) ? item.terms : [],
                styles,
                searchText: fontAwesomeBuildSearchText({
                    id: item.id,
                    label: item.label || item.id,
                    terms: Array.isArray(item?.terms) ? item.terms : []
                })
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

async function fontAwesomeFetchLocalIcons(app) {
    const response = await fetch(app.getAssetUrl('icons.json'));
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(`Yerel ikon listesi alınamadı (${response.status})`);
    }

    const icons = fontAwesomeNormalizeIconList(data.icons);
    if (!icons.length) {
        throw new Error('Yerel ikon listesi boş geldi.');
    }

    return icons;
}

function fontAwesomeFilterIcons(icons, query, style) {
    const normalizedQuery = fontAwesomeNormalize(query);
    const filtered = icons.filter(icon => {
        if (style !== 'all' && !icon.styles.includes(style)) return false;
        if (!normalizedQuery) return true;
        return icon.searchText.includes(normalizedQuery);
    });

    return filtered.slice(0, FONTAWESOME_MAX_RESULTS);
}

function fontAwesomeMeasureIcon(char, fontSize, fontFamily, fontWeight) {
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.left = '-99999px';
    probe.style.top = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.whiteSpace = 'pre';
    probe.style.lineHeight = '1';
    probe.style.padding = '0';
    probe.style.margin = '0';
    probe.style.fontSize = fontSize + 'px';
    probe.style.fontWeight = String(fontWeight);
    probe.style.fontFamily = `${fontFamily}, Arial, sans-serif`;
    probe.textContent = char || ' ';
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    probe.remove();

    return {
        width: Math.max(1, Math.ceil(rect.width)),
        height: Math.max(1, Math.ceil(rect.height))
    };
}

async function fontAwesomeEnsureFontReady(fontFamily, fontWeight, fontSize) {
    if (!document.fonts?.load) return;

    try {
        await document.fonts.load(`${fontWeight} ${fontSize}px "${fontFamily}"`, ' ');
    } catch (error) {
        console.warn('Font Awesome font load warning:', error);
    }
}

function fontAwesomeComputePlacement(icon, style, canvasSize) {
    const shortSide = Math.max(1, Math.min(canvasSize.width, canvasSize.height));
    const targetSide = Math.max(48, Math.round(shortSide * 0.72));
    const width = targetSide;
    const height = targetSide;

    return {
        width,
        height,
        x: Math.round((canvasSize.width - width) / 2),
        y: Math.round((canvasSize.height - height) / 2)
    };
}

function fontAwesomeRenderResults(root, state) {
    const results = root.querySelector('#fontAwesomeResults');
    const count = root.querySelector('#fontAwesomeCount');
    if (!results || !count) return;

    count.textContent = `${state.filtered.length} ikon`;

    if (!state.filtered.length) {
        results.innerHTML = '<div class="fontawesome-empty">Sonuç bulunamadı. Farklı bir anahtar kelime deneyebilirsin.</div>';
        return;
    }

    results.innerHTML = `
        <div class="fontawesome-results-grid">
            ${state.filtered.map(icon => {
                const previewStyle = state.activeStyle === 'all'
                    ? (icon.styles[0] || 'solid')
                    : state.activeStyle;
                const previewClass = `${fontAwesomeStyleToPrefix(previewStyle)} fa-${icon.id}`;

                return `
                    <button class="fontawesome-card" type="button" data-fontawesome-icon="${fontAwesomeEscapeHtml(icon.id)}">
                        <div class="fontawesome-card-preview">
                            <i class="${fontAwesomeEscapeHtml(previewClass)}" aria-hidden="true"></i>
                        </div>
                        <div class="fontawesome-card-label">${fontAwesomeEscapeHtml(icon.label)}</div>
                        <div class="fontawesome-card-meta">
                            ${icon.styles.map(style => `
                                <span class="fontawesome-style-badge">${fontAwesomeEscapeHtml(fontAwesomeStyleLabel(style))}</span>
                            `).join('')}
                        </div>
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function fontAwesomeRefresh(root, state) {
    state.filtered = fontAwesomeFilterIcons(state.icons, state.query, state.activeStyle);
    fontAwesomeRenderResults(root, state);
    root.querySelectorAll('[data-fontawesome-style]').forEach(button => {
        button.classList.toggle('active', button.dataset.fontawesomeStyle === state.activeStyle);
    });
}

function fontAwesomeAttachResultHandlers(root, state, app) {
    const status = root.querySelector('#fontAwesomeStatus');
    root.querySelectorAll('[data-fontawesome-icon]').forEach(button => {
        button.addEventListener('click', async () => {
            const iconId = button.dataset.fontawesomeIcon;
            const icon = state.filtered.find(item => item.id === iconId);
            if (!icon || !status) return;

            const style = state.activeStyle === 'all'
                ? (icon.styles[0] || 'solid')
                : (icon.styles.includes(state.activeStyle) ? state.activeStyle : (icon.styles[0] || 'solid'));

            const canvasSize = app.getCanvasSize();
            const placement = fontAwesomeComputePlacement(icon, style, canvasSize);

            status.hidden = false;
            status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İkon canvas\'a ekleniyor...';
            button.disabled = true;

            try {
                if (typeof window.addLayer !== 'function') {
                    throw new Error('Katman ekleme fonksiyonu bulunamadı.');
                }

                const svgText = await fontAwesomeFetchSvg(icon.id, style);
                const aspectRatio = fontAwesomeGetSvgAspectRatio(svgText);
                const maxSide = Math.max(48, Math.round(Math.min(canvasSize.width, canvasSize.height) * 0.72));
                const width = aspectRatio >= 1 ? maxSide : Math.round(maxSide * aspectRatio);
                const height = aspectRatio >= 1 ? Math.round(maxSide / aspectRatio) : maxSide;
                const src = fontAwesomeBuildSvgDataUrl(svgText, '#ffffff');

                window.addLayer('raster', {
                    name: `FA - ${icon.label}`,
                    src,
                    aspectLocked: true,
                    width,
                    height,
                    x: Math.round((canvasSize.width - width) / 2),
                    y: Math.round((canvasSize.height - height) / 2)
                });

                status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${fontAwesomeEscapeHtml(icon.label)} canvas'a eklendi.`;
                app.closeModal();
            } catch (error) {
                status.textContent = 'Ekleme hatası: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
    });
}

registerStudioPlugin({
    id: 'fontawesome',
    name: 'Font Awesome',
    menuLabel: 'Font Awesome',
    icon: 'fa-solid fa-icons',
    init(app) {
        ensureFontAwesomeStyles(app);
    },
    openModal(app) {
        return {
            title: 'Font Awesome',
            subtitle: 'İkon ara, stilini seç ve aktif canvas boyutuna oturan şekilde ekle.',
            html: `
                <div class="plugin-form fontawesome-plugin">
                    <div class="field">
                        <label for="fontAwesomeQuery">İkon ara</label>
                        <div class="fontawesome-search-row">
                            <input id="fontAwesomeQuery" class="fontawesome-search-input" type="text" placeholder="Örn: instagram, search, heart, house, shopping">
                        </div>
                    </div>

                    <div class="fontawesome-toolbar">
                        <div class="fontawesome-style-filters">
                            <button class="fontawesome-style-chip active" type="button" data-fontawesome-style="all">Tümü</button>
                            <button class="fontawesome-style-chip" type="button" data-fontawesome-style="solid">Solid</button>
                            <button class="fontawesome-style-chip" type="button" data-fontawesome-style="regular">Regular</button>
                            <button class="fontawesome-style-chip" type="button" data-fontawesome-style="brands">Brands</button>
                        </div>
                        <div id="fontAwesomeCount" class="fontawesome-count">0 ikon</div>
                    </div>

                    <div id="fontAwesomeStatus" class="plugin-status" hidden></div>
                    <div id="fontAwesomeResults" class="fontawesome-results">
                        <div class="fontawesome-empty">İkonlar hazırlanıyor...</div>
                    </div>
                </div>
            `,
            onOpen({ root, app }) {
                ensureFontAwesomeStyles(app);

                const state = {
                    icons: [],
                    filtered: [],
                    query: '',
                    activeStyle: 'all'
                };

                const queryInput = root.querySelector('#fontAwesomeQuery');
                const status = root.querySelector('#fontAwesomeStatus');

                const refresh = () => {
                    fontAwesomeRefresh(root, state);
                    fontAwesomeAttachResultHandlers(root, state, app);
                };

                const loadIcons = async () => {
                    if (status) {
                        status.hidden = false;
                        status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Font Awesome ikonları yükleniyor...';
                    }

                    try {
                        const icons = await fontAwesomeFetchLocalIcons(app);
                        state.icons = icons;
                        refresh();
                        if (status) {
                            status.hidden = false;
                            status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${icons.length} ikon hazır.`;
                        }
                    } catch (error) {
                        if (status) {
                            status.hidden = false;
                            status.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i> İkon listesi yüklenemedi: ${fontAwesomeEscapeHtml(error.message)}`;
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

                root.querySelectorAll('[data-fontawesome-style]').forEach(button => {
                    button.addEventListener('click', () => {
                        state.activeStyle = button.dataset.fontawesomeStyle || 'all';
                        refresh();
                    });
                });
                void loadIcons();
            }
        };
    }
});
