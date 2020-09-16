import React, { Component } from 'react';
import { DragDropContextProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import { connect } from 'react-redux';
import { Container } from '@material-ui/core';

import WaveformContainer from './containers/WaveformContainer';
import ButtonSection from './components/ButtonSection';
import StructureOutputContainer from './containers/StructureOutputContainer';
import { resetReduxStore } from './actions';
import { handleStructureError } from './actions/forms';
import ErrorBoundary from './components/ErrorBoundary';

// Font Awesome Imports
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faDotCircle,
  faMinusCircle,
  faPen,
  faSave,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
library.add(faDotCircle, faMinusCircle, faPen, faSave, faTrash);

import './App.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      structureAlert: {},
    };
  }
  // Lifecycle method fired before unmounting the React component
  componentWillUnmount() {
    // Reset the redux-store
    this.props.resetStore();
  }

  clearStructureAlert = () => {
    this.setState({ structureAlert: null });
    this.props.handleStructureError(0);
  };

  structureIsSaved = (value) => {
    this.props.structureIsSaved(value);
  };

  render() {
    return (
      <DragDropContextProvider backend={HTML5Backend}>
        <Container id="sme-container">
          <WaveformContainer
            {...this.props}
            structureAlert={this.state.structureAlert}
          />
          <ErrorBoundary>
            <ButtonSection />
            <StructureOutputContainer
              alertObj={this.state.structureAlert}
              clearAlert={this.clearStructureAlert}
              {...this.props}
            />
          </ErrorBoundary>
        </Container>
      </DragDropContextProvider>
    );
  }
}

const mapDispatchToProps = {
  resetStore: resetReduxStore,
  handleStructureError: handleStructureError,
};

export default connect(null, mapDispatchToProps)(App);
