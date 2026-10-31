/**
 * Inject admin-configured head/footer HTML (scripts, meta, pixels) once per page.
 * Scripts inserted via innerHTML do not run — we recreate <script> nodes.
 */

const MARK = "data-sparkpay-site-code";

function isSafeSnippet(html: string): boolean {
  const lower = html.toLowerCase();
  // Block obvious XSS vectors from mis-paste; allow normal third-party tags.
  if (lower.includes("javascript:")) return false;
  if (/\bon\w+\s*=/.test(lower)) return false;
  return true;
}

function appendNodes(target: ParentNode, html: string, where: "head" | "footer") {
  if (!html.trim() || !isSafeSnippet(html)) return;

  const wrap = document.createElement("div");
  wrap.innerHTML = html;

  const nodes = Array.from(wrap.childNodes);
  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SCRIPT") {
      const srcScript = node as HTMLScriptElement;
      const script = document.createElement("script");
      for (const attr of Array.from(srcScript.attributes)) {
        if (attr.name.toLowerCase().startsWith("on")) continue;
        script.setAttribute(attr.name, attr.value);
      }
      if (srcScript.textContent) script.textContent = srcScript.textContent;
      script.setAttribute(MARK, where);
      target.appendChild(script);
    } else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        (node as Element).setAttribute(MARK, where);
      }
      target.appendChild(node);
    }
  }
}

export function injectSiteCodes(input: { headCode?: string | null; footerCode?: string | null }) {
  if (typeof document === "undefined") return;

  // Avoid double-inject on client navigation
  document.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove());

  const head = input.headCode?.trim();
  const foot = input.footerCode?.trim();
  if (head) appendNodes(document.head, head, "head");
  if (foot) appendNodes(document.body, foot, "footer");
}
