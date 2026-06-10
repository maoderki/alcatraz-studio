const ACT_AI_STYLE_ID = 'studio-plugin-act-ai-style';
const ACT_AI_APP_ID = 'studio';
const ACT_AI_API_URL = window.STUDIO_ACT_AI_API_URL || new URL('https://map.alcatrazgroup.com/act-ai/chat.php', window.location.href).toString();
const ACT_AI_CHAT_STORAGE_KEY = 'alcatraz_studio_act_ai_chat';
const ACT_AI_SESSION_STORAGE_KEY = 'alcatraz_studio_act_ai_session';
const ACT_AI_WELCOME_MESSAGE = 'Merhaba. Studio’da ne yapalım?';
const ACT_AI_MAX_STORED_MESSAGES = 80;
const ACT_AI_MAX_SESSION_HISTORY = 24;
const ACT_AI_MAX_RECENT_ACTIONS = 30;
const ACT_AI_HELPER_MODAL_ID = 'actAiHelperModal';
let actAiPendingClarification = null;
let actAiProjectResetBound = false;

const ACT_AI_STUDIO_ACTIONS = [
    { id: 'add_text', title: 'Metin ekle' },
    { id: 'set_background', title: 'Arka plan ayarla' },
    { id: 'add_shape', title: 'Şekil ekle' },
    { id: 'add_raster_layer', title: 'Raster katman ekle' },
    { id: 'update_selected', title: 'Seçili katmanı güncelle' },
    { id: 'remove_layer', title: 'Katman sil' },
    { id: 'remove_all_layers', title: 'Tüm katmanları sil' },
    { id: 'duplicate_layer', title: 'Katmanı çoğalt' },
    { id: 'export_design_png', title: 'Kaydet / dışa aktar' },
    { id: 'save_project_json', title: 'Proje dosyasını kaydet' },
    { id: 'move_layer', title: 'Katmanı taşı' },
    { id: 'reorder_layer', title: 'Katmanı öne/arkaya taşı' },
    { id: 'add_image', title: 'Resim ekle' },
    { id: 'resize_image_width', title: 'Resim genişliğini ayarla' },
    { id: 'resize_image_dimensions', title: 'Resim boyutunu ayarla' },
    { id: 'cover_image_to_canvas', title: 'Resmi canvasa cover boyutlandır' },
    { id: 'lock_image_aspect', title: 'Resim oranını kilitle' },
    { id: 'align_image_to_canvas', title: 'Resmi hizala' }
];

function ensureActAiStyles(app) {
    if (document.getElementById(ACT_AI_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = ACT_AI_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function actAiEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function actAiBuildHelperGroups() {
    const commandNames = {
        add_layer: 'Katman ekle',
        update_layer: 'Katman güncelle',
        remove_layer: 'Katman sil',
        remove_layers: 'Katmanları sil',
        duplicate_layer: 'Katman çoğalt',
        move_layer: 'Katman taşı',
        reorder_layer: 'Katmanı öne/arkaya taşı',
        set_background: 'Arka plan ayarla',
        export_png: 'Kaydet / dışa aktar',
        export_project: 'Proje dosyasını kaydet'
    };
    const commandMap = {
        add_text: 'add_layer',
        add_shape: 'add_layer',
        add_raster_layer: 'add_layer',
        add_image: 'add_layer',
        set_background: 'set_background',
        update_selected: 'update_layer',
        resize_image_width: 'update_layer',
        resize_image_dimensions: 'update_layer',
        cover_image_to_canvas: 'update_layer',
        lock_image_aspect: 'update_layer',
        align_image_to_canvas: 'update_layer',
        remove_layer: 'remove_layer',
        remove_all_layers: 'remove_layers',
        duplicate_layer: 'duplicate_layer',
        export_design_png: 'export_png',
        save_project_json: 'export_project',
        move_layer: 'move_layer',
        reorder_layer: 'reorder_layer'
    };
    const groups = new Map();

    ACT_AI_STUDIO_ACTIONS.forEach(action => {
        const commandId = commandMap[action.id] || action.id;
        if (!groups.has(commandId)) {
            groups.set(commandId, {
                id: commandId,
                title: commandNames[commandId] || commandId,
                actionTitles: [],
                actions: [],
                aliases: []
            });
        }

        const group = groups.get(commandId);
        const actionAliases = [action.id];
        group.actionTitles.push(action.title || action.id);
        group.actions.push({
            id: action.id,
            title: action.title || action.id,
            aliases: actionAliases
        });
        group.aliases.push(...actionAliases);
    });

    return [...groups.values()].map(group => ({
        ...group,
        actionTitles: [...new Set(group.actionTitles.map(item => String(item || '').trim()).filter(Boolean))],
        actions: group.actions.filter(action => action.aliases.length),
        aliases: [...new Set(group.aliases.map(item => String(item || '').trim()).filter(Boolean))]
    }));
}

function actAiEnsureHelperModal() {
    let modal = document.getElementById(ACT_AI_HELPER_MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = ACT_AI_HELPER_MODAL_ID;
    modal.className = 'app-modal-backdrop act-ai-helper-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
        <div class="app-modal act-ai-helper-modal" role="dialog" aria-modal="true" aria-labelledby="actAiHelperTitle">
            <div class="app-modal-header">
                <div>
                    <div class="app-modal-title" id="actAiHelperTitle">Act AI Komutları</div>
                    <div class="app-modal-subtitle">Agent'tan gelen action id'leri</div>
                </div>
                <button class="app-modal-close" type="button" data-act-ai-helper-close aria-label="Kapat">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="app-modal-body">
                <div class="act-ai-helper-list">
                    ${actAiBuildHelperGroups().map(group => `
                        <details class="act-ai-helper-item">
                            <summary>
                                <span>
                                    <strong>${actAiEscapeHtml(group.id)}</strong>
                                    <small>${actAiEscapeHtml(group.title)}</small>
                                </span>
                                <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                            </summary>
                            <p>${actAiEscapeHtml(group.actionTitles.join(', '))}</p>
                            <div class="act-ai-helper-actions">
                                ${group.actions.map(action => `
                                    <section>
                                        <h4>${actAiEscapeHtml(action.title)}</h4>
                                        <div class="act-ai-helper-words">
                                            ${action.aliases.map(word => `<span>${actAiEscapeHtml(word)}</span>`).join('')}
                                        </div>
                                    </section>
                                `).join('')}
                            </div>
                        </details>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('[data-act-ai-helper-close]')) {
            actAiCloseHelperModal();
        }
    });
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') actAiCloseHelperModal();
    });

    document.body.appendChild(modal);
    return modal;
}

function actAiOpenHelperModal() {
    const modal = actAiEnsureHelperModal();
    modal.hidden = false;
    modal.querySelector('[data-act-ai-helper-close]')?.focus();
}

function actAiCloseHelperModal() {
    const modal = document.getElementById(ACT_AI_HELPER_MODAL_ID);
    if (!modal) return;
    modal.hidden = true;
}

function actAiReadStoredChat() {
    try {
        const raw = localStorage.getItem(ACT_AI_CHAT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(item => item && ['user', 'ai'].includes(item.role) && typeof item.message === 'string')
            .map(item => ({
                role: item.role,
                message: item.message,
                meta: typeof item.meta === 'string' ? item.meta : ''
            }));
    } catch (error) {
        console.warn('Act AI sohbet geçmişi okunamadı:', error);
        return [];
    }
}

function actAiWriteStoredChat(entries) {
    try {
        localStorage.setItem(ACT_AI_CHAT_STORAGE_KEY, JSON.stringify(entries.slice(-ACT_AI_MAX_STORED_MESSAGES)));
    } catch (error) {
        console.warn('Act AI sohbet geçmişi kaydedilemedi:', error);
    }
}

function actAiStoreChatMessage(role, message, meta = '') {
    const entries = actAiReadStoredChat();
    entries.push({
        role: role === 'user' ? 'user' : 'ai',
        message: String(message || ''),
        meta: String(meta || '')
    });
    actAiWriteStoredChat(entries);
}

function actAiCreateSession() {
    return {
        id: `studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        history: [],
        pending: null,
        memory: {
            facts: [],
            recentActions: []
        }
    };
}

function actAiReadSession() {
    try {
        const raw = localStorage.getItem(ACT_AI_SESSION_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const session = parsed && typeof parsed === 'object' ? parsed : actAiCreateSession();
        if (!session.id) session.id = actAiCreateSession().id;
        if (!Array.isArray(session.history)) session.history = [];
        if (!session.memory || typeof session.memory !== 'object') session.memory = {};
        if (!Array.isArray(session.memory.facts)) session.memory.facts = [];
        if (!Array.isArray(session.memory.recentActions)) session.memory.recentActions = [];
        if (!('pending' in session)) session.pending = null;
        return session;
    } catch (error) {
        console.warn('Act AI session okunamadı:', error);
        return actAiCreateSession();
    }
}

function actAiWriteSession(session) {
    try {
        const next = {
            ...session,
            history: Array.isArray(session.history) ? session.history.slice(-ACT_AI_MAX_SESSION_HISTORY) : [],
            memory: {
                ...(session.memory || {}),
                facts: Array.isArray(session.memory?.facts) ? session.memory.facts.slice(-40) : [],
                recentActions: Array.isArray(session.memory?.recentActions)
                    ? session.memory.recentActions.slice(-ACT_AI_MAX_RECENT_ACTIONS)
                    : []
            }
        };
        localStorage.setItem(ACT_AI_SESSION_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
        console.warn('Act AI session kaydedilemedi:', error);
    }
}

function actAiClearSession() {
    try {
        localStorage.removeItem(ACT_AI_SESSION_STORAGE_KEY);
    } catch (error) {
        console.warn('Act AI session temizlenemedi:', error);
    }
}

function actAiMergeMemory(memory = {}, patch = {}) {
    const next = { ...memory };
    Object.entries(patch || {}).forEach(([key, value]) => {
        if (key === 'facts' && Array.isArray(value)) {
            next.facts = [...(Array.isArray(next.facts) ? next.facts : []), ...value].slice(-40);
            return;
        }
        if (key === 'recentActions' && Array.isArray(value)) {
            next.recentActions = [...(Array.isArray(next.recentActions) ? next.recentActions : []), ...value].slice(-ACT_AI_MAX_RECENT_ACTIONS);
            return;
        }
        next[key] = value;
    });
    return next;
}

function actAiMemoryPatchFromCommands(data, commandPayload) {
    const action = data?.action || {};
    const actionId = action.id || action.name || '';
    const commands = Array.isArray(commandPayload?.commands) ? commandPayload.commands : [];
    const patch = {};

    const addedLayer = commands.find(command => command?.action === 'add_layer' && command.layer?.id)?.layer || null;
    if (addedLayer) {
        patch.lastAddedLayerId = addedLayer.id;
        patch.lastTouchedLayerId = addedLayer.id;
        if (addedLayer.type === 'raster') patch.lastAddedImageId = addedLayer.id;
        if (addedLayer.type === 'text') patch.lastAddedTextId = addedLayer.id;
        if (addedLayer.type === 'shape') patch.lastAddedShapeId = addedLayer.id;
    }

    const touchedCommand = commands.find(command => command?.target || command?.targets?.length) || null;
    if (touchedCommand?.target && typeof touchedCommand.target === 'string') {
        patch.lastTouchedLayerId = touchedCommand.target;
    }

    const applied = Array.isArray(commandPayload?.engineResult?.applied) ? commandPayload.engineResult.applied : [];
    const appliedTarget = [...applied].reverse().find(item => typeof item?.targetId === 'string')?.targetId || '';
    if (appliedTarget) patch.lastTouchedLayerId = appliedTarget;

    if (actionId) {
        patch.lastActionId = actionId;
        patch.recentActions = [{
            actionId,
            params: action.params || {},
            result: addedLayer ? { layerId: addedLayer.id, type: addedLayer.type || '' } : {},
            at: Date.now()
        }];
    }

    return patch;
}

function actAiCommitSessionTurn(userMessage, data, commandPayload = {}) {
    const session = actAiReadSession();
    const assistantMessage = actAiReadAssistantReply(data) || commandPayload.assistantMessage || commandPayload.message || '';
    session.history.push({ role: 'user', message: userMessage, at: Date.now() });
    if (assistantMessage) session.history.push({ role: 'assistant', message: assistantMessage, at: Date.now() });

    session.pending = data?.pending || data?.clarification || commandPayload.clarification || null;
    if (data?.type === 'action') session.pending = null;

    session.memory = actAiMergeMemory(session.memory, data?.memoryPatch || {});
    session.memory = actAiMergeMemory(session.memory, actAiMemoryPatchFromCommands(data, commandPayload));
    actAiWriteSession(session);
    actAiPendingClarification = session.pending;
}

function actAiClearStoredChat() {
    try {
        localStorage.removeItem(ACT_AI_CHAT_STORAGE_KEY);
    } catch (error) {
        console.warn('Act AI sohbet geçmişi temizlenemedi:', error);
    }
    actAiPendingClarification = null;
    actAiClearSession();
}

function actAiResetChatForNewProject() {
    actAiClearStoredChat();
    document.querySelectorAll('.act-ai-plugin').forEach(root => {
        const chat = root.querySelector('#actAiChat');
        const status = root.querySelector('#actAiStatus');
        if (chat) chat.innerHTML = '';
        if (status) status.hidden = true;
        actAiAddChatMessage(root, 'ai', ACT_AI_WELCOME_MESSAGE, '', { persist: false });
    });
}

function actAiBindProjectReset() {
    if (actAiProjectResetBound) return;
    actAiProjectResetBound = true;
    window.addEventListener('studio:project-new', actAiResetChatForNewProject);
}

function actAiBuildLayerIndex(app) {
    const layers = app.getLayers?.() || [];
    return layers.map(layer => ({
        id: layer.id,
        type: layer.type,
        name: layer.name || layer.id,
        text: layer.type === 'text' ? String(layer.text || '').slice(0, 120) : undefined,
        x: Math.round(Number(layer.x) || 0),
        y: Math.round(Number(layer.y) || 0),
        width: Math.round(Number(layer.width) || 0),
        height: Math.round(Number(layer.height) || 0),
        visible: layer.visible !== false,
        locked: layer.locked === true
    }));
}

function actAiNormalize(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ü', 'u');
}

function actAiStudioTargetFromAgentTarget(target, actionId) {
    const normalizedTarget = actAiNormalize(target || '');

    if (normalizedTarget === 'all_layers') return actionId === 'remove_all_layers' ? 'all' : 'all_layers';
    if (normalizedTarget === 'image') return 'last_raster';
    if (normalizedTarget === 'text') return 'last_text';
    if (normalizedTarget === 'shape') return 'last_shape';
    if (normalizedTarget === 'canvas') return 'background';
    if (normalizedTarget === 'layer') return 'selected';
    if (normalizedTarget) return target;
    return 'selected';
}

function actAiNormalizeActionParams(actionId, params = {}) {
    const next = { ...params };
    next.target = actAiStudioTargetFromAgentTarget(next.target, actionId);
    const normalizedPosition = actAiNormalize(next.position || '');
    if (['front', 'frontmost', 'top', 'topmost'].includes(normalizedPosition)) next.position = 'front';
    if (['back', 'backmost', 'bottom', 'bottommost'].includes(normalizedPosition)) next.position = 'back';
    return next;
}

function actAiUpdateLiveMeta(root, app) {
    const canvas = app.getCanvasSize?.() || { width: 0, height: 0 };
    const layers = app.getLayers?.() || [];
    const meta = root.querySelector('#actAiLiveMeta');
    if (!meta) return;
    meta.textContent = `${Math.round(canvas.width || 0)}x${Math.round(canvas.height || 0)} · ${layers.length} katman`;
}

function actAiExtractXUrl(text) {
    const value = String(text || '').trim();
    const match = value.match(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^\s]+/i);
    return match ? match[0] : '';
}

async function actAiExecuteCommand(command, app) {
    const xUrl = actAiExtractXUrl(command);
    if (xUrl && window.StudioXApi?.fetchPostData) {
        const xData = await window.StudioXApi.fetchPostData(xUrl);
        const imageOptions = Array.isArray(xData?.images) ? xData.images.filter(Boolean) : [];

        if (imageOptions.length > 1) {
            return {
                message: 'Birden fazla gorsel bulundu. Hangisini yukleyeyim?',
                assistantMessage: 'Birden fazla gorsel bulundu. Hangisini yukleyeyim?',
                commands: [],
                xApiChoice: {
                    url: xUrl,
                    data: xData,
                    images: imageOptions
                },
                analysis: {
                    type: 'x_api',
                    url: xUrl
                }
            };
        }

        const xResult = await window.StudioXApi.applyPostData?.(xData, {
            fitShortSideToCanvas: true
        });
        return {
            message: xResult?.message || 'X icerigi yüklendi.',
            assistantMessage: xResult?.message || 'X icerigi yüklendi.',
            commands: [],
            analysis: {
                type: 'x_api',
                url: xUrl
            }
        };
    }

    const data = await actAiAnalyze(command, app);
    const directResult = await actAiHandleDirectAction(data, app);
    if (directResult) {
        actAiCommitSessionTurn(command, data, directResult);
        return {
            ...directResult,
            assistantMessage: actAiReadAssistantReply(data) || directResult.message,
            analysis: data
        };
    }

    const commandPayload = actAiReadCommandPayload(data, app);
    if (!commandPayload) {
        throw new Error('Act AI geçerli engine komutu döndürmedi.');
    }

    if (Array.isArray(commandPayload.commands) && commandPayload.commands.length) {
        commandPayload.engineResult = actAiApplyStudioCommands(commandPayload.commands);
    }
    actAiCommitSessionTurn(command, data, commandPayload);
    return {
        ...commandPayload,
        analysis: data
    };
}

function actAiReadAssistantReply(data) {
    const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
    return reply || '';
}

function actAiBuildTargetedCommand(command, targetId) {
    return `${command}\nHedef katman: ${targetId}`;
}

function actAiResolveTargetCandidate(answer, candidates = []) {
    const normalized = actAiNormalize(answer);
    return candidates.find((candidate, index) => {
        const number = String(index + 1);
        const parts = [number, candidate.id, candidate.name, candidate.text, candidate.label]
            .map(actAiNormalize)
            .filter(Boolean);
        return parts.some(part => normalized === part || normalized.includes(part));
    }) || null;
}

window.StudioActAi = {
    executeCommand(command, app) {
        return actAiExecuteCommand(command, app);
    },
    getTextTargetCandidates(command, app) {
        return null;
    },
    getLayerTargetCandidates(command, app) {
        return null;
    },
    resolveTargetCandidate(answer, candidates) {
        return actAiResolveTargetCandidate(answer, candidates);
    },
    async addImage(app) {
        const result = await actAiAddImageFromPicker(app, {});
        const addedLayer = result?.commands?.find(command => command?.action === 'add_layer' && command.layer?.id)?.layer || null;
        if (addedLayer?.id) {
            app.selectLayer?.(addedLayer.id);
        }
        actAiCommitSessionTurn('Resim seç', {
            type: 'action',
            action: {
                id: 'add_image',
                params: {}
            },
            memoryPatch: {}
        }, result);
        return result;
    },
    buildTargetedCommand(command, targetId) {
        return actAiBuildTargetedCommand(command, targetId);
    },
    async applyAgentResponse(data, options = {}) {
        const app = window.createStudioPluginAppApiById?.('act-ai');
        if (!app) {
            throw new Error('Act AI Studio plugin hazir degil.');
        }

        const directResult = await actAiHandleDirectAction(data, app);
        if (directResult) {
            if (options.commitSession !== false) {
                actAiCommitSessionTurn(options.prompt || 'Dis komut', data, directResult);
            }
            return {
                ...directResult,
                assistantMessage: actAiReadAssistantReply(data) || directResult.message,
                analysis: data
            };
        }

        const commandPayload = actAiReadCommandPayload(data, app);
        if (!commandPayload) {
            throw new Error('Act AI gecerli Studio komutu dondurmedi.');
        }

        if (Array.isArray(commandPayload.commands) && commandPayload.commands.length) {
            commandPayload.engineResult = actAiApplyStudioCommands(commandPayload.commands);
        }

        if (options.commitSession !== false) {
            actAiCommitSessionTurn(options.prompt || 'Dis komut', data, commandPayload);
        }

        return {
            ...commandPayload,
            analysis: data
        };
    }
};

function actAiBuildRequestPayload(userText, app) {
    const canvas = app.getCanvasSize?.() || { width: 1080, height: 1080 };
    const project = app.getProjectData?.() || {};
    const layerIndex = actAiBuildLayerIndex(app);

    const payload = {
        version: 'act-ai.v1',
        agent: 'designer',
        message: userText,
        app: {
            id: ACT_AI_APP_ID,
            name: 'Studio'
        },
        context: {
            canvas: {
                width: Math.round(Number(canvas.width) || 1080),
                height: Math.round(Number(canvas.height) || 1080)
            },
            selection: project.selection || {
                selectedId: project.selectedLayerId || null,
                selectedIds: project.selectedLayerIds || []
            },
            layers: layerIndex
        },
        session: actAiReadSession()
    };

    return payload;
}

async function actAiAnalyze(text, app) {
    const payload = app ? actAiBuildRequestPayload(text, app) : { version: 'act-ai.v1', message: text };
    const response = await fetch(ACT_AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Sunucu hatası: ' + response.status);

    return await response.json();
}

function actAiApplyStudioCommands(commands) {
    if (!Array.isArray(commands) || !commands.length) {
        throw new Error('Act AI komut uretmedi.');
    }

    const result = window.StudioEngine?.applyCommands?.(commands, {
        commitHistory: true,
        includeContext: false
    });

    if (!result?.ok) {
        throw new Error(result?.errors?.[0]?.message || 'Studio engine komutu calismadi.');
    }

    return result;
}

function actAiStudioUid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function actAiStudioCanvas(app) {
    const canvas = app.getCanvasSize?.() || { width: 1080, height: 1080 };
    return {
        width: Math.round(Number(canvas.width) || 1080),
        height: Math.round(Number(canvas.height) || 1080)
    };
}

function actAiStudioGradient() {
    return 'linear-gradient(135deg, #0f172a, #2563eb)';
}

function actAiStudioTextLayer(text, app) {
    const canvas = actAiStudioCanvas(app);
    return {
        id: actAiStudioUid('act_text'),
        type: 'text',
        name: String(text || 'Yeni metin').slice(0, 28),
        text: text || 'Yeni metin',
        x: Math.round(canvas.width * 0.1),
        y: Math.round(canvas.height * 0.42),
        width: Math.round(canvas.width * 0.8),
        height: Math.max(80, Math.round(canvas.height * 0.16)),
        color: '#ffffff',
        fontSize: Math.max(36, Math.round(canvas.width * 0.075)),
        fontWeight: 800,
        textAlign: 'center',
        fontFamily: 'Inter',
        layerStyle: {
            dropShadow: {
                enabled: true,
                color: '#000000',
                opacity: 35,
                angle: 90,
                distance: 8,
                blur: 18,
                spread: 0
            }
        }
    };
}

function actAiStudioRasterLayer(app) {
    const canvas = actAiStudioCanvas(app);
    return {
        id: actAiStudioUid('act_raster'),
        type: 'raster',
        name: 'AI Raster Layer',
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
        src: null,
        canvasData: null,
        aspectLocked: true
    };
}

function actAiStudioDelta(params = {}) {
    const amount = Math.max(1, Math.round(Number(params.amount) || 40));
    if (params.direction === 'right') return { dx: amount, dy: 0 };
    if (params.direction === 'left') return { dx: -amount, dy: 0 };
    if (params.direction === 'up') return { dx: 0, dy: -amount };
    if (params.direction === 'down') return { dx: 0, dy: amount };
    return { dx: 0, dy: 0 };
}

function actAiGetTargetRasterLayer(app, target = 'last_raster') {
    const layers = app.getLayers?.() || [];
    const selected = app.getSelectedLayer?.();
    if ((!target || target === 'selected') && selected?.type === 'raster') return selected;

    if (typeof target === 'string' && target && !['selected', 'last_raster', 'background'].includes(target)) {
        const byId = layers.find(layer => layer.id === target);
        if (byId?.type === 'raster') return byId;
    }

    if (selected?.type === 'raster') return selected;
    return [...layers].reverse().find(layer => layer.type === 'raster') || null;
}

function actAiGetTargetLayer(app, target = 'selected') {
    const layers = app.getLayers?.() || [];
    const selected = app.getSelectedLayer?.();
    const normalized = actAiNormalize(target || 'selected');
    const topmost = layers.at(-1) || null;
    const bottommost = layers[0] || null;

    if ((!target || normalized === 'selected') && selected) return selected;
    if (['topmost', 'top_layer', 'last_layer'].includes(normalized)) return topmost;
    if (['bottommost', 'bottom_layer', 'first_layer'].includes(normalized)) return bottommost;
    if (normalized === 'last_raster') return [...layers].reverse().find(layer => layer.type === 'raster') || null;
    if (normalized === 'last_text') return [...layers].reverse().find(layer => layer.type === 'text') || null;
    if (normalized === 'last_shape') return [...layers].reverse().find(layer => layer.type === 'shape') || null;
    if (normalized === 'background') {
        return layers.find(layer => {
            const name = actAiNormalize(layer?.name || '');
            return name.includes('background') || name.includes('arka plan') || name.includes('bg');
        }) || bottommost;
    }

    const byId = layers.find(layer => layer.id === target);
    if (byId) return byId;

    const byName = layers.find(layer => actAiNormalize(layer.name || '') === normalized);
    if (byName) return byName;

    return selected || topmost || null;
}

function actAiCloneLayerForDuplicate(layer) {
    const copy = JSON.parse(JSON.stringify(layer));
    copy.id = actAiStudioUid('act_dup');
    copy.name = `${layer.name || 'Layer'} Copy`;
    copy.x = Math.round(Number(layer.x) || 0) + 24;
    copy.y = Math.round(Number(layer.y) || 0) + 24;
    return copy;
}

function actAiGetLayerIdsByTarget(app, target) {
    const layers = app.getLayers?.() || [];
    const normalized = actAiNormalize(target || '');
    if (normalized === 'all_text') return layers.filter(layer => layer.type === 'text').map(layer => layer.id);
    if (normalized === 'all_raster') return layers.filter(layer => layer.type === 'raster').map(layer => layer.id);
    if (normalized === 'all_shape') return layers.filter(layer => layer.type === 'shape').map(layer => layer.id);
    return [];
}

function actAiLoadImageMeta(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (/^https?:\/\//i.test(src)) img.crossOrigin = 'anonymous';
        img.onload = () => resolve({
            width: img.naturalWidth || img.width || 1,
            height: img.naturalHeight || img.height || 1
        });
        img.onerror = () => reject(new Error('Görsel okunamadı.'));
        img.src = src;
    });
}

function actAiFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(String(event.target?.result || ''));
        reader.onerror = () => reject(new Error('Dosya okunamadı.'));
        reader.readAsDataURL(file);
    });
}

function actAiPickImageFile() {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);

        input.addEventListener('change', () => {
            const file = Array.from(input.files || []).find(item => item.type?.startsWith('image/')) || null;
            input.remove();
            resolve(file);
        }, { once: true });

        input.click();
    });
}

function actAiComputeCoverPlacement(imageWidth, imageHeight, canvasSize) {
    const safeWidth = Math.max(1, Number(imageWidth) || canvasSize.width);
    const safeHeight = Math.max(1, Number(imageHeight) || canvasSize.height);
    const scale = Math.max(canvasSize.width / safeWidth, canvasSize.height / safeHeight);

    return {
        width: Math.max(1, Math.round(safeWidth * scale)),
        height: Math.max(1, Math.round(safeHeight * scale)),
        x: Math.round((canvasSize.width - (safeWidth * scale)) / 2),
        y: Math.round((canvasSize.height - (safeHeight * scale)) / 2)
    };
}

function actAiComputeImageAlignment(layer, canvasSize, direction) {
    const mode = actAiNormalize(direction);
    const width = Math.max(1, Math.round(Number(layer?.width) || 1));
    const height = Math.max(1, Math.round(Number(layer?.height) || 1));
    const patch = {};

    if (mode === 'left') patch.x = 0;
    if (mode === 'center' || mode === 'horizontal') patch.x = Math.round((canvasSize.width - width) / 2);
    if (mode === 'right') patch.x = Math.round(canvasSize.width - width);
    if (mode === 'top' || mode === 'up') patch.y = 0;
    if (mode === 'middle' || mode === 'vertical') patch.y = Math.round((canvasSize.height - height) / 2);
    if (mode === 'bottom' || mode === 'down') patch.y = Math.round(canvasSize.height - height);
    if (mode === 'center_middle' || mode === 'center-middle') {
        patch.x = Math.round((canvasSize.width - width) / 2);
        patch.y = Math.round((canvasSize.height - height) / 2);
    }

    return patch;
}

async function actAiAddImageFromPicker(app, options = {}) {
    const file = await actAiPickImageFile();
    if (!file) {
        return {
            message: 'Resim seçimi iptal edildi.',
            commands: []
        };
    }

    const src = await actAiFileToDataUrl(file);
    const meta = await actAiLoadImageMeta(src);
    const canvas = actAiStudioCanvas(app);
    const layerId = actAiStudioUid('act_image');
    const layer = {
        id: layerId,
        type: 'raster',
        name: file.name || 'AI Image',
        src,
        x: Math.round((canvas.width - meta.width) / 2),
        y: Math.round((canvas.height - meta.height) / 2),
        width: meta.width,
        height: meta.height,
        aspectLocked: true
    };

    const commands = [{ action: 'add_layer', layer }];
    const normalizedPosition = actAiNormalize(options.position || '');
    if (normalizedPosition === 'front' || normalizedPosition === 'back') {
        commands.push({
            action: 'reorder_layer',
            target: layerId,
            position: normalizedPosition
        });
    }

    const result = window.StudioEngine?.applyCommands?.(commands, {
        commitHistory: true,
        includeContext: false
    });

    if (!result?.ok) {
        throw new Error(result?.errors?.[0]?.message || 'Resim eklenemedi.');
    }

    return {
        message: `${layer.name} eklendi. En boy oranı kilitli.`,
        commands
    };
}

async function actAiExportDesignPng() {
    if (typeof window.exportPNG !== 'function') {
        throw new Error('Dışa aktarma fonksiyonu bulunamadı.');
    }
    await window.exportPNG();
    return {
        message: 'Tasarım PNG olarak dışa aktarıldı.',
        commands: []
    };
}

function actAiSaveProjectJson() {
    if (typeof window.exportProject !== 'function') {
        throw new Error('Proje kaydetme fonksiyonu bulunamadı.');
    }
    window.exportProject();
    return {
        message: 'Proje JSON olarak kaydedildi.',
        commands: []
    };
}

async function actAiHandleDirectAction(data, app) {
    const action = data?.action;
    const actionId = action?.id || action?.name;
    const params = action?.params || {};

    if (actionId === 'add_image') {
        const isMobile = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
        if (!isMobile) {
            // Masaüstünde otomatik tetiklemeyi dene
            actAiAddImageFromPicker(app, params).catch(err => console.warn('Otomatik seçim başlatılamadı:', err));
        }

        return {
            message: 'Resim yüklemek için aşağıdaki butonu kullanabilirsin.',
            isManualTrigger: true
        };
    }

    if (actionId === 'export_design_png') {
        return actAiExportDesignPng();
    }

    if (actionId === 'save_project_json') {
        return actAiSaveProjectJson();
    }

    return null;
}

function actAiBuildStudioCommandsFromAction(data, app) {
    const action = data?.action;
    const actionId = action?.id || action?.name;
    const baseParams = action?.params || {};
    const params = actAiNormalizeActionParams(actionId, baseParams);
    const canvas = actAiStudioCanvas(app);

    if (!actionId) return null;

    if (actionId === 'add_text') {
        return {
            message: 'Metin katmanı eklendi.',
            commands: [{
                action: 'add_layer',
                layer: actAiStudioTextLayer(params.text || 'Yeni metin', app)
            }]
        };
    }

    if (actionId === 'add_raster_layer') {
        return {
            message: 'Raster katman eklendi.',
            commands: [{
                action: 'add_layer',
                layer: actAiStudioRasterLayer(app)
            }]
        };
    }

    if (actionId === 'set_background') {
        const layerId = actAiStudioUid('act_bg');
        return {
            message: 'Arka plan hazırlandı.',
            commands: [
                {
                    action: 'add_layer',
                    layer: {
                        id: layerId,
                        type: 'shape',
                        name: 'AI Background',
                        x: 0,
                        y: 0,
                        width: canvas.width,
                        height: canvas.height,
                        fill: params.gradientValue || (params.gradient ? actAiStudioGradient() : (params.color || '#0f172a')),
                        shapeType: 'rect',
                        radius: 0
                    }
                },
                { action: 'reorder_layer', target: layerId, position: 'back' }
            ]
        };
    }

    if (actionId === 'add_shape') {
        return {
            message: 'Şekil katmanı eklendi.',
            commands: [{
                action: 'add_layer',
                layer: {
                    id: actAiStudioUid('act_shape'),
                    type: 'shape',
                    name: 'AI Shape',
                    x: Math.round(canvas.width * 0.32),
                    y: Math.round(canvas.height * 0.28),
                    width: Math.round(canvas.width * 0.36),
                    height: Math.round(canvas.height * 0.36),
                    fill: params.gradientValue || (params.gradient ? actAiStudioGradient() : (params.color || '#2563eb')),
                    shapeType: params.shapeType || 'rect',
                    radius: params.shapeType === 'rect' ? 28 : 0
                }
            }]
        };
    }

    if (actionId === 'update_selected') {
        const value = params.gradientValue || (params.gradient ? actAiStudioGradient() : (params.color || '#2563eb'));
        return {
            message: 'Seçili katman güncellendi.',
            commands: [{
                action: 'update_layer',
                target: params.target || 'selected',
                patch: {
                    fill: value,
                    color: value,
                    ...(params.text ? { text: params.text } : {})
                }
            }]
        };
    }

    if (actionId === 'remove_layer') {
        const target = params.target || 'selected';
        const targetIds = actAiGetLayerIdsByTarget(app, target);
        if (targetIds.length) {
            return {
                message: 'Katmanlar silindi.',
                commands: [{ action: 'remove_layers', targets: targetIds }]
            };
        }

        return {
            message: 'Katman silindi.',
            commands: [{ action: 'remove_layer', target }]
        };
    }

    if (actionId === 'duplicate_layer') {
        const layer = actAiGetTargetLayer(app, params.target || 'selected');
        if (!layer) throw new Error('Çoğaltılacak katman bulunamadı.');

        return {
            message: 'Katman çoğaltıldı.',
            commands: [{
                action: 'add_layer',
                layer: actAiCloneLayerForDuplicate(layer)
            }]
        };
    }

    if (actionId === 'remove_all_layers') {
        const typedTarget = params.target || 'all';
        const typedTargetIds = actAiGetLayerIdsByTarget(app, typedTarget);
        if (typedTargetIds.length) {
            return {
                message: 'Katmanlar silindi.',
                commands: [{ action: 'remove_layers', targets: typedTargetIds }]
            };
        }

        const targetIds = (app.getLayers?.() || []).map(layer => layer.id);
        if (!targetIds.length) {
            return {
                message: 'Silinecek katman yok.',
                commands: []
            };
        }

        return {
            message: 'Tüm katmanlar silindi.',
            commands: [{ action: 'remove_layers', targets: targetIds }]
        };
    }

    if (actionId === 'move_layer') {
        return {
            message: 'Katman taşındı.',
            commands: [{ action: 'move_layer', target: params.target || 'selected', ...actAiStudioDelta(params) }]
        };
    }

    if (actionId === 'reorder_layer') {
        if (!['front', 'back'].includes(params.position)) {
            throw new Error('Katman sırası için front veya back gerekli.');
        }

        const layer = params.target === 'last_raster'
            ? actAiGetTargetRasterLayer(app, params.target)
            : actAiGetTargetLayer(app, params.target || 'selected');
        if (!layer) throw new Error('Sırası değiştirilecek katman bulunamadı.');

        return {
            message: params.position === 'front' ? 'Katman en öne alındı.' : 'Katman en arkaya alındı.',
            commands: [{
                action: 'reorder_layer',
                target: layer.id,
                position: params.position
            }]
        };
    }

    if (actionId === 'resize_image_width') {
        const layer = params.target === 'last_raster'
            ? actAiGetTargetRasterLayer(app, params.target)
            : actAiGetTargetLayer(app, params.target || 'selected');
        if (!layer) throw new Error('Boyutlandırılacak katman bulunamadı.');

        const nextWidth = Math.max(1, Math.round(Number(params.width || params.amount) || layer.width || 1));
        const ratio = Math.max(0.0001, (Number(layer.height) || 1) / Math.max(1, Number(layer.width) || 1));
        const nextHeight = Math.max(1, Math.round(nextWidth * ratio));

        return {
            message: `Resim genişliği ${nextWidth}px yapıldı. En boy oranı kilitli.`,
            commands: [{
                action: 'update_layer',
                target: layer.id,
                patch: {
                    width: nextWidth,
                    height: nextHeight,
                    aspectLocked: true
                }
            }]
        };
    }

    if (actionId === 'resize_image_dimensions') {
        const layer = params.target === 'last_raster'
            ? actAiGetTargetRasterLayer(app, params.target)
            : actAiGetTargetLayer(app, params.target || 'selected');
        if (!layer) throw new Error('Boyutlandırılacak katman bulunamadı.');

        const currentWidth = Math.max(1, Number(layer.width) || 1);
        const currentHeight = Math.max(1, Number(layer.height) || 1);
        const width = Number(params.width);
        const height = Number(params.height);
        const patch = { aspectLocked: !!params.aspectLocked };

        if (Number.isFinite(width) && width > 0) patch.width = Math.max(1, Math.round(width));
        if (Number.isFinite(height) && height > 0) patch.height = Math.max(1, Math.round(height));

        if (patch.width && !patch.height && layer.aspectLocked !== false) {
            patch.height = Math.max(1, Math.round(patch.width * (currentHeight / currentWidth)));
            patch.aspectLocked = true;
        }
        if (patch.height && !patch.width && layer.aspectLocked !== false) {
            patch.width = Math.max(1, Math.round(patch.height * (currentWidth / currentHeight)));
            patch.aspectLocked = true;
        }

        if (!patch.width && !patch.height) throw new Error('Boyut için piksel değeri gerekli.');

        return {
            message: `Resim boyutu ${patch.width || Math.round(currentWidth)} x ${patch.height || Math.round(currentHeight)} px yapıldı.`,
            commands: [{
                action: 'update_layer',
                target: layer.id,
                patch
            }]
        };
    }

    if (actionId === 'cover_image_to_canvas') {
        const layer = actAiGetTargetRasterLayer(app, params.target);
        if (!layer) throw new Error('Boyutlandırılacak raster görsel bulunamadı.');

        const placement = actAiComputeCoverPlacement(layer.width, layer.height, canvas);
        return {
            message: 'Resim canvası boşluk kalmayacak şekilde kapladı.',
            commands: [{
                action: 'update_layer',
                target: layer.id,
                patch: {
                    ...placement,
                    aspectLocked: true
                }
            }]
        };
    }

    if (actionId === 'lock_image_aspect') {
        const layer = actAiGetTargetRasterLayer(app, params.target);
        if (!layer) throw new Error('Oranı kilitlenecek raster görsel bulunamadı.');

        return {
            message: 'Resmin en boy oranı kilitlendi.',
            commands: [{
                action: 'update_layer',
                target: layer.id,
                patch: {
                    aspectLocked: true
                }
            }]
        };
    }

    if (actionId === 'align_image_to_canvas') {
        const layer = params.target === 'last_raster'
            ? actAiGetTargetRasterLayer(app, params.target)
            : actAiGetTargetLayer(app, params.target || 'selected');
        if (!layer) throw new Error('Hizalanacak katman bulunamadı.');

        const patch = actAiComputeImageAlignment(layer, canvas, params.direction);
        if (!Object.keys(patch).length) throw new Error('Hizalama yönü bulunamadı.');

        return {
            message: 'Resim hizalandı.',
            commands: [{
                action: 'update_layer',
                target: layer.id,
                patch
            }]
        };
    }

    return null;
}

function actAiReadCommandPayload(data, app) {
    if (data?.type === 'clarification' && data?.clarification) {
        return {
            message: data.reply || 'Biraz daha net söyler misin?',
            assistantMessage: data.reply || 'Biraz daha net söyler misin?',
            commands: [],
            clarification: data.clarification
        };
    }

    if (data?.type === 'action' && data?.action) {
        const payload = actAiBuildStudioCommandsFromAction(data, app);
        return payload ? {
            ...payload,
            assistantMessage: actAiReadAssistantReply(data) || payload.message
        } : null;
    }

    if (Array.isArray(data?.commands)) {
        return {
            message: data.message || 'Komut uygulandi.',
            assistantMessage: actAiReadAssistantReply(data) || data.message || 'Komut uygulandi.',
            commands: data.commands
        };
    }

    if (typeof data?.reply !== 'string' || !data.reply.trim()) {
        return null;
    }

    try {
        const parsed = JSON.parse(data.reply);
        if (Array.isArray(parsed?.commands)) {
            return {
                message: parsed.message || data.message || 'Komut uygulandi.',
                assistantMessage: parsed.reply || parsed.message || data.message || 'Komut uygulandi.',
                commands: parsed.commands
            };
        }
    } catch {
        // Plain text replies are handled below as normal assistant messages.
    }

    return {
        message: data?.type === 'action' ? 'Komut hazırlanamadı.' : 'Yanıtlandı.',
        assistantMessage: data.reply.trim(),
        commands: []
    };
}

function actAiRenderAnalysis(analysis) {
    const actionId = analysis?.action?.id || analysis?.action?.name || analysis?.matchedAction || '-';
    const confidence = Number(analysis?.action?.confidence ?? analysis?.confidence ?? 0);
    return `
        <div class="act-ai-plan">
            <div><strong>Action</strong> ${actAiEscapeHtml(actionId)}</div>
            <div><strong>Confidence</strong> ${Math.round(confidence * 100)}%</div>
        </div>
    `;
}

function actAiAddChatMessage(root, role, message, meta = '', options = {}) {
    const chat = root.querySelector('#actAiChat');
    if (!chat) return;

    const item = document.createElement('div');
    item.className = `act-ai-msg ${role === 'user' ? 'user' : 'ai'}`;
    const bubble = document.createElement('div');
    bubble.className = 'act-ai-bubble';
    bubble.textContent = message;

    if (meta) {
        const metaEl = document.createElement('span');
        metaEl.className = 'act-ai-msg-meta';
        metaEl.textContent = meta;
        bubble.appendChild(metaEl);
    }

    item.appendChild(bubble);
    chat.appendChild(item);
    chat.scrollTop = chat.scrollHeight;

    if (options.persist !== false) {
        actAiStoreChatMessage(role, message, meta);
    }
}

function actAiRestoreChat(root) {
    const chat = root.querySelector('#actAiChat');
    actAiPendingClarification = actAiReadSession().pending || null;
    const entries = actAiReadStoredChat();
    entries.forEach(entry => {
        actAiAddChatMessage(root, entry.role, entry.message, entry.meta, { persist: false });
    });
    if (entries.length && chat) {
        requestAnimationFrame(() => {
            chat.scrollTop = chat.scrollHeight;
        });
    }
    return entries.length;
}

function actAiAddLog(root, prompt, message, analysis = null, isError = false) {
    const actionId = analysis?.action?.id || analysis?.action?.name || analysis?.matchedAction || '';
    const isManualTrigger = analysis?.action?.id === 'add_image' || analysis?.isManualTrigger;
    const manualPosition = analysis?.action?.params?.position || '';
    const confidence = Number(analysis?.action?.confidence ?? analysis?.confidence ?? 0);
    const meta = actionId
        ? `${actionId}${confidence ? ` · ${Math.round(confidence * 100)}%` : ''}`
        : '';

    if (isManualTrigger) {
        const chat = root.querySelector('#actAiChat');
        if (chat) {
            const item = document.createElement('div');
            item.className = 'act-ai-msg ai act-ai-question';
            item.innerHTML = `
                <div class="act-ai-bubble">${actAiEscapeHtml(message)}<div class="act-ai-choice-list">
                    <button class="act-ai-choice" type="button" data-act-ai-action-trigger="add_image" data-act-ai-position="${actAiEscapeHtml(manualPosition)}"><i class="fa-solid fa-image"></i> Resim Seç</button>
                </div></div>
            `;
            chat.appendChild(item);
            chat.scrollTop = chat.scrollHeight;
            actAiStoreChatMessage('ai', message);
            return;
        }
    }

    actAiAddChatMessage(root, 'ai', message, isError ? 'hata' : meta);
}

function actAiAddClarificationLog(root, message, clarification) {
    const candidates = Array.isArray(clarification?.candidates) ? clarification.candidates : [];
    if (!candidates.length) {
        actAiAddChatMessage(root, 'ai', message);
        return;
    }

    const chat = root.querySelector('#actAiChat');
    if (!chat) {
        actAiAddChatMessage(root, 'ai', message);
        return;
    }

    const choices = candidates.map((candidate, index) => `
        <button class="act-ai-choice" type="button" data-act-ai-target-id="${actAiEscapeHtml(candidate.id)}">${index + 1}. ${actAiEscapeHtml(candidate.label || candidate.id)}</button>
    `).join('');

    const item = document.createElement('div');
    item.className = 'act-ai-msg ai act-ai-question';
    item.innerHTML = `
        <div class="act-ai-bubble">${actAiEscapeHtml(message)}<div class="act-ai-choice-list">${choices}</div></div>
    `;
    chat.appendChild(item);
    chat.scrollTop = chat.scrollHeight;
    actAiStoreChatMessage('ai', message);
}

function actAiSetStatus(root, message, isError = false) {
    const status = root.querySelector('#actAiStatus');
    if (!status) return;

    status.hidden = false;
    status.innerHTML = `
        <i class="fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-check'}" style="color:${isError ? '#ef4444' : '#10b981'}"></i>
        ${actAiEscapeHtml(message)}
    `;
}

function actAiSetBusy(root, busy) {
    const input = root.querySelector('#actAiPrompt');
    const run = root.querySelector('#actAiRun');
    const quickActions = root.querySelectorAll('[data-act-ai-quick-prompt]');
    if (input) input.disabled = busy;
    if (run) run.disabled = busy;
    quickActions.forEach(button => {
        button.disabled = busy;
    });
}

function actAiClearPrompt(input) {
    if (!input) return;
    input.value = '';
    input.style.height = 'auto';
}

function actAiResizePrompt(input) {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

function actAiShouldAutoFocus(root) {
    return !!root?.closest?.('#pluginModalBody');
}

function actAiSettleInputFocus(root, input) {
    if (!input) return;
    if (actAiShouldAutoFocus(root)) {
        input.focus();
    }
}

async function actAiRun(root, app) {
    const input = root.querySelector('#actAiPrompt');
    const prompt = input?.value?.trim() || '';
    const commandPrompt = prompt;

    if (!prompt) {
        actAiSetStatus(root, 'Bir mesaj yaz.', true);
        return;
    }

    actAiAddChatMessage(root, 'user', prompt);
    actAiClearPrompt(input);

    actAiSetBusy(root, true);
    actAiSetStatus(root, 'Act AI düşünüyor...');

    try {
        const commandPayload = await actAiExecuteCommand(commandPrompt, app);
        actAiPendingClarification = commandPayload.clarification || null;
        actAiSetStatus(root, commandPayload.message);
        if (commandPayload.clarification) {
            actAiAddClarificationLog(root, commandPayload.assistantMessage || commandPayload.message, commandPayload.clarification);
        } else {
            actAiAddLog(root, prompt, commandPayload.assistantMessage || commandPayload.message, commandPayload.analysis);
        }
        actAiUpdateLiveMeta(root, app);
    } catch (error) {
        const message = error?.message || 'Act AI komutu calismadi.';
        actAiSetStatus(root, message, true);
        actAiAddLog(root, prompt, message, null, true);
    } finally {
        actAiSetBusy(root, false);
        actAiSettleInputFocus(root, input);
    }
}

function actAiAttachHandlers(root, app) {
    const input = root.querySelector('#actAiPrompt');
    const run = root.querySelector('#actAiRun');

    actAiPendingClarification = null;
    actAiUpdateLiveMeta(root, app);
    const liveTimer = setInterval(() => {
        if (!document.body.contains(root)) {
            clearInterval(liveTimer);
            return;
        }
        actAiUpdateLiveMeta(root, app);
    }, 1200);

    run?.addEventListener('click', () => actAiRun(root, app));
    input?.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        if (event.shiftKey) return;
        event.preventDefault();
        actAiRun(root, app);
    });
    input?.addEventListener('input', () => actAiResizePrompt(input));

    const quickActions = root.querySelector('.act-ai-quick-actions');
    quickActions?.addEventListener('wheel', event => {
        if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

        const nextScrollLeft = quickActions.scrollLeft + event.deltaY;
        const maxScrollLeft = quickActions.scrollWidth - quickActions.clientWidth;
        if (maxScrollLeft <= 0) return;

        const canScrollLeft = event.deltaY < 0 && quickActions.scrollLeft > 0;
        const canScrollRight = event.deltaY > 0 && quickActions.scrollLeft < maxScrollLeft;
        if (!canScrollLeft && !canScrollRight) return;

        event.preventDefault();
        quickActions.scrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft));
    }, { passive: false });

    root.addEventListener('click', event => {
        const helperButton = event.target.closest('[data-act-ai-helper-open]');
        if (helperButton) {
            actAiOpenHelperModal();
            return;
        }

        const quickPrompt = event.target.closest('[data-act-ai-quick-prompt]');
        if (quickPrompt && input) {
            input.value = quickPrompt.dataset.actAiQuickPrompt || '';
            actAiResizePrompt(input);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            actAiRun(root, app);
            return;
        }

        const actionTrigger = event.target.closest('[data-act-ai-action-trigger="add_image"]');
        if (actionTrigger) {
            actAiAddImageFromPicker(app, {
                position: actionTrigger.dataset.actAiPosition || ''
            }).catch(err => actAiSetStatus(root, err.message, true));
            return;
        }

        const choice = event.target.closest('[data-act-ai-target-id]');
        if (choice && actAiPendingClarification) {
            const candidate = actAiPendingClarification.candidates.find(item => item.id === choice.dataset.actAiTargetId);
            if (!candidate || !input) return;
            input.value = candidate.label;
            actAiRun(root, app);
            return;
        }
    });

    if (!actAiRestoreChat(root)) {
        actAiAddChatMessage(root, 'ai', ACT_AI_WELCOME_MESSAGE);
    }
}

function actAiOpenWithPrompt(prompt, options = {}) {
    const text = String(prompt || '').trim();
    if (!text || typeof window.openPluginModalById !== 'function') return false;

    window.openPluginModalById('act-ai');

    let attempts = 0;
    const applyPrompt = () => {
        const root = document.getElementById('pluginModalBody');
        const input = root?.querySelector('#actAiPrompt');
        const run = root?.querySelector('#actAiRun');
        if (!input || !run) {
            attempts += 1;
            if (attempts < 12) {
                requestAnimationFrame(applyPrompt);
            }
            return;
        }

        input.value = text;
        actAiResizePrompt(input);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();

        if (options.submit !== false) {
            run.click();
        }
    };

    requestAnimationFrame(applyPrompt);
    return true;
}

window.openActAiWithPrompt = actAiOpenWithPrompt;

async function actAiRunPromptSilently(prompt) {
    const text = String(prompt || '').trim();
    if (!text) {
        throw new Error('Bir mesaj yaz.');
    }

    const app = window.createStudioPluginAppApiById?.('act-ai');
    if (!app) {
        throw new Error('Act AI hazir degil.');
    }

    return await actAiExecuteCommand(text, app);
}

window.runActAiPromptSilently = actAiRunPromptSilently;

registerStudioPlugin({
    id: 'act-ai',
    name: 'Act AI',
    menuLabel: 'Act AI',
    icon: 'fa-solid fa-wand-magic-sparkles',
    init(app) {
        ensureActAiStyles(app);
        actAiBindProjectReset();
    },
    openModal() {
        return {
            title: 'Act AI',
            subtitle: 'Studio ile sohbet ederek düzenle.',
            html: `
                <div class="plugin-form act-ai-plugin">
                    <div class="act-ai-live-panel">
                        <div class="act-ai-live-state">
                            <span class="act-ai-live-dot" aria-hidden="true"></span>
                            <span>Canlı</span>
                        </div>
                        <div class="act-ai-live-actions">
                            <div id="actAiLiveMeta" class="act-ai-live-meta">Proje okunuyor</div>
                            <button class="act-ai-helper-button" type="button" data-act-ai-helper-open aria-label="Act AI komut yardımı">
                                <i class="fa-regular fa-circle-question"></i>
                            </button>
                        </div>
                    </div>

                    <div id="actAiChat" class="act-ai-chat" aria-live="polite"></div>

                    <div class="field">
                        <div class="act-ai-quick-actions" aria-label="Hazır sohbet komutları">
                            <button class="act-ai-quick-action" type="button" data-act-ai-quick-prompt="tasarımı dışa aktar">
                                <i class="fa-solid fa-download" aria-hidden="true"></i>
                                <span>Tasarımı indir</span>
                            </button>
                            <button class="act-ai-quick-action" type="button" data-act-ai-quick-prompt="resim yükle">
                                <i class="fa-regular fa-image" aria-hidden="true"></i>
                                <span>Resim yükle</span>
                            </button>
                            <button class="act-ai-quick-action" type="button" data-act-ai-quick-prompt="resmi sığdır">
                                <i class="fa-solid fa-down-left-and-up-right-to-center" aria-hidden="true"></i>
                                <span>Resmi sığdır</span>
                            </button>
                            <button class="act-ai-quick-action" type="button" data-act-ai-quick-prompt="resmi en arkaya gönder">
                                <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                                <span>Resmi en arkaya gönder</span>
                            </button>
                        </div>
                        <div class="act-ai-command-row">
                            <textarea id="actAiPrompt" class="act-ai-input" rows="1" placeholder="Bir şey yaz..."></textarea>
                            <button id="actAiRun" class="plugin-primary-btn" type="button">
                                <i class="fa-solid fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>

                    <div id="actAiStatus" class="plugin-status" hidden></div>
                </div>
            `,
            onOpen({ root, app }) {
                actAiAttachHandlers(root, app);
                if (actAiShouldAutoFocus(root)) {
                    setTimeout(() => root.querySelector('#actAiPrompt')?.focus(), 0);
                }
            }
        };
    }
});
