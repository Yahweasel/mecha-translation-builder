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

import fetch from "node-fetch";
import * as legacy from "legacy-encoding";

import * as libCheck from "./lib-check.mjs";

const config = JSON.parse(await fs.readFile("config.json", "utf8"));

const MAX_RETRIES = 16;
const TEMPERATURE = +process.argv[2] || 0;

async function main() {
    const strings = JSON.parse(
        await fs.readFile("strings.json", "utf8")
    );

    let messages = [
        {
            role: "user",
            content: `I am going to give you a sequence of ${config.language} strings from a video game. Please translate them into English. Include only the translation in your messages, no other context.${config.suffix||""} If a given string seems to be gibberish, it may have been extracted incorrectly; in that case, respond with \`{"string": "ERROR"}\`. Because the strings are going to be replaced in the binary, your translations need to be short enough to be encoded in the same space; if a translation is too long, I'll request that you make it shorter. Do you understand?`
        }
    ];
    const req = {
        messages,
        seed: 1,
        temperature: TEMPERATURE
    };
    Object.assign(req, config.openaiCompletion || {});
    {
        const f = await fetch(`${config.openai.host}/v1/chat/completions`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify(req)
        });
        const completion = await f.json();
        messages.push(completion.choices[0].message);
    }

    let times = [];
    req.response_format = {
        type: "json_schema",
        json_schema: {
            schema: {
                type: "object",
                properties: {
                    string: {type: "string"}
                },
                required: ["string"]
            },
            strict: true
        }
    };

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

        let en = string.en2 || string.en;
        console.log(`\n${JSON.stringify(en)}`);

        messages = req.messages = messages.slice(0, 2);
        messages.push({
            role: "user",
            content: JSON.stringify({string: string.string})
        }, {
            role: "assistant",
            content: JSON.stringify({string: en})
        });

        let i;
        for (i = 0; i < MAX_RETRIES; i++) {
            en = string.en2 || string.en;
            const error = await libCheck.check(string, config);
            if (!error)
                break;

            console.log(error);

            if (error.warn === "LENGTH") {
                if (messages.length <= 4) {
                    messages.push({
                        role: "user",
                        content: error.msg
                    });
                } else {
                    messages.push({
                        role: "user",
                        content: "Still too long. Severely shorten it. Use abbreviations if necessary. Remove unnecessary words if the gist is still clear without them."
                    });
                }

            } else {
                messages.push({
                    role: "user",
                    content: error.msg
                });

            }

            //req.n_predict = en.length * 6;
            let completion;
            {
                const f = await fetch(`${config.openai.host}/v1/chat/completions`, {
                    method: "POST",
                    headers: {"content-type": "application/json"},
                    body: JSON.stringify(req)
                });
                completion = await f.json();
            }
            let ret = completion.choices[0].message;
            messages.push(ret);
            ret = JSON.parse(ret.content);
            string.en2 = ret.string
                .replace(/  */g, " ")
                .replace(/  *\n/g, "\n")
                .replace(/  *\r\n/g, "\r\n");
            console.log(`=> ${JSON.stringify(string.en2)}`);
        }

        if (i >= MAX_RETRIES)
            delete string.en2;

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
