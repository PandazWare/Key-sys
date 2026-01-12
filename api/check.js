export default async function handler(req, res) {
    const { key, hwid } = req.query;

    const r = await fetch(`${process.env.REDIS_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${process.env.REDIS_TOKEN}` }
    });

    const data = await r.json();
    if (!data.result) {
        return res.json({ success: false });
    }

    const value = JSON.parse(data.result);

    // schon benutzt?
    if (value.used === true) {
        return res.json({ success: false, reason: "Key already used" });
    }

    // HWID binden
    if (!value.hwid) {
        value.hwid = hwid;
        value.used = true; // 🔒 NUR 1× BENUTZBAR

        await fetch(`${process.env.REDIS_URL}/set/${key}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                value: JSON.stringify(value),
                ttl: 24 * 60 * 60
            })
        });
    }

    if (value.hwid !== hwid) {
        return res.json({ success: false });
    }

    res.json({ success: true });
}
