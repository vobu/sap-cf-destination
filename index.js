const OAuth2 = require("oauth").OAuth2;
const cfenv = require("cfenv");
const rp = require("request-promise");
const http_verbs = require('./lib/http-verbs');

module.exports = workOn;

/**
 *
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} baseUrl - url to the OAuth server, emitting "/oauth/*" endpoints
 * @returns {Promise<any>}
 */
async function getAccessTokenForDestinationInstance(clientId, clientSecret, baseUrl) {
    return new Promise((resolve, reject) => {
        const oAuthClient = new OAuth2(clientId, clientSecret, `${baseUrl}/`, '/oauth/authorize', 'oauth/token', null);
        oAuthClient.getOAuthAccessToken('', {grant_type: 'client_credentials'},
            (err, accessToken, refreshToken, results) => {
                if (err) {
                    reject(err);
                }
                resolve(accessToken);
            });

    });

}

/**
 *
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} baseUrl - url to the OAuth server, emitting "/oauth/*" endpoints
 * @returns {Promise<any>}
 */
async function getAccessTokenForProxy(clientId, clientSecret, baseUrl) {
    return new Promise((resolve, reject) => {
        const oAuthClient = new OAuth2(clientId, clientSecret, `${baseUrl}/`, '/oauth/authorize', 'oauth/token', null);
        oAuthClient.getOAuthAccessToken('', {grant_type: 'client_credentials'},
            (err, accessToken, refreshToken, results) => {
                if (err) {
                    reject(err);
                }
                resolve(accessToken);
            });

    });

}

/**
 * retrieve destination configuration
 *
 * @param {string} destinationName
 * @param {string} destinationApiUrl
 * @param {string} accessToken - OAuth2.0 Bearer token ("client_credentials" grant type)
 * @returns {Promise<T | never>}
 */
async function getDestination(destinationName, destinationApiUrl, accessToken) {
    const options = {
        url: `${destinationApiUrl}/${destinationName}`,
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    };

    return rp(options)
        .catch(err => {
            throw err; // bubble-up
        });
}

/**
 * call a url in a destination via CF's included proxy
 *
 * @param {string} url - the absolute path (e.g. /my/api) to call in the destination
 * @param {object} destination - CF destination configuration object
 * @param {string} proxy - CF's integrated proxy as FQDN, e.g. http://10.0.1.23:20003
 * @param {string} proxyAccessToken - OAuth2.0 Bearer token ("client_credentials" grant type)
 * @param {string} [contentType]
 * @param {('GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD')} http_method
 * @param {object} [payload] - payload for POST, PUT or PATCH
 * @param {object} [formdata] - input-form like data, only relevant in conjunction with POST
 * @returns {Promise<T | never>}
 */
function callViaDestination(url, destination, proxy, proxyAccessToken, contentType = 'application/json', http_method, payload, formdata) {
    // standard header
    const headers = {
        'Proxy-Authorization': `Bearer ${proxyAccessToken}`
    };

    // if configured in CF cockpit,
    // use auth data
    if (destination.authTokens && destination.authTokens[0]) {
        headers['Authorization'] = `${destination.authTokens[0].type} ${destination.authTokens[0].value}`;
    }

    // standard options
    let options = {
        url: `${destination.destinationConfiguration.URL}${url}`,
        proxy: proxy
    };

    // enrich query option based on http verb
    switch (http_method) {
        case http_verbs.GET:
            Object.assign(options, {
                method: http_verbs.GET,
                headers: Object.assign(headers, {
                    'Content-type': contentType
                })
            });
            break;
        case http_verbs.HEAD:
            Object.assign(options, {
                method: http_verbs.HEAD,
                headers: Object.assign(headers, {
                    'Content-type': contentType
                })
            });
            break;
        case http_verbs.POST:
            Object.assign(options, {
                method: http_verbs.POST,
                headers: headers,
                body: payload
            });
            break;
        case http_verbs.PUT:
            Object.assign(options, {
                method: http_verbs.PUT,
                headers: headers,
                body: payload
            });
            break;
        case http_verbs.PATCH:
            Object.assign(options, {
                method: http_verbs.PATCH,
                headers: headers,
                body: payload
            });
            break;
        case http_verbs.POST_FORM:
            Object.assign(options, {
                method: http_verbs.POST,
                form: {
                    formdata
                },
                headers: headers,
                body: payload
            });
            break;
    }
    return rp(options)
        .catch(err => {
            throw err; // bubble-up
        });
}

/**
 *
 * @param {Map} options - configuration options for several CF service instances
 * @param {string} options.url - the url to call in the destination, absolute path (including leading slash)
 *                              e.g. /api/v1/json
 * @param {string} options.connectivity_instance - name of the instance of the connectivity service
 * @param {string} options.uaa_instance - name of the instance of the uaa service
 * @param {string} options.destination_instance - name of the instance of the destination service
 * @param {string} options.destination_name - name of the destination to use
 * @param {('GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD')} options.http_verb - HTTP method to use
 * @param {object} [options.payload] - payload for POST, PUT or PATCH
 * @param {object} [options.form_data] - input-form like data, only relevant in conjunction with POST
 * @param {string} [options.content_type] - value for "Content-Type" http header, e.g. "application/json"
 * @returns {Promise<any | never>}
 */
async function workOn(options) {
    // safeguards
    if (!http_verbs.hasOwnProperty(options.http_verb)) {
        throw Error(`unknown http method: ${options.http_verb}; allowed values: ${JSON.stringify(http_verbs)}`);
    }
    if (options.form_data && options.http_verb !== http_verbs.POST_FORM) {
        throw Error(`please specify ${http_verbs.POST_FORM} for submitting form-like data!`)
    }

    // build up necessary variables
    const connectivityInstance = cfenv.getAppEnv().getService(options.connectivity_instance);
    const connectivityClientId = connectivityInstance.credentials.clientid;
    const connectivityClientSecret = connectivityInstance.credentials.clientsecret;
    const proxy = `http://${connectivityInstance.credentials.onpremise_proxy_host}:${connectivityInstance.credentials.onpremise_proxy_port}`;

    const xsuaaInstance = cfenv.getAppEnv().getService(options.uaa_instance);
    const xsuaaUrl = xsuaaInstance.credentials.url;

    const destinationInstance = cfenv.getAppEnv().getService(options.destination_instance);
    const destinationApi = `${destinationInstance.credentials.uri}/destination-configuration/v1/destinations`;
    const destinationClientId = destinationInstance.credentials.clientid;
    const destinationClientSecret = destinationInstance.credentials.clientsecret;

    let queriedDestination = {};

    return getAccessTokenForDestinationInstance(destinationClientId, destinationClientSecret, xsuaaUrl)
        .then(accessTokenForDestination => {
            return getDestination(options.destination_name, destinationApi, accessTokenForDestination);
        })
        .then(destination => {
            queriedDestination = JSON.parse(destination);
            return getAccessTokenForProxy(connectivityClientId, connectivityClientSecret, xsuaaUrl)
        })
        .then(accessTokenForProxy => {
            return callViaDestination(
                options.url,
                queriedDestination,
                proxy,
                String(accessTokenForProxy),
                options.content_type || undefined,
                options.http_verb,
                options.payload || {},
                options.form_data || undefined);
        })
        .then(data => {
            return data;
        })
        .catch(err => {
            console.error(`couldn't query BE resource via destination: ${JSON.stringify(err)}`);
            throw err; // re-throw for bubble-up
        })


}