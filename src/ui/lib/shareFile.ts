export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Salva un file di backup: foglio di condivisione (File/iCloud Drive) se supportato, altrimenti download.
 * Va chiamata DIRETTAMENTE dal tap con il file già pronto: Safari richiede l'attivazione utente.
 */
export async function saveFile(file: File): Promise<SaveResult> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // altri errori (es. NotAllowedError): ripiega sul download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
