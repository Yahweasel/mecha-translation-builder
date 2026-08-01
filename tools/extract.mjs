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

import * as ex from "./lib-extract.mjs";

import * as fs from "fs/promises";

async function main() {
    const strings = [];
    let files = process.argv.splice(2);
    if (files.length === 0)
        files = ex.config.files;

    let encodings = ex.config.encoding;
    if (!(encodings instanceof Array))
        encodings = [encodings];

    for (const file of files) {
        let found = 0;
        const bin = await fs.readFile(file);
        for (let idx = 0; idx < bin.length; idx++) {
            if (idx % 1000 === 0)
                process.stderr.write(`${file} ${idx}/${bin.length}...\r`);
            for (const encoding of encodings) {
                const [isString, eIdx, string] = ex.findString(bin, idx, encoding);
                if (isString) {
                    const sDat ={
                        file,
                        start: idx,
                        end: eIdx,
                        raw: bin.slice(idx, eIdx).toString("binary"),
                        string
                    };
                    if (encodings.length > 1)
                        sDat.enc = encoding;
                    strings.push(sDat);
                    idx = eIdx;
                    found += string.length;
                    break;
                }
            }
        }
        process.stderr.write("\n");
    }

    process.stdout.write(JSON.stringify(strings, null, 2));
    process.stdout.write("\n");
}

main();
