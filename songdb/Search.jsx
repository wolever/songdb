import React, { Component, PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'redux/react';
import { default as LRU } from 'lru-cache';

function normalizeQuery(query) {
  return query
    .replace(/  +/, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "")
}


class SongDB {
  constructor() {
    this.cache = LRU({
      max: 100,
    });
    this.watchers = [];
    this.state = "loading";
    this.error = null;
    this.query();
  }

  query(query="") {
    query = normalizeQuery(query);
    this.currentQuery = query;
    var cached = this.cache.get(query);
    if (cached !== undefined) {
      this._setMatches(query, cached);
      return;
    };

    $.getJSON(SEARCH_API_ENDPOINT + "?q=" + escape(query))
      .done(data => {
        this.cache.set(query, data);
        this._setMatches(query, data);
      })
      .fail(::this._requestFail)
  }

  _requestFail(_, reason) {
    if (reason == "abort")
      return;
    console.log("error", reason);
    this.state = "error";
    this.error = true;
    this.changed();
  }

  _queryMore(query, url) {
    $.getJSON(url)
      .done(data => {
        if (data.more) {
          log.error("request for more also had more?", data)
          data.more = null;
        }
        this.cache.set(query, data);
        this._setMatches(query, data);
      })
      .fail(::this._requestFail);
  }

  _setMatches(query, matches) {
    if (query !== this.currentQuery)
      return;
    this.state = "done";
    this.error = null;
    this.matches = matches.matches;
    if (matches.more) {
      this._queryMore(query, matches.more);
    }
    this.changed();
  };

  changed() {
    this.watchers.forEach(watcher => watcher(this));
  }

  watch(cb) {
    this.watchers.push(cb);
    return () => {
      this.watchers = this.watchers.filter(w => w !== cb);
    }
  }
}

export var stores = {
  search: function(state, action) {
    console.log("search:", state, action);
    switch (action.type) {
    case "@@INIT":
      return {
        db: new SongDB(),
      };
    case "SEARCH_QUERYING":
      return {
        status: 
        query: action.query,
        ...state
      };
    }
  },
};

var SearchActions = {
  query: function(str) {
    var query = normalizeQuery(str);
    return function(dispatch, getState) {
      var ss = getState().search;
      dispatch({
        type: "SEARCH_QUERYING",
        query: query,
      });
    };
  },
};

@connect(state => ({
  search: state.search,
}))
export class SearchApp extends Component {
  constructor() {
    super();
    this.songdb = new SongDB();
    this.songdb.watch(::this.dbChanged);
    this.state = {
      "db": this.songdb,
    };
  }

  render() {
    var db = this.songdb;
    var actions = bindActionCreators(SearchActions, this.props.dispatch);
    return (
      <div className="search">
        <div className="query-container">
          <input className="query" onChange={::this.queryChanged} />
        </div>
        {db.error && <div className="error">Error fetching results</div>}
        {db.matches && <ul className="search-results">
          {db.matches.map(r => (
            <li key={r.id}>{r.artist}: {r.title}</li>
          ))}
        </ul>}
      </div>
    );
  }

  dbChanged(db) {
    this.setState({
      "db": db,
    })
  }

  queryChanged(event) {
    this.props.dispatch(SearchActions.query(event.target.value));
  }
}
