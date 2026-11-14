"use client";

import Script from "next/script";

declare global {
  interface Window {
    SwaggerUIBundle?: (opts: { url: string; dom_id: string }) => void;
  }
}

export function SwaggerUI() {
  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
      <div id="swagger" />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={() => window.SwaggerUIBundle?.({ url: "/api/openapi.json", dom_id: "#swagger" })}
      />
    </>
  );
}
