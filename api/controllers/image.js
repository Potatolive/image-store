'use strict';

/*
 'use strict' is not required but helpful for turning syntactical errors into true errors in the program flow
 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
*/

/*
 Modules make it possible to import JavaScript files into your application.  Modules are imported
 using 'require' statements that give you a reference to the module.

  It is a good idea to list the modules that your application depends on in the package.json in the project root
 */
var util = require('util');
var uuid = require('uuid');
var AWS = require('aws-sdk')
var easyimg = require('easyimage');
var fs = require('fs');

/*
 Once you 'require' a module you can reference the things that it exports.  These are defined in module.exports.

 For a controller in a127 (which this is) you should export the functions referenced in your Swagger document by name.

 Either:
  - The HTTP Verb of the corresponding operation (get, put, post, delete, etc)
  - Or the operationId associated with the operation in your Swagger document

  In the starter/skeleton project the 'get' operation on the '/hello' path has an operationId named 'hello'.  Here,
  we specify that in the exports of this module that 'hello' maps to the function named 'hello'
 */
module.exports = {
  upload: upload,
  crop: crop,
  sign: sign
};

var bucketName = 'potatolive-image';

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function upload(req, res) {
  console.log(req.swagger.params.file.value);

  if(
    !req.swagger.params || 
    !req.swagger.params.file || 
    !req.swagger.params.file.value || 
    req.swagger.params.file.value.buffer <= 0 ) 
  {
    res.status(400).json({'message': 'File or its content missing in the request!'})
  } else {
    var fileParams = req.swagger.params.file.value;
    
    if(fileParams.mimetype !== 'image/jpeg') {
      res.status(500).json({'message': 'Only jpeg files allowed!'});
    } else {
      var value = req.swagger.params.file.value.buffer;
      var key = req.swagger.params.file.value.originalname;

      uploadToS3(key, value, function(resp) {
        res.json(resp);
      }, function error(err) {
        res.json({'message': err});
      });
    }  
  }
}

function uploadToS3(key, value, success, error) {
  var awsConfig = {region: process.env.AWS_DEFAULT_REGION};
  AWS.config.update(awsConfig);

  if(process.env.NODE_ENV === "development") {
      AWS.config.update(
        {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
  }

  var s3 = new AWS.S3();
  
  var params = {
      Bucket: bucketName,
      Key: key,
      Body: value,
      ACL:'public-read'
  };

  s3.putObject(params, 
    function(data) {
      var resp = {
        url: 
          'https://s3.' + 
          process.env.AWS_DEFAULT_REGION + 
          '.amazonaws.com/' + 
          bucketName + 
          '/' + 
          key
      };
      success(resp);
    },
    function(error) {
      console.log(error);
      error('Error uploading file!');
    }
  );
}

function crop(req, res) {
  var cropParam = req.swagger.params.cropParam.value;

  var srcUrl = cropParam.imageUrl;
  var dstId = uuid.v4();

  var cropOption = {
    src: srcUrl,
    dst: '/tmp/' + dstId + '.jpeg',
    cropwidth: cropParam.w,
    cropheight: cropParam.h,
    gravity: 'NorthWest',
    x: cropParam.x,
    y: cropParam.y
  }

  console.log(cropOption);

  easyimg.crop(cropOption).then(function(file) {
    console.log(file);
    fs.readFile(file.path, function(err, file_buffer) {
      uploadToS3(dstId + '.jpeg', file_buffer, function(resp) {
        var fileParams = {
          id: dstId,
          url: resp.url
        }
        res.json(fileParams);
      }, function error(err) {
        res.json({'message': err});
      });
    });    
  });
}

function sign(req, res) {
  var filename = uuid.v4() + ".jpeg";
  console.log("File : " + filename);

  var awsConfig = {region: process.env.AWS_DEFAULT_REGION};
  AWS.config.update(awsConfig);

  if(process.env.NODE_ENV === "development") {
      AWS.config.update(
        {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
  }

  var s3 = new AWS.S3();
  
  var s3_params = {
      Bucket: bucketName,
      Key: filename,
      Expires: 120,
      ACL: 'public-read',
      ContentType: req.swagger.params.fileType.value
  };
  console.log(s3_params);
  
  s3.getSignedUrl('putObject', s3_params, function(err, data){
      if(err){
          console.log(err);
          res.json({'message': 'Unable to get signed URL'})
      }
      else{
          console.log(data);
          var return_data = {
              signed_request: data,
              url: 'https://' + bucketName +'.s3.amazonaws.com/'+filename,
              filename : filename,
          };
          res.json(return_data);
      }
  });
}