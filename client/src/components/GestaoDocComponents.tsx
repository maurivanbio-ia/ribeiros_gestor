import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatasetPasta } from "@shared/schema";

// ─── FolderTreePicker ───────────────────────────────────────────────────────

interface FolderTreePickerProps {
  pastas: DatasetPasta[];
  value: string;
  onChange: (caminho: string) => void;
}

function normName(nome: string) {
  return nome === "ECOBRASIL_CONSULTORIA_AMBIENTAL" ? "MAURIVAN_VAZ_RIBEIRO" : nome;
}

function FolderNode({
  folder,
  allPastas,
  depth,
  selected,
  onSelect,
  search,
  expandedIds,
  toggleExpand,
}: {
  folder: DatasetPasta;
  allPastas: DatasetPasta[];
  depth: number;
  selected: string;
  onSelect: (caminho: string) => void;
  search: string;
  expandedIds: Set<number>;
  toggleExpand: (id: number) => void;
}) {
  const children = allPastas
    .filter((p) => p.paiId === folder.id)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selected === folder.caminho;
  const displayName = normName(folder.nome);

  // If searching, only show nodes that match or have matching descendants
  const matchesSelf = search === "" || displayName.toLowerCase().includes(search.toLowerCase());
  const hasMatchingChild = (f: DatasetPasta): boolean => {
    const kids = allPastas.filter((p) => p.paiId === f.id);
    return kids.some(
      (k) =>
        normName(k.nome).toLowerCase().includes(search.toLowerCase()) ||
        hasMatchingChild(k)
    );
  };

  if (search !== "" && !matchesSelf && !hasMatchingChild(folder)) return null;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded cursor-pointer select-none group",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(folder.caminho)}
      >
        {children.length > 0 ? (
          <button
            type="button"
            className={cn(
              "shrink-0 rounded p-0.5 hover:bg-black/10",
              isSelected && "hover:bg-white/20"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(folder.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        {isExpanded || isSelected ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-400" />
        )}
        <span className="text-xs font-mono truncate flex-1">{displayName}</span>
        {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
      </div>
      {(isExpanded || search !== "") && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              allPastas={allPastas}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              search={search}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTreePicker({ pastas, value, onChange }: FolderTreePickerProps) {
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const roots = useMemo(
    () =>
      pastas
        .filter((p) => !p.paiId)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [pastas]
  );

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedPasta = pastas.find((p) => p.caminho === value);
  const selectedName = selectedPasta ? normName(selectedPasta.nome) : null;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar pasta…"
          className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")}>
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Selected indicator */}
      {selectedName && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-primary/5 border-b text-xs text-primary font-medium">
          <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
          <span className="truncate font-mono">{selectedName}</span>
        </div>
      )}

      {/* Tree */}
      <div className="max-h-[240px] overflow-y-auto p-1 space-y-0.5">
        {pastas.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma pasta disponível
          </p>
        ) : (
          roots.map((root) => (
            <FolderNode
              key={root.id}
              folder={root}
              allPastas={pastas}
              depth={0}
              selected={value}
              onSelect={onChange}
              search={search}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── DocTypePicker ──────────────────────────────────────────────────────────

interface DocTypeOption {
  sigla: string;
  descricao: string;
}

interface DocTypePickerProps {
  options: DocTypeOption[];
  value: string;
  onChange: (sigla: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  REL: "bg-blue-50 border-blue-300 text-blue-800 data-[selected]:bg-blue-600 data-[selected]:text-white data-[selected]:border-blue-600",
  NT:  "bg-cyan-50 border-cyan-300 text-cyan-800 data-[selected]:bg-cyan-600 data-[selected]:text-white data-[selected]:border-cyan-600",
  OF:  "bg-purple-50 border-purple-300 text-purple-800 data-[selected]:bg-purple-600 data-[selected]:text-white data-[selected]:border-purple-600",
  MEM: "bg-indigo-50 border-indigo-300 text-indigo-800 data-[selected]:bg-indigo-600 data-[selected]:text-white data-[selected]:border-indigo-600",
  ATA: "bg-slate-50 border-slate-300 text-slate-700 data-[selected]:bg-slate-600 data-[selected]:text-white data-[selected]:border-slate-600",
  APR: "bg-orange-50 border-orange-300 text-orange-800 data-[selected]:bg-orange-600 data-[selected]:text-white data-[selected]:border-orange-600",
  MAP: "bg-green-50 border-green-300 text-green-800 data-[selected]:bg-green-600 data-[selected]:text-white data-[selected]:border-green-600",
  DAT: "bg-teal-50 border-teal-300 text-teal-800 data-[selected]:bg-teal-600 data-[selected]:text-white data-[selected]:border-teal-600",
  MET: "bg-amber-50 border-amber-300 text-amber-800 data-[selected]:bg-amber-600 data-[selected]:text-white data-[selected]:border-amber-600",
  LAU: "bg-rose-50 border-rose-300 text-rose-800 data-[selected]:bg-rose-600 data-[selected]:text-white data-[selected]:border-rose-600",
  PT:  "bg-emerald-50 border-emerald-300 text-emerald-800 data-[selected]:bg-emerald-600 data-[selected]:text-white data-[selected]:border-emerald-600",
  PBA: "bg-lime-50 border-lime-300 text-lime-800 data-[selected]:bg-lime-600 data-[selected]:text-white data-[selected]:border-lime-600",
  EIA: "bg-yellow-50 border-yellow-300 text-yellow-800 data-[selected]:bg-yellow-600 data-[selected]:text-white data-[selected]:border-yellow-600",
  PGR: "bg-red-50 border-red-300 text-red-800 data-[selected]:bg-red-600 data-[selected]:text-white data-[selected]:border-red-600",
  PRAD:"bg-sky-50 border-sky-300 text-sky-800 data-[selected]:bg-sky-600 data-[selected]:text-white data-[selected]:border-sky-600",
  CER: "bg-violet-50 border-violet-300 text-violet-800 data-[selected]:bg-violet-600 data-[selected]:text-white data-[selected]:border-violet-600",
  CON: "bg-stone-50 border-stone-300 text-stone-800 data-[selected]:bg-stone-600 data-[selected]:text-white data-[selected]:border-stone-600",
  FIC: "bg-pink-50 border-pink-300 text-pink-800 data-[selected]:bg-pink-600 data-[selected]:text-white data-[selected]:border-pink-600",
};

const DEFAULT_COLOR =
  "bg-gray-50 border-gray-300 text-gray-700 data-[selected]:bg-gray-600 data-[selected]:text-white data-[selected]:border-gray-600";

export function DocTypePicker({ options, value, onChange }: DocTypePickerProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {options.map((opt) => {
        const isSelected = value === opt.sigla;
        const colorClass = TYPE_COLORS[opt.sigla] ?? DEFAULT_COLOR;
        return (
          <button
            key={opt.sigla}
            type="button"
            data-selected={isSelected ? "" : undefined}
            onClick={() => onChange(isSelected ? "" : opt.sigla)}
            className={cn(
              "border rounded-lg px-2 py-2 text-left transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40",
              colorClass,
              isSelected && "shadow-md ring-2 ring-primary/30"
            )}
            title={opt.descricao}
          >
            <span className="block font-bold text-sm leading-tight">{opt.sigla}</span>
            <span className="block text-[10px] leading-tight mt-0.5 opacity-80 truncate">
              {opt.descricao}
            </span>
          </button>
        );
      })}
    </div>
  );
}
