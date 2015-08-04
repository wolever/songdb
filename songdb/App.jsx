import { Redirect, Router, Route } from 'react-router'
import React, { Component } from 'react';
import { Provider } from 'redux/react';
import { createRedux } from 'redux';

import * as Counter from './Counter';
import * as Search from './Search';

require('./style.less');

var stores = {
  ...Counter.stores,
  ...Search.stores,
};

console.log("stores:", Object.keys(stores));

const redux = createRedux(stores);

export default class App extends Component {
  render() {
    var history = this.props.history;
    return (
      <Provider redux={redux}>
        {getRoutes.bind(null, history)}
      </Provider>
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

