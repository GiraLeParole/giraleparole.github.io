// ============================================================================
// ROUND LAMPO — giro B, voce B1 (05/10/2026).
// Disegno di Chiara: design/2026-09-29-scheda-otto-idee.md, «B1. Il round
// lampo». Le modifiche di Damiano dello stesso giorno, dove contraddicono la
// scheda, vincono:
//   - non c'e` un tasto per giocatore: QUALUNQUE tasto della tastiera, o un
//     tocco/clic in un punto qualunque dello schermo, ferma le lettere;
//   - subito dopo chi fa da arbitro tocca la tessera di chi ha toccato per
//     primo, e quella persona risponde (a squadre, la tessera della squadra);
//   - 15 secondi per rispondere (LAMPO_SECONDI), contati dal tocco sulla
//     tessera e non da quello che ferma le lettere;
//   - quando appare: LAMPO_QUANDO (config.js).
// Niente suono: la scheda non lo prevede.
// Si carica DOPO gioco.js: usa Gioco, Annuncio, disegnaTabellone ecc., che
// vivono li`, e gioco.js usa Lampo solo quando si clicca (mai al caricamento).
//
// Le fasi, una dopo l'altra:
//   annuncio  «Round lampo!», le lettere non sono ancora partite: i tocchi non contano
//   lettere   una lettera ogni LAMPO_INTERVALLO_MS: qui un tocco/tasto ferma tutto
//   scelta    ferme: l'arbitro tocca la tessera di chi ha toccato per primo
//   risposta  chi e` stato scelto scrive la frase, LAMPO_SECONDI secondi
//   esito     «Non è questa» (risposta sbagliata) / «Tempo scaduto» (15 s senza
//             inviare) / il nome di chi ha indovinato / «Nessuno!»
// I testi dell'annuncio e del bottone sono di Penna (05/10/2026): da rivedere
// quando Damiano prova il gioco.
// ============================================================================

const Lampo = (() => {
  const areaPartitaEl = document.querySelector(".area-partita");
  const pannelloLampoEl = document.getElementById("pannello-lampo");
  const lampoChiEl = document.getElementById("lampo-chi");
  const formLampoEl = document.getElementById("form-lampo");
  const inputLampoEl = document.getElementById("input-lampo");
  const secondiLampoEl = document.getElementById("secondi-lampo");
  const riempimentoEl = pannelloLampoEl.querySelector(".riempimento");

  let fase = null;            // null = nessun lampo in corso
  let ordine = [];            // posizioni delle lettere, nell'ordine in cui si accendono
  let fuori = new Set();      // chi ha sbagliato: non si prenota piu` in questo lampo
  let scelto = null;          // indice di chi sta rispondendo
  let alFine = null;          // chiamata a fine lampo con l'indice di chi apre il round
  let timerLettere = null;
  let timerRisposta = null;
  let timerConto = null;
  let scadenza = 0;

  // ---- quando ---------------------------------------------------------------

  // Estrae, a inizio partita, dopo la fine di quali round c'e` il lampo.
  function pianifica() {
    Gioco.lampoDopo = new Set();
    if (!Gioco.lampoAttivo) return;
    const regola = LAMPO_QUANDO[Gioco.numeroRoundTotale];
    if (!regola) return;
    // quanti: un numero, oppure [min, max] estratto a caso a ogni partita
    const q = Array.isArray(regola.quanti)
      ? regola.quanti[0] + Math.floor(Math.random() * (regola.quanti[1] - regola.quanti[0] + 1))
      : regola.quanti;
    mescola(regola.dopo).slice(0, q).forEach((n) => Gioco.lampoDopo.add(n));
  }

  // C'e` il lampo fra il round che e` appena finito (numero) e il prossimo?
  function dovuto(numeroRoundFinito) {
    return !!Gioco.lampoAttivo && Gioco.lampoDopo.has(numeroRoundFinito);
  }

  // ---- la frase -------------------------------------------------------------

  const contaLettere = (testo) => [...testo].filter(eLettera).length;

  // Una frase breve che non sia gia` uscita in questa partita, e di una
  // categoria che in questa partita non e` ancora uscita (stessa regola dei
  // round, Damiano 05/10/2026: vedi scegliFraseDellaPartita in gioco.js, che
  // la toglie anche dal mazzo, cosi` non torna in un round vero). Se fra le
  // brevi non ce n'e` nessuna, ripiega su una qualunque, con la stessa regola.
  function scegliFrase() {
    const breve = (f) => contaLettere(f.testo) <= LAMPO_MAX_LETTERE;
    return scegliFraseDellaPartita(breve) || prossimaFrase();
  }

  // ---- le tessere -----------------------------------------------------------

  // aggiornaSchedeGiocatori() ricostruisce la fila da zero: dopo ogni suo
  // giro le classi del lampo si rimettono qui, dalla fase e da chi e` fuori.
  function segnaTessere() {
    [...colonnaGiocatoriEl.children].forEach((t, i) => {
      t.classList.toggle("fuori", fuori.has(i));
      t.classList.toggle("prenotato", scelto === i);
    });
    areaPartitaEl.classList.toggle("lampo-scelta", fase === "scelta");
  }

  function indiceDiTessera(el) {
    const t = el.closest && el.closest(".scheda-giocatore");
    return t && colonnaGiocatoriEl.contains(t) ? [...colonnaGiocatoriEl.children].indexOf(t) : -1;
  }

  // ---- avvio ----------------------------------------------------------------

  function avvia(chiApreDopo) {
    alFine = chiApreDopo;
    fuori = new Set();
    scelto = null;
    fase = "annuncio";
    fermaTimerAutoscoperta();
    chiudiFestaVittoria();
    nascondiTuttiIPannelli();
    pannelloLampoEl.classList.add("nascosta");

    Gioco.fraseCorrente = scegliFrase();
    Gioco.posizioniRivelate = new Set();
    Gioco.posizioniAccese = new Set();
    Gioco.lettereUsate = new Set();
    Gioco.stato = "lampo";
    categoriaEl.textContent = testoTarga(Gioco.fraseCorrente); // come nei round: l'indizio

    areaPartitaEl.classList.add("lampo");
    aggiornaSchedeGiocatori();
    segnaTessere();
    disegnaTabellone(true);
    Annuncio.mostra({
      stile: "scena oro",
      titolo: "Round lampo!",
      sotto: "chi la sa, tocca lo schermo o un tasto", // testo di Penna, da rivedere
      durata: DURATA_ANNUNCIO_LAMPO_MS,
    });

    ordine = [];
    [...Gioco.fraseCorrente.testo].forEach((c, i) => { if (eLettera(c)) ordine.push(i); });
    ordine = mescola(ordine);
    timerLettere = setTimeout(prossimaLettera, DURATA_ANNUNCIO_LAMPO_MS + 400);
  }

  // ---- le lettere -----------------------------------------------------------

  function prossimaLettera() {
    fase = "lettere";
    if (!ordine.length) { nessuno(); return; }
    const idx = ordine.shift();
    Gioco.posizioniRivelate.add(idx);
    disegnaTabellone();
    // la casella appena accesa salta: e` la n-esima non vuota del tabellone,
    // dove n = i caratteri non-spazio che la precedono nel testo
    const posizione = [...Gioco.fraseCorrente.testo].slice(0, idx).filter((c) => c !== " ").length;
    const celle = tabelloneEl.querySelectorAll(".cella-tabellone:not(.vuota)");
    if (celle[posizione]) celle[posizione].classList.add("lampo-accesa");
    timerLettere = setTimeout(prossimaLettera, LAMPO_INTERVALLO_MS);
  }

  // ---- ci si prenota: un tocco o un tasto qualunque, poi l'arbitro ------------

  // Un tocco (o un tasto) ferma le lettere. Il gioco non sa chi e` stato: lo
  // sa chi guarda, e lo dice toccando la tessera.
  function fermaLeLettere() {
    if (fase !== "lettere") return;
    clearTimeout(timerLettere);
    fase = "scelta";
    segnaTessere();
    Annuncio.mostra({
      stile: "scena",
      titolo: "Chi è stato il primo?", // testo di Penna, da rivedere
      sotto: "tocca la sua tessera",
    });
  }

  function suPuntatore(ev) {
    if (fase === "lettere") {
      fermaLeLettere();
    } else if (fase === "scelta") {
      const i = indiceDiTessera(ev.target);
      if (i < 0 || fuori.has(i)) return;
      // senza questo, il pulsante premuto riprende il fuoco dopo che la
      // casella di scrittura l'ha preso, e chi risponde deve ritoccarla
      ev.preventDefault();
      prenota(i);
    }
  }

  function suTasto(ev) {
    if (fase !== "lettere" || ev.repeat) return;
    // un modificatore da solo, o una scorciatoia del browser (Ctrl+R...), non e` «un tasto»
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (["Shift", "Control", "Alt", "AltGraph", "Meta", "CapsLock", "NumLock", "ScrollLock", "Fn", "OS"].includes(ev.key)) return;
    if (ev.key === " ") ev.preventDefault(); // niente pagina che scorre sui telefoni
    fermaLeLettere();
  }

  document.addEventListener("pointerdown", suPuntatore);
  document.addEventListener("keydown", suTasto);

  // ---- risponde chi e` stato scelto -------------------------------------------

  function prenota(i) {
    fase = "risposta";
    scelto = i;
    segnaTessere();
    Annuncio.nascondi();
    // a squadre scrive chi ha la mano, non la squadra intera
    lampoChiEl.textContent = chiTocca(Gioco.giocatori[i]).nome;
    inputLampoEl.value = "";
    pannelloLampoEl.classList.remove("nascosta");
    // la barra riparte da piena: togliere l'animazione e rimetterla
    riempimentoEl.style.animation = "none";
    void riempimentoEl.offsetWidth;
    riempimentoEl.style.animation = "";
    riempimentoEl.style.animationDuration = LAMPO_SECONDI + "s";

    scadenza = Date.now() + LAMPO_SECONDI * 1000;
    const aggiornaConto = () => {
      secondiLampoEl.textContent = String(Math.max(0, Math.ceil((scadenza - Date.now()) / 1000)));
    };
    aggiornaConto();
    timerConto = setInterval(aggiornaConto, 200);
    timerRisposta = setTimeout(() => sbagliato(true), LAMPO_SECONDI * 1000);
    // Il pannello sta nascosto finche` l'annuncio «Chi è stato il primo?» non ha finito di
    // uscire (220 ms, vedi Annuncio.nascondi): un campo nascosto non prende il
    // fuoco, e chi risponde dovrebbe toccarlo prima di scrivere. Provato con
    // un tocco vero: senza l'attesa il fuoco resta sul corpo della pagina.
    setTimeout(() => { if (fase === "risposta" && scelto === i) inputLampoEl.focus(); }, 300);
  }

  function fermaTimerRisposta() {
    clearTimeout(timerRisposta); timerRisposta = null;
    clearInterval(timerConto); timerConto = null;
  }

  formLampoEl.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (fase !== "risposta") return;
    const tentativo = normalizzaTesto(inputLampoEl.value);
    if (tentativo.length > 0 && tentativo === normalizzaTesto(Gioco.fraseCorrente.testo)) giusto();
    else sbagliato();
  });

  // ---- gli esiti --------------------------------------------------------------

  // Sbagliata, o scaduto il tempo (scaduto = true): chi ha risposto e` fuori
  // da questo lampo e le lettere riprendono. A tempo scaduto l'annuncio dice
  // «Tempo scaduto» come nei round, anche se qualcosa era stato scritto.
  function sbagliato(scaduto) {
    fermaTimerRisposta();
    fase = "esito";
    pannelloLampoEl.classList.add("nascosta");
    const nomeFuori = Gioco.giocatori[scelto].nome; // a squadre: la squadra, come sulla tessera
    fuori.add(scelto);
    scelto = null;
    segnaTessere();
    // se sono tutti fuori nessuno puo` piu` rispondere: inutile far girare le lettere
    const tuttiFuori = fuori.size >= Gioco.giocatori.length;
    Annuncio.mostra({
      stile: "no",
      lettera: "✕",
      titolo: scaduto ? "Tempo scaduto" : "Non è questa",
      // «le lettere continuano» solo se e` vero: con tutti fuori segue «Nessuno!»
      sotto: nomeFuori + (tuttiFuori ? " è fuori" : " è fuori, le lettere continuano"), // testo di Penna, da rivedere
      durata: DURATA_ANNUNCIO_MS,
    });
    timerLettere = setTimeout(tuttiFuori ? nessuno : prossimaLettera, DURATA_ANNUNCIO_MS + 200);
  }

  function giusto() {
    fermaTimerRisposta();
    fase = "esito";
    pannelloLampoEl.classList.add("nascosta");
    const i = scelto;
    const g = Gioco.giocatori[i];
    g.soldiTotale += LAMPO_PREMIO;
    Gioco.posizioniRivelate = new Set([...Gioco.fraseCorrente.testo].map((_, k) => k));
    disegnaTabellone();
    aggiornaSchedeGiocatori();
    segnaTessere();
    Annuncio.mostra({
      stile: "scena oro",
      titolo: g.nome + "!",
      sotto: "+" + euro(LAMPO_PREMIO) + " · apre il round " + (Gioco.numeroRoundCorrente + 1),
      durata: DURATA_ANNUNCIO_LAMPO_MS,
    });
    timerLettere = setTimeout(() => fine(i), DURATA_ANNUNCIO_LAMPO_MS + 200);
  }

  // Lettere finite senza che nessuno abbia indovinato, o tutti fuori: la frase
  // si mostra intera, e il round lo apre chi lo avrebbe aperto comunque.
  function nessuno() {
    fase = "esito";
    pannelloLampoEl.classList.add("nascosta");
    scelto = null;
    Gioco.posizioniRivelate = new Set([...Gioco.fraseCorrente.testo].map((_, k) => k));
    disegnaTabellone();
    segnaTessere();
    const chiApre = Gioco.indiceProssimoRound;
    Annuncio.mostra({
      stile: "scena",
      titolo: "Nessuno!",
      sotto: "apre " + Gioco.giocatori[chiApre].nome,
      durata: DURATA_ANNUNCIO_LAMPO_MS,
    });
    timerLettere = setTimeout(() => fine(chiApre), DURATA_ANNUNCIO_LAMPO_MS + 200);
  }

  function fine(chiApre) {
    fase = null;
    fermaTimerRisposta();
    clearTimeout(timerLettere);
    areaPartitaEl.classList.remove("lampo", "lampo-scelta");
    [...colonnaGiocatoriEl.children].forEach((t) => t.classList.remove("prenotato", "fuori"));
    Gioco.stato = "idle";
    const vaAvanti = alFine;
    alFine = null;
    if (vaAvanti) vaAvanti(chiApre);
  }

  return { pianifica, dovuto, avvia };
})();
