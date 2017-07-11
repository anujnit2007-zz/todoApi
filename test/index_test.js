'use strict';
let chai=require("chai");
let chaiHttp=require("chai-http");
let should=chai.should();
let server=require("../server.js");
chai.use(chaiHttp);
global.app = app; 
describe('/GET',()=>{
    it('returns task with particuler id',(done)=>{
        chai.request(server)
        .get('http://localhost:3001/tasks/595f5fe42f40da2c5c427e13')
        .end((err,res)=>{
            res.should.have.status(200);
            done();
        })

    })
})