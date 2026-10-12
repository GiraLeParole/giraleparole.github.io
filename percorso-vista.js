// ============================================================================
// IL PERCORSO: LA SCENA (sesta stesura, 09/10/2026 sera)
// Il paesaggio a tutto schermo (cielo, sole, luna, nuvole, la montagna con la vetta, il prato, 88 alberi, il campo base, il sentiero
// in prospettiva con le sue pietre, le tappe e i due bivacchi alternati sopra e sotto, la bandiera), i meeple con i loro fantasmi e le
// loro tende, i chip, le tessere dei viaggiatori, il velo con la conferma della tenda e le bolle della prima volta, la passeggiata della
// sera, la mappa dell'iscrizione.
// Disegno di Chiara: design/2026-10-09-scheda-paesaggio-percorso.md e il prototipo design/prototipi/2026-10-09-paesaggio-percorso/
// (plancia in prospettiva, scena, movimenti, mondo che reagisce); prima: design/2026-10-09-scheda-percorso-partita.md. Il suo modello
// di gioco NON e' copiato: le regole sono in percorso.js; qui si racconta soltanto, un pezzo alla volta, quello che le regole hanno
// gia' deciso (la lista degli «eventi»). L'INTERFACCIA (tessere, cartello, ruota, comandi, annunci) resta quella del gioco: dal prototipo
// si porta solo il paesaggio.
// Le misure sono nelle unita` del paesaggio (viewBox 1920 x 1080). Il palco e` 16:9, ma in una finestra che non lo e` il paesaggio
// resta intero e centrato (meet) e continua oltre i bordi: l'interfaccia in HTML sta nelle stesse unita` (--u in style.css).
// Si carica dopo gioco.js e percorso-gioco.js, prima di lampo.js.
// ============================================================================

const PercorsoVista = (() => {
  const NSV = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const ridotto = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
  const attesa = (ms, f) => setTimeout(f, ridotto() ? Math.min(ms, 30) : ms);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = (n) => Math.round(n * 10) / 10;

  // ---- la velocita` (10/10): le misure sul sentiero e sul terreno si fanno UNA volta, sulla geometria, non con migliaia di getPointAtLength ----
  // Aprire il Percorso metteva 4 secondi: ~12.000 chiamate a getPointAtLength (calcolaSlot, calcolaPietre, nastro) piu` ~27.000 sulle creste e sulle
  // colline (profiloTerreno). Qui il tracciato (comandi assoluti M L C S Q Z) si appiattisce una volta in una tabella; se il tracciato ha altri
  // comandi, appiattisci() ritorna null e si torna a getPointAtLength.
  function appiattisci(d, passo) {
    const tok = String(d).match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    const pts = []; let k = 0, cx = 0, cy = 0, cmd = "", ux = 0, uy = 0; // (ux, uy): il secondo punto di controllo dell'ultima C, per la S
    const num = () => parseFloat(tok[k++]);
    const spezza = (n, f) => { for (let t = 1; t <= n; t++) pts.push(f(t / n)); };
    while (k < tok.length) {
      if (/^[A-Za-z]$/.test(tok[k])) { cmd = tok[k++]; if (!/^[MLCSQZ]$/.test(cmd)) return null; if (cmd === "Z") continue; }
      if (cmd === "M") { cx = num(); cy = num(); pts.push([cx, cy]); cmd = "L"; ux = cx; uy = cy; }
      else if (cmd === "L") {
        const x = num(), y = num(), x0 = cx, y0 = cy;
        spezza(Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / passo)), (u) => [x0 + (x - x0) * u, y0 + (y - y0) * u]);
        cx = x; cy = y; ux = cx; uy = cy;
      }
      else if (cmd === "C" || cmd === "S") {
        let x1, y1;
        if (cmd === "C") { x1 = num(); y1 = num(); } else { x1 = 2 * cx - ux; y1 = 2 * cy - uy; }
        const x2 = num(), y2 = num(), x = num(), y = num();
        const n = Math.max(4, Math.ceil((Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2)) / passo));
        const x0 = cx, y0 = cy;
        spezza(n, (u) => { const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, e = u ** 3; return [a * x0 + b * x1 + c * x2 + e * x, a * y0 + b * y1 + c * y2 + e * y]; });
        ux = x2; uy = y2; cx = x; cy = y;
      } else if (cmd === "Q") {
        const x1 = num(), y1 = num(), x = num(), y = num(), x0 = cx, y0 = cy;
        const n = Math.max(4, Math.ceil((Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x - x1, y - y1)) / passo));
        spezza(n, (u) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * x1 + u * u * x, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * y1 + u * u * y]);
        ux = x1; uy = y1; cx = x; cy = y;
      } else return null;
    }
    return pts;
  }
  // il sentiero come tabella (ascissa curvilinea -> punto), con piccoli passi: ptSentiero(l) fa quello che faceva sentiero.getPointAtLength(l)
  let TAB = null;
  function tabellaSentiero(d) {
    const pts = appiattisci(d, 0.5);
    if (!pts || pts.length < 2) return null;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, L: cum[cum.length - 1] };
  }
  function ptSentiero(l) {
    if (!TAB) return sentiero.getPointAtLength(l);
    const { pts, cum } = TAB;
    l = Math.max(0, Math.min(TAB.L, l));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= l) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1, f = (l - cum[lo]) / seg;
    return { x: pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, y: pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f };
  }

  const PL = PLANCIA_40;
  // La lunghezza e` un numero del pannello (10/10, quarta prova): N, i bivacchi (un terzo e due terzi) e le tappe seguono. Cambiarla rifa' il paesaggio.
  let N = Percorso.leggiRegole().caselle;
  let BIVACCHI = percorsoBivacchi(N);
  let TAPPE = posizioniCaselleSpeciali(N);
  // Ritorna true se la lunghezza e` cambiata (il paesaggio si rifara' alla prossima assicuraScena).
  function impostaLunghezza(n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n) || n === N) return false;
    N = n; BIVACCHI = percorsoBivacchi(N); TAPPE = posizioniCaselleSpeciali(N);
    V.fatto = false;
    return true;
  }
  function rinfrescaIscrizione() { if (V.modo === "iscrizione") mostraIscrizione(); }
  // la prospettiva (scheda §1.1): UNA regola, la misura dipende solo dalla y. Il suolo (pietre, nastro, stradine, edifici, bivacchi, alberi,
  // bandiera) va da 1 a `suolo`; le pedine (meeple, fantasmi, tende, chip) rimpiccioliscono meno, fino a `pezzi`, perche' restino leggibili.
  const PR = PL.prospettiva;
  const prof = (y) => clamp((PR.vicino - y) / (PR.vicino - PR.lontano), -0.14, 1); // 0 vicino a chi guarda, 1 alla vetta
  const scala = (y) => 1 - prof(y) * (1 - PR.suolo);
  const scalaPezzi = (y) => 1 - prof(y) * (1 - PR.pezzi);

  // il sole: dove sta a ogni ora (poi resta fermo: una giornata lunga non diventa un tramonto) e la sua strada (scheda §3)
  const ARCO = "M-100,122 C600,122 1300,100 1860,560";
  const SOLE_X = [140, 270, 400, 530, 660, 780, 880];
  const SOLE_ISCRIZIONE_X = 1250; // R14/D5: sopra il cartello, a sinistra della legenda, lontano dal sottotitolo
  const TRAMONTO_FUORI_X = 1860;
  const RISERVATI = [[516, 204, 1403, 622], [640, 628, 1280, 702], [62, 571, 559, 1068], [24, 180, 404, 556], [0, 0, 1920, 62], [1360, 0, 1840, 180]];
  const tocca = (bb) => RISERVATI.some((r) => bb[0] < r[2] && bb[2] > r[0] && bb[1] < r[3] && bb[3] > r[1]);
  // R7 (scheda dei ritocchi, 09/10): le righe del tempo in parole da bambino. `riga` sotto il nome e sotto l'annuncio grande;
  // `breve` dentro il preavviso («Fra 2 ore: Temporale, la pedina sta ferma, niente tenda»).
  const TESTI_TEMPO = {
    sereno: { nome: "Sereno", titolo: "Torna il Sereno", breve: "Sereno", riga: "tutto come sempre", preavviso: "torna il Sereno" },
    ventoso: { nome: "Ventoso", titolo: "Arriva il Ventoso", breve: "due passi a consonante", riga: "ogni consonante giusta vale <b>due passi</b> invece di uno" },
    temporale: { nome: "Temporale", titolo: "Arriva il Temporale", breve: "la pedina sta ferma", riga: "con le consonanti si muove <b>solo l’ombra</b>, la pedina sta ferma" },
    afa: { nome: "Afa", titolo: "Arriva l’Afa", breve: "la tenda fa tutta la strada", riga: "chi pianta la tenda fa <b>tutta la strada</b> fino al fantasma, non la metà" },
    limpida: { nome: "Giornata limpida", titolo: "Giornata limpida", breve: "una consonante gratis", riga: "una consonante si scopre <b>da sola</b>" },
  };
  const senzaTag = (h) => String(h).replace(/<[^>]+>/g, "");
  // «al 22», ma «all'8», «all'11», «all'18»
  const alN = (n) => (n === 8 || n === 11 || n === 18 ? "all’" + n : "al " + n);
  const TEMPI_NUVOLA = { temporale: "scura", afa: "calda", ventoso: "chiara", sereno: "chiara", limpida: "chiara" };

  // ---- lo stato di cio` che si VEDE ---------------------------------------------------------------------------------------
  // La partita cambia stato subito; la scena lo racconta a pezzi. Finche' una scena e` in corso (occupata > 0) le posizioni che si
  // vedono sono quelle della scena, non quelle del gioco; a fine scena si rimettono d'accordo (sync).
  const V = {
    modo: null,            // "iscrizione" | "partita" | null
    chi: [],               // per giocatore: { m (il meeple), colore, sigla, nome }
    pos: [], fant: [], tenda: [], dentro: [], arrivo: [], cammina: [], anim: [], animF: [],
    tendaRipiega: {},      // i: la pietra della tenda che si sta ripiegando (resta a vista finche' l'animazione dura)
    bivacchi: {}, castelli: {}, colori: {},
    occupata: 0, ultimoArrivo: 1e6, coda: [], inCoda: false,
    fatto: false, tendeAnnullate: new Set(),
    trattenute: [],        // quando un potenziamento sposta le pedine, la scena trattiene cio` che si VEDE finche' la scena del movimento non parte (vedi trattieni)
    fantSera: [],          // la sera: la meta di chi cammina fino al suo fantasma (resta a vista finche' la pedina non ci arriva)
  };
  let svg = null, palcoEl = null;
  let sentiero = null, L = 0, arco = null, LA = 0, campioniArco = null;
  let STEP = 0, LUNG = [];
  let gSassi, gBivacchi, gMeeple, gFantasmi, gTende, gChip, gTappe, gCastelli, gLibere, gStradine, gCaselle, gPolvere, gAlberiDietro, gAlberiDavanti, gLucciole;
  let sole, luna, nuvole;
  let SLOT = {};
  const USATI = {};    // pietra -> il posto occupato { x, y, s, lato } (tappe, bivacchi, Castelli)
  const presenti = []; // [pietra, lato] degli edifici gia` piantati, nell'ordine
  const FISSI = [];    // le pietre degli edifici della plancia (non dei Castelli del lampo)
  const alberi = [];
  const PIETRE = {};   // i parametri di ogni lastra (forma, rotazione, gonfiore, schiacciamento), per rifarla quando una pietra diventa d'ingresso
  // un generatore con seme: la plancia e` sempre uguale (stelle, pietre, alberi, lucciole, pioggia, nello stesso ordine del prototipo)
  let seme = 20261009;
  const caso = () => { seme |= 0; seme = (seme + 0x6D2B79F5) | 0; let t = Math.imul(seme ^ (seme >>> 15), 1 | seme); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const fra = (a, b) => a + caso() * (b - a);
  // Il mondo che reagisce (terza prova, 09/10): alberi, lucciole, pioggia, vento hanno un generatore TUTTO LORO, cosi' la plancia (stelle, pietre,
  // edifici) resta com'era. Regola: niente griglie ne' ritmi che si ripetono: gruppi, misure, tempi e ritardi diversi uno dall'altro.
  let semeM = 20261010;
  const casoM = () => { semeM |= 0; semeM = (semeM + 0x6D2B79F5) | 0; let t = Math.imul(semeM ^ (semeM >>> 15), 1 | semeM); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const fraM = (a, b) => a + casoM() * (b - a);
  const gaussM = () => (casoM() + casoM() + casoM() - 1.5) * 2; // a campana, scarto 1

  // ---- la geometria: il sentiero in prospettiva -----------------------------------------------------------------------------
  // Le pietre NON sono equidistanti: la pietra i sta all'ascissa LUNG[i], e LUNG[i+1] = LUNG[i] + STEP · scala(y della pietra i), con STEP
  // trovato per bisezione perche' LUNG[N] = L (le pietre del prato distano 60, quelle in vetta 33).
  function lunghezze(step) {
    const arr = [0]; let l = 0;
    for (let i = 1; i <= N; i++) { const p = ptSentiero(Math.min(L, l)); l += step * scala(p.y); arr.push(l); }
    return arr;
  }
  function calcolaPietre() {
    let lo = 20, hi = 140;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (lunghezze(m)[N] > L) hi = m; else lo = m; }
    STEP = (lo + hi) / 2; LUNG = lunghezze(STEP); LUNG[N] = L;
  }
  // punto(i) accetta anche i frazionari (la camminata)
  const punto = (i) => {
    i = Math.max(0, Math.min(N, i));
    const k = Math.floor(i), f = i - k;
    const a = LUNG[k], b = LUNG[Math.min(N, k + 1)];
    return ptSentiero(a + (b - a) * f);
  };
  const puntoSoleX = (x) => {
    if (!campioniArco) { campioniArco = []; for (let k = 0; k <= 600; k++) campioniArco.push(arco.getPointAtLength((k / 600) * LA)); }
    let best = campioniArco[0];
    for (const p of campioniArco) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best;
  };
  function direzione(i) {
    const l = LUNG[Math.max(0, Math.min(N, Math.round(i)))];
    const a = ptSentiero(Math.max(0, l - 6)), b = ptSentiero(Math.min(L, l + 6));
    const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1;
    return { dx: dx / m, dy: dy / m };
  }
  // il nastro di terra che si stringe salendo: un poligono, non uno stroke (uno stroke ha una larghezza sola)
  function nastro(mezza) {
    const S = 260, sin = [], des = [];
    for (let k = 0; k <= S; k++) {
      const l = (L * k) / S, p = ptSentiero(l);
      const a = ptSentiero(Math.max(0, l - 2)), b = ptSentiero(Math.min(L, l + 2));
      let dx = b.x - a.x, dy = b.y - a.y; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
      const w = mezza * scala(p.y);
      sin.push([p.x - dy * w, p.y + dx * w]); des.push([p.x + dy * w, p.y - dx * w]);
    }
    return "M" + sin.map((q) => r1(q[0]) + "," + r1(q[1])).join(" L") + " L" + des.reverse().map((q) => r1(q[0]) + "," + r1(q[1])).join(" L") + " Z";
  }
  // IL POSTO ACCANTO A OGNI PIETRA (scheda §1.3): dove si pianta l'edificio di una tappa, il fuoco di un bivacco, il Castello del lampo.
  // Per ogni pietra due candidati, a 92·scala dal sentiero: `sopra` (verso la vetta) e `sotto` (verso chi guarda). Un candidato e` valido se il suo
  // ingombro sta nello schermo, non tocca i riquadri dell'interfaccia e non e` troppo vicino a un altro tratto di sentiero.
  function calcolaSlot() {
    SLOT = {};
    const lontanoDalSentiero = (x, y, salvo, s) => {
      let m = 1e9;
      for (let k = 0; k <= N * 4; k++) { const i = k / 4; if (Math.abs(i - salvo) < 1.6) continue; const p = punto(i); m = Math.min(m, Math.hypot(p.x - x, p.y - y)); }
      return m >= 54 * s;
    };
    for (let i = 1; i < N; i++) {
      const p = punto(i), d = direzione(i), s = scala(p.y);
      const cand = [{ x: -d.dy, y: d.dx }, { x: d.dy, y: -d.dx }].map((nn) => ({ x: p.x + nn.x * 92 * s, y: p.y + nn.y * 92 * s, s }));
      cand.sort((a, b) => a.y - b.y); // [0] sopra, [1] sotto
      const valido = (q) => { const bb = [q.x - 40 * s, q.y - 84 * s, q.x + 40 * s, q.y + 6 * s]; return bb[0] >= 8 && bb[2] <= 1912 && bb[1] >= 8 && bb[3] <= 1072 && !tocca(bb) && lontanoDalSentiero(q.x, q.y - 50 * s, i, s); };
      SLOT[i] = { sopra: valido(cand[0]) ? cand[0] : null, sotto: valido(cand[1]) ? cand[1] : null };
    }
  }
  // un posto nuovo sta ad almeno 76·s da ogni edificio gia` piantato
  const lontanoDagliAltri = (q) => Object.keys(USATI).every((k) => Math.hypot(USATI[k].x - q.x, USATI[k].y - q.y) >= 76 * q.s);
  // il lato: le tappe fisse lo hanno scritto nella plancia; un Castello va dal lato OPPOSTO all'edificio piu` vicino lungo il sentiero (entro 8
  // pietre), altrimenti sopra sulle dispari e sotto sulle pari
  function latoDi(i) {
    const kb = BIVACCHI.indexOf(i); // i due bivacchi stanno quasi sulla stessa verticale: il primo sotto il sentiero, il secondo sopra
    if (kb >= 0) return kb % 2 ? "sopra" : "sotto";
    let vicino = null, d = 1e9;
    presenti.forEach(([p, l]) => { const dd = Math.abs(p - i); if (dd < d) { d = dd; vicino = l; } });
    if (vicino && d <= 8) return vicino === "sopra" ? "sotto" : "sopra";
    return i % 2 ? "sopra" : "sotto";
  }
  // Il posto di una pietra: { x, y, s, lato }, oppure null se il paesaggio non gliene da` (scheda §1.3, scelta 4: una pietra e` libera per il
  // Castello solo se c'e` posto). Dipende dai Castelli gia` piantati.
  function posto(i) {
    if (USATI[i]) return USATI[i];
    const s = SLOT[i]; if (!s) return null;
    const pref = latoDi(i), altro = pref === "sopra" ? "sotto" : "sopra";
    if (s[pref] && lontanoDagliAltri(s[pref])) return Object.assign({ lato: pref }, s[pref]);
    if (s[altro] && lontanoDagliAltri(s[altro])) return Object.assign({ lato: altro }, s[altro]);
    return null;
  }
  function occupa(i, s) { presenti.push([i, s.lato]); USATI[i] = s; }
  const haPosto = (i) => V.fatto && !!posto(i);

  // ---- il disegno fisso: il paesaggio, il sentiero, le tappe ------------------------------------------------------------------
  const sv = (tag, attrs, parent) => {
    const e = document.createElementNS(NSV, tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  };
  function icona(nome) { return `<svg class="icona-tempo" viewBox="0 0 48 48" aria-hidden="true"><use href="#ic-${nome}"/></svg>`; }
  // quattro forme di lastra (la prima e` quella di sempre), girate di poco e di tre tinte: le pietre non sono tutte uguali (appunto 11)
  const LASTRE = [
    "M-15,-3 C-14,-10 -6,-13 2,-12 C10,-11 16,-7 15,0 C14,7 8,11 0,11 C-8,11 -16,6 -15,-3 Z",
    "M-16,-2 C-15,-9 -8,-12 0,-12 C9,-12 16,-8 16,-1 C16,6 10,10 1,10 C-8,10 -17,5 -16,-2 Z",
    "M-13,-6 C-9,-12 2,-13 9,-10 C15,-7 15,1 12,6 C8,11 -2,12 -9,9 C-15,6 -16,-1 -13,-6 Z",
    "M-14,0 C-15,-7 -9,-11 -1,-12 C8,-13 14,-9 15,-3 C16,4 11,10 3,11 C-6,12 -13,7 -14,0 Z",
  ];
  const LUCE = "M-9,-6 C-5,-9 3,-9 7,-6";
  const TINTE = ["#CBBFA6", "#C4B79C", "#D3C8B0"];
  const EDIFICI = {
    pedaggio: `<ellipse class="terra" cy="3" rx="42" ry="6"/>
      <rect class="muro" x="-30" y="-34" width="60" height="34"/>
      <rect class="torre" x="-40" y="-56" width="20" height="56"/><rect class="torre" x="20" y="-56" width="20" height="56"/>
      <path class="merli" d="M-40,-56 v-7 h6 v7 M-33,-56 v-7 h6 v7 M-26,-56 v-7 h6 v7 M20,-56 v-7 h6 v7 M27,-56 v-7 h6 v7 M34,-56 v-7 h6 v7 M-18,-34 v-6 h6 v6 M-9,-34 v-6 h6 v6 M0,-34 v-6 h6 v6 M9,-34 v-6 h6 v6"/>
      <path class="porta" d="M-9,0 V-14 A9,9 0 0 1 9,-14 V0 Z"/>
      <rect class="feritoia" x="-32" y="-44" width="4" height="10" rx="1"/><rect class="feritoia" x="28" y="-44" width="4" height="10" rx="1"/>
      <g class="vessillo"><line x1="30" y1="-56" x2="30" y2="-82"/><path d="M30,-82 L50,-75 L30,-68 Z"/></g>
      <path class="stendardo" d="M-8,-32 H8 V-20 L0,-16 L-8,-20 Z"/>
      <circle class="onda" r="12"/><circle class="onda due" r="12"/>`,
    trampolino: `<ellipse class="terra" cy="3" rx="20" ry="5"/>
      <rect class="palo" x="-3" y="-64" width="6" height="64" rx="2"/>
      <path class="tabella" d="M-18,-62 H14 L24,-52 L14,-42 H-18 Z"/><path class="tabella" d="M-18,-38 H14 L24,-28 L14,-18 H-18 Z"/>
      <path class="segno s1" d="M-8,-58 L0,-52 L-8,-46 M4,-58 L12,-52 L4,-46"/><path class="segno s2" d="M-8,-34 L0,-28 L-8,-22 M4,-34 L12,-28 L4,-22"/>`,
  };

  // La misura della lastra di una pietra: la base sale a 1,3 (miliare 1,5, ingresso 1,4, piazzola 1,95 × 1,5), schiacciata salendo
  // (in vetta ellissi al 70 %: lo scorcio del suolo)
  function trasformaLastra(i, tipo) {
    const q = PIETRE[i];
    const base = tipo === "piazzola" ? [1.95, 1.5] : tipo === "miliare" ? [1.5, 1.5] : tipo === "ingresso" ? [1.4, 1.4] : [1.3, 1.3];
    return `rotate(${r1(q.rot)}) scale(${r1(base[0] * q.gonfia)} ${r1(base[1] * q.gonfia * q.schiaccia)})`;
  }
  // la stradina: un nastro di terra che curva dalla pietra d'ingresso alla porta, con quattro sassi sopra, tutto a misura di distanza
  function stradina(i, s, extra) {
    if (!s) return;
    const p = punto(i);
    const st = sv("g", { class: "stradina" + (extra || ""), "data-pos": i }, gStradine);
    const dx = s.x - p.x, dy = s.y - p.y, m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m, k = s.s;
    const a = { x: p.x + ux * 16 * k, y: p.y + uy * 16 * k }, b = { x: s.x - ux * 4 * k, y: s.y - uy * 4 * k };
    const c = { x: (a.x + b.x) / 2 - uy * 12 * k, y: (a.y + b.y) / 2 + ux * 12 * k };
    sv("path", { class: "terra-stradina", d: `M${r1(a.x)},${r1(a.y)} Q${r1(c.x)},${r1(c.y)} ${r1(b.x)},${r1(b.y)}`, style: `stroke-width:${r1(9 * k)}` }, st);
    [0.2, 0.42, 0.64, 0.86].forEach((t, j) => {
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y;
      sv("ellipse", { cx: r1(x + (j % 2 ? 2 : -2) * k), cy: r1(y), rx: r1(4 * k), ry: r1(3 * k) }, st);
    });
  }
  function edificio(tipo, parent, pos, s, extra) {
    const e = sv("g", { class: "tappa-mappa " + tipo + (extra || ""), "data-pos": pos, "data-lato": s.lato, transform: `translate(${r1(s.x)} ${r1(s.y)}) scale(${r1(s.s)})` }, parent);
    const ti = sv("title", {}, e);
    ti.textContent = CASELLE_PERCORSO[tipo].titolo;
    e.insertAdjacentHTML("beforeend", `<g class="edificio">${EDIFICI[tipo]}</g>`);
    return e;
  }
  function bivacco(pos) {
    const s = posto(pos);
    if (!s) return;
    occupa(pos, s); FISSI.push(pos);
    stradina(pos, s);
    const b = sv("g", { class: "bivacco spento", "data-pos": pos, "data-lato": s.lato, transform: `translate(${r1(s.x)} ${r1(s.y)}) scale(${r1(s.s)})` }, gBivacchi);
    const ti = sv("title", {}, b);
    ti.textContent = "Bivacco";
    sv("circle", { class: "alone-fuoco", r: 70, fill: "url(#alone-fuoco)" }, b);
    const pietre = sv("g", { class: "pietre" }, b);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; sv("circle", { cx: Math.cos(a) * 26, cy: 4 + Math.sin(a) * 11, r: 4.5 }, pietre); }
    sv("path", { class: "ceppi", d: "M-14,-2 L14,8 M-14,8 L14,-2", "stroke-linecap": "round" }, b);
    sv("path", { class: "fiamma", d: "M0,-52 C16,-34 22,-18 12,-2 C10,-12 5,-15 2,-22 C-5,-13 -17,-9 -12,2 C-26,-8 -20,-30 0,-52 Z" }, b);
    sv("path", { class: "brace", d: "M-10,0 q10,-8 20,0 q-10,6 -20,0z" }, b);
    sv("path", { class: "fumo", d: "M0,-8 c-8,-14 6,-20 -2,-36 c-6,-12 8,-16 2,-30", fill: "none", "stroke-linecap": "round" }, b);
  }

  function costruisciScena() {
    svg.innerHTML = "";
    seme = 20261009; alberi.length = 0;
    Object.keys(USATI).forEach((k) => delete USATI[k]); presenti.length = 0; FISSI.length = 0;
    const defs = sv("defs", {}, svg);
    // il cielo continua oltre i bordi: il gradiente e` nelle unita` del paesaggio, cosi' una finestra non 16:9 non mostra strisce
    const grad = sv("linearGradient", { id: "cielo-grad", class: "cielo-grad", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: 1080 }, defs);
    sv("stop", { offset: "0" }, grad); sv("stop", { offset: "0.55" }, grad); sv("stop", { offset: "1" }, grad);
    const pat = sv("pattern", { id: "scacchi-p", width: 12, height: 12, patternUnits: "userSpaceOnUse" }, defs);
    sv("rect", { width: 6, height: 6, fill: "#111" }, pat); sv("rect", { x: 6, y: 6, width: 6, height: 6, fill: "#111" }, pat);
    sv("rect", { x: 6, width: 6, height: 6, fill: "#fff" }, pat); sv("rect", { y: 6, width: 6, height: 6, fill: "#fff" }, pat);
    const alone = sv("radialGradient", { id: "alone-sole" }, defs);
    sv("stop", { offset: "0", "stop-color": "#FFD86B", "stop-opacity": 0.55 }, alone); sv("stop", { offset: "1", "stop-color": "#FFD86B", "stop-opacity": 0 }, alone);
    const fuoco = sv("radialGradient", { id: "alone-fuoco" }, defs);
    sv("stop", { offset: "0", "stop-color": "#FF9F1C", "stop-opacity": 0.6 }, fuoco); sv("stop", { offset: "1", "stop-color": "#FF9F1C", "stop-opacity": 0 }, fuoco);
    // il caldo delle finestre accese (la sera: il campo base, le tende)
    const caldo = sv("radialGradient", { id: "alone-caldo" }, defs);
    sv("stop", { offset: "0", "stop-color": "#FFE9A8", "stop-opacity": 0.5 }, caldo); sv("stop", { offset: "1", "stop-color": "#FFE9A8", "stop-opacity": 0 }, caldo);
    // le icone del tempo e della tenda (nelle tessere, nella riga del tempo, nei pulsanti)
    const simboli = {
      sereno: '<circle cx="24" cy="24" r="9" fill="currentColor"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M9.9 38.1l4.2-4.2M33.9 14.1l4.2-4.2"/></g>',
      ventoso: '<g fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M6 17h22a5 5 0 1 0-5-5"/><path d="M6 26h30a5 5 0 1 1-5 5"/><path d="M6 35h16"/></g>',
      temporale: '<path d="M14 32a8 8 0 0 1-1-16 11 11 0 0 1 21-2 7 7 0 0 1 2 18z" fill="currentColor"/><path d="M26 30l-6 10h6l-3 8 9-12h-6l3-6z" fill="#FFD23F" stroke="#FFD23F" stroke-width="1"/>',
      afa: '<circle cx="24" cy="18" r="8" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M8 33q4-4 8 0t8 0 8 0 8 0"/><path d="M8 41q4-4 8 0t8 0 8 0 8 0"/></g>',
      limpida: '<circle cx="20" cy="26" r="8" fill="currentColor"/><g stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 10v5M20 37v5M4 26h5M31 26h5M8.7 14.7l3.5 3.5M27.8 33.8l3.5 3.5M8.7 37.3l3.5-3.5M27.8 18.2l3.5-3.5"/></g><path d="M38 6l1.8 4.6L44 12l-4.2 1.4L38 18l-1.8-4.6L32 12l4.2-1.4z" fill="currentColor"/>',
      sera: '<path d="M30 6a16 16 0 1 0 12 26A13 13 0 0 1 30 6z" fill="currentColor"/>',
      tramonto: '<path d="M10 32a14 14 0 0 1 28 0z" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 38h40"/><path d="M24 8v6M8 18l4 4M40 18l-4 4M3 30h5M40 30h5"/></g>',
      variabile: '<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 30q8-18 16 0t16 0"/><path d="M34 14l6 2-2 6"/></g>',
      stabile: '<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M8 24h32"/><path d="M8 32h20"/></g>',
      tenda: '<g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"><path d="M24 9L5 38h38z"/><path d="M24 20l-8 18h16z" fill="currentColor"/><path d="M3 42h42"/><path d="M24 9V3h7l-7 3"/></g>',
    };
    Object.keys(simboli).forEach((k) => { const s = sv("symbol", { id: "ic-" + k, viewBox: "0 0 48 48" }, defs); s.innerHTML = simboli[k]; });
    // i sei meeple (config.js, MEEPLE): sagome senza colore, lo danno gli <use>
    MEEPLE.forEach((m) => { const g = sv("g", { id: "mp-" + m.id }, defs); g.innerHTML = m.sagoma; });

    sv("rect", { class: "cielo", x: -2000, y: -2000, width: 5920, height: 6000, fill: "url(#cielo-grad)" }, svg);
    // le stelle della sera: sparse per tutto il cielo, posizioni da un generatore con seme (mai in fila)
    const stelle = sv("g", { class: "stelle" }, svg);
    for (let k = 0; k < 90; k++) { const x = 10 + caso() * 1900, y = 8 + caso() * 560; sv("circle", { cx: Math.round(x), cy: Math.round(y), r: (0.9 + caso() * 1.8).toFixed(1), style: `--k:${k % 7};--sd:${fraM(1.6, 4.2).toFixed(2)}s;--sl:${fraM(0, 4).toFixed(2)}s` }, stelle); }
    sv("rect", { class: "foschia", x: -2000, y: -2000, width: 5920, height: 6000 }, svg);
    arco = sv("path", { class: "arco-sole", d: ARCO }, svg);
    LA = arco.getTotalLength();
    sole = sv("g", { class: "sole" }, svg);
    sv("circle", { class: "alone", r: 95, fill: "url(#alone-sole)" }, sole);
    const raggi = sv("g", { class: "raggi" }, sole);
    for (let k = 0; k < 12; k++) sv("line", { x1: 0, y1: -48, x2: 0, y2: -70, transform: `rotate(${k * 30})` }, raggi);
    sv("circle", { class: "disco", r: 38 }, sole);
    luna = sv("g", { class: "luna-alta", transform: "translate(1500 190)" }, svg);
    sv("circle", { class: "alone-luna", r: 80, fill: "url(#alone-sole)" }, luna);
    sv("path", { class: "luna", d: "M-8,-36 a36,36 0 1,0 30,58 a28,28 0 1,1 -30,-58 z" }, luna);
    nuvole = sv("g", { class: "nuvole" }, svg);
    [[0, 0, 1], [150, -30, 0.8], [-130, 10, 0.7], [280, -10, 0.55]].forEach(([dx, dy, s]) => {
      const n = sv("g", { class: "nuvola", transform: `translate(${dx} ${dy}) scale(${s})` }, nuvole);
      sv("ellipse", { cx: 0, cy: 0, rx: 70, ry: 34 }, n); sv("ellipse", { cx: -40, cy: 10, rx: 46, ry: 28 }, n);
      sv("ellipse", { cx: 44, cy: 8, rx: 50, ry: 30 }, n); sv("ellipse", { cx: 8, cy: -18, rx: 44, ry: 30 }, n);
      sv("path", { class: "fulmine", d: "M6,30 l-14,26 h12 l-8,24 l24,-32 h-12 l8,-18 z" }, n);
    });
    // le righe d'aria del Ventoso: ognuna ha la sua forma, lunghezza, velocita', spessore e ritardo (mai le stesse dieci righe in fila)
    const vento = sv("g", { class: "vento" }, svg);
    for (let k = 0; k < 13; k++) {
      const x = fraM(20, 1750), y = fraM(80, 700), n = 2 + Math.floor(casoM() * 3);
      let d = `M${r1(x)},${r1(y)} q${r1(fraM(14, 30))},${r1(-fraM(6, 22))} ${r1(fraM(30, 60))},0`;
      for (let j = 1; j < n; j++) d += ` t${r1(fraM(34, 70))},${r1(fraM(-4, 4))}`;
      const lung = Math.round(fraM(70, 150));
      sv("path", { d, style: `--du:${fraM(1.1, 2.6).toFixed(2)}s;--dl:${fraM(0, 3).toFixed(2)}s;--w:${fraM(2.2, 4.6).toFixed(1)}px;--op:${fraM(0.35, 0.75).toFixed(2)};--l:${lung};` }, vento);
    }

    // LA TERRA, dal fondo in avanti (scheda §2): le creste lontane azzurrine (la prospettiva aerea), le colline, LA MONTAGNA con la vetta
    // (un fianco al sole, uno in ombra, roccia e neve), il prato vicino. Oltre i bordi tutto continua: a destra le creste e la montagna
    // scendono piano verso il prato (in una finestra piu` larga del 16:9 non si vede il bordo del disegno: il prototipo, fisso a 16:9, non lo
    // mostrava); a sinistra le colline restano piane, come prima.
    const gc = sv("g", { class: "colline" }, svg);
    sv("path", { class: "cresta lontana", d: "M-2000,640 L0,640 C200,612 360,585 520,596 C700,608 780,540 940,520 C1080,504 1180,540 1300,520 C1360,510 1400,480 1450,470 C1520,456 1600,470 1680,440 C1760,410 1820,400 1880,406 C1900,408 1910,418 1920,420 C1990,426 2100,452 2300,500 L3920,530 L3920,3200 L-2000,3200 Z" }, gc);
    sv("path", { class: "cresta lontana-destra", d: "M1760,560 C1800,500 1840,440 1872,404 C1900,430 1915,470 1920,490 C1990,550 2100,600 2300,640 L3920,670 L3920,3200 L1760,3200 Z" }, gc);
    sv("path", { class: "collina lontana", d: "M-2000,660 L0,660 C260,630 500,640 720,620 S1060,580 1250,572 C1330,568 1400,600 1440,640 L1440,3200 L-2000,3200 Z" }, gc);
    const gm = sv("g", { class: "montagna" }, gc);
    sv("path", { class: "corpo", d: "M1000,1080 L1000,840 C1100,760 1200,690 1280,620 C1360,552 1440,500 1550,400 C1620,336 1680,290 1734,262 C1780,300 1830,360 1880,430 C1900,460 1912,490 1920,510 C1960,580 2040,680 2160,760 C2300,850 2600,880 3920,880 L3920,3200 L1000,3200 Z" }, gm);
    sv("path", { class: "luce", d: "M1180,1080 L1200,760 C1300,660 1400,560 1480,470 C1560,380 1660,300 1734,262 C1700,330 1660,400 1620,470 C1560,580 1500,680 1440,800 C1400,900 1380,1000 1370,1080 Z" }, gm);
    sv("path", { class: "ombra", d: "M1734,262 C1780,300 1830,360 1880,430 C1900,460 1912,490 1920,510 C1960,580 2040,680 2160,760 L2168,772 C2060,792 1960,780 1920,760 C1880,680 1830,600 1790,520 C1770,470 1750,400 1734,330 Z" }, gm);
    sv("path", { class: "falda", d: "M1560,560 C1600,520 1640,470 1690,420 C1660,500 1620,560 1580,620 Z" }, gm);
    sv("path", { class: "falda", d: "M1760,620 C1790,560 1820,520 1850,500 C1830,560 1810,620 1790,700 Z" }, gm);
    sv("path", { class: "roccia", d: "M1640,392 C1680,350 1708,300 1734,262 C1760,296 1792,344 1822,396 C1792,386 1764,392 1734,382 C1704,392 1672,398 1640,392 Z" }, gm);
    sv("path", { class: "neve", d: "M1706,314 C1716,292 1726,276 1734,262 C1742,276 1752,292 1762,314 C1750,320 1722,320 1706,314 Z" }, gm);
    sv("path", { class: "brillio", d: "M1744,296 l2,-6 l2,6 l6,2 l-6,2 l-2,6 l-2,-6 l-6,-2 z" }, gm);
    sv("path", { class: "collina media", d: "M-2000,800 L0,800 C260,770 520,780 760,750 S1120,712 1250,730 C1330,742 1400,790 1430,860 C1450,900 1470,980 1480,1080 L3920,1080 L3920,3200 L-2000,3200 Z" }, gc);
    sv("path", { class: "collina vicina", d: "M-2000,900 L0,900 C300,880 700,905 1100,882 S1500,900 1920,868 L3920,868 L3920,3200 L-2000,3200 Z" }, gc);
    sv("rect", { class: "velo-colline", x: -2000, y: -2000, width: 5920, height: 6000 }, svg);

    // il campo base: la grande tenda a sinistra del via, a misura di distanza, con l'ombra e la luce della sera
    const cb = PL.campoBase, sc = scala(cb.y);
    const gt = sv("g", { class: "campo-base", transform: `translate(${cb.x} ${cb.y}) scale(${r1(sc)})` }, svg);
    sv("ellipse", { class: "ombra-base", cx: 0, cy: 2, rx: 52, ry: 8 }, gt);
    sv("path", { class: "telo", d: "M-46,0 L46,0 L0,-70 Z" }, gt);
    sv("path", { class: "porta", d: "M-12,0 L12,0 L0,-28 Z" }, gt);
    sv("circle", { class: "luce-base", cy: -14, r: 40, fill: "url(#alone-caldo)" }, gt);

    // IL SENTIERO: la guida invisibile (per getPointAtLength), il nastro di terra che si stringe, le stradine SOTTO le pietre, una lastra per casella
    sentiero = sv("path", { class: "sentiero-guida", d: PL.sentiero }, svg);
    TAB = tabellaSentiero(PL.sentiero);
    L = TAB ? TAB.L : sentiero.getTotalLength();
    calcolaPietre();
    sv("path", { class: "sentiero-bordo", d: nastro(21) }, svg);
    sv("path", { class: "sentiero", d: nastro(17) }, svg);
    calcolaSlot();
    gAlberiDietro = sv("g", { class: "alberi dietro" }, svg); // gli alberi oltre il sentiero (verso la vetta) stanno sotto le pietre
    gStradine = sv("g", { class: "stradine" }, svg);
    gCaselle = sv("g", { class: "caselle" }, svg);
    for (let i = 0; i <= N; i++) {
      const p = punto(i), s = scala(p.y);
      const miliare = i > 0 && i % 5 === 0 && i < N, piazzola = BIVACCHI.includes(i), ingresso = !!TAPPE[i];
      const tipo = piazzola ? "piazzola" : miliare ? "miliare" : ingresso ? "ingresso" : "";
      const c = sv("g", { class: "pietra-mappa" + (miliare ? " miliare" : "") + (piazzola ? " piazzola" : "") + (ingresso ? " ingresso" : "") + (i === 0 ? " via" : "") + (i === N ? " arrivo" : ""), "data-i": i, transform: `translate(${r1(p.x)} ${r1(p.y)}) scale(${r1(s)})` }, gCaselle);
      PIETRE[i] = { rot: fra(-14, 14), gonfia: fra(0.92, 1.1), schiaccia: 1 - prof(p.y) * 0.3, forma: (i * 7 + 3) % 4, tinta: (i * 5 + 1) % 3 };
      const lg = sv("g", { class: "lastra-g", transform: trasformaLastra(i, tipo) }, c);
      const la = sv("path", { class: "lastra", d: LASTRE[PIETRE[i].forma] }, lg);
      if (!tipo && i !== 0 && i !== N) la.style.fill = TINTE[PIETRE[i].tinta];
      sv("path", { class: "luce", d: LUCE, fill: "none" }, lg);
      if (miliare) { const t = sv("text", { class: "numero", x: 0, y: 1, "text-anchor": "middle", "dominant-baseline": "central" }, c); t.textContent = i; }
    }
    gTappe = sv("g", { class: "tappe" }, svg);
    gBivacchi = sv("g", { class: "bivacchi" }, svg);
    gSassi = sv("g", { class: "sassi" }, svg); // i Sassi posati con la Scatola: una pietra grigia con l'anello del colore di chi l'ha posata
    gCastelli = sv("g", { class: "castelli-lampo" }, svg); // i Castelli piantati dal lampo
    gAlberiDavanti = sv("g", { class: "alberi davanti" }, svg);
    gLucciole = sv("g", { class: "lucciole" }, svg);
    Object.keys(TAPPE).forEach((pos) => {
      const s = posto(+pos);
      if (!s) return;
      occupa(+pos, s); FISSI.push(+pos);
      stradina(+pos, s);
      edificio(TAPPE[pos], gTappe, pos, s);
    });
    BIVACCHI.forEach((pos) => bivacco(pos));
    // la bandiera in vetta, la parte piu` alta del disegno
    const pb = punto(N), sb = scala(pb.y);
    const b = sv("g", { class: "bandiera", transform: `translate(${r1(pb.x)} ${r1(pb.y)}) scale(${r1(sb * 1.3)})` }, svg);
    sv("line", { class: "palo", x1: 0, y1: 0, x2: 0, y2: -92 }, b);
    sv("rect", { class: "tela", x: 1, y: -92, width: 54, height: 38, rx: 2, fill: "url(#scacchi-p)" }, b);
    // «40 caselle» accanto alla bandiera: solo nell'iscrizione (il numero sta li`, la pillola dice solo «Percorso»). Fuori dal gruppo scalato:
    // dentro, a 0,72 scalerebbe da 26 a 19 px.
    const q = sv("text", { class: "bandiera-quante", x: r1(pb.x + 48), y: r1(pb.y - 56) }, svg);
    sv("tspan", { class: "numero" }, q).textContent = String(N);
    const parola = sv("tspan", { class: "parola", dx: 6 }, q);
    parola.textContent = "caselle";
    gTende = sv("g", { class: "tende" }, svg);
    gFantasmi = sv("g", { class: "fantasmi" }, svg);
    gPolvere = sv("g", { class: "polvere" }, svg); // la polvere a ogni pietra toccata, sotto i meeple
    gMeeple = sv("g", { class: "meeple-tutti" }, svg);
    gChip = sv("g", { class: "chips" }, svg);
    gLibere = sv("g", { class: "libere" }, svg);
    piantaAlberi();
    // la pioggia davanti a tutto, anche sul prato, e il lampo (§7). Ogni goccia ha la sua lunghezza, velocita', trasparenza, inclinazione e ritardo
    // (le piu' lunghe sono le piu' vicine: piu' veloci e piu' chiare); cadono a "tende" piu' fitte e zone piu' rade; e a ogni giro la goccia
    // ricade da un'altra parte (nessuna goccia ripercorre la stessa riga).
    const pioggia = sv("g", { class: "pioggia" }, svg);
    const tende = [0, 1, 2, 3].map(() => ({ x: fraM(80, 1840), l: fraM(120, 340) }));
    const posaGoccia = (l, primo) => {
      if (primo) l._t = Math.pow(casoM(), 1.6); // 0 lontana (la maggior parte), 1 vicinissima: resta la stessa per tutta la vita della goccia
      const t = l._t, lung = 20 + t * 44;
      const x = casoM() < 0.55 ? casoM() * 1920 : (() => { const c = tende[Math.floor(casoM() * tende.length)]; return c.x + gaussM() * c.l * 0.5; })();
      const y = -640 + casoM() * 1720;
      l.setAttribute("x1", Math.round(x)); l.setAttribute("y1", Math.round(y));
      l.setAttribute("x2", Math.round(x - lung * fraM(0.14, 0.34))); l.setAttribute("y2", Math.round(y + lung));
      l.style.setProperty("--c", Math.round(520 + casoM() * 260) + "px");
      // i tempi si fissano una volta sola (cambiare il ritardo ad animazione in corso la farebbe saltare)
      if (primo) {
        const du = Math.round(1000 - t * 480 + fraM(-70, 70));
        l.style.setProperty("--du", du + "ms"); l.style.setProperty("--dl", Math.round(-casoM() * du) + "ms");
        l.style.setProperty("--op", (0.3 + t * 0.45 + casoM() * 0.12).toFixed(2)); l.style.setProperty("--w", (1.4 + t * 1.5).toFixed(1) + "px");
      }
    };
    for (let k = 0; k < 230; k++) posaGoccia(sv("line", {}, pioggia), true);
    pioggia.addEventListener("animationiteration", (e) => { if (e.target && e.target.tagName === "line") posaGoccia(e.target); });
    sv("rect", { class: "lampo", x: -2000, y: -2000, width: 5920, height: 6000 }, svg);
    V.fatto = true;
  }

  // Il vento muove bandiera, bandierine, vessilli, stendardi e fumo: a ognuno il suo ritardo, la sua velocita' e il suo angolo (scritti una volta
  // sola, la prima volta che li si vede: i Castelli del lampo e le tende nascono dopo)
  function variaVento() {
    if (!svg) return;
    svg.querySelectorAll(".bandiera .tela, .tendina .bandierina, .tappa-mappa .vessillo path, .tappa-mappa .stendardo, .bivacco .fumo").forEach((e) => {
      if (e._vv) return;
      e._vv = true;
      e.style.setProperty("--wd", fraM(0, 3).toFixed(2) + "s"); e.style.setProperty("--wf", fraM(0.75, 1.35).toFixed(2)); e.style.setProperty("--sk", Math.round(fraM(12, 32)) + "deg");
    });
  }
  // ---- gli alberi: a gruppi, a misura di distanza, mai sul sentiero ne' sui riquadri, SEMPRE appoggiati al terreno (scheda §2.3; terza prova) --------
  // Il profilo del terreno: per ogni ascissa (a passi di 2) la quota piu' alta fra creste, colline e montagna; un albero sta in piedi solo se
  // i suoi piedi e i due lati della chioma stanno SOTTO quel profilo (prima ce n'erano che spuntavano nel cielo, a ogni formato dello schermo).
  function profiloTerreno() {
    const pr = new Array(961).fill(1e9);
    document.querySelectorAll("#paesaggio-partita .colline .cresta, #paesaggio-partita .colline .collina, #paesaggio-partita .colline .montagna .corpo").forEach((p) => {
      const piatto = appiattisci(p.getAttribute("d"), 1.5); // la geometria del tracciato, senza chiedere mille volte al browser
      if (piatto) {
        for (let i = 0; i < piatto.length; i++) {
          const q = { x: piatto[i][0], y: piatto[i][1] };
          if (q.x < -2 || q.x > 1922) continue;
          const k = Math.round(q.x / 2);
          if (q.y < pr[k]) pr[k] = q.y;
        }
        return;
      }
      const lun = p.getTotalLength();
      for (let l = 0; l <= lun; l += 1.5) {
        const q = p.getPointAtLength(l);
        if (q.x < -2 || q.x > 1922) continue;
        const k = Math.round(q.x / 2);
        if (q.y < pr[k]) pr[k] = q.y;
      }
    });
    return pr;
  }
  function piantaAlberi() {
    const campioni = []; for (let k = 0; k <= 400; k++) campioni.push(ptSentiero((L * k) / 400));
    const vicinoAlSentiero = (x, y, d) => campioni.some((p) => Math.hypot(p.x - x, p.y - y) < d);
    const vicinoAUnPosto = (x, y, d) => Object.keys(USATI).some((k) => Math.hypot(USATI[k].x - x, USATI[k].y - y) < d);
    const cb = PL.campoBase;
    const profilo = profiloTerreno();
    const terreno = (x) => profilo[clamp(Math.round(x / 2), 0, 960)];
    // un albero e' valido se: non tocca i riquadri ne' il sentiero ne' gli edifici, e poggia sul terreno (i piedi e i lati della chioma)
    const valido = (x, y, r, h, tipo, soglia) => {
      if (x - r < 4 || x + r > 1916) return false;
      const bb = [x - r - 2, y - h - 2, x + r + 2, y + 4];
      if (tocca(bb) || vicinoAlSentiero(x, y, 34 * scala(y) + r) || vicinoAlSentiero(x, y - h * 0.6, 30 * scala(y) + r) || vicinoAUnPosto(x, y, 60 * scala(y) + r)) return false;
      if (Math.hypot(x - cb.x, y - cb.y) < 90) return false;
      const m = 8 + r * 0.35;
      for (const dx of [-r, -r / 2, 0, r / 2, r]) if (terreno(x + dx) > y - m) return false;
      if (tipo === "conifera" && y < 430) return false; // sopra la linea della roccia e della neve non cresce niente
      return !alberi.some((a) => Math.hypot(a.x - x, (a.y - y) * 1.6) < (a.r + r) * soglia);
    };
    // le zone: [x1, y1, x2, y2, tipo, gruppi, [min, max] per gruppo, sparsi] — il prato davanti, il prato fra il cartello e il sentiero, il prato a destra,
    // il fianco della montagna, le creste. Si piantano GRUPPI (un centro e una nuvola di alberi attorno, di misure diverse) e qualche albero solo.
    const zone = [
      [570, 975, 1915, 1072, "tondo", 5, [3, 6], 4], [560, 712, 1400, 870, "tondo", 4, [3, 6], 3], [1410, 660, 1915, 860, "tondo", 2, [3, 5], 2],
      [1300, 430, 1915, 650, "conifera", 5, [3, 7], 3], [1760, 430, 1915, 520, "conifera", 1, [3, 4], 0],
    ];
    const nuovo = (x, y, tipo, k, soglia) => {
      const s = scala(y);
      const r = (tipo === "tondo" ? 16 : tipo === "cespuglio" ? 8 : 13) * s * k;
      const h = tipo === "tondo" ? r * 3.1 : tipo === "cespuglio" ? r * 1.4 : r * fraM(3.6, 4.8);
      if (!valido(x, y, r, h, tipo, soglia)) return false;
      alberi.push({ x, y, r, h, tipo, s, lean: fraM(-3.5, 3.5), lobi: casoM() });
      return true;
    };
    zone.forEach(([x1, y1, x2, y2, tipo, gruppi, [nmin, nmax], sparsi]) => {
      for (let g = 0; g < gruppi; g++) {
        let cx = 0, cy = 0, ok = false;
        for (let t = 0; t < 60 && !ok; t++) { cx = fraM(x1, x2); cy = fraM(y1, y2); ok = terreno(cx) < cy - 20; }
        const sp = fraM(32, 78) * scala(cy), grande = fraM(0.8, 1.25), n = nmin + Math.floor(casoM() * (nmax - nmin + 1));
        let fatti = 0;
        for (let t = 0; t < 120 && fatti < n; t++) {
          const x = cx + gaussM() * sp, y = cy + gaussM() * sp * 0.5;
          if (x < x1 - 30 || x > x2 + 30 || y < y1 - 20 || y > y2 + 20) continue;
          if (nuovo(x, y, tipo, grande * fraM(0.75, 1.25), 0.55)) fatti++;
        }
        // un paio di cespugli ai piedi del gruppo (solo nel prato)
        if (tipo === "tondo") for (let t = 0, c = 0; t < 30 && c < 2; t++) if (nuovo(cx + gaussM() * sp * 1.2, cy + gaussM() * sp * 0.6, "cespuglio", fraM(0.8, 1.3), 0.4)) c++;
      }
      for (let k = 0, f = 0; k < 200 && f < sparsi; k++) if (nuovo(fraM(x1, x2), fraM(y1, y2), tipo, fraM(0.7, 1.35), 1.2)) f++;
    });
    alberi.sort((a, b) => a.y - b.y);
    alberi.forEach((a, k) => {
      // davanti al sentiero (verso chi guarda) o dietro: dietro se il punto del sentiero piu` vicino e` piu` in basso di lui
      let dietro = false, d = 1e9; campioni.forEach((p) => { const dd = Math.hypot(p.x - a.x, p.y - a.y); if (dd < d) { d = dd; dietro = p.y > a.y; } });
      // il vento: ogni albero ha il suo periodo, la sua ampiezza e il suo ritardo; il ritardo cresce da sinistra a destra (la raffica attraversa il
      // paesaggio) con un po' di scarto a caso: non partono insieme e non oscillano insieme
      const vento = `--p:${fraM(0.8, 1.6).toFixed(2)}s;--p2:${fraM(1.9, 3.4).toFixed(2)}s;--dl:${((a.x / 1920) * 2.4 + fraM(0, 0.9)).toFixed(2)}s;--dl2:${fraM(0, 3).toFixed(2)}s;--a0:${-fraM(1.5, 5).toFixed(1)}deg;--a1:${-fraM(7, 14).toFixed(1)}deg;--lum:${fraM(0.9, 1.12).toFixed(2)}`;
      const g = sv("g", { class: "albero " + a.tipo + (prof(a.y) > 0.55 ? " lontano" : prof(a.y) > 0.2 ? " medio" : " vicino"), style: `--sx:${r1(a.x)}px;--sy:${r1(a.y)}px;${vento}`, "data-k": k }, dietro ? gAlberiDietro : gAlberiDavanti);
      sv("ellipse", { class: "ombra-albero", cx: a.x, cy: a.y + 1, rx: r1(a.r * 1.1), ry: r1(a.r * 0.32) }, g);
      const c = sv("g", { class: "corpo-albero", transform: `rotate(${r1(a.lean)} ${r1(a.x)} ${r1(a.y)})` }, g);
      if (a.tipo !== "cespuglio") sv("line", { class: "tronco", x1: a.x, y1: a.y, x2: a.x, y2: a.y - (a.tipo === "tondo" ? a.r * 1.5 : a.r * 1.2), style: `stroke-width:${r1(3 * a.s)}` }, c);
      if (a.tipo === "tondo") {
        // la chioma: un cerchio grande e, a seconda dell'albero, uno o due lobi di lato (non due alberi uguali)
        const cy = a.y - a.r * 1.9;
        if (a.lobi > 0.35) sv("circle", { class: "chioma", cx: r1(a.x - a.r * (0.55 + a.lobi * 0.2)), cy: r1(cy + a.r * 0.3), r: r1(a.r * (0.6 + a.lobi * 0.12)) }, c);
        if (a.lobi < 0.7) sv("circle", { class: "chioma", cx: r1(a.x + a.r * (0.5 + (1 - a.lobi) * 0.2)), cy: r1(cy + a.r * 0.15), r: r1(a.r * (0.55 + (1 - a.lobi) * 0.15)) }, c);
        sv("circle", { class: "chioma", cx: a.x, cy: r1(cy), r: r1(a.r) }, c);
        sv("circle", { class: "chioma riflesso", cx: r1(a.x - a.r * 0.3), cy: r1(cy - a.r * 0.25), r: r1(a.r * 0.45) }, c);
      } else if (a.tipo === "cespuglio") {
        sv("circle", { class: "chioma", cx: r1(a.x - a.r * 0.7), cy: r1(a.y - a.r * 0.5), r: r1(a.r * 0.75) }, c);
        sv("circle", { class: "chioma", cx: r1(a.x + a.r * 0.7), cy: r1(a.y - a.r * 0.45), r: r1(a.r * 0.7) }, c);
        sv("circle", { class: "chioma", cx: a.x, cy: r1(a.y - a.r * 0.9), r: r1(a.r * 0.9) }, c);
      } else {
        const l2 = 0.7 + a.lobi * 0.2;
        sv("path", { class: "chioma", d: `M${a.x},${r1(a.y - a.h)} L${r1(a.x + a.r)},${r1(a.y - a.r * 0.9)} L${r1(a.x - a.r)},${r1(a.y - a.r * 0.9)} Z` }, c);
        sv("path", { class: "chioma", d: `M${a.x},${r1(a.y - a.h * (0.74 + a.lobi * 0.08))} L${r1(a.x + a.r * l2)},${r1(a.y - a.r * 1.9)} L${r1(a.x - a.r * l2)},${r1(a.y - a.r * 1.9)} Z` }, c);
        sv("path", { class: "chioma riflesso", d: `M${a.x},${r1(a.y - a.h)} L${r1(a.x - a.r)},${r1(a.y - a.r * 0.9)} L${r1(a.x - a.r * 0.2)},${r1(a.y - a.r * 0.9)} Z` }, c);
      }
      a.el = g;
    });
    // le lucciole della sera: a gruppi fra gli alberi e i cespugli del prato, qualcuna sola; ognuna con la sua strada, il suo respiro di luce e il suo tempo
    const prato = alberi.filter((a) => a.tipo !== "conifera" && a.y > 700);
    const lucciola = (x, y) => {
      const r = fraM(1.5, 3);
      const gl = sv("g", { class: "lucciola", style: `--v:${fraM(5, 11).toFixed(1)}s;--dv:${fraM(0, 11).toFixed(1)}s;--b:${fraM(2.4, 6).toFixed(1)}s;--db:${fraM(0, 6).toFixed(1)}s;` + [1, 2, 3].map((j) => `--x${j}:${r1(gaussM() * 14)}px;--y${j}:${r1(-fraM(2, 26) * j / 2)}px`).join(";") }, gLucciole);
      sv("circle", { class: "alone", cx: r1(x), cy: r1(y), r: r1(r * 3.4) }, gl);
      sv("circle", { cx: r1(x), cy: r1(y), r: r1(r) }, gl);
    };
    if (prato.length) {
      for (let g = 0; g < 5; g++) {
        const a = prato[Math.floor(casoM() * prato.length)], n = 3 + Math.floor(casoM() * 6), sp = fraM(26, 60);
        for (let k = 0; k < n; k++) { const x = a.x + gaussM() * sp, y = a.y - fraM(6, 70) + gaussM() * 8; if (terreno(x) < y - 24) lucciola(x, y); }
      }
      for (let k = 0; k < 6; k++) { const a = prato[Math.floor(casoM() * prato.length)]; lucciola(a.x + gaussM() * 70, a.y - fraM(10, 90)); }
    }
  }
  // quando sorge un Castello, gli alberi che gli stanno addosso si tolgono (il mondo che reagisce, 300 ms)
  function abbattiAttorno(x, y, s) {
    alberi.forEach((a) => { if (a.el && !a.el.classList.contains("abbattuto") && Math.abs(a.x - x) < 44 * s + a.r && a.y > y - 80 * s && a.y < y + 14 * s + a.r) a.el.classList.add("abbattuto"); });
  }
  // una partita nuova: i Castelli del lampo spariscono, le loro pietre tornano pietre, gli alberi tolti tornano
  function azzeraCastelli() {
    if (!V.fatto) return;
    gCastelli.innerHTML = "";
    gStradine.querySelectorAll(".stradina.del-lampo").forEach((x) => x.remove());
    gCaselle.querySelectorAll(".pietra-mappa.ingresso").forEach((p) => {
      const i = Number(p.getAttribute("data-i"));
      if (TAPPE[i]) return;
      p.classList.remove("ingresso");
      const lg = p.querySelector(".lastra-g"), la = p.querySelector(".lastra");
      const tipo = BIVACCHI.includes(i) ? "piazzola" : i > 0 && i % 5 === 0 && i < N ? "miliare" : "";
      if (lg) lg.setAttribute("transform", trasformaLastra(i, tipo));
      if (la && !tipo && i !== 0 && i !== N) la.style.fill = TINTE[PIETRE[i].tinta];
    });
    Object.keys(USATI).forEach((k) => { if (!FISSI.includes(Number(k))) delete USATI[k]; });
    for (let k = presenti.length - 1; k >= 0; k--) if (!FISSI.includes(presenti[k][0])) presenti.splice(k, 1);
    alberi.forEach((a) => { if (a.el) a.el.classList.remove("abbattuto"); });
    gPolvere.innerHTML = "";
  }

  // ---- i meeple, i fantasmi, le tende di chi gioca ---------------------------------------------------------------------------------
  function costruisciGiocatori(chi) {
    V.chi = chi;
    gMeeple.innerHTML = ""; gFantasmi.innerHTML = ""; gTende.innerHTML = ""; gChip.innerHTML = "";
    V.pos = chi.map(() => 0); V.fant = chi.map(() => null); V.tenda = chi.map(() => null); V.dentro = chi.map(() => false);
    V.arrivo = chi.map(() => 0); V.cammina = chi.map(() => false); V.anim = chi.map(() => false); V.animF = chi.map(() => false); V.tendaRipiega = {};
    chi.forEach((x, i) => {
      const mk = (cls, parent) => {
        const e = sv("g", { class: cls, "data-i": i }, parent);
        e.style.setProperty("--colore-giocatore", x.colore);
        const c0 = sv("g", { class: "corpo" }, e);
        // il fantasma ha un gruppo per l'animazione della Nebbia (il gruppo posizionato non si anima: scivolerebbe)
        const c = cls === "fantasma" ? sv("g", { class: "fantasma-anima" }, c0) : c0;
        sv("ellipse", { class: "ombra-terra", cx: 0, cy: 2, rx: 13, ry: 4.5 }, c);
        if (cls === "meeple") {
          sv("ellipse", { class: "anello-turno", cx: 0, cy: 3, rx: 21, ry: 8 }, c);
          sv("ellipse", { class: "anello-premio", cx: 0, cy: 3, rx: 21, ry: 8 }, c);       // il Castello ti regala un passo: l'anello del padrone
          sv("ellipse", { class: "anello-premio colore", cx: 0, cy: 3, rx: 21, ry: 8 }, c);
        }
        const sc = cls === "meeple" ? 0.78 : 0.58; // i piedi sulla pietra: 50 di altezza il meeple, 37 il fantasma
        const sg = sv("g", { class: "sagoma", transform: `translate(${-24 * sc} ${-64 * sc}) scale(${sc})` }, c);
        sv("use", { href: "#mp-" + x.m.id, class: "contorno" }, sg);
        sv("use", { href: "#mp-" + x.m.id, class: "pieno" }, sg);
        if (cls === "meeple") {
          const t = sv("text", { class: "sigla" + (String(x.sigla).length > 1 ? " due" : ""), x: 24, y: 49, "text-anchor": "middle", "dominant-baseline": "central" }, sg);
          t.textContent = x.sigla;
          const st = sv("g", { class: "stella-testa", transform: "translate(0 -66)" }, c);
          sv("path", { d: "M0,-12 L3.5,-4 L12,-3.7 L5.7,1.8 L7.6,10 L0,5.5 L-7.6,10 L-5.7,1.8 L-12,-3.7 L-3.5,-4 Z" }, st);
        }
        const ti = sv("title", {}, e);
        ti.textContent = x.nome + (cls === "fantasma" ? ": ombra, dove arriva se risolve" : "");
        return e;
      };
      mk("fantasma", gFantasmi);
      mk("meeple", gMeeple);
      const te = sv("g", { class: "tendina", "data-i": i }, gTende);
      te.style.setProperty("--colore-giocatore", x.colore);
      // la tenda sta in un gruppo suo: e` quel gruppo che si anima (le proprieta` scale/rotate sul gruppo posizionato lo farebbero scivolare)
      // (.tenda-corpo porta lo scostamento di due tende sulla stessa pietra, .tenda-anima l'animazione: due gruppi, per non pestarsi)
      const tc = sv("g", { class: "tenda-corpo" }, te);
      const ta = sv("g", { class: "tenda-anima" }, tc);
      sv("ellipse", { class: "luce-tenda", cx: 0, cy: -22, rx: 42, ry: 22, fill: "url(#alone-caldo)" }, ta); // la luce della sera, sopra la tenda (il fondo resta sul terreno)
      sv("path", { class: "telo", d: "M-22,0 L22,0 L0,-34 Z" }, ta);
      sv("path", { class: "porta", d: "M-6,0 L6,0 L0,-13 Z" }, ta);
      sv("path", { class: "bandierina", d: "M0,-34 L0,-44 L8,-41 L0,-38" }, ta);
      const ti = sv("title", {}, te);
      ti.textContent = x.nome + " si è accampato qui";
      te.style.display = "none";
    });
  }
  // Una tenda che appare sta subito sulla sua pietra: senza questo la sua transizione di 420 ms (quella che la fa scivolare quando l'Afa la sposta)
  // la farebbe arrivare volando dall'angolo del paesaggio. `pos` e` la pietra (o null: si mostra e basta).
  function mostraTendaSu(te, pos) {
    const nuova = te.style.display === "none";
    if (nuova) te.style.transition = "none";
    te.style.display = "";
    if (pos !== null && pos !== undefined) posiziona(te, punto(pos));
    if (nuova) { if (te.getBoundingClientRect) te.getBoundingClientRect(); te.style.transition = ""; }
  }
  const meepleEl = (i) => gMeeple.querySelector(`.meeple[data-i="${i}"]`);
  const fantasmaEl = (i) => gFantasmi.querySelector(`.fantasma[data-i="${i}"]`);
  const tendaEl = (i) => gTende.querySelector(`.tendina[data-i="${i}"]`);
  // Le pedine stanno a misura di distanza: la scala dipende dalla y del punto. `su` e` quanto il saltello alza (in unita` della pedina, non scalate).
  const posiziona = (e, p, su) => { const sc = scalaPezzi(p.y); e.style.transform = `translate(${p.x}px, ${p.y - (su || 0) * sc}px) scale(${sc})`; };

  // ---- il sentiero: meeple, fantasmi, tende, bivacchi, Castelli ----------------------------------------------------------------------
  function inTestaVisto() {
    let migliore = -1;
    V.pos.forEach((p, i) => { if (p > 0 && (migliore < 0 || p > V.pos[migliore] || (p === V.pos[migliore] && V.arrivo[i] < V.arrivo[migliore]))) migliore = i; });
    return migliore;
  }
  function disegnaSentiero() {
    if (!V.fatto || !V.chi.length) return;
    const sera = V.modo === "partita" && Gioco.sera;
    const turno = V.modo === "partita" && !sera && Gioco.stato !== "fine_round" ? Gioco.indiceCorrente : -1;
    const testa = V.modo === "partita" ? inTestaVisto() : -1;
    const gioc = (i) => (V.modo === "partita" ? Gioco.giocatori[i] : null);
    V.chi.forEach((x, i) => {
      const me = meepleEl(i), fa = fantasmaEl(i), te = tendaEl(i);
      if (!me) return;
      const g = gioc(i);
      const accampata = !!(g && g.accampato);
      me.classList.toggle("turno", i === turno && !(g && Percorso.dorme(g)));
      me.classList.toggle("in-testa", i === testa);
      me.classList.toggle("accampata", accampata);
      me.classList.toggle("dentro", !!V.dentro[i]);
      me.classList.toggle("cammina", !!V.cammina[i]);
      // il fantasma: per tutti, se l'ombra e` piu' avanti (mai per chi e' accampato o fermo a un bivacco); la sera svaniscono
      const f = V.fant[i];
      fa.style.display = f !== null && f !== undefined ? "" : "none";
      if (f !== null && f !== undefined && !V.animF[i]) posiziona(fa, punto(f));
      if (!V.anim[i]) posiziona(me, punto(V.pos[i]));
      // la tenda: dove il meeple dormira', piantata dal momento della conferma
      const t = V.tenda[i];
      if (t !== null && t !== undefined) mostraTendaSu(te, t); else te.style.display = "none";
      te.classList.toggle("accesa", !!V.dentro[i]);
    });
    // piu' meeple sulla stessa pietra: accanto, davanti chi e' arrivato prima (chi e' di turno sempre davanti); le tende e i fantasmi ugualmente
    // (le distanze sono nelle unita` della pedina: la scala della prospettiva le porta da sola)
    const sulla = {};
    V.chi.forEach((x, i) => { (sulla[V.pos[i]] = sulla[V.pos[i]] || []).push(i); });
    Object.keys(sulla).forEach((cella) => {
      const lista = sulla[cella];
      lista.sort((a, b) => (a === turno ? -1 : b === turno ? 1 : 0) || V.arrivo[a] - V.arrivo[b]);
      lista.forEach((i, k) => {
        const corpo = meepleEl(i).querySelector(".corpo");
        corpo.setAttribute("transform", `translate(${-11 * k} ${-12 * k}) scale(${1 - 0.07 * k})`);
      });
      lista.slice().reverse().forEach((i) => gMeeple.appendChild(meepleEl(i)));
    });
    const tendeSu = {};
    V.chi.forEach((x, i) => { if (V.tenda[i] !== null && V.tenda[i] !== undefined) (tendeSu[V.tenda[i]] = tendeSu[V.tenda[i]] || []).push(i); });
    Object.keys(tendeSu).forEach((cella) => tendeSu[cella].forEach((i, k) => {
      tendaEl(i).querySelector(".tenda-corpo").setAttribute("transform", `translate(${tendeSu[cella].length > 1 ? (k ? 13 : -13) : 0} 0)`);
    }));
    V.chi.forEach((x, i) => { if (V.tenda[i] === null || V.tenda[i] === undefined) tendaEl(i).querySelector(".tenda-corpo").removeAttribute("transform"); });
    const fantSu = {};
    V.chi.forEach((x, i) => { if (V.fant[i] !== null && V.fant[i] !== undefined) (fantSu[V.fant[i]] = fantSu[V.fant[i]] || []).push(i); });
    Object.keys(fantSu).forEach((cella) => fantSu[cella].forEach((i, k) => {
      const suTenda = tendeSu[cella] ? 1 : 0; // sulla pietra di una tenda i fantasmi si scostano in su
      // R5 (D4): sulla pietra del meeple di un ALTRO il fantasma spunta da dietro la sua spalla destra (la testa sopra la testa del meeple)
      const diFianco = V.chi.some((y, j) => j !== i && Number(V.pos[j]) === Number(cella));
      const f = fantasmaEl(i);
      f.classList.toggle("di-fianco", diFianco);
      const dx = (diFianco ? 18 : 0) - 10 * k - 16 * suTenda, dy = (diFianco ? -28 : 0) - 10 * k - 26 * suTenda;
      f.querySelector(".corpo").style.transform = `translate(${dx}px, ${dy}px)`;
    }));
    // i bivacchi (tre aspetti; la sera quello acceso oggi si vede da lontano) e i Castelli (il colore del padrone; il vessillo ammainato se il padrone e' accampato)
    Object.keys(V.bivacchi).forEach((pos) => {
      const b = gBivacchi.querySelector(`.bivacco[data-pos="${pos}"]`);
      if (!b) return;
      const stato = V.bivacchi[pos];
      const era = b.getAttribute("class");
      const nuova = "bivacco " + stato + (era && era.includes("accende") && stato === "oggi" ? " accende" : "") + (sera && stato === "oggi" ? " notte" : "");
      if (era !== nuova) b.setAttribute("class", nuova);
      const tit = b.querySelector("title");
      if (tit) tit.textContent = stato === "spento" ? "Bivacco: oggi ci si ferma tutti" : stato === "oggi" ? "Bivacco acceso oggi: ci si ferma tutti" : "Bivacco acceso ieri: ci si passa sopra";
    });
    // i Sassi (settima stesura, §8): si vedono tutti; spariscono quando qualcuno ci passa sopra
    if (gSassi) {
      const sassi = V.modo === "partita" ? Gioco.sassi || {} : {};
      gSassi.querySelectorAll(".sasso").forEach((e) => { if (!sassi[e.getAttribute("data-pos")]) e.remove(); });
      Object.keys(sassi).forEach((pos) => {
        if (gSassi.querySelector(`.sasso[data-pos="${pos}"]`)) return;
        const q = punto(Number(pos)), k = scalaPezzi(q.y), x = Gioco.giocatori.indexOf(sassi[pos]);
        const e = sv("g", { class: "sasso", "data-pos": pos, transform: `translate(${r1(q.x)} ${r1(q.y)}) scale(${r1(k)})` }, gSassi);
        sv("title", {}, e).textContent = `Il sasso di ${V.chi[x] ? V.chi[x].nome : ""}: il primo che ci passa sopra torna indietro di un passo`;
        sv("path", { d: "M-13,3 L-8,-12 L5,-15 L14,-5 L11,6 L-4,8 Z", fill: "#8E8E96", stroke: V.chi[x] ? V.chi[x].colore : "#fff", "stroke-width": 3.5, "stroke-linejoin": "round" }, e);
      });
    }
    gCastelli.querySelectorAll(".tappa-mappa.pedaggio").forEach((c) => {
      const padrone = V.castelli[c.getAttribute("data-pos")];
      const g = padrone !== undefined && padrone !== null ? gioc(padrone) : null;
      c.classList.toggle("padrone", padrone !== undefined && padrone !== null);
      c.classList.toggle("chiuso", !!(g && Percorso.dorme(g)));
      if (padrone !== undefined && padrone !== null && V.chi[padrone]) c.style.setProperty("--colore-giocatore", V.chi[padrone].colore); else c.style.removeProperty("--colore-giocatore");
    });
  }

  // lo stato del gioco -> quello che si vede (quando nessuna scena e' in corso)
  // Un potenziamento (Valanga, Sorpasso, Robin Hood) cambia la partita SUBITO, ma il movimento si racconta dopo 300-350 ms, quando il cartello e` sul palco.
  // In quel buco un qualunque ridisegno (aggiornaComandi -> aggiorna -> sync) rimetteva le pedine gia` al loro posto nuovo, e la camminata non
  // partiva piu` (10/10, quarta prova: «con Robin Hood non si sono visti i movimenti»). Chi sta per muovere qualcuno chiama trattieni() PRIMA di
  // cambiare la partita; riproduci(ev, { rilascia: true }) lo toglie quando la scena parte. Per sicurezza una trattenuta vale al massimo 8 secondi.
  function trattieni() { V.trattenute.push(Date.now()); }
  function rilascia() { V.trattenute.shift(); }
  function sync() {
    if (V.modo !== "partita") return;
    if (V.trattenute.some((t) => Date.now() - t < 8000)) return;
    Gioco.giocatori.forEach((g, i) => {
      V.pos[i] = g.pedina;
      V.fant[i] = Gioco.sera ? (V.fantSera[i] === undefined ? null : V.fantSera[i]) : Percorso.fantasma(Gioco, g);
      // D1: la tenda annullata resta a vista finche' si ripiega (300 ms): `tendaRipiega` ricorda la sua pietra
      V.tenda[i] = V.tendeAnnullate.has(i) && V.tendaRipiega[i] !== undefined ? V.tendaRipiega[i] : g.accampato && g.tenda ? g.tenda.pos : null;
      V.dentro[i] = !!g.dentro;
      V.arrivo[i] = g.arrivo;
    });
    V.bivacchi = Object.assign({}, Gioco.bivacchi);
    V.castelli = {};
    Object.keys(Gioco.castelli).forEach((pos) => { V.castelli[pos] = Gioco.giocatori.indexOf(Gioco.castelli[pos]); });
  }
  // ---- il cielo, la testata, il tempo ------------------------------------------------------------------------------------------------
  function xTramonto(restano, oreTotali) {
    if (restano <= 0) return TRAMONTO_FUORI_X;
    if (oreTotali <= 1) return 1570;
    return Math.round(1480 + ((oreTotali - restano) * 180) / (oreTotali - 1));
  }
  function aggiornaCielo() {
    if (!V.fatto) return;
    const inIscr = V.modo === "iscrizione";
    const m = inIscr ? { tempo: "sereno", carattere: "stabile", ora: 2, nuovo: false } : Gioco.meteo;
    if (!m) return;
    const sera = !inIscr && Gioco.sera;
    const tram = !inIscr && Gioco.tramonto && !sera ? Gioco.tramonto : null;
    const ore = inIscr ? 3 : Gioco.regole.oreTramonto;
    svg.dataset.tempo = sera ? "sera" : m.tempo;
    variaVento();
    svg.classList.toggle("tramonto", !!tram);
    const x = sera ? TRAMONTO_FUORI_X : tram ? xTramonto(tram.restano, ore) : inIscr ? SOLE_ISCRIZIONE_X : SOLE_X[Math.min(m.ora, SOLE_X.length - 1)];
    const p = puntoSoleX(x);
    sole.style.transform = `translate(${p.x}px, ${p.y}px)`;
    sole.classList.toggle("nascosto", sera);
    luna.classList.toggle("visibile", sera);
    // le nuvole delle previsioni: col preavviso arrivano da destra; col Temporale o il Ventoso arrivati stanno sul sole; con l'Afa se ne vanno
    const pv = inIscr ? null : Percorso.preavviso(Gioco);
    const arrivo = pv ? pv.tempo : (m.tempo === "temporale" || m.tempo === "ventoso" ? m.tempo : null);
    const PRE = inIscr ? 3 : Gioco.regole.preavviso;
    nuvole.setAttribute("data-tipo", arrivo ? TEMPI_NUVOLA[arrivo] : "");
    nuvole.classList.toggle("visibili", !!arrivo && !sera && !(arrivo === "afa" && !pv));
    const fra = pv ? pv.fra : 0;
    const px = fra ? 1760 - (PRE - fra) * 150 : p.x + 50, py = fra ? 330 - (PRE - fra) * 30 : p.y - 16;
    nuvole.style.transform = `translate(${px}px, ${py}px) scale(${fra ? 1 : 1.3})`;
    if (inIscr) return;
    // la testata: «Giorno 2 di 5»
    const gp = $("giorno-percorso");
    if (gp) {
      gp.innerHTML = `Giorno <b>${Gioco.numeroRoundCorrente}</b> <small>di ${Gioco.numeroRoundTotale}</small><span class="punti" aria-hidden="true">${Array.from({ length: Gioco.numeroRoundTotale }, (_, k) => `<i class="${k + 1 < Gioco.numeroRoundCorrente ? "passato" : k + 1 === Gioco.numeroRoundCorrente ? "oggi" : ""}"></i>`).join("")}</span>`;
    }
    const t = TESTI_TEMPO[m.tempo];
    const ta = $("tempo-adesso");
    if (ta) ta.innerHTML = sera ? `${icona("sera")}<span>Sera</span>` : `${icona(m.tempo)}<span>${t.nome}</span>`;
    let notizia = "";
    let classe = "";
    if (sera || Gioco.lampoGiorno) notizia = "";
    else if (pv) {
      const nn = TESTI_TEMPO[pv.tempo];
      notizia = `${icona(pv.tempo)}<span>Fra <b>${pv.fra} ${pv.fra === 1 ? "ora" : "ore"}</b>${pv.tempo === "sereno" ? ` ${nn.preavviso}` : `: <b>${nn.nome}</b>, ${nn.breve}`}</span>`;
      classe = "preavviso";
    } else if (m.nuovo && m.tempo !== "sereno") { notizia = `${icona(m.tempo)}<span><b>${t.nome}</b>: ${t.riga}</span>`; classe = "nuovo"; }
    // R8: il tramonto ha la sua pillola, sotto la riga del tempo (non si mescola piu' con il preavviso)
    let pillola = "", ultima = false;
    if (tram && !Gioco.lampoGiorno) {
      if (tram.restano >= 2) pillola = `Tramonto: ancora <b>${tram.restano}</b> giri di ruota, poi scende la sera`;
      else if (tram.restano === 1) { pillola = `<b>Ultimo giro!</b> Poi scende la sera`; ultima = true; }
      else { pillola = `<b>Non si gira più</b>: dai la soluzione, oppure scende la sera`; ultima = true; }
    }
    const rt = $("riga-tramonto");
    if (rt) {
      const html = pillola ? `${icona("tramonto")}<span>${pillola}</span>` : "";
      const cambioT = rt.dataset.chiave !== html;
      if (cambioT) rt.innerHTML = html;
      rt.dataset.chiave = html;
      rt.classList.toggle("vuota", !pillola);
      rt.classList.toggle("ultima", ultima);
      if (cambioT && pillola && !ridotto()) { rt.classList.remove("entra"); void rt.offsetWidth; rt.classList.add("entra"); }
    }
    const r = $("riga-tempo");
    if (r) {
      const cambio = r.dataset.chiave !== notizia;
      r.innerHTML = notizia;
      r.dataset.chiave = notizia;
      r.classList.toggle("vuota", !notizia);
      ["preavviso", "nuovo"].forEach((c) => r.classList.toggle(c, classe === c));
      if (cambio && notizia && !ridotto()) { r.classList.remove("entra"); void r.offsetWidth; r.classList.add("entra"); }
    }
  }

  // ---- le tessere dei viaggiatori ----------------------------------------------------------------------------------------------------------
  let chiaveTessere = "";
  function costruisciTessere() {
    const cont = $("colonna-giocatori");
    cont.innerHTML = "";
    cont.classList.add("tessere-viaggio");
    V.chi.forEach((x, i) => {
      const t = el("div", "tessera-viaggio", cont);
      t.style.setProperty("--colore-giocatore", x.colore);
      t.style.setProperty("--sfondo-turno", x.colore + "8C");
      t.innerHTML = `<span class="pedina-tessera" aria-hidden="true">${meepleHtml(x.m, x.sigla)}</span><span class="nome"></span><span class="dove"></span><span class="seconda"></span>`;
      const b = el("button", "btn-tenda nascosta", t, `<svg viewBox="0 0 48 48" aria-hidden="true"><use href="#ic-tenda"/></svg>`);
      b.type = "button";
      b.title = `${x.nome} si accampa`;
      b.setAttribute("aria-label", `${x.nome} si accampa`);
      b.addEventListener("click", (ev) => { ev.stopPropagation(); apriConfermaTenda(Gioco.giocatori[i]); });
      t.addEventListener("click", (ev) => { if (ev.target.closest && ev.target.closest(".btn-usa")) { ev.stopPropagation(); usaPotenziamento(i); } });
    });
    chiaveTessere = V.chi.map((x) => x.nome + x.m.id + x.sigla).join("|");
  }
  // Il pulsante «Usa» di un potenziamento: solo a chi ha il turno, a gioco fermo, se in questo momento si puo` usare. Si ricalcola a ogni ridisegno
  // delle tessere e, per rete di sicurezza, ogni 400 ms (10/10, quarta prova: un Sorpasso preso da primo non mostrava il pulsante quando poi non
  // lo era piu`): il pulsante compare appena il potenziamento e` usabile, qualunque cosa l'abbia reso tale.
  function usabilePer(i) {
    const g = Gioco.giocatori[i];
    if (!g || !g.pot) return false;
    const spegni = Gioco.stato !== "idle" || Ruota.inAnimazione();
    return !!(!spegni && i === Gioco.indiceCorrente && !Gioco.sera && Gioco.stato === "idle" && potenziamentoUsabile(g));
  }
  function controllaPulsantiUsa() {
    if (V.modo !== "partita" || !V.fatto) return;
    const cont = $("colonna-giocatori");
    if (!cont || cont.children.length !== V.chi.length) return;
    for (let i = 0; i < V.chi.length; i++) {
      const c = cont.children[i];
      if (c && !!c.querySelector(".btn-usa") !== usabilePer(i)) { aggiornaTessere(); return; }
    }
  }
  setInterval(controllaPulsantiUsa, 400);
  function aggiornaTessere() {
    if (V.modo !== "partita") return;
    const cont = $("colonna-giocatori");
    if (chiaveTessere !== V.chi.map((x) => x.nome + x.m.id + x.sigla).join("|") || cont.children.length !== V.chi.length) costruisciTessere();
    const testa = inTestaVisto();
    const sera = Gioco.sera;
    const spegni = Gioco.stato !== "idle" || Ruota.inAnimazione();
    V.chi.forEach((x, i) => {
      const t = cont.children[i];
      if (!t) return;
      const g = Gioco.giocatori[i];
      const inTurno = i === Gioco.indiceCorrente && !sera && Gioco.stato !== "lampo" && !Percorso.dorme(g);
      t.classList.toggle("turno", inTurno);
      t.classList.toggle("accampata", !!g.accampato);
      t.classList.toggle("in-testa", i === testa);
      // il nome con le carte; a squadre, chi ha la mano
      const pot = g.pot ? PERCORSO_POTENZIAMENTI[g.pot] : null;
      const usabile = !!(pot && usabilePer(i));
      const carta = (classe, titolo, n, dentro) => (n > 0 ? `<span class="${classe}" title="${n > 1 ? n + " " + titolo : titolo}">${dentro}${n > 1 ? `<i class="conta">${n}</i>` : ""}</span>` : "");
      // in mano: il Jolly, un solo potenziamento alla volta (con «Usa» per chi ha il turno, se si puo`), gli Scarponi armati, il Freno
      const carte = carta("carta-jolly", "Jolly", g.jolly, "J")
        + (pot ? (usabile ? `<button type="button" class="pot btn-usa" title="Usa: ${escHtml(pot.riga)}">${pot.nome} ▶</button>` : `<span class="pot" title="${escHtml(pot.riga)}">${pot.nome}</span>`) : "")
        + (g.scarponi > 0 ? `<span class="pot" title="Alla prossima consonante giusta fai ${g.scarponi} ${g.scarponi === 1 ? "passo" : "passi"} in più">Scarponi +${g.scarponi}</span>` : "")
        + carta("segno freno", "Frenato", g.frenato || g.frenatoQuestoTurno ? 1 : 0, svgSimbolo("freno"));
      const mano = g.componenti && g.componenti.length ? ` <small>· ${escHtml(chiTocca(g).nome)}</small>` : "";
      const nome = `${escHtml(g.nome)}${mano}<span class="carte">${carte}</span>`;
      const nomeEl = t.querySelector(".nome");
      if (nomeEl.innerHTML !== nome) nomeEl.innerHTML = nome;
      t.querySelector(".dove").textContent = V.pos[i] >= N ? "traguardo!" : V.pos[i] === 0 ? "al via" : "al " + V.pos[i];
      // la seconda riga: una di queste, e solo una
      let seconda = "";
      if (g.accampato && g.tenda) seconda = `<span class="segno-tenda" style="color:${x.colore}"><svg viewBox="0 0 48 48" aria-hidden="true"><use href="#ic-tenda"/></svg></span><span>dorme al <b>${V.tenda[i] !== null && V.tenda[i] !== undefined ? V.tenda[i] : g.tenda.pos}</b></span>`;
      else if (g.fermo) seconda = `<svg class="fiamma-tessera" viewBox="-30 -58 60 68" aria-hidden="true"><path d="M0,-52 C16,-34 22,-18 12,-2 C10,-12 5,-15 2,-22 C-5,-13 -17,-9 -12,2 C-26,-8 -20,-30 0,-52 Z" fill="#FFD23F" stroke="#FF9F1C" stroke-width="4"/></svg><span>fino all’alba</span>`;
      else if (V.fant[i] !== null && V.fant[i] !== undefined) seconda = `<span class="fantasma-tessera">${meepleHtml(x.m, "")}</span><span>al <b>${V.fant[i]}</b></span>`;
      const secEl = t.querySelector(".seconda");
      if (secEl.innerHTML !== seconda) secEl.innerHTML = seconda;
      // il pulsante della tenda: solo accanto a chi puo' accamparsi; mentre la ruota gira resta, spento
      const b = t.querySelector(".btn-tenda");
      const puo = !g.accampato && Percorso.puoAccamparsi(Gioco, g);
      if (b) {
        b.classList.toggle("nascosta", !puo);
        b.classList.toggle("spenta", spegni);
        b.disabled = spegni;
      }
    });
  }



  // ---- le scene: i movimenti raccontati un pezzo alla volta -----------------------------------------------------------------------------------
  // Una scena e` una lista di passi, ognuno con la sua durata. Le scene non si accavallano: una dopo l'altra.
  function accoda(f) {
    V.coda.push(f);
    if (!V.inCoda) vaAvanti();
  }
  function vaAvanti() {
    const f = V.coda.shift();
    if (!f) { V.inCoda = false; return; }
    V.inCoda = true;
    V.occupata += 1;
    f(() => {
      V.occupata -= 1;
      if (!V.coda.length) { sync(); disegnaSentiero(); aggiornaTessere(); }
      vaAvanti();
    });
  }
  // UN ritmo solo (sesta stesura, scelta 2): DURATA_PASSO_MS a pietra, di giorno, di sera, sul Castello, nei passi del lampo, nel Sorpasso.
  // Il salto della Scorciatoia e` un arco, piu` veloce: 2 passi di tempo per le tre pietre.
  const durataPasso = (da, a) => DURATA_PASSO_MS * Math.abs(a - da);
  const durataSalto = (n) => Math.max(DURATA_PASSO_MS, Math.round((2 * DURATA_PASSO_MS * n) / PERCORSO_TRAMPOLINO_SALTO));
  // Uno sbuffo di polvere sul punto toccato: fa «vedere» il movimento anche da lontano. Piccolo a ogni pietra, grande all'atterraggio e quando un Castello sorge.
  function polvere(p, grande, sc) {
    if (!gPolvere) return;
    const k = sc === undefined ? scalaPezzi(p.y) : sc;
    const e = sv("ellipse", { class: "sbuffo" + (grande ? " grande" : ""), cx: r1(p.x), cy: r1(p.y + 2), rx: r1(9 * k), ry: r1(3.5 * k) }, gPolvere);
    setTimeout(() => e.remove(), 600);
  }
  // Il meeple i va da `da` ad `a` lungo il sentiero (non in linea retta: il sentiero curva), alla stessa velocita` su ogni pietra, con un saltello
  // e uno sbuffo di polvere a ogni pietra toccata. Con `arco` (il salto della Scorciatoia) un arco alto, senza il dondolio della camminata.
  function camminaMeeple(i, da, a, dur, fine, arco) {
    const me = meepleEl(i);
    if (!me || da === a) { V.pos[i] = a; fine(); return; }
    if (ridotto()) { V.pos[i] = a; V.anim[i] = false; disegnaSentiero(); fine(); return; }
    V.anim[i] = true;
    V.cammina[i] = true;
    me.classList.add("cammina");
    if (arco) me.classList.add("salta");
    const n = Math.abs(a - da), t0 = performance.now();
    let ultima = da;
    const passo = (ora) => {
      const t = Math.min(1, (ora - t0) / dur);
      const pos = da + (a - da) * t, p = punto(pos);
      posiziona(me, p, arco ? Math.sin(Math.PI * t) * 46 : Math.abs(Math.sin(Math.PI * t * n)) * 7);
      if (!arco) { const k = da < a ? Math.floor(pos) : Math.ceil(pos); if (k !== ultima) { polvere(punto(k)); ultima = k; } }
      if (t < 1) requestAnimationFrame(passo);
      else {
        V.anim[i] = false;
        V.cammina[i] = false;
        me.classList.remove("cammina", "salta");
        V.pos[i] = a;
        V.arrivo[i] = ++V.ultimoArrivo;
        polvere(punto(a), !!arco);
        disegnaSentiero();
        fine();
      }
    };
    requestAnimationFrame(passo);
  }
  // Il chip che sale sopra un punto: «+2», «×2», «−1»; con `simbolo` il distintivo davanti ("castello" o "trampolino", o true = castello). A misura di distanza.
  function chipSu(punto_, testo, simbolo) {
    const sim = simbolo === true ? "castello" : simbolo || null;
    const sc = scalaPezzi(punto_.y);
    const e = sv("g", { class: "chip-mappa", transform: `translate(${r1(punto_.x)} ${r1(punto_.y - 64 * sc)}) scale(${r1(sc)})` }, gChip);
    const w = String(testo).length * 15 + 22 + (sim ? 28 : 0);
    sv("rect", { x: -w / 2, y: -19, width: w, height: 38, rx: 9 }, e);
    if (sim) {
      CASELLE_PERCORSO[sim === "castello" ? "pedaggio" : "trampolino"].simbolo.forEach((seg) => {
        const attr = { d: seg.d, transform: `translate(${-w / 2 + 8} -13) scale(0.26)` };
        if (seg.stroke) Object.assign(attr, { fill: "none", stroke: "#111", "stroke-width": seg.stroke, "stroke-linecap": "round", "stroke-linejoin": "round" });
        else Object.assign(attr, { "fill-rule": seg.regola || "nonzero", fill: "#111" });
        sv("path", attr, e);
      });
    }
    const t = sv("text", { x: sim ? 12 : 0, y: 1, "text-anchor": "middle", "dominant-baseline": "central" }, e);
    t.textContent = testo;
    setTimeout(() => e.remove(), DURATA_CHIP_PASSI_MS + 100);
  }
  // Il cartello della Scorciatoia «indica»: i due » lampeggiano arancio, uno dopo l'altro (800 ms)
  function indica(pos) {
    const e = svg && svg.querySelector(`.tappa-mappa[data-pos="${pos}"]`);
    if (!e) return;
    e.classList.remove("indica");
    if (e.getBoundingClientRect) e.getBoundingClientRect(); // riavvia l'animazione
    e.classList.add("indica");
    setTimeout(() => e.classList.remove("indica"), 850);
  }
  // La Scorciatoia nascosta che si scopre: il cartello compare sul suo posto (se il paesaggio gliene da`) e sparisce quando l'ombra e` saltata.
  function scopriScorciatoia(pos) {
    const s = V.fatto ? posto(pos) : null;
    return s ? edificio("trampolino", gTappe, pos, s, " scoperta") : null;
  }
  // Il fantasma i va da `da` ad `a` col saltello (la stessa camminata del meeple); con `arco`, l'arco della Scorciatoia (R4: il salto oltre la Scorciatoia)
  function camminaFantasma(i, da, a, dur, fine, arco) {
    const fa = fantasmaEl(i);
    if (!fa || da === a || ridotto()) { V.fant[i] = a; V.animF[i] = false; disegnaSentiero(); fine(); return; }
    V.animF[i] = true;
    fa.classList.add("in-cammino");
    const n = Math.abs(a - da), t0 = performance.now();
    const passo = (ora) => {
      const t = Math.min(1, (ora - t0) / dur);
      posiziona(fa, punto(da + (a - da) * t), arco ? Math.sin(Math.PI * t) * 38 : Math.abs(Math.sin(Math.PI * t * n)) * 6);
      if (t < 1) requestAnimationFrame(passo);
      else { V.animF[i] = false; fa.classList.remove("in-cammino"); V.fant[i] = a; disegnaSentiero(); fine(); }
    };
    requestAnimationFrame(passo);
  }
  // R4: il fantasma arriva in DUE TEMPI quando sulla sua strada c'e` una tappa. vg viene da Percorso.viaggioFantasma:
  // { daVista, eVista, atterra, scorciatoia, bivacco }. Il fantasma scivola fino alla fine della strada (chip «+4»); poi, se e` caduto su una
  // Scorciatoia: pausa, il cartello indica e il fantasma salta dove porta, ad arco (chip col distintivo e «+3»). Su un bivacco che ferma il chip
  // dice «al bivacco». (Il Castello del gioco, che qui toglieva un passo, e` tolto.)
  function viaggioFantasmaScena(i, vg, testo, fine, camminata) {
    const puntoDi = (c) => punto(Math.min(N, Math.max(0, c)));
    const cominciaDa = vg.daVista !== null && vg.daVista !== undefined ? vg.daVista : null;
    const poi = (ms, f) => attesa(ms, f);
    const chiudi = () => { V.fant[i] = vg.atterra; disegnaSentiero(); fine(); };
    const scorciatoia = () => {
      if (vg.scorciatoia === null || vg.atterra === vg.scorciatoia) { chiudi(); return; }
      poi(DURATA_FANTASMA_PAUSA_TAPPA_MS, () => {
        const cartello = scopriScorciatoia(vg.scorciatoia); // la Scorciatoia nascosta si scopre: un cartello sulla pietra, finche' l'ombra non salta
        indica(vg.scorciatoia);
        poi(500, () => {
          camminaFantasma(i, vg.scorciatoia, vg.atterra, durataSalto(Math.abs(vg.atterra - vg.scorciatoia)), () => {
            chipSu(puntoDi(vg.atterra), "+" + (vg.atterra - vg.scorciatoia), "trampolino");
            if (cartello) cartello.remove();
            poi(120, chiudi);
          }, true);
        });
      });
    };
    const scivola = () => {
      const chip = () => chipSu(puntoDi(vg.eVista), vg.bivacco !== null && vg.scorciatoia === null ? "al bivacco" : testo || "");
      if (camminata && !ridotto() && V.fant[i] !== null && V.fant[i] !== undefined && V.fant[i] !== vg.eVista) {
        // l'ombra di un potenziamento (Robin Hood) CAMMINA fino a dove arriva, con lo stesso ritmo delle pedine (10/10, quarta prova)
        chip();
        camminaFantasma(i, V.fant[i], vg.eVista, Math.max(DURATA_PASSO_MS, durataPasso(V.fant[i], vg.eVista)), () => poi(120, scorciatoia));
        return;
      }
      V.fant[i] = vg.eVista;
      disegnaSentiero();
      chip();
      poi(DURATA_PASSO_MS, scorciatoia);
    };
    // il fantasma che compare: prima sulla pedina (300 ms), poi scivola
    if (cominciaDa === null) { V.fant[i] = V.pos[i]; disegnaSentiero(); poi(300, scivola); } else scivola();
  }

  // Racconta una lista di eventi del motore (percorso.js), uno dopo l'altro. Le posizioni vere sono gia` cambiate; qui si vedono a pezzi.
  //  · passo: il meeple cammina (480 ms a pietra). La sua camminata si SPEZZA alle pietre dei Castelli di un altro che attraversa (la lista
  //    del motore ha il passo intero, poi i `castello`: la scena li legge prima di raccontare);
  //  · castello (§3.2 della scheda di Chiara): il meeple e` fermo sulla pietra; +300 il Castello si attiva (onde, porta accesa, stendardo,
  //    bagliore); +700 il padrone ha l'anello ai piedi; +1.000 il padrone fa il suo passo e sopra di lui sale il «+1»; +1.730 il meeple riparte;
  //  · trampolino (§3.4): pausa, il cartello indica, il salto ad arco, il chip «+3»;
  //  · indietro: il meeple torna indietro, alla stessa velocita`. Se subito dopo c'e` il passo di un altro che prende il suo posto (il Sorpasso)
  //    i due si muovono INSIEME;
  //  · bivacco: il fuoco si accende o resta.
  // ctx: { bolla(e) -> dati di una bolla o null, conBolla(dati, poi) } — la passeggiata della sera ferma la scena finche' il regista chiude la bolla.
  function eseguiEventi(eventi, ctx, fine) {
    ctx = ctx || {};
    const lista = eventi.slice();
    const idx = (g) => Gioco.giocatori.indexOf(g);
    const conBolla = (b, poi) => (b && ctx.conBolla ? ctx.conBolla(b, poi) : poi());
    // un Castello attraversato: gli eventi del padrone che lo seguono (il suo passo) si prendono qui e si raccontano a meta` della visita
    const visitaCastello = (c, fatto) => {
      const k = lista.indexOf(c);
      let sub = [];
      if (k >= 0) {
        lista.splice(k, 1);
        let n = 0;
        while (k + n < lista.length && lista[k + n].t !== "castello" && lista[k + n].g === c.padrone) n++;
        sub = lista.splice(k, n);
      }
      if (!c.attivo) { fatto(); return; }
      const j = idx(c.padrone);
      const cast = gCastelli.querySelector(`.tappa-mappa[data-pos="${c.pos}"]`);
      attesa(300, () => {
        if (cast) { cast.classList.add("attivo"); setTimeout(() => cast.classList.remove("attivo"), 1100); }
        conBolla(ctx.bolla ? ctx.bolla(c) : null, () => attesa(400, () => {
          const pm = meepleEl(j);
          if (pm) { pm.classList.add("premiato"); setTimeout(() => pm.classList.remove("premiato"), 900); }
          attesa(300, () => {
            eseguiEventi(sub, ctx, () => { chipSu(punto(V.pos[j]), "+1", true); attesa(250, fatto); });
          });
        }));
      });
    };
    const passoDi = (e, i, fatto) => {
      const castelli = lista.filter((x) => x.t === "castello" && x.attivo && x.visitatore === e.g && x.pos > e.da && x.pos <= e.a).sort((a, b) => a.pos - b.pos);
      let corrente = V.pos[i];
      const avanti = () => {
        const c = castelli.shift();
        const meta = c ? Math.max(c.pos, corrente) : e.a;
        camminaMeeple(i, corrente, meta, durataPasso(corrente, meta), () => {
          corrente = meta;
          if (c) visitaCastello(c, avanti); else fatto();
        });
      };
      avanti();
    };
    const prossimo = () => {
      const e = lista.shift();
      if (!e) { fine(); return; }
      const i = e.g ? idx(e.g) : -1;
      const dopo = () => attesa(60, prossimo);
      if (e.t === "passo") {
        // la sera: la pedina e' arrivata al suo fantasma, e il fantasma si dissolve
        passoDi(e, i, () => { if (Gioco.sera && V.fantSera[i] === e.a) dissolviFantasma(i); dopo(); });
      } else if (e.t === "indietro") {
        const q = lista[0] && lista[0].t === "passo" && lista[0].come === "salto" && lista[0].g !== e.g && lista[0].da === e.a ? lista.shift() : null;
        if (q) { // il Sorpasso: chi viene scavalcato torna indietro e chi scavalca avanza, nello stesso tempo
          let n = 2;
          const unito = () => { if (--n === 0) dopo(); };
          camminaMeeple(i, V.pos[i], e.a, durataPasso(V.pos[i], e.a), unito);
          passoDi(q, idx(q.g), unito);
        } else camminaMeeple(i, V.pos[i], e.a, durataPasso(V.pos[i], e.a), dopo);
      } else if (e.t === "bivacco") {
        V.bivacchi[e.pos] = "oggi";
        if (e.accende) { const b = gBivacchi.querySelector(`.bivacco[data-pos="${e.pos}"]`); if (b) b.setAttribute("class", "bivacco oggi accende"); }
        if (!Gioco.sera) V.fant[i] = null; // la sera il fantasma si e' gia' dissolto arrivando (dissolviFantasma)
        disegnaSentiero();
        aggiornaTessere();
        conBolla(ctx.bolla ? ctx.bolla(e) : null, () => attesa(e.accende ? 500 : 120, prossimo));
      } else if (e.t === "trampolino") {
        // la Scorciatoia: il meeple e` sulla pietra blu; il salto e` l'evento `passo` che segue (da questa pietra)
        const q = lista[0] && lista[0].t === "passo" && lista[0].g === e.g && lista[0].da === e.pos ? lista.shift() : null;
        attesa(DURATA_SALTO_SCORCIATOIA_PAUSA_MS, () => {
          indica(e.pos);
          if (!q) { attesa(500, prossimo); return; }
          attesa(500, () => camminaMeeple(i, V.pos[i], q.a, durataSalto(Math.abs(q.a - q.da)), () => {
            chipSu(punto(V.pos[i]), "+" + (q.a - q.da), "trampolino");
            dopo();
          }, true));
        });
      } else if (e.t === "sasso") {
        // un Sasso toccato (il passo indietro e` l'evento `indietro` che segue)
        polvere(punto(e.pos), true);
        chipSu(punto(e.pos), e.parato ? "Sasso parato" : "Sasso!");
        attesa(600, prossimo);
      } else if (e.t === "scudo") {
        if (V.pos[i] !== undefined) chipSu(punto(V.pos[i]), "Scudo!");
        attesa(500, prossimo);
      } else if (e.t === "castello") {
        // un Castello che nessun passo ha spezzato (la pedina ci e` passata sopra in un salto): si racconta con la pedina dov'e`
        lista.unshift(e);
        visitaCastello(e, dopo);
      } else prossimo();
    };
    prossimo();
  }
  // opz: { chip: { i, testo }, viaggio, rilascia, ombre }. `ombre`: le ombre che cambiano per un potenziamento (Valanga, Robin Hood, Sorpasso) non
  // saltano: camminano, insieme alla pedina (stessa camminata, stesso ritmo). `rilascia`: toglie la trattenuta presa da trattieni().
  function riproduci(ev, opz) {
    opz = opz || {};
    if (V.modo !== "partita" || !V.fatto) { if (opz.rilascia) rilascia(); return; }
    accoda((fine) => {
      if (opz.rilascia) rilascia();
      const vg = opz.viaggio || null;
      const ia = opz.chip ? opz.chip.i : -1;
      const conTappe = !!(vg && ia >= 0 && (vg.scorciatoia !== null || vg.bivacco !== null));
      const conOmbre = !!opz.ombre || ev.some((e) => e.t === "indietro" || e.t === "sasso"); // anche un Sasso incontrato riporta indietro pedina e ombra
      const prima = V.fant.slice();   // l'ombra che si vedeva fin qui
      const posPrima = V.pos.slice(); // e dov'erano le pedine
      const ombre = [];               // le ombre che camminano: { i, da, a }
      // il fantasma scivola subito sulla casella dove si fermera' davvero (§5.0); i chip salgono nello stesso istante
      const nuova = Gioco.giocatori.map((g, i) => (Gioco.sera ? (V.fantSera[i] === undefined ? null : V.fantSera[i]) : Percorso.fantasma(Gioco, g)));
      Gioco.giocatori.forEach((g, i) => {
        if (conTappe && i === ia) V.fant[i] = vg.daVista === null || vg.daVista === undefined ? null : vg.daVista;
        else if (conOmbre && !Gioco.sera && !ridotto() && (prima[i] === undefined ? null : prima[i]) !== nuova[i]) {
          const da = prima[i] === null || prima[i] === undefined ? posPrima[i] : prima[i];
          const a = nuova[i] === null ? g.pedina : nuova[i];
          V.fant[i] = da;
          if (da !== a || nuova[i] === null) ombre.push({ i, da, a, sparisce: nuova[i] === null });
        } else V.fant[i] = nuova[i];
      });
      disegnaSentiero();
      if (opz.chip && !conTappe && nuova[opz.chip.i] !== null && nuova[opz.chip.i] !== undefined) chipSu(punto(nuova[opz.chip.i]), opz.chip.testo);
      // con le ombre che camminano (potenziamenti) il viaggio dell'ombra di chi ruba parte INSIEME alla pedina di chi subisce; altrimenti dopo, come prima
      const insieme = conTappe && conOmbre;
      let aspetto = 1 + ombre.length + (insieme ? 1 : 0);
      const unito = () => { if (--aspetto === 0) { if (conTappe && !insieme) viaggioFantasmaScena(ia, vg, opz.chip.testo, fine, conOmbre); else fine(); } };
      ombre.forEach((o) => camminaFantasma(o.i, o.da, o.a, Math.max(DURATA_PASSO_MS, durataPasso(o.da, o.a)), () => { if (o.sparisce) { V.fant[o.i] = null; disegnaSentiero(); } unito(); }));
      if (insieme) viaggioFantasmaScena(ia, vg, opz.chip.testo, unito, conOmbre);
      eseguiEventi(ev, {}, unito);
    });
  }

  // La Nebbia: il fantasma trema e va via (520 ms)
  function nebbia(i) {
    if (V.modo !== "partita" || !V.fatto) return;
    const fa = fantasmaEl(i);
    if (fa) { fa.classList.add("svanisce"); setTimeout(() => { fa.classList.remove("svanisce"); V.fant[i] = null; disegnaSentiero(); aggiornaTessere(); }, DURATA_NEBBIA_MS); }
  }
  // La sera: il fantasma svanisce con un'animazione che si vede (DURATA_FANTASMA_SERA_MS), poi si toglie
  function dissolviFantasma(i) {
    const fa = fantasmaEl(i);
    if (!fa || V.fant[i] === null || V.fant[i] === undefined) { V.fantSera[i] = null; return; }
    fa.classList.add("svanisce-sera");
    attesa(DURATA_FANTASMA_SERA_MS, () => { fa.classList.remove("svanisce-sera"); V.fantSera[i] = null; V.fant[i] = null; disegnaSentiero(); aggiornaTessere(); });
  }
  function tendaPiantata(i) {
    if (V.modo !== "partita" || !V.fatto) return;
    sync();
    // il fantasma di chi si accampa svanisce (300 ms); la tenda resta, piena, dove il meeple dormira'
    const te = tendaEl(i);
    if (te) { te.classList.remove("anteprima"); mostraTendaSu(te, V.tenda[i]); }
    V.fant[i] = null;
    disegnaSentiero();
  }
  function tendeAnnullate(ev) {
    if (V.modo !== "partita" || !V.fatto || !ev.length) return;
    ev.forEach((e) => {
      const i = Gioco.giocatori.indexOf(e.g);
      V.tendeAnnullate.add(i);
      const te = tendaEl(i);
      // D1: la tenda resta a vista (sulla sua pietra) finche' si ripiega; solo dopo sparisce e parte la festa (300 ms, poi 20 di margine)
      if (V.tenda[i] !== null && V.tenda[i] !== undefined) V.tendaRipiega[i] = V.tenda[i];
      else if (e.g.tenda) V.tendaRipiega[i] = e.g.tenda.pos;
      if (te) { mostraTendaSu(te, V.tendaRipiega[i]); te.classList.add("ripiega"); }
      setTimeout(() => { V.tendeAnnullate.delete(i); delete V.tendaRipiega[i]; if (te) te.classList.remove("ripiega"); sync(); disegnaSentiero(); aggiornaTessere(); }, DURATA_TENDA_RIPIEGA_MS + 20);
    });
  }
  function giroFinito(ev) {
    // un'ora e' passata: il sole scende di uno scatto, le nuvole avanzano; le tende valgono (e, se serve, scivolano)
    if (V.modo !== "partita") return;
    ev.forEach((e) => { if (e.spostata) { const i = Gioco.giocatori.indexOf(e.g); V.tenda[i] = e.a; } });
    aggiornaCielo();
    if (!V.occupata) sync();
    disegnaSentiero();
    aggiornaTessere();
  }

  // ---- la passeggiata della sera --------------------------------------------------------------------------------------------------------------
  // R10 (scheda dei ritocchi): la sera e` una scena RACCONTATA un pezzo alla volta, con l'annuncio grande:
  //  1. «Scende la sera» e sotto chi cammina e perche' (opz.intro);
  //  2. la bolla della prima volta (opz.bolla), solo quando l'annuncio e` sparito;
  //  3. per ogni viaggiatore l'annuncio col suo meeple, che resta a schermo finche' cammina (minimo 1.500 ms): «cammina · fino al suo
  //     fantasma, al 22» oppure «va a dormire · nella tenda, al 20»; il meeple parte quando l'annuncio e` entrato (260 ms);
  //  4. chi resta fermo, una volta sola, alla fine (opz.fermi).
  // Chi cammina e` gia` stato deciso da Percorso.passeggiata: tratte = [{ g, ev, tenda }]. Una bolla di strada (bivacco, Castello) ferma la scena
  // finche' il regista non la chiude, e l'annuncio del viaggiatore si toglie per lasciarle il posto. Si cammina a 480 ms a pietra come di giorno
  // (sesta stesura: «trooooppo veloci»), e ai Castelli la camminata si spezza come di giorno.
  function passeggiata(tratte, opz, fine) {
    opz = opz || {};
    if (V.modo !== "partita" || !V.fatto) { fine(); return; }
    accoda((finita) => {
      aggiornaCielo(); // il cielo della sera
      // dov'erano al calare della sera: prima di camminare le pedine stanno ferme dove stavano
      tratte.forEach((t) => { const i = Gioco.giocatori.indexOf(t.g); const primo = t.ev.find((e) => e.t === "passo" && e.g === t.g); if (primo) V.pos[i] = primo.da; });
      V.dentro = V.dentro.map(() => false);
      V.tenda = Gioco.giocatori.map((g, i) => (g.accampato && g.tenda ? g.tenda.pos : null));
      const ultimaPosizione = (t) => { let a = null; t.ev.forEach((e) => { if (e.t === "passo" && e.g === t.g) a = e.a; }); return a === null ? t.g.pedina : a; };
      // I FANTASMI (Damiano, 09/10, terza prova): quello di chi cammina fino alla sua ombra RESTA a vista come meta e si dissolve quando la
      // pedina lo raggiunge (eseguiEventi); quelli di chi non cammina svaniscono ora, con l'animazione (non di colpo). Regole invariate.
      const prima = opz.fantasmiPrima || [];
      V.fantSera = Gioco.giocatori.map(() => null);
      tratte.forEach((t) => { if (t.tenda) return; const i = Gioco.giocatori.indexOf(t.g); const dove = ultimaPosizione(t); if (dove > V.pos[i]) V.fantSera[i] = dove; });
      V.fant = Gioco.giocatori.map((g, i) => (V.fantSera[i] !== null ? V.fantSera[i] : prima[i] !== undefined && prima[i] !== null ? prima[i] : null));
      disegnaSentiero();
      Gioco.giocatori.forEach((g, i) => { if (V.fantSera[i] === null && V.fant[i] !== null) dissolviFantasma(i); });
      const voceViaggiatore = (t) => {
        const g = t.g;
        const i = Gioco.giocatori.indexOf(g);
        const fermoOra = !t.ev.some((e) => e.t === "passo" && e.g === g);
        const dove = ultimaPosizione(t);
        let sopra, sotto;
        if (t.tenda) { sopra = "va a dormire"; sotto = fermoOra ? "nella tenda, dove già si trova" : "nella tenda, " + alN(dove); }
        else if (fermoOra) { sopra = "ha risolto"; sotto = "ma è fermo al bivacco: non avanza"; }
        else { sopra = "cammina"; sotto = "fino alla sua ombra, " + alN(dove); }
        return { stile: "tocca" + (g.nome.length > 12 ? " lungo" : ""), meeple: { m: V.chi[i].m, sigla: V.chi[i].sigla }, colore: g.colore, sopra, titolo: g.nome, sotto };
      };
      // 3. un viaggiatore: l'annuncio entra, il meeple parte dopo 260 ms, l'annuncio resta finche' cammina (minimo 1.500 ms)
      const tratta = (k) => {
        if (k >= tratte.length) { fermiAlla(); return; }
        const t = tratte[k];
        const i = Gioco.giocatori.indexOf(t.g);
        const voce = voceViaggiatore(t);
        let inizio = Date.now();
        const mostra = () => { Annuncio.mostra(voce); inizio = Math.min(inizio, Date.now()); };
        const concludi = () => {
          if (t.tenda) { V.dentro[i] = true; disegnaSentiero(); }
          const resto = Math.max(0, DURATA_ANNUNCIO_VIAGGIATORE_MIN_MS - (Date.now() - inizio));
          attesa(resto, () => { Annuncio.nascondi(); attesa(220 + DURATA_PASSEGGIATA_PAUSA_MS, () => tratta(k + 1)); });
        };
        // una bolla di strada: l'annuncio si toglie finche' la bolla e` aperta, poi ritorna
        const conBolla = (b, passa) => {
          Annuncio.nascondi();
          attesa(260, () => bolla(b, () => { mostra(); passa(); }));
        };
        mostra();
        attesa(260, () => eseguiEventi(t.ev, { bolla: opz.bollaDelloEvento, conBolla }, concludi));
      };
      // 4. chi resta fermo, una volta sola, alla fine
      const fermiAlla = () => {
        const f = opz.fermi;
        if (!f || !f.length) { fineTutte(); return; }
        const nomi = f.map((g) => g.nome);
        const elenco = nomi.length <= 1 ? nomi[0] : nomi.slice(0, -1).join(", ") + " e " + nomi[nomi.length - 1];
        const titolo = f.length === 1 ? `${elenco} resta ${f[0].pedina === 0 ? "al via" : alN(f[0].pedina)}` : `${elenco} restano dove sono`;
        Annuncio.mostra({ stile: "tocca tempo sera", icona: "sera", titolo, sotto: "niente soluzione, niente tenda", durata: DURATA_ANNUNCIO_SERA_MS });
        attesa(DURATA_ANNUNCIO_SERA_MS + 250, fineTutte);
      };
      const fineTutte = () => { Annuncio.nascondi(); V.fantSera = []; sync(); disegnaSentiero(); aggiornaTessere(); finita(); fine(); };
      // 1-2. «Scende la sera», poi la bolla della prima volta (quando l'annuncio e` sparito)
      const intro = opz.intro || { sotto: "" };
      Annuncio.mostra({ stile: "tocca tempo sera", icona: "sera", titolo: "Scende la sera", sotto: intro.sotto, durata: DURATA_ANNUNCIO_SERA_MS });
      attesa(DURATA_ANNUNCIO_SERA_MS + 250, () => (opz.bolla ? bolla(opz.bolla, () => tratta(0)) : tratta(0)));
    });
  }

  // ---- il velo, la conferma della tenda, le bolle ------------------------------------------------------------------------------------------
  // Le unita` del paesaggio in pixel dello schermo (la finestra non e' sempre 16:9: il paesaggio resta intero e centrato)
  function aPixel(x, y) {
    const W = window.innerWidth || 1920, H = window.innerHeight || 1080;
    const sc = Math.min(W / 1920, H / 1080);
    return { x: x * sc + (W - 1920 * sc) / 2, y: y * sc + (H - 1080 * sc) / 2, sc };
  }
  // il contrario: un punto dello schermo (pixel) nelle unita` del paesaggio
  function daPixel(x, y) {
    const W = window.innerWidth || 1920, H = window.innerHeight || 1080;
    const sc = Math.min(W / 1920, H / 1080);
    return { x: (x - (W - 1920 * sc) / 2) / sc, y: (y - (H - 1080 * sc) / 2) / sc, sc };
  }
  // il buco del velo: in unita` del paesaggio, convertito in pixel dello schermo (e riconvertito se la finestra cambia)
  let bucoUnita = null;
  function velo(buco) {
    const v = $("velo");
    if (!v) return;
    bucoUnita = buco ? { x: buco.x, y: buco.y, rx: buco.rx, ry: buco.ry } : null;
    v.classList.toggle("nascosta", !buco);
    if (!buco) return;
    const px = aPixel(buco.x, buco.y);
    v.style.setProperty("--buco", `radial-gradient(ellipse ${buco.rx * px.sc}px ${buco.ry * px.sc}px at ${px.x}px ${px.y}px, transparent 68%, #000 100%)`);
  }
  let chiudiBollaFn = null;
  function bolla(b, poi) {
    const e = $("bolla-prima-volta");
    if (!e || !V.fatto) { if (poi) poi(); return; }
    let p, sotto = false, stretta = false, buco, destra = false;
    const g = b.i !== undefined ? V.chi[b.i] : null;
    const cella = (c) => punto(c);
    if (b.a === "meeple") {
      // «Giusta! Un passo avanti.»: sopra la pedina
      const c = cella(V.pos[b.i] !== undefined ? V.pos[b.i] : 0), sc = scalaPezzi(c.y);
      buco = { x: c.x, y: c.y - 20 * sc, rx: 150, ry: 90 };
      p = { x: c.x, y: c.y - 84 * sc };
      if (p.y < 150) { p = { x: c.x, y: c.y + 36 * sc }; sotto = true; }
      void g;
    } else if (b.a === "ombra") {
      // «Se risolvi la frase adesso, arrivi fin qui.»: la freccia punta l'ombra (il fantasma); il buco copre la pedina e l'ombra, cosi' si vede la distanza
      const fi = V.fant[b.i];
      if (fi === null || fi === undefined) { if (poi) poi(); return; }
      const c = cella(V.pos[b.i] !== undefined ? V.pos[b.i] : 0), f = cella(fi), sf = scalaPezzi(f.y);
      buco = { x: (c.x + f.x) / 2, y: (c.y + f.y) / 2 - 20, rx: Math.max(150, Math.abs(c.x - f.x) / 2 + 100), ry: Math.max(90, Math.abs(c.y - f.y) / 2 + 80) };
      p = { x: f.x, y: f.y - 84 * sf };
      if (p.y < 150) { p = { x: f.x, y: f.y + 36 * sf }; sotto = true; }
    } else if (b.a === "castello") {
      const s = posto(b.pos), q = cella(b.pos);
      if (!s) { if (poi) poi(); return; }
      buco = { x: (s.x + q.x) / 2, y: (s.y + q.y) / 2 - 30, rx: 170, ry: 120 };
      p = { x: s.x, y: s.y - 104 * s.s };
    } else if (b.a === "sole") {
      const x = Gioco.tramonto ? xTramonto(Gioco.tramonto.restano, Gioco.regole.oreTramonto) : 880;
      const q = puntoSoleX(x);
      buco = { x: q.x, y: q.y, rx: 150, ry: 120 };
      p = { x: Math.min(q.x, 1500), y: q.y + 70 };
      sotto = true; stretta = true;
    } else if (b.a === "cielo") {
      buco = { x: 1760, y: 330, rx: 220, ry: 120 };
      p = { x: 1690, y: 200 };
      stretta = true;
    } else if (b.a === "tenda") {
      // R13: la bolla della tenda punta il PULSANTE accanto alla tessera (a destra della tessera); il buco e` sul pulsante
      const col = $("colonna-giocatori");
      const btn = col && col.children[b.i] ? col.children[b.i].querySelector(".btn-tenda") : null;
      const r = btn ? btn.getBoundingClientRect() : { left: 0, top: 0, width: 100, height: 100 };
      const c = daPixel(r.left + r.width / 2, r.top + r.height / 2);
      buco = { x: c.x, y: c.y, rx: 120, ry: 90 };
      p = { x: c.x + (r.width / 2) / c.sc + 28, y: c.y };
      destra = true;
    } else if (b.a === "tessera") {
      // «Tienila sulla tessera.»: la bolla punta la tessera di chi ha preso la Scatola
      const col = $("colonna-giocatori");
      const t = col && col.children[b.i] ? col.children[b.i] : null;
      const r = t ? t.getBoundingClientRect() : { left: 0, top: 0, width: 100, height: 100 };
      const c = daPixel(r.left + r.width / 2, r.top + r.height / 2);
      buco = { x: c.x, y: c.y, rx: (r.width / 2) / c.sc + 70, ry: (r.height / 2) / c.sc + 60 };
      p = { x: c.x + (r.width / 2) / c.sc + 28, y: c.y };
      destra = true;
    } else if (b.a === "carattere") {
      buco = { x: 1640, y: 130, rx: 300, ry: 100 };
      p = { x: 1640, y: 190 };
      sotto = true; stretta = true;
    } else if (b.a === "bivacco") {
      const s = posto(b.pos), q = cella(b.pos);
      if (!s) { if (poi) poi(); return; }
      buco = { x: (s.x + q.x) / 2, y: (s.y + q.y) / 2 - 20, rx: 170, ry: 120 };
      p = { x: s.x, y: s.y - 104 * s.s };
    } else {
      const q = cella(Math.round(N * 0.3));
      buco = { x: q.x, y: q.y, rx: 300, ry: 90 };
      p = { x: q.x, y: q.y + 40 };
      sotto = true;
    }
    e.innerHTML = `<span>${escHtml(b.testo)}</span><button type="button" class="ok">Ok</button>`;
    e.classList.remove("nascosta");
    e.classList.toggle("sotto", sotto);
    e.classList.toggle("stretta", stretta);
    e.classList.toggle("destra", destra);
    const meta = stretta ? 250 : 340;
    e.style.left = `calc(var(--u) * ${destra ? Math.round(p.x) : Math.round(Math.max(meta, Math.min(1920 - meta, p.x)))})`;
    e.style.top = `calc(var(--u) * ${Math.round(p.y)})`;
    velo(buco);
    e.classList.remove("entra"); void e.offsetWidth; e.classList.add("entra");
    const chiudi = () => {
      if (chiudiBollaFn !== chiudi) return;
      chiudiBollaFn = null;
      e.classList.add("nascosta");
      velo(null);
      if (poi) poi();
    };
    chiudiBollaFn = chiudi;
    e.querySelector(".ok").addEventListener("click", chiudi);
  }
  function chiudiBolla() { if (chiudiBollaFn) chiudiBollaFn(); }
  // Toccare il velo chiude una bolla (non la conferma); Esc chiude entrambe
  function suVelo() { if (chiudiBollaFn && !confermaAperta) chiudiBolla(); }
  let confermaAperta = null;
  function conferma(g, p, esito) {
    const e = $("conferma-tenda");
    const i = Gioco.giocatori.indexOf(g);
    if (!e || !V.fatto) { esito(false); return; }
    const x = V.chi[i];
    const a = punto(g.pedina), b = punto(p.dorme);
    // la tenda in anteprima, gia' sulla sua pietra; il velo ha un buco sul pezzo di sentiero fra il meeple e la tenda
    const te = tendaEl(i);
    if (te) { mostraTendaSu(te, p.dorme); te.classList.add("anteprima"); }
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 - 30;
    const rx = Math.max(170, Math.abs(a.x - b.x) / 2 + 120), ry = Math.max(110, Math.abs(a.y - b.y) / 2 + 100);
    velo({ x: cx, y: cy, rx, ry });
    e.classList.remove("nascosta");
    e.classList.toggle("alta", cy - ry < 760);
    e.style.setProperty("--colore-giocatore", x.colore);
    const passi = (n) => (n === 1 ? "passo" : "passi");
    const dove = p.alBivacco ? `al ${p.dorme}, al bivacco` : `al ${p.dorme}`;
    const spiega = p.alBivacco && p.persi === 0 ? "si ferma al bivacco" : `la metà dei ${p.distanza} fino all’ombra`;
    const ore = Gioco.regole.oreTramonto;
    e.innerHTML = `<h2>${meepleHtml(x.m, x.sigla, "piccolo")}${escHtml(g.nome)} si accampa?</h2>
      <ul>
        <li class="al-sicuro">fa <b>${p.passi}</b> ${passi(p.passi)} <small>(${spiega})</small></li>
        ${p.persi > 0 ? `<li class="persi"><b>${p.persi}</b> ${p.persi === 1 ? "passo perso" : "passi persi"}</li>` : ""}
        <li>stasera dorme <b>${dove}</b></li>
        <li>oggi non gira più</li>
        ${p.primaTenda ? `<li class="tramonto-riga">comincia il <b>tramonto</b>: ancora <b>${ore}</b> ${ore === 1 ? "giro" : "giri"} di ruota per tutti, poi scende la sera</li>` : ""}
      </ul>
      <p class="nota-tenda">in tenda sei al riparo: nessun potenziamento ti tocca fino all’alba</p>
      <div class="scelte"><button type="button" class="primario" id="btn-mi-accampo">Mi accampo</button><button type="button" class="secondario" id="btn-no-continuo">No, continuo</button></div>`;
    const chiudi = (si) => {
      if (confermaAperta !== chiudi) return;
      confermaAperta = null;
      e.classList.add("nascosta");
      velo(null);
      if (te) { te.classList.remove("anteprima"); if (!si) te.style.display = "none"; }
      esito(si);
    };
    confermaAperta = chiudi;
    $("btn-mi-accampo").addEventListener("click", () => chiudi(true));
    $("btn-no-continuo").addEventListener("click", () => chiudi(false));
  }

  // ---- le caselle libere del Castello del lampo --------------------------------------------------------------------------------------------------
  // Sul sentiero, le pietre libere (quelle a cui il paesaggio da` posto, percorso.js caselleLibere) si accendono; sotto il mouse compare il
  // Castello che si sta per costruire, con la sua stradina, a misura di distanza. Il tocco e l'anello stanno nella meta` della distanza dalla
  // pietra vicina (in vetta le pietre distano 33: due tocchi da 34 si coprirebbero).
  function mostraLibere(posizioni, quandoScelta, g, soloAnello) {
    nascondiLibere();
    if (!V.fatto) return;
    posizioni.forEach((q) => {
      const p = punto(q), s = soloAnello ? null : posto(q);
      if (!s && !soloAnello) return;
      const pv = punto(Math.min(N, q + 1)), passo = Math.hypot(pv.x - p.x, pv.y - p.y);
      const rAnello = clamp(passo * 0.5 - 3, 11, 30), rTocco = clamp(passo * 0.5 - 1, 13, 34);
      const c = sv("g", { class: "casella-libera", "data-pos": q, tabindex: 0, role: "button" }, gLibere);
      c.style.setProperty("--colore-giocatore", g ? g.colore : "#F39C12");
      const ti = sv("title", {}, c);
      ti.textContent = "Casella " + q;
      sv("circle", { class: "anello", cx: r1(p.x), cy: r1(p.y), r: r1(rAnello) }, c);
      if (s) { const ghost = sv("g", { class: "ghost tappa-mappa pedaggio", transform: `translate(${r1(s.x)} ${r1(s.y)}) scale(${r1(s.s)})` }, c); // stesso disegno del Castello vero
      sv("line", { class: "filo", x1: 0, y1: 0, x2: r1((p.x - s.x) / s.s), y2: r1((p.y - s.y) / s.s) }, ghost);
      ghost.insertAdjacentHTML("beforeend", `<g class="edificio">${EDIFICI.pedaggio}</g>`); }
      sv("circle", { class: "tocco", cx: r1(p.x), cy: r1(p.y), r: r1(rTocco), fill: "transparent" }, c);
      c.addEventListener("click", () => quandoScelta(q));
      c.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); quandoScelta(q); } });
    });
  }
  function nascondiLibere() { if (gLibere) gLibere.innerHTML = ""; }
  // Un Castello piantato dal lampo: SORGE dalla terra sul suo posto (600 ms, con tre sbuffi di polvere grandi), con la stradina; la pietra diventa
  // d'ingresso e gli alberi che gli stanno addosso si tolgono (300 ms)
  function castelloPiazzato(pos, indice) {
    if (!V.fatto) return;
    const s = posto(pos);
    if (!s) return; // le caselle libere sono solo quelle con un posto: qui non si arriva
    occupa(pos, s);
    stradina(pos, s, " del-lampo");
    const pietra = gCaselle.querySelector(`.pietra-mappa[data-i="${pos}"]`);
    if (pietra) {
      pietra.classList.add("ingresso");
      const lastra = pietra.querySelector(".lastra-g"), la = pietra.querySelector(".lastra");
      if (lastra) lastra.setAttribute("transform", trasformaLastra(pos, "ingresso"));
      if (la) la.style.fill = ""; // la tinta della pietra tace: la pietra d'ingresso e` blu
    }
    const e = edificio("pedaggio", gCastelli, pos, s, " del-lampo");
    V.castelli[pos] = indice;
    abbattiAttorno(s.x, s.y, s.s);
    if (!ridotto()) {
      e.classList.add("sorge");
      setTimeout(() => e.classList.remove("sorge"), 700);
      for (let k = 0; k < 3; k++) setTimeout(() => polvere({ x: s.x + (k - 1) * 22 * s.s, y: s.y }, true, s.s), k * 90);
    }
    disegnaSentiero();
  }

  // ---- l'iscrizione sulla stessa plancia ---------------------------------------------------------------------------------------------------------
  function disegnaLegendaTappe() {
    const tt = $("tessere-tappe");
    if (!tt) return;
    tt.innerHTML = "";
    const tipi = [];
    Object.keys(TAPPE).map(Number).sort((a, b) => a - b).forEach((p) => { if (!tipi.includes(TAPPE[p])) tipi.push(TAPPE[p]); });
    tipi.forEach((tipo) => {
      const c = CASELLE_PERCORSO[tipo];
      const t = el("button", "tessera-tappa " + tipo, tt, `<span class="disco" aria-hidden="true">${svgCasella(tipo)}</span><span class="testo"><b>${c.titolo}</b><span>${rigaTappa(tipo)}</span></span>`);
      t.type = "button";
      t.dataset.tipo = tipo;
      const evidenzia = (si) => document.querySelectorAll(`#paesaggio-partita .tappa-mappa.${tipo}`).forEach((x) => x.classList.toggle("evidenzia", si));
      t.addEventListener("pointerenter", () => evidenzia(true));
      t.addEventListener("pointerleave", () => evidenzia(false));
      t.addEventListener("focus", () => evidenzia(true));
      t.addEventListener("blur", () => evidenzia(false));
      t.addEventListener("click", () => { evidenzia(true); setTimeout(() => evidenzia(false), 1800); });
    });
    // il bivacco: tre aspetti, una riga sola
    const bv = el("button", "tessera-tappa bivacco-legenda", tt, `<span class="disco fuoco" aria-hidden="true"><svg viewBox="-30 -58 60 68"><path d="M0,-52 C16,-34 22,-18 12,-2 C10,-12 5,-15 2,-22 C-5,-13 -17,-9 -12,2 C-26,-8 -20,-30 0,-52 Z" fill="#FFD23F" stroke="#FF9F1C" stroke-width="3"/><path d="M-14,-2 L14,8 M-14,8 L14,-2" stroke="#6B4423" stroke-width="7" stroke-linecap="round"/></svg></span><span class="testo"><b>Bivacco</b><span>oggi ci si ferma tutti, domani ci si passa sopra</span></span>`);
    bv.type = "button";
    const evidenziaB = (si) => document.querySelectorAll("#paesaggio-partita .bivacco").forEach((x) => x.classList.toggle("evidenzia", si));
    bv.addEventListener("pointerenter", () => evidenziaB(true));
    bv.addEventListener("pointerleave", () => evidenziaB(false));
    bv.addEventListener("click", () => { evidenziaB(true); setTimeout(() => evidenziaB(false), 1800); });
  }
  // I meeple al campo base: in fila davanti alla grande tenda, il primo iscritto davanti, ciascuno col suo meeple e il suo colore
  function disegnaIscrizione() {
    if (!V.fatto || V.modo !== "iscrizione") return;
    const chi = partecipanti();
    const sigle = sigleDiStasera();
    costruisciGiocatori(chi.map((c, i) => ({ m: c.meeple, colore: c.colore, sigla: sigle[i], nome: c.nome })));
    const p0 = punto(0);
    V.chi.forEach((x, i) => {
      const me = meepleEl(i);
      const corpo = me.querySelector(".corpo");
      corpo.removeAttribute("transform");
      posiziona(me, { x: p0.x - 34 * (i + 1) - 20, y: p0.y - 6 - (i % 2) * 10 });
      V.anim[i] = true; // la posizione non e' quella di una pietra
      me.classList.remove("turno", "in-testa", "accampata", "dentro");
    });
    // il primo iscritto davanti: i meeple si disegnano dall'ultimo al primo
    V.chi.map((x, i) => i).reverse().forEach((i) => gMeeple.appendChild(meepleEl(i)));
    gFantasmi.querySelectorAll(".fantasma").forEach((f) => { f.style.display = "none"; });
    gTende.querySelectorAll(".tendina").forEach((t) => { t.style.display = "none"; });
    V.bivacchi = {}; BIVACCHI.forEach((q) => { V.bivacchi[q] = "spento"; });
    document.querySelectorAll("#paesaggio-partita .bivacco").forEach((b) => b.setAttribute("class", "bivacco spento"));
    azzeraCastelli();
    aggiornaCielo();
  }
  function assicuraScena() {
    if (!palcoEl) { palcoEl = $("palco-percorso"); svg = $("paesaggio-partita"); if (svg && svg.addEventListener) svg.addEventListener("click", suPaesaggio); }
    // il palco deve essere visibile quando si misura il sentiero (getTotalLength su un svg nascosto puo' dire 0)
    palcoEl.classList.remove("nascosta");
    if (!V.fatto) costruisciScena();
  }
  function mostraIscrizione() {
    impostaLunghezza(Percorso.leggiRegole().caselle);
    assicuraScena();
    V.modo = "iscrizione";
    V.occupata = 0; V.coda = []; V.inCoda = false;
    document.body.classList.add("percorso-iscrizione");
    document.body.classList.remove("percorso-partita");
    palcoEl.classList.add("iscrizione");
    palcoEl.classList.remove("sera");
    velo(null);
    const bl = $("bolla-prima-volta"); if (bl) bl.classList.add("nascosta");
    const cf = $("conferma-tenda"); if (cf) cf.classList.add("nascosta");
    disegnaLegendaTappe();
    disegnaIscrizione();
  }
  // ---- la partita ---------------------------------------------------------------------------------------------------------------------------------
  function mostraPartita() {
    impostaLunghezza(Percorso.leggiRegole().caselle);
    assicuraScena();
    V.modo = "partita";
    palcoEl.classList.remove("iscrizione");
    document.body.classList.remove("percorso-iscrizione");
    document.body.classList.add("percorso-partita");
    nuovaPartita();
  }
  function nuovaPartita() {
    if (V.modo !== "partita") return;
    assicuraScena();
    V.tendeAnnullate = new Set();
    V.trattenute = [];
    const chi = Gioco.giocatori.map((g) => ({ m: meepleDi(g), colore: g.colore, sigla: inizialeDistinta(g), nome: g.nome }));
    costruisciGiocatori(chi);
    chiaveTessere = "";
    V.bivacchi = Object.assign({}, Gioco.bivacchi);
    V.castelli = {};
    azzeraCastelli();
    // i bivacchi spenti, i Castelli senza padrone
    sync();
    const pb = document.querySelectorAll("#paesaggio-partita .bivacco");
    pb.forEach((b) => b.setAttribute("class", "bivacco spento"));
    Gioco.giocatori.forEach((g, i) => { meepleEl(i).querySelector(".corpo").removeAttribute("transform"); V.anim[i] = false; });
    V.occupata = 0; V.coda = []; V.inCoda = false;
    disegnaSentiero();
    aggiornaCielo();
    aggiornaTessere();
  }
  function nuovoGiorno() {
    // l'alba: i bivacchi accesi ieri sono braci; le tende spariscono; i meeple escono
    if (V.modo !== "partita" || !V.fatto) return;
    sync();
    document.querySelectorAll("#paesaggio-partita .bivacco").forEach((b) => {
      const pos = b.getAttribute("data-pos");
      b.setAttribute("class", "bivacco " + (V.bivacchi[pos] || "spento"));
    });
    palcoEl.classList.remove("sera");
    disegnaSentiero();
    aggiornaCielo();
    aggiornaTessere();
  }
  // Il lampo (§1): niente tempo ne' tramonto. Il cielo resta com'e', le tende non ci sono.
  function lampo(si) {
    if (V.modo !== "partita" || !V.fatto) return;
    if (si) { sync(); disegnaSentiero(); aggiornaTessere(); }
  }
  function aggiorna() {
    if (!V.fatto || V.modo === null) return;
    if (V.modo === "partita") {
      if (!V.occupata) sync();
      disegnaSentiero();
      aggiornaCielo();
      aggiornaTessere();
      palcoEl.classList.toggle("sera", !!Gioco.sera);
    }
  }
  function nascondi() {
    V.modo = null;
    chiudiCartellino();
    const col = $("colonna-giocatori");
    if (col) col.classList.remove("tessere-viaggio"); // le tessere dei viaggiatori non restano addosso alla Classica
    if (palcoEl) palcoEl.classList.add("nascosta");
    document.body.classList.remove("percorso-iscrizione", "percorso-partita");
    velo(null);
  }
  // ---- il cartellino della tappa toccata (R12) --------------------------------------------------------------------------------------------------
  // Toccando una tappa, un bivacco, una tenda, un fantasma o la bandiera compare un cartellino bianco con la spiegazione di quella cosa: senza
  // velo e senza «Ok», non ferma il gioco. Si chiude al tocco successivo ovunque, o da solo dopo DURATA_CARTELLINO_TAPPA_MS; un altro tocco su
  // un'altra cosa lo sposta. Nel velo o nella conferma non si apre.
  let cartellinoEl = null, cartellinoTimer = null;
  function chiudiCartellino() {
    if (cartellinoTimer) { clearTimeout(cartellinoTimer); cartellinoTimer = null; }
    if (cartellinoEl) cartellinoEl.classList.add("nascosta");
  }
  const RIGHE_TAPPE = {
    scorciatoia: ["Scorciatoia", () => `Se ti fermi proprio qui, salti avanti di ${PERCORSO_TRAMPOLINO_SALTO} caselle.`],
    bivaccoSpento: ["Bivacco", "Chi arriva qui oggi si ferma e dorme all’aperto fino all’alba: oggi non gioca più. Domani ci si passa sopra."],
    bivaccoOggi: ["Bivacco acceso oggi", "Chi arriva qui oggi si ferma e dorme fino all’alba. Domani ci si passa sopra."],
    bivaccoIeri: ["Bivacco di ieri", "Ci si passa sopra."],
    bandiera: ["Il traguardo", "Chi lo tocca per primo vince la partita."],
  };
  // Che cosa e` stato toccato, e dove sta il cartellino (la punta): { titolo, riga, disco, x, y } oppure null
  function cosaTocca(bersaglio) {
    if (!bersaglio || !bersaglio.closest || bersaglio.closest(".libere")) return null;
    const nomeDi = (i) => (V.chi[i] ? escHtml(V.chi[i].nome) : "");
    const tappa = bersaglio.closest(".tappa-mappa");
    const pietra = bersaglio.closest(".pietra-mappa.ingresso");
    const biv = bersaglio.closest(".bivacco");
    const tenda = bersaglio.closest(".tendina");
    const fant = bersaglio.closest(".fantasma");
    const band = bersaglio.closest(".bandiera");
    const daTappa = (pos, tipo) => {
      const s = posto(pos);
      if (!s) return null;
      const r = (c) => (typeof c[1] === "function" ? c[1]() : c[1]);
      if (tipo === "pedaggio") {
        const pad = V.castelli[pos]; // i Castelli sono solo quelli dei giocatori (il Castello del gioco e` tolto)
        if (pad === undefined || pad === null) return null;
        const dorme = V.modo === "partita" && Gioco.giocatori[pad] && Percorso.dorme(Gioco.giocatori[pad]);
        return { titolo: `Il castello di ${nomeDi(pad)}`, riga: dorme ? `Oggi ${nomeDi(pad)} dorme: il castello non regala niente.` : `Chi ci passa regala un passo a ${nomeDi(pad)}.`, disco: svgCasella("pedaggio"), x: s.x, y: s.y - 84 * s.s };
      }
      const c = RIGHE_TAPPE.scorciatoia;
      return { titolo: c[0], riga: r(c), disco: svgCasella(tipo), x: s.x, y: s.y - 84 * s.s };
    };
    if (tappa && tappa.getAttribute("data-pos")) {
      const pos = Number(tappa.getAttribute("data-pos"));
      const tipo = TAPPE[pos] || (V.castelli[pos] !== undefined ? "pedaggio" : null);
      return tipo ? daTappa(pos, tipo) : null;
    }
    if (pietra) {
      const pos = Number(pietra.getAttribute("data-i"));
      const tipo = TAPPE[pos] || (V.castelli[pos] !== undefined ? "pedaggio" : null);
      return tipo ? daTappa(pos, tipo) : null;
    }
    if (biv) {
      const pos = Number(biv.getAttribute("data-pos"));
      const stato = V.bivacchi[pos] || "spento";
      const c = stato === "spento" ? RIGHE_TAPPE.bivaccoSpento : stato === "oggi" ? RIGHE_TAPPE.bivaccoOggi : RIGHE_TAPPE.bivaccoIeri;
      const s = posto(pos) || punto(pos);
      return { titolo: c[0], riga: c[1], disco: `<svg viewBox="-30 -58 60 68" aria-hidden="true"><path d="M0,-52 C16,-34 22,-18 12,-2 C10,-12 5,-15 2,-22 C-5,-13 -17,-9 -12,2 C-26,-8 -20,-30 0,-52 Z" fill="#FFD23F" stroke="#FF9F1C" stroke-width="4"/></svg>`, x: s.x, y: s.y - 84 * (s.s || 1) };
    }
    if (tenda) {
      const i = Number(tenda.getAttribute("data-i"));
      const pos = V.tenda[i];
      const q = pos !== null && pos !== undefined ? punto(pos) : { x: 960, y: 500 };
      return { titolo: `La tenda di ${nomeDi(i)}`, riga: `Stasera ${nomeDi(i)} dorme qui. Fino a domani nessuno lo tocca.`, disco: `<svg viewBox="0 0 48 48" aria-hidden="true"><use href="#ic-tenda"/></svg>`, x: q.x, y: q.y - 62 * scalaPezzi(q.y) };
    }
    if (fant) {
      const i = Number(fant.getAttribute("data-i"));
      const pos = V.fant[i];
      const q = pos !== null && pos !== undefined ? punto(pos) : { x: 960, y: 500 };
      return { titolo: `L’ombra di ${nomeDi(i)}`, riga: `Dove arriva ${nomeDi(i)} se risolve la frase adesso.`, disco: V.chi[i] ? meepleHtml(V.chi[i].m, "") : "", x: q.x, y: q.y - 56 * scalaPezzi(q.y) };
    }
    if (band) {
      const q = punto(N);
      return { titolo: RIGHE_TAPPE.bandiera[0], riga: RIGHE_TAPPE.bandiera[1], disco: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 6v38" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M14 8h26v18H14z" stroke="none"/></svg>`, x: q.x + 20, y: q.y - 104 * scala(q.y) * 1.3 - 12 };
    }
    return null;
  }
  function apriCartellino(c) {
    if (!cartellinoEl) {
      const palco = $("palco-sopra");
      if (!palco) return;
      cartellinoEl = el("div", "cartellino-tappa nascosta", palco);
      cartellinoEl.id = "cartellino-tappa";
      cartellinoEl.setAttribute("role", "status");
    }
    cartellinoEl.innerHTML = `<span class="disco" aria-hidden="true">${c.disco}</span><span class="testo"><b>${c.titolo}</b>${c.riga}</span>`;
    cartellinoEl.style.left = `calc(var(--u) * ${Math.round(Math.max(250, Math.min(1670, c.x)))})`;
    cartellinoEl.style.top = `calc(var(--u) * ${Math.round(c.y)})`;
    cartellinoEl.classList.remove("nascosta");
    cartellinoEl.classList.remove("entra"); void cartellinoEl.offsetWidth; cartellinoEl.classList.add("entra");
    if (cartellinoTimer) clearTimeout(cartellinoTimer);
    cartellinoTimer = setTimeout(chiudiCartellino, DURATA_CARTELLINO_TAPPA_MS);
  }
  function suPaesaggio(ev) {
    if (V.modo !== "partita" || !V.fatto) return;
    const veloVisibile = $("velo") && !$("velo").classList.contains("nascosta");
    if (veloVisibile || confermaAperta) return;
    const c = cosaTocca(ev.target);
    if (!c) return;
    ev.cartellinoAperto = true; // il tocco che l'ha aperto non lo richiude
    apriCartellino(c);
  }
  document.addEventListener("click", (ev) => { if (!ev.cartellinoAperto) chiudiCartellino(); });

  // l'Esc e il tocco sul velo
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (confermaAperta) confermaAperta(false);
    else if (chiudiBollaFn) chiudiBolla();
  });
  const veloEl = $("velo");
  if (veloEl) veloEl.addEventListener("click", suVelo);
  window.addEventListener("resize", () => { if (bucoUnita) velo(bucoUnita); }); // il buco e` in pixel dello schermo: si ricalcola

  return {
    chiudiCartellino, testiTempo: () => TESTI_TEMPO, nuovaPartita, nuovoGiorno, mostraIscrizione, disegnaIscrizione, mostraPartita, nascondi, aggiorna, lampo,
    riproduci, nebbia, tendaPiantata, tendeAnnullate, giroFinito, passeggiata, bolla, conferma,
    mostraLibere, nascondiLibere, castelloPiazzato, haPosto, trattieni, rilascia, impostaLunghezza, rinfrescaIscrizione,
    slot: () => SLOT, punto: (i) => punto(i), posto: (i) => posto(i), scala: (y) => scala(y), scalaPezzi: (y) => scalaPezzi(y),
    lunghezze: () => ({ STEP, LUNG: LUNG.slice(), L }), stato: () => V, chiudiBolla,
  };
})();
