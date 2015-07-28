import React, { Component, PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'redux/react';


import { INCREMENT_COUNTER, DECREMENT_COUNTER } from 'songdb/constants/ActionTypes';

var actions = {
  increment: function() {
    return {
      type: INCREMENT_COUNTER
    };
  },

  decrement: function() {
    return {
      type: DECREMENT_COUNTER
    };
  },

  incrementIfOdd: function() {
    return (dispatch, getState) => {
      const { counter } = getState();

      if (counter % 2 === 0) {
        return;
      }

      dispatch(actions.increment());
    };
  },

  incrementAsync: function() {
    return dispatch => {
      setTimeout(() => {
        dispatch(increment());
      }, 1000);
    };
  },
};

export class Counter extends Component {
  static propTypes = {
    increment: PropTypes.func.isRequired,
    incrementIfOdd: PropTypes.func.isRequired,
    decrement: PropTypes.func.isRequired,
    counter: PropTypes.number.isRequired
  };

  render() {
    const { increment, incrementIfOdd, decrement, counter } = this.props;
    return (
      <p>
        Clicked: {counter} times
        {' '}
        <button onClick={increment}>+</button>
        {' '}
        <button onClick={decrement}>-</button>
        {' '}
        <button onClick={incrementIfOdd}>Increment if odd</button>
      </p>
    );
  }
}

@connect(state => ({
  counter: state.counter,
}))
export default class CounterApp extends Component {
  render() {
    const { counter, dispatch } = this.props;
    return (
      <Counter counter={counter} {...bindActionCreators(actions, dispatch)} />
    );
  }
}
