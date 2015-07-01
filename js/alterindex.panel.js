/*
 methods for editing index params

 */

function arrays_equal(a, b) {

  if ( b.length !== a.length ) {
    return false;
  }
  var as = a.sort();
  var bs = b.sort();
  for (var i = 0; i < as.length; i += 1) {
    if (as[i] !== bs[i]) {
      return false;
    }
  }
  return true;
}

function AlterIndexPanel(rdbAdmin, databaseManager, sqlPanel, receditPanel) {

  this.panelId = 'alter-index-panel';
  var tableId = 'alter-index-table',
      maxRowId = 0,
      metaTable = undefined,
      indexes = undefined,
      tableIdentifier = undefined,
      that = this;

  // function to handle error result of query submit
  function errback(err) {

    rdbAdmin.showErrorMessage('<pre>'+err[0]+': '+err[1]+'</pre>');
  }

  this.init_handlers = function(app) {

    // initialize click handlers
    //
    var $panel = $('#' + that.panelId);
    $('#alter-index-panel-btn').click(function (ev) {
      ev.stopPropagation();
      alter();
    });

    $('#alter-index-add-row').click(function (ev) {
      ev.stopPropagation();
      addRowToTable();
    });

    $panel.on('click', '*.alter-index-del-row', function(ev) {
      ev.stopPropagation();
      delRowFromTable(this);
    });

    $panel.on('change', ':input[class^="aindex-itype"]', function(ev) {
      ev.stopPropagation();
      purgeUntyped();
      addRowToTable();
    });

    $panel.on('change', ':input[id^="aindex-flist"]', function(ev) {
      ev.stopPropagation();
      addColumnSpan(this);
    });

    // add click handler to edit query
    $('.edit-sql-btn',$panel).click( function(ev) {

      ev.stopPropagation();
      var query = $('#alter-index-sql-show').html();
      sqlPanel.showQueryLater({ 'query' : query });
      app.setLocation('#/sqlcommand');
    });

    $('.lookup-create-link',$panel).click( function(ev) {

      ev.stopPropagation();
      if (!$(this).is('.disabledLink')) {
        var queryObj = createSQLQueryString();
        receditPanel.useRecordLater(queryObj);
        rdbAdmin.loadNewPage('#/browser/insert/'+encodeURIComponent('lookup.queries'));
      }
    });

    // handler updates sql display for any change in the data entry
    $panel.on('change', '*:input', function(ev) {
      ev.stopPropagation();
      onChange(this);
    });
  };

  function getTableIndexes(callback) {

    var metaT = new ResourceMeta(tableIdentifier);

    function successFirst(tbldtls) {

      function successCb(indexs) {
        indexes = indexs;
        callback();
      }

      metaTable = tbldtls;
      databaseManager.getIndexes(metaT.getSchemaNameOnly(), metaT.getTableNameOnly(), successCb, errback);
    }

    databaseManager.getTableDetails(metaT.getSchemaNameOnly(),metaT.getTableNameOnly(), successFirst, errback);
  }

  this.show = function(mode,tableName)
  {
    $panel = $('#'+that.panelId);
    $panel.hide();
    tableIdentifier = tableName;

    rdbAdmin.setHeading('');
    rdbAdmin.onStartQueryExecution();

    getTableIndexes(function () {

      buildTable();

      rdbAdmin.setHeading("Alter indexes: " + metaTable.qualResourceName());
      onChange();
      rdbAdmin.onStopQueryExecution();
      $panel.show();
    });
  };

  function delRowFromTable(domel) {

    var $table = $('#' + tableId);

    // if this is last row - don't delete
    if ($table.find('tbody tr:visible').length === 1) {
      alert('Table must have at least one row!');
      return false;
    }

    // remove html
    var $row = $(domel).closest('tr');
    $row.remove();
    onChange();
    return true;
  }

  function addRowToTable() {

    // function to add row# to end of id values
    function make_id_unique($el, i) {

      var id = $el.attr('id');
      if (id && id.length && id.substr(id.length - 1) === '_') {
        $el.attr('id', id + i);
      }
    }

    var newrowId = parseInt(maxRowId, 10) + 1;
    var $table = $('#' + tableId);

    // clone hidden row
    var $row = $table.find('#aindex-tr-pattern_').clone().show();

    // new IDs to cloned row and it's children
    $row.find('#aindex-fopts-0_').attr('style', '');
    $row.attr('id', 'aindex-tr_' + maxRowId);

    // update all *_ ids with iteration number *_#
    $row.find('td')
        .add('select', $row)
        .add('input', $row)
        .each(function (i) {

      make_id_unique($(this), i);
    });

    // attach new row
    $table.append($row);
    maxRowId = newrowId;
    return newrowId;
  }

  function addColumnSpan(element) {

    // if this is not last element - return false
    if ($(element).parent().next().length !== 0) {
      return;
    }

    var $row = $(element).closest('tr');
    var $fldspan = $row.find('*[id^="aindex-fopts-"]:last').clone();
    var idparts = $fldspan.attr('id').split(/[\-_]/g);
    var colnum = parseInt(idparts[2], 10),
        rownum = idparts[3];

    $fldspan.attr('id', 'aindex-fopts-' + (colnum + 1) + '_' + rownum);
    $row.find('td:eq(2)').append($fldspan);
  }

  function purgeUntyped() {

    var $table = $('#' + tableId);
    $table.find('tr:visible').each(function() {
      var $row = $(this);
      var $val = $row.find('*[class^="aindex-itype"]').val();
      if (!$val && $val !== undefined) {
        $row.remove();
      }
    });
  }

  function onChange() {

    // var $row = $(domel).closest('tr');
    // var $typeSelect = $row.find('td:eq(1) select');
    updateSQLDisplay();
    return false;
  }

  function updateSQLDisplay() {

    var $panel = $('#'+that.panelId),
        sqlObj = createSQLQueryString();

    if ( sqlObj.status == 'incomplete' ) {

      $('#alter-index-panel-btn').attr('disabled','disabled')
                                 .addClass('disabledBtn');
      $('.lookup-create-link',$panel).addClass('disabledLink');
    }
    else {

      $('#alter-index-panel-btn').removeAttr('disabled')
                                 .removeClass('disabledBtn');
      $('.lookup-create-link',$panel).removeClass('disabledLink');
    }

    if (sqlObj.query) {

      $('#alter-index-sql-show').html(sqlObj.query);
      $('.edit-sql-btn',$panel).removeAttr('disabled')
                               .removeClass('disabledBtn');
    }
    else {

      $('#alter-index-sql-show').html('-- nothing to do yet');
      $('.edit-sql-btn',$panel).attr('disabled','disabled')
                               .addClass('disabledBtn');
      $('#alter-index-panel-btn').attr('disabled','disabled')
                                 .addClass('disabledBtn');
      $('.lookup-create-link',$panel).addClass('disabledLink');
    }
  }

  function buildTable() {

    var $table = $('#' + tableId);

    // function to add row# to end of id values
    function make_id_unique($el, i) {

      var id = $el.attr('id');
      if (id && id.length && id.substr(id.length - 1) === '_') {
        $el.attr('id', id + i);
      }
    }

    // clone hidden row
    var $tplrow = $table.find('#aindex-tr-prior_');
    var $row = $table.find('#aindex-tr-pattern_');
    $table.empty(); //.append($hdr);
    $table.append($row).append($tplrow);

    // add field names to template row
    var fields = metaTable.getColumns();
    $row.find('#aindex-flist-0_').empty().append($('<option>'));

    for (var i = 0; i < fields.length; i += 1) {

      var $opt = $('<option>');
      $opt.html(fields[i].columnName);
      $row.find('#aindex-flist-0_').append($opt);
    }

    // get indexes from tablePanel
    if (indexes === null || indexes === undefined) {
      return false;
    }

    var k;
    function make_unique() {
      make_id_unique($(this), k);
    }

    // put each index in display table
    for (k = 0; k < indexes.length; k += 1) {

      var index = indexes[k],
          isUnique = index[1], isPrimary = index[2],
          name = index[3], columns = index[6];

      // add html row to table
      var $newrow = $tplrow.clone(true).show();

      // add index name
      $newrow.find('.aindex-iname_').val(name);
      $newrow.find('.aindex-ioldname_').val(name);

      // add index type
      var itypestr = isPrimary ? 'PRIMARY' :
                    (isUnique ? 'UNIQUE' : 'INDEX');
      $newrow.find('.aindex-itype_').closest('td').html(itypestr);
      if (isPrimary) {
        $newrow.find('input:image').css('visibility', 'hidden');
      }

      // add span with field select control for each field in index
      var colstr = columns.join(', ');

      // clone span
      var $span = $newrow.find('#aindex-fopts_').remove().show();

      // insert column idx 'j' into IDs
      $span.html(colstr).attr('style', '');
      $newrow.find('td:eq(2)').append($span);

      // add new row to table
      $newrow.attr('id', 'aindex-tr_' + maxRowId);

      // update all *_ ids with iteration number *_#
      $newrow.find('td')
          .add('select', $newrow)
          .add('input', $newrow)
          .each(make_unique);
      $table.append($newrow);

      maxRowId = parseInt(maxRowId, 10) + 1;
    }

    // add empty row
    addRowToTable();
    return true;
  }

  function createSQLQueryString() {

    // functions to create SQL statements
    function make_rename_statement(sch, oldIName,iName) {

      //var sch = metaTable.getSchemaNameOnly();
      var oldMeta = new ResourceMeta().nameResource(sch,oldIName);
      return 'ALTER INDEX ' + oldMeta.quotedResourceName() +
          ' RENAME TO ' + quoteIdentifier(iName);
    }

    function make_drop_statement(oldIName) {

      var sch = metaTable.getSchemaNameOnly();
      var metaIndex = new ResourceMeta().nameResource(sch,oldIName);
      return 'DROP INDEX ' + metaIndex.quotedResourceName();
    }

    function make_create_statement(iName, iType, iFields) {

      var sql,
          iCols = _.map(iFields, function (el) { return quoteIdentifier(el); } );

      if (iType === 'UNIQUE') {
        sql = 'CREATE UNIQUE INDEX ' + quoteIdentifier(iName) +
            ' ON ' + metaTable.quotedResourceName() +
            '(' + (iCols.join(',')) + ')';
      }
      else {
        sql = 'CREATE INDEX ' + quoteIdentifier(iName) +
            ' ON ' + metaTable.quotedResourceName() +
            '(' + (iCols.join(',')) + ')';
      }
      return sql;
    }

    // grab inputs
    var $table = $('#' + tableId);

    // iterate over html-table-rows, generate a list of sql
    var sql = [], knownIndexes = [], status = 'ok';

    $table.find('tr:gt(1)').each(function(i) {

      // for each html row (aftet 2 tpl lines), gather data into variables
      var $row = $(this);
      var iName = $row.find('*[class^="aindex-iname_"]').val();
      // skip empty rows
      if (!iName) {
        return true;
      }

      var oldiName = $row.find('*[class^="aindex-ioldname_"]').val();
      if (oldiName) {

        knownIndexes.push(oldiName);
        if (oldiName && iName !== oldiName) {
          sql.push(make_rename_statement(metaTable.getSchemaNameOnly(), oldiName, iName));
        }
      }
      else {

        var iType = $(this).find('select[class^="aindex-itype_"]').val();
        var iFields = [];
        $row.find('*[id^="aindex-flist-"]').each(function() {
          if ($(this).val() !== '') {
            iFields.push($(this).val());
          }
        });

        if (!iName) {
          return true;
        }

        // quit if incomplete line
        else if (!iType || !iFields.length) {
          status = 'incomplete';
          return false;
        }
        else {
          sql.push(make_create_statement(iName, iType, iFields));
        }
      }
      return true;
    });

    // look for 'unknown' indexes not kept in form, that need to be dropped
    for (var idx in indexes) {

      var idxname = indexes[idx][3];
      if ($.inArray(idxname, knownIndexes) === -1) {
        sql.push(make_drop_statement(idxname));
      }
    }

    return { 'query' : sql.join(';\n'),
             'status' : status  };
  }

  function alter() {

    // create an aggregate sql statement, and execute it.
    var sqlObj = createSQLQueryString();

    function tbshow() {
        setTimeout(function() {
            rdbAdmin.loadNewPage('#/table/'+encodeURIComponent(tableIdentifier));
        },5)
    }

    if (sqlObj.stat === 'incomplete') {
      alert('Alter table data is incomplete.');
    }
    else if (sqlObj.query) {
      databaseManager.sqlEngine.query({ 'q' : sqlObj.query,
                                        'callback' : tbshow,
                                        'errback' : errback });
    }
    else {
      alert('add or change an index');
    }
  }
}
