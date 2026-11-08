#!/usr/bin/env python3
"""Genera words/{lang}.json desde wordfreq + Hunspell (LibreOffice) + lista de bloqueo.

Uso: tools/.venv/bin/python tools/build_words.py es en fr
"""
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

import wordfreq

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'tools' / 'sources'
LIBRE = 'https://raw.githubusercontent.com/LibreOffice/dictionaries/master/'
LANGS = {
    'es': ('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'es/es_ES.dic'),
    'en': ('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'en/en_US.dic'),
    'fr': ('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'fr_FR/dictionaries/fr.dic'),
}
TOP_VALID = 200_000
N_ANSWERS = 1200


def normalize(word, lang):
    word = word.lower()
    if lang == 'es':
        word = word.replace('ñ', '\0')
    word = ''.join(c for c in unicodedata.normalize('NFD', word) if not unicodedata.combining(c))
    return word.replace('\0', 'ñ').upper()


def dic_text(path):
    local = SOURCES / Path(path).name
    if not local.exists():
        SOURCES.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(LIBRE + path, local)
    return local.read_text(encoding='utf-8')


def build(lang):
    alphabet, dic = LANGS[lang]
    ok = lambda w: len(w) == 5 and all(c in alphabet for c in w)

    rank = {}  # palabra normalizada -> mejor posición en wordfreq
    for i, w in enumerate(wordfreq.top_n_list(lang, TOP_VALID)):
        n = normalize(w, lang)
        if ok(n):
            rank.setdefault(n, i)

    stems = set()  # raíces en minúscula del .dic: sin nombres propios ni flexiones
    for line in dic_text(dic).splitlines()[1:]:
        stem = re.split(r'[/\s]', line.strip(), maxsplit=1)[0]
        if stem[:1].islower():
            n = normalize(stem, lang)
            if ok(n):
                stems.add(n)

    blocklist = (ROOT / 'tools' / 'blocklist' / f'{lang}.txt').read_text(encoding='utf-8')
    blocked = {normalize(l.strip(), lang) for l in blocklist.splitlines() if l.strip()}

    candidates = [w for w in stems if w in rank and w not in blocked]
    answers = sorted(sorted(candidates, key=rank.get)[:N_ANSWERS])
    valid = sorted(rank)

    assert all(ok(w) for w in valid), 'palabra inválida en valid'
    assert set(answers) <= set(valid), 'answers no está incluido en valid'
    assert not set(answers) & blocked, 'palabra bloqueada en answers'
    assert len(answers) >= 500, f'muy pocas respuestas: {len(answers)}'

    out = ROOT / 'words' / f'{lang}.json'
    out.parent.mkdir(exist_ok=True)
    data = {'alphabet': alphabet, 'answers': answers, 'valid': valid}
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{lang}: {len(valid)} válidas, {len(answers)} respuestas -> {out.relative_to(ROOT)}')


if __name__ == '__main__':
    langs = sys.argv[1:]
    assert langs and all(l in LANGS for l in langs), f'uso: build_words.py {" ".join(LANGS)}'
    for lang in langs:
        build(lang)
