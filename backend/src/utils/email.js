async function sendPasswordResetEmail(email, resetUrl) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER) {
    console.log(`[email stub] Reset password para ${email}: ${resetUrl}`);
    return;
  }

  // Integración SMTP pendiente según proveedor elegido
  console.log(`[email] Enviando reset a ${email}: ${resetUrl}`);
}

module.exports = { sendPasswordResetEmail };
