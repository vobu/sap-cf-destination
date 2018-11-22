const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const callDestination = require("../index");

// set up the middleware
chai.use(chaiAsPromised);
chai.should();

describe('input options', () => {
    it('should throw when an unsupported http method is supplied', () => {
            return callDestination({http_verb: 'BLA'}).should.be.rejected;
    });
    
});