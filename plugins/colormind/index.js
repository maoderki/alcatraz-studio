const COLORMIND_STYLE_ID = 'studio-plugin-colormind-style';
function ensureColormindStyles(app) {
    if (document.getElementById(COLORMIND_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = COLORMIND_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function colormindEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function colormindRgbToHex(rgb) {
    if (!Array.isArray(rgb) || rgb.length < 3) return '#000000';
    return '#' + rgb.slice(0, 3)
        .map(value => Math.max(0, Math.min(255, Number(value) || 0)).toString(16).padStart(2, '0'))
        .join('');
}

function colormindHexToRgb(hex) {
    const normalized = String(hex || '').trim();
    const match = normalized.match(/^#?([0-9a-f]{6})$/i);
    if (!match) return [0, 0, 0];
    const value = match[1];
    return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16)
    ];
}

async function colormindGeneratePalette(app, payload) {
    const response = await fetch(app.getBackendUrl('colormind.php'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `Istek basarisiz oldu (${response.status})`);
    }

    const result = Array.isArray(data?.result) ? data.result : [];
    if (!result.length) {
        throw new Error('Colormind bos palette dondurdu.');
    }

    return result.map(colormindRgbToHex);
}

function colormindRenderPalette(root, palette) {
    const container = root.querySelector('#colormindPalette');
    if (!container) return;

    if (!Array.isArray(palette) || !palette.length) {
        container.hidden = true;
        container.innerHTML = '';
        return;
    }

    container.hidden = false;
    container.innerHTML = `
        <div class="colormind-palette-grid">
            ${palette.map((color, index) => `
                <button class="colormind-swatch-card" type="button" data-colormind-color="${colormindEscapeHtml(color)}" title="${colormindEscapeHtml(color)}">
                    <div class="colormind-swatch-preview" style="background:${color};"></div>
                    <div class="colormind-swatch-meta">
                        <span class="colormind-swatch-index">${index + 1}</span>
                        <span class="colormind-swatch-hex">${colormindEscapeHtml(color)}</span>
                    </div>
                </button>
            `).join('')}
        </div>
    `;
}

function colormindApplyPaletteToColorWidget(palette) {
    if (!Array.isArray(palette) || palette.length < 2) return false;
    cwFgColor = palette[0];
    cwBgColor = palette[palette.length - 1];

    if (typeof syncGradientToolPresetFromColorWidget === 'function') {
        syncGradientToolPresetFromColorWidget();
    }
    if (typeof updateColorWidget === 'function') updateColorWidget();
    if (typeof renderContextBar === 'function') renderContextBar();
    if (typeof refreshInspectorFlyoutIfNeeded === 'function') refreshInspectorFlyoutIfNeeded();
    return true;
}

function colormindApplyPaletteToGradient(palette) {
    if (!Array.isArray(palette) || palette.length < 2 || typeof window.setGradientToolPreset !== 'function') {
        return false;
    }

    const lastIndex = palette.length - 1;
    const stops = palette.map((color, index) => ({
        color,
        pos: lastIndex === 0 ? 0 : Math.round((index / lastIndex) * 100)
    }));

    const applied = window.setGradientToolPreset({
        gradientType: 'linear',
        angle: 135,
        stops
    });

    if (applied && typeof window.selectTool === 'function') {
        window.selectTool('gradient');
    }

    return applied;
}

function colormindAttachPaletteHandlers(root, state) {
    root.querySelectorAll('[data-colormind-color]').forEach(button => {
        button.addEventListener('click', () => {
            const color = button.dataset.colormindColor;
            if (!color) return;

            if (cwActiveSlot === 'bg') {
                cwBgColor = color;
            } else {
                cwFgColor = color;
            }

            if (typeof syncGradientToolPresetFromColorWidget === 'function') {
                syncGradientToolPresetFromColorWidget();
            }
            if (typeof updateColorWidget === 'function') updateColorWidget();
            if (typeof renderContextBar === 'function') renderContextBar();
            if (typeof refreshInspectorFlyoutIfNeeded === 'function') refreshInspectorFlyoutIfNeeded();
        });
    });
}

registerStudioPlugin({
    id: 'colormind',
    name: 'Colormind',
    menuLabel: 'Colormind',
    icon: 'fa-solid fa-palette',
    init(app) {
        ensureColormindStyles(app);
    },
    openModal(app) {
        return {
            title: 'Colormind',
            subtitle: 'Yapay zeka ile renk paleti uret, renk widgetina ya da gradient aracina aktar.',
            html: `
                <div class="plugin-form colormind-plugin">
                    <div class="field">
                        <label for="colormindModel">Model</label>
                        <select id="colormindModel" class="plugin-select">
                            <option value="default">Default</option>
                            <option value="ui">UI</option>
                        </select>
                    </div>

                    <div class="colormind-action-panel">
                        <div class="colormind-action-group">
                            <div class="colormind-group-label">Palette Uret</div>
                            <div class="colormind-actions">
                                <button id="colormindGenerate" class="plugin-primary-btn colormind-btn-primary" type="button">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> Rastgele Uret
                                </button>
                                <button id="colormindSeeded" class="colormind-btn-secondary" type="button">
                                    <i class="fa-solid fa-droplet"></i> FG/BG ile Uret
                                </button>
                            </div>
                        </div>

                        <div class="colormind-action-group">
                            <div class="colormind-group-label">Palette Uygula</div>
                            <div class="colormind-actions colormind-actions-secondary">
                                <button id="colormindUseColors" class="colormind-btn-ghost" type="button" disabled>
                                    <i class="fa-solid fa-swatchbook"></i> FG/BG Olarak Ata
                                </button>
                                <button id="colormindUseGradient" class="colormind-btn-ghost" type="button" disabled>
                                    <i class="fa-solid fa-fill-drip"></i> Gradiente Aktar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="colormindStatus" class="plugin-status" hidden></div>
                    <div id="colormindPalette" class="colormind-palette" hidden></div>
                </div>
            `,
            onOpen({ root }) {
                ensureColormindStyles(app);

                const state = {
                    palette: []
                };

                const modelInput = root.querySelector('#colormindModel');
                const generateButton = root.querySelector('#colormindGenerate');
                const seededButton = root.querySelector('#colormindSeeded');
                const useColorsButton = root.querySelector('#colormindUseColors');
                const useGradientButton = root.querySelector('#colormindUseGradient');
                const status = root.querySelector('#colormindStatus');

                const syncButtons = () => {
                    const enabled = state.palette.length >= 2;
                    useColorsButton.disabled = !enabled;
                    useGradientButton.disabled = !enabled;
                };

                const renderPalette = () => {
                    colormindRenderPalette(root, state.palette);
                    colormindAttachPaletteHandlers(root, state);
                    syncButtons();
                };

                const runGeneration = async (mode) => {
                    const model = modelInput?.value || 'default';
                    const payload = { model };

                    if (mode === 'seeded') {
                        payload.input = [
                            colormindHexToRgb(cwFgColor),
                            'N',
                            'N',
                            'N',
                            colormindHexToRgb(cwBgColor)
                        ];
                    }

                    status.hidden = false;
                    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Colormind palette uretiyor...';
                    generateButton.disabled = true;
                    seededButton.disabled = true;

                    try {
                        state.palette = await colormindGeneratePalette(app, payload);
                        renderPalette();
                        status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${state.palette.length} renk uretildi.`;
                    } catch (error) {
                        state.palette = [];
                        renderPalette();
                        status.hidden = false;
                        status.textContent = 'Hata: ' + error.message;
                    } finally {
                        generateButton.disabled = false;
                        seededButton.disabled = false;
                    }
                };

                generateButton?.addEventListener('click', () => {
                    void runGeneration('random');
                });

                seededButton?.addEventListener('click', () => {
                    void runGeneration('seeded');
                });

                useColorsButton?.addEventListener('click', () => {
                    if (!colormindApplyPaletteToColorWidget(state.palette)) return;
                    status.hidden = false;
                    status.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981"></i> Palette FG/BG renklerine aktarildi.';
                    app.closeModal();
                });

                useGradientButton?.addEventListener('click', () => {
                    if (!colormindApplyPaletteToGradient(state.palette)) return;
                    status.hidden = false;
                    status.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981"></i> Palette gradient aracina aktarildi.';
                    app.closeModal();
                });
            }
        };
    }
});
