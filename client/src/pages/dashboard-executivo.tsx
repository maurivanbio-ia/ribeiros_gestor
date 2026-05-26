import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Car, Wrench, FileText, FileCheck, TrendingUp, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UnidadeStats {
  unidade: string;
  empreendimentos: { total: number; ativos: number; concluidos: number };
  frota: { total: number; disponiveis: number; emUso: number; manutencao: number; alugados: number };
  equipamentos: { total: number; disponiveis: number; emUso: number; manutencao: number };
  rh: { total: number; ativos: number; afastados: number };
  demandas: { total: number; pendentes: number; emAndamento: number; concluidas: number };
  contratos: { total: number; ativos: number; valorTotal: number };
}

const unidades = [
  { id: 'goiania', nome: 'Goiânia', estado: 'GO', gradient: 'from-emerald-500 to-teal-600' },
  { id: 'salvador', nome: 'Salvador', estado: 'BA', gradient: 'from-blue-500 to-cyan-600' },
  { id: 'luiz-eduardo-magalhaes', nome: 'Luiz Eduardo Magalhães', estado: 'BA', gradient: 'from-violet-500 to-indigo-600' },
];

export default function DashboardExecutivo() {
  const { data: statsData, isLoading } = useQuery<UnidadeStats[]>({
    queryKey: ['/api/dashboard/executivo'],
  });

  const totaisGerais = statsData?.reduce((acc, curr) => ({
    empreendimentos: acc.empreendimentos + curr.empreendimentos.total,
    frota: acc.frota + curr.frota.total,
    equipamentos: acc.equipamentos + curr.equipamentos.total,
    rh: acc.rh + curr.rh.total,
    demandas: acc.demandas + curr.demandas.total,
    contratos: acc.contratos + curr.contratos.total,
    valorContratos: acc.valorContratos + curr.contratos.valorTotal,
  }), {
    empreendimentos: 0,
    frota: 0,
    equipamentos: 0,
    rh: 0,
    demandas: 0,
    contratos: 0,
    valorContratos: 0,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 eco-fade-up">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="premium-gradient-primary rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent)] pointer-events-none"></div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Dashboard Executivo</h1>
              <p className="text-white/80 text-lg">Visão Consolidada do Sistema SGAI</p>
            </div>
          </div>
          
          {/* Totais Gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-white/70 text-sm mb-1">Total de Unidades</div>
              <div className="text-3xl font-bold">{unidades.length}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-white/70 text-sm mb-1">Empreendimentos</div>
              <div className="text-3xl font-bold">{totaisGerais?.empreendimentos || 0}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-white/70 text-sm mb-1">Colaboradores</div>
              <div className="text-3xl font-bold">{totaisGerais?.rh || 0}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-white/70 text-sm mb-1">Valor em Contratos</div>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totaisGerais?.valorContratos || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* KPIs Consolidados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="premium-card overflow-hidden">
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 border-b">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-900 dark:text-blue-200">
                <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Frota Total
              </h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-3">{totaisGerais?.frota || 0}</div>
              <div className="space-y-1.5 text-sm">
                {statsData?.map((unidade) => (
                  <div key={unidade.unidade} className="flex justify-between border-b border-border/40 pb-1 last:border-0 last:pb-0">
                    <span className="text-muted-foreground">{unidade.unidade}:</span>
                    <span className="font-semibold">{unidade.frota.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="premium-card overflow-hidden">
            <div className="bg-orange-50/50 dark:bg-orange-950/20 p-4 border-b">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-orange-900 dark:text-orange-200">
                <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                Equipamentos
              </h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-3">{totaisGerais?.equipamentos || 0}</div>
              <div className="space-y-1.5 text-sm">
                {statsData?.map((unidade) => (
                  <div key={unidade.unidade} className="flex justify-between border-b border-border/40 pb-1 last:border-0 last:pb-0">
                    <span className="text-muted-foreground">{unidade.unidade}:</span>
                    <span className="font-semibold">{unidade.equipamentos.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="premium-card overflow-hidden">
            <div className="bg-purple-50/50 dark:bg-purple-950/20 p-4 border-b">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-purple-900 dark:text-purple-200">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Demandas
              </h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-3">{totaisGerais?.demandas || 0}</div>
              <div className="space-y-1.5 text-sm">
                {statsData?.map((unidade) => (
                  <div key={unidade.unidade} className="flex justify-between border-b border-border/40 pb-1 last:border-0 last:pb-0">
                    <span className="text-muted-foreground">{unidade.unidade}:</span>
                    <span className="font-semibold">{unidade.demandas.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Detalhamento por Unidade */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Detalhamento por Unidade
          </h2>
          
          {statsData?.map((unidade, idx) => {
            const unidadeInfo = unidades[idx];
            return (
              <div key={unidade.unidade} className="premium-card overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${unidadeInfo.gradient}`}></div>
                <div className="bg-muted/20 p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-3 text-2xl font-bold text-foreground">
                      <Building2 className="h-7 w-7 text-primary" />
                      SGAI — {unidade.unidade}
                    </h3>
                    <span className="text-xs bg-muted border text-muted-foreground px-3 py-1 rounded-full font-semibold uppercase tracking-wider">
                      {unidadeInfo.estado}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    {/* Empreendimentos */}
                    <div className="text-center p-4 bg-muted/40 dark:bg-muted/10 rounded-xl hover:bg-muted/60 transition-colors border border-border/50">
                      <Building2 className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                      <div className="text-xs text-muted-foreground mb-1 font-medium">Empreendimentos</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{unidade.empreendimentos.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-medium">{unidade.empreendimentos.ativos} ativos</div>
                    </div>

                    {/* Frota */}
                    <div className="text-center p-4 bg-muted/40 dark:bg-muted/10 rounded-xl hover:bg-muted/60 transition-colors border border-border/50">
                      <Car className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                      <div className="text-xs text-muted-foreground mb-1 font-medium">Veículos</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{unidade.frota.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-medium">{unidade.frota.disponiveis} disponíveis</div>
                    </div>

                    {/* Equipamentos */}
                    <div className="text-center p-4 bg-muted/40 dark:bg-muted/10 rounded-xl hover:bg-muted/60 transition-colors border border-border/50">
                      <Wrench className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                      <div className="text-xs text-muted-foreground mb-1 font-medium">Equipamentos</div>
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{unidade.equipamentos.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-medium">{unidade.equipamentos.disponiveis} disponíveis</div>
                    </div>

                    {/* RH */}
                    <div className="text-center p-4 bg-muted/40 dark:bg-muted/10 rounded-xl hover:bg-muted/60 transition-colors border border-border/50">
                      <Users className="h-6 w-6 mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
                      <div className="text-xs text-muted-foreground mb-1 font-medium">Colaboradores</div>
                      <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{unidade.rh.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-medium">{unidade.rh.ativos} ativos</div>
                    </div>

                    {/* Demandas */}
                    <div className="text-center p-4 bg-muted/40 dark:bg-muted/10 rounded-xl hover:bg-muted/60 transition-colors border border-border/50">
                      <FileText className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                      <div className="text-xs text-muted-foreground mb-1 font-medium">Demandas</div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{unidade.demandas.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-medium">{unidade.demandas.concluidas} concluídas</div>
                    </div>

                    {/* Contratos */}
                    <div className="text-center p-4 bg-muted/40 dark:bg-muted/10 rounded-xl hover:bg-muted/60 transition-colors border border-border/50">
                      <FileCheck className="h-6 w-6 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                      <div className="text-xs text-muted-foreground mb-1 font-medium">Contratos</div>
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{unidade.contratos.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(unidade.contratos.valorTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

