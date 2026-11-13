"use client";
import { GLOSSARY, useLang } from "@/lib/i18n";

export function Glossary() {
  const { lang } = useLang();
  const other = lang === "ar" ? "en" : "ar";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {GLOSSARY.map((g) => (
        <details key={g.term.en} className="card group p-4 open:bg-white/[0.06]">
          <summary className="cursor-pointer list-none font-medium">
            <span className="me-2 text-nasa-cyan group-open:rotate-90">›</span>
            {g.term[lang]}
            <span className="mt-0.5 block ps-5 text-xs font-normal text-slate-500" dir={other === "ar" ? "rtl" : "ltr"}>
              {g.term[other]}
            </span>
          </summary>
          <p className="mt-2 text-sm text-slate-300">{g.def[lang]}</p>
        </details>
      ))}
    </div>
  );
}
