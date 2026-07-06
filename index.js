import express from 'express';
import axios from 'axios';

const app = express();

const API_KEYS = [
    process.env.GEMINI_KEY_1 || process.env.GEMINI_KEY,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3
].filter(Boolean);

let currentKeyIndex = 0;

function getActiveKey() {
    if (API_KEYS.length === 0) return null;
    return API_KEYS[currentKeyIndex];
}

function rotateKey() {
    if (API_KEYS.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        console.log(`[LoadBalancer] Shifted to Key Index: ${currentKeyIndex}`);
    }
}

app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; background:#0a0a0a; color:#fff; text-align:center; padding-top:100px;">
            <h1 style="color:#ff3333;">AYU ENGINE v3.8</h1>
            <p style="color:#888;">Active Keys Loaded: ${API_KEYS.length}</p>
        </body>
    `);
});

async function requestAI(systemPrompt, userPrompt) {
    const currentKey = getActiveKey();
    if (!currentKey) throw new Error("No API keys found in environment variables.");

    // Using stable v1 endpoint for faster responses
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${currentKey}`;
    
    const payload = {
        contents: [{
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUser Request: ${userPrompt}` }]
        }],
        // Adding safety settings to prevent API from hanging on filtering checks
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }
        ]
    };

    // Low timeout (8 seconds) to prevent Vercel Serverless timeout crash
    const response = await axios.post(url, payload, { timeout: 8000 });
    
    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return response.data.candidates[0].content.parts[0].text;
    }

    throw new Error("Empty or malformed response structure from API.");
}

app.get('/roast', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ status: false, error: "Missing parameter 'q'." });

    try {
        const systemPrompt = "You are Ayu's Roast Bot. Sarcastic and witty. Mix Hindi and English naturally (Hinglish). Short burn.";
        const output = await requestAI(systemPrompt, query);
        res.json({ status: true, creator: "Ayu", result: output });
    } catch (err) {
        rotateKey(); 
        res.status(500).json({ 
            status: false, 
            error: "Execution failed or timed out.",
            details: err.response ? err.response.data : err.message 
        });
    }
});

app.get('/code', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ status: false, error: "Missing parameter 'q'." });

    try {
        const systemPrompt = "You are an elite software assistant. Provide clean, optimized code blocks inside markdown fences.";
        const output = await requestAI(systemPrompt, query);
        res.json({ status: true, creator: "Ayu", result: output });
    } catch (err) {
        rotateKey(); 
        res.status(500).json({ 
            status: false, 
            error: "Execution failed or timed out.",
            details: err.response ? err.response.data : err.message 
        });
    }
});

export default app;
