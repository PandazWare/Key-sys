// api/validate-token.js
export default async function handler(req, res) {
    const { token } = req.query;
    
    if (!token) return res.status(400).json({ valid: false });

    try {
        // Prüfe ob der Token in Redis existiert
        const r = await fetch(`${process.env.REDIS_URL}/get/temp_token:${token}`, {
            headers: { Authorization: `Bearer ${process.env.REDIS_TOKEN}` }
        });
        const data = await r.json();
        
        // Wenn Key nicht existiert (oder abgelaufen ist)
        if (!data.result) {
            return res.json({ valid: false, reason: "invalid_or_expired" });
        }
        
        // Token ist gültig
        res.json({ valid: true });
        
    } catch (e) {
        console.error(e);
        res.status(500).json({ valid: false, error: "server_error" });
    }
}

