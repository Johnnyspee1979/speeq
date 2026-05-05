import {
  NEN_NORM_DATABASE,
  findNenTaskContextByInspectionPointId,
  toNenCaptureTask,
} from '../../constants/NenStandards';
import { wkbTaskTemplates } from '../../data/WkbTemplates';
import { searchNenNorm } from '../NenSearchService';

describe('NenSearchService', () => {
  it('returns the full norm catalog when the query is empty', () => {
    expect(searchNenNorm('')).toHaveLength(NEN_NORM_DATABASE.length);
  });

  it('finds smoke-related standards for a query like rook', () => {
    const results = searchNenNorm('rook');

    expect(results.some((norm) => norm.code === 'NEN 6075')).toBe(true);
  });

  it('finds compartmentation standards for a query like wbdbo', () => {
    const results = searchNenNorm('wbdbo');

    expect(results.some((norm) => norm.code === 'NEN 6068')).toBe(true);
  });

  it('finds fire-resistance standards for a query like branddeur', () => {
    const results = searchNenNorm('branddeur');

    expect(results.some((norm) => norm.code === 'NEN 6069')).toBe(true);
  });

  it('tolerates small typos for practical field searches', () => {
    const results = searchNenNorm('meterkas');

    expect(results.some((norm) => norm.code === 'NEN 1010')).toBe(true);
  });

  it('finds the right standard for riolering evidence', () => {
    const results = searchNenNorm('riolering');

    expect(results.some((norm) => norm.code === 'NEN 3215')).toBe(true);
  });

  it('finds floor area rules for a query like gebruiksoppervlakte', () => {
    const results = searchNenNorm('gebruiksoppervlakte');

    expect(results.some((norm) => norm.code === 'NEN 2580')).toBe(true);
  });

  it('finds the concrete code for betonbon evidence on site', () => {
    const results = searchNenNorm('betonbon');

    expect(results.some((norm) => norm.code === 'NEN-EN 1992-1-1')).toBe(true);
  });

  it('finds the masonry code for a latei detail', () => {
    const results = searchNenNorm('latei');

    expect(results.some((norm) => norm.code === 'NEN-EN 1996')).toBe(true);
  });

  it('maps a constructie inspection point back to the smart template context', () => {
    const context = findNenTaskContextByInspectionPointId('latei-oplegging-001');

    expect(context?.discipline.id).toBe('constructie_fundering');
    expect(context?.task.id).toBe('CON-1996-LATEI');
  });

  it('finds accessibility rules for a toilet-related field search', () => {
    const results = searchNenNorm('toilet');

    expect(results.some((norm) => norm.code === 'NEN 9120')).toBe(true);
  });

  it('finds accessibility rules for a query like doucheruimte', () => {
    const results = searchNenNorm('doucheruimte');

    expect(results.some((norm) => norm.code === 'NEN 9120')).toBe(true);
  });

  it('finds ventilation standards for anemometer-related searches', () => {
    const results = searchNenNorm('anemometer');

    expect(results.some((norm) => norm.code === 'NEN 1087')).toBe(true);
  });

  it('finds renovation ventilation standards for a query like doorstroom', () => {
    const results = searchNenNorm('doorstroom');

    expect(results.some((norm) => norm.code === 'NEN 8087')).toBe(true);
  });

  it('finds acoustic standards for a query like warmtepomp', () => {
    const results = searchNenNorm('warmtepomp');

    expect(results.some((norm) => norm.code === 'NEN 5077')).toBe(true);
  });

  it('finds electrical installation rules for a query like vereffening', () => {
    const results = searchNenNorm('vereffening');

    expect(results.some((norm) => norm.code === 'NEN 1010')).toBe(true);
  });

  it('finds PV-related installation rules for a query like omvormer', () => {
    const results = searchNenNorm('omvormer');

    expect(results.some((norm) => norm.code === 'NEN 1010')).toBe(true);
  });

  it('finds RCD-related installation rules for a query like aardlekschakelaar', () => {
    const results = searchNenNorm('aardlekschakelaar');

    expect(results.some((norm) => norm.code === 'NEN 1010')).toBe(true);
  });

  it('finds gas installation rules for a query like kruipruimte', () => {
    const results = searchNenNorm('kruipruimte');

    expect(results.some((norm) => norm.code === 'NEN 1078')).toBe(true);
  });

  it('finds gas installation rules for a query like gaslek', () => {
    const results = searchNenNorm('gaslek');

    expect(results.some((norm) => norm.code === 'NEN 1078')).toBe(true);
  });

  it('finds stucwerk standards for strijklicht-related disputes', () => {
    const results = searchNenNorm('strijklicht');

    expect(results.some((norm) => norm.code === 'NEN-EN 13914-2')).toBe(true);
  });

  it('finds safety glazing standards for a query like veiligheidsglas', () => {
    const results = searchNenNorm('veiligheidsglas');

    expect(results.some((norm) => norm.code === 'NEN 3569')).toBe(true);
  });

  it('finds accessibility standards for a rolstoeltoilet query', () => {
    const results = searchNenNorm('rolstoeltoilet');

    expect(results.some((norm) => norm.code === 'NEN 9120')).toBe(true);
  });

  it('finds accessibility standards for a query like drempel', () => {
    const results = searchNenNorm('drempel');

    expect(results.some((norm) => norm.code === 'NEN 9120')).toBe(true);
  });

  it('finds accessibility standards for a query like steunbeugel', () => {
    const results = searchNenNorm('steunbeugel');

    expect(results.some((norm) => norm.code === 'NEN 1814')).toBe(true);
  });

  it('finds support bar anchoring rules for a query like achterhout', () => {
    const results = searchNenNorm('achterhout');

    expect(results.some((norm) => norm.code === 'NEN 1814')).toBe(true);
  });

  it('finds accessibility standards for a query like rollator', () => {
    const results = searchNenNorm('rollator');

    expect(results.some((norm) => norm.code === 'NEN 9120')).toBe(true);
  });

  it('finds accessibility standards for a query like douchezitje', () => {
    const results = searchNenNorm('douchezitje');

    expect(results.some((norm) => norm.code === 'NEN 9120')).toBe(true);
  });

  it('finds accessibility standards for a query like wasbak', () => {
    const results = searchNenNorm('wasbak');

    expect(results.some((norm) => norm.code === 'NEN 9120')).toBe(true);
  });

  it('maps the drinkwater persproef template to a timer-aware capture task', () => {
    const context = findNenTaskContextByInspectionPointId('nen1006-persproef-eind-001');

    expect(context).not.toBeNull();

    const captureTask = toNenCaptureTask(context!.discipline, context!.task);

    expect(captureTask.requiresTimer).toBe(true);
    expect(captureTask.aiValidationKey).toBe('DETECT_MANOMETER');
    expect(captureTask.timerConfig?.variant).toBe('NEN1006_PERSPROEF');
  });

  it('maps the gas dichtheidsbeproeving template to a timer-aware capture task', () => {
    const context = findNenTaskContextByInspectionPointId('gas-persproef-eind-001');

    expect(context).not.toBeNull();

    const captureTask = toNenCaptureTask(context!.discipline, context!.task);
    const nen1078TimerConfig =
      captureTask.timerConfig?.variant === 'NEN1078_DICHTHEIDSPROEF'
        ? captureTask.timerConfig
        : null;

    expect(captureTask.requiresTimer).toBe(true);
    expect(captureTask.requiresMeasurementTool).toBe(true);
    expect(captureTask.aiValidationKey).toBe('DETECT_MANOMETER');
    expect(captureTask.timerConfig?.variant).toBe('NEN1078_DICHTHEIDSPROEF');
    expect(nen1078TimerConfig?.defaultDurationMinutes).toBe(10);
  });

  it('maps the NEN 2580 GO laser template back to the bouwfysica context', () => {
    const context = findNenTaskContextByInspectionPointId('nen2580-go-lasermeting-001');

    expect(context?.discipline.id).toBe('bouwfysica_gebruik');
    expect(context?.task.id).toBe('NEN-2580-01-GO-LASERMETING');
  });

  it('maps the NEN 3215 waterslot template back to the installatie context', () => {
    const context = findNenTaskContextByInspectionPointId('riolering-waterslot-sifon-001');

    expect(context?.discipline.id).toBe('installatie_water_gas');
    expect(context?.task.id).toBe('NEN-3215-02-WATERSLOT-SIFON');
  });

  it('maps the NEN 1087 toevoerdebiet template back to the installatie context', () => {
    const context = findNenTaskContextByInspectionPointId('ventilatie-toevoer-debiet-001');

    expect(context?.discipline.id).toBe('installatie_water_gas');
    expect(context?.task.id).toBe('NEN-1087-02-TOEVOER-DEBIET');
  });

  it('maps the NEN 3569 risk zone template back to the afbouw context', () => {
    const context = findNenTaskContextByInspectionPointId('veiligheidsglas-risicozone-001');

    expect(context?.discipline.id).toBe('afbouw');
    expect(context?.task.id).toBe('NEN-3569-02-RISICOZONE');
  });

  it('maps the NEN 5077 erfgrens template back to the bouwfysica context', () => {
    const context = findNenTaskContextByInspectionPointId('warmtepomp-erfgrens-afstand-001');

    expect(context?.discipline.id).toBe('bouwfysica_gebruik');
    expect(context?.task.id).toBe('NEN-5077-01-AFSTAND-ERFGRENS');
  });

  it('maps the NEN 1814 wandverankering template back to the bouwfysica context', () => {
    const context = findNenTaskContextByInspectionPointId(
      'toegankelijkheid-steunbeugel-verankering-001'
    );

    expect(context?.discipline.id).toBe('bouwfysica_gebruik');
    expect(context?.task.id).toBe('NEN-1814-01-VERANKERING');
  });

  it('maps the NEN 1814 steunbeugelhoogte template back to the bouwfysica context', () => {
    const context = findNenTaskContextByInspectionPointId(
      'toegankelijkheid-steunbeugel-hoogte-001'
    );

    expect(context?.discipline.id).toBe('bouwfysica_gebruik');
    expect(context?.task.id).toBe('NEN-1814-02-BEUGEL-HOOGTE');
  });

  it('maps the NEN 9120 rolstoel-douche template back to the bouwfysica context', () => {
    const context = findNenTaskContextByInspectionPointId(
      'toegankelijkheid-douche-draaicirkel-1500-001'
    );

    expect(context?.discipline.id).toBe('bouwfysica_gebruik');
    expect(context?.task.id).toBe('NEN-9120-09-DOUCHE-ROLSTOEL-DRAAICIRKEL');
  });

  it('maps the NEN 9120 douche-gebruiksruimte template back to the bouwfysica context', () => {
    const context = findNenTaskContextByInspectionPointId(
      'toegankelijkheid-douche-gebruiksruimte-001'
    );

    expect(context?.discipline.id).toBe('bouwfysica_gebruik');
    expect(context?.task.id).toBe('NEN-9120-15-DOUCHE-GEBRUIKSRUIMTE');
  });

  it('maps the NEN 9120 toilet-deurzwaai template back to the bouwfysica context', () => {
    const context = findNenTaskContextByInspectionPointId(
      'toegankelijkheid-toilet-deurzwaai-001'
    );

    expect(context?.discipline.id).toBe('bouwfysica_gebruik');
    expect(context?.task.id).toBe('NEN-9120-16-TOILET-DEURZWAAI');
  });

  it('maps the NEN 9120 toilet-draaicirkel template back to the bouwfysica context', () => {
    const context = findNenTaskContextByInspectionPointId('toegankelijkheid-draaicirkel-001');

    expect(context?.discipline.id).toBe('bouwfysica_gebruik');
    expect(context?.task.id).toBe('NEN-9120-04-TOILET-DRAAICIRKEL');
  });

  it('maps the NEN 6068 WBDBO template back to the brandveiligheid context', () => {
    const context = findNenTaskContextByInspectionPointId('wbdbo-scheidingswand-001');

    expect(context?.discipline.id).toBe('brandveiligheid');
    expect(context?.task.id).toBe('NEN-6068-01-WBDBO-SCHEIDING');
  });

  it('maps the NEN-EN 13914 strijklicht template back to the afbouw context', () => {
    const context = findNenTaskContextByInspectionPointId('stuc-strijklicht-001');

    expect(context?.discipline.id).toBe('afbouw');
    expect(context?.task.id).toBe('NEN-13914-03-STRIJKLICHT');
  });

  it('keeps AI guidance and timer metadata in the WKB task catalog', () => {
    const wbdboTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'wbdbo-scheidingswand-001'
    );
    const branddeurLabelTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'brandwerende-deur-label-001'
    );
    const persproefTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'nen1006-persproef-eind-001'
    );
    const goLaserTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'nen2580-go-lasermeting-001'
    );
    const contourTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'nen2580-1500mm-lijn-001'
    );
    const meterkastTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'meterkast-indeling-001'
    );
    const aardlekSpecificatieTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'aardlek-specificatie-001'
    );
    const pvStickerTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'pv-waarschuwing-sticker-001'
    );
    const aardlekTypeTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'aardlek-type-pv-ev-001'
    );
    const badkamerZoneTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'badkamer-zone-001'
    );
    const kleurcoderingTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'elektra-kleurcodering-001'
    );
    const aardlekTestTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'aardlek-test-001'
    );
    const hotspotTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'nen1006-hotspot-001'
    );
    const mantelbuisTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'nen1006-mantelbuis-001'
    );
    const gasMantelbuisTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'gas-mantelbuis-001'
    );
    const gasPersproefTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'gas-persproef-eind-001'
    );
    const gasPersproefStartTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'gas-persproef-start-001'
    );
    const gasPersproefTimerConfig =
      gasPersproefTemplate?.timerConfig?.variant === 'NEN1078_DICHTHEIDSPROEF'
        ? gasPersproefTemplate.timerConfig
        : null;
    const warmtepompAfstandTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'warmtepomp-erfgrens-afstand-001'
    );
    const warmtepompCeLabelTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'warmtepomp-ce-label-db-001'
    );
    const warmtepompDempersTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'warmtepomp-trillingsdempers-001'
    );
    const warmtepompSuskastTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'warmtepomp-suskast-001'
    );
    const rioolAfschotTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'riolering-afschot-001'
    );
    const rioolWaterslotTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'riolering-waterslot-sifon-001'
    );
    const rioolOntlastTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'riolering-ontlastvoorziening-001'
    );
    const rioolVerbindingenTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'riolering-verbindingen-001'
    );
    const ventilatieRouteTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'ventilatiekanalen-001'
    );
    const ventilatieToevoerTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'ventilatie-toevoer-debiet-001'
    );
    const ventilatieAfvoerTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'ventilatie-afvoer-debiet-001'
    );
    const ventilatieRenovatieTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'ventilatie-renovatie-doorstroom-001'
    );
    const deurbreedteTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-deurbreedte-001'
    );
    const toiletruimteTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-toiletruimte-001'
    );
    const drempelTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-drempelhoogte-001'
    );
    const draaicirkelTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-draaicirkel-001'
    );
    const toiletDeurzwaaiTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-toilet-deurzwaai-001'
    );
    const toiletWasbakTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-toilet-wasbak-hoogte-001'
    );
    const doucheBinnenmaatTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-doucheruimte-binnenmaat-001'
    );
    const gecombineerdeDoucheToiletTemplate = wkbTaskTemplates.find(
      (task) =>
        task.inspectionPointId ===
        'toegankelijkheid-gecombineerde-douche-toilet-binnenmaat-001'
    );
    const doucheRollatorTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-douche-draaicirkel-1050-001'
    );
    const doucheRolstoelTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-douche-draaicirkel-1500-001'
    );
    const doucheDeurzwaaiTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-douche-deurzwaai-001'
    );
    const douchevloerAfschotTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-douchevloer-afschot-001'
    );
    const doucheGebruiksruimteTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-douche-gebruiksruimte-001'
    );
    const doucheDrogeOpstelruimteTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-douche-droge-opstelruimte-001'
    );
    const steunbeugelVerankeringTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-steunbeugel-verankering-001'
    );
    const steunbeugelTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-steunbeugel-hoogte-001'
    );
    const closethoogteTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'toegankelijkheid-closethoogte-001'
    );
    const stucTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'stuc-vlakheid-001'
    );
    const stucStrijklichtTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'stuc-strijklicht-001'
    );
    const veiligheidsglasTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'beglazing-kitwerk-001'
    );
    const veiligheidsglasRisicozoneTemplate = wkbTaskTemplates.find(
      (task) => task.inspectionPointId === 'veiligheidsglas-risicozone-001'
    );

    expect(wbdboTemplate?.aiValidationKey).toBe('DETECT_FIRE_SEPARATION_DETAIL');
    expect(wbdboTemplate?.standards).toBe('NEN 6068 / NEN 6069');
    expect(branddeurLabelTemplate?.aiValidationKey).toBe('OCR_FIRE_RATING_LABEL');
    expect(branddeurLabelTemplate?.stopMoment).toBe('VOOR OPLEVERING');
    expect(persproefTemplate?.requiresTimer).toBe(true);
    expect(persproefTemplate?.aiValidationKey).toBe('DETECT_MANOMETER');
    expect(persproefTemplate?.standards).toBe('NEN 1006 / WB 2.3');
    expect(goLaserTemplate?.requiresMeasurementTool).toBe(true);
    expect(goLaserTemplate?.aiValidationKey).toBe('OCR_LASER_DISPLAY');
    expect(goLaserTemplate?.standards).toBe('NEN 2580 / Bbl');
    expect(contourTemplate?.aiValidationKey).toBe('DETECT_TAPE_MEASURE_HEIGHT');
    expect(meterkastTemplate?.aiValidationKey).toBe('DETECT_OPEN_BOARD_AND_COUNT');
    expect(meterkastTemplate?.standards).toBe('NEN 1010:2020+C1:2024');
    expect(aardlekSpecificatieTemplate?.aiValidationKey).toBe('OCR_RCD_30MA');
    expect(pvStickerTemplate?.aiValidationKey).toBe('DETECT_PV_STICKER');
    expect(aardlekTypeTemplate?.aiValidationKey).toBe('OCR_RCD_TYPE_B');
    expect(aardlekTypeTemplate?.standards).toBe('NEN 1010:2020+C1:2024');
    expect(badkamerZoneTemplate?.requiresMeasurementTool).toBe(true);
    expect(badkamerZoneTemplate?.aiValidationKey).toBe('DETECT_BATHROOM_ZONE');
    expect(kleurcoderingTemplate?.aiValidationKey).toBe('DETECT_WIRE_COLORS');
    expect(aardlekTestTemplate?.stopMoment).toBe('VOOR OPLEVERING');
    expect(aardlekTestTemplate?.aiValidationKey).toBe('OCR_TRIP_TIME');
    expect(hotspotTemplate?.aiValidationKey).toBe('DETECT_PIPE_SEPARATION');
    expect(mantelbuisTemplate?.aiValidationKey).toBe('DETECT_PROTECTION_PIPE');
    expect(gasMantelbuisTemplate?.aiValidationKey).toBe('DETECT_GAS_PIPE_CASING');
    expect(gasPersproefStartTemplate?.requiresMeasurementTool).toBe(true);
    expect(gasPersproefTemplate?.requiresTimer).toBe(true);
    expect(gasPersproefTemplate?.requiresMeasurementTool).toBe(true);
    expect(gasPersproefTemplate?.standards).toBe('NEN 1078:2024');
    expect(gasPersproefTimerConfig?.defaultDurationMinutes).toBe(10);
    expect(warmtepompAfstandTemplate?.requiresMeasurementTool).toBe(true);
    expect(warmtepompAfstandTemplate?.aiValidationKey).toBe('DETECT_LASER_DISTANCE');
    expect(warmtepompAfstandTemplate?.standards).toBe('NEN 5077 / Bbl art. 4.107');
    expect(warmtepompCeLabelTemplate?.aiValidationKey).toBe('OCR_CE_LABEL_DB');
    expect(warmtepompDempersTemplate?.aiValidationKey).toBe(
      'DETECT_VIBRATION_DAMPERS'
    );
    expect(warmtepompSuskastTemplate?.aiValidationKey).toBe(
      'DETECT_ACOUSTIC_ENCLOSURE'
    );
    expect(warmtepompSuskastTemplate?.stopMoment).toBe('VOOR OPLEVERING');
    expect(rioolAfschotTemplate?.aiValidationKey).toBe('DETECT_SPIRIT_LEVEL');
    expect(rioolAfschotTemplate?.standards).toBe('NEN 3215');
    expect(rioolWaterslotTemplate?.requiresMeasurementTool).toBe(true);
    expect(rioolWaterslotTemplate?.aiValidationKey).toBe('DETECT_WATER_SEAL');
    expect(rioolOntlastTemplate?.aiValidationKey).toBe('DETECT_RELIEF_VALVE');
    expect(rioolVerbindingenTemplate?.aiValidationKey).toBe('DETECT_PIPE_SLOPE');
    expect(rioolVerbindingenTemplate?.stopMoment).toBe('VOOR DICHTZETTEN');
    expect(ventilatieRouteTemplate?.standards).toBe('NEN 1087 / NEN 8087');
    expect(ventilatieRouteTemplate?.stopMoment).toBe('VOOR PLAFOND DICHT');
    expect(ventilatieToevoerTemplate?.requiresMeasurementTool).toBe(true);
    expect(ventilatieToevoerTemplate?.aiValidationKey).toBe('DETECT_ANEMOMETER');
    expect(ventilatieAfvoerTemplate?.requiresMeasurementTool).toBe(true);
    expect(ventilatieAfvoerTemplate?.aiValidationKey).toBe('DETECT_ANEMOMETER');
    expect(ventilatieRenovatieTemplate?.standards).toBe('NEN 8087');
    expect(toiletruimteTemplate?.requiresMeasurementTool).toBe(true);
    expect(toiletruimteTemplate?.standards).toBe('NEN 9120:2025 / Bbl / NEN 2580');
    expect(toiletruimteTemplate?.stopMoment).toBe('VOOR AFBOUW');
    expect(deurbreedteTemplate?.aiValidationKey).toBe('DETECT_DOOR_WIDTH');
    expect(deurbreedteTemplate?.standards).toBe('NEN 9120:2025 / Bbl');
    expect(drempelTemplate?.aiValidationKey).toBe('DETECT_THRESHOLD_HEIGHT');
    expect(draaicirkelTemplate?.requiresMeasurementTool).toBe(true);
    expect(draaicirkelTemplate?.aiValidationKey).toBe('DETECT_TURNING_CIRCLE');
    expect(draaicirkelTemplate?.standards).toBe('NEN 9120:2025 / Bbl');
    expect(toiletDeurzwaaiTemplate?.requiresMeasurementTool).toBe(true);
    expect(toiletDeurzwaaiTemplate?.aiValidationKey).toBe('DETECT_DOOR_SWING_CLEARANCE');
    expect(toiletWasbakTemplate?.aiValidationKey).toBe('DETECT_TAPE_MEASURE_HEIGHT');
    expect(doucheBinnenmaatTemplate?.aiValidationKey).toBe('DETECT_TAPE_MEASURE');
    expect(doucheBinnenmaatTemplate?.standards).toBe('NEN 9120:2025 / Bbl');
    expect(gecombineerdeDoucheToiletTemplate?.aiValidationKey).toBe('DETECT_TAPE_MEASURE');
    expect(doucheRollatorTemplate?.aiValidationKey).toBe('DETECT_TURNING_CIRCLE');
    expect(doucheRollatorTemplate?.standards).toBe('NEN 9120:2025 / Bbl');
    expect(doucheRolstoelTemplate?.aiValidationKey).toBe('DETECT_TURNING_CIRCLE');
    expect(doucheDeurzwaaiTemplate?.aiValidationKey).toBe('DETECT_DOOR_SWING_CLEARANCE');
    expect(douchevloerAfschotTemplate?.aiValidationKey).toBe('DETECT_WATERPAS');
    expect(doucheGebruiksruimteTemplate?.aiValidationKey).toBe('DETECT_TAPE_MEASURE');
    expect(doucheDrogeOpstelruimteTemplate?.aiValidationKey).toBe('DETECT_TAPE_MEASURE');
    expect(steunbeugelVerankeringTemplate?.aiValidationKey).toBe('DETECT_WALL_ANCHORING');
    expect(steunbeugelVerankeringTemplate?.standards).toBe('NEN 1814 / Bbl');
    expect(steunbeugelVerankeringTemplate?.stopMoment).toBe('VOOR SLUITEN WAND');
    expect(steunbeugelTemplate?.aiValidationKey).toBe('DETECT_SUPPORT_BAR_HEIGHT');
    expect(steunbeugelTemplate?.requiresMeasurementTool).toBe(true);
    expect(steunbeugelTemplate?.standards).toBe('NEN 1814 / Bbl');
    expect(closethoogteTemplate?.aiValidationKey).toBe('DETECT_TAPE_MEASURE');
    expect(steunbeugelTemplate?.stopMoment).toBe('VOOR OPLEVERING');
    expect(stucTemplate?.aiValidationKey).toBe('DETECT_STRAIGHTEDGE');
    expect(stucTemplate?.standards).toBe('NEN-EN 13914-2');
    expect(stucStrijklichtTemplate?.aiValidationKey).toBe('DETECT_DIFFUSE_LIGHT');
    expect(stucStrijklichtTemplate?.dossierScope).toBe('CONSUMENT');
    expect(veiligheidsglasTemplate?.aiValidationKey).toBe('DETECT_GLASS_STAMP');
    expect(veiligheidsglasTemplate?.standards).toBe('NEN 3569 / NEN-EN 13914-2');
    expect(veiligheidsglasTemplate?.dossierScope).toBe('BOTH');
    expect(veiligheidsglasRisicozoneTemplate?.aiValidationKey).toBe(
      'DETECT_TAPE_MEASURE_HEIGHT'
    );
    expect(veiligheidsglasRisicozoneTemplate?.dossierScope).toBe('BOTH');
  });
});
