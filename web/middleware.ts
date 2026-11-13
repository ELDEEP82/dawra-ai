import { NextResponse, type NextRequest } from "next/server";

/**
 * Resolve the language on the server so the first byte already has the right <html lang dir>:
 * ?lang= → `lang` cookie → Accept-Language → English. Rewrites "/x" to the prerendered "/{lang}/x".
 */
const LANGS = ["en", "ar"] as const;
type Lang = (typeof LANGS)[number];

function pick(req: NextRequest): Lang {
  const q = req.nextUrl.searchParams.get("lang");
  if (q === "en" || q === "ar") return q;
  const c = req.cookies.get("lang")?.value;
  if (c === "en" || c === "ar") return c;
  const al = req.headers.get("accept-language") ?? "";
  return /^\s*ar\b/i.test(al) ? "ar" : "en";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LANGS.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return NextResponse.next();
  const lang = pick(req);
  const url = req.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  const res = NextResponse.rewrite(url);
  const q = req.nextUrl.searchParams.get("lang");
  if ((q === "en" || q === "ar") && req.cookies.get("lang")?.value !== q) {
    res.cookies.set("lang", q, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  res.headers.set("Vary", "Cookie, Accept-Language");
  return res;
}

export const config = {
  // everything except Next internals, static data and files with an extension
  matcher: ["/((?!_next|data|textures|api|.*\\.[a-zA-Z0-9]+$).*)"],
};
