# Biglietti

Portafoglio personale di biglietti di viaggio. È una PWA che si installa sull'iPhone dalla schermata Home. Funziona offline, non ha account né backend: i dati restano nel dispositivo (IndexedDB).

Stack: Vite, Preact, TypeScript, vite-plugin-pwa (Workbox), idb, pdfjs-dist (build legacy, worker incluso nel bundle). Il font è Inter Tight variable, self-hosted. A runtime non parte nessuna richiesta di rete.

## Sviluppo

```bash
npm install
npm run dev        # server di sviluppo
npm run build      # type-check + build in dist/
npm run preview    # serve dist/ (service worker attivo: per testare l'offline)
npm run icons      # rigenera le icone in public/icons (non serve in CI)
```

`predev` e `prebuild` copiano in `public/pdfjs/` i font standard e i decoder wasm di pdf.js. In questo modo anche i PDF che li richiedono vengono resi senza rete. La cartella è in `.gitignore`.

## Deploy su GitHub Pages

1. Crea un repository su GitHub (per esempio `biglietti`) e fai push di questa cartella sul branch `main`.
2. Nel repository apri **Settings → Pages → Build and deployment → Source** e scegli **GitHub Actions**.
3. A ogni push su `main`, il workflow `.github/workflows/deploy.yml` fa la build con `BASE_PATH=/<nome-repo>/` e la pubblica.
   L'indirizzo sarà `https://<utente>.github.io/<nome-repo>/`.

Nel manifest `start_url`, `scope` e `id` valgono `./`, cioè sono relativi al manifest. Restano quindi coerenti con qualsiasi base path. Il sito pubblico contiene solo l'app: nessun dato personale.

## Installazione su iPhone

1. Apri l'indirizzo in **Safari** (deve essere Safari).
2. Tocca **Condividi → Aggiungi alla schermata Home → Aggiungi**.
3. Apri l'app dall'icona almeno una volta con la rete attiva. Il service worker mette in cache tutto, e da lì in poi funziona anche in modalità aereo.

Nota: su iOS i dati di una PWA installata sono separati da quelli di Safari. I biglietti aggiunti in Safari non compaiono nell'app installata, e viceversa. Usa sempre l'app dalla Home.

## Backup

**Impostazioni e backup** (link in fondo alla home):

- **Esporta** crea un unico file `biglietti-backup-AAAA-MM-GG.json` con metadati e allegati in base64. Su iPhone si apre il foglio di condivisione: scegli **Salva su File**, per esempio in iCloud Drive.
- **Importa** legge quel file e aggiunge i biglietti. Quelli con lo stesso id vengono sovrascritti, gli altri restano.
- La data dell'ultimo export compare in alto.

Non c'è sync. iOS può cancellare i dati di siti poco usati: l'app richiede `navigator.storage.persist()` e lo stato è visibile in Impostazioni, ma un backup ogni tanto resta la vera garanzia.

## Dati demo

In Impostazioni, **Carica demo** aggiunge 7 biglietti finti (con posti e un concerto): treni München→Bologna (già passato), Bologna→Cesena e ritorno (viaggio "Natale"); voli MUC→FRA→MEX con scalo e ritorno MEX→MUC (viaggio "Messico"). Le date sono relative a oggi. **Rimuovi demo** li cancella con un tap, e i demo non finiscono mai nel backup.

## Scelte prese (dove la richiesta lasciava spazio)

- **Nome e icona.** Il nome resta "Biglietti". L'icona è una freccia → in inchiostro su carta, la stessa freccia di "DA → A" nelle card. Niente monogramma: la freccia è il segno più riconoscibile dell'app. È disegnata in SVG perché il sottoinsieme latin del font non contiene U+2192.
- **Accesso alle Impostazioni.** L'header ha solo titolo e "+", come richiesto, quindi le Impostazioni sono un link discreto in fondo alla home.
- **"Prossimo" non si ripete** nella sua sezione, per evitare duplicati sulla stessa schermata.
- **Quando un biglietto diventa "passato".** All'orario di arrivo se c'è, altrimenti 3 ore dopo la partenza. Così un treno in corso resta tra i futuri.
- **Fuso orario.** Gli orari sono salvati "come stampati" (`YYYY-MM-DDTHH:mm`, senza fuso). Countdown e ordinamento li interpretano nel fuso del telefono. Un volo per il Messico mostra quindi l'orario locale corretto, ma il countdown può sbagliare di qualche ora quando i fusi sono diversi. È una scelta voluta, per non dover gestire i fusi.
- **Arrivo il giorno dopo.** Viene indicato con un piccolo "+1" accanto all'orario.
- **Il biglietto vero.** All'import si renderizzano tutte le pagine del PDF (fino a 8, circa 2000 px, PNG) e la vista biglietto le mostra una sotto l'altra, ognuna zoomabile. La prima pagina è ritagliata sui margini bianchi, così il codice occupa più schermo; le altre solo sopra e sotto. Le pagine bianche vengono saltate. I biglietti salvati con versioni precedenti vengono completati in automatico alla prima apertura.
- **Anteprime.** È la vista iniziale della home; l'icona accanto al "+" passa a "Elenco" (sezioni per tipo, con "Prossimo"). Ogni biglietto è disegnato come un tagliando: in alto lo stub arancione con la data (g/m/aaaa) in nero, una perforazione con fori e tacche laterali, sotto la parte bianca con tratta, giorno e orari (evidenziati in arancione), posto, tipo/viaggio e countdown. Niente anteprima del PDF: tocca il tagliando per aprire il biglietto vero. Il tagliando ha colori propri, uguali in chiaro e in scuro.
- **Posto.** Campo libero ("Carrozza 254 · Posto 46", "Posto 42K", "Settore B · Fila 12 · Posto 7"), letto dal PDF in italiano, tedesco, inglese, francese e spagnolo (Carrozza/Wagen/Wg., Posto/Platz/Pl./Sitzplatz/Seat, Settore/Block, Fila/Reihe/Row) e sempre riscritto con etichette italiane. Compare sulle card, in griglia e in alto nella vista biglietto. Il numero di treno o volo (ECE 85, LH 498) finisce nelle note.
- **Eventi.** Tipo "Evento" per concerti, teatro, partite, musei: titolo e luogo invece di "Da → A", orari "Inizio/Fine". Il prefill riconosce l'evento e il luogo (arena, teatro, stadio…) e, se c'è, preferisce l'orario d'inizio all'apertura porte.
- **HEIC.** Se il browser lo sa decodificare, viene convertito in PNG per l'anteprima; l'originale resta comunque salvato. Da Foto, iOS di solito consegna già un JPEG.
- **"File originale".** Nell'app installata su iOS apre il foglio di condivisione, che offre anteprima, "Salva su File" e "Apri in…": aprire URL `blob:` in modalità standalone su iOS è inaffidabile. Nel browser apre una nuova scheda.
- **Prefill.** Il testo del PDF viene ricostruito riga per riga dalle posizioni dei frammenti (pdf.js li restituisce sparsi), così le tabelle restano allineate. Per partenza e arrivo, in ordine: intestazioni di colonna ("Stazione di partenza | Stazione di arrivo", "Von | Nach", "From | To", "Abfahrt | Ankunft"…) con il valore sotto o a destra; righe orario tipo DB ("München Hbf … ab 07:28"); "Da: X / A: Y"; "von X nach Y"; righe "X → Y"; codici IATA noti nell'ordine del testo; un elenco di stazioni italiane ed europee (`src/places.ts`), i nomi "… Hbf / Centrale / Termini" e i luoghi già usati. Orari e posto si leggono anche in colonna ("Departure" → 10:15, "Carrozza | Posti" → 5 | 12A). Si compilano solo i campi non ancora toccati, e se non trova nulla tace. Basta la data per salvare: senza tratta il titolo è il nome del file.
- **Zoom.** Pinch per ingrandire (fino a 6×), trascinamento quando è ingrandito, doppio tap per zoomare sul punto o tornare al fit. A zoom 1 lo swipe orizzontale passa alla tratta precedente o successiva dello stesso viaggio. Ci sono anche le frecce "‹ 2 / 3 ›" in alto.
- **Eliminazione.** Conferma in linea ("Elimina" → "Elimina davvero"), senza dialoghi di sistema.
- **Accento.** Arancione: `#FF6A1A` per le superfici (stub dei tagliandi, con testo nero) e `#C2410C` per il testo su chiaro (contrasto ≥ 4.5), `#FF7A33` in dark. Usato per tagliandi, "Prossimo", orari evidenziati e countdown.

## Verifiche fatte

Viewport iPhone 390×844, chiaro e scuro:

- home con demo, filtri per viaggio, sezione "Passati";
- vista biglietto: zoom con pinch e doppio tap, swipe tra le tratte (eventi touch simulati);
- aggiunta di un PDF con prefill e render;
- modifica ed eliminazione;
- backup esporta → elimina → importa;
- offline: server spento, l'app si carica, il font c'è, il PDF viene letto e reso dalla cache.

Lighthouse 11 (l'ultima versione con la categoria PWA), profilo mobile: PWA 100, Accessibilità 100, Best Practices 100, Performance 98.

Non ancora provato su un iPhone fisico: pinch e swipe reali, wake lock, foglio di condivisione, selettore Foto/HEIC.
