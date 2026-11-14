import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/** Route-level RBAC: staff area vs patient portal. Row-level checks happen in lib/access.ts */
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/doctor") && role === "PATIENT") {
      return NextResponse.redirect(new URL("/patient", req.url));
    }
    if (path.startsWith("/patient") && role !== "PATIENT") {
      return NextResponse.redirect(new URL("/doctor", req.url));
    }
    return NextResponse.next();
  },
  { callbacks: { authorized: ({ token }) => !!token }, pages: { signIn: "/login" } },
);

export const config = { matcher: ["/doctor/:path*", "/patient/:path*"] };
