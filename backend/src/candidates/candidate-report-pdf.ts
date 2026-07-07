type PdfLine = {
  text: string;
  size?: number;
  gapBefore?: number;
};

const pageWidth = 595;
const pageHeight = 842;
const margin = 48;
const lineHeight = 15;

export function buildCandidateReportPdf(lines: PdfLine[]) {
  const pages: PdfLine[][] = [[]];
  let y = pageHeight - margin;

  for (const line of lines) {
    const needed = (line.gapBefore ?? 0) + (line.size && line.size >= 14 ? 22 : lineHeight);
    if (y - needed < margin) {
      pages.push([]);
      y = pageHeight - margin;
    }
    pages[pages.length - 1].push(line);
    y -= needed;
  }

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const fontObjectId = 3;

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[fontObjectId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  for (const page of pages) {
    const pageObjectId = objects.length;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);
    objects[pageObjectId] = '';
    objects[contentObjectId] = buildPageContent(page);
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

  pageObjectIds.forEach((pageObjectId, index) => {
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`;
  });

  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(chunks.join(''), 'latin1');
    chunks.push(`${id} 0 obj\n${objects[id]}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(''), 'latin1');
  chunks.push(`xref\n0 ${objects.length}\n`);
  chunks.push('0000000000 65535 f \n');
  for (let id = 1; id < objects.length; id++) {
    chunks.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return Buffer.from(chunks.join(''), 'latin1');
}

export function pdfHeading(text: string): PdfLine {
  return { text, size: 18, gapBefore: 0 };
}

export function pdfSection(text: string): PdfLine {
  return { text, size: 13, gapBefore: 14 };
}

export function pdfWrapped(text: string, prefix = ''): PdfLine[] {
  return wrap(`${prefix}${text}`, 92).map((line) => ({ text: line, size: 10 }));
}

function buildPageContent(lines: PdfLine[]) {
  const commands: string[] = [];
  let y = pageHeight - margin;

  for (const line of lines) {
    y -= line.gapBefore ?? 0;
    const size = line.size ?? 10;
    commands.push(`BT /F1 ${size} Tf ${margin} ${y} Td (${escapePdfText(line.text)}) Tj ET`);
    y -= size >= 14 ? 22 : lineHeight;
  }

  const stream = commands.join('\n');
  return `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
}

function wrap(value: string, maxLength: number) {
  const words = sanitize(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['N/A'];
}

function sanitize(value: string) {
  return String(value ?? 'N/A')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

function escapePdfText(value: string) {
  return sanitize(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
