import express from 'express';
import axios from 'axios';

const app = express();

// Multi-token rotation array
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

// Minimal Dashboard
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; background:#0a0a0a; color:#fff; text-align:center; padding-top:100px;">
            <h1 style="color:#ff3333;">AYU ENGINE v3.7</h1>
            <p style="color:#888;">Active Keys Loaded: ${API_KEYS.length}</p>
            <div style="background:#111; border:1px solid #222; display:inline-block; padding:20px; border-radius:8px;">
                <code>/roast?q=Target</code> | <code>/code?q=Prompt</code>
            </div>
        </body>
    `);
});

// Resilient API Call Parser
async function requestAI(systemPrompt, userPrompt) {
    const currentKey = getActiveKey();
    if (!currentKey) throw new Error("No API keys found in environment variables.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentKey}`;
    
    const payload = {
        contents: [{
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUser Request: ${userPrompt}` }]
        }]
    };

    const response = await axios.post(url, payload, { timeout: 15000 });
    
    // Dynamic parsing to prevent extraction crashes
    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return response.data.candidates[0].content.parts[0].text;
    }
    
    // Fallback parsing just in case Google changed the nesting structure
    if (response.data?.candidates?.[0]?.output?.text) {
        return response.data.candidates[0].output.text;
    }

    throw new Error("Response format mismatch or empty stream from Google API.");
}

// [Route] Roast Generator
app.get('/roast', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ status: false, error: "Missing parameter 'q'." });

    try {
        const systemPrompt = "You are Ayu's Roast Bot. You are extremely sarcastic and witty. Mix Hindi and English naturally (Hinglish). Deliver a short, sharp burn.";
        const output = await requestAI(systemPrompt, query);
        res.json({ status: true, creator: "Ayu", result: output });
    } catch (err) {
        rotateKey(); // Switch key for the next request
        res.status(500).json({ 
            status: false, 
            error: "Execution failed.",
            details: err.response ? err.response.data : err.message 
        });
    }
});

// [Route] Code Generation
app.get('/code', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ status: false, error: "Missing parameter 'q'." });

    try {
        const systemPrompt = "You are an elite software assistant. Provide clean, optimized, and production-ready code blocks inside markdown code fences.";
        const output = await requestAI(systemPrompt, query);
        res.json({ status: true, creator: "Ayu", result: output });
    } catch (err) {
        rotateKey(); // Switch key for the next request
        res.status(500).json({ 
            status: false, 
            error: "Execution failed.",
            details: err.response ? err.response.data : err.message 
        });
    }
});

export default app;
