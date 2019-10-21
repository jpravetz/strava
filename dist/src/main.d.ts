import { Athelete } from './models/athlete';
import { Activity } from './models/activity';
import { Kml, LineStyle } from './kml';
import { Dict, EpochSeconds } from './util/file';
import { StravaApiOpts } from './strava-api';
export declare type SegmentConfig = {
    description: string;
    alias: Dict;
    data: Dict;
};
export declare type StravaConfig = {
    description: string;
    client: StravaApiOpts;
    athleteId: number;
    accessToken: string;
    cachePath?: string;
    lineStyles: Record<string, LineStyle>;
};
export declare type DateRange = {
    before: EpochSeconds;
    after: EpochSeconds;
};
export declare type MainOpts = {
    home: string;
    cwd: string;
    config?: StravaConfig;
    segmentsFile?: string;
    athlete?: string;
    athleteId?: number;
    bikes?: string[];
    friends?: string[];
    dates?: DateRange[];
    dateRanges?: DateRange[];
    more?: boolean;
    kml?: string;
    xml?: string;
    activities?: string[];
    activityFilter?: string[];
    commuteOnly?: boolean;
    nonCommuteOnly?: boolean;
    imperial?: boolean;
    segments?: boolean | string;
    verbose?: number;
};
export declare class Main {
    options: MainOpts;
    strava: any;
    kml: Kml;
    athlete: Athelete;
    activities: any[];
    segments: any[];
    segmentsFileLastModified: Date;
    segmentConfig: Record<string, any>;
    gear: any[];
    segmentEfforts: Record<string, any>;
    starredSegment: [];
    constructor(options: MainOpts);
    init(): Promise<void>;
    run(): Promise<void>;
    readSegmentsFile(segmentsFile: string): Promise<void>;
    getAthlete(): Promise<void>;
    logAthlete(): void;
    getActivities(): Promise<Activity[]>;
    getActivitiesForDateRange(dateRange: DateRange): Promise<Activity[]>;
}