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

import * as legacy from "legacy-encoding";
import OpenAI from "openai";

import * as libCheck from "./lib-check.mjs";

const config = JSON.parse(await fs.readFile("config.json", "utf8"));
const openai = new OpenAI(config.openai);

const MAX_RETRIES = 16;

async function main() {
    const encodings = config.encoding;
    const defaultEncoding =
        (encodings instanceof Array)
            ? encodings[0]
            : encodings;

    const strings = JSON.parse(
        await fs.readFile("strings.json", "utf8")
    );

    let messages = [
        {
            role: "user",
            content: `I am going to give you a sequence of ${config.language} strings from a video game. Please translate them into English. Include only the translation in your messages, no other context.${config.suffix||""} If a given string seems to be gibberish, it may have been extracted incorrectly; in that case, respond with “ERROR”. Because the strings are going to be replaced in the binary, your translations need to be short enough to be encoded in the same space; if a translation is too long, I'll request that you make it shorter. Do you understand?`
        }
    ];
    const req = {messages};
    Object.assign(req, config.openaiCompletion || {});
    {
        const completion = await openai.chat.completions.create(req);
        messages.push(completion.choices[0].message);
    }

    let times = [];

    for (let si = 0; si < strings.length; si++) {
        const string = strings[si];
        if (!string.en)
            continue;

        const start = performance.now();

        let encoding = string.enc;
        if (!encoding)
            encoding = config.encoding;
        if (encoding instanceof Array)
            encoding = encoding[0];

        const en = string.en2 || string.en;
        console.log(`\n${en}`);

        messages = req.messages = messages.slice(0, 2);
        messages.push({
            role: "user",
            content: string.string.replace(/\x1b(.)/g, "(%$1)")
        }, {
            role: "assistant",
            content: en
        });

        let i;
        for (i = 0; i < MAX_RETRIES; i++) {
            const error = await libCheck.check(string, config);
            if (!error)
                break;

            console.log(error);

            if (error === "SPECIALS") {
                /*
                const origSpecials =
                    libCheck.specials(string.string, /[\x1b%]./g)
                    .replace(/\x1b(.)/g, "(%$1)");
                const enSpecials =
                    libCheck.specials(en, /[\x1b%]./g)
                    .replace(/\x1b(.)/g, "(%$1)");
                */
                const origSpecials = libCheck.specials(string.string, /%./g);
                const enSpecials = libCheck.specials(en, /%./g);

                messages.push({
                    role: "user",
                    content: `The special sequences in your translation are incorrect. The exact same sequence of special sequences must be in your translation, even if that makes the translation awkward. Special sequeences in the original string: "${origSpecials}". Special sequences in your string: "${enSpecials}". Provide a corrected translation with the special sequences intact.`
                });

            } else if (error === "LENGTH") {
                if (messages.length <= 4) {
                    messages.push({
                        role: "user",
                        content: "Too long. Shorten and/or abbreviate."
                    });
                } else {
                    messages.push({
                        role: "user",
                        content: "Still too long. Severely shorten it. Use abbreviations if necessary. Remove unnecessary words if the gist is still clear without them."
                    });
                }

            } else if (error === "UNTRANSLATED") {
                if (i === 0) {
                    // It didn't cause this
                    break;
                }

                messages.push({
                    role: "user",
                    content: "I need a fully English string. Give me the English translation."
                });

            } else if (error === "UNENCODEABLE") {
                const en = string.en2 || string.en;
                const thruEnc = legacy.decode(legacy.encode(en, encoding), encoding);
                let i;
                for (i = 0; i < en.length; i++) {
                    if (en[i] !== thruEnc[i]) {
                        messages.push({
                            role: "user",
                            content: `Unfortunately the character ‘${en[i]}’ is not encodeable. Please rephrase to avoid it.`
                        });
                        break;
                    }
                }
                if (i === en.length) {
                    console.error(en);
                    console.error(thruEnc);
                    process.exit(1);
                }

            } else {
                break;

            }

            req.n_predict = en.length * 6;
            const completion = await openai.chat.completions.create(req);
            const ret = completion.choices[0].message;
            messages.push(ret);
            string.en2 = ret.content
                .replace(/\(%(.)\)/g, "\x1b$1")
                .replace(/  */g, " ")
                .replace(/  *\n/g, "\n");
            console.log(`=> ${string.en2}`);
        }

        if (i >= MAX_RETRIES) {
            if (string.en === en)
                delete string.en2;
            else
                string.en2 = en;
        }

        if (i > 0) {
            await fs.writeFile("strings.json.tmp", JSON.stringify(strings, null, 2) + "\n");
            await fs.rename("strings.json.tmp", "strings.json");
        }

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

}

main();
