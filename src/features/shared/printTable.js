// Opens a new window with a clean, print-friendly HTML table and
// triggers the browser print dialog. Used by StudentRoster and
// ClassManager so printed output isn't cluttered with app chrome,
// buttons, or the dashboard's Tailwind styles.
//
// This is a plain utility (not a component), so it can't call the
// app's useToast() hook directly. Pass the caller's toast function
// as onBlocked so the "please allow pop-ups" message still uses the
// styled toast instead of a native alert(); if omitted, it falls
// back to a native alert so the message still reaches the user.
export function printTable(title, headers, rows, onBlocked) {
  const win = window.open("", "_blank", "width=1000,height=700");
  if (!win) {
    if (onBlocked) onBlocked("Please allow pop-ups to print.", "error");
    else alert("Please allow pop-ups to print.");
    return;
  }

  const escapeHtml = (val) =>
    String(val ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]
    );

  const headerRow = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1e293b; }
          h1 { font-size: 18px; margin: 0 0 4px; }
          .meta { font-size: 11px; color: #64748b; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; }
          tr:nth-child(even) { background: #f8fafc; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Printed ${new Date().toLocaleString()}</div>
        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  // Give the new document a tick to finish rendering before printing.
  setTimeout(() => win.print(), 250);
}
