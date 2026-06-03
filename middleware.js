export { default } from "next-auth/middleware";
console.log("I am in middleware");
export const config = {
  matcher: ["/dashboard/:path*"]
};