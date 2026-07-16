// sse.js - Server-Sent Events utility for real-time admin updates

let clients = [];

export const addClient = (req, res) => {
    // Set headers required for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial data to establish connection quickly
    res.write('data: {"message": "Connected"}\n\n');

    const clientId = Date.now();

    const newClient = {
        id: clientId,
        res
    };

    clients.push(newClient);

    // When client closes connection, remove them
    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
    });
};

import Retailer from '../models/users/retailer.model.js';

export const broadcastTransaction = async (transaction) => {
    try {
        let txnToSend = typeof transaction.toObject === 'function' ? transaction.toObject() : { ...transaction };
        
        if (txnToSend.userId && !txnToSend.userId.name) {
            const retailer = await Retailer.findById(txnToSend.userId).select('name businessName').lean();
            if (retailer) {
                txnToSend.userId = retailer;
            }
        }

        const data = `data: ${JSON.stringify(txnToSend)}\n\n`;
        
        // Broadcast to all connected clients
        clients.forEach(client => {
            try {
                client.res.write(data);
            } catch (e) {
                console.error('Error broadcasting to client', client.id, e);
            }
        });
    } catch (err) {
        console.error("Broadcast error:", err);
    }
};
