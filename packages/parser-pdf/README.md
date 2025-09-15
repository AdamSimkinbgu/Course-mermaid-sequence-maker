PDF Parser (packages/parser-pdf)

Purpose
- OCR + extraction + AI-assisted parsing of prerequisites for Phase 2.

Pipeline
- OCR (Tesseract.js default; optional cloud OCR)
- Block/line detection; course code/name recognition
- Prerequisite text extraction; normalization
- AI-assisted transform to expression grammar; confidence and ambiguity reporting

Interfaces
- ocr(pdf) → text blocks
- extract(text) → structured candidates
- transform(candidates) → expressions with diagnostics
