var express = require('express');
var request = require('request');
var xml_parser = require('libxml-to-js');
var prettyjson = require('prettyjson');


var app = express.createServer();
var thresholds = {
    hot: 60,
    cold: 40,
    precip: 40
}

app.get('/:zip', function(req, res){
    get_weather(req.params.zip, function (error, weather) {
        if(error) {
            res.send(error);
        } else {
            res.send("Try wearing a " + clothes_for_temp(weather.temp) + " and " + bring_umbrella(weather.precip));
        }
    });
});

app.get('/feedback/:zip', function(req, res){
    get_weather(req.params.zip, function (error, weather) {
        var i_was = req.param("i_was");
        if(i_was){
            adjust_temp_threshold(weather.temp, i_was);
        }
        var rained = req.param("rained");
        if(rained){
            adjust_precip_threshold(weather.precip, rained);
        }

        res.send(thresholds);
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
                    var result_params = result.data.parameters
                    var max_temp = parseInt(result_params.temperature[0].value);
                    var min_temp = parseInt(result_params.temperature[1].value);
                    var mean_temp = (max_temp + min_temp) / 2;

                    var precip_prob = Math.max(result_params["probability-of-precipitation"].value[0]["#"],
                        result_params["probability-of-precipitation"].value[1]["#"]);

                    callback(null, { 
                        temp: mean_temp,
                        precip: precip_prob
                    });
                }
            });
        } else {
            callback("There was an error" + error);
        }
    });

};

function adjust_precip_threshold(precip, rained) { 
    if (rained == "yes") {
        thresholds.precip = precip - 1;
    } else if (rained == "no"){
        thresholds.precip = precip;
    }

}
function adjust_temp_threshold(temp, i_was) {
    if(i_was == "hot") {
        if (temp >= thresholds.cold) {
            thresholds.hot = temp-1;
        } else if (temp < thresholds.cold) {
            thresholds.cold = temp-1;
        }
    } else if(i_was == "cold") {
        if (temp <= thresholds.hot) {
            thresholds.cold = temp+1;
        } else if(temp > thresholds.hot) {
            thresholds.hot = temp+1;
        }
    }
}


function clothes_for_temp(temp) {
    if(temp < thresholds.cold) {
        return "coat";
    } else if (temp <= thresholds.hot) {
        return "sweater";
    } else {
        return "shirt";
    }
}

function bring_umbrella(precip_prob) {
    if(precip_prob > thresholds.precip) {
        return "bring an umbrella";
    } else {
        return "you won't need that umbrella";
    }
}

function weather_api_str(zip) {
    return "http://graphical.weather.gov/xml/sample_products/browser_interface/ndfdXMLclient.php?zipCodeList=" + zip + "&product=time-series&begin=2012-05-04T00%253A00%253A00&end=2012-05-05T00%253A00%253A00&maxt=maxt&mint=mint&pop12=pop12"
}

app.listen(3000);

