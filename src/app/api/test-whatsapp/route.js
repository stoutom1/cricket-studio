import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const json = await response.json();

  return NextResponse.json({
    status: response.status,
    ok: response.ok,
    response: json,
  });
}