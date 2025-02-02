import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config(); 

const ASSISTANT_ID = process.env.ASSISTANT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!ASSISTANT_ID ) {
  console.error("Missing OpenAI API key or assistant ID");
  process.exit(1);
}


const openai = new OpenAI({
  apiKey: OPENAI_API_KEY, // Replace with your API key
});
const assistantId = ASSISTANT_ID; // Replace with your assistant ID
async function queryAssistant(userQuery) {

  try {
    // Create a thread and run the assistant in a single request
    const run = await openai.beta.threads.createAndRun({
      assistant_id: assistantId,
      thread: {
        messages: [
          {
            role: "user",
            content: userQuery,
          },
        ],
      },
    });
    // console.log(run);
    // Wait for completion
    let runStatus = await openai.beta.threads.runs.retrieve(run.thread_id, run.id);
    while (runStatus.status === "in_progress" || runStatus.status === "queued") {
      await new Promise((resolve) => setTimeout(resolve, 100));
      runStatus = await openai.beta.threads.runs.retrieve(run.thread_id, run.id);
    }

    // Get the response
    const messages = await openai.beta.threads.messages.list(run.thread_id);
    const lastMessage = messages.data[0];
    if (!lastMessage || !lastMessage.content.length) {
      throw new Error("No response received");
    }

    const messageContent = lastMessage.content[0];
    if (messageContent.type !== "text") {
      throw new Error("Response is not in text format");
    }

    const response = messageContent.text.value;

    // Clean up by deleting the thread (optional)
    await openai.beta.threads.del(run.thread_id);

    return response;
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

async function voiceToText(data) {
  // Create a temporary file path
  const tempFilePath = path.join(__dirname, 'temp_audio.wav');
  fs.writeFileSync(tempFilePath, data);

  try {
      // Transcribe the audio file using Whisper
      const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: "whisper-1",
      });
      fs.unlinkSync(tempFilePath);
      return transcription.text;
  } catch (error) {
      fs.unlinkSync(tempFilePath);
      throw error;
  }
}


export { queryAssistant,voiceToText };
