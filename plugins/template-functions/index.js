const TEMPLATE_FUNCTIONS_STYLE_ID = 'studio-plugin-template-functions-style';
let templateFunctionsApp = null;
let templateFunctionsRunning = false;
const templateFunctionsSizeLimits = new Map();

function templateFunctionsEnsureStyles(app) {
    if (document.getElementById(TEMPLATE_FUNCTIONS_STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = TEMPLATE_FUNCTIONS_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = app.getAssetUrl('style.css');
    document.head.appendChild(link);
}

function templateFunctionsEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function templateFunctionsNormalizeRule(rule) {
    const textLayerId = typeof rule?.textLayerId === 'string' ? rule.textLayerId.trim() : '';
    const shapeLayerId = typeof rule?.shapeLayerId === 'string' ? rule.shapeLayerId.trim() : '';
    if (!textLayerId || !shapeLayerId) return null;

    return {
        id: typeof rule?.id === 'string' && rule.id.trim()
            ? rule.id.trim()
            : `template_fn_${Math.random().toString(36).slice(2, 10)}`,
        name: typeof rule?.name === 'string' && rule.name.trim() ? rule.name.trim() : 'Shape metne gore kisalsin',
        type: 'shrink_shape_by_text_width',
        enabled: rule?.enabled !== false,
        textLayerId,
        shapeLayerId,
        targetProperty: ['auto', 'height', 'width'].includes(rule?.targetProperty) ? rule.targetProperty : 'auto',
        baseSize: Math.max(1, Math.round(Number(rule?.baseSize) || 1)),
        minSize: Math.max(1, Math.round(Number(rule?.minSize) || 1)),
        gap: Math.max(0, Math.round(Number(rule?.gap) || 0))
    };
}

function templateFunctionsResolveTargetProperty(rule, shapeLayer) {
    const width = Math.max(0, Number(shapeLayer?.width) || 0);
    const height = Math.max(0, Number(shapeLayer?.height) || 0);

    if (rule?.targetProperty === 'width' && width <= 4 && height > width * 12) {
        return 'height';
    }

    if (rule?.targetProperty === 'width' || rule?.targetProperty === 'height') {
        return rule.targetProperty;
    }

    return height > width ? 'height' : 'width';
}

function templateFunctionsMeasureTextLayer(textLayer, app = templateFunctionsApp) {
    if (!textLayer || textLayer.type !== 'text') {
        return { width: 0, height: 0 };
    }

    const probe = document.createElement('div');
    const canvasSize = app?.getCanvasSize?.() || { width: 1080, height: 1080 };
    const fontSize = Number(textLayer.fontSize) || 42;
    const layerWidth = Number(textLayer.width) || 0;
    const maxTextWidth = Math.max(40, layerWidth || (Number(canvasSize.width) - (Number(textLayer.x) || 0)));

    probe.style.position = 'fixed';
    probe.style.left = '-99999px';
    probe.style.top = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.whiteSpace = 'pre-wrap';
    probe.style.wordBreak = 'break-word';
    probe.style.overflowWrap = 'anywhere';
    probe.style.lineHeight = '1.15';
    probe.style.padding = '0';
    probe.style.border = 'none';
    probe.style.outline = 'none';
    probe.style.display = 'inline-block';
    probe.style.width = 'auto';
    probe.style.maxWidth = `${maxTextWidth}px`;
    probe.style.minWidth = '0';
    probe.style.minHeight = '0';
    probe.style.fontSize = `${fontSize}px`;
    probe.style.fontWeight = textLayer.fontWeight || 400;
    probe.style.textAlign = textLayer.textAlign || 'left';
    probe.style.fontFamily = `${textLayer.fontFamily || 'Inter'}, Arial, sans-serif`;
    probe.style.fontStyle = textLayer.fontStyle || 'normal';
    probe.style.textDecoration = textLayer.textDecoration || 'none';
    probe.textContent = textLayer.text || ' ';

    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    const width = Math.max(40, Math.min(maxTextWidth, Math.ceil(rect.width)));
    const height = Math.max(Math.ceil(fontSize * 1.4), Math.ceil(rect.height));
    probe.remove();

    return { width, height };
}

function templateFunctionsGetTextBlockOffset(textLayer, measuredTextSize, targetProperty) {
    if (!textLayer || targetProperty !== 'height') return 0;

    const textBoxHeight = Math.max(0, Number(textLayer.height) || 0);
    const textHeight = Math.max(0, Number(measuredTextSize?.height) || 0);
    const remaining = Math.max(0, textBoxHeight - textHeight);
    const verticalAlign = ['top', 'middle', 'bottom'].includes(textLayer.verticalAlign)
        ? textLayer.verticalAlign
        : 'top';

    if (verticalAlign === 'bottom') return remaining;
    if (verticalAlign === 'middle') return Math.round(remaining / 2);
    return 0;
}

function templateFunctionsComputeNextShapeSize(rule, textLayer, shapeLayer, targetProperty, measuredTextSize) {
    const textSize = Math.max(0, Number(measuredTextSize?.[targetProperty]) || Number(textLayer?.[targetProperty]) || 0);
    const defaultSize = Math.max(rule.minSize, Math.min(rule.baseSize, rule.baseSize - textSize - rule.gap));

    if (targetProperty !== 'height') return defaultSize;

    const shapeX = Number(shapeLayer.x) || 0;
    const shapeY = Number(shapeLayer.y) || 0;
    const shapeWidth = Math.max(0, Number(shapeLayer.width) || 0);
    const textX = Number(textLayer.x) || 0;
    const textY = Number(textLayer.y) || 0;
    const textWidth = Math.max(0, Number(textLayer.width) || 0);
    const overlapsHorizontally = shapeX <= textX + textWidth && shapeX + shapeWidth >= textX;

    if (!overlapsHorizontally || textY <= shapeY) return defaultSize;

    const textBlockOffset = templateFunctionsGetTextBlockOffset(textLayer, measuredTextSize, targetProperty);
    const textBlockTop = textY + textBlockOffset;
    const geometricSize = textBlockTop - shapeY - rule.gap;

    if (!Number.isFinite(geometricSize) || geometricSize <= 0) return defaultSize;
    return Math.max(rule.minSize, Math.min(rule.baseSize, geometricSize));
}

function templateFunctionsGetRules(app = templateFunctionsApp) {
    return (app?.getTemplateFunctions?.() || [])
        .map(templateFunctionsNormalizeRule)
        .filter(Boolean);
}

function templateFunctionsLayerOptions(layers, type, selectedId = '') {
    const filtered = layers.filter(layer => layer?.type === type);
    if (!filtered.length) return '<option value="">Katman yok</option>';

    return filtered.map(layer => `
        <option value="${templateFunctionsEscapeHtml(layer.id)}"${layer.id === selectedId ? ' selected' : ''}>
            ${templateFunctionsEscapeHtml(layer.name || layer.id)}
        </option>
    `).join('');
}

function templateFunctionsRuleFromForm(card) {
    const layers = templateFunctionsApp?.getLayers?.() || [];
    const textLayerId = card.querySelector('[data-tf-field="textLayerId"]')?.value;
    const shapeLayerId = card.querySelector('[data-tf-field="shapeLayerId"]')?.value;
    const targetPropertyValue = card.querySelector('[data-tf-field="targetProperty"]')?.value;
    const targetProperty = ['auto', 'height', 'width'].includes(targetPropertyValue) ? targetPropertyValue : 'auto';
    const textLayer = layers.find(layer => layer?.id === textLayerId && layer.type === 'text');
    const shapeLayer = layers.find(layer => layer?.id === shapeLayerId && layer.type === 'shape');
    const resolvedTargetProperty = templateFunctionsResolveTargetProperty({ targetProperty }, shapeLayer);
    const gap = Math.max(0, Math.round(Number(card.querySelector('[data-tf-field="gap"]')?.value) || 0));
    const minSize = Math.max(1, Math.round(Number(card.querySelector('[data-tf-field="minSize"]')?.value) || 1));
    const enteredBaseSize = Math.max(1, Math.round(Number(card.querySelector('[data-tf-field="baseSize"]')?.value) || 1));
    const measuredTextSize = textLayer ? templateFunctionsMeasureTextLayer(textLayer) : null;
    const textSize = Math.max(0, Number(measuredTextSize?.[resolvedTargetProperty]) || Number(textLayer?.[resolvedTargetProperty]) || 0);
    const shapeSize = Math.max(0, Number(shapeLayer?.[resolvedTargetProperty]) || 0);
    const minimumUsefulBaseSize = textSize + gap + minSize;
    const naturalBaseSize = textSize + gap + shapeSize;
    const baseSize = enteredBaseSize <= minimumUsefulBaseSize
        ? Math.max(minimumUsefulBaseSize, naturalBaseSize)
        : enteredBaseSize;

    return templateFunctionsNormalizeRule({
        id: card.dataset.ruleId,
        enabled: card.querySelector('[data-tf-field="enabled"]')?.checked !== false,
        name: card.querySelector('[data-tf-field="name"]')?.value,
        textLayerId,
        shapeLayerId,
        targetProperty,
        baseSize,
        minSize,
        gap
    });
}

function templateFunctionsRenderCard(rule, layers) {
    return `
        <section class="tf-card" data-rule-id="${templateFunctionsEscapeHtml(rule.id)}">
            <div class="tf-card-head">
                <div class="tf-card-title">Metin genisledikce shape kisalt</div>
                <button class="tf-remove" type="button" data-tf-remove title="Sil">
                    <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
            </div>
            <div class="tf-grid">
                <div class="tf-field tf-field-wide">
                    <label>Ad</label>
                    <input type="text" data-tf-field="name" value="${templateFunctionsEscapeHtml(rule.name)}">
                </div>
                <div class="tf-field">
                    <label>Metin katmani</label>
                    <select data-tf-field="textLayerId">${templateFunctionsLayerOptions(layers, 'text', rule.textLayerId)}</select>
                </div>
                <div class="tf-field">
                    <label>Shape katmani</label>
                    <select data-tf-field="shapeLayerId">${templateFunctionsLayerOptions(layers, 'shape', rule.shapeLayerId)}</select>
                </div>
                <div class="tf-field">
                    <label>Yon</label>
                    <select data-tf-field="targetProperty">
                        <option value="auto"${rule.targetProperty === 'auto' ? ' selected' : ''}>Otomatik</option>
                        <option value="width"${rule.targetProperty === 'width' ? ' selected' : ''}>Genislik</option>
                        <option value="height"${rule.targetProperty === 'height' ? ' selected' : ''}>Yukseklik</option>
                    </select>
                </div>
                <div class="tf-field">
                    <label>Toplam alan</label>
                    <input type="number" min="1" step="1" data-tf-field="baseSize" value="${templateFunctionsEscapeHtml(rule.baseSize)}">
                </div>
                <div class="tf-field">
                    <label>Minimum</label>
                    <input type="number" min="1" step="1" data-tf-field="minSize" value="${templateFunctionsEscapeHtml(rule.minSize)}">
                </div>
                <div class="tf-field">
                    <label>Bosluk</label>
                    <input type="number" min="0" step="1" data-tf-field="gap" value="${templateFunctionsEscapeHtml(rule.gap)}">
                </div>
                <div class="tf-field">
                    <label>Aktif</label>
                    <input type="checkbox" data-tf-field="enabled"${rule.enabled !== false ? ' checked' : ''}>
                </div>
            </div>
        </section>
    `;
}

function templateFunctionsRender(root, state, app) {
    const rules = state.rules;
    const layers = app.getLayers?.() || [];

    root.innerHTML = `
        <div class="template-functions-plugin">
            <div class="tf-toolbar">
                <div class="tf-status">${rules.length ? `${rules.length} fonksiyon` : 'Bu sablonda fonksiyon yok'}</div>
                <button class="btn btn-sm btn-primary" type="button" data-tf-add>
                    <i class="fa-solid fa-plus" aria-hidden="true"></i> Fonksiyon Ekle
                </button>
            </div>
            <div class="tf-list">
                ${rules.length
                    ? rules.map(rule => templateFunctionsRenderCard(rule, layers)).join('')
                    : '<div class="tf-empty">Fonksiyon eklenmedigi surece bu plugin sahnede hicbir otomatik degisiklik yapmaz.</div>'}
            </div>
            <div class="tf-actions">
                <button class="btn btn-sm btn-outline-light" type="button" data-tf-close>Kapat</button>
                <button class="btn btn-sm btn-primary" type="button" data-tf-save>
                    <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Kaydet
                </button>
            </div>
        </div>
    `;

    root.querySelector('[data-tf-add]')?.addEventListener('click', () => {
        const textLayer = layers.find(layer => layer?.type === 'text');
        const shapeLayer = layers.find(layer => layer?.type === 'shape');
        const gap = 24;
        const targetProperty = templateFunctionsResolveTargetProperty({ targetProperty: 'auto' }, shapeLayer);
        state.rules.push(templateFunctionsNormalizeRule({
            textLayerId: textLayer?.id || '',
            shapeLayerId: shapeLayer?.id || '',
            targetProperty: 'auto',
            baseSize: (shapeLayer?.[targetProperty] || 300) + (textLayer?.[targetProperty] || 0) + gap,
            minSize: Math.max(1, Math.round((shapeLayer?.[targetProperty] || 300) * 0.25)),
            gap
        }) || {
            id: `template_fn_${Math.random().toString(36).slice(2, 10)}`,
            name: 'Shape metne gore kisalsin',
            type: 'shrink_shape_by_text_width',
            enabled: true,
            textLayerId: '',
            shapeLayerId: '',
            targetProperty: 'auto',
            baseSize: 300,
            minSize: 80,
            gap: 24
        });
        templateFunctionsRender(root, state, app);
    });

    root.querySelectorAll('[data-tf-remove]').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('[data-rule-id]');
            state.rules = state.rules.filter(rule => rule.id !== card?.dataset.ruleId);
            templateFunctionsRender(root, state, app);
        });
    });

    root.querySelector('[data-tf-save]')?.addEventListener('click', () => {
        const nextRules = [...root.querySelectorAll('[data-rule-id]')]
            .map(templateFunctionsRuleFromForm)
            .filter(Boolean);
        state.rules = app.setTemplateFunctions?.(nextRules, { historyMode: 'immediate' }) || nextRules;
        templateFunctionsRun(app);
        templateFunctionsRender(root, state, app);
    });

    root.querySelector('[data-tf-close]')?.addEventListener('click', () => app.closeModal?.());
}

function templateFunctionsRun(app = templateFunctionsApp) {
    if (!app || templateFunctionsRunning) return;

    const rules = templateFunctionsGetRules(app).filter(rule => rule.enabled !== false);
    if (!rules.length) return;

    const layers = app.getLayers?.() || [];
    templateFunctionsRunning = true;

    try {
        rules.forEach(rule => {
            const textLayer = layers.find(layer => layer?.id === rule.textLayerId && layer.type === 'text');
            const shapeLayer = layers.find(layer => layer?.id === rule.shapeLayerId && layer.type === 'shape');
            if (!textLayer || !shapeLayer) return;

            const targetProperty = templateFunctionsResolveTargetProperty(rule, shapeLayer);
            const measuredTextSize = templateFunctionsMeasureTextLayer(textLayer, app);
            const currentSize = Number(shapeLayer[targetProperty]) || 0;
            const sizeLimitKey = `${rule.id}:${shapeLayer.id}:${targetProperty}`;
            if (!templateFunctionsSizeLimits.has(sizeLimitKey)) {
                templateFunctionsSizeLimits.set(sizeLimitKey, Math.max(rule.minSize, currentSize));
            }

            const maxSize = Math.max(rule.minSize, Number(templateFunctionsSizeLimits.get(sizeLimitKey)) || currentSize);
            const computedSize = templateFunctionsComputeNextShapeSize(rule, textLayer, shapeLayer, targetProperty, measuredTextSize);
            const nextSize = Math.min(maxSize, computedSize);
            if (Math.round(currentSize) === Math.round(nextSize)) return;

            app.updateLayer?.(shapeLayer.id, {
                [targetProperty]: Math.round(nextSize)
            }, {
                skipHistory: true,
                commitHistory: false,
                render: false,
                patchElement: true
            });
        });
    } finally {
        templateFunctionsRunning = false;
    }
}

function templateFunctionsShouldRunForLayerChange(event, app = templateFunctionsApp) {
    const applied = Array.isArray(event?.detail?.applied) ? event.detail.applied : [];
    if (!applied.length) return false;

    const layers = app?.getLayers?.() || [];
    return applied.some(item => {
        if (item?.action !== 'update_layer') return false;
        const layer = layers.find(candidate => candidate?.id === item.targetId);
        return layer?.type === 'text';
    });
}

window.registerStudioPlugin({
    id: 'template-functions',
    name: 'Fonksiyonlar',
    menuLabel: 'Fonksiyonlar',
    icon: 'fa-solid fa-code-branch',
    init(app) {
        templateFunctionsApp = app;
        templateFunctionsEnsureStyles(app);
        window.addEventListener('studio:template-functions-changed', () => {
            templateFunctionsSizeLimits.clear();
        });
        window.addEventListener('studio:layers-changed', event => {
            try {
                if (templateFunctionsShouldRunForLayerChange(event, app)) {
                    templateFunctionsRun(app);
                }
            } catch (error) {
                console.warn('Template function skipped:', error);
            }
        });
    },
    openModal(app) {
        templateFunctionsEnsureStyles(app);
        return {
            title: 'Fonksiyonlar',
            subtitle: 'Sadece bu projenin JSON icindeki sablon fonksiyonlarini duzenle.',
            html: '<div data-template-functions-root></div>',
            onOpen({ root }) {
                const mount = root.querySelector('[data-template-functions-root]');
                const state = { rules: templateFunctionsGetRules(app) };
                templateFunctionsRender(mount, state, app);
            }
        };
    }
});
