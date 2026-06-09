/**
 * Hedef elementin yazı yazılabilir bir alan (input, contenteditable, text layer vb.)
 * olup olmadığını kontrol eder.
 */
function isEditableEventTarget(target) {
    if (!target) return false;
    if (target.nodeType === 3) target = target.parentNode; // Metin düğümü kontrolü
    if (target.isContentEditable) return true;

    const tagName = target.tagName?.toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return true;

    if (target.closest?.('[contenteditable="true"], .allow-text-selection')) return true;

    return false;
}

function hasTextSelection() {
    const selection = window.getSelection?.();
    return !!selection && !selection.isCollapsed && String(selection).trim().length > 0;
}

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    if (key === 'meta' || key === 'control') {
        return;
    }

    if (isEditableEventTarget(e.target)) {
        return;
    }

    if (hasTextSelection() && isCmdOrCtrl && ['c', 'x'].includes(key)) {
        return;
    }

    if (isCmdOrCtrl && key === 'a') {
        e.preventDefault();
        return;
    }
}, true);

document.addEventListener('selectstart', event => {
    if (isEditableEventTarget(event.target)) return;
    event.preventDefault();
}, true);

const STATIC_SHORTCUTS = [
    { label: 'Katmanı Sil', keys: ['Delete / Backspace'], section: 'Genel' },
    { label: 'Katmanı Kopyala', keys: ['Cmd/Ctrl', 'D'], section: 'Genel' },
    { label: 'Geri Al', keys: ['Cmd/Ctrl', 'Z'], section: 'Genel' },
    { label: 'İleri Al', keys: ['Cmd/Ctrl', 'Shift', 'Z'], section: 'Genel' },
    { label: 'İleri Al (Alternatif)', keys: ['Cmd/Ctrl', 'Y'], section: 'Genel' },
    { label: 'Projeyi Kaydet', keys: ['Cmd/Ctrl', 'S'], section: 'Genel' },
    { label: 'Dışa Aktar', keys: ['Cmd/Ctrl', 'Shift', 'S'], section: 'Genel' },
    { label: 'Yeni Proje', keys: ['Option/Alt', 'N'], section: 'Genel' },
    { label: 'Proje Aç', keys: ['Option/Alt', 'O'], section: 'Genel' },
    { label: 'Seçimi Kaldır', keys: ['Option/Alt', 'D'], section: 'Genel' },
    { label: 'Transform Modu', keys: ['Option/Alt', 'T'], section: 'Genel' },
    { label: 'Katmanı Taşı', keys: ['Yön Tuşları'], section: 'Genel' },
    { label: 'Katmanı Hızlı Taşı', keys: ['Shift', 'Yön Tuşları'], section: 'Genel' },
    { label: 'Oto Seçim Kapalıyken Katman Seç', keys: ['Cmd/Ctrl', 'Click'], section: 'Genel' },
    { label: 'Panodaki Görseli Yapıştır', keys: ['Cmd/Ctrl', 'V'], section: 'Genel' },
    { label: 'Açık Modalı Kapat', keys: ['Esc'], section: 'Genel' },
    { label: 'Tümünü Seç (Metin İçinde)', keys: ['Cmd/Ctrl', 'A'], section: 'Genel' },
];

function formatShortcutKeys(keys) {
    return keys.map((key, index) => {
        const join = index < keys.length - 1 ? `<span class="shortcut-join">+</span>` : '';
        return `<span class="shortcut-key">${key}</span>${join}`;
    }).join('');
}

function getShortcutSections() {
    const toolShortcuts = allTools
        .filter(tool => tool.shortcut)
        .map(tool => ({
            label: tool.label,
            keys: [tool.shortcut.toUpperCase()],
            section: 'Araclar'
        }));

    const deduped = [];
    const seen = new Set();

    [...STATIC_SHORTCUTS, ...toolShortcuts].forEach(item => {
        const signature = `${item.section}:${item.label}:${item.keys.join('+')}`;
        if (seen.has(signature)) return;
        seen.add(signature);
        deduped.push(item);
    });

    const sectionOrder = ['Genel', 'Araclar'];

    return sectionOrder.map(section => ({
        title: section,
        items: deduped.filter(item => item.section === section)
    })).filter(section => section.items.length);
}

function renderShortcutsModal() {
    if (!shortcutsModalBody) return;

    const sections = getShortcutSections();
    shortcutsModalBody.innerHTML = sections.map(section => `
        <section class="shortcut-section">
            <div class="shortcut-section-title">${section.title}</div>
            <div class="shortcut-list">
                ${section.items.map(item => `
                    <div class="shortcut-item">
                        <div class="shortcut-label">${item.label}</div>
                        <div class="shortcut-keys">${formatShortcutKeys(item.keys)}</div>
                    </div>
                `).join('')}
            </div>
        </section>
    `).join('');
}

function openShortcutsModal() {
    renderShortcutsModal();
    shortcutsModal?.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeFileMenu();
}

function closeShortcutsModal() {
    shortcutsModal?.setAttribute('hidden', '');
    document.body.style.overflow = '';
}
