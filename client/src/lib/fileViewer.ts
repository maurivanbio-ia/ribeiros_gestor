/**
 * Abre um arquivo via fetch com credentials para evitar que erros do servidor
 * sejam exibidos como JSON bruto no navegador.
 * Se o servidor retornar erro, exibe alert amigável em vez de JSON.
 */
export async function openFileUrl(
  url: string,
  filename?: string,
): Promise<void> {
  try {
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) {
      let msg = "Arquivo temporariamente indisponível. Tente novamente em alguns segundos.";
      try {
        const json = await resp.json();
        if (json?.message) msg = json.message;
        else if (json?.error) msg = json.error;
      } catch (_) {}
      alert(msg);
      return;
    }
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    alert("Erro ao abrir o arquivo. Verifique sua conexão e tente novamente.");
  }
}
