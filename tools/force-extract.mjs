#!/usr/bin/env node
/*
 * Copyright (c) 2026 Yahweasel
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

import * as ex from "./lib-extract.mjs";

import * as legacy from "legacy-encoding";

async function main() {
    const file = process.argv[2];
    const start = +process.argv[3];
    const end = +process.argv[4];

    let encodings = ex.config.encodings;
    if (!(encodings instanceof Array))
        encodings = [encodings];

    const bin = await fs.readFile(file);
    const raw = bin.slice(start, end);

    const res = [];

    for (const encoding of ex.config.encoding) {
        res.push({
            file,
            start,
            end,
            raw: raw.toString("binary"),
            string: legacy.decode(raw, encoding),
            enc: encoding
        });
    }

    process.stdout.write(JSON.stringify(res, null, 2));
}

main();
