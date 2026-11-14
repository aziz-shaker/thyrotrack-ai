import { SwaggerUI } from "./SwaggerUI";

export const metadata = { title: "API Docs | ThyroTrack AI" };

/** Swagger UI for the web API (spec at /api/openapi.json). The AI service has its own at :8000/docs. */
export default function ApiDocs() {
  return (
    <main dir="ltr" className="min-h-screen bg-white">
      <SwaggerUI />
    </main>
  );
}
