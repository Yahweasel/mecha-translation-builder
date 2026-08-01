#!/usr/bin/env node
/*
 * Copyright (c) 2025, 2026 Yahweasel
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

import * as fs from "fs/promises";

import OpenAI from "openai";

import * as libCheck from "./lib-check.mjs";

const config = JSON.parse(await fs.readFile("config.json", "utf8"));
const openai = new OpenAI(config.openai);

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
    const req = {
        messages
    };
    Object.assign(req, config.openaiCompletion || {});

    // Maybe make the initial message
    if (messages.length === 0) {
        messages.push({
            role: "user",
            content: `I am going to give you a sequence of ${config.language} strings from a video game. Please translate them into English. Include only the translation in your messages, no other context.${config.suffix||""} If a given string seems to be gibberish, it may have been extracted incorrectly; in that case, respond with “ERROR”. Do you understand?`
        });
        const completion = await openai.chat.completions.create(req);
        messages.push(completion.choices[0].message);
        log.tokens = [
            completion.usage.prompt_tokens,
            completion.usage.completion_tokens
        ];
    }

    let times = [];

    let saveP = Promise.all([]);

    // Go through the strings
    for (let si = 0; si < strings.length; si++) {
        const string = strings[si];
        if (string.en) {
            // Already translated
            continue;
        }

        const start = performance.now();

        // Check our token count
        let totalTokens = log.tokens.reduce((a, b) => a + b, 0);
        if (totalTokens >= 2048) {
            while (totalTokens >= 1024 && messages.length >= 4) {
                totalTokens -= log.tokens[2] + log.tokens[3];
                log.tokens.splice(2, 2);
                messages.splice(2, 2);
            }
        }

        const orig = string.string
            .replace(/\x1b(.)/g, "(%$1)");

        // Now add this line
        messages.push({
            role: "user",
            content: orig
        });

        // Put the actual request late, so that the AI is constantly reminded
        req.messages = messages;
        if (messages.length > 3) {
            req.messages = [].concat(
                messages.slice(2, -1),
                messages.slice(0, 2),
                messages.slice(-1)
            );
        }

        // And translate
        let completion, enRaw, en;
        for (let tries = 0; tries < 16; tries++) {
            req.seed = 1 + tries;
            completion = await openai.chat.completions.create(req);
            enRaw = completion.choices[0].message.content;
            en = enRaw
                .replace(/\(%(.)\)/g, "\x1b$1");
            string.enRaw = enRaw;
            string.en = en;
            if (libCheck.check(string, config) !== "SPECIALS")
                break;
        }

        console.log(`\n${orig}\n =>\n${enRaw}`);

        // Log the cost
        log.tokens.push(completion.usage.prompt_tokens - totalTokens);
        messages.push(completion.choices[0].message);
        log.tokens.push(completion.usage.completion_tokens);

        // Save everything
        await saveP;
        saveP = (async () => {
            await fs.writeFile("chat.json.tmp", JSON.stringify(log, null, 2));
            await fs.writeFile("strings.json.tmp", JSON.stringify(strings, null, 2) + "\n");
            await fs.rename("chat.json.tmp", "chat.json");
            await fs.rename("strings.json.tmp", "strings.json");
        })();

        times.push(performance.now() - start);

        while (times.length > 8)
            times.shift();

        {
            let avg = 0;
            for (const time of times)
                avg += time;
            avg = Math.round(avg / times.length);

            let remaining = avg * (strings.length - si - 1);
            let rs = "ms";
            if (remaining > 1000) {
                remaining = Math.round(remaining / 1000);
                rs = "s";
                if (remaining > 90) {
                    remaining = Math.round(remaining / 60);
                    rs = "m";
                    if (remaining > 90) {
                        remaining = Math.round(remaining / 60);
                        rs = "h";
                    }
                }
            }

            console.log(`${si+1}/${strings.length} (${remaining}${rs} remaining)`);
        }
    }

    await saveP;
}

main();
