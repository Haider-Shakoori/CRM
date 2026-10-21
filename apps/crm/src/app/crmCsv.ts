export type ImportEntity = 'leads' | 'contacts' | 'accounts';

export const importHeaders: Record<ImportEntity, readonly string[]> = {
  leads: ['name', 'email', 'status', 'notes'],
  contacts: ['first_name', 'last_name', 'email', 'phone', 'job_title', 'notes', 'account_id'],
  accounts: ['name', 'website', 'phone', 'industry', 'notes'],
};

export class CsvValidationError extends Error {}

/**
 * Strict RFC-4180-style CSV parser: quotes and doubled quotes are supported.
 * Limits are small to bound memory, validation and single-transaction imports.
 */
export function parseCrmCsv(input: string, entity: ImportEntity): Array<Record<string, string>> {
  if (input.length > 256_000) throw new CsvValidationError('File exceeds the 256 KB import limit.');
  const source = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let afterQuote = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else cell += ch;
      continue;
    }
    if (afterQuote && ![',', '\n', '\r'].includes(ch)) {
      throw new CsvValidationError('Invalid characters after a closing quote.');
    }
    if (ch === '"') {
      if (cell.length) throw new CsvValidationError('Unexpected quote within an unquoted value.');
      quoted = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell); cell = ''; afterQuote = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = []; cell = ''; afterQuote = false;
    } else { cell += ch; }
  }
  if (quoted) throw new CsvValidationError('Unterminated quoted CSV value.');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) throw new CsvValidationError('CSV must contain a header and at least one data row.');
  const headers = rows[0]!.map((field) => field.trim());
  const allowed = importHeaders[entity];
  if (!headers.every((header) => allowed.includes(header)) || new Set(headers).size !== headers.length ||
      !headers.every(Boolean)) {
    throw new CsvValidationError('Headers must be unique and supported CRM fields: ' + allowed.join(', '));
  }
  const required = entity === 'contacts' ? ['first_name', 'last_name'] : ['name'];
  if (!required.every((header) => headers.includes(header))) {
    throw new CsvValidationError('Required header columns: ' + required.join(', '));
  }
  const data = rows.slice(1).filter((entry) => entry.some((value) => value.trim() !== ''));
  if (data.length === 0 || data.length > 100) {
    throw new CsvValidationError('Upload between 1 and 100 nonblank rows at a time.');
  }
  return data.map((values, index) => {
    if (values.length !== headers.length) {
      throw new CsvValidationError('Row ' + (index + 2) + ' has ' + values.length + ' columns; expected ' + headers.length + '.');
    }
    return Object.fromEntries(headers.map((header, pos) => [header, values[pos]!.trim()]));
  });
}

/**
 * Every exported cell is wrapped/escaped. Prefix spreadsheet formula
 * triggers with a literal apostrophe so downloaded CRM data stays data.
 */
export function createSafeCsv(columns: string[], records: Array<Record<string, unknown>>): string {
  const quote = (value: unknown) => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return [columns.map(quote).join(','),
    ...records.map((record) => columns.map((column) => quote(record[column])).join(','))].join('\r\n') + '\r\n';
}
