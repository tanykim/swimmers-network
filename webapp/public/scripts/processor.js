'use strict';

angular.module('swimmerApp').service('processor', ['_', function (_) {

    var allGenderAthletes;
    var allGenderLinks;

    this.sel = {};
    this.selParent = {};
    this.selected = {};

    this.allAthletes = [];
    this.selectedAthletes = [];
    this.allLinks = [];
    this.selectedLinks = [];
    this.pointRange = [];
    this.graph = {};

    this.athletesOnFocus = [];
    this.sharedRaces = [];
    this.sharedRacesWinner = [];

    var self = this;

    this.setAllAthletes = function (athletes, links) {
        allGenderAthletes = athletes;
        allGenderLinks = links;
    };
    this.setAthletes = function (gender) {
        self.allAthletes = allGenderAthletes[gender];
        self.allLinks = allGenderLinks[gender];
        console.log('2.processor, save original objects');
    };

    /* switch gender */
    this.switchGender = function (gender) {
        self.allAthletes = allGenderAthletes[gender];
        self.allLinks = allGenderLinks[gender];
        console.log('processor, gender switched');
    };

    /* for options */
    this.getSelSets = function (obj, selected) {
        self.sel = _.object(_.map(obj, function (val, kind) {
            var preset = selected[kind];
            var vals = _.object(_.map(val, function (d, typeId) {
                var children = _.object(_.map(d.children, function (d) {
                    var isSelected = _.contains(preset, typeId + '-' + d[0]);
                    return [d[0], isSelected];
                }));
                return [typeId, children];
            }));
            return [kind, vals];
        }));
    };
    this.getSelParentSets = function (obj, selected) {
        self.selParent = _.object(_.map(obj, function (val, kind) {
            var preset = selected[kind];
            var vals = _.object(_.map(val, function (d, typeId) {
                var hasSelectedChildren = _.map(d.children, function (c) {
                    return _.contains(preset, typeId + '-' + c[0]);
                });
                return [typeId, hasSelectedChildren.indexOf(true) > -1];
            }));
            return [kind, vals];
        }));
    };

    /* filter athletes */
    this.getFilteredAthletes = function () {

        //all athletes info must kept original for repeated links calculation
        var all = angular.copy(self.allAthletes);
        var sel = self.sel;
        // var selParent = self.selParent;

        //get currently selected meets and events
        for (var kind in sel) {
            self.selected[kind] = [];
            for (var parent in sel[kind]) {
                for (var child in sel[kind][parent]) {
                    if (sel[kind][parent][child]) {
                        self.selected[kind].push(parent + '-' + child);
                    }
                }
            }
        }

        var athletes = [];
        var allTotalPoints = [];

        _.each(all, function (athlete) {
            //check records are included in the selected meets and events
            var totalPoint = 0;
            var validRecords = [];
            _.each(athlete.records, function (r) {
                if (_.contains(self.selected.meets, r.race_id.split('--')[0]) &&
                    _.contains(self.selected.events, r.race_id.split('--')[1])) {
                    totalPoint = totalPoint + r.point;
                    validRecords.push(r);
                }
            });
            if (validRecords.length > 0) {
                allTotalPoints.push(totalPoint);
                athlete.records = validRecords;
                athletes.push(athlete);
            }
        });
        self.selectedAthletes = athletes;
        self.pointRange = [_.min(allTotalPoints), _.max(allTotalPoints)];
        console.log('3.processor, filter athletes');
    };

    /* get graph data */
    this.getGraphData = function (drawVis, width, completeLoadingCb, showAthleteCb, hideAthleteCb) {
        //selected athletes' id
        var aIds = _.pluck(self.selectedAthletes, 'id');
        var links = [];
        _.each(angular.copy(self.allLinks), function (d) {
            //check if both source and target are in the selected ids
            if (aIds.indexOf(d.source) > -1 && aIds.indexOf(d.target) > -1) {
                var validRecords = [];
                _.each(d.value, function (r) {
                    if (_.contains(self.selected.meets, r.split('--')[0]) &&
                        _.contains(self.selected.events, r.split('--')[1])) {
                        validRecords.push(r);
                    }
                });
                if (validRecords.length > 0) {
                    links.push({
                        source: d.source,
                        target: d.target,
                        value: validRecords.length
                    });
                }
            }
        });

        self.graph = {
            nodes: self.selectedAthletes,
            links: links
        };

        console.log('4.processor, graph data done');
        drawVis(self.graph, self.pointRange, width, completeLoadingCb, showAthleteCb, hideAthleteCb);
    };

    /* update */
    this.updateParentStatus = function (kind, parent) {
        var childrenVals = _.values(self.sel[kind][parent]);
        //if none of the children are selected, set the parent false
        if (childrenVals.indexOf(true) === -1) {
            self.selParent[kind][parent] = false;
        } else {
            self.selParent[kind][parent] = true;
        }
        self.getFilteredAthletes();
    };
    this.filterParent = function (kind, parent) {
        self.selParent[kind][parent] = !self.selParent[kind][parent];
        var childrenKeys = _.keys(self.sel[kind][parent]);
        _.each(childrenKeys, function (key) {
            var update = self.selParent[kind][parent] ? true : false;
            self.sel[kind][parent][key] = update;
        });
        self.getFilteredAthletes();
    };

    function getWinnersIndex() {

        return _.map(self.sharedRaces, function (raceId) {
            var athletesOfRace = _.map(self.athletesOnFocus, function (a, i) {
                if (a.records[raceId]) {
                    //i: index of column
                    return [a.records[raceId].place, i];
                } else {
                    return null;
                }
            });
            //sort by place
            var sorted = _.sortBy(_.compact(athletesOfRace), function (a) {
                return a[0];
            });

            //highest place among all swimmers
            var highestPlace = sorted[0][0];

            //return top athlete's index
            //there may be multiple swimmers with the top place, thus return array
            return _.map(_.filter(sorted, function (s) {
                return s[0] === highestPlace;
            }), function (f) {
                return f[1];
            });
        });
    }

    this.addFocusedAthlete = function (athlete) {

        var raceIds = _.pluck(athlete.records, 'race_id');

        //find shared races among all focused athletes
        //very first select - check athletesOnFocus because sharedRaces can be empty later
        if (self.athletesOnFocus.length === 0) {
            self.sharedRaces = raceIds;
        } else {
            self.sharedRaces = _.intersection(self.sharedRaces, raceIds);
        }

        self.athletesOnFocus.push({
            id: athlete.id,
            name: athlete.name,
            country: athlete.country,
            count: athlete.records.length,
            //made records as object to show the result below
            records: _.object(_.map(athlete.records, function (d) {
                return [ d.race_id, { place: +d.place, swimtime: d.swimtime }];
            }))
        });

        //get shared races winner index after adding all athletes
        self.sharedRacesWinner = getWinnersIndex();

    };

    this.removeFocusedAthlete = function (index) {

        self.athletesOnFocus.splice(index, 1);

        if (self.athletesOnFocus.length > 0) {
            var raceIdsByA = _.map(self.athletesOnFocus, function (a) {
                return _.keys(a.records);
            });
            var shared = raceIdsByA[0];
            for (var i = 1; i < raceIdsByA.length; i++) {
                shared = _.intersection(shared, raceIdsByA[i]);
            }
            self.sharedRaces = shared;
            self.sharedRacesWinner = getWinnersIndex();
        } else {
            self.sharedRaces = [];
            self.sharedRacesWinner = [];
        }
    };

    /* reset selection */
    this.resetSelection = function(updateFocusedAthletes) {
        self.athletesOnFocus = [];
        self.sharedRaces = [];
        self.sharedRacesWinner = [];
        updateFocusedAthletes();
    };

}]);