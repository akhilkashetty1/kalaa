"use server";

import { redirect } from "next/navigation";
import { endSession, normalizeEmail, requestLoginCode, safeNext, startSession, verifyLoginCode } from "@/server/auth";

export type LoginState = { step: "email" | "code"; email?: string; error?: string; notice?: string };

async function sendCode(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { step: "email", error: "Enter a valid email address." };
  try {
    const res = await requestLoginCode(email);
    if (!res.ok) return { step: "code", email, error: "Too many codes requested. Wait 15 minutes, then try again." };
  } catch (err) {
    console.error(err);
    return { step: "email", email, error: "We couldn't send the email. Try again in a minute." };
  }
  return { step: "code", email, notice: `We sent a 6-digit code to ${email}.` };
}

async function checkCode(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!email) return { step: "email", error: "Start again with your email address." };
  if (code.length !== 6) return { step: "code", email, error: "The code has 6 digits." };

  const res = await verifyLoginCode(email, code);
  if (!res.ok) {
    const error = {
      invalid: "That code isn't right. Check the latest email and try again.",
      expired: "That code has expired. Send a new one.",
      locked: "Too many wrong tries for this code. Send a new one.",
    }[res.reason];
    return { step: "code", email, error };
  }
  await startSession(res.creator.id);
  redirect(safeNext(formData.get("next")));
}

/** Single entry point for the login form; the pressed button's `intent` picks the step. */
export async function loginStep(prev: LoginState, formData: FormData): Promise<LoginState> {
  switch (formData.get("intent")) {
    case "check":
      return checkCode(prev, formData);
    case "reset":
      return { step: "email", email: String(formData.get("email") ?? "") };
    default:
      return sendCode(prev, formData);
  }
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
