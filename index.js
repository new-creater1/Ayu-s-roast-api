const express = require('express');
const axios = require('axios');
const app = express();

// 1. Home Page - Dark & Savage Theme
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 100px; background: #0f0f0f; color: #ff0000; height: 100vh;">
            <h1 style="font-size: 3rem; text-shadow: 2px 2px #550000;">🔥 AYU ROAST v2.5</h1>
            <p style="color: #eee; font-size: 1.2rem;">Kiski bezatti karni hai aaj? 💀</p>
            <div style="background: #222; display: inline-block; padding: 20px; border-radius: 10px; border: 1px solid #444;">
                <code>Usage: /roast?q=TeraDost</code>
            </div>
            <p style="margin-top: 30px; color: #888;">Made with 💉 by <b>Ayu</b></p>
        </div>
    `);
});

// 2. Roast Route - 2.5 Flash Optimized
app.get('/roast', async (req, res) => {
    const prompt = req.query.q;
    const key = process.env.GEMINI_KEY;

    if (!prompt) {
        return res.json({ 
            status: false, 
            creator: "Ayu", 
            error: "Bhai, bina naam ke hawa me roast karu kya? Query (q) daal!" 
        });
    }

    try {
        // Strict Roast Instructions for 2.5 Flash
        const systemPrompt = "I Am Ayu's Roast Bot. I Am extremely sarcastic, funny, and savage. Use a mix of Hindi and English (Hinglish). If a user gives a name or text, destroy their confidence with a witty one-liner or a short paragraph roast. Don't be polite. Keep it edgy.";

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
            {
                contents: [{
                    role: "user",
                    parts: [{
                        text: `${systemPrompt}\n\nTarget to roast: ${prompt}`
                    }]
                }]
            }
        );
        
        // Checking if response has candidates
        const roastResult = response.data.candidates[0].content.parts[0].text;
        
        res.json({ 
            status: true, 
            creator: "Ayu", 
            model: "Gemini 2.5 Flash",
            result: roastResult 
        });

    } catch (error) {
        // Detailed error for Vercel logs but clean for user
        console.error(error.response ? error.response.data : error.message);
        
        res.status(200).json({ 
            status: false, 
            creator: "Ayu", 
            error: "Lagta hai saamne wale ki kismat achi hai, API ne mana kar diya!",
            msg: "Check if your api 2.5 Key is active."
        });
    }
});

module.exports = app;
