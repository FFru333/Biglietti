// Stazioni e aeroporti noti, per riconoscere partenza e arrivo nel testo dei biglietti.
// Ogni voce: nome mostrato | alias separati da "|" (confronto senza accenti e punteggiatura).
// Non serve che sia completo: è un aiuto in più rispetto alle etichette e ai luoghi già usati.

const STATIONS = `
Milano Centrale|milano c.le|milano centrale|mailand hbf|milan central
Milano Porta Garibaldi|milano p.ta garibaldi|milano porta garibaldi
Milano Rogoredo|milano rogoredo
Torino Porta Nuova|torino p.nuova|torino porta nuova|turin
Torino Porta Susa|torino p.susa|torino porta susa
Venezia Santa Lucia|venezia s.lucia|venezia santa lucia|venezia s. lucia|venedig
Venezia Mestre|venezia mestre|mestre
Verona Porta Nuova|verona p.nuova|verona porta nuova|verona p. nuova
Padova|padova|padua
Vicenza|vicenza
Treviso Centrale|treviso c.le|treviso centrale
Bologna Centrale|bologna c.le|bologna centrale|bologna centrale av|bologna
Firenze S.M.N.|firenze s.m.n.|firenze santa maria novella|firenze smn|florenz
Firenze Campo di Marte|firenze campo di marte
Roma Termini|roma termini|rom termini|rome termini
Roma Tiburtina|roma tiburtina
Napoli Centrale|napoli c.le|napoli centrale|neapel
Napoli Afragola|napoli afragola
Salerno|salerno
Bari Centrale|bari c.le|bari centrale
Lecce|lecce
Brindisi|brindisi
Taranto|taranto
Foggia|foggia
Pescara Centrale|pescara c.le|pescara centrale
Ancona|ancona
Pesaro|pesaro
Rimini|rimini
Riccione|riccione
Cesena|cesena
Forlì|forli
Faenza|faenza
Ravenna|ravenna
Imola|imola
Ferrara|ferrara
Modena|modena
Reggio Emilia AV|reggio emilia av|reggio emilia
Parma|parma
Piacenza|piacenza
Brescia|brescia
Bergamo|bergamo
Desenzano|desenzano del garda|desenzano
Peschiera del Garda|peschiera del garda
Rovereto|rovereto
Trento|trento|trient
Bolzano|bolzano|bozen
Bressanone|bressanone|brixen
Fortezza|fortezza|franzensfeste
Brennero|brennero|brenner
Udine|udine
Trieste Centrale|trieste c.le|trieste centrale|triest
Genova Piazza Principe|genova p.principe|genova piazza principe
Genova Brignole|genova brignole
La Spezia Centrale|la spezia c.le|la spezia centrale
Pisa Centrale|pisa c.le|pisa centrale
Livorno Centrale|livorno c.le|livorno centrale
Arezzo|arezzo
Siena|siena
Perugia|perugia
Orvieto|orvieto
Caserta|caserta
Benevento|benevento
Potenza Centrale|potenza c.le|potenza centrale
Cosenza|cosenza
Lamezia Terme Centrale|lamezia terme c.le|lamezia terme
Reggio Calabria Centrale|reggio calabria c.le|reggio calabria centrale
Messina Centrale|messina c.le|messina centrale
Palermo Centrale|palermo c.le|palermo centrale
Catania Centrale|catania c.le|catania centrale
Cagliari|cagliari
Sassari|sassari
Aosta|aosta
Novara|novara
Alessandria|alessandria
Asti|asti
Como San Giovanni|como s.giovanni|como san giovanni
Varese|varese
Savona|savona
Sanremo|sanremo
Ventimiglia|ventimiglia
Domodossola|domodossola
München Hbf|munchen hbf|muenchen hbf|muenchen|munchen hauptbahnhof|monaco centrale|monaco di baviera centrale|munich central|munchen
München Ost|munchen ost|muenchen ost
München-Pasing|munchen pasing|muenchen pasing
Augsburg Hbf|augsburg hbf|augsburg
Nürnberg Hbf|nurnberg hbf|nuernberg hbf|norimberga
Stuttgart Hbf|stuttgart hbf|stoccarda
Ulm Hbf|ulm hbf
Würzburg Hbf|wurzburg hbf|wuerzburg hbf
Regensburg Hbf|regensburg hbf
Frankfurt (Main) Hbf|frankfurt main hbf|frankfurt (main) hbf|frankfurt hbf|francoforte
Frankfurt Flughafen|frankfurt main flughafen fernbf|frankfurt flughafen
Mannheim Hbf|mannheim hbf
Karlsruhe Hbf|karlsruhe hbf
Freiburg Hbf|freiburg breisgau hbf|freiburg hbf
Köln Hbf|koln hbf|koeln hbf|colonia
Bonn Hbf|bonn hbf
Düsseldorf Hbf|dusseldorf hbf|duesseldorf hbf
Dortmund Hbf|dortmund hbf
Essen Hbf|essen hbf
Hannover Hbf|hannover hbf
Bremen Hbf|bremen hbf
Hamburg Hbf|hamburg hbf|amburgo
Berlin Hbf|berlin hbf|berlino centrale|berlin hauptbahnhof
Berlin Südkreuz|berlin sudkreuz|berlin suedkreuz
Leipzig Hbf|leipzig hbf|lipsia
Dresden Hbf|dresden hbf|dresda
Rosenheim|rosenheim
Kufstein|kufstein
Garmisch-Partenkirchen|garmisch partenkirchen
Lindau-Reutin|lindau reutin|lindau
Innsbruck Hbf|innsbruck hbf|innsbruck
Salzburg Hbf|salzburg hbf|salisburgo
Wien Hbf|wien hbf|wien|vienna centrale|wien hauptbahnhof|vienna
Linz Hbf|linz hbf
Graz Hbf|graz hbf
Villach Hbf|villach hbf
Klagenfurt Hbf|klagenfurt hbf
Bregenz|bregenz
Zürich HB|zurich hb|zuerich hb|zurigo
Basel SBB|basel sbb|basilea
Bern|bern|berna
Luzern|luzern|lucerna
Lugano|lugano
Genève|geneve|ginevra|genf
Paris Gare de Lyon|paris gare de lyon|paris lyon
Paris Nord|paris nord|paris gare du nord
Paris Est|paris est|paris gare de l est
Lyon Part-Dieu|lyon part dieu
Marseille St-Charles|marseille st charles|marseille saint charles
Nice Ville|nice ville|nizza
Bruxelles-Midi|bruxelles midi|brussel zuid
Amsterdam Centraal|amsterdam centraal
Praha hl.n.|praha hl n|praga
Budapest-Keleti|budapest keleti
Ljubljana|ljubljana|lubiana
Zagreb Glavni kolodvor|zagreb gl kol|zagabria
`;

const AIRPORTS = `
MUC München|FRA Frankfurt|BER Berlin|HAM Hamburg|DUS Düsseldorf|CGN Köln|STR Stuttgart|NUE Nürnberg|HAJ Hannover|LEJ Leipzig|DRS Dresden|BRE Bremen|FMM Memmingen
VIE Wien|SZG Salzburg|INN Innsbruck|GRZ Graz|ZRH Zürich|GVA Genève|BSL Basel
MXP Milano Malpensa|LIN Milano Linate|BGY Bergamo|BLQ Bologna|VCE Venezia|TSF Treviso|VRN Verona|TRN Torino|GOA Genova|PSA Pisa|FLR Firenze|FCO Roma Fiumicino|CIA Roma Ciampino|NAP Napoli|BRI Bari|BDS Brindisi|CTA Catania|PMO Palermo|CAG Cagliari|OLB Olbia|AHO Alghero|AOI Ancona|PSR Pescara|SUF Lamezia|REG Reggio Calabria|TRS Trieste|RMI Rimini|BZO Bolzano|CUF Cuneo|TPS Trapani|CIY Comiso
CDG Paris|ORY Paris Orly|NCE Nice|MRS Marseille|LYS Lyon|TLS Toulouse|BOD Bordeaux|NTE Nantes
LHR London|LGW London Gatwick|STN London Stansted|LTN London Luton|LCY London City|MAN Manchester|EDI Edinburgh|GLA Glasgow|BHX Birmingham|DUB Dublin
AMS Amsterdam|BRU Bruxelles|CRL Charleroi|LUX Luxembourg|CPH København|ARN Stockholm|OSL Oslo|HEL Helsinki|KEF Reykjavík
MAD Madrid|BCN Barcelona|PMI Palma|IBZ Ibiza|AGP Málaga|ALC Alicante|VLC Valencia|SVQ Sevilla|TFS Tenerife|LPA Gran Canaria|LIS Lisboa|OPO Porto|FAO Faro
ATH Atene|HER Heraklion|JTR Santorini|JMK Mykonos|RHO Rodi|CFU Corfù|SKG Salonicco|LCA Larnaca|MLA Malta
PRG Praha|WAW Warszawa|KRK Kraków|BUD Budapest|OTP Bucureşti|SOF Sofia|ZAG Zagreb|SPU Split|DBV Dubrovnik|LJU Ljubljana|TIA Tirana|BEG Beograd|IST Istanbul|SAW Istanbul Sabiha|AYT Antalya
JFK New York|EWR Newark|LGA New York LaGuardia|BOS Boston|ORD Chicago|LAX Los Angeles|SFO San Francisco|SEA Seattle|MIA Miami|MCO Orlando|ATL Atlanta|DFW Dallas|IAH Houston|DEN Denver|LAS Las Vegas|PHX Phoenix|IAD Washington|YYZ Toronto|YUL Montréal|YVR Vancouver
MEX Città del Messico|CUN Cancún|GDL Guadalajara|MTY Monterrey|OAX Oaxaca|PVR Puerto Vallarta|SJD Los Cabos|MID Mérida|HAV L'Avana|PUJ Punta Cana|SJO San José|PTY Panamá|BOG Bogotá|LIM Lima|GRU São Paulo|GIG Rio de Janeiro|EZE Buenos Aires|SCL Santiago
DXB Dubai|AUH Abu Dhabi|DOH Doha|TLV Tel Aviv|AMM Amman|CAI Il Cairo|CMN Casablanca|RAK Marrakech|TUN Tunisi|JNB Johannesburg|CPT Città del Capo|NBO Nairobi|ADD Addis Abeba
BKK Bangkok|HKT Phuket|SIN Singapore|KUL Kuala Lumpur|CGK Giacarta|DPS Bali|HKG Hong Kong|TPE Taipei|NRT Tokyo Narita|HND Tokyo Haneda|KIX Osaka|ICN Seoul|PEK Pechino|PKX Pechino Daxing|PVG Shanghai|DEL Delhi|BOM Mumbai|MLE Malé|CMB Colombo|SYD Sydney|MEL Melbourne|AKL Auckland
`;

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();

interface Station { name: string; aliases: string[] }
let stations: Station[] | null = null;
function stationList() {
  stations ??= STATIONS.trim().split('\n').map((l) => {
    const [name, ...al] = l.split('|');
    return { name, aliases: [...new Set(al.map(norm).filter(Boolean))].sort((a, b) => b.length - a.length) };
  });
  return stations;
}

let airports: Map<string, string> | null = null;
export function airportList() {
  if (!airports) {
    airports = new Map();
    for (const e of AIRPORTS.trim().split(/\n|\|/)) {
      const [code, ...city] = e.trim().split(' ');
      if (code) airports.set(code, city.join(' '));
    }
  }
  return airports;
}

export interface Hit { name: string; idx: number }

/** Stazioni nominate nel testo, nell'ordine in cui compaiono (una volta ciascuna). */
export function findStations(text: string): Hit[] {
  // Indici sul testo normalizzato: allineati abbastanza per ordinare le occorrenze.
  const t = ` ${norm(text)} `;
  const hits: Hit[] = [];
  for (const st of stationList()) {
    let best = -1;
    for (const a of st.aliases) {
      const i = t.indexOf(` ${a} `);
      if (i >= 0 && (best < 0 || i < best)) best = i;
    }
    if (best >= 0) hits.push({ name: st.name, idx: best });
  }
  hits.sort((a, b) => a.idx - b.idx);
  // Se una stazione "lunga" contiene una "corta" alla stessa posizione (Bologna / Bologna Centrale), tieni la prima trovata.
  return hits.filter((h, i) => !hits.slice(0, i).some((p) => Math.abs(p.idx - h.idx) < 3));
}

/** Codici IATA noti, come parole intere maiuscole, nell'ordine in cui compaiono. */
export function findAirports(text: string): Hit[] {
  const list = airportList();
  const hits: Hit[] = [];
  const re = /(?<![A-Za-z0-9])([A-Z]{3})(?![A-Za-z0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (list.has(m[1]) && !hits.some((h) => h.name === m![1])) hits.push({ name: m[1], idx: m.index });
  }
  return hits;
}

/** Nomi di stazione generici: "<Città> Hbf / Centrale / C.le / HB / Termini / Centraal". */
export function findGenericStations(text: string): Hit[] {
  const re = /(?<![\p{L}])([A-ZÀ-ÝÄÖÜ][\p{L}'’.-]+(?:[ -](?:\([\p{L} ]+\)|[A-ZÀ-ÝÄÖÜ][\p{L}'’.-]+|am|an|der|di|del|de|im)){0,3})\s+(Hbf|Hauptbahnhof|HB|Centrale|C\.le|Termini|Centraal|Central|Gare)\b/gu;
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const name = `${m[1]} ${m[2]}`;
    if (!hits.some((h) => h.name === name)) hits.push({ name, idx: m.index });
  }
  return hits;
}

/** Nome completo se il testo è esattamente un alias noto (es. "MUENCHEN" → "München Hbf"). */
export function stationByAlias(v: string): string | undefined {
  const n = norm(v);
  return stationList().find((st) => st.aliases.includes(n))?.name;
}
