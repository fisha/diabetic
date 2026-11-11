// One-time import of the translated string tables in the design export into messages/*.json.
// After the import the catalog in messages/ is the source of truth: translators and clinicians edit it there.
// Re-running is safe: existing ids keep their current text; only ids missing from the catalog are added.
// Usage: node scripts/import-design.mjs [--dry-run]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const boards = join(here, '../../../design/claude-design/boards');
const out = join(here, '../messages');
const LOCALES = ['en', 'he', 'ar', 'ru'];
const dry = process.argv.includes('--dry-run');

const read = (f) => readFileSync(join(boards, f), 'utf8');
const script = (src) => {
  const m = /<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/.exec(src);
  if (!m) throw new Error('no DC script block');
  return m[1];
};

/** Returns the source of the balanced {...} or [...] literal that starts at index i. */
function literalAt(src, i) {
  const open = src[i];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let quote = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === '\\') j++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced literal');
}

const evalLiteral = (code) => vm.runInNewContext(`(${code})`, {}, { timeout: 1000 });

/** Board tables keyed by locale, each a flat { key: text } map. */
function tableFromStringsMethod(file) {
  const s = script(read(file));
  const i = s.indexOf('strings()');
  const r = s.indexOf('return', i);
  return evalLiteral(literalAt(s, s.indexOf('{', r)));
}
function tableFromConst(file, name) {
  const s = script(read(file));
  const i = s.indexOf(`const ${name} =`);
  if (i < 0) throw new Error(`${file}: const ${name} not found`);
  return evalLiteral(literalAt(s, s.indexOf('{', i)));
}

const catalog = Object.fromEntries(LOCALES.map((l) => [l, {}]));
const meta = {};

function addTable(prefix, board, table) {
  const keys = Object.keys(table.en);
  for (const l of LOCALES) {
    const missing = keys.filter((k) => !(k in table[l]));
    if (missing.length) console.warn(`${board}: ${l} is missing ${missing.join(', ')}`);
  }
  for (const k of keys) {
    const id = `${prefix}.${k}`;
    for (const l of LOCALES) if (typeof table[l][k] === 'string') catalog[l][id] = table[l][k];
    meta[id] = { board, review: ['translation'] };
  }
}

addTable('onb', 'Onboarding', tableFromStringsMethod('Onboarding.dc.html'));
addTable('com', 'Companion', tableFromStringsMethod('Companion.dc.html'));
addTable('web', 'Website', tableFromConst('Website.dc.html', 'T'));

// Board 13 (Localization) holds ICU strings with clinical-review flags and translator notes.
{
  const s = script(read('Localization.dc.html'));
  const rows = evalLiteral(literalAt(s, s.indexOf('[', s.indexOf('const D ='))));
  for (const r of rows) {
    for (const l of LOCALES) catalog[l][r.id] = r[l];
    meta[r.id] = {
      board: 'Localization',
      review: r.med ? ['translation', 'clinical'] : ['translation'],
      ...(r.note ? { note: r.note } : {}),
    };
  }
}


// Design-only text that must never reach the app: sample dialogue and companion speech (in production the companion's
// words come from the conversation service), sample history, sample names and values, canvas annotations, and a mock
// of the operating system's permission dialog.
const EXCLUDE = {
  'com.c_hello': 'sample companion speech', 'com.c_int': 'sample companion speech',
  'com.c_notyet': 'sample companion speech', 'com.c_reply': 'sample companion speech',
  'com.c_saved': 'sample companion speech', 'com.c_snooze': 'sample companion speech',
  'com.c_text_gen': 'sample companion speech', 'com.c_text_num': 'sample companion speech',
  'com.greeting': 'sample companion speech', 'com.u_say': 'sample user speech',
  'com.h1': 'sample history', 'com.h1s': 'sample history', 'com.h2': 'sample history', 'com.h2s': 'sample history',
  'com.h3': 'sample history', 'com.h3s': 'sample history', 'com.h4': 'sample history', 'com.h4s': 'sample history',
  'com.re_what_v': 'sample reminder text', 'com.src_sensor': 'sample device name',
  'com.demo': 'canvas annotation', 'com.reviewed': 'canvas annotation', 'onb.vo_ph': 'canvas annotation',
  'onb.sys_t': 'mock OS dialog', 'onb.sys_b': 'mock OS dialog', 'onb.sys_yes': 'mock OS dialog', 'onb.sys_no': 'mock OS dialog',
  'onb.minor.body': 'superseded by G-02 (under 18 sees the stop screen)',
};

// Strings drawn with sample values, rewritten with ICU arguments. Drafts; the non-English text needs native review.
const PARAMETERIZED = {
  'com.stale_b': {
    en: 'No new sensor reading for {minutes} min. Data may be delayed; check your device.',
    he: 'אין מדידת חיישן חדשה כבר {minutes} דקות. ייתכן עיכוב; בדקו את המכשיר.',
    ar: 'لا توجد قراءة جديدة من الحساس منذ {minutes} دقيقة. قد تتأخر البيانات؛ تحقق من جهازك.',
    ru: 'Нет новых данных сенсора уже {minutes} мин. Возможна задержка; проверьте устройство.',
  },
  'ovr.reading.stale': {
    en: 'No new readings for {minutes, plural, one {# minute} other {# minutes}}',
    he: 'אין קריאות חדשות כבר {minutes, plural, one {דקה} two {2 דקות} other {# דקות}}',
    ar: 'لا توجد قراءات جديدة منذ {minutes, plural, zero {أقل من دقيقة} one {دقيقة} two {دقيقتين} few {# دقائق} many {# دقيقة} other {# دقيقة}}',
    ru: 'Нет новых данных {minutes, plural, one {# минуту} few {# минуты} many {# минут} other {# минуты}}',
  },
  'ovr.insight.recurring': {
    en: 'Seen on {count} of the last {total} mornings',
    he: 'נראה ב־{count} מתוך {total} הבקרים האחרונים',
    ar: 'لوحظ في {count} من آخر {total} صباحات',
    ru: 'Отмечалось {count, plural, one {# утро} few {# утра} other {# утр}} из последних {total}',
  },
  'rtn.day': {
    en: 'Day {day} of about {total}. I’m learning your routine.',
    he: 'יום {day} מתוך כ־{total}. אני {gender, select, f {לומדת} other {לומד}} את השגרה שלך.',
    ar: 'اليوم {day} من نحو {total}. أتعرّف على روتينك.',
    ru: 'День {day} из примерно {total}. Я изучаю ваш распорядок.',
  },
  'com.type_ph': { en: 'Message {name}', he: 'הודעה ל{name}', ar: 'رسالة إلى {name}', ru: 'Сообщение для {name}' },
  'com.notif_from': {
    en: 'Opened from your {time} check-in. Sent, not confirmed seen.',
    he: 'נפתח מהבדיקה של {time}. נשלח, לא אושר שנראה.',
    ar: 'فُتح من متابعة الساعة {time}. أُرسل، ولم يتأكد أنه شوهد.',
    ru: 'Открыто из вопроса в {time}. Отправлено, просмотр не подтверждён.',
  },
};

function applyRules() {
  for (const id of Object.keys(EXCLUDE)) {
    if (!(id in meta)) throw new Error(`EXCLUDE lists unknown id ${id}`);
    for (const l of LOCALES) delete catalog[l][id];
    delete meta[id];
  }
  for (const [id, texts] of Object.entries(PARAMETERIZED)) {
    if (!(id in meta)) throw new Error(`PARAMETERIZED lists unknown id ${id}`);
    for (const l of LOCALES) catalog[l][id] = texts[l];
    meta[id] = { ...meta[id], note: [meta[id].note, 'Arguments replace the sample values drawn in the design.'].filter(Boolean).join(' ') };
  }
}

applyRules();
console.log(`excluded ${Object.keys(EXCLUDE).length} design-only strings`);

// Merge with the existing catalog: keep existing text, add new ids.
let added = 0;
for (const l of [...LOCALES, 'meta']) {
  const path = join(out, `${l}.json`);
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const incoming = l === 'meta' ? meta : catalog[l];
  const merged = { ...current };
  for (const [id, v] of Object.entries(incoming)) if (!(id in merged)) { merged[id] = v; if (l === 'en') added++; }
  const sorted = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
  if (!dry) writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n');
}
console.log(`${Object.keys(catalog.en).length} design strings read, ${added} new ids ${dry ? 'would be ' : ''}added`);
