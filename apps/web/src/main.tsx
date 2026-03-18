import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { ActiveIngestionProvider } from "./hooks/useActiveIngestion";
import "./index.css";

const initialDarkMode = window.localStorage.getItem("snapcapsule:dark-mode") !== "false";
document.documentElement.classList.toggle("dark", initialDarkMode);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ActiveIngestionProvider>
        <App />
      </ActiveIngestionProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
