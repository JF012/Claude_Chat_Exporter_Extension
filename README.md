# 🔮 Claude Web → Chat Exporter Extension

**Your Claude chats, straight to Obsidian.**

A lightweight browser extension that exports any Claude.ai conversation into a clean Markdown file ready for your Obsidian vault. One click, one chat, done. Images included.

---

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Claude](https://img.shields.io/badge/Claude.ai-CC785C?style=for-the-badge&logo=anthropic&logoColor=white)
![Obsidian](https://img.shields.io/badge/Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white)
![Edge](https://img.shields.io/badge/Edge-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white)
![Chrome](https://img.shields.io/badge/Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)

---

## ✨ Features

### ⚡ One-Click Export
- **Single Chat Download** — Export the exact conversation you're viewing, not the entire account
- **Smart Format** — Generates `.md` for text-only chats, `.zip` when images are present
- **Obsidian-Ready** — YAML frontmatter, proper headings, and relative image paths out of the box

### 🖼️ Full Media Support
- **Uploaded Images** — Downloads and packages images from Claude's API as separate files
- **File Attachments** — Preserves attached documents with extracted content in collapsible sections
- **Non-Image Files** — References ZIPs, PDFs, and other uploads with name and size

### 🔒 Privacy First
- **100% Local** — No external servers, no telemetry, no analytics
- **Minimal Permissions** — Only `activeTab` and `scripting`, scoped to `claude.ai`
- **No API Keys** — Uses your existing browser session, nothing stored

---

## 🏗️ Architecture

```
├── manifest.json      # Extension config (Manifest V3)
├── content.js         # Core logic — API calls, parsing, ZIP generation
├── popup.html         # Extension popup UI
├── popup.js           # Popup interaction handler
├── jszip.min.js       # ZIP packaging library
└── Icon.png           # Extension icon
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|:-----------|:--------|
| **JavaScript ES2020** | Core language |
| **Manifest V3** | Chrome/Edge extension framework |
| **Claude.ai Internal API** | Conversation data retrieval |
| **JSZip** | Client-side ZIP generation for image bundling |
| **YAML Frontmatter** | Obsidian metadata integration |

---

## 🚀 Getting Started

### Prerequisites
- Chromium-based browser (Edge, Chrome, Brave, Arc)
- An active Claude.ai session

### Installation

```bash
# Clone the repository
git clone https://github.com/JF012/Claude_Chat_Exporter_Extension.git

# Navigate to the project
cd Claude_Chat_Exporter_Extension
```

| Step | Action |
|:----:|:-------|
| 1 | Open `edge://extensions` or `chrome://extensions` |
| 2 | Enable **Developer mode** (toggle in top-right) |
| 3 | Click **Load unpacked** |
| 4 | Select the `Extension` folder from the cloned repo |

---

## 📱 Usage

| Step | Action |
|:----:|:-------|
| 1 | Navigate to any chat on `claude.ai` |
| 2 | Click the extension icon in your toolbar |
| 3 | Hit **⬇️ Export this chat** |
| 4 | Receive your `.md` or `.zip` file |

### Output Structure

**Text-only chats** → Single `.md` file

**Chats with images** → `.zip` containing:
```
My Chat/
├── My Chat.md
└── assets/
    ├── image_001.png
    ├── image_002.jpg
    └── ...
```

Drop the output into your Obsidian vault and everything renders natively.

---

## 🔧 How It Works

| Step | Detail |
|:-----|:-------|
| Detection | Extension detects when you're on a `claude.ai/chat/*` URL |
| Fetch | Calls Claude's internal API to retrieve the full conversation JSON |
| Parse | Extracts messages from `chat_messages`, resolving text, images, and attachments |
| Download | Fetches uploaded images from Claude's file preview endpoint |
| Package | Generates Markdown with YAML frontmatter and bundles assets into a ZIP if needed |
| Deliver | Triggers a browser download — ready to drop into Obsidian |

---

## ⚠️ Disclaimer

This extension uses Claude.ai's internal API endpoints, which are undocumented and may change without notice. It is not affiliated with or endorsed by Anthropic. Use at your own discretion.

---

## 📄 License

This project is open source and available for educational and portfolio purposes.

---

<p align="center">
  Made with JavaScript ⚡ by <a href="https://github.com/JF012">JF012</a>
</p>
