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
    const strings = [];
    let encodings = config.encoding;
    if (!(encodings instanceof Array))
        encodings = [encodings];

    const orig = process.argv[2].replace(/\\0/g, "\0");
    let origString = orig;
    let nullTerm = false;
    if (orig.endsWith("\0")) {
        nullTerm = true;
        origString = orig.slice(0, -1);
    }

    for (const encoding of encodings) {
        const string = legacy.encode(orig, encoding);
        let nullSub = 0;
        if (nullTerm) {
            if (encoding === "ucs2" /* FIXME: more general check */) {
                nullSub = 2;
            } else {
                nullSub = 1;
            }
        }

        for (const file of process.argv.slice(3)) {
            const bin = await fs.readFile(file);
            for (let idx = 0; idx < bin.length - string.length; idx++) {
                if (bin[idx] !== string[0])
                    continue;
                let part = bin.slice(idx, idx + string.length);
                if (string.equals(part)) {
                    //console.log(`(${encoding}) Found in ${file} at ${idx}/0x${idx.toString(16)}`);
                    if (nullTerm)
                        part = part.slice(0, -nullSub);
                    const strDat = {
                        file,
                        start: idx,
                        end: idx + part.length,
                        raw: part.toString("binary"),
                        string: origString
                    };
                    if (encodings.length > 1)
                        strDat.enc = encoding;
                    strings.push(strDat);
                }
            }
        }
    }

    //console.log(JSON.stringify(strings, null, 2));
    console.log("[");
    for (let si = 0; si < strings.length; si++) {
        let line = "  " + JSON.stringify(strings[si]);
        if (si !== strings.length - 1)
            line += ",";
        console.log(line);
    }
    console.log("]");
}


main();
