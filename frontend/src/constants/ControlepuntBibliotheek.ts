/**
 * Controlepunt-bibliotheek — gestandaardiseerde namen voor bevindingen/gebreken.
 *
 * Probleem dat dit oplost: vakmannen typen nu vrije tekst in het veldnotitie-
 * veld ("scheurtje", "barst", "haarscheur" — drie woorden, één gebrek). In het
 * dossier en de PDF levert dat een rommelige, onfilterbare bende op. Deze
 * bibliotheek geeft elk gebrek **één vaste naam** + categorie, met synoniemen
 * zodat de vakman blijft typen wat hij gewend is en SpeeQ er de gestandaardiseerde
 * naam van maakt.
 *
 * Bewust offline + lokaal gebundeld: geen AI, geen netwerk-afhankelijkheid. De
 * man op de bouw heeft vieze handen en soms geen bereik.
 *
 * Categorieën spiegelen de bestaande `categoryId`-taxonomie uit ContextForm.
 */

export type ControlepuntCategorie =
  | 'BOUW'
  | 'BOUWFYSICA'
  | 'INSTALLATIE'
  | 'ELEKTRA'
  | 'BRANDVEILIGHEID'
  | 'AFBOUW_SCHILDER';

export interface Controlepunt {
  /** Stabiele slug — verandert nooit, ook niet als de naam wordt bijgeschaafd. */
  id: string;
  /** Dé gestandaardiseerde naam zoals getoond in dossier + PDF. */
  naam: string;
  categorie: ControlepuntCategorie;
  /** Wat een vakman in de praktijk intypt; matcht terug naar `naam`. */
  synoniemen: string[];
  /** Extra zoektermen (gereedschap, context) — verbreedt de typeahead. */
  trefwoorden: string[];
  /** Korte uitleg voor de typeahead-regel. */
  omschrijving: string;
}

export const CONTROLEPUNT_BIBLIOTHEEK: Controlepunt[] = [
  // ── BOUW / constructie ────────────────────────────────────────────────────
  {
    id: 'scheurvorming',
    naam: 'Scheurvorming',
    categorie: 'BOUW',
    synoniemen: ['scheur', 'scheurtje', 'barst', 'haarscheur', 'craquele', 'breuk', 'gescheurd'],
    trefwoorden: ['muur', 'wand', 'beton', 'metselwerk', 'voeg'],
    omschrijving: 'Zichtbare scheur in beton, metselwerk of pleisterwerk.',
  },
  {
    id: 'onvoldoende-betondekking',
    naam: 'Onvoldoende betondekking wapening',
    categorie: 'BOUW',
    synoniemen: ['betondekking', 'wapening bloot', 'wapening zichtbaar', 'roest wapening', 'dekking te dun'],
    trefwoorden: ['beton', 'wapening', 'staaf', 'corrosie'],
    omschrijving: 'Wapeningsstaal ligt te dicht aan het oppervlak of steekt uit.',
  },
  {
    id: 'verzakking',
    naam: 'Verzakking / zetting',
    categorie: 'BOUW',
    synoniemen: ['zetting', 'verzakt', 'verzakking', 'fundering zakt', 'wegzakken', 'gezakt'],
    trefwoorden: ['fundering', 'vloer', 'maaiveld', 'ongelijk'],
    omschrijving: 'Ongelijke zetting van fundering of vloer.',
  },
  {
    id: 'maatafwijking',
    naam: 'Maatafwijking',
    categorie: 'BOUW',
    synoniemen: ['maatfout', 'te kort', 'te lang', 'scheef', 'niet haaks', 'uit het lood'],
    trefwoorden: ['maat', 'maatvoering', 'waterpas', 'lood'],
    omschrijving: 'Afwijking ten opzichte van de maatvoering of het lood.',
  },

  // ── BOUWFYSICA ────────────────────────────────────────────────────────────
  {
    id: 'koudebrug',
    naam: 'Koudebrug',
    categorie: 'BOUWFYSICA',
    synoniemen: ['koude brug', 'koudebrug', 'thermische brug', 'koudelek'],
    trefwoorden: ['isolatie', 'condens', 'aansluiting', 'detail'],
    omschrijving: 'Onderbreking in de isolatieschil waardoor warmte weglekt.',
  },
  {
    id: 'isolatie-ontbreekt',
    naam: 'Ontbrekende of onvoldoende isolatie',
    categorie: 'BOUWFYSICA',
    synoniemen: ['isolatie ontbreekt', 'geen isolatie', 'isolatie te dun', 'kier isolatie', 'isolatieplaat los'],
    trefwoorden: ['isolatie', 'spouw', 'plaat', 'rc-waarde'],
    omschrijving: 'Isolatie ontbreekt, is te dun of sluit niet aan.',
  },
  {
    id: 'luchtdichtheid-lek',
    naam: 'Luchtlek / kierdichting onvolledig',
    categorie: 'BOUWFYSICA',
    synoniemen: ['kier', 'tocht', 'luchtlek', 'naad open', 'kierdichting', 'tochtlek', 'lucht lekt'],
    trefwoorden: ['luchtdicht', 'tape', 'naad', 'aansluiting'],
    omschrijving: 'Lucht lekt door een naad of aansluiting die dicht hoort te zijn.',
  },
  {
    id: 'condensvorming',
    naam: 'Condens / vochtophoping',
    categorie: 'BOUWFYSICA',
    synoniemen: ['condens', 'beslagen', 'vocht', 'vochtophoping', 'nat oppervlak', 'aanslag'],
    trefwoorden: ['schimmel', 'glas', 'koud', 'oppervlak'],
    omschrijving: 'Condensvorming of vochtophoping op een oppervlak.',
  },

  // ── INSTALLATIE ───────────────────────────────────────────────────────────
  {
    id: 'onvoldoende-afschot',
    naam: 'Onvoldoende afschot riolering',
    categorie: 'INSTALLATIE',
    synoniemen: ['afschot', 'afwatering', 'riool ligt verkeerd', 'verhang', 'te weinig verval', 'staand water'],
    trefwoorden: ['riolering', 'leiding', 'waterpas', 'afvoer'],
    omschrijving: 'Riolering heeft te weinig verval om goed af te wateren.',
  },
  {
    id: 'leiding-lekkage',
    naam: 'Lekkage leiding / koppeling',
    categorie: 'INSTALLATIE',
    synoniemen: ['leidinglek', 'koppeling lek', 'druppelt', 'lekt', 'waterlek', 'natte koppeling'],
    trefwoorden: ['leiding', 'water', 'fitting', 'verbinding'],
    omschrijving: 'Water- of gasleiding lekt bij een verbinding of koppeling.',
  },
  {
    id: 'mantelbuis-ontbreekt',
    naam: 'Ontbrekende mantelbuis bij doorvoer',
    categorie: 'INSTALLATIE',
    synoniemen: ['mantelbuis', 'beschermbuis ontbreekt', 'geen mantelbuis', 'doorvoer onbeschermd'],
    trefwoorden: ['doorvoer', 'leiding', 'wand', 'vloer'],
    omschrijving: 'Leidingdoorvoer mist de vereiste beschermende mantelbuis.',
  },
  {
    id: 'waterslot-te-laag',
    naam: 'Waterslot sifon te laag',
    categorie: 'INSTALLATIE',
    synoniemen: ['waterslot', 'sifon te laag', 'stankafsluiter', 'sifon ondiep'],
    trefwoorden: ['sifon', 'riolering', 'stank', 'afvoer'],
    omschrijving: 'Het waterslot van de sifon is te ondiep tegen stankoverlast.',
  },

  // ── ELEKTRA ───────────────────────────────────────────────────────────────
  {
    id: 'aardlek-ontbreekt',
    naam: 'Ontbrekende aardlekschakelaar',
    categorie: 'ELEKTRA',
    synoniemen: ['aardlek', 'aardlekschakelaar ontbreekt', 'geen rcd', 'differentieel ontbreekt', 'geen aardlek'],
    trefwoorden: ['rcd', 'groepenkast', 'meterkast', 'beveiliging'],
    omschrijving: 'Vereiste aardlekschakelaar (RCD) ontbreekt in de groep.',
  },
  {
    id: 'onvoldoende-aarding',
    naam: 'Onvoldoende aarding / vereffening',
    categorie: 'ELEKTRA',
    synoniemen: ['aarding', 'vereffening', 'massa ontbreekt', 'niet geaard', 'aarddraad los'],
    trefwoorden: ['aarde', 'vereffening', 'rail', 'leiding'],
    omschrijving: 'Aarding of potentiaalvereffening ontbreekt of is onderbroken.',
  },
  {
    id: 'kleurcodering-onjuist',
    naam: 'Onjuiste kleurcodering bedrading',
    categorie: 'ELEKTRA',
    synoniemen: ['draadkleur', 'bedrading kleur', 'verkeerde kleur', 'kleurcodering fout', 'fase op nul'],
    trefwoorden: ['draad', 'fase', 'nul', 'bedrading'],
    omschrijving: 'Bedrading volgt niet de voorgeschreven kleurcodering.',
  },

  // ── BRANDVEILIGHEID ───────────────────────────────────────────────────────
  {
    id: 'brandwerende-doorvoer-open',
    naam: 'Brandwerende doorvoer niet afgedicht',
    categorie: 'BRANDVEILIGHEID',
    synoniemen: ['doorvoer open', 'brandmanchet ontbreekt', 'manchet', 'kierdichting brand', 'doorvoer niet dicht'],
    trefwoorden: ['doorvoer', 'manchet', 'brandwerend', 'afdichting'],
    omschrijving: 'Leidingdoorvoer door brandscheiding is niet brandwerend dichtgezet.',
  },
  {
    id: 'wbdbo-onderbroken',
    naam: 'WBDBO-scheiding onderbroken',
    categorie: 'BRANDVEILIGHEID',
    synoniemen: ['wbdbo', 'compartiment lek', 'scheidingswand brand', 'brandscheiding open', 'gat in brandwand'],
    trefwoorden: ['compartiment', 'brandwand', 'scheiding', 'wbdbo'],
    omschrijving: 'De brandwerende scheiding tussen compartimenten is onderbroken.',
  },
  {
    id: 'branddeur-label-ontbreekt',
    naam: 'Ontbrekend brandwerend label deur',
    categorie: 'BRANDVEILIGHEID',
    synoniemen: ['branddeur', 'deurlabel ontbreekt', 'geen label', 'brandlabel weg', 'sticker brandwerend'],
    trefwoorden: ['deur', 'label', 'sticker', 'brandwerend'],
    omschrijving: 'Brandwerende deur mist het verplichte typeplaatje/label.',
  },

  // ── AFBOUW / SCHILDER ─────────────────────────────────────────────────────
  {
    id: 'stucwerk-onvlak',
    naam: 'Stucwerk onvlak',
    categorie: 'AFBOUW_SCHILDER',
    synoniemen: ['stuc onvlak', 'vlakheid', 'bobbel', 'hol', 'golvend', 'stuc bol', 'oneffen stuc'],
    trefwoorden: ['stuc', 'pleister', 'wand', 'strijklicht'],
    omschrijving: 'Stucwerk vertoont onvlakheid, bobbels of holtes.',
  },
  {
    id: 'kitnaad-gebrekkig',
    naam: 'Gebrekkige kitnaad',
    categorie: 'AFBOUW_SCHILDER',
    synoniemen: ['kit', 'voeg', 'kitwerk', 'naad open', 'kit los', 'kitnaad scheurt'],
    trefwoorden: ['kit', 'voeg', 'sanitair', 'aansluiting'],
    omschrijving: 'Kitnaad is onderbroken, scheurt of laat los.',
  },
  {
    id: 'veiligheidsglas-ontbreekt',
    naam: 'Veiligheidsglas ontbreekt in risicozone',
    categorie: 'AFBOUW_SCHILDER',
    synoniemen: ['veiligheidsglas', 'glasstempel', 'gehard glas ontbreekt', 'geen gelaagd glas', 'glas niet gemerkt'],
    trefwoorden: ['glas', 'stempel', 'risicozone', 'beglazing'],
    omschrijving: 'In een risicozone ontbreekt gehard/gelaagd veiligheidsglas of het merkteken.',
  },
  {
    id: 'verfgebrek',
    naam: 'Verfgebrek',
    categorie: 'AFBOUW_SCHILDER',
    synoniemen: ['verf', 'druiper', 'kraters', 'hechting verf', 'verf bladdert', 'dekt niet', 'verfneus'],
    trefwoorden: ['verf', 'laklaag', 'afwerking', 'hechting'],
    omschrijving: 'Verflaag vertoont druipers, kraters, slechte dekking of hechting.',
  },
];
