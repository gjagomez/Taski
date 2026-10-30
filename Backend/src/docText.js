// Extrae el contenido de un archivo de evidencia para que la IA pueda analizarlo.
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { one } from './db/pool.js';

// Gemma está cargado con 4096 tokens de contexto: se envía solo una porción del documento
export const DOC_CHAR_LIMIT = Number(process.env.AI_DOC_CHARS || 6500);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TEXT_EXT = ['txt', 'md', 'csv', 'json', 'xml', 'sql', 'log', 'html', 'yml', 'yaml'];
const cache = new Map(); // los archivos no cambian una vez subidos

/**
 * Devuelve { kind: 'text', text, truncated, pages } o { kind: 'image', dataUrl }.
 * Lanza un error con mensaje claro si el tipo no se puede analizar.
 */
export async function documentContent(fileId) {
  if (cache.has(fileId)) return cache.get(fileId);
  const file = await one('SELECT id, item_id, name, mime_type, data FROM ws_item_files WHERE id = ?', [fileId]);
  if (!file) throw new Error('El archivo no existe');
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  let result;

  if (ext === 'pdf' || file.mime_type === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(file.data));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    result = textResult(text, totalPages);
    if (!result.text) throw new Error('El PDF no tiene texto seleccionable (parece escaneado). Sube una versión con texto o una imagen.');
  } else if (ext === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer: file.data });
    result = textResult(value, null);
  } else if (TEXT_EXT.includes(ext) || file.mime_type.startsWith('text/')) {
    result = textResult(file.data.toString('utf8'), null);
  } else if (file.mime_type.startsWith('image/')) {
    if (file.data.length > MAX_IMAGE_BYTES) throw new Error('La imagen es demasiado grande para analizarla (máx. 5 MB).');
    result = { kind: 'image', dataUrl: `data:${file.mime_type};base64,${file.data.toString('base64')}` };
  } else {
    throw new Error(`La IA todavía no puede leer archivos .${ext || 'desconocidos'}. Usa PDF, Word (.docx), texto o imagen.`);
  }

  result = { ...result, name: file.name, itemId: file.item_id };
  cache.set(fileId, result);
  return result;
}

function textResult(raw, pages) {
  const text = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return {
    kind: 'text',
    text: text.slice(0, DOC_CHAR_LIMIT),
    truncated: text.length > DOC_CHAR_LIMIT,
    totalChars: text.length,
    pages,
  };
}

/** Contenido del documento listo para un mensaje de usuario (texto o imagen + texto). */
export function documentMessage(doc, instruction) {
  if (doc.kind === 'image') {
    return {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: doc.dataUrl } },
        { type: 'text', text: `Imagen adjunta: "${doc.name}".\n${instruction}` },
      ],
    };
  }
  const note = doc.truncated ? `\n[Documento recortado: se incluyen los primeros ${DOC_CHAR_LIMIT} de ${doc.totalChars} caracteres]` : '';
  return {
    role: 'user',
    content: `DOCUMENTO "${doc.name}"${doc.pages ? ` (${doc.pages} página(s))` : ''}:${note}\n"""\n${doc.text}\n"""\n\n${instruction}`,
  };
}
