import React, { Component, PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'redux/react';
import { default as LRU } from 'lru-cache';


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

  normalizeQuery(query) {
    return query
      .replace(/  +/, " ")
      .replace(/^ +/, "")
      .replace(/ +$/, "")
  }

  query(query="") {
    query = this.normalizeQuery(query);
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
      <div className="set">
        <h2 className={this.state.hidden ? "more" : "less"} onClick={::this.toggle}>
          {this.props.artist} ({this.props.tracks.length})
        </h2>
        <ul className={this.state.hidden ? "hidden" : "show"}>{this.props.tracks.map(t => (
          <li key={t.id}>{t.title}</li>))}
        </ul>
      </div>
    );
  }
}

export default class SearchApp extends Component {
  constructor() {
    super();
    this.songdb = new SongDB();
    this.songdb.watch(::this.dbChanged);
    this.state = {
      "db": this.songdb,
    };
  }

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
    var db = this.songdb;
    var sorted = this.groupTracksByArtist(db.matches || []);

    return (
      <div className="search">
        <div className="query-container">
          <input className="query" onChange={::this.queryChanged} />
        </div>
        {!!db.error && <div className="error">Error fetching results</div>}
        {!!sorted.length && <div className="search-results">
          {sorted.map(t => (
            <ArtistTrackSet key={t.tracks[0].id + t.artist} artist={t.artist} tracks={t.tracks} />))}
        </div>}
      </div>
    );
  }

  dbChanged(db) {
    this.setState({
      "db": db,
    })
  }

  queryChanged(event) {
    this.songdb.query(event.target.value);
  }
}
