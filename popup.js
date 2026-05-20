const btnExport = document.getElementById('btnExport');
const status = document.getElementById('status');

function setStatus(msg, type = '') {
    status.textContent = msg;
    status.className = type;
}

// Escuchar progreso del content script
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'progress') {
        setStatus(msg.status, 'loading');
    }
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    if (!url.includes('claude.ai/chat/')) {
        setStatus('⚠️ Abre un chat de Claude primero', 'error');
        btnExport.disabled = true;
    } else {
        setStatus('✅ Chat detected — ready to export', 'success');
        btnExport.disabled = false;
    }
});

btnExport.addEventListener('click', () => {
    btnExport.disabled = true;
    setStatus('⏳ Exportando...', 'loading');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'export' }, (response) => {
            if (chrome.runtime.lastError) {
                setStatus('❌ Error de conexión. Recarga la página.', 'error');
                btnExport.disabled = false;
                return;
            }

            if (response?.success) {
                if (response.format === 'zip') {
                    setStatus(`✅ "${response.title}" exportado con ${response.images} imagen(es)`, 'success');
                } else {
                    setStatus(`✅ "${response.title}" exportado (.md)`, 'success');
                }
            } else {
                setStatus(`❌ ${response?.error || 'Error desconocido'}`, 'error');
            }

            btnExport.disabled = false;
        });
    });
});
