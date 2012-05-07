require('date-utils');
var express = require('express');
var request = require('request');
var xml_parser = require('libxml-to-js');

var app = express.createServer();
app.set("view engine", "ejs");

var cache = {
  date: Date.today()
};

app.get('/', function(req, res){
    if(req.query.zip) {
        get_weather(res, req.query.zip, render_weather);
    } else {
        res.render("index.ejs");
    }
});

app.get('/:zip', function(req, res){
    get_weather(res, req.params.zip, render_weather);
});

function render_weather(zip, res, error, weather) {
    if(Date.compare(Date.today(), cache.date) !== 0) {
        cache = {
          date: Date.today()
        };
    }
    if(error) {
        res.send(error);
    } else {
        if (cache['z' + zip] !== undefined) {
            res.send(cache['z' + zip]);
        } else {
            res.render("weather_for_zip", {
              weather: weather,
              zip: zip,
              today: Date.today().toFormat("YYYY-MM-DD")
            });
        }
    }
}

function get_weather(res, zip, callback) {
    request(weather_api_str(zip), function (error, response, body) {
        if(!error && response.statusCode == 200) {
            xml_parser(body, function (parser_error, result) {
                if(parser_error) {
                    callback(zip, res, "Parser error: " + parser_error);
                } else if(result.error) {
                    callback(zip, res, "API error " + result.error);
                } else if(result && result.data) {
                    var result_params = result.data.parameters;

                    var precip_prob;
                    // there may be a second precip prob
                    if(!result_params["probability-of-precipitation"].value[1]){
                        precip_prob = result_params["probability-of-precipitation"].value;
                    } else {
                        precip_prob = Math.max(result_params["probability-of-precipitation"].value[0]["#"],
                            result_params["probability-of-precipitation"].value[1]["#"]);
                    }

                    var temp;
                    // there is only one temperature, so its not an array
                    if(!result_params.temperature[0]){
                        temp = parseInt(result_params.temperature.value);

                        callback(zip, res, null, {
                            temp: temp,
                            precip: precip_prob
                        });
                    } else {
                        var max_temp = parseInt(result_params.temperature[0].value);
                        var min_temp = parseInt(result_params.temperature[1].value);
                        var mean_temp = (max_temp + min_temp) / 2;

                        callback(zip, res, null, {
                            max: max_temp,
                            min: min_temp,
                            mean: mean_temp,
                            precip: precip_prob
                        });
                    }
                } else {
                  callback(zip, res, "Zip code not found??");
                }
            });
        } else {
            callback(zip, res, "There was an error" + error);
        }
    });

}

function weather_api_str(zip) {
    return "http://graphical.weather.gov/xml/sample_products/browser_interface/ndfdXMLclient.php?zipCodeList=" + zip + "&product=time-series&begin=" + Date.today().toFormat("YYYY-MM-DD") + "&end=" + Date.tomorrow().toFormat("YYYY-MM-DD") + "&maxt=maxt&mint=mint&pop12=pop12";
}

app.listen(process.env.PORT || 6767);

