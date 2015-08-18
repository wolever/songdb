import BrowserHistory from 'react-router/lib/BrowserHistory';
import React from 'react';

import App from './App';

require('./base.js');
require('./style/style.less');

var history = new BrowserHistory();

React.render(<App history={history} />, document.getElementById('root'));
