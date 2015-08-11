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


export class SongDB {
  constructor(store) {
    this.cache = LRU({
      max: 100,
    });
    this.watchers = [];
    this.state = "loading";
    this.error = null;
    this.query();
  }

  setStore(store) {
    this.store = store;
    if (this._lastDispatch) {
      this.store.dispatch(this._lastDispatch);
      delete this._lastDispatch;
    }
  }

  getStore() {
    return {
      search: ::this.onDispatch,
    };
  }

  onDispatch(state={}, action) {
    console.log("virtual store got:", action);
    switch (action.type) {
      case "SEARCH":
        console.log("virtual store returning", action);
        return action;
      case "SEARCH_QUERY":
        this.query(action.query);
    }
    return state;
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
    const dispatch = {
      type: "SEARCH",
      state: this.state,
      error: this.error,
      matches: this.matches,
      query: this.currentQuery,
    };

    setTimeout(() => {
      this.store? this.store.dispatch(dispatch) : this._lastDispatch = dispatch;
    }, 0);
  }
}

@connect(state => (console.log("here", state.search) || {
  search: state.search,
}))
export class SearchApp extends Component {
  constructor() {
    super();
  }

  render() {
    var search = this.props.search;
    console.log("Component saw search:", search);
    return (
      <div className="search">
        <div className="query-container">
          <input className="query" onChange={::this.queryChanged} />
        </div>
        {search.error && <div className="error">Error fetching results</div>}
        {search.matches && <ul className="search-results">
          {search.matches.map(r => (
            <li key={r.id}>{r.artist}: {r.title}</li>
          ))}
        </ul>}
      </div>
    );
  }

  queryChanged(event) {
    this.props.dispatch({
      type: "SEARCH_QUERY",
      query: event.target.value,
    });
  }
}
