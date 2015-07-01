/*
 SchemaPanel creates the multi-table display with each table in its own box.

 */

function SchemaPanel(rdbAdmin, databaseManager) {

  var schema = [],
      schemaId = 'schema',
      that = this;

  // function to handle error result of query submit
  function errback(err) {

    rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
  }

  this.init_handlers = function() {
    //
  };

  this.show = function() {

    function displaySchemaPanel(schema) {

      // organize tables into schemata
      var pixelsPerChar = 9,
          schemata = {},
          maxWidth = 0,
          minWidth = 2000,
          $schemaDiv = $('#' + schemaId);

      for (var i = 0; i < schema.length; i += 1) {

        var scnm = schema[i].getSchemaNameOnly();

        if (! schemata[scnm]) {
          schemata[scnm] = [];
        }

        schemata[scnm].push(schema[i]);
      }

      $schemaDiv.removeClass('masoned');
      $schemaDiv.removeData('masonry');
      $schemaDiv.empty();

      for (i in schemata) {

        if (schemata.hasOwnProperty(i)) {

          var maxFldCt = 0;
          for (var j = 0; j < schemata[i].length; j += 1) {

            var sch = schemata[i][j];
            var maxNameLen = sch.qualResourceName().length;
            var schCols = sch.getColumns();

            if (schCols.length > maxFldCt) {
              maxFldCt = schCols.length;
            }

            for (var f = 0; f < schCols.length; f += 1) {

              if (schCols[f].columnName.length > maxNameLen) {

                maxNameLen = schCols[f].columnName.length;
                maxWidth = Math.max(maxWidth, maxNameLen);
              }
              else {
                minWidth = Math.min(minWidth, schCols[f].columnName.length);
              }
            }

            var $tableDiv = that.createTableDiv(sch);
            $tableDiv.css('width', maxNameLen * pixelsPerChar);
            $schemaDiv.append($tableDiv);
          }
        }
      }

      var pixelPad = 15;
      var columnDisplayWidth = maxWidth * pixelsPerChar + pixelPad;

      if (maxWidth >= 2 * minWidth) {
        columnDisplayWidth = Math.floor(maxWidth / 2.0) * pixelsPerChar + pixelPad / 2.0;
      }

      rdbAdmin.setHeading("Database Schema");
      rdbAdmin.showPanel("schema-panel");

      $schemaDiv.masonry({
          'columnWidth' : columnDisplayWidth
      }); // {'singleMode' : true})
    }

    var url1 = window.location;
    databaseManager.getDatabaseSchema(function(dta) {

        if (url1 !== window.location)
            return;
        displaySchemaPanel(dta);
    });
  };

  this.createTableDiv = function(sqlTable) {

    var field;
    var notchar = ['int', 'bigint', 'integer', 'number', 'serial',
      'bigserial', 'float', 'double', 'decimal', 'numeric',
      'smallint', 'real',  'serial', 'boolean'];

    var $tableDiv = $('<div class="table"></div>');
    $tableDiv.append('<strong class="title">' + sqlTable.qualResourceName() + '</strong><br/>');

    for (var i in sqlTable.getColumns()) {

      if (sqlTable.getColumns().hasOwnProperty(i)) {

        field = sqlTable.getColumns()[i];

        // if field type is not character
        if ($.inArray(field.dataType, notchar) !== -1) {

          $tableDiv.append(field.columnName + '<br/>');
        }

        // if field type is char
        else {

          $tableDiv.append('<span class="char">' + field.columnName + '</span><br />');
        }
      }
    }

    return $tableDiv;
  };

}


/*

 CreateSchemaPanel handles the panel that creates and drops schemas.

 */

function CreateSchemaPanel(rdbAdmin, databaseManager, receditPanel)

  /* object to handle creation and renaming of schemata */ {
  this.panelId = 'create-schema-panel';
  var mode = 'create',
      schema = '',
      that = this;

  // function to handle error result of query submit
  function errback(err) {
    rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
  }

  this.init_handlers = function(app) {

    var $panel = $('#'+this.panelId);

    $('#createSchemaBtn').click(function() {

      app.setLocation('#/createschema');
    });

    $('#save-schema-btn').bind('click', function(ev) {

      ev.stopPropagation();
      saveSchema();
    });

    $('#drop-schema-btn').bind('click', function(ev) {

      ev.stopPropagation();
      dropSchema();
    });

    $('.lookup-create-link',$panel).click( function(ev) {

      ev.stopPropagation();
      if (!$(this).is('.disabledLink')) {

        var queryObj = getQueryString();
        receditPanel.useRecordLater(queryObj);
        rdbAdmin.loadNewPage('#/browser/insert/'+encodeURIComponent('lookup.queries'));
      }
    });

    $('input:text',$panel).change( function(ev) {

      ev.stopPropagation();
      var queryObj = getQueryString();

      if ( queryObj.query !== '' ) {

        $('.lookup-create-link',$panel).removeAttr('disabled')
                                       .removeClass('disabledLink');
        $('#save-schema-btn').removeAttr('disabled')
                             .removeClass('disabledBtn');
        $('#create-schema-sql-show').html(queryObj.query);
      }
      else {
        $('.lookup-create-link',$panel).attr('disabled','disabled')
                                       .addClass('disabledLink');
        $('#save-schema-btn').attr('disabled','disabled')
                             .addClass('disabledBtn');
        $('#create-schema-sql-show').html('-- nothing to show');
      }
    });
  };

  this.show = function(mod, schem) {

    mode = mod;
    schema = schem;
    var $panel = $('#'+this.panelId);
    clearInputs();

    if (mode === 'edit') {
      $('#alter-schema-tip').css('display', 'inline');
      $('#drop-schema-btn').css('display', 'inline');
      $('input:text',$panel).val(schema);
      rdbAdmin.setHeading("Alter Schema");
    }
    else {
      $('#alter-schema-tip').css('display', 'none');
      $('#drop-schema-btn').css('display', 'none');
      rdbAdmin.setHeading("Create Schema");
    }

    $panel.find('input:text').change();
    rdbAdmin.showPanel(this.panelId);
  };

  function clearInputs() {

    var $panel = $('#'+that.panelId);
    $('input:text',$panel).val('');
  }

  function getQueryString() {

    var sql,
        $panel = $('#'+that.panelId),
        name = $('input:text',$panel).val();

    if ( name === '' ) {
      sql = '';
    }
    else if (mode === 'edit') {

      sql = 'ALTER SCHEMA ' + quoteIdentifier(schema) +
          ' RENAME TO ' + quoteIdentifier(name);
    }
    else {

      sql = 'CREATE SCHEMA ' + quoteIdentifier(name);
    }
    return {
        'query' : sql,
        'status' : 'ok'
    };
  }

  function saveSchema() {

    var queryObj,
        name = $('#' + that.panelId + ' input').val();

    if (!name) {
      alert('Please provide name!');
      return;
    }

    queryObj = getQueryString();

    // functions to handle results of query submit
    function errback(err) {

      rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
    }

    function successcb(res) {

      rdbAdmin.showWorkingMessage(res.status[1]);
      rdbAdmin.updateSchemaList();
      // new name
      schema = name;
      rdbAdmin.loadNewPage('#/');
    }

    databaseManager.sqlEngine.query({
        'q' :  queryObj.query,
        'callback' : successcb,
        'errback' : errback
    });
  }

  function dropSchema() {

    var sql;
    if (!confirm('Are you sure?')) {

      return false;
    }

    if (schema !== '') {

      sql = "DROP SCHEMA " + quoteIdentifier(schema);
    }
    else {

      return false;
    }

    // functions to handle results of query submit
    function successcb(res) {

      rdbAdmin.showWorkingMessage(res.status[1]);
      rdbAdmin.updateSchemaList();
      // new name
      schema = null;
      rdbAdmin.loadNewPage('#/');
    }

    databaseManager.sqlEngine.query({
        'q' :  sql,
        'callback' : successcb,
        'errback' : errback
    });

    return false;
  }
}

