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

const config = JSON.parse(await fs.readFile("config.json", "utf8"));

async function main() {
    let curFile = null;
    const bins = Object.create(null);
    let bin = null;
    const strings = JSON.parse(
        await fs.readFile("strings.json", "utf8")
    );

    const encodings = config.encoding;
    const encoding =
        (encodings instanceof Array)
            ? encodings[0]
            : encodings;

    for (const string of strings) {
        if (string.file !== curFile) {
            curFile = string.file;
            if (!(curFile in bins)) {
                const bak = `${string.file}.bak`;
                try {
                    bin = await fs.readFile(bak);
                } catch (ex) {
                    bin = await fs.readFile(curFile);
                    await fs.writeFile(bak, bin);
                }
                bins[curFile] = bin;
            } else {
                bin = bins[curFile];
            }
        }

        if (!string.en)
            continue;
        const stringLen = string.end - string.start;

        const en = string.en2 || string.en;

        if (en.trim() === "ERROR")
            continue;

        const strEnc = string.enc || encoding;
        let enc = legacy.encode(en.replace(/’/g, "'"), strEnc);

        if (enc.length > stringLen) {
            console.error(`String ${string.file}:${string.start} too long (>${stringLen})! “${en}”`);
            continue;
        }

        for (let i = 0; i < enc.length; i++)
            bin[string.start + i] = enc[i];

        if (
            config.spaceEnd === true ||
            (config.spaceEnd instanceof Array && config.spaceEnd.indexOf(strEnc) >= 0)
        ) {
            if (strEnc === "ucs2") {
                for (let i = enc.length; i < stringLen; i += 2) {
                    bin[string.start + i] = 0x20;
                    bin[string.start + i + 1] = 0;
                }

            } else {
                for (let i = enc.length; i < stringLen; i++)
                    bin[string.start + i] = 0x20;

            }

        } else {
            for (let i = enc.length; i < stringLen; i++)
                bin[string.start + i] = 0;

        }
    }

    for (const file in bins)
        await fs.writeFile(file, bins[file]);
}

main();
