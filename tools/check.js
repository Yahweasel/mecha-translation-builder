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
    const strings = JSON.parse(
        await fs.readFile("strings.json", "utf8")
    );

    let translated = 0;
    let tooLong = 0, mismatch = 0;
    for (const string of strings) {
        if (!string.en)
            continue;
        translated++;
        const stringLen = string.end - string.start;

        if (string.WARN) {
            delete string.WARN;
            if (string.enx)
                string.en2 = string.enx;
            else
                delete string.en2;
            delete string.enx;
        }

        const en = string.en2 || string.en;
        const enc = legacy.encode(en.replace(/’/g, "'"), "ibm850");

        if (enc.length > stringLen) {
            tooLong++;
            string.WARN = "TRUNCATED";
            string.enx = en;
            string.en2 = legacy.decode(enc.slice(0, stringLen - 1), "ibm850") + "#";
            continue;
        }

        // Check the specials
        const deSpecials = (string.string.match(/[\$%][a-zA-Z0-9]/g)||[]).join(",");
        const enSpecials = (en.match(/[\$%][a-zA-Z0-9]/g)||[]).join(",");
        if (deSpecials !== enSpecials) {
            mismatch++;
            string.WARN = `SPECIALS MISMATCH ${deSpecials} v. ${enSpecials}`;
            string.en2 = en;
            continue;
        }
    }

    console.log(
        `Total:\t${strings.length}\n` +
        `Translated:\t${translated}\n` +
        `Too long:\t${tooLong}\n` +
        `Specials:\t${mismatch}`);

    await fs.writeFile("strings.json.tmp", JSON.stringify(strings, null, 2));
    await fs.rename("strings.json.tmp", "strings.json");
}

main();
