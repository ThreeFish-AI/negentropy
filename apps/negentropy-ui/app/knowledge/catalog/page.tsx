import { redirect } from "next/navigation";

export default function CatalogPage() {
  redirect("/knowledge/wiki?mode=edit");
}
