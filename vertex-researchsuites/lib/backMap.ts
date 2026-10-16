const QUANT = ["response-rate","cross-checks","columns","reliability","analysis","sections","cleaning","results"];
const QUAL = ["review","theming","code-review","analysis-type","results"];
const PILOT = ["columns","cleaning","results"];
const AFTER_RESULTS = ["chapter5","defense-prep"];

function chain(base: string, list: string[], seg: string[]): string {
  const id = seg[1];
  const step = seg[2];
  if (!id) return "/dashboard";
  if (!step) return base;
  if (AFTER_RESULTS.includes(step)) return base + "/" + id + "/results";
  const i = list.indexOf(step);
  if (i > 0) return base + "/" + id + "/" + list[i - 1];
  return base;
}

export function backTarget(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/dashboard") return null;
  const seg = p.split("/").filter(Boolean);
  const root = seg[0];
  if (root === "quantitative-analysis") {
    if (seg[1] === "pricing") return "/dashboard";
    return seg.length === 1 ? "/quantitative-analysis/pricing" : chain("/quantitative-analysis", QUANT, seg);
  }
  if (root === "qualitative-analysis") {
    return seg.length === 1 ? "/dashboard" : chain("/qualitative-analysis", QUAL, seg);
  }
  if (root === "pilot-study") {
    if (seg.length === 1) return "/dashboard";
    if (seg[2] === "upsell") return "/pilot-study/" + seg[1] + "/results";
    return chain("/pilot-study", PILOT, seg);
  }
  if (root === "writing-check" && seg[1] === "results") return "/writing-check";
  if (root === "receipt") return "/purchases";
  return "/dashboard";
}
