function getVoiceRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function createVoiceCommandController(app, hooks = {}) {
    const state = {
        recognition: null,
        transcript: '',
        phase: 'idle',
        pendingClarification: null,
        payload: null
    };

    const notify = (phase, message = '', transcript = '', payload = null) => {
        state.phase = phase;
        if (typeof hooks.onStateChange === 'function') {
            hooks.onStateChange({
                phase,
                message,
                transcript: transcript || state.transcript || '',
                payload: payload || state.payload
            });
        }
    };

    const submitCommand = async command => {
        let commandToSend = command;
        const actAi = window.StudioActAi;

        if (!actAi?.executeCommand) {
            notify('error', 'Act AI plugini hazır değil. Önce Act AI eklentisinin yüklendiğinden emin ol.', command);
            return;
        }

        if (state.pendingClarification) {
            const selected = actAi.resolveTargetCandidate?.(command, state.pendingClarification.candidates);
            if (!selected) {
                notify('error', 'Listedeki yazılardan birini söyle: ' + state.pendingClarification.candidates.map((item, index) => `${index + 1}. ${item.label}`).join(', '), command);
                return;
            }
            commandToSend = actAi.buildTargetedCommand?.(state.pendingClarification.command, selected.id)
                || `${state.pendingClarification.command}\nHedef katman: ${selected.id}`;
            state.pendingClarification = null;
        } else {
            const candidates = actAi.getTextTargetCandidates?.(command, app);
            if (candidates) {
                state.pendingClarification = { command, candidates };
                notify('idle', 'Hangi yazı? ' + candidates.map((item, index) => `${index + 1}. ${item.label}`).join(', '), command);
                return;
            }
        }

        notify('loading', `"${command}" komutu uygulanıyor...`, command);

        try {
            const payload = await actAi.executeCommand(commandToSend, app);
            notify('idle', payload.message || 'Komut uygulandı.', command, payload);
        } catch (error) {
            notify('error', 'Act AI komutu çalışmadı: ' + error.message, command);
        }
    };

    const ensureRecognition = () => {
        if (state.recognition) return state.recognition;
        const RecognitionCtor = getVoiceRecognitionCtor();
        if (!RecognitionCtor) return null;

        const recognition = new RecognitionCtor();
        recognition.lang = 'tr-TR';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.addEventListener('start', () => {
            state.transcript = '';
            notify('listening', 'Seni dinliyorum...');
        });

        recognition.addEventListener('result', event => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                transcript += event.results[i]?.[0]?.transcript || '';
            }
            if (transcript.trim()) {
                state.transcript = transcript.trim();
                notify('listening', 'Konuşma algılandı, bitirince otomatik gönderilecek.', state.transcript);
            }
        });

        recognition.addEventListener('error', event => {
            if (state.phase === 'loading') return;
            const key = event?.error || '';
            if (key === 'no-speech') {
                notify('idle', 'Ses algılanmadı. Tekrar dene.');
                return;
            }
            if (key === 'not-allowed' || key === 'service-not-allowed') {
                notify('error', 'Mikrofon izni verilmedi.');
                return;
            }
            notify('error', 'Ses algılama başlatılamadı.');
        });

        recognition.addEventListener('end', () => {
            if (state.phase !== 'listening') return;
            const command = state.transcript.trim();
            if (!command) {
                notify('idle', 'Ses algılanmadı. Tekrar dene.');
                return;
            }
            submitCommand(command);
        });

        state.recognition = recognition;
        return recognition;
    };

    const toggle = () => {
        if (state.phase === 'loading') return;
        const recognition = ensureRecognition();
        if (!recognition) {
            notify('error', 'Bu tarayıcı sesli komutu desteklemiyor.');
            return;
        }

        if (state.phase === 'listening') {
            recognition.stop();
            return;
        }

        try {
            state.transcript = '';
            recognition.start();
        } catch (_) {
            notify('error', 'Mikrofon tekrar başlatılamadı. Biraz sonra dene.');
        }
    };

    notify(
        'idle',
        getVoiceRecognitionCtor()
            ? 'Mikrofona dokun, komutunu söyle. Konuşman bitince otomatik uygularım.'
            : 'Bu tarayıcı sesli komutu desteklemiyor.'
    );

    return {
        toggle,
        getState() {
            return { ...state };
        }
    };
}

function mountVoiceCommandUi(root, controller) {
    const micButton = root.querySelector('#voiceCommandMicBtn');
    const status = root.querySelector('#voiceCommandStatus');
    const transcriptEl = root.querySelector('#voiceCommandTranscript');
    const choicesEl = root.querySelector('#voiceCommandChoices');

    const render = ({ phase, message, transcript, payload }) => {
        if (transcriptEl) transcriptEl.textContent = transcript || 'Henüz komut yok.';
        if (status) status.textContent = message;
        
        if (choicesEl) {
            choicesEl.innerHTML = '';
            const candidates = payload?.clarification?.candidates || [];
            const isManual = payload?.isManualTrigger;

            if (isManual && payload?.action?.id === 'add_image') {
                const btn = document.createElement('button');
                btn.className = 'act-ai-choice';
                btn.innerHTML = '<i class="fa-solid fa-image"></i> Resim Seç';
                btn.onclick = () => window.StudioActAi.addImage(app).then(res => render({ phase: 'idle', message: res.message }));
                choicesEl.appendChild(btn);
            } else if (candidates.length > 0) {
                candidates.forEach((c, i) => {
                    const btn = document.createElement('button');
                    btn.className = 'act-ai-choice';
                    btn.textContent = `${i + 1}. ${c.label}`;
                    btn.onclick = () => {
                        controller.toggle(); // stop listening if active
                        StudioActAi.executeCommand(StudioActAi.buildTargetedCommand(payload.clarification.originalMessage, c.id), app).then(res => render({ phase: 'idle', message: res.message }));
                    };
                    choicesEl.appendChild(btn);
                });
            }
        }

        if (micButton) {
            micButton.disabled = phase === 'loading';
            micButton.classList.toggle('is-listening', phase === 'listening');
            micButton.classList.toggle('is-loading', phase === 'loading');
            micButton.classList.toggle('is-error', phase === 'error');
            micButton.innerHTML = phase === 'loading'
                ? '<i class="fa-solid fa-spinner fa-spin"></i>'
                : phase === 'listening'
                    ? '<i class="fa-solid fa-wave-square"></i>'
                    : phase === 'error'
                        ? '<i class="fa-solid fa-triangle-exclamation"></i>'
                        : '<i class="fa-solid fa-microphone"></i>';
        }
    };

    render({
        phase: controller.getState().phase,
        message: getVoiceRecognitionCtor()
            ? 'Mikrofona dokun, komutunu söyle. Konuşman bitince otomatik uygularım.'
            : 'Bu tarayıcı sesli komutu desteklemiyor.',
        transcript: ''
    });

    micButton?.addEventListener('click', () => controller.toggle());
    return render;
}

const voiceCommandExternalControllers = new Map();

function getVoiceCommandExternalController(key = 'default') {
    if (voiceCommandExternalControllers.has(key)) {
        return voiceCommandExternalControllers.get(key);
    }

    const app = window.createStudioPluginAppApiById?.('voice-command');
    if (!app) return null;

    const listeners = new Set();
    const controller = createVoiceCommandController(app, {
        onStateChange(snapshot) {
            listeners.forEach(listener => listener(snapshot));
        }
    });

    const api = {
        toggle() {
            controller.toggle();
        },
        subscribe(listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getState() {
            return controller.getState();
        }
    };

    voiceCommandExternalControllers.set(key, api);
    return api;
}

window.StudioVoiceCommand = {
    getController(key = 'default') {
        return getVoiceCommandExternalController(key);
    }
};

registerStudioPlugin({
    id: 'voice-command',
    name: 'Sesli Komut',
    menuLabel: 'Sesli Komut',
    icon: 'fa-solid fa-microphone-lines',
    openModal(app) {
        return {
            title: 'Sesli Komut',
            subtitle: 'Bas-konuş ile mevcut tasarımı canlı düzenle.',
            html: `
                <div class="plugin-form">
                    <div class="plugin-options-card" style="display:flex;align-items:center;gap:16px;">
                        <button id="voiceCommandMicBtn" class="plugin-primary-btn" type="button" style="width:64px;height:64px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0;flex:0 0 auto;font-size:24px;">
                            <i class="fa-solid fa-microphone"></i>
                        </button>
                        <div style="min-width:0;flex:1;">
                            <div style="font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-strong);">Bas-Konuş</div>
                            <div id="voiceCommandStatus" class="plugin-status" style="margin-top:6px;">Hazırlanıyor...</div>
                        </div>
                    </div>
                    <div id="voiceCommandChoices" class="act-ai-choice-list" style="margin-top:12px;"></div>

                    <div class="plugin-options-card">
                        <div class="plugin-options-title">Son komut</div>
                        <div id="voiceCommandTranscript" style="font-size:14px;line-height:1.6;color:var(--text);word-break:break-word;">Henüz komut yok.</div>
                    </div>

                    <div class="plugin-options-card">
                        <div class="plugin-options-title">Örnekler</div>
                        <div style="font-size:13px;line-height:1.7;color:var(--muted);">
                            “Başlığı biraz sağa kaydır”<br>
                            “Yazının rengini turuncu yap”<br>
                            “Yazıya hafif bir drop shadow ver”<br>
                            “Arka plana gradient aç”
                        </div>
                    </div>
                </div>
            `,
            onOpen({ root }) {
                let render = () => {};
                const controller = createVoiceCommandController(app, {
                    onStateChange(snapshot) {
                        render(snapshot);
                    }
                });
                render = mountVoiceCommandUi(root, controller);
            }
        };
    }
});
