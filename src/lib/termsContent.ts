import { Dog, CalendarDays, X, Heart, ShieldCheck, Lock, Star } from 'lucide-react'
import { formatBusinessHours } from './defaultConfig'
import { WhatsAppIcon as WhatsBrand } from '@/components/ui/SocialIcons'

export const TERMS_LAST_UPDATED = '3 de agosto de 2026'

export const termsSections = [
  {
    icon: Dog,
    title: 'Nuestro compromiso contigo',
    content:
      'En PET Ap nos apasiona lo que hacemos. Cada paseo es una experiencia pensada para la felicidad y el bienestar de tu perro. Nos esforzamos por dar un servicio cuidadoso y comunicarte cualquier incidencia durante el paseo.',
  },
  {
    icon: CalendarDays,
    title: '¿Cómo reservar?',
    content:
      'Reservar es muy fácil: llena el formulario en nuestra página o escríbenos directo por WhatsApp. Te confirmaremos el horario disponible y listo.',
  },
  {
    icon: X,
    title: 'Cancelaciones y cambios',
    content:
      'Entendemos que pasan imprevistos. Puedes cancelar o reagendar sin costo hasta 2 horas antes del paseo desde nuestra página de cancelación o por WhatsApp. Si cancelas después de ese tiempo, te cobraremos el 50% del servicio para cubrir el tiempo apartado.',
  },
  {
    icon: Heart,
    title: 'Salud y seguridad',
    content:
      'La salud de tu perro es lo más importante. Todos los perros deben tener su esquema de vacunación al día para paseos grupales. Para paseos individuales lo recomendamos pero no es obligatorio. Si tu perro tiene alguna condición especial, comportamiento agresivo, o está en celo, por favor infórmanos al agendar para tomar las precauciones necesarias. Así todos disfrutan el paseo.',
  },
  {
    icon: ShieldCheck,
    title: 'Responsabilidad compartida',
    content:
      'Nos comprometemos a cuidar a tu perro como si fuera nuestro. Durante el paseo usamos correa y supervisión constante. Tú como dueño te comprometes a proporcionar información honesta sobre el comportamiento, salud y necesidades de tu mascota. No nos hacemos responsables por incidentes derivados de información no revelada, como agresividad no declarada o condiciones médicas preexistentes.',
  },
  {
    icon: Lock,
    title: 'Tu privacidad importa',
    content:
      'Tus datos personales (nombre, teléfono, dirección) los usamos únicamente para coordinar los paseos, enviarte confirmaciones y recordatorios, y mejorar nuestro servicio. Para operar utilizamos proveedores tecnológicos como Google (inicio de sesión y analítica), Firebase (almacenamiento de datos), Vercel (hospedaje) y WhatsApp (comunicación). No enviamos spam ni vendemos tus datos. Las fotos y videos que tomamos durante los paseos los usamos para la galería solo si tú nos das tu autorización previa; de lo contrario quedan solo en tu reporte privado.',
  },
  {
    icon: Star,
    title: 'Precios justos',
    content:
      'Nuestros precios se muestran en pesos mexicanos (MXN). Creemos en precios accesibles para que más perros disfruten de paseos supervisados. Si algún día ajustamos nuestras tarifas, respetamos el precio acordado en reservaciones ya confirmadas. Los cupones y descuentos tienen vigencia y términos específicos que se indican al momento de aplicarlos.',
  },
  {
    icon: WhatsBrand,
    title: 'Atención al cliente',
    content: `Estamos disponibles por WhatsApp ${formatBusinessHours()
      .map((h) => `${h.weekday} de ${h.hours}`)
      .join(' y ')}. Fuera de horario puedes dejarnos un mensaje y te responderemos en cuanto abramos. Tu opinión nos ayuda a mejorar — después de cada paseo puedes calificar el servicio y dejar tus comentarios.`,
  },
]
