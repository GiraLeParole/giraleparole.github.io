// ============================================================================
// SUONI — generati dal browser con la Web Audio API, nessun file audio.
// Stessa idea vista nel sito di riferimento: oscillatori accesi e spenti al
// volo, niente da scaricare, niente dipendenze esterne.
// ============================================================================

const Audio_ = (() => {
  let ctx = null;

  // ---- VOLUME (punto 36, 28/09/2026) -----------------------------------------
  // Due cursori indipendenti, musica ed effetti, 0 (muto) - 1 (pieno). Gli
  // interruttori sì/no che c'erano prima (btn-musica, btn-muto) sono
  // assorbiti qui dentro: un cursore a zero equivale a "spento", esattamente
  // come chiesto al punto 36. Ricordati fra una partita e l'altra con
  // localStorage, come gia` faceva la vecchia preferenza musica.
  const CHIAVE_VOLUME_MUSICA = "giraleparole-volume-musica";
  const CHIAVE_VOLUME_EFFETTI = "giraleparole-volume-effetti";

  function leggiVolumeSalvato(chiave, difetto) {
    try {
      const v = window.localStorage.getItem(chiave);
      if (v === null) return difetto;
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : difetto;
    } catch (e) {
      return difetto; // niente localStorage (es. modalita` privata): vale solo per questa sessione
    }
  }

  function scriviVolumeSalvato(chiave, v) {
    try {
      window.localStorage.setItem(chiave, String(v));
    } catch (e) {
      // niente da fare: la preferenza vale solo per questa sessione
    }
  }

  let volumeEffetti = leggiVolumeSalvato(CHIAVE_VOLUME_EFFETTI, VOLUME_EFFETTI_CURSORE_INIZIALE);
  let volumeMusicaCursore = leggiVolumeSalvato(CHIAVE_VOLUME_MUSICA, VOLUME_MUSICA_CURSORE_INIZIALE);

  // Il volume "vero" della musica di sottofondo (file o groove): il cursore
  // (0-1) moltiplica il livello massimo gia` mixato in config.js.
  function volumeMusicaEffettivo() {
    return VOLUME_MUSICA_FILE * volumeMusicaCursore;
  }

  function impostaVolumeEffetti(v) {
    volumeEffetti = Math.max(0, Math.min(1, v));
    scriviVolumeSalvato(CHIAVE_VOLUME_EFFETTI, volumeEffetti);
  }

  function impostaVolumeMusica(v) {
    const eraAcceso = volumeMusicaCursore > 0;
    volumeMusicaCursore = Math.max(0, Math.min(1, v));
    scriviVolumeSalvato(CHIAVE_VOLUME_MUSICA, volumeMusicaCursore);
    if (volumeMusicaCursore <= 0) {
      if (eraAcceso) dissolviInUscita();
      return;
    }
    if (!eraAcceso) {
      // Il cursore era a zero (musica "spenta") ed e` stato appena alzato:
      // riparte da capo, come premere il vecchio interruttore "on".
      getCtx();
      if (indiceMusicaFile >= 0) suonaSelezioneCorrente();
      return;
    }
    // Gia` in corso: si sposta subito il volume, senza fade — e` un
    // trascinamento di cursore, non un cambio di brano.
    aggiornaVolumeMusicaLive();
  }

  function aggiornaVolumeMusicaLive() {
    if (!entroInRiproduzione) return;
    if (entroInRiproduzione.groove) {
      if (nodoMusica) nodoMusica.gain.value = volumeMusicaCursore;
    } else {
      const s = statoFileMusica.get(entroInRiproduzione.file);
      if (s) s.audio.volume = volumeMusicaEffettivo();
    }
  }

  function leggiVolumeMusicaCursore() {
    return volumeMusicaCursore;
  }

  function leggiVolumeEffettiCursore() {
    return volumeEffetti;
  }

  // ---- MUSICA DI SOTTOFONDO --------------------------------------------------
  // Settimo giro (28/09/2026), secondo compito: Damiano ha approvato musica
  // VERA al posto dei groove generati — quattro mp3 CC BY 4.0 scaricati in
  // `musica/` (crediti in `musica/CREDITI.md`), un brano per round che
  // cambia ad ogni round, sequenza in `config.js` (SEQUENZA_MUSICA_FILE,
  // "Funk Game Loop" ogni round pari, gli altri tre alternati nei round
  // dispari — e` l'unico dei quattro pensato per il loop). Il cambio brano
  // e` una dissolvenza breve (DURATA_DISSOLVENZA_MUSICA_SEC), non uno
  // stacco. Il GROOVE GENERATO (`TRACCE_MUSICA` piu` sotto, gia` scritto per
  // il quinto/sesto giro) NON e` stato cancellato: resta come riserva per il
  // singolo round il cui file non si carica (vedi `avviaModalitaGroove` /
  // `provaAvviaFile` sotto) — se un mp3 da` errore, quel round suona il
  // groove generato invece di restare muto, gli altri round coi file buoni
  // continuano a suonare i file veri. E` un interruttore SEPARATO dal
  // cursore degli effetti.
  // Ottavo giro (punto 36, 28/09/2026): il vecchio interruttore on/off
  // ("musicaAttiva", localStorage a parte) e` sostituito dal cursore
  // `volumeMusicaCursore` definito piu` sopra — "accesa" ora vuole dire
  // "cursore sopra zero".
  function musicaEAccesa() {
    return volumeMusicaCursore > 0;
  }

  // ---- BRANI VERI (mp3) — un <audio> + un GainNode per file, riusati per
  // tutta la partita (mai ricreati), cosi` la dissolvenza puo` alzare o
  // abbassare il volume di un file gia` pronto senza aspettare il caricamento.
  // Un solo elemento per nome file anche se compare piu` volte nella
  // sequenza (es. "Funk Game Loop"): la mappa e` per nome, non per posizione.
  // NOTA IMPORTANTE (scoperta durante la verifica, corretta subito): la
  // prima versione collegava questi <audio> al grafo Web Audio con
  // `createMediaElementSource` + GainNode, per poterne sfumare il volume
  // con la stessa precisione degli effetti. Aperta da file:// (doppio clic,
  // come fa Damiano), quel collegamento produce silenzio totale: Chrome
  // tratta la risorsa mp3 caricata da file:// come di origine "opaca" ai
  // fini del grafo Web Audio, il nodo risulta "tainted" e il suo output e`
  // muto — play() riesce, nessun errore, ma non esce suono. Verificato con
  // un AnalyserNode dopo il GainNode: da file:// tutti i campioni erano 0
  // per 2 secondi interi; da http:// (stesso codice, stesso file, via
  // `python3 -m http.server`) i campioni erano regolarmente diversi da
  // zero. Per questo qui sotto NON si passa piu` dal grafo Web Audio per i
  // file veri: si usa il volume NATIVO dell'elemento <audio>
  // (`audio.volume`, 0-1), che funziona identico da file:// e da http://
  // perche` non tocca mai l'AudioContext. La dissolvenza si fa con un
  // piccolo timer che sposta `audio.volume` a piccoli passi (vedi
  // `sfumaVolume` sotto) invece che con `AudioParam.linearRampToValueAtTime`.
  // Il groove generato (piu` sotto in questo file) NON e` toccato da questo
  // problema: usa oscillatori/buffer creati direttamente nel contesto Web
  // Audio, senza alcun <audio> di mezzo, quindi nessun "tainting" possibile.
  const statoFileMusica = new Map(); // nome file -> { audio, fallito }
  let indiceMusicaFile = -1; // -1 = nessuna scelta ancora, come indiceTraccia
  let entroInRiproduzione = null; // { file } | { groove: true } — cosa sta suonando ORA
  let idFadeInCorso = 0; // per annullare un fade vecchio se ne parte uno nuovo prima che finisca

  function statoPerFile(nomeFile) {
    let s = statoFileMusica.get(nomeFile);
    if (!s) {
      const audio = new Audio(CARTELLA_MUSICA + nomeFile);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
      s = { audio, fallito: false };
      audio.addEventListener("error", () => {
        s.fallito = true; // il file non si carica (404, formato, ecc.): i round futuri con questo nome vanno dritti al groove
      });
      statoFileMusica.set(nomeFile, s);
    }
    return s;
  }

  // Sposta `audio.volume` da dove sta ora fino a `obiettivo`, in
  // `durataSec` secondi, a piccoli passi regolari — l'equivalente "fatto a
  // mano" di un AudioParam.linearRampToValueAtTime, ma sul volume nativo
  // dell'elemento invece che su un GainNode (vedi nota sopra sul perche`).
  // Se `alFine` e` passata, viene chiamata all'ultimo passo (usata per
  // mettere in pausa il file dopo la dissolvenza in uscita).
  function sfumaVolume(audioEl, obiettivo, durataSec, alFine) {
    const PASSI = 16;
    const intervalloMs = (durataSec * 1000) / PASSI;
    const partenza = audioEl.volume;
    let passo = 0;
    const idTimer = setInterval(() => {
      passo++;
      const t = Math.min(1, passo / PASSI);
      audioEl.volume = partenza + (obiettivo - partenza) * t;
      if (passo >= PASSI) {
        clearInterval(idTimer);
        audioEl.volume = obiettivo;
        if (alFine) alFine();
      }
    }, intervalloMs);
  }

  function fileCorrente() {
    if (indiceMusicaFile < 0) return SEQUENZA_MUSICA_FILE[0];
    return SEQUENZA_MUSICA_FILE[indiceMusicaFile % SEQUENZA_MUSICA_FILE.length];
  }

  // Ferma dolcemente cio` che sta suonando ADESSO (file vero o groove),
  // qualunque cosa fosse. Non tocca la scelta del PROSSIMO round: quella la
  // decide gia` musicaProssimoRound() prima di chiamare questa funzione.
  function dissolviInUscita() {
    if (!entroInRiproduzione) return;
    if (entroInRiproduzione.groove) {
      fermaSequenziatore(); // il groove non ha un volume continuo da sfumare, si ferma e basta
    } else {
      const s = statoFileMusica.get(entroInRiproduzione.file);
      if (s) {
        sfumaVolume(s.audio, 0, DURATA_DISSOLVENZA_MUSICA_SEC, () => s.audio.pause());
      }
    }
    entroInRiproduzione = null;
  }

  // Prova a far partire il file vero del round corrente con una dissolvenza
  // in entrata; se il browser rifiuta play() (formato non supportato, ecc.)
  // o il file era gia` segnato come fallito da un tentativo precedente,
  // passa al groove generato per QUESTO round.
  function provaAvviaFile(nomeFile) {
    const s = statoPerFile(nomeFile);
    if (s.fallito) {
      avviaModalitaGroove();
      return;
    }
    s.audio.currentTime = 0;
    s.audio.volume = 0;
    const idQuestoFade = ++idFadeInCorso;
    const promessa = s.audio.play();
    // Alcuni browser restituiscono una Promise che puo` essere rifiutata
    // invece di lanciare un errore sincrono: entrambi i casi vanno
    // intercettati, altrimenti resta silenzio invece del groove.
    if (promessa && typeof promessa.catch === "function") {
      promessa.catch(() => {
        s.fallito = true;
        if (idQuestoFade === idFadeInCorso) avviaModalitaGroove();
      });
    }
    sfumaVolume(s.audio, volumeMusicaEffettivo(), DURATA_DISSOLVENZA_MUSICA_SEC);
    entroInRiproduzione = { file: nomeFile };
  }

  // Riserva: il vecchio motore a groove generato (sotto), usato SOLO quando
  // il file vero del round non parte. Nessuna dissolvenza qui (il groove non
  // ha un volume continuo da sfumare, e` gia` cosi` da quando esisteva da
  // solo) — parte e basta, com'era prima di questo giro.
  function avviaModalitaGroove() {
    entroInRiproduzione = { groove: true };
    avviaSequenziatore();
  }

  // Sceglie cosa suonare ADESSO in base alla selezione corrente
  // (indiceMusicaFile) — usata sia da musicaProssimoRound() (round gia` in
  // corso, musica accesa) sia da musicaAvvia() (si riprende a suonare cio`
  // che era gia` stato scelto per il round in corso).
  function suonaSelezioneCorrente() {
    dissolviInUscita();
    provaAvviaFile(fileCorrente());
  }

  // Costruisce un pattern di 16 sedicesimi (un giro) segnando `true` solo
  // sui passi indicati — piu` leggibile e meno soggetto a errori di conta
  // che scrivere a mano un array di 16 zeri e uno.
  function passi(indici) {
    const arr = new Array(16).fill(false);
    indici.forEach((i) => (arr[i] = true));
    return arr;
  }

  // Quattro tracce, ognuna con la sua identita`. Cambiano: tonalita`
  // (radiceBasso), tempo, qualita` dell'accordo, disegno del basso, disegno
  // di cassa/rullante/hi-hat, swing, e dove cade l'accordo "in levare".
  const TRACCE_MUSICA = [
    {
      // Traccia 1 — La minore settima, 98 bpm, il piu` "in the pocket":
      // basso che cammina (walking bass), accordo sul classico "e" di ogni
      // quarto (passi 2/6/10/14).
      nome: "La minore settima",
      tempo: 98,
      radiceBasso: 55.0, // A1
      accordoSemitoni: [0, 3, 7, 10], // Am7
      swing: 0.05,
      cassa: passi([0, 6, 10]),
      rullante: passi([4, 12]),
      rullanteFantasma: passi([9]),
      hihat: passi([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
      hihatAccento: [0, 4, 8, 12],
      hihatAperto: [14],
      bassoMappa: { 0: 0, 3: 3, 6: 7, 8: 0, 11: 10, 14: 7 },
      accordo: passi([2, 6, 10, 14]),
    },
    {
      // Traccia 2 — Re settima di dominante, 108 bpm, basso che rimbalza
      // di ottava; hi-hat piu` rado (solo ottavi) e accordo spostato sul
      // contrattempo piu` tardivo (passi 3/7/11/15, non 2/6/10/14): stesso
      // principio "in levare", punto diverso della battuta.
      nome: "Re settima",
      tempo: 108,
      radiceBasso: 73.42, // D2
      accordoSemitoni: [0, 4, 7, 10], // D7
      swing: 0.1,
      cassa: passi([0, 3, 8, 11]),
      rullante: passi([4, 12]),
      rullanteFantasma: passi([7, 15]),
      hihat: passi([0, 2, 4, 6, 8, 10, 12, 14]),
      hihatAccento: [0, 8],
      hihatAperto: [14],
      bassoMappa: { 0: 0, 2: 12, 4: 0, 6: 12, 8: 0, 10: 12, 12: 0, 14: 7 },
      accordo: passi([3, 7, 11, 15]),
    },
    {
      // Traccia 3 — Do accordo di nona, 116 bpm, il piu` rilassato: basso
      // discendente a frase (non ripete lo stesso disegno ogni quarto),
      // niente hi-hat aperto, accordo sparso (solo 2 colpi a giro) per un
      // groove piu` "laid-back".
      nome: "Do nona",
      tempo: 116,
      radiceBasso: 65.41, // C2
      accordoSemitoni: [0, 7, 10, 14], // C9 (radice-5a-7a-9a)
      swing: 0.03,
      cassa: passi([0, 7, 12]),
      rullante: passi([4, 12]),
      rullanteFantasma: passi([9, 13]),
      hihat: passi([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
      hihatAccento: [0, 4, 8, 12],
      hihatAperto: [],
      bassoMappa: { 0: 0, 4: 10, 7: 8, 8: 0, 12: 7, 14: 3 },
      accordo: passi([2, 10]),
    },
    {
      // Traccia 4 — Mi nona di dominante, 124 bpm, la piu` energica: basso
      // a ottavi quasi continuo, hi-hat accentato su ogni ottavo e due
      // hi-hat aperti, lo swing piu` marcato delle quattro (shuffle piu`
      // sentito).
      nome: "Mi nona",
      tempo: 124,
      radiceBasso: 82.41, // E2
      accordoSemitoni: [0, 4, 7, 10, 14], // E9
      swing: 0.12,
      cassa: passi([0, 6, 8, 14]),
      rullante: passi([4, 12]),
      rullanteFantasma: passi([2, 10]),
      hihat: passi([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
      hihatAccento: [0, 2, 4, 6, 8, 10, 12, 14],
      hihatAperto: [6, 14],
      bassoMappa: { 0: 0, 2: 0, 4: 7, 6: 7, 8: 0, 10: 0, 12: 12, 14: 10 },
      accordo: passi([2, 6, 10, 14]),
    },
  ];

  let indiceTraccia = -1; // -1 = nessuna scelta ancora (avanzata al primo round)
  let schedulerMusica = null;
  let prossimoTempoPasso = 0;
  let passoCorrente = 0;
  let contatoreBattute = 0;
  let nodoMusica = null;
  let nodoMusicaCtx = null;
  let bufferRumore = null;
  let bufferRumoreCtx = null;

  const FINESTRA_LOOKAHEAD_MS = 25;
  const ANTICIPO_SCHEDULING_SEC = 0.1;

  function tracciaAttiva() {
    return TRACCE_MUSICA[indiceTraccia >= 0 ? indiceTraccia : 0];
  }

  function durataSedicesimo(traccia) {
    return 60 / traccia.tempo / 4;
  }

  // Nodo unico a cui si collega ogni strumento della batteria/basso/accordo:
  // il "peso" relativo di ogni suono e` gia` nell'inviluppo (vedi le funzioni
  // sotto); il gain di QUESTO nodo unico e` invece il cursore di volume della
  // musica (punto 36) — moltiplica tutto il groove in un colpo solo.
  function nodoUscitaMusica(c) {
    if (!nodoMusica || nodoMusicaCtx !== c) {
      nodoMusica = c.createGain();
      nodoMusica.gain.value = volumeMusicaCursore;
      nodoMusica.connect(c.destination);
      nodoMusicaCtx = c;
    }
    return nodoMusica;
  }

  function rumoreBianco(c) {
    if (!bufferRumore || bufferRumoreCtx !== c) {
      const durata = 1;
      const buffer = c.createBuffer(1, c.sampleRate * durata, c.sampleRate);
      const dati = buffer.getChannelData(0);
      for (let i = 0; i < dati.length; i++) dati[i] = Math.random() * 2 - 1;
      bufferRumore = buffer;
      bufferRumoreCtx = c;
    }
    return bufferRumore;
  }

  // Cassa: seno che scivola in giu` di frequenza in fretta, inviluppo corto.
  // Volumi bassi ovunque in questa sezione (di proposito): la musica deve
  // restare SOTTO la voce dei bambini e sotto gli effetti del gioco, mai
  // sopra — vedi i volumi di tono()/tic() qui sotto, decisamente piu` alti.
  function suonaCassaMusica(c, t) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(nodoUscitaMusica(c));
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // Rullante: scoppio di rumore filtrato passa-alto (il "colpo secco") piu`
  // un corpo tonale triangolare sotto, per lo scatto. `intensita` 1 = colpo
  // vero sul contrattempo, <1 = colpo "fantasma" (piu` basso, tra un colpo
  // vero e l'altro, com'e` normale in un giro funk).
  function suonaRullanteMusica(c, t, intensita) {
    const src = c.createBufferSource();
    src.buffer = rumoreBianco(c);
    const filtro = c.createBiquadFilter();
    filtro.type = "highpass";
    filtro.frequency.value = 1200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.09 * intensita, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(filtro);
    filtro.connect(gain);
    gain.connect(nodoUscitaMusica(c));
    src.start(t);
    src.stop(t + 0.16);

    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 190;
    const gain2 = c.createGain();
    gain2.gain.setValueAtTime(0.04 * intensita, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain2);
    gain2.connect(nodoUscitaMusica(c));
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Hi-hat: rumore filtrato passa-alto molto stretto (chiuso) o piu` lungo
  // (aperto), con un accento leggermente piu` forte sui quarti.
  function suonaHihatMusica(c, t, aperto, accento) {
    const src = c.createBufferSource();
    src.buffer = rumoreBianco(c);
    const filtro = c.createBiquadFilter();
    filtro.type = "highpass";
    filtro.frequency.value = 7500;
    const gain = c.createGain();
    const durata = aperto ? 0.16 : 0.045;
    const volume = (aperto ? 0.035 : 0.022) * (accento ? 1.5 : 1);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durata);
    src.connect(filtro);
    filtro.connect(gain);
    gain.connect(nodoUscitaMusica(c));
    src.start(t);
    src.stop(t + durata + 0.02);
  }

  // Basso: triangolare passato in un filtro passa-basso morbido, cosi` non
  // ha spigoli — sincopato secondo `bassoMappa` di ogni traccia.
  function suonaBassoMusica(c, t, freq, durata) {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const filtro = c.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 900;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.065, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durata);
    osc.connect(filtro);
    filtro.connect(gain);
    gain.connect(nodoUscitaMusica(c));
    osc.start(t);
    osc.stop(t + durata + 0.02);
  }

  // Accordo "in levare": una piccola pennata di 4-5 note (dente di sega
  // filtrato, cosi` non e` tagliente) sul contrattempo — l'idea della
  // chitarra funk che stoppa l'accordo sull'"e" della battuta.
  function suonaAccordoMusica(c, t, frequenze) {
    frequenze.forEach((f) => {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      const filtro = c.createBiquadFilter();
      filtro.type = "lowpass";
      filtro.frequency.value = 1700;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.02, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(filtro);
      filtro.connect(gain);
      gain.connect(nodoUscitaMusica(c));
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  function suonaPassoMusica(passo, tGriglia) {
    const c = getCtx();
    const traccia = tracciaAttiva();
    const dur = durataSedicesimo(traccia);
    // swing: i sedicesimi dispari (la seconda meta` di ogni ottavo) si
    // spostano un filo in avanti — e` cio` che fa "ballare" un groove
    // invece di suonare quadrato e meccanico.
    const t = passo % 2 === 1 ? tGriglia + dur * traccia.swing : tGriglia;

    if (traccia.cassa[passo]) suonaCassaMusica(c, t);
    if (traccia.rullante[passo]) suonaRullanteMusica(c, t, 1);
    if (traccia.rullanteFantasma[passo]) suonaRullanteMusica(c, t, 0.4);
    if (traccia.hihat[passo]) {
      suonaHihatMusica(c, t, traccia.hihatAperto.includes(passo), traccia.hihatAccento.includes(passo));
    }
    const semitoniBasso = traccia.bassoMappa[passo];
    if (semitoniBasso !== undefined) {
      suonaBassoMusica(c, t, traccia.radiceBasso * Math.pow(2, semitoniBasso / 12), dur * 3.2);
    }
    if (traccia.accordo[passo]) {
      const frequenze = traccia.accordoSemitoni.map(
        (s) => traccia.radiceBasso * 2 * Math.pow(2, s / 12)
      );
      suonaAccordoMusica(c, t, frequenze);
    }
    // Ogni quarta battuta, una piccola variazione sull'ultimo mezzo tempo:
    // e` "un giro che si ripete con qualche variazione", non lo stesso
    // ciclo meccanico per un'ora intera.
    if (contatoreBattute % 4 === 3 && passo === 14) {
      suonaRullanteMusica(c, t, 0.5);
      suonaHihatMusica(c, t + dur / 2, true, false);
    }
  }

  function schedulaProssimiPassi() {
    const c = getCtx();
    while (prossimoTempoPasso < c.currentTime + ANTICIPO_SCHEDULING_SEC) {
      suonaPassoMusica(passoCorrente, prossimoTempoPasso);
      prossimoTempoPasso += durataSedicesimo(tracciaAttiva());
      passoCorrente++;
      if (passoCorrente >= 16) {
        passoCorrente = 0;
        contatoreBattute++;
      }
    }
  }

  function avviaSequenziatore() {
    if (schedulerMusica) return; // gia` in giro
    const c = getCtx();
    passoCorrente = 0;
    contatoreBattute = 0;
    prossimoTempoPasso = c.currentTime + 0.05;
    schedulerMusica = setInterval(schedulaProssimiPassi, FINESTRA_LOOKAHEAD_MS);
  }

  function fermaSequenziatore() {
    if (schedulerMusica) {
      clearInterval(schedulerMusica);
      schedulerMusica = null;
    }
  }

  // Ottavo giro (punto 36): non c'e` piu` un interruttore proprio — "acceso"
  // vuole dire "cursore volume musica sopra zero" (musicaEAccesa() qui
  // sopra). Questa funzione resta per il gesto-utente che sblocca l'audio
  // del browser e per riprendere a suonare quando il cursore torna sopra
  // zero (vedi impostaVolumeMusica).
  function musicaAvvia() {
    getCtx(); // richiede un gesto utente gia` avvenuto (es. click su "Inizia la partita")
    if (!musicaEAccesa()) return; // cursore a zero: nessuna musica da avviare
    if (indiceMusicaFile < 0) return; // nessun round ancora iniziato: nulla da riprendere
    // Se nuovoRound() aveva gia` avviato il brano di questo round (perche`
    // il cursore era gia` sopra zero all'apertura della partita), non
    // ripartire da capo qui: iniziaPartita() chiama nuovoRound() e poi
    // musicaAvvia() in sequenza, e senza questa guardia suonerebbero due
    // dissolvenze sovrapposte sullo stesso brano.
    const giaInCorso =
      entroInRiproduzione &&
      (entroInRiproduzione.groove || entroInRiproduzione.file === fileCorrente());
    if (!giaInCorso) suonaSelezioneCorrente();
  }

  function musicaFerma() {
    dissolviInUscita();
  }

  function isMusicaAttiva() {
    return musicaEAccesa();
  }

  // Chiamata da nuovoRound() in gioco.js ad ogni round nuovo (compreso il
  // primo): passa al brano successivo fra i sei della sequenza (config.js,
  // SEQUENZA_MUSICA_FILE), e quando finisce l'ultimo riparte dal primo. Se
  // la musica sta gia` suonando (cursore sopra zero), passa subito al nuovo
  // brano con una dissolvenza; se il cursore e` a zero, si limita a segnare
  // la scelta — suonera` quando/se il cursore tornera` sopra zero.
  function musicaProssimoRound() {
    indiceMusicaFile = (indiceMusicaFile + 1) % SEQUENZA_MUSICA_FILE.length;
    if (musicaEAccesa()) suonaSelezioneCorrente();
  }

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Un singolo "bip": frequenza, forma d'onda, durata, volume, ritardo.
  function tono(freq, tipo = "sine", durata = 0.2, volume = 0.2, ritardo = 0) {
    if (volumeEffetti <= 0) return; // punto 36: cursore effetti a zero = muto
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = tipo;
    osc.frequency.value = freq;
    const t0 = c.currentTime + ritardo;
    gain.gain.setValueAtTime(volume * volumeEffetti, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durata);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + durata + 0.05);
  }

  // Terzo giro (28/09/2026), punto 15: "il suono di ogni spicchio e`
  // fastidioso, perche` e` un suono particolare". Era un'onda quadra
  // (square) a 700Hz — ricca di armoniche, il timbro piu` ruvido che la Web
  // Audio API sa fare. Sostituita con un'onda triangolare (piu` morbida
  // della sinusoide sola, ma senza gli spigoli della quadra), un filo piu`
  // grave e un volume piu` basso: un "tock" leggero, non un buzz.
  function tic() {
    tono(500, "triangle", 0.035, 0.08);
  }

  function letteraRivelata() {
    tono(600, "sine", 0.12, 0.2);
    tono(900, "sine", 0.12, 0.15, 0.05);
  }

  function letteraAssente() {
    tono(200, "square", 0.25, 0.2);
    tono(150, "square", 0.3, 0.2, 0.15);
  }

  // Punto 37 (28/09/2026, seconda dettatura): "un suono di errore breve e
  // non fastidioso" per la lettera già chiamata — diverso da letteraAssente
  // (che resta com'era) perché è un errore diverso: qui non è che la
  // lettera manca, è che il giocatore l'ha già usata. Due note brevi che
  // scendono, morbide (sine, non square), più corte di letteraAssente.
  function letteraGiaChiamata() {
    tono(340, "sine", 0.1, 0.16);
    tono(260, "sine", 0.13, 0.14, 0.09);
  }

  function bancarotta() {
    [400, 350, 300, 200].forEach((f, i) => tono(f, "sawtooth", 0.25, 0.18, i * 0.18));
    tono(100, "sawtooth", 0.5, 0.15, 0.72);
  }

  function passa() {
    tono(440, "sine", 0.15, 0.18);
    tono(330, "sine", 0.2, 0.18, 0.1);
  }

  function jolly() {
    [880, 1109, 1319, 1568, 1760].forEach((f, i) => tono(f, "sine", 0.2, 0.15, i * 0.08));
    tono(2093, "sine", 0.4, 0.1, 0.4);
  }

  function vittoria() {
    [1047, 1319, 1568, 2093].forEach((f, i) => tono(f, "sine", 0.5, 0.2, i * 0.12));
  }

  // Punto 30 (28/09/2026, aggiunta dopo il sesto giro): la musichetta della
  // festa di fine round, che accompagna la finestra animata in gioco.js
  // (mostraFestaVittoria). E` volutamente PIU` lunga e vistosa del breve
  // "vittoria()" qui sopra (che resta com'era, non lo tocco) — un arpeggio
  // maggiore che sale e un accordo pieno a chiudere la frase, cosi` dura
  // quanto basta a coprire l'apertura della finestra. Rispetta l'interruttore
  // degli EFFETTI (il `muto` di tono(), vedi sopra), non quello della
  // musica di sottofondo: e` un effetto legato a un evento, non un loop.
  // Settimo giro, secondo compito: il sottofondo (file vero o groove di
  // riserva) si abbassa un momento durante la festa, cosi` l'arpeggio si
  // sente sopra invece di dover competere col brano intero — poi torna al
  // volume di prima. Non tocca il muto degli effetti (la festa lo rispetta
  // gia` tramite tono(), vedi sopra), ne` l'interruttore della musica.
  const DURATA_DUCK_FESTA_SEC = 1.4;

  function duckMusicaPerFesta() {
    if (!entroInRiproduzione) return;
    if (!entroInRiproduzione.groove) {
      // File vero: sfuma il volume nativo dell'<audio> (vedi nota sopra sul
      // perche` non si passa dal Web Audio per i file), giu` e poi su.
      const s = statoFileMusica.get(entroInRiproduzione.file);
      if (!s) return;
      const pieno = volumeMusicaEffettivo();
      sfumaVolume(s.audio, pieno * 0.35, 0.15, () => {
        sfumaVolume(s.audio, pieno, DURATA_DUCK_FESTA_SEC - 0.15);
      });
    } else if (nodoMusica) {
      // Groove: qui il bus e` un vero GainNode Web Audio (niente <audio> di
      // mezzo, nessun problema di tainting), si puo` sfumare come prima.
      const c = getCtx();
      const g = nodoMusica.gain;
      const pieno = volumeMusicaCursore;
      g.cancelScheduledValues(c.currentTime);
      g.setValueAtTime(pieno, c.currentTime);
      g.linearRampToValueAtTime(pieno * 0.35, c.currentTime + 0.15);
      g.linearRampToValueAtTime(pieno, c.currentTime + DURATA_DUCK_FESTA_SEC);
    }
  }

  function festaVittoria() {
    duckMusicaPerFesta();
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tono(f, "triangle", 0.22, 0.22, i * 0.11));
    [1046.5, 1318.5, 1568.0].forEach((f) => tono(f, "sine", 0.6, 0.16, 0.6));
  }

  // Punto 69, quattordicesimo giro (29/09/2026, richiesta di Chiara — "fuori
  // mandato" nella sua scheda, scelta mia): il secondo tempo dell'annuncio,
  // «Tocca a», ha un suono suo, breve e gentile — due note morbide che
  // salgono (sine, come letteraRivelata/jolly), ben diverso dal suono
  // squadrato e discendente di letteraAssente() che lo precede. Dal divano
  // il suono arriva prima dell'immagine.
  function toccaA() {
    tono(659.25, "sine", 0.16, 0.14);
    tono(880, "sine", 0.26, 0.16, 0.13);
  }

  function click() {
    tono(800, "sine", 0.06, 0.12);
  }

  function inizioSpin() {
    tono(300, "sine", 0.2, 0.15);
    tono(450, "sine", 0.2, 0.15, 0.1);
  }

  return {
    tic,
    letteraRivelata,
    letteraAssente,
    letteraGiaChiamata,
    bancarotta,
    passa,
    jolly,
    vittoria,
    toccaA,
    click,
    inizioSpin,
    festaVittoria,
    impostaVolumeEffetti,
    impostaVolumeMusica,
    leggiVolumeEffettiCursore,
    leggiVolumeMusicaCursore,
    musicaAvvia,
    musicaFerma,
    isMusicaAttiva,
    musicaProssimoRound,
    // Solo per verifica/debug (console, test): non usata dal gioco stesso.
    statoMusica: () => {
      const s = entroInRiproduzione && !entroInRiproduzione.groove
        ? statoFileMusica.get(entroInRiproduzione.file)
        : null;
      return {
        indiceMusicaFile,
        fileCorrente: indiceMusicaFile < 0 ? null : fileCorrente(),
        suonando: entroInRiproduzione,
        volumeAudioEl: s ? s.audio.volume : null,
        pausedAudioEl: s ? s.audio.paused : null,
        currentTimeAudioEl: s ? s.audio.currentTime : null,
        durationAudioEl: s ? s.audio.duration : null,
      };
    },
  };
})();
