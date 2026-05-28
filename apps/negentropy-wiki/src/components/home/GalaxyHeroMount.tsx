"use client";

import dynamic from "next/dynamic";

const GalaxyBackground = dynamic(
  () => import("./GalaxyBackground").then((mod) => mod.GalaxyBackground),
  { ssr: false, loading: () => null },
);

export function GalaxyHeroMount() {
  return <GalaxyBackground className="home-hero-galaxy" />;
}
