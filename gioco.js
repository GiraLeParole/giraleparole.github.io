// ============================================================================
// GIOCO — stato e logica di "Gira le Parole".
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
// GLI SPICCHI SPECIALI (2.4) — disegno di Chiara, 06/10/2026
// (design/2026-10-06-scheda-spicchi-speciali.md). Il tracciato di ogni simbolo
// sta in SPECIALI (config.js): qui lo stesso disegno come <svg>, copiato dal
// prototipo di Chiara.
// ----------------------------------------------------------------------------
function svgSimbolo(chiave) {
  const sp = SPECIALI[chiave];
  const parti = sp.simbolo.map((p) => {
    if (p.testo) return `<text x="50" y="54" text-anchor="middle" dominant-baseline="central">${p.testo}</text>`;
    if (p.fill) return `<path d="${p.d}" stroke="none"${p.regola ? ` fill-rule="${p.regola}"` : ""}/>`;
    return `<path d="${p.d}" fill="none" stroke-width="${p.stroke}"/>`;
  });
  return `<svg class="simbolo-speciale" viewBox="0 0 100 100" aria-hidden="true">${parti.join("")}</svg>`;
}
function pillola(chiave) {
  return `<span class="pillola-speciale">${svgSimbolo(chiave)}${SPECIALI[chiave].titolo}</span>`;
}
// I nomi dei giocatori li scrive chi gioca: dentro un testo con markup (i cartelli
// degli speciali) passano sempre da qui.
function escHtml(testo) {
  return String(testo).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// Una fonte sola per i colori: config.js (COLORE_SPECIALE*), qui passati al CSS.
document.documentElement.style.setProperty("--speciale", COLORE_SPECIALE);
document.documentElement.style.setProperty("--speciale-scuro", COLORE_SPECIALE_SCURO);

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
  giocatori: [],           // { nome, colore, soldiRound, soldiTotale, jolly, scudo }
  indiceCorrente: 0,
  frasiRimaste: [],        // coda mescolata delle frasi non ancora usate in questa partita
  fraseCorrente: null,     // { testo, categoria, difficolta, gruppi, indizio }
  // 05/10/2026 (Damiano): mai due frasi della stessa categoria nella stessa
  // partita, round lampo compresi. La categoria e` solo dietro le quinte;
  // sul tabellone si vede l'indizio (vedi testoTarga).
  categorieUsate: [],      // categorie gia` uscite in questa partita, la meno recente per prima
  frasiDellaPartita: new Set(), // le frasi gia` uscite in questa partita (round e lampi)
  ripieghiDiCategoria: 0,  // quante volte le categorie non sono bastate (serve alla prova, non al gioco)
  posizioniRivelate: new Set(),
  // Terzo giro, punto 16: lettere gia` trovate ma non ancora "scoperte" col
  // click del giocatore — accese sul tabellone, in attesa di un tocco.
  posizioniAccese: new Set(),
  lettereUsate: new Set(), // lettere gia tentate/comprate in questo round
  stato: "idle",           // idle | girando | scegli_consonante | scegli_vocale | attesa_jolly | attesa_express | risolvendo | rivelando | fine_round | scegli_casella | in_annuncio
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
  // Giro A (29/09/2026, voce A2/A4): l'aiutino usato in questo round, un
  // booleano per indice di Gioco.giocatori — azzerato in nuovoRound(). Il
  // premio di casa (voce A4) e` fisso per tutta la partita, scritto
  // all'iscrizione.
  aiutinoUsato: [],
  premioCasa: "",
  // Giro B, voce B1 (round lampo, lampo.js): se la partita lo prevede, e dopo
  // la fine di quali round (LAMPO_QUANDO, config.js) — estratti a ogni partita
  // da Lampo.pianifica().
  lampoAttivo: false,
  lampoDopo: new Set(),
  // Spicchi speciali (2.4): la coppia di speciali di ogni round (indice 0 = round 1),
  // estratta a ogni partita (programmaSpeciali, config.js; l'indice 0, il round 1, e` null: nel round 1 non ci sono speciali); e l'Express in corso:
  // null oppure { lettere, vinto } (quante consonanti giuste, quanto hanno reso).
  programmaSpeciali: [],
  express: null,
};

// Una partita (nuova o «Gioca ancora») ha il suo programma di speciali: si
// estrae qui e lo si da` alla ruota, prima che il round 1 sia impostato.
function preparaSpeciali() {
  Gioco.programmaSpeciali = programmaSpeciali(Gioco.numeroRoundTotale);
  Ruota.impostaProgrammaSpeciali(Gioco.programmaSpeciali);
}

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

// Cosa si legge sulla targa sotto il tabellone: l'indizio della frase. Se la
// frase non ce l'ha, la categoria (05/10/2026, Damiano).
function testoTarga(frase) {
  const indizio = typeof frase.indizio === "string" ? frase.indizio.trim() : "";
  return indizio || frase.categoria;
}

// Una partita nuova riparte senza categorie ne' frasi gia` uscite.
function azzeraCategorieDellaPartita() {
  Gioco.categorieUsate = [];
  Gioco.frasiDellaPartita = new Set();
  Gioco.ripieghiDiCategoria = 0;
}

// Sceglie la frase del round (o del lampo, con `filtro` = «breve»). La regola
// (Damiano, 05/10/2026): MAI due frasi della stessa categoria nella stessa
// partita, contando round e lampi. In ordine:
//  1. una frase del mazzo che resta, di una categoria non ancora uscita;
//  2. se il mazzo non ne ha, una di quelle dei gruppi scelti (puo` essere gia`
//     uscita in una partita di prima, mai in questa);
//  3. RIPIEGO, solo se le categorie dei gruppi scelti sono finite: si
//     ricomincia dalla categoria uscita MENO di recente, con una frase non
//     ancora uscita in questa partita (e, se c'e`, ancora nel mazzo).
// Nessuna frase esce due volte nella stessa partita. Ritorna null solo se
// il filtro non lascia niente (il chiamante allora riprova senza filtro).
function scegliFraseDellaPartita(filtro) {
  const tutte = frasiDeiGruppi();
  if (Gioco.frasiRimaste.length === 0) Gioco.frasiRimaste = mescola(tutte);
  const buona = (f) => (!filtro || filtro(f)) && !Gioco.frasiDellaPartita.has(f);
  const nuova = (f) => !Gioco.categorieUsate.includes(f.categoria);
  const delMazzo = Gioco.frasiRimaste.filter(buona);
  const dellaPartita = tutte.filter(buona);
  let candidate = delMazzo.filter(nuova);
  if (!candidate.length) candidate = dellaPartita.filter(nuova);
  if (!candidate.length && dellaPartita.length) {
    Gioco.ripieghiDiCategoria += 1;
    const eta = (f) => Gioco.categorieUsate.indexOf(f.categoria);
    const menoRecente = Math.min(...dellaPartita.map(eta));
    candidate = dellaPartita.filter((f) => eta(f) === menoRecente);
    const ancoraNelMazzo = candidate.filter((f) => delMazzo.includes(f));
    if (ancoraNelMazzo.length) candidate = ancoraNelMazzo;
  }
  if (!candidate.length) return null;
  const frase = candidate[Math.floor(Math.random() * candidate.length)];
  Gioco.frasiRimaste = Gioco.frasiRimaste.filter((f) => f !== frase);
  Gioco.frasiDellaPartita.add(frase);
  Gioco.categorieUsate = Gioco.categorieUsate.filter((c) => c !== frase.categoria);
  Gioco.categorieUsate.push(frase.categoria); // l'ultima uscita sta in fondo
  return frase;
}

function prossimaFrase() {
  // Se anche senza filtro non resta nulla (non succede: servono piu` frasi
  // di quanti round e lampi ci siano) si pesca comunque dal mazzo.
  return scegliFraseDellaPartita() || mescola(frasiDeiGruppi()).pop();
}

// ----------------------------------------------------------------------------
// SCHERMATA 1 — ISCRIZIONE GIOCATORI (Giro A, 29/09/2026, disegno di Chiara —
// `design/2026-09-29-scheda-otto-idee.md`, voce A1): due colonne — "Chi
// gioca" (tessere dei giocatori, ognuno per sé o a squadre, posto vuoto che
// aggiunge un giocatore con un tocco) e "Stasera" (frasi, round, aiutino
// segnato in tessera, premio di casa). I nomi dell'ultima sera restano
// scritti: si tocca "Inizia" e via.
// ----------------------------------------------------------------------------

const listaGiocatoriEl = document.getElementById("lista-giocatori");
const btnAggiungiGiocatore = document.getElementById("btn-aggiungi-giocatore"); // resta nel DOM, nascosto: il posto vuoto lo sostituisce
const btnIniziaPartita = document.getElementById("btn-inizia-partita");
const erroreIscrizioneEl = document.getElementById("errore-iscrizione");
const modoGiocoEl = document.getElementById("modo-gioco");
const premioCasaEl = document.getElementById("premio-casa");
const lampoAttivoEl = document.getElementById("lampo-attivo");

// Undicesimo giro, punto 58, strada B (28/09/2026, scelta di Damiano: "la
// tessera con l'iniziale, moooolto carina"): la prima lettera del nome,
// maiuscola — niente da scegliere, niente disegnino, niente pannello a
// parte. "?" finche` il nome e` vuoto (stesso segnaposto di prima).
function inizialeDiNome(nome) {
  const car = (nome || "").trim().charAt(0);
  return car ? car.toUpperCase() : "?";
}

// Lo stato dell'iscrizione vive QUI, non nel DOM. Difetto trovato da Chiara
// (29/09/2026, scheda otto idee): `Gioco.giocatori` si costruiva leggendo
// `[...listaGiocatoriEl.children]` — con il "posto vuoto +" della nuova
// iscrizione quel posto sarebbe diventato un giocatore in più al primo
// avvio. Ora Gioco.giocatori si costruisce da Iscrizione (vedi
// btnIniziaPartita qui sotto), il DOM è solo la sua rappresentazione.
const Iscrizione = {
  modo: "singoli", // "singoli" | "squadre"
  giocatori: [{ nome: "", aiutino: false }, { nome: "", aiutino: false }],
  squadre: [
    { nome: "", componenti: [{ nome: "", aiutino: false }, { nome: "", aiutino: false }, { nome: "", aiutino: false }] },
    { nome: "", componenti: [{ nome: "", aiutino: false }, { nome: "", aiutino: false }, { nome: "", aiutino: false }] },
  ],
  premioCasa: "",
  lampoAttivo: false,
};

// I nomi dell'ultima partita restano scritti (scelta 1 della scheda,
// raccomandata da Chiara, approvata da Damiano): la sera normale e` aprire
// e toccare "Inizia la partita".
(function ricordaIscrizione() {
  try {
    const v = JSON.parse(window.localStorage.getItem(CHIAVE_ULTIMA_ISCRIZIONE));
    if (v && (v.modo === "singoli" || v.modo === "squadre")) {
      Iscrizione.modo = v.modo;
      if (Array.isArray(v.giocatori) && v.giocatori.length) {
        Iscrizione.giocatori = v.giocatori;
        // una partita salvata da soli (prima del 06/10/2026) riparte con due posti
        while (Iscrizione.giocatori.length < 2) Iscrizione.giocatori.push({ nome: "", aiutino: false });
      }
      if (Array.isArray(v.squadre) && v.squadre.length === 2) Iscrizione.squadre = v.squadre;
      if (typeof v.premioCasa === "string") Iscrizione.premioCasa = v.premioCasa;
      if (typeof v.lampoAttivo === "boolean") Iscrizione.lampoAttivo = v.lampoAttivo;
    }
  } catch (e) {}
})();
function salvaIscrizione() {
  try {
    window.localStorage.setItem(
      CHIAVE_ULTIMA_ISCRIZIONE,
      JSON.stringify({
        modo: Iscrizione.modo,
        giocatori: Iscrizione.giocatori,
        squadre: Iscrizione.squadre,
        premioCasa: Iscrizione.premioCasa,
        lampoAttivo: Iscrizione.lampoAttivo,
      })
    );
  } catch (e) {}
}

function tesseraIniziale(nome, colore, classe) {
  const t = document.createElement("div");
  t.className = "tessera-iniziale-iscrizione" + (classe ? " " + classe : "");
  t.setAttribute("aria-hidden", "true");
  t.style.outlineColor = colore;
  t.textContent = inizialeDiNome(nome);
  return t;
}

function interruttoreAiutino(oggetto) {
  const l = document.createElement("label");
  l.className = "interruttore";
  const i = document.createElement("input");
  i.type = "checkbox";
  i.checked = !!oggetto.aiutino;
  i.setAttribute("aria-label", "Aiutino");
  i.addEventListener("change", () => {
    oggetto.aiutino = i.checked;
    salvaIscrizione();
  });
  const leva = document.createElement("span");
  leva.className = "leva";
  leva.setAttribute("aria-hidden", "true");
  const testo = document.createElement("span");
  testo.className = "testo-interruttore";
  testo.textContent = "Aiutino";
  l.appendChild(i);
  l.appendChild(leva);
  l.appendChild(testo);
  return l;
}

function campoNome(oggetto, segnaposto, tessera) {
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 16;
  input.placeholder = segnaposto;
  input.value = oggetto.nome || "";
  input.addEventListener("input", () => {
    oggetto.nome = input.value;
    tessera.textContent = inizialeDiNome(input.value || segnaposto);
    salvaIscrizione();
  });
  return input;
}

function disegnaIscrizione() {
  listaGiocatoriEl.innerHTML = "";
  listaGiocatoriEl.classList.toggle("squadre", Iscrizione.modo === "squadre");
  [...modoGiocoEl.children].forEach((b) => {
    const on = b.dataset.modo === Iscrizione.modo;
    b.classList.toggle("selezionata", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  });

  if (Iscrizione.modo === "singoli") {
    Iscrizione.giocatori.forEach((g, i) => {
      const card = document.createElement("div");
      card.className = "riga-giocatore tessera-iscrizione";
      card.style.setProperty("--colore-giocatore", COLORI_GIOCATORI[i]);
      const t = tesseraIniziale(g.nome, COLORI_GIOCATORI[i]);
      card.appendChild(t);
      card.appendChild(campoNome(g, `Giocatore ${i + 1}`, t));
      card.appendChild(interruttoreAiutino(g));
      if (Iscrizione.giocatori.length > 2) {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "btn-rimuovi";
        x.textContent = "✕";
        x.setAttribute("aria-label", "Togli questo giocatore");
        x.addEventListener("click", () => {
          Iscrizione.giocatori.splice(i, 1);
          salvaIscrizione();
          disegnaIscrizione();
        });
        card.appendChild(x);
      }
      listaGiocatoriEl.appendChild(card);
    });
  } else {
    Iscrizione.squadre.forEach((s, i) => {
      const card = document.createElement("div");
      card.className = "riga-giocatore tessera-iscrizione tessera-squadra";
      card.style.setProperty("--colore-giocatore", COLORI_GIOCATORI[i]);
      const t = tesseraIniziale(s.nome || NOMI_SQUADRE_SEGNAPOSTO[i], COLORI_GIOCATORI[i]);
      card.appendChild(t);
      const nomeSquadra = campoNome(s, NOMI_SQUADRE_SEGNAPOSTO[i], t);
      nomeSquadra.addEventListener("input", () => {
        if (!nomeSquadra.value) t.textContent = inizialeDiNome(NOMI_SQUADRE_SEGNAPOSTO[i]);
      });
      card.appendChild(nomeSquadra);
      const comp = document.createElement("div");
      comp.className = "componenti";
      s.componenti.forEach((c, k) => {
        const riga = document.createElement("div");
        riga.className = "componente";
        const mt = tesseraIniziale(c.nome, COLORI_GIOCATORI[i]);
        riga.appendChild(mt);
        riga.appendChild(campoNome(c, k === 0 ? "chi c’è" : "", mt));
        riga.appendChild(interruttoreAiutino(c));
        comp.appendChild(riga);
      });
      card.appendChild(comp);
      listaGiocatoriEl.appendChild(card);
    });
  }
  disegnaPostoVuoto();
}

// Il posto vuoto vive accanto alla lista, MA non e` un giocatore: gioco.js
// non lo legge mai (vedi la nota sopra Iscrizione). E` solo il pulsante che
// aggiunge una tessera con un tocco.
let postoVuoto = null;
function disegnaPostoVuoto() {
  if (postoVuoto) postoVuoto.remove();
  postoVuoto = null;
  if (Iscrizione.modo !== "singoli" || Iscrizione.giocatori.length >= MAX_GIOCATORI) return;
  postoVuoto = document.createElement("button");
  postoVuoto.type = "button";
  postoVuoto.className = "tessera-vuota";
  postoVuoto.innerHTML = "<b>+</b><span>un altro</span>";
  postoVuoto.addEventListener("click", () => {
    Iscrizione.giocatori.push({ nome: "", aiutino: false });
    salvaIscrizione();
    disegnaIscrizione();
    listaGiocatoriEl.querySelector(".tessera-iscrizione:last-child input")?.focus();
  });
  listaGiocatoriEl.appendChild(postoVuoto);
}

modoGiocoEl.addEventListener("click", (ev) => {
  const b = ev.target.closest(".segmento");
  if (!b || b.dataset.modo === Iscrizione.modo) return;
  Iscrizione.modo = b.dataset.modo;
  salvaIscrizione();
  disegnaIscrizione();
});

premioCasaEl.value = Iscrizione.premioCasa;
premioCasaEl.addEventListener("input", () => {
  Iscrizione.premioCasa = premioCasaEl.value;
  salvaIscrizione();
});

lampoAttivoEl.checked = Iscrizione.lampoAttivo;
lampoAttivoEl.addEventListener("change", () => {
  Iscrizione.lampoAttivo = lampoAttivoEl.checked;
  salvaIscrizione();
});

disegnaIscrizione();

// ---- «Le nostre frasi», il quinto gruppo (giro C, non ancora costruito) ---
// Il chip compare solo se in questo browser esistono gia` frasi scritte in
// casa (CHIAVE_FRASI_NOSTRE) — oggi non esiste ancora la pagina che le
// scrive (C2), quindi il chip resta assente finche` GIRO_B_C_ATTIVO non
// diventa vero: qui il codice e` gia` pronto, non serve toccarlo giovedì.
(function gruppoFrasiNostre() {
  function leggiFrasiNostre() {
    try {
      const v = JSON.parse(window.localStorage.getItem(CHIAVE_FRASI_NOSTRE));
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }
  const nostre = leggiFrasiNostre();
  if (!GIRO_B_C_ATTIVO || !nostre.length || opzioniGruppiEl.querySelector(".nostre")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "opzione-gruppo nostre";
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `Le nostre frasi <small>· ${nostre.length}</small>`;
  b.addEventListener("click", () => {
    const on = b.classList.toggle("selezionata");
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  opzioniGruppiEl.appendChild(b);
})();

// ---- Le porte del giro C: finche` GIRO_B_C_ATTIVO (config.js) resta false,
// non si vedono — un solo interruttore per riaccenderle giovedì, senza
// toccare il markup. La leva del round lampo (giro B, costruito il
// 05/10/2026) ha il suo, LAMPO_ATTIVO. --------------------------------------
if (!GIRO_B_C_ATTIVO) {
  document.getElementById("btn-albo")?.classList.add("nascosta");
  document.getElementById("btn-frasi-nostre")?.classList.add("nascosta");
}
if (!LAMPO_ATTIVO) {
  document.getElementById("riga-lampo")?.classList.add("nascosta");
}

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

// ---- VERSIONE, NOVITÀ, MINI GUIDA (Giro A, voci A5/A6) --------------------
// NOVITA arriva da novita.js, generato da CHANGELOG.md (vedi
// genera-novita.mjs e pubblica.sh): mai scritto a mano nel gioco.
(function versioneENovita() {
  if (typeof NOVITA === "undefined" || !NOVITA.versioni || !NOVITA.versioni.length) return;
  const ultima = NOVITA.versioni[0];
  const versioneEl = document.getElementById("versione-gioco");
  if (versioneEl) versioneEl.textContent = "v " + ultima.versione;
  const pallino = document.querySelector("#btn-novita .pallino-nuovo");
  let viste = null;
  try { viste = window.localStorage.getItem(CHIAVE_NOVITA_VISTE); } catch (e) {}
  if (pallino) pallino.classList.toggle("acceso", viste !== ultima.versione);

  const elenco = document.getElementById("elenco-novita");
  NOVITA.versioni.forEach((v) => {
    const blocco = document.createElement("div");
    blocco.className = "versione-novita";
    blocco.innerHTML =
      `<h3>Versione ${v.versione}${v.titolo ? " · " + v.titolo : ""} <small>${v.data}</small></h3>` +
      `<ul>${v.voci.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    elenco.appendChild(blocco);
  });
  if (NOVITA.inArrivo && NOVITA.inArrivo.length) {
    const blocco = document.createElement("div");
    blocco.className = "versione-novita novita-in-arrivo";
    blocco.innerHTML = `<h3>In arrivo</h3><ul>${NOVITA.inArrivo.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    elenco.appendChild(blocco);
  }

  const fin = document.getElementById("finestra-novita");
  const finGuida = document.getElementById("finestra-guida");
  const btnTutte = document.getElementById("btn-tutte-novita");
  const segnaVista = () => {
    try { window.localStorage.setItem(CHIAVE_NOVITA_VISTE, ultima.versione); } catch (e) {}
    if (pallino) pallino.classList.remove("acceso");
  };
  const blocchi = () => [...elenco.querySelectorAll(".versione-novita")];
  // «Tutte le novità»: via il filtro, via il pulsante. Dal piede si vede sempre tutto.
  const mostraTutte = () => {
    blocchi().forEach((b) => b.classList.remove("gia-vista"));
    if (btnTutte) btnTutte.classList.remove("visibile");
  };
  // Le versioni stanno già nell'ordine di NOVITA.versioni (la più recente prima), poi «In arrivo»:
  // le prime `quante` sono quelle che mancano, le altre (compreso «In arrivo») si nascondono.
  const mostraSoloNuove = (quante) => {
    blocchi().forEach((b, i) => b.classList.toggle("gia-vista", i >= quante));
    if (btnTutte) btnTutte.classList.add("visibile");
  };
  document.getElementById("btn-novita")?.addEventListener("click", () => {
    mostraTutte();
    fin.classList.remove("nascosta");
    segnaVista();
  });
  btnTutte?.addEventListener("click", mostraTutte);
  document.getElementById("btn-chiudi-novita")?.addEventListener("click", () => fin.classList.add("nascosta"));
  fin.addEventListener("click", (ev) => { if (ev.target === fin) fin.classList.add("nascosta"); });
  // Esc chiude la finestra aperta, Novità o «Come si gioca».
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    fin.classList.add("nascosta");
    if (finGuida) finGuida.classList.add("nascosta");
  });

  // APERTURA DA SOLA (05/10/2026, scheda di Chiara, scelte decise da Damiano). Gira una
  // volta, all'avvio, sulla schermata di iscrizione: mai in partita. Prima si vede la
  // pagina per mezzo secondo, poi la finestra arriva sopra. La versione conta come vista
  // all'apertura. Se il browser non lascia scrivere (navigazione privata, file bloccato)
  // non si apre niente da soli, come prima: resta il pallino.
  const RITARDO_APERTURA_MS = 500;
  let memoriaOk = true;
  try {
    window.localStorage.setItem(CHIAVE_NOVITA_VISTE + "-prova", "1");
    window.localStorage.removeItem(CHIAVE_NOVITA_VISTE + "-prova");
  } catch (e) { memoriaOk = false; }
  if (!memoriaOk) return;
  if (viste === null) {
    // Prima visita in assoluto: a chi non conosce il gioco «cosa c'è di nuovo» non dice
    // niente. Si apre «Come si gioca»; la versione di oggi conta come vista.
    window.setTimeout(() => { finGuida?.classList.remove("nascosta"); segnaVista(); }, RITARDO_APERTURA_MS);
  } else if (viste !== ultima.versione) {
    // Versione nuova: le Novità con solo le versioni uscite dopo quella vista; se quella
    // vista non c'è più nell'elenco, tutte.
    const indice = NOVITA.versioni.findIndex((v) => v.versione === viste);
    mostraSoloNuove(indice < 0 ? NOVITA.versioni.length : indice);
    window.setTimeout(() => { fin.classList.remove("nascosta"); segnaVista(); }, RITARDO_APERTURA_MS);
  }
})();

// La mini guida «Come si gioca» — voce = il pezzo vero in piccolo (a
// sinistra) + nome e riga (a destra). Testi di Penna, da usare cosi` come
// sono (brief del 29/09/2026). Le voci 7-8 hanno ciascuna la sua leva: la 7
// (round lampo) segue LAMPO_ATTIVO, la 8 (frase premio) GIRO_B_C_ATTIVO
// (config.js). La 7 e` stata riscritta da Penna il 05/10/2026 con la regola
// nuova (un tocco o un tasto ferma le lettere, l'arbitro tocca la tessera).
const GUIDA = [
  { esempio: '<button class="primario">Gira la ruota</button>', nome: "Gira la ruota", testo: "Poi una consonante: prendi la cifra per ogni volta che c’è." },
  { esempio: "<button>Vocale · 500 €</button>", nome: "Vocale · 500 €", testo: "La paghi con i soldi del round, tutte le volte che vuoi." },
  { esempio: "<button>Do la soluzione</button>", nome: "Do la soluzione", testo: "Hai 20 secondi. Se è giusta, soldi del round in cassaforte." },
  { esempio: '<button class="aiutino">Aiutino</button>', nome: "Aiutino", testo: "Se ce l’hai, scegli una casella: si scoprono gratis tutte le sue lettere. Una a round." },
  { esempio: '<span class="tessera-guida">J</span>', nome: "Jolly", testo: "Su Bancarotta o Passa lo giochi: non perdi soldi né turno." },
  { esempio: '<button class="segmento selezionata" style="border-radius:999px">A squadre</button>', nome: "A squadre", testo: "Due squadre, e dentro la squadra si gioca un turno a testa." },
  { esempio: '<span class="interruttore"><span class="leva" style="background:var(--accento);border-color:var(--accento)"></span></span>', nome: "Round lampo", testo: "Le lettere escono da sole. La sai? Tocca lo schermo o un tasto, l’arbitro tocca la tua tessera: 15 secondi per scriverla, 500 € se è giusta." },
  { esempio: '<span class="tessera-guida">★</span>', nome: "Frase premio", testo: "Una sola a partita: se la risolvi, vinci una sorpresa." },
  // 2.4, voce C8 della scheda di Chiara (06/10/2026): sempre mostrata. Testo del disegno, da confermare a Penna (punto 74).
  { esempio: '<span class="pillole-guida">' + ["express", "robinhood", "mistero", "scudo"].map(pillola).join("") + '</span>', nome: "Spicchi speciali", testo: "Dal secondo round, due a round, e cambiano. Express: consonanti a raffica, 500 € l’una, ma se sbagli una lettera è bancarotta; o lo lasci, e prendi 200 €. Robin Hood: 500 € da chi è in testa. Mistero: sotto c’è 1.000 €, Passa o 500 € da regalare al secondo. Scudo: ti salva da una lettera sbagliata, da solo. Uno per volta." },
];
(function guida() {
  const elenco = document.getElementById("elenco-guida");
  // la 7 (round lampo) segue LAMPO_ATTIVO, la 8 (frase premio) GIRO_B_C_ATTIVO, la 9 (speciali) e` sempre mostrata
  const voci = GUIDA.filter((_, i) => i < 6 || (i === 6 && LAMPO_ATTIVO) || (i === 7 && GIRO_B_C_ATTIVO) || i === 8);
  voci.forEach((v) => {
    const es = document.createElement("div");
    es.className = "esempio";
    es.innerHTML = v.esempio;
    const t = document.createElement("div");
    t.className = "voce";
    t.innerHTML = `<b>${v.nome}</b>${v.testo}`;
    elenco.appendChild(es);
    elenco.appendChild(t);
  });
  const fin = document.getElementById("finestra-guida");
  document.getElementById("btn-guida")?.addEventListener("click", () => fin.classList.remove("nascosta"));
  document.getElementById("btn-chiudi-guida")?.addEventListener("click", () => fin.classList.add("nascosta"));
  fin.addEventListener("click", (ev) => { if (ev.target === fin) fin.classList.add("nascosta"); });
})();

btnIniziaPartita.addEventListener("click", () => {
  erroreIscrizioneEl.textContent = "";

  if (Iscrizione.modo === "singoli") {
    // 06/10/2026, decisione di Damiano: da soli il turno non passa mai e non
    // c'e` niente in gioco, quindi «ognuno per se`» parte da 2 giocatori.
    // (A squadre le squadre sono sempre due: anche da un giocatore l'una, sono due.)
    if (Iscrizione.giocatori.length < 2) {
      erroreIscrizioneEl.textContent = "Per giocare servono almeno due giocatori. Tocca il «+» per aggiungerne uno.";
      return;
    }
    Gioco.giocatori = Iscrizione.giocatori.map((g, i) => {
      const nome = (g.nome || "").trim() || `Giocatore ${i + 1}`;
      return {
        nome,
        colore: COLORI_GIOCATORI[i],
        iniziale: inizialeDiNome(nome),
        soldiRound: 0,
        soldiTotale: 0,
        jolly: 0,
        scudo: 0,
        aiutino: !!g.aiutino,
      };
    });
  } else {
    // A squadre (voce A3 della scheda): i componenti vuoti si ignorano
    // (minimo 1, massimo MAX_PER_SQUADRA per squadra).
    const squadreValide = Iscrizione.squadre.map((s, i) => {
      const componenti = s.componenti
        .filter((c) => (c.nome || "").trim())
        .slice(0, MAX_PER_SQUADRA)
        .map((c) => ({ nome: c.nome.trim(), iniziale: inizialeDiNome(c.nome), aiutino: !!c.aiutino }));
      return { indice: i, nome: (s.nome || "").trim() || NOMI_SQUADRE_SEGNAPOSTO[i], componenti };
    });
    if (squadreValide.some((s) => s.componenti.length < 1)) {
      erroreIscrizioneEl.textContent = "Ogni squadra ha bisogno di almeno un giocatore.";
      return;
    }
    Gioco.giocatori = squadreValide.map((s) => ({
      nome: s.nome,
      colore: COLORI_GIOCATORI[s.indice],
      iniziale: inizialeDiNome(s.nome),
      soldiRound: 0,
      soldiTotale: 0,
      jolly: 0,
      scudo: 0,
      componenti: s.componenti,
      mano: 0,
    }));
  }

  // Punto 38: quanti round dura questa partita.
  Gioco.numeroRoundTotale = numeroRoundScelto;
  Gioco.numeroRoundCorrente = 1;
  Gioco.storicoRound = [];
  Gioco.ultimoRoundFinito = false;
  // Voce D: una partita nuova non pesca dal mazzo dei gruppi scelti l'ultima
  // volta, che potevano essere diversi.
  Gioco.frasiRimaste = [];
  azzeraCategorieDellaPartita();
  // Voce A2/A4: l'aiutino usato si azzera round per round (vedi nuovoRound);
  // il premio di casa e il round lampo restano quelli scelti stasera.
  Gioco.aiutinoUsato = [];
  Gioco.premioCasa = premioCasaEl.value.trim();
  Gioco.lampoAttivo = LAMPO_ATTIVO && lampoAttivoEl.checked;
  Lampo.pianifica(); // dopo Gioco.numeroRoundTotale, qui sopra
  preparaSpeciali(); // prima di iniziaPartita(): nuovoRound() imposta il round 1 con la sua coppia
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

// Punto 69, quattordicesimo giro (29/09/2026, disegno di Chiara): lo
// sbiadimento delle tessere non di turno si ritocca da config.js
// (OPACITA_GIOCATORE_NON_DI_TURNO), non da qui — passa alla CSS con una
// custom property, cosi` la transizione resta nel foglio di stile.
document.documentElement.style.setProperty("--opacita-non-turno", OPACITA_GIOCATORE_NON_DI_TURNO);

const btnGira = document.getElementById("btn-gira");
const btnCompraVocale = document.getElementById("btn-compra-vocale");
btnCompraVocale.textContent = "Vocale · " + euro(COSTO_VOCALE); // voce 3, undicesimo giro: sempre allineato a COSTO_VOCALE
const btnRisolvi = document.getElementById("btn-risolvi");
// Giro A, voce A2: l'aiutino — pulsante + pannello "Scegli una casella".
const btnAiutino = document.getElementById("btn-aiutino");
const pannelloAiutino = document.getElementById("pannello-aiutino");
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

const pannelloExpress = document.getElementById("pannello-express");
const btnExpressSi = document.getElementById("btn-express-si");
const btnExpressNo = document.getElementById("btn-express-no");
const fasciaExpressEl = document.getElementById("fascia-express");
const btnExpressVocale = document.getElementById("btn-express-vocale");
const btnExpressSoluzione = document.getElementById("btn-express-soluzione");
btnExpressVocale.textContent = "Vocale · " + euro(COSTO_VOCALE);

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

// ---- LA X: finire la partita (06/10/2026, dettatura di Damiano) --------------
// Dalla partita non si tornava indietro se non ricaricando il sito. Ora la X in
// alto chiede «Vuoi finire la partita?»: con «No» (il pulsante col fuoco) non
// cambia niente; con «Sì» si ricarica la pagina. Si ricarica apposta: in una
// partita ci sono una decina di timer sparsi (soluzione, lampo, annunci, ruota,
// autoscoperta, festa, musica) e il modo sicuro di non lasciarne appeso nessuno
// e` ripartire pulito. I nomi, i premi e la leva del lampo sono salvati
// in localStorage (salvaIscrizione) e tornano scritti; il volume anche.
// Mentre la conferma e` aperta il gioco NON si ferma (timer e lettere vanno).
const overlayEsciEl = document.getElementById("overlay-esci");
const btnEsciNoEl = document.getElementById("btn-esci-no");
function apriConfermaEsci() {
  overlayEsciEl.classList.remove("nascosta");
  btnEsciNoEl.focus();
}
function chiudiConfermaEsci() {
  overlayEsciEl.classList.add("nascosta");
}
document.getElementById("btn-esci").addEventListener("click", apriConfermaEsci);
btnEsciNoEl.addEventListener("click", chiudiConfermaEsci);
document.getElementById("btn-esci-si").addEventListener("click", () => {
  Audio_.musicaFerma();
  salvaIscrizione();
  window.location.reload();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !overlayEsciEl.classList.contains("nascosta")) chiudiConfermaEsci();
});

let contestoJollyPendente = null; // "passa" | "bancarotta"

function iniziaPartita() {
  schermataIscrizione.classList.add("nascosta");
  schermataGioco.classList.remove("nascosta");
  // la freccia va alla ruota: la piega a ogni fotogramma secondo la lamella (ruota pesante, 05/10/2026)
  Ruota.init(canvasRuota, document.querySelector(".puntatore"));
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

// A squadre (Giro A, voce A3 della scheda), chi parla adesso non e` la
// squadra ma il componente che ha la mano — negli annunci "Tocca a" e`
// il suo nome che i ragazzi devono sentire; il colore resta quello della
// squadra. In "ognuno per sé" chi parla e` semplicemente il giocatore.
function chiTocca(g) {
  if (g.componenti && g.componenti.length) {
    const c = g.componenti[g.mano % g.componenti.length];
    return { nome: c.nome, iniziale: c.iniziale, colore: g.colore };
  }
  return { nome: g.nome, iniziale: g.iniziale, colore: g.colore };
}

// A ogni turno che finisce, se la squadra che ha appena giocato ha piu` di
// un componente, la mano passa al successivo dentro la squadra — cosi` la
// prossima volta che tocca a questa squadra parla qualcun altro.
function avanzaManoSquadra(g) {
  if (g && g.componenti && g.componenti.length) {
    g.mano = (g.mano + 1) % g.componenti.length;
  }
}

function nuovoRound() {
  fermaTimerAutoscoperta();
  Gioco.express = null; // un Express non si porta da un round all'altro
  // Giro A, voce A2: l'aiutino si usa al massimo una volta per round.
  Gioco.aiutinoUsato = Gioco.giocatori.map(() => false);
  if (tabelloneEl) tabelloneEl.classList.remove("scegli-casella");
  // Ogni round nuovo passa alla musichetta successiva fra le quattro
  // (richiesta di Damiano: "una diversa per ogni round, varia di piu`"),
  // compreso il primo round della partita — vedi Audio_.musicaProssimoRound.
  Audio_.musicaProssimoRound();
  Gioco.fraseCorrente = prossimaFrase();
  Gioco.posizioniRivelate = new Set();
  Gioco.posizioniAccese = new Set();
  Gioco.lettereUsate = new Set();
  // Punto 69, voce 4 (29/09/2026, disegno di Chiara): anche l'inizio round
  // assegna un turno e ora lo dice il palco ("Tocca a", qui sotto) — lo
  // stato resta "in_annuncio" finche` quel secondo tempo non ha finito.
  Gioco.stato = "in_annuncio";
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
      // 2.4: al posto di «la ruota vale di piu`», le due pillole degli speciali di questo round
      pillole: Gioco.programmaSpeciali[Gioco.numeroRoundCorrente - 1],
      durata: DURATA_ANNUNCIO_ROUND_MS,
    });
  } else {
    Annuncio.nascondi();
  }
  categoriaEl.textContent = testoTarga(Gioco.fraseCorrente); // l'indizio; la categoria solo se manca
  if (indicatoreRoundEl) indicatoreRoundEl.textContent = `Round ${Gioco.numeroRoundCorrente} di ${Gioco.numeroRoundTotale}`;
  disegnaPuntiRound();
  disegnaTabellone(true); // punto 45: le caselle-lettera si accendono con un'onda, solo all'apertura del round
  nascondiTuttiIPannelli();
  aggiornaComandi();
  aggiornaSchedeGiocatori();

  // Punto 69, voce 4: al round 1 il palco mostra subito «Tocca a»; dal round
  // 2 lo mostra dopo l'annuncio "Round N" (durata DURATA_ANNUNCIO_ROUND_MS),
  // 50ms prima che quello esca da solo, cosi` il palco non resta vuoto in
  // mezzo. In tutti e due i casi i comandi tornano solo alla fine.
  const attesaToccaA = Gioco.numeroRoundCorrente > 1 ? DURATA_ANNUNCIO_ROUND_MS - 50 : 0;
  setTimeout(() => {
    const p = chiTocca(giocatoreCorrente());
    Audio_.toccaA();
    Annuncio.mostra({
      stile: "tocca" + (p.nome.length > 12 ? " lungo" : ""),
      lettera: p.iniziale,
      colore: p.colore,
      sopra: "Tocca a",
      titolo: p.nome,
      durata: DURATA_TOCCA_A_MS,
    });
    setTimeout(() => { Gioco.stato = "idle"; aggiornaComandi(); }, DURATA_TOCCA_A_MS);
  }, attesaToccaA);
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
          // Giro A, voce A2: con l'aiutino in corso (Gioco.stato ===
          // "scegli_casella") una casella ancora coperta si sceglie con un
          // tocco — respira in CSS (.scegli-casella .coperta).
          if (Gioco.stato === "scegli_casella") {
            cella.setAttribute("role", "button");
            cella.setAttribute("tabindex", "0");
            cella.setAttribute("aria-label", "Scegli questa casella per l'aiutino");
            cella.addEventListener("click", () => sceltaCasellaAiutino(idx));
            cella.addEventListener("keydown", (ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                sceltaCasellaAiutino(idx);
              }
            });
          }
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

// Punto 69, quattordicesimo giro (29/09/2026, disegno di Chiara), voce 2: la
// tessera che entra in turno fa un balzo — ma SOLO quando l'indice del
// giocatore e` appena cambiato, non a ogni ridisegno per i soldi. Siccome
// aggiornaSchedeGiocatori ricostruisce la fila da zero (innerHTML = ""), il
// confronto va tenuto qui fuori, a livello di modulo.
let ultimoIndiceDisegnato = -1;

// Decimo giro (28/09/2026), disegno di Chiara, intervento 4: un numero
// grande per tessera (i soldi del round) e il resto piccolo — non piu` sei
// righe di testo per due numeri. I jolly diventano carte (.carta-jolly),
// non piu` un'emoji che su Linux esce come un quadratino.
function aggiornaSchedeGiocatori() {
  colonnaGiocatoriEl.innerHTML = "";
  // Giro B, voce B1: durante il round lampo nessuno e` di turno, quindi
  // nessuna tessera e` piena e nessuna sbiadita (e il «balzo» di chi entra in
  // turno non si consuma: resta per quando il round parte davvero).
  const inLampo = Gioco.stato === "lampo";
  const indiceCambiato = !inLampo && ultimoIndiceDisegnato !== Gioco.indiceCorrente;
  if (!inLampo) ultimoIndiceDisegnato = Gioco.indiceCorrente;
  Gioco.giocatori.forEach((g, i) => {
    const div = document.createElement("div");
    const inTurno = !inLampo && i === Gioco.indiceCorrente;
    // Punto 69, voce 1: il giocatore di turno e` l'unica tessera piena, al
    // 55% del suo colore (OPACITA_GIOCATORE_NON_DI_TURNO governa lo
    // sbiadimento delle altre, in CSS — qui resta lo sfondo del turno).
    div.className = "scheda-giocatore" + (inTurno ? " turno-attivo" : "")
      + (inTurno && indiceCambiato ? " entra-in-turno" : "");
    div.style.setProperty("--colore-giocatore", g.colore);
    div.style.borderLeftColor = g.colore;
    div.style.background = hexInRgba(g.colore, inTurno ? 0.55 : 0.16);

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
    // 2.4: lo Scudo tenuto, accanto alle carte Jolly (voce C7)
    for (let k = 0; k < (g.scudo || 0); k++) {
      const carta = document.createElement("span");
      carta.className = "carta-scudo";
      carta.title = "Scudo";
      carta.innerHTML = svgSimbolo("scudo");
      jolly.appendChild(carta);
    }

    info.appendChild(nome);
    info.appendChild(soldiRound);
    info.appendChild(soldiTotale);

    // Giro A, voce A3: a squadre, le mini-tessere dei componenti sotto il
    // nome — quella che ha la mano e` accesa, le altre attenuate.
    if (g.componenti && g.componenti.length) {
      const componentiEl = document.createElement("div");
      componentiEl.className = "componenti-squadra";
      g.componenti.forEach((c, k) => {
        const mini = document.createElement("span");
        mini.className = "mini" + (k === g.mano ? " in-mano" : "");
        mini.textContent = c.iniziale;
        mini.title = c.nome;
        componentiEl.appendChild(mini);
      });
      info.appendChild(componentiEl);
    }

    // Giro A, voce A2: la riga "aiutino" — per un giocatore singolo, sempre
    // che ce l'abbia; a squadre, solo quando ce l'ha chi ha la mano adesso
    // ("la riga compare quando ha la mano", scheda otto idee).
    const haAiutino = g.componenti ? (g.componenti[g.mano] && g.componenti[g.mano].aiutino) : g.aiutino;
    if (haAiutino) {
      const segno = document.createElement("div");
      segno.className = "segno-aiutino" + (Gioco.aiutinoUsato[i] ? " usato" : "");
      segno.textContent = "aiutino";
      info.appendChild(segno);
    }

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
  [pannelloVocali, pannelloConsonanti, pannelloExpress, pannelloJolly, pannelloSoluzione, pannelloFineRound, pannelloAiutino].forEach((p) =>
    p.classList.add("nascosta")
  );
  tabelloneEl.classList.remove("scegli-casella");
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
  const vocaliRimaste = VOCALI.some((v) => !letteraGiaUscita(v));
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
  // Giro A, voce A2: l'aiutino c'e` solo per chi ce l'ha (nelle squadre, il
  // componente che ha la mano adesso), e si spegne dopo l'uso nel round.
  const haAiutino = g.componenti ? (g.componenti[g.mano] && g.componenti[g.mano].aiutino) : g.aiutino;
  const usato = !!Gioco.aiutinoUsato[Gioco.indiceCorrente];
  btnAiutino.classList.toggle("nascosta", !haAiutino);
  btnAiutino.disabled = !idle || usato;
  aggiornaAvvisoLettereFinite(consonantiFinite, vocaliFinite);
}

// L'aiutino, toccato: si sceglie una casella coperta (Giro A, voce A2). Il
// turno NON passa — resta a chi ha appena scoperto la casella gratis.
btnAiutino.addEventListener("click", () => {
  if (Gioco.stato !== "idle" || Gioco.aiutinoUsato[Gioco.indiceCorrente]) return;
  Gioco.aiutinoUsato[Gioco.indiceCorrente] = true;
  Gioco.stato = "scegli_casella";
  nascondiTuttiIPannelli();
  tabelloneEl.classList.add("scegli-casella");
  pannelloAiutino.classList.remove("nascosta");
  disegnaTabellone();
  aggiornaSchedeGiocatori();
  aggiornaComandi();
});

function sceltaCasellaAiutino(idx) {
  if (Gioco.stato !== "scegli_casella") return;
  // Regola del 30/09/2026 (punto 79): l'aiutino scopre TUTTE le caselle della
  // lettera scelta, con la stessa resa di una lettera chiamata (accensione,
  // poi scoperta), ma senza soldi. La lettera entra fra le usate: chiamarla
  // dopo vale "è già uscita". Il turno resta a chi ha usato l'aiutino.
  const lettera = normalizzaLettera(Gioco.fraseCorrente.testo[idx]);
  Gioco.lettereUsate.add(lettera);
  posizioniCoperteDellaLettera(lettera).forEach((p) => Gioco.posizioniAccese.add(p));
  tabelloneEl.classList.remove("scegli-casella");
  pannelloAiutino.classList.add("nascosta");
  Audio_.letteraRivelata();
  disegnaTabellone();
  numeraCaselleAccese();
  Annuncio.mostra({ lettera, titolo: quanteVolte(Gioco.posizioniAccese.size) });
  aggiornaSchedeGiocatori();
  Gioco.stato = "rivelando";
  aggiornaComandi();
  avviaTimerAutoscoperta();
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

  // voce = { lettera?, titolo, sotto?, sopra?, colore?, stile?: 'no' | 'scena' | 'scena rosso' | 'scena oro' | 'tocca'[' lungo'], durata?: ms }
  // 2.4 (spicchi speciali), in piu`: sottoHtml (la riga sotto con markup), simbolo (chiave di SPECIALI al posto della lettera),
  // esito { classe, testo } (la carta del Mistero), robin { da, a, pedina } (Robin Hood), pillole [chiavi] (sotto «Round N»)
  // sopra/colore, punto 69 (29/09/2026, disegno di Chiara): il secondo tempo
  // «Tocca a» — sopra e` la riga piccola "Tocca a", colore e` il colore del
  // giocatore per l'anello della tessera e l'alone del nome (var CSS
  // --colore-giocatore, con fallback sull'accento se non passato).
  function mostra(voce) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (timerUscita) { clearTimeout(timerUscita); timerUscita = null; }
    annuncioEl.className = "annuncio " + (voce.stile || "");
    annuncioEl.innerHTML = "";
    if (voce.colore) annuncioEl.style.setProperty("--colore-giocatore", voce.colore);
    if (voce.robin) {
      // 2.4, Robin Hood: la tessera di chi e` in testa, il tragitto con la pedina, la tessera di chi riceve
      const blocco = document.createElement("div");
      blocco.className = "tessere-robin";
      const tessera = (g) => {
        const t = document.createElement("div");
        t.className = "annuncio-tessera";
        t.style.setProperty("--colore-giocatore", g.colore);
        t.textContent = g.iniziale;
        return t;
      };
      const tragitto = document.createElement("div");
      tragitto.className = "tragitto";
      const pedina = document.createElement("span");
      pedina.className = "pedina";
      pedina.textContent = voce.robin.pedina;
      tragitto.appendChild(pedina);
      blocco.appendChild(tessera(voce.robin.da));
      blocco.appendChild(tragitto);
      blocco.appendChild(tessera(voce.robin.a));
      annuncioEl.appendChild(blocco);
    } else if (voce.lettera || voce.simbolo || voce.esito) {
      const t = document.createElement("div");
      t.className = "annuncio-tessera" + (voce.esito ? " esito " + voce.esito.classe : "");
      if (voce.simbolo) t.innerHTML = svgSimbolo(voce.simbolo);      // 2.4: il simbolo di uno speciale al posto della lettera
      else if (voce.esito) t.innerHTML = voce.esito.testo;           // 2.4: la carta del Mistero (testo scritto qui, mai dai giocatori)
      else t.textContent = voce.lettera;
      annuncioEl.appendChild(t);
    }
    const testo = document.createElement("div");
    testo.className = "annuncio-testo";
    if (voce.sopra) {
      const sp = document.createElement("div");
      sp.className = "annuncio-sopra";
      sp.textContent = voce.sopra;
      testo.appendChild(sp);
    }
    const h = document.createElement("div");
    h.className = "annuncio-titolo";
    h.textContent = voce.titolo;
    testo.appendChild(h);
    if (voce.sotto || voce.sottoHtml) {
      const s = document.createElement("div");
      s.className = "annuncio-sotto";
      // sottoHtml: la riga con del markup (grassetto, simbolo); i nomi li passa gia` escHtml()
      if (voce.sottoHtml) s.innerHTML = voce.sottoHtml;
      else s.textContent = voce.sotto;
      testo.appendChild(s);
    }
    if (voce.pillole) {
      // 2.4: sotto «Round N», le due pillole di questo round
      const p = document.createElement("div");
      p.className = "annuncio-pillole";
      p.innerHTML = `<span class="etichetta">sulla ruota</span>` + voce.pillole.map(pillola).join("");
      testo.appendChild(p);
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
// Gioco.indiceCorrente. Punto 69 (29/09/2026): da quando il secondo tempo
// «Tocca a» legge il nome DOPO che passaTurno ha gia` avanzato l'indice
// (giocatoreCorrente(), in annunciaEPassaTurno), questa funzione non serve
// piu` a nessun testo — lasciata per chi la vuole ancora.
function nomeGiocatoreProssimo() {
  return Gioco.giocatori[(Gioco.indiceCorrente + 1) % Gioco.giocatori.length].nome;
}

function quanteVolte(n) {
  return n === 1 ? "ce n'è una" : "ce ne sono " + n;
}

// Mostra un annuncio che finisce con il turno che passa: i comandi restano
// spenti (stato diverso da "idle") finche` l'annuncio non ha finito il suo
// tempo — cosi` si vede cosa e` successo prima che tocchi al prossimo.
//
// Punto 69, quattordicesimo giro (29/09/2026, disegno di Chiara): il palco ha
// un secondo tempo. Il primo tempo (voce, come passato dal chiamante: "non
// c'è", "Passa!", "Bancarotta!"...) dice solo cosa e` successo. Allo scadere
// il turno passa (passaTurno, che ora non rimette idle da solo) e il palco
// mostra «Tocca a <nome>» per DURATA_TOCCA_A_MS: solo alla fine di QUESTO
// secondo tempo i comandi tornano.
function annunciaEPassaTurno(voce) {
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  Annuncio.mostra(voce);
  setTimeout(() => {
    passaTurno();
    const p = chiTocca(giocatoreCorrente());
    Audio_.toccaA();
    Annuncio.mostra({
      stile: "tocca" + (p.nome.length > 12 ? " lungo" : ""),
      lettera: p.iniziale,
      colore: p.colore,
      sopra: "Tocca a",
      titolo: p.nome,
      durata: DURATA_TOCCA_A_MS,
    });
    setTimeout(() => { Gioco.stato = "idle"; aggiornaComandi(); }, DURATA_TOCCA_A_MS);
  }, voce.durata);
}

// ---- GIRA LA RUOTA ---------------------------------------------------------

btnGira.addEventListener("click", () => {
  if (Gioco.stato !== "idle" || Ruota.inAnimazione()) return;
  Gioco.stato = "girando";
  aggiornaComandi();
  Audio_.inizioSpin();
  Annuncio.nascondi();

  // Ruota pesante (05/10/2026): niente piu` giri e durata decisi qui. La
  // ruota riceve una forza a caso (nessun argomento) e la fisica decide
  // quanti giri fa e quanto dura (config.js, LANCIO_GIRI_MIN/MAX).
  Ruota.gira(
    undefined,
    () => Audio_.tic(),
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

// Ruota pesante: un tic per piolo. La freccia non si muove piu` da qui, la
// piega ruota.js a ogni fotogramma (lamella).
function ticRuotaTrascinamento() {
  Audio_.tic();
}

function onTrascinamentoNonValido() {
  // Punto 62: sotto mezzo giro il lancio non conta. Ruota pesante
  // (05/10/2026): questa funzione ora si chiama AL RILASCIO, non a ruota
  // ferma — la ruota si pianta da sola in meno di un secondo
  // (ATTRITO_LANCIO_NON_VALIDO_RAD_S2) e intanto «Più forte!» e` gia` sul
  // palco. Lo stato resta "girando" e i comandi spenti finche` la ruota si
  // muove (Ruota.inAnimazione): li riaccende onRuotaFermaNonValida.
  // Voce B, tredicesimo giro (29/09/2026): "Più forte!" dice cosa fare
  // invece di dare un giudizio a chi ha tirato.
  Annuncio.mostra({ stile: "scena", titolo: "Più forte!", sotto: "rilancia la ruota", durata: DURATA_ANNUNCIO_MS });
}

// A ruota ferma dopo un lancio non valido: il turno non passa, si puo`
// riprovare all'istante.
function onRuotaFermaNonValida() {
  Gioco.stato = "idle";
  aggiornaComandi();
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
    onTrascinamentoNonValido,
    onRuotaFermaNonValida
  );
}

canvasRuota.addEventListener("pointerup", finisceTrascinamento);
canvasRuota.addEventListener("pointercancel", finisceTrascinamento);

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
    annunciaEPassaTurno({ stile: "scena", titolo: "Passa!", durata: DURATA_ANNUNCIO_MS });
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
      sotto: g.nome + " perde tutto",
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
  if (segmento.tipo === "speciale") {
    gestisciSpeciale(segmento.speciale, g);
    return;
  }
}

// ---- GLI SPICCHI SPECIALI (2.4) ----------------------------------------------
// Disegno di Chiara, 06/10/2026 (scheda, voce C4-C6). Cambiate da Damiano la
// sera del 06/10: Express rifiutato = 200 € fissi e si gira di nuovo; Scudo al
// massimo uno per giocatore. Regola di Alfred (non detta da Damiano): chi cade sullo Scudo avendone
// gia` uno gira di nuovo, senza prenderne un secondo.
//
// Suoni: nessuno nuovo, si riusano quelli che ci sono (Audio_.jolly per lo Scudo,
// letteraRivelata per i soldi che entrano, click per il «?» che si apre, passa,
// bancarotta, toccaA per il regalo).

// Dopo una mossa che NON chiude il turno: in Express si torna al pannello delle
// consonanti, altrimenti ai comandi di sempre.
function riapriExpress() {
  apriPannelloConsonanti();
}

function gestisciSpeciale(chiave, g) {
  if (chiave === "express") {
    apriPannelloExpress();
  } else if (chiave === "robinhood") {
    spicchioRobinHood(g);
  } else if (chiave === "mistero") {
    spicchioMistero(g);
  } else if (chiave === "scudo") {
    spicchioScudo(g);
  }
}

// Fine di un cartello dopo il quale si gira ancora: i comandi tornano.
function giraAncoraDopo(durata) {
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  setTimeout(() => { Gioco.stato = "idle"; aggiornaComandi(); }, durata);
}

// ---- Express ----
function apriPannelloExpress() {
  Gioco.stato = "attesa_express";
  pannelloExpress.classList.remove("nascosta");
  aggiornaComandi();
}

btnExpressSi.addEventListener("click", () => {
  if (Gioco.stato !== "attesa_express") return;
  pannelloExpress.classList.add("nascosta");
  Audio_.click();
  Gioco.express = { lettere: 0, vinto: 0 };
  Gioco.spicchioValore = EXPRESS_VALORE_LETTERA;
  Gioco.spicchioTipo = "express";
  apriPannelloConsonanti();
});

// Express rifiutato (Damiano, 06/10 sera): 200 € fissi e si gira di nuovo.
// I testi del cartello sono di Erbottega (nel disegno c'era «500 € a lettera»).
btnExpressNo.addEventListener("click", () => {
  if (Gioco.stato !== "attesa_express") return;
  const g = giocatoreCorrente();
  pannelloExpress.classList.add("nascosta");
  g.soldiRound += EXPRESS_RIFIUTO_VALORE;
  Audio_.letteraRivelata();
  aggiornaSchedeGiocatori();
  Annuncio.mostra({ stile: "scena oro", titolo: "+" + euro(EXPRESS_RIFIUTO_VALORE), sotto: "niente Express · gira ancora", durata: DURATA_ANNUNCIO_MS });
  giraAncoraDopo(DURATA_ANNUNCIO_MS);
});

// La fascia in testa al pannello delle consonanti, mentre si gioca l'Express.
function aggiornaFasciaExpress() {
  const e = Gioco.express;
  const conto = e && e.lettere > 0
    ? `<span class="conto"><b>${e.lettere}</b> ${e.lettere === 1 ? "lettera" : "lettere"} · <b>+${euro(e.vinto)}</b></span>`
    : "";
  fasciaExpressEl.innerHTML = svgSimbolo("express") + `EXPRESS · ${euro(EXPRESS_VALORE_LETTERA)} a lettera ` + conto;
}

// Vocale e Do la soluzione, sotto le consonanti, solo in Express.
function aggiornaAltreMosseExpress() {
  const g = giocatoreCorrente();
  const conto = VOCALE_SI_PAGA_COL_TOTALE ? g.soldiTotale : g.soldiRound;
  const vocaliRimaste = VOCALI.some((v) => !letteraGiaUscita(v));
  btnExpressVocale.disabled = conto < COSTO_VOCALE || !vocaliRimaste || vocaliFiniteNellaFrase();
  btnExpressSoluzione.disabled = false;
}

btnExpressVocale.addEventListener("click", () => {
  if (!Gioco.express || Gioco.stato !== "scegli_consonante") return;
  pannelloConsonanti.classList.add("nascosta");
  apriPannelloVocali();
});
btnExpressSoluzione.addEventListener("click", () => {
  if (!Gioco.express || Gioco.stato !== "scegli_consonante") return;
  pannelloConsonanti.classList.add("nascosta");
  apriPannelloSoluzione();
});

// Una lettera che non c'e` (o una soluzione sbagliata) durante l'Express: bancarotta,
// con il Jolly che puo` salvare come sempre. L'Express finisce in ogni caso.
let bancarottaDaExpress = false; // dice al «No, va cosi`» del Jolly quale riga scrivere
function testoBancarotta(g) {
  return bancarottaDaExpress ? "l’Express finisce: " + g.nome + " perde tutto" : g.nome + " perde tutto";
}
function bancarottaExpress() {
  const g = giocatoreCorrente();
  Gioco.express = null;
  bancarottaDaExpress = true;
  if (g.jolly > 0) {
    apriPannelloJolly("bancarotta");
    return;
  }
  Audio_.bancarotta();
  g.soldiRound = 0;
  g.soldiTotale = 0;
  aggiornaSchedeGiocatori();
  bancarottaDaExpress = false;
  annunciaEPassaTurno({
    stile: "scena rosso",
    titolo: "Bancarotta!",
    sotto: "l’Express finisce: " + g.nome + " perde tutto",
    durata: DURATA_ANNUNCIO_LUNGO_MS,
  });
}

// Una lettera gia` chiamata nell'Express non e` un errore: si dice e si riprova.
function expressGiaUscita(lettera) {
  Audio_.letteraGiaChiamata();
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  Annuncio.mostra({ lettera, stile: "no", titolo: "è già uscita", sotto: "riprova", durata: DURATA_ANNUNCIO_MS });
  setTimeout(riapriExpress, DURATA_ANNUNCIO_MS);
}

// ---- Robin Hood ----
// Chi e` in testa e` chi ha piu` soldi in CASSAFORTE (la classifica). Pari merito in
// testa: i 500 € si dividono a multipli di 50 €, il resto si perde (come il regalo del Mistero).
function dividiA50(importo, quanti) {
  return Math.floor(importo / quanti / 50) * 50;
}
function spicchioRobinHood(g) {
  const massimo = Math.max(...Gioco.giocatori.map((x) => x.soldiTotale));
  const inTesta = Gioco.giocatori.filter((x) => x.soldiTotale === massimo);
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  if (inTesta.includes(g)) {
    // sei tu in testa (anche a pari merito): niente da prendere
    Audio_.click();
    Annuncio.mostra({
      stile: "speciale robin ferma",
      robin: { da: g, a: g, pedina: euro(ROBIN_HOOD_VALORE) },
      titolo: "Robin Hood!",
      // a casseforti tutte vuote (dopo il round 1 puo` capitare) il testo di Chiara
      sotto: massimo === 0 ? "nessuno ha ancora soldi in cassaforte · gira ancora" : "sei tu in testa: niente da prendere · gira ancora",
      durata: DURATA_ROBIN_HOOD_MS,
    });
    giraAncoraDopo(DURATA_ROBIN_HOOD_MS);
    return;
  }
  const quota = dividiA50(Math.min(ROBIN_HOOD_VALORE, massimo), inTesta.length);
  const presi = quota * inTesta.length;
  inTesta.forEach((x) => { x.soldiTotale -= quota; });
  g.soldiRound += presi;
  const nomi = inTesta.map((x) => `<b>${escHtml(x.nome)}</b>`).join(" e ");
  Audio_.letteraRivelata();
  Annuncio.mostra({
    stile: "speciale robin",
    robin: { da: inTesta[0], a: g, pedina: euro(presi) },
    titolo: "Robin Hood!",
    sottoHtml: `${euro(presi)} da ${nomi}, ${inTesta.length === 1 ? "che è" : "che sono"} in testa · gira ancora`,
    durata: DURATA_ROBIN_HOOD_MS,
  });
  // le tessere della fila si aggiornano quando la pedina e` arrivata (1000 ms)
  setTimeout(aggiornaSchedeGiocatori, 1000);
  giraAncoraDopo(DURATA_ROBIN_HOOD_MS);
}

// ---- Mistero ----
function spicchioMistero(g) {
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  Audio_.click();
  Annuncio.mostra({ stile: "speciale mistero", simbolo: "mistero", titolo: "Mistero…", sotto: "cosa c’è sotto?" });
  setTimeout(() => svelaMistero(g, estraiMistero()), DURATA_MISTERO_COPERTO_MS);
}
function svelaMistero(g, sotto) {
  const stile = "speciale mistero gira"; // «gira»: la carta si volta (a 260 ms il contenuto e` gia` quello nuovo)
  if (sotto.esito === "soldi") {
    Audio_.letteraRivelata();
    Annuncio.mostra({
      stile,
      esito: { classe: "soldi", testo: formattaMigliaia(sotto.valore) + "<br>€" },
      titolo: `${euro(sotto.valore)} a lettera!`,
      sotto: "scegli una consonante",
      durata: DURATA_ANNUNCIO_MS,
    });
    setTimeout(() => {
      impostaTitoloConsonanti(`<b>${euro(sotto.valore)}</b> a lettera · scegli una consonante`);
      Gioco.spicchioValore = sotto.valore;
      Gioco.spicchioTipo = "soldi";
      apriPannelloConsonanti();
    }, DURATA_ANNUNCIO_MS);
  } else if (sotto.esito === "passa") {
    Audio_.passa();
    const voce = { stile, esito: { classe: "passa", testo: "PASSA" }, titolo: "Passa!", durata: DURATA_ANNUNCIO_MS };
    if (g.jolly > 0) {
      // il ramo Passa di sempre, Jolly compreso: dopo la carta si chiede se lo si usa
      Annuncio.mostra(voce);
      setTimeout(() => apriPannelloJolly("passa"), DURATA_ANNUNCIO_MS);
    } else {
      annunciaEPassaTurno(voce);
    }
  } else {
    // regalo: dalla cassaforte di g a quella del secondo in classifica (se il secondo
    // e` g, al terzo; con due soli giocatori, all'altro). Pari merito: diviso a 50 €.
    const ordine = Gioco.giocatori.slice().sort((a, b) => b.soldiTotale - a.soldiTotale);
    let beneficiario = ordine[1];
    if (beneficiario === g) beneficiario = ordine[2] || ordine[0];
    const beneficiari = Gioco.giocatori.filter((x) => x !== g && x.soldiTotale === beneficiario.soldiTotale);
    const quota = dividiA50(Math.min(sotto.valore, g.soldiTotale), beneficiari.length);
    const dato = quota * beneficiari.length;
    g.soldiTotale -= dato;
    beneficiari.forEach((x) => { x.soldiTotale += quota; });
    aggiornaSchedeGiocatori();
    Audio_.toccaA();
    if (dato > 0) {
      Annuncio.mostra({
        stile,
        esito: { classe: "regalo", testo: "−" + formattaMigliaia(dato) + "<br>€" },
        titolo: `Regali ${euro(dato)}`,
        sottoHtml: `a ${beneficiari.map((x) => `<b>${escHtml(x.nome)}</b>`).join(" e ")}, ${beneficiari.length === 1 ? "secondo" : "secondi"} in classifica · gira ancora`,
        durata: DURATA_ANNUNCIO_LUNGO_MS,
      });
    } else {
      // niente in cassaforte: niente da regalare (se e` vuota per tutti, il testo di Chiara; titolo di Erbottega)
      Annuncio.mostra({
        stile,
        esito: { classe: "regalo", testo: "0<br>€" },
        titolo: "Niente da regalare",
        sotto: Gioco.giocatori.every((x) => x.soldiTotale === 0) ? "nessuno ha ancora soldi in cassaforte · gira ancora" : "la cassaforte è vuota · gira ancora",
        durata: DURATA_ANNUNCIO_LUNGO_MS,
      });
    }
    giraAncoraDopo(DURATA_ANNUNCIO_LUNGO_MS);
  }
}

// ---- Scudo ----
function spicchioScudo(g) {
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  Audio_.jolly();
  if (g.scudo >= SCUDO_MASSIMO) {
    // ne ha gia` uno (regola di Alfred, Damiano non l'ha detta): gira ancora, senza prenderne un secondo
    Annuncio.mostra({ stile: "speciale", simbolo: "scudo", titolo: "Scudo!", sotto: "ne hai già uno · gira ancora", durata: DURATA_SCUDO_PRESO_MS });
  } else {
    g.scudo += 1;
    aggiornaSchedeGiocatori();
    Annuncio.mostra({ stile: "speciale", simbolo: "scudo", titolo: "Scudo!", sotto: "ti salva da una lettera sbagliata · gira ancora", durata: DURATA_SCUDO_PRESO_MS });
  }
  giraAncoraDopo(DURATA_SCUDO_PRESO_MS);
}

// Lo Scudo che scatta: su una consonante o una vocale che non c'e` o e` gia` uscita,
// ma non nell'Express (li` e` l'all-in). La lettera conta come chiamata, il turno non passa.
function scudoPuoSalvare() {
  return giocatoreCorrente().scudo > 0 && !Gioco.express;
}
function scudoSalva(lettera, titolo) {
  const g = giocatoreCorrente();
  Gioco.lettereUsate.add(lettera);
  Audio_.jolly();
  // lo scudo sulla tessera si gonfia e sparisce (600 ms); la fila si ridisegna a fine cartello
  const carta = colonnaGiocatoriEl.children[Gioco.indiceCorrente]?.querySelector(".carta-scudo");
  if (carta) carta.classList.add("scatta");
  g.scudo -= 1;
  Gioco.stato = "in_annuncio";
  aggiornaComandi();
  Annuncio.mostra({
    lettera,
    stile: "no speciale",
    titolo,
    sottoHtml: svgSimbolo("scudo") + " lo Scudo ti ha salvato · gira ancora",
    durata: DURATA_SCUDO_SCATTA_MS,
  });
  setTimeout(() => {
    aggiornaSchedeGiocatori();
    Gioco.stato = "idle";
    aggiornaComandi();
  }, DURATA_SCUDO_SCATTA_MS);
}

// ---- CONSONANTI -------------------------------------------------------------

function apriPannelloConsonanti() {
  Gioco.stato = "scegli_consonante";
  grigliaConsonanti.innerHTML = "";
  // Express (2.4): fascia in testa, titolo «un'altra», Vocale e Do la soluzione sotto.
  // Finite le consonanti il pannello non si chiude: restano solo quelle due mosse.
  const inExpress = Gioco.spicchioTipo === "express" && !!Gioco.express;
  pannelloConsonanti.classList.toggle("express", inExpress);
  const consonantiFinite = inExpress && consonantiFiniteNellaFrase();
  if (inExpress) {
    aggiornaFasciaExpress();
    impostaTitoloConsonanti(consonantiFinite ? "Consonanti finite" : Gioco.express.lettere > 0 ? "Un’altra consonante" : "Scegli una consonante");
    aggiornaAltreMosseExpress();
  }
  (consonantiFinite ? [] : CONSONANTI).forEach((lettera) => {
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

// Le occorrenze della lettera che sono ANCORA coperte: ne restano fuori
// quelle gia` rivelate o accese in attesa di un tocco.
function posizioniCoperteDellaLettera(lettera) {
  return posizioniDellaLettera(lettera).filter(
    (p) => !Gioco.posizioniRivelate.has(p) && !Gioco.posizioniAccese.has(p)
  );
}

// "Gia` uscita": chiamata prima in questo round, OPPURE presente nella frase
// ma con tutte le occorrenze gia` scoperte (caso dell'aiutino, 30/09/2026).
// Una lettera che nella frase non c'e` affatto non e` "gia` uscita": e` "non c'e`".
function letteraGiaUscita(lettera) {
  if (Gioco.lettereUsate.has(lettera)) return true;
  return posizioniDellaLettera(lettera).length > 0 && posizioniCoperteDellaLettera(lettera).length === 0;
}

function sceltaConsonante(lettera) {
  pannelloConsonanti.classList.add("nascosta");

  // Punto 35 (28/09/2026): una consonante già chiamata — sul tabellone o
  // già tentata e risultata assente — fa finire il turno senza soldi.
  // Vale allo stesso modo sullo spicchio JOLLY (nessun ramo separato).
  if (letteraGiaUscita(lettera)) {
    if (Gioco.express) { expressGiaUscita(lettera); return; }          // 2.4: nell'Express si riprova
    if (scudoPuoSalvare()) { scudoSalva(lettera, "è già uscita"); return; } // 2.4: lo Scudo
    Audio_.letteraGiaChiamata();
    annunciaEPassaTurno({
      lettera,
      stile: "no",
      titolo: "è già uscita",
      durata: DURATA_ANNUNCIO_LUNGO_MS,
    });
    return;
  }

  Gioco.lettereUsate.add(lettera);
  const posizioni = posizioniCoperteDellaLettera(lettera);

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
    } else if (Gioco.express) {
      // 2.4: una consonante giusta nell'Express; poi si riapre il pannello (finalizzaRivelazione)
      Gioco.express.lettere += 1;
      Gioco.express.vinto += importoVinto;
      Audio_.letteraRivelata();
      disegnaTabellone();
      numeraCaselleAccese();
      Annuncio.mostra({ lettera, titolo: quanteVolte(posizioni.length), sotto: "+" + euro(importoVinto) + " · un’altra!" });
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
    if (Gioco.express) { Audio_.letteraAssente(); bancarottaExpress(); return; } // 2.4: nell'Express una lettera che non c'e` e` bancarotta
    if (scudoPuoSalvare()) { scudoSalva(lettera, "non c’è"); return; }           // 2.4: lo Scudo
    Audio_.letteraAssente();
    if (Gioco.spicchioTipo === "jolly") {
      annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", sotto: "niente Jolly", durata: DURATA_ANNUNCIO_MS });
    } else if (Gioco.spicchioTipo === "raddoppia") {
      annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", sotto: "niente raddoppio", durata: DURATA_ANNUNCIO_MS });
    } else {
      annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", durata: DURATA_ANNUNCIO_MS });
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
  // 2.4: nell'Express, a frase non finita, si torna al pannello delle consonanti
  if (Gioco.express && !fraseCompletamenteRivelata()) {
    riapriExpress();
    return;
  }
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
  apriPannelloVocali();
});

function apriPannelloVocali() {
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
}

btnAnnullaVocale.addEventListener("click", () => {
  pannelloVocali.classList.add("nascosta");
  if (Gioco.express) { riapriExpress(); return; } // 2.4: in Express si torna alle consonanti
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
  if (letteraGiaUscita(lettera)) {
    // 2.4, Express: una lettera gia` chiamata non e` un errore, non costa nulla, si riprova
    if (Gioco.express) { expressGiaUscita(lettera); return; }
    g[contoPerLaVocale] -= COSTO_VOCALE;
    aggiornaSchedeGiocatori();
    if (scudoPuoSalvare()) { scudoSalva(lettera, "è già uscita"); return; } // 2.4: lo Scudo (la vocale si paga lo stesso)
    Audio_.letteraGiaChiamata();
    if (VOCALE_GIA_CHIAMATA_PERDE_TURNO) {
      annunciaEPassaTurno({
        lettera,
        stile: "no",
        titolo: "è già uscita",
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
  const posizioni = posizioniCoperteDellaLettera(lettera);

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
    aggiornaSchedeGiocatori();
    // 2.4: nell'Express una lettera che non c'e` e` bancarotta, vocale compresa
    // (scelta di Erbottega: Damiano dice «una lettera che non c'e`», non «consonante»)
    if (Gioco.express) { Audio_.letteraAssente(); bancarottaExpress(); return; }
    if (scudoPuoSalvare()) { scudoSalva(lettera, "non c’è"); return; } // 2.4: lo Scudo (la vocale si paga lo stesso)
    Audio_.letteraAssente();
    if (VOCALE_ASSENTE_PERDE_TURNO) {
      annunciaEPassaTurno({ lettera, stile: "no", titolo: "non c’è", durata: DURATA_ANNUNCIO_MS });
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
  bancarottaDaExpress = false;
  aggiornaComandi();
});

btnJollyNo.addEventListener("click", () => {
  const g = giocatoreCorrente();
  const contesto = contestoJollyPendente;
  pannelloJolly.classList.add("nascosta");
  contestoJollyPendente = null;
  if (contesto === "passa") {
    Audio_.passa();
    annunciaEPassaTurno({ stile: "scena", titolo: "Passa!", durata: DURATA_ANNUNCIO_MS });
  } else {
    Audio_.bancarotta();
    g.soldiRound = 0;
    g.soldiTotale = 0;
    aggiornaSchedeGiocatori();
    annunciaEPassaTurno({
      stile: "scena rosso",
      titolo: "Bancarotta!",
      sotto: testoBancarotta(g), // 2.4: «l'Express finisce: ... perde tutto» se veniva dall'Express
      durata: DURATA_ANNUNCIO_LUNGO_MS,
    });
  }
  bancarottaDaExpress = false;
});

// ---- RISOLVI (con timer) -----------------------------------------------------

btnRisolvi.addEventListener("click", () => {
  if (Gioco.stato !== "idle") return;
  apriPannelloSoluzione();
});

function apriPannelloSoluzione() {
  Gioco.stato = "risolvendo";
  pannelloSoluzione.classList.remove("nascosta");
  inputSoluzione.value = "";
  inputSoluzione.focus();
  aggiornaComandi();
  avviaTimerSoluzione();
}

function avviaTimerSoluzione() {
  let secondi = SECONDI_PER_LA_SOLUZIONE;
  // la barra riparte da piena e si consuma in SECONDI_PER_LA_SOLUZIONE secondi
  // (stessa barra del round lampo, 06/10/2026): il tempo resta quello del timer
  const barra = document.getElementById("riempimento-soluzione");
  barra.style.animation = "none";
  void barra.offsetWidth;
  barra.style.animation = "";
  barra.style.animationDuration = SECONDI_PER_LA_SOLUZIONE + "s";
  secondiRimastiEl.textContent = String(secondi);
  fermaTimerSoluzione();
  Gioco.timerSoluzione = setInterval(() => {
    secondi -= 1;
    secondiRimastiEl.textContent = String(Math.max(0, secondi));
    if (secondi <= 0) {
      fermaTimerSoluzione();
      pannelloSoluzione.classList.add("nascosta");
      // 2.4: nell'Express il tempo scaduto vale una soluzione sbagliata (scelta di Erbottega)
      if (Gioco.express) { bancarottaExpress(); return; }
      annunciaEPassaTurno({ stile: "scena", titolo: "Tempo scaduto", durata: DURATA_ANNUNCIO_MS });
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
  } else if (Gioco.express) {
    bancarottaExpress(); // 2.4: soluzione sbagliata durante l'Express = bancarotta
  } else {
    annunciaEPassaTurno({ stile: "scena", titolo: "Non è questa", durata: DURATA_ANNUNCIO_MS });
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
  Gioco.express = null; // 2.4: l'Express finisce con il round
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
  // Giro A, voce A3: anche il round vinto e` un turno che finisce — la mano
  // passa al componente successivo della squadra vincitrice.
  avanzaManoSquadra(g);

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
    // Giro B, voce B1: se fra questo round e il prossimo c'e` il lampo, a
    // aprire il round sara` chi lo vince, non chi verrebbe comunque.
    btnRoundSuccessivo.textContent = Lampo.dovuto(Gioco.numeroRoundCorrente)
      ? "Round lampo · tutti pronti" // testo di Penna 05/10/2026, da rivedere quando Damiano prova il gioco
      : "Prossimo round · comincia " + Gioco.giocatori[Gioco.indiceProssimoRound].nome;
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
  // Giro B, voce B1: fra questo round e il prossimo puo` esserci il lampo
  // (lampo.js). A lampo finito il round parte comunque da qui: apre chi ha
  // vinto il lampo, o chi verrebbe comunque (indiceProssimoRound) se non l'ha
  // vinto nessuno.
  const apriRound = (indice) => {
    Gioco.indiceCorrente = indice;
    Gioco.numeroRoundCorrente += 1;
    nuovoRound();
  };
  if (Lampo.dovuto(Gioco.numeroRoundCorrente)) {
    Lampo.avvia(apriRound);
    return;
  }
  apriRound(Gioco.indiceProssimoRound);
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
  Audio_.jingleFinale(); // 06/10/2026: un jingle suo, diverso da quello della festa del round e da quello del lampo

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

  // Giro A, voce A4: il premio di casa, solo se all'iscrizione era stato
  // scritto qualcosa in "In palio stasera".
  const premioCasaEl2 = document.getElementById("finale-premio-casa");
  const premioCasaTestoEl = document.getElementById("finale-premio-testo");
  if (premioCasaEl2 && premioCasaTestoEl) {
    const testo = Gioco.premioCasa || "";
    premioCasaTestoEl.textContent = testo;
    premioCasaEl2.classList.toggle("nascosta", !testo);
  }

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
    g.scudo = 0;
    if (g.componenti) g.mano = 0;
  });
  Gioco.numeroRoundCorrente = 1;
  Gioco.storicoRound = [];
  Gioco.ultimoRoundFinito = false;
  Lampo.pianifica(); // una partita nuova, un lampo estratto di nuovo
  preparaSpeciali(); // e due speciali nuovi per ogni round
  azzeraCategorieDellaPartita(); // e di nuovo tutte le categorie a disposizione
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

// Punto 69 (29/09/2026): non rimette piu` lo stato a "idle" da solo — quello
// arriva alla fine del secondo tempo «Tocca a» (vedi annunciaEPassaTurno).
// Qui si avanza l'indice e si ridisegna la fila (col balzo sulla tessera
// nuova, vedi aggiornaSchedeGiocatori).
function passaTurno() {
  // Giro A, voce A3: la squadra che ha appena giocato passa la mano al
  // componente successivo, PRIMA di lasciare il turno alla squadra dopo.
  avanzaManoSquadra(giocatoreCorrente());
  Gioco.indiceCorrente = (Gioco.indiceCorrente + 1) % Gioco.giocatori.length;
  aggiornaSchedeGiocatori();
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
