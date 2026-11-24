import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = (queryClient: QueryClient) => {
  const router = createRouter({
    routeTree,
    basepath: import.meta.env["VITE_ROUTER_BASEPATH"] ?? (import.meta.env.PROD ? "/party-pantry-pals" : "/"),
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
  return router;
};
