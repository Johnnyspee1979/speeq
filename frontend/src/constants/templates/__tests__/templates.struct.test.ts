/**
 * @jest-environment node
 *
 * Struct-invariant-tests voor de RUWE WKB-templatebronnen in
 * src/constants/templates/*. Dit zijn de per-norm/per-discipline gedefinieerde
 * controlepunt-arrays die WkbTemplates.ts samenvoegt en hermapt. Het dossier-
 * en capture-pad leunt op stabiele, niet-lege velden per controlepunt.
 *
 * We borgen wat hier daadwerkelijk geldt en stabiel hoort te blijven:
 *  - elke bronlijst bevat controlepunten;
 *  - de `id` is GLOBAAL UNIEK over álle bronlijsten heen (dit is de bron-id —
 *    let op: WkbTemplates.ts hermapt naar eigen, niet-unieke index-id's; die
 *    bekende bevinding wordt elders gedocumenteerd, hier borgen we juist dat de
 *    BRON schoon is);
 *  - verplichte tekstvelden (id, inspectionPointId, component, description,
 *    builderInstruction, stopMoment) zijn niet-lege strings;
 *  - `normCodes` is een niet-lege lijst van niet-lege strings;
 *  - `requiresExif` is een boolean.
 *
 * Pure data → @jest-environment node (geen RN/lucide-import in deze bronnen).
 */

import { AFBOUW_TEMPLATES } from '../AfbouwTemplates';
import { BOUWFYSICA_TEMPLATES } from '../BouwfysicaTemplates';
import { BRANDVEILIGHEID_TEMPLATES } from '../BrandveiligheidTemplates';
import { CONSTRUCTIE_TEMPLATES } from '../ConstructieTemplates';
import { ELEKTROTECHNIEK_TEMPLATES } from '../ElektrotechniekTemplates';
import { INSTALLATIE_TEMPLATES } from '../InstallatieTemplates';
import { NEN_1006_TEMPLATES } from '../Nen1006Templates';
import { NEN_1010_TEMPLATES } from '../Nen1010Templates';
import { NEN_1078_TEMPLATES } from '../Nen1078Templates';
import { NEN_1087_TEMPLATES } from '../Nen1087Templates';
import { NEN_1264_TEMPLATES } from '../Nen1264Templates';
import { NEN_13914_TEMPLATES } from '../Nen13914Templates';
import { NEN_1814_TEMPLATES } from '../Nen1814Templates';
import { NEN_199X_TEMPLATES } from '../Nen199xTemplates';
import { NEN_2580_TEMPLATES } from '../Nen2580Templates';
import { NEN_3215_TEMPLATES } from '../Nen3215Templates';
import { NEN_3569_TEMPLATES } from '../Nen3569Templates';
import { NEN_5077_TEMPLATES } from '../Nen5077Templates';
import { NEN_6068_6069_TEMPLATES } from '../Nen6068_6069Templates';
import { NEN_9120_TEMPLATES } from '../Nen9120Templates';

type AnyTemplate = Record<string, unknown>;

const GROUPS: Record<string, readonly unknown[]> = {
  AFBOUW_TEMPLATES,
  BOUWFYSICA_TEMPLATES,
  BRANDVEILIGHEID_TEMPLATES,
  CONSTRUCTIE_TEMPLATES,
  ELEKTROTECHNIEK_TEMPLATES,
  INSTALLATIE_TEMPLATES,
  NEN_1006_TEMPLATES,
  NEN_1010_TEMPLATES,
  NEN_1078_TEMPLATES,
  NEN_1087_TEMPLATES,
  NEN_1264_TEMPLATES,
  NEN_13914_TEMPLATES,
  NEN_1814_TEMPLATES,
  NEN_199X_TEMPLATES,
  NEN_2580_TEMPLATES,
  NEN_3215_TEMPLATES,
  NEN_3569_TEMPLATES,
  NEN_5077_TEMPLATES,
  NEN_6068_6069_TEMPLATES,
  NEN_9120_TEMPLATES,
};

const REQUIRED_STRINGS = [
  'id',
  'inspectionPointId',
  'component',
  'description',
  'builderInstruction',
  'stopMoment',
] as const;

const ALL: { group: string; item: AnyTemplate }[] = Object.entries(GROUPS).flatMap(
  ([group, items]) => items.map((item) => ({ group, item: item as AnyTemplate })),
);

const ref = (e: { group: string; item: AnyTemplate }): string =>
  `${e.group}:${String(e.item.id)}`;

const isNonEmptyString = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

describe('WKB-template-bronnen (struct)', () => {
  it('importeert elke bronlijst als niet-lege array', () => {
    const empty = Object.entries(GROUPS)
      .filter(([, items]) => !Array.isArray(items) || items.length === 0)
      .map(([name]) => name);
    expect(empty).toEqual([]);
  });

  it('telt het verwachte totaal aan controlepunten', () => {
    expect(ALL.length).toBe(142);
  });

  it('heeft globaal unieke bron-id-s over alle lijsten heen', () => {
    const ids = ALL.map((e) => String(e.item.id));
    const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    expect(dups).toEqual([]);
  });

  it('heeft niet-lege verplichte tekstvelden', () => {
    const bad = ALL.filter((e) =>
      REQUIRED_STRINGS.some((f) => !isNonEmptyString(e.item[f])),
    ).map(ref);
    expect(bad).toEqual([]);
  });

  it('heeft normCodes als niet-lege lijst van niet-lege strings', () => {
    const bad = ALL.filter((e) => {
      const codes = e.item.normCodes;
      return (
        !Array.isArray(codes) ||
        codes.length === 0 ||
        codes.some((c) => !isNonEmptyString(c))
      );
    }).map(ref);
    expect(bad).toEqual([]);
  });

  it('heeft requiresExif als boolean', () => {
    const bad = ALL.filter((e) => typeof e.item.requiresExif !== 'boolean').map(ref);
    expect(bad).toEqual([]);
  });
});
