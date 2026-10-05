// One CSV cell, quoted. Cells starting with = + - @ (or tab/CR) are prefixed
// with an apostrophe so spreadsheet apps show them as text instead of running
// them as formulas — lead names and notes come from public forms, so an
// "=HYPERLINK(...)" name must not execute when an export is opened in Excel.
// (Phone numbers like "+91 …" also stop being misread as formulas.)
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
