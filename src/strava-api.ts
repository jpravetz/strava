import { StravaCoord } from './strava-api';
import { Athelete } from './models/athlete';
import { Activity } from './models/activity';
import { Dict, EpochSeconds, Metres } from './util';
import * as assert from 'assert';
import request = require('superagent');
import { isNumber } from 'epdoc-util';
import { StravaCreds } from './strava-creds';
import { DetailedActivity } from './models/detailed-activity';
import { SegmentId } from './models/segment';
import { SummarySegment } from './models/summary-segment';

const STRAVA_URL_PREFIX = process.env.STRAVA_URL_PREFIX || 'https://www.strava.com';
const STRAVA_API_PREFIX = STRAVA_URL_PREFIX + '/api/v3';
const STRAVA_URL = {
  authorize: STRAVA_URL_PREFIX + '/oauth/authorize',
  token: STRAVA_URL_PREFIX + '/oauth/token',
  athlete: STRAVA_API_PREFIX + '/athlete',
  picture: STRAVA_API_PREFIX + '/athlete/picture',
  activities: STRAVA_API_PREFIX + '/activities',
  starred: STRAVA_API_PREFIX + '/segments/starred'
};

export type StravaCode = string;
export type StravaSecret = string;
export type StravaAccessToken = string;
export type StravaRefreshToken = string;
export type StravaClientId = number;

export enum StravaStreamSource {
  activities = 'activities',
  segments = 'segments',
  routes = 'routes',
  segmentEfforts = 'segment_efforts'
}
export enum StravaStreamType {
  latlng = 'latlng',
  distance = 'distance',
  altitude = 'altitude'
}
export type StravaObjId = number;
export type StravaSegmentId = StravaObjId;
export type Query = Dict;
export type StravaCoord = [number, number];
export type StravaCoordData = {
  type: string;
  data: StravaCoord[];
};

export type StravaClientConfig = {
  id: StravaClientId;
  secret: StravaSecret;
};

export type StravaApiOpts = StravaClientConfig & {
  token: StravaAccessToken;
};

export type AuthorizationUrlOpts = {
  redirectUri?: string;
  scope?: string;
  state?: string;
  approvalPrompt?: string;
};

const defaultAuthOpts: AuthorizationUrlOpts = {
  scope: 'read_all,activity:read_all,profile:read_all',
  state: '',
  approvalPrompt: 'auto',
  redirectUri: 'https://localhost'
};

export type TokenUrlOpts = {
  code?: string;
};

export type StravaActivityOpts = {
  athleteId: number;
  query: {
    after: EpochSeconds;
    before: EpochSeconds;
    per_page: number;
    page?: number;
  };
};

export class StravaApi {
  id: StravaClientId;
  secret: StravaSecret;
  private _credsFile: string;
  private _creds: StravaCreds;

  constructor(clientConfig: StravaClientConfig, credsFile: string) {
    this.id = clientConfig.id || parseInt(process.env.STRAVA_CLIENT_ID, 10);
    this.secret = clientConfig.secret || process.env.STRAVA_CLIENT_SECRET;
    // this.token = opts.token || process.env.STRAVA_ACCESS_TOKEN;
    this._credsFile = credsFile;
  }

  toString() {
    return '[Strava]';
  }

  initCreds(): Promise<void> {
    this._creds = new StravaCreds(this._credsFile);
    return this._creds.read();
  }

  get creds() {
    return this._creds;
  }

  getAuthorizationUrl(options: AuthorizationUrlOpts = {}): string {
    assert.ok(this.id, 'A client ID is required.');

    let opts = Object.assign(defaultAuthOpts, options);

    return (
      `${STRAVA_URL.authorize}?client_id=${this.id}` +
      `&redirect_uri=${encodeURIComponent(opts.redirectUri)}` +
      `&scope=${opts.scope}` +
      `&state=${opts.state}` +
      `&approval_prompt=${opts.approvalPrompt}` +
      `&response_type=code`
    );
  }

  getTokenUrl(options: TokenUrlOpts = {}): string {
    let opts = Object.assign(defaultAuthOpts, options);

    return (
      `${STRAVA_URL.token}?client_id=${this.id}` +
      `&secret=${this.secret}` +
      `&code=${opts.code}` +
      `&grant_type=authorization_code`
    );
  }

  /**
   * Exchanges code for refresh and access tokens from Strava. Writes these
   * tokens to ~/.strava/credentials.json.
   * @param code
   */
  getTokens(code: StravaCode) {
    let payload = {
      code: code,
      client_id: this.id,
      client_secret: this.secret,
      grant_type: 'authorization_code'
    };
    // console.log('getTokens request', payload);
    return request
      .post(STRAVA_URL.token)
      .send(payload)
      .then(resp => {
        // console.log('getTokens response', resp.body);
        console.log('Authorization obtained.');
        return this.creds.write(resp.body);
      })
      .then(resp => {
        console.log('Credentials written to local storage');
      });
  }

  acquireToken(code: string): Promise<string> {
    assert.ok(this.id, 'A client ID is required.');
    assert.ok(this.secret, 'A client secret is required.');

    const query = {
      client_id: this.id,
      client_secret: this.secret,
      code: code
    };

    return request
      .post(STRAVA_URL.token)
      .query(query)
      .then(resp => {
        return Promise.resolve(resp.body.access_token);
      })
      .catch(err => {
        return Promise.reject(err);
      });
  }

  authHeaders = function(): Dict {
    assert.ok(this.secret, 'An access token is required.');

    return {
      Authorization: 'access_token ' + this.creds.accessToken
    };
  };

  getAthlete(athleteId?: number): Promise<Athelete> {
    let url = STRAVA_URL.athlete;
    if (isNumber(athleteId)) {
      url = url + '/' + athleteId;
    }
    return request
      .get(url)
      .set('Authorization', 'access_token ' + this.creds.accessToken)
      .then(resp => {
        if (resp && Athelete.isInstance(resp.body)) {
          return Promise.resolve(Athelete.newFromResponseData(resp.body));
        }
        throw new Error('Invalid Athelete return value');
      });
  }

  getActivities(options: StravaActivityOpts, callback): Promise<Dict[]> {
    let url = STRAVA_URL.activities;
    if (isNumber(options.athleteId)) {
      url = url + '/' + options.athleteId;
    }
    return request
      .get(url)
      .set('Authorization', 'access_token ' + this.creds.accessToken)
      .query(options.query)
      .then(resp => {
        if (!resp || !Array.isArray(resp.body)) {
          throw new Error(JSON.stringify(resp.body));
        }
        return Promise.resolve(resp.body);
      })
      .catch(err => {
        err.message = 'Activities - ' + err.message;
        throw err;
      });
  }

  getStarredSegments(accum: SummarySegment[], page: number = 1): Promise<void> {
    const perPage = 200;
    return request
      .get(STRAVA_URL.starred)
      .query({ per_page: perPage, page: page })
      .set('Authorization', 'access_token ' + this.creds.accessToken)
      .then(resp => {
        if (resp && Array.isArray(resp.body)) {
          console.log(`  Retrieved ${resp.body.length} starred segments for page ${page}`);
          resp.body.forEach(item => {
            let result = SummarySegment.newFromResponseData(item);
            accum.push(result);
          });
          if (resp.body.length >= perPage) {
            return this.getStarredSegments(accum, page + 1);
          }
          return Promise.resolve();
        }
        throw new Error('Invalid starred segments return value');
      });
  }

  getStreamCoords(source: StravaStreamSource, objId: StravaObjId, name: string) {
    let result: StravaCoord[] = [];
    let query = {
      keys: StravaStreamType.latlng,
      key_by_type: ''
    };
    return this.getStreams(source, objId, query)
      .then(resp => {
        if (Array.isArray(resp.latlng)) {
          console.log(`  Get ${name} Found ${resp.latlng.length} coordinates`);
          return Promise.resolve(resp.latlng);
        }
        console.log(`  Get ${name} did not find any coordinates`);
        return Promise.resolve([]);
      })
      .catch(err => {
        console.log(`  Get ${name} coordinates ${err.message}`);
        return Promise.resolve([]);
      });
  }

  getDetailedActivity(activity: Activity) {
    return request
      .get(STRAVA_URL.activities + '/' + activity.id)
      .set('Authorization', 'access_token ' + this.creds.accessToken)
      .then(resp => {
        if (resp && DetailedActivity.isInstance(resp.body)) {
          return Promise.resolve(DetailedActivity.newFromResponseData(resp.body));
        }
        throw new Error('Invalid DetailedActivity return value');
      })
      .catch(err => {
        err.message = `getActivity ${activity.id} ${err.message} (${activity.toString()})`;
        throw err;
      });
  }

  /**
   * Retrieve data for the designated type of stream
   * @param objId The activity or segement ID
   * @param types An array, usually [ 'latlng' ]
   * @param options Additional query string parameters, if any
   * @param callback
   * @returns {*}
   */
  getStreams(source: StravaStreamSource, objId: StravaSegmentId, options: Query) {
    return request
      .get(`${STRAVA_API_PREFIX}/${source}/${objId}/streams`)
      .set('Authorization', 'access_token ' + this.creds.accessToken)
      .query(options)
      .then(resp => {
        if (resp && Array.isArray(resp.body)) {
          let result: Dict = {};
          resp.body.forEach(item => {
            if (Array.isArray(item.data)) {
              result[item.type] = item.data;
            }
          });
          return Promise.resolve(result);
        }
        throw new Error(`Invalid data returned for ${source}`);
      });
  }

  getSegment(segmentId: StravaSegmentId) {
    return request
      .get(STRAVA_API_PREFIX + '/segments/' + segmentId)
      .set('Authorization', 'access_token ' + this.creds.accessToken);
  }

  getSegmentEfforts(segmentId: StravaSegmentId, params: Query) {
    return request.get(STRAVA_API_PREFIX + '/segments/' + segmentId + '/all_efforts').query(params);
  }
}
