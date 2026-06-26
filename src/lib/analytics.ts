import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Google Analytics 4 Utility
 */
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "";

export const initGA = () => {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;

  const script1 = document.createElement("script");
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script1);

  const script2 = document.createElement("script");
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_MEASUREMENT_ID}', {
      page_path: window.location.pathname,
    });
  `;
  document.head.appendChild(script2);
};

export const logPageView = (path: string) => {
  if (!GA_MEASUREMENT_ID || !window.gtag) return;
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: path,
  });
};

export const logEvent = (action: string, params?: object) => {
  if (!GA_MEASUREMENT_ID || !window.gtag) return;
  window.gtag("event", action, params);
};

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    logPageView(location.pathname + location.search);
  }, [location]);
};

declare global {
  interface Window {
    gtag: (command: string, idOrAction: string, params?: any) => void;
    dataLayer: any[];
  }
}
