const HISTORY_LIMIT = 100;

function createHistoryManager(deps) {
    const limit = deps.limit ?? HISTORY_LIMIT;
    let historyStack = [];
    let historyIndex = -1;
    let historyDebounceTimer = null;
    let isRestoring = false;

    function cloneState() {
        if (window.StudioEngine?.exportProject) {
            return JSON.parse(JSON.stringify(window.StudioEngine.exportProject()));
        }

        return JSON.parse(JSON.stringify({
            projectName: deps.getProjectName(),
            canvas: {
                width: deps.getCanvasWidth(),
                height: deps.getCanvasHeight()
            },
            layers: deps.getLayers(),
            selection: {
                selectedId: deps.getSelectedId(),
                selectedIds: deps.getSelectedIds?.() || []
            }
        }));
    }

    function commit() {
        if (isRestoring) return;

        clearTimeout(historyDebounceTimer);
        historyDebounceTimer = null;

        const state = cloneState();
        const signature = JSON.stringify(state);
        const currentEntry = historyStack[historyIndex];
        if (currentEntry && currentEntry.signature === signature) return;

        if (historyIndex < historyStack.length - 1) {
            historyStack = historyStack.slice(0, historyIndex + 1);
        }

        historyStack.push({ state, signature });
        if (historyStack.length > limit) {
            historyStack.shift();
        }
        historyIndex = historyStack.length - 1;
    }

    function scheduleCommit(delay = 300) {
        if (isRestoring) return;
        clearTimeout(historyDebounceTimer);
        historyDebounceTimer = setTimeout(() => {
            commit();
        }, delay);
    }

    function restore(index) {
        if (index < 0 || index >= historyStack.length) return;

        clearTimeout(historyDebounceTimer);
        historyDebounceTimer = null;
        isRestoring = true;

        const snapshot = JSON.parse(JSON.stringify(historyStack[index].state));
        historyIndex = index;

        if (window.StudioEngine?.loadProject) {
            window.StudioEngine.loadProject(snapshot, { skipHistory: true });
        } else {
            deps.setProjectName(snapshot.projectName || 'Adsız Proje');
            deps.setCanvasSize(snapshot.canvas?.width || snapshot.canvasWidth || 1080, snapshot.canvas?.height || snapshot.canvasHeight || 1080);
            deps.setLayers(Array.isArray(snapshot.layers) ? snapshot.layers : []);
            const selectedIds = snapshot.selection?.selectedIds || snapshot.selectedIds;
            const selectedId = snapshot.selection?.selectedId || snapshot.selectedId;
            if (Array.isArray(selectedIds) && selectedIds.length) {
                deps.setSelectedIds?.(selectedIds);
            } else {
                deps.setSelectedId(selectedId || null);
            }

            deps.render();
            deps.updateDocumentTitle();
        }
        isRestoring = false;
    }

    function undo() {
        commit();
        if (historyIndex <= 0) return;
        restore(historyIndex - 1);
    }

    function redo() {
        commit();
        if (historyIndex >= historyStack.length - 1) return;
        restore(historyIndex + 1);
    }

    return {
        commit,
        scheduleCommit,
        restore,
        undo,
        redo
    };
}

window.createHistoryManager = createHistoryManager;
