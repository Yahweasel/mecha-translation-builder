# Binary translation

The basic concept of the translation pipeline is (1) extract strings, (2)
validate that nonsense isn't being extracted with the strings, (3) translate
the strings via AI, (4) check AI translations for common errors, (5) reinject
the translated strings into the binary.

Note that almost every new translation process is expected to need new changes
and fixes to mecha-translation-builder. You will need to dig into the source if
you intend to use this. Actual game translations will all have forks of this
repository associated with them.


## config.json

Before using any of these tools, you must set up config.json. See
config.json.example for an example of how to set it up.


## extract.mjs

Run this to extract strings. Outputs JSON data to stdout. Save it to
`strings.json` in most cases.

You should check that `strings.json` is basically correct, and remove any false
positives, before moving on.


## trans.mjs

Runs the strings in `strings.json` through LLM-based translation. Leaves the
current chat state in `chat.json`, which can be discarded once translation is
complete, or use to continue if `trans.js` is interrupted. It's important that
the LLM translation is an actual *chat*, as that helps to make the translation
more consistent.


## check.mjs

Checks for common errors in `strings.json`, in particular the translated string
being too long.

Rather than simply reporting the error, `check.js` leaves warnings in
`strings.json`.


## fix-ai.mjs

Fixes the kinds of errors that `check.mjs` can find by using AI. Give
temperature as a parameter to use a non-zero temperature and thus be
non-deterministic. You may need to run this multiple times, or even with
different models, and in some cases, AI simply won't figure out a solution, so
you'll have to fix it yourself.


## apply.mjs

Injects the translated strings in `strings.json` back into the binaries.



# Other tools

Sometimes the straight-through process isn't enough.


## find.mjs

If you know that a string is in the source, but extract.mjs couldn't find it,
find.mjs might.

```sh
$ find.mjs <string to find> <file(s) to search>
```

find.mjs simply searches for the raw bit patterns associated with the string,
so will be less fussy than extract.mjs.


## force-extract.mjs

If you know that a certain range is definitely a string, you can forcibly
extract it into the proper format for strings.json.

```sh
$ force-extract.mjs <file> <start index> <end index>
```

This is useful when combined with `find.mjs`, as `find.mjs` can be used to find
a substring. Then, use `force-extract.mjs` to extract the surrounding full
string.
