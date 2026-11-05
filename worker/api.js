import { EVENTS } from '../data.js';

const MAX_BODY_BYTES = 720_000;
const MAX_IMAGE_BYTES = 500_000;
const SESSION_COOKIE = 'donde_session';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src https://www.openstreetmap.org https://maps.google.com https://www.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: {
    ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', ...headers,
  } });
}

function textValue(value, field, min, max) {
  if (typeof value !== 'string') throw new ApiError(400, `${field}: escribe un texto válido.`);
  const cleaned = value.normalize('NFC').trim().replace(/[\u0000-\u001F\u007F]/g, ' ');
  if (cleaned.length < min || cleaned.length > max) throw new ApiError(400, `${field}: usa entre ${min} y ${max} caracteres.`);
  return cleaned;
}

export function validateEvent(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'El evento no es válido.');
  const title = textValue(body.title, 'Nombre del evento', 3, 100);
  const venue = textValue(body.venue, 'Nombre del lugar', 2, 80);
  const zone = textValue(body.zone, 'Zona', 2, 60);
  const category = textValue(body.category, 'Categoría', 2, 40);
  const description = textValue(body.description, 'Descripción', 10, 1800);
  const date = textValue(body.date, 'Fecha', 10, 10);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(now);
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date < today) {
    throw new ApiError(400, 'Elige una fecha válida de hoy en adelante.');
  }
  const time = textValue(body.time, 'Hora', 5, 5);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ApiError(400, 'Escribe una hora válida.');
  if (new Date(`${date}T${time}:00-06:00`) <= now) throw new ApiError(400, 'El horario del evento ya pasó. Elegí una hora futura.');
  const { price, lat, lng } = body;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 1_000_000 || Math.round(price) !== price) throw new ApiError(400, 'El precio debe ser un monto entero entre ₡0 y ₡1 000 000.');
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 8 || lat > 12 || lng < -86 || lng > -82) throw new ApiError(400, 'Selecciona una ubicación válida dentro de Costa Rica.');
  if (typeof body.groupEligible !== 'boolean') throw new ApiError(400, 'Indica si el evento participa en el plan de grupo.');
  if (body.groupEligible && price === 0) throw new ApiError(400, 'El beneficio de grupo necesita una entrada con precio mayor a cero.');
  let imageData = '';
  if (body.imageData != null && body.imageData !== '') {
    if (typeof body.imageData !== 'string') throw new ApiError(400, 'La imagen no es válida.');
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.imageData);
    if (!match || match[2].length % 4 !== 0 || Math.floor(match[2].length * 3 / 4) > MAX_IMAGE_BYTES) throw new ApiError(400, 'Usa una imagen JPG, PNG o WebP de hasta 500 KB.');
    imageData = body.imageData;
  }
  return { title, venue, zone, category, description, date, time, price, lat, lng, imageData, groupEligible: body.groupEligible };
}

async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'Envía los datos en formato JSON.');
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new ApiError(413, 'El archivo es demasiado grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Faltan los datos de la solicitud.');
  const chunks = []; let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new ApiError(413, 'El archivo es demasiado grande.'); }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Object expected');
    return body;
  }
  catch { throw new ApiError(400, 'Los datos JSON no son válidos.'); }
}

function sameOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new ApiError(403, 'Abre el sitio para realizar esta acción.');
}

async function session(request) {
  const cookie = request.headers.get('cookie') || '';
  const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const id = value && UUID_RE.test(value) ? value : crypto.randomUUID();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  const sessionHash = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return { sessionHash, headers: value === id ? {} : { 'Set-Cookie': `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` } };
}

function eventFromRow(row) {
  return {
    id: row.id, title: row.title, venue: row.venue, zone: row.zone,
    category: row.category, date: row.event_date, time: row.event_time,
    price: row.price, description: row.description, lat: row.lat, lng: row.lng,
    imageData: row.image_data || '', groupEligible: Boolean(row.group_eligible),
    createdAt: row.created_at, source: 'community', verified: false,
  };
}

async function findEvent(db, id) {
  const seed = EVENTS.find(event => event.id === id);
  if (seed) return seed;
  const row = await db.prepare('SELECT * FROM community_events WHERE id = ?').bind(id).first();
  return row ? eventFromRow(row) : null;
}

function eventExpired(event, now = new Date()) {
  return !event || (!event.demo && new Date(`${event.date}T${event.time}:00-06:00`) <= now);
}

async function groupFromDatabase(db, id, sessionHash) {
  const row = await db.prepare('SELECT id, event_id, event_title, host_name, host_session_hash, created_at FROM groups WHERE id = ?').bind(id).first();
  if (!row) throw new ApiError(404, 'No encontramos este grupo.');
  const result = await db.prepare('SELECT name, session_hash FROM group_members WHERE group_id = ? ORDER BY joined_at, rowid').bind(id).all();
  const members = result.results || [];
  const expired = eventExpired(await findEvent(db, row.event_id));
  return {
    id: row.id, eventId: row.event_id, eventTitle: row.event_title, hostName: row.host_name,
    members: members.map(member => ({ name: member.name })), createdAt: row.created_at,
    memberCount: members.length, friendsConfirmed: Math.max(0, members.length - 1),
    discountEligible: members.length === 5 && !expired, expired,
    isHost: row.host_session_hash === sessionHash,
    isMember: members.some(member => member.session_hash === sessionHash),
  };
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: Boolean(env.DB), persistent: Boolean(env.DB) }, env.DB ? 200 : 503);
    if (!env.DB) throw new ApiError(503, 'El servidor de eventos y grupos todavía no está conectado.');
    const db = env.DB;
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) throw new ApiError(405, 'Este método no está disponible.');
    if (request.method !== 'GET') sameOrigin(request);

    if (url.pathname === '/api/events') {
      if (request.method === 'GET') {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date());
        const result = await db.prepare('SELECT * FROM community_events WHERE event_date >= ? ORDER BY event_date, event_time LIMIT 100').bind(today).all();
        return json({ events: (result.results || []).map(eventFromRow) });
      }
      if (request.method !== 'POST') throw new ApiError(405, 'Este método no está disponible.');
      const event = validateEvent(await readBody(request));
      const { sessionHash, headers } = await session(request);
      // A small per-browser cap limits accidental duplicate submissions without collecting contact data.
      const recent = await db.prepare("SELECT COUNT(*) AS total FROM community_events WHERE creator_session_hash = ? AND created_at > datetime('now', '-1 hour')").bind(sessionHash).first();
      if (recent.total >= 10) throw new ApiError(429, 'Ya publicaste varios eventos. Esperá una hora antes de volver a intentarlo.');
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO community_events (id, title, venue, zone, category, event_date, event_time, price, description, lat, lng, image_data, group_eligible, creator_session_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, event.title, event.venue, event.zone, event.category, event.date, event.time, event.price, event.description, event.lat, event.lng, event.imageData, Number(event.groupEligible), sessionHash).run();
      const row = await db.prepare('SELECT * FROM community_events WHERE id = ?').bind(id).first();
      return json({ event: eventFromRow(row) }, 201, headers);
    }

    if (url.pathname === '/api/groups' && request.method === 'POST') {
      const body = await readBody(request);
      const eventId = textValue(body.eventId, 'Evento', 1, 100);
      const event = await findEvent(db, eventId);
      if (!event) throw new ApiError(404, 'No encontramos el evento de este grupo.');
      if (!event.groupEligible || event.price <= 0) throw new ApiError(400, 'Este evento no participa en el beneficio de grupo.');
      if (eventExpired(event)) throw new ApiError(400, 'El horario del evento ya pasó. Elegí un nuevo plan.');
      const eventTitle = event.title;
      const hostName = textValue(body.hostName, 'Tu nombre', 2, 40);
      const { sessionHash, headers } = await session(request);
      const recent = await db.prepare("SELECT COUNT(*) AS total FROM groups WHERE host_session_hash = ? AND created_at > datetime('now', '-1 hour')").bind(sessionHash).first();
      if (recent.total >= 10) throw new ApiError(429, 'Ya creaste varios grupos. Esperá una hora para crear otro.');
      const id = crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT INTO groups (id, event_id, event_title, host_name, host_session_hash) VALUES (?, ?, ?, ?, ?)').bind(id, eventId, eventTitle, hostName, sessionHash),
        db.prepare('INSERT INTO group_members (group_id, session_hash, name) VALUES (?, ?, ?)').bind(id, sessionHash, hostName),
      ]);
      return json({ group: await groupFromDatabase(db, id, sessionHash) }, 201, headers);
    }

    const match = /^\/api\/groups\/([0-9a-f-]{36})(?:\/(join|membership))?$/.exec(url.pathname);
    if (match && UUID_RE.test(match[1])) {
      const id = match[1], action = match[2];
      const { sessionHash, headers } = await session(request);
      if (!action && request.method === 'GET') return json({ group: await groupFromDatabase(db, id, sessionHash) }, 200, headers);
      if (action === 'join' && request.method === 'POST') {
        const body = await readBody(request);
        const name = textValue(body.name, 'Tu nombre', 2, 40);
        const group = await groupFromDatabase(db, id, sessionHash);
        if (group.expired) throw new ApiError(409, 'El horario de este evento ya pasó. Elegí un nuevo plan.');
        if (group.isMember) throw new ApiError(409, 'Ya estás en este grupo.');
        // Capacity and uniqueness are enforced by one SQL statement and the composite primary key.
        const result = await db.prepare('INSERT OR IGNORE INTO group_members (group_id, session_hash, name) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM group_members WHERE group_id = ?) < 5').bind(id, sessionHash, name, id).run();
        if (!result.meta?.changes) throw new ApiError(409, 'El grupo ya está completo o tu confirmación ya existe.');
        return json({ group: await groupFromDatabase(db, id, sessionHash) }, 200, headers);
      }
      if (action === 'membership' && request.method === 'DELETE') {
        const group = await groupFromDatabase(db, id, sessionHash);
        if (group.isHost) throw new ApiError(409, 'La persona que armó el grupo no puede salir.');
        await db.prepare('DELETE FROM group_members WHERE group_id = ? AND session_hash = ?').bind(id, sessionHash).run();
        return json({ group: await groupFromDatabase(db, id, sessionHash) }, 200, headers);
      }
      throw new ApiError(405, 'Este método no está disponible.');
    }
    throw new ApiError(404, 'No encontramos esta ruta.');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error('Dondeeshoy API request failed', error?.name || 'Error');
    return json({ error: 'No pudimos guardar los cambios. Volvé a intentarlo en un momento.' }, 500);
  }
}
