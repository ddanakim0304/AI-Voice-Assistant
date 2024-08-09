const Microphone =  require("node-microphone");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmegpath = require("ffmpeg-static");
const readline = require("readline");
const axios = require("axios");
const FrormData = require("form-data");
const Speaker = require("speaker");
const OpenAI = require("openai");
require("dotenv").config();


// Set the path for FFmeg, used for audio processing
ffmpeg.setFfmpegPath(ffmegpath);

// Initialize the OpenAI API client
const secretKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
    apiKey: secretKey,
    });

    // Variables to store chat history and other components
    let chatHistory = []; // store chat history
    let mic, outputFile, micStream, rl; // Microphone, output file, microphone stream, and readline interface

    console.log("Welcome to the TTS Chatbot!");

const setupReadLineInterface = () => {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true // Make sure the terminal can capture keypress events
    });
}

readline.emitKeypressEvents(process.stdin, rl);

if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}

// Handle keypress events

process.stdin.on("keypress", (str, key) => {    
    if (key && 
        (key.name.toLowerCase() === "return" ||
        key.name.toLowerCase() === "enter")
    ) {
        if (micStream) {
            stopRecordingAndProcess();
        } else {
            startRecording();
        }
    } else if (key && key.ctrl && key.name === "c"){
        process.exit();
    } else if (key) {
        console.log ("Exiting the chatbot. Goodbye!");
        process.exit(0);
    }
});

console.log("Press 'Enter' to start chatting.");

const startRecording = () => {
    mic = new Microphone();
    outputFile = fs.createWritingStream("output.wav");
    micStream = mic.startRecording();

    micStream.on("data", (data) => {
        outputFile.write(data);
    });

    micStream.on("error", (error) => {
        console.error("Error: ", error);
    });
    console.log("Recording... Press Enter to stop")
}

// Function to stop recording and process the audio
const stopRecordingAndProcess = () => {
    mic.startRecording();
    outputFile.end();
    console.log("Recording stopped, process audio...");
    transcribeAndChat(); // Transcribe the audio and initiate chat
}

// Default voice setting for text-to-speech
const inputVoice = "echo";
const inputModel = "tts-1"; ////// change this to eleven labs!!


async function streamedAudio(
    inputText,
    model = inputModel,
    voice = inputVoice
) {
    const url = "https://api.openai.com/v1/audio/speech";
    const headers = {
        Authorization: `Bearer ${secretKey}`
    }
    const data = {
        model = model,
        input: inputText,
        voice: voice,
        response_format: "mp3",
    }

    try{
        // Make a POST request to the OpenAI audio API
        const response = await axios.post(url, data, {
            headers: headers,
            responseType: "stream",
        });

        // Configure speaker settings
        const speaker = new Speaker({
            channels: 2,
            bitDepth: 16,
            sampleRate: 44100,
        });

        // Convert the response to the desired audio format and play it
        ffmpeg(response.data)
        .toFormat("s16le")
        .audioChannels(2)
        .audioFrequency(44100)
        .pipe(speaker);
    } catch(error) {
        // Handle errors from the API or the audio processing
        if (error.response) {
            console.error (
                `Error with HTTP request: ${error.response.status} - ${error.response.statusText}`
            );
        } else {
            console.error(`Error in streamedAudio: ${error.message}`);
        }
    }
}

// Function to transcribe audio to text and send it to the chatbot
async function transcribeAndChat() {
    const filePath = "output.wav";
    // Prepare form data for the transcription request
    const form = new FromData();
    form.append("file", fs.createReadStream(filePath));
    form.append("model", "whisper-1")
    form.append("response_format", "text");

    try {
        // POst the audio file to OpenAI for transcription
        const transcriptionResponse = await axios.post(
            "https://api.openai.com/v1/audio/transcriptions",
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${secretKey}`,
                },
            }
        ):
        const transcribedText = transcriptionResponse.data;
        console.log(`>> You said: ${transcribedText}`);

        // Prepare messages for the chatbot, including the transcribed text
        const messages = [
            {
                role: "system",
                content:
                    "You are a helpful assistant providing concise responses in at most two sentences."
                    {/* change this!!!! -Dain*/},
            },
            ...chatHistory,
            {role: "user", content: transcribedText },
        ];

        // Send messages to the chatbot and get the response
        const chatResponse = await openai.chat.completions.create({
            messages: messages,
            model: "gpt-4o-mini"
        });

        // Extract the chat response
        const chatResponseText = chatResponse.choices[0].message.content;

        // Update chat history with the lastest interaction
        
    }
}


