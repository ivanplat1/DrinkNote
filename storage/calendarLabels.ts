import AsyncStorage from '@react-native-async-storage/async-storage';

const CALENDAR_LABELS_KEY = 'calendar_labels_v3';

export const DEFAULT_LABEL_COLOR = '#6B9BD1';

export type LabelEntry = { text: string; color: string };

/** Один период метки (может пересекаться с другими). */
export type LabelDefinition = {
  id: string;
  fromISO: string;
  toISO: string;
  text: string;
  color: string;
};

/** Для обратной совместимости: дата -> массив меток (несколько периодов могут покрывать один день). */
export type CalendarLabelsMap = Record<string, LabelEntry[]>;

function genId(): string {
  return `label_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Миграция из v2 (per-day map) в v3 (definitions). */
async function migrateFromV2(): Promise<LabelDefinition[]> {
  const raw = await AsyncStorage.getItem('calendar_labels_v2');
  if (!raw) return [];
  try {
    const map = JSON.parse(raw) as Record<string, { text: string; color?: string }>;
    const dates = Object.keys(map).sort();
    if (dates.length === 0) return [];
    const definitions: LabelDefinition[] = [];
    let start = dates[0];
    let entry = map[dates[0]];
    const key = () => `${entry?.text ?? ''}|${entry?.color ?? DEFAULT_LABEL_COLOR}`;
    let currentKey = key();

    for (let i = 1; i < dates.length; i++) {
      const d = dates[i];
      const e = map[d];
      const nextKey = `${e?.text ?? ''}|${e?.color ?? DEFAULT_LABEL_COLOR}`;
      const prevDate = new Date(dates[i - 1] + 'T00:00:00');
      const currDate = new Date(d + 'T00:00:00');
      const diffDays = (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);

      if (nextKey === currentKey && diffDays === 1) {
        continue;
      }
      definitions.push({
        id: genId(),
        fromISO: start,
        toISO: dates[i - 1],
        text: entry?.text ?? '',
        color: entry?.color ?? DEFAULT_LABEL_COLOR,
      });
      start = d;
      entry = e;
      currentKey = nextKey;
    }
    definitions.push({
      id: genId(),
      fromISO: start,
      toISO: dates[dates.length - 1],
      text: entry?.text ?? '',
      color: entry?.color ?? DEFAULT_LABEL_COLOR,
    });
    return definitions;
  } catch {
    return [];
  }
}

async function getDefinitions(): Promise<LabelDefinition[]> {
  const raw = await AsyncStorage.getItem(CALENDAR_LABELS_KEY);
  if (!raw) {
    const fromV2 = await migrateFromV2();
    if (fromV2.length > 0) {
      await AsyncStorage.setItem(CALENDAR_LABELS_KEY, JSON.stringify({ definitions: fromV2 }));
      await AsyncStorage.removeItem('calendar_labels_v2');
      return fromV2;
    }
    return [];
  }
  try {
    const data = JSON.parse(raw) as { definitions?: LabelDefinition[] };
    const list = Array.isArray(data.definitions) ? data.definitions : [];
    return list.filter((d) => d && d.id && d.fromISO && d.toISO);
  } catch {
    return [];
  }
}

async function saveDefinitions(definitions: LabelDefinition[]): Promise<void> {
  await AsyncStorage.setItem(CALENDAR_LABELS_KEY, JSON.stringify({ definitions }));
}

/** Карта дата -> массив меток (несколько периодов на один день). */
export async function getCalendarLabels(): Promise<CalendarLabelsMap> {
  const defs = await getDefinitions();
  const map: CalendarLabelsMap = {};
  for (const d of defs) {
    const from = new Date(d.fromISO + 'T00:00:00');
    const to = new Date(d.toISO + 'T00:00:00');
    const cursor = new Date(from);
    while (cursor.getTime() <= to.getTime()) {
      const iso =
        cursor.getFullYear() +
        '-' +
        String(cursor.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(cursor.getDate()).padStart(2, '0');
      if (!map[iso]) map[iso] = [];
      map[iso].push({ text: d.text, color: d.color });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
}

/** Добавить метку на один день (добавляет новый период из одного дня). */
export async function setCalendarLabel(
  dateISO: string,
  label: string | null,
  color: string = DEFAULT_LABEL_COLOR
): Promise<CalendarLabelsMap> {
  const defs = await getDefinitions();
  const next = defs.filter((d) => !(d.fromISO === dateISO && d.toISO === dateISO));
  if (label != null && label.trim() !== '') {
    next.push({
      id: genId(),
      fromISO: dateISO,
      toISO: dateISO,
      text: label.trim(),
      color,
    });
  }
  await saveDefinitions(next);
  return getCalendarLabels();
}

/** Добавить новый период метки (не перезаписывает пересекающиеся). */
export async function setCalendarLabelRange(
  fromISO: string,
  toISO: string,
  label: string | null,
  color: string = DEFAULT_LABEL_COLOR
): Promise<LabelDefinition[]> {
  const from = new Date(fromISO + 'T00:00:00');
  const to = new Date(toISO + 'T00:00:00');
  if (from.getTime() > to.getTime()) return getDefinitions();
  const defs = await getDefinitions();
  if (label == null || label.trim() === '') return defs;
  defs.push({
    id: genId(),
    fromISO: fromISO,
    toISO: toISO,
    text: label.trim(),
    color,
  });
  await saveDefinitions(defs);
  return defs;
}

export type LabelRange = LabelDefinition;

/** Список всех периодов (определений). */
export async function getCalendarLabelRanges(): Promise<LabelRange[]> {
  return getDefinitions();
}

/** Полная замена списка периодов меток (для импорта/восстановления). */
export async function setCalendarLabelRanges(ranges: LabelRange[]): Promise<LabelRange[]> {
  const normalized = (Array.isArray(ranges) ? ranges : [])
    .filter((d) => d && d.fromISO && d.toISO && typeof d.text === 'string')
    .map((d) => ({
      id: d.id || genId(),
      fromISO: d.fromISO,
      toISO: d.toISO,
      text: d.text.trim(),
      color: d.color || DEFAULT_LABEL_COLOR,
    }))
    .filter((d) => d.text.length > 0);
  await saveDefinitions(normalized);
  return getDefinitions();
}

/** Удалить период по id. */
export async function deleteCalendarLabelRange(id: string): Promise<LabelDefinition[]> {
  const defs = await getDefinitions();
  const next = defs.filter((d) => d.id !== id);
  await saveDefinitions(next);
  return next;
}

/** Обновить период по id. */
export async function updateCalendarLabelRange(
  id: string,
  fromISO: string,
  toISO: string,
  text: string,
  color: string
): Promise<LabelDefinition[]> {
  const defs = await getDefinitions();
  const idx = defs.findIndex((d) => d.id === id);
  if (idx === -1) return defs;
  const from = new Date(fromISO + 'T00:00:00');
  const to = new Date(toISO + 'T00:00:00');
  if (from.getTime() > to.getTime()) return defs;
  defs[idx] = { ...defs[idx], fromISO, toISO, text: text.trim(), color };
  await saveDefinitions(defs);
  return defs;
}

export async function clearCalendarLabels(): Promise<void> {
  await AsyncStorage.removeItem(CALENDAR_LABELS_KEY);
  await AsyncStorage.removeItem('calendar_labels_v1');
  await AsyncStorage.removeItem('calendar_labels_v2');
}
