import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Calendar, Clock, CheckCircle2, ListTodo,
  FolderKanban, ChevronRight, Search, Megaphone, ClipboardList,
  Activity, AlertCircle, PackageCheck, ShieldAlert, TrendingUp,
  TrendingDown, Minus, Target, Building2, BarChart3
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, PieChart, Pie, Cell
} from "recharts";
import { PlatformReportPDF } from "@/components/PlatformReportPDF";

/* ─── Types ─────────────────────────────────────────────── */
interface User { id: number; email: string; role: string; cargo: string; unidade: string; nome?: string }
interface Projeto { id: number; nome: string; status: string; coordenadorId: number | null; empreendimentoId: number }
interface Empreendimento { id: number; nome: string; cliente: string; unidade: string; coordenadorId?: number }
interface Campanha { id: number; nome: string; empreendimentoId: number; periodoInicio: string; periodoFim: string; descricao: string | null; status?: string | null; motivoStatus?: string | null }
interface CronogramaItem { id: number; titulo: string; tipo: string; status: string; prioridade: string; dataInicio: string | null; dataFim: string | null; concluido: boolean; empreendimentoId: number | null; projetoId: number | null; responsavel: string | null; descricao: string | null }
interface Demanda { id: number; titulo: string; status: string; prioridade: string; dataEntrega: string | null; descricao: string | null; empreendimentoId: number | null; responsavelId: number | null }
interface Entregavel { id: number; titulo: string; tipo: string; prazo: string; status: string; responsavel: string | null; empreendimentoId: number | null; descricao: string | null }
interface Risco { id: number; titulo: string; nivelRisco: string; status: string; empreendimentoId: number }
type SourceType = 'campanha' | 'cronograma' | 'demanda' | 'entregavel';
interface AgendaItem { id: number; source: SourceType; titulo: string; tipo: string; empreendimentoId: number | null; empreendimentoNome: string; prazo: string; dias: number; status: string; descricao: string | null }

/* ─── Campaign status config ─────────────────────────────── */
const CAMP_ST: Record<string, { label: string; color: string; bg: string }> = {
  planejada:    { label: "Planejada",    color: "#155e75", bg: "#ecfeff" },
  em_andamento: { label: "Em Andamento", color: "#0e7490", bg: "#ecfeff" },
  atrasada:     { label: "Atrasada",     color: "#9a3a0a", bg: "#fff7ed" },
  suspensa:     { label: "Suspensa",     color: "#164e63", bg: "#ecfeff" },
  cancelada:    { label: "Cancelada",    color: "#7c2d12", bg: "#ffedd5" },
  encerrada:    { label: "Encerrada",    color: "#475569", bg: "#f1f5f9" },
  concluida:    { label: "Concluída",    color: "#134e4a", bg: "#ccfbf1" },
};

/* ─── Helpers ────────────────────────────────────────────── */
function daysUntil(d: string | null | undefined): number {
  if (!d) return 9999;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(d + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}
function fmt(d: string | null) { return d ? d.split('-').reverse().join('/') : '—'; }

type UrgLevel = 'overdue' | 'urgent' | 'soon' | 'upcoming' | 'ok';
function urgency(dias: number): UrgLevel {
  if (dias < 0) return 'overdue';
  if (dias <= 7) return 'urgent';
  if (dias <= 30) return 'soon';
  if (dias <= 90) return 'upcoming';
  return 'ok';
}

const URG = {
  overdue:  { label: 'Vencido',      color: '#c2410c', badge: 'bg-orange-100 text-orange-800', border: 'border-l-orange-700', dot: 'bg-orange-700' },
  urgent:   { label: 'Esta semana',  color: '#ea580c', badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-500', dot: 'bg-orange-500' },
  soon:     { label: '30 dias',      color: '#f97316', badge: 'bg-orange-50 text-orange-600',  border: 'border-l-orange-400', dot: 'bg-orange-400' },
  upcoming: { label: '90 dias',      color: '#0099a8', badge: 'bg-cyan-100 text-cyan-800',     border: 'border-l-cyan-500',   dot: 'bg-cyan-500' },
  ok:       { label: 'Ok',           color: '#0e7490', badge: 'bg-cyan-100 text-cyan-900',     border: 'border-l-cyan-600',   dot: 'bg-cyan-600' },
};

const SRC_ICON: Record<SourceType, any> = { campanha: Megaphone, cronograma: ClipboardList, demanda: ListTodo, entregavel: PackageCheck };
const SRC_LABEL: Record<SourceType, string> = { campanha: 'Campanha', cronograma: 'Cronograma', demanda: 'Demanda', entregavel: 'Entregável' };
const SRC_COLOR: Record<SourceType, string> = { campanha: '#ea580c', cronograma: '#0099a8', demanda: '#0e7490', entregavel: '#06b6d4' };

type HealthLevel = 'critico' | 'atencao' | 'ok';
const HEALTH_CFG = {
  critico: { label: 'Crítico',   icon: TrendingDown, color: '#c2410c', bg: 'bg-orange-50 border-orange-200', gradient: 'from-orange-600 to-orange-800' },
  atencao: { label: 'Atenção',   icon: Minus,        color: '#ea580c', bg: 'bg-orange-50 border-orange-200', gradient: 'from-orange-500 to-orange-600' },
  ok:      { label: 'No prazo',  icon: TrendingUp,   color: '#0099a8', bg: 'bg-cyan-50 border-cyan-200',     gradient: 'from-cyan-500 to-teal-600' },
};

function calcHealth(emprId: number, items: AgendaItem[], riscos: Risco[]): HealthLevel {
  const it = items.filter(i => i.empreendimentoId === emprId);
  const od = it.filter(i => i.dias < 0).length;
  const ur = it.filter(i => i.dias >= 0 && i.dias <= 7).length;
  const cr = riscos.filter(r => r.empreendimentoId === emprId && r.nivelRisco === 'critico' && r.status !== 'encerrado').length;
  const hi = riscos.filter(r => r.empreendimentoId === emprId && r.nivelRisco === 'alto'    && r.status !== 'encerrado').length;
  if (od > 2 || cr > 0) return 'critico';
  if (od > 0 || ur > 2 || hi > 0) return 'atencao';
  return 'ok';
}

function campaignPct(inicio: string, fim: string) {
  const n = Date.now(), s = new Date(inicio).getTime(), e = new Date(fim).getTime();
  if (n < s) return -1;
  if (n > e) return 100;
  return Math.round((n - s) / (e - s) * 100);
}

/* ─── Sub-components ─────────────────────────────────────── */
function KpiHero({ label, value, icon: Icon, sub, gradient, onClick }: {
  label: string; value: number; icon: any; sub?: string; gradient: string; onClick?: () => void;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${gradient} text-white shadow-md cursor-pointer hover:shadow-lg transition-shadow`} onClick={onClick}>
      <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-white/10" />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/70 text-[11px] font-medium uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-white/80" />
        </div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
        {sub && <p className="text-white/60 text-[11px] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CampaignTimeline({ campanha, emprNome }: { campanha: Campanha; emprNome: string }) {
  const pct = campaignPct(campanha.periodoInicio, campanha.periodoFim);
  const isFuture = pct === -1;
  const isPast = pct === 100;
  const dias = isFuture ? daysUntil(campanha.periodoInicio) : isPast ? null : daysUntil(campanha.periodoFim);

  // Use manual status from DB if set, otherwise auto from dates
  const manualKey = campanha.status && CAMP_ST[campanha.status] ? campanha.status : null;
  const autoKey = isFuture ? "planejada" : isPast ? "concluida" : "em_andamento";
  const st = CAMP_ST[manualKey ?? autoKey];

  return (
    <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">{campanha.nome}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Building2 className="h-3 w-3" />{emprNome}</p>
        </div>
        <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
        <Calendar className="h-3 w-3" />
        <span>{fmt(campanha.periodoInicio)} → {fmt(campanha.periodoFim)}</span>
        {dias !== null && <span className="font-semibold ml-auto" style={{ color: st.color }}>{isFuture ? `em ${dias}d` : `${dias}d restantes`}</span>}
      </div>
      {!isPast && (
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(isFuture ? 0 : pct, 0)}%`, background: `linear-gradient(90deg, ${st.color}, ${st.color}cc)` }} />
        </div>
      )}
    </div>
  );
}

function AgendaRow({ item, onClick }: { item: AgendaItem; onClick: () => void }) {
  const u = urgency(item.dias);
  const cfg = URG[u];
  const Icon = SRC_ICON[item.source];
  const diasTxt = item.dias < 0 ? `${Math.abs(item.dias)}d atraso` : item.dias === 0 ? 'Hoje' : `${item.dias}d`;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border border-l-4 ${cfg.border} border-white/10 bg-card/60 hover:bg-white/5 hover:shadow-sm transition-all cursor-pointer`} onClick={onClick}>
      <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: SRC_COLOR[item.source] + '15' }}>
        <Icon className="h-3.5 w-3.5" style={{ color: SRC_COLOR[item.source] }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{item.titulo}</p>
        <p className="text-xs text-muted-foreground truncate">{item.empreendimentoNome} · {SRC_LABEL[item.source]}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:block">{fmt(item.prazo)}</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{diasTxt}</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

function SectionGroup({ label, color, items, onClick }: { label: string; color: string; items: AgendaItem[]; onClick: (i: AgendaItem) => void }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label} ({items.length})</span>
      </div>
      <div className="space-y-1.5">
        {items.map(i => <AgendaRow key={`${i.source}-${i.id}`} item={i} onClick={() => onClick(i)} />)}
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function DashboardCoordenador() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<SourceType | 'all'>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'overdue' | 'urgent' | 'soon' | 'upcoming'>('all');
  const [selectedProj, setSelectedProj] = useState<string>('todos');
  const [showAllCamp, setShowAllCamp] = useState(false);

  const { data: user, isLoading: ul } = useQuery<User>({ queryKey: ['/api/auth/me'] });
  const { data: projetos = [], isLoading: pl } = useQuery<Projeto[]>({ queryKey: ['/api/projetos'] });
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ['/api/empreendimentos'] });
  const { data: campanhas = [] } = useQuery<Campanha[]>({ queryKey: ['/api/campanhas'] });
  const { data: cronograma = [] } = useQuery<CronogramaItem[]>({ queryKey: ['/api/cronograma'] });
  const { data: demandas = [] } = useQuery<Demanda[]>({ queryKey: ['/api/minhas-demandas'] });
  const { data: entregaveis = [] } = useQuery<Entregavel[]>({ queryKey: ['/api/entregaveis'] });
  const { data: riscos = [] } = useQuery<Risco[]>({ queryKey: ['/api/riscos'] });

  const isAdmin = user?.role === 'admin' || user?.role === 'diretor';
  const emprMap = useMemo(() => new Map(empreendimentos.map(e => [e.id, e])), [empreendimentos]);
  const myProjects = useMemo(() => isAdmin ? projetos : projetos.filter(p => p.coordenadorId === user?.id), [projetos, user, isAdmin]);
  const myEmprs = useMemo(() => isAdmin ? empreendimentos : empreendimentos.filter(e => e.coordenadorId === user?.id), [empreendimentos, user, isAdmin]);
  const myEmprIds = useMemo(() => new Set([...myProjects.map(p => p.empreendimentoId), ...myEmprs.map(e => e.id)]), [myProjects, myEmprs]);
  const emprNome = (id: number | null) => id ? (emprMap.get(id)?.nome || `#${id}`) : '—';

  const agendaItems = useMemo<AgendaItem[]>(() => {
    const items: AgendaItem[] = [];
    campanhas.filter(c => isAdmin || myEmprIds.has(c.empreendimentoId)).forEach(c => {
      const dias = daysUntil(c.periodoFim);
      if (dias > 180 || dias < -30) return;
      items.push({ id: c.id, source: 'campanha', titulo: c.nome, tipo: 'campanha', empreendimentoId: c.empreendimentoId, empreendimentoNome: emprNome(c.empreendimentoId), prazo: c.periodoFim, dias, status: 'ativo', descricao: c.descricao });
    });
    cronograma.filter(c => !c.concluido && c.status !== 'concluido' && c.dataFim && (isAdmin || c.empreendimentoId ? myEmprIds.has(c.empreendimentoId!) : true)).forEach(c => {
      const dias = daysUntil(c.dataFim);
      if (dias > 180) return;
      items.push({ id: c.id, source: 'cronograma', titulo: c.titulo, tipo: c.tipo || 'etapa', empreendimentoId: c.empreendimentoId, empreendimentoNome: emprNome(c.empreendimentoId), prazo: c.dataFim!, dias, status: c.status, descricao: c.descricao });
    });
    demandas.filter(d => d.status !== 'concluida' && d.status !== 'cancelada' && d.dataEntrega).forEach(d => {
      const dias = daysUntil(d.dataEntrega);
      if (dias > 180) return;
      items.push({ id: d.id, source: 'demanda', titulo: d.titulo, tipo: 'tarefa', empreendimentoId: d.empreendimentoId, empreendimentoNome: emprNome(d.empreendimentoId), prazo: d.dataEntrega!, dias, status: d.status, descricao: d.descricao });
    });
    entregaveis.filter(e => e.status !== 'aprovado' && e.status !== 'cancelado' && (isAdmin || e.empreendimentoId ? myEmprIds.has(e.empreendimentoId!) : true)).forEach(e => {
      const dias = daysUntil(e.prazo);
      if (dias > 180) return;
      items.push({ id: e.id, source: 'entregavel', titulo: e.titulo, tipo: e.tipo || 'documento', empreendimentoId: e.empreendimentoId, empreendimentoNome: emprNome(e.empreendimentoId), prazo: e.prazo, dias, status: e.status, descricao: e.descricao });
    });
    return items.sort((a, b) => a.dias - b.dias);
  }, [campanhas, cronograma, demandas, entregaveis, myEmprIds, isAdmin]);

  const filtered = useMemo(() => {
    let r = agendaItems;
    if (filterSource !== 'all') r = r.filter(i => i.source === filterSource);
    if (filterUrgency !== 'all') r = r.filter(i => urgency(i.dias) === filterUrgency);
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(i => i.titulo.toLowerCase().includes(q) || i.empreendimentoNome.toLowerCase().includes(q)); }
    if (selectedProj !== 'todos') { const id = parseInt(selectedProj); r = r.filter(i => i.empreendimentoId === id); }
    return r;
  }, [agendaItems, filterSource, filterUrgency, search, selectedProj]);

  const overdueItems = agendaItems.filter(i => i.dias < 0);
  const urgentItems  = agendaItems.filter(i => i.dias >= 0 && i.dias <= 7);
  const soonItems    = agendaItems.filter(i => i.dias > 7 && i.dias <= 30);
  const upcomingItems= agendaItems.filter(i => i.dias > 30 && i.dias <= 90);

  const projectHealth = useMemo(() => myProjects.map(p => {
    const h = calcHealth(p.empreendimentoId, agendaItems, riscos);
    const it = agendaItems.filter(i => i.empreendimentoId === p.empreendimentoId);
    const rs = riscos.filter(r => r.empreendimentoId === p.empreendimentoId && r.status !== 'encerrado' && r.status !== 'mitigado');
    return { ...p, empreendimento: emprMap.get(p.empreendimentoId)?.nome || p.nome, health: h, overdueCount: it.filter(i => i.dias < 0).length, urgentCount: it.filter(i => i.dias >= 0 && i.dias <= 7).length, totalPendentes: it.length, riscoCritico: rs.filter(r => r.nivelRisco === 'critico').length, riscoAlto: rs.filter(r => r.nivelRisco === 'alto').length };
  }), [myProjects, agendaItems, riscos, emprMap]);

  // Campanhas para timeline
  const now = Date.now();
  const campAtivas   = campanhas.filter(c => new Date(c.periodoInicio).getTime() <= now && new Date(c.periodoFim).getTime() >= now);
  const campFuturas  = campanhas.filter(c => new Date(c.periodoInicio).getTime() > now).sort((a,b) => new Date(a.periodoInicio).getTime() - new Date(b.periodoInicio).getTime());
  const campRecentes = campanhas.filter(c => new Date(c.periodoFim).getTime() < now).sort((a,b) => new Date(b.periodoFim).getTime() - new Date(a.periodoFim).getTime());
  const campTimeline = [...campAtivas, ...campFuturas, ...campRecentes];
  const campDisplay  = showAllCamp ? campTimeline : campTimeline.slice(0, 4);

  // Chart data
  const urgencyChart = [
    { name: 'Vencidos', value: overdueItems.length, fill: '#c2410c' },
    { name: 'Semana', value: urgentItems.length, fill: '#ea580c' },
    { name: '30 dias', value: soonItems.length, fill: '#f97316' },
    { name: '90 dias', value: upcomingItems.length, fill: '#0099a8' },
  ].filter(d => d.value > 0);

  const sourceChart = [
    { name: 'Campanhas', value: agendaItems.filter(i => i.source === 'campanha').length, fill: '#ea580c' },
    { name: 'Cronograma', value: agendaItems.filter(i => i.source === 'cronograma').length, fill: '#0099a8' },
    { name: 'Demandas', value: agendaItems.filter(i => i.source === 'demanda').length, fill: '#0e7490' },
    { name: 'Entregáveis', value: agendaItems.filter(i => i.source === 'entregavel').length, fill: '#06b6d4' },
  ].filter(d => d.value > 0);

  function handleItemClick(item: AgendaItem) { if (item.empreendimentoId) navigate(`/empreendimentos/${item.empreendimentoId}`); }


  if (ul || pl) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      </div>
    );
  }

  const userName = user?.nome?.split(' ')[0] || user?.email?.split('@')[0] || 'Coordenador';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="min-h-screen bg-background eco-fade-up">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Hero Header ─────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl premium-gradient-accent text-white p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-20 translate-x-20" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-16 -translate-x-12" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-white/75 text-xs font-semibold uppercase tracking-wider">{saudacao}, {userName}</p>
                <h1 className="text-3xl font-black mt-0.5 tracking-tight">Meu Painel de Controle</h1>
                <p className="text-white/60 text-xs mt-1">{user?.cargo || 'Coordenador'} · SGAI</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <PlatformReportPDF buttonVariant="secondary" buttonSize="sm" />
              </div>
            </div>
            {overdueItems.length > 0 && (
              <div className="mt-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2 w-fit">
                <AlertCircle className="h-4 w-4 text-white animate-pulse" />
                <span className="text-sm font-semibold text-white">{overdueItems.length} item{overdueItems.length > 1 ? 'ns' : ''} vencido{overdueItems.length > 1 ? 's' : ''} requer{overdueItems.length === 1 ? '' : 'em'} atenção imediata</span>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI Row ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiHero label="Projetos" value={myProjects.length + myEmprs.length} icon={FolderKanban}
            sub="sob responsabilidade" gradient="premium-gradient-primary"
            onClick={() => navigate('/empreendimentos')} />
          <KpiHero label="Vencidos" value={overdueItems.length} icon={AlertCircle}
            sub={overdueItems.length > 0 ? "ação imediata!" : "tudo ok"}
            gradient={overdueItems.length > 0 ? "bg-gradient-to-br from-red-700 to-red-900" : "premium-gradient-accent"}
            onClick={() => { setFilterUrgency('overdue'); document.getElementById('agenda-section')?.scrollIntoView({ behavior: 'smooth' }); }} />
          <KpiHero label="Esta semana" value={urgentItems.length} icon={Clock}
            sub="vencimentos próximos" gradient="bg-gradient-to-br from-amber-600 to-amber-800"
            onClick={() => { setFilterUrgency('urgent'); document.getElementById('agenda-section')?.scrollIntoView({ behavior: 'smooth' }); }} />
          <KpiHero label="Campanhas" value={campanhas.length} icon={Target}
            sub={`${campAtivas.length} ativa${campAtivas.length !== 1 ? 's' : ''}`}
            gradient="bg-gradient-to-br from-indigo-600 to-indigo-800" />
        </div>

        {/* ── Campanhas + Charts row ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Campaign timeline */}
          <Card className="premium-card lg:col-span-2 border-0 shadow-sm bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-teal-100 dark:bg-teal-900/40 rounded-lg">
                    <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  Campanhas de Campo
                  {campAtivas.length > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">{campAtivas.length} ativa{campAtivas.length !== 1 ? 's' : ''}</span>}
                </CardTitle>
                {campTimeline.length > 4 && (
                  <button className="text-xs text-primary hover:underline" onClick={() => { setShowAllCamp(!showAllCamp); }}>
                    {showAllCamp ? 'Menos' : `+${campTimeline.length - 4} mais`}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {campTimeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center"><Target className="h-6 w-6 text-teal-400" /></div>
                  <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {campDisplay.map(c => <CampaignTimeline key={c.id} campanha={c} emprNome={emprNome(c.empreendimentoId)} />)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Urgency + Source mini charts */}
          <div className="space-y-4">
            <Card className="premium-card">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" /> Por Urgência
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {urgencyChart.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">Tudo em dia!</div>
                ) : (
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={urgencyChart} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                      <RTooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {urgencyChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="premium-card">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {sourceChart.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">Sem pendências</div>
                ) : (
                  <div className="space-y-2">
                    {sourceChart.map(s => (
                      <div key={s.name}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-muted-foreground">{s.name}</span>
                          <span className="font-bold">{s.value}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(s.value / agendaItems.length * 100).toFixed(0)}%`, background: s.fill }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Project Health ───────────────────────────── */}
        {projectHealth.length > 0 && (
          <Card className="premium-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="p-1.5 bg-violet-100 dark:bg-violet-900/40 rounded-lg">
                  <Activity className="h-4 w-4 text-violet-600" />
                </div>
                Saúde dos Projetos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {projectHealth.map(p => {
                  const cfg = HEALTH_CFG[p.health];
                  const Icon = cfg.icon;
                  return (
                    <div key={p.id} className={`rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all ${cfg.bg}`}
                      onClick={() => navigate(`/empreendimentos/${p.empreendimentoId}`)}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate text-gray-900 dark:text-gray-100">{p.empreendimento}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.nome}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 font-bold text-xs" style={{ color: cfg.color }}>
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {p.overdueCount > 0 && <span className="font-semibold text-red-600">🔴 {p.overdueCount} vencidos</span>}
                        {p.urgentCount > 0 && <span className="font-semibold text-orange-500">🟠 {p.urgentCount} esta semana</span>}
                        {p.riscoCritico > 0 && <span className="font-semibold text-red-600 flex items-center gap-0.5"><ShieldAlert className="h-3 w-3" />{p.riscoCritico} crítico</span>}
                        {p.riscoAlto > 0 && <span className="font-semibold text-orange-500 flex items-center gap-0.5"><ShieldAlert className="h-3 w-3" />{p.riscoAlto} alto</span>}
                        {p.overdueCount === 0 && p.urgentCount === 0 && p.riscoCritico === 0 && (
                          <span className="text-emerald-600">✓ {p.totalPendentes} pendência{p.totalPendentes !== 1 ? 's' : ''} sob controle</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Agenda / Filters ─────────────────────────── */}
        <div id="agenda-section" className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-44">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar item..." className="pl-8 h-8 text-xs rounded-xl bg-card border-white/10 text-foreground" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'campanha', 'cronograma', 'demanda', 'entregavel'] as const).map(s => (
                <button key={s} onClick={() => setFilterSource(s)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${filterSource === s ? 'bg-primary text-primary-foreground font-semibold' : 'bg-card text-muted-foreground border border-white/10 hover:text-foreground hover:bg-white/5'}`}>
                  {s === 'all' ? 'Tudo' : s === 'campanha' ? 'Campanhas' : s === 'cronograma' ? 'Cronograma' : s === 'demanda' ? 'Demandas' : 'Entregáveis'}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'overdue', 'urgent', 'soon', 'upcoming'] as const).map(u => (
                <button key={u} onClick={() => setFilterUrgency(u)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${filterUrgency === u ? 'bg-primary text-primary-foreground font-semibold' : 'bg-card text-muted-foreground border border-white/10 hover:text-foreground hover:bg-white/5'}`}>
                  {u === 'all' ? 'Todas urgências' : u === 'overdue' ? '🔴 Vencidos' : u === 'urgent' ? '🟠 Semana' : u === 'soon' ? '🟡 30 dias' : '🔵 90 dias'}
                </button>
              ))}
            </div>
          </div>

          {/* Project filter tabs */}
          {myProjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setSelectedProj('todos')}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${selectedProj === 'todos' ? 'bg-primary text-primary-foreground font-semibold' : 'bg-card text-muted-foreground border border-white/10'}`}>
                Todos os projetos
              </button>
              {myProjects.map(p => {
                const empr = emprMap.get(p.empreendimentoId);
                const count = agendaItems.filter(i => i.empreendimentoId === p.empreendimentoId).length;
                const h = projectHealth.find(ph => ph.id === p.id)?.health || 'ok';
                const dot = h === 'critico' ? '🔴' : h === 'atencao' ? '🟡' : '🟢';
                const lbl = (empr?.nome || p.nome).slice(0, 20);
                return (
                  <button key={p.id} onClick={() => setSelectedProj(String(p.empreendimentoId))}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1 ${selectedProj === String(p.empreendimentoId) ? 'bg-primary text-primary-foreground font-semibold' : 'bg-card text-muted-foreground border border-white/10'}`}>
                    {dot} {lbl}{lbl.length < (empr?.nome || p.nome).length ? '…' : ''}
                    {count > 0 && <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Agenda items */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3 bg-card/65 rounded-2xl border border-white/5 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{search ? 'Nenhum item encontrado.' : 'Tudo em dia!'}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{search ? 'Tente um termo diferente.' : 'Nenhum lembrete pendente.'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <SectionGroup label="Vencidos" color="#c2410c" items={filtered.filter(i => urgency(i.dias) === 'overdue')} onClick={handleItemClick} />
              <SectionGroup label="Esta semana" color="#ea580c" items={filtered.filter(i => urgency(i.dias) === 'urgent')} onClick={handleItemClick} />
              <SectionGroup label="Próximos 30 dias" color="#f97316" items={filtered.filter(i => urgency(i.dias) === 'soon')} onClick={handleItemClick} />
              <SectionGroup label="Próximos 90 dias" color="#0099a8" items={filtered.filter(i => urgency(i.dias) === 'upcoming')} onClick={handleItemClick} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
