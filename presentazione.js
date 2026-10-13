// La pagina di presentazione (Chiara, 07/10/2026): riempie la pagina coi dati
// veri — niente numeri scritti a mano — e fa girare la ruota vera.
// Legge: NOVITA (novita.js), FRASI (frasi-nostre.js), GRUPPI_FRASI, GRUPPI_DI_DEFAULT,
// SPECIALI_TUTTI, MAX_GIOCATORI, MAX_PER_SQUADRA (config.js), pillola() (speciali-comuni.js),
// Ruota (ruota.js, con fisica-ruota.js). Non tocca niente.
// Ogni riempimento e` protetto: se un segnaposto nella pagina manca (un testo riscritto
// senza il suo numero), si salta quel pezzo e lo script va avanti fino alla ruota.
'use strict';
(function () {
  const $ = (s) => document.querySelector(s);
  const setTesto = (s, t) => { document.querySelectorAll(s).forEach((e) => { e.textContent = t; }); };
  const setHtml = (s, t) => { document.querySelectorAll(s).forEach((e) => { e.innerHTML = t; }); };
  const parametri = new URLSearchParams(location.search);

  // ?fallback: i caratteri di ripiego, come li vede chi non ha Ubuntu e Lato (solo per guardare)
  if (parametri.has('fallback')) {
    document.documentElement.style.setProperty('--font-titoli', 'Arial, sans-serif');
    document.documentElement.style.setProperty('--font-testo', 'Arial, sans-serif');
  }

  // la versione, da novita.js (generato da CHANGELOG.md)
  if (typeof NOVITA !== 'undefined' && NOVITA.versioni && NOVITA.versioni.length) {
    setTesto('#versione-gioco', 'v ' + NOVITA.versioni[0].versione);
  }

  // quante frasi, dal mazzo vero
  if (typeof FRASI !== 'undefined') setTesto('#conta-frasi', String(FRASI.length));

  // i gruppi di frasi, coi nomi di config.js; acceso quello di default
  if (typeof GRUPPI_FRASI !== 'undefined') {
    setHtml('#pillole-gruppi', GRUPPI_FRASI.map((g) =>
      `<span class="pillola-gruppo${(GRUPPI_DI_DEFAULT || []).includes(g.valore) ? ' scelto' : ''}">${g.nome}</span>`).join(''));
  }

  // quanti giocatori, da config.js
  setTesto('#max-giocatori, .max-giocatori', String(MAX_GIOCATORI));
  setTesto('#max-per-squadra', String(MAX_PER_SQUADRA));

  // gli spicchi speciali: le pillole con il simbolo. pillola() e le variabili --speciale*
  // stanno in speciali-comuni.js (una copia sola, la usa anche gioco.js).
  setHtml('#pillole-speciali', SPECIALI_TUTTI.map(pillola).join(''));

  // «Come si gioca», le due versioni (13/10/2026): i meeple dei pezzi in piccolo del Percorso, dalla sagoma vera di config.js (MEEPLE), come nella
  // carta «Percorso» del gioco: contorno bianco, colore del meeple; il fantasma e` lo stesso, tratteggiato e piu` chiaro.
  if (typeof MEEPLE !== 'undefined' && MEEPLE.length) {
    const m = MEEPLE[0];
    const pieno = '<g transform="translate(4 3.5) scale(0.9)"><g fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">' + m.sagoma + '</g><g fill="' + m.colore + '">' + m.sagoma + '</g></g>';
    const fantasma = '<g transform="translate(104 3.5) scale(0.9)" opacity="0.55"><g fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="4 3" stroke-linejoin="round">' + m.sagoma + '</g><g fill="' + m.colore + '" opacity="0.75">' + m.sagoma + '</g></g>';
    setHtml('#passi-percorso .mp-pieno', pieno);
    setHtml('#passi-percorso .mp-fantasma', fantasma);
  }

  // le linguette Classica / Percorso: una versione alla volta (senza questo script restano tutte e due, una sotto l'altra)
  (function () {
    const barra = $('.linguette-partita');
    const classica = $('#passi-classica'), percorso = $('#passi-percorso');
    const lc = $('#linguetta-classica'), lp = $('#linguetta-percorso');
    if (!barra || !classica || !percorso || !lc || !lp) return;
    const mostra = (percorsoScelto) => {
      classica.hidden = percorsoScelto;
      percorso.hidden = !percorsoScelto;
      [[lc, !percorsoScelto], [lp, percorsoScelto]].forEach(([b, su]) => {
        b.classList.toggle('selezionata', su);
        b.setAttribute('aria-selected', su ? 'true' : 'false');
        b.tabIndex = su ? 0 : -1;
      });
    };
    lc.addEventListener('click', () => mostra(false));
    lp.addEventListener('click', () => mostra(true));
    barra.addEventListener('keydown', (ev) => { // frecce sinistra/destra come in ogni gruppo di linguette
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      const p = ev.key === 'ArrowRight';
      mostra(p); (p ? lp : lc).focus();
    });
    barra.hidden = false;
    mostra(false);
  })();

  // la ruota vera (round 1, senza speciali, come a inizio partita). Parte da sola una volta,
  // dopo 700 ms, come se qualcuno l'avesse spinta: dice «e` una ruota» senza una parola.
  // Non parte da sola se chi guarda ha chiesto meno movimento; si tocca e gira di nuovo.
  const canvas = $('#canvas-ruota');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Ruota.init(canvas, $('.puntatore'));
  const gira = () => {
    if (Ruota.inAnimazione()) return;
    canvas.classList.add('gira');
    Ruota.gira(undefined, () => {}, () => { canvas.classList.remove('gira'); });
  };
  canvas.addEventListener('click', gira);
  if (!menoMovimento && !parametri.has('ferma')) window.setTimeout(gira, 700);
  window.Presentazione = { gira };
})();
