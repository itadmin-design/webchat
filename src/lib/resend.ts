import { Resend } from "resend";
//
export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLinkEmail(email: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${token}`;
 //
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Your login link",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; font-size: 24px; font-weight: 600; margin-bottom: 16px;">Ваша ссылка для входа</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">
          Нажмите на кнопку снизу для входа. Ссылка активна в течении 15 минут.
        </p>
        <a href="${url}" style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 500;">
          Войти в аккаунт
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 32px;">
          Если вы не пытались войти, можете проигнорировать это письмо.
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(email: string, name: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${token}`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Ваша заявка на регистрацию одобрена!",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; font-size: 24px; font-weight: 600; margin-bottom: 16px;">Welcome, ${name}!</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">
          Ваша заявка на регистрацию одобрена! Нажмите на ссылку ниже, чтобы открыть чат.
        </p>
        <a href="${url}" style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 500;">
          Открыть чат
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 32px;">
          Вы можете войти тут ${process.env.NEXT_PUBLIC_APP_URL} используя ваш email.
        </p>
      </div>
    `,
  });
}
