import os
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

@app.route("/api/search")
@crossdomain("*")
def search():
    cxn = psycopg2.connect("dbname=songs")
    cur = cxn.cursor(cursor_factory=DictCursor)
    try:
        q = request.args["q"].lower() or "a"
        query = " & ".join(
            "'%s':*" %(x.replace("'", ""), )
            for x in q.split()
        )
        more = to_bool(request.args.get("more"))
        limit = 250 if more else 25
        cur.execute("""
            WITH q AS (
                select to_tsquery('simple', %s) AS q
            ),
            results as (
                SELECT
                    id,
                    artist,
                    title,
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
        """, [query, limit])

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

@app.route("/")
def index():
    return open("index.html").read()

if __name__ == "__main__":
    is_dev = not to_bool(os.environ.get("PROD"))
    app.run(debug=is_dev, host=is_dev and "127.0.0.1" or "0.0.0.0")
