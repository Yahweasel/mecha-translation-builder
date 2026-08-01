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
import * as unicode from "unicode-properties";

export const config = JSON.parse(await fs.readFile("config.json", "utf8"));

config.letters = config.letters || {
    categories: ["Lu", "Ll"],
    scripts: ["Latin"]
};

const categCache = Object.create(null);
const scriptCache = Object.create(null);

export function getCategory(c) {
    if (c in categCache)
        return categCache[c];
    const ret = unicode.getCategory(c.charCodeAt(0));
    categCache[c] = ret;
    return ret;
}

export function getScript(c) {
    if (c in scriptCache)
        return scriptCache[c];
    const ret = unicode.getScript(c.charCodeAt(0));
    scriptCache[c] = ret;
    return ret;
}

export function findStringIBM850(bin, idx) {
    let eIdx = idx;
    for (;
        bin[eIdx] >= 0x20 ||
        bin[eIdx] === 0x0A ||
        bin[eIdx] === 0x0D;
        eIdx++) {}

    let isString = false;
    if (eIdx >= idx) {
        // Check whether a fair portion of them are actually letters
        let letters = 0;
        for (let li = idx; li < eIdx; li++) {
            const c = bin[li];
            if ((c >= 0x41 && c <= 0x5A) ||
                (c >= 0x61 && c <= 0x7A) ||
                c === 0x20 || c === 0x25 || c === 0x24) {
                letters++;
            }
        }
        if (letters >= 3 && (letters / (eIdx - idx)) >= 0.65)
            isString = true;
    }

    if (isString) {
        const ibm850 = bin.slice(idx, eIdx);
        const string = legacy.decode(ibm850, "ibm850");
        return [true, eIdx, string];
    }

    return [false, null, null];
}

export function findStringGeneric2(bin, idx, encoding) {
    const thruEncoding = config.thruEncoding;
    let eIdx = idx;
    let endNLBytes = 0;
    while (eIdx < bin.length) {
        const c1 = bin[eIdx];
        const c2 = bin[eIdx+1] || 0;
        let d = legacy.decode(Buffer.from([c1]), encoding);
        let len = 1;
        if (d.length !== 1 || d.charCodeAt(0) === 0xfffd) {
            d = legacy.decode(Buffer.from([c1, c2]), encoding);
            len = 2;
        }

        if (d.length !== 1 || d.charCodeAt(0) === 0xfffd)
            break;

        const dc = d.charCodeAt(0);

        if (
            dc < 0x20 &&
            dc !== 0x0a && // \n
            dc !== 0x0d && // \r
            dc !== 0x1b    // ESC (special)
        )
            break;

        if (dc === 0x0a && eIdx < idx + 4) {
            // Unlikely to be a proper line this early
            break;
        }

        if (thruEncoding) {
            // Must also be encodable in this
            if (legacy.decode(legacy.encode(d, thruEncoding), thruEncoding) !== d)
                break;
        }

        const categ = getCategory(d);

        if (eIdx === idx) {
            if (config.start) {
                // Has to start with a starting symbol
                if (
                    config.start.indexOf(categ) < 0 &&
                    config.start.indexOf(d) < 0
                )
                    break;
            } else {
                // At least can't start with whitespace
                if (categ[0] === "Z" || categ === "Cc")
                    break;
            }
        }

        // And check the ending too
        endNLBytes += len;
        if (config.end) {
            if (
                config.end.indexOf(categ) >= 0 ||
                config.end.indexOf(d) >= 0
            )
                endNLBytes = 0;
        } else {
            // At least can't end with whitespace
            if (categ[0] !== "Z" && categ !== "Cc")
                endNLBytes = 0;
        }

        eIdx += len;
    }

    if (config.nullTerminated) {
        if (bin[eIdx] !== 0)
            return [false, null, null];
        if (encoding === "ucs2" && bin[eIdx+1] !== 0)
            return [false, null, null];
    }

    eIdx -= endNLBytes;

    const raw = bin.slice(idx, eIdx);
    const string = legacy.decode(raw, encoding);

    let isString = false;
    if (eIdx > idx) {
        // Check whether a fair portion of them are acceptable
        let letters = 0;
        for (const c of string) {
            const categ = getCategory(c);
            const script = getScript(c);
            if (
                config.letters.categories.indexOf(categ) >= 0 &&
                config.letters.scripts.indexOf(script) >= 0
            ) {
                letters++;
            }
        }
        if (letters >= 3 && letters / string.length >= 0.65)
            isString = true;
    }


    if (isString)
        return [true, eIdx, string];

    return [false, null, null];
}

export function findString(bin, idx, encoding) {
    switch (encoding) {
        case "ibm850":
            return findStringIBM850(bin, idx);

        case "932":
        case "shiftjis":
        case "ucs2":
            return findStringGeneric2(bin, idx, encoding);

        default:
            throw new Error(`Unsupported encoding ${encoding}`);
    }
}
