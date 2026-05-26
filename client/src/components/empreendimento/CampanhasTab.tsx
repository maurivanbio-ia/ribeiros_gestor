import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Target, Plus, Edit, Trash2, Calendar, ChevronDown, ChevronUp,
  AlertTriangle, BookOpen, X, ClipboardList, ImageIcon, Loader2
} from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface CampanhasTabProps {
  empreendimentoId: number;
}

const CAMPANHA_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  planejada:    { label: "Planejada",     color: "#00599C", bg: "#dbeafe" },
  em_andamento: { label: "Em Andamento",  color: "#1E6146", bg: "#d1fae5" },
  atrasada:     { label: "Atrasada",      color: "#f97316", bg: "#ffedd5" },
  suspensa:     { label: "Suspensa",      color: "#7c3aed", bg: "#ede9fe" },
  cancelada:    { label: "Cancelada",     color: "#ef4444", bg: "#fee2e2" },
  encerrada:    { label: "Encerrada",     color: "#64748b", bg: "#f1f5f9" },
  concluida:    { label: "Concluída",     color: "#0d7a6a", bg: "#ccfbf1" },
};

const TIPO_INTERCORRENCIA = [
  { value: "ocorrencia", label: "Ocorrência", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "anomalia", label: "Anomalia", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "impedimento", label: "Impedimento", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "observacao", label: "Observação", color: "bg-blue-100 text-blue-800 border-blue-200" },
];

type CampanhaForm = {
  nome: string;
  periodoInicio: string;
  periodoFim: string;
  descricao: string;
  observacoesMetodologicas: string;
  status: string;
  motivoStatus: string;
  projetoId: number | null;
};

const emptyForm: CampanhaForm = {
  nome: "",
  periodoInicio: "",
  periodoFim: "",
  descricao: "",
  observacoesMetodologicas: "",
  status: "planejada",
  motivoStatus: "",
  projetoId: null,
};

export function CampanhasTab({ empreendimentoId }: CampanhasTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<any | null>(null);
  const [campanhaToDelete, setCampanhaToDelete] = useState<any | null>(null);
  const [form, setForm] = useState<CampanhaForm>(emptyForm);
  const [expandedCampanhaId, setExpandedCampanhaId] = useState<number | null>(null);
  const [intercorrenciaForm, setIntercorrenciaForm] = useState({ data: "", tipo: "ocorrencia", titulo: "", descricao: "" });
  const [addingIntercorrencia, setAddingIntercorrencia] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [expandedObsId, setExpandedObsId] = useState<number | null>(null);

  const { data: campanhas = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "campanhas"],
    queryFn: async () => {
      const res = await fetch(`/api/empreendimentos/${empreendimentoId}/campanhas`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: projetos = [] } = useQuery<any[]>({
    queryKey: ["/api/projetos", empreendimentoId],
    queryFn: async () => {
      const res = await fetch(`/api/projetos?empreendimentoId=${empreendimentoId}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const { data: intercorrencias = [], refetch: refetchIntercorrencias } = useQuery<any[]>({
    queryKey: ["/api/campanhas", expandedCampanhaId, "intercorrencias"],
    queryFn: async () => {
      if (!expandedCampanhaId) return [];
      const res = await fetch(`/api/campanhas/${expandedCampanhaId}/intercorrencias`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!expandedCampanhaId,
  });

  const invalidateCampanhas = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "campanhas"] });
    queryClient.invalidateQueries({ queryKey: ["/api/campanhas"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/campanhas", data),
    onSuccess: () => {
      invalidateCampanhas();
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Campanha criada com sucesso" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/campanhas/${id}`, data),
    onSuccess: () => {
      invalidateCampanhas();
      setDialogOpen(false);
      setEditingCampanha(null);
      setForm(emptyForm);
      toast({ title: "Campanha atualizada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/campanhas/${id}`),
    onSuccess: () => {
      invalidateCampanhas();
      setDeleteDialogOpen(false);
      setCampanhaToDelete(null);
      toast({ title: "Campanha excluída" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
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
    mutationFn: async (data: any) => apiRequest("POST", `/api/campanhas/${expandedCampanhaId}/intercorrencias`, data),
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
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/campanhas/${expandedCampanhaId}/intercorrencias/${id}`),
    onSuccess: () => { refetchIntercorrencias(); toast({ title: "Intercorrência removida" }); },
  });

  const handleOpenCreate = () => {
    setEditingCampanha(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (campanha: any) => {
    setEditingCampanha(campanha);
    setForm({
      nome: campanha.nome || "",
      periodoInicio: campanha.periodoInicio || "",
      periodoFim: campanha.periodoFim || "",
      descricao: campanha.descricao || "",
      observacoesMetodologicas: campanha.observacoesMetodologicas || "",
      status: campanha.status || "planejada",
      motivoStatus: campanha.motivoStatus || "",
      projetoId: campanha.projetoId ?? null,
    });
    setDialogOpen(true);
  };

  const handleDelete = (campanha: any) => {
    setCampanhaToDelete(campanha);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) {
      toast({ title: "Erro", description: "O nome da campanha é obrigatório.", variant: "destructive" });
      return;
    }
    if (!form.periodoInicio || !form.periodoFim) {
      toast({ title: "Erro", description: "As datas de início e fim são obrigatórias.", variant: "destructive" });
      return;
    }
    const data = {
      nome: form.nome,
      periodoInicio: form.periodoInicio,
      periodoFim: form.periodoFim,
      descricao: form.descricao || null,
      observacoesMetodologicas: form.observacoesMetodologicas || null,
      status: form.status || "planejada",
      motivoStatus: form.motivoStatus || null,
      projetoId: form.projetoId || null,
      empreendimentoId,
    };
    if (editingCampanha) {
      updateMutation.mutate({ id: editingCampanha.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando campanhas...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Campanhas de Campo
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie campanhas de monitoramento, coleta e amostragem.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />Nova Campanha
        </Button>
      </div>

      {/* Campaign list */}
      {campanhas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campanhas.map((campanha: any) => (
            <Card key={campanha.id} className="overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h4 className="font-semibold text-sm leading-tight truncate">{campanha.nome}</h4>
                      {(() => {
                        const s = campanha.status || "planejada";
                        const st = CAMPANHA_STATUS[s] ?? CAMPANHA_STATUS["planejada"];
                        return (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        );
                      })()}
                    </div>
                    {campanha.projetoId && (() => {
                      const p = projetos.find((p: any) => p.id === campanha.projetoId);
                      return p ? (
                        <p className="text-[10px] text-violet-700 font-medium flex items-center gap-1 mb-0.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
                          {p.nome}
                        </p>
                      ) : null;
                    })()}
                    {campanha.descricao && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{campanha.descricao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(campanha)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(campanha)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 space-y-3">
                {/* Period */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-500" />
                    <span>Início: <strong className="text-foreground">{formatDate(campanha.periodoInicio)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-blue-500" />
                    <span>Fim: <strong className="text-foreground">{formatDate(campanha.periodoFim)}</strong></span>
                  </div>
                </div>

                {/* Observações Metodológicas */}
                {campanha.observacoesMetodologicas && (
                  <div className="border-t pt-2">
                    <Button
                      variant="ghost" size="sm"
                      className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedObsId(expandedObsId === campanha.id ? null : campanha.id)}
                    >
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-emerald-600" />Observações Metodológicas
                      </span>
                      {expandedObsId === campanha.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    {expandedObsId === campanha.id && (
                      <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-md p-3">
                        <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">{campanha.observacoesMetodologicas}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Intercorrências — seção independente */}
                <div className="border-t pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <Button
                      variant="ghost" size="sm"
                      className="justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground px-1"
                      onClick={() => {
                        const next = expandedCampanhaId === campanha.id ? null : campanha.id;
                        setExpandedCampanhaId(next);
                        if (!next) { setAddingIntercorrencia(false); setPendingImages([]); }
                      }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-semibold uppercase tracking-wide">
                        Intercorrências {expandedCampanhaId === campanha.id ? `(${intercorrencias.length})` : ""}
                      </span>
                      {expandedCampanhaId === campanha.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    {!addingIntercorrencia && (
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                        onClick={() => { setExpandedCampanhaId(campanha.id); setAddingIntercorrencia(true); }}>
                        <Plus className="h-3 w-3 mr-1" />Registrar
                      </Button>
                    )}
                  </div>

                  {expandedCampanhaId === campanha.id && (
                    <div className="mt-2 space-y-2">
                      <div>

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
                                onClick={() => addIntercorrenciaMutation.mutate({ data: intercorrenciaForm.data || new Date().toISOString().slice(0, 10), tipo: intercorrenciaForm.tipo, titulo: intercorrenciaForm.titulo, descricao: intercorrenciaForm.descricao || null, imagens: pendingImages, campanhaId: campanha.id })}>
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
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">Nenhuma campanha cadastrada</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Cadastre campanhas de monitoramento com suas observações metodológicas e intercorrências de campo.
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />Criar Primeira Campanha
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              {editingCampanha ? "Editar Campanha" : "Nova Campanha"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <Label htmlFor="nome">Nome da Campanha *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Campanha de Monitoramento de Fauna – 1º Semestre 2025" />
            </div>

            {projetos.length > 0 && (
              <div>
                <Label htmlFor="projetoId">Projeto Vinculado</Label>
                <Select
                  value={form.projetoId ? String(form.projetoId) : "none"}
                  onValueChange={(v) => setForm({ ...form, projetoId: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger id="projetoId">
                    <SelectValue placeholder="Selecione um projeto (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem projeto vinculado</SelectItem>
                    {projetos.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Vincular a um projeto permite filtrar campanhas no Monitoramento de Campo.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodoInicio">Período Início *</Label>
                <Input id="periodoInicio" type="date" value={form.periodoInicio} onChange={(e) => setForm({ ...form, periodoInicio: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="periodoFim">Período Fim *</Label>
                <Input id="periodoFim" type="date" value={form.periodoFim} onChange={(e) => setForm({ ...form, periodoFim: e.target.value })} />
              </div>
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Objetivo geral da campanha..." rows={3} />
            </div>

            <Separator />

            <div>
              <Label htmlFor="observacoesMetodologicas" className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                Observações Metodológicas
              </Label>
              <Textarea
                id="observacoesMetodologicas"
                value={form.observacoesMetodologicas}
                onChange={(e) => setForm({ ...form, observacoesMetodologicas: e.target.value })}
                placeholder="Descreva os métodos, protocolos, equipamentos utilizados, normas técnicas seguidas, procedimentos de coleta, frequência de amostragem, critérios de identificação de espécies/parâmetros..."
                rows={7}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Detalhe toda a metodologia utilizada nesta campanha para garantir rastreabilidade técnica.</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">Status da Campanha</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CAMPANHA_STATUS).map(([key, val]) => (
                  <button key={key} type="button"
                    onClick={() => setForm({ ...form, status: key })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all text-left ${form.status === key ? "shadow-sm scale-[1.01]" : "opacity-60 hover:opacity-90"}`}
                    style={{ background: val.bg, color: val.color, borderColor: form.status === key ? val.color : "transparent" }}>
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: val.color }} />
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="motivoStatus">Motivo / observação do status (opcional)</Label>
              <Textarea id="motivoStatus" value={form.motivoStatus}
                onChange={(e) => setForm({ ...form, motivoStatus: e.target.value })}
                placeholder="Descreva o motivo desta situação se necessário..."
                rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingCampanha ? "Salvar Alterações" : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a campanha <strong>"{campanhaToDelete?.nome}"</strong>? Todas as intercorrências associadas também serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => campanhaToDelete && deleteMutation.mutate(campanhaToDelete.id)}>
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
