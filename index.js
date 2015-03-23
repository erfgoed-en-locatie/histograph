var fs = require('fs'),
    express = require('express'),
    request = require('request'),
    cors = require('cors'),
    config = require(process.env.HISTOGRAPH_CONFIG),
    exampleUrls = require('./exampleUrls.json'),
    context = require('./context.json'),
    app = express(),
    elasticsearch = require('./elasticsearch'),
    logo = fs.readFileSync('./histograph.txt', 'utf8'),
    traversalApiUri = 'http://' + config.core.traversal.host
        + ':' + config.core.traversal.port
        + '/traversal',
    // Set URI of this API, from config
    apiUri = config.api.host + (config.api.externalPort != 80 ? ':' + config.api.externalPort : ''),
    validSearchReqParams = [
      "name",
      "uri",
      "hgid"
    ],
    validFilterReqParams = [
      "type"
    ];

app.use(cors());

app.get('/', function (req, res) {
  res.send({
    name: 'Histograph API',
    version: '0.1.3',
    message: 'Histograph - historical geocoder (alpha version)',
    docs: "https://github.com/histograph/api",
    examples: exampleUrls.map(function(query) { return 'http://' + apiUri + query; })
  });
});

app.get('/search', function (req, res) {

  // Check request params for valid search and filter parameters
  var searchReqParams = paramsFromRequest(validSearchReqParams, req.query),
      filterReqParams = paramsFromRequest(validFilterReqParams, req.query);

  var options = {};
  if (req.query.highlight === "true") {
    options.highlight = true;
  }

  if (req.query.exact === "true") {
    options.exactMatch = true;
  } else {
    options.exactMatch = false;
  }

  if (searchReqParams.length == 1) {
    elasticsearch.search(
        searchReqParams[0].param,
        searchReqParams[0].value,
        filterReqParams,
        options,
        function(error, result) {
      if (error) {
        res.status(400).send({
          error: "Error getting data from Elasticsearch",
          message: result
        });
      } else {
        var hgids = result.map(function(hit) { return hit._id; });
            options = {
              uri: traversalApiUri,
              method: 'POST',
              json: {
                hgids: hgids
              }
            };

        request(options, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            res.send({
              "@context": context,
              "type": body.type,
              "features": body.features.map(function(feature) {
                feature.properties.pits = feature.properties.pits.map(function(pit) {
                  if (pit.relations) {
                    Object.keys(pit.relations).map(function(relation) {
                      pit.relations[relation] = pit.relations[relation].map(function(hgid) {
                        return {
                          "@id": hgid
                        };
                      });
                    });
                    pit.relations["@id"] = pit.hgid;
                  }
                  pit["@id"] = pit.hgid;
                  return pit;
                });

                return {
                  type: feature.type,
                  properties: feature.properties,
                  geometry: feature.geometry
                };
              })
            });
          } else {
            res.status(response.statusCode).send({
              error: "Error getting data from Histograph Core",
              message: error
            });
          }
        });
      }
    });
  } else {
    res.status(400).send({
      error: "Only one of the following search parameters allowed: "
          + validSearchReqParams
                .map(function(param) { return "'" + param + "'"; })
                .join(", ")
    });
  }
});

function paramsFromRequest(validParams, query) {
  return validParams
    .map(function(reqParam) {
      if (query[reqParam]) {
        return {
          param: reqParam,
          value: query[reqParam]
        };
      } else {
        return false;
      }
    })
    .filter(function(reqParam) {
      return reqParam;
    });
}

var server = app.listen(config.api.internalPort, function () {
  console.log(logo);
  console.log('Histograph API listening at port ' + config.api.internalPort);
});
