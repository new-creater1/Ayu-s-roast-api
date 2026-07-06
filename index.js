import express from 'express';
import axios from 'axios';
import PQueue from 'p-queue';

const app = express();

// Global configuration
const PORT = process.env.PORT;
const queue = new PQueue({ concurrency: 2 });

const API_KEYS = [
    process.env.GEMINI_KEY_1 || process.env.GEMINI_KEY,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3 
].filter(Boolean);

let currentKeyIndex = 0;

function rotateKey() {
    if (API_KEYS.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        console.log(`[System] Load Balancer: Switched to API Key Index [${currentKeyIndex}]`);
    }
}

async function callGeminiWithRetry(systemPrompt, userPrompt) {
    if (API_KEYS.length === 0) {
        throw new Error("Initialization failed: No valid Gemini API keys found in environment.");
    }

    let attempts = 0;
    const maxAttempts = API_KEYS.length;

    while (attempts < maxAttempts) {
        const activeKey = API_KEYS[currentKeyIndex];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
        
        const payload = {
            contents: [{
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nUser Request: ${userPrompt}` }]
            }]
        };

        try {
            const response = await axios.post(url, payload, { timeout: 10000 });
            return response.data;
        } catch (error) {
            const statusCode = error.response?.status;
            
            // Trigger seamless key rotation for Rate Limit (429) or Auth Issues (401)
            if (statusCode === 429 || statusCode === 401) {
                console.warn(`[Warning] Key Index [${currentKeyIndex}] returned status ${statusCode}. Executing failover...`);
                rotateKey();
                attempts++;
            } else {
                // Throw immediately for syntax or structure failures
                throw error;
            }
        }
    }

    throw new Error("Exhausted all configured API tokens. Rate limits exceeded globally.");
}

// Minimalistic Clean Dashboard Landing Page
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AYU ROAST API Engine</title>
            <style>
                body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0a0a; color: #e0e0e0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                .container { background: #111; padding: 40px; border-radius: 12px; border: 1px solid #222; max-width: 480px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h1 { font-size: 2rem; color: #ff3333; margin-top: 0; letter-spacing: 1px; }
                p { color: #aaa; font-size: 1rem; line-height: 1.5; }
                .endpoint-box { background: #181818; padding: 15px; border-radius: 8px; border: 1px solid #2a2a2a; margin-top: 25px; text-align: left; }
                code { background: #252525; padding: 4px 8px; border-radius: 4px; color: #00ffca; font-size: 0.9rem; }
                .footer { margin-top: 30px; font-size: 0.8rem; color: #555; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>AYU ENGINE v3.5</h1>
                <p>Enterprise-grade routing engine with multi-token rotation and adaptive rate-limiting.</p>
                <div class="endpoint-box">
                    <div style="margin-bottom: 12px;">⚡ <b>Roast:</b> <code>/roast?q=Name</code></div>
                    <div>💻 <b>Code:</b> <code>/code?q=ExpressServer</code></div>
                </div>
                <div class="footer">Engineered by Ayu Godz &bull; All Systems Operational</div>
            </div>
        </body>
        </html>
    `);
});

// [Endpoint] Roast Generator
app.get('/roast', async (req, res) => {
    const prompt = req.query.q?.trim();
    if (!prompt) {
        return res.status(400).json({ status: false, creator: "Ayu", error: "Missing query parameter 'q'." });
    }

    await queue.add(async () => {
        try {
            const systemPrompt = "You are Ayu's Roast Bot. You are extremely sarcastic, brilliant, and witty. Mix Hindi and English words naturally (Hinglish). Deliver a short, sharp, and lethal burn or one-liner that destroys the user's confidence cleanly. Keep it edgy but modern.";
            const data = await callGeminiWithRetry(systemPrompt, prompt);
            
            const resultText = data.candidates[0].content.parts[0].text;
            res.json({ status: true, creator: "Ayu", engine: "Gemini 2.5 Flash", result: resultText });
        } catch (error) {
            console.error(`[Error] /roast routing failure: ${error.message}`);
            res.status(500).json({ status: false, creator: "Ayu", error: "Internal processing fault. Key pool exhausted." });
        }
    });
});

// [Endpoint] Code Optimizer
app.get('/code', async (req, res) => {
    const prompt = req.query.q?.trim();
    if (!prompt) {
        return res.status(400).json({ status: false, creator: "Ayu", error: "Missing query parameter 'q'." });
    }

    await queue.add(async () => {
        try {
            const systemPrompt = "You are an elite software architecture assistant engineered by Ayu. Provide exceptionally clean, scalable, and optimized code solutions. Use markdown code fences and include production-ready execution advice.";
            const data = await callGeminiWithRetry(systemPrompt, prompt);

            const resultText = data.candidates[0].content.parts[0].text;
            res.json({ status: true, creator: "Ayu", engine: "Gemini 2.5 Flash", result: resultText });
        } catch (error) {
            console.error(`[Error] /code routing failure: ${error.message}`);
            res.status(500).json({ status: false, creator: "Ayu", error: "Internal processing fault.." });
        }
    });
});

export default app;
