import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Wallet, Pencil, Trash2, Link2, Paperclip, X, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function RecibosSection() {
  const queryClientHook = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [uploadingArquivo, setUploadingArquivo] = useState(false);
  const [uploadingNF, setUploadingNF] = useState(false);
  const [form, setForm] = useState({
    descricao: "", valor: "", pagador: "", recebedor: "",
    dataPagamento: "", metodoPagamento: "pix", categoria: "", observacoes: "", numero: "",
    arquivo: "" as string | null, notaFiscalUrl: "" as string | null,
    arquivoNome: "", nfNome: "",
  });

  async function handleFileUpload(field: "arquivo" | "notaFiscalUrl", nomeField: "arquivoNome" | "nfNome") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (field === "arquivo") setUploadingArquivo(true);
      else setUploadingNF(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const resp = await fetch("/api/arquivos/upload", { method: "POST", credentials: "include", body: fd });
        if (!resp.ok) throw new Error("Erro no upload");
        const data = await resp.json();
        const url = data.fileUrl || data.url || `/api/arquivos/${data.id}/download`;
        setForm(f => ({ ...f, [field]: url, [nomeField]: file.name }));
        toast({ title: "Arquivo enviado", description: file.name });
      } catch {
        toast({ title: "Erro", description: "Falha ao enviar arquivo", variant: "destructive" });
      } finally {
        if (field === "arquivo") setUploadingArquivo(false);
        else setUploadingNF(false);
      }
    };
    input.click();
  }

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/recibos"],
    queryFn: () => fetch("/api/recibos", { credentials: "include" }).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const { arquivoNome: _an, nfNome: _nn, ...rest } = data;
      return editing
        ? fetch(`/api/recibos/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rest) }).then(r => r.json())
        : fetch("/api/recibos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rest) }).then(r => r.json());
    },
    onSuccess: () => {
      void queryClientHook.invalidateQueries({ queryKey: ["/api/recibos"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/recibos/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClientHook.invalidateQueries({ queryKey: ["/api/recibos"] }),
  });

  const totalValor = items.reduce((acc: number, r: any) => acc + parseFloat(r.valor || "0"), 0);

  function openNew() {
    setEditing(null);
    setForm({ descricao: "", valor: "", pagador: "", recebedor: "", dataPagamento: "", metodoPagamento: "pix", categoria: "", observacoes: "", numero: "", arquivo: null, notaFiscalUrl: null, arquivoNome: "", nfNome: "" });
    setOpen(true);
  }

  function openEdit(item: any) {
    setEditing(item);
    setForm({
      descricao: item.descricao, valor: item.valor, pagador: item.pagador || "",
      recebedor: item.recebedor || "", dataPagamento: item.dataPagamento || "",
      metodoPagamento: item.metodoPagamento || "pix", categoria: item.categoria || "",
      observacoes: item.observacoes || "", numero: item.numero || "",
      arquivo: item.arquivo || null, notaFiscalUrl: item.notaFiscalUrl || null,
      arquivoNome: "", nfNome: "",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Recibos de Pagamento</h3>
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-medium text-green-600">R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> ({items.length} recibos)
              </p>
            </div>
            <Button onClick={openNew} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />Novo Recibo
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum recibo registrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 px-3">Nº</th>
                    <th className="text-left py-2 px-3">Descrição</th>
                    <th className="text-left py-2 px-3">Lançamento</th>
                    <th className="text-left py-2 px-3">Empreendimento</th>
                    <th className="text-left py-2 px-3">Pagador</th>
                    <th className="text-left py-2 px-3">Data</th>
                    <th className="text-left py-2 px-3">Método</th>
                    <th className="text-right py-2 px-3">Valor</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 text-muted-foreground">{item.numero || "-"}</td>
                      <td className="py-2 px-3 font-medium max-w-[160px] truncate">{item.descricao}</td>
                      <td className="py-2 px-3">
                        {item.lancamentoId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded px-2 py-0.5">
                            <Link2 className="h-3 w-3" />
                            #{item.lancamentoId}
                            {item.lancamentoDescricao && (
                              <span className="hidden sm:inline text-muted-foreground ml-1 truncate max-w-[80px]">
                                {item.lancamentoDescricao}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Avulso</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{item.empreendimentoNome || "-"}</td>
                      <td className="py-2 px-3">{item.pagador || "-"}</td>
                      <td className="py-2 px-3">{item.dataPagamento || "-"}</td>
                      <td className="py-2 px-3"><span className="capitalize">{item.metodoPagamento}</span></td>
                      <td className="py-2 px-3 text-right font-medium text-green-700">
                        R$ {parseFloat(item.valor || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1 justify-end">
                          {item.arquivo && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" title="Ver comprovante"
                              onClick={() => import("@/lib/fileViewer").then(m => m.openFileUrl(item.arquivo!))}>
                              <Paperclip className="h-3 w-3" />
                            </Button>
                          )}
                          {item.notaFiscalUrl && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-violet-600" title="Ver Nota Fiscal"
                              onClick={() => import("@/lib/fileViewer").then(m => m.openFileUrl(item.notaFiscalUrl!))}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={() => { if (confirm("Remover recibo?")) deleteMutation.mutate(item.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Recibo" : "Novo Recibo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Número</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="REC-001" />
              </div>
              <div className="space-y-1">
                <Label>Método</Label>
                <Select value={form.metodoPagamento} onValueChange={v => setForm(f => ({ ...f, metodoPagamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pix", "transferencia", "boleto", "dinheiro", "cheque"].map(m => (
                      <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label>Data Pagamento</Label>
                <Input type="date" value={form.dataPagamento} onChange={e => setForm(f => ({ ...f, dataPagamento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Pagador</Label>
                <Input value={form.pagador} onChange={e => setForm(f => ({ ...f, pagador: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Recebedor</Label>
                <Input value={form.recebedor} onChange={e => setForm(f => ({ ...f, recebedor: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Serviços, Material, Taxa" />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Recibo / Comprovante</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1 justify-start text-xs"
                    disabled={uploadingArquivo}
                    onClick={() => handleFileUpload("arquivo", "arquivoNome")}
                  >
                    <Paperclip className="mr-1 h-3 w-3" />
                    {uploadingArquivo ? "Enviando..." : (form.arquivoNome || (form.arquivo ? "Arquivo anexado" : "Anexar"))}
                  </Button>
                  {form.arquivo && (
                    <>
                      <a href={form.arquivo} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3 w-3" /></Button>
                      </a>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm(f => ({ ...f, arquivo: null, arquivoNome: "" }))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nota Fiscal</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1 justify-start text-xs"
                    disabled={uploadingNF}
                    onClick={() => handleFileUpload("notaFiscalUrl", "nfNome")}
                  >
                    <Paperclip className="mr-1 h-3 w-3" />
                    {uploadingNF ? "Enviando..." : (form.nfNome || (form.notaFiscalUrl ? "NF anexada" : "Anexar NF"))}
                  </Button>
                  {form.notaFiscalUrl && (
                    <>
                      <a href={form.notaFiscalUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3 w-3" /></Button>
                      </a>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm(f => ({ ...f, notaFiscalUrl: null, nfNome: "" }))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.descricao || !form.valor || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
