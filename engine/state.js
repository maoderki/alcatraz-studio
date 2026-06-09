function studioEngineHydrateProject(data, options = {}) {
    const project = data && typeof data === 'object' ? data : {};

    if (typeof project.projectName === 'string' && project.projectName.trim()) {
        projectName = project.projectName.trim();
    }

    templateFunctions = typeof studioEngineNormalizeTemplateFunctions === 'function'
        ? studioEngineNormalizeTemplateFunctions(project.templateFunctions)
        : [];

    const width = project.canvas?.width || project.canvasWidth;
    const height = project.canvas?.height || project.canvasHeight;
    if (width && height) {
        setCanvasSize(width, height);
    }

    if (Array.isArray(project.layers)) {
        layers = studioEngineClone(project.layers);
        normalizeZ();
    } else {
        layers = [];
    }

    const restoredSelection = Array.isArray(project.selection?.selectedIds)
        ? project.selection.selectedIds
        : (Array.isArray(project.selectedIds)
            ? project.selectedIds
            : (typeof (project.selection?.selectedId || project.selectedId) === 'string'
                ? [project.selection?.selectedId || project.selectedId]
                : [layers.at(-1)?.id].filter(Boolean)));
    studioEngineSetSelection(restoredSelection);

    window.StudioEngineSession.bumpRevision();
    render();
    updateDocumentTitle();

    if (!options.skipHistory && typeof commitHistory === 'function') {
        commitHistory();
    }

    return {
        ok: true,
        revision: window.StudioEngineSession.getRevision(),
        context: window.StudioEngineSession.getContext({ level: options.contextLevel || 'index' })
    };
}

function studioEngineCreateNewProject(payload = {}, options = {}) {
    const width = Math.max(100, Math.round(Number(payload.width) || 1080));
    const height = Math.max(100, Math.round(Number(payload.height) || 1080));
    const nextProjectName = typeof payload.projectName === 'string' && payload.projectName.trim()
        ? payload.projectName.trim()
        : 'Adsız Proje';

    projectName = nextProjectName;
    templateFunctions = [];
    setCanvasSize(width, height);
    layers = [createCanvasRasterLayer()];
    studioEngineSetSelection(layers[0]?.id ? [layers[0].id] : []);

    window.StudioEngineSession.bumpRevision();
    render();
    updateDocumentTitle();

    if (!options.skipHistory && typeof commitHistory === 'function') {
        commitHistory();
    }

    return {
        ok: true,
        revision: window.StudioEngineSession.getRevision(),
        context: window.StudioEngineSession.getContext({ level: options.contextLevel || 'index' })
    };
}

window.StudioEngineState = {
    hydrateProject: studioEngineHydrateProject,
    createNewProject: studioEngineCreateNewProject
};
