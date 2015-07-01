


function TriggerPanel(rdbAdmin, sqlPanel, databaseManager, receditPanel) {
  this.panelId = 'alter-trigger-panel';
	var that = this,
      altPanelId = 'no-trigger-functions',
      tableId = 'alter-trigger-table',
      tableIdentifier = undefined,
      metaTable = undefined,
      maxRowId = 0,
      triggers = [],
      triggerFunctions = [];

	// function to handle error result of query submit
	function errback(err) {
		rdbAdmin.showErrorMessage('<pre>'+err[0] + ':' + err[1]+'</pre>');
	}

	this.init_handlers = function(app)
	{
    var $panel = $('#'+this.panelId);
    $('#createNewTriggerBtn').click( function () {
      app.setLocation('#/createtrigger/'+encodeURIComponent(tableIdentifier));
    });
		$("#alter-trigger-panel-btn").click( function(ev) {
      alter();
      ev.stopPropagation();
		});
    $('#alter_trigger_add_row').click(function (ev) {
      addRowToTable(this);
      ev.stopPropagation();
    });
    $panel.on('click', '*.alter_trigger_del_row', function(ev) {
      delRowFromTable(this);
      ev.stopPropagation();
    });
    $panel.on('change', '*:input', function (ev) {
      onChange(this);
      ev.stopPropagation();
    });
    // add click handler to edit query
    $('.edit-sql-btn',$panel).click( function (ev) {
      var queryObj = createSQLQueryString();
      sqlPanel.showQueryLater(queryObj);
      rdbAdmin.loadNewPage('#/sqlcommand');
      ev.stopPropagation();
    });
    $('.lookup-create-link',$panel).click( function (ev) {
      ev.stopPropagation();
      if (!$(this).is('.disabledLink')) {
        var queryObj = createSQLQueryString();
        receditPanel.useRecordLater(queryObj);
        rdbAdmin.loadNewPage('#/browser/insert/'+encodeURIComponent('lookup.queries'));
      }
    });
	};

	this.show = function(tableName)
	{
    var $panel = $('#'+that.panelId),
        $altPanel = $('#'+altPanelId),
        oaf = new OnAllFinish(['triggers','functions'], updateDisplay);
    $panel.hide();
    tableIdentifier = tableName;
    metaTable = new ResourceMeta(tableIdentifier);
    triggers = [];
    triggerFunctions = [];
    maxRowId = 0;

    function updateDisplay() {
      rdbAdmin.setHeading("Alter Triggers on " + metaTable.qualResourceName());
      if (triggerFunctions.length) {
        buildTable(tableIdentifier,triggerFunctions);
        updateSQLDisplay();
        $panel.show();
        $altPanel.hide();
      }
      else {
        $panel.hide();
        $altPanel.show();
      }
      rdbAdmin.onStopQueryExecution();
    }
    function withTriggers(dtls) {
      triggers = dtls;
      oaf.finished('triggers');
    }
    function withFunctions(flists) {
      for (var fi in flists) {
        var func = flists[fi];
        if ( func[3] === 'trigger' ) {
          triggerFunctions.push(func[2]);
        }
      }
      oaf.finished('functions');
    }
    rdbAdmin.onStartQueryExecution();
    databaseManager.getTriggers(metaTable.getSchemaNameOnly(), metaTable.getTableNameOnly(), withTriggers);
    databaseManager.getFunctionNames(withFunctions);
	};

  // function to add row# to end of id values
  function make_id_unique($el,i) {
    var id = $el.attr('id');
    if (id && id.length && id.substr(id.length-1)==='_') {
      $el.attr('id',id+i);
    }
  }

  function addRowToTable(elem) {
		// function to add row# to end of id values
		var newrowId = parseInt(maxRowId,10) + 1,
		    $table = $('#'+tableId),
		    // clone hidden row
		    $row = $table.find('#atrigger-tr-pattern_').clone().show();
		$row.attr('id','atrigger-tr_'+maxRowId);
		// update all *_ ids with iteration number *_#
		$row.find('td')
			  .add('select',$row)
			  .add('input',$row)
        .add('span',$row)
			  .each(function (i) {
			make_id_unique($(this),maxRowId);
		});
		// attach new row
		$table.append($row);
		maxRowId = newrowId;
		return newrowId;
	}

  function delRowFromTable(domel) {
    var $table = $('#'+tableId);
    // if this is last row - don't delete
    if ($table.find('tbody tr:visible').length === 1) {
      alert('Table must have at least one row!');
      return false;
    }
    // remove html
    var $row = $(domel).closest('tr');
    $row.remove();
    updateSQLDisplay();
    return true;
  }

  function buildTable(tableName,triggerFuncs) {
    var $table = $('#'+tableId);
    // clone hidden row
    var $tplrow = $table.find('#atrigger-tr-prior_');
    var $row = $table.find('#atrigger-tr-pattern_');
    $table.empty();
    $table.append($row).append($tplrow);
    $('#trigger-table').val(tableName);
    // put function names in $row
    var $tfOptions = $('*:input[class^="atrigger-function_"]',$row);
    $tfOptions.empty();
    for (var _tf in triggerFuncs ) {
      var tf = triggerFuncs[_tf];
      $tfOptions.append('<option>'+tf+'</option>');
    }
    // put each trigger in display table
    function make_unique() {
      make_id_unique($(this),maxRowId);
    }
    for ( var k=0; k<triggers.length; k+=1 ) {
      var trigger = triggers[k];
      var name = trigger[0], timing = trigger[3],
          event = trigger[4], foreach = trigger[5],
          funcName = trigger[6];
      // add html row to table
      var $newrow = $tplrow.clone(true).show();
      // add trigger name
      $newrow.find('.atrigger-tname_').val(name);
      $newrow.find('.atrigger-toldname_').val(name);
      $newrow.find('.atrigger-timing_').html(timing);
      $newrow.find('.atrigger-event_').html(event);
      $newrow.find('.atrigger-foreach_').html(foreach);
      $newrow.find('.atrigger-function_').html(funcName);
      // add new row to table
      $newrow.attr('id','atrigger-tr_'+maxRowId);
      // update all *_ ids with iteration number *_#
      $newrow.find('td')
           .add('select',$newrow)
           .add('input',$newrow)
           .add('span',$newrow)
           .each(make_unique);
      $table.append($newrow);
      maxRowId = parseInt(maxRowId,10) + 1;
    }
    // add empty row
    addRowToTable();
    return true;
  }

  function alter() {
		// create an aggregate sql statement, and execute it.
    var sqlObj = createSQLQueryString(),
        tableName = metaTable.qualResourceName();
		function tbshow() {
			rdbAdmin.loadNewPage('#/table/'+encodeURIComponent(tableName));
		}
		if ( sqlObj.stat === 'incomplete' ) {
			alert('Trigger data is incomplete.\n Please remove unused rows from form.');
		}
		else if ( sqlObj.query.length ) {
			databaseManager.sqlEngine.query( { 'q' : sqlObj.query,
                                         'callback' : tbshow,
                                         'errback' : errback });
		}
		else {
			alert('Add or change a trigger');
		}
	}

  function onChange(elem) {
    updateSQLDisplay();
  }

  function updateSQLDisplay() {
    var queryObj = createSQLQueryString(),
        $panel = $('#'+that.panelId);
    if ( queryObj.query === '' ) {
      $('#alter-trigger-sql-show').html('-- nothing to show');
      $('.edit-sql-btn',$panel).addClass('disabledBtn')
                               .attr('disabled','disabled');
    }
    else {
      $('#alter-trigger-sql-show').html(queryObj.query);
      $('.edit-sql-btn',$panel).removeClass('disabledBtn')
                               .removeAttr('disabled');
    }
    if ( (! queryObj.query) || queryObj.status==='edit-needed') {
      $('#alter-trigger-panel-btn',$panel).addClass('disabledBtn')
                                   .attr('disabled','disabled');
      $('.lookup-create-link',$panel).addClass('disabledLink');
    }
    else {
      $('#alter-trigger-panel-btn',$panel).removeClass('disabledBtn')
                                   .removeAttr('disabled');
      $('.lookup-create-link',$panel).removeClass('disabledLink');
    }
  }

//  CREATE TRIGGER name { BEFORE | AFTER } { event [ OR ... ] }
//    ON table [ FOR [ EACH ] { ROW | STATEMENT } ]
//    EXECUTE PROCEDURE funcname ( arguments )

  function createSQLQueryString() {
    var $panel = $('#'+that.panelId),
        $table = $panel.find('table:first'),
        tbl = $('#trigger-table').val(),
        status = 'ok', statements = [],
        knownTriggers = [];
    function make_drop_statement(oldcName) {
      return 'DROP TRIGGER ' + quoteIdentifier(oldcName) + ' ON ' + quoteIdentifier(tbl);
    }
    function make_create_statement(trigName, timing, events, tbl, foreach, funcName) {
      return 'CREATE TRIGGER ' + quoteIdentifier(trigName) + ' ' + timing + ' ' + events + '\n'
           + ' ON ' + quoteIdentifier(tbl) + ' FOR EACH ' + foreach + '\n'
           + ' EXECUTE PROCEDURE ' + quoteIdentifier(funcName) + '()';
    }
    function make_alter_statement(oldName,newName) {
      return 'ALTER TRIGGER ' + quoteIdentifier(oldName)
           + ' ON ' + quoteIdentifier(tbl)
           + ' RENAME TO ' + quoteIdentifier(newName);
    }
    if (!tbl) {
      tbl = '~table~';
      status = 'edit-needed';
    }
    $table.find('tr:gt(2)').each( function (i) {
      // for each html row (aftet 2 tpl lines), gather data into variables
      var $row = $(this),
          oldTrigName = $('input[class^="atrigger-toldname_"]',$row).val(),
          trigName = $('input[class^="atrigger-tname_"]',$row).val(),
          q;
      if ( oldTrigName ) {
        knownTriggers.push(oldTrigName);
        if ( trigName !== oldTrigName ) {
           q = make_alter_statement(oldTrigName,trigName);
           statements.push(q);
        }
      }
      else {
        var timing = $('*:input[class^="atrigger-timing_"]',$row).val(),
            foreach = $('*:input[class^="atrigger-foreach_"]',$row).val(),
            events = $('*:input[class^="atrigger-event_"]',$row).val(),
            funcName = $('*:input[class^="atrigger-function_"]',$row).val();
        if ( trigName ) {
          if ( !funcName ) {
            funcName = '~function~';
            status = 'edit-needed';
          }
          q = make_create_statement(trigName, timing, events, tbl, foreach, funcName);
          statements.push(q);
        }
      }
    });
    // look for 'unknown' triggers not kept in form, that need to be dropped
    for (var con in triggers) {
      var tname = triggers[con][0];
      if ( $.inArray(tname,knownTriggers) === -1 ){
          statements.push(make_drop_statement(tname));
      }
    }
    // assemble string
    var sql = statements.join(';\n');
    return { 'status' : status,
             'query' : sql    };
  }
}
