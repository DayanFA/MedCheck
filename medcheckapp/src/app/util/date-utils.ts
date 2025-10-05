// Centraliza funções de data para evitar uso incorreto de toISOString() (UTC) ao derivar a data do "dia".
// Padrão do sistema: fuso America/Rio_Branco alinhado ao backend.

const ACRE_TZ = 'America/Rio_Branco';

/** Retorna string YYYY-MM-DD considerando o fuso America/Rio_Branco. */
export function todayAcreISODate(ref: Date = new Date()): string {
  // Intl.DateTimeFormat com locale en-CA produz formato padronizado YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: ACRE_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(ref);
}

/** Converte Date qualquer para YYYY-MM-DD no fuso Acre. */
export function toAcreISODate(date: Date): string { return todayAcreISODate(date); }

/** Retorna agora em OffsetDateTime string (ISO) no fuso Acre (para logs/debug). */
export function nowAcreOffset(): string {
  const now = new Date();
  // Montar manualmente: pegar componentes no fuso Acre
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ACRE_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(now).reduce((acc: any, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
  const { year, month, day, hour, minute, second } = parts;
  // Offset fixo -05:00 (Acre) — se houver mudança futura de horário de verão será necessário ajustar.
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
}

/** Utilidade: retorna diferença (em dias) entre "hoje Acre" e uma data local (para debug de adiantamento). */
export function debugAcreDaySkew(localRef: Date = new Date()): number {
  const localDay = localRef.getDate();
  const acreDay = parseInt(todayAcreISODate(localRef).slice(8,10), 10);
  return acreDay - localDay; // >0 indica dia de Acre adiantado vs fuso local
}
