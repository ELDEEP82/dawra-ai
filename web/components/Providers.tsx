"use client";
import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { LangProvider } from "@/lib/i18n";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LangProvider>{children}</LangProvider>
    </MotionConfig>
  );
}
