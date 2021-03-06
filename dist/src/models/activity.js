"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const detailed_activity_1 = require("./detailed-activity");
const dateutil = __importStar(require("dateutil"));
const epdoc_util_1 = require("epdoc-util");
const segment_data_1 = require("./segment-data");
const REGEX = {
    noKmlData: /^(Workout|Yoga|Weight Training)$/i
};
class Activity {
    constructor(data) {
        this.keys = ['distance', 'total_elevation_gain', 'moving_time', 'elapsed_time', 'average_temp', 'device_name'];
        this._coordinates = []; // will contain the latlng coordinates for the activity
        Object.assign(this, data);
        this.startDate = new Date(this.start_date);
        let d = Math.round(this.distance / 100) / 10;
        this._asString = `${this.start_date_local.slice(0, 10)}, ${this.type} ${d} km, ${this.name}`;
    }
    static newFromResponseData(data, main) {
        let result = new Activity(data);
        result.main = main;
        return result;
    }
    static isInstance(val) {
        return val && epdoc_util_1.isNumber(val.id) && epdoc_util_1.isBoolean(val.commute);
    }
    toString() {
        return this._asString;
    }
    hasKmlData() {
        if (!epdoc_util_1.isString(this.type) || REGEX.noKmlData.test(this.type)) {
            return false;
        }
        return this._coordinates.length > 0 ? true : false;
    }
    /**
     * Get starred segment_efforts and descriptions from the DetailedActivity
     * object and add to Acivity.
     * @param data
     */
    addFromDetailedActivity(data) {
        console.log('  Adding activity details for ' + this.toString());
        if (detailed_activity_1.DetailedActivity.isInstance(data)) {
            if (epdoc_util_1.isString(data.description)) {
                this._addDescriptionFromDetailedActivity(data);
            }
            if (Array.isArray(data.segment_efforts)) {
                this._addDetailSegmentsFromDetailedActivity(data);
            }
        }
    }
    _addDescriptionFromDetailedActivity(data) {
        if (epdoc_util_1.isString(data.description)) {
            let p = data.description.split(/\r\n/);
            //console.log(p)
            if (p && p.length) {
                let a = [];
                p.forEach(line => {
                    let kv = line.match(/^([^\s\=]+)\s*=\s*(.*)+$/);
                    if (kv) {
                        this.keys.push(kv[1]);
                        this[kv[1]] = kv[2];
                    }
                    else {
                        a.push(line);
                    }
                });
                if (a.length) {
                    this.description = a.join('\n');
                }
            }
            else {
                this.description = data.description;
            }
            this.keys.push('description');
        }
    }
    _addDetailSegmentsFromDetailedActivity(data) {
        this._segments = [];
        data.segment_efforts.forEach(effort => {
            // @ts-ignore
            if (this.main.segFile) {
                let seg = this.main.segFile.getSegment(effort.name);
                if (seg) {
                    console.log('  Found starred segment', effort.name);
                    this._addDetailSegment(effort);
                }
            }
        });
    }
    _addDetailSegment(segEffort) {
        let name = String(segEffort.name).trim();
        let aliases = this.main.config.aliases;
        if (aliases && aliases[name]) {
            name = aliases[name];
            segEffort.name = name;
        }
        console.log("  Adding segment '" +
            name +
            "', elapsed time " +
            dateutil.formatMS(segEffort.elapsed_time * 1000, {
                ms: false,
                hours: true
            }));
        // Add segment to this activity
        this._segments.push(new segment_data_1.SegmentData(segEffort));
    }
    include(filter) {
        if ((!filter.commuteOnly && !filter.nonCommuteOnly) ||
            (filter.commuteOnly && this.commute) ||
            (filter.nonCommuteOnly && !this.commute)) {
            if (Array.isArray(filter.exclude)) {
                if (filter.exclude.indexOf(this.type) >= 0) {
                    return false;
                }
            }
            if (Array.isArray(filter.include)) {
                if (filter.include.indexOf(this.type) < 0) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
    static compareStartDate(a, b) {
        if (a.start_date < b.start_date) {
            return -1;
        }
        if (a.start_date > b.start_date) {
            return 1;
        }
        return 0;
    }
}
exports.Activity = Activity;
//# sourceMappingURL=activity.js.map