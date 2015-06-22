//---cloudantHelper.js------------------------------------------------------------
module.exports = {

  // Insert a record
  insertRecord: function(db, record, response) {
    db.insert(record, function(err, body, header) {
      if (!err && body.ok === true) {
        console.log("Successfully saved the following record to DB:\n", record);
        response(body);
      }
      else {
        console.error("Saving the following record to DB failed:\n", record);
        response(err);
      }
    });
  },

  // Delete a record
  deleteRecord: function(db, uniqueId, revNum, response) {
    db.destroy(uniqueId, revNum, function(err, body, header) {
      if (!err) {
        console.log("Successfully deleted the following event from DB:\n", uniqueId);
        response("Success");
      }
      else {
        console.error("Deleting " + uniqueId + " failed");
        response(err);
      }
    });
  },

  // Returns JSON records from the input view using the index
  getRecords: function(db, view, index, response) {
    db.view(view, index, function(err, body) {
      if (!err) {
        var docs = [];
          body.rows.forEach(function(doc) {
            docs.push(doc.value);
          });
          response(JSON.stringify(docs));
      }
      else {
        console.error("Getting documents from " + view + " failed with error: ", err);
        response(err);
      }
    });
  },

  // Returns doc from a view with a field corresponding to input value
  // Result is first doc found with field equivalent to value
  getDoc: function(db, view, index, field, value, response) {
    this.getRecords(db, view, index, function(result) {
      if (!result.name) {
        // Look for the matching record
        var results = JSON.parse(result),
            docFound = false;
        for (var i=0; i < results.length; i++) {
          if (results[i][field] === value) {
            response(results[i]);
            docFound = true;
            break;
          }
        }
        // If doc was not found, respond with error object
        if (!docFound) {
          response({
            'error' : "Record not found in returned results set"
          });
        }
      }
      else {
        response(result);
      }
    });
  },

  // Returns true if input DB exists, otherwise false
  dbExists: function(nano, dbName, response) {
    nano.db.list(function(err, body) {
      if (!err) {
        var dbFound = false;
        body.forEach(function(db) {
          if (db === dbName) {
            dbFound = true;
          }
        });
        response (null, dbFound);
      }
      else {
        var error = "Error getting list of DBs";
        console.error(error);
        response(error, null);
      }
    });
  }
}
