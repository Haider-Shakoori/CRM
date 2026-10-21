import { describe, expect, it } from 'vitest';
import { createSafeCsv, parseCrmCsv } from './crmCsv';

describe('safe CRM CSV parsing and rendering', () => {
  it('parses RFC-style quoted commas, newlines, CRLF and doubled quotes', () => {
    const rows = parseCrmCsv('name,email,notes\r\n"Amina, Khan",amina@example.test,"Spoke ""today""\nFollow-up"\r\n', 'leads');
    expect(rows).toEqual([{
      name: 'Amina, Khan', email: 'amina@example.test', notes: 'Spoke "today"\nFollow-up',
    }]);
  });

  it('rejects spoofed columns, duplicate headings, missing required columns and malformed CSV', () => {
    expect(() => parseCrmCsv('name,organization_id\nAmina,foreign', 'leads')).toThrow('Headers');
    expect(() => parseCrmCsv('name,name\nAmina,Amina', 'leads')).toThrow('Headers');
    expect(() => parseCrmCsv('email\na@example.test', 'leads')).toThrow('Required');
    expect(() => parseCrmCsv('name,notes\nAmina,"unclosed', 'leads')).toThrow('Unterminated');
    expect(() => parseCrmCsv('name,email\nAmina', 'leads')).toThrow('columns');
    expect(() => parseCrmCsv('first_name,last_name\nAmina,Khan', 'contacts')).not.toThrow();
  });

  it('limits import size and count before making a server request', () => {
    expect(() => parseCrmCsv('name\n' + 'A\n'.repeat(101), 'leads')).toThrow('100');
    expect(() => parseCrmCsv('name\n' + 'X'.repeat(256001), 'leads')).toThrow('256 KB');
  });

  it('quotes all output and neutralizes formula-execution prefixes', () => {
    const csv = createSafeCsv(['name', 'notes'], [
      { name: '=HYPERLINK("evil")', notes: '+42' },
      { name: '@SUM(A1)', notes: ' hi' },
      { name: 'Regular', notes: '-10' },
      { name: 'Business', notes: 'line1\nline2' },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
    expect(csv).toContain('"\'+42"');
    expect(csv).toContain('"\'@SUM(A1)"');
    expect(csv).toContain('"\'-10"');
    expect(csv).toContain('"line1\nline2"');
  });
});
