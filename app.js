
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , https = require('https')
  , path = require('path')
  , fs = require('fs');

var app = express();

var CAS = require('cas');
var cas = new CAS({
      base_url: 'https://dk.example.org:8143/cas',
      service: 'http://dk.example.org:3000',
      proxy_server: true,
      proxy_server_port: 0,
      proxy_server_key: fs.readFileSync('privatekey.pem'),
      proxy_server_cert: fs.readFileSync('cert.pem'),
      proxy_callback_host: 'dk.example.org',
      proxy_callback_port: 9999,
      version: 2.0
});

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

var doSimpleAuthenticated = function(req, res, extended) {      
    res.send({authenticated: extended});
};   

app.get('/', function(req, res) {
    cas.authenticate(req, res, function(err, status, username, extended) {
        if (err) {
          // Handle the error
          res.send({error: err});
        } else {
          // Log the user in 
          cas.log("/: CAS successfully authenticated: " + username);        
          doSimpleAuthenticated(req, res, extended);  
        }     
    });
    
});

app.get('/proxied', function(req, res) {
    cas.authenticate(req, res, function(err, status, username, extended) {
      
        if (err) {
            res.end(err.message);
            return;
        }
        cas.log("/proxied: CAS successfully authenticated: " + username);
        var pgtIOU = extended['PGTIOU'];
        
        if (!pgtIOU) {
            res.end("No pgtIOU could be obtained from the CAS server. Aborting authentication...");
            return;
        } else {
            cas.log("/proxied: CAS Server returned the pgtIOU: " + pgtIOU);
        }
        cas.log("/proxied: Proceeding with proxied request...");
        cas.proxiedRequest(pgtIOU, {
            protocol: 'https',
            method: 'GET',
            hostname: 'dk.example.org',
            port: 443,
            pathname: '/samplerest/Service1/'
        }, function(err, proxyReq, proxyRes) {
            if (err) {
                res.end("An error has occurred: " + err.message);
                return;
            }
     
            if (!proxyRes) {
              res.end("Proxy authentication has failed. ");
              return;
            }
            
            proxyRes.on('data', function(chunk) {

                res.write(chunk);
            });
            proxyRes.on('end', function() {
                res.write('<div>Completed proxy authentication successfully.<br/></div>');
                res.end();
            });
        });


        return;
    });
}); 

http.createServer(app).listen(app.get('port'), function(){
  cas.log("createServer(): express server is listening on port " + app.get('port'));
});