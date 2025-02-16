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

const fs = require("fs/promises");

const legacy = require("legacy-encoding");

async function main() {
    const fugger2 = await fs.readFile("FUGGER2.EXE");
    const strings = JSON.parse(
        await fs.readFile("strings.json", "utf8")
    );

    for (const string of strings) {
        if (!string.en)
            continue;
        const stringLen = string.end - string.start;

        const en = string.en2 || string.en;
        const enc = legacy.encode(en.replace(/’/g, "'"), "ibm850");

        if (enc.length > stringLen) {
            console.error(`String ${string.start} too long (>${stringLen})! “${en}”`);
            continue;
        }

        for (let i = 0; i < stringLen; i++)
            fugger2[string.start + i] = enc[i] || 0;
    }

    await fs.writeFile("FUGGEREN.EXE", fugger2);
}

main();
