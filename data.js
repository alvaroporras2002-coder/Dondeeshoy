/**
 * Agenda ilustrativa para presentar el concepto de ¿Dónde es hoy?
 * No representa eventos, precios, promociones ni ubicaciones confirmados.
 * Las coordenadas son puntos aproximados de cada zona, no direcciones de locales.
 */
const COSTA_RICA_ZONE = 'America/Costa_Rica';

function localClock(now = new Date()) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: COSTA_RICA_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now).filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  );
  return {
    date: new Date(Date.UTC(values.year, values.month - 1, values.day)),
    minutes: values.hour * 60 + values.minute
  };
}

const clock = localClock();

function eventDate(days, time) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(clock.date);
  // Al abrir la página de madrugada o al terminar la noche, no anunciamos
  // una hora que ya pasó como si todavía estuviera por comenzar.
  const safeDays = days === 0 && clock.minutes >= hour * 60 + minute ? 1 : days;
  date.setUTCDate(date.getUTCDate() + safeDays);
  return date.toISOString().slice(0, 10);
}

function weekendDate(weekday, time) {
  const offset = (weekday - clock.date.getUTCDay() + 7) % 7;
  const [hour, minute] = time.split(':').map(Number);
  const safeOffset = offset === 0 && clock.minutes >= hour * 60 + minute ? 7 : offset;
  return eventDate(safeOffset, time);
}

export const CATEGORIES = [
  { id: 'all', label: 'Todos los planes', icon: 'sparkles' },
  { id: 'rooftop', label: 'Rooftops & atardeceres', icon: 'sunset' },
  { id: 'electronica', label: 'Electrónica & DJs', icon: 'disc' },
  { id: 'envivo', label: 'Música en vivo', icon: 'music' },
  { id: 'gastro', label: 'Comida & cocteles', icon: 'utensils' },
  { id: 'teatro', label: 'Stand-up & teatro', icon: 'theater' }
];

export const ZONES = ['San José', 'Escazú', 'Santa Ana', 'Heredia'];

export const EVENTS = [
  {
    id: 'demo-sunset',
    title: 'Sunset Beats & Rooftop Sessions',
    venue: 'Skyline Lounge',
    zone: 'Escazú',
    category: 'rooftop',
    date: eventDate(0, '18:00'),
    time: '18:00',
    price: 8000,
    description: 'El atardecer, un buen beat y tus compas. Una propuesta de rooftop para empezar la noche con calma y dejar que el plan siga. Evento de muestra; local, precio y promoción sin confirmar.',
    lat: 9.9196,
    lng: -84.1399,
    image: 'assets/hero-rooftop.webp',
    groupEligible: true,
    tag: 'Atardecer + house',
    demo: true
  },
  {
    id: 'demo-underground',
    title: 'Underground Bass & Red Lights',
    venue: 'Club Vértigo',
    zone: 'San José',
    category: 'electronica',
    date: eventDate(0, '22:00'),
    time: '22:00',
    price: 6000,
    description: 'Bajos profundos, luces y una pista que marca el ritmo de la noche. Armá el grupo y encontrá tu próximo beat. Evento de muestra; no es una programación oficial de este local.',
    lat: 9.9325,
    lng: -84.0796,
    image: 'assets/club-night.webp',
    groupEligible: true,
    tag: 'Hasta que salga el sol',
    demo: true
  },
  {
    id: 'demo-latin',
    title: 'La noche suena a latino',
    venue: 'Patio Sonoro',
    zone: 'Heredia',
    category: 'envivo',
    date: eventDate(0, '20:00'),
    time: '20:00',
    price: 5000,
    description: 'Una banda en vivo, clásicos para cantar y espacio para bailar con tus compas. Vos ponés las ganas; el ritmo hace el resto. Evento y local ilustrativos.',
    lat: 9.9985,
    lng: -84.1179,
    image: 'assets/live-music.webp',
    groupEligible: true,
    tag: 'Banda en vivo',
    demo: true
  },
  {
    id: 'demo-mesa',
    title: 'Mesa larga, buenas historias',
    venue: 'Jardín del Oeste',
    zone: 'Santa Ana',
    category: 'gastro',
    date: eventDate(1, '19:00'),
    time: '19:00',
    price: 0,
    description: 'Un jardín, sabores para compartir y una conversación sin prisa. Una idea para reunirte después del brete. Entrada ilustrativa sin costo; consumo aparte. Evento y local de muestra.',
    lat: 9.9324,
    lng: -84.1818,
    image: 'assets/hero-rooftop.webp',
    groupEligible: false,
    tag: 'Después del brete',
    demo: true
  },
  {
    id: 'demo-jazz',
    title: 'Jazz bajo las luces',
    venue: 'Cava & Sonido',
    zone: 'Escazú',
    category: 'envivo',
    date: weekendDate(5, '20:30'),
    time: '20:30',
    price: 7000,
    description: 'Música cerquita, luz cálida y una noche para escuchar algo distinto. Elegí buena compañía y dejá que el jazz haga su parte. Evento y local ilustrativos.',
    lat: 9.9294,
    lng: -84.1442,
    image: 'assets/live-music.webp',
    groupEligible: true,
    tag: 'Una noche diferente',
    demo: true
  },
  {
    id: 'demo-risas',
    title: 'Cero estrés, muchas risas',
    venue: 'La Esquina Escénica',
    zone: 'San José',
    category: 'teatro',
    date: weekendDate(6, '20:00'),
    time: '20:00',
    price: 6500,
    description: 'Stand-up en formato íntimo para soltar la semana a carcajadas. Llegá con tus compas y descubrí un plan fuera de lo de siempre. Evento y local de muestra.',
    lat: 9.9363,
    lng: -84.0647,
    image: 'assets/live-music.webp',
    groupEligible: false,
    tag: 'Plan para reírse',
    demo: true
  }
];
