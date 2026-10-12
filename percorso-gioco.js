// ============================================================================
// IL PERCORSO NELLA PARTITA (settima stesura, 10/10/2026)
// Qui le regole di percorso.js si innestano nel gioco di gioco.js: il giro di ruota che fa passare un'ora, la
// consonante giusta con il passo subito, gli speciali, la vocale, la tenda con la conferma, la sera, la festa, il
// traguardo, il Castello del lampo. La scena (paesaggio, meeple, tende, bolle) e` percorso-vista.js.
// Disegno di Chiara: design/2026-10-09-scheda-percorso-partita.md. Regole: design/2026-10-10-regolamento-percorso.md (grafica da prototipo: il minimo).
// Si carica DOPO gioco.js (le funzioni qui sotto le chiama gioco.js solo quando si gioca, mai al caricamento) e
// prima di lampo.js. Tutto cio` che e` qui parte solo se inPercorso(): in Classica non si legge mai.
// ============================================================================

const passiInBallo = (g) => Percorso.ombraVista(Gioco, g) - g.pedina;
const testoPassi = (n) => n + (n === 1 ? " passo" : " passi");
const testoCaselle = (n) => n + (n === 1 ? " casella" : " caselle");
const indiceDi = (g) => Gioco.giocatori.indexOf(g);
// "Giulia", "Giulia e Leo", "Giulia, Leo e Papa`" (i nomi vanno gia` passati da escHtml)
const elencoNomi = (nomi) => (nomi.length <= 1 ? nomi.join("") : nomi.slice(0, -1).join(", ") + " e " + nomi[nomi.length - 1]);
const doveEPercorso = (g) => (g.pedina >= Gioco.caselle ? "traguardo!" : g.pedina === 0 ? "al via" : "al " + g.pedina);
// Chi e` piu` avanti; a pari caselle, chi ci e` arrivato prima (definizione del regolamento).
function classificaPercorso() { return Percorso.classifica(Gioco); }
const tempoNome = { sereno: "Sereno", ventoso: "Ventoso", temporale: "Temporale" };

// Pedine, ombre, tende, bivacchi, Castelli, Sassi e Scorciatoie da capo: lo stato del Percorso a inizio partita (o a «Gioca ancora»).
// Il sentiero e` uno solo (il paesaggio di Chiara); le pietre sono tante quante dice il pannello (regolamento §11-bis).
function azzeraPercorso() {
  Gioco.regole = Percorso.leggiRegole();
  Gioco.caselle = Gioco.regole.caselle;   // la lunghezza del sentiero e` un numero del pannello (partenza 25)
  PercorsoVista.impostaLunghezza(Gioco.caselle);
  Gioco.caselleSpeciali = posizioniCaselleSpeciali(Gioco.caselle);
  Gioco.haPosto = (pos) => PercorsoVista.haPosto(pos); // il paesaggio dice se una pietra da` posto a un Castello (percorso.js, caselleLibere)
  Gioco.castelli = {};
  Gioco.sassi = {};
  Gioco.bivacchi = {};
  percorsoBivacchi(Gioco.caselle).forEach((q) => { Gioco.bivacchi[q] = "spento"; });
  Gioco.tickArrivo = 0;
  Gioco.traguardo = null;
  Gioco.tramonto = null;
  Gioco.sera = false;
  Gioco.lampoGiorno = false;
  Gioco.tendaAperta = false;
  Gioco.dopoFesta = null;
  Gioco.viste = new Set();
  Gioco.fineConsonanti = () => consonantiFiniteNellaFrase();
  Gioco.turnoSenzaRuota = false;
  Gioco.giocatori.forEach((g) => {
    g.pedina = 0; g.ombra = 0; g.arrivo = 0;
    g.fermo = false; g.accampato = false; g.tenda = null; g.dentro = false;
    g.frenato = false; g.frenatoQuestoTurno = false;
    g.pot = null; g.scarponi = 0; g.scorciatoiaOggi = false;
  });
  Percorso.inizializzaScorciatoie(Gioco, Gioco.regole.scorciatoie); // nascoste: nessuno sa dove sono, nemmeno il regista
  Bolle.coda = [];
  PercorsoVista.nuovaPartita();
}

// L'alba: il tempo (a caso, senza preavviso), i bivacchi accesi ieri che non fermano piu', chi dormiva che riparte, le tende che spariscono, i
// Freni che scadono. Il primo giorno parte Sereno e il tempo cambia di rado.
function albaPercorso() {
  Percorso.alba(Gioco, {});
  Gioco.traguardo = null;
  Gioco.sera = false;
  Gioco.dopoFesta = null;
  PercorsoVista.nuovoGiorno();
}

// ---- il turno ------------------------------------------------------------------------------
// Il turno comincia: chi era stato frenato lo e` per questo turno (e solo per questo); si segna se in questo turno la ruota non gira piu'
// (consonanti finite): allora il turno e` un'ora (regolamento, definizioni). Si apre la finestra della tenda: «solo quando il turno passa»,
// fino al primo gesto di chi ha il turno (gestoDelTurno).
function iniziaTurnoPercorso() {
  const g = giocatoreCorrente();
  g.frenatoQuestoTurno = !!g.frenato;
  g.frenato = false;
  Gioco.turnoSenzaRuota = consonantiFiniteNellaFrase();
  Gioco.tendaAperta = !Gioco.sera && !Gioco.lampoGiorno;
}
function finisceTurnoPercorso() {
  const g = giocatoreCorrente();
  g.frenatoQuestoTurno = false;
}
// Il primo gesto di chi ha il turno (girare, comprare una vocale, risolvere, usare un potenziamento) chiude la finestra della tenda.
function gestoDelTurno() {
  if (!Gioco.tendaAperta) return;
  Gioco.tendaAperta = false;
  PercorsoVista.aggiorna();
}
function preparaRoundPercorso() {
  Gioco.giocatori.forEach((x) => { x.frenatoQuestoTurno = false; });
  iniziaTurnoPercorso();
}

// Il «Tocca a…» col meeple al posto della tessera con l'iniziale; ogni mattina dal secondo giorno parte l'ultimo (settima stesura, §9).
function vocePercorsoToccaA(p, inizioGiorno) {
  const g = giocatoreCorrente();
  return {
    stile: "tocca" + (p.nome.length > 12 ? " lungo" : ""),
    meeple: { m: meepleDi(g), sigla: inizialeDistinta(g) },
    colore: p.colore,
    sopra: inizioGiorno && Gioco.numeroRoundCorrente > 1 ? "Parte per primo l’ultimo" : "Tocca a",
    titolo: p.nome,
    durata: DURATA_TOCCA_A_MS,
  };
}
// Il prossimo che gioca: chi dorme (in tenda o al bivacco) ha finito il suo giorno e il suo turno si salta.
function prossimoInPiedi() {
  const n = Gioco.giocatori.length;
  for (let k = 1; k <= n; k++) {
    const i = (Gioco.indiceCorrente + k) % n;
    if (!Percorso.dorme(Gioco.giocatori[i])) return i;
  }
  return Gioco.indiceCorrente;
}
// Chi ha appena preso un bivacco (passo subito, Sorpasso...) dorme li` fino all'alba: ha finito il giorno, non gira piu`, il suo turno passa.
// Ritorna true se ha preso lui la mano (a frase finita no: la frase e` risolta, non c'e` turno da far passare).
function chiGiocaDorme() {
  const g = giocatoreCorrente();
  if (!g.fermo || fraseCompletamenteRivelata()) return false;
  annunciaEPassaTurno({ stile: "tocca tempo sera", icona: "sera", titolo: g.nome + " dorme al bivacco", sotto: "fino all’alba · il turno passa", durata: DURATA_ANNUNCIO_LUNGO_MS });
  return true;
}
// Il turno passa. Se l'ora del tramonto era l'ultima, scende la sera («Quando il turno passa senza soluzione, scende la sera»).
function passaTurnoPercorso() {
  const g = giocatoreCorrente();
  finisceTurnoPercorso();
  if (Gioco.turnoSenzaRuota) Percorso.passaOra(Gioco); // a consonanti finite un turno e` un'ora; il resto del turno in cui e` uscita l'ultima consonante e` la stessa ora
  avanzaManoSquadra(g);
  // se l'ora del tramonto era l'ultima, o se nessuno e` piu` in piedi (l'ultimo si e` fermato a un bivacco), scende la sera
  if (Percorso.ultimaOra(Gioco) || !Percorso.inPiedi(Gioco).length) { iniziaSera(null); return; }
  daiIlTurnoA(prossimoInPiedi());
}
function daiIlTurnoA(indice) {
  Gioco.indiceCorrente = indice;
  iniziaTurnoPercorso();
  aggiornaSchedeGiocatori();
  const p = chiTocca(giocatoreCorrente());
  Audio_.toccaA();
  Annuncio.mostra(vocePercorsoToccaA(p, false));
  setTimeout(() => { Gioco.stato = "idle"; aggiornaComandi(); }, DURATA_TOCCA_A_MS);
}
// Chi si accampa mentre ha il turno lo perde: passa al successivo (nessuna ora passa).
function saltaTurnoDi(g) {
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  finisceTurnoPercorso();
  avanzaManoSquadra(g);
  daiIlTurnoA(prossimoInPiedi());
}

// ---- le bolle della prima volta (regolamento §11) -----------------------------------------------
// Una riga sola la prima volta che succede una cosa, sul velo, finche' il regista non la chiude. Si mettono in coda e si dicono
// quando il gioco e` fermo (idle), non mentre un annuncio e` sul palco; di sera le dice la scena (percorso-vista.js).
const Bolle = { coda: [] };
function richiediBolla(chiave, dati) {
  if (!inPercorso() || Gioco.viste.has(chiave)) return false;
  Gioco.viste.add(chiave);
  Bolle.coda.push(Object.assign({ chiave }, dati));
  return true;
}
function apriProssimaBolla() {
  if (!Bolle.coda.length || Gioco.stato !== "idle") return;
  const dati = Bolle.coda.shift();
  Gioco.stato = "bolla";
  aggiornaComandi();
  PercorsoVista.bolla(dati, () => { Gioco.stato = "idle"; aggiornaComandi(); });
}
// Le bolle che nascono da cio` che succede sul sentiero (Castello visitato, primo bivacco): di giorno si accodano, di sera le chiede la scena.
function bollaDelloEvento(e) {
  if (e.t === "castello" && e.attivo) {
    if (Gioco.viste.has("castello")) return null;
    Gioco.viste.add("castello");
    return { chiave: "castello", a: "castello", pos: e.pos, testo: `Hai visitato il castello di ${e.padrone.nome}: ${e.padrone.nome} avanza di un passo.` };
  }
  if (e.t === "bivacco") {
    if (Gioco.viste.has("bivacco")) return null;
    Gioco.viste.add("bivacco");
    return { chiave: "bivacco", a: "bivacco", pos: e.pos, testo: "Al bivacco dove nessuno ha ancora dormito, oggi chi arriva si ferma e dorme lì. Il giorno dopo ci si passa sopra." };
  }
  return null;
}
function accodaBolleDegliEventi(ev) {
  ev.forEach((e) => { const b = bollaDelloEvento(e); if (b) Bolle.coda.push(b); });
}

// Le cose che si controllano ogni volta che i comandi si ridisegnano: la prima bolla del preavviso, la tenda, l'ultima ora.
function aggiornaPercorsoComandi() {
  const pv = Percorso.preavviso(Gioco);
  if (pv && !Gioco.sera) {
    richiediBolla("preavviso", {
      a: "cielo",
      testo: `Fra ${pv.fra} ${pv.fra === 1 ? "ora" : "ore"} ${{ sereno: "torna il Sereno", ventoso: "arriva il Ventoso", temporale: "arriva il Temporale" }[pv.tempo]}: le nuvole avvisano sempre ${Gioco.regole.preavviso} ${Gioco.regole.preavviso === 1 ? "ora" : "ore"} prima.`,
    });
  }
  PercorsoVista.aggiorna();
  if (Gioco.stato === "idle" && !Ruota.inAnimazione()) {
    // R13: la prima volta che il pulsante della tenda compare accanto a qualcuno, la bolla che dice a cosa serve
    if (!Gioco.viste.has("tenda") && !Gioco.sera) {
      const i = Gioco.giocatori.findIndex((x) => Percorso.puoAccamparsi(Gioco, x));
      if (i >= 0) {
        richiediBolla("tenda", { a: "tenda", i, testo: "La tenda: quando il turno passa, chi la pianta fa subito metà della strada dell’ombra, poi per oggi ha finito, e nessuno lo tocca più. Tocca il pulsante per vedere quanti passi." });
      }
    }
    // R9: nell'ultima ora la ruota non gira piu`: lo dice l'annuncio grande, una volta sola per tramonto
    if (Gioco.tramonto && Percorso.ultimaOra(Gioco) && !Gioco.sera && !Gioco.tramonto.fermaDetta && !Gioco.lampoGiorno) {
      Gioco.tramonto.fermaDetta = true;
      Annuncio.mostra({ stile: "tocca tempo sera", icona: "tramonto", titolo: "Non si gira più", sotto: "chi ha il turno dà la soluzione, oppure scende la sera", durata: DURATA_ANNUNCIO_TEMPO_MS });
    }
    apriProssimaBolla();
  }
}

// R9 (scheda dei ritocchi): il cambio di tempo e l'ultimo giro si annunciano in GRANDE mentre la ruota gira (10-12 s: l'annuncio finisce
// prima della consonante). Dal 09/10 sera il cambio di tempo sta al CENTRO dello schermo, col resto offuscato, un secondo in piu`. Il tempo cambia quando la ruota si ferma (iniziaGiroPercorso): qui lo si prevede, perche' l'avviso
// arrivi prima. Se i due coincidono, prima il tempo e poi l'ultimo giro.
function annunciInizioGiro() {
  if (!inPercorso() || Gioco.giroAnnunciato || Gioco.lampoGiorno || Gioco.sera) return;
  Gioco.giroAnnunciato = true;
  const m = Gioco.meteo;
  const testi = PercorsoVista.testiTempo();
  const cambia = m && Percorso.restaPrimaDelCambio(Gioco) <= 1;
  const ultimo = !!(Gioco.tramonto && Gioco.tramonto.restano === 1);
  const vociTempo = () => {
    const t = testi[m.prossimo];
    // 09/10 sera (appunto 9 di Damiano): un secondo in piu` (DURATA_ANNUNCIO_CAMBIO_TEMPO_MS), al centro dello schermo, il resto offuscato
    return { stile: "tocca tempo centro " + m.prossimo, icona: m.prossimo, titolo: t.titolo, sottoHtml: t.riga, durata: DURATA_ANNUNCIO_CAMBIO_TEMPO_MS, velo: true };
  };
  const vociUltimo = () => ({ stile: "tocca tempo sera", icona: "sera", titolo: "Ultimo giro!", sotto: "poi scende la sera", durata: DURATA_ANNUNCIO_TEMPO_MS });
  if (cambia) {
    Audio_.click();
    Annuncio.mostra(vociTempo());
    if (ultimo) setTimeout(() => { if (Gioco.stato === "girando") Annuncio.mostra(vociUltimo()); }, DURATA_ANNUNCIO_CAMBIO_TEMPO_MS + 250);
  } else if (ultimo) Annuncio.mostra(vociUltimo());
}

// ---- il giro di ruota ---------------------------------------------------------------------------------
// Un giro di ruota e` un'ora: il tempo di questo giro e` quello di prima del tick; poi il sole scende di uno scatto, le nuvole
// avanzano, un cambio di tempo vale dall'ora dopo, e le tende in attesa valgono (pagando col tempo che c'e` adesso).
function iniziaGiroPercorso() {
  Gioco.giroAnnunciato = false;
  Gioco.tempoGiro = Gioco.meteo.tempo;
  Percorso.passaOra(Gioco);
  const ev = Percorso.validaTende(Gioco);
  PercorsoVista.giroFinito(ev);
}

function gestisciEsitoPercorso(segmento, indice, g) {
  if (segmento.tipo === "soldi") {
    if (segmento.jolly && !Gioco.jollyPresoInQuestoRound) { // il Jolly come in Classica: si guadagna con una consonante
      impostaTitoloConsonanti("<b>Jolly!</b> Se la consonante c’è, è tuo");
      Gioco.spicchioValore = JOLLY_VALORE_SOLDI_PER_LETTERA;
      Gioco.spicchioTipo = "jolly";
      apriPannelloConsonanti();
      return;
    }
    const n = PASSI_PER_SPICCHIO[indice];
    impostaTitoloConsonanti(`<b>${testoPassi(n)}</b> a lettera · scegli una consonante`);
    Gioco.spicchioValore = n;
    Gioco.spicchioTipo = "soldi";
    apriPannelloConsonanti();
    return;
  }
  if (segmento.tipo === "bancarotta") { // la Nebbia
    if (g.jolly > 0) { apriPannelloJolly("nebbia"); return; }
    nebbiaSullOmbra(g);
    return;
  }
  if (segmento.tipo === "raddoppia") { // il Raddoppio, al centro dello spicchio in tre
    impostaTitoloConsonanti("<b>Raddoppio!</b> Se la consonante c’è, l’ombra raddoppia");
    Gioco.spicchioValore = 0;
    Gioco.spicchioTipo = "raddoppia";
    apriPannelloConsonanti();
    return;
  }
  if (segmento.tipo === "speciale") gestisciSpecialePercorso(segmento.speciale, g);
}

// La Nebbia: l'ombra sparisce (i passi gia` fatti restano), il turno passa (la Bancarotta del Percorso; il Jolly salva; i Ramponi salvano l'ombra).
function nebbiaSullOmbra(g) {
  Audio_.bancarotta();
  const r = Percorso.nebbia(Gioco, g);
  if (!r.salvata) {
    PercorsoVista.nebbia(indiceDi(g));
    richiediBolla("nebbia", { a: "meeple", i: indiceDi(g), testo: "Nebbia: va via l’ombra. I passi fatti restano." });
  }
  aggiornaSchedeGiocatori();
  annunciaEPassaTurno({ stile: "scena nebbia", titolo: "Nebbia!", sotto: r.salvata ? "i Ramponi di " + g.nome + " salvano l’ombra" : "l’ombra di " + g.nome + " va via", durata: DURATA_ANNUNCIO_LUNGO_MS });
}

// ---- la lettera ------------------------------------------------------------------------------------------
function risolviConsonantePercorso(lettera) {
  Gioco.quante = null;
  Gioco.lettereUsate.add(lettera);
  const tipo = Gioco.spicchioTipo;
  const posizioni = posizioniCoperteDellaLettera(lettera);
  const g = giocatoreCorrente();

  if (posizioni.length === 0) {
    if (tipo !== "jolly" && !g.frenatoQuestoTurno && !Percorso.dorme(g)) g.scarponi = 0; // gli Scarponi armati si consumano alla consonante, anche se non c'e`
    if (scudoPuoSalvare()) { scudoSalva(lettera, "non c’è"); return; }
    Audio_.letteraAssente();
    const sotto = { jolly: "niente Jolly", raddoppia: "niente Raddoppio", robinhood: "niente Robin Hood" }[tipo];
    annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", sotto, durata: DURATA_ANNUNCIO_MS });
    return;
  }

  const n = posizioni.length;
  posizioni.forEach((p) => Gioco.posizioniAccese.add(p));
  const tempo = Gioco.tempoGiro;
  // Il passo subito e l'ombra (§2): uno spicchio di passi, il Raddoppio, e Robin Hood (la sua consonante da' il suo passo; l'ombra no)
  const info = Percorso.consonanteGiusta(Gioco, g, {
    tipo: tipo === "soldi" ? "passi" : tipo,
    valore: tipo === "soldi" ? Gioco.spicchioValore : 0,
    volte: n,
    tempo,
  });
  const voce = { lettera, titolo: quanteVolte(n) };
  let suono = "letteraRivelata";
  voce.sotto = rigaSottoLettera(tipo, info);
  if (tipo === "jolly") {
    g.jolly += 1;
    Gioco.jollyPresoInQuestoRound = true;
    Ruota.animaPresaJolly(Gioco.spicchioIndice);
    suono = "jolly";
  } else if (tipo === "robinhood") {
    Gioco.robinInAttesa = true; // il furto parte a lettere scoperte (finalizzaRivelazione)
  }
  Audio_[suono]();
  disegnaTabellone();
  numeraCaselleAccese();
  Annuncio.mostra(voce);
  // il meeple fa il passo e il fantasma scivola nell'istante in cui compare la lettera (§5.0 della scheda)
  const chip = info.passi || info.ombraPiu ? { i: indiceDi(g), testo: tipo === "raddoppia" ? "×2" : "+" + info.ombraPiu } : null;
  PercorsoVista.riproduci(info.ev, { chip: info.ombraPiu || tipo === "raddoppia" ? chip : null, viaggio: info.viaggio });
  accodaBolleDegliEventi(info.ev);
  // La bolla della prima consonante giusta, in DUE bolle in fila (Damiano, 09/10 sera, strada A; la parola «fantasma» non compare):
  // sopra la pedina «Giusta! Un passo avanti.», poi, con una freccia sull'ombra, «Se risolvi la frase adesso, arrivi fin qui.»
  // La prima solo se la pedina e` avanzata davvero (non col Temporale); la seconda solo quando l'ombra si vede (a volte la pedina
  // la raggiunge subito: allora la spiegazione aspetta la prossima volta che c'e`).
  const prime = [];
  if (info.passi > 0 && !Gioco.viste.has("passo")) {
    Gioco.viste.add("passo");
    prime.push({ chiave: "passo", a: "meeple", i: indiceDi(g), testo: "Giusta! Un passo avanti." });
  }
  if (Percorso.fantasma(Gioco, g) !== null && !Gioco.viste.has("ombra")) {
    Gioco.viste.add("ombra");
    prime.push({ chiave: "ombra", a: "ombra", i: indiceDi(g), testo: "Se risolvi la frase adesso, arrivi fin qui." });
  }
  Bolle.coda.unshift(...prime);
  if (info.viaggio && info.viaggio.scorciatoia !== null && !Gioco.viste.has("scorciatoia")) { // la prima Scorciatoia scoperta (§12)
    Gioco.viste.add("scorciatoia");
    Bolle.coda.push({ chiave: "scorciatoia", a: "ombra", i: indiceDi(g), testo: "Una scorciatoia nascosta! La tua ombra salta avanti di 3." });
  }
  aggiornaSchedeGiocatori();
  Gioco.stato = "rivelando";
  aggiornaComandi();
  avviaTimerAutoscoperta();
}

// La riga sotto «ce n'e` una»: cosa e` successo alla pedina e all'ombra.
function rigaSottoLettera(tipo, info) {
  const passi = info.passi === 0 ? "" : info.passi === 1 ? "un passo avanti" : info.passi === 2 ? "due passi avanti" : info.passi + " passi avanti";
  if (tipo === "jolly") return "e il Jolly è tuo";
  if (info.fermoPrima) return "al bivacco fino all’alba";
  if (info.frenato) return "frenato: fermo per questo turno";
  const ombra = tipo === "raddoppia" ? "l’ombra raddoppia" : tipo === "robinhood" ? "e scatta Robin Hood" : "ombra +" + info.ombraPiu;
  const pezzi = [];
  if (info.tempo === "temporale" && !info.scarponi) pezzi.push("Temporale: niente passo");
  else if (passi) pezzi.push(passi + (info.scarponi ? " (Scarponi)" : ""));
  if (!info.fermo) pezzi.push(ombra); // chi si ferma al bivacco dorme: l'ombra non c'e'
  if (info.viaggio && info.viaggio.scorciatoia !== null) pezzi.push("scorciatoia!");
  if (info.fermo) pezzi.push("al bivacco fino all’alba");
  return pezzi.join(" · ");
}

// ---- gli speciali della ruota (settima stesura: la Scatola e Robin Hood) -------------------------------------------------------------------------
function gestisciSpecialePercorso(chiave, g) {
  if (chiave === "robinhood") {
    impostaTitoloConsonanti(`<b>Robin Hood!</b> Se la consonante c’è, ${testoCaselle(PERCORSO_ROBIN_HOOD_PASSI)} da chi è in testa`);
    Gioco.spicchioValore = 0;
    Gioco.spicchioTipo = "robinhood";
    apriPannelloConsonanti();
  } else if (chiave === "scatola") specialeScatola(g);
}

// La Scatola (§8): il riquadro al centro dice cosa e` uscito; il giocatore lo tiene sulla tessera (uno alla volta: il nuovo sostituisce il
// vecchio) e gira ancora. Nell'ultima ora del tramonto lo prende ma non gira piu` (ci pensa btnGira, spento da ruotaSpenta).
function specialeScatola(g) {
  const chiave = Percorso.pescaScatola(Gioco, g);
  const p = PERCORSO_POTENZIAMENTI[chiave];
  const vecchio = g.pot && g.pot !== chiave ? PERCORSO_POTENZIAMENTI[g.pot].nome : null;
  g.pot = chiave;
  Audio_.letteraRivelata();
  aggiornaSchedeGiocatori();
  richiediBolla("scatola", { a: "tessera", i: indiceDi(g), testo: "Tienila sulla tessera." });
  cartelloSpeciale("scatola", "Scatola: " + p.nome + "!", { sotto: p.riga + (p.auto ? "" : " Si usa nel tuo turno, prima di girare.") + (vecchio ? " · prende il posto di " + vecchio : "") }, DURATA_CARTELLO_PERCORSO_MS);
  giraAncoraDopo(DURATA_CARTELLO_PERCORSO_MS);
}

// I riquadri a scelta: la forma di #pannello-express. Lo stato resta fermo finche` il regista non tocca un pulsante.
function apriSceltaPercorso(riempi) {
  Gioco.stato = "attesa_percorso";
  pannelloPercorso.innerHTML = "";
  riempi(pannelloPercorso);
  pannelloPercorso.classList.remove("nascosta");
  aggiornaComandi();
}
function chiudiSceltaPercorso() {
  pannelloPercorso.classList.add("nascosta");
  pannelloPercorso.innerHTML = "";
}
function domandaPercorso(html) {
  const p = document.createElement("p");
  p.innerHTML = html; // testi nostri; i nomi dei giocatori non ci passano mai
  return p;
}
function pulsantePercorso(testo, classe, alClick) {
  const b = document.createElement("button");
  b.type = "button";
  if (classe) b.className = classe;
  b.textContent = testo;
  b.addEventListener("click", alClick);
  return b;
}
// Scegli un avversario toccando il suo meeple (Freno)
function sceltaAvversario(domandaHtml, avversari, alla) {
  apriSceltaPercorso((box) => {
    box.appendChild(domandaPercorso(domandaHtml));
    const fila = document.createElement("div");
    fila.className = "scegli-giocatore";
    avversari.forEach((x) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.setProperty("--colore-giocatore", x.colore);
      const t = document.createElement("span");
      t.className = "meeple-freno";
      t.innerHTML = meepleHtml(meepleDi(x), inizialeDistinta(x));
      b.appendChild(t);
      b.appendChild(document.createTextNode(x.nome));
      b.addEventListener("click", () => { chiudiSceltaPercorso(); Audio_.click(); alla(x); });
      fila.appendChild(b);
    });
    box.appendChild(fila);
  });
}
function cartelloSpeciale(chiave, titolo, voce, durata) {
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  Annuncio.mostra(Object.assign({ stile: "speciale", titolo, durata }, definizioneSpeciale(chiave) ? { simbolo: chiave } : {}, voce)); // (il simbolo solo se c'e`: i potenziamenti senza disegno hanno la parola)
}

// ---- i potenziamenti da usare (§8): nel proprio turno, prima di girare ------------------------------------------------------------------------
// Si usano dal pulsante «Usa» sulla tessera di chi ha il turno (percorso-vista.js). Scudo e Ramponi scattano da soli. Usarne uno e` un gesto del
// turno (chiude la finestra della tenda) ma il turno continua: si gira ancora.
function potenziamentoUsabile(g) {
  if (!g.pot || PERCORSO_POTENZIAMENTI[g.pot].auto) return false;
  if (g.pot === "valanga") return Percorso.valangaPossibile(Gioco, g);
  if (g.pot === "sorpasso") return Percorso.sorpassoPossibile(Gioco, g);
  if (g.pot === "freno") return Percorso.candidatiFreno(Gioco, g).length > 0;
  if (g.pot === "sasso") return Percorso.pietreSasso(Gioco, g).length > 0;
  return true; // gli Scarponi
}
function usaPotenziamento(i) {
  const g = Gioco.giocatori[i];
  if (!inPercorso() || Gioco.stato !== "idle" || Ruota.inAnimazione() || g !== giocatoreCorrente() || !potenziamentoUsabile(g)) return;
  const k = g.pot;
  const nome = PERCORSO_POTENZIAMENTI[k].nome;
  const dopo = (ev, ms) => { // la scena racconta i movimenti mentre il cartello e` sul palco (pedine E ombre camminano; la trattenuta si toglie qui)
    setTimeout(() => { PercorsoVista.riproduci(ev, { rilascia: true, ombre: true }); accodaBolleDegliEventi(ev); aggiornaSchedeGiocatori(); }, 350);
    giraAncoraDopo(ms);
  };
  if (k === "freno" || k === "sasso") { // si sceglie un avversario o una pietra: il potenziamento si consuma solo a scelta fatta
    gestoDelTurno();
    Audio_.click();
    if (k === "freno") {
      sceltaAvversario("<b>Freno!</b> Chi freni? Al suo prossimo turno né il passo né l’ombra si muovono.", Percorso.candidatiFreno(Gioco, g), (x) => {
        g.pot = null;
        const r = Percorso.freno(Gioco, g, x);
        aggiornaSchedeGiocatori();
        cartelloSpeciale("freno", "Freno!", { sottoHtml: r.esito === "scudo" ? `lo Scudo di <b>${escHtml(x.nome)}</b> lo para` : `Freno a <b>${escHtml(x.nome)}</b>` }, DURATA_ANNUNCIO_LUNGO_MS);
        giraAncoraDopo(DURATA_ANNUNCIO_LUNGO_MS);
      });
    } else sceltaPietraSasso(g);
    return;
  }
  gestoDelTurno();
  g.pot = null;
  Audio_.click();
  if (k === "valanga") {
    PercorsoVista.trattieni();
    const r = Percorso.valanga(Gioco, g);
    const arretrato = r.ev.filter((e) => e.t === "indietro").reduce((n, e) => n + (e.da - e.a), 0);
    cartelloSpeciale("valanga", "Valanga!", { sottoHtml: r.esito === "scudo" ? `lo Scudo di <b>${escHtml(r.vittima.nome)}</b> la ferma` : `<b>${escHtml(r.vittima.nome)}</b> torna indietro di ${arretrato}${Percorso.fantasma(Gioco, r.vittima) !== null ? ", e la sua ombra con lui" : ""}` }, DURATA_CARTELLO_PERCORSO_MS);
    dopo(r.ev, DURATA_CARTELLO_PERCORSO_MS);
  } else if (k === "sorpasso") {
    PercorsoVista.trattieni();
    const r = Percorso.sorpasso(Gioco, g);
    cartelloSpeciale("sorpasso", "Sorpasso!", { sottoHtml: `<b>${escHtml(g.nome)}</b> va davanti a <b>${escHtml(r.con.nome)}</b>` }, DURATA_CARTELLO_PERCORSO_MS);
    accodaBolleDegliEventi(r.ev);
    dopo(r.ev, DURATA_CARTELLO_PERCORSO_MS);
  } else { // Scarponi e Scarponi grandi: armati fino alla prossima consonante
    const extra = PERCORSO_POTENZIAMENTI[k].extra;
    Percorso.scarponi(Gioco, g, extra);
    aggiornaSchedeGiocatori();
    cartelloSpeciale("scarponi", nome + "!", { sotto: `alla prossima consonante giusta fai ${extra} ${extra === 1 ? "passo" : "passi"} in più` }, DURATA_ANNUNCIO_LUNGO_MS);
    giraAncoraDopo(DURATA_ANNUNCIO_LUNGO_MS);
  }
}
// Il Sasso: si tocca una pietra dietro la propria pedina (le pietre si accendono); «Annulla» lo tiene in mano.
function sceltaPietraSasso(g) {
  Gioco.stato = "attesa_percorso";
  pannelloPercorso.innerHTML = "";
  pannelloPercorso.appendChild(domandaPercorso("<b>Sasso!</b> Tocca una delle 3 pietre dietro di te: il primo che ci passa sopra torna indietro di un passo"));
  const scelte = document.createElement("div");
  scelte.className = "scelte";
  const chiudi = () => { PercorsoVista.nascondiLibere(); pannelloPercorso.classList.add("nascosta"); pannelloPercorso.innerHTML = ""; };
  scelte.appendChild(pulsantePercorso("Annulla", "secondario", () => { chiudi(); Gioco.stato = "idle"; aggiornaComandi(); }));
  pannelloPercorso.appendChild(scelte);
  pannelloPercorso.classList.remove("nascosta");
  aggiornaComandi();
  PercorsoVista.mostraLibere(Percorso.pietreSasso(Gioco, g), (pos) => {
    chiudi();
    g.pot = null;
    Percorso.posaSasso(Gioco, g, pos);
    PercorsoVista.aggiorna();
    aggiornaSchedeGiocatori();
    cartelloSpeciale("sasso", "Sasso!", { sotto: `posato sulla pietra ${pos}` }, DURATA_ANNUNCIO_LUNGO_MS);
    giraAncoraDopo(DURATA_ANNUNCIO_LUNGO_MS);
  }, g, true);
}

// Robin Hood: la consonante prima (2.4.1); se c'e`, 3 caselle dalla pedina di chi e` in testa all'OMBRA di chi ruba (sono sue solo se
// risolve). Chi e' in tenda e' al riparo (si colpisce il primo dei non accampati dopo di lui); lo Scudo lo para.
function spicchioRobinHoodPercorso(g) {
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  PercorsoVista.trattieni();
  const r = Percorso.robinHood(Gioco, g);
  const niente = (sotto) => {
    PercorsoVista.rilascia(); // niente si muove: la trattenuta non serve
    Audio_.click();
    Annuncio.mostra({
      stile: "speciale robin ferma",
      robin: { da: g, a: g, pedina: testoCaselle(PERCORSO_ROBIN_HOOD_PASSI) },
      titolo: "Robin Hood!",
      sotto,
      durata: DURATA_ROBIN_HOOD_MS,
    });
    dopoRobinHood();
  };
  if (r.esito === "nessunoPartito") { niente("nessuno è ancora partito · gira ancora"); return; }
  if (r.esito === "tuInTesta") { niente("sei tu in testa: niente da prendere · gira ancora"); return; }
  if (r.esito === "freno") { niente("col Freno l’ombra non si muove · gira ancora"); return; }
  if (r.esito === "alRiparo") { niente("chi ti precede è al riparo: niente da prendere · gira ancora"); return; }
  if (r.esito === "scudo") { aggiornaSchedeGiocatori(); niente("lo Scudo di " + r.vittima.nome + " lo para · gira ancora"); return; }
  Audio_.letteraRivelata();
  Annuncio.mostra({
    stile: "speciale robin",
    robin: { da: r.vittima, a: g, pedina: testoCaselle(r.n) },
    titolo: "Robin Hood!",
    sottoHtml: `<b>${escHtml(r.vittima.nome)}</b> torna indietro di ${r.n} · ` + (r.preso ? `l’ombra di <b>${escHtml(g.nome)}</b> avanza di ${r.n} · gira ancora` : `ma <b>${escHtml(g.nome)}</b> dorme al bivacco: non le prende`),
    durata: DURATA_ROBIN_HOOD_MS,
  });
  richiediBolla("robin", { a: "meeple", i: indiceDi(r.vittima), testo: `Robin Hood: la pedina di chi è in testa torna indietro di ${PERCORSO_ROBIN_HOOD_PASSI}. Le prende la tua ombra: sono tue se risolvi.` });
  // la pedina di chi era in testa torna indietro quando il cartello e` sul palco (ROBIN_HOOD_PEDINA_RITARDO_MS), l'ombra di chi ruba si allunga
  setTimeout(() => { PercorsoVista.riproduci(r.ev, { chip: r.preso ? { i: indiceDi(g), testo: "+" + r.n } : null, viaggio: r.viaggio, rilascia: true, ombre: true }); aggiornaSchedeGiocatori(); }, ROBIN_HOOD_PEDINA_RITARDO_MS);
  dopoRobinHood();
}

// ---- la tenda (§4) ---------------------------------------------------------------------------------------------------
// Il pulsante e` accanto a chi puo` accamparsi, prima che la ruota giri; toccato, il gioco chiede conferma col prezzo vero.
function apriConfermaTenda(g) {
  if (!inPercorso() || Gioco.stato !== "idle" || !Percorso.puoAccamparsi(Gioco, g)) return;
  const prezzo = Percorso.prezzoTenda(Gioco, g);
  Gioco.stato = "conferma_tenda";
  aggiornaComandi();
  Audio_.click();
  PercorsoVista.conferma(g, prezzo, (si) => {
    if (!si) { Gioco.stato = "idle"; aggiornaComandi(); return; }
    confermaTenda(g);
  });
}
function confermaTenda(g) {
  const r = Percorso.accampa(Gioco, g);
  Audio_.click();
  if (r.primaDelGiorno) richiediBolla("tramonto", { a: "sole", testo: `Tramonto: ancora ${Gioco.regole.oreTramonto} ${Gioco.regole.oreTramonto === 1 ? "giro" : "giri"} di ruota per tutti, poi scende la sera.` });
  PercorsoVista.tendaPiantata(indiceDi(g));
  Gioco.stato = "idle";
  aggiornaSchedeGiocatori();
  if (g === giocatoreCorrente()) saltaTurnoDi(g); // ha finito il suo giorno: il suo turno si salta
  else aggiornaComandi();
}
if (btnScendeSera) btnScendeSera.addEventListener("click", () => {
  if (!inPercorso() || Gioco.stato !== "idle" || !Percorso.ultimaOra(Gioco)) return;
  Audio_.click();
  iniziaSera(null);
});

// ---- si risolve, e la sera -------------------------------------------------------------------------------------------
// Dove camminera' chi risolve: fino al suo fantasma (un passo, se l'ombra e' ferma alla pedina), fermandosi a un bivacco che ferma.
function metaDellaSoluzione(g) {
  if (g.fermo) return g.pedina;
  const vista = Percorso.ombraVista(Gioco, g);
  const voluta = vista > g.pedina ? vista : g.pedina + PERCORSO_PASSO_SOLUZIONE;
  return Percorso.simulaArrivo(Gioco, g.pedina, voluta);
}
// Chi risolve la frase: le tende ancora in attesa si annullano, le ombre degli altri svaniscono, c'e` la festa; finita quella
// scende la sera e cammina per primo lui.
function vinciRoundPercorso(g) {
  const annullate = Percorso.annullaTende(Gioco);
  PercorsoVista.tendeAnnullate(annullate);
  avanzaManoSquadra(g);
  finisceTurnoPercorso();
  Gioco.posizioniRivelate = new Set([...Gioco.fraseCorrente.testo].map((_, k) => k));
  disegnaTabellone();
  Gioco.stato = "fine_round";
  // la frase e` risolta, non «finita»: l'avviso «Lettere finite» qui sul palco direbbe il contrario
  Gioco.consonantiFiniteAvvisate = true;
  Gioco.vocaliFiniteAvvisate = true;
  aggiornaComandi();
  const meta = metaDellaSoluzione(g);
  const caselle = Math.max(0, Math.min(meta, Gioco.caselle) - g.pedina);
  // R10: i testi della festa dicono cosa succede stasera
  const sotto = g.fermo ? "fermo al bivacco: non avanza, ma la frase è sua"
    : Percorso.ombraVista(Gioco, g) <= g.pedina ? "il passo di chi risolve"
    : "stasera cammina fino all’ombra";
  Gioco.dopoFesta = () => iniziaSera(g);
  // D1: se una tenda si annulla, prima si ripiega (300 ms) e solo dopo parte la festa
  if (annullate.length) setTimeout(() => mostraFestaPercorso(g, caselle, sotto, false), DURATA_TENDA_RIPIEGA_MS + 20);
  else mostraFestaPercorso(g, caselle, sotto, false);
}

// La festa di chi risolve: «+4 caselle» e la riga sotto; al traguardo «Traguardo!».
function mostraFestaPercorso(g, caselle, sottoHtml, traguardo, sopra) {
  Audio_.festaVittoria();
  const scheda = overlayFesta.querySelector(".scheda-festa");
  scheda.classList.add("percorso");
  scheda.classList.toggle("traguardo", !!traguardo);
  overlayFesta.querySelector(".festa-testo").textContent = sopra || "ha risolto la frase!";
  scriviIniziale(festaImmagineEl, g);
  festaImmagineEl.style.outlineColor = g.colore;
  festaNomeEl.textContent = g.nome;
  festaNomeEl.style.color = g.colore;
  festaMoneteEl.innerHTML = ""; // niente monete: non ci sono soldi
  creaScintille(festaMoneteEl, SCINTILLE_FESTA_ROUND_N, 130);
  if (frameContatoreFesta) { cancelAnimationFrame(frameContatoreFesta); frameContatoreFesta = null; }
  if (traguardo) {
    festaCifraEl.textContent = "Traguardo!";
    document.getElementById("festa-unita").textContent = "";
    document.getElementById("festa-sotto").innerHTML = `<b>${escHtml(g.nome)}</b> vince la partita`;
  } else {
    animaContatoreFesta(caselle, "+");
    document.getElementById("festa-unita").textContent = caselle === 1 ? " casella" : " caselle";
    document.getElementById("festa-sotto").innerHTML = sottoHtml;
  }
  generaCoriandoliFesta(g.colore);
  overlayFesta.classList.remove("nascosta");
  fermaTimerChiusuraFesta();
  timerChiusuraFesta = setTimeout(chiudiFestaVittoria, DURATA_FESTA_VITTORIA_MS);
}

// Scende la sera: la frase si scopre, le ombre svaniscono, camminano chi ha risolto e gli accampati, fino alla loro meta. Dal 09/10 sera
// (R10) la scena e` raccontata un pezzo alla volta dall'annuncio grande (percorso-vista.js, passeggiata): chi cammina e perche',
// e chi resta fermo.
function iniziaSera(solutore) {
  Gioco.stato = "sera";
  fermaTimerAutoscoperta();
  fermaTimerSoluzione();
  nascondiTuttiIPannelli();
  Annuncio.nascondi();
  Gioco.posizioniRivelate = new Set([...Gioco.fraseCorrente.testo].map((_, k) => k));
  Gioco.posizioniAccese = new Set();
  disegnaTabellone();
  Gioco.consonantiFiniteAvvisate = true;
  Gioco.vocaliFiniteAvvisate = true;
  aggiornaComandi();
  const fantasmiPrima = Gioco.giocatori.map((g) => Percorso.fantasma(Gioco, g)); // dove si vedevano i fantasmi prima che la sera li tocchi (per la scena)
  const tratte = Percorso.passeggiata(Gioco, solutore);
  // chi resta fermo: non cammina ne' verso un fantasma ne' verso una tenda (se la passeggiata e` finita al traguardo, la vittoria viene prima di tutto)
  const camminano = new Set(tratte.map((t) => t.g));
  const fermi = Gioco.traguardo ? [] : Gioco.giocatori.filter((x) => !camminano.has(x));
  const sotto = solutore ? `${solutore.nome} ha risolto: cammina fino alla sua ombra`
    : tratte.length ? "nessuno ha risolto: cammina solo chi ha la tenda"
    : "nessuno ha risolto e nessuno ha la tenda: tutti fermi";
  const bollaSera = !Gioco.viste.has("sera") ? (Gioco.viste.add("sera"), { chiave: "sera", a: "sentiero", testo: "La sera si cammina: chi ha risolto va fino alla sua ombra, chi ha la tenda va a dormire. Gli altri restano fermi." }) : null;
  PercorsoVista.passeggiata(tratte, { intro: { sotto }, fantasmiPrima, bolla: bollaSera, bollaDelloEvento, fermi: tratte.length ? fermi : [] }, () => fineGiornata(solutore));
}

// Finita la passeggiata: chi ha toccato il traguardo vince; altrimenti il giorno e` finito. Domani parte l'ultimo (settima stesura, §9).
function fineGiornata(solutore) {
  Gioco.sera = true;
  if (Gioco.traguardo) { vittoriaDiTraguardo(Gioco.traguardo); return; }
  if (solutore) Gioco.storicoRound.push({ numero: Gioco.numeroRoundCorrente, vincitoreNome: solutore.nome, vincitoreColore: solutore.colore });
  Gioco.indiceProssimoRound = indiceDelPrimoDomani();
  Gioco.ultimoRoundFinito = Gioco.numeroRoundCorrente >= Gioco.numeroRoundTotale;
  aggiornaSchedeGiocatori();
  if (Gioco.ultimoRoundFinito) btnRoundSuccessivo.textContent = "Vedi la classifica finale";
  else btnRoundSuccessivo.textContent = Lampo.dovuto(Gioco.numeroRoundCorrente) ? "Round lampo · tutti pronti" : "Prossimo giorno · comincia " + Gioco.giocatori[Gioco.indiceProssimoRound].nome + ", che è l’ultimo";
  Gioco.stato = "fine_round";
  pannelloFineRound.classList.remove("nascosta");
  aggiornaComandi();
}
// Ogni mattina parte per primo l'ultimo (la pedina piu` indietro; a pari caselle, chi viene prima nell'ordine dei turni); a squadre, l'ultima
// squadra, e dentro la squadra il componente a cui toccherebbe (g.mano). Si calcola quando il giorno si apre, dopo l'eventuale lampo.
function indiceDelPrimoDomani() { return indiceDi(Percorso.ultimo(Gioco)); }

// Chi tocca il traguardo vince subito, anche a meta' giorno e a round non finiti.
function vittoriaDiTraguardo(g) {
  Gioco.stato = "fine_round";
  fermaTimerAutoscoperta();
  fermaTimerSoluzione();
  Gioco.consonantiFiniteAvvisate = true;
  Gioco.vocaliFiniteAvvisate = true;
  Gioco.dopoFesta = null;
  Gioco.storicoRound.push({ numero: Gioco.numeroRoundCorrente, vincitoreNome: g.nome, vincitoreColore: g.colore });
  Gioco.ultimoRoundFinito = true;
  btnRoundSuccessivo.textContent = "Vedi la classifica finale";
  Audio_.musicaProssimoRound();
  nascondiTuttiIPannelli();
  aggiornaSchedeGiocatori();
  pannelloFineRound.classList.remove("nascosta");
  mostraFestaPercorso(g, 0, "", true);
  aggiornaComandi();
}
// Il traguardo toccato dal round lampo: nessun round da aprire, si va alla classifica finale (lampo.js).
function traguardoDalLampo(g) {
  Gioco.traguardo = g;
  vittoriaDiTraguardo(g);
}

// ---- il Castello del lampo --------------------------------------------------------------------------------------------
// Le caselle libere davanti alla pedina di chi ha vinto il lampo (percorso.js, caselleLibere).
function caselleLibereDelPercorso(g) { return Percorso.caselleLibere(Gioco, g); }
function piazzaPedaggio(g, pos) {
  Percorso.piazzaCastello(Gioco, g, pos);
  PercorsoVista.castelloPiazzato(pos, indiceDi(g));
  aggiornaSchedeGiocatori();
}

// ---- la fine ------------------------------------------------------------------------------------------------------------
function mostraFinalePercorso() {
  finaleClassificaEl.classList.remove("nascosta");
  palcoFinaleEl.classList.add("nascosta");
  const classificati = classificaPercorso();
  const vincitore = classificati[0];
  const toccato = vincitore.pedina >= Gioco.caselle;
  Audio_.jingleFinale();
  const scheda = document.getElementById("scheda-finale-vincitore");
  scheda.classList.add("percorso");
  scheda.classList.toggle("traguardo", toccato);
  scriviIniziale(finaleVincitoreImmagineEl, vincitore);
  finaleVincitoreImmagineEl.style.outlineColor = vincitore.colore;
  finaleVincitoreNomeEl.textContent = vincitore.nome;
  finaleVincitoreNomeEl.style.color = vincitore.colore;
  finaleVincitoreCifraEl.textContent = toccato ? "Traguardo!" : "al " + vincitore.pedina;
  document.getElementById("finale-unita").textContent = "";
  document.getElementById("finale-sotto").textContent = toccato ? "" : "su " + Gioco.caselle + " caselle";
  finaleClassificaEl.innerHTML = "";
  classificati.forEach((giocatore, i) => {
    const riga = document.createElement("div");
    riga.className = "riga-classifica-finale";
    riga.style.borderLeftColor = giocatore.colore;
    riga.textContent = `${i + 1}. ${giocatore.nome} — ${doveEPercorso(giocatore)}`;
    finaleClassificaEl.appendChild(riga);
  });
  const premioCasaEl2 = document.getElementById("finale-premio-casa");
  const premioCasaTestoEl = document.getElementById("finale-premio-testo");
  if (premioCasaEl2 && premioCasaTestoEl) {
    const testo = Gioco.premioCasa || "";
    premioCasaTestoEl.textContent = testo;
    premioCasaEl2.classList.toggle("nascosta", !testo);
  }
  avviaFuochiFinale();
}

// ---- il pannello di controllo del regista (regolamento §12) ------------------------------------------------------------------
// I numeri non sono decisi: il regista li regola giocando, da qui, SOLO fra una partita e l'altra (il pulsante sta nell'iscrizione
// del Percorso, non in partita). Lo strumento e` suo, non dei giocatori: basta che sia chiaro. I valori restano fra una sera e l'altra
// (localStorage). La lunghezza del sentiero e` il primo numero; i bivacchi la seguono da soli.
const PercorsoRegole = (() => {
  const finestra = document.getElementById("finestra-regole-percorso");
  const campi = document.getElementById("campi-regole-percorso");
  const btnApri = document.getElementById("btn-regole-percorso");
  const btnChiudi = document.getElementById("btn-chiudi-regole");
  const btnPartenza = document.getElementById("btn-regole-di-partenza");
  if (!finestra || !campi || !btnApri) return {};
  const ordine = ["caselle", "oreTempo", "oreInPiuPrimoGiorno", "preavviso", "oreTramonto", "scorciatoie", "scatolaForza", "scatolaDistanza"];
  const unita = { caselle: "pietre", oreTempo: "ore", oreInPiuPrimoGiorno: "ore", preavviso: "ore", oreTramonto: "giri", scorciatoie: "", scatolaForza: "", scatolaDistanza: "caselle" };

  function disegna() {
    const valori = Percorso.leggiRegole();
    campi.innerHTML = "";
    const nota = document.createElement("p");
    nota.className = "nota-regole";
    nota.textContent = "Il sentiero è uno solo e si accorcia o si allunga qui: i due bivacchi si mettono da soli a un terzo e a due terzi. La lunghezza cambia alla prossima partita.";
    campi.appendChild(nota);
    ordine.forEach((k) => {
      const lim = PERCORSO_REGOLE_LIMITI[k];
      const riga = document.createElement("label");
      riga.className = "campo-regola";
      riga.innerHTML = `<span class="nome-regola">${lim[2]}</span>`;
      const input = document.createElement("input");
      input.type = "number";
      input.id = "regola-" + k;
      input.min = String(lim[0]);
      input.max = String(lim[1]);
      input.step = "1";
      input.value = String(valori[k]);
      input.addEventListener("input", () => {
        const v = Percorso.leggiRegole();
        v[k] = Number(input.value);
        Percorso.salvaRegole(v);
      });
      input.addEventListener("change", () => { input.value = String(Percorso.leggiRegole()[k]); }); // fuori scala: torna a posto
      riga.appendChild(input);
      const u = document.createElement("span");
      u.className = "unita-regola";
      u.textContent = unita[k];
      riga.appendChild(u);
      campi.appendChild(riga);
    });
  }
  function apri() { disegna(); finestra.classList.remove("nascosta"); }
  function chiudi() {
    finestra.classList.add("nascosta");
    if (PercorsoVista.impostaLunghezza(Percorso.leggiRegole().caselle)) PercorsoVista.rinfrescaIscrizione(); // il paesaggio si rifa' con la lunghezza nuova
  }
  btnApri.addEventListener("click", apri);
  btnChiudi.addEventListener("click", chiudi);
  btnPartenza.addEventListener("click", () => { Percorso.salvaRegole(PERCORSO_REGOLE_DI_PARTENZA); disegna(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !finestra.classList.contains("nascosta")) chiudi(); });
  return { apri, chiudi, disegna };
})();

// ---- la carta «Percorso» nella scelta della partita (R16) ----------------------------------------------------------------------------
// Al posto della mini-corsia, un pezzo di sentiero: sette pietre in leggera curva (la lastra del paesaggio, scala 0,9), la terza blu (la pietra
// d'ingresso) con il Viandante sopra, il suo fantasma tratteggiato sulla sesta, e la bandiera a scacchi dopo l'ultima. Un svg 300 x 70 disegnato
// qui con MEEPLE[0].sagoma: le `defs` del paesaggio non ci sono ancora, la sagoma si copia dentro l'svg della carta.
(function disegnaCartaPercorso() {
  const scena = document.querySelector(".scena-percorso");
  if (!scena || scena.querySelector("svg")) return;
  const NS = "http://www.w3.org/2000/svg";
  const LASTRA_ = "M-15,-3 C-14,-10 -6,-13 2,-12 C10,-11 16,-7 15,0 C14,7 8,11 0,11 C-8,11 -16,6 -15,-3 Z";
  const m = MEEPLE[0];
  const xs = [0, 1, 2, 3, 4, 5, 6].map((k) => 24 + k * 38);
  const ys = [0, 1, 2, 3, 4, 5, 6].map((k) => 52 - Math.sin((k / 6) * Math.PI) * 9); // una leggera curva in salita e discesa
  let pietre = "";
  xs.forEach((x, k) => {
    const blu = k === 2;
    pietre += `<g transform="translate(${x} ${ys[k]}) scale(${blu ? 1.05 : 0.9})"><path d="${LASTRA_}" fill="${blu ? "#4C6FD9" : "#CBBFA6"}" stroke="${blu ? "#fff" : "#7D715E"}" stroke-width="${blu ? 2 : 1.6}"/><path d="M-9,-6 C-5,-9 3,-9 7,-6" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2" stroke-linecap="round"/></g>`;
  });
  const figura = (x, y, sc, fantasma) => {
    const tr = `translate(${x - 24 * sc} ${y - 64 * sc}) scale(${sc})`;
    if (fantasma) return `<g transform="${tr}" opacity="0.55"><use href="#mp-carta" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="4 3" stroke-linejoin="round"/><use href="#mp-carta" fill="${m.colore}" opacity="0.75"/></g>`;
    return `<g transform="${tr}"><use href="#mp-carta" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><use href="#mp-carta" fill="${m.colore}"/><text x="24" y="49" text-anchor="middle" dominant-baseline="central" font-family="inherit" font-weight="800" font-size="15" fill="#fff" stroke="rgba(0,0,0,0.35)" stroke-width="2.5" paint-order="stroke">M</text></g>`;
  };
  const xb = xs[6] + 26, yb = ys[6] + 4;
  const bandiera = `<g transform="translate(${xb} ${yb})"><line x1="0" y1="0" x2="0" y2="-34" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><rect x="0.6" y="-34" width="18" height="13" rx="1" fill="url(#scacchi-carta)" stroke="#fff" stroke-width="1.2"/></g>`;
  scena.innerHTML = `<svg viewBox="0 0 320 70" xmlns="${NS}" aria-hidden="true" focusable="false">
    <defs><g id="mp-carta">${m.sagoma}</g>
      <pattern id="scacchi-carta" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#111"/><rect x="3" y="3" width="3" height="3" fill="#111"/><rect x="3" width="3" height="3" fill="#fff"/><rect y="3" width="3" height="3" fill="#fff"/></pattern></defs>
    <path d="M${xs[0]} ${ys[0]} ${xs.slice(1).map((x, k) => `L${x} ${ys[k + 1]}`).join(" ")}" fill="none" stroke="#9C7A52" stroke-opacity="0.8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    ${pietre}${figura(xs[5], ys[5] + 2, 0.42, true)}${figura(xs[2], ys[2] + 2, 0.5, false)}${bandiera}</svg>`;
})();
