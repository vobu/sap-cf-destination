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

let mockserver = {};
const mockserverPort = 3000;
const mockserverUrl = `http://localhost:${mockserverPort}`;

describe('callDestination in non-CF env, query options', () => {
    before(done => {
        // hard-wire "local" mode
        this.VCAP_APPLICATION = process.env.VCAP_APPLICATION;
        delete process.env.VCAP_APPLICATION;

        // start mock server
        const server = jsonServer.create();
        const router = jsonServer.router(path.join(__dirname, 'mockdata', 'local-query-actions-data.json'));
        const middlewares = jsonServer.defaults();

        server.use(middlewares);
        server.use(router);
        mockserver = server.listen(3000, () => {
            console.log('JSON Server is running');
            done();
        });
    });
    
    
    it('GET full response from valid endpoint', () => {
        let parameters = {
            url: '/builds/1',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'GET',
            full_response: true
        };
        return callDestination(parameters)
            .then(object => {
                expect(object.statusCode).to.equal(200);
                expect(object.headers).to.be.an('object');
            })
            .catch(err => {
                expect.fail(err);
            });
    });

    it('GET a 404 as a valid response from non-existing endpoint', () => {
        let parameters = {
            url: '/builds/doesnt/exist',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'GET',
            tech_error_only: true
        };
        return callDestination(parameters)
            .then(object => {
                expect(JSON.parse(object)).to.be.an('object');
            })
            .catch(err => {
                expect.fail(err);
            });
    });

    it('GET a 404 as a valid response + error code from non-existing endpoint', () => {
        let parameters = {
            url: '/builds/doesnt/exist',
            connectivity_instance: 'a',
            uaa_instance: 'b',
            destination_instance: 'c',
            destination_name: mockserverUrl,
            http_verb: 'GET',
            tech_error_only: true,
            full_response: true
        };
        return callDestination(parameters)
            .then(object => {
                expect(object.statusCode).to.equal(404);
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