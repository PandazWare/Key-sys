import crypto from "crypto";

export default async function handler(req, res) {
    const key = crypto.randomBytes(16).toString("hex");
    const ttl = 24 * 60 * 60; // 24h

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

    res.status(200).json({
        key,
        expires: "24 hours"
    });
}
