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

function extractText(content) {
    let text = '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        for (const block of content) {
            if (block.type === 'text') {
                text += block.text + '\n';
            } else if (block.type === 'tool_result') {
                const c = Array.isArray(block.content)
                    ? block.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
                    : block.content || '';
                text += `\n> 🔧 Resultado de herramienta:\n> ${c}\n`;
            } else if (block.type === 'document') {
                text += `\n> 📎 Archivo adjunto: **${block.name || 'archivo'}**\n`;
            }
        }
    } else if (content?.text) {
        text = content.text;
    }
    return text.trim();
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
        md += `source: claude.ai\n`;
        md += `chat_id: ${chatId}\n`;
        md += `tags:\n  - claude\n  - ai-chat\n`;
        md += `---\n\n`;

        md += `# ${chat.name || 'Sin título'}\n\n`;
        md += `> 📅 ${new Date(chat.created_at).toLocaleDateString()} | 💬 ${(chat.chat_messages || []).length} mensajes\n\n---\n\n`;

        const messages = chat.chat_messages || [];
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const role = msg.sender === 'human' ? '🧑 Yo' : '🤖 Claude';
            let text = extractText(msg.content);

            progressCallback?.(`Procesando mensaje ${i + 1}/${messages.length}...`);

            // --- Imágenes subidas (files) ---
            if (msg.files?.length > 0) {
                for (const file of msg.files) {
                    if (file.file_kind === 'image') {
                        imageCount++;
                        const fileName = file.file_name || `imagen_${String(imageCount).padStart(3, '0')}`;
                        const previewUrl = `/api/${orgId}/files/${file.uuid}/preview`;

                        progressCallback?.(`Descargando imagen ${imageCount}: ${fileName}...`);
                        const img = await fetchImageAsBlob(previewUrl);

                        if (img) {
                            const finalName = fileName.includes('.') ? fileName : `${fileName}.${img.ext}`;
                            assetsFolder.file(finalName, img.blob);
                            text += `\n\n![${fileName}](assets/${finalName})\n`;
                        } else {
                            text += `\n\n> 🖼️ Imagen: **${fileName}** (no se pudo descargar)\n`;
                        }
                    }
                }
            }

            // --- Imágenes inline en content (base64 de Claude) ---
            if (Array.isArray(msg.content)) {
                for (const block of msg.content) {
                    if (block.type === 'image') {
                        imageCount++;
                        const ext = (block.media_type || block.source?.media_type || 'image/png')
                            .split('/')[1]?.replace('jpeg', 'jpg') || 'png';
                        const imgName = `inline_${String(imageCount).padStart(3, '0')}.${ext}`;

                        const b64Data = block.data || block.source?.data;
                        if (b64Data) {
                            // Convertir base64 a blob
                            const binary = atob(b64Data);
                            const bytes = new Uint8Array(binary.length);
                            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                            assetsFolder.file(imgName, bytes);
                            text += `\n\n![imagen](assets/${imgName})\n`;
                        }
                    }
                }
            }

            // --- Archivos adjuntos ---
            if (msg.attachments?.length > 0) {
                for (const att of msg.attachments) {
                    if (att.extracted_content) {
                        text += `\n\n> 📎 **${att.file_name}**\n\n\`\`\`\n${att.extracted_content}\n\`\`\`\n`;
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
            // Enviar progreso al popup (best effort)
            chrome.runtime.sendMessage({ action: 'progress', status }).catch(() => {});
        }).then(sendResponse);
        return true; // mantener canal abierto para async
    }
});
