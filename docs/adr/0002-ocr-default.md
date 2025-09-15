ADR 0002: OCR Default for PDF Import

Context
- PDFs vary widely; many are scanned. Privacy is a concern.

Decision
- Default to on-device OCR via Tesseract.js. Offer optional cloud OCR (e.g., Google Vision, AWS Textract) with explicit user opt-in.

Consequences
- No external data transfer by default; slower performance on large PDFs but acceptable for initial scope.
