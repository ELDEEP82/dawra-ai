"use client";
/** Consistent crop icons (lucide) coloured by crop. */
import { Bean, Carrot, Cherry, Citrus, Flower2, Leaf, Minus, Salad, Sprout, TreePalm, Trees, Wheat, type LucideIcon } from "lucide-react";
import { cropStyle } from "@/lib/crops";

const ICON: Record<string, LucideIcon> = {
  barley: Wheat, wheat: Wheat, triticale: Wheat, sorghum: Wheat, pearl_millet: Wheat, quinoa: Wheat,
  barley_forage: Leaf, sudan_grass: Leaf, bermuda: Leaf, rhodes: Leaf, alfalfa: Leaf,
  cowpea: Bean, faba_bean: Bean, sesbania: Sprout,
  sugar_beet: Carrot, cotton: Flower2, tomato: Cherry, squash: Salad, watermelon: Citrus,
  date_palm: TreePalm, olive: Trees, fallow: Minus,
};

export function CropIcon({ id, size = 16, className = "" }: { id: string; size?: number; className?: string }) {
  const Icon = ICON[id] ?? Sprout;
  return <Icon size={size} strokeWidth={2.2} className={className} style={{ color: id === "fallow" ? "#9AA5A0" : cropStyle(id).color }} aria-hidden />;
}
