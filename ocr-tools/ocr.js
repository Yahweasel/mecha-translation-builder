#!/usr/bin/env node
/*
 * Copyright (c) 2023-2025 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED “AS IS” AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

const config = require("./config.json");
process.env.GOOGLE_APPLICATION_CREDENTIALS = config.google;

const fs = require("fs/promises");
const sc = require("stream/consumers");
const util = require("util");

const OpenAI = require("openai");
const Sharp = require("sharp");

const openAIModel = "gpt-4o";

/**
 * OCR in.png using OpenAI.
 */
async function openAIVision() {
    const openai = new OpenAI({
        apiKey: config.openai
    });

    const img = new Sharp(await sc.buffer(process.stdin));
    const jpeg = await img
        .resize(2000, 768, {fit: "inside"})
        .toFormat("jpeg", {quality: 91})
        .toBuffer();
    const messages = [{
        role: "user",
        detail: "high",
        content: [
            {type: "text", text: "Please transcribe the text in this image, in any language. Only give me the transcription, no other context."},
            {
                type: "image_url",
                image_url: {url: "data:image/jpeg;base64," + jpeg.toString("base64")}
            }
        ]
    }];
    completion = await openai.chat.completions.create({
        model: openAIModel,
        messages
    });
    return completion.choices[0].message.content;
}

async function main() {
    try {
        // OCR the image
        const ocrN = await openAIVision();
        process.stdout.write(ocrN);

    } catch (err) {
        console.log("(OCR error)");
        console.log(err.message);
        process.exit(1);

    }
}
main();
