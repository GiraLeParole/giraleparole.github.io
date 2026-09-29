// ============================================================================
// LA RUOTA — disegno su canvas + fisica dello spin.
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
  let transizioneRound = null; // { inizio, prima: [valori del round prima] }, solo mentre l'onda e` in corso

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
    if (conOnda && canvas) {
      transizioneRound = { inizio: performance.now(), prima };
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

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    for (let i = 0; i < 260; i++) {
      scintille.push({ a: Math.random(), r: Math.random(), s: 0.6 + Math.random() * 1.6 });
    }
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
      const a0 = i * ANGOLO_SPICCHIO,
        a1 = a0 + ANGOLO_SPICCHIO;
      if (seg.tipo === "soldi") {
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
      } else if (seg.tipo === "passa") {
        fetta(a0, a1, rSpicchi, COLORE_PASSA);
      } else if (seg.tipo === "bancarotta") {
        fetta(a0, a1, rSpicchi, "#141414");
      } else if (seg.tipo === "triplo") {
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
      if (seg.tipo === "soldi") {
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
      const am = i * ANGOLO_SPICCHIO + ANGOLO_SPICCHIO / 2;
      if (seg.tipo === "soldi") {
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
      } else if (seg.tipo === "passa") {
        scrittaRadiale(am, "PASSA", rDa, rSpicchi * 0.1, "#20233A", null, rSpicchi * 0.1 * 0.9);
      } else if (seg.tipo === "bancarotta") {
        scrittaRadiale(am, "BANCAROTTA", rDa, rSpicchi * 0.072, "#fff", null, rSpicchi * 0.072 * 0.88);
      } else if (seg.tipo === "triplo") {
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

    // 4. bordo esterno + anello dorato + pioli
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0A0E23";
    ctx.beginPath();
    ctx.arc(0, 0, rSpicchi, 0, Math.PI * 2);
    ctx.stroke();
    const anelloGrad = ctx.createLinearGradient(-rTotale, -rTotale, rTotale, rTotale);
    anelloGrad.addColorStop(0, "#fff2c4");
    anelloGrad.addColorStop(0.35, "#f3c531");
    anelloGrad.addColorStop(0.65, "#c2860a");
    anelloGrad.addColorStop(1, "#8a5c04");
    ctx.lineWidth = spessoreAnello;
    ctx.strokeStyle = anelloGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rSpicchi + spessoreAnello / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#5c3c02";
    ctx.beginPath();
    ctx.arc(0, 0, rSpicchi, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, rTotale, 0, Math.PI * 2);
    ctx.stroke();
    const rPioli = rSpicchi + spessoreAnello / 2,
      raggioPiolo = Math.max(2.5, spessoreAnello * 0.24);
    for (let i = 0; i < N; i++) {
      const a0 = i * ANGOLO_SPICCHIO;
      const px = Math.cos(a0) * rPioli,
        py = Math.sin(a0) * rPioli;
      const g = ctx.createRadialGradient(px - raggioPiolo * 0.3, py - raggioPiolo * 0.3, 0, px, py, raggioPiolo);
      g.addColorStop(0, "#fff8e2");
      g.addColorStop(1, "#8a6200");
      ctx.beginPath();
      ctx.arc(px, py, raggioPiolo, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#4a3400";
      ctx.stroke();
    }
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

  // ---- fisica della girata: parte con una spinta, rallenta con un ease-out
  // (mai un giro a scatto secco) ---------------------------------------------
  function easeSpinRuota(t) {
    const rt = SPIN_FRAZIONE_SPINTA;
    if (t <= rt) {
      return rt * (1 - Math.cos((Math.PI / 2) * (t / rt)));
    }
    const u = (t - rt) / (1 - rt);
    return rt + (1 - rt) * Math.sin((Math.PI / 2) * u);
  }

  // Fa girare la ruota e alla fine chiama onFine(segmentoVinto, indice).
  // Quando la freccia si ferma sullo spicchio "triplo" (indice 12), il
  // segmento restituito NON e` mai `{tipo:"triplo"}` — e` gia` risolto in
  // quale dei tre quinti la freccia e` caduta: bancarotta (i due lati, 5°
  // ciascuno) o raddoppia (il centro, 5°). gioco.js non deve sapere niente
  // della sotto-divisione: riceve sempre un tipo che sa gia` gestire.
  function gira(durataMs, angoloTotale, onTic, onFine) {
    if (animando) return;
    animando = true;
    evidenziato = null;
    const partenza = rotazioneCorrente;
    const inizio = performance.now();
    let ultimoTic = -1;

    function frame(ora) {
      const t = Math.min(1, (ora - inizio) / durataMs);
      const eased = easeSpinRuota(t);
      rotazioneCorrente = partenza + angoloTotale * eased;
      disegna();

      const spicchiPercorsi = Math.floor((angoloTotale * eased) / ANGOLO_SPICCHIO);
      if (spicchiPercorsi !== ultimoTic) {
        ultimoTic = spicchiPercorsi;
        if (onTic) onTic();
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        animando = false;
        const angoloFinale = ((rotazioneCorrente % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // il puntatore e` fisso in alto (-PI/2 rispetto allo 0 del canvas):
        // lo spicchio sotto e` quello il cui intervallo, ruotato, copre -PI/2.
        const angoloSottoPuntatore = ((Math.PI * 1.5 - angoloFinale) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const indice = Math.floor(angoloSottoPuntatore / ANGOLO_SPICCHIO) % N;
        evidenziato = indice;
        disegna();

        let segmentoEsito = SEGMENTI_RUOTA[indice];
        if (segmentoEsito.tipo === "triplo") {
          const inizioSpicchio = indice * ANGOLO_SPICCHIO;
          const resto = angoloSottoPuntatore - inizioSpicchio;
          const terzo = Math.min(2, Math.floor(resto / (ANGOLO_SPICCHIO / 3)));
          segmentoEsito = terzo === 1 ? { tipo: "raddoppia" } : { tipo: "bancarotta" };
        }
        onFine(segmentoEsito, indice);
      }
    }
    requestAnimationFrame(frame);
  }

  function inAnimazione() {
    return animando;
  }

  // ---- trascinamento (punti 61-62, 29/09/2026): si afferra, si trascina,
  // si lascia — la velocita` di partenza nasce dal gesto, poi si frena per
  // attrito costante come un oggetto pesante. -------------------------------

  let trascinando = false;
  let angoloCursoreGrezzoPrec = 0; // ultimo angolo (screen-space) letto dal puntatore, non "srotolato"
  let rotazioneTargetTrascina = 0; // dove punta il dito ADESSO (srotolato): la ruota lo rincorre
  let storiaAngoliTrascina = []; // {t, angolo} recenti, per calcolare la velocita` al rilascio
  let rafTrascina = null;
  let onTicGesto = null; // callback tic, valido per tutta la durata del gesto (drag + frenata)
  // Voce B, tredicesimo giro (29/09/2026): la velocita` di rilascio si
  // calcola sulla ruota DISEGNATA, non sul bersaglio della mano — altrimenti
  // uno scatto secco della mano, frenato subito dal ritardo, dava uno
  // scalino di velocita` al rilascio (la ruota sembrava frenare di colpo).
  let storiaRuotaTrascina = []; // {t, angolo} della ruota disegnata
  let ultimoPassoTrascina = null; // orologio in millisecondi, non in fotogrammi (uguale a ogni Hz)

  // tic ("la freccia sbatte sui pioli", punto 55/62): conta quanti spicchi
  // ha attraversato la ruota RENDERIZZATA (non il bersaglio del dito), sia
  // durante il trascinamento sia durante la frenata — stesso principio del
  // tic di gira() ma basato sulla distanza assoluta percorsa, perche` qui
  // (a differenza di gira()) la direzione puo` invertirsi.
  let rotazionePrecedenteTic = 0;
  let distanzaPercorsaTic = 0;
  let ultimoSpicchioTic = 0;

  function resettaTicPercorso() {
    rotazionePrecedenteTic = rotazioneCorrente;
    distanzaPercorsaTic = 0;
    ultimoSpicchioTic = 0;
  }

  function aggiornaTicPercorso() {
    // Voce E, tredicesimo giro (29/09/2026, facoltativa): il verso di questo
    // passo (positivo = orario, negativo = antiorario) passa a onTicGesto,
    // cosi` chi ascolta puo` piegare la freccia dalla parte giusta.
    const verso = Math.sign(rotazioneCorrente - rotazionePrecedenteTic) || 1;
    distanzaPercorsaTic += Math.abs(rotazioneCorrente - rotazionePrecedenteTic);
    rotazionePrecedenteTic = rotazioneCorrente;
    const spicchi = Math.floor(distanzaPercorsaTic / ANGOLO_SPICCHIO);
    if (spicchi !== ultimoSpicchioTic) {
      ultimoSpicchioTic = spicchi;
      if (onTicGesto) onTicGesto(verso);
    }
  }

  function angoloDaPunto(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx);
  }

  // Porta (a-b) nell'intervallo (-PI, PI]: evita il "salto" di 2*PI quando
  // l'angolo grezzo (atan2, sempre fra -PI e PI) attraversa il taglio.
  function differenzaAngolareCorta(a, b) {
    let d = a - b;
    const giro = Math.PI * 2;
    while (d > Math.PI) d -= giro;
    while (d <= -Math.PI) d += giro;
    return d;
  }

  // true se si puo` cominciare un trascinamento adesso (ruota gia` ferma e
  // non gia` in mano) — gioco.js chiama questo prima di ascoltare il resto
  // del gesto, cosi` un pointerdown a meta` di un'altra girata non fa nulla.
  function puoIniziareTrascinamento() {
    return !animando && !trascinando;
  }

  function iniziaTrascinamento(clientX, clientY, onTic) {
    if (!puoIniziareTrascinamento()) return false;
    trascinando = true;
    animando = true; // blocca il pulsante e un secondo trascinamento, come durante gira()
    evidenziato = null;
    onTicGesto = onTic || null;
    angoloCursoreGrezzoPrec = angoloDaPunto(clientX, clientY);
    rotazioneTargetTrascina = rotazioneCorrente;
    storiaAngoliTrascina = [{ t: performance.now(), angolo: rotazioneTargetTrascina }];
    storiaRuotaTrascina = [{ t: performance.now(), angolo: rotazioneCorrente }]; // Voce B
    ultimoPassoTrascina = performance.now(); // Voce B
    resettaTicPercorso();
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
    // tiene solo un po' piu` della finestra che serve al calcolo della
    // velocita` (TRASCINA_FINESTRA_VELOCITA_MS, config.js): il resto si
    // scarta, cosi` la lista non cresce senza limite durante un
    // trascinamento lungo.
    const soglia = ora - TRASCINA_FINESTRA_VELOCITA_MS * 3;
    while (storiaAngoliTrascina.length > 2 && storiaAngoliTrascina[0].t < soglia) {
      storiaAngoliTrascina.shift();
    }
  }

  // Ad ogni fotogramma, mentre si trascina: la ruota rincorre il dito con
  // un po' di inerzia (punto 62, "non e` incollata al cursore"), non ci si
  // scatta sopra di colpo. Voce B, tredicesimo giro (29/09/2026): il
  // rincorrere e` calcolato sul TEMPO trascorso (TRASCINA_RITARDO_MS), non
  // piu` a frazione fissa per fotogramma — cosi` il ritardo e` lo stesso a
  // 60, 120 o 144 Hz. Il passo e` anche limitato a TRASCINA_VELOCITA_MAX_RAD_S,
  // e se la mano corre via troppo il bersaglio scivola (TRASCINA_STACCO_MAX_RAD)
  // invece di restare agganciato a distanza illimitata.
  function passoTrascinamento() {
    if (!trascinando) {
      rafTrascina = null;
      return;
    }
    const ora = performance.now();
    const dt = Math.max(1, Math.min(50, ora - ultimoPassoTrascina));
    ultimoPassoTrascina = ora;
    let passo = (rotazioneTargetTrascina - rotazioneCorrente) * (1 - Math.exp(-dt / TRASCINA_RITARDO_MS));
    const passoMax = (TRASCINA_VELOCITA_MAX_RAD_S * dt) / 1000;
    passo = Math.max(-passoMax, Math.min(passoMax, passo));
    rotazioneCorrente += passo;
    const stacco = rotazioneTargetTrascina - rotazioneCorrente;
    if (Math.abs(stacco) > TRASCINA_STACCO_MAX_RAD) {
      rotazioneTargetTrascina = rotazioneCorrente + Math.sign(stacco) * TRASCINA_STACCO_MAX_RAD;
    }
    storiaRuotaTrascina.push({ t: ora, angolo: rotazioneCorrente });
    while (storiaRuotaTrascina.length > 2 && storiaRuotaTrascina[0].t < ora - TRASCINA_FINESTRA_VELOCITA_MS * 3) {
      storiaRuotaTrascina.shift();
    }
    disegna();
    aggiornaTicPercorso();
    rafTrascina = requestAnimationFrame(passoTrascinamento);
  }

  // Fine del gesto (rilascio): calcola la velocita` dell'ultimo istante
  // (finestra TRASCINA_FINESTRA_VELOCITA_MS), poi frena per attrito
  // costante (ATTRITO_RUOTA_RAD_S2). Se il giro fatto DAL RILASCIO e` sotto
  // GIRO_MINIMO_VALIDO_TURNI chiama onNonValido() (la ruota resta ferma
  // dov'e`, il lancio non conta); altrimenti chiama onFine(segmento,
  // indice), stessa forma di gira().
  function terminaTrascinamento(onFine, onNonValido) {
    if (!trascinando) return;
    trascinando = false;

    const ora = performance.now();
    // Voce B: la velocita` di rilascio e` quella della ruota DISEGNATA
    // (storiaRuotaTrascina), non quella del bersaglio della mano — cosi` non
    // c'e` nessuno scalino fra "mentre si trascina" e "appena rilasciata".
    const recenti = storiaRuotaTrascina.filter((c) => ora - c.t <= TRASCINA_FINESTRA_VELOCITA_MS);
    const riferimento =
      recenti.length >= 2 ? recenti[0] : storiaRuotaTrascina[Math.max(0, storiaRuotaTrascina.length - 2)];
    const ultimo = storiaRuotaTrascina[storiaRuotaTrascina.length - 1];

    let velocita = 0;
    if (riferimento && ultimo && ultimo.t > riferimento.t) {
      velocita = (ultimo.angolo - riferimento.angolo) / ((ultimo.t - riferimento.t) / 1000);
    }
    velocita = Math.max(-TRASCINA_VELOCITA_MAX_RAD_S, Math.min(TRASCINA_VELOCITA_MAX_RAD_S, velocita));

    const direzione = velocita >= 0 ? 1 : -1;
    const velocitaAbs = Math.abs(velocita);
    // Voce B: il lancio vale se, con l'attrito normale, farebbe almeno
    // GIRO_MINIMO_VALIDO_TURNI; se non vale, frena con l'attrito debole e si
    // pianta in meno di 0,6s invece di scorrere a lungo prima di scoprire
    // che non contava.
    const vSoglia = Math.sqrt(2 * ATTRITO_RUOTA_RAD_S2 * GIRO_MINIMO_VALIDO_TURNI * Math.PI * 2);
    const valido = velocitaAbs >= vSoglia;
    const attrito = valido ? ATTRITO_RUOTA_RAD_S2 : ATTRITO_LANCIO_NON_VALIDO_RAD_S2;
    const durataFrenataSec = velocitaAbs / attrito; // T = v0 / a (attrito costante)
    const angoloTotale = (velocitaAbs * velocitaAbs) / (2 * attrito); // s = v0^2 / (2a)

    const partenza = rotazioneCorrente;
    const inizio = performance.now();
    const durataMs = Math.max(1, durataFrenataSec * 1000);

    function frame(ora2) {
      const t = Math.min(1, (ora2 - inizio) / durataMs);
      const tSec = t * durataFrenataSec;
      // v(t) = v0 - a*t ; s(t) = v0*t - 1/2*a*t^2 (attrito costante, punto 62)
      const s = velocitaAbs * tSec - 0.5 * attrito * tSec * tSec;
      rotazioneCorrente = partenza + direzione * s;
      disegna();
      aggiornaTicPercorso();

      if (t < 1) {
        requestAnimationFrame(frame);
        return;
      }

      animando = false;
      onTicGesto = null;

      if (!valido) {
        evidenziato = null;
        disegna();
        if (onNonValido) onNonValido();
        return;
      }

      const angoloFinale = ((rotazioneCorrente % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const angoloSottoPuntatore = ((Math.PI * 1.5 - angoloFinale) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const indice = Math.floor(angoloSottoPuntatore / ANGOLO_SPICCHIO) % N;
      evidenziato = indice;
      disegna();

      let segmentoEsito = SEGMENTI_RUOTA[indice];
      if (segmentoEsito.tipo === "triplo") {
        const inizioSpicchio = indice * ANGOLO_SPICCHIO;
        const resto = angoloSottoPuntatore - inizioSpicchio;
        const terzo = Math.min(2, Math.floor(resto / (ANGOLO_SPICCHIO / 3)));
        segmentoEsito = terzo === 1 ? { tipo: "raddoppia" } : { tipo: "bancarotta" };
      }
      if (onFine) onFine(segmentoEsito, indice);
    }
    requestAnimationFrame(frame);
  }

  // Il dito solleva il tocco fuori dallo schermo, o il gesto viene
  // interrotto (pointercancel): stesso esito di un rilascio, cosi` il gioco
  // non resta bloccato con "animando" vero per sempre.
  function annullaTrascinamento(onNonValido) {
    if (!trascinando) return;
    terminaTrascinamento(null, onNonValido);
  }

  return {
    init,
    disegna,
    gira,
    inAnimazione,
    impostaJollyDisponibile,
    animaPresaJolly,
    impostaRound,
    puoIniziareTrascinamento,
    iniziaTrascinamento,
    muoviTrascinamento,
    terminaTrascinamento,
    annullaTrascinamento,
  };
})();
