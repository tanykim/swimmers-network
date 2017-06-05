import { connect } from 'react-redux';
import VisComponent from '../components/Vis';
import _ from 'lodash';

const mapStateToProps = (state, ownProps) => (
  {
    visType: state.currentView.vis,
    clickedIds: state.graph.clickedIds,
    validRaces: state.data.athletesByRace.validRaces,
    topAthletes: state.data.topAthletes,
    searchedAthletes: state.options.searchedAthletes,
    links: state.data.graph.links,
    byRace: state.data.athletesByRace.byRace,
    gender: state.gender,
  }
);

const mapDispatchToProps = (dispatch) => (
  {
    switchVis: (value) => {
      dispatch({ type: 'SET_VIS_VIEW', value });
    },
    selectAthlete: (value, links) => {
      dispatch({ type: 'CLICK_NODE', value, links });
    },
    selectRace: (id, athletes) => {
      dispatch({ type: 'SELECT_RACE', value: { id, athletes }});
    },
  }
);

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return Object.assign({}, {
    ...stateProps,
    switchVis: (value) => {
      dispatchProps.switchVis(value);
    },
    selectAthlete: (e) => {
      const id = e.currentTarget.value;
      if (+id === 0) {
        return false;
      }
      let athlete = _.findLast(stateProps.topAthletes, (a) => a.id === id);
      if (!athlete) {
        athlete = _.findLast(stateProps.searchedAthletes, (a) => a.id === id);
      }
      dispatchProps.selectAthlete(athlete, stateProps.links);
    },
    selectRace: (e) => {
      const id = e.currentTarget.value;
      if (+id === 0) {
        return false;
      }
      const athletes = _.flatten(_.values(stateProps.byRace[id]));
      dispatchProps.selectRace(id, athletes);
    }
  })
};

export default connect(mapStateToProps,
  mapDispatchToProps,
  mergeProps,
)(VisComponent);