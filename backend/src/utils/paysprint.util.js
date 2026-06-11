import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const generatePaySprintToken = () => {
    const jwtKeyBase64 = process.env.PAYSPRINT_JWT_KEY;
    const secret = Buffer.from(jwtKeyBase64, 'base64').toString('utf8');
    const partnerId = secret.substring(0, 8); 

    const currentUnixTime = Math.floor(Date.now() / 1000);
    const payload = {
        timestamp: currentUnixTime, // PaySprint requires Unix seconds
        partnerId: partnerId,
        reqid: Math.floor(Math.random() * 1000000).toString(),
        iat: currentUnixTime - 60 // Backdate by 60s to fix clock drift 'Cannot handle token prior to' errors
    };

    const token = jwt.sign(payload, jwtKeyBase64, { algorithm: 'HS256' });
    return token;
};

export const encryptPayload = (payloadString) => {
    const key = process.env.PAYSPRINT_AES_KEY;
    const iv = process.env.PAYSPRINT_AES_IV;
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    let encrypted = cipher.update(payloadString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
};

export const decryptPayload = (encryptedString) => {
    const key = process.env.PAYSPRINT_AES_KEY;
    const iv = process.env.PAYSPRINT_AES_IV;
    
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    let decrypted = decipher.update(encryptedString, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};
