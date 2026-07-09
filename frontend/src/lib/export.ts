const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700&family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:wght@500;700;900&family=Source+Serif+4:wght@400;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">';

const RESET_CSS =
  '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
  'html,body{height:100%;}' +
  "body{font-family:'DM Sans',Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
  '-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}' +
  'img{max-width:100%;display:block;}' +
  'a{color:inherit;text-decoration:none;}';

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Wrap body HTML into a full standalone document for export. */
export function wrapHtmlForExport(body: string, title: string = "Page"): string {
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    `<title>${escapeHtml(title)}</title>\n` +
    `${FONT_LINK}\n` +
    `<style>${RESET_CSS}</style>\n` +
    "</head>\n" +
    "<body>\n" +
    `${body}\n` +
    "</body>\n" +
    "</html>\n"
  );
}
