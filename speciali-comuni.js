// ----------------------------------------------------------------------------
// GLI SPICCHI SPECIALI, la parte che serve a due pagine (07/10/2026).
// Prima stava in gioco.js (2.4, disegno di Chiara del 06/10); la pagina di
// presentazione (index.html) mostra le stesse pillole e non puo` caricare
// gioco.js, che vuole il DOM della partita. Una copia sola, qui: la caricano
// gioco.html e index.html, dopo config.js e prima di gioco.js / presentazione.js.
// Il tracciato di ogni simbolo sta in SPECIALI (config.js): qui lo stesso
// disegno come <svg>.
// ----------------------------------------------------------------------------
function svgSimbolo(chiave) {
  return svgDaDefinizione(definizioneSpeciale(chiave));
}
// Le caselle speciali del Percorso (config.js, CASELLE_PERCORSO) hanno lo stesso tipo di simbolo.
function svgCasella(tipo) {
  return svgDaDefinizione(CASELLE_PERCORSO[tipo]);
}
function svgDaDefinizione(sp) {
  const parti = sp.simbolo.map((p) => {
    if (p.testo) return `<text x="50" y="54" text-anchor="middle" dominant-baseline="central">${p.testo}</text>`;
    if (p.fill) return `<path d="${p.d}" stroke="none"${p.regola ? ` fill-rule="${p.regola}"` : ""}/>`;
    return `<path d="${p.d}" fill="none" stroke-width="${p.stroke}"/>`;
  });
  return `<svg class="simbolo-speciale" viewBox="0 0 100 100" aria-hidden="true">${parti.join("")}</svg>`;
}
function pillola(chiave) {
  return `<span class="pillola-speciale">${svgSimbolo(chiave)}${definizioneSpeciale(chiave).titolo}</span>`;
}
// Una fonte sola per i colori: config.js (COLORE_SPECIALE*), qui passati al CSS.
document.documentElement.style.setProperty("--speciale", COLORE_SPECIALE);
document.documentElement.style.setProperty("--speciale-scuro", COLORE_SPECIALE_SCURO);
