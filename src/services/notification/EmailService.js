const nodemailer = require('nodemailer');
const env = require('../../config/env');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

/**
 * EmailService - Gerencia o envio de e-mails transacionais da plataforma.
 */
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true para 465, false para outros
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Configurações para evitar falhas de certificado em ambientes de teste
      tls: {
        rejectUnauthorized: env.NODE_ENV === 'production'
      }
    });

    this.from = `${process.env.EMAIL_FROM || 'Otaku Clash Angola'} <${process.env.SMTP_USER}>`;
  }

  /**
   * Método genérico para envio de e-mail.
   * @param {string} to - Destinatário
   * @param {string} subject - Assunto
   * @param {string} html - Conteúdo em HTML
   * @param {string} text - Conteúdo em texto plano (fallback)
   */
  async send(to, subject, html, text) {
    try {
      const mailOptions = {
        from: this.from,
        to,
        subject,
        text,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`[EmailService] E-mail enviado para ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`[EmailService] Erro ao enviar e-mail para ${to}: ${error.message}`);
      // Não lançamos erro aqui para não interromper fluxos principais (ex: cadastro),
      // mas registramos a falha para intervenção manual se necessário.
      return null;
    }
  }

  /**
   * Envia e-mail de boas-vindas.
   */
  async sendWelcomeEmail(to, username) {
    const subject = 'Bem-vindo ao Otaku Clash Angola!';
    const html = `
      <h1>Olá, ${username}!</h1>
      <p>Sua conta foi criada com sucesso na maior plataforma de quiz anime de Angola.</p>
      <p>Prepare sua estratégia e suba no ranking!</p>
    `;
    const text = `Olá ${username}, bem-vindo ao Otaku Clash Angola!`;
    
    return this.send(to, subject, html, text);
  }

  /**
   * Envia e-mail de recuperação de senha.
   * @param {string} to 
   * @param {string} token - Token de reset
   */
  async sendPasswordResetEmail(to, token) {
    const resetUrl = `${env.API_URL}/reset-password?token=${token}`;
    const subject = 'Recuperação de Senha - Otaku Clash Angola';
    const html = `
      <h1>Recuperação de Senha</h1>
      <p>Você solicitou a alteração de sua senha.</p>
      <p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
      <p>Se você não solicitou isso, ignore este e-mail.</p>
    `;
    const text = `Link para recuperar sua senha: ${resetUrl}`;

    return this.send(to, subject, html, text);
  }

  /**
   * Valida a conexão com o servidor SMTP.
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('[EmailService] Conexão com servidor SMTP validada.');
      return true;
    } catch (error) {
      logger.error('[EmailService] Falha na conexão SMTP:', error);
      return false;
    }
  }
}

module.exports = new EmailService();