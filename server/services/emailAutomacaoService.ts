import { db } from "../db";
import { emailContas, emailsCapturados, empreendimentos, demandas, users } from "@shared/schema";
import { eq, and, desc, like, or, ilike } from "drizzle-orm";
import { sql } from "drizzle-orm";

const CATEGORIAS = [
  "Demanda nova", "Demanda em andamento", "Demanda concluída",
  "Pendência técnica", "Pendência administrativa", "Pendência financeira",
  "Solicitação de revisão", "Solicitação de envio de documento",
  "Aprovação ou aceite", "Evidência de cumprimento",
  "Condicionante ambiental", "Programa ambiental", "Relatório técnico",
  "Licença, autorização ou ofício", "Empreendimento", "Cliente",
  "Contrato", "Responsável interno", "Prazo", "Prioridade", "Status",
  "Anexos e evidências", "Comunicado institucional", "Cobrança", "Notificação",
];

export async function classificarEmailComIA(assunto: string, corpo: string, remetente: string, emps: {id:number;nome:string;apelido?:string|null}[]) {
  const apiKey = process.env.OPENAI_DIRECT_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key não configurada");
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  const empsCtx = emps.slice(0, 40).map(e => `[ID:${e.id}] ${e.nome}${e.apelido ? ` (${e.apelido})` : ''}`).join("\n");

  const prompt = `Você é um sistema de gestão ambiental. Classifique o e-mail abaixo e extraia todas as informações relevantes.

EMPREENDIMENTOS CADASTRADOS:
${empsCtx || "Nenhum cadastrado ainda"}

E-MAIL:
De: ${remetente}
Assunto: ${assunto}
Corpo: ${corpo.slice(0, 3000)}

Responda APENAS em JSON válido com esta estrutura exata:
{
  "resumo": "resumo do e-mail em 1-2 frases",
  "categoriaPrincipal": "uma das categorias: ${CATEGORIAS.slice(0,8).join(', ')}...",
  "subcategoria": "subcategoria específica",
  "tipoDemanda": "tipo específico de demanda ou null",
  "descricaoDemanda": "descrição clara da demanda ou null",
  "prioridade": "alta|media|baixa",
  "nivelRisco": "alto|medio|baixo",
  "statusDemanda": "pendente|em_andamento|concluida|aprovada|aguardando_validacao|enviada_ao_cliente",
  "empreendimentoId": ID numérico do empreendimento vinculado ou null,
  "empreendimentoNome": "nome do empreendimento ou null",
  "clienteVinculado": "nome do cliente ou null",
  "contratoVinculado": "número ou referência do contrato ou null",
  "programaAmbiental": "nome do programa ou null",
  "condicionante": "referência da condicionante ou null",
  "numeroProcesso": "número do processo/licença/ofício ou null",
  "responsavelSugerido": "nome do responsável interno ou null",
  "responsavelExterno": "nome ou e-mail do responsável externo ou null",
  "prazoIdentificado": "prazo em texto ou null",
  "dataVencimento": "data ISO 8601 ou null",
  "remetenteOrg": "organização/empresa do remetente ou null",
  "evidenciaCumprimento": true ou false,
  "precisaValidacao": true ou false,
  "vinculoPendente": true ou false,
  "nivelConfianca": número entre 0 e 1,
  "observacoesIA": "observações relevantes ou null",
  "sugestoesVinculo": [{"id": ID, "nome": "nome", "confianca": 0.0-1.0}] ou []
}`;

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1000,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  let parsed: any = {};
  try { parsed = JSON.parse(resp.choices[0]?.message?.content || "{}"); } catch {}
  return parsed;
}

// Backoff em memória: evita tentar contas bloqueadas temporariamente
const TEMP_BLOCKED = new Map<number, number>(); // contaId → timestamp de liberação
const BLOCK_DURATION_MS = 45 * 60 * 1000; // 45 minutos

export function isContaBloqueada(contaId: number): boolean {
  const liberaEm = TEMP_BLOCKED.get(contaId);
  if (!liberaEm) return false;
  if (Date.now() >= liberaEm) { TEMP_BLOCKED.delete(contaId); return false; }
  return true;
}

function bloqueiarContaTemporariamente(contaId: number) {
  TEMP_BLOCKED.set(contaId, Date.now() + BLOCK_DURATION_MS);
  console.warn(`[EmailAutomação] Conta ${contaId} bloqueada temporariamente por ${BLOCK_DURATION_MS / 60000} min`);
}

function categorizeImapError(raw: string, extraInfo?: string): { msg: string; temporario: boolean } {
  const m = (raw || "").toLowerCase();
  const extra = (extraInfo || "").toLowerCase();
  const combined = m + " " + extra;
  if (m.includes("getaddrinfo") || m.includes("enotfound") || m.includes("could not resolve"))
    return { msg: "Host inválido: o servidor não foi encontrado. Verifique o endereço IMAP (ex: email-ssl.com.br).", temporario: false };
  if (m.includes("econnrefused"))
    return { msg: "Porta bloqueada: conexão recusada. Verifique a porta (993 para SSL/TLS ou 143 para STARTTLS).", temporario: false };
  if (m.includes("etimedout") || m.includes("connect etimedout") || m.includes("timed out") || m.includes("timeout") || m.includes("não completou"))
    return { msg: "Timeout: o servidor não respondeu. Verifique host, porta e se o acesso IMAP está liberado.", temporario: true };
  if (m.includes("self signed") || m.includes("unable to verify") || m.includes("certificate"))
    return { msg: "Erro de certificado SSL: tente alterar a porta (993↔143) ou entre em contato com o provedor.", temporario: false };
  // Bloqueio temporário do servidor (ex: Locaweb [UNAVAILABLE]) — verificar ANTES de credenciais
  if (combined.includes("[unavailable]") || combined.includes("temporary authentication failure") || combined.includes("temporarily") || combined.includes("too many") || combined.includes("rate limit") || combined.includes("try again later"))
    return { msg: "Bloqueio temporário no servidor — muitas tentativas de login consecutivas. Aguarde 30–45 minutos e tente novamente. Acesse o Webmail para desbloquear a conta.", temporario: true };
  if (m.includes("authenticationfailed") || m.includes("invalid credentials") || m.includes("authentication failed") ||
      m.includes("login failed") || m.includes("bad credentials") || m.includes("username and password") || m.includes("[auth]"))
    return { msg: "Senha incorreta: autenticação recusada. Verifique o usuário (e-mail completo) e a senha.", temporario: false };
  if (m.includes("imap access") || m.includes("imap is disabled") || m.includes("not enabled"))
    return { msg: "Acesso IMAP desativado: ative o IMAP nas configurações do provedor.", temporario: false };
  if (m.includes("too many connections") || m.includes("maximum number"))
    return { msg: "Limite de conexões atingido: aguarde alguns minutos e tente novamente.", temporario: true };
  // "Command failed" é o erro genérico do ImapFlow para resposta NO/BAD
  if (m.includes("command failed") || extra.includes("authenticationfailed") || extra.includes("no login") || extra.includes("login failed"))
    return { msg: "Credenciais incorretas: o servidor recusou o login. Verifique o usuário (e-mail completo) e a senha.", temporario: false };
  if (m.includes("cannot convert") || m.includes("undefined or null"))
    return { msg: "Erro de protocolo IMAP: resposta inesperada do servidor. Verifique host, porta e SSL.", temporario: false };
  return { msg: (raw || "Erro desconhecido").slice(0, 300), temporario: false };
}

export async function sincronizarConta(contaId: number, unidade: string) {
  // Backoff: não tenta conta bloqueada temporariamente
  if (isContaBloqueada(contaId)) {
    const liberaEm = TEMP_BLOCKED.get(contaId)!;
    const minutos = Math.ceil((liberaEm - Date.now()) / 60000);
    console.warn(`[EmailAutomação] Conta ${contaId} em backoff — pulando (libera em ~${minutos} min)`);
    throw new Error(`Bloqueio temporário ativo — próxima tentativa em ~${minutos} minuto(s). Acesse o Webmail para desbloquear.`);
  }

  let client: any = null;
  let lock: any = null;
  let capturados = 0;
  let erros = 0;

  try {
    console.log(`[EmailAutomação] STEP1 buscando conta id=${contaId}`);
    const [conta] = await db.select().from(emailContas)
      .where(and(eq(emailContas.id, contaId), eq(emailContas.ativo, true)));
    if (!conta) throw new Error("Conta não encontrada ou inativa");
    console.log(`[EmailAutomação] STEP2 conta encontrada: ${conta.email}`);

    const emps = await db.select({ id: empreendimentos.id, nome: empreendimentos.nome })
      .from(empreendimentos).where(eq(empreendimentos.unidade, unidade));
    console.log(`[EmailAutomação] STEP3 emps=${emps.length}`);

    const { ImapFlow } = await import("imapflow");
    const { simpleParser } = await import("mailparser");
    console.log(`[EmailAutomação] STEP4 imports ok`);

    const isSecure = Boolean(conta.secure) && conta.secure !== '0' && conta.secure !== 'false';
    const imapOpts: any = {
      host: String(conta.host || "").trim(),
      port: Number(conta.port) || 993,
      secure: isSecure,
      auth: { user: String(conta.usuario || "").trim(), pass: String(conta.senha || "") },
      logger: false,
      connectionTimeout: 30000,
      greetingTimeout: 20000,
      socketTimeout: 60000,
      disableAutoIdle: true,
      // Bypass de verificação SSL — necessário para Locaweb e provedores com cert auto-assinado
      tls: {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      },
    };
    if (!isSecure) {
      // STARTTLS: também desabilita verificação de cert no upgrade
      imapOpts.tlsOptions = { rejectUnauthorized: false, checkServerIdentity: () => undefined };
    }
    console.log(`[EmailAutomação] STEP5 opts host=${imapOpts.host} port=${imapOpts.port} secure=${imapOpts.secure} user=${imapOpts.auth?.user}`);

    client = new (ImapFlow as any)(imapOpts);
    console.log(`[EmailAutomação] STEP6 cliente criado, conectando...`);

    await client.connect();
    console.log(`[EmailAutomação] STEP7 conectado OK`);

    lock = await client.getMailboxLock("INBOX");

    // Carregar IDs já conhecidos
    const existingRows = await db.select({ messageId: emailsCapturados.messageId })
      .from(emailsCapturados).where(eq(emailsCapturados.contaId, contaId));
    const knownIds = new Set(existingRows.map((r: any) => r.messageId).filter(Boolean));

    // Após getMailboxLock, client.mailbox.exists já contém o total de mensagens
    const totalMessages: number = (client as any).mailbox?.exists ?? 0;
    console.log(`[EmailAutomação] ${conta.email}: ${totalMessages} mensagens na INBOX (mailbox.exists)`);

    if (totalMessages > 0) {
      const start = Math.max(1, totalMessages - 99);
      const range = `${start}:${totalMessages}`;

      for await (const msg of client.fetch(range, { envelope: true, source: true })) {
        if (!msg) continue;

        try {
          // Guard obrigatório: source deve existir e ser conversível
          const rawSource = msg.source;
          if (rawSource === null || rawSource === undefined) { erros++; continue; }

          const sourceBuf = Buffer.isBuffer(rawSource)
            ? rawSource
            : typeof rawSource === "string"
              ? Buffer.from(rawSource, "utf8")
              : Buffer.from(String(rawSource));

          if (sourceBuf.length === 0) { erros++; continue; }

          // Envelope seguro
          const envelope = msg.envelope ?? {};
          const msgId: string = (envelope.messageId as string | undefined)
            || `${conta.id}-${msg.uid ?? Date.now()}`;

          if (knownIds.has(msgId)) continue;

          const parsed = await simpleParser(sourceBuf, { skipHtmlToText: false });

          const rawText = parsed.text ?? "";
          const rawHtml = parsed.html ?? "";
          const corpo = (rawText || rawHtml.replace(/<[^>]*>/g, " "))
            .slice(0, 8000).replace(/\s+/g, " ").trim();

          const assunto: string = (envelope.subject as string | undefined) || "(sem assunto)";
          const fromList: any[] = Array.isArray(envelope.from) ? envelope.from : [];
          const remetente: string = fromList[0]?.address ?? "desconhecido";
          const toList: any[] = Array.isArray(envelope.to) ? envelope.to : [];

          const classificacao: any = await classificarEmailComIA(
            assunto, corpo.slice(0, 4000), remetente, emps
          ).catch(() => ({}));

          const attachments: any[] = Array.isArray(parsed.attachments) ? parsed.attachments : [];
          const anexos = attachments.map((a: any) => ({
            nome: a.filename ?? "anexo",
            tamanho: typeof a.size === "number" ? a.size : 0,
            tipo: a.contentType ?? "application/octet-stream",
          }));

          const emailData: any = {
            contaId,
            messageId: msgId,
            dataRecebimento: envelope.date instanceof Date ? envelope.date : new Date(),
            remetente,
            remetenteOrg:       classificacao.remetenteOrg       ?? null,
            destinatarios:      toList.map((t: any) => t?.address).filter(Boolean),
            assunto,
            resumo:             classificacao.resumo              ?? assunto,
            corpo:              corpo.slice(0, 5000),
            categoriaPrincipal: classificacao.categoriaPrincipal  ?? "Notificação",
            subcategoria:       classificacao.subcategoria         ?? null,
            tipoDemanda:        classificacao.tipoDemanda          ?? null,
            descricaoDemanda:   classificacao.descricaoDemanda     ?? null,
            prioridade:         classificacao.prioridade           ?? "media",
            nivelRisco:         classificacao.nivelRisco           ?? "baixo",
            statusDemanda:      classificacao.statusDemanda        ?? "pendente",
            empreendimentoId:   classificacao.empreendimentoId     ?? null,
            empreendimentoNome: classificacao.empreendimentoNome   ?? null,
            clienteVinculado:   classificacao.clienteVinculado     ?? null,
            contratoVinculado:  classificacao.contratoVinculado    ?? null,
            programaAmbiental:  classificacao.programaAmbiental    ?? null,
            condicionante:      classificacao.condicionante        ?? null,
            numeroProcesso:     classificacao.numeroProcesso       ?? null,
            responsavelSugerido:classificacao.responsavelSugerido  ?? null,
            responsavelExterno: classificacao.responsavelExterno   ?? null,
            prazoIdentificado:  classificacao.prazoIdentificado    ?? null,
            dataVencimento: classificacao.dataVencimento
              ? new Date(classificacao.dataVencimento) : null,
            anexos:             anexos.length ? anexos : null,
            evidenciaCumprimento: !!classificacao.evidenciaCumprimento,
            nivelConfianca:     classificacao.nivelConfianca       ?? null,
            precisaValidacao:   !!classificacao.precisaValidacao,
            vinculoPendente:    !!classificacao.vinculoPendente,
            sugestoesVinculo:   classificacao.sugestoesVinculo     ?? null,
            observacoesIA:      classificacao.observacoesIA        ?? null,
            unidade,
            processado: true,
          };

          const [novo] = await db.insert(emailsCapturados).values(emailData)
            .returning({ id: emailsCapturados.id });

          if (novo && classificacao.tipoDemanda && classificacao.descricaoDemanda &&
            ["Demanda nova", "Pendência técnica", "Pendência administrativa", "Condicionante ambiental"]
              .includes(classificacao.categoriaPrincipal)) {
            await criarDemandaAutomatica(novo.id, classificacao, unidade).catch(() => {});
          }

          knownIds.add(msgId);
          capturados++;
        } catch (msgErr: any) {
          console.error("[EmailAutomação] Erro ao processar msg:", msgErr?.message ?? msgErr);
          erros++;
        }
      }
    }

    await db.update(emailContas).set({
      ultimaSincEm: new Date(),
      totalEmails: sql`${emailContas.totalEmails} + ${capturados}`,
    }).where(eq(emailContas.id, contaId));

    lock?.release();
    await client?.logout().catch(() => {});

  } catch (e: any) {
    lock?.release();
    await client?.logout().catch(() => {});
    const rawMsg = e?.message ?? String(e);
    const serverResp = e?.response ?? e?.serverResponse ?? e?.responseText ?? "";
    console.error(`[EmailAutomação] ERRO conta=${contaId}: ${rawMsg} | serverResponse: ${serverResp}`);
    const { msg: friendly, temporario } = categorizeImapError(rawMsg, String(serverResp));
    if (temporario) bloqueiarContaTemporariamente(contaId);
    console.error(`[EmailAutomação] MENSAGEM AMIGÁVEL: ${friendly} | temporario=${temporario}`);
    throw new Error(friendly);
  }

  return { capturados, erros };
}

async function criarDemandaAutomatica(emailId: number, classificacao: any, unidade: string) {
  const titulo = classificacao.descricaoDemanda?.slice(0, 200) || "Demanda identificada por e-mail";
  const nova = await db.insert(demandas).values({
    titulo,
    descricao: `Criado automaticamente por e-mail.\n\n${classificacao.resumo || ""}`,
    status: "pendente",
    prioridade: classificacao.prioridade === "alta" ? "alta" : classificacao.prioridade === "baixa" ? "baixa" : "media",
    prazo: classificacao.dataVencimento ? new Date(classificacao.dataVencimento) : null,
    unidade,
    criadoPor: null as any,
    responsavelId: null,
    empreendimentoId: classificacao.empreendimentoId || null,
    tipo: classificacao.tipoDemanda?.slice(0, 50) || "email",
  } as any).returning({ id: demandas.id }).catch(() => []);

  if (nova[0]) {
    await db.update(emailsCapturados).set({ demandaCriadaId: nova[0].id }).where(eq(emailsCapturados.id, emailId));
  }
}

export async function gerarRelatorioExecutivo(unidade: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const proximos7 = new Date(hoje);
  proximos7.setDate(proximos7.getDate() + 7);

  const [total, novas, validacao, semVinculo, semResponsavel, vencidas] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(emailsCapturados).where(eq(emailsCapturados.unidade, unidade)),
    db.select({ c: sql<number>`count(*)` }).from(emailsCapturados).where(and(eq(emailsCapturados.unidade, unidade), sql`${emailsCapturados.criadoEm} >= ${hoje}`)),
    db.select({ c: sql<number>`count(*)` }).from(emailsCapturados).where(and(eq(emailsCapturados.unidade, unidade), eq(emailsCapturados.precisaValidacao, true))),
    db.select({ c: sql<number>`count(*)` }).from(emailsCapturados).where(and(eq(emailsCapturados.unidade, unidade), eq(emailsCapturados.vinculoPendente, true))),
    db.select({ c: sql<number>`count(*)` }).from(emailsCapturados).where(and(eq(emailsCapturados.unidade, unidade), sql`${emailsCapturados.responsavelSugerido} IS NULL`)),
    db.select({ c: sql<number>`count(*)` }).from(emailsCapturados).where(and(eq(emailsCapturados.unidade, unidade), sql`${emailsCapturados.dataVencimento} < ${hoje} AND ${emailsCapturados.statusDemanda} NOT IN ('concluida', 'aprovada')`)),
  ]);

  return {
    totalEmails: Number(total[0]?.c || 0),
    emailsHoje: Number(novas[0]?.c || 0),
    precisamValidacao: Number(validacao[0]?.c || 0),
    semVinculo: Number(semVinculo[0]?.c || 0),
    semResponsavel: Number(semResponsavel[0]?.c || 0),
    vencidas: Number(vencidas[0]?.c || 0),
    geradoEm: new Date().toISOString(),
  };
}
