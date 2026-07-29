import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auto-trader")({
  head: () => ({ meta: [{ title: "IA Trading — Au Pluriel" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/ia-trading" });
  },
});
