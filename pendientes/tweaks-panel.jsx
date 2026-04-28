// ═══════════════════════════════════════════════════════════════
// SHARED DATA — mock realistic data for all 3 directions
// ═══════════════════════════════════════════════════════════════

const PEOPLE = [
  { id: 'jc', name: 'Juan Camilo', role: 'Legal Ops', country: 'CO', avatar: 'JC', color: '#FF4940' },
  { id: 'cf', name: 'Carlos Eduardo Fernández', short: 'Carlos E.', role: 'Country Lead CO', country: 'CO', avatar: 'CE', color: '#5B9BFF' },
  { id: 'ab', name: 'Ana Bravo', role: 'Senior Counsel', country: 'HQ', avatar: 'AB', color: '#A78BFA' },
  { id: 'eg', name: 'Enrique Gonzalez', role: 'Global Legal Head', country: 'HQ', avatar: 'EG', color: '#2DD4A0' },
  { id: 'jm', name: 'Juan Manuel', role: 'Regulatory', country: 'CO', avatar: 'JM', color: '#FFB938' },
  { id: 'mr', name: 'María Restrepo', role: 'Privacy', country: 'MX', avatar: 'MR', color: '#22D3EE' },
];

const PROJECTS = [
  {
    id: 'P-01', name: 'Legal Tracker', country: 'CO', priority: 'Alta', status: 'Activo',
    lead: 'cf', desc: 'Tracker interno para equipos de Legal de Rappi.',
    tasks: 1, completed: 0, dueIn: 14, risk: 'medium', riskReason: '1 tarea sin mover en 9 días',
  },
  {
    id: 'P-02', name: 'Mapping litigio global', country: 'HQ', priority: 'Alta', status: 'Activo',
    lead: 'ab', desc: 'Identificar riesgos a nivel global sobre litigios.',
    tasks: 2, completed: 0, dueIn: 21, risk: 'high', riskReason: '2 tareas vencidas · owner bloqueado',
  },
  {
    id: 'P-03', name: 'Compliance GDPR LATAM', country: 'MX', priority: 'Media', status: 'Activo',
    lead: 'mr', desc: 'Adecuación regional a normativa privacy.',
    tasks: 8, completed: 3, dueIn: 45, risk: 'low', riskReason: 'En ritmo',
  },
];

const TASKS = [
  // Critical — mine, overdue
  { id: 'T-142', name: 'Responder demanda laboral — Bogotá', project: 'P-01', responsible: 'jc', priority: 'Alta', status: 'Bloqueado', deadline: -3, type: 'Contencioso', risk: 'Legal alto', accionable: 'Esperando respuesta de RR.HH. sobre contrato', country: 'CO', blockedBy: 'RR.HH.', daysStale: 4 },
  { id: 'T-138', name: 'Revisar contrato proveedor delivery', project: 'P-01', responsible: 'jc', priority: 'Alta', status: 'En curso', deadline: -1, type: 'Contractual', risk: 'Operativo', accionable: 'Revisar cláusula 7.2 de penalidades', country: 'CO' },
  { id: 'T-156', name: 'Policy de data retention — revisión legal', project: 'P-03', responsible: 'jc', priority: 'Alta', status: 'En revisión', deadline: 0, type: 'Privacy', risk: 'Reputacional', accionable: 'Pendiente firma de Privacy Officer', country: 'MX' },
  { id: 'T-161', name: 'Opinión regulatoria — nuevo método de pago', project: 'P-01', responsible: 'jc', priority: 'Media', status: 'En curso', deadline: 2, type: 'Regulatorio', risk: 'Legal alto', accionable: 'Redactar memorándum inicial', country: 'CO' },

  // Team tasks
  { id: 'T-101', name: 'Auditoría interna Q1', project: 'P-02', responsible: 'ab', priority: 'Alta', status: 'En curso', deadline: 5, type: 'Regulatorio', risk: 'Legal alto', accionable: 'Entrevistas a área de Ops', country: 'HQ' },
  { id: 'T-102', name: 'Términos y condiciones v4', project: 'P-02', responsible: 'ab', priority: 'Alta', status: 'Pendiente', deadline: -2, type: 'Contractual', risk: 'Reputacional', accionable: 'Definir scope con producto', country: 'HQ' },
  { id: 'T-115', name: 'Demanda consumidor — Medellín', project: 'P-01', responsible: 'cf', priority: 'Alta', status: 'En curso', deadline: 1, type: 'Contencioso', risk: 'Legal alto', accionable: 'Audiencia programada 28/04', country: 'CO' },
  { id: 'T-118', name: 'Contrato framework RappiPay', project: 'P-01', responsible: 'cf', priority: 'Media', status: 'En revisión', deadline: 3, type: 'Contractual', risk: 'Operativo', accionable: 'Firma pendiente de CFO', country: 'CO' },
  { id: 'T-120', name: 'NDA con partner estratégico', project: null, responsible: 'cf', priority: 'Baja', status: 'Pendiente', deadline: 7, type: 'Contractual', risk: 'Operativo', accionable: 'Primer draft', country: 'CO' },
  { id: 'T-125', name: 'Respuesta a SIC — reclamación', project: null, responsible: 'jm', priority: 'Alta', status: 'En curso', deadline: -4, type: 'Regulatorio', risk: 'Legal alto', accionable: 'Compilar evidencia', country: 'CO' },
  { id: 'T-128', name: 'Análisis CNBC nueva circular', project: null, responsible: 'jm', priority: 'Media', status: 'Pendiente', deadline: 10, type: 'Regulatorio', risk: 'Operativo', accionable: 'Leer circular 032', country: 'CO' },
  { id: 'T-133', name: 'DPO — revisión de tratamiento', project: 'P-03', responsible: 'mr', priority: 'Media', status: 'En curso', deadline: 4, type: 'Privacy', risk: 'Reputacional', accionable: 'Matriz de riesgo', country: 'MX' },
];

const COUNTRIES = [
  { code: 'CO', name: 'Colombia', lead: 'Carlos E.', active: 15, overdue: 14, blocked: 0, onTime: 50, projects: 1, health: 'critical' },
  { code: 'HQ', name: 'Global', lead: 'Enrique G.', active: 2, overdue: 2, blocked: 0, onTime: null, projects: 1, health: 'risk' },
  { code: 'MX', name: 'México', lead: 'María R.', active: 2, overdue: 0, blocked: 0, onTime: 100, projects: 1, health: 'good' },
  { code: 'BR', name: 'Brasil', lead: '—', active: 0, overdue: 0, blocked: 0, onTime: null, projects: 0, health: 'idle' },
  { code: 'AR', name: 'Argentina', lead: '—', active: 0, overdue: 0, blocked: 0, onTime: null, projects: 0, health: 'idle' },
  { code: 'CR', name: 'Costa Rica', lead: '—', active: 0, overdue: 0, blocked: 0, onTime: null, projects: 0, health: 'idle' },
  { code: 'UY', name: 'Uruguay', lead: '—', active: 0, overdue: 0, blocked: 0, onTime: null, projects: 0, health: 'idle' },
  { code: 'PR', name: 'Perú', lead: '—', active: 0, overdue: 0, blocked: 0, onTime: null, projects: 0, health: 'idle' },
  { code: 'EC', name: 'Ecuador', lead: '—', active: 0, overdue: 0, blocked: 0, onTime: null, projects: 0, health: 'idle' },
  { code: 'CL', name: 'Chile', lead: '—', active: 0, overdue: 0, blocked: 0, onTime: null, projects: 0, health: 'idle' },
];

// Navigation structure — reorganized into logical groups
const NAV = [
  {
    section: 'Para mí',
    items: [
      { id: 'home', label: 'Home', icon: 'home', badge: null },
      { id: 'mistareas', label: 'Mis tareas', icon: 'list', badge: 4 },
    ]
  },
  {
    section: 'Equipo',
    items: [
      { id: 'tracker', label: 'Tracker', icon: 'table', badge: 20 },
      { id: 'proyectos', label: 'Proyectos', icon: 'folder', badge: 3 },
      { id: 'miequipo', label: 'Mi equipo', icon: 'users', badge: null },
    ]
  },
  {
    section: 'Insights',
    items: [
      { id: 'resumen', label: 'Resumen', icon: 'chart', badge: null },
      { id: 'analytics', label: 'Analytics', icon: 'pie', badge: null },
      { id: 'historial', label: 'Historial', icon: 'clock', badge: 3 },
    ]
  },
];

// Smart "what needs my attention" algorithm output — tasks ranked for current user 'jc'
const MY_PRIORITIZED = [
  { task: TASKS[0], reason: 'Bloqueada 4 días · vence -3d', urgency: 'critical' },
  { task: TASKS[1], reason: 'Vence mañana · SLA Alta (2d)', urgency: 'critical' },
  { task: TASKS[2], reason: 'Vence HOY · esperando firma externa', urgency: 'high' },
  { task: TASKS[3], reason: 'SLA Media — empezar hoy para cumplir', urgency: 'medium' },
];

// Team bottlenecks — who's drowning and why
const BOTTLENECKS = [
  {
    person: PEOPLE[0], load: 4, capacity: 5, overdue: 2, blocked: 1,
    verdict: 'Al límite',
    detail: '2 vencidas + 1 bloqueada esperando RR.HH.',
    severity: 'high',
  },
  {
    person: PEOPLE[1], load: 3, capacity: 6, overdue: 1, blocked: 0,
    verdict: 'Con margen',
    detail: 'Puede absorber 2-3 tareas más',
    severity: 'low',
  },
  {
    person: PEOPLE[4], load: 2, capacity: 5, overdue: 1, blocked: 0,
    verdict: 'Vencida SIC',
    detail: 'T-125 lleva 4 días vencida · prioridad Alta',
    severity: 'medium',
  },
];

// Sparkline mock — last 8 weeks of closed tasks
const TREND_8W = [3, 5, 4, 6, 8, 5, 2, 1];

// Make everything available globally
Object.assign(window, {
  PEOPLE, PROJECTS, TASKS, COUNTRIES, NAV, MY_PRIORITIZED, BOTTLENECKS, TREND_8W,
});
