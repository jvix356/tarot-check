// 인증 코드 메일 발송. Resend 또는 Gmail(앱 비밀번호) 중 설정된 쪽을 써요.
export function mailConfigured() {
  if (process.env.STORE === 'memory') return true;
  return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM) || !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendCode(to, code) {
  const subject = '[타로 리딩 판독기] 이메일 인증 코드';
  const text = `인증 코드: ${code}\n\n10분 안에 사이트에 입력해 주세요.\n본인이 요청하지 않았다면 이 메일은 무시해도 돼요.\n\n이 인증은 게시판 작성 계정 확인용이며 실명 확인이 아니에요.`;
  if (process.env.STORE === 'memory') { globalThis.__tcLastMail = { to, code }; return; }
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    });
    if (!r.ok) throw Object.assign(new Error('mail_failed'), { status: 502 });
    return;
  }
  const nodemailer = (await import('nodemailer')).default;
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  await t.sendMail({ from: `타로 리딩 판독기 <${process.env.GMAIL_USER}>`, to, subject, text });
}
