import express from 'express';
import axios from 'axios';
import PQueue from 'p-queue';

const app = express();

// 1. Request Queue Setup (Taaki Rate Limit na lage)
// concurrency: 2 ka matlab ek baar mein sirf 2 requests process hongi, baaki line (queue) mein rahengi.
const queue = new PQueue({ concurrency: 2 });

// 2. Multi-Token Rotation Setup
// Apne .env file mein GEMINI_KEY_1 aur GEMINI_KEY_2 dono set kar dena.
const API_KEYS = [
    process.env.GEMINI_KEY_1 || process.env.GEMINI_KEY, // Fallback to old key
    process.env.GEMINI_KEY_2
].filter(Boolean); // Sirf vahi keys lega jo active/present hain

let currentKeyIndex = 0;

// Function to get active token & rotate if one fails
function getApiKey() {
    if (API_KEYS.length === 0) return null;
    return API_KEYS[currentKeyIndex];
}

function rotateKey() {
    if (API_KEYS.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        console.log(`[System] API Key rotated! Now using Key Index: ${currentKeyIndex}`);
    }
}

// Dark & Savage Home Page
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px 20px; background: #0f0f0f; color: #ff0000; min-height: 100vh; box-sizing: border-box;">
            <h1 style="font-size: 3rem; text-shadow: 2px 2px #550000; margin-bottom: 10px;">🔥 AYU ROAST v3.0 ULTRA</h1>
            <p style="color: #eee; font-size: 1.2rem; margin-bottom: 30px;">Ab Roast, Code, aur Images... all in one! 💀</p>
            
            <div style="background: #1a1a1a; display: inline-block; padding: 25px; border-radius: 12px; border: 1px solid #333; text-align: left; max-width: 500px; width: 100%; box-sizing: border-box;">
                <b style="color: #fff; display: block; margin-bottom: 10px;">Available Endpoints:</b>
                <div style="margin-bottom: 15px;">
                    <span style="color: #00ffca;">⚡ Roast:</span> <code style="background:#222; padding:3px 6px; color:#fff;">/roast?q=TeraDost</code>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #00ffca;">💻 Write Code:</span> <code style="background:#222; padding:3px 6px; color:#fff;">/code?q=express server</code>
                </div>
                <div>
                    <span style="color: #00ffca;">🎨 Generate Image:</span> <code style="background:#222; padding:3px 6px; color:#fff;">/image?q=angry anime boy</code>
                </div>
            </div>
            <p style="margin-top: 40px; color: #888;">Engineered with Multi-Token Rotation & Auto-Queue 💉 by <b>Ayu</b></p>
        </div>
    `);
});

// Helper function to call Gemini API
async function callGemini(systemPrompt, userPrompt, isImageRequest = false) {
    const key = getApiKey();
    if (!key) throw new Error("API Keys missing!");

    // Image ke liye v1 stable endpoint use karein, text ke liye v1beta
    const version = isImageRequest ? 'v1' : 'v1beta';
    const model = isImageRequest ? 'imagen-3.0-generate-002' : 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${key}`;

    const payload = isImageRequest ? {
        contents: [{ parts: [{ text: userPrompt }] }]
    } : {
        contents: [{
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUser Request: ${userPrompt}` }]
        }]
    };

    try {
        const response = await axios.post(url, payload);
        return response.data;
    } catch (error) {
        if (error.response && (error.response.status === 429 || error.response.status === 401)) {
            console.warn(`[Warning] Rotating key due to status ${error.response.status}`);
            rotateKey();
            const retryKey = getApiKey();
            const retryUrl = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${retryKey}`;
            const retryResponse = await axios.post(retryUrl, payload);
            return retryResponse.data;
        }
        throw error;
    }
}


// 1. ROAST ROUTE
app.get('/roast', async (req, res) => {
    const prompt = req.query.q;
    if (!prompt) return res.json({ status: false, creator: "Ayu", error: "I need a target to roast. Please provide a name or topic in the query (q) parameter." });

    // Request ko queue ke andar daal diya taaki bari-bari execute ho
    await queue.add(async () => {
        try {
            const systemPrompt = "I Am Ayu's Roast Bot. I Am extremely sarcastic, funny, and savage. Use a mix of Hindi and English (Hinglish). Destroy the user's confidence with a witty one-liner or a short paragraph roast. Don't be polite. Keep it edgy.";
            const data = await callGemini(systemPrompt, prompt);
            
            const roastResult = data.candidates[0].content.parts[0].text;
            res.json({ status: true, creator: "Ayu", model: "Gemini 2.5 Flash", result: roastResult });
        } catch (error) {
            console.error(error.message);
            res.status(500).json({ status: false, creator: "Ayu", error: "Unable to process cammand. Please check your API configuration or try again." });
        }
    });
});

// 2. CODE ROUTE
app.get('/code', async (req, res) => {
    const prompt = req.query.q;
    if (!prompt) return res.json({ status: false, creator: "Ayu", error: "What code do you want to get written? Tell me in the query (q)." });

    await queue.add(async () => {
        try {
            const systemPrompt = "You are an expert developer AI assistant created by Ayu. Write clean, optimized, and well-commented code based on the user request. Provide brief explanations if needed.";
            const data = await callGemini(systemPrompt, prompt);

            const codeResult = data.candidates[0].content.parts[0].text;
            res.json({ status: true, creator: "Ayu", model: "Gemini 2.5 Flash", result: codeResult });
        } catch (error) {
            console.error(error.message);
            res.status(500).json({ status: false, creator: "Ayu", error: "Code generate error check server." });
        }
    });
});

// 3. IMAGE GENERATION ROUTE
app.get('/image', async (req, res) => {
    const prompt = req.query.q;
    if (!prompt) return res.json({ status: false, creator: "Ayu", error: "Please provide a prompt for the image you want to create in the query (q)." });

    await queue.add(async () => {
        try {
            // Imagen model se direct response call
            const data = await callGemini(null, prompt, true);
            
            // Image data extract karna (Base64 format mein aata hai Imagen se)
            const base64Image = data.candidates[0].content.parts[0].inlineData.data;
            const imageBuffer = Buffer.from(base64Image, 'base64');

            // Seedha image browser par render karwane ke liye headers set kiye
            res.setHeader('Content-Type', 'image/jpeg');
            res.send(imageBuffer);
        } catch (error) {
            console.error(error.response ? error.response.data : error.message);
            res.status(500).json({ 
                status: false, 
                creator: "Ayu", 
                error: "Image generation fail..  plz Check your api key." 
            });
        }
    });
});

export default app;
