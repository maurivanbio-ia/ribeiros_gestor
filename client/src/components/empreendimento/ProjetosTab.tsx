import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { FolderKanban, DollarSign, TrendingUp, Calendar, Target, Plus, Edit, Trash2, CheckCircle, Clock, AlertCircle, Users, Wrench, Truck, RefreshCw, CalendarDays, BookOpen, AlertTriangle, ChevronDown, ChevronUp, X, ImageIcon, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Projeto, User } from "@shared/schema";

export interface ProjetosTabProps {
  empreendimentoId: number;
}

const statusOptions = [
  { value: "ativo",           label: "Ativo",           color: "bg-green-100 text-green-800 border-green-200" },
  { value: "em_planejamento", label: "Em Planejamento", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "em_andamento",    label: "Em Andamento",    color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "em_execucao",     label: "Em Execução",     color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "concluido",       label: "Concluído",       color: "bg-teal-100 text-teal-800 border-teal-200" },
  { value: "pausado",         label: "Pausado",         color: "bg-gray-100 text-gray-800 border-gray-200" },
  { value: "inativo",         label: "Inativo",         color: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "cancelado",       label: "Cancelado",       color: "bg-red-100 text-red-700 border-red-200" },
];

const periodicidadeOptions = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "pontual", label: "Pontual / Única vez" },
];

const getStatusColor = (status: string) => {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.color || "bg-gray-100 text-gray-800 border-gray-200";
};

const getStatusLabel = (status: string) => {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.label || status;
};

const getPeriodicidadeLabel = (value: string | null | undefined) => {
  if (!value) return null;
  return periodicidadeOptions.find(p => p.value === value)?.label || value;
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
};

const calcularEficiencia = (valorContratado: string | null, valorRecebido: string | null) => {
  const contratado = Number(valorContratado || 0);
  const recebido = Number(valorRecebido || 0);
  if (contratado === 0) return 0;
  return Math.round((recebido / contratado) * 100);
};

type ProjetoForm = {
  nome: string;
  descricao: string;
  status: string;
  valorContratado: string;
  valorRecebido: string;
  orcamentoPrevisto: string;
  inicioPrevisto: string;
  fimPrevisto: string;
  coordenadorId: string;
  periodicidade: string;
  metodologia: string;
};

const emptyForm: ProjetoForm = {
  nome: "",
  descricao: "",
  status: "em_planejamento",
  valorContratado: "",
  valorRecebido: "",
  orcamentoPrevisto: "",
  inicioPrevisto: "",
  fimPrevisto: "",
  coordenadorId: "",
  periodicidade: "",
  metodologia: "",
};

const TIPO_INTERCORRENCIA = [
  { value: "ocorrencia", label: "Ocorrência", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "anomalia", label: "Anomalia", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "impedimento", label: "Impedimento", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "observacao", label: "Observação", color: "bg-blue-100 text-blue-800 border-blue-200" },
];

export function ProjetosTab({ empreendimentoId }: ProjetosTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);
  const [projetoToDelete, setProjetoToDelete] = useState<Projeto | null>(null);
  const [form, setForm] = useState<ProjetoForm>(emptyForm);
  const [loadingResources, setLoadingResources] = useState(false);
  const [expandedProjetoId, setExpandedProjetoId] = useState<number | null>(null);
  const [intercorrenciaForm, setIntercorrenciaForm] = useState({ data: "", tipo: "ocorrencia", titulo: "", descricao: "" });
  const [addingIntercorrencia, setAddingIntercorrencia] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Seleções de recursos
  const [selectedMembroIds, setSelectedMembroIds] = useState<number[]>([]);
  const [selectedEquipamentoIds, setSelectedEquipamentoIds] = useState<number[]>([]);
  const [selectedVeiculoIds, setSelectedVeiculoIds] = useState<number[]>([]);

  const { data: projetos = [], isLoading } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos", empreendimentoId],
    queryFn: async () => {
      const res = await fetch(`/api/projetos?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar projetos");
      return res.json();
    },
  });

  const { data: coordenadores = [] } = useQuery<User[]>({
    queryKey: ["/api/users", "coordenadores"],
    queryFn: async () => {
      const res = await fetch("/api/users?cargo=coordenador");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: membrosDisponiveis = [] } = useQuery<any[]>({
    queryKey: ["/api/equipe"],
    queryFn: async () => {
      const res = await fetch("/api/equipe?ativo=true");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: equipamentosDisponiveis = [] } = useQuery<any[]>({
    queryKey: ["/api/equipamentos", empreendimentoId],
    queryFn: async () => {
      const res = await fetch(`/api/equipamentos?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: veiculosDisponiveis = [] } = useQuery<any[]>({
    queryKey: ["/api/frota", empreendimentoId],
    queryFn: async () => {
      const res = await fetch(`/api/frota?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: intercorrencias = [], refetch: refetchIntercorrencias } = useQuery<any[]>({
    queryKey: ["/api/projetos", expandedProjetoId, "intercorrencias"],
    queryFn: async () => {
      if (!expandedProjetoId) return [];
      const res = await fetch(`/api/projetos/${expandedProjetoId}/intercorrencias`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!expandedProjetoId,
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("imagem", file);
      const res = await fetch("/api/intercorrencias/upload-imagem", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Falha no upload");
      const { key } = await res.json();
      return key;
    } catch {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const addIntercorrenciaMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", `/api/projetos/${expandedProjetoId}/intercorrencias`, data),
    onSuccess: () => {
      refetchIntercorrencias();
      setIntercorrenciaForm({ data: "", tipo: "ocorrencia", titulo: "", descricao: "" });
      setPendingImages([]);
      setAddingIntercorrencia(false);
      toast({ title: "Intercorrência registrada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteIntercorrenciaMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/projetos/${expandedProjetoId}/intercorrencias/${id}`),
    onSuccess: () => { refetchIntercorrencias(); toast({ title: "Intercorrência removida" }); },
  });

  const loadProjetoResources = useCallback(async (projetoId: number) => {
    setLoadingResources(true);
    try {
      const [equipeRes, equipRes, veicRes] = await Promise.all([
        fetch(`/api/projetos/${projetoId}/equipe`),
        fetch(`/api/projetos/${projetoId}/equipamentos`),
        fetch(`/api/projetos/${projetoId}/veiculos`),
      ]);
      const [equipe, equips, veics] = await Promise.all([
        equipeRes.ok ? equipeRes.json() : [],
        equipRes.ok ? equipRes.json() : [],
        veicRes.ok ? veicRes.json() : [],
      ]);
      setSelectedMembroIds(equipe.map((m: any) => m.id));
      setSelectedEquipamentoIds(equips.map((e: any) => e.id));
      setSelectedVeiculoIds(veics.map((v: any) => v.id));
    } catch {
      // silent
    } finally {
      setLoadingResources(false);
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/projetos", data),
    onSuccess: async (res) => {
      const created = await res.json();
      await syncResources(created.id);
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto criado", description: "O projeto foi cadastrado com sucesso." });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/projetos/${id}`, data),
    onSuccess: async (_res, { id }) => {
      await syncResources(id);
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto atualizado", description: "O projeto foi atualizado com sucesso." });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/projetos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto excluído", description: "O projeto foi removido com sucesso." });
      setDeleteDialogOpen(false);
      setProjetoToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const syncResources = async (projetoId: number) => {
    await Promise.all([
      apiRequest("PATCH", `/api/projetos/${projetoId}/equipe`, { membroIds: selectedMembroIds }),
      apiRequest("PATCH", `/api/projetos/${projetoId}/equipamentos`, { equipamentoIds: selectedEquipamentoIds }),
      apiRequest("PATCH", `/api/projetos/${projetoId}/veiculos`, { veiculoIds: selectedVeiculoIds }),
    ]);
  };

  const handleOpenCreate = () => {
    setEditingProjeto(null);
    setForm(emptyForm);
    setSelectedMembroIds([]);
    setSelectedEquipamentoIds([]);
    setSelectedVeiculoIds([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (projeto: Projeto) => {
    setEditingProjeto(projeto);
    setForm({
      nome: projeto.nome,
      descricao: projeto.descricao || "",
      status: projeto.status,
      valorContratado: projeto.valorContratado || "",
      valorRecebido: projeto.valorRecebido || "",
      orcamentoPrevisto: projeto.orcamentoPrevisto || "",
      inicioPrevisto: projeto.inicioPrevisto || "",
      fimPrevisto: projeto.fimPrevisto || "",
      coordenadorId: projeto.coordenadorId?.toString() || "",
      periodicidade: (projeto as any).periodicidade || "",
      metodologia: (projeto as any).metodologia || "",
    });
    setSelectedMembroIds([]);
    setSelectedEquipamentoIds([]);
    setSelectedVeiculoIds([]);
    setDialogOpen(true);
    loadProjetoResources(projeto.id);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProjeto(null);
    setForm(emptyForm);
    setSelectedMembroIds([]);
    setSelectedEquipamentoIds([]);
    setSelectedVeiculoIds([]);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) {
      toast({ title: "Erro", description: "O nome do projeto é obrigatório.", variant: "destructive" });
      return;
    }

    const data = {
      nome: form.nome,
      descricao: form.descricao || null,
      status: form.status,
      valorContratado: form.valorContratado || null,
      valorRecebido: form.valorRecebido || null,
      orcamentoPrevisto: form.orcamentoPrevisto || null,
      inicioPrevisto: form.inicioPrevisto || null,
      fimPrevisto: form.fimPrevisto || null,
      coordenadorId: form.coordenadorId ? parseInt(form.coordenadorId) : null,
      periodicidade: form.periodicidade || null,
      metodologia: form.metodologia || null,
      empreendimentoId,
    };

    if (editingProjeto) {
      updateMutation.mutate({ id: editingProjeto.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (projeto: Projeto) => {
    setProjetoToDelete(projeto);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (projetoToDelete) {
      deleteMutation.mutate(projetoToDelete.id);
    }
  };

  const toggleId = (id: number, list: number[], setList: (v: number[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const projetosEmAndamento = projetos.filter(p => p.status === 'em_andamento');
  const projetosConcluidos = projetos.filter(p => p.status === 'concluido');
  const valorTotalContratado = projetos.reduce((sum, p) => sum + Number(p.valorContratado || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando projetos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Projetos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} vinculado{projetos.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2" data-testid="button-novo-projeto">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700">{projetos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-yellow-700">{projetosEmAndamento.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold text-green-700">{projetosConcluidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(valorTotalContratado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {projetos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {projetos.map((projeto) => {
            const eficiencia = calcularEficiencia(projeto.valorContratado, projeto.valorRecebido);
            const periLabel = getPeriodicidadeLabel((projeto as any).periodicidade);

            return (
              <Card key={projeto.id} className="hover:shadow-md transition-shadow" data-testid={`card-projeto-${projeto.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate" data-testid={`text-projeto-nome-${projeto.id}`}>
                        {projeto.nome}
                      </h4>
                      {projeto.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{projeto.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge className={getStatusColor(projeto.status)}>
                        {getStatusLabel(projeto.status)}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(projeto)} data-testid={`button-edit-${projeto.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(projeto)} data-testid={`button-delete-${projeto.id}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {periLabel && (
                    <div className="flex items-center gap-1.5 mb-2 text-xs text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-1 w-fit border border-indigo-200">
                      <RefreshCw className="h-3 w-3" />
                      {periLabel}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />Contratado
                      </p>
                      <p className="font-medium">{formatCurrency(projeto.valorContratado)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />Recebido
                      </p>
                      <p className="font-medium text-green-600">{formatCurrency(projeto.valorRecebido)}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Eficiência</span>
                      <span className="font-medium">{eficiencia}%</span>
                    </div>
                    <Progress value={eficiencia} className="h-2" />
                  </div>

                  {(projeto.inicioPrevisto || projeto.fimPrevisto) && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                      {projeto.inicioPrevisto && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Início: {formatDate(projeto.inicioPrevisto)}</span>
                        </div>
                      )}
                      {projeto.fimPrevisto && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          <span>Fim: {formatDate(projeto.fimPrevisto)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Toggle intercorrências + metodologia */}
                  <div className="pt-2 border-t mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const next = expandedProjetoId === projeto.id ? null : projeto.id;
                        setExpandedProjetoId(next);
                        setAddingIntercorrencia(false);
                        setIntercorrenciaForm({ data: "", tipo: "ocorrencia", titulo: "", descricao: "" });
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Metodologia & Intercorrências
                      </span>
                      {expandedProjetoId === projeto.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>

                    {expandedProjetoId === projeto.id && (
                      <div className="mt-3 space-y-4">
                        {/* Metodologia resumida */}
                        {(projeto as any).metodologia ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3">
                            <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1 mb-1.5">
                              <BookOpen className="h-3.5 w-3.5" />Metodologia
                            </p>
                            <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">{(projeto as any).metodologia}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />Metodologia não registrada. Use o botão editar para preencher.
                          </p>
                        )}

                        {/* Intercorrências */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />Intercorrências ({intercorrencias.length})
                            </p>
                            {!addingIntercorrencia && (
                              <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setAddingIntercorrencia(true)}>
                                <Plus className="h-3 w-3 mr-1" />Registrar
                              </Button>
                            )}
                          </div>

                          {addingIntercorrencia && (
                            <div className="border rounded-md p-3 bg-amber-50 border-amber-200 mb-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Data</label>
                                  <Input type="date" value={intercorrenciaForm.data} onChange={(e) => setIntercorrenciaForm({ ...intercorrenciaForm, data: e.target.value })} className="h-7 text-xs" />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                                  <Select value={intercorrenciaForm.tipo} onValueChange={(v) => setIntercorrenciaForm({ ...intercorrenciaForm, tipo: v })}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {TIPO_INTERCORRENCIA.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Título</label>
                                <Input value={intercorrenciaForm.titulo} onChange={(e) => setIntercorrenciaForm({ ...intercorrenciaForm, titulo: e.target.value })} className="h-7 text-xs" placeholder="Título da intercorrência" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                                <Textarea value={intercorrenciaForm.descricao} onChange={(e) => setIntercorrenciaForm({ ...intercorrenciaForm, descricao: e.target.value })} rows={2} className="text-xs" placeholder="Descreva a intercorrência..." />
                              </div>
                              {/* Upload de imagens */}
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Imagens (JPEG / PNG)</label>
                                <label className="mt-1 flex items-center gap-2 cursor-pointer w-fit px-3 py-1.5 rounded border border-dashed border-amber-400 bg-amber-100 hover:bg-amber-200 transition text-xs text-amber-800 font-medium">
                                  {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                                  {uploadingImage ? "Enviando..." : "Adicionar imagem"}
                                  <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={uploadingImage}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const key = await uploadImage(file);
                                      if (key) setPendingImages(prev => [...prev, key]);
                                      e.target.value = "";
                                    }} />
                                </label>
                                {pendingImages.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {pendingImages.map((key, i) => (
                                      <div key={key} className="relative group">
                                        <img src={`/api/intercorrencias/imagem?key=${encodeURIComponent(key)}`}
                                          className="h-16 w-16 object-cover rounded border border-amber-300" alt={`img-${i}`} />
                                        <button onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAddingIntercorrencia(false); setPendingImages([]); }}>Cancelar</Button>
                                <Button size="sm" className="h-7 text-xs" disabled={addIntercorrenciaMutation.isPending || !intercorrenciaForm.titulo || uploadingImage}
                                  onClick={() => addIntercorrenciaMutation.mutate({ data: intercorrenciaForm.data || new Date().toISOString().slice(0, 10), tipo: intercorrenciaForm.tipo, titulo: intercorrenciaForm.titulo, descricao: intercorrenciaForm.descricao || null, imagens: pendingImages, projetoId: projeto.id })}>
                                  {addIntercorrenciaMutation.isPending ? "Salvando..." : "Salvar"}
                                </Button>
                              </div>
                            </div>
                          )}

                          {intercorrencias.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Nenhuma intercorrência registrada.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {intercorrencias.map((ic: any) => {
                                const tipoInfo = TIPO_INTERCORRENCIA.find((t) => t.value === ic.tipo);
                                return (
                                  <div key={ic.id} className="border rounded-md p-2.5 bg-white relative">
                                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-5 w-5 text-red-400 hover:text-red-600" onClick={() => deleteIntercorrenciaMutation.mutate(ic.id)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                    <div className="flex items-center gap-2 mb-1 pr-6">
                                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${tipoInfo?.color}`}>{tipoInfo?.label || ic.tipo}</span>
                                      {ic.data && <span className="text-xs text-muted-foreground">{formatDate(ic.data)}</span>}
                                    </div>
                                    <p className="text-xs font-semibold">{ic.titulo}</p>
                                    {ic.descricao && <p className="text-xs text-muted-foreground mt-0.5">{ic.descricao}</p>}
                                    {ic.imagens && ic.imagens.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {ic.imagens.map((key: string, i: number) => (
                                          <a key={i} href={`/api/intercorrencias/imagem?key=${encodeURIComponent(key)}`} target="_blank" rel="noreferrer">
                                            <img src={`/api/intercorrencias/imagem?key=${encodeURIComponent(key)}`}
                                              className="h-20 w-20 object-cover rounded border hover:opacity-80 transition" alt={`foto-${i + 1}`} />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">Nenhum projeto cadastrado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui projetos. Clique no botão acima para criar o primeiro.
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />Criar Primeiro Projeto
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── DIALOG EDIÇÃO / CRIAÇÃO ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProjeto ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* ── Identificação ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="nome">Nome do Projeto *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome do projeto"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="DESCRIÇÃO DO PROJETO"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="coordenador">Coordenador</Label>
                <Select value={form.coordenadorId} onValueChange={(value) => setForm({ ...form, coordenadorId: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o coordenador" /></SelectTrigger>
                  <SelectContent>
                    {coordenadores.map((coord) => (
                      <SelectItem key={coord.id} value={coord.id.toString()}>{coord.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="periodicidade" className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
                  Periodicidade das Atividades
                </Label>
                <Select value={form.periodicidade || "_nenhuma"} onValueChange={(v) => setForm({ ...form, periodicidade: v === "_nenhuma" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a periodicidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_nenhuma">— Não definida —</SelectItem>
                    {periodicidadeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="col-span-2">
                <Label htmlFor="metodologia" className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                  Metodologia Detalhada
                </Label>
                <Textarea
                  id="metodologia"
                  value={form.metodologia}
                  onChange={(e) => setForm({ ...form, metodologia: e.target.value })}
                  placeholder="Descreva detalhadamente a metodologia do projeto: procedimentos de campo, normas técnicas, equipamentos utilizados, protocolos de amostragem, frequência de coleta, análise dos dados..."
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

            <Separator />

            {/* ── Financeiro ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Financeiro</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="valorContratado">Valor Contratado</Label>
                  <Input id="valorContratado" type="number" step="0.01" value={form.valorContratado}
                    onChange={(e) => setForm({ ...form, valorContratado: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <Label htmlFor="valorRecebido">Valor Recebido</Label>
                  <Input id="valorRecebido" type="number" step="0.01" value={form.valorRecebido}
                    onChange={(e) => setForm({ ...form, valorRecebido: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <Label htmlFor="orcamentoPrevisto">Orçamento Previsto</Label>
                  <Input id="orcamentoPrevisto" type="number" step="0.01" value={form.orcamentoPrevisto}
                    onChange={(e) => setForm({ ...form, orcamentoPrevisto: e.target.value })} placeholder="0.00" />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Datas ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />Cronograma
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="inicioPrevisto">Início Previsto</Label>
                  <Input id="inicioPrevisto" type="date" value={form.inicioPrevisto}
                    onChange={(e) => setForm({ ...form, inicioPrevisto: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="fimPrevisto">Fim Previsto</Label>
                  <Input id="fimPrevisto" type="date" value={form.fimPrevisto}
                    onChange={(e) => setForm({ ...form, fimPrevisto: e.target.value })} />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Equipe ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />Equipe
                {loadingResources && <span className="text-xs font-normal text-muted-foreground">(carregando...)</span>}
                {selectedMembroIds.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">{selectedMembroIds.length} selecionado(s)</Badge>
                )}
              </p>
              {membrosDisponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum membro de equipe cadastrado.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-muted/30">
                  {membrosDisponiveis.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 px-1">
                      <Checkbox
                        id={`membro-${m.id}`}
                        checked={selectedMembroIds.includes(m.id)}
                        onCheckedChange={() => toggleId(m.id, selectedMembroIds, setSelectedMembroIds)}
                      />
                      <label htmlFor={`membro-${m.id}`} className="text-sm cursor-pointer select-none flex-1">
                        {m.nome}
                        {m.cargo && <span className="text-muted-foreground text-xs ml-1.5">({m.cargo})</span>}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Equipamentos ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />Equipamentos
                {selectedEquipamentoIds.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">{selectedEquipamentoIds.length} selecionado(s)</Badge>
                )}
              </p>
              {equipamentosDisponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum equipamento vinculado a este empreendimento.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-muted/30">
                  {equipamentosDisponiveis.map((eq: any) => (
                    <div key={eq.id} className="flex items-center gap-2 px-1">
                      <Checkbox
                        id={`equip-${eq.id}`}
                        checked={selectedEquipamentoIds.includes(eq.id)}
                        onCheckedChange={() => toggleId(eq.id, selectedEquipamentoIds, setSelectedEquipamentoIds)}
                      />
                      <label htmlFor={`equip-${eq.id}`} className="text-sm cursor-pointer select-none flex-1">
                        {eq.nome}
                        {eq.tipo && <span className="text-muted-foreground text-xs ml-1.5">({eq.tipo})</span>}
                        {eq.numeroPatrimonio && <span className="text-muted-foreground text-xs ml-1.5">#{eq.numeroPatrimonio}</span>}
                      </label>
                      <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                        eq.status === 'disponivel' ? 'bg-green-100 text-green-700' :
                        eq.status === 'em_uso' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {eq.status === 'disponivel' ? 'Disponível' : eq.status === 'em_uso' ? 'Em uso' : 'Manutenção'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Frota ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />Frota / Veículos
                {selectedVeiculoIds.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">{selectedVeiculoIds.length} selecionado(s)</Badge>
                )}
              </p>
              {veiculosDisponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum veículo vinculado a este empreendimento.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-muted/30">
                  {veiculosDisponiveis.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-2 px-1">
                      <Checkbox
                        id={`veic-${v.id}`}
                        checked={selectedVeiculoIds.includes(v.id)}
                        onCheckedChange={() => toggleId(v.id, selectedVeiculoIds, setSelectedVeiculoIds)}
                      />
                      <label htmlFor={`veic-${v.id}`} className="text-sm cursor-pointer select-none flex-1">
                        {v.marca} {v.modelo} — {v.placa}
                        {v.tipo && <span className="text-muted-foreground text-xs ml-1.5">({v.tipo})</span>}
                      </label>
                      <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                        v.status === 'disponivel' ? 'bg-green-100 text-green-700' :
                        v.status === 'em_uso' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {v.status === 'disponivel' ? 'Disponível' : v.status === 'em_uso' ? 'Em uso' : 'Indisponível'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingProjeto ? "Salvar Alterações" : "Criar Projeto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o projeto "{projetoToDelete?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
