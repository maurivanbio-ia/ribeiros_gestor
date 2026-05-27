import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlatformReportPDF } from "@/components/PlatformReportPDF";
import { ExportButton } from "@/components/ExportButton";
import {
  CheckCircle, TriangleAlert, XCircle, Clock, FileText, Package,
  AlertTriangle, RefreshCcw, TrendingUp, Activity, Users, Filter,
  Building2, Target, CalendarDays, ArrowRight, Layers, Zap,
  ChevronRight, MapPin, Truck, Wrench, Lock, Banknote, TrendingDown, Wallet
} from "lucide-react";
import type { Empreendimento } from "@shared/schema";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
  RadialBarChart, RadialBar, Legend
} from "recharts";

/* ─── Types ─────────────────────────────────────────────── */
interface DashboardStats {
  licenses: { active: number; expiring: number; expired: number; emRenovacao?: number };
  condicionantes: { pendentes: number; cumpridas: number; vencidas: number };
  entregas: { pendentes: number; entregues: number; atrasadas: number };
  agenda: Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; empreendimento?: string }>;
  monthlyExpiry: Array<{ month: string; count: number }>;
  frota?: { total: number; disponiveis: number; emUso: number; manutencao: number; alugados: number };
  equipamentos?: { total: number; disponiveis: number; emUso: number; manutencao: number };
  rh?: { total: number; ativos: number; afastados: number };
  demandas?: { total: number; pendentes: number; emAndamento: number; concluidas: number };
  contratos?: { total: number; ativos: number; valorTotal: number };
  autorizacoesVencidas?: any[];
  condicionantesAlerta?: any[];
}

interface FinancialStats {
  totalReceitas: number;
  totalDespesas: number;
  totalPendente: number;
  saldoAtual: number;
  porCategoria: Array<{ categoria: string; valor: number; tipo: string }>;
  evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
  porProjeto?: Array<{ projeto: string; projetoId: number; receitas: number; despesas: number; lucro: number }>;
  porCampanha?: Array<{ campanha: string; campanhaId: number; receitas: number; despesas: number; lucro: number }>;
}

interface Campanha {
  id: number; nome: string; periodoInicio: string; periodoFim: string;
  descricao?: string | null; empreendimentoId: number; observacoesMetodologicas?: string | null;
  status?: string | null; motivoStatus?: string | null;
}

interface Projeto {
  id: number; nome: string; status: string; empreendimentoId: number;
  inicioPrevisto?: string | null; fimPrevisto?: string | null;
}

/* ─── Palette ECO ─────────────────────────────────────────── */
const P = {
  green: "#2DD4BF",  // Neon Teal / Mint
  yellow: "#F59E0B", // Amber
  red: "#EF4444",    // Red
  blue: "#06B6D4",   // Cyan
  purple: "#8B5CF6", // Purple
  cyan: "#00E5FF",   // Bright Cyan
  orange: "#F97316",
  teal: "#2DD4BF",
  indigo: "#3B82F6",
};

/* ─── Campaign status config (ECO palette) ───────────────── */
const CAMPANHA_STATUS: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  planejada:    { label: "Planejada",     color: "#155e75", bg: "#ecfeff", desc: "Campanha programada, ainda não iniciada" },
  em_andamento: { label: "Em Andamento",  color: "#0e7490", bg: "#ecfeff", desc: "Campanha em execução conforme planejado" },
  atrasada:     { label: "Atrasada",      color: "#9a3a0a", bg: "#fff7ed", desc: "Execução com atraso em relação ao cronograma" },
  suspensa:     { label: "Suspensa",      color: "#164e63", bg: "#ecfeff", desc: "Temporariamente paralisada" },
  cancelada:    { label: "Cancelada",     color: "#7c2d12", bg: "#ffedd5", desc: "Campanha cancelada definitivamente" },
  encerrada:    { label: "Encerrada",     color: "#475569", bg: "#f1f5f9", desc: "Finalizada antes do prazo previsto" },
  concluida:    { label: "Concluída",     color: "#134e4a", bg: "#ccfbf1", desc: "Concluída com êxito dentro do prazo" },
};

/* ─── Helpers ────────────────────────────────────────────── */
function fmt(d?: string | null) {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
}

function campaignProgress(inicio: string, fim: string) {
  const now = Date.now();
  const start = new Date(inicio).getTime();
  const end = new Date(fim).getTime();
  if (now < start) return -1; // future
  if (now > end) return 100;  // past
  return Math.round(((now - start) / (end - start)) * 100);
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

/* ─── Sub-components ─────────────────────────────────────── */
function HeroKpi({ label, value, sub, icon: Icon, gradient }: {
  label: string; value: number | string; sub?: string;
  icon: any; gradient: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} text-white shadow-lg`}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
      <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-4 -translate-x-4" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</span>
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
        {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function MiniDonut({ data, label }: {
  data: { name: string; value: number; color: string }[];
  label: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const hasData = data.some(d => d.value > 0);
  return (
    <Card className="premium-card h-full">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{label}</p>
        {!hasData ? (
          <div className="h-28 flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-28 w-28 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={46} dataKey="value" paddingAngle={4}>
                    {data.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-xl font-black text-foreground">{total}</p>
              {data.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold ml-1">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignCard({ campanha, empreendimentos, onClick }: { campanha: Campanha; empreendimentos?: Empreendimento[]; onClick?: () => void }) {
  const progress = campaignProgress(campanha.periodoInicio, campanha.periodoFim);
  const emp = empreendimentos?.find(e => e.id === campanha.empreendimentoId);
  const isFuture = progress === -1;
  const isPast = progress === 100;
  const days = isFuture ? daysUntil(campanha.periodoInicio) : isPast ? null : daysUntil(campanha.periodoFim);

  // Prefer manual status from DB; fall back to date-based auto label
  const manualKey = campanha.status && CAMPANHA_STATUS[campanha.status] ? campanha.status : null;
  const autoKey = isFuture ? "planejada" : isPast ? "concluida" : "em_andamento";
  const activeKey = manualKey ?? autoKey;
  const st = CAMPANHA_STATUS[activeKey];

  return (
    <div
      className="flex gap-3 p-3 rounded-xl border border-white/5 hover:bg-white/[0.02] transition-colors group cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-col items-center gap-1 w-1 mt-1">
        <div className="h-2.5 w-2.5 rounded-full border-2 flex-shrink-0" style={{ borderColor: st.color, background: isFuture && !manualKey ? "transparent" : st.color }} />
        <div className="flex-1 w-0.5 bg-white/5 min-h-[20px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{campanha.nome}</p>
            {emp && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Building2 className="h-3 w-3" />{emp.nome}</p>}
          </div>
          <Badge className="flex-shrink-0 text-[10px] px-1.5 py-0 font-semibold border-0" style={{ background: st.bg, color: st.color }}>
            {st.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span>{fmt(campanha.periodoInicio)} → {fmt(campanha.periodoFim)}</span>
          {days !== null && (
            <span className="font-medium" style={{ color: st.color }}>
              {isFuture ? `em ${days}d` : isPast ? "" : `${days}d restantes`}
            </span>
          )}
        </div>
        {!isFuture && !isPast && (
          <div className="mt-2">
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: `linear-gradient(90deg, #ea580c, #0099a8)` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{progress}% concluído</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectRow({ projeto, onClick }: { projeto: Projeto; onClick?: () => void }) {
  const statusMap: Record<string, { label: string; color: string }> = {
    ativo:           { label: "Ativo",           color: P.green },
    em_planejamento: { label: "Em Planejamento", color: P.cyan },
    em_andamento:    { label: "Em Andamento",    color: P.blue },
    em_execucao:     { label: "Em Execução",     color: P.teal },
    concluido:       { label: "Concluído",       color: P.green },
    pausado:         { label: "Pausado",         color: P.yellow },
    inativo:         { label: "Inativo",         color: P.yellow },
    cancelado:       { label: "Cancelado",       color: P.red },
  };
  const st = statusMap[projeto.status] ?? { label: projeto.status, color: P.teal };
  return (
    <div
      className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.02] rounded-lg px-1 transition-colors"
      onClick={onClick}
    >
      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: st.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{projeto.nome}</p>
        {projeto.fimPrevisto && <p className="text-[10px] text-muted-foreground">Prev. {fmt(projeto.fimPrevisto)}</p>}
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: st.color + "20", color: st.color }}>
        {st.label}
      </span>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────── */
export default function Dashboard() {
  const [, navigate] = useLocation();
  const [selectedEmp, setSelectedEmp] = useState("todos");
  const [filtroResp, setFiltroResp] = useState<'todos' | 'empreendedor' | 'ecobrasil'>('todos');
  const [selectedCampanha, setSelectedCampanha] = useState<Campanha | null>(null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [motivoStatus, setMotivoStatus] = useState("");
  const { toast } = useToast();

  const updateCampanhaMutation = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: number; status: string; motivo?: string }) => {
      const res = await apiRequest("PATCH", `/api/campanhas/${id}`, { status, motivoStatus: motivo || null });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campanhas"] });
      setSelectedCampanha(prev => prev ? { ...prev, status: data.status, motivoStatus: data.motivoStatus } : null);
      setEditingStatus(false);
      setMotivoStatus("");
      toast({ title: "Status atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const { data: empreendimentos } = useQuery<Empreendimento[]>({ queryKey: ["/api/empreendimentos"] });

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", { empreendimentoId: selectedEmp }],
    queryFn: async () => {
      const url = selectedEmp === "todos" ? "/api/dashboard/stats" : `/api/dashboard/stats?empreendimentoId=${selectedEmp}`;
      const r = await fetch(url); if (!r.ok) throw new Error(); return r.json();
    },
  });

  const { data: campanhas = [] } = useQuery<Campanha[]>({
    queryKey: ["/api/campanhas"],
    queryFn: async () => { const r = await fetch("/api/campanhas"); if (!r.ok) return []; return r.json(); },
  });

  const { data: projetos = [] } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos"],
    queryFn: async () => { const r = await fetch("/api/projetos"); if (!r.ok) return []; return r.json(); },
  });

  const { data: financialStats } = useQuery<FinancialStats | null>({
    queryKey: ["/api/financeiro/stats", { empreendimentoId: selectedEmp }],
    queryFn: async () => {
      const url = selectedEmp === "todos" ? "/api/financeiro/stats" : `/api/financeiro/stats?empreendimentoId=${selectedEmp}`;
      const r = await fetch(url);
      if (r.status === 403) return null;
      if (!r.ok) return null;
      return r.json();
    },
  });

  const lic = stats?.licenses ?? { active: 0, expiring: 0, expired: 0, emRenovacao: 0 };
  const cond = stats?.condicionantes ?? { pendentes: 0, cumpridas: 0, vencidas: 0 };
  const ent = stats?.entregas ?? { pendentes: 0, entregues: 0, atrasadas: 0 };
  const dem = stats?.demandas ?? { total: 0, pendentes: 0, emAndamento: 0, concluidas: 0 };
  const frota = stats?.frota ?? { total: 0, disponiveis: 0, emUso: 0, manutencao: 0, alugados: 0 };
  const equip = stats?.equipamentos ?? { total: 0, disponiveis: 0, emUso: 0, manutencao: 0 };
  const rh = stats?.rh ?? { total: 0, ativos: 0, afastados: 0 };
  const contratos = stats?.contratos ?? { total: 0, ativos: 0, valorTotal: 0 };
  const autVencidas = stats?.autorizacoesVencidas ?? [];
  const condAlerta = stats?.condicionantesAlerta ?? [];
  const prazos = stats?.agenda ?? [];
  const monthlyExpiry = stats?.monthlyExpiry ?? [];

  // Campaign classification
  const now = Date.now();
  const campanhasAtivas = campanhas.filter(c => {
    const s = new Date(c.periodoInicio).getTime();
    const e = new Date(c.periodoFim).getTime();
    return now >= s && now <= e;
  });
  const campanhasFuturas = campanhas.filter(c => new Date(c.periodoInicio).getTime() > now)
    .sort((a, b) => new Date(a.periodoInicio).getTime() - new Date(b.periodoInicio).getTime());
  const campanhasRecentes = campanhas.filter(c => new Date(c.periodoFim).getTime() < now)
    .sort((a, b) => new Date(b.periodoFim).getTime() - new Date(a.periodoFim).getTime())
    .slice(0, 3);

  const timelineCampanhas = [
    ...campanhasAtivas,
    ...campanhasFuturas.slice(0, 5),
    ...campanhasRecentes,
  ].slice(0, 8);

  // Empreendimentos by status for chart
  const empByStatus: Record<string, number> = {};
  empreendimentos?.forEach(e => {
    const s = e.status || "sem_status";
    empByStatus[s] = (empByStatus[s] || 0) + 1;
  });

  const condFilt = condAlerta.filter(c => filtroResp === 'todos' ? true : c.tipoResponsavel === filtroResp);
  const condVencidas = condFilt.filter(c => c.status === 'vencida');
  const condAndamento = condFilt.filter(c => c.status === 'em_andamento');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#1E6146] to-[#00599C] flex items-center justify-center animate-pulse">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Carregando dashboard…</p>
        </div>
      </div>
    );
  }

  const totalLic = lic.active + lic.expiring + lic.expired + (lic.emRenovacao ?? 0);

  return (
    <div className="min-h-screen bg-[#f5f6fa] dark:bg-gray-950">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Top bar ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Painel de Controle</h1>
            <p className="text-sm text-muted-foreground">Sistema de Gestão Ambiental Integrado · SGAI</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedEmp} onValueChange={setSelectedEmp}>
              <SelectTrigger className="w-[220px] h-8 text-xs rounded-xl border-gray-200">
                <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Todos os empreendimentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">📊 Todos</SelectItem>
                {empreendimentos?.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <PlatformReportPDF buttonVariant="outline" buttonSize="sm" />
            <ExportButton entity="relatorio-completo" variant="outline" />
          </div>
        </div>

        {/* ── Hero KPIs (gradient cards) ────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroKpi label="Licenças Ativas" value={lic.active}
            sub={`de ${totalLic} no total`} icon={CheckCircle}
            gradient="bg-gradient-to-br from-[#ea580c] to-[#9a3a0a]" />
          <HeroKpi label="Campanhas de Campo" value={campanhas.length}
            sub={`${campanhasAtivas.length} em andamento`} icon={Target}
            gradient="bg-gradient-to-br from-[#0099a8] to-[#0e7490]" />
          <HeroKpi label="Projetos Ativos" value={projetos.filter(p => p.status === 'ativo' || p.status === 'em_andamento' || p.status === 'em_execucao' || p.status === 'planejamento' || p.status === 'em_planejamento').length}
            sub={`de ${projetos.length} projetos`} icon={Layers}
            gradient="bg-gradient-to-br from-[#0a6a7a] to-[#064e5a]" />
          <HeroKpi label="Cond. Pendentes" value={cond.pendentes}
            sub={cond.vencidas > 0 ? `${cond.vencidas} vencidas!` : "em dia"}
            icon={cond.vencidas > 0 ? AlertTriangle : CheckCircle}
            gradient={cond.vencidas > 0 ? "bg-gradient-to-br from-orange-700 to-orange-900" : "bg-gradient-to-br from-[#06b6d4] to-[#0099a8]"} />
        </div>

        {/* ── Row 2: Campanhas + Licenças + Condicionantes ─ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Campaign Timeline */}
          <Card className="premium-card lg:col-span-1">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 border border-blue-500/15 rounded-lg">
                    <Target className="h-4 w-4 text-blue-400" />
                  </div>
                  Campanhas de Campo
                </CardTitle>
                <div className="flex gap-1.5">
                  {campanhasAtivas.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                      {campanhasAtivas.length} ativa{campanhasAtivas.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {campanhasFuturas.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/15">
                      {campanhasFuturas.length} próxima{campanhasFuturas.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {timelineCampanhas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center">
                    <Target className="h-6 w-6 text-blue-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada</p>
                  <p className="text-xs text-muted-foreground/70">Acesse um empreendimento para criar campanhas de campo</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {timelineCampanhas.map(c => (
                    <CampaignCard key={c.id} campanha={c} empreendimentos={empreendimentos}
                      onClick={() => { setSelectedCampanha(c); setEditingStatus(false); setMotivoStatus(""); }} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Licenses */}
          <Card className="premium-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/15 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                Licenças Ambientais
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Donut */}
              <div className="flex items-center gap-4">
                <div className="h-36 w-36 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: "Ativas", value: lic.active, color: P.green },
                        { name: "A Vencer", value: lic.expiring, color: P.yellow },
                        { name: "Vencidas", value: lic.expired, color: P.red },
                        { name: "Renovação", value: lic.emRenovacao ?? 0, color: P.blue },
                      ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={58} dataKey="value" paddingAngle={3}>
                        {[P.green, P.yellow, P.red, P.blue].map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {[
                    { label: "Ativas", val: lic.active, color: P.green, path: "/licencas/ativas" },
                    { label: "A Vencer", val: lic.expiring, color: P.yellow, path: "/licencas/vencer" },
                    { label: "Vencidas", val: lic.expired, color: P.red, path: "/licencas/vencidas" },
                    { label: "Em Renovação", val: lic.emRenovacao ?? 0, color: P.blue, path: "/licencas/em-renovacao" },
                  ].map(item => (
                    <button key={item.label} className="w-full flex items-center justify-between text-xs hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1 transition-colors" onClick={() => navigate(item.path)}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <span className="font-bold text-foreground">{item.val}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Monthly bar */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Vencimento Mensal</p>
                <ResponsiveContainer width="100%" height={70}>
                  <BarChart data={monthlyExpiry} margin={{ top: 0, right: 0, left: -30, bottom: -5 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <RTooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                    <Bar dataKey="count" fill={P.blue} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Condicionantes + Demandas */}
          <Card className="premium-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 border border-amber-500/15 rounded-lg">
                  <FileText className="h-4 w-4 text-amber-400" />
                </div>
                Condicionantes & Demandas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Condicionantes radial */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Condicionantes</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Pendentes", val: cond.pendentes, color: P.yellow, bg: "bg-amber-500/5 border border-amber-500/10" },
                    { label: "Cumpridas", val: cond.cumpridas, color: P.green, bg: "bg-emerald-500/5 border border-emerald-500/10" },
                    { label: "Vencidas", val: cond.vencidas, color: P.red, bg: "bg-red-500/5 border border-red-500/10" },
                  ].map(item => (
                    <div key={item.label} className={`${item.bg} rounded-xl p-2.5 text-center`}>
                      <p className="text-xl font-black" style={{ color: item.color }}>{item.val}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Demandas donut */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Demandas ({dem.total})</p>
                <div className="flex items-center gap-3">
                  <div className="h-24 w-24 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[
                          { name: "Pendentes", value: dem.pendentes, color: P.yellow },
                          { name: "Andamento", value: dem.emAndamento, color: P.blue },
                          { name: "Concluídas", value: dem.concluidas, color: P.green },
                        ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={26} outerRadius={40} dataKey="value" paddingAngle={3}>
                          {[P.yellow, P.blue, P.green].map((c, i) => <Cell key={i} fill={c} />)}
                        </Pie>
                        <RTooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[
                      { label: "Pendentes", val: dem.pendentes, color: P.yellow },
                      { label: "Em Andamento", val: dem.emAndamento, color: P.blue },
                      { label: "Concluídas", val: dem.concluidas, color: P.green },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="font-bold">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Entregas */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Entregas do Mês</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Entregues", val: ent.entregues, color: P.green, bg: "bg-emerald-500/5 border border-emerald-500/10" },
                    { label: "Pendentes", val: ent.pendentes, color: P.yellow, bg: "bg-amber-500/5 border border-amber-500/10" },
                    { label: "Atrasadas", val: ent.atrasadas, color: P.red, bg: "bg-red-500/5 border border-red-500/10" },
                  ].map(item => (
                    <div key={item.label} className={`${item.bg} rounded-xl p-2.5 text-center`}>
                      <p className="text-xl font-black" style={{ color: item.color }}>{item.val}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 3: Projetos + Frota/Equip + RH + Prazos ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Projetos */}
          <Card className="premium-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-purple-500/10 border border-purple-500/15 rounded-lg">
                    <Layers className="h-4 w-4 text-purple-400" />
                  </div>
                  Projetos
                </CardTitle>
                <span className="text-xs text-muted-foreground">{projetos.length} total</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {projetos.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Sem projetos cadastrados</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {projetos.slice(0, 6).map(p => <ProjectRow key={p.id} projeto={p} onClick={() => navigate(`/empreendimentos/${p.empreendimentoId}`)} />)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Frota & Equipamentos */}
          <Card className="premium-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/15 rounded-lg">
                  <Truck className="h-4 w-4 text-cyan-400" />
                </div>
                Frota & Equipamentos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={[
                  { name: "Frota", Disp: frota.disponiveis, Uso: frota.emUso, Man: frota.manutencao },
                  { name: "Equip.", Disp: equip.disponiveis, Uso: equip.emUso, Man: equip.manutencao },
                ]} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Disp" name="Disponíveis" fill={P.green} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Uso" name="Em Uso" fill={P.blue} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Man" name="Manutenção" fill={P.yellow} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2 px-2">
                {[
                  { label: "Frota total", val: frota.total, icon: Truck, color: P.cyan },
                  { label: "Equip. total", val: equip.total, icon: Wrench, color: P.indigo },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                    <item.icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-bold">{item.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* RH */}
          <Card className="premium-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="p-1.5 bg-rose-500/10 border border-rose-500/15 rounded-lg">
                  <Users className="h-4 w-4 text-rose-400" />
                </div>
                Recursos Humanos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="text-center py-2">
                <p className="text-4xl font-black text-foreground">{rh.total}</p>
                <p className="text-xs text-muted-foreground">colaboradores</p>
              </div>
              {[
                { label: "Ativos", value: rh.ativos, color: P.green, pct: rh.total > 0 ? Math.round(rh.ativos / rh.total * 100) : 0 },
                { label: "Afastados", value: rh.afastados, color: P.red, pct: rh.total > 0 ? Math.round(rh.afastados / rh.total * 100) : 0 },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold">{item.value} <span className="text-muted-foreground font-normal">({item.pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.pct}%`, background: item.color }} />
                  </div>
                </div>
              ))}
              {contratos.total > 0 && (
                <div className="pt-2 border-t border-gray-50 dark:border-gray-800">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Contratos</p>
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-xl font-black">{contratos.ativos}</span>
                    <span className="text-xs text-muted-foreground mb-0.5">/ {contratos.total} ativos</span>
                  </div>
                  {contratos.valorTotal > 0 && (
                    <p className="text-xs text-emerald-600 font-medium">
                      R$ {contratos.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prazos */}
          <Card className="premium-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="p-1.5 bg-orange-500/10 border border-orange-500/15 rounded-lg">
                  <CalendarDays className="h-4 w-4 text-orange-400" />
                </div>
                Próximos Prazos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {prazos.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Sem prazos próximos</div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {prazos.slice(0, 10).map((p, i) => {
                    const atrasado = p.status === 'vencida' || p.status === 'atrasada';
                    const urgente = p.status === 'em_andamento' || p.status === 'a_vencer';
                    const color = atrasado ? P.red : urgente ? P.yellow : P.teal;
                    return (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-xl text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.titulo}</p>
                          <p className="text-muted-foreground text-[10px]">{p.prazo?.split('-').reverse().join('/')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Financeiro ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* KPIs financeiros */}
          <Card className="premium-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/15 rounded-lg">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                </div>
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {financialStats === undefined ? (
                <div className="space-y-2 animate-pulse">
                  {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}
                </div>
              ) : financialStats === null ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Área financeira bloqueada</p>
                  <p className="text-xs text-muted-foreground/70">Acesse o módulo Financeiro e desbloqueie para ver os dados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: "Receitas", value: financialStats.totalReceitas, icon: TrendingUp, color: P.green, bg: "bg-emerald-500/5 border border-emerald-500/10" },
                    { label: "Despesas", value: financialStats.totalDespesas, icon: TrendingDown, color: P.red, bg: "bg-red-500/5 border border-red-500/10" },
                    { label: "Saldo Atual", value: financialStats.saldoAtual, icon: Banknote, color: financialStats.saldoAtual >= 0 ? P.green : P.red, bg: financialStats.saldoAtual >= 0 ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-red-500/5 border border-red-500/10" },
                    { label: "A Receber/Pagar", value: financialStats.totalPendente, icon: Clock, color: P.yellow, bg: "bg-amber-500/5 border border-amber-500/10" },
                  ].map(item => (
                    <div key={item.label} className={`${item.bg} rounded-xl px-3 py-2.5 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: item.color }} />
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums" style={{ color: item.color }}>
                        {item.value < 0 ? "-" : ""}R$ {Math.abs(item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evolução mensal */}
          <Card className="premium-card lg:col-span-2">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 border border-blue-500/15 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                </div>
                Evolução Financeira Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {financialStats === undefined ? (
                <div className="h-[180px] bg-gray-50 dark:bg-gray-800 rounded-xl animate-pulse" />
              ) : financialStats === null ? (
                <div className="flex flex-col items-center justify-center h-[180px] gap-3 text-center">
                  <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Dados financeiros protegidos</p>
                  <p className="text-xs text-muted-foreground/70">Desbloqueie o módulo Financeiro para visualizar</p>
                </div>
              ) : financialStats.evolucaoMensal.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[180px] gap-2 text-center">
                  <Banknote className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Nenhum lançamento registrado</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={financialStats.evolucaoMensal} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={P.green} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={P.green} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDesp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={P.red} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={P.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} width={54} />
                    <RTooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(value: number, name: string) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="receitas" name="Receitas" stroke={P.green} fill="url(#gradRec)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="despesas" name="Despesas" stroke={P.red} fill="url(#gradDesp)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="lucro" name="Saldo" stroke={P.blue} fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Projeto / Campanha financial charts ─────────── */}
        {financialStats && ((financialStats.porProjeto?.length ?? 0) > 0 || (financialStats.porCampanha?.length ?? 0) > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(financialStats.porProjeto?.length ?? 0) > 0 && (
              <Card className="premium-card">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    Financeiro por Projeto
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={financialStats.porProjeto} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="projeto" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} width={54} />
                      <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="receitas" name="Receitas" fill={P.green} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill={P.red} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="lucro" name="Lucro" fill={P.blue} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {(financialStats.porCampanha?.length ?? 0) > 0 && (
              <Card className="premium-card">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                    </div>
                    Financeiro por Campanha
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={financialStats.porCampanha} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="campanha" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} width={54} />
                      <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="receitas" name="Receitas" fill={P.green} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill={P.red} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="lucro" name="Lucro" fill={P.blue} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Alerts section ───────────────────────────── */}
        {autVencidas.length > 0 && (
          <Card id="secao-autorizacoes-vencidas" className="premium-card overflow-hidden">
            <div className="bg-gradient-to-r from-orange-700 to-orange-900 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-bold text-sm">Autorizações Vencidas</span>
                <span className="bg-white/20 text-white text-xs font-bold rounded-full px-2 py-0.5">{autVencidas.length}</span>
              </div>
              <button className="text-white/80 hover:text-white text-xs flex items-center gap-1" onClick={() => navigate("/licencas/vencidas")}>
                Ver todas <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="divide-y divide-white/5 bg-card/45">
              {autVencidas.slice(0, 6).map((aut: any) => {
                const emp = empreendimentos?.find(e => e.id === aut.empreendimentoId);
                const hoje = new Date().toISOString().split('T')[0];
                const dias = aut.dataValidade ? Math.floor((new Date(hoje).getTime() - new Date(aut.dataValidade).getTime()) / 86400000) : null;
                return (
                  <div key={aut.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => aut.fonte === 'gestao_dados' ? navigate('/gestao-dados') : emp && navigate(`/empreendimentos/${emp.id}`)}>
                    <span className="flex-shrink-0 text-[10px] font-bold bg-orange-500/20 text-orange-400 rounded px-1.5 py-0.5 uppercase">{(aut.tipo || 'doc').slice(0, 8)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{aut.titulo || aut.numero || `#${aut.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp?.nome || '—'}{aut.orgaoEmissor ? ` · ${aut.orgaoEmissor}` : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {aut.dataValidade && <p className="text-xs font-medium text-orange-400">{aut.dataValidade.split('-').reverse().join('/')}</p>}
                      {dias !== null && dias > 0 && <p className="text-[10px] font-bold text-red-400">{dias}d vencida</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Condicionantes em Atenção ─────────────────── */}
        {condAlerta.length > 0 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Condicionantes em Atenção
                {condVencidas.length > 0 && <span className="text-xs font-normal bg-red-100 text-red-700 rounded-full px-2 py-0.5">{condVencidas.length} vencida{condVencidas.length !== 1 ? "s" : ""}</span>}
                {condAndamento.length > 0 && <span className="text-xs font-normal bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5">{condAndamento.length} em andamento</span>}
              </h3>
              <div className="flex gap-1.5">
                {[
                  { key: 'todos', label: `Todos (${condAlerta.length})` },
                  { key: 'empreendedor', label: `🏢 Empreendedor` },
                  { key: 'ecobrasil', label: `🌿 Consultora` },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setFiltroResp(opt.key as any)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${filtroResp === opt.key ? 'bg-primary text-primary-foreground border-transparent shadow-[0_0_10px_rgba(45,212,191,0.2)]' : 'bg-card text-muted-foreground border-white/10 hover:text-foreground hover:bg-white/5'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {condVencidas.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Vencidas</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {condVencidas.map((c: any) => {
                    const hoje = new Date().toISOString().split('T')[0];
                    const dias = c.prazo ? Math.floor((new Date(hoje).getTime() - new Date(c.prazo).getTime()) / 86400000) : null;
                    return (
                      <Card key={c.id} className="border-0 shadow-sm rounded-2xl border-l-4 border-l-red-500 bg-red-50/60 dark:bg-red-950/20 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => c.empreendimentoId && navigate(`/empreendimentos/${c.empreendimentoId}`)}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1 mb-1">
                                {c.tipoResponsavel === 'empreendedor' && <span className="text-[10px] font-bold bg-[#0099a8] text-white rounded-full px-2 py-0.5">🏢 Empreendedor</span>}
                                {c.tipoResponsavel === 'ecobrasil' && <span className="text-[10px] font-bold bg-[#1A7A45] text-white rounded-full px-2 py-0.5">🌿 Consultora</span>}
                                {c.codigo && <span className="text-xs font-semibold bg-red-100 text-red-700 rounded px-1.5 py-0.5">{c.codigo}</span>}
                              </div>
                              <p className="text-sm font-semibold truncate">{c.titulo || c.descricao?.substring(0, 60)}</p>
                              <p className="text-xs text-muted-foreground truncate">📋 {c.licencaNumero} · 📍 {c.empreendimentoNome}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-medium text-red-500">{c.prazo?.split('-').reverse().join('/')}</p>
                              {dias !== null && dias > 0 && <p className="text-xs font-bold text-red-600">{dias}d atraso</p>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {condAndamento.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-2 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Em Andamento</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {condAndamento.map((c: any) => (
                    <Card key={c.id} className="border-0 shadow-sm rounded-2xl border-l-4 border-l-yellow-500 bg-yellow-50/60 dark:bg-yellow-950/20 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => c.empreendimentoId && navigate(`/empreendimentos/${c.empreendimentoId}`)}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1 mb-1">
                              {c.tipoResponsavel === 'empreendedor' && <span className="text-[10px] font-bold bg-[#0099a8] text-white rounded-full px-2 py-0.5">🏢 Empreendedor</span>}
                              {c.tipoResponsavel === 'ecobrasil' && <span className="text-[10px] font-bold bg-[#1A7A45] text-white rounded-full px-2 py-0.5">🌿 Consultora</span>}
                              {c.codigo && <span className="text-xs font-semibold bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5">{c.codigo}</span>}
                            </div>
                            <p className="text-sm font-semibold truncate">{c.titulo || c.descricao?.substring(0, 60)}</p>
                            <p className="text-xs text-muted-foreground truncate">📋 {c.licencaNumero} · 📍 {c.empreendimentoNome}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-medium text-yellow-600">{c.prazo?.split('-').reverse().join('/')}</p>
                            {c.progresso > 0 && <p className="text-xs text-muted-foreground">{c.progresso}%</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Campaign Detail Dialog ────────────────────────── */}
      <Dialog open={!!selectedCampanha} onOpenChange={open => { if (!open) { setSelectedCampanha(null); setEditingStatus(false); } }}>
        <DialogContent className="max-w-lg rounded-2xl">
          {selectedCampanha && (() => {
            const c = selectedCampanha;
            const emp = empreendimentos?.find(e => e.id === c.empreendimentoId);
            const progress = campaignProgress(c.periodoInicio, c.periodoFim);
            const isFuture = progress === -1;
            const isPast = progress === 100;
            const days = isFuture ? daysUntil(c.periodoInicio) : isPast ? null : daysUntil(c.periodoFim);
            const manualStatus = c.status && !["planejada", null, undefined].includes(c.status) ? c.status : null;
            const displayStatus = manualStatus ?? (isFuture ? "planejada" : isPast ? "concluida" : "em_andamento");
            const st = CAMPANHA_STATUS[displayStatus] ?? CAMPANHA_STATUS["planejada"];
            return (
              <>
                <DialogHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl flex-shrink-0" style={{ background: st.bg }}>
                      <Target className="h-5 w-5" style={{ color: st.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-base font-bold leading-snug">{c.nome}</DialogTitle>
                      {emp && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Building2 className="h-3 w-3" />{emp.nome}</p>}
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Period + status badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmt(c.periodoInicio)} → {fmt(c.periodoFim)}
                    </span>
                    {days !== null && (
                      <span className="text-xs font-medium" style={{ color: st.color }}>
                        {isFuture ? `começa em ${days}d` : `${days}d restantes`}
                      </span>
                    )}
                    <Badge className="text-[11px] px-2 py-0.5 font-semibold border-0 ml-auto"
                      style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </Badge>
                  </div>

                  {/* Progress bar for active */}
                  {!isFuture && progress < 100 && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso temporal</span><span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${progress}%`, background: `linear-gradient(90deg, #ea580c, #0099a8)` }} />
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {c.descricao && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Descrição</p>
                      <p className="text-sm text-foreground leading-relaxed">{c.descricao}</p>
                    </div>
                  )}

                  {/* Obs metodológicas */}
                  {c.observacoesMetodologicas && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Observações Metodológicas</p>
                      <p className="text-sm text-foreground leading-relaxed">{c.observacoesMetodologicas}</p>
                    </div>
                  )}

                  {/* Previous status reason */}
                  {c.motivoStatus && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-3 py-2">
                      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Motivo do status</p>
                      <p className="text-sm text-amber-800">{c.motivoStatus}</p>
                    </div>
                  )}

                  <Separator />

                  {/* Status change section */}
                  {!editingStatus ? (
                    <Button variant="outline" className="w-full" onClick={() => { setEditingStatus(true); setNewStatus(displayStatus); }}>
                      Alterar Status da Campanha
                    </Button>
                  ) : (
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Novo Status</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(CAMPANHA_STATUS).map(([key, val]) => (
                          <button key={key}
                            onClick={() => setNewStatus(key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all text-left ${newStatus === key ? "shadow-sm scale-[1.02]" : "opacity-70 hover:opacity-100"}`}
                            style={{ background: val.bg, color: val.color, borderColor: newStatus === key ? val.color : "transparent" }}>
                            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: val.color }} />
                            {val.label}
                          </button>
                        ))}
                      </div>
                      {newStatus && (
                        <p className="text-xs text-muted-foreground italic">{CAMPANHA_STATUS[newStatus]?.desc}</p>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Motivo / observação (opcional)</Label>
                        <Textarea placeholder="Descreva o motivo desta mudança de status..." value={motivoStatus}
                          onChange={e => setMotivoStatus(e.target.value)} className="text-sm resize-none h-20 rounded-xl" />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingStatus(false)}>Cancelar</Button>
                        <Button size="sm" className="flex-1" disabled={!newStatus || updateCampanhaMutation.isPending}
                          style={{ background: "linear-gradient(90deg, #ea580c, #0099a8)" }}
                          onClick={() => updateCampanhaMutation.mutate({ id: c.id, status: newStatus, motivo: motivoStatus })}>
                          {updateCampanhaMutation.isPending ? "Salvando…" : "Confirmar"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Navigate to empreendimento */}
                  {emp && (
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground"
                      onClick={() => { setSelectedCampanha(null); navigate(`/empreendimentos/${emp.id}`); }}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1" /> Ver detalhes no empreendimento
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
