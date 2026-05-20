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
        setStatus('⚠️ Open a claude chat first', 'error');
        btnExport.disabled = true;
    } else {
        setStatus('✅ Chat detected - ready to export', 'success');
        btnExport.disabled = false;
    }
});

btnExport.addEventListener('click', () => {
    btnExport.disabled = true;
    setStatus('⏳ Exporting...', 'loading');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'export' }, (response) => {
            if (chrome.runtime.lastError) {
                setStatus('❌ Connection error, must reload', 'error');
                btnExport.disabled = false;
                return;
            }

            if (response?.success) {
                if (response.format === 'zip') {
                    setStatus(`✅ "${response.title}" exported with ${response.images} image(s)`);
                } else {
                    setStatus(`✅ "${response.title}" exported (.md)`, 'success');
                }
            } else {
                setStatus(`❌ ${response?.error || 'Unknown error'}`, 'error');
            }

            btnExport.disabled = false;
        });
    });
});
