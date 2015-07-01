/*
   methods for editing constraints

*/



function AlterConstraintsPanel(rdbAdmin,databaseManager,sqlPanel,receditPanel)
{
  this.panelId = 'alter-constraint-panel';
	var tableId = 'alter-constraint-table',
      tableIdentifier = '',
	    maxRowId = 0,
      metaTable = undefined,
      constraints = undefined,
      that = this;

  // function to handle error result of query submit
  function errback(err) {
    rdbAdmin.showErrorMessage('<pre>' + err[0].toString() + ': ' + err[1] + '</pre>');
  }

	this.init_handlers = function(app) {
		// initialize click handlers
		//
    var $panel = $('#'+that.panelId);
		$('#alter-constraint-panel-btn').click(function (ev) {
      alter();
      ev.stopPropagation();
    });

		$('#alter_constraint_add_row').click(function (ev) {
      addRowToTable(this);
      onChange(this);
      ev.stopPropagation();
    });

    $panel.on('click', '*.alter_constraint_del_row', function(ev) {
      delRowFromTable(this);
      onChange(this);
      ev.stopPropagation();
    });

		// add click handler to edit query
		$('.edit-sql-btn',$panel).click( function(ev) {
      ev.stopPropagation();
      var query = $('#alter-constraint-sql-show').html();
      sqlPanel.showQueryLater({'query':query});
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
			onChange(this);
            ev.stopPropagation();
		});
	};

  function getTableConstraints(callback)  {
    var metaT = new ResourceMeta(tableIdentifier);
    function successfirst(tbldtls) {
      function successcb(condtls) {
        constraints = condtls;
        callback();
      }
      metaTable = tbldtls;
      databaseManager.getConstraints(metaTable.getSchemaNameOnly(), metaTable.getTableNameOnly(), successcb);
    }
    databaseManager.getTableDetails(metaT.getSchemaNameOnly(), metaT.getTableNameOnly(), successfirst);
  }

	this.show = function(mode,tableName)
	{
    var $panel = $('#'+that.panelId);
    $panel.hide();
    tableIdentifier = tableName;
    maxRowId = 0;
    rdbAdmin.setHeading('');
    rdbAdmin.onStartQueryExecution();
    getTableConstraints(function () {
      buildTable();
      rdbAdmin.setHeading("Alter Constraints: " +  metaTable.qualResourceName());
      updateSQLDisplay();
      rdbAdmin.onStopQueryExecution();
      $panel.show();
    });
    //$('*:input:first',$table).change();
	};

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

	function addRowToTable(elem) {

		// function to add row# to end of id values
		function make_id_unique($el,i) {
			var id = $el.attr('id');
			if (id && id.length && id.substr(id.length-1)==='_') {
				$el.attr('id',id+i);
			}
		}

		var newrowId = parseInt(maxRowId,10) + 1;
		var $table = $('#'+tableId);

		// clone hidden row
		var $row = $table.find('#aconstraint-tr-pattern').clone().show();
		// new IDs to cloned row and it's children
		$row.find('.aconstraint-copts').removeAttr('style');
    updateVisibility($row,'CHECK');
		$row.attr('id','aconstraint-tr_'+maxRowId);

		// update all *_ ids with iteration number *_#
		$row.find('td')
			   .add('select',$row)
			   .add('input',$row)
			   .each(function (i) {
			make_id_unique($(this),i);
		});
		// attach new row
		$table.append($row);
		maxRowId = newrowId;
		return newrowId;
	}

	function onChange(domel) {

    if (domel) {

        var $table = $('#'+tableId),
            $row = $(domel).closest('tr');

        // show/hide display of foreign key field
        var $typeSelect = $row.find('td:eq(1) select');
        var itypestr = $typeSelect.val();
        updateVisibility($row,itypestr);

        // control number of blank field selects
        var $fldsCell = $row.find('td:eq(2)');

        // get sample select from #aconstraint-tr-pattern > .aconstraint-copts > select
        var $patternRow = $table.find('#aconstraint-tr-pattern'),
            $colList = $patternRow.find('.aconstraint-copts .aconstraint-clist').clone();

        // clear 'blank' value selects from row aconstraint.copts
        $fldsCell.find("select option:selected").each(function () {
          var str = $(this).text();
          if ( str === '' )
            $(this).closest('select').remove();
        });

        // append one blank select
        $fldsCell.find('span').append($colList);

/*
        var $fldspan = $row.find('span.aconstraint-copts:last').clone();
        $row.find('select[value=""]').closest('span').remove();
        var idparts = $fldspan.attr('id').split(/[\-_]/g);
        var colnum = parseInt(idparts[2],10),
            rownum = idparts[3];
        $fldspan.addClass('aconstraint-copts');
        $fldsCell.append($fldspan.children());
*/
    }

    // update the SQL display
    updateSQLDisplay();
		return false;
	}

	function updateSQLDisplay() {

		var sql,
        $panel = $('#'+that.panelId),
		    sqlObj = createSQLQueryString();

    if ( sqlObj.status == 'incomplete' ) {
      $('#alter-constraint-panel-btn').attr('disabled','disabled')
                                      .addClass('disabledBtn');
      $('.lookup-create-link',$panel).addClass('disabledLink');
    }
    else {
      $('#alter-constraint-panel-btn').removeAttr('disabled')
                                      .removeClass('disabledBtn');
      $('.lookup-create-link',$panel).removeClass('disabledLink');
    }

		if ( sqlObj.query  ) {
      $('#alter-constraint-sql-show',$panel).html(sqlObj.query);
      $('.edit-sql-btn',$panel).removeAttr('disabled')
                               .removeClass('disabledBtn');
    }
    else {
      $('#alter-constraint-sql-show',$panel).html('-- nothing to show yet');
      $('.edit-sql-btn',$panel).attr('disabled','disabled')
                               .addClass('disabledBtn');
		}
	}

  function updateVisibility($row,itypestr) {

    if (itypestr === 'FOREIGN KEY') {
        $row.find('*[class^="aconstraint-cother-label_"]').html('References:');
        $row.find('*[class^="aconstraint-cother_"]').show();
        $row.find('.aconstraint-copts').show();
    }
    else if (itypestr === 'CHECK') {
        $row.find('*[class^="aconstraint-cother-label_"]').html('Check:');
        $row.find('*[class^="aconstraint-cother_"]').show();
        $row.find('.aconstraint-copts').hide();
    }
    else {
        $row.find('*[class^="aconstraint-cother-label_"]').html('');
        $row.find('*[class^="aconstraint-cother_"]').hide();
        $row.find('.aconstraint-copts').show();
    }
  }

	function buildTable() {

		var $table = $('#'+tableId);

		// function to add row# to end of id values
		function make_id_unique($el,i) {
			var id = $el.attr('id');
			if (id && id.length && id.substr(id.length-1)==='_') {
				$el.attr('id',id+i);
			}
		}

		// save hidden rows, clear table, reinsert saved rows
		var $tplrow = $table.find('#aconstraint-tr-prior_');
		var $row = $table.find('#aconstraint-tr-pattern');
		$table.empty(); //.append($hdr);
		$table.append($row).append($tplrow);

		// add field names to template row
		var fields = metaTable.getColumns();
		$row.find('.aconstraint-clist').empty().append($('<option>'));
		for (var i=0; i<fields.length; i+=1) {
			var $opt = $('<option>');
			$opt.html(fields[i].columnName);
			$row.find('.aconstraint-clist').append($opt);
		}

		// check that constraints has data
		if (constraints === null || constraints === undefined) {
			return false;
		}
		// put each constraint in display table
        var k;
		function make_unique() {
			make_id_unique($(this),k);
		}

    for (k=0; k<constraints.length; k+=1) {

			var constraint = constraints[k];
      var name = constraint[0], typ = constraint[1],
          fortbl = constraint[3], columns = constraint[7],
          forcolumns = constraint[8], consrc = constraint[12],
          fortable = constraint[13], forschema = constraint[14];

			// add html row to table
			var $newrow = $tplrow.clone(true).show();

			// add constraint name
			$newrow.find('.aconstraint-cname_').html(name);
			$newrow.find('.aconstraint-coldname_').val(name);

			// add constraint type
			var itypestr = { 'c' : 'CHECK',
                       'f' : 'FOREIGN KEY',
                       'p' : 'PRIMARY KEY',
                       'u' : 'UNIQUE' }[typ];
			$newrow.find('.aconstraint-ctype_').closest('td').html(itypestr);

			// add span with field select control for each field in constraint
      var cols = [];
      for (var c in columns) {
          var colIdx = parseInt(columns[c],10)-1;
          cols.push(metaTable.getColumns()[colIdx].columnName);
      }
      var colstr = cols.join(', ');

			// clone span
      var $span = $newrow.find('.aconstraint-copts').remove().show();

      // insert field name select
      $span.html(colstr).removeAttr('style');
      $newrow.find('td:eq(2)').append($span);

      // add foreign reference info
      var forcolstr;
      if (consrc.split('REFERENCES').length == 2) {
          forcolstr = consrc.split('REFERENCES')[1];
      }
      else {
          forcolstr = consrc;
      }

      if (forcolstr) {
          $newrow.find('.aconstraint-cother_').html(forcolstr);
      }
      updateVisibility($newrow,itypestr);

      // add new row to table
			$newrow.attr('id','aconstraint-tr_'+maxRowId);

			// update all *_ ids with iteration number *_#
			$newrow.find('td')
				   .add('select',$newrow)
				   .add('input',$newrow)
				   .each(make_unique);
			$table.append($newrow);
			maxRowId = parseInt(maxRowId,10) + 1;
		}

		// add empty row
		addRowToTable();
		return true;
	}

  function createSQLQueryString() {

		var tableName = metaTable.qualResourceName();

		// functions to create SQL statements
		function alter_table() {
			return 'ALTER TABLE ' + metaTable.quotedResourceName() + '\n';
		}
		function make_drop_statement(oldcName) {
			return '  DROP CONSTRAINT ' + quoteIdentifier(oldcName);
		}
		function make_create_statement(cName,cType,cFields,cOther)	{
			var sql;
			if (cType === 'UNIQUE') {
				sql = '  ADD ' +
                      (cName ? 'CONSTRAINT '+quoteIdentifier(cName) : '') +
				      ' UNIQUE ('+(cFields.join(','))+')';
			}
			else if (cType === 'PRIMARY KEY') {
				sql = '  ADD ' +
                      (cName ? 'CONSTRAINT '+quoteIdentifier(cName) : '') +
				      ' PRIMARY KEY ('+(cFields.join(','))+')';
			}
			else if (cType === 'FOREIGN KEY') {
				sql = '  ADD ' +
                      (cName ? 'CONSTRAINT '+quoteIdentifier(cName) : '') +
				      ' FOREIGN KEY ('+(cFields.join(','))+')' +
                      ' REFERENCES ' + cOther;
			}
			else if (cType === 'CHECK') {
				sql = '  ADD ' +
                      (cName ? 'CONSTRAINT '+quoteIdentifier(cName) : '') +
				      ' CHECK (' + cOther + ')';
			}
			return sql;
		}
		// grab inputs
		var $table = $('#'+tableId);

		// iterate over html-table-rows, generate a list of sql
		var sql = [], knownconstraints = [], status = 'ok';
		$table.find('tr:gt(1)').each( function (i) {

			// for each html row (aftet 2 tpl lines), gather data into variables
			var $row = $(this);
			var cName = $row.find('*[class^="aconstraint-cname_"]').val();
			var oldcName = $row.find('*[class^="aconstraint-coldname_"]').val();
      if ( oldcName ) {
          knownconstraints.push(oldcName);
      }
      else {

        var cType = $row.find('select[class^="aconstraint-ctype_"]').val();
        var cOther = $row.find('input[class^="aconstraint-cother_"]').val();
        var cFields = [];
        $row.find('.aconstraint-clist').each( function () {
            if ($(this).val() !== '') {
                cFields.push( $(this).val() );
            }
        });

        // quit if incomplete line
        if ( !cType
            || ((cType in {'CHECK':1, 'FOREIGN KEY':1}) && !cOther)
            || ((cType === 'FOREIGN KEY') && !cFields.length)) {
            status = 'incomplete';
            return false;
        }
        else {
          sql.push(make_create_statement(cName,cType,cFields,cOther));
        }
			}
			return true;
		});

    // look for 'unknown' constraints not kept in form, that need to be dropped
    for (var con in constraints) {
      var conname = constraints[con][0];
      if ( $.inArray(conname,knownconstraints) === -1 ){
          sql.push(make_drop_statement(conname));
      }
    }

    // return object with status and sql
    var sqlRet = sql.length ? alter_table() + sql.join(',\n') : '';
    return { 'query' : sqlRet,
             'status' : status };
  }

	function alter() {
		// create an aggregate sql statement, and execute it.
    var sqlObj = createSQLQueryString(),
        tableName = metaTable.qualResourceName();
		function tbshow() {
			rdbAdmin.loadNewPage('#/table/'+encodeURIComponent(tableName));
		}
		if ( sqlObj.stat === 'incomplete' ) {
			alert('Constraint data is incomplete.\n Please remove unused rows from form.');
		}
		else if ( sqlObj.query.length ) {
			databaseManager.sqlEngine.query( { 'q' : sqlObj.query,
                                         'callback' : tbshow,
                                         'errback' : errback });
		}
		else {
			alert('Add or change a constraint');
		}
	}
}
