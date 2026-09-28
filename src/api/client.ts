import axios from "axios";

export const TOKEN_STORAGE_KEY = "stackfolio_token";

const AUTH_PAGES = ["/signin", "/signup", "/forgot-password", "/reset-password"];

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "https://stackfolio-backend.onrender.com",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Do not set Content-Type for FormData — the browser must set the multipart boundary.
  if (config.data instanceof FormData) {
    if (typeof config.headers.set === "function") {
      config.headers.set("Content-Type", false);
    } else {
      delete config.headers["Content-Type"];
    }
  } else if (!config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const path = window.location.pathname;
      const isAuthPage = AUTH_PAGES.some((page) => path === page || path.startsWith(`${page}/`));
      if (!isAuthPage) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        window.location.assign("/signin");
      }
    }
    return Promise.reject(error);
  },
);
