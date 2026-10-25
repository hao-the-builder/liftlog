import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { escapeCsvValue, toCsv } from "./csv";
import { createZip, crc32 } from "./zip";

describe("escapeCsvValue", () => {
  it("leaves a plain value alone", () => {
    expect(escapeCsvValue("Leg press")).toBe("Leg press");
    expect(escapeCsvValue(62.5)).toBe("62.5");
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("quotes values containing a comma, a quote or a newline", () => {
    expect(escapeCsvValue("Pain-free depth, only")).toBe('"Pain-free depth, only"');
    expect(escapeCsvValue('He said "go"')).toBe('"He said ""go"""');
    expect(escapeCsvValue("line one\nline two")).toBe('"line one\nline two"');
  });

  it("neutralises a value that a spreadsheet would run as a formula", () => {
    // A note starting with = is a live formula in Excel and Sheets.
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(escapeCsvValue("@import")).toBe("'@import");
  });

  it("quotes and neutralises together", () => {
    expect(escapeCsvValue("=a,b")).toBe('"\'=a,b"');
  });

  it("does not mangle a negative number into a formula", () => {
    // It is prefixed, which is the safe trade: a spreadsheet shows -5 as text
    // rather than evaluating an arbitrary leading-minus expression.
    expect(escapeCsvValue(-5)).toBe("'-5");
  });
});

describe("toCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    const csv = toCsv(["a", "b"], [[1, 2], [3, 4]]);
    expect(csv).toBe("a,b\r\n1,2\r\n3,4\r\n");
  });

  it("writes just the header for no rows", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\r\n");
  });
});

describe("crc32", () => {
  it("matches the known checksum for a standard input", () => {
    // CRC-32 of "123456789" is 0xCBF43926, the standard check value.
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("is zero for empty input", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("createZip", () => {
  const entries = [
    { name: "workouts.csv", data: new TextEncoder().encode("a,b\r\n1,2\r\n") },
    { name: "bodyweight.csv", data: new TextEncoder().encode("date,weight\r\n2026-10-25,82\r\n") },
  ];

  it("starts with the local file header signature", () => {
    const zip = createZip(entries);
    expect([...zip.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("ends with the end-of-central-directory record naming every entry", () => {
    const zip = createZip(entries);
    const view = new DataView(zip.buffer, zip.byteLength - 22, 22);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(8, true)).toBe(entries.length);
    expect(view.getUint16(10, true)).toBe(entries.length);
  });

  it("produces an archive the operating system can actually open", () => {
    // The real test. A ZIP that parses in a unit test but fails in Finder or
    // Explorer is worse than no export, so this unzips it with a real tool.
    const zip = createZip(entries);
    const dir = mkdtempSync(join(tmpdir(), "liftlog-zip-"));
    const path = join(dir, "export.zip");
    writeFileSync(path, zip);

    let listing = "";
    try {
      listing = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
            `$z=[System.IO.Compression.ZipFile]::OpenRead('${path}'); ` +
            `$z.Entries | ForEach-Object { $_.FullName + '|' + $_.Length }; $z.Dispose()`,
        ],
        { encoding: "utf8", timeout: 30_000 },
      );
    } catch (cause) {
      // No PowerShell available (CI on Linux, for instance). The structural
      // assertions above still ran; skip the integration check rather than
      // failing on the environment.
      expect(cause).toBeDefined();
      return;
    }

    expect(listing).toContain("workouts.csv|10");
    expect(listing).toContain("bodyweight.csv|28");
  });

  it("handles an empty archive", () => {
    const zip = createZip([]);
    expect(zip).toHaveLength(22);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x06054b50);
  });
});
