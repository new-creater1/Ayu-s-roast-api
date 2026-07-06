import express from 'express';

const app = express();

// Performance and Concurrency Tuning
const MAX_CONCURRENT_JOBS = 1; 
const ANTI_FLOOD_DELAY = 1200; // 1.2s cooldown between requests
const API_TIMEOUT_LIMIT = 8200; // Drops hanging calls safely at 8.2s to prevent Vercel 504 crash

const API_KEYS = [
    process.env.GEMINI_KEY_1 || process.env.GEMINI_KEY,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3
].filter(Boolean);

let currentKeyIndex = 0;
const memoryQueue = [];
let processingUnitsActive = 0;

function rotateKey() {
    if (API_KEYS.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        console.log(`[LoadBalancer] Shifted actively to Key Index: ${currentKeyIndex}`);
    }
}

function processQueue(task) {
    return new Promise((resolve, reject) => {
        memoryQueue.push({ task, resolve, reject });
        shiftQueueExecutor();
    });
}

async function shiftQueueExecutor() {
    if (processingUnitsActive >= MAX_CONCURRENT_JOBS || memoryQueue.length === 0) return;

    processingUnitsActive++;
    const { task, resolve, reject } = memoryQueue.shift();

    try {
        const result = await task();
        resolve(result);
    } catch (err) {
        reject(err);
    } finally {
        processingUnitsActive--;
        setTimeout(() => shiftQueueExecutor(), ANTI_FLOOD_DELAY);
    }
}

async function executeAIStream(systemPrompt, userPrompt) {
    const activeKey = API_KEYS[currentKeyIndex];
    if (!activeKey) throw new Error("Credentials missing inside cloud environment variables.");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    
    const payload = {
        contents: [{
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nTarget Specification: ${userPrompt}` }]
        }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
            temperature: 0.3, // Keeps the code structured, logical, and extremely fast
            maxOutputTokens: 2048
        }
    };

    const abortController = new AbortController();
    const timeoutSignal = setTimeout(() => abortController.abort(), API_TIMEOUT_LIMIT);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal
        });

        clearTimeout(timeoutSignal);

        if (!response.ok) {
            const errorDump = await response.text();
            throw new Error(`HTTP_${response.status}: ${errorDump}`);
        }

        const data = await response.json();
        const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!extractedText) throw new Error("Empty processing response returned from engine.");
        return extractedText;

    } catch (error) {
        clearTimeout(timeoutSignal);
        throw error;
    }
}

app.get('/', (req, res) => {
    res.send(`<body style="background:#0a0a0a;color:#fff;text-align:center;font-family:sans-serif;padding-top:100px;">
        <h1 style="color:#00ffca;">AYU CORE CONTROLLER v5.0</h1>
        <p style="color:#666;">Synchronous Thread Isolation Active &bull; Monitored Nodes: ${API_KEYS.length}</p>
    </body>`);
});

app.get('/roast', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ status: false, error: "Query parameter 'q' is mandatory." });

    try {
        const sysInstructions = "You are Ayu's Custom Roast Module. Deliver a single highly sarcastic, incredibly sharp, and raw conversational roast line. Rely entirely on a natural mix of Hinglish. Do not look like a formal AI model.";
        const output = await processQueue(() => executeAIStream(sysInstructions, query));
        res.json({ status: true, creator: "Ayu", result: output });
    } catch (err) {
        rotateKey();
        res.status(500).json({ status: false, error: "Pipeline processing dropped.", diagnostic: err.message });
    }
});

app.get('/code', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ status: false, error: "Query parameter 'q' is mandatory." });

    try {
        const sysInstructions = "You are an elite senior software architect. Provide fully functional, complete, and production-ready code files. Never truncate code, never shorten scripts, and never use shortcuts like '// write code here'. Start directly with markdown code fences. Keep technical explanations down to a bare minimum, focusing 95% on delivering full-length code blocks.";
        const output = await processQueue(() => executeAIStream(sysInstructions, query));
        res.json({ status: true, creator: "Ayu", result: output });
    } catch (err) {
        rotateKey();
        res.status(500).json({ status: false, error: "Pipeline processing dropped.", diagnostic: err.message });
    }
});

export default app;
