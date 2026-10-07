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
const DURATA_ROBIN_HOOD_MS = 3000;        // il cartello intero con la pedina che passa di mano
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
const DURATA_ANNUNCIO_MS = 1300;
const DURATA_ANNUNCIO_LUNGO_MS = 1800;

// Punto 69, quattordicesimo giro (29/09/2026, disegno di Chiara): ogni
// annuncio che passa il turno ha un secondo tempo, «Tocca a <nome>», che
// arriva DOPO DURATA_ANNUNCIO_MS (o DURATA_ANNUNCIO_LUNGO_MS per la
// bancarotta) e dura DURATA_TOCCA_A_MS — durante questo tempo il turno e`
// gia` passato e la fila dei giocatori mostra il balzo (voce 2 della scheda).
// I comandi tornano solo alla fine di questo secondo tempo, non prima.
// Raccomandazione di Chiara: 2400. Se in prova sembra lento, scendere a 1800.
const DURATA_TOCCA_A_MS = 2400;

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
  "Funk-Game-Loop.mp3",
  "C-Funk.mp3",
  "Funk-Game-Loop.mp3",
  "Protofunk.mp3",
];

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
