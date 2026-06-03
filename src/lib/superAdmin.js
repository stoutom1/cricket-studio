export function isSuperAdmin(session) {
  return (
    session?.user?.email &&
    session.user.email ===
      process.env.SUPER_ADMIN_EMAIL
  );
}