// ============================================================================
// LA RUOTA — disegno su canvas. La fisica (pulsante e trascinamento) e` in
// fisica-ruota.js, un solo motore, la ruota pesante di Chiara (05/10/2026);
// qui ci sono il disegno, i pioli, la freccia e i gesti della mano.
// Decimo giro (28/09/2026): disegno rifatto secondo la proposta di Chiara
// (`design/2026-09-28-revisione.md`, intervento 2, e il suo prototipo
// `design/prototipi/2026-09-28-schermo-largo/proposta-ruota.js`) — le
// scritte si leggono tutte dal bordo verso il mozzo, come in TV, e non si
// capovolgono mai (il vecchio "raddrizzamento" guardava l'angolo dello
// spicchio senza la rotazione corrente: dopo ogni girata circa meta` ruota
// finiva a testa in giu`). La composizione degli spicchi vive in config.js
// (SEGMENTI_RUOTA), qui c'e solo come si disegna e come gira.
//
// Due cose che il disegno di Chiara richiede e che il vecchio ruota.js non
// doveva gestire:
//  - lo SPICCHIO TRIPLO (tipo "triplo") non e` piu` tre fette intere: e`
//    UNA fetta di 15° divisa nel disegno in tre parti da 5° (bancarotta,
//    RADDOPPIA, bancarotta) — la fisica deve quindi, quando la ruota si
//    ferma su quella fetta, calcolare in quale terzo e` caduta la freccia;
//  - il JOLLY (punto 53, 28/09/2026, terzo giro post-design): non e` piu`
//    una carta sopra uno spicchio (punto 49) ma uno spicchio intero a se`,
//    che pero` vive sullo STESSO indice fisico di un 600€ — quando qualcuno
//    lo prende, quello spicchio smette di disegnarsi come jolly e torna a
//    mostrare la cifra, con una piccola transizione (vedi
//    Ruota.impostaJollyDisponibile / animaPresaJolly). Torna disponibile al
//    round successivo (chi chiama nuovoRound() in gioco.js lo riattiva).
// ============================================================================

// Spicchi speciali (2.4, disegno di Chiara 06/10/2026): colore unico, distintivo
// bianco col simbolo, due posti fissi (POSTI_SPECIALI in config.js) che cambiano
// coppia a ogni round (programmaSpeciali in config.js).
const Ruota = (() => {
  let canvas, ctx;
  let rotazioneCorrente = 0; // radianti, stato persistente fra una girata e l'altra
  let animando = false;
  let evidenziato = null; // indice dello spicchio sotto la freccia, a ruota ferma
  let jollyDisponibile = true; // false quando il jolly di questo round e` gia` stato preso
  let transizioneJolly = null; // { t: 0..1 } mentre la piccola animazione di presa e` in corso

  const N = SEGMENTI_RUOTA.length;
  const ANGOLO_SPICCHIO = (Math.PI * 2) / N;
  const scintille = []; // punti fissi di luccichio per il riempimento olografico

  // Punto 60 (29/09/2026): fotografia del round 1 di ogni spicchio "soldi",
  // presa una volta sola all'avvio — serve a sapere, quando cambia il
  // round, "che livello era" ogni spicchio (SEGMENTI_RUOTA[i].valore viene
  // sovrascritto round dopo round, quindi da solo non basta piu` a
  // ritrovare l'indice in LIVELLI_BASE_CIFRE).
  const VALORE_BASE_SEGMENTI = SEGMENTI_RUOTA.map((seg) => (seg.tipo === "soldi" ? seg.valore : null));

  // Voce C, tredicesimo giro (29/09/2026): quanto ci mette l'onda a fare il
  // giro della ruota, e quanto dura il cambio su un singolo spicchio.
  const ONDA_GIRO_MS = 1000;
  const ONDA_SPICCHIO_MS = 360;
  let transizioneRound = null; // { inizio, prima: [valori del round prima], primaSpeciali }, solo mentre l'onda e` in corso
  // la coppia di speciali di ogni round (programmaSpeciali in config.js), data da gioco.js a inizio partita
  let programmaSpecialiCorrente = null;
  function impostaProgrammaSpeciali(programma) { programmaSpecialiCorrente = programma; }
  function coppiaSpecialiDelRound(numeroRound) {
    const p = programmaSpecialiCorrente || programmaSpeciali(numeroRound);
    programmaSpecialiCorrente = p;
    return p[Math.min(numeroRound, p.length) - 1];
  }

  // Ruota pesante (05/10/2026): il motore fisico, uno solo per pulsante e mano
  let fisica = null;
  let stratoAnello = null; // canvas in cache con anello e pioli, ridisegnato solo se cambia la misura o i pioli
  function creaFisica() {
    const opzioni = {
      pioliPerSpicchio: PIOLI_PER_SPICCHIO,
      spicchi: N,
      inerzia: RUOTA_INERZIA,
      attritoCuscinetto: ATTRITO_CUSCINETTO_RAD_S2,
      lamellaResistenza: LAMELLA_RESISTENZA_RAD_S2,
      lamellaVelocitaRif: LAMELLA_VELOCITA_RIF_RAD_S,
      lamellaFinestraGradi: LAMELLA_FINESTRA_GRADI,
      lamellaRestituzione: LAMELLA_RESTITUZIONE,
      scattoVelocita: LAMELLA_SCATTO_RAD_S,
      velocitaFermo: RUOTA_VELOCITA_FERMO_RAD_S,
      lamellaRitornoMs: LAMELLA_RITORNO_MS,
      spintaCorsaGradiMin: SPINTA_CORSA_GRADI_MIN,
      spintaCorsaGradiMax: SPINTA_CORSA_GRADI_MAX,
      lancioGiriMin: LANCIO_GIRI_MIN,
      lancioGiriMax: LANCIO_GIRI_MAX,
      attritoLancioNonValido: ATTRITO_LANCIO_NON_VALIDO_RAD_S2,
    };
    fisica = FisicaRuota.crea(opzioni);
    fisica.imposta(rotazioneCorrente, 0);
    stratoAnello = null;
  }

  // Aggiorna le cifre della ruota per il round dato (punto 60): ogni
  // spicchio "soldi" prende il valore della sua colonna in CIFRE_PER_ROUND,
  // trovata cercando il valore del round 1 in LIVELLI_BASE_CIFRE. Tipo,
  // posizione, jolly: tutto invariato, cambia solo `valore`.
  //
  // Voce C, tredicesimo giro (29/09/2026, scheda di Chiara): con `conOnda`
  // vero, il cambio non e` piu` istantaneo — un'onda di luce parte dalla
  // freccia e fa il giro in senso orario, spicchio dopo spicchio, e sotto il
  // lampo la cifra vecchia sfuma mentre entra la nuova (vedi faseOnda/
  // disegna). Il round 1 non ha nulla da cui cambiare: gioco.js chiama
  // impostaRound(1, false).
  function impostaRound(numeroRound, conOnda) {
    const riga = cifrePerRound(numeroRound);
    const prima = SEGMENTI_RUOTA.map((s) => s.valore);
    for (let i = 0; i < N; i++) {
      const base = VALORE_BASE_SEGMENTI[i];
      if (base === null) continue;
      const livello = LIVELLI_BASE_CIFRE.indexOf(base);
      if (livello === -1) continue; // non dovrebbe succedere: ogni valore del round 1 e` in LIVELLI_BASE_CIFRE
      SEGMENTI_RUOTA[i].valore = riga[livello];
    }
    // i due posti speciali prendono la coppia del round; sotto
    // l'onda il simbolo e la parola vecchi sfumano via e entrano i nuovi
    // (stesso tempo delle cifre). Il colore dello spicchio non cambia.
    const primaSpeciali = SEGMENTI_RUOTA.map((s) => (s.tipo === "speciale" ? s.speciale || null : null));
    const primaTipi = SEGMENTI_RUOTA.map((s) => s.tipo);
    // Damiano, 06/10 sera: il round 1 non ha speciali («anche in televisione non
    // appaiono mai al primo round»). Nei due posti c'e` la ruota della 2.3 (soldi,
    // stessi valori e colori: VALORE_BASE_SEGMENTI li ricorda); dal round 2 ci sono gli speciali.
    POSTI_SPECIALI.forEach((posto, k) => {
      if (numeroRound >= 2) {
        SEGMENTI_RUOTA[posto].tipo = "speciale";
        SEGMENTI_RUOTA[posto].speciale = coppiaSpecialiDelRound(numeroRound)[k];
      } else {
        SEGMENTI_RUOTA[posto].tipo = "soldi";
        SEGMENTI_RUOTA[posto].speciale = null;
      }
    });
    // (le cifre dei posti tornati soldi le ha gia` messe il ciclo qui sopra: VALORE_BASE_SEGMENTI li ricorda)
    if (conOnda && canvas) {
      transizioneRound = { inizio: performance.now(), prima, primaSpeciali, primaTipi };
      const passo = () => {
        disegna();
        if (transizioneRound && performance.now() - transizioneRound.inizio < ONDA_GIRO_MS + ONDA_SPICCHIO_MS) {
          requestAnimationFrame(passo);
        } else {
          transizioneRound = null;
          disegna();
        }
      };
      requestAnimationFrame(passo);
      return;
    }
    disegna();
  }

  // Voce C: 0..1 = quanto e` avanzato il cambio sullo spicchio i durante
  // l'onda; null se l'onda non e` in corso. La frazione di giro dello
  // spicchio, contata dalla freccia in senso orario, decide QUANDO tocca a
  // lui (l'onda parte dalla freccia e gira in senso orario).
  function faseOnda(i) {
    if (!transizioneRound) return null;
    const am = i * ANGOLO_SPICCHIO + ANGOLO_SPICCHIO / 2;
    const giro = Math.PI * 2;
    const frazione = ((((am + rotazioneCorrente + Math.PI / 2) % giro) + giro) % giro) / giro;
    const t = (performance.now() - transizioneRound.inizio - frazione * ONDA_GIRO_MS) / ONDA_SPICCHIO_MS;
    return Math.max(0, Math.min(1, t));
  }

  // Il tipo con cui si disegna lo spicchio i: durante l'onda un posto che passa da
  // soldi a speciale (round 1 -> 2) tiene il tipo vecchio nella prima meta` del
  // lampo (cifra che sfuma, colore vecchio) e prende quello nuovo nella seconda.
  function tipoVisto(i) {
    const nuovo = SEGMENTI_RUOTA[i].tipo;
    if (transizioneRound && transizioneRound.primaTipi) {
      const fo = faseOnda(i);
      if (fo !== null && fo < 0.5) return transizioneRound.primaTipi[i];
    }
    return nuovo;
  }

  // Ruota pesante (05/10/2026): init riceve anche la freccia
  function init(canvasEl, puntatore) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    puntatoreEl = puntatore || null;
    for (let i = 0; i < 260; i++) {
      scintille.push({ a: Math.random(), r: Math.random(), s: 0.6 + Math.random() * 1.6 });
    }
    creaFisica();
    disegna();
  }

  // Riempimento olografico (il 1500€ "da premio" e il centro del triplo):
  // arcobaleno che scorre lungo il raggio piu` puntini chiari sparsi (i
  // "glitter" della TV). Statico rispetto allo spicchio: la ruota gira, il
  // glitter gira con lei.
  function riempiOlografico(a0, a1, r0, r1, dominante) {
    const g = ctx.createLinearGradient(0, 0, Math.cos((a0 + a1) / 2) * r1, Math.sin((a0 + a1) / 2) * r1);
    const stops =
      dominante === "oro"
        ? ["#f9d976", "#ffb347", "#ff6fa8", "#c084fc", "#60a5fa", "#6ee7b7", "#fde68a"]
        : ["#ff5ea8", "#ffd166", "#6ee7b7", "#60a5fa", "#c084fc", "#ff5ea8"];
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    ctx.beginPath();
    ctx.arc(0, 0, r1, a0, a1);
    ctx.arc(0, 0, r0, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    scintille.forEach((p) => {
      const ang = a0 + p.a * (a1 - a0);
      const rr = r0 + p.r * (r1 - r0);
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, p.s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Voce 5, undicesimo giro (28/09/2026, controllo di Chiara): mescola due
  // colori esadecimali in proporzione t (0 = tutto hexA, 1 = tutto hexB) —
  // serve alla sfumatura dello spicchio jolly, dal bianco al colore del 600€.
  function mixHex(hexA, hexB, t) {
    const a = parseInt(hexA.replace("#", ""), 16);
    const b = parseInt(hexB.replace("#", ""), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  function fetta(a0, a1, r, colore) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = colore;
    ctx.fill();
  }

  // Scritta lungo il raggio, un glifo per riga, dal bordo verso il mozzo
  // (come in TV): mai capovolta, qualunque sia la rotazione della ruota.
  function scrittaRadiale(angolo, testo, rDa, dimFont, colore, contorno, passo) {
    ctx.save();
    ctx.rotate(angolo);
    ctx.font = `800 ${dimFont}px 'Ubuntu', 'Liberation Sans', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let r = rDa;
    for (const ch of testo) {
      ctx.save();
      ctx.translate(r, 0);
      ctx.rotate(Math.PI / 2);
      if (contorno) {
        ctx.lineWidth = Math.max(2, dimFont * 0.14);
        ctx.strokeStyle = contorno;
        ctx.lineJoin = "round";
        ctx.strokeText(ch, 0, 0);
      }
      ctx.fillStyle = colore;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      r -= passo;
    }
    ctx.restore();
  }

  // Vero se questo e` lo spicchio del jolly (punto 53) E il jolly e` ancora
  // li` (non preso in questo round, e non a meta` della transizione di
  // presa: durante la transizione si disegna la cifra, vedi disegnaJollyOCifra).
  function mostraJolly(seg) {
    return seg.jolly && jollyDisponibile;
  }

  // Ruota pesante (05/10/2026): anello dorato + pioli, disegnati una volta in uno strato
  // trasparente grande come il canvas, in coordinate della ruota (centro in
  // mezzo). A ogni fotogramma si appoggia con drawImage dentro la rotazione.
  function strato(w, h, rTotale, spessoreAnello, rSpicchi) {
    if (stratoAnello && stratoAnello.width === w && stratoAnello.height === h) return stratoAnello;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const k = c.getContext("2d");
    k.translate(w / 2, h / 2);
    const anelloGrad = k.createLinearGradient(-rTotale, -rTotale, rTotale, rTotale);
    anelloGrad.addColorStop(0, "#fff2c4");
    anelloGrad.addColorStop(0.35, "#f3c531");
    anelloGrad.addColorStop(0.65, "#c2860a");
    anelloGrad.addColorStop(1, "#8a5c04");
    k.lineWidth = spessoreAnello;
    k.strokeStyle = anelloGrad;
    k.beginPath();
    k.arc(0, 0, rSpicchi + spessoreAnello / 2, 0, Math.PI * 2);
    k.stroke();
    k.lineWidth = 2;
    k.strokeStyle = "#5c3c02";
    k.beginPath(); k.arc(0, 0, rSpicchi, 0, Math.PI * 2); k.stroke();
    k.beginPath(); k.arc(0, 0, rTotale, 0, Math.PI * 2); k.stroke();
    // i pioli: PIOLI_PER_SPICCHIO per spicchio, tutti uguali, uno ogni
    // ANGOLO_SPICCHIO / PIOLI_PER_SPICCHIO — i due di confine compresi. Piu`
    // piccoli di oggi (0.16 dello spessore dell'anello, non 0.24): a 72 la
    // distanza fra due pioli e` 42 px sul canvas da 1000, e un piolo da 17 px
    // la mangiava quasi a meta`.
    const totale = N * PIOLI_PER_SPICCHIO;
    const rPioli = rSpicchi + spessoreAnello / 2;
    const raggioPiolo = Math.max(2, spessoreAnello * 0.16);
    for (let i = 0; i < totale; i++) {
      const a = (i * Math.PI * 2) / totale;
      const px = Math.cos(a) * rPioli, py = Math.sin(a) * rPioli;
      const g = k.createRadialGradient(px - raggioPiolo * 0.3, py - raggioPiolo * 0.3, 0, px, py, raggioPiolo);
      g.addColorStop(0, "#fff8e2");
      g.addColorStop(1, "#8a6200");
      k.beginPath();
      k.arc(px, py, raggioPiolo, 0, Math.PI * 2);
      k.fillStyle = g;
      k.fill();
      k.lineWidth = 1;
      k.strokeStyle = "#4a3400";
      k.stroke();
    }
    stratoAnello = c;
    return c;
  }

  // Il simbolo di uno speciale, dal tracciato di SPECIALI (config.js),
  // disegnato centrato nell'origine in un quadrato di lato `lato`, nel colore
  // dato. Lo stesso tracciato che la pagina usa come <svg>: un disegno solo.
  function disegnaSimbolo(chiave, lato, colore) {
    const sp = SPECIALI[chiave];
    if (!sp) return;
    ctx.save();
    ctx.translate(-lato / 2, -lato / 2);
    ctx.scale(lato / 100, lato / 100);
    ctx.fillStyle = colore;
    ctx.strokeStyle = colore;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    sp.simbolo.forEach((parte) => {
      if (parte.testo) {
        ctx.font = "800 92px 'Ubuntu', 'Liberation Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(parte.testo, 50, 54);
        return;
      }
      const p = new Path2D(parte.d);
      if (parte.fill) ctx.fill(p, parte.regola || "nonzero");
      if (parte.stroke) { ctx.lineWidth = parte.stroke; ctx.stroke(p); }
    });
    ctx.restore();
  }

  // Uno spicchio speciale: un distintivo bianco tondo vicino al
  // bordo, col simbolo dentro, e sotto la parola, dal bordo verso il mozzo
  // come tutte le altre. Durante l'onda del cambio di round simbolo e parola
  // vecchi sfumano via nella prima metà e i nuovi entrano nella seconda
  // (come le cifre). Misure in frazione di rSpicchi, così scalano con la ruota.
  function disegnaSpeciale(i, am, rSpicchi) {
    const seg = SEGMENTI_RUOTA[i];
    const rDistintivo = rSpicchi * 0.092;      // 42 px sul canvas da 1000: il disco sta nella corda dello spicchio (93 px al suo bordo interno)
    const rCentro = rSpicchi * 0.857;          // il distintivo sta fra 0,77 e 0,94 del raggio: entro la corda dello spicchio
    const latoSimbolo = rDistintivo * 1.5;
    const dimParola = rSpicchi * 0.06;         // come BANCAROTTA (0,072) ma più corta: "ROBIN HOOD" deve fermarsi prima del mozzo
    const rParola = rCentro - rDistintivo - dimParola * 0.95;
    const mostra = (chiave, alfa) => {
      if (!chiave) return;
      ctx.save();
      ctx.globalAlpha = alfa;
      // il distintivo
      ctx.save();
      ctx.rotate(am);
      ctx.translate(rCentro, 0);
      ctx.beginPath();
      ctx.arc(0, 0, rDistintivo, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0A0E23";
      ctx.stroke();
      ctx.rotate(Math.PI / 2); // l'alto del simbolo verso il bordo, come l'alto di ogni lettera
      disegnaSimbolo(chiave, latoSimbolo, COLORE_SPECIALE_SIMBOLO);
      ctx.restore();
      // la parola
      scrittaRadiale(am, SPECIALI[chiave].nome, rParola, dimParola, "#fff", "#0A0E23", dimParola * 0.9);
      ctx.restore();
    };
    const fo = faseOnda(i);
    if (fo !== null && fo < 1 && transizioneRound.primaSpeciali) {
      const vecchio = transizioneRound.primaSpeciali[i];
      if (fo < 0.5) mostra(vecchio, 1 - fo * 2);
      else mostra(seg.speciale, (fo - 0.5) * 2);
    } else {
      mostra(seg.speciale, 1);
    }
  }

  function disegna() {
    const w = canvas.width,
      h = canvas.height;
    const cx = w / 2,
      cy = h / 2;
    const rTotale = Math.min(w, h) / 2 - 4;
    const spessoreAnello = Math.max(14, rTotale * 0.07);
    const rSpicchi = rTotale - spessoreAnello;
    const rMozzo = rTotale * 0.13;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotazioneCorrente);

    // 1. riempimenti
    for (let i = 0; i < N; i++) {
      const seg = SEGMENTI_RUOTA[i];
      const tipoSeg = tipoVisto(i); // durante l'onda un posto che cambia tipo lo cambia a meta` lampo
      const a0 = i * ANGOLO_SPICCHIO,
        a1 = a0 + ANGOLO_SPICCHIO;
      if (tipoSeg === "soldi") {
        // Voce A, tredicesimo giro (29/09/2026, controllo di Chiara): il
        // colore segue lo SPICCHIO (il suo livello del round 1), non la
        // cifra che ci sta sopra in questo round — altrimenti, dal round 3
        // in poi, cifre diverse che condividono lo stesso colore del round 1
        // finiscono vicine sulla ruota (verificato con
        // `design/strumenti/colori-round.mjs`: ΔE 0 dal round 5). Riapre il
        // punto 29 solo fra un round e l'altro, mai dentro lo stesso round.
        const c = COLORE_PER_CIFRA[VALORE_BASE_SEGMENTI[i]];
        if (mostraJolly(seg) && !(transizioneJolly && transizioneJolly.indice === i)) {
          // Voce 5 (28/09/2026): finche` il jolly c'e`, lo spicchio e`
          // bianco — "JOLLY" si legge da solo, senza contorno colorato.
          fetta(a0, a1, rSpicchi, "#fff");
        } else if (transizioneJolly && transizioneJolly.indice === i) {
          // La stessa transizione (t) con cui sotto sfuma la scritta: il
          // bianco sfuma nel colore del 600€.
          fetta(a0, a1, rSpicchi, mixHex("#ffffff", c, transizioneJolly.t));
        } else if (c === "olografico") {
          riempiOlografico(a0, a1, 0, rSpicchi, "oro");
        } else {
          fetta(a0, a1, rSpicchi, c);
        }
      } else if (tipoSeg === "passa") {
        fetta(a0, a1, rSpicchi, COLORE_PASSA);
      } else if (tipoSeg === "bancarotta") {
        fetta(a0, a1, rSpicchi, "#141414");
      } else if (tipoSeg === "speciale") {
        fetta(a0, a1, rSpicchi, COLORE_SPECIALE);  // un colore per tutta la classe
      } else if (tipoSeg === "triplo") {
        const t = ANGOLO_SPICCHIO / 3;
        fetta(a0, a0 + t, rSpicchi, "#141414");
        riempiOlografico(a0 + t, a0 + 2 * t, 0, rSpicchi, "arcobaleno");
        fetta(a0 + 2 * t, a1, rSpicchi, "#141414");
      }
      // rilievo leggero, come sempre
      const gloss = ctx.createRadialGradient(0, 0, 0, 0, 0, rSpicchi);
      gloss.addColorStop(0, "rgba(255,255,255,0.18)");
      gloss.addColorStop(0.6, "rgba(255,255,255,0.03)");
      gloss.addColorStop(1, "rgba(0,0,0,0.16)");
      fetta(a0, a1, rSpicchi, gloss);
      // Voce C: il lampo dell'onda — bianco a campana (sin), fra 0 e 0.55 di
      // opacita`, cosi` non copre mai del tutto il colore sotto. Lo spicchio
      // del jolly non partecipa (mostra JOLLY, non una cifra); il 1500
      // olografico si`.
      if (tipoSeg === "soldi" || tipoSeg === "speciale") {
        const fo = faseOnda(i);
        if (fo !== null && fo > 0 && fo < 1) {
          fetta(a0, a1, rSpicchi, `rgba(255,255,255,${(0.55 * Math.sin(Math.PI * fo)).toFixed(3)})`);
        }
      }
    }

    // 2. linee fra le fette (anche le due interne del triplo, sottili)
    ctx.strokeStyle = "#0A0E23";
    for (let i = 0; i < N; i++) {
      const a0 = i * ANGOLO_SPICCHIO;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a0) * rSpicchi, Math.sin(a0) * rSpicchi);
      ctx.stroke();
      if (SEGMENTI_RUOTA[i].tipo === "triplo") {
        const t = ANGOLO_SPICCHIO / 3;
        ctx.lineWidth = 1.2;
        for (const a of [a0 + t, a0 + 2 * t]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * rSpicchi, Math.sin(a) * rSpicchi);
          ctx.stroke();
        }
      }
    }

    // 3. scritte — tutte dal bordo verso il mozzo
    const dimCifra = rSpicchi * 0.118; // una cifra per riga
    const passoCifra = dimCifra * 0.86;
    const rDa = rSpicchi - dimCifra * 0.8;
    for (let i = 0; i < N; i++) {
      const seg = SEGMENTI_RUOTA[i];
      const tipoSeg = tipoVisto(i); // durante l'onda un posto che cambia tipo lo cambia a meta` lampo
      const am = i * ANGOLO_SPICCHIO + ANGOLO_SPICCHIO / 2;
      if (tipoSeg === "soldi") {
        if (mostraJolly(seg) && !(transizioneJolly && transizioneJolly.indice === i)) {
          // Voce 5, undicesimo giro (28/09/2026): spicchio bianco, "JOLLY"
          // alla stessa misura delle cifre, rosso pieno, senza contorno —
          // prima era piu` piccola e col contorno rosso, poco leggibile a
          // 1366 (controllo di Chiara).
          scrittaRadiale(am, "JOLLY", rDa, dimCifra, "#d3222a", null, passoCifra);
        } else if (transizioneJolly && transizioneJolly.indice === i) {
          // piccola transizione: il JOLLY sfuma via, la cifra sfuma dentro
          // (punto 53: "con una piccola transizione").
          const t = transizioneJolly.t;
          if (t < 1) {
            ctx.save();
            ctx.globalAlpha = 1 - t;
            scrittaRadiale(am, "JOLLY", rDa, dimCifra, "#d3222a", null, passoCifra);
            ctx.restore();
          }
          ctx.save();
          ctx.globalAlpha = t;
          scrittaRadiale(am, String(seg.valore), rDa, dimCifra, "#fff", "#0A0E23", passoCifra);
          scrittaRadiale(
            am,
            "€",
            rDa - passoCifra * String(seg.valore).length + passoCifra * 0.15,
            dimCifra * 0.6,
            "#fff",
            "#0A0E23",
            passoCifra
          );
          ctx.restore();
        } else if (faseOnda(i) !== null && faseOnda(i) < 1) {
          // Voce C: durante l'onda la cifra vecchia sfuma via nella prima
          // meta` del lampo, e la nuova entra nella seconda — stesse misure
          // e stesso "€" della cifra normale qui sotto.
          const fo = faseOnda(i);
          const vecchia = String(transizioneRound.prima[i]);
          const mostraCifra = (testo, alfa) => {
            ctx.save();
            ctx.globalAlpha = alfa;
            scrittaRadiale(am, testo, rDa, dimCifra, "#fff", "#0A0E23", passoCifra);
            scrittaRadiale(
              am,
              "€",
              rDa - passoCifra * testo.length + passoCifra * 0.15,
              dimCifra * 0.6,
              "#fff",
              "#0A0E23",
              passoCifra
            );
            ctx.restore();
          };
          if (fo < 0.5) mostraCifra(vecchia, 1 - fo * 2);
          else mostraCifra(String(seg.valore), (fo - 0.5) * 2);
        } else {
          // cifra normale — bianca con contorno scuro, leggibile su
          // qualunque colore (TV, foto 04).
          scrittaRadiale(am, String(seg.valore), rDa, dimCifra, "#fff", "#0A0E23", passoCifra);
          scrittaRadiale(
            am,
            "€",
            rDa - passoCifra * String(seg.valore).length + passoCifra * 0.15,
            dimCifra * 0.6,
            "#fff",
            "#0A0E23",
            passoCifra
          );
        }
      } else if (tipoSeg === "speciale") {
        disegnaSpeciale(i, am, rSpicchi);
      } else if (tipoSeg === "passa") {
        scrittaRadiale(am, "PASSA", rDa, rSpicchi * 0.1, "#20233A", null, rSpicchi * 0.1 * 0.9);
      } else if (tipoSeg === "bancarotta") {
        scrittaRadiale(am, "BANCAROTTA", rDa, rSpicchi * 0.072, "#fff", null, rSpicchi * 0.072 * 0.88);
      } else if (tipoSeg === "triplo") {
        const t = ANGOLO_SPICCHIO / 3;
        const a0 = i * ANGOLO_SPICCHIO;
        scrittaRadiale(a0 + t / 2, "BANCAROTTA", rDa, rSpicchi * 0.052, "#fff", null, rSpicchi * 0.052 * 0.9);
        scrittaRadiale(a0 + t * 1.5, "RADDOPPIA", rDa, rSpicchi * 0.06, "#fff", "#0A0E23", rSpicchi * 0.06 * 0.95);
        scrittaRadiale(a0 + t * 2.5, "BANCAROTTA", rDa, rSpicchi * 0.052, "#fff", null, rSpicchi * 0.052 * 0.9);
      }
    }

    // 3bis. a ruota ferma, lo spicchio sotto la freccia si illumina: la
    // cifra che conta non si cerca.
    if (evidenziato !== null) {
      const a0 = evidenziato * ANGOLO_SPICCHIO,
        a1 = a0 + ANGOLO_SPICCHIO;
      fetta(a0, a1, rSpicchi, "rgba(255,255,255,0.22)");
      ctx.save();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#fff";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, rSpicchi, a0, a1);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 4. bordo esterno + anello dorato + pioli — Ruota pesante (05/10/2026): dallo strato in cache
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0A0E23";
    ctx.beginPath();
    ctx.arc(0, 0, rSpicchi, 0, Math.PI * 2);
    ctx.stroke();
    ctx.drawImage(strato(w, h, rTotale, spessoreAnello, rSpicchi), -cx, -cy);
    ctx.restore();

    // 5. mozzo
    const mozzoGrad = ctx.createRadialGradient(cx - rMozzo * 0.3, cy - rMozzo * 0.3, 0, cx, cy, rMozzo);
    mozzoGrad.addColorStop(0, "#fff2c4");
    mozzoGrad.addColorStop(0.5, "#f3c531");
    mozzoGrad.addColorStop(1, "#8a5c04");
    ctx.beginPath();
    ctx.arc(cx, cy, rMozzo, 0, Math.PI * 2);
    ctx.fillStyle = mozzoGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#5c3c02";
    ctx.stroke();
    const rBottone = rMozzo * 0.6;
    const bottoneGrad = ctx.createRadialGradient(cx - rBottone * 0.35, cy - rBottone * 0.35, 0, cx, cy, rBottone);
    bottoneGrad.addColorStop(0, "#3a4380");
    bottoneGrad.addColorStop(1, "#0A0E23");
    ctx.beginPath();
    ctx.arc(cx, cy, rBottone, 0, Math.PI * 2);
    ctx.fillStyle = bottoneGrad;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ruota pesante (05/10/2026): la freccia segue la lamella del motore: -1..1, il CSS la ruota
    if (puntatoreEl) puntatoreEl.style.setProperty("--lamella", fisica.S.lamella.toFixed(3));
  }

  // ---- il jolly: disponibile/preso, con una piccola transizione ----------

  // Chiamata da gioco.js in nuovoRound(): il jolly torna disponibile.
  function impostaJollyDisponibile(valore) {
    jollyDisponibile = valore;
    transizioneJolly = null;
    disegna();
  }

  // Chiamata da gioco.js quando un giocatore prende il jolly (punto 53): lo
  // spicchio smette di mostrare "JOLLY" e torna a mostrare la sua cifra
  // (600€), con una breve dissolvenza incrociata invece di un cambio secco.
  function animaPresaJolly(indice, durataMs) {
    // Voce 5, undicesimo giro (28/09/2026): 600 ms, non piu` 380 — lo stesso
    // tempo in cui il bianco dello spicchio sfuma nel colore del 600€.
    durataMs = durataMs || 600;
    jollyDisponibile = false;
    const inizio = performance.now();
    transizioneJolly = { indice, t: 0 };
    function passo(ora) {
      const t = Math.min(1, (ora - inizio) / durataMs);
      transizioneJolly = { indice, t };
      disegna();
      if (t < 1) requestAnimationFrame(passo);
      else transizioneJolly = null;
    }
    requestAnimationFrame(passo);
  }

  // ---- Ruota pesante (05/10/2026): lo spicchio sotto la freccia, risolto (triplo compreso) ----
  function esitoSottoFreccia() {
    const angoloFinale = ((rotazioneCorrente % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const angoloSottoPuntatore = ((Math.PI * 1.5 - angoloFinale) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const indice = Math.floor(angoloSottoPuntatore / ANGOLO_SPICCHIO) % N;
    let segmento = SEGMENTI_RUOTA[indice];
    if (segmento.tipo === "triplo") {
      const inizioSpicchio = indice * ANGOLO_SPICCHIO;
      const resto = angoloSottoPuntatore - inizioSpicchio;
      const terzo = Math.min(2, Math.floor(resto / (ANGOLO_SPICCHIO / 3)));
      segmento = terzo === 1 ? { tipo: "raddoppia" } : { tipo: "bancarotta" };
    }
    return { segmento, indice };
  }

  // ---- Ruota pesante (05/10/2026): la ruota lasciata a se stessa: un fotogramma dopo l'altro
  // finche` il motore dice "ferma". Uguale per pulsante e mano.
  let ultimoPasso = 0;
  let lancioValido = true;
  function animaLibera(onTic, onFine, onFermaNonValida) {
    ultimoPasso = performance.now();
    function frame(ora) {
      const dt = Math.max(0.001, Math.min(0.1, (ora - ultimoPasso) / 1000));
      ultimoPasso = ora;
      const fermata = fisica.passo(dt, (verso) => { if (onTic) onTic(verso); });
      rotazioneCorrente = fisica.S.theta;
      if (!fermata) {
        disegna();
        requestAnimationFrame(frame);
        return;
      }
      animando = false;
      onTicGesto = null;
      if (!lancioValido) {
        evidenziato = null;
        disegna();
        // "Più forte!" e` gia` stato detto al rilascio (terminaTrascinamento).
        // Ma i comandi dipendono da inAnimazione(), che fino a qui era vero:
        // ora che la ruota e` ferma chi chiama deve poterli riaccendere.
        if (onFermaNonValida) onFermaNonValida();
        return;
      }
      const { segmento, indice } = esitoSottoFreccia();
      evidenziato = indice;
      disegna();
      if (onFine) onFine(segmento, indice);
    }
    requestAnimationFrame(frame);
  }

  // Ruota pesante (05/10/2026): Fa girare la ruota con la mano finta: forza 0..1 (niente = a
  // caso). Alla fine chiama onFine(segmentoVinto, indice), come prima.
  function gira(forza, onTic, onFine) {
    if (animando) return;
    animando = true;
    evidenziato = null;
    lancioValido = true;
    fisica.imposta(rotazioneCorrente, 0);
    fisica.spingi(forza === undefined || forza === null ? Math.random() : forza);
    animaLibera(onTic, onFine);
  }

  function inAnimazione() {
    return animando;
  }

  // ---- trascinamento (punti 61-62): si afferra, si trascina, si lascia ----
  let trascinando = false;
  let angoloCursoreGrezzoPrec = 0;
  let rotazioneTargetTrascina = 0;
  let storiaAngoliTrascina = [];
  let rafTrascina = null;
  let onTicGesto = null;
  let storiaRuotaTrascina = [];
  let ultimoPassoTrascina = null;

  function angoloDaPunto(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx);
  }

  function differenzaAngolareCorta(a, b) {
    let d = a - b;
    const giro = Math.PI * 2;
    while (d > Math.PI) d -= giro;
    while (d <= -Math.PI) d += giro;
    return d;
  }

  function puoIniziareTrascinamento() {
    return !animando && !trascinando;
  }

  function iniziaTrascinamento(clientX, clientY, onTic) {
    if (!puoIniziareTrascinamento()) return false;
    trascinando = true;
    animando = true;
    evidenziato = null;
    onTicGesto = onTic || null;
    angoloCursoreGrezzoPrec = angoloDaPunto(clientX, clientY);
    rotazioneTargetTrascina = rotazioneCorrente;
    storiaAngoliTrascina = [{ t: performance.now(), angolo: rotazioneTargetTrascina }];
    storiaRuotaTrascina = [{ t: performance.now(), angolo: rotazioneCorrente }];
    ultimoPassoTrascina = performance.now();
    fisica.inMano(true);
    fisica.imposta(rotazioneCorrente, 0);
    if (!rafTrascina) rafTrascina = requestAnimationFrame(passoTrascinamento);
    return true;
  }

  function muoviTrascinamento(clientX, clientY) {
    if (!trascinando) return;
    const grezzo = angoloDaPunto(clientX, clientY);
    const delta = differenzaAngolareCorta(grezzo, angoloCursoreGrezzoPrec);
    angoloCursoreGrezzoPrec = grezzo;
    rotazioneTargetTrascina += delta;
    const ora = performance.now();
    storiaAngoliTrascina.push({ t: ora, angolo: rotazioneTargetTrascina });
    const soglia = ora - TRASCINA_FINESTRA_VELOCITA_MS * 3;
    while (storiaAngoliTrascina.length > 2 && storiaAngoliTrascina[0].t < soglia) {
      storiaAngoliTrascina.shift();
    }
  }

  // Ruota pesante (05/10/2026): in mano: la ruota rincorre il dito con il ritardo di una
  // ruota pesante — TRASCINA_RITARDO_MS per la massa (secondo giro: 300 ms
  // a inerzia 1, 390 a 1,3; era 220, e prima ancora 95) — e non supera mai
  // la velocita` della girata piu` forte (il tetto lo da` il motore). Lo
  // stacco massimo fra dito e ruota non e` piu` una costante: e` quello che
  // si ha andando al tetto con questo ritardo (tetto x ritardo), cosi` la
  // mano che corre scivola sulla ruota, e la ruota in mano non va mai oltre
  // il tetto. I tic in mano si contano sui pioli, con fisica.tic.
  function ritardoMano() { return TRASCINA_RITARDO_MS * fisica.P.inerzia; }
  function passoTrascinamento() {
    if (!trascinando) {
      rafTrascina = null;
      return;
    }
    const ora = performance.now();
    const dt = Math.max(1, Math.min(50, ora - ultimoPassoTrascina));
    ultimoPassoTrascina = ora;
    const ritardo = ritardoMano();
    let passo = (rotazioneTargetTrascina - rotazioneCorrente) * (1 - Math.exp(-dt / ritardo));
    const tetto = fisica.velocitaTetto();
    const passoMax = (tetto * dt) / 1000;
    passo = Math.max(-passoMax, Math.min(passoMax, passo));
    const prima = rotazioneCorrente;
    rotazioneCorrente += passo;
    const stacco = rotazioneTargetTrascina - rotazioneCorrente;
    const staccoMax = (tetto * ritardo) / 1000;
    if (Math.abs(stacco) > staccoMax) {
      rotazioneTargetTrascina = rotazioneCorrente + Math.sign(stacco) * staccoMax;
    }
    storiaRuotaTrascina.push({ t: ora, angolo: rotazioneCorrente });
    while (storiaRuotaTrascina.length > 2 && storiaRuotaTrascina[0].t < ora - TRASCINA_FINESTRA_VELOCITA_MS * 3) {
      storiaRuotaTrascina.shift();
    }
    fisica.imposta(rotazioneCorrente, passo / (dt / 1000));
    // la lamella si piega anche in mano (il motore la aggiorna senza muovere la ruota)
    fisica.S.lamella = lamellaInMano();
    disegna();
    const t = fisica.tic(prima, rotazioneCorrente);
    if (t && onTicGesto) onTicGesto(t);
    rafTrascina = requestAnimationFrame(passoTrascinamento);
  }

  // Ruota pesante (05/10/2026): deflessione della lamella mentre la ruota e` in mano: segue il
  // piolo nella finestra, nel verso in cui la ruota si sta muovendo.
  function lamellaInMano() {
    const p = fisica.fase(rotazioneCorrente);
    const W = fisica.FINESTRA / fisica.PASSO_PIOLO;
    const verso = fisica.S.omega >= 0 ? 1 : -1;
    if (verso > 0 && p > 0 && p <= W) return (W - p) / W;
    if (verso < 0 && p >= 1 - W && p < 1) return -((p - (1 - W)) / W);
    return fisica.S.lamella * 0.6; // ritorno rapido, un fotogramma alla volta
  }

  // Ruota pesante (05/10/2026): Fine del gesto: la velocita` di rilascio e` quella della ruota
  // disegnata (finestra TRASCINA_FINESTRA_VELOCITA_MS); poi la ruota e` del
  // motore. Se il lancio non vale (sotto GIRO_MINIMO_VALIDO_TURNI) si dice
  // SUBITO (onNonValido al rilascio), mentre la ruota si pianta.
  function terminaTrascinamento(onFine, onNonValido, onFermaNonValida) {
    if (!trascinando) return;
    trascinando = false;
    const ora = performance.now();
    const recenti = storiaRuotaTrascina.filter((c) => ora - c.t <= TRASCINA_FINESTRA_VELOCITA_MS);
    const riferimento =
      recenti.length >= 2 ? recenti[0] : storiaRuotaTrascina[Math.max(0, storiaRuotaTrascina.length - 2)];
    const ultimo = storiaRuotaTrascina[storiaRuotaTrascina.length - 1];
    let velocita = 0;
    if (riferimento && ultimo && ultimo.t > riferimento.t) {
      velocita = (ultimo.angolo - riferimento.angolo) / ((ultimo.t - riferimento.t) / 1000);
    }
    fisica.imposta(rotazioneCorrente, 0);
    lancioValido = fisica.lascia(velocita, GIRO_MINIMO_VALIDO_TURNI);
    if (!lancioValido && onNonValido) onNonValido();
    animaLibera(onTicGesto, onFine, onFermaNonValida);
  }

  function annullaTrascinamento(onNonValido, onFermaNonValida) {
    if (!trascinando) return;
    terminaTrascinamento(null, onNonValido, onFermaNonValida);
  }

  return {
    init,
    disegna,
    gira,
    inAnimazione,
    impostaJollyDisponibile,
    animaPresaJolly,
    impostaRound,
    impostaProgrammaSpeciali,
    puoIniziareTrascinamento,
    iniziaTrascinamento,
    muoviTrascinamento,
    terminaTrascinamento,
    annullaTrascinamento,
  };
})();
