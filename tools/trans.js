#!/usr/bin/env node
/*
 * Copyright (c) 2025 Yahweasel
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

const fs = require("fs/promises");

const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: config.openai
});
const openaiModel = "gpt-4o";

async function main() {
    const strings = JSON.parse(
        await fs.readFile("strings.json", "utf8")
    );

    // Get our previous messages
    let log = {tokens: [], messages: []};
    try {
        log = JSON.parse(
            await fs.readFile("chat.json", "utf8")
        );
    } catch (ex) {}
    const messages = log.messages;

    // Maybe make the initial message
    if (messages.length === 0) {
        messages.push({
            role: "user",
            content: "I am going to give you a sequence of German strings from a video game. Please translate them into English. Include only the translation in your messages, no other context. These strings are from the code, so may have special seqeuences of the form $(...) and %(...); please leave those sequences intact. Do you understand?"
        });
        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages
        });
        messages.push(completion.choices[0].message);
        log.tokens = [
            completion.usage.prompt_tokens,
            completion.usage.completion_tokens
        ];
    }

    let translated = 0;

    // Go through the strings
    for (const string of strings) {
        if (string.en) {
            // Already translated
            continue;
        }

        // Check our token count
        let totalTokens = log.tokens.reduce((a, b) => a + b, 0);
        while (totalTokens >= 1000 && messages.length >= 4) {
            totalTokens -= log.tokens[2] + log.tokens[3];
            log.tokens.splice(2, 2);
            messages.splice(2, 2);
        }

        // Expand out the special sequences
        const de = string.string
            .replace(/%([0-9]*[a-zA-Z])/g, "%($1)")
            .replace(/\$([0-9][a-zA-Z][0-9])/g, "$($1)")
            .replace(/\$([a-zA-Z])/g, "$($1)");

        // Now add this line
        messages.push({
            role: "user",
            content: de
        });

        // And translate
        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages
        });
        const enRaw = completion.choices[0].message.content;
        string.enRaw = enRaw;
        const en = enRaw
            .replace(/([\$%])\(([0-9]*[a-zA-Z][0-9]*)\)/g, "$1$2");
        string.en = en;

        console.log(`\n${string.string}\n =>\n${en}`);

        // Log the cost
        log.tokens.push(completion.usage.prompt_tokens - totalTokens);
        messages.push(completion.choices[0].message);
        log.tokens.push(completion.usage.completion_tokens);

        // Save everything
        await fs.writeFile("chat.json.tmp", JSON.stringify(log, null, 2));
        await fs.rename("chat.json.tmp", "chat.json");
        await fs.writeFile("strings.json.tmp", JSON.stringify(strings, null, 2));
        await fs.rename("strings.json.tmp", "strings.json");

        /*
        // And maybe stop
        if (++translated >= 256)
            break;
        */
    }
}

main();
