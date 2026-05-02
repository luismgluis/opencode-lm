import { Flag } from "@opencode-ai/core/flag/flag"
import { Hono } from "hono"
import { proxy } from "hono/proxy"
import { getMimeType } from "hono/utils/mime"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"

const embeddedUIPromise = Flag.OPENCODE_DISABLE_EMBEDDED_WEB_UI
  ? Promise.resolve(null)
  : // @ts-expect-error - generated file at build time
    import("opencode-web-ui.gen.ts").then((module) => module.default as Record<string, string>).catch(() => null)

const DEFAULT_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' data:; connect-src 'self' data:"

const csp = (hash = "") =>
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'${hash ? ` 'sha256-${hash}'` : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' data:; connect-src 'self' data:`

const OC_AUTH_BAR = `<!-- oc-auth -->
<style>
  #ocAuthBtn {
    position:fixed; bottom:12px; left:12px; z-index:99999;
    width:32px; height:32px; border-radius:8px;
    border:1px solid #30363d;
    display:none; align-items:center; justify-content:center;
    cursor:pointer; font-family:inherit;
    font-size:11px; font-weight:600; text-transform:uppercase;
    color:#c9d1d9; background:#161b22;
    transition:border-color .15s;
  }
  #ocAuthBtn:hover { border-color:#58a6ff; }
  #ocAuthMenu {
    position:fixed; bottom:52px; left:12px; z-index:99999;
    display:none; flex-direction:column; gap:0;
    min-width:160px;
    background:#161b22; border:1px solid #30363d;
    border-radius:8px; padding:4px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    font-size:13px; box-shadow:0 8px 24px rgba(0,0,0,0.4);
  }
  #ocAuthMenu a {
    display:flex; align-items:center; gap:8px;
    padding:8px 12px; border-radius:6px;
    color:#c9d1d9; text-decoration:none; transition:background .1s;
  }
  #ocAuthMenu a:hover { background:#21262d; }
  #ocAuthMenu .oc-label { color:#8b949e; font-size:11px; padding:4px 12px; }
  #ocAuthMenu .oc-danger { color:#f85149; }
  #ocAuthMenu hr { border:none; border-top:1px solid #21262d; margin:4px 0; }
</style>
<div id="ocAuthBtn" title="Account">U</div>
<div id="ocAuthMenu">
  <div class="oc-label" id="ocAuthName">Account</div>
  <a href="/auth/portal" target="_top">\u2699 Settings</a>
  <hr>
  <a href="/auth/logout" target="_top" class="oc-danger">\u2192 Logout</a>
</div>
<script>
(function(){
  var btn=document.getElementById('ocAuthBtn'),menu=document.getElementById('ocAuthMenu');
  btn.onclick=function(){menu.style.display=menu.style.display==='flex'?'none':'flex'};
  document.addEventListener('click',function(e){if(e.target!==btn&&!menu.contains(e.target))menu.style.display='none'});
  var x=new XMLHttpRequest();
  x.open('GET','/auth/session',false);
  x.withCredentials=true;
  x.send();
  if(x.status===200){var d=JSON.parse(x.responseText);if(d&&d.user){
    var n=d.user.username;btn.textContent=n.charAt(0).toUpperCase();btn.title=n;
    document.getElementById('ocAuthName').textContent=n;
    btn.style.display='flex';
  }}
})();
</script>`

function injectAuthBar(html: string): string {
  return html.replace("</body>", OC_AUTH_BAR + "\n</body>")
}

export const UIRoutes = (): Hono =>
  new Hono().all("/*", async (c) => {
    const embeddedWebUI = await embeddedUIPromise
    const path = c.req.path

    if (embeddedWebUI) {
      const match = embeddedWebUI[path.replace(/^\//, "")] ?? embeddedWebUI["index.html"] ?? null
      if (!match) return c.json({ error: "Not Found" }, 404)

      if (await fs.exists(match)) {
        const mime = getMimeType(match) ?? "text/plain"
        c.header("Content-Type", mime)
        if (mime.startsWith("text/html")) {
          const content = await fs.readFile(match, "utf-8")
          c.header("Content-Security-Policy", DEFAULT_CSP)
          return c.body(injectAuthBar(content))
        }
        return c.body(new Uint8Array(await fs.readFile(match)))
      } else {
        return c.json({ error: "Not Found" }, 404)
      }
    } else {
      const response = await proxy(`https://app.opencode.ai${path}`, {
        raw: c.req.raw,
        headers: {
          ...Object.fromEntries(c.req.raw.headers.entries()),
          host: "app.opencode.ai",
        },
      })
      const isHtml = response.headers.get("content-type")?.includes("text/html")
      if (isHtml) {
        const text = await response.clone().text()
        const match = text.match(
          /<script\b(?![^>]*\bsrc\s*=)[^>]*\bid=(['"])oc-theme-preload-script\1[^>]*>([\s\S]*?)<\/script>/i,
        )
        const hash = match ? createHash("sha256").update(match[2]).digest("base64") : ""
        response.headers.set("Content-Security-Policy", csp(hash))
        return c.body(injectAuthBar(text))
      }
      return response
    }
  })
