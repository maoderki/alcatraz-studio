const historyManager = window.createHistoryManager({
    limit: HISTORY_LIMIT,
    getProjectName: () => projectName,
    setProjectName: value => {
        projectName = value;
    },
    getCanvasWidth: () => canvasWidth,
    getCanvasHeight: () => canvasHeight,
    getLayers: () => layers,
    setLayers: value => {
        layers = value;
    },
    getSelectedId: () => selectedId,
    getSelectedIds: () => selectedIds,
    setSelectedId: value => {
        studioEngineSetSelection(value ? [value] : []);
    },
    setSelectedIds: value => {
        studioEngineSetSelection(value || []);
    },
    setCanvasSize: (width, height) => setCanvasSize(width, height),
    render: () => render(),
    updateDocumentTitle: () => updateDocumentTitle()
});

const STUDIO_AUTOSAVE_KEY = 'alcatraz_studio_autosave';
let autosaveDebounceTimer = null;

function persistProjectAutosave() {
    try {
        localStorage.setItem(STUDIO_AUTOSAVE_KEY, JSON.stringify(getProjectData()));
    } catch (error) {
        console.warn('Autosave warning:', error);
    }
}

function clearProjectAutosave() {
    try {
        localStorage.removeItem(STUDIO_AUTOSAVE_KEY);
    } catch (error) {
        console.warn('Autosave clear warning:', error);
    }
}

function readProjectAutosave() {
    try {
        const raw = localStorage.getItem(STUDIO_AUTOSAVE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('Autosave read warning:', error);
        return null;
    }
}

const commitHistory = (...args) => {
    const result = historyManager.commit(...args);
    persistProjectAutosave();
    return result;
};

const scheduleHistoryCommit = (...args) => {
    clearTimeout(autosaveDebounceTimer);
    const delay = typeof args[0] === 'number' ? args[0] : 300;
    autosaveDebounceTimer = setTimeout(() => {
        persistProjectAutosave();
    }, delay);
    return historyManager.scheduleCommit(...args);
};
const restoreHistory = historyManager.restore;
const undoHistory = historyManager.undo;
const redoHistory = historyManager.redo;
