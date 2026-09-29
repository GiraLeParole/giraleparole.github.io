// ============================================================================
// CONFIGURAZIONE DEL GIOCO — GIRA LE PAROLE
// Tutto quello che Damiano vuole poter ritoccare giocando sta qui, in un solo
// punto. Non serve capire il resto del codice per cambiare questi numeri.
// ============================================================================

// ----------------------------------------------------------------------------
// LA RUOTA — composizione degli spicchi.
// ----------------------------------------------------------------------------
// Ogni spicchio e un oggetto con:
//   tipo:    "soldi" | "passa" | "bancarotta" | "jolly"
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
//   Cosi` restano 2 copie per ognuno dei 7 livelli invariati e 3 copie per
//   400€ e 800€ — lo sbilancio minimo possibile spalmando 20 spicchi "soldi"
//   su 9 livelli (20 non e` multiplo di 9). Verificato con
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
// PALETTE PER CIFRA — quella validata da Chiara col validatore delle
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
  { tipo: "soldi", valore: 800 }, // ex-Passa (quattordicesimo giro, punto 75): fra 400€ e 500€, valore alto
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
  { tipo: "soldi", valore: 400 }, // ex-Passa (quattordicesimo giro, punto 75): fra 900€ e 1000€, valore basso
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

// Ogni cifra introdotta da CIFRE_PER_ROUND che NON esisteva gia` in
// COLORE_PER_CIFRA prende, in automatico, il colore del SUO livello (stesso
// posto della tabella qui sopra — "stessa famiglia" perche` e` letteralmente
// lo stesso spicchio, solo con un numero piu` alto), tranne l'ultimo livello
// (indice 8, "da premio") che resta sempre "olografico" qualunque cifra
// raggiunga, cosi` come il 1500 del round 1 oggi. Fatto una volta sola qui,
// cosi` ruota.js continua a leggere COLORE_PER_CIFRA esattamente come prima
// — nessun cambiamento al disegno.
// PROVVISORIO, da guardare con Chiara: e` la scelta piu` semplice possibile
// ("stessa famiglia" = stesso colore esatto del livello, non una sfumatura
// nuova), e non rifa` il controllo delle adiacenze (ΔE) che lei aveva
// validato solo sui 9 colori del round 1 — una cifra nuova potrebbe finire
// vicino a uno spicchio dello stesso colore su una ruota di un round diverso
// da quello per cui erano stati calcolati gli scarti.
(function estendiColorePerCifra() {
  CIFRE_PER_ROUND.forEach((riga) => {
    riga.forEach((cifra, i) => {
      if (COLORE_PER_CIFRA[cifra] !== undefined) return;
      const coloreLivello = COLORE_PER_CIFRA[LIVELLI_BASE_CIFRE[i]];
      COLORE_PER_CIFRA[cifra] = coloreLivello;
      if (typeof console !== "undefined" && console.info) {
        console.info(
          `[config] cifra nuova ${cifra}€ (livello ${i}, base ${LIVELLI_BASE_CIFRE[i]}€) senza colore proprio: presa la famiglia di quel livello (${coloreLivello}) — da rivedere con Chiara.`
        );
      }
    });
  });
})();

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
const VOLUME_MUSICA_CURSORE_INIZIALE = 0.5;
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
const CHIAVE_FRASI_NOSTRE = "giraleparole-frasi-nostre"; // scritta dalla pagina "Le nostre frasi" (giro C, non ancora costruita)

// ----------------------------------------------------------------------------
// GIRO B E GIRO C — non ancora costruiti (round lampo, frase premio, albo
// d'oro, le nostre frasi, sfida): un solo interruttore nasconde tutto quello
// che li riguarda nell'iscrizione e nella mini guida — «Come si gioca» mostra
// solo le prime 6 voci finché resta false. Giovedì, quando si costruiscono,
// basta girare questo a true.
// ----------------------------------------------------------------------------
const GIRO_B_C_ATTIVO = false;

// ----------------------------------------------------------------------------
// FISICA DELLA RUOTA — "gira come una ruota vera", non a scatto
// ----------------------------------------------------------------------------
// Quarto giro, punto 21 (28/09/2026): "gira molto piu` lentamente, come se
// fosse una persona a farla girare — un giro e mezzo, forse tre, e una
// frenata lunga e naturale". Prima erano 4-7 giri in 4.2-6 secondi: la
// girata sembrava un motore che frena, non una spinta di mano.
//
// GIRI_MINIMI + GIRI_EXTRA_CASUALI decidono i giri INTERI (1 o 2, a caso);
// la frazione random si aggiunge sotto (ANGOLO_EXTRA_MIN/MAX_TURNI, usata
// in gioco.js). Combinati, il totale di ogni girata cade sempre fra 1,5 e
// 3 giri pieni, mai fuori da quella forchetta:
//  - 1,5-2,0 giri se esce il giro intero piu` basso (1);
//  - 2,5-3,0 giri se esce quello piu` alto (2).
const GIRI_MINIMI = 1;          // giri completi minimi, prima della frazione extra
const GIRI_EXTRA_CASUALI = 1;   // giri completi aggiuntivi, scelti a caso (0 o 1)

// La frazione di giro "extra" che si somma sempre ai giri interi qui sopra:
// fra mezzo giro e un giro intero, mai meno, mai di piu`.
const ANGOLO_EXTRA_MIN_TURNI = 0.5;
const ANGOLO_EXTRA_MAX_TURNI = 1.0;

const DURATA_SPIN_MS_MIN = 7000; // durata minima di una girata, in millisecondi
const DURATA_SPIN_MS_MAX = 9000; // durata massima di una girata, in millisecondi

// Terzo giro, punto 14: "la partenza e` troppo veloce, il rallentamento va
// bene". La curva di prima (easeOutCubic pura) partiva gia` alla velocita`
// massima e da li` decelerava soltanto: non c'era mai stata una vera spinta
// iniziale, era gia` tutta frenata.
// Ora la girata ha due tratti, uno che sale e uno che scende (due quarti di
// onda sinusoidale, saldati dove si incontrano): prima una SPINTA che parte
// da ferma e acquista velocita` piano, poi una FRENATA che rallenta piano
// fino a fermarsi — proprio come una ruota vera. I due tratti si uniscono
// senza scatti (la velocita` nel punto di saldatura e` la stessa arrivando
// da un lato e partendo dall'altro, per costruzione: e` la ragione per cui
// la formula usa lo stesso numero come ampiezza di entrambi i tratti).
// Un solo numero da ritoccare: quanto dura la spinta iniziale, in frazione
// del tempo totale della girata. Piu` piccolo = spinta piu` breve e brusca,
// piu` grande = partenza piu` lunga e dolce.
//
// Quarto giro, punto 21: portato da 0.15 a 0.45. Con una spinta cosi` lunga
// la velocita` resta bassa per buona parte del primo secondo (misurato: nel
// caso piu` lento del primo secondo si vedono ~1,1 spicchi, nel caso piu`
// veloce ~4 spicchi su 24 totali — mai un lampo indistinguibile), e la
// frenata che segue occupa il restante 55% della durata: piu` lunga della
// spinta, come chiesto.
const SPIN_FRAZIONE_SPINTA = 0.45;

// ----------------------------------------------------------------------------
// TRASCINAMENTO DELLA RUOTA (punti 61-62, 29/09/2026)
// ----------------------------------------------------------------------------
// "Girare davvero la ruota, trascinandola col mouse o col dito... la si
// afferra, la si trascina e la si lascia: la velocita` di partenza nasce da
// quella del gesto nel momento del rilascio." Mentre si trascina la ruota
// rincorre la mano con un po' di inerzia, non incollata al cursore ("in TV
// dal vivo non pesa poco" — punto 62); dopo il rilascio frena per attrito
// come un oggetto pesante. Il pulsante "Gira la ruota" resta INVARIATO (la
// fisica di GIRI_MINIMI/DURATA_SPIN_MS_MIN-MAX/SPIN_FRAZIONE_SPINTA qui
// sopra, gia` approvata — "la ruota ora gira bene"): questi numeri governano
// SOLO il trascinamento, un motore fisico separato (vedi ruota.js).

// Voce B, tredicesimo giro (29/09/2026, controllo di Chiara,
// `design/2026-09-29-scheda-dodicesimo-giro.md`): il ritardo della mano si
// misura in millisecondi, non piu` "per fotogramma" — TRASCINA_SMORZAMENTO
// (0.16 a ogni fotogramma) valeva circa 95ms a 60Hz ma meno della meta` su
// uno schermo a 144Hz, e la ruota sembrava piu` leggera a seconda dello
// schermo. Con un tempo in millisecondi il ritardo e` lo stesso ovunque.
const TRASCINA_RITARDO_MS = 95;

// Quanti millisecondi di storia recente si guardano per calcolare la
// velocita` di rilascio: un rallentamento della mano appena prima di
// lasciare la presa conta, un campione troppo vecchio no.
const TRASCINA_FINESTRA_VELOCITA_MS = 120;

// Tetto alla velocita` di rilascio misurata, in radianti al secondo — un
// trascinamento irregolare (piu` facile su schermo touch, dove due eventi
// possono arrivare a distanza di un salto grande) non lancia la ruota oltre
// questo. Voce B, tredicesimo giro: prima erano 6,5 rad/s (25 spicchi/s), e
// il lancio piu` forte durava 13s e faceva 6,7 giri (non 5,4 come diceva
// erroneamente questo commento) — troppo, e sopra la girata col pulsante.
// Ora il tetto e` lo stesso della girata piu` veloce del pulsante, 4,2 rad/s
// = 16 spicchi/s: nessun lancio a mano va piu` veloce del pulsante.
const TRASCINA_VELOCITA_MAX_RAD_S = 4.2;

// Decelerazione costante dopo il rilascio, in radianti al secondo quadro —
// attrito vero (velocita` che scende in linea retta fino a fermarsi, mai
// uno scatto): "un oggetto pesante", punto 62. Voce B, tredicesimo giro: da
// 0.5 a 0.47 — con il nuovo tetto di velocita` (4,2 rad/s) il lancio piu`
// forte possibile frena in circa 8,9s e fa circa 3 giri, come il pulsante al
// massimo.
const ATTRITO_RUOTA_RAD_S2 = 0.47;

// Voce B, tredicesimo giro (nuova): quando il lancio non raggiunge la
// soglia di GIRO_MINIMO_VALIDO_TURNI, la ruota frena con QUESTO attrito
// (molto piu` forte di quello normale) e si pianta in meno di 0,6s, invece
// di scorrere fino a 3,5s prima che comparisse "Più forte!" — un bambino
// non fa in tempo a leggere una cifra che non conta.
const ATTRITO_LANCIO_NON_VALIDO_RAD_S2 = 3;

// Punto 62, scelta PROVVISORIA di Alfred (non dettata da Damiano, "questa
// ultima parte e` una scelta di Alfred"): il lancio conta solo se la ruota,
// DAL RILASCIO, fa almeno questa frazione di giro (0.5 = mezzo giro). Sotto
// soglia il lancio non conta: la ruota si pianta subito (vedi
// ATTRITO_LANCIO_NON_VALIDO_RAD_S2), un annuncio sul palco dice di
// rilanciare, e il turno non passa — si puo` riprovare subito. Un solo
// numero da ritoccare se in prova sembra troppo severo o troppo permissivo.
const GIRO_MINIMO_VALIDO_TURNI = 0.5;

// Voce B, tredicesimo giro (nuova): quanto puo` allontanarsi il bersaglio
// del dito dalla ruota disegnata, in radianti — se il dito corre piu` veloce
// di quanto la ruota riesca a rincorrerlo (TRASCINA_RITARDO_MS), il
// bersaglio si riporta a questa distanza: e` la mano che scivola sulla
// ruota, non un elastico che si tende all'infinito.
const TRASCINA_STACCO_MAX_RAD = 0.5;

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
