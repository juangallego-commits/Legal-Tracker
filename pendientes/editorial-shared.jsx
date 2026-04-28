// ═══════════════════════════════════════════════════════════════
// EDITORIAL — Extended data with roles, ETAs, overdue
// ═══════════════════════════════════════════════════════════════

const ED_PEOPLE = {
  specialist: { id: 'jc', name: 'Juan Camilo', short: 'JC', role: 'Legal Ops', country: 'Colombia', avatar: 'JC', color: '#B8551F', streak: 7, avgAlta: '1.8d', avgMedia: '3.2d', avgBaja: '4.5d' },
  manager: { id: 'cf', name: 'Carlos E. Fernández', short: 'CF', role: 'Country Lead · CO', country: 'Colombia', avatar: 'CF', color: '#4A6B8A', team: 4 },
  hq: { id: 'eg', name: 'Enrique Gonzalez', short: 'EG', role: 'Global Legal Head', country: 'Global', avatar: 'EG', color: '#3D5A4A', countries: 10 },
};

const ED_TEAM = [
  { id: 'jc', name: 'Juan Camilo', role: 'Legal Ops', avatar: 'JC', color: '#B8551F', load: 4, capacity: 5, overdue: 2, blocked: 1 },
  { id: 'jm', name: 'Juan Manuel', role: 'Regulatory', avatar: 'JM', color: '#A57F2C', load: 2, capacity: 5, overdue: 1, blocked: 0 },
  { id: 'mr', name: 'María Restrepo', role: 'Privacy', avatar: 'MR', color: '#3D6478', load: 2, capacity: 5, overdue: 0, blocked: 0 },
  { id: 'ab', name: 'Ana Bravo', role: 'Senior Counsel', avatar: 'AB', color: '#6B4D7A', load: 3, capacity: 6, overdue: 1, blocked: 0 },
];

const ED_TASKS_MINE = [
  { id: 'T-142', name: 'Responder demanda laboral — Bogotá', project: 'Mapping litigio CO', priority: 'Alta', status: 'Bloqueado', deadline: -3, eta: 'venció hace 3d', accionable: 'Esperando respuesta de RR.HH. sobre contrato', blocked: 'RR.HH. — 4 días sin respuesta', sla: '2d' },
  { id: 'T-138', name: 'Revisar contrato proveedor delivery', project: 'Legal Tracker', priority: 'Alta', status: 'En curso', deadline: -1, eta: 'venció ayer', accionable: 'Revisar cláusula 7.2 de penalidades', sla: '2d' },
  { id: 'T-156', name: 'Policy de data retention — revisión legal', project: 'Compliance GDPR', priority: 'Alta', status: 'En revisión', deadline: 0, eta: 'vence HOY', accionable: 'Pendiente firma de Privacy Officer', sla: '2d' },
  { id: 'T-161', name: 'Opinión regulatoria — nuevo método de pago', project: 'Legal Tracker', priority: 'Media', status: 'En curso', deadline: 1, eta: 'mañana', accionable: 'Redactar memorándum inicial', sla: '5d' },
  { id: 'T-172', name: 'Revisar términos partner logística', project: null, priority: 'Media', status: 'Pendiente', deadline: 3, eta: 'en 3 días', accionable: 'Primer draft', sla: '5d' },
  { id: 'T-178', name: 'NDA con startup de pagos', project: null, priority: 'Baja', status: 'Pendiente', deadline: 6, eta: 'en 6 días', accionable: 'Esperar template legal', sla: '7d' },
  { id: 'T-180', name: 'Análisis circular CNBC 032', project: null, priority: 'Media', status: 'Pendiente', deadline: 8, eta: 'en 8 días', accionable: 'Lectura preliminar', sla: '5d' },
];

// Group buckets for "Tus tareas agrupadas" intermediate view
const ED_BUCKETS_MINE = {
  overdue: ED_TASKS_MINE.filter(t => t.deadline < 0),
  today: ED_TASKS_MINE.filter(t => t.deadline === 0),
  thisWeek: ED_TASKS_MINE.filter(t => t.deadline >= 1 && t.deadline <= 5),
  later: ED_TASKS_MINE.filter(t => t.deadline > 5),
  blocked: ED_TASKS_MINE.filter(t => t.status === 'Bloqueado'),
};

const ED_PROJECTS_MINE = [
  { id: 'P-01', name: 'Legal Tracker', role: 'Owner', tasks: 3, completed: 0, deadline: 14, lead: 'Carlos E.', participants: 4 },
  { id: 'P-02', name: 'Mapping litigio CO', role: 'Participante', tasks: 1, completed: 0, deadline: 21, lead: 'Ana Bravo', participants: 6 },
  { id: 'P-03', name: 'Compliance GDPR LATAM', role: 'Participante', tasks: 1, completed: 0, deadline: 45, lead: 'María R.', participants: 5 },
];

// All tracker tasks (for tracker view — manager/hq see everyone, specialist sees only theirs)
const ED_TRACKER = [
  { id: 'T-142', name: 'Responder demanda laboral — Bogotá', project: 'Mapping litigio CO', resp: 'jc', priority: 'Alta', status: 'Bloqueado', deadline: -3, type: 'Contencioso', risk: 'Legal alto', country: 'CO' },
  { id: 'T-138', name: 'Revisar contrato proveedor delivery', project: 'Legal Tracker', resp: 'jc', priority: 'Alta', status: 'En curso', deadline: -1, type: 'Contractual', risk: 'Operativo', country: 'CO' },
  { id: 'T-125', name: 'Respuesta a SIC — reclamación', project: null, resp: 'jm', priority: 'Alta', status: 'En curso', deadline: -4, type: 'Regulatorio', risk: 'Legal alto', country: 'CO' },
  { id: 'T-115', name: 'Demanda consumidor — Medellín', project: 'Legal Tracker', resp: 'cf', priority: 'Alta', status: 'En curso', deadline: 1, type: 'Contencioso', risk: 'Legal alto', country: 'CO' },
  { id: 'T-156', name: 'Policy de data retention — revisión legal', project: 'Compliance GDPR', resp: 'jc', priority: 'Alta', status: 'En revisión', deadline: 0, type: 'Privacy', risk: 'Reputacional', country: 'MX' },
  { id: 'T-101', name: 'Auditoría interna Q1', project: 'Mapping litigio CO', resp: 'ab', priority: 'Alta', status: 'En curso', deadline: 5, type: 'Regulatorio', risk: 'Legal alto', country: 'HQ' },
  { id: 'T-102', name: 'Términos y condiciones v4', project: 'Mapping litigio CO', resp: 'ab', priority: 'Alta', status: 'Pendiente', deadline: -2, type: 'Contractual', risk: 'Reputacional', country: 'HQ' },
  { id: 'T-161', name: 'Opinión regulatoria — método de pago', project: 'Legal Tracker', resp: 'jc', priority: 'Media', status: 'En curso', deadline: 1, type: 'Regulatorio', risk: 'Legal alto', country: 'CO' },
  { id: 'T-118', name: 'Contrato framework RappiPay', project: 'Legal Tracker', resp: 'cf', priority: 'Media', status: 'En revisión', deadline: 3, type: 'Contractual', risk: 'Operativo', country: 'CO' },
  { id: 'T-133', name: 'DPO — revisión de tratamiento', project: 'Compliance GDPR', resp: 'mr', priority: 'Media', status: 'En curso', deadline: 4, type: 'Privacy', risk: 'Reputacional', country: 'MX' },
  { id: 'T-128', name: 'Análisis CNBC nueva circular', project: null, resp: 'jm', priority: 'Media', status: 'Pendiente', deadline: 10, type: 'Regulatorio', risk: 'Operativo', country: 'CO' },
  { id: 'T-120', name: 'NDA con partner estratégico', project: null, resp: 'cf', priority: 'Baja', status: 'Pendiente', deadline: 7, type: 'Contractual', risk: 'Operativo', country: 'CO' },
];

const ED_NAV_BY_ROLE = {
  specialist: [
    { section: 'Mi día', items: [{id:'home',label:'Inicio',badge:null},{id:'mistareas',label:'Mis tareas',badge:7},{id:'agrupadas',label:'Por urgencia',badge:null}]},
    { section: 'Donde participo', items: [{id:'proyectos',label:'Mis proyectos',badge:3},{id:'historial',label:'Cerradas',badge:null}]},
  ],
  manager: [
    { section: 'Mi día', items: [{id:'home',label:'Inicio',badge:null},{id:'mistareas',label:'Mis tareas',badge:3}]},
    { section: 'Equipo', items: [{id:'tracker',label:'Tracker',badge:11},{id:'miequipo',label:'Mi equipo',badge:null},{id:'proyectos',label:'Proyectos',badge:3}]},
    { section: 'Insights', items: [{id:'analytics',label:'Analytics',badge:null},{id:'historial',label:'Historial',badge:null}]},
  ],
  hq: [
    { section: 'Visión', items: [{id:'home',label:'Inicio global',badge:null},{id:'paises',label:'Por país',badge:10}]},
    { section: 'Operación', items: [{id:'tracker',label:'Tracker global',badge:20},{id:'proyectos',label:'Proyectos',badge:3},{id:'miequipo',label:'Equipos',badge:null}]},
    { section: 'Insights', items: [{id:'analytics',label:'Analytics',badge:null},{id:'historial',label:'Historial',badge:null}]},
  ],
};

Object.assign(window, { ED_PEOPLE, ED_TEAM, ED_TASKS_MINE, ED_BUCKETS_MINE, ED_PROJECTS_MINE, ED_TRACKER, ED_NAV_BY_ROLE });
