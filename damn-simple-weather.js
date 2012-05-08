require('date-utils');
var express = require('express');
var request = require('request');
var xml_parser = require('libxml-to-js');

var app = express.createServer();
app.set("view engine", "ejs");

var cache = {
  date: Date.today()
};

function NOAA_weather_api_str(zip) {
    return "http://graphical.weather.gov/xml/sample_products/browser_interface/ndfdXMLclient.php?zipCodeList=" +
        zip + "&product=time-series&begin=" + Date.today().toFormat("YYYY-MM-DD") +
        "&end=" + Date.tomorrow().toFormat("YYYY-MM-DD") + "&maxt=maxt&mint=mint&pop12=pop12";
}

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
    request(NOAA_weather_api_str(zip), function (error, response, body) {
        if(!error && response.statusCode == 200) {
            xml_parser(body, function (parser_error, result) {
                if(parser_error) {
                    callback(zip, res, "Parser error: " + parser_error);
                } else if(result.error) {
                    callback(zip, res, "API error " + result.error);
                } else if(result && result.data) {
                    callback(zip, res, null, parse_NOAA_response(result));
                } else {
                    callback(zip, res, "Zip code not found??");
                }
            });
        } else {
            callback(zip, res, "There was an error" + error);
        }
    });
}

function parse_NOAA_response(response) {
    var resp_precip_obj = response.data.parameters["probability-of-precipitation"];
    var resp_temperature_obj = response.data.parameters["temperature"];

    //console.log(response_params);
    //console.log(isArray(response_params["probability-of-precipitation"]).value);
    //console.log(isArray(response_params.temperature));

    var precip_prob_obj = {
        precip_prob: 0
    };
    if(is_array(resp_precip_obj)) {
        var precip_count = 0;
        for(var precip_chance in resp_precip_obj){
            precip_count++;
            precip_prob_obj["precip"] += precip_chance["#"];
        }
        precip_prob_obj["precip"] /= precip_count;
    } else {
        precip_prob_obj["precip"] = resp_precip_obj.value;
        console.log(resp_precip_obj);
        console.log(precip_prob_obj);
    }

    var temperature_obj = {};
    if(is_array(resp_temperature_obj)) {
        var min_temp_count = 0;
        var max_temp_count = 0;
        temperature_obj["min_temp"] = 0;
        temperature_obj["max_temp"] = 0;
        for(var temp_value in resp_temperature_obj) {
            if(temp_value.name === "Daily Minimum Temperature") {
                temperature_obj["min_temp"] += temp_value.value;
                min_temp_count++;
            } else if(temp_value.name === "Daily Maximum Temperature") {
                temperature_obj["max_temp"] += temp_value.value;
                max_temp_count++;
            }
        }
        temperature_obj["max_temp"] = max_temp_count == 0 ? undefined : temperature_obj["max_temp"] / max_temp_count;
        temperature_obj["min_temp"] = min_temp_count == 0 ? undefined : temperature_obj["min_temp"] / min_temp_count;
    } else {
        temperature_obj["temp"] = parseInt(resp_temperature_obj.value);
    }

    return merge_objects(temperature_obj, precip_prob_obj);

    /*
    var temp;
    // there is only one temperature, so its not an array
    if(!response_params.temperature[0]){
        temp = parseInt(response_params.temperature.value);

        return {
            temp: temp,
            precip: precip_prob
        };
    } else {
        var max_temp = parseInt(response_params.temperature[0].value);
        var min_temp = parseInt(response_params.temperature[1].value);
        var mean_temp = (max_temp + min_temp) / 2;

        return {
            max: max_temp,
            min: min_temp,
            mean: mean_temp,
            precip: precip_prob
        };
    }
    */
}

function is_array(obj) {
    return obj.length ? true : false;
}

function merge_objects(obj1, obj2) {
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

app.listen(process.env.PORT || 6767);

