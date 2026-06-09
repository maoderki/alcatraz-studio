const FOOTBALL_TEAMS_STYLE_ID = 'studio-plugin-football-teams-style';
const FOOTBALL_TEAMS_SUGGESTIONS = ['Galatasaray', 'Fenerbahce', 'Besiktas', 'Barcelona', 'Real Madrid', 'Arsenal'];

function ensureFootballTeamsStyles(app) {
    if (document.getElementById(FOOTBALL_TEAMS_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = FOOTBALL_TEAMS_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function footballTeamsEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function footballTeamsFetchJson(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Istek basarisiz oldu (${response.status})`);
    }

    return data;
}

function footballTeamsBuildProxyLogoUrl(team, app) {
    const logo = String(team?.logo || '').trim();
    if (!logo) return '';
    return `${app.getBackendUrl('teams.php')}?asset=${encodeURIComponent(logo)}`;
}

function footballTeamsLoadImageMeta(src) {
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

function footballTeamsFitLogo(meta, canvasSize) {
    const safeWidth = Math.max(1, Number(meta?.width) || 1);
    const safeHeight = Math.max(1, Number(meta?.height) || 1);
    const maxWidth = Math.max(320, Math.round(canvasSize.width * 0.78));
    const maxHeight = Math.max(320, Math.round(canvasSize.height * 0.78));
    const minWidth = Math.max(260, Math.round(canvasSize.width * 0.58));
    const minHeight = Math.max(260, Math.round(canvasSize.height * 0.58));
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

async function footballTeamsInsertLogo(team, app) {
    const src = footballTeamsBuildProxyLogoUrl(team, app);
    if (!src) {
        throw new Error('Takim logosu bulunamadi.');
    }

    const meta = await footballTeamsLoadImageMeta(src);
    const canvasSize = app.getCanvasSize();
    const placement = footballTeamsFitLogo(meta, canvasSize);

    if (typeof window.addLayer !== 'function') {
        throw new Error('Katman ekleme fonksiyonu bulunamadi.');
    }

    window.addLayer('raster', {
        name: `${team.name || 'Takim'} Logo`,
        src,
        aspectLocked: true,
        width: placement.width,
        height: placement.height,
        x: placement.x,
        y: placement.y
    });
}

function footballTeamsBuildPosterLayers(team, app) {
    const canvasSize = app.getCanvasSize();
    const coverFill = 'linear-gradient(145deg, #081226 0%, #0f172a 42%, #1d4ed8 100%)';
    const logoSize = Math.max(140, Math.round(Math.min(canvasSize.width, canvasSize.height) * 0.24));
    const top = Math.round(canvasSize.height * 0.12);
    const subtitle = [team.country, team.league].filter(Boolean).join(' | ');

    return [
        {
            type: 'shape',
            name: 'Poster Background',
            fill: coverFill,
            x: 0,
            y: 0,
            width: canvasSize.width,
            height: canvasSize.height,
            radius: 0,
            opacity: 1
        },
        {
            type: 'raster',
            name: `${team.name || 'Takim'} Logo`,
            src: footballTeamsBuildProxyLogoUrl(team, app),
            x: Math.round((canvasSize.width - logoSize) / 2),
            y: top,
            width: logoSize,
            height: logoSize,
            aspectLocked: true
        },
        {
            type: 'text',
            name: 'Team Name',
            text: String(team.name || 'Takim').toUpperCase(),
            x: Math.round(canvasSize.width * 0.12),
            y: top + logoSize + 28,
            width: Math.round(canvasSize.width * 0.76),
            height: Math.max(70, Math.round(canvasSize.height * 0.12)),
            color: '#ffffff',
            fontSize: Math.max(34, Math.round(canvasSize.width * 0.06)),
            fontWeight: 800,
            textAlign: 'center',
            fontFamily: 'Inter'
        },
        {
            type: 'text',
            name: 'Team Meta',
            text: subtitle || 'Soccer Club',
            x: Math.round(canvasSize.width * 0.14),
            y: top + logoSize + Math.max(92, Math.round(canvasSize.height * 0.14)),
            width: Math.round(canvasSize.width * 0.72),
            height: Math.max(40, Math.round(canvasSize.height * 0.08)),
            color: 'rgba(226,232,240,0.92)',
            fontSize: Math.max(16, Math.round(canvasSize.width * 0.022)),
            fontWeight: 500,
            textAlign: 'center',
            fontFamily: 'Inter'
        }
    ];
}

async function footballTeamsApplyPoster(team, app) {
    const layers = footballTeamsBuildPosterLayers(team, app);
    if (typeof window.addLayer !== 'function') {
        throw new Error('Katman ekleme fonksiyonu bulunamadi.');
    }

    layers.forEach(layer => {
        window.addLayer(layer.type, layer);
    });
}

function footballTeamsRenderResults(root, state, app) {
    const results = root.querySelector('#footballTeamsResults');
    const count = root.querySelector('#footballTeamsCount');
    if (!results || !count) return;

    count.textContent = `${state.results.length} takim`;

    if (!state.results.length) {
        results.hidden = false;
        results.innerHTML = `
            <div class="football-teams-empty">
                Arama yaparak takim logosu bulabilir veya hazir onerilerden birine tiklayabilirsin.
            </div>
        `;
        return;
    }

    results.hidden = false;
    results.innerHTML = `
        <div class="football-teams-grid">
            ${state.results.map(team => `
                <article class="football-teams-card">
                    <div class="football-teams-logo-wrap">
                        <img class="football-teams-logo" src="${footballTeamsEscapeHtml(footballTeamsBuildProxyLogoUrl(team, app))}" alt="${footballTeamsEscapeHtml(team.name)} logosu" loading="lazy">
                    </div>
                    <div class="football-teams-meta">
                        <div class="football-teams-title">${footballTeamsEscapeHtml(team.name || 'Isimsiz takim')}</div>
                        <div class="football-teams-subtitle">${footballTeamsEscapeHtml(team.league || 'Lig bilgisi yok')}</div>
                        <div class="football-teams-detail">${footballTeamsEscapeHtml([team.country, team.formedYear ? `Kurulus: ${team.formedYear}` : ''].filter(Boolean).join(' | ') || 'Ulke bilgisi yok')}</div>
                        ${team.stadium ? `<div class="football-teams-detail">${footballTeamsEscapeHtml(team.stadium)}</div>` : ''}
                    </div>
                    <div class="football-teams-card-actions">
                        <button class="plugin-primary-btn" type="button" data-football-team-insert="${footballTeamsEscapeHtml(String(team.id || team.name || ''))}">
                            <i class="fa-solid fa-shield"></i> Logoyu Ekle
                        </button>
                        <button class="football-teams-secondary-btn" type="button" data-football-team-poster="${footballTeamsEscapeHtml(String(team.id || team.name || ''))}">
                            <i class="fa-solid fa-panorama"></i> Poster Yap
                        </button>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function footballTeamsAttachResultHandlers(root, state, app) {
    const status = root.querySelector('#footballTeamsStatus');
    if (!status) return;

    root.querySelectorAll('[data-football-team-insert]').forEach(button => {
        button.addEventListener('click', async () => {
            const key = button.dataset.footballTeamInsert;
            const team = state.results.find(item => String(item.id || item.name || '') === key);
            if (!team) return;

            status.hidden = false;
            status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logo canvas\'a ekleniyor...';
            button.disabled = true;

            try {
                await footballTeamsInsertLogo(team, app);
                status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${footballTeamsEscapeHtml(team.name)} logosu eklendi.`;
                app.closeModal();
            } catch (error) {
                status.textContent = 'Ekleme hatasi: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
    });

    root.querySelectorAll('[data-football-team-poster]').forEach(button => {
        button.addEventListener('click', async () => {
            const key = button.dataset.footballTeamPoster;
            const team = state.results.find(item => String(item.id || item.name || '') === key);
            if (!team) return;

            status.hidden = false;
            status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Takim poster sahneye kuruluyor...';
            button.disabled = true;

            try {
                await footballTeamsApplyPoster(team, app);
                status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${footballTeamsEscapeHtml(team.name)} posteri olusturuldu.`;
                app.closeModal();
            } catch (error) {
                status.textContent = 'Poster olusturulamadi: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
    });
}

function footballTeamsRender(root, state, app) {
    footballTeamsRenderResults(root, state, app);
    footballTeamsAttachResultHandlers(root, state, app);
}

registerStudioPlugin({
    id: 'football-teams',
    name: 'Futbol Takımları',
    menuLabel: 'Futbol Takımları',
    icon: 'fa-solid fa-futbol',
    init(app) {
        ensureFootballTeamsStyles(app);
    },
    openModal(app) {
        return {
            title: 'Futbol Takımları',
            subtitle: 'Takım ara, logosunu ekle veya tek tıkla poster kompozisyonu oluştur.',
            html: `
                <div class="plugin-form football-teams-plugin">
                    <div class="field">
                        <label for="footballTeamsQuery">Takim adi</label>
                        <div class="football-teams-search">
                            <input id="footballTeamsQuery" class="football-teams-input" type="text" placeholder="Orn: Galatasaray, Barcelona, Arsenal">
                            <button id="footballTeamsRun" class="plugin-primary-btn" type="button">
                                <i class="fa-solid fa-magnifying-glass"></i> Takım Ara
                            </button>
                        </div>
                    </div>

                    <div class="football-teams-suggestions">
                        ${FOOTBALL_TEAMS_SUGGESTIONS.map(item => `
                            <button class="football-teams-chip" type="button" data-football-team-suggestion="${footballTeamsEscapeHtml(item)}">${footballTeamsEscapeHtml(item)}</button>
                        `).join('')}
                    </div>

                    <div id="footballTeamsCount" class="plugin-status">0 takim</div>
                    <div id="footballTeamsStatus" class="plugin-status" hidden></div>
                    <div id="footballTeamsResults" class="football-teams-results"></div>
                </div>
            `,
            onOpen({ root }) {
                ensureFootballTeamsStyles(app);

                const state = {
                    results: []
                };

                const queryInput = root.querySelector('#footballTeamsQuery');
                const runButton = root.querySelector('#footballTeamsRun');
                const status = root.querySelector('#footballTeamsStatus');

                const runSearch = async (forcedQuery) => {
                    const query = String(forcedQuery || queryInput?.value || '').trim();
                    if (!status || !queryInput || !runButton) return;

                    queryInput.value = query;

                    if (query.length < 2) {
                        status.hidden = false;
                        status.textContent = 'En az 2 karakter yaz.';
                        state.results = [];
                        footballTeamsRender(root, state, app);
                        return;
                    }

                    status.hidden = false;
                    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Takimlar araniyor...';
                    runButton.disabled = true;

                    try {
                        const data = await footballTeamsFetchJson(`${app.getBackendUrl('teams.php')}?search=${encodeURIComponent(query)}`);
                        state.results = Array.isArray(data?.teams) ? data.teams : [];

                        if (!state.results.length) {
                            status.textContent = 'Sonuc bulunamadi.';
                        } else {
                            status.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981"></i> ${state.results.length} takim bulundu.`;
                        }

                        footballTeamsRender(root, state, app);
                    } catch (error) {
                        state.results = [];
                        footballTeamsRender(root, state, app);
                        status.textContent = 'Arama hatasi: ' + error.message;
                    } finally {
                        runButton.disabled = false;
                    }
                };

                requestAnimationFrame(() => {
                    queryInput?.focus();
                    queryInput?.select?.();
                });

                footballTeamsRender(root, state, app);

                queryInput?.addEventListener('keydown', event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        runSearch();
                    }
                });

                runButton?.addEventListener('click', () => {
                    runSearch();
                });

                root.querySelectorAll('[data-football-team-suggestion]').forEach(button => {
                    button.addEventListener('click', () => {
                        runSearch(button.dataset.footballTeamSuggestion || '');
                    });
                });
            }
        };
    }
});
