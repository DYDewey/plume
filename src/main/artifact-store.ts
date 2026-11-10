import { randomUUID } from 'node:crypto';

/** Pages d'artefacts en mémoire (les plus récentes seulement), servies par le protocole artifact://. */
export function createArtifactStore(max = 50) {
  const pages = new Map<string, string>();
  return {
    /** Garde la page et renvoie son adresse. */
    put(html: string): string {
      const id = randomUUID();
      pages.set(id, html);
      while (pages.size > max) pages.delete(pages.keys().next().value as string);
      return `artifact://view/${id}`;
    },
    /** Page d'une adresse artifact://view/<id>, ou undefined. */
    get(url: string): string | undefined {
      const m = /^artifact:\/\/view\/([0-9a-f-]{36})\/?$/i.exec(url);
      return m ? pages.get(m[1]) : undefined;
    },
  };
}
