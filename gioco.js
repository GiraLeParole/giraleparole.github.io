// ============================================================================
// GIOCO — stato e logica di "Gira le Parole" (versione di casa).
// Vanilla JS, nessuna libreria, nessuna chiamata di rete.
// ============================================================================

const VOCALI = ["A", "E", "I", "O", "U"];
const CONSONANTI = ["B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z"];

// Toglie accenti e porta in maiuscolo — stessa idea "provata sul prodotto reale"
// vista nel sito di riferimento (toUpperCase + normalize NFD + strip diacritici).
// Usata sia per confrontare le lettere sia per tollerare maiuscole/accenti
// nella soluzione finale.
function normalizzaLettera(carattere) {
  return carattere.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizzaTesto(testo) {
  return testo
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, "") // via apostrofi/punteggiatura: si confronta il contenuto, non la forma
    .replace(/\s+/g, " ")
    .trim();
}

function eLettera(carattere) {
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(carattere);
}

// Undicesimo giro, voce 7 (28/09/2026): il punto delle migliaia sempre,
// anche sotto le cinque cifre — toLocaleString("it-IT") non raggruppa "4500"
// (provato: l'opzione minimumGroupingDigits non e` onorata), e "4500 €"
// accanto a "23.000 €" in una fila di tessere stona. formattaMigliaia() da`
// solo il numero (per i posti dove il simbolo € e` un elemento a parte,
// colorato diversamente); euro() da` la stringa intera.
const formattaMigliaia = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const euro = (n) => formattaMigliaia(n) + " €";

// ----------------------------------------------------------------------------
// TABELLONE — griglia fissa (nono giro, punto 45, 28/09/2026)
// ----------------------------------------------------------------------------
// Distribuisce le parole di una frase sulle righe del tabellone (config.js,
// RIGHE_TABELLONE), senza mai spezzare una parola. Algoritmo goloso, una
// parola alla volta, mai tornare indietro: se la parola non entra nello
// spazio ancora libero della riga corrente, si chiude la riga e si passa
// alla successiva. La capacita` di una riga e` in caratteri, spazio
// compreso (uno spazio prima di ogni parola tranne la prima della riga).
//
// Restituisce un array lungo quanto RIGHE_TABELLONE: ogni elemento e` la
// lista delle parole di quella riga, ciascuna con l'indice del suo primo
// carattere nel testo ORIGINALE (spazi compresi) — lo stesso schema di
// indicizzazione gia` usato altrove nel file da Gioco.posizioniRivelate e
// Gioco.posizioniAccese (un contatore che avanza di 1 anche sullo spazio fra
// due parole, vedi il vecchio disegnaTabellone prima di questo giro).
//
// Le 325 frasi di frasi.js sono state verificate una per una contro
// RIGHE_TABELLONE con uno script a parte (zero fallite, vedi rapporto di
// consegna): se in futuro una frase nuova non entrasse comunque, le parole
// in eccesso finiscono compresse nell'ultima riga invece di far fallire il
// disegno — degradazione visibile, mai un crash.
function distribuisciParoleInRighe(testo, righe) {
  const parole = testo.split(" ");
  const distribuzione = righe.map(() => []);
  let rigaIdx = 0;
  let usato = 0;
  let cursoreGlobale = 0;

  parole.forEach((parola) => {
    const cePreDaRiga = distribuzione[rigaIdx].length > 0;
    const necessario = parola.length + (cePreDaRiga ? 1 : 0);
    if (usato + necessario > righe[rigaIdx] && rigaIdx < righe.length - 1) {
      rigaIdx++;
      usato = 0;
    }
    if (distribuzione[rigaIdx].length > 0) usato += 1; // lo spazio prima della parola
    distribuzione[rigaIdx].push({ parola, idx: cursoreGlobale });
    usato += parola.length;
    cursoreGlobale += parola.length + 1; // +1 = lo spazio dopo (anche sull'ultima parola, innocuo)
  });

  return distribuzione;
}

// Larghezza FISICA del tabellone, in caselle: sempre quella della riga piu`
// larga, uguale su ogni riga del disegno (le righe piu` strette restano
// dentro lo stesso riquadro, solo con qualche casella spenta in piu` ai
// lati) — vedi il commento su RIGHE_TABELLONE in config.js.
const LARGHEZZA_FISICA_TABELLONE = Math.max(...RIGHE_TABELLONE);

// ----------------------------------------------------------------------------
// STATO DI GIOCO
// ----------------------------------------------------------------------------

const Gioco = {
  giocatori: [],           // { nome, colore, soldiRound, soldiTotale, jolly }
  indiceCorrente: 0,
  frasiRimaste: [],        // coda mescolata delle frasi non ancora usate in questa partita
  fraseCorrente: null,     // { testo, categoria }
  posizioniRivelate: new Set(),
  // Terzo giro, punto 16: lettere gia` trovate ma non ancora "scoperte" col
  // click del giocatore — accese sul tabellone, in attesa di un tocco.
  posizioniAccese: new Set(),
  lettereUsate: new Set(), // lettere gia tentate/comprate in questo round
  stato: "idle",           // idle | girando | scegli_consonante | scegli_vocale | attesa_jolly | risolvendo | rivelando | fine_round
  timerSoluzione: null,
  timerAutoscoperta: null,
  // Punto 33 (28/09/2026): se il "consonanti/vocali finite" di QUESTO round
  // e` gia` stato annunciato col messaggio grande (punto 37) — evita di
  // ripeterlo ad ogni aggiornaComandi() finché resta vero.
  consonantiFiniteAvvisate: false,
  vocaliFiniteAvvisate: false,
  // Punto 38/39 (28/09/2026, seconda dettatura): quanti round dura la
  // partita, a che round siamo, e chi ha vinto ogni round gia` finito.
  numeroRoundTotale: NUMERO_ROUND_DI_DEFAULT,
  numeroRoundCorrente: 1,
  storicoRound: [],       // [{ numero, vincitoreNome, vincitoreColore }]
  ultimoRoundFinito: false,
  // Decimo giro, punto 53 (28/09/2026): il jolly e` uno spicchio intero
  // (Ruota.impostaJollyDisponibile), non piu` una carta — si puo` prendere
  // una sola volta per round. Azzerato in nuovoRound().
  jollyPresoInQuestoRound: false,
  spicchioIndice: null, // l'indice dello spicchio su cui si e` fermata l'ultima girata
};

function mescola(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Voce D, tredicesimo giro (29/09/2026, punto 64): con che frasi si gioca
// stasera. Chiave di localStorage come quelle del volume — si ricorda da una
// partita all'altra sullo stesso browser.
const CHIAVE_GRUPPI = "giraleparole-gruppi";

function leggiGruppiSalvati() {
  try {
    const v = JSON.parse(window.localStorage.getItem(CHIAVE_GRUPPI));
    const ok = Array.isArray(v) ? v.filter((g) => GRUPPI_FRASI.some((x) => x.valore === g)) : [];
    return ok.length ? ok : GRUPPI_DI_DEFAULT.slice();
  } catch (e) {
    return GRUPPI_DI_DEFAULT.slice();
  }
}
let gruppiScelti = new Set(leggiGruppiSalvati());

// L'unione delle frasi di FRASI che hanno almeno uno dei gruppi accesi. Se
// FRASI non ha il campo `gruppi` (frasi.js, non piu` caricato ma per
// sicurezza) la lista risulterebbe vuota: si usa allora FRASI intera, cosi`
// il gioco non resta senza frasi da pescare.
function frasiDeiGruppi() {
  const filtrate = FRASI.filter((f) => (f.gruppi || []).some((g) => gruppiScelti.has(g)));
  return filtrate.length ? filtrate : FRASI;
}

const opzioniGruppiEl = document.getElementById("opzioni-gruppi");
const contaFraseEl = document.getElementById("conta-frasi");

function disegnaGruppi() {
  opzioniGruppiEl.innerHTML = "";
  GRUPPI_FRASI.forEach((g) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opzione-gruppo" + (gruppiScelti.has(g.valore) ? " selezionata" : "");
    b.setAttribute("aria-pressed", gruppiScelti.has(g.valore) ? "true" : "false");
    b.textContent = g.nome;
    b.addEventListener("click", () => {
      if (gruppiScelti.has(g.valore)) {
        if (gruppiScelti.size === 1) {
          // l'ultimo gruppo acceso non si spegne: scuote la testa ("no")
          b.classList.remove("no");
          void b.offsetWidth;
          b.classList.add("no");
          return;
        }
        gruppiScelti.delete(g.valore);
      } else {
        gruppiScelti.add(g.valore);
      }
      try {
        window.localStorage.setItem(CHIAVE_GRUPPI, JSON.stringify([...gruppiScelti]));
      } catch (e) {}
      disegnaGruppi();
    });
    opzioniGruppiEl.appendChild(b);
  });
  contaFraseEl.textContent = frasiDeiGruppi().length + " frasi";
}
disegnaGruppi();

function prossimaFrase() {
  if (Gioco.frasiRimaste.length === 0) {
    Gioco.frasiRimaste = mescola(frasiDeiGruppi());
  }
  return Gioco.frasiRimaste.pop();
}

// ----------------------------------------------------------------------------
// SCHERMATA 1 — ISCRIZIONE GIOCATORI
// ----------------------------------------------------------------------------

const listaGiocatoriEl = document.getElementById("lista-giocatori");
const btnAggiungiGiocatore = document.getElementById("btn-aggiungi-giocatore");
const btnIniziaPartita = document.getElementById("btn-inizia-partita");
const erroreIscrizioneEl = document.getElementById("errore-iscrizione");

// Undicesimo giro, punto 58, strada B (28/09/2026, scelta di Damiano: "la
// tessera con l'iniziale, moooolto carina"): la prima lettera del nome,
// maiuscola — niente da scegliere, niente disegnino, niente pannello a
// parte. "?" finche` il nome e` vuoto (stesso segnaposto di prima).
function inizialeDiNome(nome) {
  const car = (nome || "").trim().charAt(0);
  return car ? car.toUpperCase() : "?";
}

function rigaGiocatoreHtml(indice, nomeIniziale) {
  const div = document.createElement("div");
  div.className = "riga-giocatore";
  div.dataset.indice = String(indice);

  // La tessera bianca con l'iniziale e l'anello del colore del giocatore —
  // si aggiorna da sola mentre si scrive il nome (vedi l'ascoltatore
  // sull'input qui sotto), niente da cliccare o scegliere.
  const tessera = document.createElement("div");
  tessera.className = "tessera-iniziale-iscrizione";
  tessera.setAttribute("aria-hidden", "true");
  tessera.style.outlineColor = COLORI_GIOCATORI[indice];
  tessera.textContent = inizialeDiNome(nomeIniziale);

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 16;
  input.placeholder = `Giocatore ${indice + 1}`;
  input.value = nomeIniziale || "";
  input.addEventListener("input", () => {
    tessera.textContent = inizialeDiNome(input.value);
  });

  const btnRimuovi = document.createElement("button");
  btnRimuovi.type = "button";
  btnRimuovi.className = "btn-rimuovi";
  btnRimuovi.textContent = "✕";
  btnRimuovi.setAttribute("aria-label", "Rimuovi giocatore");
  btnRimuovi.addEventListener("click", () => {
    if (listaGiocatoriEl.children.length <= 1) return;
    div.remove();
    rinumeraRigheIscrizione();
  });

  div.appendChild(tessera);
  div.appendChild(input);
  div.appendChild(btnRimuovi);
  return div;
}

function rinumeraRigheIscrizione() {
  [...listaGiocatoriEl.children].forEach((riga, i) => {
    riga.dataset.indice = String(i);
    riga.querySelector(".tessera-iniziale-iscrizione").style.outlineColor = COLORI_GIOCATORI[i];
    riga.querySelector("input").placeholder = `Giocatore ${i + 1}`;
  });
  btnAggiungiGiocatore.disabled = listaGiocatoriEl.children.length >= 4;
}

btnAggiungiGiocatore.addEventListener("click", () => {
  if (listaGiocatoriEl.children.length >= 4) return;
  const indice = listaGiocatoriEl.children.length;
  listaGiocatoriEl.appendChild(rigaGiocatoreHtml(indice));
  rinumeraRigheIscrizione();
});

// due giocatori di partenza, comodo per il caso piu comune
listaGiocatoriEl.appendChild(rigaGiocatoreHtml(0));
listaGiocatoriEl.appendChild(rigaGiocatoreHtml(1));
rinumeraRigheIscrizione();

// ---- SCELTA DEL NUMERO DI ROUND (punto 38, 28/09/2026, seconda dettatura) --

const opzioniRoundEl = document.getElementById("opzioni-round");
let numeroRoundScelto = NUMERO_ROUND_DI_DEFAULT;

function costruisciOpzioniRound() {
  opzioniRoundEl.innerHTML = "";
  OPZIONI_NUMERO_ROUND.forEach((n) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "opzione-round" + (n === numeroRoundScelto ? " selezionata" : "");
    btn.textContent = n === NUMERO_ROUND_DI_DEFAULT ? `${n} (partita completa)` : String(n);
    btn.addEventListener("click", () => {
      numeroRoundScelto = n;
      [...opzioniRoundEl.children].forEach((b) => b.classList.remove("selezionata"));
      btn.classList.add("selezionata");
    });
    opzioniRoundEl.appendChild(btn);
  });
}
costruisciOpzioniRound();

btnIniziaPartita.addEventListener("click", () => {
  const righe = [...listaGiocatoriEl.children];
  if (righe.length < 1) {
    erroreIscrizioneEl.textContent = "Serve almeno un giocatore.";
    return;
  }
  Gioco.giocatori = righe.map((riga, i) => {
    const input = riga.querySelector("input");
    const nome = input.value.trim() || `Giocatore ${i + 1}`;
    return { nome, colore: COLORI_GIOCATORI[i], iniziale: inizialeDiNome(nome), soldiRound: 0, soldiTotale: 0, jolly: 0 };
  });
  // Punto 38: quanti round dura questa partita.
  Gioco.numeroRoundTotale = numeroRoundScelto;
  Gioco.numeroRoundCorrente = 1;
  Gioco.storicoRound = [];
  Gioco.ultimoRoundFinito = false;
  // Voce D: una partita nuova non pesca dal mazzo dei gruppi scelti l'ultima
  // volta, che potevano essere diversi.
  Gioco.frasiRimaste = [];
  erroreIscrizioneEl.textContent = "";
  iniziaPartita();
});

// ----------------------------------------------------------------------------
// SCHERMATA 2 — PARTITA
// ----------------------------------------------------------------------------

const schermataIscrizione = document.getElementById("schermata-iscrizione");
const schermataGioco = document.getElementById("schermata-gioco");
const schermataFinale = document.getElementById("schermata-finale");
const categoriaEl = document.getElementById("categoria-corrente");
const indicatoreRoundEl = document.getElementById("indicatore-round");
const tabelloneEl = document.getElementById("tabellone-frase");
const colonnaCentraleEl = document.querySelector(".colonna-centrale");
const annuncioEl = document.getElementById("annuncio");
const colonnaGiocatoriEl = document.getElementById("colonna-giocatori");
const canvasRuota = document.getElementById("canvas-ruota");

const btnGira = document.getElementById("btn-gira");
const btnCompraVocale = document.getElementById("btn-compra-vocale");
btnCompraVocale.textContent = "Vocale · " + euro(COSTO_VOCALE); // voce 3, undicesimo giro: sempre allineato a COSTO_VOCALE
const btnRisolvi = document.getElementById("btn-risolvi");
const btnVolume = document.getElementById("btn-volume");
const pannelloVolume = document.getElementById("pannello-volume");
const cursoreVolumeMusica = document.getElementById("cursore-volume-musica");
const cursoreVolumeEffetti = document.getElementById("cursore-volume-effetti");

// Punto 39 (28/09/2026, seconda dettatura): classifica a tendina.
const btnClassifica = document.getElementById("btn-classifica");
const pannelloClassifica = document.getElementById("pannello-classifica");
const contenutoClassificaEl = document.getElementById("contenuto-classifica");

// Punto 39: schermata finale.
const finaleVincitoreImmagineEl = document.getElementById("finale-vincitore-immagine");
const finaleVincitoreNomeEl = document.getElementById("finale-vincitore-nome");
const finaleVincitoreCifraEl = document.getElementById("finale-vincitore-cifra");
const finaleClassificaEl = document.getElementById("finale-classifica");
const overlayFuochiFinaleEl = document.getElementById("overlay-fuochi-finale");
const btnGiocaAncora = document.getElementById("btn-gioca-ancora");
const btnTornaInizio = document.getElementById("btn-torna-inizio");

const pannelloVocali = document.getElementById("pannello-vocali");
const grigliaVocali = document.getElementById("griglia-vocali");
const btnAnnullaVocale = document.getElementById("btn-annulla-vocale");

const pannelloConsonanti = document.getElementById("pannello-consonanti");
const grigliaConsonanti = document.getElementById("griglia-consonanti");

const pannelloJolly = document.getElementById("pannello-jolly");
const testoJollyDomanda = document.getElementById("testo-jolly-domanda");
const btnJollySi = document.getElementById("btn-jolly-si");
const btnJollyNo = document.getElementById("btn-jolly-no");

const pannelloSoluzione = document.getElementById("pannello-soluzione");
const secondiRimastiEl = document.getElementById("secondi-rimasti");
const formSoluzione = document.getElementById("form-soluzione");
const inputSoluzione = document.getElementById("input-soluzione");

const pannelloFineRound = document.getElementById("pannello-fine-round");
const btnRoundSuccessivo = document.getElementById("btn-round-successivo");

// Punto 30 (28/09/2026): la festa di fine round.
const overlayFesta = document.getElementById("overlay-festa");
const festaImmagineEl = document.getElementById("festa-immagine");
const festaNomeEl = document.getElementById("festa-nome");
const festaCifraEl = document.getElementById("festa-cifra");
const festaMoneteEl = document.getElementById("festa-monete");
const btnChiudiFesta = document.getElementById("btn-chiudi-festa");
let timerChiusuraFesta = null;
let frameContatoreFesta = null;

// ---- SCINTILLE (punto 46, 28/09/2026, nono giro) ---------------------------
// "Feste più animate, non troppo pacchiano": qualche pallino colorato che
// esplode da un punto e sfuma, generato al volo con <span> — zero librerie,
// una sola keyframe CSS condivisa (.particella-scintilla in style.css).
// Riusata sia dalla festa di round (dentro la scheda, punto 30) sia dai
// fuochi della schermata finale (a tutto schermo, subito sotto).
const COLORI_SCINTILLE = ["#F39C12", "#E74C3C", "#3498DB", "#2ECC71", "#EC407A", "#8E24AA", "#ffffff"];

function creaScintille(contenitore, quante, raggioPx) {
  for (let i = 0; i < quante; i++) {
    const s = document.createElement("span");
    s.className = "particella-scintilla";
    const angolo = Math.random() * Math.PI * 2;
    const distanza = raggioPx * (0.5 + Math.random() * 0.5);
    s.style.setProperty("--dx", (Math.cos(angolo) * distanza).toFixed(1) + "px");
    s.style.setProperty("--dy", (Math.sin(angolo) * distanza).toFixed(1) + "px");
    s.style.background = COLORI_SCINTILLE[Math.floor(Math.random() * COLORI_SCINTILLE.length)];
    s.style.animationDelay = (Math.random() * 0.15).toFixed(2) + "s";
    contenitore.appendChild(s);
  }
}

// Mostra la finestra animata di chi ha vinto il round: nome, disegnino,
// monete che "cadono" (CSS, generate qui una per una con ritardo e
// dimensione casuali), scintille che esplodono dal centro (punto 46) e la
// cifra che sale da 0 all'importo vinto con un piccolo conta-numeri
// (easeOutCubic, la stessa curva della girata della ruota — coerenza di
// "peso" fra le animazioni del gioco). Si chiude da sola dopo
// DURATA_FESTA_VITTORIA_MS (config.js) o subito con un tocco.
function mostraFestaVittoria(giocatore, importo) {
  Audio_.festaVittoria();
  festaImmagineEl.textContent = giocatore.iniziale;
  festaImmagineEl.style.outlineColor = giocatore.colore;
  festaNomeEl.textContent = giocatore.nome;
  festaNomeEl.style.color = giocatore.colore;
  generaMoneteFesta();
  creaScintille(festaMoneteEl, SCINTILLE_FESTA_ROUND_N, 130);
  animaContatoreFesta(importo);
  generaCoriandoliFesta(giocatore.colore);
  overlayFesta.classList.remove("nascosta");
  fermaTimerChiusuraFesta();
  timerChiusuraFesta = setTimeout(chiudiFestaVittoria, DURATA_FESTA_VITTORIA_MS);
}

// Decimo giro, rilievo 6 (28/09/2026, disegno di Chiara): coriandoli a
// tutto schermo dietro la scheda della festa, nel colore del vincitore piu`
// oro e bianco — "non troppo pacchiano": due colori piu` bianco, non un
// arcobaleno. Il contenitore vive DENTRO overlay-festa (a tutto overlay, non
// solo dentro la scheda), cosi` cadono su tutto lo schermo.
function generaCoriandoliFesta(coloreGiocatore) {
  const colori = [coloreGiocatore, "#F3C531", "#ffffff", coloreGiocatore, "#FFD166"];
  let cont = overlayFesta.querySelector(".coriandoli");
  if (!cont) {
    cont = document.createElement("div");
    cont.className = "coriandoli";
    overlayFesta.insertBefore(cont, overlayFesta.firstChild);
  }
  cont.innerHTML = "";
  for (let i = 0; i < 70; i++) {
    const s = document.createElement("span");
    s.className = "coriandolo";
    s.style.left = Math.random() * 100 + "%";
    s.style.background = colori[i % colori.length];
    s.style.animationDuration = (2.2 + Math.random() * 1.6).toFixed(2) + "s";
    s.style.animationDelay = (Math.random() * 0.9).toFixed(2) + "s";
    s.style.setProperty("--giri", Math.round(360 + Math.random() * 360) + "deg");
    cont.appendChild(s);
  }
}

function generaMoneteFesta() {
  festaMoneteEl.innerHTML = "";
  const N_MONETE = 16;
  for (let i = 0; i < N_MONETE; i++) {
    const moneta = document.createElement("span");
    moneta.className = "moneta-festa";
    moneta.textContent = "🪙";
    moneta.style.left = Math.random() * 92 + "%";
    moneta.style.animationDelay = (Math.random() * 0.7).toFixed(2) + "s";
    moneta.style.animationDuration = (1.3 + Math.random() * 0.9).toFixed(2) + "s";
    moneta.style.fontSize = (1.1 + Math.random() * 1.1).toFixed(2) + "rem";
    festaMoneteEl.appendChild(moneta);
  }
}

function animaContatoreFesta(importo) {
  const durata = DURATA_CONTATORE_FESTA_MS; // proporzionale a DURATA_FESTA_VITTORIA_MS, vedi config.js
  const inizio = performance.now();
  if (frameContatoreFesta) cancelAnimationFrame(frameContatoreFesta);
  function passo(ora) {
    const t = Math.min(1, (ora - inizio) / durata);
    const eased = 1 - Math.pow(1 - t, 3);
    festaCifraEl.textContent = formattaMigliaia(importo * eased);
    if (t < 1) {
      frameContatoreFesta = requestAnimationFrame(passo);
    } else {
      frameContatoreFesta = null;
    }
  }
  frameContatoreFesta = requestAnimationFrame(passo);
}

function chiudiFestaVittoria() {
  fermaTimerChiusuraFesta();
  overlayFesta.classList.add("nascosta");
}

function fermaTimerChiusuraFesta() {
  if (timerChiusuraFesta) {
    clearTimeout(timerChiusuraFesta);
    timerChiusuraFesta = null;
  }
}

btnChiudiFesta.addEventListener("click", chiudiFestaVittoria);
// Un tocco fuori dalla scheda (sullo sfondo scuro) chiude allo stesso modo
// del bottone — comodo su schermo touch, dove il bottone potrebbe essere
// piccolo per un bambino che vuole solo "andare avanti".
overlayFesta.addEventListener("click", (ev) => {
  if (ev.target === overlayFesta) chiudiFestaVittoria();
});

let contestoJollyPendente = null; // "passa" | "bancarotta"

function iniziaPartita() {
  schermataIscrizione.classList.add("nascosta");
  schermataGioco.classList.remove("nascosta");
  Ruota.init(canvasRuota);
  Gioco.indiceCorrente = Math.floor(Math.random() * Gioco.giocatori.length);
  nuovoRound();
  aggiornaSchedeGiocatori();
  // Il click su "Inizia la partita" e` il gesto dell'utente che sblocca
  // l'audio del browser: e` il punto giusto per far partire la musica, se
  // il cursore ricordato (localStorage) e` sopra zero (punto 17, poi punto 36).
  if (Audio_.isMusicaAttiva()) {
    Audio_.musicaAvvia();
  }
}

function giocatoreCorrente() {
  return Gioco.giocatori[Gioco.indiceCorrente];
}

function nuovoRound() {
  fermaTimerAutoscoperta();
  // Ogni round nuovo passa alla musichetta successiva fra le quattro
  // (richiesta di Damiano: "una diversa per ogni round, varia di piu`"),
  // compreso il primo round della partita — vedi Audio_.musicaProssimoRound.
  Audio_.musicaProssimoRound();
  Gioco.fraseCorrente = prossimaFrase();
  Gioco.posizioniRivelate = new Set();
  Gioco.posizioniAccese = new Set();
  Gioco.lettereUsate = new Set();
  Gioco.stato = "idle";
  // Punto 33/37: il "consonanti/vocali finite" si annuncia una volta sola
  // per round — si azzera qui, la frase e` nuova.
  Gioco.consonantiFiniteAvvisate = false;
  Gioco.vocaliFiniteAvvisate = false;
  // Punto 53 (28/09/2026): il jolly torna disponibile ad ogni round nuovo.
  Gioco.jollyPresoInQuestoRound = false;
  Ruota.impostaJollyDisponibile(true);
  // Punto 60 (29/09/2026): le cifre della ruota cambiano round dopo round
  // (CIFRE_PER_ROUND, config.js) — stessi spicchi, stesso ordine, cifre
  // nuove. Dal secondo round in poi un breve annuncio sul palco fa vedere
  // che e` cambiato qualcosa (nello stile dell'annuncio, non un lampo sulla
  // ruota da solo): il round 1 non ha nulla da cui "cambiare".
  // Voce C, tredicesimo giro (29/09/2026): dal round 2 in poi la ruota
  // stessa mostra il cambio con l'onda di luce (vedi Ruota.impostaRound) —
  // l'annuncio non deve piu` dirlo da solo, lo accompagna.
  Ruota.impostaRound(Gioco.numeroRoundCorrente, Gioco.numeroRoundCorrente > 1);
  if (Gioco.numeroRoundCorrente > 1) {
    Annuncio.mostra({
      stile: "scena oro round",
      titolo: `Round ${Gioco.numeroRoundCorrente}`,
      sotto: "la ruota vale di più",
      durata: DURATA_ANNUNCIO_ROUND_MS,
    });
  } else {
    Annuncio.nascondi();
  }
  categoriaEl.textContent = Gioco.fraseCorrente.categoria;
  if (indicatoreRoundEl) indicatoreRoundEl.textContent = `Round ${Gioco.numeroRoundCorrente} di ${Gioco.numeroRoundTotale}`;
  disegnaPuntiRound();
  disegnaTabellone(true); // punto 45: le caselle-lettera si accendono con un'onda, solo all'apertura del round
  nascondiTuttiIPannelli();
  aggiornaComandi();
  aggiornaSchedeGiocatori();
}

// Punto 45 (28/09/2026, nono giro): il tabellone e` ora una griglia fissa,
// sempre rettangolare e sempre della stessa forma (RIGHE_TABELLONE,
// config.js), non piu` righe che si allargano o restringono in base alla
// frase. Ogni riga ha sempre LARGHEZZA_FISICA_TABELLONE caselle: quelle non
// occupate da una lettera (i margini per centrare una riga piu` corta, e lo
// spazio fra due parole) sono caselle "vuota", spente e senza bordo.
//
// Punto 45, seconda parte: "quando esce la frase si accendono le caselle
// dove andranno le lettere; le altre restano spente" — animaIngresso=true
// (solo alla prima chiamata di un round nuovo, vedi nuovoRound) fa comparire
// ogni casella-lettera con una piccola animazione a onda (CSS, vedi
// .cella-tabellone.appare in style.css), sfalsata cella per cella. Le
// ri-disegnature successive dello stesso round (una lettera scoperta, un
// click su una casella accesa...) chiamano la funzione senza argomento e
// restano istantanee, cosi` l'onda non si ripete ad ogni tocco.
function disegnaTabellone(animaIngresso = false) {
  tabelloneEl.innerHTML = "";
  const testo = Gioco.fraseCorrente.testo;
  const distribuzione = distribuisciParoleInRighe(testo, RIGHE_TABELLONE);
  let progressivoLettera = 0; // avanza solo sulle caselle-lettera, mai su quelle vuote

  const aggiungiCellaVuota = (rigaEl) => {
    const cella = document.createElement("span");
    cella.className = "cella-tabellone vuota";
    rigaEl.appendChild(cella);
  };

  distribuzione.forEach((parole) => {
    const rigaEl = document.createElement("div");
    rigaEl.className = "riga-tabellone";

    // Quante caselle occupa davvero il contenuto di questa riga (lettere +
    // uno spazio fra ogni coppia di parole) — il resto, fino alla larghezza
    // fisica del tabellone, si distribuisce in parti uguali ai due lati per
    // centrare la riga "come in TV" (punto 45).
    const usato = parole.reduce((tot, p, i) => tot + p.parola.length + (i > 0 ? 1 : 0), 0);
    const padSinistra = Math.floor((LARGHEZZA_FISICA_TABELLONE - usato) / 2);
    const padDestra = LARGHEZZA_FISICA_TABELLONE - usato - padSinistra;

    for (let i = 0; i < padSinistra; i++) aggiungiCellaVuota(rigaEl);

    parole.forEach((p, ip) => {
      if (ip > 0) aggiungiCellaVuota(rigaEl); // lo spazio fra due parole
      [...p.parola].forEach((car, ic) => {
        const idx = p.idx + ic;
        const cella = document.createElement("span");
        if (!eLettera(car)) {
          cella.className = "cella-tabellone non-alfabetica";
          cella.textContent = car;
        } else if (Gioco.posizioniRivelate.has(idx)) {
          cella.className = "cella-tabellone rivelata";
          cella.textContent = car.toUpperCase();
        } else if (Gioco.posizioniAccese.has(idx)) {
          // Terzo giro, punto 16: la lettera e` gia` trovata, ma resta vuota
          // finche` il giocatore non ci clicca sopra (vedi scopriCasella).
          cella.className = "cella-tabellone accesa";
          cella.setAttribute("role", "button");
          cella.setAttribute("tabindex", "0");
          cella.setAttribute("aria-label", "Tocca per scoprire questa lettera");
          cella.addEventListener("click", () => scopriCasella(idx));
          cella.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              scopriCasella(idx);
            }
          });
        } else {
          // ATTENZIONE: mai chiamare questa classe solo "nascosta" — collide
          // con l'utility globale `.nascosta { display: none !important; }`
          // (style.css) usata per intere schermate/pannelli, che avrebbe
          // reso invisibile OGNI casella non ancora scoperta (bug trovato
          // durante la verifica di questo giro: il tabellone risultava
          // completamente vuoto a inizio round). "coperta" non collide.
          cella.className = "cella-tabellone coperta";
        }
        if (animaIngresso) {
          cella.classList.add("appare");
          cella.style.animationDelay = progressivoLettera * 16 + "ms";
        }
        progressivoLettera++;
        rigaEl.appendChild(cella);
      });
    });

    for (let i = 0; i < padDestra; i++) aggiungiCellaVuota(rigaEl);

    tabelloneEl.appendChild(rigaEl);
  });
}

// Converte un colore esadecimale (es. "#E74C3C") in "rgba(r, g, b, alpha)".
// Serve per tingere lo sfondo delle schede giocatore col loro colore invece
// di lasciarle tutte sullo stesso pannello scuro (terzo giro, punto 18).
function hexInRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Decimo giro (28/09/2026), disegno di Chiara, intervento 4: un numero
// grande per tessera (i soldi del round) e il resto piccolo — non piu` sei
// righe di testo per due numeri. I jolly diventano carte (.carta-jolly),
// non piu` un'emoji che su Linux esce come un quadratino.
function aggiornaSchedeGiocatori() {
  colonnaGiocatoriEl.innerHTML = "";
  Gioco.giocatori.forEach((g, i) => {
    const div = document.createElement("div");
    const inTurno = i === Gioco.indiceCorrente;
    div.className = "scheda-giocatore" + (inTurno ? " turno-attivo" : "");
    div.style.setProperty("--colore-giocatore", g.colore);
    div.style.borderLeftColor = g.colore;
    div.style.background = hexInRgba(g.colore, inTurno ? 0.3 : 0.16);

    // Undicesimo giro, punto 58, strada B (28/09/2026): non piu` un
    // disegnino ma la tessera bianca con l'iniziale del nome — il colore del
    // giocatore resta visibile nell'anello (outline) e nel bordo/sfondo
    // della scheda (righe sopra).
    const iniziale = document.createElement("div");
    iniziale.className = "tessera-giocatore";
    iniziale.textContent = g.iniziale;
    iniziale.style.outlineColor = g.colore;

    const info = document.createElement("div");
    info.className = "info-giocatore";
    const nome = document.createElement("div");
    nome.className = "nome-giocatore";
    nome.textContent = g.nome;

    // Il numero grande e` quello che conta ADESSO: i soldi del round. La
    // cassaforte (il totale al sicuro) resta sotto, piu` piccola.
    const soldiRound = document.createElement("div");
    soldiRound.className = "soldi-round-giocatore";
    soldiRound.innerHTML = `${formattaMigliaia(g.soldiRound)}<span class="euro">€</span>`;
    const soldiTotale = document.createElement("div");
    soldiTotale.className = "soldi-totale-giocatore";
    soldiTotale.innerHTML = `in cassaforte <b>${euro(g.soldiTotale)}</b>`;

    const jolly = document.createElement("div");
    jolly.className = "jolly-giocatore";
    for (let k = 0; k < g.jolly; k++) {
      const carta = document.createElement("span");
      carta.className = "carta-jolly";
      carta.textContent = "J";
      carta.title = "Jolly";
      jolly.appendChild(carta);
    }

    info.appendChild(nome);
    info.appendChild(soldiRound);
    info.appendChild(soldiTotale);
    div.appendChild(iniziale);
    div.appendChild(info);
    div.appendChild(jolly);
    colonnaGiocatoriEl.appendChild(div);
  });
  aggiornaPannelloClassifica();
  disegnaPuntiRound();
}

// Decimo giro, intervento 4: i round vinti diventano pallini nell'intestazione
// (round-punti in HTML), colorati col giocatore che li ha vinti — assorbono
// "Round vinti" dal vecchio pannello classifica (che resta con la sola
// classifica dei soldi, vedi aggiornaPannelloClassifica).
function disegnaPuntiRound() {
  const el = document.getElementById("round-punti");
  if (!el) return;
  el.innerHTML = "";
  const tot = Gioco.numeroRoundTotale || NUMERO_ROUND_DI_DEFAULT;
  for (let n = 1; n <= tot; n++) {
    const p = document.createElement("span");
    p.className = "punto";
    p.textContent = String(n);
    const vinto = (Gioco.storicoRound || []).find((r) => r.numero === n);
    if (vinto) {
      p.classList.add("vinto");
      p.style.background = vinto.vincitoreColore;
      p.title = "Round " + n + ": " + vinto.vincitoreNome;
    } else if (n === Gioco.numeroRoundCorrente) {
      p.classList.add("corrente");
      p.title = "Round " + n + " di " + tot;
    }
    el.appendChild(p);
  }
}

// Punto 39 (28/09/2026, seconda dettatura): round vinti finora + classifica
// per soldi in cassaforte. Ricostruita ad ogni aggiornaSchedeGiocatori(),
// cosi` resta sempre allineata anche se il pannello e` chiuso.
function aggiornaPannelloClassifica() {
  contenutoClassificaEl.innerHTML = "";

  // Decimo giro, intervento 4: "Round vinti" e` passato ai pallini
  // nell'intestazione (disegnaPuntiRound) — qui resta la sola classifica
  // dei soldi in cassaforte.
  const titoloSoldi = document.createElement("p");
  titoloSoldi.className = "titolo-classifica";
  titoloSoldi.textContent = "Classifica soldi";
  contenutoClassificaEl.appendChild(titoloSoldi);

  [...Gioco.giocatori]
    .sort((a, b) => b.soldiTotale - a.soldiTotale)
    .forEach((g, i) => {
      const riga = document.createElement("div");
      riga.className = "riga-classifica";
      riga.style.borderLeftColor = g.colore;
      riga.textContent = `${i + 1}. ${g.nome} — ${euro(g.soldiTotale)}`;
      contenutoClassificaEl.appendChild(riga);
    });
}

function nascondiTuttiIPannelli() {
  [pannelloVocali, pannelloConsonanti, pannelloJolly, pannelloSoluzione, pannelloFineRound].forEach((p) =>
    p.classList.add("nascosta")
  );
  fermaTimerSoluzione();
}

// ---- PUNTO 33 (28/09/2026): consonanti/vocali finite in questa frase ------
// "Finite" vuol dire: quelle davvero presenti nella frase sono gia` tutte
// state trovate (rivelate o accese in attesa di un click) — non conta quante
// lettere sono state "chiamate" in tutto, solo quante ne restano da scoprire
// DENTRO la frase corrente.
function categoriaFinitaNellaFrase(elencoLettere) {
  const testo = Gioco.fraseCorrente.testo;
  for (let i = 0; i < testo.length; i++) {
    const car = testo[i];
    if (!eLettera(car)) continue;
    if (!elencoLettere.includes(normalizzaLettera(car))) continue;
    if (!Gioco.posizioniRivelate.has(i) && !Gioco.posizioniAccese.has(i)) return false;
  }
  return true;
}

function consonantiFiniteNellaFrase() {
  return categoriaFinitaNellaFrase(CONSONANTI);
}

function vocaliFiniteNellaFrase() {
  return categoriaFinitaNellaFrase(VOCALI);
}

// Punto 37 (28/09/2026, seconda dettatura), assorbito nel palco dell'annuncio
// (punto 56, undicesimo giro): l'avviso "consonanti/vocali finite" appare una
// volta sola, nel momento in cui la condizione diventa vera (non un testo
// persistente) — per questo serve un flag per round
// (Gioco.consonantiFiniteAvvisate/vocaliFiniteAvvisate, azzerato in
// nuovoRound()) che ricorda se l'abbiamo già annunciato.
function aggiornaAvvisoLettereFinite(consonantiFinite, vocaliFinite) {
  const consonantiAppenaFinite = consonantiFinite && !Gioco.consonantiFiniteAvvisate;
  const vocaliAppenaFinite = vocaliFinite && !Gioco.vocaliFiniteAvvisate;
  Gioco.consonantiFiniteAvvisate = consonantiFinite;
  Gioco.vocaliFiniteAvvisate = vocaliFinite;

  if (consonantiAppenaFinite && vocaliAppenaFinite) {
    Annuncio.mostra({ stile: "scena", titolo: "Lettere finite", sotto: "resta solo la soluzione", durata: DURATA_ANNUNCIO_LUNGO_MS });
  } else if (consonantiAppenaFinite) {
    Annuncio.mostra({ stile: "scena", titolo: "Consonanti finite", durata: DURATA_ANNUNCIO_LUNGO_MS });
  } else if (vocaliAppenaFinite) {
    Annuncio.mostra({ stile: "scena", titolo: "Vocali finite", durata: DURATA_ANNUNCIO_LUNGO_MS });
  }
}

function aggiornaComandi() {
  const idle = Gioco.stato === "idle" && !Ruota.inAnimazione();
  const g = giocatoreCorrente();
  const vocaliRimaste = VOCALI.some((v) => !Gioco.lettereUsate.has(v));
  // Punto 33: quando in questa frase non restano consonanti (o vocali) da
  // scoprire, girare la ruota (o comprare una vocale) non serve piu` a
  // niente — vedi DISATTIVA_COMANDI_SE_LETTERE_FINITE in config.js.
  const consonantiFinite = DISATTIVA_COMANDI_SE_LETTERE_FINITE && consonantiFiniteNellaFrase();
  const vocaliFinite = DISATTIVA_COMANDI_SE_LETTERE_FINITE && vocaliFiniteNellaFrase();
  btnGira.disabled = !idle || consonantiFinite;
  // La vocale si paga coi soldi DEL ROUND (scelta provvisoria di Erbottega,
  // vedi VOCALE_SI_PAGA_COL_TOTALE in config.js): il totale in cassaforte
  // non basta a comprarla da solo, anche se e` pieno.
  const contoPerLaVocale = VOCALE_SI_PAGA_COL_TOTALE ? g.soldiTotale : g.soldiRound;
  btnCompraVocale.disabled = !idle || contoPerLaVocale < COSTO_VOCALE || !vocaliRimaste || vocaliFinite;
  btnRisolvi.disabled = !idle;
  aggiornaAvvisoLettereFinite(consonantiFinite, vocaliFinite);
}

// ---- L'ANNUNCIO (punto 56, undicesimo giro, 28/09/2026, disegno di Chiara) -
// Il "palco", copiato dal prototipo di Chiara (design/prototipi/2026-09-28-
// annuncio-e-disegnini/proposta-annuncio.js): un solo posto dove guardare,
// per tutto cio` che in TV direbbe il conduttore — lettera trovata/assente,
// jolly, raddoppio, Passa, Bancarotta, tempo scaduto, risposta sbagliata,
// lettera già uscita, lettere finite. Sostituisce la vecchia riga verde
// (mostraMessaggio) e il messaggio grande sopra il tabellone
// (mostraMessaggioGrande, punto 37/42): stile in style.css, blocco
// @media(min-width:1200px). Sotto i 1200px (non piu` il riferimento, "basta
// che non si rompa") il palco resta senza il suo stile speciale: si vede,
// non si rompe.
const Annuncio = (() => {
  let timer = null;
  let timerUscita = null;

  // voce = { lettera?, titolo, sotto?, stile?: 'no' | 'scena' | 'scena rosso' | 'scena oro', durata?: ms }
  function mostra(voce) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (timerUscita) { clearTimeout(timerUscita); timerUscita = null; }
    annuncioEl.className = "annuncio " + (voce.stile || "");
    annuncioEl.innerHTML = "";
    if (voce.lettera) {
      const t = document.createElement("div");
      t.className = "annuncio-tessera";
      t.textContent = voce.lettera;
      annuncioEl.appendChild(t);
    }
    const testo = document.createElement("div");
    testo.className = "annuncio-testo";
    const h = document.createElement("div");
    h.className = "annuncio-titolo";
    h.textContent = voce.titolo;
    testo.appendChild(h);
    if (voce.sotto) {
      const s = document.createElement("div");
      s.className = "annuncio-sotto";
      s.textContent = voce.sotto;
      testo.appendChild(s);
    }
    annuncioEl.appendChild(testo);
    colonnaCentraleEl.classList.add("con-annuncio");
    void annuncioEl.offsetWidth; // riavvia l'animazione anche se un annuncio era gia` a schermo
    annuncioEl.classList.add("entra");
    if (voce.durata) timer = setTimeout(nascondi, voce.durata);
  }

  function nascondi() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!colonnaCentraleEl.classList.contains("con-annuncio")) return;
    annuncioEl.classList.add("esce");
    timerUscita = setTimeout(() => {
      colonnaCentraleEl.classList.remove("con-annuncio");
      annuncioEl.className = "annuncio";
      annuncioEl.innerHTML = "";
      timerUscita = null;
    }, 220);
  }

  return { mostra, nascondi };
})();

// L'ordine con cui le caselle si accendono, una alla volta (90 ms l'una
// dall'altra, come in TV): gioco.js chiama questa funzione DOPO
// disegnaTabellone(), quando le caselle "accesa" sono gia` nel DOM.
function numeraCaselleAccese() {
  document.querySelectorAll(".cella-tabellone.accesa").forEach((c, k) => c.style.setProperty("--ordine", k));
}

// "Prossimo" — chi gioca dopo, calcolato PRIMA che passaTurno() avanzi
// Gioco.indiceCorrente (vedi le chiamate qui sotto).
function nomeGiocatoreProssimo() {
  return Gioco.giocatori[(Gioco.indiceCorrente + 1) % Gioco.giocatori.length].nome;
}

function quanteVolte(n) {
  return n === 1 ? "ce n'è una" : "ce ne sono " + n;
}

// Mostra un annuncio che finisce con il turno che passa: i comandi restano
// spenti (stato diverso da "idle") finche` l'annuncio non ha finito il suo
// tempo — cosi` si vede cosa e` successo prima che tocchi al prossimo.
function annunciaEPassaTurno(voce) {
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  Annuncio.mostra(voce);
  setTimeout(passaTurno, voce.durata);
}

// ---- GIRA LA RUOTA ---------------------------------------------------------

btnGira.addEventListener("click", () => {
  if (Gioco.stato !== "idle" || Ruota.inAnimazione()) return;
  Gioco.stato = "girando";
  aggiornaComandi();
  Audio_.inizioSpin();
  Annuncio.nascondi();

  // Quarto giro, punto 21: la frazione extra non e` piu` "un punto a caso
  // sull'intero giro" (0-360°), ma sempre fra mezzo giro e un giro intero
  // (ANGOLO_EXTRA_MIN/MAX_TURNI, config.js) — cosi il totale resta sempre
  // nella forchetta 1,5-3 giri chiesta da Damiano, mai sotto ne` sopra.
  const giriTotali = GIRI_MINIMI + Math.floor(Math.random() * (GIRI_EXTRA_CASUALI + 1));
  const frazioneExtra =
    ANGOLO_EXTRA_MIN_TURNI + Math.random() * (ANGOLO_EXTRA_MAX_TURNI - ANGOLO_EXTRA_MIN_TURNI);
  const angoloExtra = frazioneExtra * Math.PI * 2;
  const angoloTotale = giriTotali * Math.PI * 2 + angoloExtra;
  const durata = DURATA_SPIN_MS_MIN + Math.random() * (DURATA_SPIN_MS_MAX - DURATA_SPIN_MS_MIN);

  Ruota.gira(
    durata,
    angoloTotale,
    () => {
      Audio_.tic();
      puntatoreTic();
    },
    (segmentoVinto, indice) => gestisciEsitoRuota(segmentoVinto, indice)
  );
});

// ---- GIRA LA RUOTA TRASCINANDOLA (punti 61-62, 29/09/2026) ----------------
// "Oppure poter scegliere" (punto 61): il pulsante sopra resta, invariato —
// questa e` la seconda strada, mouse o dito, che porta allo STESSO esito
// (gestisciEsitoRuota) e agli stessi annunci. Si puo` afferrare la ruota
// solo quando il gioco aspetta un giro (Gioco.stato === "idle"), come per il
// pulsante: non mentre si sceglie una lettera o c'e` un annuncio aperto.
let pointerIdTrascinamento = null;

function ticRuotaTrascinamento(verso) {
  Audio_.tic();
  puntatoreTic(verso);
}

function onTrascinamentoNonValido() {
  // Punto 62: sotto mezzo giro il lancio non conta. La ruota e` gia` ferma
  // dove l'attrito l'ha lasciata (niente da riportare indietro): un
  // annuncio breve sul palco chiede di rilanciare, e si torna "idle" subito
  // — il turno non passa, si puo` riprovare all'istante.
  Gioco.stato = "idle";
  aggiornaComandi();
  // Voce B, tredicesimo giro (29/09/2026): "Più forte!" dice cosa fare
  // invece di dare un giudizio a chi ha tirato.
  Annuncio.mostra({ stile: "scena", titolo: "Più forte!", sotto: "rilancia la ruota", durata: DURATA_ANNUNCIO_MS });
}

canvasRuota.addEventListener("pointerdown", (ev) => {
  if (Gioco.stato !== "idle" || Ruota.inAnimazione()) return;
  if (!Ruota.iniziaTrascinamento(ev.clientX, ev.clientY, ticRuotaTrascinamento)) return;
  pointerIdTrascinamento = ev.pointerId;
  canvasRuota.setPointerCapture(ev.pointerId);
  canvasRuota.classList.add("trascinando");
  Gioco.stato = "girando";
  aggiornaComandi();
  Audio_.inizioSpin();
  Annuncio.nascondi();
  ev.preventDefault();
});

canvasRuota.addEventListener("pointermove", (ev) => {
  if (pointerIdTrascinamento === null || ev.pointerId !== pointerIdTrascinamento) return;
  Ruota.muoviTrascinamento(ev.clientX, ev.clientY);
});

function finisceTrascinamento(ev) {
  if (pointerIdTrascinamento === null || ev.pointerId !== pointerIdTrascinamento) return;
  pointerIdTrascinamento = null;
  canvasRuota.classList.remove("trascinando");
  Ruota.terminaTrascinamento(
    (segmentoVinto, indice) => gestisciEsitoRuota(segmentoVinto, indice),
    onTrascinamentoNonValido
  );
}

canvasRuota.addEventListener("pointerup", finisceTrascinamento);
canvasRuota.addEventListener("pointercancel", finisceTrascinamento);

// Decimo giro, punto 55 (28/09/2026): la freccia "sbatte sui pioli" mentre
// la ruota gira — un piccolo scatto ad ogni tic (uno spicchio attraversato),
// che rallenta insieme alla ruota perche` i tic diventano piu` radi verso la
// fine della girata (vedi Ruota.gira in ruota.js). Chiara: "-14° per 90 ms a
// ogni tic" (`design/2026-09-28-revisione.md`, rilievo 7).
const puntatoreEl = document.querySelector(".puntatore");
let timerPuntatoreTic = null;
// Voce E, tredicesimo giro (29/09/2026, facoltativa): con verso negativo
// (la ruota trascinata all'indietro) la freccia si piega dall'altra parte
// (classe "tic-indietro" invece di "tic"). Il pulsante "Gira la ruota" non
// passa mai un verso: gira sempre in avanti, quindi resta "tic".
function puntatoreTic(verso) {
  if (!puntatoreEl) return;
  const classe = verso < 0 ? "tic-indietro" : "tic";
  puntatoreEl.classList.remove("tic", "tic-indietro");
  // force reflow cosi` l'animazione riparte anche se il tic precedente non
  // e` ancora finito (i tic possono arrivare piu` fitti dei 90ms all'inizio
  // della girata, quando la ruota e` ancora veloce).
  void puntatoreEl.offsetWidth;
  puntatoreEl.classList.add(classe);
  if (timerPuntatoreTic) clearTimeout(timerPuntatoreTic);
  timerPuntatoreTic = setTimeout(() => puntatoreEl.classList.remove(classe), 90);
}

// Il titolo del riquadro delle consonanti porta la cifra dello spicchio
// (prima stava nella riga verde, ora assorbita dal palco dell'annuncio):
// "1.000 € a lettera · scegli una consonante" (voce 1 della scheda, punto 56).
function impostaTitoloConsonanti(html) {
  pannelloConsonanti.querySelector("p").innerHTML = html;
}

function gestisciEsitoRuota(segmento, indice) {
  const g = giocatoreCorrente();
  Gioco.spicchioIndice = indice;
  if (segmento.tipo === "soldi") {
    // Punto 53 (28/09/2026): il jolly e` uno spicchio intero, sullo stesso
    // indice di un 600€ — finche` nessuno l'ha preso in questo round, chi ci
    // finisce deve comunque dire una consonante per guadagnarlo (punto 25),
    // e prende SOLO il jolly, non i soldi dello spicchio (punto 49).
    if (segmento.jolly && !Gioco.jollyPresoInQuestoRound) {
      impostaTitoloConsonanti("<b>Jolly!</b> Se la consonante c’è, è tuo");
      Gioco.spicchioValore = JOLLY_VALORE_SOLDI_PER_LETTERA;
      Gioco.spicchioTipo = "jolly";
      apriPannelloConsonanti();
      return;
    }
    impostaTitoloConsonanti(`<b>${euro(segmento.valore)}</b> a lettera · scegli una consonante`);
    Gioco.spicchioValore = segmento.valore;
    Gioco.spicchioTipo = "soldi";
    apriPannelloConsonanti();
    return;
  }
  if (segmento.tipo === "passa") {
    if (g.jolly > 0) {
      apriPannelloJolly("passa");
      return;
    }
    Audio_.passa();
    annunciaEPassaTurno({ stile: "scena", titolo: "Passa!", sotto: "tocca a " + nomeGiocatoreProssimo(), durata: DURATA_ANNUNCIO_MS });
    return;
  }
  if (segmento.tipo === "bancarotta") {
    if (g.jolly > 0) {
      apriPannelloJolly("bancarotta");
      return;
    }
    Audio_.bancarotta();
    // Regola 9 (28/09/2026): la bancarotta azzera round E totale insieme.
    g.soldiRound = 0;
    g.soldiTotale = 0;
    aggiornaSchedeGiocatori();
    annunciaEPassaTurno({
      stile: "scena rosso",
      titolo: "Bancarotta!",
      sotto: g.nome + " perde tutto · tocca a " + nomeGiocatoreProssimo(),
      durata: DURATA_ANNUNCIO_LUNGO_MS,
    });
    return;
  }
  if (segmento.tipo === "raddoppia") {
    // Punto 48 (28/09/2026, regola provvisoria di Erbottega, vedi
    // RADDOPPIA_MOLTIPLICATORE in config.js): il centro dello spicchio
    // triplo. Una consonante giusta raddoppia i soldi del round; se non
    // c'e`, il turno passa come su uno spicchio normale.
    impostaTitoloConsonanti("<b>Raddoppia!</b> Se la consonante c’è, raddoppi");
    Gioco.spicchioValore = 0;
    Gioco.spicchioTipo = "raddoppia";
    apriPannelloConsonanti();
    return;
  }
}

// ---- CONSONANTI -------------------------------------------------------------

function apriPannelloConsonanti() {
  Gioco.stato = "scegli_consonante";
  grigliaConsonanti.innerHTML = "";
  CONSONANTI.forEach((lettera) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = lettera;
    // Punto 35 (28/09/2026): niente stato disabilitato/grigio per le
    // consonanti già chiamate — "ricordarsele fa parte del gioco". Nessun
    // indizio visivo le distingue dalle altre; il controllo si fa dentro
    // sceltaConsonante quando il giocatore clicca davvero.
    btn.addEventListener("click", () => sceltaConsonante(lettera));
    grigliaConsonanti.appendChild(btn);
  });
  pannelloConsonanti.classList.remove("nascosta");
  aggiornaComandi();
}

function posizioniDellaLettera(lettera) {
  const posizioni = [];
  [...Gioco.fraseCorrente.testo].forEach((car, idx) => {
    if (eLettera(car) && normalizzaLettera(car) === lettera) posizioni.push(idx);
  });
  return posizioni;
}

function sceltaConsonante(lettera) {
  pannelloConsonanti.classList.add("nascosta");

  // Punto 35 (28/09/2026): una consonante già chiamata — sul tabellone o
  // già tentata e risultata assente — fa finire il turno senza soldi.
  // Vale allo stesso modo sullo spicchio JOLLY (nessun ramo separato).
  if (Gioco.lettereUsate.has(lettera)) {
    Audio_.letteraGiaChiamata();
    annunciaEPassaTurno({
      lettera,
      stile: "no",
      titolo: "è già uscita",
      sotto: "tocca a " + nomeGiocatoreProssimo(),
      durata: DURATA_ANNUNCIO_LUNGO_MS,
    });
    return;
  }

  Gioco.lettereUsate.add(lettera);
  const posizioni = posizioniDellaLettera(lettera);

  if (posizioni.length > 0) {
    // Scelta di Erbottega (28/09/2026, punto 16 del terzo giro): i soldi si
    // incassano SUBITO, appena la lettera e` trovata — non si aspetta che il
    // giocatore abbia cliccato tutte le caselle. Il click serve solo a
    // "scoprire" la lettera sul tabellone, come lo schermo che si accende
    // in TV: l'importo vinto e` gia` definitivo e visibile nella scheda.
    const g = giocatoreCorrente();
    const importoVinto = Gioco.spicchioValore * posizioni.length;
    g.soldiRound += importoVinto;
    posizioni.forEach((p) => Gioco.posizioniAccese.add(p));

    if (Gioco.spicchioTipo === "jolly") {
      // Punto 53 (28/09/2026): il jolly e` uno spicchio intero — chi lo
      // prende prende SOLO il jolly, non i soldi dello spicchio sotto
      // (punto 49). Preso una volta per round (Gioco.jollyPresoInQuestoRound):
      // lo spicchio smette di mostrare "JOLLY" e torna a mostrare la sua
      // cifra, con una piccola transizione (Ruota.animaPresaJolly). Il
      // giocatore CONTINUA il turno, come chiesto: si torna a "idle" solo
      // dopo che ha scoperto tutte le caselle accese (vedi
      // finalizzaRivelazione), esattamente come su uno spicchio soldi normale.
      g.jolly += 1;
      Gioco.jollyPresoInQuestoRound = true;
      Ruota.animaPresaJolly(Gioco.spicchioIndice);
      Audio_.jolly();
      disegnaTabellone();
      numeraCaselleAccese();
      Annuncio.mostra({ lettera, titolo: quanteVolte(posizioni.length), sotto: "e il Jolly è tuo" });
    } else if (Gioco.spicchioTipo === "raddoppia") {
      // Punto 48: consonante giusta sul RADDOPPIA — i soldi del round
      // raddoppiano (RADDOPPIA_MOLTIPLICATORE, config.js), oltre a rivelare
      // la lettera come su qualunque spicchio (a valore 0: il premio qui e`
      // il raddoppio, non l'importo per lettera).
      g.soldiRound = Math.round(g.soldiRound * RADDOPPIA_MOLTIPLICATORE);
      Audio_.letteraRivelata();
      disegnaTabellone();
      numeraCaselleAccese();
      Annuncio.mostra({ lettera, titolo: quanteVolte(posizioni.length), sotto: "raddoppi: " + euro(g.soldiRound) });
    } else {
      Audio_.letteraRivelata();
      disegnaTabellone();
      numeraCaselleAccese();
      Annuncio.mostra({ lettera, titolo: quanteVolte(posizioni.length), sotto: "+" + euro(importoVinto) });
    }
    aggiornaSchedeGiocatori();
    Gioco.stato = "rivelando";
    aggiornaComandi();
    avviaTimerAutoscoperta();
  } else {
    Audio_.letteraAssente();
    if (Gioco.spicchioTipo === "jolly") {
      annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", sotto: "niente Jolly · tocca a " + nomeGiocatoreProssimo(), durata: DURATA_ANNUNCIO_MS });
    } else if (Gioco.spicchioTipo === "raddoppia") {
      annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", sotto: "niente raddoppio · tocca a " + nomeGiocatoreProssimo(), durata: DURATA_ANNUNCIO_MS });
    } else {
      annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", sotto: "tocca a " + nomeGiocatoreProssimo(), durata: DURATA_ANNUNCIO_MS });
    }
  }
}

// ---- SCOPERTA DELLE CASELLE (click sulle caselle accese) --------------------

function scopriCasella(idx) {
  if (!Gioco.posizioniAccese.has(idx)) return;
  Gioco.posizioniAccese.delete(idx);
  Gioco.posizioniRivelate.add(idx);
  Audio_.click();
  disegnaTabellone();
  if (Gioco.posizioniAccese.size === 0) {
    finalizzaRivelazione();
  }
}

function finalizzaRivelazione() {
  fermaTimerAutoscoperta();
  Annuncio.nascondi();
  Gioco.stato = "idle";
  aggiornaComandi();
  if (fraseCompletamenteRivelata()) {
    vinciRound();
  }
}

// Se nessuno clicca tutte le caselle accese entro TEMPO_AUTOSCOPERTA_MS
// (config.js), si scoprono da sole: il gioco non deve restare bloccato
// perche' un bambino non ha toccato lo schermo (punto 16, richiesta esplicita).
function avviaTimerAutoscoperta() {
  fermaTimerAutoscoperta();
  Gioco.timerAutoscoperta = setTimeout(() => {
    Gioco.timerAutoscoperta = null;
    if (Gioco.posizioniAccese.size === 0) return;
    [...Gioco.posizioniAccese].forEach((idx) => {
      Gioco.posizioniAccese.delete(idx);
      Gioco.posizioniRivelate.add(idx);
    });
    disegnaTabellone();
    finalizzaRivelazione();
  }, TEMPO_AUTOSCOPERTA_MS);
}

function fermaTimerAutoscoperta() {
  if (Gioco.timerAutoscoperta) {
    clearTimeout(Gioco.timerAutoscoperta);
    Gioco.timerAutoscoperta = null;
  }
}

// ---- VOCALI ------------------------------------------------------------------

btnCompraVocale.addEventListener("click", () => {
  if (Gioco.stato !== "idle") return;
  Gioco.stato = "scegli_vocale";
  grigliaVocali.innerHTML = "";
  VOCALI.forEach((lettera) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = lettera;
    // Punto 35: stessa scelta delle consonanti — niente disabilitato/grigio,
    // il controllo si fa dentro sceltaVocale quando si clicca davvero.
    btn.addEventListener("click", () => sceltaVocale(lettera));
    grigliaVocali.appendChild(btn);
  });
  pannelloVocali.classList.remove("nascosta");
  aggiornaComandi();
});

btnAnnullaVocale.addEventListener("click", () => {
  pannelloVocali.classList.add("nascosta");
  Gioco.stato = "idle";
  aggiornaComandi();
});

function sceltaVocale(lettera) {
  pannelloVocali.classList.add("nascosta");
  const g = giocatoreCorrente();
  // Vedi VOCALE_SI_PAGA_COL_TOTALE in config.js: per ora si paga sempre col
  // round, mai col totale in cassaforte (scelta provvisoria di Erbottega).
  const contoPerLaVocale = VOCALE_SI_PAGA_COL_TOTALE ? "soldiTotale" : "soldiRound";
  if (g[contoPerLaVocale] < COSTO_VOCALE) return; // non dovrebbe capitare: il pulsante "Compra vocale" e` disabilitato senza fondi

  // Punto 35 (28/09/2026): una vocale già chiamata in questo round si
  // tratta esattamente come una vocale assente — paga e perde il turno
  // (VOCALE_GIA_CHIAMATA_PERDE_TURNO in config.js), con lo stesso avviso
  // grande ed errore sonoro della consonante già chiamata.
  if (Gioco.lettereUsate.has(lettera)) {
    g[contoPerLaVocale] -= COSTO_VOCALE;
    Audio_.letteraGiaChiamata();
    aggiornaSchedeGiocatori();
    if (VOCALE_GIA_CHIAMATA_PERDE_TURNO) {
      annunciaEPassaTurno({
        lettera,
        stile: "no",
        titolo: "è già uscita",
        sotto: "tocca a " + nomeGiocatoreProssimo(),
        durata: DURATA_ANNUNCIO_LUNGO_MS,
      });
    } else {
      Annuncio.mostra({ lettera, stile: "no", titolo: "è già uscita", durata: DURATA_ANNUNCIO_LUNGO_MS });
      Gioco.stato = "idle";
      aggiornaComandi();
    }
    return;
  }

  g[contoPerLaVocale] -= COSTO_VOCALE; // si paga sempre, anche se la vocale non c'è
  Gioco.lettereUsate.add(lettera);
  const posizioni = posizioniDellaLettera(lettera);

  if (posizioni.length > 0) {
    posizioni.forEach((p) => Gioco.posizioniAccese.add(p));
    Audio_.letteraRivelata();
    disegnaTabellone();
    numeraCaselleAccese();
    Annuncio.mostra({ lettera, titolo: quanteVolte(posizioni.length) }); // la vocale non paga: niente "sotto"
    aggiornaSchedeGiocatori();
    Gioco.stato = "rivelando";
    aggiornaComandi();
    avviaTimerAutoscoperta();
  } else {
    // Punto 34 (28/09/2026): la vocale assente ora fa finire il turno
    // (prima continuava) — VOCALE_ASSENTE_PERDE_TURNO in config.js.
    Audio_.letteraAssente();
    aggiornaSchedeGiocatori();
    if (VOCALE_ASSENTE_PERDE_TURNO) {
      annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", sotto: "tocca a " + nomeGiocatoreProssimo(), durata: DURATA_ANNUNCIO_MS });
    } else {
      Annuncio.mostra({ lettera, stile: "no", titolo: "non c’è", durata: DURATA_ANNUNCIO_MS });
      Gioco.stato = "idle";
      aggiornaComandi();
    }
  }
}

// ---- JOLLY --------------------------------------------------------------------

function apriPannelloJolly(contesto) {
  Gioco.stato = "attesa_jolly";
  contestoJollyPendente = contesto;
  testoJollyDomanda.textContent = (contesto === "bancarotta" ? "Bancarotta!" : "Passa!") + " Usi un Jolly?";
  pannelloJolly.classList.remove("nascosta");
  aggiornaComandi();
}

btnJollySi.addEventListener("click", () => {
  const g = giocatoreCorrente();
  g.jolly -= 1;
  pannelloJolly.classList.add("nascosta");
  Audio_.jolly();
  if (contestoJollyPendente === "passa") {
    Annuncio.mostra({ stile: "scena oro", titolo: "Jolly!", sotto: g.nome + " è salvo e gira ancora", durata: DURATA_ANNUNCIO_MS });
  } else {
    // JOLLY_SALVA_ANCHE_I_SOLDI: deciso da Damiano il 28/09/2026, sempre vero.
    // Il ramo "false" non azzera comunque i soldi qui: il jolly annulla
    // l'intero effetto della bancarotta quando viene usato, per definizione.
    Annuncio.mostra({ stile: "scena oro", titolo: "Jolly!", sotto: g.nome + " salva soldi e turno", durata: DURATA_ANNUNCIO_MS });
  }
  aggiornaSchedeGiocatori();
  Gioco.stato = "idle";
  contestoJollyPendente = null;
  aggiornaComandi();
});

btnJollyNo.addEventListener("click", () => {
  const g = giocatoreCorrente();
  const contesto = contestoJollyPendente;
  pannelloJolly.classList.add("nascosta");
  contestoJollyPendente = null;
  if (contesto === "passa") {
    Audio_.passa();
    annunciaEPassaTurno({ stile: "scena", titolo: "Passa!", sotto: "tocca a " + nomeGiocatoreProssimo(), durata: DURATA_ANNUNCIO_MS });
  } else {
    Audio_.bancarotta();
    g.soldiRound = 0;
    g.soldiTotale = 0;
    aggiornaSchedeGiocatori();
    annunciaEPassaTurno({
      stile: "scena rosso",
      titolo: "Bancarotta!",
      sotto: g.nome + " perde tutto · tocca a " + nomeGiocatoreProssimo(),
      durata: DURATA_ANNUNCIO_LUNGO_MS,
    });
  }
});

// ---- RISOLVI (con timer) -----------------------------------------------------

btnRisolvi.addEventListener("click", () => {
  if (Gioco.stato !== "idle") return;
  Gioco.stato = "risolvendo";
  pannelloSoluzione.classList.remove("nascosta");
  inputSoluzione.value = "";
  inputSoluzione.focus();
  aggiornaComandi();
  avviaTimerSoluzione();
});

function avviaTimerSoluzione() {
  let secondi = SECONDI_PER_LA_SOLUZIONE;
  secondiRimastiEl.textContent = String(secondi);
  fermaTimerSoluzione();
  Gioco.timerSoluzione = setInterval(() => {
    secondi -= 1;
    secondiRimastiEl.textContent = String(Math.max(0, secondi));
    if (secondi <= 0) {
      fermaTimerSoluzione();
      pannelloSoluzione.classList.add("nascosta");
      annunciaEPassaTurno({ stile: "scena", titolo: "Tempo scaduto", sotto: "tocca a " + nomeGiocatoreProssimo(), durata: DURATA_ANNUNCIO_MS });
    }
  }, 1000);
}

function fermaTimerSoluzione() {
  if (Gioco.timerSoluzione) {
    clearInterval(Gioco.timerSoluzione);
    Gioco.timerSoluzione = null;
  }
}

formSoluzione.addEventListener("submit", (ev) => {
  ev.preventDefault();
  fermaTimerSoluzione();
  pannelloSoluzione.classList.add("nascosta");
  const tentativo = normalizzaTesto(inputSoluzione.value);
  const corretta = normalizzaTesto(Gioco.fraseCorrente.testo);
  if (tentativo.length > 0 && tentativo === corretta) {
    vinciRound();
  } else {
    annunciaEPassaTurno({ stile: "scena", titolo: "Non è questa", sotto: "tocca a " + nomeGiocatoreProssimo(), durata: DURATA_ANNUNCIO_MS });
  }
});

// ---- FINE ROUND / PASSAGGIO DI TURNO ------------------------------------------

function fraseCompletamenteRivelata() {
  for (let i = 0; i < Gioco.fraseCorrente.testo.length; i++) {
    const car = Gioco.fraseCorrente.testo[i];
    if (eLettera(car) && !Gioco.posizioniRivelate.has(i)) return false;
  }
  return true;
}

function vinciRound() {
  fermaTimerSoluzione();
  const g = giocatoreCorrente();

  // Regola 9 (28/09/2026, corretta punto 68 del 29/09/2026): chi risolve
  // porta a casa i soldi del round in corso. Il bonus fisso di 1000€ vale
  // SOLO se nel round aveva 0€ (altrimenti il round stesso vale gia` di
  // piu` di 1000€ nella maggior parte dei casi, e il bonus raddoppierebbe
  // un premio gia` alto). Tutti gli altri — vincitore compreso, ormai
  // svuotato — ripartono dal round successivo con 0€ di round: chi
  // accumulava senza dare la soluzione perde tutto quello che aveva messo
  // da parte nel round.
  const soldiPortatiACasa = g.soldiRound === 0 ? BONUS_VITTORIA_ROUND : g.soldiRound;
  g.soldiTotale += soldiPortatiACasa;
  Gioco.giocatori.forEach((giocatore) => {
    giocatore.soldiRound = 0;
  });

  Gioco.posizioniRivelate = new Set([...Gioco.fraseCorrente.testo].map((_, i) => i));
  disegnaTabellone();
  aggiornaSchedeGiocatori();
  Gioco.stato = "fine_round";

  // Punto 39 (28/09/2026, seconda dettatura): il round appena chiuso entra
  // nella classifica dei round vinti, e si segna se era l'ultimo previsto.
  Gioco.storicoRound.push({ numero: Gioco.numeroRoundCorrente, vincitoreNome: g.nome, vincitoreColore: g.colore });
  Gioco.ultimoRoundFinito = Gioco.numeroRoundCorrente >= Gioco.numeroRoundTotale;
  aggiornaSchedeGiocatori(); // rifa` anche il pannello classifica, col round appena aggiunto

  // Regola 8 (28/09/2026): il round nuovo lo apre chi viene DOPO il vincitore,
  // mai il vincitore stesso — altrimenti chi vince e` troppo facilitato.
  // Punto 38: se questo era l'ultimo round non serve piu`, ma si calcola
  // comunque (costa nulla ed evita un ramo if in piu`).
  Gioco.indiceProssimoRound = (Gioco.indiceCorrente + 1) % Gioco.giocatori.length;

  // Undicesimo giro, voce 3 (28/09/2026): #testo-fine-round non si riempie
  // più — la festa animata (mostraFestaVittoria, qui sotto) ha già detto
  // nome, cifra e "ha risolto la frase!"; resta solo il pulsante, con chi
  // comincia il prossimo round nel suo stesso testo.
  if (Gioco.ultimoRoundFinito) {
    btnRoundSuccessivo.textContent = "Vedi la classifica finale";
  } else {
    btnRoundSuccessivo.textContent = "Prossimo round · comincia " + Gioco.giocatori[Gioco.indiceProssimoRound].nome;
  }
  // Il pannello resta pronto SOTTO alla festa animata (punto 30): quando la
  // festa si chiude (tocco o timeout) lo si trova gia` li`, pronto col
  // bottone giusto — nessun doppio giro di stato da gestire.
  pannelloFineRound.classList.remove("nascosta");
  mostraFestaVittoria(g, soldiPortatiACasa);
  aggiornaComandi();
}

btnRoundSuccessivo.addEventListener("click", () => {
  pannelloFineRound.classList.add("nascosta");
  if (Gioco.ultimoRoundFinito) {
    mostraSchermataFinale();
    return;
  }
  Gioco.indiceCorrente = Gioco.indiceProssimoRound;
  Gioco.numeroRoundCorrente += 1;
  nuovoRound();
});

// ---- SCHERMATA FINALE (punto 39, 28/09/2026, seconda dettatura) -----------
// Non si chiude da sola (Damiano, seconda dettatura): resta finché non si
// tocca "Gioca ancora" o "Torna all'inizio".
function mostraSchermataFinale() {
  fermaTimerChiusuraFesta(); // se la festa dell'ultimo round era ancora aperta
  overlayFesta.classList.add("nascosta");
  schermataGioco.classList.add("nascosta");
  schermataFinale.classList.remove("nascosta");

  const classificati = [...Gioco.giocatori].sort((a, b) => b.soldiTotale - a.soldiTotale);
  const vincitore = classificati[0];
  Audio_.festaVittoria();

  finaleVincitoreImmagineEl.textContent = vincitore.iniziale;
  finaleVincitoreImmagineEl.style.outlineColor = vincitore.colore;
  finaleVincitoreNomeEl.textContent = vincitore.nome;
  finaleVincitoreNomeEl.style.color = vincitore.colore;
  finaleVincitoreCifraEl.textContent = formattaMigliaia(vincitore.soldiTotale);

  finaleClassificaEl.innerHTML = "";
  classificati.forEach((giocatore, i) => {
    const riga = document.createElement("div");
    riga.className = "riga-classifica-finale";
    riga.style.borderLeftColor = giocatore.colore;
    riga.textContent = `${i + 1}. ${giocatore.nome} — ${euro(giocatore.soldiTotale)}`;
    finaleClassificaEl.appendChild(riga);
  });

  avviaFuochiFinale();
}

// Punto 46 (28/09/2026, nono giro): qualche "botto" di scintille a posizioni
// casuali sullo schermo, sfalsati nel tempo — poi si fermano da soli e la
// schermata finale resta sobria, come voleva Damiano ("dalle almeno la
// festa del round, più qualcosa"). Ogni botto si rimuove dal DOM appena
// finita la sua animazione: l'overlay non lascia residui dietro di se`.
function avviaFuochiFinale() {
  overlayFuochiFinaleEl.innerHTML = "";
  const raggio = Math.round(innerHeight * 0.24); // punto 54/rilievo 6: raggio proporzionale allo schermo
  const botto = () => {
    const b = document.createElement("div");
    b.className = "botto-fuochi";
    b.style.left = (12 + Math.random() * 76) + "%";
    b.style.top = (8 + Math.random() * 60) + "%";
    overlayFuochiFinaleEl.appendChild(b);
    creaScintille(b, FUOCHI_FINALE_PARTICELLE_PER_BURST, raggio);
    setTimeout(() => b.remove(), 1600);
  };
  for (let i = 0; i < FUOCHI_FINALE_BURST_N; i++) setTimeout(botto, i * 420);
  // Punto 40: la schermata finale resta finche` non la chiude qualcuno — i
  // botti iniziali durerebbero solo pochi secondi, poi un botto ogni
  // FUOCHI_FINALE_INTERVALLO_MS finche` la schermata resta a schermo.
  if (window.__fuochiTimer) clearInterval(window.__fuochiTimer);
  window.__fuochiTimer = setInterval(() => {
    if (schermataFinale.classList.contains("nascosta")) {
      clearInterval(window.__fuochiTimer);
      return;
    }
    botto();
  }, FUOCHI_FINALE_INTERVALLO_MS);
}

// "Gioca ancora": stessi giocatori (nomi, colori, disegnini), soldi e round
// azzerati, si riparte dal round 1.
btnGiocaAncora.addEventListener("click", () => {
  Gioco.giocatori.forEach((g) => {
    g.soldiRound = 0;
    g.soldiTotale = 0;
    g.jolly = 0;
  });
  Gioco.numeroRoundCorrente = 1;
  Gioco.storicoRound = [];
  Gioco.ultimoRoundFinito = false;
  schermataFinale.classList.add("nascosta");
  schermataGioco.classList.remove("nascosta");
  Gioco.indiceCorrente = Math.floor(Math.random() * Gioco.giocatori.length);
  nuovoRound();
  aggiornaSchedeGiocatori();
});

// "Torna all'inizio": si passa dalla schermata di iscrizione, per scegliere
// di nuovo giocatori e numero di round (Gioco.giocatori resta con le righe
// vecchie finché non si preme "Inizia la partita" un'altra volta).
btnTornaInizio.addEventListener("click", () => {
  schermataFinale.classList.add("nascosta");
  schermataIscrizione.classList.remove("nascosta");
});

function passaTurno() {
  Gioco.indiceCorrente = (Gioco.indiceCorrente + 1) % Gioco.giocatori.length;
  Gioco.stato = "idle";
  aggiornaSchedeGiocatori();
  aggiornaComandi();
}

// ---- VOLUME (punto 36, 28/09/2026) — sostituisce i vecchi interruttori
// sì/no separati per musica ed effetti: un solo pulsante altoparlanti apre
// un pannello con due cursori, assorbiti in Audio_ (vedi audio.js). --------

cursoreVolumeMusica.value = String(Math.round(Audio_.leggiVolumeMusicaCursore() * 100));
cursoreVolumeEffetti.value = String(Math.round(Audio_.leggiVolumeEffettiCursore() * 100));

function aggiornaIconaVolume() {
  const entrambiAZero = Audio_.leggiVolumeMusicaCursore() <= 0 && Audio_.leggiVolumeEffettiCursore() <= 0;
  btnVolume.textContent = entrambiAZero ? "🔇" : "🔊";
}
aggiornaIconaVolume();

function chiudiPannelloVolume() {
  pannelloVolume.classList.add("nascosta");
  btnVolume.setAttribute("aria-expanded", "false");
}

btnVolume.addEventListener("click", () => {
  const eraAperto = !pannelloVolume.classList.contains("nascosta");
  chiudiPannelloClassifica();
  if (eraAperto) {
    chiudiPannelloVolume();
  } else {
    pannelloVolume.classList.remove("nascosta");
    btnVolume.setAttribute("aria-expanded", "true");
  }
});

cursoreVolumeMusica.addEventListener("input", () => {
  Audio_.impostaVolumeMusica(Number(cursoreVolumeMusica.value) / 100);
  aggiornaIconaVolume();
});

cursoreVolumeEffetti.addEventListener("input", () => {
  Audio_.impostaVolumeEffetti(Number(cursoreVolumeEffetti.value) / 100);
  aggiornaIconaVolume();
});

// ---- CLASSIFICA (punto 39, 28/09/2026, seconda dettatura) -----------------

function chiudiPannelloClassifica() {
  pannelloClassifica.classList.add("nascosta");
  btnClassifica.setAttribute("aria-expanded", "false");
}

btnClassifica.addEventListener("click", () => {
  const eraAperto = !pannelloClassifica.classList.contains("nascosta");
  chiudiPannelloVolume();
  if (eraAperto) {
    chiudiPannelloClassifica();
  } else {
    pannelloClassifica.classList.remove("nascosta");
    btnClassifica.setAttribute("aria-expanded", "true");
  }
});

// Un tocco fuori da entrambi i pannelli li chiude — comodo su touch, dove
// non c'e` un "click fuori" ovvio come col mouse.
document.addEventListener("click", (ev) => {
  if (
    ev.target !== btnVolume &&
    !pannelloVolume.contains(ev.target) &&
    !pannelloVolume.classList.contains("nascosta")
  ) {
    chiudiPannelloVolume();
  }
  if (
    ev.target !== btnClassifica &&
    !pannelloClassifica.contains(ev.target) &&
    !pannelloClassifica.classList.contains("nascosta")
  ) {
    chiudiPannelloClassifica();
  }
});
