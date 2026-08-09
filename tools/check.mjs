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

import * as libCheck from "./lib-check.mjs";

const config = JSON.parse(await fs.readFile("config.json", "utf8"));

async function main() {
    const encodings = config.encoding;
    const defaultEncoding =
        (encodings instanceof Array)
            ? encodings[0]
            : encodings;

    const strings = JSON.parse(
        await fs.readFile("strings.json", "utf8")
    ).sort((a, b) => {
        if (a.file < b.file)
            return -1;
        else if (b.file < a.file)
            return 1;
        else if (a.start < b.start)
            return -1;
        else if (a.start > b.start)
            return 1;
        else if (a.end < b.end)
            return -1;
        else if (a.end > b.end)
            return 1;
        return 0;
    });

    let translated = 0;
    let bad = 0, tooLong = 0, mismatch = 0, unenc = 0, untr = 0, overlap = 0;
    let prev = null;
    for (const string of strings) {
        if (!string.en)
            continue;
        const encoding = string.enc || defaultEncoding;
        translated++;
        const stringLen = string.end - string.start;

        if (string.WARN) {
            delete string.WARN;
            delete string.enx;
        }

        // Check for overlaps
        if (prev && prev.file === string.file && string.start < prev.end) {
            bad++;
            overlap++;
            string.WARN = "OVERLAP";
            continue;
        }
        prev = string;

        const en = string.en2 || string.en;

        const warn = libCheck.check(string, config);
        if (warn === null)
            continue;
        bad++;
        string.WARN = warn;
        if (!string.en2)
            string.en2 = string.en;

        // Give more info
        switch (warn.warn) {
            case "UNTRANSLATED":
                untr++;
                break;

            case "SPECIALS":
            {
                mismatch++;
                const origSpecials = libCheck.specials(string.string, libCheck.specialsRe);
                const enSpecials = libCheck.specials(en, libCheck.specialsRe);
                string.WARN = `SPECIALS MISMATCH ${JSON.stringify(origSpecials)} v. ${JSON.stringify(enSpecials)}`;
                break;
            }

            case "UNENCODEABLE":
            {
                unenc++;
                const thruEnc = legacy.decode(legacy.encode(en, encoding), encoding);
                string.WARN = `UNENCODABLE: ${thruEnc} v. ${en}`
                break;
            }

            case "LENGTH":
            {
                tooLong++;

                const enc = legacy.encode(
                    en.replace(/’/g, "'"), encoding
                );

                const suffix = legacy.encode("#", encoding);
                const enc2 = Buffer.concat([
                    enc.slice(0, stringLen - suffix.length),
                    suffix
                ]);
                string.enx = legacy.decode(enc2, encoding);

                break;
            }
        }
    }

    console.log(
        `Total:\t${strings.length}\n` +
        `Translated:\t${translated}\n` +
        `Overlapping:\t${overlap}\n` +
        `Untranslated:\t${untr}\n` +
        `Specials:\t${mismatch}\n` +
        `Unencodable:\t${unenc}\n` +
        `Too long:\t${tooLong}\n`
    );

    await fs.writeFile("strings.json.tmp", JSON.stringify(strings, null, 2) + "\n");
    await fs.rename("strings.json.tmp", "strings.json");

    process.exit(bad ? 1 : 0);
}

main();
