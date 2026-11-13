"use client";

export function StoryHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h3>
      <p className="muted mt-1 max-w-3xl text-sm sm:text-base">{lead}</p>
    </div>
  );
}
