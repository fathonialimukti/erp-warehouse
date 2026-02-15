import { fetch } from "@tauri-apps/plugin-http";

// Base URL configuration
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// Fetch wrapper with interceptor functionality
interface RequestConfig extends RequestInit {
  url?: string;
  _retry?: boolean;
  params?: Record<string, any>;
  responseType?: "json" | "blob";
}

const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const token = localStorage.getItem("auth_token");

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

const handleResponse = async (
  response: Response,
  url: string,
  config: RequestConfig,
) => {
  if (!response.ok) {
    console.error("API Error:", response.status, "URL:", url);

    if (response.status === 401 && !config._retry) {
      console.error("401 error detected, clearing auth data");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    if (response.status === 403) {
      console.error("403 Forbidden - user not authorized for:", url);
    }

    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || "Request failed");

    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  // Handle blob response type
  if (config.responseType === "blob") {
    return response.blob();
  }

  return response.json();
};

export const api = {
  defaults: { baseURL: BASE_URL },

  get: async (endpoint: string, config: RequestConfig = {}) => {
    let url = `${BASE_URL}${endpoint}`;

    // Handle query parameters
    if (config.params) {
      const queryString = Object.entries(config.params)
        .filter(
          ([_, value]) => value !== undefined && value !== null && value !== "",
        )
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join("&");

      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const token = localStorage.getItem("auth_token");

    if (token) {
      console.log("Adding auth token to request:", url);
    } else {
      console.error("No auth token found for request:", url);
    }

    const response = await fetch(url, {
      ...config,
      method: "GET",
      headers: { ...getHeaders(), ...config.headers },
      credentials: "include",
    });

    return { data: await handleResponse(response, url, config) };
  },

  post: async (endpoint: string, data?: any, config: RequestConfig = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const token = localStorage.getItem("auth_token");

    if (token) {
      console.log("Adding auth token to request:", url);
    } else {
      console.error("No auth token found for request:", url);
    }

    const response = await fetch(url, {
      ...config,
      method: "POST",
      headers: { ...getHeaders(), ...config.headers },
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });

    return { data: await handleResponse(response, url, config) };
  },

  put: async (endpoint: string, data?: any, config: RequestConfig = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const token = localStorage.getItem("auth_token");

    if (token) {
      console.log("Adding auth token to request:", url);
    } else {
      console.error("No auth token found for request:", url);
    }

    const response = await fetch(url, {
      ...config,
      method: "PUT",
      headers: { ...getHeaders(), ...config.headers },
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });

    return { data: await handleResponse(response, url, config) };
  },

  patch: async (endpoint: string, data?: any, config: RequestConfig = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const token = localStorage.getItem("auth_token");

    if (token) {
      console.log("Adding auth token to request:", url);
    } else {
      console.error("No auth token found for request:", url);
    }

    const response = await fetch(url, {
      ...config,
      method: "PATCH",
      headers: { ...getHeaders(), ...config.headers },
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });

    return { data: await handleResponse(response, url, config) };
  },

  delete: async (endpoint: string, config: RequestConfig = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const token = localStorage.getItem("auth_token");

    if (token) {
      console.log("Adding auth token to request:", url);
    } else {
      console.error("No auth token found for request:", url);
    }

    const response = await fetch(url, {
      ...config,
      method: "DELETE",
      headers: { ...getHeaders(), ...config.headers },
      credentials: "include",
    });

    return { data: await handleResponse(response, url, config) };
  },
};
