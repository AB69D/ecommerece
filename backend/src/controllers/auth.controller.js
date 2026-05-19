import OtpModel from "../models/otp.model.js";
import AdminModel from "../models/admin.model.js";
import jwt from 'jsonwebtoken';

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';
const BREVO_KEY = process.env.API_KEY || process.env.SMTP_KEY;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendCode = async (request, response) => {
    try {
        const { email } = request.body;

        if (!email) {
            return response.status(400).json({
                message: "Email is required",
                error: true,
                success: false
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const isEnvAdmin = ADMIN_EMAILS.includes(normalizedEmail);
        const dbAdmin = await AdminModel.findOne({ email: normalizedEmail });

        if (!isEnvAdmin && !dbAdmin) {
            return response.status(403).json({
                message: "This email is not authorized for admin access",
                error: true,
                success: false
            });
        }

        const code = generateCode();

        await OtpModel.deleteMany({ email: normalizedEmail });

        const otp = new OtpModel({
            email: normalizedEmail,
            code,
            expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        });
        await otp.save();

        try {
            const emailRes = await fetch(BREVO_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': BREVO_KEY
                },
                body: JSON.stringify({
                    sender: {
                        name: process.env.MAIL_FROM_NAME,
                        email: process.env.MAIL_FROM_ADDRESS
                    },
                    to: [{ email: normalizedEmail }],
                    subject: 'Gram2Ghor Admin - Login Code',
                    htmlContent: `
                        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                            <h2 style="color: #1a1a1a; margin-bottom: 16px;">Admin Login Code</h2>
                            <p style="color: #666; font-size: 14px; line-height: 1.6;">
                                Use the following code to log in to your Gram2Ghor admin panel.
                                This code expires in 3 hours.
                            </p>
                            <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
                            </div>
                            <p style="color: #999; font-size: 12px;">
                                If you did not request this code, please ignore this email.
                            </p>
                        </div>
                    `
                })
            });

            if (!emailRes.ok) {
                const errBody = await emailRes.json().catch(() => ({}));
                throw new Error(errBody.message || `Brevo API error: ${emailRes.status}`);
            }
        } catch (emailError) {
            await OtpModel.deleteOne({ _id: otp._id });
            return response.status(500).json({
                message: "Failed to send email. " + emailError.message,
                error: true,
                success: false
            });
        }

        return response.json({
            message: "Login code sent to your email",
            error: false,
            success: true
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const verifyCode = async (request, response) => {
    try {
        const { email, code } = request.body;

        if (!email || !code) {
            return response.status(400).json({
                message: "Email and code are required",
                error: true,
                success: false
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const otp = await OtpModel.findOne({
            email: normalizedEmail,
            code,
            verified: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otp) {
            return response.status(400).json({
                message: "Invalid or expired code",
                error: true,
                success: false
            });
        }

        otp.verified = true;
        await otp.save();

        const token = jwt.sign(
            { email: normalizedEmail },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
        );

        return response.json({
            message: "Login successful",
            error: false,
            success: true,
            data: { token }
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const verifyToken = async (request, response) => {
    try {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return response.status(401).json({
                message: "No token provided",
                error: true,
                success: false,
                valid: false
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        return response.json({
            message: "Token is valid",
            error: false,
            success: true,
            valid: true,
            data: { email: decoded.email }
        });

    } catch (error) {
        return response.status(401).json({
            message: "Invalid or expired token",
            error: true,
            success: false,
            valid: false
        });
    }
};
