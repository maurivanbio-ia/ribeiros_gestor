import test from "node:test";
import assert from "node:assert";
import { gerarNomeAbnt } from "../services/dropboxService";

test("gerarNomeAbnt - should correctly format ABNT file name", () => {
  const codigo = "PRJ-001";
  const tipo = "Relatorio";
  const nomeOriginal = "Licenciamento_V3.pdf";
  
  const nomeAbnt = gerarNomeAbnt(codigo, tipo, nomeOriginal);
  
  // Format check: ECB-[CODIGO]-[TIPO]-[YYYYMMDD]-[ORIGINAL]
  assert.ok(nomeAbnt.startsWith("ECB-PRJ_001-RELATORIO-"), "Should start with prefix and normalized inputs");
  assert.ok(nomeAbnt.endsWith("-LICENCIAMENTO_V3.pdf"), "Should end with normalized base name and extension");
  
  // Check date presence (8 digits)
  const matches = nomeAbnt.match(/\d{8}/);
  assert.ok(matches, "Should contain an 8-digit date string");
});

test("gerarNomeAbnt - should handle special characters and accents in project codes and names", () => {
  const codigo = "Ação Ambiental";
  const tipo = "Licença";
  const nomeOriginal = "Relatório Técnico Final.docx";
  
  const nomeAbnt = gerarNomeAbnt(codigo, tipo, nomeOriginal);
  
  // Should normalize accents and characters to uppercase and underscores
  assert.ok(nomeAbnt.startsWith("ECB-ACAO_AMBIENTAL-LICENCA-"), "Should sanitize and normalize characters");
  assert.ok(nomeAbnt.endsWith("-RELATORIO_TECNICO_FINAL.docx"), "Should sanitize file name and preserve extension");
});
