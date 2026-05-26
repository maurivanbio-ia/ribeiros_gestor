import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database, Plus, FileText, Download, FolderOpen,
  ChevronDown, ChevronRight, File, Search, X
} from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";

export interface GestaoDadosTabProps {
  empreendimentoId: number;
}

type Dataset = {
  id: number;
  nome: string;
  descricao: string;
  empreendimentoId: number;
  tipo: string;
  tipoDocumento?: string;
  tamanho: number;
  formato?: string;
  dataUpload: string;
  usuario: string;
  url: string;
  codigoArquivo?: string;
  projeto?: string;
  subprojeto?: string;
  projetoVinculoId?: number | null;
  disciplina?: string;
};

type Projeto = {
  id: number;
  nome: string;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

const TIPO_COLORS: Record<string, string> = {
  REL: "bg-blue-100 text-blue-800",
  NT: "bg-cyan-100 text-cyan-800",
  OF: "bg-purple-100 text-purple-800",
  ATA: "bg-slate-100 text-slate-700",
  LAU: "bg-rose-100 text-rose-800",
  MAP: "bg-green-100 text-green-800",
  PT: "bg-emerald-100 text-emerald-800",
  PBA: "bg-lime-100 text-lime-800",
  EIA: "bg-yellow-100 text-yellow-800",
};

function getTipoColor(tipo: string) {
  return TIPO_COLORS[tipo] || "bg-gray-100 text-gray-700";
}

function getFileIcon(formato?: string) {
  const f = (formato || "").toLowerCase();
  if (f === "pdf") return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
  if (["xlsx", "xls", "csv"].includes(f)) return <File className="h-4 w-4 text-green-600 shrink-0" />;
  if (["docx", "doc"].includes(f)) return <File className="h-4 w-4 text-blue-600 shrink-0" />;
  return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function DatasetCard({ dataset }: { dataset: Dataset }) {
  const tipo = dataset.tipoDocumento || dataset.tipo || "";
  const dataFormatada = dataset.dataUpload
    ? new Date(dataset.dataUpload).toLocaleDateString("pt-BR")
    : "—";
  return (
    <div
      className="border rounded-lg p-3 bg-background hover:bg-muted/30 transition-colors"
      data-testid={`card-dataset-${dataset.id}`}
    >
      <div className="flex items-start gap-2">
        {getFileIcon(dataset.formato)}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-foreground break-all leading-snug mb-1">
            {dataset.nome}
          </p>
          {dataset.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{dataset.descricao}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
            {tipo && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getTipoColor(tipo)}`}>
                {tipo}
              </span>
            )}
            {dataset.formato && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {dataset.formato.toUpperCase()}
              </Badge>
            )}
            <span className="font-medium">{formatFileSize(dataset.tamanho)}</span>
            <span>Upload: {dataFormatada}</span>
            {dataset.usuario && <span>Por: {dataset.usuario}</span>}
          </div>
          {dataset.disciplina && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Disciplina: <span className="font-medium">{dataset.disciplina}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectSection({
  projectName,
  datasets,
  defaultOpen = true,
}: {
  projectName: string;
  datasets: Dataset[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isSemProjeto = projectName === "__sem_projeto__";
  const label = isSemProjeto ? "Geral / Sem projeto" : projectName;
  const totalSize = datasets.reduce((acc, d) => acc + d.tamanho, 0);
  const tipos = [...new Set(datasets.map(d => d.tipoDocumento || d.tipo).filter(Boolean))];

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <FolderOpen className="h-4 w-4 text-amber-500" />
          <span className={`font-semibold text-sm ${isSemProjeto ? "text-muted-foreground italic" : "text-card-foreground"}`}>
            {label}
          </span>
          <Badge variant="secondary" className="text-xs">{datasets.length}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {tipos.slice(0, 3).map(t => (
            <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getTipoColor(t)}`}>{t}</span>
          ))}
          {tipos.length > 3 && <span>+{tipos.length - 3}</span>}
          <span className="font-medium">{formatFileSize(totalSize)}</span>
        </div>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-background">
          {datasets.map(d => <DatasetCard key={d.id} dataset={d} />)}
        </div>
      )}
    </div>
  );
}

export function GestaoDadosTab({ empreendimentoId }: GestaoDadosTabProps) {
  const [search, setSearch] = useState("");

  const { data: datasets = [], isLoading } = useQuery<Dataset[]>({
    queryKey: ["/api/datasets", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/datasets?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar datasets");
      return res.json();
    },
  });

  const { data: projetos = [] } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos", empreendimentoId],
    queryFn: async () => {
      const res = await fetch(`/api/projetos?empreendimentoId=${empreendimentoId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const projetoById = Object.fromEntries(projetos.map(p => [p.id, p.nome]));

  // Filter by search
  const filtered = search.trim()
    ? datasets.filter(d =>
        d.nome.toLowerCase().includes(search.toLowerCase()) ||
        (d.descricao || "").toLowerCase().includes(search.toLowerCase()) ||
        (d.tipoDocumento || d.tipo || "").toLowerCase().includes(search.toLowerCase()) ||
        (d.projeto || "").toLowerCase().includes(search.toLowerCase())
      )
    : datasets;

  // Determine if we should group by project
  const hasProjectInfo = filtered.some(d => d.projeto || d.projetoVinculoId);

  // Build groups
  const groupMap = new Map<string, Dataset[]>();
  for (const d of filtered) {
    let key = "__sem_projeto__";
    if (d.projetoVinculoId && projetoById[d.projetoVinculoId]) {
      key = projetoById[d.projetoVinculoId];
    } else if (d.projeto) {
      key = d.projeto;
    }
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(d);
  }

  // Sort: named projects alphabetically, "__sem_projeto__" last
  const groupEntries = [...groupMap.entries()].sort(([a], [b]) => {
    if (a === "__sem_projeto__") return 1;
    if (b === "__sem_projeto__") return -1;
    return a.localeCompare(b, "pt-BR");
  });

  const totalSize = datasets.reduce((acc, d) => acc + d.tamanho, 0);
  const tiposUnicos = new Set(datasets.map(d => d.tipoDocumento || d.tipo).filter(Boolean)).size;
  const formatosUnicos = new Set(datasets.map(d => d.formato).filter(Boolean)).size;
  const projetosUnicos = new Set(datasets.map(d => d.projetoVinculoId ? projetoById[d.projetoVinculoId] : d.projeto).filter(Boolean)).size;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Gestão de Dados</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Datasets e arquivos relacionados a este empreendimento
          </p>
        </div>
        <Link href="/gestao-dados">
          <Button data-testid="button-manage-datasets">
            <Plus className="mr-2 h-4 w-4" />
            Gerenciar Dados
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-blue-700" data-testid="stat-datasets-total">{datasets.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Projetos</p>
              <p className="text-2xl font-bold text-amber-700">{Math.max(projetosUnicos, groupEntries.filter(([k]) => k !== "__sem_projeto__").length)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-2">
            <Download className="h-4 w-4 text-purple-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Tamanho Total</p>
              <p className="text-lg font-bold text-purple-700" data-testid="stat-datasets-tamanho-total">{formatFileSize(totalSize)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Tipos / Formatos</p>
              <p className="text-2xl font-bold text-green-700" data-testid="stat-datasets-tipos">
                {tiposUnicos}<span className="text-base font-normal text-muted-foreground"> / {formatosUnicos}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {datasets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum dataset encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Este empreendimento ainda não possui dados cadastrados.
            </p>
            <Link href="/gestao-dados">
              <Button data-testid="button-add-first-dataset">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeiro Dataset
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search */}
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-background">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar documentos por nome, tipo, projeto…"
              className="border-0 shadow-none p-0 h-auto focus-visible:ring-0 text-sm"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              Nenhum documento encontrado para "{search}".
            </p>
          )}

          {/* Grouped view */}
          {filtered.length > 0 && hasProjectInfo ? (
            <div className="space-y-3">
              {groupEntries.map(([projectName, docs]) => (
                <ProjectSection
                  key={projectName}
                  projectName={projectName}
                  datasets={docs}
                  defaultOpen={groupEntries.length <= 3}
                />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            // Flat view (no project info)
            <div className="space-y-2">
              {filtered.map(d => <DatasetCard key={d.id} dataset={d} />)}
            </div>
          ) : null}

          {/* Link to full gestão */}
          <div className="text-center pt-1">
            <Link href="/gestao-dados">
              <Button variant="outline" size="sm" data-testid="button-view-all-datasets">
                <Database className="h-4 w-4 mr-2" />
                Abrir Gestão de Dados completa
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
