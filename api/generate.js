import crypto from "crypto";

export default async function handler(req, res) {
    // 1. Hole Token und IP
    const { token } = req.query;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress;

    // --- SICHERHEITSCHECK START ---
    
    if (!token) {
        return res.status(401).json({ success: false, message: "Missing validation token." });
    }

    // Token in Redis prüfen (temp_token:XYZ)
    try {
        const tokenCheck = await fetch(`${process.env.REDIS_URL}/get/temp_token:${token}`, {
            headers: { Authorization: `Bearer ${process.env.REDIS_TOKEN}` }
        });
        const tokenData = await tokenCheck.json();

        // Wenn Token nicht existiert (oder abgelaufen)
        if (!tokenData.result) {
            return res.status(403).json({ success: false, message: "Invalid or expired session. Please verify again." });
        }

        // WICHTIG: Token sofort löschen! (Anti-Bypass)
        await fetch(`${process.env.REDIS_URL}/del/temp_token:${token}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.REDIS_TOKEN}` }
        });

    } catch (e) {
        console.error("Redis Error:", e);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
    // --- SICHERHEITSCHECK ENDE ---


    // --- IP RATE LIMIT & KEY GENERATION ---
    
    // IP hashen für Privatsphäre
    const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');
    const redisKey = `ratelimit:${ipHash}`;
    
    const COOLDOWN_HOURS = 24;
    const COOLDOWN_SECONDS = COOLDOWN_HOURS * 60 * 60;
    
    try {
        // Prüfe ob IP bereits einen Key generiert hat
        const checkResponse = await fetch(`${process.env.REDIS_URL}/get/${redisKey}`, {
            headers: { Authorization: `Bearer ${process.env.REDIS_TOKEN}` }
        });
        
        const checkData = await checkResponse.json();
        
        if (checkData.result) {
            // IP hat bereits einen Key generiert -> Cooldown prüfen
            const data = JSON.parse(checkData.result);
            const timePassedSeconds = Math.floor((Date.now() - data.timestamp) / 1000);
            const timeRemainingSeconds = COOLDOWN_SECONDS - timePassedSeconds;
            
            if (timeRemainingSeconds > 0) {
                // Cooldown noch aktiv
                const hoursRemaining = Math.floor(timeRemainingSeconds / 3600);
                const minutesRemaining = Math.floor((timeRemainingSeconds % 3600) / 60);
                
                return res.json({
                    success: false,
                    message: `Cooldown active. Wait ${hoursRemaining}h ${minutesRemaining}m.`
                });
            }
        }
        
        // --- ALLES OK, GENERIERE NEUEN KEY ---
        
        const key = "PANDAZ-" + crypto.randomBytes(8).toString("hex").toUpperCase();
        const ttl = 24 * 60 * 60; // Key ist 24h gültig

        // Speichere den eigentlichen Key
        await fetch(`${process.env.REDIS_URL}/set/${key}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                value: JSON.stringify({
                    createdAt: Date.now(),
                    hwid: null,
                    used: false
                }),
                ttl
            })
        });
        
        // Update Rate Limit für diese IP
        await fetch(`${process.env.REDIS_URL}/set/${redisKey}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                value: JSON.stringify({
                    timestamp: Date.now()
                }),
                ttl: COOLDOWN_SECONDS
            })
        });
        
        return res.status(200).json({
            success: true,
            key,
            expires: "24 hours",
            nextKeyIn: "24 hours"
        });
        
    } catch (error) {
        console.error("Generate error:", error);
        res.status(500).json({
            success: false,
            error: "server_error",
            message: "An error occurred. Please try again later."
        });
    }
}
