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

export const broadcastTransaction = (transaction) => {
    const data = `data: ${JSON.stringify(transaction)}\n\n`;
    
    // Broadcast to all connected clients
    clients.forEach(client => {
        try {
            client.res.write(data);
        } catch (e) {
            console.error('Error broadcasting to client', client.id, e);
        }
    });
};
