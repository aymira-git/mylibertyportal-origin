import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportTableCSV } from "./csvExport.js";

let blob;
let link;

beforeEach(() => {
  blob = null;
  link = { click: vi.fn() };
  vi.stubGlobal("document", {
    createElement: vi.fn(() => link),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  });
  vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
    blob = b;
    return "blob:fake";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

// Returns the file's text WITHOUT its BOM, plus whether a BOM was present.
async function read() {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  return { hasBom, text: new TextDecoder().decode(hasBom ? bytes.slice(3) : bytes) };
}

describe("exportTableCSV", () => {
  it("writes headers and rows separated by CRLF, with a UTF-8 BOM for Excel", async () => {
    exportTableCSV("roster", ["Name", "Level"], [["Budi", "warrior"], ["Ani", "elite"]]);
    const { hasBom, text } = await read();
    expect(hasBom).toBe(true);
    expect(text).toBe("Name,Level\r\nBudi,warrior\r\nAni,elite");
  });

  it("quotes cells that contain commas, quotes or line breaks", async () => {
    exportTableCSV("x", ["A", "B", "C"], [["Santoso, Budi", 'He said "hi"', "line1\nline2"]]);
    expect((await read()).text).toBe('A,B,C\r\n"Santoso, Budi","He said ""hi""","line1\nline2"');
  });

  it("writes empty cells for null and undefined, and keeps zero", async () => {
    exportTableCSV("x", ["A", "B", "C"], [[null, undefined, 0]]);
    expect((await read()).text).toBe("A,B,C\r\n,,0");
  });

  it("keeps accented names and emoji intact", async () => {
    exportTableCSV("x", ["Name"], [["José Núñez 🎓"]]);
    expect((await read()).text).toContain("José Núñez 🎓");
  });

  it("adds .csv to the filename only when it is missing", () => {
    exportTableCSV("roster", ["A"], []);
    expect(link.download).toBe("roster.csv");
    exportTableCSV("roster.csv", ["A"], []);
    expect(link.download).toBe("roster.csv");
  });

  it("clicks the link, then cleans up", () => {
    exportTableCSV("r", ["A"], []);
    expect(link.click).toHaveBeenCalledOnce();
    expect(document.body.removeChild).toHaveBeenCalledWith(link);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  // Open to debate: names come from a public registration form. A name that
  // starts with "=" is run as a formula when the CSV is opened in Excel/Sheets.
  // A common defence is to prefix such cells with an apostrophe.
  it.fails("does not let a cell that starts with '=' become a spreadsheet formula", async () => {
    exportTableCSV("x", ["Name"], [["=1+1"]]);
    const { text } = await read();
    expect(text.split("\r\n")[1].startsWith("=")).toBe(false);
  });
});
