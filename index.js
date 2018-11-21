const OAuth2 = require("oauth").OAuth2;
const cfenv = require("cfenv");
const rp = require("request-promise");

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
 * @returns {Promise<T | never>}
 */
function callViaDestination(url, destination, proxy, proxyAccessToken, contentType = 'application/json') {
    // standard header
    const headers = {
        'Proxy-Authorization': `Bearer ${proxyAccessToken}`,
        'Content-type': contentType
    };

    // if configured in CF cockpit,
    // use auth data
    if (destination.authTokens && destination.authTokens[0]) {
        headers['Authorization'] = `${destination.authTokens[0].type} ${destination.authTokens[0].value}`;
    }

    const options = {
        url: `${destination.destinationConfiguration.URL}${url}`,
        method: 'GET',
        headers: headers,
        proxy: proxy
    };
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
 * @returns {Promise<any | never>}
 */
async function workOn(options) {
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
        .then( destination => {
            queriedDestination = JSON.parse(destination);
            return getAccessTokenForProxy(connectivityClientId, connectivityClientSecret, xsuaaUrl)
        })
        .then(accessTokenForProxy => {
            return callViaDestination(options.url, queriedDestination, proxy, accessTokenForProxy);
        })
        .then(data => {
            return data;
        })
        .catch(err => {
            console.error(`couldn't query BE resource via destination: ${JSON.stringify(err)}`);
            throw err; // re-throw for bubble-up
        })


}