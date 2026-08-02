import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

// SMTP config is admin-configurable at runtime (Settings → Users), stored in
// the generic Setting key/value table rather than env vars, since it can
// change without a redeploy. Node-only (nodemailer) — never import this from
// src/middleware.ts.

const SETTING_KEY = "smtp";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean; // true = implicit TLS (usually port 465)
  username: string;
  password: string;
  from: string;
}

export type SmtpConfigMasked = Omit<SmtpConfig, "password"> & { hasPassword: boolean };

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value);
    if (!parsed?.host || !parsed?.username || !parsed?.from) return null;
    return parsed as SmtpConfig;
  } catch {
    return null;
  }
}

export async function getSmtpConfigMasked(): Promise<SmtpConfigMasked | null> {
  const config = await getSmtpConfig();
  if (!config) return null;
  const { password, ...rest } = config;
  return { ...rest, hasPassword: !!password };
}

// `password: undefined` (field omitted from the request) keeps the
// previously-stored password — lets the admin update host/port/etc. without
// retyping it every time. Pass an empty string explicitly to clear it.
export async function saveSmtpConfig(input: Omit<SmtpConfig, "password"> & { password?: string }): Promise<void> {
  const existing = await getSmtpConfig();
  const config: SmtpConfig = {
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    from: input.from,
    password: input.password !== undefined ? input.password : existing?.password ?? "",
  };
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(config) },
    create: { key: SETTING_KEY, value: JSON.stringify(config) },
  });
}

export async function isSmtpConfigured(): Promise<boolean> {
  const config = await getSmtpConfig();
  return !!config?.password;
}

async function getTransporter() {
  const config = await getSmtpConfig();
  if (!config?.password) return null;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password },
  });
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const transporter = await getTransporter();
  if (!transporter) return { ok: false, error: "SMTP is not configured" };
  const config = await getSmtpConfig();
  try {
    await transporter.sendMail({ from: config!.from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendPasswordResetEmail(to: string, username: string, resetUrl: string) {
  return sendMail({
    to,
    subject: "Reset your BuildVerse password",
    text:
      `A password reset was requested for your BuildVerse account (${username}).\n\n` +
      `Reset it here: ${resetUrl}\n\n` +
      `This link expires in 30 minutes. If you didn't request this, you can ignore this email — your password won't change.`,
    html:
      `<p>A password reset was requested for your BuildVerse account (<strong>${username}</strong>).</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>This link expires in 30 minutes. If you didn't request this, you can ignore this email — your password won't change.</p>`,
  });
}

export async function sendTempPasswordEmail(to: string, username: string, tempPassword: string, appUrl: string) {
  return sendMail({
    to,
    subject: "Your BuildVerse account",
    text:
      `An admin created a BuildVerse account for you.\n\n` +
      `Username: ${username}\n` +
      `Temporary password: ${tempPassword}\n\n` +
      `Sign in at ${appUrl} — you'll be asked to set your own password right away.`,
    html:
      `<p>An admin created a BuildVerse account for you.</p>` +
      `<p><strong>Username:</strong> ${username}<br/>` +
      `<strong>Temporary password:</strong> <code>${tempPassword}</code></p>` +
      `<p>Sign in at <a href="${appUrl}">${appUrl}</a> — you'll be asked to set your own password right away.</p>`,
  });
}
