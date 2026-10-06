// ============================================================================
// FISICA DELLA RUOTA PESANTE — proposta di Chiara, 05/10/2026, secondo giro.
// Un solo motore per il pulsante e per il trascinamento: cambia solo da dove
// arriva la velocita` di partenza (una mano finta a caso, o la mano vera).
//
// Secondo giro (notte del 05/10). Damiano, dopo aver provato il primo:
// «ancora troppo leggera... immagina una persona che le da` una spinta: i
// primi attimi e` piu` lenta e poi prende velocita` per un poco, ma poi
// torna a rallentare». Due cose cambiano rispetto al primo giro:
//  - LA MASSA (inerzia). Le frenate (cuscinetto e lamella) sono forze: su
//    una ruota piu` pesante rallentano meno. inerzia = 1 e` la ruota del
//    primo giro; 2 e` una ruota che pesa il doppio. La corsa (quanti giri)
//    non dipende dal peso: dipende dall'energia della spinta e da quanta ne
//    mangiano i pioli a ogni giro. Il peso decide solo quanto tutto e` LENTO.
//  - LA SPINTA non dura un tempo fisso (era 0,7 s): la mano accompagna la
//    ruota per una CORSA in gradi (spintaCorsaGradi), come un braccio che
//    tira il bordo da sopra verso il fianco, e la lascia a fine corsa. La
//    forza della mano cresce da zero, e` massima a meta` corsa e cala a
//    zero: cosi` la ruota nei primi attimi quasi non si muove, poi prende
//    velocita`, e passa alla frenata senza strappo. Quanto dura lo decide la
//    ruota: piu` pesante, piu` a lungo la mano la accompagna.
//
// Il modello, in quattro pezzi:
//  1. CUSCINETTO: la ruota frena sempre un po', in modo costante
//     (attritoCuscinetto / inerzia, rad/s²).
//  2. PIOLI E LAMELLA: ogni piolo che passa sotto la freccia la piega per un
//     tratto (lamellaFinestraGradi) prima di scappare via. In quel tratto la
//     ruota frena di piu` (lamellaResistenza / inerzia, rad/s²), e tanto piu`
//     quanto piu` va veloce (a lamellaVelocitaRif rad/s la resistenza
//     raddoppia: un urto forte costa piu` di uno lento). E` questa la frenata
//     "a pioli": tanti pioli = tanta frenata, e si vede sugli ultimi. Quando
//     la punta scivola via dal piolo da` un piccolo scatto in avanti
//     (scattoVelocita): la ruota non si posa mai con la freccia SUL piolo.
//  3. L'ULTIMO PIOLO: se la ruota entra nel tratto della lamella senza
//     l'energia per piegarla fino in fondo, si ferma li` dentro e la lamella
//     la respinge indietro fino a uscire dal tratto (lamellaRestituzione =
//     quanta energia restituisce): e` il rimbalzo. La ruota si posa appena
//     prima del piolo, con la freccia dritta.
//  4. LA MANO: col pulsante, una mano finta accompagna la ruota per una
//     corsa di spintaCorsaGradi (fra Min e Max secondo la forza) fino alla
//     velocita` che fa la corsa totale scelta (fra lancioGiriMin e
//     lancioGiriMax giri, spinta compresa) e poi la lascia. Col
//     trascinamento la mano e` vera, e questo file non la vede: riceve solo
//     la velocita` al rilascio.
//
// Il file non sa niente di canvas: espone uno stato (theta, omega, lamella)
// e un passo nel tempo. Gira uguale nel browser e in Node (per le misure).
// ============================================================================
(function (radice) {
  'use strict';

  const DUE_PI = Math.PI * 2;
  const PASSO_S = 0.002; // sotto-passo d'integrazione: 2 ms, qualunque sia la frequenza dello schermo

  const DEFAULT = {
    pioliPerSpicchio: 3,          // 3 intervalli per spicchio = 4 pioli ai quattro angoli, 72 in tutto (TV, foto 01 e 04)
    spicchi: 24,
    inerzia: 2,                   // massa della ruota: 1 = il primo giro (provato da Damiano: «troppo leggera»), 2 = pesa il doppio
    attritoCuscinetto: 0.05,      // rad/s² a inerzia 1, sempre
    lamellaResistenza: 0.2,       // rad/s² a inerzia 1, mentre un piolo piega la lamella, a velocita` quasi zero
    lamellaVelocitaRif: 0.8,      // rad/s: a questa velocita` la resistenza della lamella raddoppia
    lamellaFinestraGradi: 1.8,    // gradi di corsa in cui il piolo piega la lamella prima di scappare
    lamellaRestituzione: 0.5,     // frazione dell'energia che la lamella restituisce nel rimbalzo
    scattoVelocita: 0.08,         // rad/s: minimo di spinta in avanti quando la lamella scappa dal piolo
    velocitaFermo: 0.05,          // rad/s: sotto questa, fuori dalla lamella, la ruota e` ferma
    lamellaRitornoMs: 30,         // costante di tempo del ritorno della lamella dopo il piolo
    spintaCorsaGradiMin: 60,      // la corsa della mano nella spinta piu` debole: tira il bordo per 60°
    spintaCorsaGradiMax: 90,      // ...e nella piu` forte: un quarto di giro, da sopra al fianco
    lancioGiriMin: 1.0,           // giri della girata piu` debole del pulsante (corsa totale, spinta compresa)
    lancioGiriMax: 1.6,           // giri della girata piu` forte del pulsante — ed e` anche il tetto della mano vera
    attritoLancioNonValido: 1.2,  // rad/s²: un lancio a mano sotto il mezzo giro si pianta cosi` (regola di gioco, non fisica)
  };

  function crea(opzioni) {
    const P = Object.assign({}, DEFAULT, opzioni || {});
    const PASSO_PIOLO = DUE_PI / (P.spicchi * P.pioliPerSpicchio); // rad fra un piolo e l'altro
    const FINESTRA = (P.lamellaFinestraGradi * Math.PI) / 180;     // rad
    const W = FINESTRA / PASSO_PIOLO;                               // finestra in frazione di passo
    const CUSCINETTO = P.attritoCuscinetto / P.inerzia;             // le frenate sono forze: sulla massa contano meno
    const LAMELLA = P.lamellaResistenza / P.inerzia;

    // stato
    const S = {
      theta: 0,        // rotazione della ruota, rad (positiva = oraria sullo schermo)
      omega: 0,        // rad/s
      lamella: 0,      // -1..1: quanto e` piegata la freccia (segno = verso)
      modo: 'fermo',   // fermo | spinta | libero | nonValido | inMano
      t: 0,
      spinta: null,    // { omegaFine, durata, trascorso }
      rimbalzo: false, // vero mentre la lamella respinge la ruota all'indietro
      rimbalzoVerso: 1,
    };

    // fase del piolo sotto la freccia, in [0,1): la freccia sta a -PI/2 sullo
    // schermo; in coordinate della ruota il punto sotto la freccia e`
    // (1.5*PI - theta). Con theta che cresce (ruota in senso orario) la fase
    // SCENDE: il piolo davanti alla freccia si avvicina, e quando la fase
    // passa da 0 a 1 il piolo e` scappato via: un tic.
    function fase(theta) {
      const x = ((1.5 * Math.PI - theta) / PASSO_PIOLO) % 1;
      return x < 0 ? x + 1 : x;
    }

    // la lamella e` piegata da un piolo? (finestra guardata nel verso dato)
    function dentroFinestra(p, verso) {
      return verso > 0 ? p > 0 && p <= W : p >= 1 - W && p < 1;
    }
    function profonditaFinestra(p, verso) {
      return verso > 0 ? W - p : p - (1 - W); // 0..W, in frazione di passo
    }

    // c'e` stato un tic fra due rotazioni? (un piolo e` passato sotto la freccia)
    function tic(thetaPrima, thetaDopo) {
      const a = Math.floor((1.5 * Math.PI - thetaPrima) / PASSO_PIOLO);
      const b = Math.floor((1.5 * Math.PI - thetaDopo) / PASSO_PIOLO);
      if (a === b) return 0;
      return thetaDopo > thetaPrima ? 1 : -1;
    }

    // Un sotto-passo della ruota lasciata libera (o nel lancio non valido).
    // Restituisce +1/-1 se e` scattato un tic, altrimenti 0.
    function sottoPassoLibero(h) {
      if (S.omega === 0 && !S.rimbalzo) { S.modo = 'fermo'; return 0; }
      const versoMoto = S.omega >= 0 ? 1 : -1;
      const versoLamella = S.rimbalzo ? S.rimbalzoVerso : versoMoto;
      const p = fase(S.theta);
      const dentro = dentroFinestra(p, versoLamella);
      const v = Math.abs(S.omega);

      let decel;
      if (S.rimbalzo) decel = CUSCINETTO; // la lamella spinge: nessuna resistenza, solo il cuscinetto (anche nel lancio non valido)
      else if (S.modo === 'nonValido') decel = P.attritoLancioNonValido;
      else if (dentro) decel = CUSCINETTO + LAMELLA * (1 + v / P.lamellaVelocitaRif);
      else decel = CUSCINETTO;

      let vNuova = v - decel * h;
      if (vNuova <= 0) {
        if (dentro && !S.rimbalzo) {
          // si e` fermata dentro la lamella: rimbalzo. L'energia accumulata
          // piegando la lamella (resistenza x corsa) torna in parte indietro.
          const corsa = profonditaFinestra(p, versoMoto) * PASSO_PIOLO;
          const vRimbalzo = Math.sqrt(2 * LAMELLA * Math.max(corsa, 0.0005) * P.lamellaRestituzione);
          S.omega = -versoMoto * vRimbalzo;
          S.rimbalzo = true;
          S.rimbalzoVerso = versoMoto;
          return 0;
        }
        S.omega = 0; S.modo = 'fermo'; S.rimbalzo = false;
        return 0;
      }
      // fuori dalla lamella, sotto la velocita` di fermo, la ruota si posa
      if (!dentro && vNuova < P.velocitaFermo && (S.modo !== 'nonValido' || S.rimbalzo)) {
        S.omega = 0; S.modo = 'fermo'; S.rimbalzo = false;
        return 0;
      }
      S.omega = versoMoto * vNuova;
      const thetaPrima = S.theta;
      S.theta += S.omega * h;
      if (S.rimbalzo && !dentroFinestra(fase(S.theta), S.rimbalzoVerso)) {
        // uscita dalla finestra all'indietro: la lamella ha finito di spingere
        S.rimbalzo = false;
      }
      const t = tic(thetaPrima, S.theta);
      if (t && S.modo !== 'nonValido' && vNuova < P.scattoVelocita) {
        // la punta della lamella scivola via dal piolo e da` un piccolo scatto
        S.omega = versoMoto * P.scattoVelocita;
      }
      return t;
    }

    // deflessione della lamella da disegnare: dentro la finestra segue il
    // piolo (0 -> 1 fino allo scatto, e a ritroso nel rimbalzo), fuori torna
    // a zero con una costante di tempo (lamellaRitornoMs).
    function aggiornaLamella(h) {
      const p = fase(S.theta);
      let bersaglio = 0;
      if (S.omega !== 0 || S.rimbalzo) {
        const verso = S.rimbalzo ? S.rimbalzoVerso : S.omega >= 0 ? 1 : -1;
        if (dentroFinestra(p, verso)) bersaglio = (verso > 0 ? 1 : -1) * (profonditaFinestra(p, verso) / W);
      }
      if (bersaglio !== 0) S.lamella = bersaglio; // il piolo la piega e la accompagna: subito
      else S.lamella += (bersaglio - S.lamella) * (1 - Math.exp(-(h * 1000) / P.lamellaRitornoMs));
      if (Math.abs(S.lamella) < 0.002) S.lamella = 0;
    }

    // Avanza di dt secondi. onTic(verso) a ogni piolo. Ritorna vero se la ruota si e` fermata in questo passo.
    function passo(dt, onTic) {
      let rimasto = Math.min(dt, 0.1);
      let fermataOra = false;
      while (rimasto > 0) {
        const h = Math.min(PASSO_S, rimasto);
        rimasto -= h;
        S.t += h;
        let t = 0;
        if (S.modo === 'spinta') {
          const sp = S.spinta;
          sp.trascorso += h;
          const u = Math.min(1, sp.trascorso / sp.durata);
          const nuovaOmega = sp.omegaFine * profiloSpinta(u);
          const thetaPrima = S.theta;
          S.omega = nuovaOmega;
          S.theta += S.omega * h;
          t = tic(thetaPrima, S.theta);
          if (u >= 1) { S.modo = 'libero'; S.spinta = null; }
        } else if (S.modo === 'libero' || S.modo === 'nonValido') {
          t = sottoPassoLibero(h);
          if (S.modo === 'fermo') fermataOra = true;
        }
        aggiornaLamella(h);
        if (t && onTic) onTic(t);
      }
      return fermataOra;
    }

    // --- le due mani --------------------------------------------------------
    // La velocita` della ruota durante la spinta, in frazione di quella
    // finale, con u = tempo trascorso / durata. E` l'integrale di una forza
    // che cresce da zero, e` massima a meta` e cala a zero (sin² della
    // corsa): i primi attimi la ruota quasi non si muove, poi prende
    // velocita`, e arriva alla velocita` di rilascio senza strappo (la forza
    // li` e` zero, e subentra la frenata). Media sulla spinta: meta` della
    // velocita` finale, quindi la corsa della mano vale omegaFine*durata/2.
    function profiloSpinta(u) {
      return u - Math.sin(DUE_PI * u) / DUE_PI;
    }

    // La spinta del pulsante con forza in [0,1]: corsa della mano (gradi) e
    // velocita` di rilascio, cioe` quella che fa la corsa totale scelta
    // (giri, spinta compresa) una volta lasciata.
    function spintaPerForza(forza) {
      const f = Math.max(0, Math.min(1, forza));
      const corsaGradi = P.spintaCorsaGradiMin + (P.spintaCorsaGradiMax - P.spintaCorsaGradiMin) * f;
      const giri = P.lancioGiriMin + (P.lancioGiriMax - P.lancioGiriMin) * f;
      const corsaRad = (corsaGradi * Math.PI) / 180;
      const omegaFine = velocitaPerGiri(Math.max(0.05, giri - corsaRad / DUE_PI));
      return { corsaGradi, omegaFine, durata: (2 * corsaRad) / omegaFine };
    }

    // Pulsante: forza in [0,1] -> la mano finta accompagna la ruota per la sua corsa e la lascia.
    function spingi(forza) {
      const sp = spintaPerForza(forza);
      S.modo = 'spinta';
      S.rimbalzo = false;
      S.spinta = { omegaFine: sp.omegaFine, durata: sp.durata, trascorso: 0 };
      return sp.omegaFine;
    }

    // Il tetto della mano vera: la velocita` di rilascio della girata piu` forte del pulsante.
    function velocitaTetto() { return spintaPerForza(1).omegaFine; }

    // Mano vera: la ruota e` gia` in moto a `omega` (rad/s, col segno) e viene lasciata.
    // Se non vale (sotto giriMinimi), frena con l'attrito del lancio non valido.
    function lascia(omega, giriMinimi) {
      const tetto = velocitaTetto();
      const v = Math.max(-tetto, Math.min(tetto, omega));
      const valido = giriDaVelocita(Math.abs(v)) >= giriMinimi;
      S.omega = v;
      S.rimbalzo = false;
      S.modo = valido ? 'libero' : 'nonValido';
      return valido;
    }

    function aSecco(omega, fn) {
      const salva = { theta: S.theta, omega: S.omega, lamella: S.lamella, modo: S.modo, t: S.t, spinta: S.spinta, rimbalzo: S.rimbalzo, rimbalzoVerso: S.rimbalzoVerso };
      S.theta = 0; S.omega = Math.abs(omega); S.modo = 'libero'; S.rimbalzo = false; S.spinta = null;
      let n = 0;
      while (S.modo !== 'fermo' && n++ < 20000) sottoPassoLibero(0.004);
      const r = fn(n * 0.004);
      Object.assign(S, salva);
      return r;
    }
    // Quanti giri fa la ruota lasciata libera a `omega` rad/s (simulazione a secco, senza tic).
    function giriDaVelocita(omega) { return aSecco(omega, () => S.theta / DUE_PI); }
    // quanto dura la frenata da `omega` (s)
    function durataDaVelocita(omega) { return aSecco(omega, (durata) => durata); }

    const cacheGiri = new Map();
    // La velocita` di rilascio che fa esattamente `giri` giri (bisezione sulla simulazione).
    function velocitaPerGiri(giri) {
      if (cacheGiri.has(giri)) return cacheGiri.get(giri);
      let lo = 0, hi = 10;
      for (let i = 0; i < 28; i++) {
        const m = (lo + hi) / 2;
        if (giriDaVelocita(m) < giri) lo = m; else hi = m;
      }
      const v = (lo + hi) / 2;
      cacheGiri.set(giri, v);
      return v;
    }

    function inMano(valore) { S.modo = valore ? 'inMano' : 'fermo'; S.rimbalzo = false; S.spinta = null; }
    function imposta(theta, omega) { S.theta = theta; if (omega !== undefined) S.omega = omega; }

    return {
      P, S, PASSO_PIOLO, FINESTRA, DUE_PI,
      passo, spingi, lascia, inMano, imposta, fase, tic,
      giriDaVelocita, velocitaPerGiri, durataDaVelocita, spintaPerForza, velocitaTetto, profiloSpinta,
      ticAlSecondo: (omega) => Math.abs(omega) / PASSO_PIOLO,
      spicchiAlSecondo: (omega) => Math.abs(omega) / (DUE_PI / P.spicchi),
    };
  }

  const api = { crea, DEFAULT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else radice.FisicaRuota = api;
})(typeof window !== 'undefined' ? window : globalThis);
