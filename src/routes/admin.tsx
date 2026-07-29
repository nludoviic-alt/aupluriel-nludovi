import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administration — Au Pluriel" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/administration" });
  },
});
