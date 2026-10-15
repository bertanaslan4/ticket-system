import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { AuthProvider } from "../features/auth/AuthProvider";
import { routes } from "./router";
import { useLanguage, localizeValidation } from "../i18n/index.js";
const router = createBrowserRouter(routes);
export default function App() {
  const language = useLanguage();
  return (
    <div
      lang={language}
      onInvalidCapture={localizeValidation}
      onInputCapture={(e) =>
        (e.target as HTMLInputElement).setCustomValidity?.("")
      }
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </div>
  );
}
