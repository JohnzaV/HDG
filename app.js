/* Heading Lab: buildless, browser-local training. */
(() => {
  'use strict';
  const M = window.HeadingMath;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = {green: '#b5db8b', cyan: '#95d8e0', red: '#fb8f91', muted: '#9bb0bd'};
  const CENTER = {x: 450, y: 380};
  const DEFAULT = {rose: 90, showDegrees: false, step: 15, tolerance: 5, mode: 'practice', duration: 120};
  const STORAGE_SETTINGS = 'heading-lab.settings.v1';
  const STORAGE_HISTORY = 'heading-lab.history.v1';
  const FIXES = ['LUMEN', 'VEXOR', 'NOKTA', 'RAVIK', 'MAVEN', 'TOLIX', 'NERVO', 'BEXAL', 'ROMIK', 'KAVEN', 'VILOR', 'DOMEX'];
  const AIRCRAFT = [
    {call: 'CSA42A', type: 'A320', level: 180, speed: 240},
    {call: 'BAW73K', type: 'A319', level: 210, speed: 280},
    {call: 'DLH8TX', type: 'A320', level: 200, speed: 260},
    {call: 'LOT6CP', type: 'E190', level: 160, speed: 230},
    {call: 'TVS21M', type: 'B738', level: 190, speed: 250}
  ];
  let storageAvailable = true;
  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { storageAvailable = false; return fallback; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { storageAvailable = false; }
  }
  function validConfig(raw, fallbackShowDegrees = DEFAULT.showDegrees) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      rose: [0, 30, 90].includes(source.rose) ? source.rose : DEFAULT.rose,
      showDegrees: typeof source.showDegrees === 'boolean' ? source.showDegrees : fallbackShowDegrees,
      step: [5, 15, 30].includes(source.step) ? source.step : DEFAULT.step,
      tolerance: Number.isInteger(source.tolerance) && source.tolerance >= 0 && source.tolerance <= 15 ? source.tolerance : DEFAULT.tolerance,
      mode: source.mode === 'timed' ? 'timed' : 'practice',
      duration: [60, 120, 180].includes(source.duration) ? source.duration : DEFAULT.duration
    };
  }
  function validHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(item => item && typeof item.date === 'string' && Number.isFinite(Date.parse(item.date)) && Array.isArray(item.records))
      .slice(0, 20).map(item => ({
        date: new Date(item.date).toISOString(), config: validConfig(item.config, true),
        records: item.records.filter(r => r && Number.isInteger(r.target) && r.target >= 0 && r.target < 360 &&
          (r.answer === null || (Number.isInteger(r.answer) && r.answer >= 0 && r.answer < 360)) && Number.isFinite(r.seconds) && r.seconds >= 0)
          .slice(0, 10000).map(r => ({...M.assess(r.answer, r.target, validConfig(item.config).tolerance), seconds: r.seconds}))
      })).filter(item => item.records.length);
  }
  let settings = validConfig(readStorage(STORAGE_SETTINGS, DEFAULT));
  let history = validHistory(readStorage(STORAGE_HISTORY, []));
  let activeConfig = {...settings};
  let phase = 'idle';
  let paused = false;
  let records = [];
  let target = 315;
  let radius = 245;
  let fixIndex = 0;
  let aircraft = {...AIRCRAFT[0], heading: 90};
  let questionSeconds = 0;
  let remaining = settings.duration;
  let lastTick = performance.now();
  let expired = false;
  let latestResult = null;
  let sessionDate = null;

  const isActive = () => phase === 'aim' || phase === 'review';
  const currentConfig = () => isActive() ? activeConfig : settings;
  const decimal = value => value === null ? '—' : value.toLocaleString('cs-CZ', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const countText = value => `${value} ${value === 1 ? 'cíl' : value >= 2 && value <= 4 ? 'cíle' : 'cílů'}`;
  const escapeText = text => String(text).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));

  function svgElement(name, attributes, text) {
    const element = document.createElementNS(NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function line(parent, from, to, attributes = {}) {
    parent.append(svgElement('line', {x1: from.x, y1: from.y, x2: to.x, y2: to.y, ...attributes}));
  }
  function label(parent, position, text, attributes = {}) {
    parent.append(svgElement('text', {x: position.x, y: position.y, fill: COLORS.muted, 'font-family': 'Consolas, monospace', 'font-size': 19, 'text-anchor': 'middle', 'dominant-baseline': 'middle', ...attributes}, text));
  }
  function renderRose() {
    const parent = $('rose');
    parent.replaceChildren();
    const step = currentConfig().rose;
    if (!step) return;
    parent.append(svgElement('circle', {cx: CENTER.x, cy: CENTER.y, r: 299, fill: 'none', stroke: '#70838f', 'stroke-width': 1, opacity: .4}));
    for (let heading = 0; heading < 360; heading += step) {
      const cardinal = heading % 90 === 0;
      line(parent, M.point(heading, cardinal ? 284 : 290), M.point(heading, 303), {stroke: cardinal ? '#b6c7d0' : '#8296a3', 'stroke-width': cardinal ? 1.6 : 1.2});
      if (currentConfig().showDegrees) label(parent, M.point(heading, 331), M.format(heading), {fill: cardinal ? '#bbcbd4' : '#8da3b0', 'font-size': cardinal ? 21 : 18});
    }
  }
  function renderAircraft() {
    const parent = $('aircraft');
    parent.replaceChildren();
    const p = M.point(target, radius);
    const side = p.x >= CENTER.x ? -1 : 1;
    const vertical = p.y >= CENTER.y ? -1 : 1;
    const anchor = side === 1 ? 'start' : 'end';
    const labelX = CENTER.x + side * 54;
    const labelY = CENTER.y + vertical * 58;
    for (const r of [20, 34, 48]) {
      const ghost = M.point(aircraft.heading + 180, r);
      parent.append(svgElement('circle', {cx: ghost.x, cy: ghost.y, r: 2.2, fill: COLORS.cyan, opacity: 1 - r / 65}));
    }
    line(parent, CENTER, M.point(aircraft.heading, 48), {stroke: COLORS.cyan, 'stroke-width': 1.8, opacity: .85});
    parent.append(svgElement('path', {d: `M450 380 L${450 + side * 30} ${380 + vertical * 35} H${labelX}`, fill: 'none', stroke: COLORS.cyan, 'stroke-width': 1.1, opacity: .7}));
    parent.append(svgElement('rect', {x: 445, y: 375, width: 10, height: 10, fill: '#19252e', stroke: COLORS.cyan, 'stroke-width': 1.8}));
    label(parent, {x: labelX, y: labelY}, aircraft.call, {fill: COLORS.cyan, 'text-anchor': anchor, 'font-size': 20});
    label(parent, {x: labelX, y: labelY + 24}, `${aircraft.level}  ${aircraft.speed}`, {fill: COLORS.cyan, 'text-anchor': anchor, 'font-size': 17});
    label(parent, {x: labelX, y: labelY + 47}, `${aircraft.type}  H${M.format(aircraft.heading)}`, {fill: '#779ba7', 'text-anchor': anchor, 'font-size': 14});
  }
  function renderWaypoint() {
    const parent = $('waypoint');
    const p = M.point(target, radius);
    parent.replaceChildren();
    parent.append(svgElement('path', {d: `M${p.x} ${p.y - 9} l8 14 h-16 Z`, fill: '#19252e', stroke: COLORS.green, 'stroke-width': 1.8}));
    const right = p.x < 700;
    label(parent, {x: p.x + (right ? 16 : -16), y: p.y - 1}, FIXES[fixIndex], {fill: COLORS.green, 'text-anchor': right ? 'start' : 'end', 'font-size': 20});
  }
  function renderSolution() {
    const parent = $('solution');
    parent.replaceChildren();
    $('scope-legend').hidden = phase !== 'review';
    if (phase !== 'review' || !latestResult) return;
    const result = latestResult;
    if (result.answer !== null) {
      const userPoint = M.point(result.answer, radius + 17);
      line(parent, CENTER, userPoint, {stroke: COLORS.red, 'stroke-width': 2, 'stroke-dasharray': '8 6'});
      if (result.error >= 12) {
        const pos = M.point(result.answer, radius + 41);
        label(parent, pos, `${M.format(result.answer)}°`, {fill: COLORS.red, 'font-size': 17});
      }
      if (result.error > 0) {
        const start = M.point(target, 68);
        const end = M.point(result.answer, 68);
        parent.append(svgElement('path', {d: `M450 380 L${start.x} ${start.y} A68 68 0 0 ${result.delta >= 0 ? 1 : 0} ${end.x} ${end.y} Z`, fill: '#fb8f911c', stroke: 'none'}));
        parent.append(svgElement('path', {d: `M${start.x} ${start.y} A68 68 0 0 ${result.delta >= 0 ? 1 : 0} ${end.x} ${end.y}`, fill: 'none', stroke: COLORS.red, 'stroke-width': 1.2, opacity: .75}));
      }
    }
    line(parent, CENTER, M.point(target, radius - 12), {stroke: COLORS.green, 'stroke-width': 2});
    const labelPosition = M.point(target, radius * .69);
    label(parent, {x: labelPosition.x + 13, y: labelPosition.y - 13}, `${M.format(target)}°`, {fill: COLORS.green, 'font-size': 18, 'text-anchor': 'start', stroke: '#19252e', 'stroke-width': 5, 'paint-order': 'stroke fill'});
    $('user-legend').hidden = result.answer === null;
    $('user-legend').innerHTML = `<i class="user-line"></i>${result.error === 0 ? 'Tvůj heading · shodný' : 'Tvůj heading'}`;
  }
  function renderRadar() {
    renderRose(); renderSolution(); renderWaypoint(); renderAircraft();
    const cfg = currentConfig();
    $('config-rose').textContent = cfg.rose ? `RŮŽICE ${cfg.rose}°` : 'BEZ RŮŽICE';
    $('config-step').textContent = `CÍLE PO ${cfg.step}°`;
    $('config-tolerance').textContent = `TOLERANCE ±${cfg.tolerance}°`;
  }

  function renderSettings() {
    document.querySelectorAll('[data-setting]').forEach(button => {
      const selected = String(settings[button.dataset.setting]) === button.dataset.value;
      button.setAttribute('aria-pressed', String(selected));
    });
    $('rose-numbers').checked = settings.showDegrees;
    $('tolerance').value = settings.tolerance;
    $('tolerance-output').textContent = `±${settings.tolerance}°`;
    $('duration').value = settings.duration;
    $('duration-setting').hidden = settings.mode !== 'timed';
    $('settings-fields').disabled = isActive();
    $('settings-status').textContent = isActive() ? 'UZAMČENO' : 'VLASTNÍ';
    $('settings-note').textContent = isActive() ? 'Nastavení zůstává stejné po celé cvičení. Pro změnu cvičení ukonči.' : 'Růžici a krok cílů můžeš libovolně kombinovat.';
    $('start-note').textContent = settings.mode === 'practice' ? 'Bez limitu. Vlastním tempem.' : `${settings.duration} sekund odpovídání. Rozbor bez limitu.`;
  }
  function renderStats() {
    const summary = M.summarize(records);
    $('hits').innerHTML = `${summary.hits} <em>/ ${summary.total}</em>`;
    $('accuracy').innerHTML = `${summary.accuracy ?? '—'}<small>%</small>`;
    $('mean-error').innerHTML = `${decimal(summary.meanError)}<small>°</small>`;
    $('mean-time').innerHTML = `${decimal(summary.meanTime)}<small>s</small>`;
    const recent = records.slice(-6);
    $('recent-answers').innerHTML = recent.length ? recent.map(record => `<span class="answer-chip ${record.hit ? '' : 'miss'}" title="Správně ${M.format(record.target)}°, zadáno ${record.answer === null ? 'bez odpovědi' : M.format(record.answer) + '°'}, odchylka ${record.error === null ? '—' : record.error + '°'}">${record.hit ? '✓' : '×'} ${M.format(record.target)}</span>`).join('') : '<span class="muted">Tvoje odpovědi se objeví tady.</span>';
  }
  function renderClock() {
    const timed = isActive() && activeConfig.mode === 'timed';
    if (timed) {
      const display = Math.ceil(remaining);
      $('round-clock').textContent = `${String(Math.floor(display / 60)).padStart(2, '0')}:${String(display % 60).padStart(2, '0')}`;
    } else {
      $('round-clock').textContent = `${questionSeconds.toFixed(1)} s`;
    }
    $('time-fill').style.width = timed ? `${remaining / activeConfig.duration * 100}%` : '0%';
    $('time-fill').classList.toggle('warning', timed && remaining <= 15);
  }
  function feedbackHTML(result) {
    const exact = result.error === 0;
    const title = result.answer === null ? 'Čas vypršel' : exact ? 'Přesně na bod.' : result.hit ? 'V toleranci.' : 'Mimo toleranci.';
    const delta = result.error === null ? '—' : `${result.delta > 0 ? '+' : result.delta < 0 ? '−' : ''}${result.error}°`;
    const description = result.answer === null ? 'Tento cíl se počítá jako chyba. Zelená spojnice ukazuje správný směr.' : exact ? 'Tvůj heading se shoduje se správným směrem.' : `Tvůj heading je o ${result.error}° ${result.delta > 0 ? 'vpravo' : 'vlevo'} od správného směru.${result.error === 180 ? ' Je to opačný směr.' : ''}`;
    return `<div class="feedback-title"><span>${title}</span><span>${delta}</span></div><div class="feedback-values"><div><span>SPRÁVNĚ</span><strong>${M.format(result.target)}°</strong></div><div><span>TVŮJ HEADING</span><strong class="${exact ? '' : 'wrong'}">${result.answer === null ? '—' : M.format(result.answer) + '°'}</strong></div></div><p class="feedback-description">${description}</p>`;
  }
  function renderControls() {
    const active = isActive();
    const review = phase === 'review';
    $('phase-badge').textContent = paused ? 'PAUZA' : phase === 'aim' ? 'ODHAD HEADINGU' : review ? 'ROZBOR' : phase === 'finished' ? 'DOKONČENO' : 'PŘIPRAVENO';
    $('round-label').textContent = active ? `CÍL ${review ? records.length : records.length + 1} / ${activeConfig.mode === 'practice' ? 'TRÉNINK' : 'TEST'}` : phase === 'finished' ? 'DOKONČENÉ CVIČENÍ' : 'TVÉ CVIČENÍ';
    $('task-title').textContent = active ? `${aircraft.call} → ${FIXES[fixIndex]}` : phase === 'finished' ? 'Další cvičení?' : 'Každý stupeň se počítá.';
    $('task-copy').innerHTML = active ? review ? 'Porovnej oba směry. Pokračuj, až si odpověď projdeš.' : `Jaký heading přivede letadlo <b>${aircraft.call}</b> k waypointu <b>${FIXES[fixIndex]}</b>?` : phase === 'finished' ? 'Uprav si obtížnost, nebo zkus stejnou kombinaci ještě jednou.' : 'Odhadni heading z letadla k waypointu. Nastav si podmínky a začni.';
    $('answer-area').hidden = phase !== 'aim';
    $('heading-input').disabled = paused || phase !== 'aim';
    $('keypad').querySelectorAll('button').forEach(button => { button.disabled = paused || phase !== 'aim'; });
    $('feedback').hidden = !review;
    $('feedback').classList.toggle('miss', review && !latestResult?.hit);
    if (review) $('feedback').innerHTML = feedbackHTML(latestResult);
    $('main-action').innerHTML = phase === 'aim' ? 'Potvrdit heading <span>↵</span>' : review ? `${expired ? 'Zobrazit výsledky' : 'Další waypoint'} <span>↵</span>` : 'Zahájit trénink <span>↗</span>';
    $('main-action').disabled = paused;
    $('end-button').hidden = !active;
    $('start-note').hidden = active;
    $('pause-button').disabled = !active;
    $('pause-button').textContent = paused ? 'Pokračovat' : 'Pauza';
    $('pause-overlay').hidden = !paused;
    $('scope').setAttribute('aria-label', paused ? 'Cvičení pozastaveno' : 'Radarový obraz');
    renderSettings(); renderClock();
  }
  function focusInput() {
    if (matchMedia('(min-width: 781px)').matches && navigator.maxTouchPoints === 0) $('heading-input').focus({preventScroll: true});
  }
  function nextTarget() {
    target = M.pickHeading(activeConfig.step, target);
    radius = 211 + Math.random() * 43;
    fixIndex = (fixIndex + 1 + Math.floor(Math.random() * (FIXES.length - 1))) % FIXES.length;
    aircraft = {...AIRCRAFT[Math.floor(Math.random() * AIRCRAFT.length)], heading: Math.floor(Math.random() * 72) * 5};
    questionSeconds = 0;
    latestResult = null;
    phase = 'aim'; paused = false;
    lastTick = performance.now();
    $('heading-input').value = '';
    $('heading-input').removeAttribute('aria-invalid');
    $('input-error').textContent = '';
    renderRadar(); renderControls(); focusInput();
  }
  function startSession() {
    activeConfig = {...settings};
    records = [];
    sessionDate = new Date().toISOString();
    remaining = activeConfig.duration;
    expired = false;
    if ($('results-dialog').open) $('results-dialog').close();
    nextTarget(); renderStats();
  }
  function tick() {
    const now = performance.now();
    if (phase === 'aim' && !paused) {
      const dt = Math.max(0, (now - lastTick) / 1000);
      const elapsed = activeConfig.mode === 'timed' ? Math.min(dt, remaining) : dt;
      questionSeconds += elapsed;
      if (activeConfig.mode === 'timed') {
        remaining = Math.max(0, remaining - dt);
        if (remaining <= 0) {
          expired = true;
          grade(null);
        }
      }
    }
    lastTick = now;
    renderClock();
  }
  function grade(answer) {
    if (phase !== 'aim') return;
    latestResult = {...M.assess(answer, target, activeConfig.tolerance), seconds: questionSeconds};
    records.push(latestResult);
    phase = 'review';
    if (answer !== null) $('heading-input').value = M.format(answer);
    renderStats(); renderRadar(); renderControls();
    if (matchMedia('(min-width: 781px)').matches) $('main-action').focus({preventScroll: true});
  }
  function submitAnswer() {
    tick();
    if (phase !== 'aim' || paused) return;
    const answer = M.parse($('heading-input').value);
    if (answer === null) {
      $('input-error').textContent = 'Zadej heading od 000 do 360.';
      $('heading-input').setAttribute('aria-invalid', 'true');
      focusInput(); return;
    }
    grade(answer);
  }
  function mainAction() {
    if (paused) return;
    if (phase === 'idle' || phase === 'finished') startSession();
    else if (phase === 'aim') submitAnswer();
    else if (expired) finishSession();
    else nextTarget();
  }
  function setPaused(value) {
    if (!isActive() || value === paused) return;
    tick();
    paused = value;
    lastTick = performance.now();
    renderControls();
    if (paused) $('resume-button').focus({preventScroll: true});
    else if (phase === 'aim') focusInput();
    else if (phase === 'review') $('main-action').focus({preventScroll: true});
  }
  function finishSession() {
    if (!isActive()) return;
    tick();
    const completed = {date: sessionDate, config: {...activeConfig}, records: [...records]};
    phase = 'finished'; paused = false;
    if (completed.records.length) {
      history.unshift(completed); history = history.slice(0, 20);
      writeStorage(STORAGE_HISTORY, history);
    }
    $('solution').replaceChildren();
    $('scope-legend').hidden = true;
    renderRose(); renderControls();
    showSession(completed);
  }
  function configDescription(cfg) {
    return `${cfg.rose ? 'Růžice ' + cfg.rose + '° ' + (cfg.showDegrees ? 's čísly' : 'bez čísel') : 'Bez růžice'} · cíle po ${cfg.step}° · tolerance ±${cfg.tolerance}° · ${cfg.mode === 'timed' ? 'test ' + cfg.duration + ' s' : 'volný trénink'}`;
  }
  function showSession(session) {
    const summary = M.summarize(session.records);
    $('results-eyebrow').textContent = 'DEBRIEFING';
    $('results-title').textContent = summary.total ? 'Každý cíl je zkušenost.' : 'Zatím bez odpovědí.';
    const rows = session.records.map((r, i) => `<tr><td>${i + 1}</td><td>${M.format(r.target)}°</td><td>${r.answer === null ? 'ČAS' : M.format(r.answer) + '°'}</td><td class="${r.hit ? 'hit' : 'miss'}">${r.error === null ? '—' : r.error + '°'}</td><td>${decimal(r.seconds)} s</td></tr>`).join('');
    $('results-content').innerHTML = `<div class="results-config">${configDescription(session.config)}</div><div class="result-metrics"><div class="result-metric"><span>ZÁSAHY</span><strong>${summary.hits}<small> / ${summary.total}</small></strong></div><div class="result-metric"><span>ÚSPĚŠNOST</span><strong>${summary.accuracy ?? '—'}<small> %</small></strong></div><div class="result-metric"><span>PRŮM. ODCHYLKA</span><strong>${decimal(summary.meanError)}<small> °</small></strong></div><div class="result-metric"><span>PRŮM. ČAS ODPOVĚDI</span><strong>${decimal(summary.meanTime)}<small> s</small></strong></div></div>${summary.total ? `<div class="table-wrap"><table class="result-table"><thead><tr><th>#</th><th>Správně</th><th>Zadáno</th><th>Odchylka</th><th>Čas</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p>Zahaj nové cvičení a zkus první waypoint.</p>'}<p class="small-copy muted">Průměrná odchylka a čas se počítají ze zadaných odpovědí. Vypršení času snižuje úspěšnost.</p><button class="primary" id="again-button">Nové cvičení ↗</button>`;
    if (isActive()) $('again-button').textContent = 'Zpět k tréninku';
    $('again-button').addEventListener('click', () => { $('results-dialog').close(); if (isActive()) return; startSession(); });
    if (!$('results-dialog').open) $('results-dialog').showModal();
  }
  function showHistory() {
    if (isActive() && !paused) setPaused(true);
    $('results-eyebrow').textContent = 'HISTORIE';
    $('results-title').textContent = 'Tvoje poslední cvičení.';
    $('results-content').innerHTML = history.length ? history.map((session, index) => {
      const summary = M.summarize(session.records);
      const date = new Date(session.date).toLocaleString('cs-CZ', {day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit'});
      return `<div class="history-row"><div><time>${escapeText(date)}</time><strong>${summary.accuracy}%</strong></div><p>${countText(summary.total)} · odchylka ${decimal(summary.meanError)}° · ${decimal(summary.meanTime)} s<br>${configDescription(session.config)}</p><button class="text-button" data-session="${index}">Zobrazit odpovědi ↗</button></div>`;
    }).join('') : `<p>${storageAvailable ? 'Po dokončení prvního cvičení tu najdeš jeho výsledky. Ukládá se posledních 20 cvičení v tomto prohlížeči.' : 'Ukládání historie není v tomto prohlížeči dostupné. Samotný trénink funguje dál.'}</p>`;
    document.querySelectorAll('[data-session]').forEach(button => button.addEventListener('click', () => showSession(history[Number(button.dataset.session)])));
    $('results-dialog').showModal();
  }

  function updateSettings(key, value) {
    if (isActive()) return;
    settings = validConfig({...settings, [key]: value});
    writeStorage(STORAGE_SETTINGS, settings);
    // Keep the ready-state example on the selected target grid as well.
    target = M.normalize(Math.round(target / settings.step) * settings.step);
    renderSettings(); renderRadar();
  }
  document.querySelectorAll('[data-setting]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.setting;
    updateSettings(key, key === 'mode' ? button.dataset.value : Number(button.dataset.value));
  }));
  $('rose-numbers').addEventListener('change', event => updateSettings('showDegrees', event.target.checked));
  $('tolerance').addEventListener('input', event => updateSettings('tolerance', Number(event.target.value)));
  $('duration').addEventListener('change', event => updateSettings('duration', Number(event.target.value)));
  $('heading-input').addEventListener('input', event => {
    event.target.value = event.target.value.replace(/[^0-9]/g, '').slice(0, 3);
    $('input-error').textContent = '';
    event.target.removeAttribute('aria-invalid');
  });
  function typeKey(key) {
    if (phase !== 'aim' || paused) return;
    const input = $('heading-input');
    if (key === 'clear') input.value = '';
    else if (key === 'backspace') input.value = input.value.slice(0, -1);
    else if (input.value.length < 3) input.value += key;
    $('input-error').textContent = '';
    input.removeAttribute('aria-invalid');
  }
  $('keypad').addEventListener('click', event => {
    const button = event.target.closest('[data-key]');
    if (button) typeKey(button.dataset.key);
  });
  $('main-action').addEventListener('click', mainAction);
  $('end-button').addEventListener('click', finishSession);
  $('pause-button').addEventListener('click', () => setPaused(!paused));
  $('resume-button').addEventListener('click', () => setPaused(false));
  $('history-button').addEventListener('click', showHistory);
  $('help-button').addEventListener('click', () => {
    if (isActive() && !paused) setPaused(true);
    $('help-dialog').showModal();
  });
  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  }));
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
    if (event.key.toLowerCase() === 'p' && isActive()) { event.preventDefault(); setPaused(!paused); return; }
    if (paused) return;
    const focused = event.target;
    const isHeading = focused === $('heading-input');
    const isFormControl = focused.matches('input, select, textarea');
    if (event.key === 'Enter' && (isHeading || focused === document.body || focused === $('main-action') || focused.closest('#keypad'))) {
      event.preventDefault(); if (!event.repeat) mainAction(); return;
    }
    if (phase === 'aim' && !isHeading && !isFormControl && /^\d$/.test(event.key)) { event.preventDefault(); typeKey(event.key); }
    if (phase === 'aim' && !isHeading && !isFormControl && event.key === 'Backspace') { event.preventDefault(); typeKey('backspace'); }
    if (phase === 'aim' && event.key === 'Escape') { event.preventDefault(); typeKey('clear'); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'aim' && !paused) setPaused(true);
  });
  function updateUtc() { $('utc').textContent = new Date().toISOString().slice(11, 19); }
  renderSettings(); renderRadar(); renderStats(); renderControls(); updateUtc();
  setInterval(tick, 100);
  setInterval(updateUtc, 1000);
})();
