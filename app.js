// LlamaDock-Benchmark-Website: statisch, liest data/index.json und data/runs/<id>/run.json
// (erzeugt von scripts/export-site.mjs). Seiten (per <body data-page>):
//   board   Startseite: Leaderboard, Szenario-Matrix, Modelle
//   model   models/<slug>/: ein Modell mit allen Konfigurationen und Läufen (data-model = slug)
//   method  methode/: Ablauf, Score-Formel, Szenarien
// Alle Links sind relativ zu <base> (Wurzel der Seite); Anker daher immer mit Pfad.
const app = document.getElementById('app');
const PAGE = document.body.dataset.page || 'board';
let DATA = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtS = (ms) => (ms == null ? '–' : ms >= 60000 ? `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')} min` : `${(ms / 1000).toFixed(1)} s`);
const num = (n, d = 0) => (n == null || Number.isNaN(n) ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: d }));
const date = (d) => (d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
const dateTime = (d) => (d ? new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
const ctxK = (n) => (n ? `${Math.round(n / 1024)}k` : null);
const bytes = (n) => (n == null ? '' : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} kB` : `${n} B`);
const modelUrl = (slug, anchor = '') => `models/${encodeURIComponent(slug)}/${anchor ? `#${anchor}` : ''}`;
const runUrl = (r) => modelUrl(r.modelSlug, `run-${r.id}`);
const stars = (v) => (v == null ? '–' : `★ ${num(v, 2)}`);
const STATE = { done: 'fertig', timeout: 'Zeitlimit', error: 'Fehler', cancelled: 'abgebrochen' };

/** Farbstufe eines Scores 0–100. */
const tone = (v) => (v == null ? 'none' : v >= 80 ? 'good' : v >= 55 ? 'mid' : 'low');
const meter = (v, big = false) =>
  v == null
    ? '<span class="muted">–</span>'
    : `<span class="meter${big ? ' big' : ''}" title="${num(v, 1)} von 100"><b class="t-${tone(v)}">${num(v, big ? 1 : 0)}</b><i><span class="bg-${tone(v)}" style="width:${Math.max(2, Math.min(100, v))}%"></span></i></span>`;
const chip = (t, cls = '') => (t ? `<span class="chip ${cls}">${esc(t)}</span>` : '');
const checksText = (s) => (s?.checksTotal ? `${s.checksPassed}/${s.checksTotal}` : '–');

async function load() {
  const r = await fetch('data/index.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('Noch keine Daten veröffentlicht.');
  DATA = await r.json();
  document.getElementById('generated').textContent = DATA.generatedAt ? dateTime(DATA.generatedAt) : '–';
}

/** Kurzbeschreibung einer Konfiguration als Chips. */
function configChips(c) {
  const s = c.profile?.server ?? {};
  return [
    chip(ctxK(s.ctx) && `${ctxK(s.ctx)} Kontext`),
    chip(s.kvCache && `KV ${s.kvCache}`),
    chip(c.thinking && `Thinking ${c.thinking}`),
    chip(c.profile?.provider === 'router' ? `Router · ${c.profile.router?.profiles?.length ?? 0} Profile` : c.profile?.provider === 'ninfer' ? 'NInfer' : `llama.cpp${s.build ? ` ${s.build}` : ''}`),
    c.systemPrompt ? chip(`Prompt ${c.systemPrompt.name}`) : '',
  ].join('');
}

function componentsHead() {
  return DATA.components.map((k) => `<th class="num" title="Gewicht ${DATA.weights[k.id]}">${esc(k.label)}</th>`).join('');
}

function noData(msg) {
  app.innerHTML = `<section class="hero"><h1>Lokale Modelle im Agent-Test</h1><p class="lead">${esc(msg)}</p></section>`;
}

/* ------------------------------------------------------------ Leaderboard */

function board() {
  const cfgs = DATA.configs ?? [];
  if (!cfgs.length) {
    noData('Noch keine veröffentlichten Läufe.');
    app.insertAdjacentHTML('beforeend', routingSection());
    return;
  }
  const gpu = DATA.runs[0]?.hardware?.gpu;
  const scen = Object.values(DATA.scenarios);
  const runsById = new Map(DATA.runs.map((r) => [r.id, r]));
  const podium = cfgs.slice(0, 3);

  const rows = cfgs
    .map(
      (c) => `<tr>
        <td class="rank r${c.rank}">${c.rank}</td>
        <td class="who">
          <a href="${modelUrl(c.modelSlug, `config-${c.configId}`)}"><b>${esc(DATA.models[c.modelSlug]?.name ?? c.model)}</b></a>
          <div class="muted small mono">${esc(c.model)}</div>
          <div class="chips">${configChips(c)}</div>
        </td>
        <td>${meter(c.score, true)}</td>
        ${DATA.components.map((k) => `<td class="num">${meter(c.parts[k.id])}</td>`).join('')}
        <td class="num">${num(c.tps, 1)}</td>
        <td class="num">${fmtS(c.agentMs)}</td>
        <td class="num">${c.scenarios.length}/${scen.length}${c.rated < c.runs.length ? `<div class="muted small" title="Läufe ohne manuelle Bewertung">${c.runs.length - c.rated} unbewertet</div>` : ''}</td>
      </tr>`,
    )
    .join('');

  const matrix = `<div class="panel table-wrap"><table class="matrix">
      <thead><tr><th>Konfiguration</th>${scen.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead>
      <tbody>${cfgs
        .map(
          (c) => `<tr><td><a href="${modelUrl(c.modelSlug, `config-${c.configId}`)}">${esc(c.label)}</a><div class="muted small">${esc(c.thinking ? `Thinking ${c.thinking}` : '')}</div></td>${scen
            .map((s) => {
              const sc = c.scenarios.find((x) => x.id === s.id);
              if (!sc) return '<td class="muted">–</td>';
              const rs = sc.runs.map((id) => runsById.get(id)).filter(Boolean);
              const r = rs[0];
              const score = rs.length ? rs.reduce((a, x) => a + (x.points?.score ?? 0), 0) / rs.length : null;
              return `<td><a class="cell" href="${runUrl(r)}">${meter(score)}<span class="muted small">${checksText(r.score)} Checks · ${fmtS(r.timing?.agentMs)}${rs.length > 1 ? ` · ${rs.length}×` : ''}</span></a></td>`;
            })
            .join('')}</tr>`,
        )
        .join('')}</tbody></table></div>`;

  const models = Object.values(DATA.models).sort((a, b) => (b.best ?? -1) - (a.best ?? -1));
  app.innerHTML = `
    <section class="hero">
      <h1>Lokale Modelle im Agent-Test</h1>
      <p class="lead">Echte Aufgaben für einen Coding-Agent (pi) mit lokalen Modellen${gpu ? ` auf einer <b>${esc(gpu)}</b>` : ''}. Jeder Lauf mit exakter Konfiguration, automatischen Browser-Checks, manueller Bewertung und den erzeugten Artefakten.</p>
      <div class="kpis">
        <div><b>${models.length}</b><span>Modelle</span></div>
        <div><b>${cfgs.length}</b><span>Konfigurationen</span></div>
        <div><b>${DATA.runs.length}</b><span>Läufe</span></div>
        <div><b>${scen.length}</b><span>Szenarien</span></div>
      </div>
    </section>

    <section class="podium">${podium
      .map(
        (c) => `<a class="panel pod p${c.rank}" href="${modelUrl(c.modelSlug, `config-${c.configId}`)}">
          <span class="place">${['🥇', '🥈', '🥉'][c.rank - 1]}</span>
          <b>${esc(DATA.models[c.modelSlug]?.name ?? c.model)}</b>
          <span class="muted small">${esc(c.label)}</span>
          <span class="pod-score t-${tone(c.score)}">${num(c.score, 1)}</span>
        </a>`,
      )
      .join('')}</section>

    ${categoryRankings()}

    ${routingSection()}

    <h2 id="leaderboard">Leaderboard</h2>
    <p class="muted small">Score 0–100 aus manueller Bewertung, automatischen Checks, Tempo und externen Benchmarks (<a href="methode/#score">so wird gerechnet</a>). Eine Zeile = ein Modell mit exakt einer Konfiguration.</p>
    <div class="panel table-wrap"><table class="board">
      <thead><tr><th>#</th><th>Modell &amp; Konfiguration</th><th>Score</th>${componentsHead()}<th class="num">t/s</th><th class="num">Ø Dauer</th><th class="num">Szenarien</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>

    <h2>Szenarien × Konfigurationen</h2>
    <p class="muted small">Lauf-Score ohne externe Benchmarks; ein Klick führt zum Lauf mit Artefakt, Screenshots und allen Details.</p>
    ${matrix}

    <h2>Modelle</h2>
    <div class="grid">${models
      .map((m) => {
        const r = DATA.recipes[m.recipe];
        const shot = DATA.runs.find((x) => x.modelSlug === m.slug && x.screenshot);
        return `<a class="panel card" href="${modelUrl(m.slug)}">
          ${shot ? `<img class="card-img" loading="lazy" src="data/runs/${esc(shot.id)}/screenshot.png" alt="" />` : ''}
          <div class="card-head"><b>${esc(m.name)}</b>${meter(m.best)}</div>
          <div class="muted small mono">${esc(m.file)}</div>
          <div class="muted small">${m.configs.length} Konfiguration(en) · ${m.runs} Läufe${r?.license ? ` · ${esc(r.license)}` : ''}</div>
        </a>`;
      })
      .join('')}</div>`;
}

const CATEGORY_EMPTY = {
  coding: 'Noch kein Coding-Szenario gelaufen.',
  writing: 'Noch kein Schreib-Szenario gelaufen (Kategorie „Writing“).',
  image: 'Noch kein Bild-Szenario gelaufen (Kategorie „Image Gen“, Tool generate_image).',
  routing: 'Noch kein Lauf mit dem Ziel „Auto-Routing“.',
  computer: 'Noch kein Computer-Use-Szenario gelaufen und keine externen Werte (OSWorld, AndroidWorld, WebArena) für die getesteten Modelle.',
};

const pct = (v) => (v == null ? '–' : `${num(v * 100, 0)} %`);

/** Routing: eigener Entscheider-Benchmark (Testset in LlamaDock) + JevBench v1.4.1 (extern). */
function routingSection() {
  const R = DATA.routing;
  if (!R || (!R.own?.length && !R.external)) return '';
  const ts = R.testset;
  const n = ts ? ts.router.length + ts.guard.length + ts.support.length : null;
  const own = (R.own ?? [])
    .map(
      (r, i) => `<tr>
        <td class="rank r${i + 1}">${i + 1}</td>
        <td class="who"><b>${esc(r.label)}</b><div class="muted small">${r.engine === 'jevk5' ? (r.translate ? 'mit Übersetzung DE→EN' : 'Deutsch direkt') : 'Deutsch → Englisch (MarianMT)'} · ${esc(r.hardware?.cpu ?? 'CPU')}</div></td>
        <td>${meter(r.metrics.score, true)}</td>
        <td class="num" title="AUC: trennt die Schwierigkeit leichte von schweren Aufgaben?">${pct(r.metrics.tier.auc)}</td>
        <td class="num" title="Genauigkeit bei der Schwelle, die LlamaDock verwendet">${pct(r.metrics.tier.accuracyAtConfigured)}</td>
        <td class="num">${pct(r.metrics.domain.accuracy)}</td>
        <td class="num" title="AUC Prompt-Injection-Erkennung">${pct(r.metrics.guard.auc)}</td>
        <td class="num" title="AUC: stützt der Beleg die Aussage?">${pct(r.metrics.support.auc)}</td>
        <td class="num">${num(r.metrics.latency.routerMs)} ms</td>
      </tr>`,
    )
    .join('');
  const ext = R.external;
  const shown = ext ? ext.systems.filter((x) => x.rank <= 12 || x.llamadock) : [];
  const jev = shown
    .map(
      (x) => `<tr class="${x.llamadock ? 'hl' : ''}">
        <td class="rank">${x.rank}</td>
        <td class="who"><b>${esc(x.name)}</b>${x.llamadock ? ' <span class="chip">in LlamaDock</span>' : ''}<div class="muted small">${esc([x.org, x.base, x.license].filter(Boolean).join(' · '))}${x.api ? ' · API' : ''}</div></td>
        <td>${meter(x.score)}</td>
        <td class="num">${num(x.intelligence)}</td>
        <td class="num">${num(x.calibration)}</td>
        <td class="num">${num(x.speed)}</td>
        <td class="num">${num(x.cost)}</td>
        <td class="num">${esc(x.costPer1k)}</td>
        <td>${x.url ? `<a href="${esc(x.url)}" rel="noopener">Quelle</a>` : ''}</td>
      </tr>`,
    )
    .join('');
  return `<h2 id="routing">🧭 Routing &amp; Entscheider</h2>
    <p class="muted small">Der Router wählt pro Aufgabe Modell und Thinking-Stufe. Die Entscheidung trifft ein kleines Entscheidungsmodell (getypte Fragen, ein Forward-Pass). Standard ist seit dem 24.09.2026 <b>JevK5</b> statt Laya (<a href="methode/#routing">Methode</a>).</p>
    ${
      own
        ? `<h3>LlamaDock-Routing-Test</h3>
    <p class="muted small">${n ? `${n} Fragen (${ts.router.length} Aufgaben auf Deutsch und Englisch mit Schwierigkeit und Bereich, ${ts.guard.length} Texte mit/ohne Prompt Injection, ${ts.support.length} Beleg-Aussage-Paare)` : ''}, alle auf der CPU. Score = Mittel aus Klassen-AUC, Bereichs-Genauigkeit, Guard-AUC und Beleg-AUC.</p>
    <div class="panel table-wrap"><table class="board">
      <thead><tr><th>#</th><th>Entscheider</th><th>Score</th><th class="num">Klasse AUC</th><th class="num">Klasse ✓</th><th class="num">Bereich</th><th class="num">Guard</th><th class="num">Beleg</th><th class="num">Router-Entscheidung</th></tr></thead>
      <tbody>${own}</tbody></table></div>`
        : ''
    }
    ${
      ext
        ? `<h3>Extern: ${esc(ext.benchmark)}</h3>
    <p class="muted small">Benchmark Heaven, bewertet am ${date(ext.scoredAt)}, abgerufen am ${date(ext.retrievedAt)}: ${ext.systems.length} Systeme, Score = harmonisches Mittel aus Intelligence, Calibration, Speed und Cost. Gezeigt: die Top 12 und die Systeme, die LlamaDock einbauen kann. <a href="${esc(ext.source)}" rel="noopener">Ganze Rangliste</a></p>
    <div class="panel table-wrap"><table class="board">
      <thead><tr><th>#</th><th>System</th><th>Score</th><th class="num">Intel.</th><th class="num">Calib.</th><th class="num">Speed</th><th class="num">Cost</th><th class="num">$/1000</th><th></th></tr></thead>
      <tbody>${jev}</tbody></table></div>`
        : ''
    }`;
}

/** Rankings nach Anwendungsfall: je Kategorie die besten Konfigurationen. */
function categoryRankings() {
  const cats = DATA.categories ?? [];
  if (!cats.length) return '';
  const byId = new Map(DATA.configs.map((c) => [c.configId, c]));
  const entry = (cat, e, i) => {
    const c = byId.get(e.configId);
    const basis =
      cat.id === 'speed' ? 'Decode-t/s + Dauer' : e.scenarios ? `${e.scenarios} Szenario${e.scenarios > 1 ? 'en' : ''}${e.external ? ' + extern' : ''}` : 'nur externe Benchmarks';
    return `<li>
      <span class="pos">${i + 1}</span>
      <a href="${modelUrl(c.modelSlug, `config-${c.configId}`)}" title="${esc(c.label)}">
        <b>${esc(DATA.models[c.modelSlug]?.name ?? c.model)}</b>
        <span class="muted small">${c.thinking ? `Thinking ${esc(c.thinking)} · ` : ''}${esc(basis)}</span>
      </a>
      ${meter(e.score)}
    </li>`;
  };
  return `<h2 id="anwendungsfaelle">Rankings nach Anwendungsfall</h2>
    <p class="muted small">Wer ist wofür am besten? Je Kategorie zählen nur passende Szenarien und externe Benchmarks (<a href="methode/#kategorien">so wird gerechnet</a>).</p>
    <div class="cats">${cats
      .map(
        (cat) => `<section class="panel cat" id="cat-${esc(cat.id)}">
          <h3><span class="cat-icon">${cat.icon}</span>${esc(cat.label)}</h3>
          ${
            cat.ranking.length
              ? `<ol>${cat.ranking.slice(0, 5).map((e, i) => entry(cat, e, i)).join('')}</ol>`
              : cat.id === 'routing' && DATA.routing?.own?.length
                ? `<ol>${DATA.routing.own
                    .slice(0, 5)
                    .map((r, i) => `<li><span class="pos">${i + 1}</span><a href="./#routing"><b>${esc(r.label)}</b><span class="muted small">Entscheider · ${r.engine === 'jevk5' ? (r.translate ? 'übersetzt' : 'Deutsch direkt') : 'übersetzt'}</span></a>${meter(r.metrics.score)}</li>`)
                    .join('')}</ol>`
                : `<p class="muted small">${esc(CATEGORY_EMPTY[cat.id] ?? 'Noch keine Daten.')}</p>`
          }
        </section>`,
      )
      .join('')}</div>`;
}

/* ------------------------------------------------------------ Modellseite */

/** Plätze einer Konfiguration in den Rankings nach Anwendungsfall. */
function categoryPlaces(c) {
  const items = (DATA.categories ?? [])
    .map((cat) => {
      const i = cat.ranking.findIndex((e) => e.configId === c.configId);
      return i < 0 ? '' : `<a class="place-chip" href="./#cat-${esc(cat.id)}"><span>${cat.icon} ${esc(cat.label)}</span>${meter(cat.ranking[i].score)}<span class="muted small">Platz ${i + 1}/${cat.ranking.length}</span></a>`;
    })
    .filter(Boolean);
  return items.length ? `<div class="places">${items.join('')}</div>` : '';
}

function paramRows(c) {
  const p = c.profile ?? {};
  if (p.provider === 'router') {
    const r = p.router ?? {};
    return [
      ['Ziel', 'LlamaDock-Router, Modell <span class="mono">llamadock/auto</span>'],
      ['Profile für Auto', (r.profiles ?? []).map((x) => `<div>${esc(x.name)} <span class="muted small">(${esc(x.tier)}${x.domains?.length ? `, Bereich ${esc(x.domains.join(', '))}` : ''})</span></div>`).join('') || '–'],
      ['Standardprofil', esc(r.defaultProfile ?? '–')],
      ['Schwelle groß/klein', esc(r.difficultyThreshold ?? '–')],
      ['Thinking', r.autoThinking ? `Laya wählt pro Aufgabe${r.thinkingThresholds ? ` <span class="muted">(Schwellen ${esc(r.thinkingThresholds.join(' / '))})</span>` : ''}` : esc(c.thinking ?? '–')],
      ['System Prompt', c.systemPrompt ? esc(c.systemPrompt.name) : 'pi-Standard + Benchmark-Regeln'],
      ['Tools', (c.tools ?? []).map((t) => chip(t)).join('')],
    ];
  }
  const s = p.server ?? {};
  const sampling = Object.entries(p.sampling ?? {}).map(([k, v]) => `${k} ${v}`).join(' · ');
  return [
    ['Modelldatei', `<span class="mono">${esc(p.model ?? '–')}</span>`],
    ['Vision (mmproj)', p.mmproj ? `<span class="mono">${esc(p.mmproj)}</span>` : 'nein'],
    ['Provider', `${p.provider === 'ninfer' ? 'NInfer (Docker)' : 'llama.cpp'}${s.build ? ` · Build ${esc(s.build)}` : ''}`],
    ['Kontext', s.ctx ? `${num(s.ctx)} Tokens${s.parallel > 1 ? ` (${s.parallel} Slots)` : ''}` : '–'],
    ['KV-Cache', esc(s.kvCache ?? 'f16')],
    ['GPU-Layer (ngl)', esc(s.ngl ?? '–')],
    ['Flash Attention', s.flashAttention ? 'an' : 'aus'],
    ['ubatch', esc(s.ub ?? '–')],
    ['Jinja-Template', s.jinja === false ? 'aus' : 'an'],
    ['MoE auf CPU', esc(s.cpuMoe ?? '–')],
    ['Zusatz-Flags', (s.extraArgs ?? []).length ? `<span class="mono">${esc(s.extraArgs.join(' '))}</span>` : '–'],
    p.ninfer ? ['NInfer', `<span class="mono">${esc(JSON.stringify(p.ninfer))}</span>`] : null,
    ['Sampling', esc(sampling || 'Server-Standard')],
    ['Thinking', `${esc(c.thinking ?? p.thinking ?? '–')}${p.reasoningEfforts ? ` <span class="muted">(Modell kennt ${esc(p.reasoningEfforts.join(', ') || 'nur an/aus')})</span>` : ''}`],
    ['Max. Antwort-Tokens', num(p.maxTokens)],
    ['System Prompt', c.systemPrompt ? `${esc(c.systemPrompt.name)} (${c.systemPrompt.mode === 'replace' ? 'ersetzt' : 'ergänzt'} pi's Prompt)` : 'pi-Standard + Benchmark-Regeln'],
    ['Tools', (c.tools ?? []).map((t) => chip(t)).join('')],
  ].filter(Boolean);
}

function envRows(c) {
  const h = c.hardware ?? {};
  return [
    ['GPU', `${esc(h.gpu ?? '–')}${h.vramMB ? ` · ${num(h.vramMB / 1024, 0)} GB VRAM` : ''}`],
    ['Treiber / CUDA', `${esc(h.driver ?? '–')} / ${esc(h.cuda ?? '–')}`],
    ['CPU', `${esc(h.cpu ?? '–')}${h.threads ? ` · ${h.threads} Threads` : ''}`],
    ['RAM', h.ramGB ? `${h.ramGB} GB` : '–'],
    ['Betriebssystem', esc(h.os ?? '–')],
    ['Modell-Server', `<span class="mono">${esc(c.provider?.version ?? '–')}</span>`],
    ['Harness', `pi <span class="mono">${esc(c.harness?.version ?? '')}</span>`],
  ];
}

const dl = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

function runCard(r) {
  const pts = r.points ?? {};
  const rubric = r.scenario.rubric ?? DATA.scenarios[r.scenario.id]?.rubric ?? [];
  const tools = Object.entries(r.toolCalls?.byName ?? {}).map(([k, v]) => chip(`${k} ${v}×`)).join('');
  const entry = r.scenario.entry || 'index.html';
  const hasEntry = (r.artifacts ?? []).some((a) => a.path === entry);
  const base = `data/runs/${encodeURIComponent(r.id)}`;
  const stats = [
    ['Lauf-Score', meter(pts.score)],
    ['Checks', `${checksText(r.score)}`],
    ['Bewertung', `<span class="star">${stars(r.score?.manual)}</span>`],
    ['Dauer Agent', fmtS(r.timing?.agentMs)],
    ['Decode', r.tps?.decode ? `${num(r.tps.decode, 1)} t/s` : '–'],
    ['effektiv', r.tps?.effective ? `${num(r.tps.effective, 1)} t/s` : '–'],
    ['Tokens ↑ / ↓', `${num(r.tokens?.in)} / ${num(r.tokens?.out)}`],
    ['aus Cache', num(r.tokens?.cacheRead)],
    ['Runden', num(r.turns)],
    ['Tool-Aufrufe', `${num(r.toolCalls?.total)}${r.toolErrors ? ` (${r.toolErrors} Fehler)` : ''}`],
    ['Modell laden', fmtS(r.timing?.loadMs)],
    ['Zeitlimit', r.timeLimitSec ? fmtS(r.timeLimitSec * 1000) : '–'],
  ];
  return `<article class="panel run" id="run-${esc(r.id)}">
    <header class="run-head">
      <div>
        <h3>${esc(r.scenario.name)} ${chip(`v${r.scenario.version ?? 1}`)}</h3>
        <div class="muted small">${dateTime(r.date)} · ${esc(STATE[r.state] ?? r.state)}${r.isolation?.breaches ? ` · <span class="warn">${r.isolation.breaches}× außerhalb des Arbeitsordners gesucht</span>` : ''}</div>
      </div>
      <div class="run-score">${meter(pts.score, true)}</div>
    </header>
    <div class="stats">${stats.map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>
    <div class="parts small muted">Bewertung ${num(pts.manual)} · Checks ${num(pts.checks)} · Tempo ${num(pts.speed)} (t/s ${num(pts.tps)}, Dauer ${num(pts.time)})</div>
    ${
      r.screenshot || r.mobileScreenshot
        ? `<div class="shots">${r.screenshot ? `<a href="${base}/screenshot.png"><img loading="lazy" src="${base}/screenshot.png" alt="Screenshot Desktop" /></a>` : ''}${r.mobileScreenshot ? `<a class="mobile" href="${base}/screenshot-mobile.png"><img loading="lazy" src="${base}/screenshot-mobile.png" alt="Screenshot Handy" /></a>` : ''}</div>`
        : ''
    }
    ${
      hasEntry
        ? `<div class="actions"><button class="btn" data-preview="${esc(r.id)}" data-src="${base}/work/${esc(entry)}">▶ Live ansehen</button><a class="btn" href="${base}/work/${esc(entry)}" target="_blank" rel="noopener">In neuem Tab ↗</a></div><div class="preview-slot" id="pv-${esc(r.id)}"></div>`
        : ''
    }
    <div class="cols">
      <div>
        <h4>Automatische Checks</h4>
        <ul class="checks">${(r.checks ?? []).map((c) => `<li><span class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span> ${esc(c.label)}${c.detail ? ` <span class="muted small">${esc(c.detail)}</span>` : ''}</li>`).join('') || '<li class="muted">–</li>'}</ul>
      </div>
      <div>
        <h4>Manuelle Bewertung</h4>
        ${
          r.manual
            ? `<table class="rubric"><tbody>${rubric
                .map((x) => `<tr><th title="${esc(x.hint ?? '')}">${esc(x.label)}</th><td class="star">${r.manual.ratings?.[x.id] ? '★'.repeat(r.manual.ratings[x.id]) + '<span class="dim">' + '★'.repeat(5 - r.manual.ratings[x.id]) + '</span>' : '–'}</td></tr>`)
                .join('')}</tbody></table>${r.manual.notes ? `<p class="notes">${esc(r.manual.notes)}</p>` : ''}`
            : '<p class="muted small">Noch nicht bewertet.</p>'
        }
      </div>
    </div>
    ${tools ? `<div class="chips">${tools}</div>` : ''}
    <details><summary>Aufgabe</summary><pre>${esc(r.prompt ?? DATA.scenarios[r.scenario.id]?.prompt ?? '')}</pre></details>
    ${r.final ? `<details><summary>Letzte Antwort des Agents</summary><pre>${esc(r.final)}</pre></details>` : ''}
    ${(r.errors ?? []).length ? `<details><summary>Fehler (${r.errors.length})</summary><pre>${esc(r.errors.join('\n'))}</pre></details>` : ''}
    ${(r.console ?? []).length ? `<details><summary>Browser-Konsole (${r.console.length})</summary><pre>${esc(r.console.map((c) => `[${c.type ?? c.level ?? 'log'}] ${c.text ?? c}`).join('\n'))}</pre></details>` : ''}
    ${r.systemPrompt?.text ? `<details><summary>System Prompt „${esc(r.systemPrompt.name)}“</summary><pre>${esc(r.systemPrompt.text)}</pre></details>` : ''}
    <details><summary>Dateien (${(r.artifacts ?? []).length})</summary><ul class="files">${(r.artifacts ?? []).map((a) => `<li><a href="${base}/work/${esc(a.path)}">${esc(a.path)}</a> <span class="muted">${bytes(a.size)}</span></li>`).join('')}</ul></details>
  </article>`;
}

async function modelPage(slug) {
  const m = DATA.models[slug];
  if (!m) return notFound();
  const recipe = DATA.recipes[m.recipe] ?? null;
  const ext = DATA.external[m.recipe] ?? [];
  const cfgs = DATA.configs.filter((c) => c.modelSlug === slug);
  const ids = cfgs.flatMap((c) => c.runs);
  const runs = new Map(
    (await Promise.all(ids.map((id) => fetch(`data/runs/${encodeURIComponent(id)}/run.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)))).filter(Boolean).map((r) => [r.id, r]),
  );
  const quant = recipe?.quants?.find((q) => q.file && m.file && q.file.replace(/\.gguf$/i, '') === m.file);
  const extVal = cfgs[0]?.external;

  app.innerHTML = `
    <p class="crumbs"><a href="./">← Leaderboard</a></p>
    <section class="hero model-hero">
      <div>
        <h1>${esc(m.name)}</h1>
        <p class="mono muted">${esc(m.file)}</p>
        ${recipe?.description ? `<p class="lead">${esc(recipe.description)}</p>` : ''}
        <div class="chips">
          ${recipe?.hfRepo ? `<a class="chip link" href="https://huggingface.co/${esc(recipe.hfRepo)}">🤗 ${esc(recipe.hfRepo)}</a>` : ''}
          ${chip(recipe?.license && `Lizenz ${recipe.license}`)}
          ${chip(recipe?.paramsB && `${num(recipe.paramsB, 1)} Mrd. Parameter`)}
          ${chip(quant?.size && `Datei ${bytes(quant.size)}`)}
          ${chip(recipe?.baseModel && `Basis ${recipe.baseModel}`)}
          ${recipe?.vision ? chip('Vision') : ''}${recipe?.toolCalling ? chip('Tool Calling') : ''}
        </div>
        ${recipe?.architecture ? `<p class="muted small">${esc(recipe.architecture)}</p>` : ''}
      </div>
      <div class="best">
        <span class="muted small">bester Score</span>
        ${meter(m.best, true)}
        <span class="muted small">Platz ${m.bestRank ?? '–'} von ${DATA.configs.length}</span>
      </div>
    </section>

    ${
      cfgs.length > 1
        ? `<nav class="toc">${cfgs.map((c) => `<a href="${modelUrl(slug, `config-${c.configId}`)}">#${c.rank} ${esc(c.label)}${c.thinking ? ` · ${esc(c.thinking)}` : ''}</a>`).join('')}</nav>`
        : ''
    }

    ${cfgs
      .map((c) => {
        const list = c.runs.map((id) => runs.get(id)).filter(Boolean);
        return `<section class="config" id="config-${esc(c.configId)}">
          <div class="config-head">
            <div>
              <h2>${esc(c.label)}</h2>
              <div class="chips">${configChips(c)}${chip(`Konfiguration ${c.configId}`, 'mono')}</div>
            </div>
            <div class="rankbox"><span class="muted small">Platz</span><b>${c.rank}</b></div>
          </div>
          <div class="panel scorecard">
            <div class="total">${meter(c.score, true)}<span class="muted small">Gesamt-Score</span></div>
            <div class="parts-grid">${DATA.components
              .map((k) => `<div><span class="muted small">${esc(k.label)} <span class="dim">· Gewicht ${DATA.weights[k.id]}</span></span>${meter(c.parts[k.id])}</div>`)
              .join('')}</div>
          </div>
          ${categoryPlaces(c)}
          <div class="two">
            <div class="panel"><h3>Exakte Parameter</h3>${dl(paramRows(c))}</div>
            <div class="panel"><h3>Hardware &amp; Software</h3>${dl(envRows(c))}<p class="muted small">Zuletzt gelaufen: ${dateTime(c.lastRun)}</p></div>
          </div>
          <h3 class="runs-title">Läufe (${list.length})</h3>
          ${list.map(runCard).join('')}
        </section>`;
      })
      .join('')}

    <h2>Externe Benchmarks</h2>
    ${
      ext.length
        ? `<div class="panel table-wrap"><table><thead><tr><th>Benchmark</th><th class="num">Wert</th><th>Quelle</th><th>Stand</th></tr></thead><tbody>${ext
            .map(
              (e) =>
                `<tr><td>${esc(e.benchmark)}${e.note ? `<div class="muted small">${esc(e.note)}</div>` : ''}</td><td class="num">${e.value == null ? '–' : num(e.value, 2)}</td><td><a href="${esc(e.source)}">${esc(safeHost(e.source))}</a></td><td>${date(e.date)}</td></tr>`,
            )
            .join('')}</tbody></table></div>`
        : '<p class="muted">Keine externen Werte hinterlegt.</p>'
    }
    ${extVal ? `<p class="muted small">Extern-Score ${num(extVal.value, 1)} = Mittel aus ${extVal.n} Werten${extVal.inherited ? ` des Basismodells (${esc(DATA.recipes[extVal.from]?.name ?? extVal.from)})` : ''}.</p>` : ''}`;

  // Sprung zu #config-… / #run-… nach dem Rendern
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preview]');
    if (!b) return;
    const slot = document.getElementById(`pv-${b.dataset.preview}`);
    if (slot.firstChild) {
      slot.innerHTML = '';
      b.textContent = '▶ Live ansehen';
    } else {
      slot.innerHTML = `<iframe class="preview" sandbox="allow-scripts allow-forms" src="${esc(b.dataset.src)}" title="Artefakt"></iframe>`;
      b.textContent = '■ Vorschau schließen';
    }
  });
}

function safeHost(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

/* ------------------------------------------------------------ Methode */

function method() {
  const w = DATA.weights;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  app.innerHTML = `
    <section class="hero"><h1>Methode</h1><p class="lead">Wie ein Lauf abläuft, was gemessen wird und wie der Score entsteht.</p></section>
    <div class="panel prose">
      <h2>Ablauf eines Laufs</h2>
      <p>LlamaDock lädt das Profil (Modell + Parameter) und startet den Agent <b>pi</b> im Druckmodus (<code>pi -p --mode json --no-session</code>) in einem leeren, isolierten Ordner: ohne Erweiterungen, Skills oder Kontextdateien, nur mit den Tools des Szenarios und einem Zeitlimit. Der System Prompt verbietet, außerhalb des Ordners zu suchen; Versuche werden am Lauf vermerkt.</p>
      <p>Danach öffnet ein Headless-Browser (Chrome DevTools Protocol) das Ergebnis: Konsolenfehler, Elemente, Formularverhalten, Handy-Breite, echte Tastendrücke bei Spielen, Screenshots. Die Checks sind je Szenario festgelegt. Die Rubrik (1–5 Sterne je Punkt) wird von Hand vergeben.</p>
      <p>Gemessen werden Dauer, Tokens (Prompt, Antwort, Cache), Decode-Geschwindigkeit (Median der Server-Messungen), effektive Geschwindigkeit (Antwort-Tokens pro Sekunde Modellzeit), Runden und Tool-Aufrufe. Jeder Lauf speichert die exakte Konfiguration, Hardware sowie Modell-Server- und Harness-Version.</p>
      <p><b>Eine Konfiguration</b> ist ein Modell mit exakt denselben Parametern (Server-Flags, Sampling, Thinking-Stufe, System Prompt, Tools). Läuft dasselbe Szenario mit derselben Konfiguration erneut, ersetzt der neue Lauf den alten.</p>

      <h2 id="score">Score</h2>
      <p>Jeder Teil liegt zwischen 0 und 100. Der Score ist ihr gewichteter Mittelwert; fehlt ein Teil (z. B. noch keine Bewertung), zählen die übrigen entsprechend stärker.</p>
      <table class="weights"><thead><tr><th>Teil</th><th class="num">Gewicht</th><th>Berechnung</th></tr></thead><tbody>
        <tr><td>Bewertung</td><td class="num">${w.manual} / ${total}</td><td>Mittel der Rubrik-Sterne, 1 ★ = 0, 5 ★ = 100</td></tr>
        <tr><td>Checks</td><td class="num">${w.checks} / ${total}</td><td>Anteil bestandener automatischer Checks</td></tr>
        <tr><td>Tempo</td><td class="num">${w.speed} / ${total}</td><td>Je zur Hälfte: Decode-t/s im Verhältnis zum schnellsten Lauf überhaupt, Dauer im Verhältnis zum schnellsten fertigen Lauf im selben Szenario (Zeitlimit überschritten = 0)</td></tr>
        <tr><td>Extern</td><td class="num">${w.external} / ${total}</td><td>Mittel der veröffentlichten Benchmarkwerte des Modells (Model Card, mit Quelle). Grober Anhaltspunkt: Nicht jedes Modell ist auf denselben Benchmarks gemessen.</td></tr>
      </tbody></table>
      <p>Der Score einer Konfiguration mittelt zuerst über Wiederholungen eines Szenarios, dann über die Szenarien. Der <b>Lauf-Score</b> in den Tabellen enthält den externen Teil nicht. Tempo ist relativ: Kommt ein schnelleres Modell dazu, sinkt der Tempo-Wert der anderen.</p>

      <h2 id="kategorien">Rankings nach Anwendungsfall</h2>
      <p>Jedes Szenario trägt eine oder mehrere Kategorien, externe Benchmarks werden nach Namen zugeordnet (z. B. LiveCodeBench und SWE-bench → Coding, GPQA, HLE und MMLU → Intelligence, IFEval → Writing). Innerhalb einer Kategorie zählen Bewertung, Checks und externe Werte mit denselben Gewichten wie oben, Tempo nicht.</p>
      <table class="weights"><thead><tr><th>Kategorie</th><th>Grundlage</th></tr></thead><tbody>
        <tr><td>🧠 Overall Intelligence</td><td>alle Szenarien + externe Wissens- und Reasoning-Benchmarks</td></tr>
        <tr><td>💻 Coding</td><td>Coding-Szenarien + externe Coding-Benchmarks</td></tr>
        <tr><td>⚡ Speed</td><td>nur Tempo: Decode-t/s und Dauer</td></tr>
        <tr><td>✍️ Writing &amp; Scientific Writing</td><td>Schreib-Szenarien (Artikel, wissenschaftlicher Text) + Instruction-Following-Benchmarks</td></tr>
        <tr><td>🎨 Image Gen</td><td>Szenarien, in denen der Agent über das Tool <code>generate_image</code> Bilder erzeugt (Prompt-Umsetzung, Bildqualität, Schrift im Bild)</td></tr>
        <tr><td>🖱️ Computer Use</td><td>Szenarien der Kategorie + externe GUI-Agent-Benchmarks (OSWorld-Verified, AndroidWorld, WebArena-Verified) aus den Model Cards</td></tr>
        <tr><td>🧭 Routing</td><td>Läufe über den LlamaDock-Router (Auto-Routing): der Entscheider wählt pro Aufgabe Modell und Thinking-Stufe; bewertet wird das Ergebnis aller Szenarien. Ohne solche Läufe zeigt das Ranking die Entscheider aus dem Routing-Test.</td></tr>
      </tbody></table>
      <p><b>Artificial Analysis Intelligence Index</b>: steht, wo vorhanden, bei den externen Werten der Modelle (unabhängig gemessen, <a href="https://artificialanalysis.ai/" rel="noopener">artificialanalysis.ai</a>). Er fließt nicht in den Score ein, weil nicht jedes Modell dort gelistet ist; ein Mittel aus Index und Model-Card-Werten wäre zwischen Modellen nicht vergleichbar.</p>

      <h2 id="routing">Routing-Test und Entscheider</h2>
      <p>Der Router von LlamaDock fragt ein kleines Entscheidungsmodell, wie schwer eine Aufgabe ist (Skala 0–3) und zu welchem Bereich sie gehört; daraus folgen Modell (klein/groß, Spezialprofil) und Thinking-Stufe. Dasselbe Modell prüft im Notebook-Modus, ob ein Beleg eine Aussage stützt, und dient Agents als Tool <code>decide</code> (z. B. Prompt-Injection-Prüfung).</p>
      <p>Der <b>LlamaDock-Routing-Test</b> stellt jeder Engine dieselben Fragen: Aufgaben auf Deutsch und Englisch mit von Hand gesetzter Schwierigkeit und Bereich, Texte mit und ohne versteckte Anweisungen an eine KI, und Beleg-Aussage-Paare (gestützt / nicht gestützt). Gemessen werden die Trennschärfe (AUC) der Schwierigkeit für klein/groß, die Genauigkeit bei der verwendeten Schwelle, die Bereichs-Genauigkeit, AUC und Genauigkeit für Prompt Injection und Belege sowie die Latenz auf der CPU. Das Testset ist klein und von Hand beschriftet: ein Plausibilitätstest, kein Ersatz für einen großen Benchmark.</p>
      <p>Extern steht daneben <b>JevBench</b> von Benchmark Heaven: 534 öffentliche und 308 versiegelte Entscheidungen, Score als harmonisches Mittel aus Intelligence, Calibration, Speed und Cost.</p>
    </div>

    <h2>Szenarien</h2>
    ${Object.values(DATA.scenarios)
      .map(
        (s) => `<div class="panel scenario"><div class="config-head"><h3>${esc(s.name)}</h3>${chip(`v${s.version ?? 1}`)}</div><p class="muted">${esc(s.description ?? '')}</p>
        <div class="chips">${(s.categories ?? []).map((c) => chip((DATA.categories ?? []).find((x) => x.id === c)?.label ?? c, 'cat-chip')).join('')}${(s.tools ?? []).map((t) => chip(t)).join('')}${chip(s.timeLimitSec && `Zeitlimit ${fmtS(s.timeLimitSec * 1000)}`)}</div>
        <div class="cols"><div><h4>Checks</h4><ul class="small">${(s.checks ?? []).map((c) => `<li>${esc(c.label)}</li>`).join('')}</ul></div>
        <div><h4>Rubrik</h4><ul class="small">${(s.rubric ?? []).map((c) => `<li><b>${esc(c.label)}</b>: ${esc(c.hint ?? '')}</li>`).join('')}</ul></div></div>
        <details><summary>Aufgabe</summary><pre>${esc(s.prompt)}</pre></details></div>`,
      )
      .join('')}`;
}

function notFound() {
  app.innerHTML = '<h1>Nicht gefunden</h1><p><a href="./">Zum Leaderboard</a></p>';
}

async function main() {
  document.querySelector(`[data-nav="${PAGE}"]`)?.classList.add('active');
  try {
    await load();
  } catch (e) {
    return noData(e.message);
  }
  if (PAGE === 'model') await modelPage(document.body.dataset.model);
  else if (PAGE === 'method') method();
  else board();
  // Alte Hash-Links (#/model/<id>, #/run/<id>) der ersten Version weiterleiten
  const old = location.hash.match(/^#\/(model|run)\/(.+)$/);
  if (old && PAGE === 'board') {
    const run = DATA.runs.find((r) => r.id === decodeURIComponent(old[2]));
    const cfg = DATA.configs.find((c) => c.profile?.id === decodeURIComponent(old[2]));
    if (run) location.href = runUrl(run);
    else if (cfg) location.href = modelUrl(cfg.modelSlug, `config-${cfg.configId}`);
  }
}

main();
