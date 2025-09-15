// Placeholder interfaces for Phase 2 PDF parsing
export interface OcrResult { text: string }
export interface ExtractionCandidate { courseId: string; title?: string; prereqText?: string }

export async function ocr(_pdf: ArrayBuffer): Promise<OcrResult> {
  return { text: '' };
}

export function extract(_ocr: OcrResult): ExtractionCandidate[] {
  return [];
}

export function transform(_candidates: ExtractionCandidate[]) {
  return { expressions: [], diagnostics: [] as string[] };
}
