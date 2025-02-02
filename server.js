// core module 
// const path = require('path');

// // our third party modules
import dotenv from "dotenv";
dotenv.config(); // Required in ES modules
import express from "express";
import cors from "cors";
import morgan from "morgan";
import multer from "multer";
import path from "path";
import {queryAssistant, voiceToText} from "./openai.js";
const app = express()
// chains of middlewares
app.use(cors());
app.use(morgan('dev'))
app.use(express.json())
const upload = multer({
    storage: multer.memoryStorage(), // Store file in memory
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    }
  });
  

const port = process.env.PORT || 5000
const smartSearch = async (req, res) => {
    try {
        console.log(req.body);

        if (req.file) {
            const text = await voiceToText(req.file.buffer);
            console.log("Transcribed text:", text);
            const response = await queryAssistant(text);
            console.log("Assistant's response:", response);
            return res.json({ answer: response });
        } else {
            console.log('Prompt:', req.body.prompt);
            const response = await queryAssistant(req.body.prompt);
            console.log("Assistant's response:", response);
            return res.json({ answer: response });
        }
    } catch (error) {
        console.error('Error processing audio:', error);
        return res.status(500).json({ error: 'Error processing audio file' });
    }
};
app.post('/openai', upload.single('audio'), smartSearch);
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
