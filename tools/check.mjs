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

function specials(str, re) {
    return (str.match(re) || []).join(",");
}

// ABCDEGHIKLMOPSTU
const CMAP = {
    0: "A",
    1: "B",
    2: "C",
    3: "D",
    4: "E",
    5: "H",
    6: "I",
    7: "K",
    8: "L",
    9: "M",
    "a": "O",
    "b": "P",
    "c": "S",
    "d": "T",
    "e": "U",
    "f": "Z"
};

function encodeUID(uid) {
    return uid.toString(16).split("").map(x => CMAP[x]).join("");
}

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

    let uid = 0;
    let translated = 0;
    let tooLong = 0, mismatch = 0, unenc = 0, untr = 0, overlap = 0;
    let prev = null;
    for (const string of strings) {
        if (!string.en)
            continue;
        const encoding = string.enc || defaultEncoding;
        translated++;
        const stringLen = string.end - string.start;

        if (string.WARN) {
            delete string.WARN;
            delete string.uid;
            delete string.enx;
        }

        if (prev && prev.file === string.file && string.start < prev.end) {
            overlap++;
            string.WARN = "OVERLAP";
            continue;
        }
        prev = string;

        const en = string.en2 || string.en;
        if (en.trim() === "ERROR")
            continue;
        const enc = legacy.encode(
            en.replace(/’/g, "'"), encoding
        );

        // Check the specials
        //const origSpecials = specials(string.string, /[\x1b%]./g);
        //const enSpecials = specials(en, /[\x1b%]./g);
        const origSpecials = specials(string.string, /%./g);
        const enSpecials = specials(en, /%./g);
        if (origSpecials !== enSpecials) {
            mismatch++;
            if (!string.en2)
                string.en2 = string.en;
            string.WARN = `SPECIALS MISMATCH ${origSpecials} v. ${enSpecials}`;
            continue;
        }

        // Check encodability
        const thruEnc = legacy.decode(legacy.encode(en, encoding), encoding);
        if (thruEnc !== en) {
            unenc++;
            if (!string.en2)
                string.en2 = string.en;
            string.WARN = `UNENCODABLE: ${thruEnc} v. ${en}`
            continue;
        }

        // Check if it even fits
        if (enc.length > stringLen) {
            tooLong++;
            if (!string.en2)
                string.en2 = string.en;
            string.WARN = "TRUNCATED";
            let uidStr = `#${encodeUID(uid)}#`;
            string.uid = uid;
            uid++;
            if (!config.useUIDs)
                uidStr = "";

            const enc2 = legacy.encode(uidStr, encoding);
            const enc3 = legacy.encode("#", encoding);
            const enc4 = Buffer.concat([
                enc2,
                enc.slice(0, stringLen - enc2.length - enc3.length),
                enc3
            ]);

            if (enc4.length > stringLen) {
                //string.enx = string.string;
                string.enx = legacy.decode(enc4.slice(0, stringLen), encoding);
            } else {
                string.enx = legacy.decode(enc4, encoding);
            }
            continue;
        }

        // And finally, check if it seems untranslated
        if (/\p{Lo}/u.test(en)) {
            untr++;
            if (!string.en2)
                string.en2 = string.en;
            string.WARN = "UNTRANSLATED";
            continue;
        }

    }

    console.log(
        `Total:\t${strings.length}\n` +
        `Translated:\t${translated}\n` +
        `Too long:\t${tooLong}\n` +
        `Specials:\t${mismatch}\n` +
        `Unencodable:\t${unenc}\n` +
        `Untranslated:\t${untr}\n` +
        `Overlapping:\t${overlap}\n`
    );

    await fs.writeFile("strings.json.tmp", JSON.stringify(strings, null, 2) + "\n");
    await fs.rename("strings.json.tmp", "strings.json");
}

main();
