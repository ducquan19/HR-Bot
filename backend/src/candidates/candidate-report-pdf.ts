type PdfLine = {
  text: string;
  size?: number;
  gapBefore?: number;
  bold?: boolean;
  indent?: number;
  bullet?: boolean;
};

const pageWidth = 595;
const pageHeight = 842;
const margin = 48;
const lineHeight = 15;
const bodyWrapLength = 116;
const bulletWrapLength = 110;

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
  const boldFontObjectId = 4;

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[fontObjectId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[boldFontObjectId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

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
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`;
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
  return { text, size: 18, gapBefore: 0, bold: true };
}

export function pdfSection(text: string): PdfLine {
  return { text, size: 13, gapBefore: 16, bold: true };
}

export function pdfWrapped(text: string, prefix = ''): PdfLine[] {
  return wrap(`${prefix}${text}`, bodyWrapLength).map((line) => ({ text: line, size: 10 }));
}

export function pdfField(label: string, value: unknown): PdfLine[] {
  return wrap(`${label}: ${formatValue(value)}`, bodyWrapLength).map((line, index) => ({
    text: line,
    size: 10,
    bold: index === 0,
  }));
}

export function pdfParagraph(text: string): PdfLine[] {
  return wrap(text, bodyWrapLength).map((line) => ({ text: line, size: 10 }));
}

export function pdfBullets(items: unknown[], emptyText: string): PdfLine[] {
  const values = items.map(formatValue).filter((value) => value && value !== 'N/A');
  if (!values.length) return pdfParagraph(emptyText);

  return values.flatMap((value) => wrap(value, bulletWrapLength).map((line, index) => ({
    text: index === 0 ? `- ${line}` : line,
    size: 10,
    indent: index === 0 ? 0 : 12,
    bullet: index === 0,
  })));
}

function buildPageContent(lines: PdfLine[]) {
  const commands: string[] = [];
  let y = pageHeight - margin;

  for (const line of lines) {
    y -= line.gapBefore ?? 0;
    const size = line.size ?? 10;
    const font = line.bold ? 'F2' : 'F1';
    const x = margin + (line.indent ?? 0);
    commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(line.text)}) Tj ET`);
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

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === '') return 'N/A';
  return String(value);
}

function escapePdfText(value: string) {
  return sanitize(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
