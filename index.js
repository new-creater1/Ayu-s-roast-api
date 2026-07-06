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

// Ultra Clean HTML Dashboard
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; background:#0a0a0a; color:#fff; text-align:center; padding-top:100px;">
            <h1 style="color:#ff3333;">AYU ENGINE v3.6</h1>
            <p style="color:#888;">All Systems Live &bull; Active Keys: ${API_KEYS.length}</p>
            <div style="background:#111; border:1px solid #222; display:inline-block; padding:20px; border-radius:8px;">
                <code>/roast?q=Target</code> | <code>/code?q=Prompt</code>
            </div>
        </body>
    `);
});

// Universal Request Processor with Fallback Loop
async function requestAI(systemPrompt, userPrompt) {
    let currentKey = getActiveKey();
    if (!currentKey) throw new Error("No active credentials configured.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentKey}`;
    
    const payload = {
        contents: [{
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUser Request: ${userPrompt}` }]
        }]
    };

    try {
        const response = await axios.post(url, payload, { timeout: 15000 });
        return response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
        const status = error.response?.status;
        console.error(`[API Error] Status: ${status} | Message: ${error.message}`);

        // If rate limited or unauthenticated, cycle the token and immediately retry
        if (status === 429 || status === 401) {
            rotateKey();
            const fallbackKey = getActiveKey();
            const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${fallbackKey}`;
            
            const retryResponse = await axios.post(fallbackUrl, payload, { timeout: 15000 });
            return retryResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        }
        throw error;
    }
}

// [Route] Roast Generator
app.get('/roast', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ status: false, error: "Missing query parameter 'q'." });

    try {
        const systemPrompt = "You are Ayu's Roast Bot. You are extremely sarcastic, brilliant, and witty. Mix Hindi and English words naturally (Hinglish). Deliver a short, sharp, and lethal burn or one-liner that destroys the user's confidence cleanly. Keep it edgy but modern.";
        const output = await requestAI(systemPrompt, query);
        
        if (!output) throw new Error("Empty model output stream.");
        res.json({ status: true, creator: "Ayu", result: output });
    } catch (err) {
        res.status(500).json({ status: false, error: "Processing failure.." });
    }
});

// [Route] Code Generation
app.get('/code', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ status: false, error: "Missing query parameter 'q'." });

    try {
        const systemPrompt = "You are an elite software architecture assistant engineered by Ayu. Provide exceptionally clean, scalable, and optimized code solutions. Use markdown code fences and include production-ready execution advice.";
        const output = await requestAI(systemPrompt, query);
        
        if (!output) throw new Error("Empty model output stream.");
        res.json({ status: true, creator: "Ayu", result: output });
    } catch (err) {
        res.status(500).json({ status: false, error: "Processing failure.." });
    }
});

export default app;
