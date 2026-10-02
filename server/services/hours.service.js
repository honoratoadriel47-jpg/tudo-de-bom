import { getSettings } from './settings.service.js';

const DAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fmt = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Data/hora "de parede" no fuso da loja. */
export function zonedNow(timeZone, date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date).map((p) => [p.type, p.value]),
  );
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute), ymd: `${parts.year}-${parts.month}-${parts.day}` };
}

/** Intervalos abertos (em minutos desde 00:00 do dia "d"), tratando virada de meia-noite. */
function windowsFor(hours, d) {
  const h = hours[d];
  if (!h || h.closed) return [];
  const o = toMin(h.open), c = toMin(h.close);
  return [{ start: o, end: c <= o ? c + 1440 : c }];
}

export function storeStatus(date = new Date()) {
  const s = getSettings();
  const now = zonedNow(s.timezone, date);
  const prev = (now.day + 6) % 7;
  let open = false, closesAt = null;
  for (const w of windowsFor(s.hours, now.day)) if (now.minutes >= w.start && now.minutes < w.end) { open = true; closesAt = w.end; }
  for (const w of windowsFor(s.hours, prev)) if (now.minutes + 1440 >= w.start && now.minutes + 1440 < w.end) { open = true; closesAt = w.end - 1440; }
  if (s.manualStatus === 'open') open = true;
  if (s.manualStatus === 'closed') open = false;

  // Próxima abertura (até 7 dias à frente)
  let next = null;
  if (!open) {
    for (let i = 0; i < 8 && !next; i++) {
      const d = (now.day + i) % 7;
      for (const w of windowsFor(s.hours, d)) {
        if (i === 0 && w.start <= now.minutes) continue;
        next = { dayOffset: i, day: d, start: w.start, end: w.end };
        break;
      }
    }
  }
  const label = open
    ? `Aberto até ${fmt(closesAt ?? 0)}`
    : next
      ? `Abrimos ${next.dayOffset === 0 ? 'hoje' : next.dayOffset === 1 ? 'amanhã' : DAYS[next.day]} às ${fmt(next.start)}`
      : 'Fechado no momento';

  return { open, label, manual: s.manualStatus !== 'auto', next, now };
}

/** Horários disponíveis para agendamento quando a loja está fechada (próxima janela de funcionamento). */
export function scheduleSlots(date = new Date()) {
  const s = getSettings();
  const st = storeStatus(date);
  if (st.open || !s.scheduling.allowWhenClosed || !st.next || st.manual) return [];
  const step = Math.max(15, Number(s.scheduling.slotMinutes) || 30);
  const startMin = st.next.start + Math.max(s.prep.deliveryMin, s.prep.pickupMin);
  const slots = [];
  for (let m = Math.ceil(startMin / step) * step; m <= st.next.end - 15; m += step) {
    slots.push({ value: `${st.next.dayOffset}|${fmt(m)}`, label: `${st.next.dayOffset === 0 ? 'Hoje' : st.next.dayOffset === 1 ? 'Amanhã' : DAYS[st.next.day]}, ${fmt(m)}` });
  }
  return slots;
}

export function hoursSummary() {
  const s = getSettings();
  return s.hours.map((h, i) => ({ day: DAYS[i], text: h.closed ? 'Fechado' : `${h.open} às ${h.close}` }));
}
