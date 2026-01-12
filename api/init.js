// api/init.js
import crypto from "crypto";

export default async function handler(req, res) {
    // 1. Generiere einen temporären Token (Einmal-Token für den Linkvertise-Prozess)
    const token = crypto.randomBytes(32).toString("hex");
    
    // 2. Speichere Token in Redis (Gültig für 10 Min, solange braucht man max. für Linkvertise)
    // Wir nutzen das Prefix "temp_token:", um es von echten Keys zu unterscheiden
    await fetch(`${process.env.REDIS_URL}/set/temp_token:${token}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            value: "pending", 
            ttl: 600 // 10 Minuten Zeit für den Linkvertise Link
        })
    });

    // 3. Baue die Ziel-URL (Deine Seite mit dem Token als Parameter)
    // WICHTIG: Ändere das auf deine echte Domain, wenn du live gehst!
    const targetUrl = `https://pandazware-key-sys.vercel.app/?token=${token}`;
    
    // 4. Base64 codieren für Linkvertise (damit die URL sauber übergeben wird)
    const base64Target = Buffer.from(targetUrl).toString('base64');
    
    // 5. Linkvertise URL mit Redirect Parameter (?r=...)
    // Hinweis: Das funktioniert bei den meisten Linkvertise-Links. 
    const linkvertiseLink = `https://link-hub.net/2646346/ZPXj7mNJU9Pa?r=${base64Target}`;
    
    // 6. Redirect den User zu Linkvertise
    res.redirect(linkvertiseLink);
}
