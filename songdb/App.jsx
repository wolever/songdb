import { Redirect, Router, Route } from 'react-router'
import React, { Component } from 'react';
import { Provider } from 'redux/react';
import { createRedux } from 'redux';

import * as stores from './stores';

import CounterApp from './Counter';
import SearchApp from './Search';

require('./style.less');

const redux = createRedux(stores);

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
      <Route path="/" component={SearchApp} />
    </Router>
  )
}

