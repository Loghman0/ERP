/* ========== AI CHAT FAB (hər iki rol) ========== */
let aiChatHistory = [];
function initAIChatFAB() {
  if ($('aiChatFab')) return;
  const fab = document.createElement('div');
  fab.id = 'aiChatFab';
  fab.innerHTML = `
    <button id="aiChatToggle" class="fixed bottom-5 right-5 z-[200] w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-600 shadow-2xl flex items-center justify-center text-white text-xl hover:scale-110 transition" title="AI Köməkçi">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
    </button>
    <div id="aiChatPanel" class="hidden fixed bottom-24 right-5 z-[200] w-[92vw] sm:w-[420px] h-[70vh] sm:h-[560px] glass rounded-3xl border border-purple-500/30 flex flex-col overflow-hidden shadow-2xl">
      <div class="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-purple-600/20 to-fuchsia-600/20">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-wand-magic-sparkles text-purple-300"></i>
          <div>
            <p class="text-sm font-black text-white">AI Köməkçi</p>
            <p class="text-[10px] text-slate-400" id="aiChatScope"></p>
          </div>
        </div>
        <div class="flex gap-1">
          <button onclick="aiChatHistory=[];document.getElementById('aiChatMsgs').innerHTML='';" class="text-slate-400 hover:text-white w-8 h-8 rounded-lg hover:bg-white/10" title="Təmizlə"><i class="fa-solid fa-trash text-xs"></i></button>
          <button id="aiChatClose" class="text-slate-400 hover:text-white w-8 h-8 rounded-lg hover:bg-white/10"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div id="aiChatMsgs" class="flex-1 overflow-y-auto p-4 space-y-3"></div>
      <form id="aiChatForm" class="p-3 border-t border-white/5 flex gap-2">
        <input id="aiChatInput" type="text" placeholder="Sual yazın..." class="input-style flex-1" autocomplete="off" />
        <button type="submit" class="px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black"><i class="fa-solid fa-paper-plane"></i></button>
      </form>
    </div>`;
  document.body.appendChild(fab);
  const isAdmin = state.profile.role === 'admin';
  $('aiChatScope').textContent = isAdmin ? 'Tam çıxış (Admin)' : BRANCH_LABEL[state.profile.branch] + ' filialı';
  $('aiChatToggle').onclick = () => { $('aiChatPanel').classList.toggle('hidden'); $('aiChatInput')?.focus(); if ($('aiChatMsgs').children.length === 0) aiChatWelcome(); };
  $('aiChatClose').onclick = () => $('aiChatPanel').classList.add('hidden');
  $('aiChatForm').onsubmit = aiChatSubmit;
}

function aiChatWelcome() {
  const isAdmin = state.profile.role === 'admin';
  const examples = isAdmin
    ? ['"Bu ay ən çox gəlir gətirən müəllim kimdir?"', '"Filialların müqayisəsini göstər"', '"Ən çox borcu olan şagirdlər"']
    : ['"Bu filialda neçə şagird var?"', '"Bu ay neçə yeni qeydiyyat olub?"', '"Borclu şagirdləri göstər"'];
  aiChatAdd('ai', `Salam! Mən sizin AI köməkçinizəm.\n\n**Nümunələr:**\n${examples.map(e => '- ' + e).join('\n')}`);
}

function aiChatAdd(who, text) {
  const msgs = $('aiChatMsgs');
  const wrap = document.createElement('div');
  wrap.className = 'flex ' + (who === 'user' ? 'justify-end' : 'justify-start');
  wrap.innerHTML = who === 'user'
    ? `<div class="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white text-sm">${text.replace(/[<>]/g, c => ({ '<': '&lt;', '>': '&gt;' }[c]))}</div>`
    : `<div class="max-w-[90%] px-3 py-2 rounded-2xl rounded-tl-sm bg-white/5 border border-white/10">${typeof text === 'string' && text.startsWith('<') ? text : renderMD(text)}</div>`;
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
  return wrap;
}

async function aiChatSubmit(e) {
  e.preventDefault();
  const input = $('aiChatInput');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  aiChatAdd('user', q);
  aiChatHistory.push({ role: 'user', text: q });
  // Mövzudan kənar sualların offline filtri (kvota israfının qarşısını alır)
  if (window.MERAM_PROMPTS && MERAM_PROMPTS.isOffTopic(q)) {
    aiChatAdd('ai', MERAM_PROMPTS.REFUSAL);
    return;
  }
  const thinking = aiChatAdd('ai', `<div class="flex items-center gap-2 text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin"></i> Düşünür...</div>`);
  try {
    const ctx = buildAIContext('chat');
    const sys = MERAM_PROMPTS.chatSystem(state.profile);
    const history = aiChatHistory.slice(-6).map(m => `${m.role === 'user' ? 'İstifadəçi' : 'AI'}: ${m.text}`).join('\n');
    const prompt = `KONTEKST:\n${JSON.stringify(ctx, null, 2)}\n\nDİALOQ TARİXÇƏSİ:\n${history}\n\nYeni sual: ${q}`;
    const text = await callGemini(prompt, { systemInstruction: sys });
    thinking.querySelector('div').outerHTML = `<div class="max-w-[90%] px-3 py-2 rounded-2xl rounded-tl-sm bg-white/5 border border-white/10">${renderMD(text)}</div>`;
    aiChatHistory.push({ role: 'ai', text });
  } catch (err) {
    thinking.querySelector('div').outerHTML = `<div class="max-w-[90%] px-3 py-2 rounded-2xl rounded-tl-sm bg-red-500/10 border border-red-500/30 text-red-300 text-sm">${err.message}</div>`;
  }
}

/* ========== AI UI HELPERS ========== */
function aiPageHTML(title, icon, gradient, desc) {
  return `
    <div class="glass rounded-3xl p-6 mb-5">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center"><i class="fa-solid ${icon} text-white text-xl"></i></div>
        <div>
          <h3 class="text-xl font-black text-white">${title}</h3>
          <p class="text-xs text-slate-400">${desc}</p>
        </div>
      </div>
      <button id="aiRunBtn" class="w-full sm:w-auto py-3 px-6 rounded-2xl font-black text-white bg-gradient-to-r ${gradient}"><i class="fa-solid fa-wand-magic-sparkles mr-2"></i>Analiz et</button>
    </div>
    <div id="aiOutput" class="glass rounded-3xl p-6 min-h-[160px]"><p class="text-slate-500 text-sm text-center py-8"><i class="fa-solid fa-circle-info mr-2"></i>"Analiz et" düyməsini basın</p></div>`;
}
function aiLoadingHTML(msg) {
  return `<div class="flex flex-col items-center justify-center py-10 text-slate-400"><i class="fa-solid fa-spinner fa-spin text-3xl text-purple-400 mb-3"></i><p class="text-sm">${msg}</p></div>`;
}
function aiErrorHTML(msg) {
  return `<div class="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm"><i class="fa-solid fa-triangle-exclamation mr-2"></i>${escapeHtml(msg)}</div>`;
}
