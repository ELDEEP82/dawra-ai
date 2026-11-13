"use client";
import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { LangProvider } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export function Providers({ children, lang }: { children: ReactNode; lang: Lang }) {
  return (
    <MotionConfig reducedMotion="user">
      <LangProvider lang={lang}>{children}</LangProvider>
    </MotionConfig>
  );
}
