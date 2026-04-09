
const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE";

const state = { files: [], rawOutput: '', imageMap: {} };
const $ = id => document.getElementById(id);

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function getExt(name) { const p = name.split('.'); return p.length > 1 ? p.pop().toLowerCase() : 'file'; }
function isImage(n) { return /\.(png|jpg|jpeg|gif|webp)$/i.test(n); }
function isPDF(n)   { return /\.pdf$/i.test(n); }
function isBinary(n){ return /\.(zip|exe|dmg|bin|db|sqlite|woff|woff2|ttf|otf|ico|mp4|mp3|mov)$/i.test(n); }

const dropZone = $('drop-zone');
const fileInput = $('file-input');
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFiles(Array.from(e.dataTransfer.files)); });
fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));

function handleFiles(files) {
  files.forEach(f => {
    if (!state.files.find(x => x.name === f.name && x.size === f.size)) {
      state.files.push(f);
      if (isImage(f.name)) {
        const r = new FileReader();
        r.onload = e => { state.imageMap[f.name] = e.target.result; };
        r.readAsDataURL(f);
      }
    }
  });
  renderFileList();
}

function renderFileList() {
  const list = $('file-list');
  list.innerHTML = '';
  state.files.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<div class="file-info"><span class="file-ext">${getExt(file.name)}</span><span class="file-name">${file.name}</span></div><div class="file-right"><span class="file-size">${formatBytes(file.size)}</span><button class="file-remove" data-i="${i}">×</button></div>`;
    list.appendChild(item);
  });
  list.querySelectorAll('.file-remove').forEach(btn => btn.addEventListener('click', () => { state.files.splice(parseInt(btn.dataset.i),1); renderFileList(); }));
}

function sanitizeText(str) {
  return str.replace(/\0/g, '').replace(/[^\x09\x0A\x0D\x20-\x7E\x80-\uFFFF]/g, '');
}
const readText = f => new Promise((res,rej) => { const r=new FileReader(); r.onload=e=>res(sanitizeText(e.target.result)); r.onerror=rej; r.readAsText(f, 'UTF-8'); });

async function buildFileContent() {
  const parts = [];
  for (const file of state.files) {
    if (isBinary(file.name)) { parts.push(`[Binary skipped: ${file.name}]`); continue; }
    if (isImage(file.name))  { parts.push(`[Image file: ${file.name}]`); continue; }
    if (isPDF(file.name))    { parts.push(`[PDF file: ${file.name}]`); continue; }
    try {
      let text = await readText(file);
      const printableRatio = (text.match(/[\x20-\x7E\n\r\t]/g) || []).length / (text.length || 1);
      if (printableRatio < 0.7) { parts.push(`[Skipped: ${file.name} — corrupted or unsupported encoding. Re-save as UTF-8.]`); continue; }
      if (text.length > 40000) text = text.slice(0,40000) + '\n[truncated]';
      parts.push(`--- FILE: ${file.name} ---\n${text}\n--- END: ${file.name} ---`);
    } catch { parts.push(`[Could not read: ${file.name}]`); }
  }
  return parts.join('\n\n');
}

function buildPrompt(fileContent) {
  const title    = $('doc-title').value.trim() || 'Project Documentation';
  const audience = {developer:'software developers',enduser:'non-technical end users',admin:'system administrators',mixed:'a general mixed audience'}[$('doc-audience').value];
  const docType  = {guide:'a practical how-to guide',reference:'a technical reference manual',quickstart:'a quick start guide',readme:'a README document',api:'API documentation'}[$('doc-type').value];
  const extra    = $('doc-extra').value.trim();
  const useSteps   = $('tog-steps').checked;
  const useTips    = $('tog-tips').checked;
  const useCheck   = $('tog-checklist').checked;
  const useImages  = $('tog-images').checked;
  const useCode    = $('tog-code').checked;

  return `You are a technical documentation writer. Analyze the files below and generate ${docType} titled "${title}".
AUDIENCE: ${audience}
${extra ? 'EXTRA: ' + extra : ''}

FILES:
${fileContent}

OUTPUT FORMAT:
1. Start with: # ${title}
2. Short overview paragraph.
3. Numbered sections: ## 1. Section Name
${useSteps   ? '\nUse for steps: <STEP n="1">description</STEP>' : ''}
${useTips    ? '\nUse for tips: <TIP>text</TIP>\nUse for warnings: <WARNING>text</WARNING>\nUse for dangers: <DANGER>text</DANGER>' : ''}
${useImages  ? '\nUse for screenshots: <IMAGE caption="description" />' : ''}
${useCode    ? '\nUse triple backtick code blocks with language.' : ''}
${useCheck   ? '\nEnd with: ## ✓ Checklist\n<CHECK>item</CHECK>' : ''}

Write simply, clearly, and specifically about what is in the files. No jargon.`;
}

function setProgress(pct, msg) {
  $('progress-fill').style.width = pct + '%';
  $('progress-msg').textContent = msg;
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" style="color:var(--accent);text-decoration:underline" target="_blank">$1</a>');
}

function renderDoc(raw) {
  let html = '<div class="rendered-doc">';
  const lines = raw.split('\n');
  let i=0, inCode=false, codeLines=[], codeLang='', inCheck=false;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (!inCode) { inCode=true; codeLang=line.slice(3).trim(); codeLines=[]; i++; continue; }
      else { inCode=false; html+=`<pre><code>${esc(codeLines.join('\n'))}</code></pre>`; i++; continue; }
    }
    if (inCode) { codeLines.push(line); i++; continue; }
    const step   = line.match(/^<STEP n="(\d+)">(.*?)<\/STEP>/);
    const tip    = line.match(/^<TIP>(.*?)<\/TIP>/);
    const warn   = line.match(/^<WARNING>(.*?)<\/WARNING>/);
    const danger = line.match(/^<DANGER>(.*?)<\/DANGER>/);
    const img    = line.match(/^<IMAGE caption="(.*?)" \/>/);
    const check  = line.match(/^<CHECK>(.*?)<\/CHECK>/);
    if (step)   { html+=`<div class="step-callout"><div class="step-num">${step[1]}</div><div class="step-text">${inline(step[2])}</div></div>`; i++; continue; }
    if (tip)    { html+=`<div class="callout callout-tip"><span class="callout-icon">💡</span><div class="callout-body"><strong>Tip</strong>${inline(tip[1])}</div></div>`; i++; continue; }
    if (warn)   { html+=`<div class="callout callout-warning"><span class="callout-icon">⚠️</span><div class="callout-body"><strong>Warning</strong>${inline(warn[1])}</div></div>`; i++; continue; }
    if (danger) { html+=`<div class="callout callout-danger"><span class="callout-icon">🚫</span><div class="callout-body"><strong>Danger</strong>${inline(danger[1])}</div></div>`; i++; continue; }
    if (img) {
      const caption = img[1];
      const matchedKey = Object.keys(state.imageMap).find(k => k.toLowerCase().includes(caption.toLowerCase().split(' ')[0]));
      const imgSrc = matchedKey ? state.imageMap[matchedKey] : Object.values(state.imageMap)[0] || null;
      if (imgSrc) {
        html+=`<div class="img-real"><img src="${imgSrc}" alt="${esc(caption)}" style="max-width:100%;border-radius:8px;margin:12px 0;display:block;"/><div class="img-placeholder-caption" style="text-align:center;font-size:13px;color:var(--text2);margin-top:4px">${esc(caption)}</div></div>`;
      } else {
        html+=`<div class="img-placeholder"><div class="img-placeholder-icon">🖼</div><div class="img-placeholder-label">[ Screenshot / Diagram ]</div><div class="img-placeholder-caption">${esc(caption)}</div></div>`;
      }
      i++; continue;
    }
    if (check) {
      if (!inCheck) { html+='<ul class="checklist">'; inCheck=true; }
      html+=`<li onclick="this.classList.toggle('done');this.querySelector('.checklist-box').classList.toggle('checked')"><div class="checklist-box"></div>${inline(check[1])}</li>`;
      if (!lines[i+1]?.match(/^<CHECK>/)) { html+='</ul>'; inCheck=false; }
      i++; continue;
    }
    if (line.startsWith('# '))  { html+=`<h1>${inline(line.slice(2))}</h1>`;  i++; continue; }
    if (line.startsWith('## ')) { html+=`<h2>${inline(line.slice(3))}</h2>`;  i++; continue; }
    if (line.startsWith('### ')){ html+=`<h3>${inline(line.slice(4))}</h3>`;  i++; continue; }
    if (line.match(/^[-*] /))   { html+=`<p style="padding-left:16px;color:var(--text2)">· ${inline(line.slice(2))}</p>`; i++; continue; }
    if (line.trim()) { html+=`<p>${inline(line)}</p>`; }
    else { html+='<div style="height:6px"></div>'; }
    i++;
  }
  return html + '</div>';
}

$('btn-generate').addEventListener('click', async () => {
  if (state.files.length === 0) { alert('Please upload at least one file first.'); return; }

  const btn = $('btn-generate');
  btn.disabled = true;
  $('btn-label').textContent = 'Working…';
  $('progress-area').style.display = 'block';
  $('card-output').style.display = 'none';

  try {
    setProgress(10, 'Reading your files…');
    const fileContent = await buildFileContent();

    setProgress(40, 'Sending to Groq…');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: buildPrompt(fileContent) }],
        max_tokens: 4096,
        temperature: 0.4
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Request failed: ' + response.status);

    setProgress(85, 'Formatting your document…');
    const raw = data.choices?.[0]?.message?.content || '';
    if (!raw) throw new Error('No content returned. Please try again.');

    state.rawOutput = raw;
    setProgress(100, 'Done!');
    $('doc-preview').innerHTML = renderDoc(raw);
    $('card-output').style.display = 'block';
    setTimeout(() => $('card-output').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  } catch (err) {
    setProgress(0, '');
    $('progress-area').style.display = 'none';
    alert('Error: ' + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
    $('btn-label').textContent = 'Generate Documentation';
  }
});

$('btn-copy').addEventListener('click', () => {
  const previewHtml = $('doc-preview').innerHTML;

  // Build a self-contained HTML blob so paste into Word/Notion/Docs preserves layout
  const fullHtml = `
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #1a1a1a; max-width: 780px; padding: 32px; }
  h1 { font-size: 26px; font-weight: 900; border-bottom: 2px solid #0a0a0a; padding-bottom: 10px; margin-bottom: 18px; }
  h2 { font-size: 18px; font-weight: 800; margin: 26px 0 10px; }
  h3 { font-size: 15px; font-weight: 700; margin: 16px 0 6px; }
  p  { margin-bottom: 9px; }
  pre { background:#f4f4f4; border:1px solid #ddd; border-left:3px solid #999; border-radius:5px; padding:12px 14px; font-family:monospace; font-size:12px; white-space:pre-wrap; word-break:break-all; margin:10px 0; }
  code { font-family:monospace; font-size:12px; color:#c0392b; background:#fdf0f0; padding:1px 4px; border-radius:3px; }
  pre code { color:inherit; background:none; padding:0; }
  .step-callout { display:flex; gap:10px; align-items:flex-start; margin:9px 0; padding:10px 14px; background:#f2f2f2; border-radius:6px; border-left:3px solid #0a0a0a; }
  .step-num { font-size:11px; font-weight:900; background:#0a0a0a; color:#fff; border-radius:50%; min-width:22px; height:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .callout { display:flex; gap:9px; padding:10px 14px; border-radius:6px; margin:9px 0; }
  .callout-tip     { background:#e8f8f4; border-left:3px solid #2ecc71; color:#0d3d2e; }
  .callout-warning { background:#fffbeb; border-left:3px solid #f59e0b; color:#3d2e00; }
  .callout-danger  { background:#fef2f2; border-left:3px solid #e74c3c; color:#3d0000; }
  .callout-icon { font-size:14px; flex-shrink:0; }
  .callout-body strong { display:block; font-weight:700; margin-bottom:2px; }
  .img-placeholder { background:#f7f7f7; border:2px dashed #ccc; border-radius:6px; padding:22px; text-align:center; margin:10px 0; color:#888; }
  .img-real img { max-width:100%; border-radius:6px; display:block; margin:10px auto; }
  .img-placeholder-caption { font-style:italic; font-size:12px; margin-top:4px; }
  .checklist { list-style:none; padding:0; margin:10px 0; }
  .checklist li { display:flex; gap:9px; padding:7px 10px; border-bottom:1px solid #eee; align-items:flex-start; }
  .checklist-box { width:14px; height:14px; border:2px solid #0a0a0a; border-radius:3px; flex-shrink:0; margin-top:3px; }
</style>
</head>
<body>${previewHtml}</body>
</html>`;

  try {
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const plainBlob = new Blob([state.rawOutput], { type: 'text/plain' });
    const item = new ClipboardItem({ 'text/html': blob, 'text/plain': plainBlob });
    navigator.clipboard.write([item]).then(() => {
      $('btn-copy').textContent = 'Copied!';
      setTimeout(() => $('btn-copy').textContent = 'Copy Markdown', 2000);
    });
  } catch {
    // Fallback to plain text if ClipboardItem not supported
    navigator.clipboard.writeText(state.rawOutput).then(() => {
      $('btn-copy').textContent = 'Copied (plain text)';
      setTimeout(() => $('btn-copy').textContent = 'Copy Markdown', 2000);
    });
  }
});

$('btn-download').addEventListener('click', () => {
  const title = $('doc-title').value.trim() || 'documentation';
  const filename = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([state.rawOutput], { type: 'text/markdown' }));
  a.download = filename;
  a.click();
});
