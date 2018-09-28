'use strict';
const fs = require('fs');
const util = require('util');
const AWS = require('aws-sdk');
const _ = require('lodash');
const path = require('path');

// Takes arguments passed to the given function and calls aws ssm getParameters method
// Writes value of each parameter to a JSON file in ${outputs_dir} directory
// Returns an empty array ${output_files} if error
// If successful, returns an array ${output_files} of relative path(s) to the output file(s)
exports.exportParameterToFile = function(inputArray, callback) {
  var parameter_names = [];
  if (Array.isArray(inputArray)) {
    parameter_names = inputArray;
  }
  else {
    return callback(new Error("exportParameterToFile: Argument Error: Only Arrays are allowed!"))
  }
  console.log("exportParameterToFile: received input array of parameter store keys:");
  console.log(parameter_names);
  callSsm(parameter_names, function(err,data){
    if (err) {
      return callback(err);
    }
    // Write data to file after returning data from SSM
    return callback(null, data);
  });
}

function callSsm(parameter_names, callback) {
  var params = {
    Names: parameter_names, /* required - Array of strings */
    WithDecryption: true
  };
  var ssm = new AWS.SSM();

  ssm.getParameters(params, function(err, ssmResponse) {
    if (err) { // an error occurred in request response cycle to SSM
      return callback(err, err.stack);
    }
    else if (!_.isEmpty(ssmResponse.InvalidParameters)) {
        return callback(new Error("callSsm: Call to AWS SSM reported isnvalid Parmeter(s)"));
      }
    else {                                                        // successful ssm response
      writeResponseToFile(ssmResponse, function(err,output_files){
        if (err) {
          return callback(err);
        }
        return callback(null, output_files)
      });
    }
  });
}

function writeResponseToFile(ssmResponse, callback) {
  const outputs_dir = './data';
  if (!fs.existsSync(outputs_dir)){
      fs.mkdirSync(outputs_dir);
  }
  var output_files = [];
  _.forEach(ssmResponse.Parameters, function(param) {
    // AWS parmaters are usually organized into hierarchies, so I am replacing '/' with '-' so I can have clean filenames
    // @see https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-su-organize.html
    const file_name = _.replace(_.trim(param.Name, '/'), new RegExp("/", "g"), '-')
    const output_file_path = path.format({ dir: outputs_dir, name: file_name, ext: '.json'})
    const output_json_body = param.Value
    fs.writeFileSync(output_file_path, output_json_body, function (err) {
      if (err) {
        return callback(err);
      }
    });
    output_files.push(output_file_path);
  });
  console.log("writeResponseToFile: saved files, returning array of output file paths:")
  console.log(output_files)
  return callback(null, output_files);
}
