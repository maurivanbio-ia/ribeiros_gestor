
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, Edit, Trash2, X, FlaskConical, Loader2, MapPin, Download,
  Eye, Upload, FileText, Image as ImageIcon, AlertTriangle, Phone, Clock,
  Calendar, CheckCircle2, Send, Microscope, XCircle, Paperclip, File,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ── Schema ─────────────────────────────────────────────────────────────────
const amostraSchema = z.object({
  id: z.number().optional(),
  codigo: z.string().min(1, "Código obrigatório"),
  tipo: z.string().min(1, "Selecione o tipo"),
  subtipo: z.string().optional(),
  pontoColeta: z.string().min(1, "Ponto de coleta obrigatório"),
  latitude: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().optional(),
  ).optional(),
  longitude: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().optional(),
  ).optional(),
  dataColeta: z.string().min(1, "Data de coleta obrigatória"),
  horaColeta: z.string().optional(),
  coletorNome: z.string().optional(),
  laboratorioNome: z.string().optional(),
  contatoLaboratorio: z.string().optional(),
  dataEnvioLab: z.string().optional(),
  dataPrevisaoResultado: z.string().optional(),
  status: z.string().min(1, "Status obrigatório"),
  parametrosAnalisados: z.string().optional(),
  intercorrencias: z.string().optional(),
  laudoArquivo: z.string().optional(),
  imagensAnexos: z.string().optional(),
  observacoes: z.string().optional(),
  empreendimentoId: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().optional(),
  ).optional(),
});

type AmostraForm = z.infer<typeof amostraSchema>;

interface Anexo { name: string; url: string; type: "image" | "laudo" | "outro"; }

// ── Constants ──────────────────────────────────────────────────────────────
const TIPO_OPTIONS = [
  { value: "agua", label: "Água" },
  { value: "solo", label: "Solo" },
  { value: "ar", label: "Ar" },
  { value: "sedimento", label: "Sedimento" },
  { value: "efluente", label: "Efluente" },
  { value: "residuo", label: "Resíduo" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "coletada",          label: "Coletada",           color: "bg-blue-100 text-blue-800",    icon: FlaskConical },
  { value: "enviada_lab",       label: "Amostra Encaminhada", color: "bg-purple-100 text-purple-800", icon: Send },
  { value: "em_analise",        label: "Em Análise",          color: "bg-yellow-100 text-yellow-800", icon: Microscope },
  { value: "resultado_parcial", label: "Resultado Parcial",   color: "bg-orange-100 text-orange-800", icon: Clock },
  { value: "concluida",         label: "Concluída",           color: "bg-green-100 text-green-800",   icon: CheckCircle2 },
  { value: "descartada",        label: "Descartada",          color: "bg-red-100 text-red-800",       icon: XCircle },
];

// ── Upload helper ──────────────────────────────────────────────────────────
async function uploadFile(file: File): Promise<string> {
  const { uploadURL, objectPath } = await fetch("/api/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    credentials: "include",
  }).then((r) => r.json());

  await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  return objectPath as string;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AmostrasPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAmostra, setEditingAmostra] = useState<any | null>(null);
  const [viewingAmostra, setViewingAmostra] = useState<any | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [amostraToDelete, setAmostraToDelete] = useState<number | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [pendingAnexos, setPendingAnexos] = useState<Anexo[]>([]);
  const [laudoUrl, setLaudoUrl] = useState<string>("");
  const laudoInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [debouncedSearch, tipoFilter, statusFilter]);

  const { data: amostras = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/amostras", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/amostras${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar amostras");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const form = useForm<AmostraForm>({
    resolver: zodResolver(amostraSchema),
    defaultValues: {
      codigo: "", tipo: "", subtipo: "", pontoColeta: "", dataColeta: "",
      horaColeta: "", coletorNome: "", laboratorioNome: "", contatoLaboratorio: "",
      dataEnvioLab: "", dataPrevisaoResultado: "",
      status: "coletada", parametrosAnalisados: "", intercorrencias: "",
      laudoArquivo: "", imagensAnexos: "", observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AmostraForm) => {
      const res = await apiRequest("POST", "/api/amostras", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amostras"] });
      toast({ title: "Amostra cadastrada com sucesso!" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao cadastrar", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AmostraForm }) => {
      const res = await apiRequest("PUT", `/api/amostras/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amostras"] });
      toast({ title: "Amostra atualizada!" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/amostras/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amostras"] });
      toast({ title: "Amostra removida!" });
      setDeleteDialogOpen(false);
      setAmostraToDelete(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao excluir", variant: "destructive" }),
  });

  const onSubmit = (data: AmostraForm) => {
    const payload = {
      ...data,
      laudoArquivo: laudoUrl || data.laudoArquivo || "",
      imagensAnexos: pendingAnexos.length > 0
        ? JSON.stringify(pendingAnexos)
        : (data.imagensAnexos || ""),
    };
    editingAmostra
      ? updateMutation.mutate({ id: editingAmostra.id!, data: payload })
      : createMutation.mutate(payload);
  };

  const handleUploadLaudo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setLaudoUrl(url);
      toast({ title: "Laudo carregado", description: file.name });
    } catch {
      toast({ title: "Erro ao enviar laudo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleUploadImagens = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const novos: Anexo[] = [];
      for (const file of files) {
        const url = await uploadFile(file);
        novos.push({ name: file.name, url, type: "image" });
      }
      setPendingAnexos((prev) => [...prev, ...novos]);
      toast({ title: `${novos.length} imagem(ns) carregada(s)` });
    } catch {
      toast({ title: "Erro ao enviar imagem(ns)", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeAnexo = (idx: number) =>
    setPendingAnexos((prev) => prev.filter((_, i) => i !== idx));

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingAmostra(null);
    setPendingAnexos([]);
    setLaudoUrl("");
    form.reset();
  };

  const handleNew = () => {
    setEditingAmostra(null);
    setPendingAnexos([]);
    setLaudoUrl("");
    form.reset({
      codigo: "", tipo: "", subtipo: "", pontoColeta: "", dataColeta: "",
      horaColeta: "", coletorNome: "", laboratorioNome: "", contatoLaboratorio: "",
      dataEnvioLab: "", dataPrevisaoResultado: "",
      status: "coletada", parametrosAnalisados: "", intercorrencias: "",
      laudoArquivo: "", imagensAnexos: "", observacoes: "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (a: any) => {
    setEditingAmostra(a);
    const existingAnexos: Anexo[] = a.imagensAnexos ? JSON.parse(a.imagensAnexos) : [];
    setPendingAnexos(existingAnexos);
    setLaudoUrl(a.laudoArquivo || "");
    form.reset({
      ...a,
      latitude: a.latitude ?? undefined,
      longitude: a.longitude ?? undefined,
      dataEnvioLab: a.dataEnvioLab || "",
      dataPrevisaoResultado: a.dataPrevisaoResultado || "",
      contatoLaboratorio: a.contatoLaboratorio || "",
      intercorrencias: a.intercorrencias || "",
    });
    setIsDialogOpen(true);
  };

  const handleExportExcel = async () => {
    if (!amostras.length) { toast({ title: "Nenhuma amostra", variant: "destructive" }); return; }
    const { utils, writeFile } = await import("xlsx");
    const exportData = amostras.map((a: any) => ({
      "Código": a.codigo,
      "Tipo": TIPO_OPTIONS.find(t => t.value === a.tipo)?.label || a.tipo,
      "Subtipo": a.subtipo || "",
      "Ponto de Coleta": a.pontoColeta,
      "Data da Coleta": a.dataColeta ? new Date(a.dataColeta).toLocaleDateString("pt-BR") : "",
      "Status": STATUS_OPTIONS.find(s => s.value === a.status)?.label || a.status,
      "Laboratório": a.laboratorioNome || "",
      "Contato Lab": a.contatoLaboratorio || "",
      "Prazo Entrega": a.dataPrevisaoResultado ? new Date(a.dataPrevisaoResultado).toLocaleDateString("pt-BR") : "",
      "Intercorrências": a.intercorrencias || "",
      "Parâmetros": a.parametrosAnalisados || "",
      "Observações": a.observacoes || "",
    }));
    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Amostras");
    writeFile(wb, `amostras_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Excel exportado!" });
  };

  const getStatusInfo = (status: string) => STATUS_OPTIONS.find(s => s.value === status);

  const getStatusBadge = (status: string) => {
    const s = getStatusInfo(status);
    if (!s) return <Badge variant="outline">{status}</Badge>;
    const Icon = s.icon;
    return (
      <Badge className={`${s.color} border-0 gap-1`}>
        <Icon className="w-3 h-3" />{s.label}
      </Badge>
    );
  };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "-";

  const parseAnexos = (json: string | null | undefined): Anexo[] => {
    try { return json ? JSON.parse(json) : []; } catch { return []; }
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-amostras">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-primary" />
            Gestão de Amostras
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie amostras coletadas para análise ambiental</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={!amostras.length}>
            <Download className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
          <RefreshButton />
          <Button onClick={handleNew} data-testid="button-nova-amostra">
            <Plus className="h-4 w-4 mr-2" /> Nova Amostra
          </Button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {STATUS_OPTIONS.map(s => {
          const count = amostras.filter((a: any) => a.status === s.value).length;
          const Icon = s.icon;
          return (
            <button
              key={s.value}
              onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
              className={`rounded-lg border p-2 text-center transition-all ${statusFilter === s.value ? "ring-2 ring-primary" : "hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{count}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, ponto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(searchTerm || tipoFilter !== "all" || statusFilter !== "all") && (
            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setTipoFilter("all"); setStatusFilter("all"); }}>
              <X className="h-4 w-4 mr-2" /> Limpar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : amostras.length === 0 ? (
            <div className="text-center py-12">
              <FlaskConical className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma amostra encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || tipoFilter !== "all" || statusFilter !== "all"
                  ? "Tente ajustar os filtros." : "Cadastre sua primeira amostra."}
              </p>
              <Button onClick={handleNew}><Plus className="h-4 w-4 mr-2" /> Nova Amostra</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ponto de Coleta</TableHead>
                    <TableHead>Data Coleta</TableHead>
                    <TableHead>Prazo Entrega</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Laboratório</TableHead>
                    <TableHead>Anexos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amostras.map((a: any) => {
                    const anexos = parseAnexos(a.imagensAnexos);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono font-medium">{a.codigo}</TableCell>
                        <TableCell>
                          <div>
                            <p>{TIPO_OPTIONS.find(t => t.value === a.tipo)?.label || a.tipo}</p>
                            {a.subtipo && <p className="text-xs text-muted-foreground">{a.subtipo}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{a.pontoColeta}</p>
                            {a.latitude && a.longitude && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {Number(a.latitude).toFixed(5)}, {Number(a.longitude).toFixed(5)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(a.dataColeta)}</TableCell>
                        <TableCell>
                          {a.dataPrevisaoResultado ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(a.dataPrevisaoResultado)}
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>{getStatusBadge(a.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{a.laboratorioNome || "-"}</p>
                            {a.contatoLaboratorio && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />{a.contatoLaboratorio}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {a.laudoArquivo && (
                              <a href={a.laudoArquivo} target="_blank" rel="noreferrer">
                                <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-blue-50">
                                  <FileText className="h-3 w-3" />Laudo
                                </Badge>
                              </a>
                            )}
                            {anexos.length > 0 && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <ImageIcon className="h-3 w-3" />{anexos.length}
                              </Badge>
                            )}
                            {a.intercorrencias && (
                              <Badge variant="outline" className="gap-1 text-xs text-orange-700 border-orange-300">
                                <AlertTriangle className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setViewingAmostra(a)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(a)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setAmostraToDelete(a.id); setDeleteDialogOpen(true); }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Formulário ── */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAmostra ? "Editar Amostra" : "Nova Amostra"}</DialogTitle>
            <DialogDescription>
              {editingAmostra ? "Atualize os dados da amostra." : "Preencha as informações para cadastrar."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Identificação */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Identificação</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField name="codigo" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código *</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: AM-2026-001" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField name="tipo" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField name="subtipo" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtipo</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: Água Superficial" /></FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="pontoColeta" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ponto de Coleta *</FormLabel>
                      <FormControl><Input {...field} placeholder="Local da coleta" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField name="latitude" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="-23.550520" {...field}
                          value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                      </FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="longitude" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="-46.633308" {...field}
                          value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                      </FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="empreendimentoId" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empreendimento</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "none" ? undefined : parseInt(v))}
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}/>
                </div>
              </div>

              <Separator />

              {/* Coleta */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Coleta</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField name="dataColeta" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Coleta *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField name="horaColeta" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora da Coleta</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="coletorNome" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Coletor</FormLabel>
                      <FormControl><Input {...field} placeholder="Responsável pela coleta" /></FormControl>
                    </FormItem>
                  )}/>
                </div>
              </div>

              <Separator />

              {/* Laboratório */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Laboratório &amp; Status</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField name="laboratorioNome" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Laboratório</FormLabel>
                      <FormControl><Input {...field} placeholder="Nome do laboratório" /></FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="contatoLaboratorio" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contatos do Laboratório</FormLabel>
                      <FormControl><Input {...field} placeholder="Tel./e-mail/responsável" /></FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="status" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => {
                            const Icon = s.icon;
                            return (
                              <SelectItem key={s.value} value={s.value}>
                                <span className="flex items-center gap-2">
                                  <Icon className="w-4 h-4" />{s.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField name="dataPrevisaoResultado" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo de Entrega</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="dataEnvioLab" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Envio ao Lab</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                    </FormItem>
                  )}/>
                </div>
              </div>

              <Separator />

              {/* Parâmetros e Intercorrências */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Análise</p>
                <div className="space-y-4">
                  <FormField name="parametrosAnalisados" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parâmetros Analisados</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Ex: pH, DBO, DQO, Metais Pesados..." rows={2} />
                      </FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="intercorrencias" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Intercorrências
                      </FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Registre problemas, desvios ou observações durante a coleta/análise..." rows={3} />
                      </FormControl>
                    </FormItem>
                  )}/>
                  <FormField name="observacoes" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações Gerais</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Observações adicionais..." rows={2} />
                      </FormControl>
                    </FormItem>
                  )}/>
                </div>
              </div>

              <Separator />

              {/* Arquivos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Imagens &amp; Laudos
                </p>
                <div className="space-y-4">
                  {/* Laudo */}
                  <div className="rounded-lg border border-dashed p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Laudo / Relatório</span>
                        <span className="text-xs text-muted-foreground">(PDF, DOCX, DOC)</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => laudoInputRef.current?.click()}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                        Enviar
                      </Button>
                      <input
                        ref={laudoInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={handleUploadLaudo}
                      />
                    </div>
                    {laudoUrl ? (
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded p-2">
                        <File className="h-4 w-4" />
                        <a href={laudoUrl} target="_blank" rel="noreferrer" className="underline flex-1 truncate">
                          Ver laudo
                        </a>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setLaudoUrl("")}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum laudo anexado.</p>
                    )}
                  </div>

                  {/* Imagens */}
                  <div className="rounded-lg border border-dashed p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-medium">Imagens</span>
                        <span className="text-xs text-muted-foreground">(JPG, PNG, WEBP)</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => imgInputRef.current?.click()}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                        Adicionar
                      </Button>
                      <input
                        ref={imgInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleUploadImagens}
                      />
                    </div>
                    {pendingAnexos.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {pendingAnexos.map((an, i) => (
                          <div key={i} className="relative group rounded border overflow-hidden bg-gray-50">
                            <img
                              src={an.url}
                              alt={an.name}
                              className="w-full h-20 object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button type="button" variant="ghost" size="sm" className="text-white" onClick={() => removeAnexo(i)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-[10px] p-1 truncate text-muted-foreground">{an.name}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma imagem anexada.</p>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || uploading}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingAmostra ? "Salvar Alterações" : "Cadastrar Amostra"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Detalhes ── */}
      {viewingAmostra && (
        <Dialog open={!!viewingAmostra} onOpenChange={() => setViewingAmostra(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                {viewingAmostra.codigo}
                <span className="ml-2">{getStatusBadge(viewingAmostra.status)}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Tipo:</span> {TIPO_OPTIONS.find(t => t.value === viewingAmostra.tipo)?.label}</div>
                <div><span className="text-muted-foreground">Subtipo:</span> {viewingAmostra.subtipo || "-"}</div>
                <div><span className="text-muted-foreground">Ponto de Coleta:</span> {viewingAmostra.pontoColeta}</div>
                <div><span className="text-muted-foreground">Data Coleta:</span> {formatDate(viewingAmostra.dataColeta)}</div>
                <div><span className="text-muted-foreground">Laboratório:</span> {viewingAmostra.laboratorioNome || "-"}</div>
                <div><span className="text-muted-foreground">Contato:</span> {viewingAmostra.contatoLaboratorio || "-"}</div>
                <div><span className="text-muted-foreground">Envio ao Lab:</span> {formatDate(viewingAmostra.dataEnvioLab)}</div>
                <div><span className="text-muted-foreground">Prazo de Entrega:</span> {formatDate(viewingAmostra.dataPrevisaoResultado)}</div>
              </div>
              {viewingAmostra.parametrosAnalisados && (
                <div>
                  <p className="font-medium mb-1">Parâmetros Analisados</p>
                  <p className="text-muted-foreground bg-muted p-2 rounded">{viewingAmostra.parametrosAnalisados}</p>
                </div>
              )}
              {viewingAmostra.intercorrencias && (
                <div>
                  <p className="font-medium mb-1 flex items-center gap-1 text-orange-700">
                    <AlertTriangle className="h-4 w-4" /> Intercorrências
                  </p>
                  <p className="text-muted-foreground bg-orange-50 border border-orange-200 p-2 rounded whitespace-pre-line">
                    {viewingAmostra.intercorrencias}
                  </p>
                </div>
              )}
              {viewingAmostra.observacoes && (
                <div>
                  <p className="font-medium mb-1">Observações</p>
                  <p className="text-muted-foreground bg-muted p-2 rounded whitespace-pre-line">{viewingAmostra.observacoes}</p>
                </div>
              )}
              {viewingAmostra.laudoArquivo && (
                <div>
                  <p className="font-medium mb-1">Laudo / Relatório</p>
                  <a href={viewingAmostra.laudoArquivo} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline bg-blue-50 p-2 rounded">
                    <FileText className="h-4 w-4" /> Ver laudo
                  </a>
                </div>
              )}
              {parseAnexos(viewingAmostra.imagensAnexos).length > 0 && (
                <div>
                  <p className="font-medium mb-2">Imagens</p>
                  <div className="grid grid-cols-3 gap-2">
                    {parseAnexos(viewingAmostra.imagensAnexos).map((an: Anexo, i: number) => (
                      <a key={i} href={an.url} target="_blank" rel="noreferrer" className="group">
                        <img src={an.url} alt={an.name}
                          className="w-full h-24 object-cover rounded border group-hover:opacity-90 transition-opacity" />
                        <p className="text-[10px] text-muted-foreground truncate mt-1">{an.name}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingAmostra(null)}>Fechar</Button>
              <Button onClick={() => { setViewingAmostra(null); handleEdit(viewingAmostra); }}>
                <Edit className="h-4 w-4 mr-2" /> Editar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmar exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => amostraToDelete && deleteMutation.mutate(amostraToDelete)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
