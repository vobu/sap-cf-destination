const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const jsonServer = require('json-server');
const path = require('path');
const callDestination = require('../index');

// set up the middleware
chai.use(chaiAsPromised);
chai.should();
const expect = chai.expect;

// rewire for testing internal functions
const app = rewire('../index.js');
callViaDestination = app.__get__('callViaDestination');

let mockserver = {};
const mockserverPort = 3000;
const mockserverUrl = `http://localhost:${mockserverPort}`;

describe('callDestination in non-CF env', () => {
    before(done => {
        // hard-wire "local" mode
        this.VCAP_APPLICATION = process.env.VCAP_APPLICATION;
        delete process.env.VCAP_APPLICATION;

        // start mock server
        const server = jsonServer.create();
        const router = jsonServer.router(path.join(__dirname, 'mockdata', 'data.json'));
        const middlewares = jsonServer.defaults();

        server.use(middlewares);
        server.use(router);
        mockserver = server.listen(3000, () => {
            console.log('JSON Server is running');
            done();
        });
    });

    it('HEAD on a valid endpoint', () => {
        let parameters = {
            url: '/builds/1',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'HEAD'
        };
        return callDestination(parameters)
            .then(data => {
                expect(data).to.be.an('object');
            })
            .catch(err => {
                expect.fail(err);
            });
    });

    it('OPTIONS of a valid endpoint', () => {
        let parameters = {
            url: '/builds/1',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'OPTIONS'
        };
        return callDestination(parameters)
            .then(data => {
                expect(data).to.be.empty;
            })
            .catch(err => {
                expect.fail(err);
            });
    });
    
    it('GET a valid endpoint', () => {
        let parameters = {
            url: '/builds/1',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'GET'
        };
        return callDestination(parameters)
            .then(data => {
                const result = JSON.parse(data);
                expect(result.id).to.be.equal(1);
            })
            .catch(err => {
                expect.fail(err);
            });
    });

    it('POST to a valid endpoint', () => {
        let parameters = {
            url: '/builds',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'POST',
            payload: {
                "me": "here"
            }
        };
        return callDestination(parameters)
            .then(validObject => {
                expect(validObject.me).to.be.equal("here");
            })
            .catch(err => {
                expect.fail(err);
            });
    });
    
    it('PUT to a valid endpoint', () => {
        let parameters = {
            url: '/jobs/1',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'PUT',
            payload: {
                "title": "new title"
            }
        };
        return callDestination(parameters)
            .then(validObject => {
                expect(validObject.id).to.be.equal(1);
            })
            .catch(err => {
                expect.fail(err);
            });
    });
    
    it('PATCH a valid endpoint', () => {
        let parameters = {
            url: '/jobs/1',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'PATCH',
            payload: {
                "title": "new title"
            }
        };
        return callDestination(parameters)
            .then(validObject => {
                expect(validObject.id).to.be.equal(1);
            })
            .catch(err => {
                expect.fail(err);
            });
    });
    
    it('DELETE a valid endpoint', () => {
        let parameters = {
            url: '/builds/1',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'DELETE'
        };
        return callDestination(parameters)
            .then(validObject => {
                expect(validObject).to.exist;
            })
            .catch(err => {
                expect.fail(err);
            });
    });

    
    
    
    after(done => {
        // restore actual runtime env (if applicable)
        process.env.VCAP_APPLICATION = this.VCAP_APPLICATION;

        // stop mock server
        mockserver.close(function () {
            console.log('JSON server stopped');
            done();
        })
    })
});