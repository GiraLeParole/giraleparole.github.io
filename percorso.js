// ============================================================================
// IL PERCORSO — le regole della settima stesura (10/10/2026)
// design/2026-10-10-regolamento-percorso.md: passo subito e ombra, Scorciatoie nascoste solo per l'ombra, bivacchi dove si dorme all'aperto,
// tenda sempre disponibile «solo quando il turno passa», tre tempi, la Scatola con otto potenziamenti, il lampo dopo ogni giorno
// (Castello davanti a se' oppure un passo), ogni mattina parte l'ultimo. Tolti (§10): Rifugio, Castello del gioco, Vento in poppa, il premio
// del bivacco, l'Afa, la Giornata limpida, il carattere della giornata, i 2 passi del lampo, il Sorpasso come scambio, le Scorciatoie fisse.
//
// Qui non c'e` niente di grafico e niente di cio` che il gioco chiede allo schermo: ci sono solo le regole, scritte come funzioni su un
// «mondo» (il Gioco di gioco.js, o uno finto nelle prove). Ogni mossa cambia subito lo stato e ritorna la lista di cio` che e` successo,
// nell'ordine (gli «eventi»): e` la lista che la scena (percorso-vista.js) racconta, un pezzo alla volta. Le prove di
// verifiche/percorso/regole.js girano questo file da solo.
//
// Il mondo (W) ha: giocatori, indiceCorrente, numeroRoundCorrente, numeroRoundTotale, caselle, caselleSpeciali {pos: tipo} (i Castelli),
// castelli {pos: giocatore}, bivacchi {pos: stato}, sassi {pos: giocatore}, scorciatoie [pos] (nascoste), tickArrivo, meteo, tramonto, sera,
// tendaAperta, regole, traguardo, fineConsonanti(). Ogni giocatore ha: pedina, ombra, arrivo, fermo (dorme a un bivacco), accampato, tenda,
// dentro, frenato, frenatoQuestoTurno, jolly, pot (il potenziamento in mano), scarponi (passi in piu` armati), scorciatoiaOggi.
// Si carica dopo config.js e prima di gioco.js.
// ============================================================================

const Percorso = (() => {
  // ---- piccole cose ------------------------------------------------------------
  const tappaDi = (W, c) => W.caselleSpeciali[c];
  // un bivacco spento, o acceso oggi, ferma chi ci arriva oggi (§4); quello di ieri no
  const sosta = (W, c) => W.bivacchi[c] === "spento" || W.bivacchi[c] === "oggi";
  const segnaArrivo = (W, g) => { g.arrivo = ++W.tickArrivo; };
  // Chi dorme: chi si e` accampato (§5) o si e` fermato a un bivacco (§4). Dorme fino all'alba e quel giorno non gioca piu`.
  const dorme = (g) => !!(g.fermo || g.accampato);
  const inPiedi = (W) => W.giocatori.filter((x) => !dorme(x));
  const alRiparo = (W, g) => !!g.accampato;   // in tenda nessun potenziamento degli altri ti tocca; al bivacco si`
  // Definizioni del regolamento: In testa = la pedina piu` avanti, a pari caselle chi ci e` arrivato prima; Ultimo = la piu` indietro, a pari
  // caselle chi viene prima nell'ordine dei turni.
  const classifica = (W) => [...W.giocatori].sort((a, b) => b.pedina - a.pedina || a.arrivo - b.arrivo);
  function inTesta(W) { const c = classifica(W)[0]; return c && c.pedina > 0 ? c : null; } // al via nessuno e` in testa
  function ultimo(W) { return [...W.giocatori].sort((a, b) => a.pedina - b.pedina || W.giocatori.indexOf(a) - W.giocatori.indexOf(b))[0]; }
  const nuovoEv = () => { const ev = []; ev.coda = []; return ev; };

  // ---- l'ombra --------------------------------------------------------------------------------
  // `g.ombra` e` la casella dove arriverebbe la pedina se risolvesse adesso (mai dietro la pedina, mai oltre il primo bivacco che ferma).
  const ombraVista = (W, g) => (g.ombra > g.pedina ? g.ombra : g.pedina);
  // L'ombra non va oltre il primo bivacco che ferma (§2); chi dorme ha l'ombra sulla pedina.
  function limiteOmbra(W, g) {
    if (dorme(g)) return g.pedina;
    for (let c = g.pedina + 1; c <= W.caselle; c++) if (sosta(W, c)) return c;
    return W.caselle;
  }
  function fissaOmbra(W, g, e) { g.ombra = Math.max(g.pedina, Math.min(limiteOmbra(W, g), Math.round(e))); }
  const fissaOmbraVista = fissaOmbra;
  // Dove si ferma una pedina che va da `da` fino a `a`, senza muoverla: al primo bivacco che ferma, altrimenti in `a`.
  function simulaArrivo(W, da, a) {
    for (let c = da + 1; c <= a && c <= W.caselle; c++) if (sosta(W, c)) return c;
    return Math.min(a, W.caselle);
  }
  // La casella del fantasma di g, o null se non c'e` (ombra ferma sulla pedina, o dorme).
  function fantasma(W, g) {
    if (dorme(g)) return null;
    const e = ombraVista(W, g);
    return e <= g.pedina ? null : e;
  }

  // ---- le Scorciatoie nascoste (§3) ---------------------------------------------------------------
  // Una nascita: una pietra a caso, mai su un bivacco, sul campo base, sul traguardo, su una pietra con un Castello, con una pedina o con
  // un'ombra, ne' su un'altra Scorciatoia.
  function nuovaScorciatoia(W) {
    const no = new Set([0, W.caselle]);
    Object.keys(W.bivacchi).forEach((p) => no.add(Number(p)));
    Object.keys(W.castelli).forEach((p) => no.add(Number(p)));
    W.scorciatoie.forEach((p) => no.add(p));
    W.giocatori.forEach((x) => { no.add(x.pedina); no.add(ombraVista(W, x)); });
    const buone = [];
    for (let p = 1; p < W.caselle; p++) if (!no.has(p)) buone.push(p);
    if (!buone.length) return null;
    const p = buone[Math.floor(Math.random() * buone.length)];
    W.scorciatoie.push(p);
    return p;
  }
  function inizializzaScorciatoie(W, n) {
    W.scorciatoie = [];
    for (let k = 0; k < n; k++) nuovaScorciatoia(W);
  }
  // L'ombra di g si allunga in avanti fino a `voluta` (fermandosi al primo bivacco che ferma). Se si FERMA su una Scorciatoia nascosta alla
  // fine di questo movimento, la scopre: l'ombra avanza di 3 (fermandosi al primo bivacco che ferma), la Scorciatoia sparisce e ne nasce
  // un'altra. Una volta al giorno per giocatore; l'ombra riportata sulla pedina non fa scattare niente. Ritorna { prima, a, scorciatoia, atterra }.
  function allungaOmbra(W, g, voluta) {
    const prima = ombraVista(W, g);
    fissaOmbra(W, g, voluta);
    const r = { prima, a: g.ombra, scorciatoia: null, atterra: g.ombra };
    const e = g.ombra;
    if (e > prima && e > g.pedina && !g.scorciatoiaOggi && W.scorciatoie.includes(e)) {
      g.scorciatoiaOggi = true;
      W.scorciatoie = W.scorciatoie.filter((p) => p !== e);
      g.ombra = Math.max(g.pedina, simulaArrivo(W, e, e + PERCORSO_TRAMPOLINO_SALTO));
      nuovaScorciatoia(W);
      r.scorciatoia = e; r.atterra = g.ombra;
    }
    return r;
  }
  // Come ci arriva il fantasma, per la scena: da dove si vedeva (`daVista`) alla pietra di adesso. Ritorna null se non si muove in avanti.
  // scorciatoia: la pietra scoperta (poi salta a `atterra`); bivacco: la sua pietra se l'ombra si e` fermata contro un bivacco che ferma.
  function viaggioFantasma(W, g, daVista, r) {
    if (dorme(g)) return null;
    if (ombraVista(W, g) <= g.pedina) return null;
    const eVista = r.scorciatoia !== null ? r.scorciatoia : r.a;
    return {
      daVista, eVista, atterra: r.atterra, scorciatoia: r.scorciatoia,
      bivacco: sosta(W, r.atterra) && W.bivacchi[r.atterra] !== undefined ? r.atterra : null,
    };
  }

  // ---- il movimento: casella per casella, con quello che scatta per strada ---------------
  // `bersaglio` e` fin dove si vuole andare; ci si ferma prima se un bivacco ferma. I Castelli di un altro attraversati finiscono in
  // ev.coda (il padrone avanza dopo che il visitatore ha finito); un Sasso di un altro toglie un passo a fine movimento (chi e` in tenda non lo
  // fa scattare). Scatta solo andando avanti: nessuna tappa scatta per un movimento all'indietro. opz: { come, tetto }.
  function cammina(W, g, bersaglio, opz, ev) {
    opz = opz || {};
    const tetto = opz.tetto === undefined ? W.caselle : opz.tetto;
    bersaglio = Math.min(bersaglio, tetto);
    const da = g.pedina;
    let c = da;
    let ferma = false;
    const sassi = [];
    while (c < bersaglio) {
      c += 1;
      const padrone = W.castelli[c];
      if (padrone && padrone !== g) ev.coda.push({ visitatore: g, pos: c, padrone });
      const s = W.sassi && W.sassi[c];
      if (s && s !== g && !g.accampato) sassi.push({ pos: c, padrone: s });
      if (sosta(W, c)) { ferma = true; break; }
    }
    if (c === da) return;
    g.pedina = c;
    segnaArrivo(W, g);
    ev.push({ t: "passo", g, da, a: c, come: opz.come || "passo" });
    if (g.ombra < c) g.ombra = c; // l'ombra non sta mai dietro la pedina
    if (ferma) {
      const accende = W.bivacchi[c] === "spento";
      if (accende) W.bivacchi[c] = "oggi";
      g.fermo = true;     // dorme li` fino all'alba
      g.ombra = c;
      ev.push({ t: "bivacco", g, pos: c, accende });
    } else if (c >= W.caselle) { // chi arriva al traguardo vince subito, anche a meta` giorno
      g.pedina = W.caselle;
      if (!W.traguardo) W.traguardo = g;
      ev.push({ t: "traguardo", g });
      return;
    }
    sassi.forEach(({ pos, padrone }) => {
      if (W.sassi[pos] !== padrone) return;
      delete W.sassi[pos];   // il Sasso sparisce comunque, anche se lo Scudo lo para
      if (g.pot === "scudo") { g.pot = null; ev.push({ t: "sasso", g, pos, padrone, parato: true }); return; }
      ev.push({ t: "sasso", g, pos, padrone, parato: false });
      indietro(W, g, 1, ev);
    });
  }
  // Una pedina spostata all'indietro (Valanga, Robin Hood, Sasso): mai sotto il campo base, l'ombra con lei della stessa distanza; chi dorme
  // al bivacco dorme lo stesso. Ritorna di quanto e` tornata indietro.
  function indietro(W, g, n, ev) {
    const m = Math.min(n, g.pedina);
    if (m <= 0) return 0;
    const da = g.pedina, vistaOmbra = ombraVista(W, g);
    g.pedina -= m;
    segnaArrivo(W, g);
    fissaOmbra(W, g, vistaOmbra - m);
    ev.push({ t: "indietro", g, da, a: g.pedina });
    return m;
  }

  // I Castelli attraversati: il padrone avanza di una casella, sempre dopo il visitatore. Il passo del Castello non porta mai il padrone al
  // traguardo (si ferma una casella prima) e si ferma a un bivacco che ferma. I Castelli di chi dorme (tenda o bivacco) non pagano.
  function elaboraCastelli(W, ev) {
    let guardia = 0;
    while (ev.coda.length && guardia++ < 32) {
      const { visitatore, pos, padrone } = ev.coda.shift();
      const attivo = !W.traguardo && !dorme(padrone) && padrone.pedina < W.caselle - 1;
      ev.push({ t: "castello", visitatore, pos, padrone, attivo });
      if (attivo) cammina(W, padrone, padrone.pedina + PERCORSO_BIVACCO_PASSO_CASTELLO, { come: "castello", tetto: W.caselle - 1 }, ev);
    }
  }

  // Un movimento solo, con tutto cio` che si porta dietro.
  function muovi(W, g, bersaglio, opz) {
    const ev = nuovoEv();
    cammina(W, g, bersaglio, opz, ev);
    elaboraCastelli(W, ev);
    return ev;
  }

  // ---- la consonante giusta: il passo subito e l'ombra (§2) ---------------------------------------
  const passiDelTempo = (tempo) => (tempo === "ventoso" ? 2 : tempo === "temporale" ? 0 : 1);
  // o: { tipo: "passi" | "raddoppia" | "robinhood" | "jolly", valore, volte, tempo }.
  // Ritorna { passi, ombraPiu, frenato, fermo, scarponi, ev, viaggio }. Il Jolly prende solo il Jolly; Robin Hood da` il suo passo ma la sua
  // lettera non allunga l'ombra (valore 0). Gli Scarponi armati si sommano al passo del tempo e si consumano alla consonante (anche se non c'e`:
  // vedi consumaScarponi); col Freno non si muove ne' la pedina ne' l'ombra e gli Scarponi restano armati.
  function consonanteGiusta(W, g, o) {
    const ev = nuovoEv();
    const info = { passi: 0, ombraPiu: 0, frenato: !!g.frenatoQuestoTurno, fermoPrima: !!g.fermo, fermo: !!g.fermo, tempo: o.tempo, scarponi: 0, ev, viaggio: null };
    if (o.tipo === "jolly") return info;
    const pedinaPrima = g.pedina;
    const ombraPrima = g.ombra;
    const vistaPrima = fantasma(W, g); // dove si vedeva il fantasma (null se non c'era)
    const bloccato = info.frenato || dorme(g);
    let voluta = null;
    if (!bloccato) {
      if (o.tipo === "raddoppia") { // raddoppia la distanza che si vede fra pedina e ombra, contata da dove la pedina era PRIMA del passo
        const d = ombraVista(W, g) - pedinaPrima;
        voluta = ombraPrima + Math.max(2 - d, d);
      } else voluta = ombraPrima + o.volte * o.valore;  // si allunga da dove era gia` arrivata
      info.scarponi = g.scarponi || 0;
      g.scarponi = 0;
    }
    const k = bloccato ? 0 : passiDelTempo(o.tempo) + info.scarponi;
    if (k > 0) cammina(W, g, pedinaPrima + k, { come: "passo" }, ev);
    info.passi = ev.filter((e) => e.t === "passo" && e.g === g).reduce((s, e) => s + (e.a - e.da), 0);
    const arretrato = ev.filter((e) => e.t === "indietro" && e.g === g).reduce((s, e) => s + (e.da - e.a), 0); // un Sasso incontrato: l'ombra viene con lei
    if (voluta !== null) {
      if (g.fermo) g.ombra = g.pedina; // il passo l'ha fermato a un bivacco: da li` non si va oltre
      else {
        const r = allungaOmbra(W, g, voluta - arretrato);
        info.ombraPiu = o.tipo === "raddoppia" ? null : o.volte * o.valore;
        info.viaggio = viaggioFantasma(W, g, vistaPrima, r);
      }
    }
    elaboraCastelli(W, ev);
    info.fermo = !!g.fermo;
    return info;
  }

  // La vocale costa un passo d'ombra (§2). Con l'ombra ferma alla pedina il pulsante e` spento: qui non si scende sotto la pedina.
  function pagaVocale(W, g) { fissaOmbra(W, g, ombraVista(W, g) - PERCORSO_COSTO_VOCALE_PASSI); }
  // La Nebbia: l'ombra torna sulla pedina (i passi gia` fatti restano); i Ramponi la salvano e si consumano. Ritorna { salvata }.
  function nebbia(W, g) {
    if (g.pot === "ramponi") { g.pot = null; return { salvata: true }; }
    g.ombra = g.pedina;
    return { salvata: false };
  }

  // ---- gli attacchi: Robin Hood (dalla ruota), Valanga, Freno, Sasso (dalla Scatola) --------------
  // Un attacco su `v`: lo Scudo lo para (e si consuma). Ritorna true se e` parato.
  function parato(W, v, ev) {
    if (v.pot !== "scudo") return false;
    v.pot = null;
    ev.push({ t: "scudo", g: v });
    return true;
  }
  // Il bersaglio di Valanga e Robin Hood: chi e` in testa; se e` in tenda, il primo dei non accampati dopo di lui, mai chi lancia
  // (null = non si puo` usare). Al via nessuno e` in testa.
  function bersaglioDiTesta(W, g) {
    const cl = classifica(W);
    if (!cl[0] || cl[0].pedina === 0) return null;
    const v = cl.find((x) => !alRiparo(W, x));
    return v && v !== g ? v : null;
  }
  // Robin Hood (spicchio della ruota): chiamata una consonante, se c'e` si rubano 3 caselle alla pedina di chi e` in testa, e vanno alla tua ombra.
  function robinHood(W, g) {
    const ev = nuovoEv();
    const cl = classifica(W);
    const capo = cl[0];
    if (!capo || capo.pedina === 0) return { esito: "nessunoPartito", ev };
    if (capo === g) return { esito: "tuInTesta", ev };
    if (g.frenatoQuestoTurno) return { esito: "freno", ev };
    const vittima = bersaglioDiTesta(W, g);
    if (!vittima) return { esito: "alRiparo", capo, ev };
    if (parato(W, vittima, ev)) return { esito: "scudo", vittima, ev };
    const n = indietro(W, vittima, PERCORSO_ROBIN_HOOD_PASSI, ev);
    // chi dorme (al bivacco) toglie le caselle ma non le prende: non ha ombra
    const preso = !dorme(g) && n > 0;
    const vistaG = fantasma(W, g);
    let viaggio = null;
    if (preso) { const r = allungaOmbra(W, g, g.ombra + n); viaggio = viaggioFantasma(W, g, vistaG, r); }
    ev.push({ t: "robin", da: vittima, a: g, n, preso });
    return { esito: "furto", vittima, n, preso, ev, viaggio };
  }
  // Valanga (Scatola): chi e` in testa torna indietro di 2, pedina e ombra. Ritorna { esito: "no" | "scudo" | "colpito", vittima, ev }.
  function valangaPossibile(W, g) { return !!bersaglioDiTesta(W, g); }
  function valanga(W, g) {
    const ev = nuovoEv();
    const vittima = bersaglioDiTesta(W, g);
    if (!vittima) return { esito: "no", ev };
    if (parato(W, vittima, ev)) return { esito: "scudo", vittima, ev };
    indietro(W, vittima, PERCORSO_VALANGA_PASSI, ev);
    return { esito: "colpito", vittima, ev };
  }
  // Sorpasso (Scatola): la tua pedina va sulla pietra subito davanti alla prima pedina davanti a te; niente scambio; non porta mai al
  // traguardo. Le pedine in tenda contano (non e` un attacco). La pedina davanti piu` vicina; a pari caselle, la prima arrivata.
  function davantiATe(W, g) {
    const davanti = W.giocatori.filter((x) => x !== g && x.pedina > g.pedina);
    if (!davanti.length) return null;
    return davanti.reduce((a, b) => (b.pedina < a.pedina || (b.pedina === a.pedina && b.arrivo < a.arrivo) ? b : a));
  }
  function sorpassoPossibile(W, g) { return !!davantiATe(W, g); }
  function sorpasso(W, g) {
    const ev = nuovoEv();
    const v = davantiATe(W, g);
    if (!v) return { esito: "no", ev };
    const meta = v.pedina + 1 >= W.caselle ? v.pedina : v.pedina + 1;
    cammina(W, g, meta, { come: "salto", tetto: W.caselle - 1 }, ev);
    elaboraCastelli(W, ev);
    return { esito: "ok", con: v, ev };
  }
  // Scarponi (Scatola): alla prossima consonante giusta la pedina fa `extra` passi in piu` (2 gli Scarponi grandi, 1 gli Scarponi).
  function scarponi(W, g, extra) { g.scarponi = extra; }
  // Freno (Scatola): a chi gioca ancora oggi; nel suo prossimo turno ne' il passo subito ne' l'ombra si muovono. Ritorna "scudo" o "ok".
  function candidatiFreno(W, g) { return W.giocatori.filter((x) => x !== g && !dorme(x)); }
  function freno(W, g, v) {
    const ev = nuovoEv();
    if (parato(W, v, ev)) return { esito: "scudo", ev };
    v.frenato = true;
    return { esito: "ok", ev };
  }
  // Sasso (Scatola): su una pietra al massimo PERCORSO_SASSO_INDIETRO (3) dietro la tua pedina (Damiano, 10/10, quarta prova: «il furbetto l'ha messo
  // sempre davanti alle due pedine»), che non sia il campo base, un bivacco, un Castello, una pedina o un altro Sasso.
  function pietreSasso(W, g) {
    const occupate = new Set(W.giocatori.map((x) => x.pedina));
    const out = [];
    for (let p = Math.max(1, g.pedina - PERCORSO_SASSO_INDIETRO); p < g.pedina; p++) {
      if (W.bivacchi[p] !== undefined || W.castelli[p] !== undefined || occupate.has(p) || (W.sassi && W.sassi[p])) continue;
      out.push(p);
    }
    return out;
  }
  function posaSasso(W, g, pos) {
    if (!pietreSasso(W, g).includes(pos)) return false;
    W.sassi[pos] = g;
    return true;
  }

  // ---- la Scatola (§8) --------------------------------------------------------------------------
  // Una sola Scatola, un solo mazzo, per tutti: gli otto potenziamenti (PERCORSO_POTENZIAMENTI). Piu` sei indietro rispetto a chi e` in testa, piu`
  // e` probabile un potenziamento forte; piu` sei avanti, un leggero. Conta la distanza della tua pedina da quella di chi e` in testa (a
  // `scatolaDistanza` caselle la spinta e` al massimo), non una fascia. I pesi: forte 1 + F·t, leggero 1 + F·(1 − t), medio 1 + F/2, con F =
  // `scatolaForza` (pannello) e t la distanza in decimi della soglia. Al via, finche' nessuno si e` mosso, tutti uguali.
  function pesiScatola(W, g) {
    const F = W.regole.scatolaForza, D = Math.max(1, W.regole.scatolaDistanza);
    const capo = classifica(W)[0];
    const pesi = {};
    const t = capo && capo.pedina > 0 ? Math.min(1, Math.max(0, (capo.pedina - g.pedina) / D)) : null;
    Object.keys(PERCORSO_POTENZIAMENTI).forEach((k) => {
      const peso = PERCORSO_POTENZIAMENTI[k].peso;
      pesi[k] = t === null ? 1 : peso === "forte" ? 1 + F * t : peso === "leggero" ? 1 + F * (1 - t) : 1 + F / 2;
    });
    return pesi;
  }
  function pescaScatola(W, g) {
    const pesi = pesiScatola(W, g);
    const chiavi = Object.keys(pesi);
    let r = Math.random() * chiavi.reduce((s, k) => s + pesi[k], 0);
    for (const k of chiavi) { r -= pesi[k]; if (r < 0) return k; }
    return chiavi[chiavi.length - 1];
  }

  // ---- il Castello del lampo (§7) -----------------------------------------------------------------
  // Le caselle libere: una pietra senza niente sopra (non un bivacco, non il traguardo, non un Castello, non un Sasso) a cui il paesaggio da` posto
  // (`W.haPosto`: lontana abbastanza da ogni altro edificio; nelle prove senza scena: tutte). Una Scorciatoia nascosta NON esclude la pietra: nessuno
  // deve poterla indovinare dalle pietre che non si offrono. Il vincitore del lampo costruisce davanti alla propria pedina.
  function caselleLibere(W, g) {
    const libere = [];
    for (let p = (g ? g.pedina + 1 : 1); p <= W.caselle - 1; p++) {
      if (W.castelli[p] !== undefined || W.bivacchi[p] !== undefined || (W.sassi && W.sassi[p])) continue;
      if (W.haPosto && !W.haPosto(p)) continue;
      libere.push(p);
    }
    return libere;
  }
  function piazzaCastello(W, g, pos) {
    W.caselleSpeciali[pos] = "pedaggio";
    W.castelli[pos] = g;
    if (W.scorciatoie.includes(pos)) { // la Scorciatoia si sposta in silenzio sotto un'altra pietra
      W.scorciatoie = W.scorciatoie.filter((p) => p !== pos);
      nuovaScorciatoia(W);
    }
  }
  // Il passo del lampo (al posto del Castello): un passo, con le regole dei salti (bivacco che ferma, mai al traguardo).
  function passoLampo(W, g) { return muovi(W, g, g.pedina + 1, { come: "salto", tetto: W.caselle - 1 }); }

  // ---- la tenda (§5) ---------------------------------------------------------------------------
  // La tenda c'e` sempre, dal primo giorno, ma si pianta solo quando il turno passa (W.tendaAperta: la accende e la spegne il gioco): fra la
  // fine di un turno e il primo gesto di chi ha il turno dopo, chiunque puo` accamparsi, anche fuori dal proprio turno. Non puo` chi e` in testa
  // (anche a pari merito), l'ultimo rimasto in piedi, chi dorme, chi ha l'ombra ferma alla pedina (non avrebbe niente da incassare).
  function puoAccamparsi(W, g) {
    if (W.lampoGiorno || W.sera || !W.tendaAperta) return false;
    if (dorme(g) || ombraVista(W, g) <= g.pedina) return false;
    const avanti = Math.max(...W.giocatori.map((x) => x.pedina));
    if (avanti > 0 && g.pedina === avanti) return false; // a pari merito in testa nessuno si accampa
    if (inPiedi(W).length <= 1) return false;
    return true;
  }
  // Il prezzo vero: la meta` della distanza fra pedina e ombra, arrotondata in su, diventa passi; l'altra meta` e` persa. La tenda appare dove
  // la pedina dormira`, fermandosi al primo bivacco che ferma.
  function prezzoTenda(W, g) {
    const d = Math.max(0, ombraVista(W, g) - g.pedina);
    const base = simulaArrivo(W, g.pedina, g.pedina + Math.ceil(d / 2));
    const passi = base - g.pedina;
    return {
      distanza: d, passi, persi: d - passi, base, dorme: base,
      alBivacco: sosta(W, base) && W.bivacchi[base] !== undefined,
      primaTenda: !W.tramonto,
    };
  }
  // «Mi accampo»: vale subito. La prima del giorno fa partire il tramonto.
  function accampa(W, g) {
    const p = prezzoTenda(W, g);
    g.accampato = true;
    g.tenda = { base: p.base, pos: p.dorme, passi: p.passi, valida: true };
    const primaDelGiorno = !W.tramonto;
    if (primaDelGiorno) W.tramonto = { restano: W.regole.oreTramonto, da: g };
    return { prezzo: p, primaDelGiorno };
  }
  // (La tenda non si annulla piu` e non aspetta il giro dopo: restano per non rompere chi le chiama.)
  const validaTende = () => [];
  const annullaTende = () => [];

  // ---- il tempo (§6) e il tramonto (§5) ----------------------------------------------------------
  function pesca(pesi, escludi) {
    const voci = Object.keys(pesi).filter((k) => k !== escludi);
    const tot = voci.reduce((s, k) => s + pesi[k], 0);
    let r = Math.random() * tot;
    for (const k of voci) { r -= pesi[k]; if (r < 0) return k; }
    return voci[voci.length - 1];
  }
  // All'alba il tempo e` un'incognita, a caso e senza preavviso; il primo giorno parte Sereno e cambia di rado. Il tempo non cambia mai piu`
  // spesso del preavviso.
  function albaTempo(W) {
    const primo = W.numeroRoundCorrente <= 1;
    const tempo = primo ? "sereno" : pesca(PERCORSO_TEMPO_PESI);
    const intervallo = Math.max(W.regole.preavviso, W.regole.oreTempo + (primo ? W.regole.oreInPiuPrimoGiorno : 0));
    W.meteo = { tempo, ora: 0, intervallo, H: intervallo + 1, prossimo: pesca(PERCORSO_TEMPO_PESI, tempo), nuovo: true };
  }
  // Quanti giri restano col tempo di adesso, prima del cambio (0 = il cambio e` in corso).
  const restaPrimaDelCambio = (W) => W.meteo.H - 1 - W.meteo.ora;
  // Il preavviso: tre ore prima del cambio le nuvole arrivano (il numero e` nel pannello). Se il giorno finisce prima, il cambio non avviene.
  function preavviso(W) {
    const m = W.meteo;
    const resta = restaPrimaDelCambio(W);
    if (!m || resta <= 0 || resta > W.regole.preavviso) return null;
    return { tempo: m.prossimo, fra: resta };
  }
  // Un'ora e` passata (un giro di ruota; a consonanti finite, un turno). Un cambio vale dall'ora dopo.
  function passaOra(W) {
    const m = W.meteo;
    m.ora += 1;
    m.nuovo = false;
    let cambiato = false;
    if (restaPrimaDelCambio(W) <= 0) {
      m.tempo = m.prossimo;
      m.H += m.intervallo;
      m.prossimo = pesca(PERCORSO_TEMPO_PESI, m.tempo);
      m.nuovo = true;
      cambiato = true;
    }
    if (W.tramonto && W.tramonto.restano > 0) W.tramonto.restano -= 1;
    return { cambiato };
  }
  // Nell'ultima ora del tramonto non si gira piu` dopo quel giro: resta la soluzione, le vocali o «Scende la sera».
  const ultimaOra = (W) => !!W.tramonto && W.tramonto.restano <= 0;
  const ruotaSpenta = (W) => ultimaOra(W);

  // ---- l'alba (§4, §6) ----------------------------------------------------------------------------
  // Il giorno nuovo: i bivacchi accesi ieri non fermano piu', chi dormiva riparte, le tende spariscono, i Freni scadono, il tempo ricomincia.
  function alba(W, opz) {
    opz = opz || {};
    Object.keys(W.bivacchi).forEach((p) => { if (W.bivacchi[p] === "oggi") W.bivacchi[p] = "prima"; });
    W.giocatori.forEach((g) => {
      g.fermo = false; g.accampato = false; g.tenda = null; g.dentro = false;
      g.ombra = g.pedina;
      g.frenato = false; g.frenatoQuestoTurno = false; g.scorciatoiaOggi = false;
    });
    W.tramonto = null;
    W.sera = false;
    W.tendaAperta = false;
    W.lampoGiorno = !!opz.lampo;
    if (!opz.lampo) albaTempo(W);
  }

  // ---- la sera: la passeggiata (§2, §5) -------------------------------------------------------------
  // Cammina per primo chi ha risolto, fino alla sua ombra (con l'ombra ferma alla pedina, di una casella); poi chi si e` accampato, uno alla
  // volta nell'ordine dei turni (cominciando da chi segue il giocatore che aveva il turno quando e` scesa la sera), fino alla sua tenda. Gli
  // altri non si muovono. Chi tocca per primo il traguardo vince. Ritorna le tratte { g, ev, tenda }, una per chi cammina, nell'ordine.
  function passeggiata(W, solutore) {
    W.sera = true;
    const tratte = [];
    const ordine = [];
    if (solutore) ordine.push(solutore);
    const n = W.giocatori.length;
    for (let k = 1; k <= n; k++) {
      const x = W.giocatori[(W.indiceCorrente + k) % n];
      if (x !== solutore && x.accampato && x.tenda && !ordine.includes(x)) ordine.push(x);
    }
    // le ombre degli altri svaniscono (quella di chi ha risolto serve: e` dove cammina)
    W.giocatori.forEach((x) => { if (x !== solutore && !x.accampato) x.ombra = x.pedina; });
    ordine.forEach((x) => {
      if (W.traguardo) return;
      if (x === solutore) {
        const ev = nuovoEv();
        if (!x.fermo) {
          const meta = ombraVista(W, x) > x.pedina ? ombraVista(W, x) : x.pedina + PERCORSO_PASSO_SOLUZIONE;
          cammina(W, x, meta, { come: "sera" }, ev);
          elaboraCastelli(W, ev);
        }
        x.ombra = x.pedina;
        tratte.push({ g: x, ev, tenda: false });
      } else {
        const ev = nuovoEv();
        cammina(W, x, x.tenda.base, { come: "sera" }, ev);
        elaboraCastelli(W, ev);
        x.dentro = true;
        x.ombra = x.pedina;
        tratte.push({ g: x, ev, tenda: true });
      }
    });
    return tratte;
  }

  // ---- i numeri del pannello ---------------------------------------------------------------------------
  function limitaRegole(r) {
    const out = {};
    Object.keys(PERCORSO_REGOLE_DI_PARTENZA).forEach((k) => {
      const lim = PERCORSO_REGOLE_LIMITI[k];
      let v = r && r[k] !== undefined && r[k] !== null && r[k] !== "" ? Number(r[k]) : NaN; // niente scritto: il valore di partenza (non 0)
      if (!Number.isFinite(v)) v = PERCORSO_REGOLE_DI_PARTENZA[k];
      out[k] = Math.round(Math.max(lim[0], Math.min(lim[1], v)));
    });
    return out;
  }
  function leggiRegole() {
    // Sul sito pubblicato il pannello non c'e` (PANNELLO_REGOLE_PERCORSO, config.js): valgono solo i valori di partenza, e un valore salvato
    // prima dal pannello nel browser di qualcuno si cancella.
    if (!PANNELLO_REGOLE_PERCORSO) {
      try { window.localStorage.removeItem(CHIAVE_REGOLE_PERCORSO); } catch (e) { /* niente memoria nel browser: niente da cancellare */ }
      return limitaRegole(null);
    }
    try {
      const v = JSON.parse(window.localStorage.getItem(CHIAVE_REGOLE_PERCORSO));
      return limitaRegole(v);
    } catch (e) {
      return limitaRegole(null);
    }
  }
  function salvaRegole(r) {
    const v = limitaRegole(r);
    try { window.localStorage.setItem(CHIAVE_REGOLE_PERCORSO, JSON.stringify(v)); } catch (e) { /* senza memoria nel browser il pannello vale per questa sera */ }
    return v;
  }

  return {
    classifica, inTesta, ultimo, alRiparo, dorme, inPiedi, sosta, segnaArrivo, tappaDi,
    limiteOmbra, fissaOmbra, fissaOmbraVista, ombraVista, viaggioFantasma, simulaArrivo, fantasma,
    nuovaScorciatoia, inizializzaScorciatoie, allungaOmbra,
    cammina, muovi, elaboraCastelli, nuovoEv, indietro,
    consonanteGiusta, pagaVocale, nebbia, robinHood,
    valanga, valangaPossibile, sorpasso, sorpassoPossibile, scarponi, freno, candidatiFreno, pietreSasso, posaSasso,
    pesiScatola, pescaScatola,
    caselleLibere, piazzaCastello, passoLampo,
    puoAccamparsi, prezzoTenda, accampa, validaTende, annullaTende,
    albaTempo, preavviso, passaOra, ultimaOra, ruotaSpenta, restaPrimaDelCambio,
    alba, passeggiata,
    limitaRegole, leggiRegole, salvaRegole,
  };
})();
