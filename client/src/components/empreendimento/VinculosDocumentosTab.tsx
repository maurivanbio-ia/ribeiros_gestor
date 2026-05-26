import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Network, Info, X, GripHorizontal, Link2 } from "lucide-react";
import type { DocumentoVinculo } from "@shared/schema";

interface Props { empreendimentoId: number }

// Document type styling
const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  licenca:      { label: "Licença",        color: "#2563eb", bg: "#dbeafe", border: "#93c5fd" },
  autorizacao:  { label: "Autorização",    color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  contrato:     { label: "Contrato",       color: "#0891b2", bg: "#cffafe", border: "#67e8f9" },
  minuta:       { label: "Minuta",         color: "#059669", bg: "#d1fae5", border: "#6ee7b7" },
  parecer:      { label: "Parecer Técnico",color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
  plano:        { label: "Plano de Trab.", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
  ata:          { label: "Ata de Reunião", color: "#0d9488", bg: "#ccfbf1", border: "#5eead4" },
  entregavel:   { label: "Entregável",     color: "#ea580c", bg: "#ffedd5", border: "#fdba74" },
  condicionante:{ label: "Condicionante",  color: "#7c2d12", bg: "#fef2f2", border: "#fca5a5" },
  documento:    { label: "Documento",      color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
};

// Deterministic color from empreendimentoId
function emprColor(id: number): string {
  const palette = [
    "#2563eb","#7c3aed","#059669","#d97706","#dc2626",
    "#0891b2","#ea580c","#0d9488","#be185d","#4338ca",
  ];
  return palette[id % palette.length];
}

interface DocNode {
  id: string; tipo: string; docId: number; nome: string;
  x: number; y: number;
}

interface DocOption { tipo: string; docId: number; nome: string }

// Fetch helpers per doc type
function fetchAuth(url: string) {
  return fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : []);
}

function useDocOptions(empreendimentoId: number) {
  const { data: licencas = [] }      = useQuery<any[]>({ queryKey: ['/api/licencas-ambientais', empreendimentoId], queryFn: () => fetchAuth(`/api/licencas-ambientais?empreendimentoId=${empreendimentoId}`) });
  const { data: autorizacoes = [] }  = useQuery<any[]>({ queryKey: ['/api/autorizacoes', empreendimentoId], queryFn: () => fetchAuth(`/api/autorizacoes?empreendimentoId=${empreendimentoId}`) });
  const { data: contratos = [] }     = useQuery<any[]>({ queryKey: ['/api/contratos', empreendimentoId], queryFn: () => fetchAuth(`/api/contratos?empreendimentoId=${empreendimentoId}`) });
  const { data: minutas = [] }       = useQuery<any[]>({ queryKey: ['/api/minutas', empreendimentoId], queryFn: () => fetchAuth(`/api/minutas?empreendimentoId=${empreendimentoId}`) });
  const { data: pareceres = [] }     = useQuery<any[]>({ queryKey: ['/api/pareceres-tecnicos', empreendimentoId], queryFn: () => fetchAuth(`/api/pareceres-tecnicos?empreendimentoId=${empreendimentoId}`) });
  const { data: planos = [] }        = useQuery<any[]>({ queryKey: ['/api/planos-trabalho', empreendimentoId], queryFn: () => fetchAuth(`/api/planos-trabalho?empreendimentoId=${empreendimentoId}`) });
  const { data: atas = [] }          = useQuery<any[]>({ queryKey: ['/api/atas-reuniao', empreendimentoId], queryFn: () => fetchAuth(`/api/atas-reuniao?empreendimentoId=${empreendimentoId}`) });
  const { data: entregaveis = [] }   = useQuery<any[]>({ queryKey: ['/api/entregaveis', empreendimentoId], queryFn: () => fetchAuth(`/api/entregaveis?empreendimentoId=${empreendimentoId}`) });
  // Documentos inseridos via Gestão de Dados (datasets)
  const { data: datasetsRaw = [] }   = useQuery<any[]>({ queryKey: ['/api/datasets', empreendimentoId], queryFn: () => fetchAuth(`/api/datasets?empreendimentoId=${empreendimentoId}`) });

  return useMemo<DocOption[]>(() => [
    ...licencas.map((d: any)     => ({ tipo: 'licenca',       docId: d.id, nome: d.numero || d.tipo || `Licença #${d.id}` })),
    ...autorizacoes.map((d: any) => ({ tipo: 'autorizacao',   docId: d.id, nome: d.numero || d.tipo || `Aut. #${d.id}` })),
    ...contratos.map((d: any)    => ({ tipo: 'contrato',      docId: d.id, nome: d.numero || d.objeto || `Contrato #${d.id}` })),
    ...minutas.map((d: any)      => ({ tipo: 'minuta',        docId: d.id, nome: d.titulo || `Minuta #${d.id}` })),
    ...pareceres.map((d: any)    => ({ tipo: 'parecer',       docId: d.id, nome: d.titulo || `Parecer #${d.id}` })),
    ...planos.map((d: any)       => ({ tipo: 'plano',         docId: d.id, nome: d.titulo || `Plano #${d.id}` })),
    ...atas.map((d: any)         => ({ tipo: 'ata',           docId: d.id, nome: d.titulo || d.assunto || `Ata #${d.id}` })),
    ...entregaveis.map((d: any)  => ({ tipo: 'entregavel',    docId: d.id, nome: d.titulo || `Entregável #${d.id}` })),
    // Documentos da Gestão de Dados — agrupados por tipo documental se disponível
    ...datasetsRaw.map((d: any)  => ({
      tipo: 'documento',
      docId: d.id,
      nome: d.codigoArquivo
        ? `[${d.codigoArquivo}] ${d.titulo || d.nome}`
        : d.titulo || d.nome || `Documento #${d.id}`,
    })),
  ], [licencas, autorizacoes, contratos, minutas, pareceres, planos, atas, entregaveis, datasetsRaw]);
}

const NODE_W = 140;
const NODE_H = 48;

function initPositions(nodes: DocNode[], width: number, height: number): DocNode[] {
  const count = nodes.length;
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const rx = Math.min(width, 700) / 2 - 90;
    const ry = Math.min(height, 500) / 2 - 60;
    return {
      ...n,
      x: width / 2 + rx * Math.cos(angle) - NODE_W / 2,
      y: height / 2 + ry * Math.sin(angle) - NODE_H / 2,
    };
  });
}

export function VinculosDocumentosTab({ empreendimentoId }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 900, h: 560 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => {
      setSvgSize({ w: e.contentRect.width || 900, h: Math.max(480, e.contentRect.height || 560) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const { data: vinculos = [], isLoading } = useQuery<DocumentoVinculo[]>({
    queryKey: ['/api/documento-vinculos', empreendimentoId],
    queryFn: () => fetch(`/api/documento-vinculos?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const docOptions = useDocOptions(empreendimentoId);

  // Build nodes from all docs involved in vinculos + all doc options
  const allNodes = useMemo<DocNode[]>(() => {
    const seen = new Set<string>();
    const nodes: DocNode[] = [];
    const addNode = (tipo: string, docId: number, nome: string) => {
      const key = `${tipo}-${docId}`;
      if (!seen.has(key)) { seen.add(key); nodes.push({ id: key, tipo, docId, nome, x: 0, y: 0 }); }
    };
    vinculos.forEach(v => {
      addNode(v.origemTipo, v.origemId, v.origemNome);
      addNode(v.destinoTipo, v.destinoId, v.destinoNome);
    });
    return nodes;
  }, [vinculos]);

  // Count connections per node id
  const connectionCount = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    vinculos.forEach(v => {
      const ok = `${v.origemTipo}-${v.origemId}`;
      const dk = `${v.destinoTipo}-${v.destinoId}`;
      counts[ok] = (counts[ok] || 0) + 1;
      counts[dk] = (counts[dk] || 0) + 1;
    });
    return counts;
  }, [vinculos]);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev };
      const unplaced = allNodes.filter(n => !next[n.id]);
      if (unplaced.length === 0) return prev;
      const placed = initPositions(allNodes, svgSize.w, svgSize.h);
      placed.forEach(n => { if (!next[n.id]) next[n.id] = { x: n.x, y: n.y }; });
      return next;
    });
  }, [allNodes, svgSize]);

  // Drag state
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const pos = positions[id] || { x: 0, y: 0 };
    dragging.current = { id, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
  }, [positions]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const { id, ox, oy } = dragging.current;
    setPositions(prev => ({ ...prev, [id]: { x: e.clientX - ox, y: e.clientY - oy } }));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = null; }, []);

  // Clicked edge popup
  const [activeVinculo, setActiveVinculo] = useState<DocumentoVinculo | null>(null);
  const [activePos, setActivePos] = useState<{ x: number; y: number } | null>(null);

  // Add vinculo dialog
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ origemKey: '', destinoKey: '', descricao: '' });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/documento-vinculos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documento-vinculos', empreendimentoId] });
      setAddOpen(false);
      setForm({ origemKey: '', destinoKey: '', descricao: '' });
      toast({ title: 'Vínculo criado com sucesso' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/documento-vinculos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documento-vinculos', empreendimentoId] });
      setActiveVinculo(null);
      toast({ title: 'Vínculo removido' });
    },
  });

  function handleAddSubmit() {
    if (!form.origemKey || !form.destinoKey || !form.descricao.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return;
    }
    if (form.origemKey === form.destinoKey) {
      toast({ title: 'Selecione documentos diferentes', variant: 'destructive' }); return;
    }
    const origem = docOptions.find(d => `${d.tipo}-${d.docId}` === form.origemKey);
    const destino = docOptions.find(d => `${d.tipo}-${d.docId}` === form.destinoKey);
    if (!origem || !destino) return;
    addMutation.mutate({
      empreendimentoId,
      origemTipo: origem.tipo, origemId: origem.docId, origemNome: origem.nome,
      destinoTipo: destino.tipo, destinoId: destino.docId, destinoNome: destino.nome,
      descricao: form.descricao,
    });
  }

  const lineColor = emprColor(empreendimentoId);

  function edgePath(v: DocumentoVinculo): string {
    const a = positions[`${v.origemTipo}-${v.origemId}`];
    const b = positions[`${v.destinoTipo}-${v.destinoId}`];
    if (!a || !b) return '';
    const ax = a.x + NODE_W / 2, ay = a.y + NODE_H / 2;
    const bx = b.x + NODE_W / 2, by = b.y + NODE_H / 2;
    const cx = (ax + bx) / 2, cy = (ay + by) / 2 - 40;
    return `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
  }

  function edgeMidpoint(v: DocumentoVinculo) {
    const a = positions[`${v.origemTipo}-${v.origemId}`];
    const b = positions[`${v.destinoTipo}-${v.destinoId}`];
    if (!a || !b) return null;
    const ax = a.x + NODE_W / 2, ay = a.y + NODE_H / 2;
    const bx = b.x + NODE_W / 2, by = b.y + NODE_H / 2;
    return { x: (ax + bx) / 2, y: (ay + by) / 2 - 20 };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Network className="h-5 w-5 text-violet-500" />
            Mapa de Vínculos de Documentos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visualize e gerencie as relações entre documentos deste empreendimento. Arraste os nós para reorganizar.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Novo Vínculo
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
          <span key={key} className="text-[11px] px-2 py-0.5 rounded-full font-medium border"
            style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
            {cfg.label}
          </span>
        ))}
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium border ml-2"
          style={{ color: lineColor, background: '#f8fafc', borderColor: lineColor }}>
          ─── Vínculo ({vinculos.length})
        </span>
        {Object.values(connectionCount).some(c => c >= 2) && (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium border ml-1 flex items-center gap-1"
            style={{ color: '#7c3aed', background: '#ede9fe', borderColor: '#c4b5fd' }}>
            <span className="font-bold">+</span> Hub = documento relacionado a 2 ou mais
          </span>
        )}
      </div>

      {/* Graph */}
      <div ref={containerRef} className="relative w-full rounded-xl border border-border/60 bg-white dark:bg-gray-900 overflow-hidden" style={{ height: 520 }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-violet-400 border-t-transparent rounded-full" />
            Carregando...
          </div>
        ) : vinculos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Link2 className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="font-semibold text-sm">Nenhum vínculo cadastrado</p>
              <p className="text-xs mt-1">Clique em "Novo Vínculo" para conectar documentos deste empreendimento.</p>
            </div>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={svgSize.w} height={520}
            className="select-none"
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={lineColor} />
              </marker>
              <filter id="shadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Edges */}
            {vinculos.map(v => {
              const path = edgePath(v);
              if (!path) return null;
              const mid = edgeMidpoint(v);
              const isActive = activeVinculo?.id === v.id;
              return (
                <g key={v.id} style={{ cursor: 'pointer' }} onClick={e => {
                  if (!mid) return;
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) setActivePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  setActiveVinculo(isActive ? null : v);
                }}>
                  {/* Hit area */}
                  <path d={path} fill="none" stroke="transparent" strokeWidth={16} />
                  {/* Visible line */}
                  <path
                    d={path}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={isActive ? 3.5 : 2.5}
                    strokeDasharray={isActive ? "none" : "6 3"}
                    markerEnd="url(#arrow)"
                    opacity={isActive ? 1 : 0.75}
                    style={{ transition: 'all 0.2s' }}
                  />
                  {/* Mid badge */}
                  {mid && (
                    <g>
                      <circle cx={mid.x} cy={mid.y} r={10} fill={lineColor} opacity={0.9} />
                      <text x={mid.x} y={mid.y + 4.5} textAnchor="middle" fill="white" fontSize={12} fontWeight="bold">i</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {allNodes.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;
              const cfg = TIPO_CONFIG[node.tipo] || { color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db', label: node.tipo };
              const connCount = connectionCount[node.id] || 0;
              const isHub = connCount >= 2;
              return (
                <g key={node.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  style={{ cursor: 'grab' }}
                  onMouseDown={e => onMouseDown(e, node.id)}
                  filter="url(#shadow)"
                >
                  <rect
                    width={NODE_W} height={NODE_H} rx={8}
                    fill={cfg.bg} stroke={isHub ? cfg.color : cfg.border}
                    strokeWidth={isHub ? 2.5 : 1.5}
                  />
                  {/* Grip indicator */}
                  <text x={NODE_W - 10} y={12} fill={cfg.color} fontSize={8} opacity={0.5} fontFamily="monospace">⠿</text>
                  {/* Type badge */}
                  <rect x={0} y={0} width={NODE_W} height={16} rx="8" fill={cfg.color} opacity={0.12} />
                  <text x={NODE_W / 2} y={11} textAnchor="middle" fill={cfg.color} fontSize={9} fontWeight="600">
                    {cfg.label}
                  </text>
                  {/* Name */}
                  <text x={NODE_W / 2} y={32} textAnchor="middle" fill="#1e293b" fontSize={11} fontWeight="500">
                    {node.nome.length > 18 ? node.nome.slice(0, 18) + '…' : node.nome}
                  </text>
                  {/* "+" hub badge — shown when node has 2+ connections */}
                  {isHub && (
                    <g transform={`translate(${NODE_W - 10}, -6)`}>
                      <circle r={9} fill={cfg.color} />
                      <text textAnchor="middle" y={4} fill="white" fontSize={11} fontWeight="bold">+</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Edge popup */}
        {activeVinculo && activePos && (
          <div
            className="absolute z-50 bg-white dark:bg-gray-900 border border-border rounded-xl shadow-xl p-4 w-72"
            style={{
              left: Math.min(activePos.x + 12, svgSize.w - 300),
              top: Math.max(activePos.y - 80, 8),
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" /> Vínculo
              </span>
              <button onClick={() => setActiveVinculo(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ color: TIPO_CONFIG[activeVinculo.origemTipo]?.color, background: TIPO_CONFIG[activeVinculo.origemTipo]?.bg }}>
                  {TIPO_CONFIG[activeVinculo.origemTipo]?.label || activeVinculo.origemTipo}
                </span>
                <span className="text-xs font-medium truncate">{activeVinculo.origemNome}</span>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground" style={{ color: lineColor }}>▼ vinculado a ▼</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ color: TIPO_CONFIG[activeVinculo.destinoTipo]?.color, background: TIPO_CONFIG[activeVinculo.destinoTipo]?.bg }}>
                  {TIPO_CONFIG[activeVinculo.destinoTipo]?.label || activeVinculo.destinoTipo}
                </span>
                <span className="text-xs font-medium truncate">{activeVinculo.destinoNome}</span>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 mb-3">
              <p className="text-xs leading-relaxed text-foreground">{activeVinculo.descricao}</p>
            </div>
            {activeVinculo.criadoPor && (
              <p className="text-[10px] text-muted-foreground mb-3">Por: {activeVinculo.criadoPor}</p>
            )}
            <Button
              variant="destructive" size="sm" className="w-full"
              onClick={() => deleteMutation.mutate(activeVinculo.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {deleteMutation.isPending ? 'Removendo...' : 'Remover Vínculo'}
            </Button>
          </div>
        )}
      </div>

      {/* List view */}
      {vinculos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lista de Vínculos ({vinculos.length})</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {vinculos.map(v => (
              <div key={v.id} className="border border-border/60 rounded-xl p-3 bg-white dark:bg-gray-900 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: lineColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ color: TIPO_CONFIG[v.origemTipo]?.color, background: TIPO_CONFIG[v.origemTipo]?.bg }}>
                      {TIPO_CONFIG[v.origemTipo]?.label}
                    </span>
                    <span className="text-xs font-medium truncate max-w-[100px]">{v.origemNome}</span>
                    <span className="text-muted-foreground text-[10px]">→</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ color: TIPO_CONFIG[v.destinoTipo]?.color, background: TIPO_CONFIG[v.destinoTipo]?.bg }}>
                      {TIPO_CONFIG[v.destinoTipo]?.label}
                    </span>
                    <span className="text-xs font-medium truncate max-w-[100px]">{v.destinoNome}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.descricao}</p>
                </div>
                <button onClick={() => deleteMutation.mutate(v.id)} className="flex-shrink-0 text-muted-foreground hover:text-red-500 transition-colors mt-0.5">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-violet-500" />
              Criar Vínculo entre Documentos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold mb-1.5 block">Documento de Origem</label>
              <Select value={form.origemKey} onValueChange={v => setForm(f => ({ ...f, origemKey: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o documento origem..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => {
                    const docs = docOptions.filter(d => d.tipo === tipo);
                    if (docs.length === 0) return null;
                    return docs.map(d => (
                      <SelectItem key={`${d.tipo}-${d.docId}`} value={`${d.tipo}-${d.docId}`}>
                        <span className="text-xs font-semibold mr-1.5" style={{ color: cfg.color }}>[{cfg.label}]</span>
                        {d.nome}
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground text-xs justify-center">
              <div className="h-px flex-1 bg-border" />
              <span className="font-medium">vinculado a</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block">Documento de Destino</label>
              <Select value={form.destinoKey} onValueChange={v => setForm(f => ({ ...f, destinoKey: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o documento destino..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => {
                    const docs = docOptions.filter(d => d.tipo === tipo && `${d.tipo}-${d.docId}` !== form.origemKey);
                    if (docs.length === 0) return null;
                    return docs.map(d => (
                      <SelectItem key={`${d.tipo}-${d.docId}`} value={`${d.tipo}-${d.docId}`}>
                        <span className="text-xs font-semibold mr-1.5" style={{ color: cfg.color }}>[{cfg.label}]</span>
                        {d.nome}
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block">Descrição da relação</label>
              <Textarea
                placeholder="Ex: Esta licença foi condicionada à execução do contrato, exigindo aprovação prévia do parecer técnico..."
                rows={3}
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                className="text-sm resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleAddSubmit} disabled={addMutation.isPending}>
                {addMutation.isPending ? 'Criando...' : 'Criar Vínculo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
