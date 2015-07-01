
// replace " in strings
function qt(x) {
  if (typeof(x) === typeof('abc')) {
    return x.replace(/\"/g, '&quot;');
  }
  else {
    return x;
  }
}

// format group elements
function fmt(v) {
  function fmt_grp(x) {
    var b = [], val, j, i;
    for (i in x) {
      if (x.hasOwnProperty(i)) {
        j = x[i];
        if (typeof(j) === 'object' && j.constructor === Array) {
          j = fmt_grp(j);
        }
        else if (typeof(j) === typeof(1) || typeof(j) === typeof(1.01)) {
          // j = j;
        }
        else {
          j = '"' + j + '"';
        }
        b.push(j);
      }
    }
    val = '{' + (b.join(',')) + '}';
    return val;
  }

  if (v === null || v === undefined) {
    return '';
  }
  if (typeof(v) === 'object' && v.constructor === Array) {
    return fmt_grp(v);
  }
  else {
    return v;
  }
}

function RecEditPanel(rdbAdmin, databaseManager) {

  this.panelId = 'edit-record-panel';

  var htmlTableId = 'edit-rec-table',
      rowNameStem = 'edit-panel-table-tr-',
      formId = 'edit-record-panel-form',
      // tableIdentifier holds name of table, optionally with schema
      tableIdentifier = undefined,
      // record holds the record being edited
      record = undefined,
      // columns holds metadata for the table columns
      columns = undefined,
      // mode is ['edit','new']
      mode = undefined,
      // keyVals is list of fields in primary key
      keyFields = undefined,
      recordHandoff = undefined,
      columnComments = undefined,
      tableComment = undefined,
      doAfter = null;
      that = this;

  // function to handle error result of query submit
  function errback(err) {
    rdbAdmin.showErrorMessage('<pre>' + err[0].toString() + ': ' + err[1] + '</pre>');
    presetFormForQuery();
  }

  function showSelectPanel() {
    rdbAdmin.loadNewPage('#/browser/' + encodeURIComponent(tableIdentifier));
  }

  this.init_handlers = function () {

    var $panel = $('#' + this.panelId);

    // add click handlers to select panel table
    $('#edit-panel-save-btn').click(function(ev) {
        prepFormForSubmit();
        rdbAdmin.resetMessages();
        doAfter = showSelectPanel;
        //showSelectPanel();
        return true;
    });
    $('#edit-panel-save-insert-btn').click(function (ev) {
        prepFormForSubmit();
        rdbAdmin.resetMessages();
        doAfter = function() {
            that.show_new(decodeURIComponent(tableIdentifier));
        };
        return true;
    });

    // set change-detection on input fields
    $panel.on('change', '#edit-rec-table :input',  function(ev) {
      ev.stopPropagation();
      markChange(this);
    });
    // set change-detection on null checkbox fields
    $panel.on('change', '#edit-rec-table :checkbox', function(ev) {
      ev.stopPropagation();
      handleCheckbox(this);
    });
    // setup toggle between text and file inputs
    $panel.on('click', '#edit-rec-table button', function(ev) {
      ev.stopPropagation();
      textFileToggle(this);
    });
    // handler updates sql display for any change in the data entry
    $panel.on('change', '*:input', function(ev) {
      ev.stopPropagation();
      onChange(this);
    });
    $('.lookup-create-link',$panel).click( function(ev) {
      ev.stopPropagation();
      if (!$(this).is('.disabledLink')) {
        var queryObj = createSQLQueryString();
        that.useRecordLater(queryObj);
        rdbAdmin.loadNewPage('#/browser/insert/'+encodeURIComponent('lookup.queries'));
      }
    });
  };

  function set_mode(mod) {
        mode = mod;
        if ( mode === 'new' ) {
              $('#edit-panel-save-insert-btn').css('display', 'inline');
              rdbAdmin.setHeading("New record: " + tableIdentifier);
        }
        else {
              $('#edit-panel-save-insert-btn').css('display', 'none');
              rdbAdmin.setHeading("Edit record: " + tableIdentifier);
        }
  }

  function recEditCallback(data) {

        if (data.status[0] !== 'error') {
            rdbAdmin.showWorkingMessage(data.row_count[1]);
            // empty fields
            var $table = $('#' + htmlTableId);
            $('input',$table).add('textarea',$table).val('').removeAttr('name');
            doAfter(data);
        }
        else {
            errback('error wrongly passed to success callback ' + str(data.error[1]));
        }
  }

  function presetFormForQuery() {

      // querying
      databaseManager.sqlEngine.queryByForm({
          'formId' : formId,
          'callback' : recEditCallback,
          'errback' : errback
      });
  }

  this.show_new = function(tableName) {

    tableIdentifier = tableName;
    var $panel = $('#' + this.panelId);
    $panel.hide();

    function prefabRecord() {
      var col, colName;
      if (recordHandoff && columns) {
          record = [];
          for (var ci in columns) {
            col = columns[ci];
            colName = col.columnName;
            if (recordHandoff[colName]) {
              record[ci] = recordHandoff[colName];
            }
          }
          recordHandoff = undefined;
        }
        else {
          record = undefined;
        }

        renderReceditTable('yes');

        presetFormForQuery();
        rdbAdmin.onStopQueryExecution();
        $panel.show();
        onChange();
    }

    keyFields = undefined;
    set_mode('new');
    rdbAdmin.onStartQueryExecution();
    getTableColumns(prefabRecord);
  };

  this.show_row = function(tableName, keyVal) {

    tableIdentifier = tableName;
    keyFields = undefined;
    var $panel = $('#' + this.panelId);
    $panel.hide();
    set_mode('edit');
    rdbAdmin.onStartQueryExecution();
    var oaf = new OnAllFinish(['meta','record'], function () {
        renderReceditTable();
        rdbAdmin.onStopQueryExecution();

        presetFormForQuery();
        $panel.show();
        onChange();
    });

    function callbackRec(data) {
      record = data.records.rows[0];
      oaf.finished('record');
    }

    function callbackMeta() {
      oaf.finished('meta');
    }
    getRecordData(keyVal, callbackRec);
    getTableColumns(callbackMeta);
  };

  this.useRecordLater = function(queryObj) {
    // stashes a hash of fields away for use with next insert-record
    recordHandoff = queryObj;
  };

  function calc_field_size(field, maxLen, dType, numDims) {

    var maxCols = 65; // 80
    function array_adjust(ary) {
      if (numDims) {
        if (ary[0] === 'a') {
          return ary;
        }
        else {
          return [ary[0],ary[1] + 7,undefined];
        }
      }
      else {
        return ary;
      }
    }
    // calc field size
    var len = 0, max, h, h1;
    if (maxLen) {
      if (maxLen < maxCols) {
        len = max = maxLen;
      }
      else {
        len = maxCols;
        max = maxLen;
      }
    }
    else if ($.inArray(dType, ['bool', 'boolean']) > -1) {
      len = max = 8;
    }
    else {
      var apiT = apiType(dType);
      if (apiT === 'NUMBER') {
        len = max = 30;
      }
      else if ($.inArray(apiT, ['DATE','TIME','DATETIME']) > -1) {
        len = max = 45;
      }
      else if (field !== '') {
        if (field.length < maxCols) {
          len = field.length;
          max = undefined;
        }
        else {
          len = maxCols;
          max = undefined;
        }
      }
    }
    if (max !== undefined && max < maxCols*1.5) {
      return array_adjust(['t',len,max]);
    }
    else {
      len = maxCols;
      if (max !== undefined) {
        h = Math.floor(max / len);
        if (h > 4) {
          h = 4;
        }
      }
      else {
        h = 4;
      }
      // if field data is larger
      if (field && field.length) {
        if (field.length > maxCols * 4) {
          h1 = Math.floor(field.length / len);
          if (h1 > 4) {
            if (h1 <= 6) {
              h = h1;
            }
            else {
              h = Math.floor(6 + (h1 - 6) / 1.5);
              if (h > maxCols/4) {
                h = maxCols/4;
              }
            }
          }
        }
      }
      return array_adjust(['a',h,len,max]);
    }
  }

  function getRecordData(keyVal, handleRecord) {

    var kVjson = decodeURIComponent(keyVal),
        keyValList = JSON.parse(kVjson),
        qParts = [], qArgs = [], query,
        fName, fValue;

    keyFields = [];
    while ( keyValList.length ) {

      fName = keyValList.splice(0,1)[0];
      keyFields.push(fName);
      fValue = keyValList.splice(0,1)[0];
      qParts.push(fName + ' = %s');
      qArgs.push(fValue);
    }

    query = 'SELECT * FROM ' + quoteIdentifier(tableIdentifier) +
            ' WHERE ' + (qParts.join(' AND '));
    databaseManager.sqlEngine.query({
      'q' : query,
      'args' : qArgs,
      'callback' : handleRecord,
      'errback' : errback
    });
  }

  function renderReceditTable(isNew) {

    // create html table: render fields and data
    var $txtArea,
        // manipulate html table
        $table = $('#' + htmlTableId),
        $tabCmt = $table.find('tr:first').show().remove(),
        $row = $table.find('tr:first').show().remove();

    // clear table, and save source row for future use. hide it.
    $table.empty().append($tabCmt).append($row.hide());
    $table.find('#table-comment').html(tableComment || '<span style="color:#ccc;">Table Comment</span>' );

    // iterate over columns, adding each to table
    for (var i = 0; i < columns.length; i += 1) {

      var col = columns[i],
          field = record ? fmt(record[i]) : '',
          fldQual = calc_field_size(field, col.maxLength, col.dataType, col.numDims),
          colCmt = columnComments[i],
          // ['a', h, width, max] or ['t',len,max]
          $newRow = $row.clone().show();

      $newRow.attr('id', rowNameStem + i);
      $newRow.find('#colname').html(col.columnName).attr('id', 'colname' + i);

      if (fldQual[0] === 't') {
        $newRow.find('#colval_text').val(field).attr('id', 'colval_text' + i);
        $newRow.find('#colval_text' + i).attr('size', fldQual[1])
               .attr('maxlength', fldQual[2]);
      }
      else {
        $txtArea = $('<textarea />').attr('id', 'colval_text' + i);
        $txtArea.attr('rows', fldQual[1]).attr('cols', fldQual[2]);

        if (fldQual[3] !== undefined) {
          $txtArea.attr('maxlength', fldQual[3]);
        }

        $txtArea.val(field);
        $newRow.find('#colval_text').after($txtArea);
        $newRow.find('#colval_text').remove();
      }

      if (isNew && field) {
        var $el = $newRow.find('*:input[id^="colval_text"]');
        markChange($el.get(0));
      }

      $newRow.find('#colval_file').attr('id', 'colval_file' + i);
      $newRow.find('#colchanged').attr('id', 'colchanged' + i);
      $newRow.find('#coltype').val(apiType(col.dataType)).attr('id', 'coltype' + i);
      var isNull = ( record && record[i] === null ) || false;
      $newRow.find('#colnull').prop('checked', isNull).attr('id', 'colnull'+i);
      handleCheckbox($newRow.get(0));
      $newRow.find('#column-type').html(col.dataType);
      $newRow.find('#column-comment').html(colCmt);
      $table.append($newRow);
    }
  }

  function getTableColumns(renderer) {

    var oaf = new OnAllFinish(['col','tab'],renderer);

    function recedit(tblrec) {

      function withColCmts(cmts) {
        columnComments = cmts;
        oaf.finished('col');
      }

      function withTabCmt(cmts) {
        tableComment = cmts;
        oaf.finished('tab');
      }

      columns = tblrec.getColumns();
      if (columns !== false) {
        databaseManager.getColumnComments(tblrec.tableOID, columns, withColCmts, errback);
        databaseManager.getTableComment(tblrec.tableOID, withTabCmt, errback);
      }
    }

    // find field types
    var metaTable = new ResourceMeta(tableIdentifier);
    databaseManager.getTableDetails(metaTable.getSchemaNameOnly(), metaTable.getTableNameOnly(), recedit, errback);
  }

  //  sets colchanged# field 'yes' if input changes
  function markChange(elem) {

    var $row = $(elem).parents('tr');
        var idx = $row.prevAll().length;
    $row.find('*:input[id^="colchanged"]').val("yes");
    idx = 1;
  }

  //  sets input field to text, empty, if null checkbox selected
  function handleCheckbox(elem) {

    var $row = $(elem).closest('tr'),
        idx = $row[0].rowIndex - 2,
        nullChecked = $row.find('*:checkbox').prop('checked');
    if ( nullChecked ){
      $row.find('#colval_file' + idx).hide();
      $row.find('#colval_text' + idx).show().val('').attr('disabled','disabled');
      $row.find('*[id^="colval_"]').add('button',$row).attr('disabled','disabled');
    }
    else {
      $row.find('#colval_text' + idx).show().removeAttr('disabled');
      $row.find('*[id^="colval_"]').add('button',$row).removeAttr('disabled');
    }
  }

  // toggle between text and file
  function textFileToggle(elem) {

    var $row = $(elem).closest('tr'),
        idx = $row[0].rowIndex - 2;
    if ($row.find('#colval_file' + idx + ':visible').length) {
      $row.find('#colval_file' + idx).hide();
      $row.find('#colval_text' + idx).show();
      $row.find('button').html('file');
    }
    else if ($row.find('#colval_text' + idx + ':visible').length) {
      $row.find('#colval_text' + idx).hide();
      $row.find('#colval_file' + idx).show();
      $row.find('button').html('text');
    }
    else {
      alert('ERROR: no input field visible ' + idx + ' ');
    }
  }

  function prepFormForSubmit() {

    var changeFields = [],
        original_vals = [],
        argCtr = 0,
        $table = $('#' + htmlTableId);

    //$('.to-remove-later').remove();

    function add_hidden_arg_field(val) {
      var argnum = 'arg' + ('000' + argCtr).substr(('' + argCtr).length);
      argCtr += 1;
      var $fld = $('<input type="hidden"  class="to-remove-later" />');
      $fld.attr('name', argnum).val(val);
      $table.append($fld);
    }

    function add_hidden_query_field(q) {
      var $fld = $('<input type="hidden" name="q" class="to-remove-later" />');
      $fld.val(q);
      $table.append($fld);
    }

    // old values here - record
    if (record && record.length) {

      assert(keyFields, 'keyFields empty 0');
      for (var ovi = 0; ovi < record.length; ovi += 1) {

        var ov = record[ovi],
            ovc = columns[ovi];

        // ignore fields not in primary key
        if ($.inArray(ovc.columnName, keyFields) > -1) {
            original_vals.push([ovc.columnName,ov]);
        }
      }
    }

    // new values - in html fields
    //   iterate to put name attributes in changed fields
    $table.find('input[id^="colchanged"]:gt(0)').each(function() {

      var $row, index, $cVal, argNum, $cValType, colIsNull;
      if ($(this).val() === 'yes' || mode === 'new') {

        $row = $(this).closest('tr');
        index = $row[0].rowIndex - 2;
        // test for null
        colIsNull = $row.find('input[id^="colnull"]').prop('checked');

        if ( colIsNull ) {
          changeFields.push([columns[index].columnName,null])
        }
        else {
          $cVal = $row.find('input[id^="colval_"]:visible');
          $cVal = $cVal.add($row.find('textarea[id^="colval_"]:visible'));
          assert($cVal.length <= 1,'too many colvals');
          argNum = 'arg' + ('000' + argCtr).substr(('' + argCtr).length);
          argCtr += 1;
          $cVal.attr('name', argNum);
          $cValType = $row.find('input[id^="coltype"]');
          assert($cValType.length <= 1,'too many coltypes');
          $cValType.attr('name', argNum + 'type');
          changeFields.push([columns[index].columnName,true]);
        }
      }
    });

    for ( var ovi in original_vals ) {

      var ovs = original_vals[ovi][1];
      if (ovs !== null) {
        add_hidden_arg_field(ovs);
      }
    }

    // assemble a query string
    var queryRet = createSQLQueryString();

    // put query into form
    add_hidden_query_field(queryRet.query);
  }

  function createSQLQueryString() {

    var changeFields = [],
        original_vals = [],
        $table = $('#' + htmlTableId);

    // old values here - record
    if ( mode === 'edit' && record && record.length ) {
      assert(keyFields, 'keyFields empty 1');
      for (var ovi = 0; ovi < record.length; ovi += 1) {
        var ovc = columns[ovi];
        // ignore fields not in primary key
        if ($.inArray(ovc.columnName, keyFields) > -1) {
            original_vals.push(ovc.columnName);
        }
      }
    }

    // new values - in html fields
    //   iterate to put name attributes in changed fields
    $table.find('input[id^="colchanged"]:gt(0)').each(function() {
      var $row, index, $cVal, argNum, colIsNull;
      if ($(this).val() === 'yes' || mode === 'new') {
        $row = $(this).closest('tr');
        index = $row.prevAll().length - 2;
        // test for null
        colIsNull = $row.find('input[id^="colnull"]').prop('checked');
        changeFields.push([columns[index].columnName, colIsNull ? null : true])
      }
    });

    // assemble a query string
    var qNewColumns = [], // field-change parts of query
        orig = [], // names of fields with orig data to reference
        qNewColString, queryRet, f;
    if (changeFields.length === 0) {
      return { 'query' : '',
               'status' : 'incomplete'  };
    }

    // edit mode
    if ( mode === 'edit' ) {
      for (f = 0; f < changeFields.length; f += 1) {
        if (changeFields[f][1] === null) {
          qNewColumns.push('"' + changeFields[f][0] + '" = NULL');
        }
        else {
          qNewColumns.push('"' + changeFields[f][0] + '"= %s');
        }
      }
      qNewColString = qNewColumns.join(',');
      for (var oid = 0; oid < original_vals.length; oid += 1) {
        if (original_vals[oid][1] === null) {
          orig.push('"' + original_vals[oid] + '" IS NULL');
        }
        else {
          orig.push('"' + original_vals[oid] + '"= %s');
        }
      }
      var origvals = orig.join(' AND ');
      queryRet = 'UPDATE ' + quoteIdentifier(tableIdentifier) + ' SET ' + qNewColString +
          ' WHERE ' + origvals;
    }

    // insert mode
    else {
      var tokens = [];
      for (f = 0; f < changeFields.length; f += 1) {
        qNewColumns.push('"' + changeFields[f][0] + '"');
        if (changeFields[f][1] === null) {
          tokens.push('NULL');
        }
        else {
          tokens.push('%s');
        }
      }
      qNewColString = qNewColumns.join(',');
      queryRet = 'INSERT INTO ' + quoteIdentifier(tableIdentifier) + ' (' + qNewColString + ')' +
          ' VALUES( ' + tokens.join(',') + ');';
    }
    return { 'query' : queryRet,
             'status' : 'ok'  };
  }

  function onChange() {
    updateSQLDisplay();
    return false;
  }

  function updateSQLDisplay() {
    var $panel = $('#'+that.panelId),
        sqlObj = createSQLQueryString();
    if ( sqlObj.status == 'incomplete' ) {
      $('#edit-panel-save-btn').attr('disabled','disabled')
                               .addClass('disabledBtn');
      $('#edit-panel-save-insert-btn').attr('disabled','disabled')
                                      .addClass('disabledBtn');
      $('.lookup-create-link',$panel).addClass('disabledLink');
    }
    else {
      $('#edit-panel-save-btn').removeAttr('disabled')
                               .removeClass('disabledBtn');
      $('#edit-panel-save-insert-btn').removeAttr('disabled')
                                      .removeClass('disabledBtn');
      $('.lookup-create-link',$panel).removeClass('disabledLink');
    }
    if (sqlObj.query) {
      $('#edit-rec-sql-show').html(sqlObj.query);
      $('.edit-sql-btn',$panel).removeAttr('disabled')
                               .removeClass('disabledBtn');
    }
    else {
      $('#edit-rec-sql-show').html('-- nothing to do yet');
      $('.edit-sql-btn',$panel).attr('disabled','disabled')
                               .addClass('disabledBtn');
      $('#edit-panel-save-btn').attr('disabled','disabled')
                               .addClass('disabledBtn');
      $('.lookup-create-link',$panel).addClass('disabledLink');
    }
    if ( mode === 'edit' ) {
      $('#edit-panel-save-insert-btn').hide();
    }
    else {
      $('#edit-panel-save-insert-btn').show();
    }
  }
}


//
