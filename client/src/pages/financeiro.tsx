import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus, Download, DollarSign, TrendingUp, TrendingDown, Clock,
  BarChart3, PieChart, LineChart, Wallet, Building, Loader2,
  ArrowUpIcon, ArrowDownIcon, Receipt, FileText,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import { FinancialReportPDF } from "@/components/FinancialReportPDF";
import { NovoLancamentoForm } from "@/components/financeiro/NovoLancamentoForm";
import { EditLancamentoForm } from "@/components/financeiro/EditLancamentoForm";
import { LancamentosTabContent } from "@/components/financeiro/LancamentosTabContent";
import { RecibosSection } from "@/components/financeiro/RecibosSection";
import { ReembolsosTabContent } from "@/components/financeiro/ReembolsosTabContent";
import { ReembolsoApprovalDialog } from "@/components/financeiro/ReembolsoApprovalDialog";
import { ReciboDialog } from "@/components/financeiro/ReciboDialog";
import type { LancamentosFilters } from "@/components/financeiro/LancamentosTabContent";
import type { FinanceiroLancamento, Empreendimento, Projeto, Campanha, CategoriaFinanceira } from "@shared/schema";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Pie, Bar } from "react-chartjs-2";

import { ECO_PALETTE, ECO_CHART_COLORS, FIN_COLORS, ecoAlpha } from "@/lib/eco-palette";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const CHART_COLORS = ECO_CHART_COLORS;

interface ExpenseEvolutionData {
  categorias: Array<{ id: number; nome: string; tipo: string }>;
  evolucao: Array<{ mes: string; valores: { [categoriaId: number]: number } }>;
}

interface FinancialStats {
  evolucaoMensal?: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
  porCategoria?: Array<{ categoria: string; valor: number }>;
  porEmpreendimento?: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number }>;
  porProjeto?: Array<{ projeto: string; projetoId: number; receitas: number; despesas: number; lucro: number }>;
  porCampanha?: Array<{ campanha: string; campanhaId: number; receitas: number; despesas: number; lucro: number }>;
}

export default function FinanceiroPage() {
  const [filters, setFilters] = useState({ tipo: "todos", status: "todos", empreendimento: "", search: "", unidade: "todas" });
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState("todos");
  const [selectedProjetoId, setSelectedProjetoId] = useState("todos");
  const [selectedCampanhaId, setSelectedCampanhaId] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLancamento, setEditingLancamento] = useState<FinanceiroLancamento | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLancamentoId, setDeletingLancamentoId] = useState<number | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState("todas");
  const [selectedCatsForProjeto, setSelectedCatsForProjeto] = useState<Set<number>>(new Set());
  const [selectedCatsForCampanha, setSelectedCatsForCampanha] = useState<Set<number>>(new Set());
  const [selectedReembolso, setSelectedReembolso] = useState<any>(null);
  const [isReembolsoDetailOpen, setIsReembolsoDetailOpen] = useState(false);
  const [reembolsoObservacao, setReembolsoObservacao] = useState("");
  const [pagamentoInfo, setPagamentoInfo] = useState({ formaPagamento: "", dataPagamento: "" });
  const [reciboDialogOpen, setReciboDialogOpen] = useState(false);
  const [reciboForm, setReciboForm] = useState<any>({ lancamentoId: null, empreendimentoId: null, numero: "", descricao: "", valor: "", pagador: "", recebedor: "", dataPagamento: "", metodoPagamento: "pix", categoria: "", observacoes: "", unidade: "" });

  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const expenseEvolutionChartRef = useRef<HTMLCanvasElement>(null);
  // Off-screen refs always rendered for PDF export (not affected by tab visibility)
  const lineChartExportRef = useRef<HTMLCanvasElement>(null);
  const pieChartExportRef = useRef<HTMLCanvasElement>(null);
  const barChartExportRef = useRef<HTMLCanvasElement>(null);
  const expenseEvolutionExportRef = useRef<HTMLCanvasElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Queries ──────────────────────────────────────────────────────────────
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.tipo !== "todos") params.append("tipo", filters.tipo);
    if (filters.status !== "todos") params.append("status", filters.status);
    if (selectedEmpreendimentoId !== "todos") params.append("empreendimentoId", selectedEmpreendimentoId);
    if (selectedProjetoId !== "todos") params.append("projetoId", selectedProjetoId);
    if (selectedCampanhaId !== "todos") params.append("campanhaId", selectedCampanhaId);
    if (filters.search) params.append("search", filters.search);
    if (filters.unidade !== "todas") params.append("unidade", filters.unidade);
    const q = params.toString();
    return q ? `?${q}` : "";
  };

  const { data: lancamentos = [], isLoading } = useQuery<FinanceiroLancamento[]>({
    queryKey: ["/api/financeiro/lancamentos", filters.tipo, filters.status, selectedEmpreendimentoId, selectedProjetoId, selectedCampanhaId, filters.search, filters.unidade],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/lancamentos${buildQueryString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lancamentos");
      return res.json();
    },
  });

  const { data: stats } = useQuery<FinancialStats>({
    queryKey: ["/api/financeiro/stats", selectedEmpreendimentoId],
    queryFn: async () => {
      const params = selectedEmpreendimentoId !== "todos" ? `?empreendimentoId=${selectedEmpreendimentoId}` : "";
      const res = await fetch(`/api/financeiro/stats${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: expenseEvolution } = useQuery<ExpenseEvolutionData>({
    queryKey: ["/api/financeiro/expense-evolution", selectedExpenseCategory, selectedEmpreendimentoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEmpreendimentoId !== "todos") params.append("empreendimentoId", selectedEmpreendimentoId);
      if (selectedExpenseCategory !== "todas") params.append("categoriaId", selectedExpenseCategory);
      const q = params.toString();
      const res = await fetch(`/api/financeiro/expense-evolution${q ? `?${q}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expense evolution");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ["/api/empreendimentos"] });
  const { data: allProjetos = [] } = useQuery<Projeto[]>({ queryKey: ["/api/projetos"] });
  const { data: allCampanhas = [] } = useQuery<Campanha[]>({ queryKey: ["/api/campanhas"] });
  const { data: categoriasFinanceirasData = [] } = useQuery<CategoriaFinanceira[]>({ queryKey: ["/api/categorias-financeiras"] });
  const { data: lancamentosAllForChart = [] } = useQuery<FinanceiroLancamento[]>({
    queryKey: ["/api/financeiro/lancamentos/chart-all", selectedEmpreendimentoId],
    queryFn: async () => {
      const params = selectedEmpreendimentoId !== "todos" ? `?empreendimentoId=${selectedEmpreendimentoId}` : "";
      const res = await fetch(`/api/financeiro/lancamentos${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lancamentos for chart");
      return res.json();
    },
  });
  const { data: recibosData = [] } = useQuery<any[]>({ queryKey: ["/api/recibos"] });

  const { data: reembolsosFinanceiro = [], isLoading: loadingReembolsosFinanceiro } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "financeiroPendente"],
    queryFn: async () => { const res = await fetch("/api/reembolsos?financeiroPendente=true", { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  const { data: reembolsosDiretor = [], isLoading: loadingReembolsosDiretor } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "diretorPendente"],
    queryFn: async () => { const res = await fetch("/api/reembolsos?diretorPendente=true", { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  const { data: reembolsosAprovados = [], isLoading: loadingReembolsosAprovados } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "aprovado_diretor"],
    queryFn: async () => { const res = await fetch("/api/reembolsos?status=aprovado_diretor", { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidateFinanceiro = () => queryClient.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.startsWith?.("/api/financeiro") ?? false });
  const invalidateReembolsos = () => queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => apiRequest("PUT", `/api/financeiro/lancamentos/${id}`, { status }),
    onSuccess: () => { invalidateFinanceiro(); toast({ title: "Status atualizado" }); },
    onError: (e: Error) => { toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" }); console.error(e); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/financeiro/lancamentos/${id}`),
    onSuccess: () => { invalidateFinanceiro(); toast({ title: "Lançamento excluído" }); setDeleteDialogOpen(false); setDeletingLancamentoId(null); },
    onError: (e: Error) => { toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" }); console.error(e); },
  });

  const updateLancamentoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FinanceiroLancamento> }) => apiRequest("PUT", `/api/financeiro/lancamentos/${id}`, data),
    onSuccess: () => { invalidateFinanceiro(); toast({ title: "Lançamento atualizado" }); setEditDialogOpen(false); setEditingLancamento(null); },
    onError: (e: Error) => { toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }); console.error(e); },
  });

  const createReciboMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/recibos", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recibos"] }); toast({ title: "Recibo emitido" }); setReciboDialogOpen(false); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  const onReembolsoSuccess = () => { invalidateReembolsos(); toast({ title: "Sucesso" }); setIsReembolsoDetailOpen(false); setSelectedReembolso(null); setReembolsoObservacao(""); };
  const onReembolsoError = (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" });

  const aprovarFinanceiroMutation = useMutation({
    mutationFn: (args: { id: number; observacao?: string }) => apiRequest("POST", `/api/reembolsos/${args.id}/aprovar-financeiro`, { observacao: args.observacao }),
    onSuccess: onReembolsoSuccess, onError: onReembolsoError,
  });

  const rejeitarFinanceiroMutation = useMutation({
    mutationFn: (args: { id: number; observacao?: string }) => apiRequest("POST", `/api/reembolsos/${args.id}/rejeitar-financeiro`, { observacao: args.observacao }),
    onSuccess: onReembolsoSuccess, onError: onReembolsoError,
  });

  const aprovarDiretorMutation = useMutation({
    mutationFn: (args: { id: number; observacao?: string }) => apiRequest("POST", `/api/reembolsos/${args.id}/aprovar-diretor`, { observacao: args.observacao }),
    onSuccess: onReembolsoSuccess, onError: onReembolsoError,
  });

  const rejeitarDiretorMutation = useMutation({
    mutationFn: (args: { id: number; observacao?: string }) => apiRequest("POST", `/api/reembolsos/${args.id}/rejeitar-diretor`, { observacao: args.observacao }),
    onSuccess: onReembolsoSuccess, onError: onReembolsoError,
  });

  const pagarReembolsoMutation = useMutation({
    mutationFn: (args: { id: number; formaPagamento: string; dataPagamento: string }) =>
      apiRequest("POST", `/api/reembolsos/${args.id}/pagar`, { formaPagamento: args.formaPagamento, dataPagamento: args.dataPagamento }),
    onSuccess: () => { invalidateReembolsos(); toast({ title: "Sucesso", description: "Reembolso marcado como pago!" }); setIsReembolsoDetailOpen(false); setSelectedReembolso(null); setPagamentoInfo({ formaPagamento: "", dataPagamento: "" }); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const recibosLancamentoIds = new Set<number>(recibosData.filter(r => r.lancamentoId).map(r => r.lancamentoId));
  const empMap = new Map<number | null, string>([[null, "Escritório"], ...empreendimentos.map(e => [e.id, e.nome] as [number, string])]);

  const projetosFiltrados = allProjetos.filter(p =>
    selectedEmpreendimentoId === "todos" || (p as any).empreendimentoId?.toString() === selectedEmpreendimentoId
  );
  const campanhasFiltradas = allCampanhas.filter(c =>
    (selectedEmpreendimentoId === "todos" || c.empreendimentoId?.toString() === selectedEmpreendimentoId) &&
    (selectedProjetoId === "todos" || c.projetoId?.toString() === selectedProjetoId)
  );

  const totalReceitas = lancamentos.filter(l => l.tipo === "receita" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas = lancamentos.filter(l => l.tipo === "despesa" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
  const totalPendente = lancamentos.filter(l => l.status === "aguardando").reduce((s, l) => s + Number(l.valor), 0);
  const saldoAtual = totalReceitas - totalDespesas;

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" as const } } };

  const lineChartData = {
    labels: stats?.evolucaoMensal?.map(m => m.mes) || [],
    datasets: [
      { label: "Receitas", data: stats?.evolucaoMensal?.map(m => m.receitas) || [], borderColor: FIN_COLORS.receita, backgroundColor: FIN_COLORS.receitaSoft, fill: true, tension: 0.4 },
      { label: "Despesas", data: stats?.evolucaoMensal?.map(m => m.despesas) || [], borderColor: FIN_COLORS.despesa, backgroundColor: FIN_COLORS.despesaSoft, fill: true, tension: 0.4 },
      { label: "Lucro", data: stats?.evolucaoMensal?.map(m => m.lucro) || [], borderColor: FIN_COLORS.lucro, backgroundColor: FIN_COLORS.lucroSoft, fill: true, tension: 0.4 },
    ],
  };

  const pieChartData = {
    labels: stats?.porCategoria?.map(c => c.categoria) || [],
    datasets: [{ data: stats?.porCategoria?.map(c => c.valor) || [], backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: "#fff" }],
  };

  const barChartData = {
    labels: stats?.porEmpreendimento?.map(e => e.empreendimento) || [],
    datasets: [
      { label: "Receitas", data: stats?.porEmpreendimento?.map(e => e.receitas) || [], backgroundColor: FIN_COLORS.receitaSolid },
      { label: "Despesas", data: stats?.porEmpreendimento?.map(e => e.despesas) || [], backgroundColor: FIN_COLORS.despesaSolid },
      { label: "Lucro", data: stats?.porEmpreendimento?.map(e => e.lucro) || [], backgroundColor: FIN_COLORS.lucroSolid },
    ],
  };

  const projetoChartData = {
    labels: stats?.porProjeto?.map(p => p.projeto) || [],
    datasets: [
      { label: "Receitas", data: stats?.porProjeto?.map(p => p.receitas) || [], backgroundColor: FIN_COLORS.receitaSolid },
      { label: "Despesas", data: stats?.porProjeto?.map(p => p.despesas) || [], backgroundColor: FIN_COLORS.despesaSolid },
      { label: "Lucro", data: stats?.porProjeto?.map(p => p.lucro) || [], backgroundColor: FIN_COLORS.lucroSolid },
    ],
  };

  const campanhaChartData = {
    labels: stats?.porCampanha?.map(c => c.campanha) || [],
    datasets: [
      { label: "Receitas", data: stats?.porCampanha?.map(c => c.receitas) || [], backgroundColor: FIN_COLORS.receitaSolid },
      { label: "Despesas", data: stats?.porCampanha?.map(c => c.despesas) || [], backgroundColor: FIN_COLORS.despesaSolid },
      { label: "Lucro", data: stats?.porCampanha?.map(c => c.lucro) || [], backgroundColor: FIN_COLORS.lucroSolid },
    ],
  };

  // ── Per-category expense breakdown by Projeto ──
  const despesasCatsByProjeto = (() => {
    const projIds = [...new Set(lancamentosAllForChart.filter(l => l.projetoId && l.tipo === "despesa").map(l => l.projetoId!))];
    const projLabels = projIds.map(id => allProjetos.find(p => p.id === id)?.nome ?? `Projeto ${id}`);
    const catIds = [...new Set(lancamentosAllForChart.filter(l => l.projetoId && l.tipo === "despesa").map(l => l.categoriaId).filter(Boolean))] as number[];
    const catNames: Record<number, string> = Object.fromEntries(categoriasFinanceirasData.map(c => [c.id, c.nome]));
    const activeCatIds = catIds.filter(id => selectedCatsForProjeto.size === 0 || selectedCatsForProjeto.has(id));
    const CAT_PAL = [...ECO_PALETTE, ...ECO_PALETTE];
    const datasets = activeCatIds.map((catId, i) => ({
      label: catNames[catId] ?? `Cat. ${catId}`,
      data: projIds.map(pid => lancamentosAllForChart.filter(l => l.projetoId === pid && l.tipo === "despesa" && l.categoriaId === catId).reduce((s, l) => s + Number(l.valor), 0)),
      backgroundColor: CAT_PAL[i % CAT_PAL.length],
      stack: "despesas",
    }));
    return { projIds, projLabels, catIds, catNames, datasets, CAT_PAL };
  })();

  const projetoCatChartData = {
    labels: despesasCatsByProjeto.projLabels,
    datasets: despesasCatsByProjeto.datasets,
  };

  // ── Per-category expense breakdown by Campanha ──
  const despesasCatsByCampanha = (() => {
    const campIds = [...new Set(lancamentosAllForChart.filter(l => l.campanhaId && l.tipo === "despesa").map(l => l.campanhaId!))] as number[];
    const campLabels = campIds.map(id => allCampanhas.find(c => c.id === id)?.nome ?? `Campanha ${id}`);
    const catIds = [...new Set(lancamentosAllForChart.filter(l => l.campanhaId && l.tipo === "despesa").map(l => l.categoriaId).filter(Boolean))] as number[];
    const catNames: Record<number, string> = Object.fromEntries(categoriasFinanceirasData.map(c => [c.id, c.nome]));
    const activeCatIds = catIds.filter(id => selectedCatsForCampanha.size === 0 || selectedCatsForCampanha.has(id));
    const CAT_PAL = [...ECO_PALETTE, ...ECO_PALETTE];
    const datasets = activeCatIds.map((catId, i) => ({
      label: catNames[catId] ?? `Cat. ${catId}`,
      data: campIds.map(cid => lancamentosAllForChart.filter(l => l.campanhaId === cid && l.tipo === "despesa" && l.categoriaId === catId).reduce((s, l) => s + Number(l.valor), 0)),
      backgroundColor: CAT_PAL[i % CAT_PAL.length],
      stack: "despesas",
    }));
    return { campIds, campLabels, catIds, catNames, datasets, CAT_PAL };
  })();

  const campanhaCatChartData = {
    labels: despesasCatsByCampanha.campLabels,
    datasets: despesasCatsByCampanha.datasets,
  };

  const stackedBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: R$ ${Number(ctx.raw || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: { stacked: true },
      y: { stacked: true, ticks: { callback: (v: any) => `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` } },
    },
  };

  const expenseEvolutionChartData = {
    labels: expenseEvolution?.evolucao?.map(e => e.mes) || [],
    datasets: (() => {
      if (!expenseEvolution) return [];
      const cats = selectedExpenseCategory === "todas" ? expenseEvolution.categorias : expenseEvolution.categorias.filter(c => c.id.toString() === selectedExpenseCategory);
      return cats.map((cat, i) => ({ label: cat.nome, data: expenseEvolution.evolucao.map(e => e.valores[cat.id] || 0), backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }));
    })(),
  };

  const handleOpenReciboFromLancamento = (lancamento: FinanceiroLancamento) => {
    const empNome = empreendimentos.find(e => e.id === lancamento.empreendimentoId)?.nome ?? "";
    setReciboForm({ lancamentoId: lancamento.id, empreendimentoId: lancamento.empreendimentoId, numero: "", descricao: lancamento.descricao ?? "", valor: String(lancamento.valor), pagador: empNome, recebedor: "Maurivan Vaz Ribeiro", dataPagamento: lancamento.dataPagamento ?? lancamento.data ?? "", metodoPagamento: "pix", categoria: lancamento.tipo === "receita" ? "Receita" : "Despesa", observacoes: "", unidade: lancamento.unidade ?? "" });
    setReciboDialogOpen(true);
  };

  const handleSelectReembolso = (r: any) => { setSelectedReembolso(r); setIsReembolsoDetailOpen(true); };

  if (isLoading) return (
    <div className="container mx-auto py-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
      <p>Carregando módulo financeiro...</p>
    </div>
  );

  const EmptyChart = ({ icon: Icon, label }: { icon: any; label: string }) => (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <div className="text-center"><Icon className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>{label}</p></div>
    </div>
  );

  return (
    <SensitivePageWrapper moduleName="Módulo Financeiro">
    <div className="container mx-auto py-8 space-y-6" data-testid="page-financeiro">

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Módulo Financeiro</h1>
            <p className="text-muted-foreground mt-2">Gestão completa dos aspectos econômicos dos projetos</p>
          </div>
          <div className="flex gap-3">
            <FinancialReportPDF stats={stats} empreendimentos={empreendimentos} lineChartRef={lineChartExportRef} pieChartRef={pieChartExportRef} barChartRef={barChartExportRef} expenseEvolutionChartRef={expenseEvolutionExportRef} />
            <Button variant="outline" onClick={() => window.open("/api/financeiro/export-excel", "_blank")} data-testid="button-exportar-excel">
              <Download className="h-4 w-4 mr-2" />Exportar Excel
            </Button>
            <RefreshButton />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-novo-lancamento">
                <Plus className="h-4 w-4 mr-2" />Novo Lançamento
              </Button>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Novo Lançamento Financeiro</DialogTitle></DialogHeader>
                <NovoLancamentoForm onSuccess={() => setDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Empreendimento / Projeto / Campanha Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-muted/50 rounded-lg p-3">
          <Building className="h-5 w-5 text-muted-foreground" />
          <Label className="text-sm font-medium whitespace-nowrap">Empreendimento:</Label>
          <Select value={selectedEmpreendimentoId} onValueChange={(v) => { setSelectedEmpreendimentoId(v); setSelectedProjetoId("todos"); setSelectedCampanhaId("todos"); }}>
            <SelectTrigger className="w-[220px]" data-testid="select-empreendimento-filter">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Empreendimentos</SelectItem>
              {empreendimentos.map(emp => <SelectItem key={emp.id} value={emp.id.toString()}>{emp.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <Label className="text-sm font-medium whitespace-nowrap">Projeto:</Label>
          <Select value={selectedProjetoId} onValueChange={(v) => { setSelectedProjetoId(v); setSelectedCampanhaId("todos"); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Projetos</SelectItem>
              {(projetosFiltrados.length > 0 ? projetosFiltrados : allProjetos).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <Label className="text-sm font-medium whitespace-nowrap">Campanha:</Label>
          <Select value={selectedCampanhaId} onValueChange={setSelectedCampanhaId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Campanhas</SelectItem>
              {(campanhasFiltradas.length > 0 ? campanhasFiltradas : allCampanhas).map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          {(selectedEmpreendimentoId !== "todos" || selectedProjetoId !== "todos" || selectedCampanhaId !== "todos") && (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedEmpreendimentoId("todos"); setSelectedProjetoId("todos"); setSelectedCampanhaId("todos"); }} data-testid="button-limpar-filtro">Limpar Filtros</Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Receitas", value: fmtBRL(totalReceitas), icon: TrendingUp, color: "text-green-600", sub: "Valores recebidos e confirmados", testId: "text-total-receitas" },
          { label: "Total Despesas", value: fmtBRL(totalDespesas), icon: TrendingDown, color: "text-red-600", sub: "Valores pagos e confirmados", testId: "text-total-despesas" },
          { label: "Saldo Atual", value: fmtBRL(saldoAtual), icon: Wallet, color: saldoAtual >= 0 ? "text-green-600" : "text-red-600", sub: "Receitas menos despesas", testId: "text-saldo-atual" },
          { label: "Pendente Aprovação", value: fmtBRL(totalPendente), icon: Clock, color: "text-yellow-600", sub: "Aguardando análise e aprovação", testId: "text-total-pendente" },
        ].map(({ label, value, icon: Icon, color, sub, testId }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${color}`} data-testid={testId}>{value}</div>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="resumo" data-testid="tab-resumo"><BarChart3 className="h-4 w-4 mr-1 hidden sm:block" />Resumo</TabsTrigger>
          <TabsTrigger value="evolucao" data-testid="tab-evolucao"><LineChart className="h-4 w-4 mr-1 hidden sm:block" />Evolução</TabsTrigger>
          <TabsTrigger value="projetos" data-testid="tab-projetos"><Building className="h-4 w-4 mr-1 hidden sm:block" />Projeto</TabsTrigger>
          <TabsTrigger value="campanhas" data-testid="tab-campanhas"><PieChart className="h-4 w-4 mr-1 hidden sm:block" />Campanha</TabsTrigger>
          <TabsTrigger value="lancamentos" data-testid="tab-lancamentos"><FileText className="h-4 w-4 mr-1 hidden sm:block" />Lançamentos</TabsTrigger>
          <TabsTrigger value="reembolsos" data-testid="tab-reembolsos">
            <Receipt className="h-4 w-4 mr-1 hidden sm:block" />
            Reembolsos ({reembolsosFinanceiro.length + reembolsosDiretor.length + reembolsosAprovados.length})
          </TabsTrigger>
          <TabsTrigger value="recibos" data-testid="tab-recibos"><Wallet className="h-4 w-4 mr-1 hidden sm:block" />Recibos</TabsTrigger>
        </TabsList>

        {/* Resumo */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" />Evolução Mensal</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats?.evolucaoMensal?.length ? <Line ref={lineChartRef as any} data={lineChartData} options={chartOptions} /> : <EmptyChart icon={LineChart} label="Sem dados para exibir" />}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" />Gastos por Categoria</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats?.porCategoria?.length ? <Pie ref={pieChartRef as any} data={pieChartData} options={chartOptions} /> : <EmptyChart icon={PieChart} label="Sem dados para exibir" />}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evolução */}
        <TabsContent value="evolucao" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" />Evolução Financeira (Últimos 12 meses)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {stats?.evolucaoMensal?.length ? <Line data={lineChartData} options={chartOptions} /> : <EmptyChart icon={LineChart} label="Adicione lançamentos para visualizar a evolução" />}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Evolução de Despesas por Tipo</CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap">Filtrar por tipo:</Label>
                  <Select value={selectedExpenseCategory} onValueChange={setSelectedExpenseCategory}>
                    <SelectTrigger className="w-[200px]" data-testid="select-expense-category-filter">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as categorias</SelectItem>
                      {expenseEvolution?.categorias?.map(cat => <SelectItem key={cat.id} value={cat.id.toString()}>{cat.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {expenseEvolutionChartData.datasets.length > 0 ? (
                  <Bar ref={expenseEvolutionChartRef as any} data={expenseEvolutionChartData} options={{ ...chartOptions, scales: { x: { stacked: false }, y: { stacked: false, ticks: { callback: (v) => `R$ ${Number(v).toLocaleString("pt-BR")}` } } } }} />
                ) : <EmptyChart icon={BarChart3} label="Adicione despesas para visualizar a evolução por tipo" />}
              </div>
            </CardContent>
          </Card>
          {stats?.evolucaoMensal && stats.evolucaoMensal.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Detalhamento Mensal</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Mês</th>
                        <th className="text-right p-4">Receitas</th>
                        <th className="text-right p-4">Despesas</th>
                        <th className="text-right p-4">Lucro/Prejuízo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.evolucaoMensal.map((mes, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-4 font-medium">{mes.mes}</td>
                          <td className="p-4 text-right text-green-600">{fmtBRL(mes.receitas)}</td>
                          <td className="p-4 text-right text-red-600">{fmtBRL(mes.despesas)}</td>
                          <td className={`p-4 text-right font-bold ${mes.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtBRL(mes.lucro)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Por Projeto */}
        <TabsContent value="projetos" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Receitas e Despesas por Projeto</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {stats?.porProjeto?.length ? <Bar ref={barChartRef as any} data={projetoChartData} options={chartOptions} /> : <EmptyChart icon={Building} label="Adicione lançamentos com projeto para visualizar" />}
              </div>
            </CardContent>
          </Card>

          {/* ── Gastos por Categoria — Projeto ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5 text-orange-500" />Gastos por Categoria — Projeto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {despesasCatsByProjeto.catIds.length > 0 ? (<>
                {/* Category selector */}
                <div className="flex flex-wrap gap-1.5 pb-2 border-b">
                  <span className="text-xs text-muted-foreground self-center mr-1">Categorias:</span>
                  {despesasCatsByProjeto.catIds.map((catId, i) => {
                    const active = selectedCatsForProjeto.size === 0 || selectedCatsForProjeto.has(catId);
                    return (
                      <button key={catId}
                        onClick={() => setSelectedCatsForProjeto(prev => {
                          const base = prev.size > 0 ? new Set(prev) : new Set(despesasCatsByProjeto.catIds);
                          if (base.has(catId)) base.delete(catId); else base.add(catId);
                          if (base.size === despesasCatsByProjeto.catIds.length) return new Set<number>();
                          return new Set<number>(base);
                        })}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${active ? "text-white border-transparent shadow-sm" : "bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-80"}`}
                        style={active ? { backgroundColor: despesasCatsByProjeto.CAT_PAL[i % despesasCatsByProjeto.CAT_PAL.length] } : {}}>
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: despesasCatsByProjeto.CAT_PAL[i % despesasCatsByProjeto.CAT_PAL.length] }} />
                        {despesasCatsByProjeto.catNames[catId] ?? `Cat. ${catId}`}
                      </button>
                    );
                  })}
                  {selectedCatsForProjeto.size > 0 && (
                    <button onClick={() => setSelectedCatsForProjeto(new Set())} className="text-xs text-red-400 hover:text-red-600 underline ml-1">Todas</button>
                  )}
                </div>
                <div className="h-[350px]">
                  {projetoCatChartData.datasets.length > 0
                    ? <Bar data={projetoCatChartData} options={stackedBarOptions as any} />
                    : <EmptyChart icon={Building} label="Selecione ao menos uma categoria" />}
                </div>
                {/* Summary table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left">Projeto</th>
                        {despesasCatsByProjeto.catIds.filter(id => selectedCatsForProjeto.size === 0 || selectedCatsForProjeto.has(id)).map(id => (
                          <th key={id} className="px-3 py-2 text-right">{despesasCatsByProjeto.catNames[id] ?? `Cat.${id}`}</th>
                        ))}
                        <th className="px-3 py-2 text-right font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {despesasCatsByProjeto.projLabels.map((proj, pi) => {
                        const activeCatIds = despesasCatsByProjeto.catIds.filter(id => selectedCatsForProjeto.size === 0 || selectedCatsForProjeto.has(id));
                        const total = activeCatIds.reduce((s, catId) => s + (despesasCatsByProjeto.datasets.find(d => d.label === despesasCatsByProjeto.catNames[catId])?.data[pi] ?? 0), 0);
                        return (
                          <tr key={pi} className={pi % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                            <td className="px-3 py-1.5 font-medium">{proj}</td>
                            {activeCatIds.map(catId => {
                              const ds = despesasCatsByProjeto.datasets.find(d => d.label === despesasCatsByProjeto.catNames[catId]);
                              return <td key={catId} className="px-3 py-1.5 text-right tabular-nums text-red-600">{fmtBRL(ds?.data[pi] ?? 0)}</td>;
                            })}
                            <td className="px-3 py-1.5 text-right tabular-nums font-bold">{fmtBRL(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>) : (
                <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma despesa com projeto e categoria registrada.</div>
              )}
            </CardContent>
          </Card>

          {stats?.porProjeto && stats.porProjeto.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.porProjeto.map((proj, idx) => (
                <Card key={idx} className="border-l-4" style={{ borderLeftColor: proj.lucro >= 0 ? "#22c55e" : "#ef4444" }}>
                  <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Building className="h-4 w-4" />{proj.projeto}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Receitas:</span><span className="text-green-600 font-medium">{fmtBRL(proj.receitas)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Despesas:</span><span className="text-red-600 font-medium">{fmtBRL(proj.despesas)}</span></div>
                    <div className="flex justify-between border-t pt-2"><span className="font-medium">Lucro:</span><span className={`font-bold ${proj.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtBRL(proj.lucro)}</span></div>
                    <div className="text-xs text-muted-foreground">Margem: {proj.receitas > 0 ? ((proj.lucro / proj.receitas) * 100).toFixed(1) : 0}%</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhum lançamento com projeto cadastrado.</CardContent></Card>
          )}
        </TabsContent>

        {/* Por Campanha */}
        <TabsContent value="campanhas" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Receitas e Despesas por Campanha</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {stats?.porCampanha?.length ? <Bar data={campanhaChartData} options={chartOptions} /> : <EmptyChart icon={PieChart} label="Adicione lançamentos com campanha para visualizar" />}
              </div>
            </CardContent>
          </Card>

          {/* ── Gastos por Categoria — Campanha ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5 text-indigo-500" />Gastos por Categoria — Campanha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {despesasCatsByCampanha.catIds.length > 0 ? (<>
                {/* Category selector */}
                <div className="flex flex-wrap gap-1.5 pb-2 border-b">
                  <span className="text-xs text-muted-foreground self-center mr-1">Categorias:</span>
                  {despesasCatsByCampanha.catIds.map((catId, i) => {
                    const active = selectedCatsForCampanha.size === 0 || selectedCatsForCampanha.has(catId);
                    return (
                      <button key={catId}
                        onClick={() => setSelectedCatsForCampanha(prev => {
                          const base = prev.size > 0 ? new Set(prev) : new Set(despesasCatsByCampanha.catIds);
                          if (base.has(catId)) base.delete(catId); else base.add(catId);
                          if (base.size === despesasCatsByCampanha.catIds.length) return new Set<number>();
                          return new Set<number>(base);
                        })}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${active ? "text-white border-transparent shadow-sm" : "bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-80"}`}
                        style={active ? { backgroundColor: despesasCatsByCampanha.CAT_PAL[i % despesasCatsByCampanha.CAT_PAL.length] } : {}}>
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: despesasCatsByCampanha.CAT_PAL[i % despesasCatsByCampanha.CAT_PAL.length] }} />
                        {despesasCatsByCampanha.catNames[catId] ?? `Cat. ${catId}`}
                      </button>
                    );
                  })}
                  {selectedCatsForCampanha.size > 0 && (
                    <button onClick={() => setSelectedCatsForCampanha(new Set())} className="text-xs text-red-400 hover:text-red-600 underline ml-1">Todas</button>
                  )}
                </div>
                <div className="h-[350px]">
                  {campanhaCatChartData.datasets.length > 0
                    ? <Bar data={campanhaCatChartData} options={stackedBarOptions as any} />
                    : <EmptyChart icon={PieChart} label="Selecione ao menos uma categoria" />}
                </div>
                {/* Summary table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left">Campanha</th>
                        {despesasCatsByCampanha.catIds.filter(id => selectedCatsForCampanha.size === 0 || selectedCatsForCampanha.has(id)).map(id => (
                          <th key={id} className="px-3 py-2 text-right">{despesasCatsByCampanha.catNames[id] ?? `Cat.${id}`}</th>
                        ))}
                        <th className="px-3 py-2 text-right font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {despesasCatsByCampanha.campLabels.map((camp, ci) => {
                        const activeCatIds = despesasCatsByCampanha.catIds.filter(id => selectedCatsForCampanha.size === 0 || selectedCatsForCampanha.has(id));
                        const total = activeCatIds.reduce((s, catId) => s + (despesasCatsByCampanha.datasets.find(d => d.label === despesasCatsByCampanha.catNames[catId])?.data[ci] ?? 0), 0);
                        return (
                          <tr key={ci} className={ci % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                            <td className="px-3 py-1.5 font-medium">{camp}</td>
                            {activeCatIds.map(catId => {
                              const ds = despesasCatsByCampanha.datasets.find(d => d.label === despesasCatsByCampanha.catNames[catId]);
                              return <td key={catId} className="px-3 py-1.5 text-right tabular-nums text-red-600">{fmtBRL(ds?.data[ci] ?? 0)}</td>;
                            })}
                            <td className="px-3 py-1.5 text-right tabular-nums font-bold">{fmtBRL(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>) : (
                <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma despesa com campanha e categoria registrada.</div>
              )}
            </CardContent>
          </Card>

          {stats?.porCampanha && stats.porCampanha.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.porCampanha.map((camp, idx) => (
                <Card key={idx} className="border-l-4" style={{ borderLeftColor: camp.lucro >= 0 ? "#22c55e" : "#ef4444" }}>
                  <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><PieChart className="h-4 w-4" />{camp.campanha}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Receitas:</span><span className="text-green-600 font-medium">{fmtBRL(camp.receitas)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Despesas:</span><span className="text-red-600 font-medium">{fmtBRL(camp.despesas)}</span></div>
                    <div className="flex justify-between border-t pt-2"><span className="font-medium">Lucro:</span><span className={`font-bold ${camp.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtBRL(camp.lucro)}</span></div>
                    <div className="text-xs text-muted-foreground">Margem: {camp.receitas > 0 ? ((camp.lucro / camp.receitas) * 100).toFixed(1) : 0}%</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhum lançamento com campanha cadastrado.</CardContent></Card>
          )}
        </TabsContent>

        {/* Lançamentos */}
        <TabsContent value="lancamentos" className="space-y-6">
          <LancamentosTabContent
            lancamentos={lancamentos}
            filters={filters as LancamentosFilters}
            setFilters={setFilters as (f: LancamentosFilters) => void}
            recibosLancamentoIds={recibosLancamentoIds}
            empMap={empMap}
            onUpdateStatus={(id, status) => updateStatusMutation.mutate({ id, status })}
            onEmitirRecibo={handleOpenReciboFromLancamento}
            onEdit={l => { setEditingLancamento(l); setEditDialogOpen(true); }}
            onDelete={id => { setDeletingLancamentoId(id); setDeleteDialogOpen(true); }}
          />
        </TabsContent>

        {/* Reembolsos */}
        <TabsContent value="reembolsos" className="space-y-6">
          <ReembolsosTabContent
            reembolsosFinanceiro={reembolsosFinanceiro}
            reembolsosDiretor={reembolsosDiretor}
            reembolsosAprovados={reembolsosAprovados}
            loadingReembolsosFinanceiro={loadingReembolsosFinanceiro}
            loadingReembolsosDiretor={loadingReembolsosDiretor}
            loadingReembolsosAprovados={loadingReembolsosAprovados}
            onSelectReembolso={handleSelectReembolso}
          />
        </TabsContent>

        {/* Recibos */}
        <TabsContent value="recibos" className="space-y-6">
          <RecibosSection />
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <ReembolsoApprovalDialog
        open={isReembolsoDetailOpen}
        onOpenChange={setIsReembolsoDetailOpen}
        selectedReembolso={selectedReembolso}
        reembolsoObservacao={reembolsoObservacao}
        setReembolsoObservacao={setReembolsoObservacao}
        pagamentoInfo={pagamentoInfo}
        setPagamentoInfo={setPagamentoInfo}
        aprovarFinanceiroMutation={aprovarFinanceiroMutation}
        rejeitarFinanceiroMutation={rejeitarFinanceiroMutation}
        aprovarDiretorMutation={aprovarDiretorMutation}
        rejeitarDiretorMutation={rejeitarDiretorMutation}
        pagarMutation={pagarReembolsoMutation}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingLancamentoId && deleteMutation.mutate(deletingLancamentoId)} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-delete">
              {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Lançamento</DialogTitle></DialogHeader>
          {editingLancamento && (
            <EditLancamentoForm
              lancamento={editingLancamento}
              onSuccess={() => { setEditDialogOpen(false); setEditingLancamento(null); }}
              onCancel={() => { setEditDialogOpen(false); setEditingLancamento(null); }}
              updateMutation={updateLancamentoMutation}
            />
          )}
        </DialogContent>
      </Dialog>

      <ReciboDialog
        open={reciboDialogOpen}
        onOpenChange={setReciboDialogOpen}
        reciboForm={reciboForm}
        setReciboForm={setReciboForm}
        createReciboMutation={createReciboMutation}
      />

    </div>

    {/* Off-screen charts always rendered for PDF export — never display:none */}
    <div aria-hidden="true" style={{ position: "fixed", top: "-9999px", left: 0, width: "700px", height: "350px", pointerEvents: "none", opacity: 0 }}>
      {stats?.evolucaoMensal?.length ? (
        <Line ref={lineChartExportRef as any} data={lineChartData} options={{ ...chartOptions, animation: false as any }} />
      ) : null}
    </div>
    <div aria-hidden="true" style={{ position: "fixed", top: "-9999px", left: 0, width: "700px", height: "350px", pointerEvents: "none", opacity: 0 }}>
      {stats?.porCategoria?.length ? (
        <Pie ref={pieChartExportRef as any} data={pieChartData} options={{ ...chartOptions, animation: false as any }} />
      ) : null}
    </div>
    <div aria-hidden="true" style={{ position: "fixed", top: "-9999px", left: 0, width: "700px", height: "350px", pointerEvents: "none", opacity: 0 }}>
      {stats?.porEmpreendimento?.length ? (
        <Bar ref={barChartExportRef as any} data={barChartData} options={{ ...chartOptions, animation: false as any }} />
      ) : null}
    </div>
    <div aria-hidden="true" style={{ position: "fixed", top: "-9999px", left: 0, width: "700px", height: "350px", pointerEvents: "none", opacity: 0 }}>
      {expenseEvolutionChartData.datasets.length > 0 ? (
        <Bar ref={expenseEvolutionExportRef as any} data={expenseEvolutionChartData} options={{ ...chartOptions, animation: false as any, scales: { x: { stacked: false }, y: { stacked: false } } }} />
      ) : null}
    </div>

    </SensitivePageWrapper>
  );
}
