# ⬡ DocCraft — AI Documentation Agent

A free, browser-based documentation generator. Upload any files — scripts, images, PDFs, configs — and get back a fully structured guide with numbered steps, callouts, image placeholders, and a checklist.

No account needed to use the app. You just need a free Groq API key.

---

## 🔑 Getting Your Free API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up for free — no credit card required
3. Click **API Keys** in the left sidebar
4. Click **Create API Key**, give it a name, and copy it
5. Open `app.js` in any text editor and replace line 3:

```js
const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE";
```

with your actual key:

```js
const GROQ_API_KEY = "gsk_xxxxxxxxxxxxxxxxxxxxxxxx";
```

6. Save the file and you're good to go.

---

## 🚀 Running Locally

1. Download or clone this repo
2. Add your Groq key to `app.js` as above
3. Double-click `start.bat` — it opens the app automatically in your browser

---

## 🌐 Deploying to GitHub Pages

1. Push all files to a GitHub repo
2. Go to **Settings → Pages**
3. Set source to `main` branch, root `/`
4. Your app will be live at `https://yourusername.github.io/your-repo-name`

> ⚠️ If you deploy to GitHub, do not commit your real API key. Put `YOUR_GROQ_API_KEY_HERE` back as the placeholder before pushing. Each user adds their own key locally.

---

## 📁 Supported File Types

| Type | Handling |
|------|----------|
| `.js .ts .py .sh .go .rb` etc. | Read as text |
| `.md .txt .json .yaml .env` | Read as text |
| `.png .jpg .gif .webp` | Referenced by name |
| `.pdf` | Referenced by name |
| Binary files | Skipped |

---

## 📄 Output Includes

- Numbered sections with clear headings
- Step-by-step callouts
- Tip / Warning / Danger callouts
- Image placeholder boxes with captions
- Code blocks
- Interactive checklist at the end

Download as `.md` or copy raw Markdown.

---

## License

MIT — use it, fork it, build on it.
