// LlamaDock-Benchmark-Website: statisch, liest nur data/index.json und data/runs/<id>/run.json
// (erzeugt von scripts/export-site.mjs). Hash-Routen: #/ · #/model/<id> · #/run/<id> · #/about
const app = document.getElementById('app');
let DATA = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtS = (ms) => (ms == null ? '–' : ms >= 60000 ? `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')} min` : `${(ms / 1000).toFixed(1)} s`);
const num = (n) => (n == null ? '–' : Number(n).toLocaleString('de-DE'));
const date = (d) => (d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
const score = (s) =>
  s ? `${s.checksPassed}/${s.checksTotal} Checks${s.manual != null ? ` · <span class="star">★ ${s.manual}</span>` : ''}` : '–';

async function load() {
  const r = await fetch('data/index.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('Keine Daten (erst exportieren: node scripts/export-site.mjs)');
  DATA = await r.json();
  document.getElementById('generated').textContent = new Date(DATA.generatedAt).toLocaleString('de-DE');
}

/** Bester Lauf je Szenario × Profil (Checks, dann manuelle Note). */
function best(runs) {
  return [...runs].sort((a, b) => (b.score?.auto ?? 0) - (a.score?.auto ?? 0) || (b.score?.manual ?? 0) - (a.score?.manual ?? 0))[0];
}

function overview() {
  const scen = Object.values(DATA.scenarios);
  const models = Object.values(DATA.models);
  if (!DATA.runs.length) {
    app.innerHTML = '<h1>Benchmarks</h1><p class="muted">Noch keine veröffentlichten Läufe.</p>';
    return;
  }
  const gpu = DATA.runs[0]?.hardware?.gpu ?? '';
  const rows = scen
    .map((s) => {
      const cells = models
        .map((m) => {
          const list = DATA.runs.filter((r) => r.scenario.id === s.id && r.profile.id === m.id);
          const b = best(list);
          return `<td>${b ? `<a href="#/run/${esc(b.id)}">${score(b.score)}</a><div class="muted small">${fmtS(b.timing?.agentMs)} · ${b.tps?.decode ?? '–'} t/s · ${list.length}×</div>` : '<span class="muted">–</span>'}</td>`;
        })
        .join('');
      return `<tr><td><b>${esc(s.name)}</b><div class="muted small">${esc(s.description ?? '')}</div></td>${cells}</tr>`;
    })
    .join('');
  app.innerHTML = `
    <h1>Lokale Modelle im Agent-Test</h1>
    <p class="muted">Echte Aufgaben für einen Coding-Agent (pi) mit lokalen Modellen${gpu ? ` auf einer <b>${esc(gpu)}</b>` : ''}. Jeder Lauf mit vollständiger Konfiguration, automatischen Browser-Checks und manueller Bewertung (1–5).</p>
    <h2>Vergleich</h2>
    <div class="panel table-wrap"><table>
      <thead><tr><th>Szenario</th>${models.map((m) => `<th><a href="#/model/${esc(m.id)}">${esc(m.name)}</a></th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <h2>Modelle</h2>
    <div class="grid">${models
      .map((m) => {
        const runs = DATA.runs.filter((r) => r.profile.id === m.id);
        const p = m.profile ?? {};
        return `<a class="panel" href="#/model/${esc(m.id)}" style="color:inherit;text-decoration:none">
          <b>${esc(m.name)}</b>
          <div class="muted small">${esc(p.model ?? '')}</div>
          <div style="margin-top:8px">${[p.provider, p.server?.build, p.server?.ctx ? `${Math.round(p.server.ctx / 1024)}k Kontext` : null, p.server?.kvCache ? `KV ${p.server.kvCache}` : null]
            .filter(Boolean)
            .map((c) => `<span class="chip">${esc(c)}</span>`)
            .join('')}</div>
          <div class="muted small">${runs.length} Läufe</div>
        </a>`;
      })
      .join('')}</div>`;
}

function modelPage(id) {
  const m = DATA.models[id];
  if (!m) return notFound();
  const p = m.profile ?? {};
  const recipe = DATA.recipes[m.recipe] ?? null;
  const ext = DATA.external[m.recipe] ?? [];
  const runs = DATA.runs.filter((r) => r.profile.id === id);
  const conf = [
    ['Modelldatei', p.model],
    ['Vision (mmproj)', p.mmproj ?? 'nein'],
    ['Provider', `${p.provider ?? '–'}${p.server?.build ? ` (Build ${p.server.build})` : ''}`],
    ['Kontext', p.server?.ctx ? `${num(p.server.ctx)} Tokens` : '–'],
    ['KV-Cache', p.server?.kvCache],
    ['GPU-Layer', p.server?.ngl],
    ['Flash Attention', p.server?.flashAttention ? 'an' : 'aus'],
    ['Thinking', p.thinking],
    ['Sampling', Object.entries(p.sampling ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'Server-Standard'],
    ['Zusatz-Flags', (p.server?.extraArgs ?? []).join(' ') || '–'],
  ];
  const first = runs[0] ? DATA.runs.find((r) => r.id === runs[0].id) : null;
  app.innerHTML = `
    <p><a href="#/">← Übersicht</a></p>
    <h1>${esc(m.name)}</h1>
    ${recipe ? `<p class="muted">${esc(recipe.name)} · <a href="https://huggingface.co/${esc(recipe.hfRepo)}">${esc(recipe.hfRepo)}</a> · Lizenz ${esc(recipe.license ?? '?')}</p>` : ''}
    <h2>Konfiguration</h2>
    <div class="panel table-wrap"><table><tbody>${conf.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v ?? '–')}</td></tr>`).join('')}</tbody></table></div>
    ${first ? `<p class="muted small">Hardware: ${esc(first.hardware?.gpu ?? '–')} · Harness: ${esc(first.harness?.id ?? 'pi')} ${esc(first.harness?.version ?? '')} · Provider-Version: ${esc(first.provider?.version ?? '–')}</p>` : ''}
    <h2>Eigene Ergebnisse</h2>
    <div class="grid">${runs
      .map(
        (r) => `<a class="panel" href="#/run/${esc(r.id)}" style="color:inherit;text-decoration:none">
          <img class="card-img" loading="lazy" src="data/runs/${esc(r.id)}/screenshot.png" alt="" onerror="this.style.display='none'" />
          <b>${esc(DATA.scenarios[r.scenario.id]?.name ?? r.scenario.id)}</b>
          <div>${score(r.score)}</div>
          <div class="muted small">${date(r.date)} · ${fmtS(r.timing?.agentMs)} · ${r.tps?.decode ?? '–'} t/s · ${num(r.tokens?.out)} Tokens</div>
        </a>`,
      )
      .join('')}</div>
    <h2>Externe Benchmarks</h2>
    ${
      ext.length
        ? `<div class="panel table-wrap"><table><thead><tr><th>Benchmark</th><th>Wert</th><th>Quelle</th><th>Stand</th></tr></thead><tbody>${ext
            .map(
              (e) => `<tr><td>${esc(e.benchmark)}${e.note ? `<div class="muted small">${esc(e.note)}</div>` : ''}</td><td>${e.value == null ? '–' : esc(e.value)}</td><td><a href="${esc(e.source)}">${esc(new URL(e.source).hostname)}</a></td><td>${date(e.date)}</td></tr>`,
            )
            .join('')}</tbody></table></div>`
        : '<p class="muted">Keine externen Werte hinterlegt.</p>'
    }`;
}

async function runPage(id) {
  const r = await (await fetch(`data/runs/${encodeURIComponent(id)}/run.json`, { cache: 'no-store' })).json().catch(() => null);
  if (!r) return notFound();
  const sc = DATA.scenarios[r.scenario.id] ?? { name: r.scenario.id, rubric: [] };
  const entry = 'index.html';
  const hasEntry = (r.artifacts ?? []).some((a) => a.path === entry);
  const tools = Object.entries(r.toolCalls?.byName ?? {}).map(([k, v]) => `<span class="chip">${esc(k)} ${v}×</span>`).join('');
  app.innerHTML = `
    <p><a href="#/model/${esc(r.profile.id)}">← ${esc(r.profile.name)}</a></p>
    <h1>${esc(sc.name)}</h1>
    <p class="muted">${esc(r.profile.name)} · ${date(r.date)} · ${esc(r.state)}</p>
    <div class="stats">
      ${[
        ['Checks', r.score ? `${r.score.checksPassed}/${r.score.checksTotal}` : '–'],
        ['Bewertung', r.score?.manual != null ? `★ ${r.score.manual}` : '–'],
        ['Dauer Agent', fmtS(r.timing?.agentMs)],
        ['Decode', r.tps?.decode ? `${r.tps.decode} t/s` : '–'],
        ['Tokens ↑ / ↓', `${num(r.tokens?.in)} / ${num(r.tokens?.out)}`],
        ['Runden', r.turns ?? '–'],
        ['Tool-Aufrufe', r.toolCalls?.total ?? '–'],
        ['Modell laden', fmtS(r.timing?.loadMs)],
      ]
        .map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
        .join('')}
    </div>
    <p>${tools}</p>
    ${hasEntry ? `<h2>Ergebnis (live)</h2><iframe class="preview" sandbox="allow-scripts allow-forms" src="data/runs/${esc(r.id)}/work/${entry}"></iframe>` : ''}
    ${r.screenshot ? `<h2>Screenshot</h2><img class="shot" loading="lazy" src="data/runs/${esc(r.id)}/screenshot.png" alt="Screenshot" />` : ''}
    <h2>Automatische Checks</h2>
    <ul class="checks">${(r.checks ?? []).map((c) => `<li><span class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span> ${esc(c.label)} ${c.detail ? `<span class="muted small">${esc(c.detail)}</span>` : ''}</li>`).join('')}</ul>
    ${
      r.manual
        ? `<h2>Manuelle Bewertung</h2><div class="panel table-wrap"><table><tbody>${(sc.rubric ?? [])
            .map((x) => `<tr><th>${esc(x.label)}</th><td>${r.manual.ratings?.[x.id] ?? '–'} / 5</td><td class="muted small">${esc(x.hint ?? '')}</td></tr>`)
            .join('')}</tbody></table>${r.manual.notes ? `<p>${esc(r.manual.notes)}</p>` : ''}</div>`
        : ''
    }
    <h2>Aufgabe</h2><pre>${esc(sc.prompt)}</pre>
    ${r.final ? `<h3>Antwort des Agents</h3><pre>${esc(r.final)}</pre>` : ''}
    <h2>Kontext</h2>
    <pre>${esc(JSON.stringify({ profile: r.profile, systemPrompt: r.systemPrompt, thinking: r.thinking, tools: r.tools, hardware: r.hardware, provider: r.provider, harness: r.harness }, null, 2))}</pre>
    <h3>Dateien</h3>
    <ul class="small">${(r.artifacts ?? []).map((a) => `<li><a href="data/runs/${esc(r.id)}/work/${esc(a.path)}">${esc(a.path)}</a> <span class="muted">${num(a.size)} B</span></li>`).join('')}</ul>`;
}

function about() {
  app.innerHTML = `
    <h1>Methode</h1>
    <div class="panel">
      <p>Jeder Lauf startet den Agent <b>pi</b> im Druckmodus (<code>pi -p --mode json --no-session</code>) in einem leeren Ordner, ohne Erweiterungen, Skills oder Kontextdateien, nur mit den Tools des Szenarios (read, bash, edit, write) und einem Zeitlimit.
      Das Modell läuft lokal (llama.cpp bzw. NInfer) mit genau der angegebenen Konfiguration.</p>
      <p>Danach öffnet ein Headless-Browser (Chrome DevTools Protocol) das Ergebnis: Konsolenfehler, Elemente, Formularverhalten, Handy-Breite, echte Tastendrücke bei Spielen, Screenshot. Die Checks sind je Szenario festgelegt. Die Rubrik (1–5) wird von Hand vergeben.</p>
      <p>Externe Benchmarkwerte stammen aus den Model Cards und sind mit Quelle und Abrufdatum angegeben.</p>
    </div>
    <h2>Szenarien</h2>
    ${Object.values(DATA.scenarios)
      .map(
        (s) => `<div class="panel" style="margin-bottom:12px"><b>${esc(s.name)}</b> <span class="chip">v${esc(s.version ?? 1)}</span><p class="muted">${esc(s.description ?? '')}</p>
        <h3>Checks</h3><ul class="small">${(s.checks ?? []).map((c) => `<li>${esc(c.label)}</li>`).join('')}</ul>
        <h3>Rubrik</h3><ul class="small">${(s.rubric ?? []).map((c) => `<li><b>${esc(c.label)}</b>: ${esc(c.hint ?? '')}</li>`).join('')}</ul>
        <details><summary>Prompt</summary><pre>${esc(s.prompt)}</pre></details></div>`,
      )
      .join('')}`;
}

function notFound() {
  app.innerHTML = '<h1>Nicht gefunden</h1><p><a href="#/">Zur Übersicht</a></p>';
}

async function route() {
  try {
    if (!DATA) await load();
  } catch (e) {
    app.innerHTML = `<h1>Benchmarks</h1><p class="muted">${esc(e.message)}</p>`;
    return;
  }
  const [, page, id] = (location.hash.replace(/^#/, '') || '/').split('/');
  window.scrollTo(0, 0);
  if (page === 'model') modelPage(decodeURIComponent(id));
  else if (page === 'run') await runPage(decodeURIComponent(id));
  else if (page === 'about') about();
  else overview();
}

window.addEventListener('hashchange', route);
route();
