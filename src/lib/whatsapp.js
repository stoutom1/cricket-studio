export async function sendWhatsAppBirthdayMessage({
  recipientPhone,
  playerName,
  leagueName,
}) {
  const accessToken =
    process.env.WHATSAPP_ACCESS_TOKEN;

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  const apiVersion =
    process.env.WHATSAPP_API_VERSION || "v25.0";

  if (!accessToken) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN is not configured."
    );
  }

  if (!phoneNumberId) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID is not configured."
    );
  }

  const cleanPhone = String(
    recipientPhone || ""
  ).replace(/\D/g, "");

  const cleanPlayerName = String(
    playerName || ""
  ).trim();

  const cleanLeagueName = String(
    leagueName || "your cricket league"
  ).trim();

  if (
    cleanPhone.length < 10 ||
    cleanPhone.length > 15
  ) {
    throw new Error(
      "A valid WhatsApp number with country code is required."
    );
  }

  if (!cleanPlayerName) {
    throw new Error("Player name is required.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },

 body: JSON.stringify({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: cleanPhone,
  type: "template",

  template: {
    name: "hello_world",

    language: {
      code: "en_US",
    },
  },
}),
    }
  );

  const data = await response.json();

  console.log("WhatsApp birthday response:", {
    status: response.status,
    ok: response.ok,
    messageId: data?.messages?.[0]?.id || null,
    error: data?.error || null,
  });

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "WhatsApp rejected the birthday message."
    );
  }

  return {
    success: true,
    recipient: cleanPhone,
    messageId: data?.messages?.[0]?.id || null,
  };
}