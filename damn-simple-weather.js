require('date-utils');
var express = require('express');
var request = require('request');
var xml_parser = require('libxml-to-js');

var app = express.createServer();

var cache = {
  date: Date.today()
};

app.get('/', function(req, res){
    res.send("Use /(zipcode) to get weather for your zipcode. ie: http://[myurl.com]/10027");
});

app.get('/:zip', function(req, res){
    get_weather(req.params.zip, function (error, weather) {
        if(Date.compare(Date.today(), cache.date) !== 0) {
            cache = {
              date: Date.today()
            };
        }
        if(error) {
            res.send(error);
        } else {
            if (cache['z' + req.params.zip] !== undefined) {
                res.send(cache['z' + req.params.zip]);
            } else {
                reply = "Weather for: " + req.params.zip + " on " +
                    Date.today().toFormat("YYYY-MM-DD") + "<br />" +
                    weather.min + "-" + weather.max + "F<br />" +
                    weather.precip + "% chance of precipitation";
                reply = "<div style=\"text-align: center\">" + reply + "</div>";
                cache['z' + req.params.zip] = reply;
                res.send(reply);
            }
        }
    });
});

function get_weather(zip, callback) {
    request(weather_api_str(zip), function (error, response, body) {
        if(!error && response.statusCode == 200) {
            xml_parser(body, function (parser_error, result) {
                if(parser_error) {
                    callback("Parser error: " + parser_error);
                } else if(result.error) {
                    callback("API error " + result.error);
                } else {
                    var result_params = result.data.parameters;
                    var max_temp = parseInt(result_params.temperature[0].value);
                    var min_temp = parseInt(result_params.temperature[1].value);
                    var mean_temp = (max_temp + min_temp) / 2;

                    var precip_prob = Math.max(result_params["probability-of-precipitation"].value[0]["#"],
                        result_params["probability-of-precipitation"].value[1]["#"]);

                    callback(null, {
                        max: max_temp,
                        min: min_temp,
                        mean: mean_temp,
                        precip: precip_prob
                    });
                }
            });
        } else {
            callback("There was an error" + error);
        }
    });

};

function weather_api_str(zip) {
    return "http://graphical.weather.gov/xml/sample_products/browser_interface/ndfdXMLclient.php?zipCodeList=" + zip + "&product=time-series&begin=" + Date.today().toFormat("YYYY-MM-DD") + "&end=" + Date.tomorrow().toFormat("YYYY-MM-DD") + "&maxt=maxt&mint=mint&pop12=pop12"
}

app.listen(6767);

