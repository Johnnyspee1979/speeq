# GK1-intake — "Valt dit project onder GK1?"

Een lichte, read-only beslisboom die de aannemer bij een nieuw project doorloopt.
Geeft een **indicatie**, geen juridisch bindend advies — bij twijfel verwijzen we
naar gemeente of kwaliteitsborger.

## Bron

- Wkb geldt sinds 1-1-2024, nu alleen **gevolgklasse 1** (o.a. grondgebonden
  eengezinswoningen, kleine bedrijfsgebouwen). GK2/GK3 vallen er nog niet onder
  (uitbreiding hangt af van de evaluatie, uiterlijk 1-1-2027).
- Combinatie-regel (IPLO/TloKB/VNG): komen GK1 en GK2 samen en vormen de
  bouwwerken **één bouwkundige eenheid**, dan telt de **hoogste** gevolgklasse
  voor het geheel. Zijn het bouwkundig **te onderscheiden, losse gebouwen**, dan
  volgt **elk gebouw zijn eigen spoor**.
- GK1 → bouwmelding + kwaliteitsborger. Hoger → (nu nog) reguliere vergunning.

## Intake-vragen

1. **Type bouwwerk:** grondgebonden woning / klein bedrijfsgebouw / appartementen
   / winkel-plus-wonen / anders.
2. **Fase:** nieuwbouw of verbouw.
3. **Meerdere bouwwerken op één project?** Zo ja: **één bouwkundige eenheid** of
   **losse, te onderscheiden gebouwen**?

## Basisklasse per type

| Type | Basis |
|---|---|
| grondgebonden woning | GK1 |
| klein bedrijfsgebouw | GK1 |
| appartementen | HOGER (GK2+) |
| winkel-plus-wonen | GEMENGD (afhankelijk van eenheid) |
| anders | ONBEKEND |

## Beslisregel → uitkomst

- **GK1** (groen): basis GK1, en bij meerdere gebouwen ofwel één eenheid die
  GK1 blijft, ofwel losse gebouwen waarvan het GK1-deel zijn eigen spoor volgt.
- **BUITEN_GK1** (navy/grijs, waarschuwen): basis HOGER (bijv. appartementen),
  of één bouwkundige eenheid waarin een hogere klasse meedoet.
- **TWIJFEL** (oranje): GEMENGD/ONBEKEND, of een combinatie die we niet
  zelfverzekerd kunnen plaatsen → vraag het na bij gemeente/borger.

Liever een eerlijk **TWIJFEL → vraag het na** dan een zelfverzekerd verkeerd
antwoord. Nooit blokkeren; bij BUITEN_GK1/TWIJFEL waarschuwen + adviseren.

## Service

`frontend/src/services/GevolgklasseService.ts` — pure `bepaalGevolgklasse(antwoorden)`.
Tests dekken o.a. grondgebonden → GK1, appartementen → buiten, winkel+wonen →
twijfel, en de combinatie-regel (één eenheid vs losse gebouwen).
