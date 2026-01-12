import crypto from "crypto";

export default async function handler(req, res) {
    // IP-Adresse des Clients holen
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress;
    
    // IP hashen für Privatsphäre
    const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');
    const redisKey = `ratelimit:${ipHash}`;
    
    const COOLDOWN_HOURS = 23;
    const COOLDOWN_SECONDS = COOLDOWN_HOURS * 60 * 60;
    
    try {
        // Prüfe ob IP bereits einen Key generiert hat
        const checkResponse = await fetch(`${process.env.REDIS_URL}/get/${redisKey}`, {
            headers: { Authorization: `Bearer ${process.env.REDIS_TOKEN}` }
        });
        
        const checkData = await checkResponse.json();
        
        if (checkData.result) {
            // IP hat bereits einen Key generiert
            const data = JSON.parse(checkData.result);
            const timePassedSeconds = Math.floor((Date.now() - data.timestamp) / 1000);
            const timeRemainingSeconds = COOLDOWN_SECONDS - timePassedSeconds;
            
            if (timeRemainingSeconds > 0) {
                // Cooldown noch aktiv
                const hoursRemaining = Math.floor(timeRemainingSeconds / 3600);
                const minutesRemaining = Math.floor((timeRemainingSeconds % 3600) / 60);
                
                return res.status(429).json({
                    success: false,
                    error: "rate_limit",
                    message: `Du kannst nur alle ${COOLDOWN_HOURS} Stunden einen Key generieren.`,
                    timeRemaining: `${hoursRemaining}h ${minutesRemaining}m`,
                    nextKeyAt: data.timestamp + (COOLDOWN_SECONDS * 1000)
                });
            }
        }
        
        // Generiere neuen Key
        const key = crypto.randomBytes(16).toString("hex");
        const ttl = 24 * 60 * 60; // 24h
        
        // Speichere den Key
        await fetch(`${process.env.REDIS_URL}/set/${key}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                value: JSON.stringify({
                    createdAt: Date.now(),
                    hwid: null
                }),
                ttl
            })
        });
        
        // Speichere IP-Tracking mit TTL
        await fetch(`${process.env.REDIS_URL}/set/${redisKey}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                value: JSON.stringify({
                    timestamp: Date.now(),
                    keysGenerated: (checkData.result ? JSON.parse(checkData.result).keysGenerated + 1 : 1)
                }),
                ttl: COOLDOWN_SECONDS
            })
        });
        
        res.status(200).json({
            success: true,
            key,
            expires: "24 hours",
            nextKeyIn: `${COOLDOWN_HOURS} hours`
        });
        
    } catch (error) {
        console.error("Rate limit check error:", error);
        res.status(500).json({
            success: false,
            error: "server_error",
            message: "An error accured. Please try again later."
        });
    }
                    }
