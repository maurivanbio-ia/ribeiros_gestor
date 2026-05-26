import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft, Ban, Infinity, Layers } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";

const licenseSchema = z.object({
  numero: z.string().min(1, "Número da licença é obrigatório"),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  orgaoEmissor: z.string().min(1, "Órgão emissor é obrigatório"),
  dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
  validade: z.string().optional(),
  arquivoPdf: z.string().optional(),
  dispensaLicenciamento: z.boolean().optional(),
  semDataValidade: z.boolean().optional(),
  observacoes: z.string().optional(),
  grupo: z.string().optional(),
}).refine(
  (data) => {
    if (!data.semDataValidade && !data.validade) return false;
    return true;
  },
  { message: "Validade é obrigatória", path: ["validade"] }
);

type LicenseFormData = z.infer<typeof licenseSchema>;

const licenseTypes = [
  "Licença Prévia (LP)",
  "Licença de Instalação (LI)",
  "Licença de Operação (LO)",
  "Licença Ambiental Simplificada (LAS)",
  "Autorização Ambiental",
];

export default function NewLicense() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      numero: "",
      tipo: "",
      orgaoEmissor: "",
      dataEmissao: "",
      validade: "",
      arquivoPdf: "",
      dispensaLicenciamento: false,
      semDataValidade: false,
      observacoes: "",
      grupo: "",
    },
  });

  const createLicense = useMutation({
    mutationFn: async (data: LicenseFormData) => {
      const licenseData = {
        ...data,
        empreendimentoId: parseInt(id as string),
      };
      const response = await apiRequest("POST", "/api/licencas", licenseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/licenses"] });
      toast({
        title: "Sucesso",
        description: "Licença cadastrada com sucesso!",
      });
      setLocation(`/empreendimentos/${id}`);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar licença. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LicenseFormData) => {
    createLicense.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Nova Licença</h2>
        <p className="text-muted-foreground mt-2">Cadastre uma nova licença ambiental</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número da licença *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: LP 001/2024, LI 042/2023, LO 123/2024"
                        data-testid="input-license-number"
                      />
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
                    <FormLabel>Tipo de licença *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-license-type">
                          <SelectValue placeholder="Selecione o tipo de licença" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {licenseTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                name="orgaoEmissor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Órgão emissor *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: IBAMA, IBRAM, Secretaria de Meio Ambiente"
                        data-testid="input-issuer"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dispensa de Licenciamento */}
              <FormField
                control={form.control}
                name="dispensaLicenciamento"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-amber-600" />
                      <div>
                        <FormLabel className="text-sm font-medium text-amber-800 dark:text-amber-300 cursor-pointer">
                          Dispensa de Licenciamento
                        </FormLabel>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Documento de dispensa — não requer licença formal</p>
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataEmissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de emissão *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          data-testid="input-issue-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="semDataValidade"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) form.setValue("validade", "");
                            }}
                          />
                        </FormControl>
                        <FormLabel className="text-xs text-muted-foreground font-normal cursor-pointer flex items-center gap-1">
                          <Infinity className="h-3 w-3" />
                          Sem data de validade
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  {!form.watch("semDataValidade") && (
                    <FormField
                      control={form.control}
                      name="validade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Validade *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date"
                              data-testid="input-validity"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {form.watch("semDataValidade") && (
                    <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <Infinity className="h-4 w-4 text-blue-600" />
                      <span className="text-xs text-blue-700 dark:text-blue-300">Documento sem data de vencimento</span>
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="grupo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      Grupo / Bloco <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Bloco A, Fase 1, Lar do Sol 2, Torre Norte…"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Use o mesmo nome para agrupar licenças de um bloco ou fase.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Observações sobre a licença, condições especiais, etc."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="arquivoPdf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arquivo PDF da licença (opcional)</FormLabel>
                    <ObjectUploader
                      onGetUploadParameters={async () => {
                        const response = await apiRequest("POST", "/api/upload/pdf");
                        const data = await response.json();
                        return { 
                          method: data.method, 
                          url: data.url, 
                          filePath: data.filePath 
                        };
                      }}
                      onComplete={(result) => {
                        if (result.filePath) {
                          field.onChange(result.filePath);
                        }
                      }}
                      accept=".pdf"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-4">
                <Button 
                  type="submit" 
                  disabled={createLicense.isPending}
                  className="font-medium"
                  data-testid="button-save-license"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createLicense.isPending ? "Salvando..." : "Salvar Licença"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation(`/empreendimentos/${id}`)}
                  className="font-medium"
                  data-testid="button-cancel"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
