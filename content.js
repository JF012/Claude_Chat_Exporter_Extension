async function fetchImageAsBlob(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        return { blob, ext, type: blob.type };
    } catch {
        return null;
    }
}

async function exportChat(progressCallback) {
    const chatId = window.location.pathname.split('/chat/')[1];
    if (!chatId) {
        return { success: false, error: 'No estás en un chat de Claude.' };
    }

    try {
        progressCallback?.('Obteniendo datos del chat...');
        const orgs = await fetch('/api/organizations').then(r => r.json());
        const orgId = orgs[0].uuid;

        const chat = await fetch(
            `/api/organizations/${orgId}/chat_conversations/${chatId}?rendering_mode=raw`
        ).then(r => r.json());

        const safeName = (chat.name || chatId).replace(/[<>:"/\\|?*]/g, '_');
        const zip = new JSZip();
        const assetsFolder = zip.folder('assets');
        let imageCount = 0;
        let md = '';

        // --- Frontmatter YAML para Obsidian ---
        md += `---\n`;
        md += `title: "${(chat.name || 'Sin título').replace(/"/g, '\\"')}"\n`;
        md += `date: ${new Date(chat.created_at).toISOString().split('T')[0]}\n`;
        md += `model: ${chat.model || 'unknown'}\n`;
        md += `source: claude.ai\n`;
        md += `chat_id: ${chatId}\n`;
        md += `tags:\n  - claude\n  - ai-chat\n`;
        md += `---\n\n`;

        md += `# ${chat.name || 'Sin título'}\n\n`;
        md += `> 📅 ${new Date(chat.created_at).toLocaleDateString()} | 💬 ${(chat.chat_messages || []).length} mensajes | 🧠 ${chat.model || ''}\n\n---\n\n`;

        const messages = chat.chat_messages || [];
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const role = msg.sender === 'human' ? '🧑 Yo' : '🤖 Claude';

            progressCallback?.(`Procesando mensaje ${i + 1}/${messages.length}...`);

            // --- El contenido principal está en msg.text ---
            let text = msg.text || '';

            // Marcar si el mensaje fue truncado por la API
            if (msg.truncated) {
                text += '\n\n> ⚠️ *Este mensaje fue truncado por la API de Claude*\n';
            }

            // --- Imágenes subidas (files) ---
            if (msg.files?.length > 0) {
                for (const file of msg.files) {
                    if (file.file_kind === 'image') {
                        imageCount++;
                        const fileName = file.file_name || `imagen_${String(imageCount).padStart(3, '0')}`;
                        const previewUrl = `/api/organizations/${orgId}/files/${file.file_uuid || file.uuid}/preview`;

                        progressCallback?.(`Descargando imagen ${imageCount}: ${fileName}...`);
                        const img = await fetchImageAsBlob(previewUrl);

                        if (img) {
                            const finalName = fileName.includes('.') ? fileName : `${fileName}.${img.ext}`;
                            assetsFolder.file(finalName, img.blob);
                            text += `\n\n![${fileName}](assets/${finalName})\n`;
                        } else {
                            text += `\n\n> 🖼️ Imagen: **${fileName}** (no se pudo descargar)\n`;
                        }
                    } else {
                        // Archivos no-imagen (zip, pdf, etc.)
                        text += `\n\n> 📎 Archivo: **${file.file_name}** (${(file.size_bytes / 1024).toFixed(1)} KB)\n`;
                    }
                }
            }

            // --- Archivos adjuntos con contenido extraído ---
            if (msg.attachments?.length > 0) {
                for (const att of msg.attachments) {
                    if (att.extracted_content) {
                        const preview = att.extracted_content.length > 2000
                            ? att.extracted_content.slice(0, 2000) + '\n... (contenido truncado)'
                            : att.extracted_content;
                        text += `\n\n<details>\n<summary>📎 ${att.file_name}</summary>\n\n\`\`\`\n${preview}\n\`\`\`\n</details>\n`;
                    } else {
                        text += `\n\n> 📎 Archivo adjunto: **${att.file_name}**\n`;
                    }
                }
            }

            if (!text.trim()) continue;
            md += `## ${role}\n\n${text}\n\n---\n\n`;
        }

        zip.file(`${safeName}.md`, md);

        // --- Si no hay imágenes, descargar solo el .md ---
        if (imageCount === 0) {
            const blob = new Blob([md], { type: 'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${safeName}.md`;
            a.click();
            return { success: true, title: chat.name || chatId, format: 'md', images: 0 };
        }

        // --- Con imágenes, descargar como .zip ---
        progressCallback?.(`Empaquetando ${imageCount} imagen(es) en ZIP...`);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${safeName}.zip`;
        a.click();

        return {
            success: true,
            title: chat.name || chatId,
            format: 'zip',
            images: imageCount
        };

    } catch (e) {
        return { success: false, error: e.message };
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'export') {
        exportChat((status) => {
            chrome.runtime.sendMessage({ action: 'progress', status }).catch(() => {});
        }).then(sendResponse);
        return true;
    }
});
