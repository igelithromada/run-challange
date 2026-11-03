import { timingSafeEqual } from "node:crypto";

export async function POST(request: Request) {
  const expectedCode = process.env.REGISTRATION_CODE;

  if (!expectedCode) {
    return Response.json(
      { error: "Registrace není na serveru nakonfigurována." },
      { status: 503 }
    );
  }

  let submittedCode: unknown;
  try {
    const body = await request.json();
    submittedCode = body?.code;
  } catch {
    return Response.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  if (typeof submittedCode !== "string" || submittedCode.length > 128) {
    return Response.json({ valid: false }, { status: 400 });
  }

  const submitted = Buffer.from(submittedCode, "utf8");
  const expected = Buffer.from(expectedCode, "utf8");
  const valid =
    submitted.length === expected.length &&
    timingSafeEqual(submitted, expected);

  return Response.json({ valid }, { status: valid ? 200 : 403 });
}
