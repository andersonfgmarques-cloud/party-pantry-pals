import React from "react";
import type ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

export function mountApp(root: ReturnType<typeof import("react-dom/client")["createRoot"]>) {
  const queryClient = new QueryClient();
  const router = getRouter(queryClient);
  root.render(<React.StrictMode><RouterProvider router={router} context={{ queryClient }} /></React.StrictMode>);
}
