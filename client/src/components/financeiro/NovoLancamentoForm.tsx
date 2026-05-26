import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DateInput } from "@/components/DateInput";
import { Loader2, RefreshCw, ReceiptText, Paperclip, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Empreendimento, CategoriaFinanceira, Projeto, Campanha } from "@shared/schema";
import { novoLancamentoSchema, type NovoLancamentoFormData, formatDateLocal } from "./types";

interface NovoLancamentoFormProps {
  onSuccess: () => void;
}

export function NovoLancamentoForm({ onSuccess }: NovoLancamentoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showOutrosInput, setShowOutrosInput] = useState(false);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);
  const [comprovanteFileName, setComprovanteFileName] = useState<string | null>(null);

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: allProjetos = [] } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: allCampanhas = [] } = useQuery<Campanha[]>({
    queryKey: ["/api/campanhas"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: categorias = [], refetch: refetchCategorias } = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/categorias-financeiras"],
    staleTime: 1000 * 60 * 5,
  });

  const initCategoriesMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/categorias-financeiras/init"),
    onSuccess: () => { refetchCategorias(); },
  });

  const syncCategoriesMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/categorias-financeiras/sync"),
    onSuccess: () => {
      refetchCategorias();
      toast({ title: "Categorias atualizadas", description: "As categorias foram sincronizadas com sucesso!" });
    },
  });

  const form = useForm<NovoLancamentoFormData>({
    resolver: zodResolver(novoLancamentoSchema),
    defaultValues: {
      tipo: "despesa",
      valor: 0,
      descricao: "",
      observacoes: "",
      categoriaOutros: "",
      data: new Date(),
      dataVencimento: null,
      dataPagamento: null,
      isReembolso: false,
      projetoId: null,
      campanhaId: null,
      comprovanteUrl: null,
      notaFiscalUrl: null,
    },
  });

  const tipoSelecionado = form.watch("tipo");
  const isReembolso = form.watch("isReembolso");
  const selectedEmpreendimentoId = form.watch("empreendimentoId");
  const selectedProjetoId = form.watch("projetoId");

  const projetosFiltrados = allProjetos.filter(p =>
    !selectedEmpreendimentoId || (p as any).empreendimentoId === selectedEmpreendimentoId
  );
  const campanhasFiltradas = allCampanhas.filter(c =>
    (!selectedEmpreendimentoId || c.empreendimentoId === selectedEmpreendimentoId) &&
    (!selectedProjetoId || c.projetoId === selectedProjetoId)
  );

  const createLancamentoMutation = useMutation({
    mutationFn: async (data: NovoLancamentoFormData) => {
      const { isReembolso: _flag, ...rest } = data;
      const payload = {
        ...rest,
        data: formatDateLocal(data.data),
        dataVencimento: formatDateLocal(data.dataVencimento),
        dataPagamento: formatDateLocal(data.dataPagamento),
      };
      const lancamento = await apiRequest("POST", "/api/financeiro/lancamentos", payload);

      // When marked as reembolso, also create a pedido de reembolso entry.
      // Done in a separate try/catch so a reembolso failure never blocks the lancamento.
      if (_flag) {
        try {
          await apiRequest("POST", "/api/reembolsos", {
            titulo: data.descricao.substring(0, 100),
            descricao: data.observacoes
              ? `${data.descricao}\n\n${data.observacoes}`
              : data.descricao,
            categoria: "outros",
            valor: String(data.valor),
            dataGasto: formatDateLocal(data.data),
            empreendimentoId: data.empreendimentoId ?? null,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
        } catch (reembolsoError) {
          console.error("Reembolso creation failed (lancamento was saved):", reembolsoError);
          toast({
            title: "Aviso",
            description:
              "Lançamento criado, mas houve um erro ao registrar o pedido de reembolso. Crie o pedido manualmente no portal.",
            variant: "destructive",
          });
        }
      }

      return lancamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith?.("/api/financeiro") ?? false;
        },
      });
      toast({ title: "Lançamento criado", description: "Novo lançamento financeiro foi criado com sucesso!" });
      form.reset();
      setShowOutrosInput(false);
      onSuccess();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível criar o lançamento.", variant: "destructive" });
    },
  });

  const onSubmit = (data: NovoLancamentoFormData) => { createLancamentoMutation.mutate(data); };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="tipo" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Lançamento *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-tipo">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="reembolso">Reembolso</SelectItem>
                  <SelectItem value="solicitacao_recurso">Solicitação de Recurso</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="empreendimentoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Empreendimento *</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value === "escritorio" ? null : Number(value));
                  form.setValue("projetoId", null);
                  form.setValue("campanhaId", null);
                }}
                value={field.value === null ? "escritorio" : field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-empreendimento">
                    <SelectValue placeholder="Selecione o empreendimento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="escritorio" className="font-medium text-blue-600">
                    Escritório (Despesas Administrativas)
                  </SelectItem>
                  {empreendimentos.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>{emp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="projetoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Projeto</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value === "nenhum" ? null : Number(value));
                  form.setValue("campanhaId", null);
                }}
                value={field.value === null || field.value === undefined ? "nenhum" : field.value.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o projeto (opcional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum (sem projeto)</SelectItem>
                  {(projetosFiltrados.length > 0 ? projetosFiltrados : allProjetos).map((proj) => (
                    <SelectItem key={proj.id} value={proj.id.toString()}>{proj.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="campanhaId" render={({ field }) => (
            <FormItem>
              <FormLabel>Campanha</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === "nenhum" ? null : Number(value))}
                value={field.value === null || field.value === undefined ? "nenhum" : field.value.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a campanha (opcional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhuma (sem campanha)</SelectItem>
                  {(campanhasFiltradas.length > 0 ? campanhasFiltradas : allCampanhas).map((camp) => (
                    <SelectItem key={camp.id} value={camp.id.toString()}>{camp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="categoriaId" render={({ field }) => {
            const categoriasFiltradas = categorias.filter((cat) =>
              tipoSelecionado === "receita" ? cat.tipo === "receita" : cat.tipo === "despesa"
            );
            return (
              <FormItem className="col-span-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Categoria *</FormLabel>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => syncCategoriesMutation.mutate()}
                    disabled={syncCategoriesMutation.isPending}
                    className="text-xs h-6" data-testid="button-sync-categorias">
                    {syncCategoriesMutation.isPending
                      ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      : <RefreshCw className="h-3 w-3 mr-1" />}
                    Atualizar
                  </Button>
                </div>
                {categorias.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                    {initCategoriesMutation.isPending ? "Inicializando categorias..." : "Carregando categorias..."}
                  </div>
                ) : (
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        if (value === "outros") {
                          setShowOutrosInput(true);
                          const outrosCat = categoriasFiltradas.find(
                            (c) => c.nome === "Outras Despesas" || c.nome === "Outras Receitas"
                          );
                          if (outrosCat) field.onChange(outrosCat.id);
                        } else {
                          setShowOutrosInput(false);
                          field.onChange(Number(value));
                        }
                      }}
                      value={showOutrosInput ? "outros" : field.value?.toString() || ""}
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
                      data-testid="radio-categoria"
                    >
                      {categoriasFiltradas
                        .filter((c) => c.nome !== "Outras Despesas" && c.nome !== "Outras Receitas")
                        .map((cat) => (
                          <div key={cat.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={cat.id.toString()} id={`cat-${cat.id}`} data-testid={`radio-categoria-${cat.id}`} />
                            <Label htmlFor={`cat-${cat.id}`} className="flex items-center gap-2 cursor-pointer text-sm">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor }} />
                              {cat.nome}
                            </Label>
                          </div>
                        ))}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="outros" id="cat-outros" data-testid="radio-categoria-outros" />
                        <Label htmlFor="cat-outros" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-400" /> Outros
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                )}
                {showOutrosInput && (
                  <div className="mt-3">
                    <Input placeholder="Digite a categoria personalizada..."
                      value={form.watch("categoriaOutros") || ""}
                      onChange={(e) => form.setValue("categoriaOutros", e.target.value)}
                      className="max-w-md" data-testid="input-categoria-outros" />
                  </div>
                )}
                <FormMessage />
              </FormItem>
            );
          }} />

          <FormField control={form.control} name="valor" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor *</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="0,00" {...field}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                  data-testid="input-valor" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="data" render={({ field }) => (
            <FormItem>
              <FormLabel>Data do Lançamento *</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="dataVencimento" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Vencimento</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data-vencimento" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="dataPagamento" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Pagamento</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data-pagamento" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="descricao" render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição *</FormLabel>
            <FormControl>
              <Textarea placeholder="Descreva o lançamento financeiro..." className="min-h-[100px] resize-none"
                {...field} data-testid="textarea-descricao" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="observacoes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl>
              <Textarea placeholder="Observações adicionais..." className="min-h-[60px] resize-none"
                {...field} data-testid="textarea-observacoes" />
            </FormControl>
            <FormDescription>Informações complementares sobre o lançamento</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        {/* File uploads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="comprovanteUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>Recibo / Comprovante</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1 justify-start"
                    disabled={uploadingComprovante}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx";
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        setUploadingComprovante(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const resp = await fetch("/api/arquivos/upload", {
                            method: "POST",
                            credentials: "include",
                            body: formData,
                          });
                          if (!resp.ok) throw new Error("Erro no upload");
                          const data = await resp.json();
                          field.onChange(data.fileUrl || data.url || `/api/arquivos/${data.id}/download`);
                          setComprovanteFileName(file.name);
                          toast({ title: "Arquivo enviado", description: file.name });
                        } catch {
                          toast({ title: "Erro", description: "Falha ao enviar arquivo", variant: "destructive" });
                        } finally {
                          setUploadingComprovante(false);
                        }
                      };
                      input.click();
                    }}
                  >
                    {uploadingComprovante ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                    {comprovanteFileName ? comprovanteFileName : "Anexar arquivo"}
                  </Button>
                  {field.value && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => { field.onChange(null); setComprovanteFileName(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="notaFiscalUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>Nota Fiscal</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1 justify-start"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".pdf,.jpg,.jpeg,.png,.xml";
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const resp = await fetch("/api/arquivos/upload", {
                            method: "POST",
                            credentials: "include",
                            body: formData,
                          });
                          if (!resp.ok) throw new Error("Erro no upload");
                          const data = await resp.json();
                          field.onChange(data.fileUrl || data.url || `/api/arquivos/${data.id}/download`);
                          toast({ title: "Nota Fiscal enviada", description: file.name });
                        } catch {
                          toast({ title: "Erro", description: "Falha ao enviar NF", variant: "destructive" });
                        }
                      };
                      input.click();
                    }}
                  >
                    <Paperclip className="mr-2 h-4 w-4" />
                    {field.value ? "NF anexada" : "Anexar Nota Fiscal"}
                  </Button>
                  {field.value && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => field.onChange(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Reembolso toggle */}
        <FormField control={form.control} name="isReembolso" render={({ field }) => (
          <FormItem>
            <div className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${isReembolso ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30" : "border-muted"}`}>
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  id="isReembolso"
                  data-testid="checkbox-reembolso"
                  className="mt-0.5"
                />
              </FormControl>
              <div className="flex-1">
                <Label htmlFor="isReembolso" className="flex items-center gap-2 cursor-pointer font-medium">
                  <ReceiptText className="h-4 w-4 text-blue-600" />
                  Este lançamento é um reembolso
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Ao marcar esta opção, um pedido de reembolso será criado automaticamente e aparecerá nas abas de reembolso para aprovação.
                </p>
              </div>
            </div>
          </FormItem>
        )} />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => { form.reset(); setShowOutrosInput(false); setComprovanteFileName(null); }} data-testid="button-cancelar">
            Limpar
          </Button>
          <Button type="submit" disabled={createLancamentoMutation.isPending} data-testid="button-criar-lancamento">
            {createLancamentoMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</>
            ) : "Criar Lançamento"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
