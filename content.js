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
        return { success: false, error: 'Not on a Claude chat.' };
    }

    try {
        progressCallback?.('Fetching chat data...');
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

        // --- YAML Frontmatter for Obsidian ---
        md += `---\n`;
        md += `title: "${(chat.name || 'Untitled').replace(/"/g, '\\"')}"\n`;
        md += `date: ${new Date(chat.created_at).toISOString().split('T')[0]}\n`;
        md += `model: ${chat.model || 'unknown'}\n`;
        md += `source: claude.ai\n`;
        md += `chat_id: ${chatId}\n`;
        md += `tags:\n  - claude\n  - ai-chat\n`;
        md += `---\n\n`;

        md += `# ${chat.name || 'Untitled'}\n\n`;
        md += `> 📅 ${new Date(chat.created_at).toLocaleDateString()} | 💬 ${(chat.chat_messages || []).length} messages | 🧠 ${chat.model || ''}\n\n---\n\n`;

        const messages = chat.chat_messages || [];
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const role = msg.sender === 'human' ? '🧑 Me' : '🤖 Claude';

            progressCallback?.(`Processing message ${i + 1}/${messages.length}...`);

            // --- Main content is in msg.text ---
            let text = msg.text || '';

            // Flag if message was truncated by the API
            if (msg.truncated) {
                text += '\n\n> ⚠️ *This message was truncated by Claude API*\n';
            }

            // --- Uploaded images (files) ---
            if (msg.files?.length > 0) {
                for (const file of msg.files) {
                    if (file.file_kind === 'image') {
                        imageCount++;
                        const fileName = file.file_name || `image_${String(imageCount).padStart(3, '0')}`;
                        const previewUrl = `/api/organizations/${orgId}/files/${file.file_uuid || file.uuid}/preview`;

                        progressCallback?.(`Downloading image ${imageCount}: ${fileName}...`);
                        const img = await fetchImageAsBlob(previewUrl);

                        if (img) {
                            const finalName = fileName.includes('.') ? fileName : `${fileName}.${img.ext}`;
                            assetsFolder.file(finalName, img.blob);
                            text += `\n\n![${fileName}](assets/${finalName})\n`;
                        } else {
                            text += `\n\n> 🖼️ Image: **${fileName}** (failed to download)\n`;
                        }
                    } else {
                        // Non-image files (zip, pdf, etc.)
                        text += `\n\n> 📎 File: **${file.file_name}** (${(file.size_bytes / 1024).toFixed(1)} KB)\n`;
                    }
                }
            }

            // --- Attachments with extracted content ---
            if (msg.attachments?.length > 0) {
                for (const att of msg.attachments) {
                    if (att.extracted_content) {
                        const preview = att.extracted_content.length > 2000
                            ? att.extracted_content.slice(0, 2000) + '\n... (content truncated)'
                            : att.extracted_content;
                        text += `\n\n<details>\n<summary>📎 ${att.file_name}</summary>\n\n\`\`\`\n${preview}\n\`\`\`\n</details>\n`;
                    } else {
                        text += `\n\n> 📎 Attachment: **${att.file_name}**\n`;
                    }
                }
            }

            if (!text.trim()) continue;
            md += `## ${role}\n\n${text}\n\n---\n\n`;
        }

        zip.file(`${safeName}.md`, md);

        // --- No images: download .md only ---
        if (imageCount === 0) {
            const blob = new Blob([md], { type: 'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${safeName}.md`;
            a.click();
            return { success: true, title: chat.name || chatId, format: 'md', images: 0 };
        }

        // --- With images: download as .zip ---
        progressCallback?.(`Packaging ${imageCount} image(s) into ZIP...`);
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
            chrome.runtime.sendMessage({ action: 'progress', status }).catch(() => { });
        }).then(sendResponse);
        return true;
    }
});