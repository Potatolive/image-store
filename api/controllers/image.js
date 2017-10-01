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
  upload: upload
};


/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function upload(req, res) {
  console.log(req.swagger.params.file.value);

  var awsConfig = {region: process.env.AWS_DEFAULT_REGION};
  AWS.config.update(awsConfig);

  if(process.env.NODE_ENV === "development") {
      AWS.config.update(
        {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
  }

  var bucketName = 'potatolive-image';

  var fileParams = req.swagger.params.file.value;

  if(fileParams.mimetype !== 'image/jpeg') {
    res.status(500).json({'message': 'Only jpeg files allowed!'});
  } else {
    var s3 = new AWS.S3();
    
      var params = {
          Bucket: bucketName,
          Key: uuid.v4() + '.jpeg',
          Body: req.swagger.params.file.value.buffer,
          ContentLength: req.swagger.params.file.value.size,
          ACL:'public-read'
      };
    
      s3.putObject(params, 
        function(success) {
          console.log(success);
          var resp = {
            url: 
              'https://s3.' + 
              process.env.AWS_DEFAULT_REGION + 
              '.amazonaws.com/' + 
              bucketName + 
              '/' + 
              params.Key
          };

        console.log(resp);

          res.json(resp);
        },
        function(error) {
          console.log(error);
          res.send({'message': 'Error uploading file!'});
        }
      );
  }
}
