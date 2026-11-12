/* ========== AI: MALIYYƏ ANALİZİ (admin) ========== */
async function renderAIFinance() {
  if (!can('ai')) { $('view-ai-finance').innerHTML = aiNoAccessHTML(); return; }
  const v = $('view-ai-finance');
  v.innerHTML = aiPageHTML('AI Maliyyə Analizi', 'fa-chart-line', 'from-emerald-600 to-blue-600',
    'Gemini gəlir, xərc, maaş və filial göstəricilərini analiz edərək hesabat yaradacaq.');
  $('aiRunBtn').onclick = async () => {
    const out = $('aiOutput');
    out.innerHTML = aiLoadingHTML('Maliyyə məlumatları analiz edilir...');
    try {
      const ctx = buildAIContext('finance');
      const prompt = `MALİYYƏ MƏLUMATLARI:\n${JSON.stringify(ctx, null, 2)}\n\nBu məlumatları təhlil et.`;
      const text = await callGemini(prompt, {
        systemInstruction: MERAM_PROMPTS.financeSystem(state.profile),
        cacheKey: 'fin-' + Object.keys(state.income || {}).length + '-' + Object.keys(state.expenses || {}).length,
      });
      out.innerHTML = renderMD(text);
    } catch (e) { out.innerHTML = aiErrorHTML(e.message); }
  };
}

/* ========== AI: ŞAGİRD HESABATI (admin) ========== */
async function renderAIStudents() {
  if (!can('ai')) { $('view-ai-students').innerHTML = aiNoAccessHTML(); return; }
  const v = $('view-ai-students');
  const ctx = buildAIContext('students');
  const opts = ctx.students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name || '')} — ${escapeHtml(BRANCH_LABEL[s.branch] || '')}</option>`).join('');
  v.innerHTML = `
    <div class="glass rounded-3xl p-6 mb-5">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center"><i class="fa-solid fa-user-graduate text-white text-xl"></i></div>
        <div>
          <h3 class="text-xl font-black text-white">AI Şagird Hesabatı</h3>
          <p class="text-xs text-slate-400">Akademik, maliyyə və imtahan məlumatlarına əsasən avtomatik hesabat</p>
        </div>
      </div>
      <div class="grid sm:grid-cols-3 gap-3">
        <select id="aiStudentPick" class="input-style sm:col-span-2"><option value="">— Bütün şagirdlər ümumi —</option>${opts}</select>
        <button id="aiRunBtn" class="py-3 px-4 rounded-2xl font-black text-white bg-gradient-to-r from-purple-600 to-fuchsia-600"><i class="fa-solid fa-wand-magic-sparkles mr-2"></i>Hesabat yarat</button>
      </div>
    </div>
    <div id="aiOutput" class="glass rounded-3xl p-6"></div>
    <div class="mt-4 flex gap-2 no-print">
      <button onclick="aiPrintReport()" class="btn-ghost"><i class="fa-solid fa-print mr-2"></i>Çap et / PDF</button>
    </div>`;
  $('aiRunBtn').onclick = async () => {
    const out = $('aiOutput');
    const sid = $('aiStudentPick').value;
    out.innerHTML = aiLoadingHTML('Şagird məlumatları analiz edilir...');
    try {
      const data = sid ? ctx.students.find(s => s.id === sid) : ctx.students;
      const prompt = `${sid ? 'BİR ŞAGİRD' : 'BÜTÜN ŞAGİRDLƏR'} MƏLUMATI:\n${JSON.stringify(data, null, 2)}\n\nBu məlumatlara əsasən hesabat hazırla.`;
      const text = await callGemini(prompt, {
        systemInstruction: MERAM_PROMPTS.studentsSystem(state.profile),
        cacheKey: 'stu-' + (sid || 'all'),
      });
      out.innerHTML = renderMD(text);
    } catch (e) { out.innerHTML = aiErrorHTML(e.message); }
  };
}

function aiPrintReport() {
  const out = $('aiOutput').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>AI Hesabat</title>
    <style>
    body{font-family:'Inter',system-ui,sans-serif;padding:40px;color:#0f1e1c;max-width:900px;margin:auto;line-height:1.65;background:#fbf7f0}
    h1{font-family:'Space Grotesk',system-ui,sans-serif;color:#0f1e1c;font-size:22px;margin-bottom:2px}
    h2,h3{font-family:'Space Grotesk',system-ui,sans-serif;color:#0f766e;margin-top:22px}
    ul,ol{padding-left:22px} code{background:#eafaf7;color:#0f766e;padding:2px 6px;border-radius:5px;font-size:13px}
    </style>
    </head><body><h1>Məram — AI Hesabat</h1><p style="color:#5b6b67;font-size:13px;margin-bottom:24px">${new Date().toLocaleString('az-AZ')}</p>${out}
    <script>setTimeout(()=>window.print(),300)<\/script></body></html>`); // eslint-disable-line no-useless-escape -- intentional: avoids prematurely closing the outer <script> tag this template literal lives inside
}

/* ========== AI: PROQNOZ (admin) ========== */
/* === DETERMINISTIC FORECAST (no AI hallucination) ===
   Uses linear regression on the last 6 months of (income, expenses).
   LLM is asked ONLY to interpret the deterministic numbers — never to predict them. */
function computeForecast() {
  // Build last 6 months window (including current month)
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  // monthly income (real tuition + manual income) and expenses (manual + auto salaries)
  const seriesIn = months.map(m => computeFinance(m, 'all').totalIncome || 0);
  const seriesEx = months.map(m => computeFinance(m, 'all').totalExpense || 0);

  // Linear regression: y = a + b*x, x = 0..n-1
  const linreg = (ys) => {
    const n = ys.length;
    const xs = ys.map((_, i) => i);
    const xm = xs.reduce((a, b) => a + b, 0) / n;
    const ym = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - xm) * (ys[i] - ym); den += (xs[i] - xm) ** 2; }
    const b = den === 0 ? 0 : num / den;
    const a = ym - b * xm;
    return { a, b, next: a + b * n };
  };
  const lrIn = linreg(seriesIn);
  const lrEx = linreg(seriesEx);

  // Geometric mean growth (last 3 months)
  const growth = (ys) => {
    const last = ys.slice(-3).filter(v => v > 0);
    if (last.length < 2) return 0;
    const ratios = [];
    for (let i = 1; i < last.length; i++) ratios.push(last[i] / last[i - 1]);
    const g = Math.pow(ratios.reduce((a, b) => a * b, 1), 1 / ratios.length) - 1;
    return g;
  };
  const gIn = growth(seriesIn);
  const gEx = growth(seriesEx);

  const nextIn = Math.max(0, Math.round(lrIn.next));
  const nextEx = Math.max(0, Math.round(lrEx.next));
  const lastIn = seriesIn[seriesIn.length - 1] || 0;
  const lastEx = seriesEx[seriesEx.length - 1] || 0;

  return {
    months,
    seriesIn, seriesEx,
    lastIncome: lastIn, lastExpense: lastEx,
    nextMonthIncome: nextIn,
    nextMonthExpense: nextEx,
    nextMonthProfit: nextIn - nextEx,
    incomeTrendPct: Math.round(gIn * 1000) / 10,
    expenseTrendPct: Math.round(gEx * 1000) / 10,
    avgIncome: Math.round(seriesIn.reduce((a, b) => a + b, 0) / seriesIn.length),
    avgExpense: Math.round(seriesEx.reduce((a, b) => a + b, 0) / seriesEx.length),
  };
}

function forecastCardsHTML(f) {
  const trendCls = (v) => v >= 0 ? 'text-emerald-400' : 'text-red-400';
  const trendIcon = (v) => v >= 0 ? '↑' : '↓';
  const spark = (vals) => {
    const max = Math.max(...vals, 1);
    const w = 100 / vals.length;
    return `<svg viewBox="0 0 100 30" class="w-full h-10" preserveAspectRatio="none">
      ${vals.map((v, i) => `<rect x="${i * w + 1}" y="${30 - (v / max) * 28}" width="${w - 2}" height="${(v / max) * 28}" fill="currentColor" opacity="0.7"/>`).join('')}
    </svg>`;
  };
  return `
    <div class="grid sm:grid-cols-2 gap-4 mb-5">
      <div class="glass-soft rounded-2xl p-4 text-emerald-400">
        <p class="text-[10px] uppercase text-slate-500 font-bold">Növbəti Ay — Gəlir Proqnozu</p>
        <p class="text-3xl font-black mt-1">${fmt(f.nextMonthIncome)}</p>
        <p class="text-[11px] mt-1 ${trendCls(f.incomeTrendPct)}">${trendIcon(f.incomeTrendPct)} ${Math.abs(f.incomeTrendPct)}% son 3 aylıq trend</p>
        ${spark(f.seriesIn)}
        <p class="text-[10px] text-slate-500 mt-1">Son 6 ay orta: ${fmt(f.avgIncome)}</p>
      </div>
      <div class="glass-soft rounded-2xl p-4 text-red-400">
        <p class="text-[10px] uppercase text-slate-500 font-bold">Növbəti Ay — Xərc Proqnozu</p>
        <p class="text-3xl font-black mt-1">${fmt(f.nextMonthExpense)}</p>
        <p class="text-[11px] mt-1 ${trendCls(-f.expenseTrendPct)}">${trendIcon(-f.expenseTrendPct)} ${Math.abs(f.expenseTrendPct)}% son 3 aylıq trend</p>
        ${spark(f.seriesEx)}
        <p class="text-[10px] text-slate-500 mt-1">Son 6 ay orta: ${fmt(f.avgExpense)}</p>
      </div>
      <div class="glass-soft rounded-2xl p-4 col-span-full ${f.nextMonthProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}">
        <p class="text-[10px] uppercase text-slate-500 font-bold">Növbəti Ay — Mənfəət Proqnozu</p>
        <p class="text-3xl font-black mt-1">${fmt(f.nextMonthProfit)}</p>
        <p class="text-[11px] text-slate-500 mt-1">Düstur: xətti reqressiya (least-squares) son 6 ay üzərində. Trend faizi son 3 ayın həndəsi ortasından.</p>
      </div>
    </div>`;
}

async function renderAIForecast() {
  if (!can('ai')) { $('view-ai-forecast').innerHTML = aiNoAccessHTML(); return; }
  const v = $('view-ai-forecast');
  v.innerHTML = aiPageHTML('AI Proqnoz Sistemi', 'fa-chart-simple', 'from-blue-600 to-cyan-500',
    'Proqnoz rəqəmləri xətti reqressiya ilə hesablanır. AI yalnız strateji şərh verir (hallucination təhlükəsi yoxdur).');
  // Always show deterministic numbers up-front
  const f = computeForecast();
  $('aiOutput').innerHTML = forecastCardsHTML(f) +
    `<div class="text-center py-4 text-slate-500 text-sm"><i class="fa-solid fa-circle-info mr-2"></i>"Analiz et" düyməsi ilə AI strateji şərh əlavə edəcək</div>`;
  $('aiRunBtn').onclick = async () => {
    const out = $('aiOutput');
    const ff = computeForecast();
    out.innerHTML = forecastCardsHTML(ff) + aiLoadingHTML('AI strateji şərh hazırlayır...');
    try {
      const ctx = buildAIContext('forecast');
      // CRITICAL: AI sees ONLY pre-computed numbers; it interprets, it does not predict.
      const facts = {
        son_6_ay_gəlir: ff.months.map((m, i) => ({ ay: m, gəlir: ff.seriesIn[i] })),
        son_6_ay_xərc: ff.months.map((m, i) => ({ ay: m, xərc: ff.seriesEx[i] })),
        növbəti_ay_gəlir_AZN: ff.nextMonthIncome,
        növbəti_ay_xərc_AZN: ff.nextMonthExpense,
        növbəti_ay_mənfəət_AZN: ff.nextMonthProfit,
        gəlir_trend_faizi: ff.incomeTrendPct,
        xərc_trend_faizi: ff.expenseTrendPct,
        son_6_ay_orta_gəlir: ff.avgIncome,
        son_6_ay_orta_xərc: ff.avgExpense,
        mövcud_şagird_sayı: ctx.studentsCount,
        mövcud_kadr_sayı: ctx.teachersCount,
      };
      const prompt = `DƏQİQ RƏQƏMLƏR (dəyişdirmə, yalnız şərh et):\n${JSON.stringify(facts, null, 2)}`;
      const aiText = await callGemini(prompt, {
        systemInstruction: MERAM_PROMPTS.forecastSystem(state.profile),
        cacheKey: 'fcst-v3-' + ff.nextMonthIncome + '-' + ff.nextMonthExpense,
      });
      out.innerHTML = forecastCardsHTML(ff) +
        `<div class="glass-soft rounded-2xl p-5 border border-purple-500/20">
          <div class="flex items-center gap-2 mb-3"><i class="fa-solid fa-wand-magic-sparkles text-purple-400"></i><span class="text-xs font-black uppercase tracking-widest text-purple-300">AI Strateji Şərh</span></div>
          ${renderMD(aiText)}
        </div>`;
    } catch (e) { out.innerHTML = forecastCardsHTML(ff) + aiErrorHTML(e.message); }
  };
}

/* ========== AI: ŞAGİRD PROFİL TƏHLİLİ (hər iki rol) ========== */
async function aiAnalyzeStudent() {
  const sid = state.currentProfileId;
  if (!sid) return;
  const s = state.students[sid];
  if (!s) return;
  // SECURITY: branch check
  if (state.profile.role !== 'admin' && s.branch !== state.profile.branch) {
    toast('Bu şagird sizin filialınıza aid deyil', 'error');
    return;
  }
  const box = $('profileAiResult');
  box.classList.remove('hidden');
  box.innerHTML = aiLoadingHTML('İmtahan nəticələri analiz edilir...');
  try {
    const exams = Object.values(state.examResults?.[sid] || {});
    const data = {
      ad: s.name, sinif: s.class,
      fənlər: (s.subjects || []).map(x => x.subject),
      imtahanlar: exams,
    };
    const prompt = `Sən təcrübəli pedaqoqsan. Aşağıdakı şagirdin imtahan nəticələrini analiz et və müəllim üçün qısa məsləhət ver. Azərbaycan dilində.\n\nMƏLUMATLAR:\n${JSON.stringify(data, null, 2)}\n\nStruktur:\n## İnkişaf Etdiyi Sahələr\n## Zəiflədiyi Sahələr\n## Fənn-Fənn Bal Dəyişiklikləri\n## Ümumi Performans\n## Müəllimə Tövsiyələr\n\nÇox qısa, konkret və faydalı yaz.`;
    const text = await callGemini(prompt, { cacheKey: 'sai-' + sid + '-' + exams.length });
    box.innerHTML = `<div class="flex items-center gap-2 mb-3"><i class="fa-solid fa-wand-magic-sparkles text-purple-400"></i><span class="text-xs font-black uppercase tracking-widest text-purple-300">AI Təhlili</span></div>` + renderMD(text);
  } catch (e) { box.innerHTML = aiErrorHTML(e.message); }
}

