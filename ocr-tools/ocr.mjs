#!/usr/bin/env node
/*
 * Copyright (c) 2023-2026 Yahweasel
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

import * as cproc from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

import fetch from "node-fetch";
import sharp from "sharp";

const config = JSON.parse(await fs.readFile("config.json", "utf8"));

async function main() {
    const req = {
        seed: 1,
        temperature: 0,
        max_completion_tokens: 8192
    };
    Object.assign(req, config.openaiCompletionOCR || {});

    const ocr = [];

    const p = cproc.spawn(
        `${path.dirname(process.argv[1])}/eocr.py`,
        [JSON.stringify(config.easyocr.languages)],
        {
            stdio: ["pipe", "pipe", "inherit"]
        }
    );
    p.stdout.setEncoding("utf8");
    let pLines = [""];
    const prs = new ReadableStream({
        pull: async controller => {
            while (true) {
                if (pLines.length > 1) {
                    controller.enqueue(pLines.shift());
                    return;
                }

                const txt = await new Promise(res => {
                    p.stdout.once("data", res);
                });
                pLines[0] += txt;
                pLines = pLines[0].split("\n");
            }
        }
    });
    const pr = prs.getReader();

    for (const file of process.argv.slice(2)) {
        p.stdin.write(
            JSON.stringify({c: "ocr", file}) +
            "\n"
        );
        const eocrRes = JSON.parse((await pr.read()).value);

        const img = await fs.readFile(file);

        for (const para of eocrRes) {
            const eocrBbox = para[0];
            const bbox = [1/0, 1/0, 0, 0];
            for (const part of eocrBbox) {
                if (part[0] < bbox[0]) bbox[0] = part[0];
                if (part[1] < bbox[1]) bbox[1] = part[1];
                if (part[0] > bbox[2]) bbox[2] = part[0];
                if (part[1] > bbox[3]) bbox[3] = part[1];
            }

            const paraImg = await sharp(img)
                .extract({
                    left: bbox[0],
                    top: bbox[1],
                    width: bbox[2] - bbox[0],
                    height: bbox[3] - bbox[1]
                })
                .toFormat("jpeg", {quality: 91})
                .toBuffer();

            req.messages = [{
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${paraImg.toString("base64")}`
                        }
                    },
                    {
                        type: "text",
                        text: "Text Recognition:"
                    }
                ]
            }];

            const part = {
                file,
                bbox,
                string: para[1]
            };

            const f = await fetch(`${config.openai.host}/v1/chat/completions`, {
                method: "POST",
                headers: {"content-type": "application/json"},
                body: JSON.stringify(req)
            });
            const completion = await f.json();
            try {
                part.string = completion.choices[0].message.content.trim();
            } catch (ex) {
                part.ocrError = JSON.stringify(completion, null, 2);
            }

            console.log(part);
            ocr.push(part);

            await fs.writeFile("strings.json.tmp", JSON.stringify(ocr, null, 2));
            await fs.rename("strings.json.tmp", "strings.json");
        }
    }

    p.stdin.write('{"c":"exit"}\n');
}

await main();
