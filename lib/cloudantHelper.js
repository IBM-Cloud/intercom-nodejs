//---cloudantHelper.js------------------------------------------------------------
module.exports = {

  // Insert a record
  insertRecord: function(db, record, response) {
    db.insert(record, function(err, body, header) {
      if (!err) {
        console.log("Successfully saved the following record to DB:\n", record);
        response("Success");
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
  }

}
