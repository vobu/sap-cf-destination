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
    if (cfenv.getAppEnv().isLocal) {
        return Promise.resolve("mockLocalAccessToken");
    }
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
    if (cfenv.getAppEnv().isLocal) {
        return Promise.resolve("mockLocalProxyToken");
    }
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
    if (cfenv.getAppEnv().isLocal) {
        let object = {
            "destinationConfiguration": {
                "URL": destinationName
            }
        };
        return Promise.resolve(JSON.stringify(object));
    }
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
 * @param {Map} parameters - various configuration options
 * @param {string} parameters.url - the absolute path (e.g. /my/api) to call in the destination
 * @param {object} parameters.destination - CF destination configuration object
 * @param {string} parameters.proxy - CF's integrated proxy as FQDN, e.g. http://10.0.1.23:20003
 * @param {string} parameters.proxyAccessToken - OAuth2.0 Bearer token ("client_credentials" grant type)
 * @param {string} [parameters.contentType]
 * @param {('GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS')} parameters.http_method
 * @param {object} [parameters.payload] - payload for POST, PUT or PATCH
 * @param {object} [parameters.formData] - play a browser a submit a form!
 * @param {boolean} [parameters.fullResponse] - pass entire reponse through from BE via proxy
 * @param {boolean} [parameters.techErrorOnly] - get a rejection only if the request failed for technical reasons
 * @param {boolean} [parameters.binary] - whether to expect (and deliver) a binary at @param url
 * @returns {Promise<T | never>}
 */
function callViaDestination(parameters) {
    let {url, destination,
        proxy, proxyAccessToken,
        contentType = 'application/json', http_method, payload,
        fullResponse, formData, techErrorOnly, binary, scc_name} = parameters;

    let headers = {};
    let options = {
        url: `${destination.destinationConfiguration.URL}${url}`,
        resolveWithFullResponse: fullResponse,
        simple: !techErrorOnly
    };

    // this allows binary downloads
    if (binary) {
        Object.assign(options, {
            encoding: null
        });
    }

    // enhance only if running in CF
    if (!cfenv.getAppEnv().isLocal) {
        // add auth for proxy
        headers = {
            'Proxy-Authorization': `Bearer ${proxyAccessToken}`
        };
        // add proxy
        Object.assign(options, {
            proxy: proxy
        });
    }

    // if configured in CF cockpit,
    // use auth data
    if (destination.authTokens && destination.authTokens[0]) {
        headers['Authorization'] = `${destination.authTokens[0].type} ${destination.authTokens[0].value}`;
    }
    
    //Adding cloud connector name header if passed from request
    if(`${scc_name}`!=="undefined"){
	    headers['SAP-Connectivity-SCC-Location_ID'] = `${scc_name}`;
    }

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
        case http_verbs.OPTIONS:
            Object.assign(options, {
                method: http_verbs.OPTIONS,
                headers: headers
            });
            break;
        case http_verbs.POST:
            // processing of "browser submitting form" behaviour
            // and regular (JSON) post is different
            if (parameters.formData) {
                Object.assign(options, {
                    method: http_verbs.POST,
                    headers: headers,
                    formData: formData
                });
            } else {
                Object.assign(options, {
                    method: http_verbs.POST,
                    headers: Object.assign(headers, {
                        'Content-type': contentType
                    }),
                    body: payload,
                    json: true
                });
            }
            break;
        case http_verbs.PUT:
            Object.assign(options, {
                method: http_verbs.PUT,
                headers: Object.assign(headers, {
                    'Content-type': contentType
                }),
                body: payload,
                json: true
            });
            break;
        case http_verbs.PATCH:
            Object.assign(options, {
                method: http_verbs.PATCH,
                headers: Object.assign(headers, {
                    'Content-type': contentType
                }),
                body: payload,
                json: true
            });
            break;
        case http_verbs.DELETE:
            Object.assign(options, {
                method: http_verbs.DELETE,
                headers: headers
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
 * @param {('GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS')} options.http_verb - HTTP method to use
 * @param {object} [options.payload] - payload for POST, PUT or PATCH
 * @param {object} [options.formData] - mimic a browser for POSTing a form to the destination; implies http verb POST
 * @param {string} [options.content_type] - value for "Content-Type" http header, e.g. "application/json"
 * @param {boolean} [options.full_response] - whether to have the full response (including all headers etc)
 *                                          pass through to the caller (BE -> proxy -> client)
 * @param {boolean} [options.tech_error_only] - get a rejection only if the request failed for technical reasons,
 *                                          so e.g. 404 is considered a valid response
 * @param {boolean} [options.binary] - whether to expect (and deliver) a binary at @param url
 * @returns {Promise<any | never>}
 */
async function workOn(options) {
    // safeguards
    if (!http_verbs.hasOwnProperty(options.http_verb)) {
        throw Error(`unknown http method: ${options.http_verb}; allowed values: ${JSON.stringify(http_verbs)}`);
    }

    // build up necessary variables
    let connectivityInstance;
    let connectivityClientId;
    let connectivityClientSecret;
    let proxy;
    let xsuaaInstance;
    let xsuaaUrl;
    let destinationInstance;
    let destinationApi;
    let destinationClientId;
    let destinationClientSecret;

    // differentiate between running in non-CF and CF environment
    if (!cfenv.getAppEnv().isLocal) {
        connectivityInstance = cfenv.getAppEnv().getService(options.connectivity_instance);
        connectivityClientId = connectivityInstance.credentials.clientid;
        connectivityClientSecret = connectivityInstance.credentials.clientsecret;
        proxy = `http://${connectivityInstance.credentials.onpremise_proxy_host}:${connectivityInstance.credentials.onpremise_proxy_port}`;

        xsuaaInstance = cfenv.getAppEnv().getService(options.uaa_instance);
        xsuaaUrl = xsuaaInstance.credentials.url;

        destinationInstance = cfenv.getAppEnv().getService(options.destination_instance);
        destinationApi = `${destinationInstance.credentials.uri}/destination-configuration/v1/destinations`;
        destinationClientId = destinationInstance.credentials.clientid;
        destinationClientSecret = destinationInstance.credentials.clientsecret;
    } else {
        connectivityClientId = 'connectivityClientId';
        connectivityClientSecret = 'connectivityClientSecret';
        proxy = null;

        xsuaaUrl = 'http://localhost';

        destinationApi = `http://localhost/destination-configuration/v1/destinations`;
        destinationClientId = 'destinationClientId';
        destinationClientSecret = 'destinationClientSecret';
    }


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
                {
                    url: options.url,
                    destination: queriedDestination,
                    proxy: proxy,
                    proxyAccessToken: String(accessTokenForProxy),
                    contentType: options.content_type || undefined,
                    http_method: options.http_verb,
                    payload: options.payload || undefined,
                    formData: options.formData || undefined,
                    fullResponse: options.full_response || false,
                    techErrorOnly: options.tech_error_only || false,
                    binary: options.binary || false,
                    scc_name: options.scc_name || undefined
                });
        })
        .then(data => {
            return data;
        })
        .catch(err => {
            console.error(`couldn't query BE resource via destination: ${JSON.stringify(err)}`);
            throw err; // re-throw for bubble-up
        })


}
