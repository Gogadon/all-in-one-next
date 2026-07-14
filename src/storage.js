import { CONFIG } from './config.js';
import { emptyState } from './core.js';

let dbp;

const open = () => {
  if (!('indexedDB' in globalThis)) return Promise.resolve(null);
  if (dbp) return dbp;

  dbp = new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG.dbName, CONFIG.dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbp;
};

const get = async (storeName, key) => {
  const db = await open();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
};

const put = async (storeName, value, key) => {
  const db = await open();
  if (!db) return false;

  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
    const request = key === undefined ? store.put(value) : store.put(value, key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

export const validate = state => {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw Error('Zustand ist ungültig.');
  }

  if (
    !Array.isArray(state.sessions)
    || !Array.isArray(state.activities)
    || !Array.isArray(state.challenges)
  ) {
    throw Error('Backup hat nicht die erwartete Struktur.');
  }

  for (const session of state.sessions) {
    if (
      !session.id
      || !/^\d{4}-\d{2}-\d{2}$/.test(session.date ?? '')
      || !Array.isArray(session.segments)
    ) {
      throw Error('Mindestens eine Session ist beschädigt.');
    }
  }

  return state;
};

export const database = {
  async load() {
    try {
      const state = await get('state', CONFIG.stateKey);
      if (state) return validate(state);
    } catch (error) {
      console.warn(error);
    }

    const fallback = localStorage.getItem(CONFIG.fallbackKey);
    return fallback ? validate(JSON.parse(fallback)) : emptyState();
  },

  async save(state) {
    validate(state);

    try {
      if (await put('state', state, CONFIG.stateKey)) return;
    } catch (error) {
      console.warn(error);
    }

    localStorage.setItem(CONFIG.fallbackKey, JSON.stringify(state));
  },

  async snapshot(state, reason) {
    try {
      await put('snapshots', {
        id: `snap_${Date.now()}_${Math.random()}`,
        createdAt: new Date().toISOString(),
        reason,
        state: structuredClone(state),
      });
    } catch (error) {
      console.warn(error);
    }
  },
};

const LEGACY_METRICS = {
  dauer: 'duration',
  distanz: 'distance',
  hoehenmeter: 'elevation',
  schritte: 'steps',
  kalorien: 'calories',
  tempo_avg: 'averageSpeed',
  tempo_max: 'maxSpeed',
  puls_avg: 'averageHeartRate',
  puls_max: 'maxHeartRate',
  watt_avg: 'averagePower',
  trittfrequenz: 'cadence',
  gewicht: 'weight',
  wdh: 'repetitions',
};

const mapLegacyMetrics = metrics => Object.fromEntries(
  Object.entries(metrics ?? {})
    .filter(([, value]) => value != null)
    .map(([key, value]) => [LEGACY_METRICS[key] ?? key, value])
);

function convertLegacyBackup(root) {
  const old = root.daten;
  const now = new Date().toISOString();
  const library = new Map((old.bibliothek ?? []).map(activity => [activity.id, activity]));
  const legacyPlan = old.plaene?.kraft ?? {};
  const unitNames = new Map(
    (legacyPlan.einheiten ?? []).map(unit => [unit.id, unit.name])
  );

  const activities = (old.bibliothek ?? []).map(activity => ({
    id: activity.id,
    moduleId: activity.kategorie === 'rad'
      ? 'cycling'
      : activity.kategorie === 'wandern'
        ? 'hiking'
        : 'strength',
    name: activity.name,
    metrics: (activity.messwerte ?? []).map(metric => LEGACY_METRICS[metric] ?? metric),
    archived: Boolean(activity.archiviert),
    settings: activity.einstellungen ?? {},
    note: activity.notiz ?? '',
    legacyCategory: activity.kategorie,
  }));

  const sessions = (old.sessions ?? []).map((session, index) => {
    const moduleId = session.modul === 'rad'
      ? 'cycling'
      : session.modul === 'wandern'
        ? 'hiking'
        : 'strength';

    const createdAt = session.erstelltAm
      ?? `${session.datum}T${String(8 + index % 10).padStart(2, '0')}:${String(index * 7 % 60).padStart(2, '0')}:00.000Z`;

    const segments = (session.segmente ?? []).map((segment, segmentIndex) => {
      const activity = library.get(segment.aktivitaetId);
      const name = activity?.name ?? `Übung ${segmentIndex + 1}`;

      return {
        id: segment.id,
        activityId: segment.aktivitaetId,
        name,
        title: name,
        status: segment.erledigt === false ? 'draft' : 'completed',
        entries: (segment.eintraege ?? []).map(entry => ({
          id: entry.id,
          metrics: mapLegacyMetrics(entry.messwerte),
          flags: entry.flags ?? [],
          source: entry.quelle ?? 'legacy-import',
          status: 'completed',
        })),
      };
    });

    return {
      id: session.id,
      moduleId,
      date: session.datum,
      createdAt,
      updatedAt: createdAt,
      status: session.uebersprungen
        ? 'skipped'
        : session.abgeschlossen
          ? 'completed'
          : 'draft',
      title: session.name
        || (moduleId === 'strength'
          ? unitNames.get(session.ausPlan) || 'Freie Session'
          : ''),
      note: session.notiz ?? '',
      segments,
    };
  });

  const challengeMap = {
    rad_km: 'cyclingDistance',
    wandern_km: 'hikingDistance',
    wandern_hm: 'hikingElevation',
    wandern_schritte: 'hikingSteps',
  };

  const periodMap = {
    woche: 'week',
    monat: 'month',
    jahr: 'year',
    gesamt: 'all',
  };

  const challenges = (old.challenges ?? [])
    .filter(challenge => challengeMap[challenge.was])
    .map(challenge => ({
      id: challenge.id,
      metricId: challengeMap[challenge.was],
      target: challenge.zielwert,
      period: periodMap[challenge.zeitraum] ?? challenge.zeitraum ?? 'month',
      createdAt: challenge.erstellt,
    }));

  return {
    schemaVersion: 1,
    activities,
    sessions,
    plans: Object.keys(legacyPlan).length
      ? [{
          id: 'legacy-strength-plan',
          moduleId: 'strength',
          name: 'Importierter Kraftplan',
          legacyData: legacyPlan,
        }]
      : [],
    challenges,
    preferences: {
      theme: 'dark',
      legacySettings: old.einstellungen ?? {},
    },
    meta: {
      createdAt: root.exportiertAm ?? now,
      updatedAt: now,
      importedFrom: 'all-in-one-schema-2',
    },
  };
}

export const exportJson = state => JSON.stringify({
  app: CONFIG.name,
  version: CONFIG.version,
  exportedAt: new Date().toISOString(),
  data: validate(state),
}, null, 2);

export const importJson = text => {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw Error('Keine gültige JSON-Datei.');
  }

  const imported = parsed?.daten && Array.isArray(parsed.daten.sessions)
    ? convertLegacyBackup(parsed)
    : parsed?.data ?? parsed;

  return validate({
    ...emptyState(),
    ...imported,
    schemaVersion: 1,
  });
};
