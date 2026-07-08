import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { generatePaySprintToken } from './src/utils/paysprint.util.js';
import axios from 'axios';

const getVerifiedPipe = async (merchantcode, mobile) => {
    const pipes = ['bank1', 'bank2', 'bank3', 'bank5'];
    const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
    
    const headers = {
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json'
    };

    console.log("Checking pipes for:", merchantcode, mobile);
    for (const pipe of pipes) {
        try {
            const currentToken = generatePaySprintToken();
            const currentHeaders = { ...headers, 'Token': currentToken };

            const res = await axios.post(`${baseUrl}/service/onboard/onboard/getonboardstatus`, {
                merchantcode: merchantcode,
                mobile: String(mobile),
                pipe: pipe
            }, { headers: currentHeaders });
            
            console.log(`Response for ${pipe}:`, res.data);
            if (res.data && res.data.response_code === 1 && res.data.is_approved === 'Accepted') {
                return pipe;
            }
        } catch (e) {
            console.error(`Error checking pipe status for ${pipe}:`, e.message, e.response?.data);
        }
    }
    return 'bank3';
};

(async () => {
    const pipe = await getVerifiedPipe("A2ZB1004", "8902762742");
    console.log("Verified pipe:", pipe);
})();
