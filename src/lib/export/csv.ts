/**
 * CSV generation.
 *
 * Two things that are easy to get wrong and painful to discover later:
 * quoting, and formula injection. A set note of `=cmd|' /c calc'!A1` is a
 * live formula when the export is opened in Excel or Sheets, so any value
 * starting with a formula trigger is prefixed with an apostrophe, which the
 * spreadsheet strips on display and treats as text.
 */

const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (FORMULA_TRIGGERS.some((trigger) => text.startsWith(trigger))) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(","));
  }
  // CRLF is what RFC 4180 specifies and what Excel expects.
  return `${lines.join("\r\n")}\r\n`;
}
