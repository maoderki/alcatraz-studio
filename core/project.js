function initializeProjectState() {
    const autosavedProject = readProjectAutosave();

    initColorWidget();
    setCanvasSize(canvasWidth, canvasHeight);
    createBrushCursor();

    if (autosavedProject && typeof autosavedProject === 'object') {
        window.StudioEngine?.loadProject?.(autosavedProject, { skipHistory: true });
        fitStageToView();
    } else {
        window.StudioEngine?.createNewProject?.({
            width: canvasWidth,
            height: canvasHeight,
            projectName
        }, { skipHistory: true });
        fitStageToView();
    }

    commitHistory();
}

// ── Project state ─────────────────────────────────────────────────────────
function getProjectData() {
    return window.StudioEngine?.exportProject?.() || {
        projectName,
        canvas: {
            width: canvasWidth,
            height: canvasHeight
        },
        selection: {
            selectedId,
            selectedIds
        },
        layers
    };
}

function setProjectData(data, options = {}) {
    window.StudioEngine?.loadProject?.(data, options);
}

function toggleFileMenu(menuName) {
    const menu = document.querySelector(`.file-menu[data-menu="${menuName}"]`);
    if (!menu) return;

    const dropdown = menu.querySelector('.file-dropdown');
    const btn = menu.querySelector('.file-menu-btn');
    const willOpen = !dropdown?.classList.contains('open');

    closeFileMenu();

    if (!willOpen) return;

    dropdown?.classList.add('open');
    btn?.classList.add('open');
}

function closeFileMenu() {
    document.querySelectorAll('.file-menu').forEach(menu => {
        menu.querySelector('.file-dropdown')?.classList.remove('open');
        menu.querySelector('.file-menu-btn')?.classList.remove('open');
    });
}

document.addEventListener('click', e => {
    if (!e.target.closest('.file-menu')) closeFileMenu();
});

function openNewProjectModal() {
    if (newProjectWidthInput) newProjectWidthInput.value = canvasWidth;
    if (newProjectHeightInput) newProjectHeightInput.value = canvasHeight;
    syncNewProjectPresetState();
    newProjectModal?.removeAttribute('hidden');
    closeFileMenu();
}

function closeNewProjectModal() {
    newProjectModal?.setAttribute('hidden', '');
}

let templatesManifestCache = null;

function escapeTemplateHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadTemplatesManifest() {
    if (Array.isArray(templatesManifestCache)) {
        return templatesManifestCache;
    }

    const response = await fetch(studioAssetUrl('templates/index.json'), { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Şablon listesi okunamadı.');
    }

    const payload = await response.json();
    const templates = Array.isArray(payload?.templates) ? payload.templates : [];
    templatesManifestCache = templates;
    return templates;
}

function renderTemplatesModalState(markup) {
    if (!templatesModalBody) return;
    templatesModalBody.innerHTML = markup;
}

function renderTemplatesModalLoading() {
    renderTemplatesModalState(`
        <div class="templates-empty-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <div>Şablonlar yükleniyor...</div>
        </div>
    `);
}

function renderTemplatesModalError(message) {
    renderTemplatesModalState(`
        <div class="templates-empty-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div>${escapeTemplateHtml(message || 'Şablonlar yüklenemedi.')}</div>
        </div>
    `);
}

function renderTemplatesModalList(templates) {
    if (!templatesModalBody) return;
    if (!templates.length) {
        renderTemplatesModalState(`
            <div class="templates-empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <div>templates klasorunde henuz sablon yok.</div>
            </div>
        `);
        return;
    }

    templatesModalBody.innerHTML = `
        <div class="templates-grid">
            ${templates.map(template => {
                const thumb = typeof template.thumbnail === 'string' && template.thumbnail.trim()
                    ? studioAssetUrl(template.thumbnail)
                    : '';
                return `
                    <button class="template-card" type="button" onclick="applyTemplateById('${escapeTemplateHtml(template.id)}')">
                        <div class="template-card-thumb"${thumb ? ` style="background-image:url('${escapeTemplateHtml(thumb)}')"` : ''}>
                            ${thumb ? '' : '<span>Önizleme yok</span>'}
                        </div>
                        <div class="template-card-body">
                            <div class="template-card-title">${escapeTemplateHtml(template.name || 'İsimsiz Şablon')}</div>
                            <div class="template-card-meta">
                                ${escapeTemplateHtml(template.size || '')}
                            </div>
                            <div class="template-card-desc">${escapeTemplateHtml(template.description || '')}</div>
                        </div>
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

async function openTemplatesModal() {
    if (!templatesModal) return;
    templatesModal.removeAttribute('hidden');
    closeFileMenu();
    renderTemplatesModalLoading();

    try {
        const templates = await loadTemplatesManifest();
        renderTemplatesModalList(templates);
    } catch (error) {
        renderTemplatesModalError(error instanceof Error ? error.message : 'Şablonlar yüklenemedi.');
    }
}

function closeTemplatesModal() {
    templatesModal?.setAttribute('hidden', '');
}

async function applyTemplateById(templateId) {
    const templates = await loadTemplatesManifest();
    const template = templates.find(item => item?.id === templateId);
    if (!template?.project) {
        alert('Şablon dosyası bulunamadı.');
        return;
    }

    if (layers.length && !confirm('Mevcut çalışma kaybolacak. Seçilen şablon yüklensin mi?')) {
        return;
    }

    const response = await fetch(studioAssetUrl(template.project), { cache: 'no-store' });
    if (!response.ok) {
        alert('Şablon dosyası okunamadı.');
        return;
    }

    const project = await response.json();
    clearProjectAutosave();
    setProjectData(project);
    fitStageToView();
    closeTemplatesModal();
}

function syncNewProjectPresetState() {
    const width = Number(newProjectWidthInput?.value);
    const height = Number(newProjectHeightInput?.value);
    document.querySelectorAll('[data-canvas-size-preset]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.canvasSizePreset === `${width}x${height}`);
    });
}

function createNewProjectWithSize(width, height) {
    const w = Math.max(100, Math.round(Number(width)));
    const h = Math.max(100, Math.round(Number(height)));
    if (!w || !h) return;
    if (layers.length && !confirm('Mevcut çalışma kaybolacak. Devam?')) return;
    clearProjectAutosave();
    window.StudioEngine?.createNewProject?.({
        width: w,
        height: h,
        projectName: 'Adsız Proje'
    }, {
        skipHistory: false
    });
    window.dispatchEvent(new CustomEvent('studio:project-new'));
    fitStageToView();
    closeNewProjectModal();
}

function newProject() {
    openNewProjectModal();
}

function exportProject() {
    const blob = new Blob([JSON.stringify(getProjectData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.download = 'tasarim_' + Date.now() + '.json';
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    closeFileMenu();
}

function openProject() {
    document.getElementById('projectInput').click();
    closeFileMenu();
}

document.getElementById('projectInput')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try { setProjectData(JSON.parse(ev.target.result)); }
        catch { alert('Geçersiz JSON dosyası.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
});

window.addEventListener('beforeunload', () => {
    persistProjectAutosave();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistProjectAutosave();
});

document.addEventListener('keydown', e => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyN') {
        e.preventDefault();
        newProject();
        return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyO') {
        e.preventDefault();
        openProject();
        return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyD') {
        e.preventDefault();
        clearRasterSelection();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        exportPNG();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportProject(); }
});

window.openTemplatesModal = openTemplatesModal;
window.closeTemplatesModal = closeTemplatesModal;
window.applyTemplateById = applyTemplateById;
