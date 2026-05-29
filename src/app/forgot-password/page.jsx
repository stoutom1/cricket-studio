export default function ForgotPasswordPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#030712",
        color: "white"
      }}
    >
      <div
        style={{
          background: "#111827",
          padding: 30,
          borderRadius: 16,
          width: 400
        }}
      >
        <h1
          style={{
            marginBottom: 20,
            fontSize: 28
          }}
        >
          Reset Password
        </h1>

        <form>
          <input
            type="email"
            placeholder="Enter your email"
            required
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #374151",
              marginBottom: 16,
              background: "#1f2937",
              color: "white"
            }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "none",
              background: "#2563eb",
              color: "white",
              fontWeight: 700
            }}
          >
            Send Reset Link
          </button>
        </form>
      </div>
    </div>
  );
}