import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Papers",
};

export default function PapersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
