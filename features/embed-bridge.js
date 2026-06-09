(function () {
    const params = new URLSearchParams(window.location.search);
    const isEmbeddedStudio = params.get('embed') === '1';

    function postToHost(type, payload = {}, requestId = null, ok = true, error = '') {
        if (window.parent === window) return;
        window.parent.postMessage({
            source: 'studio-embed',
            type,
            payload,
            requestId,
            ok,
            error
        }, '*');
    }

    function waitFor(check, timeout = 20000, interval = 120) {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();

            const tick = () => {
                try {
                    const value = check();
                    if (value) {
                        resolve(value);
                        return;
                    }
                } catch (error) {
                    reject(error);
                    return;
                }

                if (Date.now() - startedAt >= timeout) {
                    reject(new Error('Studio embed baglantisi hazir degil.'));
                    return;
                }

                window.setTimeout(tick, interval);
            };

            tick();
        });
    }

    async function ensureEmbedCoreApis() {
        await waitFor(() => window.StudioEngine?.exportProject && window.StudioEngine?.applyCommands);
        return true;
    }

    async function ensureEmbedActAiApi() {
        await ensureEmbedCoreApis();
        await waitFor(() => window.StudioActAi?.applyAgentResponse, 30000);
        return true;
    }

    async function ensureEmbedXApi() {
        await ensureEmbedCoreApis();
        await waitFor(() => window.StudioXApi?.applyPostData, 30000);
        return true;
    }

    async function capturePreviewDataUrl() {
        if (typeof domtoimage?.toPng !== 'function' || !stage) {
            throw new Error('Studio preview olusturulamadi.');
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            position: fixed;
            left: -99999px;
            top: 0;
            width: ${canvasWidth}px;
            height: ${canvasHeight}px;
            overflow: hidden;
            background: transparent;
            pointer-events: none;
            z-index: -1;
        `;

        const clone = stage.cloneNode(true);
        clone.classList.add('exporting');
        clone.classList.remove('empty');
        clone.style.width = `${canvasWidth}px`;
        clone.style.height = `${canvasHeight}px`;
        clone.style.transform = 'none';
        clone.style.transformOrigin = 'center center';
        clone.querySelectorAll('.selected, .text-frame-visible').forEach(node => {
            node.classList.remove('selected');
            node.classList.remove('text-frame-visible');
        });

        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            return await domtoimage.toPng(clone, {
                width: canvasWidth,
                height: canvasHeight,
                bgcolor: null,
                style: {
                    transform: 'none',
                    transformOrigin: 'center center'
                }
            });
        } finally {
            wrapper.remove();
        }
    }

    async function handleApplyXPost(payload = {}) {
        await ensureEmbedXApi();
        const result = await window.StudioXApi.applyPostData(payload.data || {}, payload.options || {});
        if (typeof fitStageToView === 'function') fitStageToView();
        let previewDataUrl = '';
        try {
            previewDataUrl = await capturePreviewDataUrl();
        } catch (_) {
            previewDataUrl = '';
        }
        return {
            message: result?.message || 'X verisi Studio yuzeyine uygulandi.',
            project: window.StudioEngine?.exportProject?.(),
            previewDataUrl
        };
    }

    async function handleApplyAgentResponse(payload = {}) {
        await ensureEmbedActAiApi();
        const result = await window.StudioActAi.applyAgentResponse(payload.data || {}, { prompt: payload.prompt || '' });
        if (typeof fitStageToView === 'function') fitStageToView();
        let previewDataUrl = '';
        try {
            previewDataUrl = await capturePreviewDataUrl();
        } catch (_) {
            previewDataUrl = '';
        }
        return {
            message: result?.assistantMessage || result?.message || 'Designer komutu Studio yuzeyine uygulandi.',
            project: window.StudioEngine?.exportProject?.(),
            previewDataUrl
        };
    }

    async function handleMessage(event) {
        const data = event?.data;
        if (!data || data.source !== 'act-ai-host') return;

        try {
            await ensureEmbedCoreApis();

            let payload = {};
            if (data.type === 'act-ai:studio:apply-x-post') {
                payload = await handleApplyXPost(data.payload);
            } else if (data.type === 'act-ai:studio:apply-agent-response') {
                payload = await handleApplyAgentResponse(data.payload);
            } else {
                throw new Error('Bilinmeyen Studio embed komutu.');
            }

            postToHost('result', payload, data.requestId, true);
        } catch (error) {
            postToHost('result', {}, data.requestId, false, error instanceof Error ? error.message : 'Studio embed komutu basarisiz oldu.');
        }
    }

    async function announceReady() {
        if (!isEmbeddedStudio) return;

        document.documentElement.dataset.embed = 'true';

        let previewDataUrl = '';
        try {
            await ensureEmbedCoreApis();
            if (typeof fitStageToView === 'function') fitStageToView();
            try {
                previewDataUrl = await capturePreviewDataUrl();
            } catch (_) {
                previewDataUrl = '';
            }
        } catch (_) {
            previewDataUrl = '';
        }

        postToHost('ready', {
            message: 'Studio embed hazir.',
            previewDataUrl
        });
    }

    if (!isEmbeddedStudio) return;

    window.addEventListener('message', handleMessage);
    window.addEventListener('load', announceReady, { once: true });
    window.addEventListener('studio:plugins-loaded', announceReady);
}());
