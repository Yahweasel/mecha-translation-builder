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
    const strings = [];
    for (let idx = 0; idx < fugger2.length; idx++) {
        let eIdx = idx;
        for (;
            fugger2[eIdx] >= 0x20 ||
            fugger2[eIdx] === 0x0A ||
            fugger2[eIdx] === 0x0D;
            eIdx++) {}

        let isString = false;
        if (eIdx >= idx) {
            // Check whether a fair portion of them are actually letters
            let letters = 0;
            for (let li = idx; li < eIdx; li++) {
                const c = fugger2[li];
                if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A))
                    letters++;
            }
            if (letters >= 3 && (letters / (eIdx - idx)) >= 0.65)
                isString = true;
        }

        if (isString) {
            const ibm850 = fugger2.slice(idx, eIdx);
            const string = legacy.decode(ibm850, "ibm850");
            strings.push({
                start: idx,
                end: eIdx,
                raw: ibm850.toString("binary"),
                string
            });
            idx = eIdx;
        }
    }
    process.stdout.write(JSON.stringify(strings, null, 2));
    process.stdout.write("\n");
}

main();
