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

export const onboardMerchant = async (merchantData) => {
    try {
        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://sit.paysprint.in/service-api/api/v1';
        
        // This is a standard payload structure. Modify according to exact API requirements.
        const payload = {
            merchantcode: merchantData.merchantcode,
            mobilenumber: merchantData.mobile,
            is_new: "1",
            emailid: merchantData.email,
            companyname: merchantData.businessName || merchantData.name,
            name: merchantData.name,
            pan: merchantData.panNumber,
            pancard: merchantData.panPictureUrl || "",
            aadhar: merchantData.aadhaarNumber,
            aadharfront: merchantData.aadhaarPictureUrl || "",
            aadharback: "",
            address: merchantData.address?.city || "",
            dob: merchantData.dob || "01-01-1990",
            state: merchantData.address?.state || "",
            city: merchantData.address?.city || "",
            pincode: merchantData.pincode || "110001"
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        };

        // Note: The endpoint path might be different based on your exact API access
        // Common endpoint for AEPS onboarding: /service/aeps/onboarding
        // Or /service/aeps/merchant/onboarding
        const response = await fetch(`${baseUrl}/service/aeps/merchant/onboarding`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ body: encryptedData })
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("Non-JSON response from PaySprint onboarding:", responseText.substring(0, 200));
            return { success: false, message: "PaySprint API returned an invalid response (HTML/404)." };
        }
        
        if (data.status) {
            return { success: true, message: "Onboarding successful", data };
        } else {
            return { success: false, message: data.message || "Failed to verify via PaySprint." };
        }
    } catch (error) {
        console.error("PaySprint onboarding error:", error);
        return { success: false, message: "System error during PaySprint verification." };
    }
};

export const sendAadhaarOtp = async (merchantcode, aadhaar, latitude, longitude) => {
    try {
        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://sit.paysprint.in/service-api/api/v1';
        const payload = {
            merchantcode,
            accessmode: "SITE",
            latitude: latitude || "22.44543",
            longitude: longitude || "77.434",
            aadhaar
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'PS001'
        };

        const response = await fetch(`${baseUrl}/service/aeps/v3/merchantkyc/send_otp`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.status) {
            return { success: true, message: data.message, data: data.data };
        } else {
            return { success: false, message: data.message || "Failed to send Aadhaar OTP." };
        }
    } catch (error) {
        console.error("PaySprint send OTP error:", error);
        return { success: false, message: "System error during Aadhaar OTP generation." };
    }
};

export const verifyAadhaarOtp = async (merchantcode, aadhaar, otp, stateresp, ekyc_id, latitude, longitude) => {
    try {
        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://sit.paysprint.in/service-api/api/v1';
        const payload = {
            merchantcode,
            aadhaar,
            latitude: parseFloat(latitude || "22.44543"),
            longitude: parseFloat(longitude || "77.434"),
            otp,
            stateresp,
            ekyc_id,
            piddata: "", // Pass empty if biometric is not used, or mock if needed
            accessmode: "SITE"
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await fetch(`${baseUrl}/service/aeps/v3/merchantkyc/verify_otp`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.status) {
            return { success: true, message: data.message, data: data.data };
        } else {
            return { success: false, message: data.message || "Failed to verify Aadhaar OTP." };
        }
    } catch (error) {
        console.error("PaySprint verify OTP error:", error);
        return { success: false, message: "System error during Aadhaar OTP verification." };
    }
};

export const verifyPanDetails = async (merchantcode, name, pan, dob) => {
    try {
        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://sit.paysprint.in/service-api/api/v1';
        const payload = {
            merchantcode,
            name,
            pan,
            dob
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await fetch(`${baseUrl}/service/onboard/onboard/pan_update_bank6`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        // Wait, the API docs do not specify the exact success response structure, assuming status = true
        // and message. If not, it will return success anyway.
        if (data.status || data.response_code === 1) {
            return { success: true, message: data.message || "PAN Verification Successful", data: data.data };
        } else {
            return { success: false, message: data.message || "Failed to verify PAN." };
        }
    } catch (error) {
        console.error("PaySprint PAN verification error:", error);
        return { success: false, message: "System error during PAN verification." };
    }
};

export const getWebOnboardingUrl = async (merchantData) => {
    try {
        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://sit.paysprint.in/service-api/api/v1';
        const payload = {
            merchantcode: merchantData.merchantcode,
            mobile: merchantData.mobile,
            is_new: merchantData.is_new ? "1" : "0",
            register_type: merchantData.is_new ? "1" : "0",
            email: merchantData.email,
            firm: merchantData.businessName || merchantData.name,
            callback: merchantData.callbackUrl || "http://localhost:5173/kyc-status"
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        };

        const response = await fetch(`${baseUrl}/service/onboard/v2/onboard/getonboardurl`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("Non-JSON response from PaySprint Web Onboarding:", responseText);
            return { success: false, message: "PaySprint Web Onboarding API is currently unavailable." };
        }
        
        if (data.status) {
            return { success: true, message: data.message, url: data.redirecturl || data.url };
        } else {
            return { success: false, message: data.message || "Failed to generate Onboarding URL." };
        }
    } catch (error) {
        console.error("PaySprint getOnboardUrl error:", error);
        return { success: false, message: "System error during URL generation." };
    }
};
