const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJSTDate(date) {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

function formatJST(date) {
  const jst = toJSTDate(date);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  const h = String(jst.getUTCHours()).padStart(2, '0');
  const min = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${h}:${min} JST`;
}

function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { toJSTDate, formatJST, toISODateString };
