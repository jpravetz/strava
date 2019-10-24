import { Dict, EpochSeconds } from './util/file';
import * as assert from 'assert';
import request = require('superagent');
import { isNumber } from 'epdoc-util';
import { StravaCreds } from './strava-creds';

const STRAVA_URL_PREFIX = process.env.STRAVA_URL_PREFIX || 'https://www.strava.com/';
const STRAVA_URL = {
  authorize: STRAVA_URL_PREFIX + 'oauth/authorize',
  token: STRAVA_URL_PREFIX + 'oauth/token',
  athlete: STRAVA_URL_PREFIX + 'api/v3/athlete',
  picture: STRAVA_URL_PREFIX + 'api/v3/athlete/picture',
  activities: STRAVA_URL_PREFIX + 'api/v3/activities'
};

export type StravaCode = string;
export type StravaSecret = string;
export type StravaAccessToken = string;
export type StravaRefreshToken = string;
export type StravaClientId = number;

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
  scope: 'read_all,activity:read_all',
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

  getTokens(code: StravaCode) {
    let payload = {
      code: code,
      client_id: this.id,
      client_secret: this.secret,
      grant_type: 'authorization_code'
    };
    console.log('getTokens request', payload);
    return request
      .post(STRAVA_URL.token)
      .send(payload)
      .then(resp => {
        console.log('getTokens response', resp);
        return this.creds.write(resp);
      })
      .then(resp => {
        console.log('Credentials written to local storage');
      });
  }

  getTokenPayload(options: TokenUrlOpts = {}): string {
    let opts = Object.assign(defaultAuthOpts, options);

    return (
      `${STRAVA_URL.token}?client_id=${this.id}` +
      `&secret=${this.secret}` +
      `&code=${opts.code}` +
      `&grant_type=authorization_code`
    );
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

  getAthlete(athleteId?: number): Dict {
    let url = STRAVA_URL.athlete;
    if (isNumber(athleteId)) {
      url = url + '/' + athleteId;
    }
    return request.get(url).set('Authorization', 'access_token ' + this.creds.accessToken);
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
        if (!Array.isArray(resp)) {
          throw new Error(JSON.stringify(resp));
        }
        return Promise.resolve(resp);
      })
      .catch(err => {
        err.message = 'Activities - ' + err.message;
        throw err;
      });
  }
}
