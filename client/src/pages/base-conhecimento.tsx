
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Eye,
  Star,
  FileText,
  BookOpen,
  Scale,
  ClipboardList,
  FileCheck,
  CheckSquare,
  File,
  Filter,
  Loader2,
  ExternalLink,
  GraduationCap,
  Quote,
  Sparkles,
  Copy,
  Check,
  Upload,
  X,
  FileUp,
  LayoutGrid,
  LayoutList,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";

const baseConhecimentoSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  tipo: z.string().min(1, "Selecione o tipo"),
  categoria: z.string().optional(),
  subcategoria: z.string().optional(),
  tema: z.string().optional(),
  conteudo: z.string().optional(),
  arquivoUrl: z.string().optional(),
  arquivoNome: z.string().optional(),
  arquivoTipo: z.string().optional(),
  versao: z.string().optional(),
  tags: z.string().optional(),
  publico: z.boolean().optional(),
  destaque: z.boolean().optional(),
  status: z.string().optional(),
  isArtigoCientifico: z.boolean().optional(),
  citacaoAbnt: z.string().optional(),
  referenciaAbnt: z.string().optional(),
  resumoAuto: z.string().optional(),
  autores: z.string().optional(),
  anoPublicacao: z.string().optional(),
  periodico: z.string().optional(),
  doi: z.string().optional(),
});

type BaseConhecimento = {
  id: number;
  titulo: string;
  descricao?: string;
  tipo: string;
  categoria?: string;
  subcategoria?: string;
  tema?: string;
  conteudo?: string;
  arquivoUrl?: string;
  arquivoNome?: string;
  arquivoTipo?: string;
  versao?: string;
  tags?: string;
  publico?: boolean;
  destaque?: boolean;
  visualizacoes?: number;
  downloads?: number;
  status: string;
  isArtigoCientifico?: boolean;
  citacaoAbnt?: string;
  referenciaAbnt?: string;
  resumoAuto?: string;
  autores?: string;
  anoPublicacao?: string;
  periodico?: string;
  doi?: string;
  criadoEm?: string;
};

type FormData = z.infer<typeof baseConhecimentoSchema>;

const TIPOS = [
  { value: "modelo", label: "Modelo", icon: FileText },
  { value: "procedimento", label: "Procedimento", icon: ClipboardList },
  { value: "legislacao", label: "Legislação", icon: Scale },
  { value: "manual", label: "Manual", icon: BookOpen },
  { value: "formulario", label: "Formulário", icon: FileCheck },
  { value: "checklist", label: "Checklist", icon: CheckSquare },
  { value: "artigo_cientifico", label: "Artigo Científico", icon: GraduationCap },
  { value: "outro", label: "Outro", icon: File },
];

const TEMAS = [
  { value: "fauna", label: "Fauna" },
  { value: "flora", label: "Flora" },
  { value: "recursos_hidricos", label: "Recursos Hídricos" },
  { value: "residuos", label: "Resíduos" },
  { value: "qualidade_ar", label: "Qualidade do Ar" },
  { value: "solo", label: "Solo" },
  { value: "ruido", label: "Ruído" },
  { value: "mudancas_climaticas", label: "Mudanças Climáticas" },
  { value: "biodiversidade", label: "Biodiversidade" },
  { value: "areas_protegidas", label: "Áreas Protegidas" },
  { value: "licenciamento", label: "Licenciamento" },
  { value: "monitoramento", label: "Monitoramento" },
  { value: "educacao_ambiental", label: "Educação Ambiental" },
  { value: "legislacao", label: "Legislação" },
  { value: "gestao_ambiental", label: "Gestão Ambiental" },
  { value: "outro", label: "Outro" },
];

const CATEGORIAS = [
  { value: "licenciamento", label: "Licenciamento" },
  { value: "monitoramento", label: "Monitoramento" },
  { value: "sst", label: "SST" },
  { value: "rh", label: "RH" },
  { value: "financeiro", label: "Financeiro" },
  { value: "qualidade", label: "Qualidade" },
  { value: "meio_ambiente", label: "Meio Ambiente" },
  { value: "administrativo", label: "Administrativo" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo", color: "bg-green-500" },
  { value: "rascunho", label: "Rascunho", color: "bg-yellow-500" },
  { value: "arquivado", label: "Arquivado", color: "bg-gray-500" },
];

function getTipoIcon(tipo: string, className = "h-5 w-5") {
  const tipoConfig = TIPOS.find((t) => t.value === tipo);
  if (tipoConfig) {
    const Icon = tipoConfig.icon;
    return <Icon className={className} />;
  }
  return <File className={className} />;
}

function getTipoLabel(tipo: string) {
  return TIPOS.find((t) => t.value === tipo)?.label || tipo;
}

function getCategoriaLabel(categoria: string | undefined) {
  if (!categoria) return "-";
  return CATEGORIAS.find((c) => c.value === categoria)?.label || categoria;
}

function getTemaLabel(tema: string | undefined) {
  if (!tema) return "-";
  return TEMAS.find((t) => t.value === tema)?.label || tema;
}

function getStatusBadge(status: string) {
  const s = STATUS_OPTIONS.find((x) => x.value === status);
  return s ? <Badge className={s.color}>{s.label}</Badge> : null;
}

const CATEGORIA_ACCENT: Record<string, { border: string; icon: string; badge: string }> = {
  meio_ambiente:   { border: "border-l-green-500",   icon: "bg-green-50 text-green-700",   badge: "bg-green-100 text-green-800 border-green-300" },
  licenciamento:   { border: "border-l-blue-500",    icon: "bg-blue-50 text-blue-700",    badge: "bg-blue-100 text-blue-800 border-blue-300" },
  sst:             { border: "border-l-red-500",     icon: "bg-red-50 text-red-700",      badge: "bg-red-100 text-red-800 border-red-300" },
  monitoramento:   { border: "border-l-amber-500",   icon: "bg-amber-50 text-amber-700",  badge: "bg-amber-100 text-amber-800 border-amber-300" },
  rh:              { border: "border-l-purple-500",  icon: "bg-purple-50 text-purple-700",badge: "bg-purple-100 text-purple-800 border-purple-300" },
  financeiro:      { border: "border-l-emerald-500", icon: "bg-emerald-50 text-emerald-700",badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  qualidade:       { border: "border-l-cyan-500",    icon: "bg-cyan-50 text-cyan-700",    badge: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  administrativo:  { border: "border-l-slate-400",   icon: "bg-slate-50 text-slate-700",  badge: "bg-slate-100 text-slate-800 border-slate-300" },
};

function getCategoriaAccent(categoria: string | undefined) {
  return CATEGORIA_ACCENT[categoria || ""] || {
    border: "border-l-gray-300",
    icon: "bg-primary/10 text-primary",
    badge: "bg-gray-100 text-gray-700 border-gray-300",
  };
}

export default function BaseConhecimentoPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [temaFilter, setTemaFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BaseConhecimento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [extractedText, setExtractedText] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [viewerItem, setViewerItem] = useState<BaseConhecimento | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (categoriaFilter !== "all") params.categoria = categoriaFilter;
    if (temaFilter !== "all") params.tema = temaFilter;
    return params;
  }, [debouncedSearch, tipoFilter, categoriaFilter, temaFilter]);

  const { data: items = [], isLoading } = useQuery<BaseConhecimento[]>({
    queryKey: ["/api/base-conhecimento", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/base-conhecimento${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar documentos");
      return res.json();
    },
  });

  const destaqueItems = useMemo(() => items.filter((item) => item.destaque), [items]);
  const regularItems = useMemo(() => items.filter((item) => !item.destaque), [items]);

  const form = useForm<FormData>({
    resolver: zodResolver(baseConhecimentoSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      tipo: "",
      categoria: "",
      subcategoria: "",
      tema: "",
      conteudo: "",
      arquivoUrl: "",
      arquivoNome: "",
      arquivoTipo: "",
      versao: "1.0",
      tags: "",
      publico: false,
      destaque: false,
      status: "ativo",
      isArtigoCientifico: false,
      citacaoAbnt: "",
      referenciaAbnt: "",
      resumoAuto: "",
      autores: "",
      anoPublicacao: "",
      periodico: "",
      doi: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => apiRequest("POST", "/api/base-conhecimento", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
      toast({ title: "Sucesso", description: "Documento cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar documento",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) =>
      apiRequest("PUT", `/api/base-conhecimento/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
      toast({ title: "Sucesso", description: "Documento atualizado!" });
      setIsDialogOpen(false);
      setEditingItem(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar documento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/base-conhecimento/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
      toast({ title: "Sucesso", description: "Documento removido!" });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir documento",
        variant: "destructive",
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/base-conhecimento/${id}/download`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
    },
  });

  const onSubmit = (data: FormData) => {
    editingItem
      ? updateMutation.mutate({ id: editingItem.id, data })
      : createMutation.mutate(data);
  };

  const handleNew = () => {
    setEditingItem(null);
    setUploadedFileName("");
    setExtractedText("");
    form.reset({
      titulo: "",
      descricao: "",
      tipo: "",
      categoria: "",
      subcategoria: "",
      tema: "",
      conteudo: "",
      arquivoUrl: "",
      arquivoNome: "",
      arquivoTipo: "",
      versao: "1.0",
      tags: "",
      publico: false,
      destaque: false,
      status: "ativo",
      isArtigoCientifico: false,
      citacaoAbnt: "",
      referenciaAbnt: "",
      resumoAuto: "",
      autores: "",
      anoPublicacao: "",
      periodico: "",
      doi: "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (item: BaseConhecimento) => {
    setEditingItem(item);
    setUploadedFileName(item.arquivoNome || "");
    setExtractedText("");
    form.reset({
      titulo: item.titulo,
      descricao: item.descricao || "",
      tipo: item.tipo,
      categoria: item.categoria || "",
      subcategoria: item.subcategoria || "",
      tema: item.tema || "",
      conteudo: item.conteudo || "",
      arquivoUrl: item.arquivoUrl || "",
      arquivoNome: item.arquivoNome || "",
      arquivoTipo: item.arquivoTipo || "",
      versao: item.versao || "1.0",
      tags: item.tags || "",
      publico: item.publico || false,
      destaque: item.destaque || false,
      status: item.status || "ativo",
      isArtigoCientifico: item.isArtigoCientifico || false,
      citacaoAbnt: item.citacaoAbnt || "",
      referenciaAbnt: item.referenciaAbnt || "",
      resumoAuto: item.resumoAuto || "",
      autores: item.autores || "",
      anoPublicacao: item.anoPublicacao || "",
      periodico: item.periodico || "",
      doi: item.doi || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) deleteMutation.mutate(itemToDelete);
  };

  const handleDownload = (item: BaseConhecimento) => {
    downloadMutation.mutate(item.id);
    if (item.arquivoUrl) {
      const a = document.createElement("a");
      a.href = item.arquivoUrl;
      a.download = item.arquivoNome || "documento";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const isInlinePreviewable = (tipo: string | undefined) => {
    if (!tipo) return false;
    return ["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt"].includes(tipo.toLowerCase());
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setCategoriaFilter("all");
    setTemaFilter("all");
  };

  const handleUploadFile = async (file: File) => {
    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/base-conhecimento/upload-arquivo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      form.setValue("arquivoUrl", data.url);
      form.setValue("arquivoNome", data.nome);
      form.setValue("arquivoTipo", data.tipo?.split("/")[1] || "pdf");
      setUploadedFileName(data.nome);
      
      if (data.textoExtraido) {
        setExtractedText(data.textoExtraido);
      }
      
      toast({
        title: "Arquivo enviado",
        description: data.temConteudo 
          ? `"${data.nome}" enviado e texto extraído com sucesso. Clique em Analisar com IA.`
          : `"${data.nome}" enviado com sucesso.`,
      });
      
      // Auto-trigger analysis after upload
      await handleAnalyzeDocumentWithContent(data.nome, data.textoExtraido || "");
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleAnalyzeDocumentWithContent = async (filename: string, content: string) => {
    setIsAnalyzing(true);
    try {
      const response = await apiRequest("POST", "/api/base-conhecimento/analyze", {
        filename,
        contentPreview: content,
      });
      const analysis = await response.json();
      applyAnalysisToForm(analysis);
      toast({
        title: "Análise IA concluída",
        description: analysis.isArtigoCientifico
          ? "Artigo científico identificado! Campos preenchidos automaticamente."
          : "Variáveis extraídas e campos preenchidos automaticamente.",
      });
    } catch {
      toast({ title: "Erro na análise", description: "Não foi possível analisar o documento", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAnalysisToForm = (analysis: any) => {
    if (analysis.titulo) form.setValue("titulo", analysis.titulo);
    if (analysis.tema) form.setValue("tema", analysis.tema);
    if (analysis.tags || analysis.palavrasChave) form.setValue("tags", analysis.tags || analysis.palavrasChave);
    if (analysis.resumoAuto) form.setValue("resumoAuto", analysis.resumoAuto);
    if (analysis.descricaoGerada && !form.getValues("descricao")) form.setValue("descricao", analysis.descricaoGerada);
    if (analysis.versao && !form.getValues("versao")) form.setValue("versao", analysis.versao);
    if (analysis.isArtigoCientifico) {
      form.setValue("isArtigoCientifico", true);
      form.setValue("tipo", "artigo_cientifico");
      if (analysis.autores) form.setValue("autores", analysis.autores);
      if (analysis.anoPublicacao) form.setValue("anoPublicacao", analysis.anoPublicacao);
      if (analysis.periodico) form.setValue("periodico", analysis.periodico);
      if (analysis.doi) form.setValue("doi", analysis.doi);
      if (analysis.citacaoAbnt) form.setValue("citacaoAbnt", analysis.citacaoAbnt);
      if (analysis.referenciaAbnt) form.setValue("referenciaAbnt", analysis.referenciaAbnt);
    }
  };

  const handleAnalyzeDocument = async () => {
    const filename = form.getValues("arquivoNome");
    const conteudo = form.getValues("conteudo");
    const content = extractedText || conteudo || "";
    
    if (!filename && !conteudo && !extractedText) {
      toast({
        title: "Atenção",
        description: "Faça upload de um arquivo ou informe o nome do arquivo para análise",
        variant: "destructive",
      });
      return;
    }

    await handleAnalyzeDocumentWithContent(filename || "documento.pdf", content);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "Copiado!",
      description: "Texto copiado para a área de transferência",
    });
  };

  const DocumentCard = ({ item, featured = false, listView = false }: { item: BaseConhecimento; featured?: boolean; listView?: boolean }) => {
    const accent = getCategoriaAccent(item.categoria);

    if (listView) {
      return (
        <div className={cn(
          "group flex items-center gap-4 p-4 bg-card border rounded-lg hover:shadow-md transition-all border-l-4",
          featured ? "border-l-yellow-400 border-yellow-200" : accent.border,
        )}>
          <div className={cn("flex-shrink-0 p-2.5 rounded-lg", featured ? "bg-yellow-100 text-yellow-700" : accent.icon)}>
            {getTipoIcon(item.tipo, "h-5 w-5")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm text-foreground truncate max-w-[400px]">{item.titulo}</span>
              {item.destaque && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
              {item.isArtigoCientifico && <GraduationCap className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{getTipoLabel(item.tipo)}</Badge>
              {item.categoria && (
                <Badge className={cn("text-xs border", accent.badge)}>{getCategoriaLabel(item.categoria)}</Badge>
              )}
              {item.tema && (
                <Badge variant="outline" className="text-xs text-muted-foreground">{getTemaLabel(item.tema)}</Badge>
              )}
              {getStatusBadge(item.status)}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{item.visualizacoes || 0}</span>
            <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{item.downloads || 0}</span>
            {item.versao && <span className="text-xs font-mono">v{item.versao}</span>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {item.arquivoUrl && (
              <>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setViewerItem(item)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => handleDownload(item)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                </Button>
              </>
            )}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn(
        "group flex flex-col bg-card border rounded-xl hover:shadow-lg transition-all overflow-hidden border-l-4",
        featured ? "border-l-yellow-400 border-yellow-200" : accent.border,
      )}>
        <div className="p-5 flex-1 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className={cn("p-2.5 rounded-lg flex-shrink-0", featured ? "bg-yellow-100 text-yellow-700" : accent.icon)}>
              {getTipoIcon(item.tipo, "h-5 w-5")}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {item.destaque && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
              {item.isArtigoCientifico && <GraduationCap className="h-4 w-4 text-blue-500" />}
              {getStatusBadge(item.status)}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-base leading-snug line-clamp-2 text-foreground">{item.titulo}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="outline" className="text-xs">{getTipoLabel(item.tipo)}</Badge>
              {item.categoria && (
                <Badge className={cn("text-xs border", accent.badge)}>{getCategoriaLabel(item.categoria)}</Badge>
              )}
              {item.tema && (
                <Badge variant="outline" className="text-xs text-muted-foreground">{getTemaLabel(item.tema)}</Badge>
              )}
            </div>
          </div>

          {(item.resumoAuto || item.descricao) && (
            <p className={cn("text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1", item.resumoAuto && "italic")}>
              {item.resumoAuto || item.descricao}
            </p>
          )}

          {item.isArtigoCientifico && item.citacaoAbnt && (
            <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                  <Quote className="h-3 w-3" /> Citação ABNT
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(item.citacaoAbnt!, "citacao")}>
                  {copiedField === "citacao" ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-xs text-blue-600 line-clamp-2">{item.citacaoAbnt}</p>
            </div>
          )}

          {item.tags && (
            <div className="flex flex-wrap gap-1">
              <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              {item.tags.split(",").slice(0, 4).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">
                  {tag.trim()}
                </Badge>
              ))}
              {item.tags.split(",").length > 4 && (
                <span className="text-xs text-muted-foreground self-center">+{item.tags.split(",").length - 4}</span>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{item.visualizacoes || 0}</span>
            <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{item.downloads || 0}</span>
            {item.versao && <span className="font-mono">v{item.versao}</span>}
          </div>
          {item.arquivoUrl && (
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setViewerItem(item)}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => handleDownload(item)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Baixar
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Base de Conhecimento
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie documentos, modelos, procedimentos e manuais da organização
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo Documento
          </Button>
        </div>
      </div>

      <div className="bg-muted/40 border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {TIPOS.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-[160px] bg-background">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {CATEGORIAS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={temaFilter} onValueChange={setTemaFilter}>
              <SelectTrigger className="w-[160px] bg-background">
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Temas</SelectItem>
                {TEMAS.map((tema) => (
                  <SelectItem key={tema.value} value={tema.value}>{tema.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 border rounded-lg bg-background p-1">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode("grid")}
                title="Visualização em grade"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode("list")}
                title="Visualização em lista"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {(tipoFilter !== "all" || categoriaFilter !== "all" || temaFilter !== "all" || searchTerm) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Filtros ativos:</span>
            {searchTerm && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSearchTerm("")}>
                "{searchTerm}" <X className="h-3 w-3" />
              </Badge>
            )}
            {tipoFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setTipoFilter("all")}>
                {getTipoLabel(tipoFilter)} <X className="h-3 w-3" />
              </Badge>
            )}
            {categoriaFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setCategoriaFilter("all")}>
                {getCategoriaLabel(categoriaFilter)} <X className="h-3 w-3" />
              </Badge>
            )}
            {temaFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setTemaFilter("all")}>
                {getTemaLabel(temaFilter)} <X className="h-3 w-3" />
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-foreground" onClick={clearFilters}>
              Limpar todos
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {destaqueItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" /> Em Destaque
              </h2>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {destaqueItems.map((item) => (
                    <DocumentCard key={item.id} item={item} featured />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {destaqueItems.map((item) => (
                    <DocumentCard key={item.id} item={item} featured listView />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {destaqueItems.length > 0 && regularItems.length > 0 && (
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
                  Todos os Documentos
                </h2>
                <span className="text-sm text-muted-foreground">{regularItems.length} documento{regularItems.length !== 1 ? "s" : ""}</span>
              </div>
            )}
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Nenhum documento encontrado</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {searchTerm || tipoFilter !== "all" || categoriaFilter !== "all"
                    ? "Tente ajustar os filtros ou termos de busca"
                    : "Comece adicionando seu primeiro documento"}
                </p>
                {!searchTerm && tipoFilter === "all" && categoriaFilter === "all" && (
                  <Button onClick={handleNew}>
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Documento
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(destaqueItems.length > 0 ? regularItems : items).map((item) => (
                  <DocumentCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {(destaqueItems.length > 0 ? regularItems : items).map((item) => (
                  <DocumentCard key={item.id} item={item} listView />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Documento" : "Novo Documento"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do documento
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Título *</FormLabel>
                      <FormControl>
                        <Input placeholder="Título do documento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIAS.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subcategoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subcategoria</FormLabel>
                      <FormControl>
                        <Input placeholder="Subcategoria (opcional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tema"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Tema</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tema" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TEMAS.map((tema) => (
                            <SelectItem key={tema.value} value={tema.value}>
                              {tema.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição do documento"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conteudo"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Conteúdo</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Conteúdo do documento (texto ou markdown)"
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* File Upload Section */}
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Arquivo do Documento</span>
                  </div>
                  
                  {/* Upload area */}
                  <div
                    className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => document.getElementById("bc-file-input")?.click()}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleUploadFile(file);
                    }}
                  >
                    <input
                      id="bc-file-input"
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.pptx,.ppt,.md"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadFile(file);
                        e.target.value = "";
                      }}
                    />
                    {isUploadingFile || isAnalyzing ? (
                      <div className="flex flex-col items-center gap-2 text-primary">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-sm font-medium">
                          {isUploadingFile ? "Enviando arquivo..." : "Analisando com IA..."}
                        </span>
                      </div>
                    ) : uploadedFileName ? (
                      <div className="flex flex-col items-center gap-2 text-green-600">
                        <FileText className="h-8 w-8" />
                        <span className="text-sm font-medium">{uploadedFileName}</span>
                        <span className="text-xs text-muted-foreground">Arquivo enviado e analisado — clique para trocar</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span className="text-sm font-medium">Arraste um arquivo ou clique para fazer upload</span>
                        <span className="text-xs">PDF, DOCX, TXT, XLSX, PPT (máx. 20MB)</span>
                        <span className="text-xs text-primary">A IA extrairá automaticamente todas as variáveis do documento</span>
                      </div>
                    )}
                  </div>

                  {/* URL and file name fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="arquivoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">URL / Caminho do Arquivo</FormLabel>
                          <FormControl>
                            <Input placeholder="Preenchido após upload ou cole URL externa" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="arquivoNome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Nome do Arquivo</FormLabel>
                          <FormControl>
                            <Input placeholder="documento.pdf" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAnalyzeDocument}
                    disabled={isAnalyzing || isUploadingFile}
                    className="gap-2"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Analisar Documento com IA
                  </Button>
                </div>

                {form.watch("isArtigoCientifico") && (
                  <div className="md:col-span-2 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                    <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Dados do Artigo Científico
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="autores"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Autores</FormLabel>
                            <FormControl>
                              <Input placeholder="SOBRENOME, Nome; SOBRENOME2, Nome2" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="anoPublicacao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ano de Publicação</FormLabel>
                            <FormControl>
                              <Input placeholder="2024" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="periodico"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Periódico/Revista</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do periódico" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="doi"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>DOI</FormLabel>
                            <FormControl>
                              <Input placeholder="10.xxxx/xxxxx" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="citacaoAbnt"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel className="flex items-center gap-1">
                              <Quote className="h-3 w-3" /> Citação ABNT
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="SILVA; SANTOS, 2023" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="referenciaAbnt"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Referência ABNT Completa</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="SOBRENOME, Nome. Título do artigo. Nome da Revista, v. X, n. Y, p. XX-XX, ano."
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="resumoAuto"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Resumo (gerado automaticamente)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Resumo do documento..."
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arquivoTipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Arquivo</FormLabel>
                      <FormControl>
                        <Input placeholder="documento.pdf" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arquivoTipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo do Arquivo</FormLabel>
                      <FormControl>
                        <Input placeholder="pdf, docx, xlsx..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="versao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Versão</FormLabel>
                      <FormControl>
                        <Input placeholder="1.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input placeholder="tag1, tag2, tag3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publico"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Público</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Visível para todos os usuários
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destaque"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Destaque</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Aparecer em destaque na listagem
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingItem ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Viewer Dialog */}
      <Dialog open={!!viewerItem} onOpenChange={(open) => { if (!open) setViewerItem(null); }}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 shrink-0" />
              <span className="truncate">{viewerItem?.arquivoNome || viewerItem?.titulo}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {viewerItem?.arquivoTipo?.toUpperCase()} · {viewerItem?.titulo}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 px-4 pb-4">
            {viewerItem && isInlinePreviewable(viewerItem.arquivoTipo) ? (
              <iframe
                key={viewerItem.id}
                src={viewerItem.arquivoUrl || ""}
                title={viewerItem.arquivoNome || "Documento"}
                className="w-full h-full rounded border border-border"
                style={{ minHeight: "500px" }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">{viewerItem?.arquivoNome}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Arquivos do tipo <strong>{viewerItem?.arquivoTipo?.toUpperCase()}</strong> não podem ser visualizados diretamente no navegador.
                  </p>
                </div>
                <Button onClick={() => { if (viewerItem) handleDownload(viewerItem); }}>
                  <Download className="h-4 w-4 mr-2" /> Baixar arquivo
                </Button>
              </div>
            )}
          </div>

          <div className="px-6 py-3 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { if (viewerItem) handleDownload(viewerItem); }}>
              <Download className="h-4 w-4 mr-1" /> Baixar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setViewerItem(null)}>
              <X className="h-4 w-4 mr-1" /> Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
