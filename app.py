import os
import re
import json
from datetime import timedelta

import psycopg2
from unstdlib import to_int, to_str
from psycopg2.extras import DictCursor
from functools import update_wrapper
from flask import Flask, make_response, request, current_app


app = Flask(__name__)


def to_bool(val, allow_none=False):
    if val is None and allow_none:
        return None
    return (
        to_int(val) or
        to_str(val).lower() == "true"
    )

def crossdomain(origin=None, methods=None, headers=None,
                max_age=21600, attach_to_all=True,
                automatic_options=True):
    if methods is not None:
        methods = ', '.join(sorted(x.upper() for x in methods))
    if headers is not None and not isinstance(headers, basestring):
        headers = ', '.join(x.upper() for x in headers)
    if not isinstance(origin, basestring):
        origin = ', '.join(origin)
    if isinstance(max_age, timedelta):
        max_age = max_age.total_seconds()

    def get_methods():
        if methods is not None:
            return methods

        options_resp = current_app.make_default_options_response()
        return options_resp.headers['allow']

    def decorator(f):
        def wrapped_function(*args, **kwargs):
            if automatic_options and request.method == 'OPTIONS':
                resp = current_app.make_default_options_response()
            else:
                resp = make_response(f(*args, **kwargs))
            if not attach_to_all and request.method != 'OPTIONS':
                return resp

            h = resp.headers

            h['Access-Control-Allow-Origin'] = origin
            h['Access-Control-Allow-Methods'] = get_methods()
            h['Access-Control-Max-Age'] = str(max_age)
            if headers is not None:
                h['Access-Control-Allow-Headers'] = headers
            return resp

        f.provide_automatic_options = False
        return update_wrapper(wrapped_function, f)
    return decorator

def tsquery_escape(term):
    """ Escape a query string so it's safe to use with Postgres'
        ``to_tsquery(...)``. Single quotes are ignored, double quoted strings
        are used as literals, and the logical operators 'and', 'or', 'not',
        '(', and ')' can be used:
            >>> tsquery_escape("Hello")
            "'hello':*"
            >>> tsquery_escape('"Quoted string"')
            "'quoted string'"
            >>> tsquery_escape("multiple terms OR another")
            "'multiple':* & 'terms':* | 'another':*"
            >>> tsquery_escape("'\"*|")
            "'\"*|':*"
            >>> tsquery_escape('not foo and (bar or "baz")')
            "! 'foo':* & ( 'bar':* | 'baz' )"
    """

    magic_terms = {
        "and": "&",
        "or": "|",
        "not": "!",
        "OR": "|",
        "AND": "&",
        "NOT": "!",
        "(": "(",
        ")": ")",
    }
    magic_values = set(magic_terms.values())
    paren_count = 0
    res = []
    bits = re.split(r'((?:".*?")|[()])', term)
    for bit in bits:
        if not bit:
            continue
        split_bits = (
            [bit] if bit.startswith('"') and bit.endswith('"') else
            bit.strip().split()
        )
        for bit in split_bits:
            if not bit:
                continue
            if bit in magic_terms:
                bit = magic_terms[bit]
                last = res and res[-1] or ""

                if bit == ")":
                    if last == "(":
                        paren_count -= 1
                        res.pop()
                        continue
                    if paren_count == 0:
                        continue
                    if last in magic_values and last != "(":
                        res.pop()
                elif bit == "|" and last == "&":
                    res.pop()
                elif bit == "!":
                    pass
                elif bit == "(":
                    pass
                elif last in magic_values or not last:
                    continue

                if bit == ")":
                    paren_count -= 1
                elif bit == "(":
                    paren_count += 1

                res.append(bit)
                if bit == ")":
                    res.append("&")
                continue

            bit = bit.replace("'", "")
            if not bit:
                continue

            if bit.startswith('"') and bit.endswith('"'):
                res.append(bit.replace('"', "'"))
            else:
                res.append("'%s':*" %(bit.replace("'", ""), ))
            res.append("&")

    while res and res[-1] in magic_values:
        last = res[-1]
        if last == ")":
            break
        if last == "(":
            paren_count -= 1
        res.pop()
    while paren_count > 0:
        res.append(")")
        paren_count -= 1
    return " ".join(res)


def do_search(cur, q, limit):
    if not q:
        cur.execute("""
            SELECT
                id,
                artist,
                lower(title) as title,
                0 as rank
            FROM songs
            ORDER BY artist, title
            LIMIT %s
        """, [limit])
        return

    cur.execute("""
        WITH q AS (
            select to_tsquery('simple', %s) AS q
        ),
        results as (
            SELECT
                id,
                artist,
                lower(title) as title,
                GREATEST(
                    ts_rank(to_tsvector('simple', artist || ' ' || title), q),
                    ts_rank(to_tsvector('simple', title || ' ' || artist), q)
                ) AS rank
            FROM songs
            JOIN q on true
            WHERE
                to_tsvector('simple', artist || ' ' || title) @@ q OR
                to_tsvector('simple', title || ' ' || artist) @@ q
            LIMIT %s
        )
        SELECT
            *
        FROM results
        ORDER BY
            rank, artist, title
    """, [tsquery_escape(q), limit])

@app.route("/api/search")
@crossdomain("*")
def search():
    cxn = psycopg2.connect("dbname=songs")
    cur = cxn.cursor(cursor_factory=DictCursor)
    try:
        q = request.args.get("q", "").lower()
        more = to_bool(request.args.get("more"))
        limit = 250 if more else 25
        do_search(cur, q, limit)
        matches = map(dict, cur)
        more_url = (
            request.url + "&more=true" if (not more and len(matches) == limit)
            else None
        )
        return json.dumps({
            "matches": matches,
            "more": more_url,
        })
    finally:
        cur.close()
        cxn.close()


@app.route("/api/song/<id>")
@crossdomain("*")
def song(song_id):
    cxn = psycopg2.connect("dbname=songs")
    cur = cxn.cursor(cursor_factory=DictCursor)
    try:
        return json.dumps({
            "matches": matches,
            "more": more_url,
        })
    finally:
        cur.close()
        cxn.close()


@app.route("/")
def index():
    return open("index.html").read()

if __name__ == "__main__":
    is_dev = not to_bool(os.environ.get("PROD"))
    app.run(debug=is_dev, host=is_dev and "127.0.0.1" or "0.0.0.0")
