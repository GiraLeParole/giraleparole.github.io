// ============================================================================
// CONFIGURAZIONE DEL GIOCO — GIRA LE PAROLE
// Tutto quello che Damiano vuole poter ritoccare giocando sta qui, in un solo
// punto. Non serve capire il resto del codice per cambiare questi numeri.
// ============================================================================

// ----------------------------------------------------------------------------
// LA RUOTA — composizione degli spicchi.
// ----------------------------------------------------------------------------
// Ogni spicchio e un oggetto con:
//   tipo:    "soldi" | "passa" | "bancarotta" | "jolly" | "speciale"
//   valore:  il premio in euro (solo per tipo "soldi")
//   colore:  colore di sfondo dello spicchio
//   testo:   colore del testo scritto sopra
//
// Sono 24 spicchi (il minimo chiesto era 20). Larghezza uguale per tutti
// (360/24 = 15 gradi ciascuno) — piu semplice da disegnare e da capire.
//
// Scelte fatte per rispettare le indicazioni di Damiano (28/09/2026, punto 3):
// - PASSA: 2 spicchi (quattordicesimo giro, punto 75, 29/09/2026 — "come nel
//   programma in TV di oggi", Damiano lo vedeva in diretta mentre lo diceva).
//   Prima erano 4, a distanza di 6 fra loro (due coppie gia` opposte a 12).
//   Tenuta la coppia agli indici 3 e 15 (opposta, 12 spicchi esatti), gli
//   altri due Passa (indici 9 e 21) sono diventati spicchi "soldi": 800€
//   all'indice 9 e 400€ all'indice 21, scelti da Erbottega per non
//   addensare valori uguali nella stessa zona di ruota — l'indice 9 stava
//   fra due spicchi bassi (400€, 500€) e ora porta un valore alto, l'indice
//   21 stava fra due spicchi alti (900€, 1000€) e ora porta un valore basso.
//   Cosi` restavano 2 copie per ognuno dei 7 livelli invariati e 3 copie per
//   400€ e 800€. DAL 06/10/2026 (2.4) quei due spicchi sono i due posti degli
//   SPECIALI, ma solo DAL ROUND 2 (Damiano: nel round 1 non ce ne sono, come
//   in TV): nel round 1 la ruota e` identica a quella della 2.3, con questi
//   due spicchi coi soldi; dal round 2 ruota.js li fa tipo "speciale" e ogni
//   livello di cifra ha ESATTAMENTE due copie (18 spicchi "soldi" su 9 livelli). Prima, verificato con
//   `node design/strumenti/colori-round.mjs livello` su tutti e 7 i round:
//   nessuna coppia di spicchi vicini dello stesso colore.
// - BANCAROTTA: 2 spicchi in tutto. Damiano non era sicuro fra 2 e 3 ("mi
//   sa"): ho scelto 2 perche uno dei due sta gia dentro lo spicchio triplo
//   qui sotto, quindi il "peso" percepito sulla ruota e comunque alto.
//   Se in prova coi ragazzi sembra poco, aggiungerne una terza qui e la cosa
//   piu facile da ritoccare di tutto questo file.
// - Lo SPICCHIO TRIPLO (indici 11-13 dell'array, marcati qui sotto): tre
//   spicchi stretti consecutivi che imitano l'effetto TV "bancarotta al
//   centro, cifra alta ai due lati" — non e un vero settore unico diviso in
//   tre (avrebbe richiesto disegno a mano sul canvas), sono tre fette normali
//   messe una via l'altra. Visivamente sulla ruota si legge come il pezzo
//   "raddoppia / bancarotta / raddoppia" di cui parlava Damiano.
// Decimo giro (28/09/2026): ruota ridisegnata da Chiara come quella della TV
// (`design/2026-09-28-revisione.md`, intervento 2). I «Passa» restano
// spicchi BIANCHI con scritta scura, come deciso al terzo giro, punto 11.
const COLORE_PASSA = "#F7F3E8";
const TESTO_PASSA = "#20233A";

// ----------------------------------------------------------------------------
// GLI SPICCHI SPECIALI (2.4, con Quante? dalla 2.5) — disegno di Chiara, 06/10/2026
// (`design/2026-10-06-scheda-spicchi-speciali.md`; Quante?: `design/2026-10-07-quante.md`).
// Cinque speciali, due per round, nei due posti fissi 9 e 21 di SEGMENTI_RUOTA (tipo "speciale" dal
// round 2; nel round 1 non compare nessuno speciale, Damiano 06/10 sera).
// Regole cambiate da Damiano la sera del 06/10: Express rifiutato = 200 € fissi
// e si gira di nuovo; Scudo al massimo uno per giocatore.
// ----------------------------------------------------------------------------
// I cinque speciali (Quante?, il quinto, dalla 2.5). `nome` e` la parola sullo spicchio e nei cartelli (nomi
// di Damiano e Alfred, 05-06/10/2026). `simbolo` e` il disegno: un solo
// tracciato in un quadrato 0-100, letto dal canvas (Path2D) e dalla pagina
// (<svg viewBox="0 0 100 100">), cosi` il simbolo e` lo stesso dappertutto.
//   fill: true      → tracciato pieno
//   stroke: N       → tracciato a linea, spessa N (su 100)
//   testo: "?"      → un glifo del font dei titoli, al posto del tracciato
const SPECIALI = {
  express: {
    nome: "EXPRESS",
    titolo: "Express",
    simbolo: [{ d: "M58 4 L22 54 L46 54 L40 96 L78 42 L54 42 Z", fill: true }], // il fulmine
  },
  robinhood: {
    nome: "ROBIN HOOD",
    titolo: "Robin Hood",
    simbolo: [
      { d: "M30 10 Q 92 50 30 90", stroke: 9 },     // l'arco
      { d: "M30 10 L30 90", stroke: 4.5 },          // la corda
      { d: "M10 50 L80 50", stroke: 8 },            // la freccia
      { d: "M97 50 L76 37 L76 63 Z", fill: true },  // la punta
    ],
  },
  mistero: {
    nome: "MISTERO",
    titolo: "Mistero",
    simbolo: [{ testo: "?" }],
  },
  scudo: {
    nome: "SCUDO",
    titolo: "Scudo",
    simbolo: [
      // l'orlo dello scudo (anello: contorno meno interno, regola evenodd) e l'emblema in mezzo
      { d: "M50 5 L87 19 L87 48 C87 71 71 88 50 96 C29 88 13 71 13 48 L13 19 Z M50 18.5 L76.5 28.5 L76.5 48.5 C76.5 64.5 65 76.5 50 83 C35 76.5 23.5 64.5 23.5 48.5 L23.5 28.5 Z", fill: true, regola: "evenodd" },
      { d: "M50 31 L65.5 37 L65.5 49 C65.5 58.5 59 65.5 50 69.5 C41 65.5 34.5 58.5 34.5 49 L34.5 37 Z", fill: true },
    ],
  },
  quante: {
    nome: "QUANTE?",
    titolo: "Quante?",
    simbolo: [ // il conto con le stanghette: tre aste e la sbarra che le taglia, a linea come l'arco di Robin Hood
      { d: "M26 16 L26 84", stroke: 10 },
      { d: "M50 16 L50 84", stroke: 10 },
      { d: "M74 16 L74 84", stroke: 10 },
      { d: "M8 76 L92 24", stroke: 10 },
    ],
  },
};

// Il colore di classe: TUTTI gli speciali sono verde-azzurri, come tutti i
// Passa sono bianchi e tutte le Bancarotte nere (spirito del punto 29).
// Scelto fuori dalle tinte dei soldi (ΔE ≥ 24 a vista normale e ≥ 14 per
// protan/deutan contro i vicini dei due posti qui sotto, misurato il 06/10
// con design/strumenti/validate_palette.mjs). Debole solo accanto al verde
// del 700 € (ΔE 10) e, per chi non distingue i colori, al rosa del 600 € (7):
// per questo i due posti non hanno quei vicini.
const COLORE_SPECIALE = "#009688";        // lo spicchio
const COLORE_SPECIALE_SIMBOLO = "#004D40"; // il simbolo dentro il distintivo bianco (contrasto 9,6:1)
const COLORE_SPECIALE_SCURO = "#00695C";   // bordi, pillole e distintivi nei cartelli

// Dove stanno: due posti fissi, opposti (12 spicchi esatti), con solo soldi
// ai lati, a due o piu` spicchi da Bancarotta (0), Passa (3, 15), Jolly (7) e
// dallo spicchio in tre (12). Sono i due posti lasciati dai Passa il 29/09
// (punto 75): togliendoli, ogni livello di cifra torna ad avere ESATTAMENTE
// due spicchi (18 spicchi su 9 livelli), e lo sbilancio del 400 € e dell'800 €
// (tre copie) sparisce. Dal round 2: nel round 1 i due posti hanno i soldi della 2.3.
const POSTI_SPECIALI = [9, 21];

// L'ordine qui e` quello delle pillole nella guida.
const SPECIALI_TUTTI = ["express", "robinhood", "mistero", "scudo", "quante"];

const QUANTE_VALORE_LETTERA = 500;   // a occorrenza, come l'Express (scelta aperta per Damiano)
const QUANTE_MOLTIPLICATORE = 2;     // col numero giusto
const QUANTE_NUMERI = [1, 2, 3, 4, 5, 6]; // i tondi da toccare; l'ultimo vale «6 o piu`» (nel mazzo del 05/10 una consonante presente compare 6+ volte 17 volte su 2.386)
const DURATA_QUANTE_CADE_MS = 1800;  // il cartello di chi ci cade, come lo Scudo preso

// Quali due per round, con cinque speciali su due posti (dal round 2; il
// round 1 non ne ha, Damiano 06/10). Regola «i due meno visti»: a ogni round
// escono i due che in questa partita sono comparsi meno volte, a sorte fra i
// pari; mai la coppia del round prima; fra piu` coppie possibili, prima quelle
// mai uscite in questa partita. Garantisce: la coppia cambia a OGNI round;
// nessuno speciale compare due volte prima che tutti siano comparsi una volta;
// con 3 round escono quattro speciali diversi (uno resta fuori, a sorte); con
// 5 round tutti e cinque almeno una volta (tre di loro due volte); con 7
// round tutti almeno due volte (due di loro tre volte). I numeri sono in
// design/2026-10-07-quante.md, §3 (design/strumenti/rotazione-cinque.mjs).
function programmaSpeciali(numeroRound) {
  const conto = {};
  SPECIALI_TUTTI.forEach((k) => { conto[k] = 0; });
  const chiave = (c) => c.slice().sort().join("+");
  const programma = [null]; // round 1
  const uscite = new Set();
  let precedente = null;
  for (let r = 2; r <= numeroRound; r++) {
    const minimo = Math.min(...SPECIALI_TUTTI.map((k) => conto[k]));
    const alMinimo = SPECIALI_TUTTI.filter((k) => conto[k] === minimo);
    const coppie = [];
    if (alMinimo.length >= 2) {
      for (let i = 0; i < alMinimo.length; i++) for (let j = i + 1; j < alMinimo.length; j++) coppie.push([alMinimo[i], alMinimo[j]]);
    } else {
      // uno solo al minimo: lui e uno di quelli subito sopra (sono a minimo + 1, mai di piu`)
      SPECIALI_TUTTI.filter((k) => k !== alMinimo[0]).forEach((k) => coppie.push([alMinimo[0], k]));
    }
    let ammesse = coppie.filter((c) => chiave(c) !== precedente);
    if (!ammesse.length) ammesse = coppie; // non succede mai (vedi §3), ma meglio una coppia ripetuta di un round senza speciali
    const nuove = ammesse.filter((c) => !uscite.has(chiave(c)));
    const scelta = (nuove.length ? nuove : ammesse)[Math.floor(Math.random() * (nuove.length ? nuove : ammesse).length)].slice();
    if (Math.random() < 0.5) scelta.reverse(); // chi va nel posto 9 e chi nel 21
    programma.push(scelta);
    scelta.forEach((k) => { conto[k] += 1; });
    precedente = chiave(scelta);
    uscite.add(precedente);
  }
  return programma;
}

// Cosa c'e` sotto il Mistero (Damiano, 05/10: «1.000 €, Passa, oppure regali
// 500 €»). I pesi sono una scelta di Chiara da approvare: il buono esce una
// volta su due, cosi` il Mistero resta una cosa che si vuole scoprire.
const MISTERO_SOTTO = [
  { esito: "soldi", valore: 1000, peso: 2 },
  { esito: "passa", peso: 1 },
  { esito: "regalo", valore: 500, peso: 1 },
];
function estraiMistero() {
  const tot = MISTERO_SOTTO.reduce((s, x) => s + x.peso, 0);
  let r = Math.random() * tot;
  for (const x of MISTERO_SOTTO) { r -= x.peso; if (r < 0) return x; }
  return MISTERO_SOTTO[0];
}

const EXPRESS_RIFIUTO_VALORE = 200;   // chi rifiuta l'Express prende questi, fissi, e gira di nuovo (Damiano, 06/10 sera: «prende 200 e basta, fisso»; sostituisce i «500 € a lettera» della proposta di Chiara)
const SCUDO_MASSIMO = 1;              // al massimo uno per giocatore (Damiano, 06/10 sera: «sennò troppo forte»); usato, se ne puo` prendere un altro
const EXPRESS_VALORE_LETTERA = 500;   // ogni consonante giusta, per ogni volta che c'e` (Damiano, 06/10)
const ROBIN_HOOD_VALORE = 500;         // da chi e` in testa (Damiano, 05/10: «lo porteremmo a 500»)

// Durate (ms) dei cartelli nuovi; quelle di sempre restano (DURATA_ANNUNCIO_MS 1300, _LUNGO 1800).
// Mistero, 2.4.1 (Damiano 07/10, «un po' piu` lunga», come Robin Hood): il «?» restava chiuso 900 ms e la carta
// si girava in 520 ms; ora resta chiuso 1300 ms e la carta si gira in 800 ms. Il CSS legge il secondo da qui.
const DURATA_MISTERO_COPERTO_MS = 1300;  // il «?» resta chiuso cosi` a lungo, poi la carta si gira
const DURATA_MISTERO_GIRA_MS = 800;      // la carta che si gira e mostra cosa c'era sotto
// Robin Hood, 2.4.1 (Damiano 07/10, «un pelino piu` lunga»): la pedina viaggiava 700 ms (da 300 a 1000) e il cartello
// restava 2400 ms; ora viaggia 1100 ms (da 300 a 1400) e il cartello resta 3000 ms. Il CSS legge i due valori da qui.
const ROBIN_HOOD_PEDINA_RITARDO_MS = 300; // la pedina aspetta questo, poi parte
const ROBIN_HOOD_PEDINA_MS = 1100;        // quanto dura il viaggio da chi e` in testa a chi gira
let DURATA_ROBIN_HOOD_MS = 3000;          // il cartello intero con la pedina che passa di mano
const DURATA_SCUDO_PRESO_MS = 1800;
const DURATA_SCUDO_SCATTA_MS = 1800;

// ----------------------------------------------------------------------------
// PALETTE PER LIVELLO DI CIFRA (2.5, Chiara 07/10: il colore segue lo spicchio, non
// la cifra del round — ruota.js legge COLORE_PER_CIFRA[VALORE_BASE_SEGMENTI[i]], punto 65,
// cioe` il valore dello spicchio al round 1; le cifre dei round dopo non hanno un colore
// loro e non serve che l'abbiano). Quella validata da Chiara col validatore delle
// adiacenze (decimo giro, 28/09/2026): ΔE minimo 14,2 per deutan/protan e
// 17,7 a vista normale su tutte le 24 coppie di spicchi vicini (prima erano
// 4,1 e 11,7). Il 1500 non e` piu` un colore piatto: e` olografico a
// dominante oro (vedi ruota.js), come il 1000 luccicante della TV.
// ----------------------------------------------------------------------------
const COLORE_PER_CIFRA = {
  300: "#E53935",
  400: "#FB8C00",
  500: "#FBC02D",
  600: "#EC407A",
  700: "#43A047",
  800: "#1E88E5",
  900: "#8E24AA",
  1000: "#3949AB",
  1500: "olografico", // vedi riempiOlografico() in ruota.js, dominante "oro"
};

// ----------------------------------------------------------------------------
// COMPOSIZIONE DELLA RUOTA — ordine e disegno di Chiara (decimo giro,
// 28/09/2026, `design/2026-09-28-revisione.md`, intervento 2). 24 fette da
// 15° ciascuna. Cambia rispetto ai giri precedenti:
// - lo SPICCHIO TRIPLO (indice 12) non e` piu` tre fette normali da 15°
//   messe una via l'altra: e` UNA fetta sola, divisa in tre nel disegno
//   (5°/5°/5°: bancarotta stretta, RADDOPPIA al centro, bancarotta stretta —
//   vedi ruota.js). La ruota resta quindi a 24 posizioni FISICHE, non 26;
// - il JOLLY non e` piu` un tipo di spicchio a se stante: e` un flag
//   (`jolly: true`) su uno spicchio "soldi" — quello da 600€ (indice 7).
//   Finche` nessuno l'ha preso in questo round, la ruota lo disegna come
//   jolly (punto 53: "torna uno spicchio intero", non piu` una carta); una
//   volta preso, quello spicchio torna a mostrare la sua cifra come tutti
//   gli altri, per il resto del round (vedi Gioco.jollyPresoInQuestoRound e
//   Ruota.impostaJollyDisponibile in gioco.js/ruota.js). Al round successivo
//   torna disponibile.
const SEGMENTI_RUOTA = [
  { tipo: "bancarotta" },
  { tipo: "soldi", valore: 800 },
  { tipo: "soldi", valore: 1500 },
  { tipo: "passa" },
  { tipo: "soldi", valore: 1000 },
  { tipo: "soldi", valore: 300 },
  { tipo: "soldi", valore: 1500 },
  { tipo: "soldi", valore: 600, jolly: true },
  { tipo: "soldi", valore: 400 },
  { tipo: "soldi", valore: 800 }, // posto 9: ex-Passa (punto 75), 800€ nel round 1; dal round 2 ruota.js lo fa «speciale» (2.4)
  { tipo: "soldi", valore: 500 },
  { tipo: "soldi", valore: 700 },
  { tipo: "triplo" }, // vedi sopra: UNA fetta, tre parti nel disegno
  { tipo: "soldi", valore: 600 },
  { tipo: "soldi", valore: 900 },
  { tipo: "passa" },
  { tipo: "soldi", valore: 700 },
  { tipo: "soldi", valore: 500 },
  { tipo: "soldi", valore: 300 },
  { tipo: "soldi", valore: 400 },
  { tipo: "soldi", valore: 900 },
  { tipo: "soldi", valore: 400 }, // posto 21: ex-Passa (punto 75), 400€ nel round 1; dal round 2 ruota.js lo fa «speciale» (2.4)
  { tipo: "soldi", valore: 1000 },
  { tipo: "soldi", valore: 800 },
];

// ----------------------------------------------------------------------------
// CIFRE PER ROUND (punto 60, 29/09/2026) — "in TV le cifre salgono di round
// in round" (fotografie di Gerry Scotti + la ricerca di Vera sulla versione
// USA). Restano fermi il numero degli spicchi, l'ordine dei tipi (Passa,
// bancarotte, spicchio in tre, jolly) e i colori per cifra: cambia solo
// QUANTO vale ogni "livello" di cifra, round dopo round. Un solo punto da
// ritoccare per cambiare la progressione: la tabella CIFRE_PER_ROUND qui
// sotto, una riga per round, nello stesso ordine di LIVELLI_BASE_CIFRE.
//
// LIVELLI_BASE_CIFRE elenca gli 8 importi "normali" del round 1 (quelli con
// un colore fisso in COLORE_PER_CIFRA sopra) piu` il livello "da premio"
// (1500, sempre olografico — vedi riempiOlografico() in ruota.js): NON e` la
// disposizione fisica sulla ruota (quella resta SEGMENTI_RUOTA, invariata),
// e` solo l'elenco dei valori distinti che compaiono al round 1.
const LIVELLI_BASE_CIFRE = [300, 400, 500, 600, 700, 800, 900, 1000, 1500];

// Una riga per round, stesso ordine di LIVELLI_BASE_CIFRE. Progressione
// scelta: i primi 8 livelli salgono di 50€ ogni round (increment regolare,
// come le puntate della TV che salgono a scaglioni piccoli); il livello "da
// premio" (ultima colonna, sempre olografico) sale piu` deciso, 300€ a
// round, e resta cosi` sempre ben staccato dagli altri (mai un incrocio fra
// le due fasce entro le 7 righe qui sotto, il massimo di OPZIONI_NUMERO_ROUND
// piu` sotto). Se un giorno si gioca piu` di 7 round, cifrePerRound() ripete
// l'ultima riga: le cifre smettono di salire ma non tornano mai indietro.
const CIFRE_PER_ROUND = [
  [300, 400, 500, 600, 700, 800, 900, 1000, 1500], // round 1 — invariato, e` il round 1 di sempre
  [350, 450, 550, 650, 750, 850, 950, 1050, 1800], // round 2
  [400, 500, 600, 700, 800, 900, 1000, 1100, 2100], // round 3
  [450, 550, 650, 750, 850, 950, 1050, 1150, 2400], // round 4
  [500, 600, 700, 800, 900, 1000, 1100, 1200, 2700], // round 5
  [550, 650, 750, 850, 950, 1050, 1150, 1250, 3000], // round 6
  [600, 700, 800, 900, 1000, 1100, 1200, 1300, 3300], // round 7
];

// Restituisce la riga di CIFRE_PER_ROUND per un numero di round (1-based).
// Oltre l'ultima riga scritta, ripete l'ultima (mai un round senza cifre).
function cifrePerRound(numeroRound) {
  const idx = Math.min(numeroRound, CIFRE_PER_ROUND.length) - 1;
  return CIFRE_PER_ROUND[Math.max(0, idx)];
}

// ----------------------------------------------------------------------------
// LO SPICCHIO TRIPLO — RADDOPPIA (punto 48, regola PROVVISORIA di Erbottega,
// 28/09/2026: non dettata da Damiano). Chi ci finisce dice una consonante:
// se c'e`, i soldi del round raddoppiano; se non c'e`, il turno passa (come
// uno spicchio normale). Le due bancarotte ai lati del RADDOPPIA si
// comportano come qualunque altra bancarotta della ruota, jolly compreso.
// Un solo numero da ritoccare se in prova sembra troppo o troppo poco.
const RADDOPPIA_MOLTIPLICATORE = 2;

// ----------------------------------------------------------------------------
// JOLLY DA SPICCHIO — si guadagna con una lettera (sesto giro, punto 25,
// confermato al decimo: "resta valido il punto 25"). Chi finisce sullo
// spicchio del 600€-jolly (mentre il jolly e` ancora li`) sceglie comunque
// una consonante: se c'e`, prende SOLO il jolly (punto 49/53: non i soldi
// dello spicchio sotto) e continua il turno; se non c'e`, niente jolly e il
// turno passa. Lo spicchio non ha quindi una cifra propria PER IL JOLLY —
// la lettera trovata in quel momento non fa guadagnare soldi (0 = niente
// soldi). Dopo che il jolly e` stato preso, lo stesso spicchio torna un 600€
// normale per chi ci finisce dopo, nello stesso round.
// ----------------------------------------------------------------------------
const JOLLY_VALORE_SOLDI_PER_LETTERA = 0;

// ----------------------------------------------------------------------------
// JOLLY — cosa salva quando viene usato su una Bancarotta o su un Passa.
// ----------------------------------------------------------------------------
// Deciso da Damiano il 28/09/2026: il jolly salva da tutto, turno E soldi.
// Resta comunque un solo interruttore qui: se un giorno si vuole provare la
// versione "salva solo il turno", si cambia questa riga sola.
const JOLLY_SALVA_ANCHE_I_SOLDI = true;

// ----------------------------------------------------------------------------
// TEMPO PER LA SOLUZIONE
// ----------------------------------------------------------------------------
// Deciso da Damiano il 28/09/2026: si parte da 20 secondi.
const SECONDI_PER_LA_SOLUZIONE = 20;

// ----------------------------------------------------------------------------
// COLORI DEI GIOCATORI (uno per giocatore, in ordine di iscrizione)
// ----------------------------------------------------------------------------
const COLORI_GIOCATORI = [
  "#E74C3C", // giocatore 1 — rosso
  "#3498DB", // giocatore 2 — blu
  "#27AE60", // giocatore 3 — verde
  "#F39C12", // giocatore 4 — arancione
];

// ----------------------------------------------------------------------------
// ALTRE REGOLE ECONOMICHE
// ----------------------------------------------------------------------------
const COSTO_VOCALE = 500;      // ogni acquisto di vocale costa questo, si paga sempre (anche se la vocale non c'e)

// Scelta NON fatta da Damiano, presa in via provvisoria da Erbottega (28/09/2026):
// la vocale si paga sempre con i soldi DEL ROUND, mai col totale in cassaforte.
// Se nel round non ce ne sono abbastanza, la vocale non si compra, anche se il
// totale basterebbe. Per cambiare basta questa riga (o il controllo che la usa,
// vedi PAGA_VOCALE_CON in gioco.js).
const VOCALE_SI_PAGA_COL_TOTALE = false;

const BONUS_VITTORIA_ROUND = 1000; // bonus a chi risolve la frase SOLO se nel round aveva 0€ (punto 68, 29/09/2026); con soldi nel round porta quelli

// ----------------------------------------------------------------------------
// OTTAVO GIRO (28/09/2026) — quattro regole nuove, dettate dopo aver giocato
// con la musica vera. Le prime tre sono scelte di Damiano, provvisorie, in
// interruttori qui: si cambiano da soli senza toccare la logica del gioco.
// ----------------------------------------------------------------------------

// Punto 33: quando in una frase non restano consonanti (o vocali) DA
// SCOPRIRE — cioe` quelle davvero presenti nella frase sono gia` tutte state
// trovate — girare la ruota (o comprare una vocale) non serve piu` a niente:
// il gioco lo dice chiaramente e disattiva il pulsante inutile. Quando sono
// finite entrambe, resta attivo solo "Do la soluzione". Se un giorno si
// preferisce lasciare i pulsanti sempre cliccabili anche a vuoto, basta
// questo interruttore.
const DISATTIVA_COMANDI_SE_LETTERE_FINITE = true;

// Punto 34: chi compra una vocale che non c'e` nella frase paga E perde il
// turno (prima il turno continuava). Interruttore separato dal successivo
// perche` sono due decisioni distinte anche se producono lo stesso esito.
const VOCALE_ASSENTE_PERDE_TURNO = true;

// Punto 35: scegliere una vocale gia` chiamata (in questo round) si tratta
// esattamente come una vocale assente — paga e perde il turno. Le
// consonanti gia` chiamate invece non si pagano mai (non hanno un costo):
// scegliere una consonante gia` chiamata (sul tabellone o gia` tentata e
// assente) fa finire il turno senza soldi, in gioco.js, sempre attivo, non
// serve un interruttore.
const VOCALE_GIA_CHIAMATA_PERDE_TURNO = true;

// ----------------------------------------------------------------------------
// VOLUME (punto 36) — due cursori, musica ed effetti, aperti dal pulsante
// degli altoparlanti in alto. Ogni valore va da 0 (muto) a 1 (pieno) e si
// ricorda da una partita all'altra (localStorage, vedi audio.js). Qui solo i
// valori di PARTENZA, per una partita mai giocata prima su questo browser.
// ----------------------------------------------------------------------------
// La musica oggi (VOLUME_MUSICA_FILE qui sopra, 0.3) e` "troppo alta" secondo
// Damiano: il cursore parte quindi a meta`, cosi` il volume vero di partenza
// e` la META` di adesso (0.3 * 0.5 = 0.15), non lo stesso livello con in piu`
// un cursore per abbassarlo dopo.
//
// 06/10/2026, Damiano: «durante il round dovremmo abbassare le varie musiche,
// livello massimo accettabilmente basso, con la possibilita` di alzarlo, ma di
// base basso, cosi` i vari effetti sonori risaltano». Il cursore di partenza
// scende da 0.5 a 0.25: round 0.3 * 0.25 = 0.075 (prima 0.15), lampo
// 0.075 * 0.3 = 0.0225 (prima 0.045). Gli effetti hanno picchi di 0.12-0.22
// (tic fino a 0.264 + 0.12 di scatto, lettera trovata 0.2, lettera assente 0.12, bancarotta 0.18, festa 0.22, bling 0.14). Chi vuole
// piu` musica alza il cursore: a fondo corsa il round arriva a 0.3.
// CORREZIONE (06/10/2026, sera): Damiano chiede il 15%: il cursore parte a 0.15
// e si legge 15 (il cursore e` 0-100). Il volume vero e` 0.3 * 0.15 = 0.045,
// perche` 0.3 e` il tetto gia` mixato dei file (VOLUME_MUSICA_FILE). Scelta la
// lettura «15% sul cursore», quella che vede chi gioca.
// Dal 06/10/2026 (sera) parte SEMPRE da qui: il volume della musica non si ricorda piu` fra una visita e l'altra.
const VOLUME_MUSICA_CURSORE_INIZIALE = 0.15;
// Gli effetti (tic della ruota, lettera trovata, bancarotta, jolly, festa...)
// non erano mai stati segnalati come troppo alti: il cursore parte pieno.
const VOLUME_EFFETTI_CURSORE_INIZIALE = 1.0;

// ----------------------------------------------------------------------------
// L'ANNUNCIO (punto 56, undicesimo giro, 28/09/2026, disegno di Chiara)
// ----------------------------------------------------------------------------
// Il palco unico dove compare ogni annuncio (lettera trovata/assente, Passa,
// Bancarotta, jolly, tempo scaduto, risposta sbagliata, lettera già uscita,
// lettere finite) assorbe sia la vecchia riga verde (messaggio-gioco) sia il
// messaggio grande di prima (punto 37/42, DURATA_MESSAGGIO_GRANDE_MS, non
// serve più). Due durate, in millisecondi: quanto il gioco aspetta prima di
// passare il turno dopo un esito negativo (DURATA_ANNUNCIO_MS) e quanto dopo
// un esito più pesante — bancarotta, avvisi (DURATA_ANNUNCIO_LUNGO_MS).
// Dal 09/10/2026 (Damiano, prima partita del Percorso: «un secondo in piu`, sennò non si legge») queste durate sono `let`:
// preparaModalita() (gioco.js) le rimette ai valori di base nella Classica e ci somma PERCORSO_ANNUNCIO_IN_PIU_MS nel Percorso,
// cosi` anche le attese che seguono un annuncio (il turno che passa, «gira ancora») restano d'accordo con l'annuncio.
let DURATA_ANNUNCIO_MS = 1300;
let DURATA_ANNUNCIO_LUNGO_MS = 1800;

// Punto 69, quattordicesimo giro (29/09/2026, disegno di Chiara): ogni
// annuncio che passa il turno ha un secondo tempo, «Tocca a <nome>», che
// arriva DOPO DURATA_ANNUNCIO_MS (o DURATA_ANNUNCIO_LUNGO_MS per la
// bancarotta) e dura DURATA_TOCCA_A_MS — durante questo tempo il turno e`
// gia` passato e la fila dei giocatori mostra il balzo (voce 2 della scheda).
// I comandi tornano solo alla fine di questo secondo tempo, non prima.
// Raccomandazione di Chiara: 2400. Se in prova sembra lento, scendere a 1800.
let DURATA_TOCCA_A_MS = 2400; // nel Percorso 2700 (DURATA_TOCCA_A_PERCORSO_MS)

// La tessera di chi NON e` di turno si sbiadisce a questa opacita` (1 =
// piena, 0 = invisibile) — cosi` la tessera di chi gioca ora risalta senza
// che le altre spariscano (i soldi restano leggibili). Raccomandazione di
// Chiara: 0.55. Se dal divano sembrano "fuori gioco", salire a 0.65.
const OPACITA_GIOCATORE_NON_DI_TURNO = 0.55;

// Voce C, tredicesimo giro (29/09/2026): l'annuncio del cambio di round
// resta 2,4s invece di 1,6 — la ruota ci mette 1s a fare il giro dell'onda
// piu` 360ms per l'ultimo spicchio, e l'annuncio deve restare aperto oltre
// quella durata.
const DURATA_ANNUNCIO_ROUND_MS = 2400;

// ----------------------------------------------------------------------------
// NUMERO DI ROUND DELLA PARTITA (punto 38)
// ----------------------------------------------------------------------------
// Scelte proposte nella schermata di iscrizione. Scelta di Damiano,
// provvisoria: 5 e` gia` selezionato di default ("partita completa").
const OPZIONI_NUMERO_ROUND = [3, 5, 7];
const NUMERO_ROUND_DI_DEFAULT = 5;

// ----------------------------------------------------------------------------
// GRUPPI DI FRASI (punto 64, 29/09/2026) — con che frasi si gioca stasera.
// ----------------------------------------------------------------------------
// valore = il campo `gruppi` di frasi-nostre.js; nome = quello che si legge
// sullo schermo (Chiara, voce D). Se un giorno cambia il nome di un gruppo
// per Damiano, basta cambiare `nome` qui: `valore` deve restare uguale a
// quello scritto nel file delle frasi.
const GRUPPI_FRASI = [
  { valore: "bambini", nome: "Bambini" },
  { valore: "famiglia", nome: "Famiglia" },
  { valore: "tutti", nome: "Grandi" },
  { valore: "esperti", nome: "Esperti" },
];
const GRUPPI_DI_DEFAULT = ["famiglia"];

// ----------------------------------------------------------------------------
// L'ISCRIZIONE PER LO SCHERMO LARGO (Giro A, 29/09/2026, disegno di Chiara —
// `design/2026-09-29-scheda-otto-idee.md`, voce A1) — tessere dei giocatori,
// ognuno per sé o a squadre, posto vuoto che aggiunge un giocatore, i nomi
// dell'ultima sera ricordati.
// ----------------------------------------------------------------------------
const MAX_GIOCATORI = 4;
const MAX_PER_SQUADRA = 3;
const NOMI_SQUADRE_SEGNAPOSTO = ["Genitori", "Figli"]; // se il nome resta vuoto, si usa questo
const CHIAVE_ULTIMA_ISCRIZIONE = "giraleparole-ultima-iscrizione";
const CHIAVE_NOVITA_VISTE = "giraleparole-novita-viste";
// 2.4.1 (Damiano 07/10): una frase uscita non torna per almeno 4 partite. Lo storico sta nel browser
// (localStorage): non c'e` un server, quindi vale per il dispositivo, non per la casa.
const CHIAVE_STORICO_FRASI = "giraleparole-storico-frasi";
const PARTITE_SENZA_RIPETIZIONI = 4;
// «Cambia frase» nel round lampo: la frase nuova compare e le lettere ripartono dopo questa attesa (ms), per darle il tempo di essere letta.
const LAMPO_ATTESA_DOPO_CAMBIO_MS = 1500;
const CHIAVE_FRASI_NOSTRE = "giraleparole-frasi-nostre"; // scritta dalla pagina "Le nostre frasi" (giro C, non ancora costruita)

// ----------------------------------------------------------------------------
// GIRO B (frase premio) E GIRO C (albo d'oro, le nostre frasi, sfida) — non
// ancora costruiti: un solo interruttore nasconde tutto quello che li
// riguarda nell'iscrizione e nella mini guida — «Come si gioca» mostra solo
// le prime 6 voci finche` resta false. Il round lampo (giro B, B1) NON
// dipende piu` da questo: ha il suo interruttore qui sotto (LAMPO_ATTIVO), che
// accende anche la voce 7 della guida (riscritta il 05/10/2026, vedi GUIDA in
// gioco.js). Quando si costruisce la frase premio, questo si gira a true e la
// guida mostra anche la voce 8.
// ----------------------------------------------------------------------------
const GIRO_B_C_ATTIVO = false;

// ----------------------------------------------------------------------------
// IL ROUND LAMPO (giro B, voce B1 — disegno di Chiara, 05/10/2026, con le
// modifiche di Damiano dello stesso giorno: la prenotazione e` un tocco o un
// tasto QUALUNQUE, poi chi fa da arbitro tocca la tessera di chi ha toccato
// per primo; 15 secondi per rispondere, non 10; quando appare e` deciso da
// LAMPO_QUANDO). Le lettere si accendono da sole una alla volta, chi indovina
// la frase porta a casa il premio e apre il round dopo. Nessun suono: la
// scheda non lo prevede.
// ----------------------------------------------------------------------------
const LAMPO_ATTIVO = true;           // false = il lampo sparisce del tutto (leva dell'iscrizione compresa)
const LAMPO_INTERVALLO_MS = 1200;    // una lettera si accende ogni 1,2 s
const LAMPO_CONTO_SECONDI = 3;      // dopo una soluzione sbagliata: tre secondi di conto alla rovescia a vista prima che le lettere ripartano (10/10, quarta prova)
const LAMPO_SECONDI = 15;            // chi risponde ha 15 s, contati dal tocco sulla sua tessera (non da quello che ferma le lettere)
const LAMPO_PREMIO = 500;            // in cassaforte, a chi indovina
const LAMPO_MAX_LETTERE = 22;        // «frase breve»: al massimo 22 lettere (spazi esclusi)
const DURATA_ANNUNCIO_LAMPO_MS = 2400;

// Dopo quale round si puo` fare il lampo, per numero di round della partita
// (Damiano, 05/10/2026: «non solo una volta a partita... tre round due volte,
// cinque round tre volte, sette round quattro o cinque volte, tanto e`
// veloce»). `dopo` = i round dopo la cui fine puo` apparire; `quanti` = quanti
// di quelli se ne estraggono a caso a ogni partita: un numero fisso, oppure
// [min, max] (allora anche il numero si estrae a caso).
//  - 3 round: dopo il primo e dopo il secondo (2 su 2: tutti e due, ogni
//    partita), non dopo il terzo;
//  - 5 round: 3 volte, a caso fra i 4 posti dopo il 1, 2, 3 e 4 (Damiano,
//    05/10: «per il lampo a caso a partire dal primo»). Mai dopo l'ultimo;
//  - 7 round: 4 o 5 volte, a caso, sempre senza lampo dopo il primo round:
//    fra i 5 posti dopo il 2, 3, 4, 5 e 6 (lettura di Erbottega/Alfred: per i
//    7 round Damiano non si e` espresso).
// Un numero di round che non sta qui non ha lampo.
const LAMPO_QUANDO = {
  3: { dopo: [1, 2], quanti: 2 },
  5: { dopo: [1, 2, 3, 4], quanti: 3 },
  7: { dopo: [2, 3, 4, 5, 6], quanti: [4, 5] },
};

// ----------------------------------------------------------------------------
// LA RUOTA PESANTE (05/10/2026, disegno di Chiara, design/2026-10-05-ruota-pesante.md)
// Un solo motore (fisica-ruota.js) per il pulsante e per la mano: cambia solo
// da dove arriva la velocita` di partenza. Damiano: «dovremmo trovare un modo
// per simulare BENE una ruota vera, grossa e pesante». Provata e scelta da
// lui il 05/10 sul prototipo: posizione «Più pesante», 72 pioli («la ruota
// cosi` e` BELLISSIMA, ora il movimento e` moooolto piu` naturale»).
// Sostituisce i vecchi blocchi «FISICA DELLA RUOTA» (punto 21, giri e durata
// fissi con easing) e «TRASCINAMENTO DELLA RUOTA» (punti 61-62).
// ----------------------------------------------------------------------------
const PIOLI_PER_SPICCHIO = 3;             // 3 intervalli per spicchio = un piolo ogni 5°, 72 in tutto (TV: foto 01 e 04 di riferimento/tv-gerry-scotti)
const RUOTA_INERZIA = 1.3;                // la massa: 1 = la ruota del primo giro («troppo leggera»), 1,3 = pesa un terzo in piu`. Divide le due frenate qui sotto
const ATTRITO_CUSCINETTO_RAD_S2 = 0.05;   // la ruota frena sempre un po', costante (a massa 1)
const LAMELLA_RESISTENZA_RAD_S2 = 0.2;    // quanto frena un piolo mentre piega la lamella, a velocita` quasi zero (a massa 1)
const LAMELLA_VELOCITA_RIF_RAD_S = 0.8;   // a questa velocita` la resistenza raddoppia: un urto forte costa piu` di uno lento
const LAMELLA_FINESTRA_GRADI = 1.8;       // gradi di corsa in cui il piolo piega la lamella prima di scappare via
const LAMELLA_RESTITUZIONE = 0.5;         // energia che la lamella restituisce nel rimbalzo (0..1)
const LAMELLA_SCATTO_RAD_S = 0.08;        // scatto minimo in avanti quando la lamella scappa dal piolo: mai ferma SUL piolo
const RUOTA_VELOCITA_FERMO_RAD_S = 0.05;  // sotto questa velocita`, fuori dalla lamella, la ruota e` ferma
const LAMELLA_RITORNO_MS = 30;            // costante di tempo con cui la freccia torna dritta dopo un piolo
const SPINTA_CORSA_GRADI_MIN = 60;        // la corsa della mano nella spinta piu` debole: tira il bordo per 60°
const SPINTA_CORSA_GRADI_MAX = 90;        // ...e nella piu` forte: un quarto di giro, da sopra al fianco. Quanto dura lo decide la ruota (2 – 2,25 s)
const LANCIO_GIRI_MIN = 0.8;              // giri della girata piu` debole del pulsante, spinta compresa (era 1,0)
const LANCIO_GIRI_MAX = 1.25;             // giri della girata piu` forte del pulsante; e` anche il tetto della mano vera (era 1,6)
const ATTRITO_LANCIO_NON_VALIDO_RAD_S2 = 1.2; // un lancio a mano sotto il mezzo giro si pianta cosi` (regola di gioco, non fisica)
const TRASCINA_RITARDO_MS = 300;          // in mano, quanto la ruota ritarda sul dito a massa 1; si moltiplica per RUOTA_INERZIA (390 ms). Era 220, e prima 95
const TRASCINA_FINESTRA_VELOCITA_MS = 120; // quanti ms di storia recente si guardano per la velocita` di rilascio

// Punto 62, scelta PROVVISORIA di Alfred (non dettata da Damiano): il lancio
// a mano conta solo se la ruota, DAL RILASCIO, fa almeno questa frazione di
// giro (0.5 = mezzo giro). Sotto soglia la ruota si pianta (vedi
// ATTRITO_LANCIO_NON_VALIDO_RAD_S2), un annuncio sul palco dice di rilanciare
// e il turno non passa. Se in prova i lanci validi sono pochi si puo` portare
// a 0,4 (raccomandazione di Chiara): e` una regola di gioco, non di fisica.
const GIRO_MINIMO_VALIDO_TURNI = 0.5;

// ----------------------------------------------------------------------------
// IMMAGINI GIOCATORI (sesto giro, punto 27 — 28/09/2026)
// ----------------------------------------------------------------------------
// Piccola raccolta di disegnini disegnati a mano in SVG dentro il progetto
// (cartella qui sotto), self-hosted come i font: nessuna dipendenza esterna,
// funziona anche senza internet.
//
// Undicesimo giro, punto 58 (28/09/2026): Damiano ha scelto la strada B (la
// tessera con l'iniziale del nome, vedi Gioco.giocatori[].iniziale in
// gioco.js) — questi file NON sono più usati per scegliere l'aspetto di un
// giocatore, ma restano nel progetto (design/prototipi/.../immagini/ per la
// strada A scartata, e questa cartella per i file originali): non si
// cancellano.
const CARTELLA_IMMAGINI_GIOCATORI = "immagini-giocatori/";
const IMMAGINI_GIOCATORI = [
  { file: "gatto.svg", nome: "Gatto" },
  { file: "cane.svg", nome: "Cane" },
  { file: "coniglio.svg", nome: "Coniglio" },
  { file: "orso.svg", nome: "Orso" },
  { file: "volpe.svg", nome: "Volpe" },
  { file: "panda.svg", nome: "Panda" },
  { file: "leone.svg", nome: "Leone" },
  { file: "elefante.svg", nome: "Elefante" },
  { file: "pinguino.svg", nome: "Pinguino" },
  { file: "tartaruga.svg", nome: "Tartaruga" },
];

// ----------------------------------------------------------------------------
// FESTA DI FINE ROUND (punto 30 — 28/09/2026, aggiunta dopo il sesto giro)
// ----------------------------------------------------------------------------
// Quanto resta aperta da sola la finestra animata di chi vince il round,
// prima di richiudersi (si puo` anche chiudere prima con un tocco).
// Ottavo giro (28/09/2026, seconda dettatura): portata da 4200 a 7000 —
// "due o tre secondi in più di adesso", chiesto da Damiano.
const DURATA_FESTA_VITTORIA_MS = 7000;

// Durata del conta-numeri che sale da 0 all'importo vinto (gioco.js,
// animaContatoreFesta). Scala in proporzione a DURATA_FESTA_VITTORIA_MS,
// stessa frazione di prima (1500/4200 quando la festa durava 4200ms): cosi`
// il numero non resta fermo a lungo sulla cifra finale mentre la finestra
// resta aperta piu` a lungo.
const DURATA_CONTATORE_FESTA_MS = Math.round(DURATA_FESTA_VITTORIA_MS * (1500 / 4200));

// ----------------------------------------------------------------------------
// SCOPERTA DELLE CASELLE (terzo giro, punto 16)
// ----------------------------------------------------------------------------
// Quando una lettera viene trovata, le sue caselle si "accendono" e il
// giocatore ci clicca sopra una per una per scoprirle (come in televisione).
// Se nessuno clicca — un bambino distratto, per esempio — dopo questo tempo
// le caselle rimaste si scoprono da sole, cosi il gioco non resta bloccato.
const TEMPO_AUTOSCOPERTA_MS = 6000;

// ----------------------------------------------------------------------------
// MUSICA DI SOTTOFONDO — brani veri al posto dei groove generati (28/09/2026,
// approvato da Damiano). File scaricati da Damiano in `musica/` (crediti in
// `musica/CREDITI.md`, CC BY 4.0, Kevin MacLeod/incompetech.com).
// ----------------------------------------------------------------------------
// Un brano per round, che cambia ad ogni round nuovo — stesso meccanismo di
// avanzamento di prima (Audio_.musicaProssimoRound, chiamata da nuovoRound()
// in gioco.js), solo che ora l'indice scorre su questa lista di FILE invece
// che sulle quattro tracce generate. "Funk Game Loop" e` l'unico dei quattro
// pensato per girare in loop (56 secondi, si "chiude" bene) — richiesta di
// Damiano: "prediligendo quello che gira in loop" — quindi qui suona un
// round si` e uno no, e gli altri tre si alternano nei round in mezzo.
// Elenco facile da ritoccare: per cambiare la sequenza basta riscrivere
// questo array (i nomi sono i file dentro CARTELLA_MUSICA qui sotto).
const CARTELLA_MUSICA = "musica/";
const SEQUENZA_MUSICA_FILE = [
  "Funk-Game-Loop.mp3",
  "Funky-Chunk.mp3",
  "Funkorama.mp3",
  "C-Funk.mp3",
  "Enter-the-Party.mp3",
  "Protofunk.mp3",
  "Loopster.mp3",
  "Got-Funk.mp3",
  "Funk-Game-Loop.mp3",
  "Aces-High.mp3",
];
// 07/10/2026: dai 4 brani ai 9 (+ Funk Game Loop, che ricorre due volte), su
// richiesta di Damiano ("sono sempre le stesse"). Regola: due round di fila
// non hanno mai lo stesso file, nemmeno al giro di coda (l'ultimo, Aces High,
// e il primo, Funk Game Loop, sono diversi): chi ritocca l'elenco la rispetti.
// Con 10 posizioni, una partita da 5 round ne usa 5 e non ripete.

// Volume dei brani veri, sotto voci ed effetti (stesso principio dei groove
// generati: la musica non deve mai coprire ne` i bambini ne` il gioco).
// I file mp3 sono gia` mixati piuttosto "pieni": un volume basso qui serve
// a restare sotto tono()/tic() (volumi 0.08-0.2, vedi audio.js) anche se il
// brano di per se` e` piu` denso di un singolo bip. Non provato ad orecchio
// (headless non ha uscita audio) — da ritoccare qui se in prova risulta
// troppo alto o troppo basso.
const VOLUME_MUSICA_FILE = 0.3;

// La musica del round lampo (06/10/2026, scelta di Damiano: "Rocket Power").
// Suona solo durante il lampo, al posto della musica dei round. Deve stare
// bassa, «per non rimbambire chi gioca e far sentire bene i bling». E` un
// FATTORE sul volume dei round (ora 1: stesso livello, scelta di Damiano la
// sera del 06/10/2026; era 0.3), quindi resta in proporzione quando si
// sposta il cursore della musica. Col cursore di partenza (0.15): round e
// lampo 0.045. Il bling (audio.js) vale 0.14 + 0.11 sul cursore degli
// effetti: circa tre volte il picco della musica. Non provato ad orecchio.
const MUSICA_LAMPO_FILE = "Rocket-Power.mp3";
const MUSICA_LAMPO_FATTORE = 1; // 06/10/2026 sera: Damiano la vuole allo stesso livello dei round (era 0.3)

// La musica della schermata di iscrizione (giocatori, modalita`, gruppi),
// 07/10/2026. Parte quando si apre la schermata e lascia il posto alla musica
// dei round (con la dissolvenza qui sotto) quando la partita comincia. Stesso
// cursore e stesso volume di tutta la musica, nessun fattore proprio.
// DAMIANO SCEGLIE A ORECCHIO fra i tre candidati in
// `musica-candidati/iscrizione/` (Sunshine, Chee-Zee-Beach, Somewhere-Sunny):
// si sposta il file scelto dentro `musica/` e qui si scrive il suo nome, per
// esempio "Sunshine.mp3". Finche` e` null, l'iscrizione resta muta come prima.
const MUSICA_ISCRIZIONE_FILE = "Chee-Zee-Beach.mp3"; // scelta di Damiano (10/10/2026, «la meno peggio»); il file e` copiato in musica/, i candidati restano in musica-candidati/

// Durata della dissolvenza fra un brano e il successivo a inizio round —
// "non uno stacco" (richiesta di Damiano). In secondi.
const DURATA_DISSOLVENZA_MUSICA_SEC = 0.8;

// ----------------------------------------------------------------------------
// TABELLONE — griglia fissa (nono giro, punto 45, 28/09/2026)
// ----------------------------------------------------------------------------
// "Il tabellone come in televisione: sempre rettangolare, grande, sempre
// uguale, fatto di una griglia di rettangolini." Un numero per RIGA: quanti
// caratteri (lettere + apostrofi/punteggiatura + gli spazi fra le parole)
// puo` ospitare quella riga prima che la parola successiva vada a capo. Non
// spezza mai una parola: la si sposta tutta alla riga dopo.
//
// VERIFICATO (decimo giro, 28/09/2026) — Chiara ha contato la griglia vera
// sulla foto del tabellone di Gerry Scotti (`riferimento/tv-gerry-scotti/`):
// **12-14-14-12**, 52 caselle, come ricordava Damiano ("4 righe uguali da
// 14" era una lettura sbagliata di Alfred). Con questa griglia entrano 322
// frasi su 325: le 3 che non entravano sono state tolte da frasi.js (punto
// 50, verificato di nuovo con uno script a parte: 322/322 entrano).
// La riga piu` larga (14) decide anche la larghezza FISICA del tabellone,
// sempre identica su ogni riga (vedi LARGHEZZA_FISICA_TABELLONE in gioco.js):
// le righe piu` strette (12) restano comunque dentro un riquadro largo
// uguale alle altre, solo con qualche casella spenta in piu` ai due lati.
const RIGHE_TABELLONE = [12, 14, 14, 12];

// ----------------------------------------------------------------------------
// FUOCHI D'ARTIFICIO (punto 46, nono giro; numeri rifatti al decimo giro,
// 28/09/2026, sul disegno di Chiara — su uno schermo da 1080 righe i vecchi
// numeri quasi non si vedevano, vedi `design/2026-09-28-revisione.md`,
// rilievo 6).
// ----------------------------------------------------------------------------
const SCINTILLE_FESTA_ROUND_N = 14; // pallini che esplodono nella festa di round (invariato)
const FUOCHI_FINALE_BURST_N = 8; // quanti "botti" separati nella schermata finale
const FUOCHI_FINALE_PARTICELLE_PER_BURST = 42; // pallini per ogni botto

// Dopo la sequenza di FUOCHI_FINALE_BURST_N botti iniziali, un botto in piu`
// ogni tot millisecondi finche` la schermata finale resta aperta (punto 40:
// "resta finche` non la chiude qualcuno") — cosi` la festa non si spegne
// dopo pochi secondi mentre la schermata rimane a lungo sullo schermo.
const FUOCHI_FINALE_INTERVALLO_MS = 2500;

// ============================================================================
// LA MODALITA` «PERCORSO» (07/10/2026) — disegno di Chiara, decisioni di Damiano.
// Pagine: design/2026-10-07-percorso.md (il disegno), design/2026-10-07-percorso-conti.md
// (i conti, i due set, la Nebbia, le scelte A-H), scheda per Erbottega
// design/2026-10-07-scheda-percorso.md; le costanti sono quelle di
// design/prototipi/2026-10-07-percorso/proposta-config.js. Damiano, 07/10: «approvo
// tutte le raccomandazioni di Chiara», compresa la lunghezza che segue la serata.
//
// In una riga: la Classica con i passi al posto degli euro. Una lettera giusta spinge
// avanti l'OMBRA; chi risolve la frase porta la PEDINA fin dove sta l'ombra; la
// Nebbia (la Bancarotta del Percorso) fa sparire l'ombra. Vince chi tocca il
// traguardo (subito, anche a round non finiti), altrimenti chi e` piu` avanti
// alla fine. La partita Classica non cambia in niente.
// ============================================================================

// ---- gli interruttori ---------------------------------------------------------
// Il set di speciali e di caselle (scelta B dei conti di Chiara): alla prima prova il
// RIDOTTO (4 spicchi e 5 caselle, senza il Fiume); il PIENO (8 spicchi e 10 caselle,
// Fiume compreso) si accende cambiando questa riga. Per provarlo SENZA toccare
// questo file basta scrivere ?set=pieno in fondo all'indirizzo della pagina
// (gioco.html?set=pieno): vince l'indirizzo.
const PERCORSO_SET = "ridotto"; // "ridotto" | "pieno" — Damiano li prova tutti e due (07/10)
// L'unita` scritta sotto il numero dei passi sulla ruota (scelta H): "orme" (due impronte,
// raccomandazione di Chiara) oppure "parola" (PASSI scritto per esteso). Anche qui
// ?unita=parola nell'indirizzo vince su questa riga.
const PERCORSO_UNITA_RUOTA = "parola"; // "orme" | "parola" — dal 09/10/2026 (quinta stesura) sugli spicchi si legge «N PASSI», senza orme
// Per provare una striscia di una lunghezza decisa a mano: ?caselle=40 nell'indirizzo
// (tra 15 e 80). Senza, la lunghezza e` quella della serata (percorsoCaselle).
const PERCORSO_CASELLE_FISSE = null; // oppure un numero (es. 40): tutte le serate, qualunque round e giocatori

// Cosa c'e` nell'indirizzo (gioco.html?set=pieno&unita=parola&caselle=40). Il gioco non
// manda niente a nessuno: legge solo il proprio indirizzo.
const PERCORSO_INDIRIZZO = (() => {
  try { return new URLSearchParams(window.location.search); } catch (e) { return { get: () => null }; }
})();
function percorsoSetInUso() {
  // Regolamento del 09/10/2026 (§1): «Solo il set ridotto. Il set pieno e il suo interruttore (PERCORSO_SET, ?set=pieno)
  // restano spenti: si riprendono dopo la prova». Finche' non si riprende, ?set=pieno nell'indirizzo non fa niente.
  return "ridotto";
}
function percorsoUnitaInUso() {
  if (!PANNELLO_REGOLE_PERCORSO) return PERCORSO_UNITA_RUOTA; // online gli indirizzi di prova non fanno niente
  const v = PERCORSO_INDIRIZZO.get("unita");
  return v === "orme" || v === "parola" ? v : PERCORSO_UNITA_RUOTA;
}
function percorsoCaselleForzate() {
  if (!PANNELLO_REGOLE_PERCORSO) return PERCORSO_CASELLE_FISSE; // online gli indirizzi di prova non fanno niente
  const n = parseInt(PERCORSO_INDIRIZZO.get("caselle"), 10);
  if (Number.isFinite(n) && n >= 15 && n <= 80) return n;
  return PERCORSO_CASELLE_FISSE;
}

// ---- la striscia -------------------------------------------------------------
// La lunghezza segue la serata (scelta A): 5 × (round + 6 − giocatori). In quattro
// 25 · 35 · 45 caselle per 3 · 5 · 7 round, in tre 30 · 40 · 50, in due 35 · 45 · 55
// (a squadre contano le squadre). L'alternativa e` PERCORSO_CASELLE_FISSE = 40.
function percorsoCaselle(round, giocatori) { return 5 * (round + 6 - giocatori); }

// ---- gli spicchi: passi al posto degli euro --------------------------------------
// Un valore per ogni posto di SEGMENTI_RUOTA (24): null dove non ci sono passi (Nebbia — cosi` si chiama la Bancarotta nel Percorso —, Passa, il
// triplo, e i sette spicchi che nel Percorso sono speciali: sei Scatole e Robin Hood, vedi PERCORSO_RUOTA_SPECIALI). Settima stesura (10/10/2026,
// §1): la ruota e` la stessa tutti i giorni e i passi sono solo da 1, 2 e 3 — 13 spicchi: 1 ×3 · 2 ×5 · 3 ×5, media circa 2,2. Mai due spicchi
// vicini con lo stesso numero, mai due Scatole vicine. Il Jolly sta sul 2 del posto 7.
const PASSI_PER_SPICCHIO = [
  null, // 0  Nebbia (la Bancarotta del Percorso)
  null, // 1  Scatola
  1,    // 2
  null, // 3  Passa
  2,    // 4
  null, // 5  Scatola
  3,    // 6
  2,    // 7  il Jolly ci sta sopra (jolly: true in SEGMENTI_RUOTA)
  3,    // 8
  null, // 9  Scatola (posto speciale di oggi)
  2,    // 10
  3,    // 11
  null, // 12 triplo: Nebbia · RADDOPPIO · Nebbia
  null, // 13 Scatola
  1,    // 14
  null, // 15 Passa
  3,    // 16
  null, // 17 Scatola
  2,    // 18
  null, // 19 Robin Hood
  1,    // 20
  null, // 21 Scatola (posto speciale di oggi)
  2,    // 22
  3,    // 23
];
// I sette spicchi speciali della ruota del Percorso (settima stesura, §1): sei Scatole (anche ai due posti speciali di oggi, 9 e 21) e l'unico
// speciale visibile, Robin Hood. Sempre quelli, tutti i giorni: niente programma di speciali per round.
const PERCORSO_RUOTA_SPECIALI = { 1: "scatola", 5: "scatola", 9: "scatola", 13: "scatola", 17: "scatola", 19: "robinhood", 21: "scatola" };


// La Nebbia (Damiano, 07/10 sera). Stesso posto e stessa regola della Bancarotta (l'ombra
// sparisce, il turno passa, il Jolly salva), ma non e` il nero: un grigio di nebbia scuro, con la
// parola bianca. ΔE dai vicini sulla ruota (validate_palette.mjs, 07/10): 25,2 dal blu del 3
// (24,2 per protan/deutan), 30,8 dal rosso dell'1 (13,1), 21,6 dal nero.
const COLORE_NEBBIA = "#3E4A5A";

// Un colore per numero (spirito del punto 29: stessa cifra, stesso colore). Quattro tinte della
// ruota di oggi (300, 500, 800, 900 €) piu` l'olografico oro del 1.500 € per il 5, «da premio».
// Le 24 adiacenze della ruota: ΔE ≥ 18,4 a vista normale e ≥ 12,4 per protan/deutan
// (design/strumenti/colori-percorso.mjs).
const COLORE_PER_PASSI = {
  1: "#E53935",
  2: "#FBC02D",
  3: "#1E88E5",
  4: "#8E24AA",
  5: "olografico",
};

// ---- gli spicchi speciali del Percorso --------------------------------------------
// Otto, nei due posti fissi 9 e 21, due per round dal round 2. Il Raddoppio non e` fra questi: sta
// al centro dello spicchio in tre, al posto di RADDOPPIA. `nome` e` la parola sullo spicchio (al
// massimo 10 lettere, come ROBIN HOOD), `titolo` il nome intero nei cartelli. Robin Hood e` lo
// stesso della Classica (SPECIALI): simbolo e nome gia` decisi; nel Percorso prende caselle.
const SPECIALI_PERCORSO = {
  robinhood: SPECIALI.robinhood,
  sorpasso: {
    nome: "SORPASSO",
    titolo: "Sorpasso",
    simbolo: [
      { d: "M12 72 Q50 8 86 60", stroke: 9 },              // il balzo
      { d: "M94 74 L72 52 L94 46 Z", fill: true },          // la punta
      { d: "M41 80 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 Z", fill: true }, // chi viene scavalcato
    ],
  },
  freno: {
    nome: "FRENO",
    titolo: "Freno",
    simbolo: [
      { d: "M50 9 a41 41 0 1 0 0.1 0 Z", stroke: 9 },      // il disco
      { d: "M28 50 L72 50", stroke: 11 },                   // la sbarra
    ],
  },
  scatola: {
    nome: "SCATOLA",
    titolo: "Scatola",
    simbolo: [ // una scatola con il punto interrogativo (settima stesura, §12: il minimo)
      { d: "M14 12 H86 V92 H14 Z", stroke: 8 },
      { d: "M36 40 C36 24 64 24 64 40 C64 52 50 52 50 64", stroke: 9 },
      { d: "M44.5 77 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0 Z", fill: true },
    ],
  },
  scambio: {
    nome: "SCAMBIO",
    titolo: "Scambio d’ombra",
    simbolo: [
      { d: "M12 34 H74", stroke: 9 },
      { d: "M94 34 L72 20 L72 48 Z", fill: true },
      { d: "M88 66 H26", stroke: 9 },
      { d: "M6 66 L28 52 L28 80 Z", fill: true },
    ],
  },
  calamita: {
    nome: "CALAMITA",
    titolo: "Calamita",
    simbolo: [
      { d: "M24 8 V54 a26 26 0 0 0 52 0 V8", stroke: 14 },
      { d: "M16 10 H32 M68 10 H84", stroke: 6 },
    ],
  },
  bivio: {
    nome: "BIVIO",
    titolo: "Bivio",
    simbolo: [
      { d: "M50 92 V52 L18 14 M50 52 L82 14", stroke: 11 },
    ],
  },
  eco: {
    nome: "ECO",
    titolo: "Eco",
    simbolo: [
      { d: "M10 50 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z", fill: true },
      { d: "M40 26 a30 30 0 0 1 0 48", stroke: 8 },
      { d: "M58 12 a48 48 0 0 1 0 76", stroke: 8 },
    ],
  },
};
// La ruota (ruota.js) e la pagina (svgSimbolo, pillola) leggono i simboli con definizioneSpeciale(): i cinque della
// Classica (SPECIALI) e questi otto. SPECIALI resta di cinque voci, com'e` (la scheda di Chiara diceva di
// estenderlo con Object.assign, ma le prove della Classica pretendono che gli speciali siano cinque).
function definizioneSpeciale(chiave) { return SPECIALI[chiave] || SPECIALI_PERCORSO[chiave]; }
const POSTI_SPECIALI_PERCORSO = POSTI_SPECIALI; // gli stessi due posti, 9 e 21

// ---- le caselle speciali della striscia --------------------------------------------
// Stesso linguaggio degli spicchi speciali: distintivo bianco, simbolo verde-azzurro scuro.
// Il Fiume non e` un distintivo: e` una colonna d'acqua su tutte le corsie.
// Dall'08/10/2026 (tappe del viaggio, disegno di Chiara, scelte di Damiano) le caselle hanno nomi e segni di viaggio:
// Trampolino → Scorciatoia, Pedaggio → Castello, la Bottega tiene il nome col segno della bancarella. Le chiavi
// (trampolino, pedaggio...) restano quelle del codice: sono nomi interni, non si vedono. `riga` e` quello che dice la
// legenda «Le tappe» sulla mappa dell'iscrizione (al massimo 48 lettere); `rigaSetPieno` se col set pieno cambia.
const CASELLE_PERCORSO = {
  pedaggio: {
    titolo: "Castello",
    simbolo: [
      { d: "M12 92 V34 H28 V16 H42 V34 H58 V16 H72 V34 H88 V92 Z M40 92 V66 a10 10 0 0 1 20 0 V92 Z", fill: true, regola: "evenodd" },
    ],
    riga: "Costruito vincendo la Battaglia, regala un passo a chi l’ha costruito.", // Damiano, 09/10/2026: la seconda meta` della riga di prima (scheda dei ritocchi R1); la prima, «chi ci passa perde un passo del fantasma», era del Castello del gioco, tolto nella sesta stesura. La legenda dell'iscrizione oggi non lo mostra (la plancia non ha Castelli fissi).
  },
  trampolino: {
    titolo: "Scorciatoia",
    simbolo: [
      { d: "M20 22 L48 50 L20 78", stroke: 13 },
      { d: "M52 22 L80 50 L52 78", stroke: 13 },
    ],
    riga: "Ci arrivi? Salti avanti di 3 caselle.",
  },
  rifugio: {
    titolo: "Rifugio",
    simbolo: [{ d: "M50 10 L8 54 H24 V90 H76 V54 H92 Z M42 90 V64 H58 V90 Z", fill: true, regola: "evenodd" }],
    riga: "Finché ci stai sopra, Robin Hood e Sorpasso non ti toccano.",
    rigaSetPieno: "Al sicuro: niente furti, sorpassi o calamite.",
  },
  belvedere: {
    titolo: "Belvedere",
    simbolo: [
      { d: "M6 50 Q50 4 94 50 Q50 96 6 50 Z", stroke: 8 },
      { d: "M36 50 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 Z", fill: true },
    ],
    riga: "Al round dopo, una consonante gratis.",
  },
  fiume: {
    titolo: "Fiume",
    simbolo: [
      { d: "M4 36 q11 -14 22 0 t22 0 t22 0 t22 0", stroke: 8 },
      { d: "M4 66 q11 -14 22 0 t22 0 t22 0 t22 0", stroke: 8 },
    ],
    riga: "L’ombra si ferma qui finché non risolvi.",
  },
  bottega: {
    titolo: "Bottega",
    simbolo: [
      { d: "M8 24 H92", stroke: 10 },
      { d: "M12 28 H88 V42 q-9.5 12 -19 0 q-9.5 12 -19 0 q-9.5 12 -19 0 q-9.5 12 -19 0 Z", fill: true },
      { d: "M24 62 H76 V92 H24 Z", fill: true },
    ],
    riga: "Compri un Jolly o uno Scudo coi tuoi passi.",
  },
  ponte: {
    titolo: "Ponte",
    simbolo: [
      { d: "M8 82 V60 Q50 6 92 60 V82", stroke: 9 },
      { d: "M4 84 H96", stroke: 9 },
    ],
    riga: "Al prossimo Castello passi gratis.",
  },
};
// La riga della legenda per una tappa, secondo il set in uso (il Rifugio protegge da piu` cose col set pieno).
function rigaTappa(tipo) {
  const c = CASELLE_PERCORSO[tipo];
  return (percorsoSetInUso() === "pieno" && c.rigaSetPieno) || c.riga;
}

// Le dieci caselle del primo disegno, su una striscia di 40: mai due vicine, il Fiume a meta`.
const CASELLE_SPECIALI_40 = {
  6: "trampolino",
  9: "pedaggio",
  12: "rifugio",
  15: "belvedere",
  20: "fiume",
  24: "bottega",
  27: "ponte",
  30: "pedaggio",
  33: "rifugio",
  36: "trampolino",
};

// I due set (scelta B): ridotto = le idee del primo giro, pieno = tutto.
const PERCORSO_SETS = {
  // settima stesura (10/10/2026): niente speciali a rotazione (la ruota e` sempre la stessa: Scatole e Robin Hood) e niente tappe fisse
  // (le Scorciatoie sono nascoste e nascono a caso, i Castelli li costruisce il lampo). Il set pieno resta spento.
  ridotto: { spicchi: [], caselle: {} },
  pieno:   { spicchi: [], caselle: {} },
};

// Quali speciali escono a ogni round: la regola «i due meno visti» di programmaSpeciali (sopra),
// sugli speciali del set in uso. Con quattro speciali e 5 round escono tutti e quattro due volte;
// con otto, cinque o sei una volta. Round 1: nessuno (come la Classica). Una copia della
// regola, non la stessa funzione, perche` la Classica non deve cambiare in niente.
function programmaSpecialiPercorso(numeroRound) {
  const chiavi = PERCORSO_SETS[percorsoSetInUso()].spicchi;
  const conto = {};
  chiavi.forEach((k) => { conto[k] = 0; });
  const chiave = (c) => c.slice().sort().join("+");
  const programma = [null]; // round 1
  const uscite = new Set();
  let precedente = null;
  for (let r = 2; r <= numeroRound; r++) {
    const minimo = Math.min(...chiavi.map((k) => conto[k]));
    const alMinimo = chiavi.filter((k) => conto[k] === minimo);
    const coppie = [];
    if (alMinimo.length >= 2) {
      for (let i = 0; i < alMinimo.length; i++) for (let j = i + 1; j < alMinimo.length; j++) coppie.push([alMinimo[i], alMinimo[j]]);
    } else {
      chiavi.filter((k) => k !== alMinimo[0]).forEach((k) => coppie.push([alMinimo[0], k]));
    }
    let ammesse = coppie.filter((c) => chiave(c) !== precedente);
    if (!ammesse.length) ammesse = coppie;
    const nuove = ammesse.filter((c) => !uscite.has(chiave(c)));
    const scelta = (nuove.length ? nuove : ammesse)[Math.floor(Math.random() * (nuove.length ? nuove : ammesse).length)].slice();
    if (Math.random() < 0.5) scelta.reverse(); // chi va nel posto 9 e chi nel 21
    programma.push(scelta);
    scelta.forEach((k) => { conto[k] += 1; });
    precedente = chiave(scelta);
    uscite.add(precedente);
  }
  return programma;
}

// Le caselle speciali del set in uso, su una striscia della lunghezza data: le posizioni del set
// (scritte per 40) si scalano in proporzione (Math.round(i × caselle / 40)), mai due sulla stessa
// casella, mai la casella 0 (il via) ne` l'ultima (il traguardo). Con 40 sono quelle del set.
function posizioniCaselleSpeciali(caselle) {
  const base = PERCORSO_SETS[percorsoSetInUso()].caselle;
  const out = {};
  Object.keys(base).map(Number).sort((a, b) => a - b).forEach((i) => {
    let p = Math.min(caselle - 1, Math.max(1, Math.round((i * caselle) / 40)));
    // se e` gia` presa, si cerca la piu` vicina libera (prima avanti, poi indietro)
    for (let d = 1; out[p] && d < caselle; d++) {
      if (p + d <= caselle - 1 && !out[p + d]) { p = p + d; break; }
      if (p - d >= 1 && !out[p - d]) { p = p - d; break; }
    }
    out[p] = base[i];
  });
  return out;
}

// ---- i numeri delle regole (tutti da ritoccare qui) ---------------------------------
const PERCORSO_COSTO_VOCALE_PASSI = 1;      // la vocale costa un passo all'ombra (Damiano, 06/10)
const PERCORSO_ROBIN_HOOD_PASSI = 3;         // dalla pedina di chi e` in testa alla tua ombra
const PERCORSO_SORPASSO_ENTRO = Infinity;    // Sorpasso a qualunque distanza (scelta D dei conti)
const PERCORSO_CALAMITA_ENTRO = 5;           // Calamita entro 5 caselle (scelta D)
const PERCORSO_TRAMPOLINO_SALTO = 3;
const PERCORSO_SASSO_INDIETRO = 3;           // il Sasso si posa al massimo 3 pietre dietro la propria pedina (10/10, quarta prova)
const PERCORSO_VALANGA_PASSI = 2;            // la Valanga: chi e` in testa torna indietro di 2 (settima stesura, §8)
const PERCORSO_BIVIO = { sicuri: 2, rischio: 6 };
const PERCORSO_BOTTEGA = { jolly: 4, scudo: 3 }; // prezzi in passi, pagati dall'ombra
const PERCORSO_PEDAGGIO_PASSI = 1;
const PERCORSO_BELVEDERE_PASSI_PER_LETTERA = 1; // Belvedere: un passo per ogni volta che la consonante c'e` (scelta E)
const PERCORSO_PASSO_SOLUZIONE = 1;          // chi risolve con l'ombra a +0 avanza di 1 (scelta F)

// ---- la quinta stesura (regolamento del 09/10/2026, design/2026-10-09-regolamento-percorso.md) ---------------------
// La plancia (§12-bis): un sentiero DISEGNATO, non calcolato. Per ora ne esiste una sola, da 40 pietre (3 giocatori, 5 round, la
// serata di casa) e si usa per tutte le serate: le altre si disegnano dopo la prova. Le misure sono nelle unita` del paesaggio
// (viewBox 1920 × 1080). Sesta stesura (09/10 sera): il sentiero in prospettiva, disegnato da Chiara (design/2026-10-09-scheda-paesaggio-percorso.md).
// Le tappe sono le due Scorciatoie (6 e 35, in PERCORSO_SETS) e i due bivacchi (13 e 27, un terzo e due terzi, mai su una tappa).
const PLANCIA_40 = {
  caselle: 40,
  // il sentiero parte vicino a chi guarda (in basso a sinistra), corre lungo il prato, gira al bordo destro, torna sul fianco della
  // montagna, gira ancora e sale alla vetta (in alto a destra). Le pietre non sono equidistanti: la spaziatura la da` la prospettiva.
  sentiero: "M720,946 C980,972 1260,952 1500,892 C1670,850 1860,840 1842,756 C1824,680 1620,690 1506,646 C1432,618 1446,548 1520,486 C1600,422 1700,364 1700,316 C1700,294 1722,278 1734,262",
  bivacchi: [13, 27],
  campoBase: { x: 655, y: 942 },
  cima: { x: 1734, y: 262 },
  // la prospettiva (sesta stesura, scheda di Chiara §1.1): la misura dipende solo dalla y. A `vicino` (in basso) tutto e` a misura 1;
  // a `lontano` (in alto) il suolo (pietre, nastro, alberi, edifici) e` a `suolo` e le pedine (meeple, fantasmi, tende, chip) a `pezzi`.
  prospettiva: { vicino: 950, lontano: 262, suolo: 0.55, pezzi: 0.7 },
  // il lato dell'edificio accanto alle tappe fisse, alternato lungo il sentiero (scelto sul disegno: il 13 e il 27 stanno quasi sulla stessa verticale)
  lato: { 6: "sopra", 13: "sotto", 27: "sopra", 35: "sotto" },
  // le pietre dove il Castello del lampo non ha posto non sono scritte qui: le calcola il paesaggio (dipende dai Castelli gia` costruiti)
};
// La lunghezza del sentiero la sceglie il regista dal pannello (`caselle`, partenza 25; Damiano 10/10, quarta prova: su 40 pietre in 5 giorni la vetta non si
// raggiungeva). I due bivacchi si mettono da soli a un terzo e a due terzi (arrotondati), mai sul campo base (0) ne' sul traguardo (ultima pietra).
function percorsoBivacchi(n) {
  const a = Math.min(n - 2, Math.max(1, Math.round(n / 3)));
  const b = Math.min(n - 1, Math.max(a + 1, Math.round((2 * n) / 3)));
  return [a, b];
}
const PLANCE_PERCORSO = [{ id: "40", nome: "Il sentiero", plancia: PLANCIA_40 }]; // una sola; la lunghezza e` del pannello (percorsoBivacchi)

// I sei meeple (scheda §5.1): ognuno con la sua sagoma e il suo colore; il colore segue il meeple. Le sagome sono disegnate in un
// riquadro 48 × 64 con i piedi a y 64, senza colore (lo danno gli <use>).
const MEEPLE_CORPO = '<path d="M24,24 C16,24 12,31 12,40 L12,64 L36,64 L36,40 C36,31 32,24 24,24 Z"/>';
const MEEPLE = [
  { id: "viandante", nome: "Viandante", colore: "#E74C3C",
    sagoma: '<circle cx="24" cy="16" r="9"/><path d="M7,21 L41,21 L37,15 L30,15 L28,7 L20,7 L18,15 L11,15 Z"/>' + MEEPLE_CORPO },
  { id: "esploratrice", nome: "Esploratrice", colore: "#3498DB",
    sagoma: '<circle cx="24" cy="15" r="9"/><path d="M30,9 C40,10 42,20 37,30 L31,22 Z"/>' + MEEPLE_CORPO + '<rect x="33" y="30" width="11" height="22" rx="5"/>' },
  { id: "alpinista", nome: "Alpinista", colore: "#27AE60",
    sagoma: '<path d="M24,1 L35,20 L13,20 Z"/><circle cx="24" cy="3.5" r="3.5"/><circle cx="24" cy="17" r="8.5"/>' + MEEPLE_CORPO + '<rect x="40" y="22" width="4.5" height="42" rx="2"/>' },
  { id: "cavaliere", nome: "Cavaliere", colore: "#F39C12",
    sagoma: '<path d="M13,9 L35,9 L35,23 L13,23 Z"/><circle cx="24" cy="16" r="9"/><path d="M24,10 C19,1 31,-1 36,4 C31,5 28,7 26,10 Z"/><path d="M24,24 C13,24 7,32 7,42 L7,64 L41,64 L41,42 C41,32 35,24 24,24 Z"/>' },
  { id: "maga", nome: "Maga", colore: "#9B59B6",
    sagoma: '<path d="M24,0 L34,19 L14,19 Z"/><path d="M6,22 L42,22 L39,16 L9,16 Z"/><circle cx="24" cy="17" r="8"/><path d="M24,24 C18,24 14,30 13,38 L7,64 L41,64 L35,38 C34,30 30,24 24,24 Z"/>' },
  { id: "pellegrina", nome: "Pellegrina", colore: "#A6D930",
    sagoma: '<path d="M11,22 C11,7 37,7 37,22 L37,27 L11,27 Z"/><circle cx="24" cy="19" r="8"/><path d="M24,24 C12,24 7,34 7,46 L7,64 L41,64 L41,46 C41,34 36,24 24,24 Z"/>' },
];

// Il pannello di controllo (§12): i numeri che il regista regola giocando. I valori di partenza sono una PRIMA PROPOSTA di
// Erbottega (il regolamento dice «i numeri non sono decisi»); il pannello li ritocca e il browser li ricorda.
//   oreStabile / oreVariabile: ogni quante ore (giri di ruota) cambia il tempo, nelle giornate stabili e in quelle variabili;
//   crescita: la probabilita` (in %) che l'ULTIMA giornata della serata sia variabile; sale in linea retta dal giorno 2
//             (il primo giorno e` sempre calmo) all'ultimo;
//   preavviso: quante ore prima le nuvole avvisano (e il tempo non cambia mai piu` spesso di cosi`);
//   oreTramonto: quanti giri di ruota restano dopo la prima tenda (minimo 1).
// Il pannello «Regola il Percorso» esiste solo nella copia di lavoro (13/10/2026, decisione di Damiano: «sono settaggi che non devono poter
// cambiare» sul sito online). Qui sta true; pubblica.sh, copiando config.js nella cartella pubblica, riscrive QUESTA RIGA con false (e si
// ferma se non ci riesce). Con false: il pulsante e la finestra vengono tolti dalla pagina, il gioco usa sempre i valori di partenza qui sotto
// (un valore salvato prima nel browser di qualcuno non conta, e viene cancellato), e gli indirizzi ?caselle= e ?unita= non fanno niente.
// Non cambiare il testo di questa riga a mano senza cambiare anche pubblica.sh, che la cerca cosi' com'e'.
const PANNELLO_REGOLE_PERCORSO = false;
const PERCORSO_REGOLE_DI_PARTENZA = { caselle: 25, oreTempo: 4, oreInPiuPrimoGiorno: 4, preavviso: 3, oreTramonto: 3, scorciatoie: 2, scatolaForza: 4, scatolaDistanza: 8 };
const PERCORSO_REGOLE_LIMITI = {
  caselle: [20, 40, "Lunghezza del sentiero (pietre)"],
  oreTempo: [3, 24, "Ogni quante ore cambia il tempo"],
  oreInPiuPrimoGiorno: [0, 24, "Il primo giorno cambia più di rado: ore in più"],
  preavviso: [1, 6, "Preavviso delle nuvole (ore)"],
  oreTramonto: [1, 6, "Ore del tramonto (giri di ruota dopo la prima tenda)"],
  scorciatoie: [0, 4, "Scorciatoie nascoste"],
  scatolaForza: [0, 10, "Scatola: quanto la distanza da chi è in testa sposta le probabilità (0 = per niente)"],
  scatolaDistanza: [1, 20, "Scatola: a quante caselle dal primo la spinta è al massimo"],
};
// Gli otto potenziamenti della Scatola (settima stesura, §8). `peso`: forte | medio | leggero (come spinge la Scatola, vedi Percorso.pesiScatola);
// `auto`: scatta da solo (Scudo, Ramponi), gli altri si usano nel proprio turno, prima di girare. `riga`: cosa dice quando esce (una riga sola).
const PERCORSO_POTENZIAMENTI = {
  valanga:  { nome: "Valanga", peso: "forte", auto: false, riga: "Chi è in testa torna indietro di 2 caselle." },
  sorpasso: { nome: "Sorpasso", peso: "forte", auto: false, riga: "Vai sulla pietra davanti alla prima pedina che hai davanti." },
  scarponiGrandi: { nome: "Scarponi grandi", peso: "forte", auto: false, extra: 2, riga: "Alla tua prossima consonante giusta fai 2 passi in più." },
  freno:    { nome: "Freno", peso: "medio", auto: false, riga: "Scegli chi frenare: al suo prossimo turno né il passo né l’ombra si muovono." },
  scarponi: { nome: "Scarponi", peso: "medio", auto: false, extra: 1, riga: "Alla tua prossima consonante giusta fai 1 passo in più." },
  scudo:    { nome: "Scudo", peso: "leggero", auto: true, riga: "Scatta da solo: para il primo attacco che ti arriva." },
  sasso:    { nome: "Sasso", peso: "leggero", auto: false, riga: "Lo posi su una delle 3 pietre dietro di te: il primo che ci passa torna indietro di un passo." },
  ramponi:  { nome: "Ramponi", peso: "leggero", auto: true, riga: "Scatta da solo: la prossima Nebbia non ti fa sparire l’ombra." },
};
const CHIAVE_REGOLE_PERCORSO = "giraleparole-percorso-regole";
// Che tempo arriva (pesi): il Sereno e` il piu` frequente (§5). Anche questi sono una proposta.
const PERCORSO_TEMPO_PESI = { sereno: 36, ventoso: 20, temporale: 14 }; // tre tempi (settima stesura, §6)
const PERCORSO_BIVACCO_PASSO_CASTELLO = 1;   // il passo che il Castello regala al castellano
const DURATA_PASSO_MS = 480;                  // UN ritmo solo: 480 ms a pietra, di giorno, di sera, sul Castello, nei passi del lampo (Damiano 09/10 sera, scelta 2 di Chiara)
const DURATA_BOLLA_PRIMA_VOLTA_MS = 0;        // 0 = resta finche' il regista non la chiude (Ok, il velo, Esc)
const DURATA_PASSEGGIATA_PAUSA_MS = 450;
const DURATA_SALTO_SCORCIATOIA_PAUSA_MS = 200;
const DURATA_TENDA_RIPIEGA_MS = 300;

// ---- le durate (ms) --------------------------------------------------------------------
// Il CSS (proposta.css, ora in style.css) ha gli stessi numeri scritti nelle sue animazioni:
// se si cambia uno qui, va cambiato anche li`.
const DURATA_OMBRA_SCIVOLA_MS = 420;
const DURATA_CHIP_PASSI_MS = 1200;
const DURATA_NEBBIA_MS = 520;          // l'ombra trema e svanisce (poi il velo grigio della corsia, 600)
const DURATA_FANTASMA_SERA_MS = 900;  // la sera il fantasma si dissolve (quando la pedina lo raggiunge, o subito per chi non cammina)
const DURATA_VELO_NEBBIA_MS = 600;
const DURATA_SALTO_PEDINA_MS = 650;    // poi l'ombra assorbita, 320 ms
const DURATA_SORPASSO_MS = 420;
const DURATA_SCAMBIO_MS = 600;
let DURATA_CARTELLO_PERCORSO_MS = 3000; // i cartelli degli speciali del Percorso con la riga lunga (Vento, Eco, Calamita...): come Robin Hood (controllo di Chiara 08/10: il regista li legge a voce)
const DURATA_RITARDO_OMBRA_MS = 350;       // l'ombra parte dopo che il cartello della lettera e` sul palco (come nel prototipo)
// (Robin Hood: DURATA_ROBIN_HOOD_MS, quella del 07/10, 3000)

// ---- i ritocchi dopo la prima partita (09/10/2026 sera, design/2026-10-09-scheda-ritocchi-percorso.md) --------------------
// R11: nel Percorso ogni annuncio a tempo dura un secondo in piu` (lo applica preparaModalita); «Tocca a» va a 2700; la lettera
// resta finche' le caselle sono scoperte (non ha durata).
const PERCORSO_ANNUNCIO_IN_PIU_MS = 1000;
const DURATA_TOCCA_A_PERCORSO_MS = 2700;
const DURATE_BASE_ANNUNCI = { annuncio: 1300, lungo: 1800, toccaA: 2400, robin: 3000, cartello: 3000 }; // i valori della Classica
// R4: il fantasma in due tempi sulle tappe
const DURATA_FANTASMA_PAUSA_TAPPA_MS = 200;
const DURATA_FANTASMA_INDIETRO_MS = 300;
const DURATA_FANTASMA_PAUSA_CASTELLO_MS = 150;
// R9/R10: gli annunci grandi del tempo, dell'ultimo giro e della sera
const DURATA_ANNUNCIO_TEMPO_MS = 3100;         // «Ultimo giro!», «Non si gira piu`»
const DURATA_ANNUNCIO_CAMBIO_TEMPO_MS = 4100; // il cambio di tempo: un secondo in piu` (Damiano 09/10 sera, appunto 9), al centro e col resto offuscato
const DURATA_ANNUNCIO_SERA_MS = 2800;
const DURATA_ANNUNCIO_VIAGGIATORE_MIN_MS = 1500; // l'annuncio di chi cammina resta finche' cammina, almeno questo
// R12: il cartellino della tappa toccata si chiude da solo
const DURATA_CARTELLINO_TAPPA_MS = 6000;
