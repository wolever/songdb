import React, { Component, PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'redux/react';
import { default as LRU } from 'lru-cache';
import { default as jq } from 'jquery';

function normalizeQuery(query) {
  return query
    .replace(/  +/, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "")
}


export class SongDB {
  constructor() {
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
    switch (action.type) {
      case "SEARCH":
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

    jq.getJSON(SEARCH_API_ENDPOINT + "?q=" + escape(query))
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
    jq.getJSON(url)
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


export function favoriteSongs(state={}, action) {
  if (action.type === "FAVORITE_SONG_ADD") {
    return {
      [action.songId]: +(new Date()),
      ...state
    };
  }
  return state;
}

favoriteSongs.add = function(song) {
  return {
    type: "FAVORITE_SONG_ADD",
    songId: song.id,
  };
};


@connect(state => ({
  favorites: state.favoriteSongs,
}))
class ArtistTrackSet extends Component {
  constructor () {
    super();
    this.state = { hidden: false };
  }

  toggle() {
    this.setState({ hidden: !this.state.hidden });
  }

  render() {
    return (
      <div className="artist-group">
        <h4 className={"artist " + (this.state.hidden? "less" : "more")} onClick={::this.toggle}>
          {this.props.artist}
        </h4>
        <ul className={"list-unstyled " + (this.state.hidden? "hidden" : "show")}>{this.props.tracks.map(t => (
          <li key={t.id}>{t.title}</li>))}
        </ul>
      </div>
    );
  }
}


@connect(state => ({
  search: state.search,
}))
export class SearchApp extends Component {
  groupTracksByArtist(tracks) {
    var result = [];
    tracks.forEach(track => {
      var last = result[result.length - 1];
      if (!last || last.artist != track.artist) {
        last = { artist: track.artist, tracks: [] }
        result.push(last);
      }
      last.tracks.push(track);
    });
    return result;
  }

  render() {
    var search = this.props.search;
    var sorted = this.groupTracksByArtist(search.matches || []);

    return (
      <div className="search">
        <div className="query-container">
          <div className="container">
            <input className="query input-lg" onChange={::this.queryChanged} />
          </div>
        </div>
        <div className="results-container container">
          <div className="results">
            {!!search.error && <div className="error">Error fetching results</div>}
            {!!sorted.length && <div className="search-results">
              {sorted.map(t => (
                <ArtistTrackSet key={t.tracks[0].id + t.artist} artist={t.artist} tracks={t.tracks} />
              ))}
            </div>}
          </div>
        </div>
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
