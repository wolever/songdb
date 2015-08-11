import { Redirect, Router, Route } from 'react-router'
import React, { Component } from 'react';
import { Provider } from 'redux/react';
import { createRedux } from 'redux';

import * as Counter from './Counter';
import * as Search from './Search';

require('./style.less');

var db = new Search.SongDB();

var stores = {
  ...Counter.stores,
  ...db.getStore(),
};

const redux = createRedux(stores);

db.setStore(redux);

export default class App extends Component {
  render() {
    var history = this.props.history;
    return (
      <div>
        <h1>An improved song database for #LoserKaraoke</h1>
        <Provider redux={redux}>
          {getRoutes.bind(null, history)}
        </Provider>
      </div>
    );
  }
}

function getRoutes(history) {
  return (
    <Router history={history}>
      <Route path="counter" component={Counter.CounterApp} />
      <Route path="/" component={Search.SearchApp} />
    </Router>
  )
}

