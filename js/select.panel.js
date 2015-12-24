

/* object to handle creation and renaming of views */
function SelectPanel(rdbAdmin, databaseManager, sqlPanel, dataDisplayer) {

    this.panelId = "select-panel";
    var tableId = 'select-panel-result-table',
    // tableIdentifier is the ascii/unicode table name, optionally with schema
        tableIdentifier = undefined,
    // metaTable contains the table metadata (column list, schema, name, etc)
        metaTable = undefined,
    // data will be the json blob received from the server
        data = undefined,
    // keyFieldIndexes will be a list of 2-tuples [[fld-idx,TableColumn],..]
        keyFieldIndexes = undefined,
    // paging items
        totalRowsCount = null,
        totalPages = null,
        limit = 30,
        page = 1,
    // is this a view rather than a table
        isView = undefined,
        that = this;

    function reset(tableName, isAView) {
        tableIdentifier = tableName;
        metaTable = new ResourceMeta(tableIdentifier);
        page = 1;
        data = undefined;
        isView = isAView;
        keyFieldIndexes = undefined;
        totalRowsCount = totalPages = null;
        limit = 30;
    }

    // function to handle error result of query submit
    function errback(err) {
        rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
    }

    this.init_handlers = function (app) {
        // bind handlers to create button, and to form submit buttons
        var $form = $('#' + this.panelId);
        // add click handlers
        $('#select-panel-new-item').click(function (ev) {
            app.setLocation('#/browser/insert/' + encodeURIComponent(tableIdentifier));
            ev.stopPropagation();
        });
        $('#sel-table-select-btn').click(function (ev) { // [update] button
            that.select();
            ev.stopPropagation();
        });
        $('#sel-panel-delete-selected').click(function (ev) {
            deleteSelected();
            ev.stopPropagation();
        });
        $form.on('click', 'span.sel-table-tr-edit', function (ev) {
            var keyVals = createPrimKeyValueList(this);
            var kV = JSON.stringify(keyVals);
            app.setLocation('#/browser/editrec/' + encodeURIComponent(tableIdentifier) + '/' + encodeURIComponent(kV));
            ev.stopPropagation();
        });
//    $form.on('click', '.colhdr', function (ev) {
//      sortByColumn(this);
//      ev.stopPropagation();
//    });
        // select/deselect all
        $form.on('click', '#sel-table-selitem', function (ev) {
            if ($(this).prop('checked')) {
                $('input.sel-table-selitem', $form).prop('checked', true);
            }
            else {
                $('input.sel-table-selitem', $form).prop('checked', false);
            }
            ev.stopPropagation();
        });
        // pagination link handlers
        $form.on('click', 'span[id^="sel-pager-"]', function (ev) {
            var dir = $(this).attr('id').substr(10, 5);
            page = (dir === 'up') ? page + 1 : page - 1;
            buildTable();
            ev.stopPropagation();
        });
/*
        $form.on('change', '#select-panel-select-div .sel-panel-functions, #select-panel-select-div .sel-table-fields',
            function (ev) {
                add_row(this);
                ev.stopPropagation();
            });
        $form.on('change', '#select-panel-fwhere-div .sel-table-fwhere, #select-panel-fwhere-div input',
            function (ev) {
                add_row(this);
                ev.stopPropagation();
            });
        $form.on('change', '#select-panel-fsort-div .sel-table-fsort, #select-panel-fsort-div :checkbox',
            function (ev) {
                add_row(this);
                ev.stopPropagation();
            });
*/
        // toggle control fieldset boxes hidden/nothidden
        $('fieldset legend', $form).click(function (ev) {
            $(this).closest('fieldset').children('*:not(legend)').toggle();
            ev.stopPropagation();
        });

        // toggle control fieldset boxes hidden/nothidden
        $(':input', $form).change(function (ev) {
            updateSQL();
        });

        // redo results display when full-values checkbox gets toggles
        $('#select-full-values', $form).change(function (ev) {
            buildTable();
            ev.stopPropagation();
        });
    };

    function updateSQL() {

        var queryRes = buildQuery(false); // not count
        var $panel = $('#' + that.panelId);
        $('#sel-panel_jush-sql', $panel).html(queryRes.query);
    }

    function createPrimKeyValueList(domel) {

        var rI = $(domel).parents('tr:first').get(0).rowIndex,
            row = data.rows[parseInt(rI, 10) - 1],
            keyVals = [];

        for (var k in keyFieldIndexes) {
            keyVals.push(keyFieldIndexes[k][1].columnName);
            keyVals.push(row[keyFieldIndexes[k][0]]);
        }

        return keyVals;
    }

    function reveal() {
        var $panel = $('#' + that.panelId);
        rdbAdmin.onStopQueryExecution();
        //$panel.slideDown('fast','linear');
        $panel.show();
    }

    function errReveal(err, msg) {
        errback(err);
        reveal();
    }

    this.show = function (tableName, isAView) {
        var $panel = $('#' + this.panelId);
        $('.tablehide', $panel).show();
        $panel.hide();
        rdbAdmin.onStartQueryExecution();
        rdbAdmin.setHeading("Select: " + tableName);
        if (tableIdentifier !== tableName)
            reset(tableName, isAView);

        // get fields type and other meta-info
        function callback(dtls) {
            metaTable = dtls; //.fields;
            getPKConstraint();
        }

        databaseManager.getTableDetails(metaTable.getSchemaNameOnly(), metaTable.getTableNameOnly(), callback, errReveal);
    };

    var okTypes = ['int', 'bigint', 'smallint', 'integer', 'serial', 'bigserial',
        'real', 'float', 'double', 'decimal', 'double', 'decimal',
        'number', 'numeric', 'text', 'character', 'char', 'varchar',
        'character varying', 'timestamp', 'timestamp with time zone',
        'timestamp without time zone', 'date', 'time',
        'time with time zone', 'time without time zone', 'bytea'];

    function getPKConstraint() {
        // get constraints data, especially primary key info
        function callbackCon(constraints) {
            keyFieldIndexes = [];
            for (var k = 0; k < constraints.length; k += 1) {
                var constraint = constraints[k],
                    typ = constraint[1],
                    columns = constraint[7];
                if (typ === 'p') {
                    for (var c in columns) {
                        var colIdx = parseInt(columns[c], 10) - 1;
                        var column = metaTable.getColumns()[colIdx];
                        if ($.inArray(column.dataType, okTypes) > -1) {
                            keyFieldIndexes.push([colIdx, column]);
                        }
                        else {
                            keyFieldIndexes = [];
                            break;
                        }
                    }
                    break;
                }
            }
            that.select();
        }

        databaseManager.getConstraints(metaTable.getSchemaNameOnly(), metaTable.getTableNameOnly(), callbackCon, errReveal);
    }

    this.select = function () {
        rdbAdmin.resetMessages();
        return buildTable();
    };

    function clearSelectControls() {
        // init some interface controls
        var $form = $('#' + that.panelId);
        $('div#select-panel-select-div span:gt(0)', $form).remove();
        $('.sel-panel-functions', $form).find('option:first').attr("selected", "selected");
        $('.sel-table-fields', $form).empty().append('<option></option>');

        // where line
        $('div#select-panel-fwhere-div span:gt(0)', $form).remove();
        $('.sel-table-fwhere', $form).empty().append('<option></option>');
        $('.sel-statement', $form).find('option:first').attr("selected", "selected");
        $('div#select-panel-fwhere-div input', $form).val('');

        // sort line
        $('div#select-panel-fsort-div span:gt(0)', $form).remove();
        $('.sel-table-fsort', $form).empty().append('<option></option>');
        $('div#select-panel-fsort-div :checkbox', $form).prop('checked', false);

        // limit line
        $('#sel-panel-limit').val('30');
    }

    function fillSelectControls(insertAllowed, deleteAllowed) {
        var i,
            $form = $('#' + that.panelId);
        if (data && data.header) {
            if ($('.sel-table-fields', $form).children().length <= 1) {
                for (i in data.header) {
                    $('.sel-table-fields', $form).append('<option>' + data.header[i][1] + '</option>');
                }
            }
            if ($('.sel-table-fsort', $form).children().length <= 1) {
                for (i in data.header) {
                    $('.sel-table-fsort', $form).append('<option>' + data.header[i][1] + '</option>');
                }
            }
            if ($('.sel-table-fwhere').children().length <= 1) {
                for (i in data.header) {
                    $('.sel-table-fwhere', $form).append('<option>' + data.header[i][1] + '</option>');
                }
            }
            var $selPanelDelBtn = $('#sel-panel-del-btn');
            if (deleteAllowed) {
                $selPanelDelBtn.show();
            } else {
                $selPanelDelBtn.hide();
            }
            var $selPanelNewBtn = $('#sel-panel-new-item');
            if (insertAllowed) {
                $selPanelNewBtn.show();
            } else {
                $selPanelDelBtn.hide();
            }
        }
        // hide select and search control boxes unless in use
        if ($('.sel-panel-functions:first').val() === '') {
            $('div#select-panel-select-div').hide();
        }
        if ($('.sel-table-fwhere:first').val() === '') {
            $('div#select-panel-fwhere-div').hide();
        }
    }

    function add_row(field) {

        // check if this row is the last - if isn't - return false
        //
        var $span = $(field).closest('span');
        if ($span.nextAll('span:first').length !== 0)
            return false;

        var $newspan = $span.clone();

        // clean selects in cloned row
        //
        var selects = $newspan.find('select');
        for (var i = 0; i < selects.length; i += 1) {

            selects[i].name = selects[i].name.replace(/[a-z]\[[0-9]+/, '$&1');
            selects[i].selectedIndex = 0;
        }

        var inputs = $newspan.find('input');
        if (inputs.length) {

            inputs[0].name = inputs[0].name.replace(/[a-z]\[[0-9]+/, '$&1');
            inputs[0].value = '';
        }

        $span.parent().append('<br/>').append($newspan);
        return true;
    }

    /*
     function sortByColumn(colm) {

     var col = $(colm).html();

     // set up sorting inputs
     if ($('div#sel-panel-fsort-div select[value="' + col + '"]').length === 0) {

     // add row with this col name
     add_row($('div#sel-panel-fsort-div:last').find('select: first').get(0));

     // set col name
     $('div#sel-panel-fsort-div:last').find('select:first').val(col);
     }

     var select = $('div#sel-panel-fsort-div select[value="' + col + '"]:first');
     var checkbox = $(select.parent().find('input:checkbox').get(0));

     if (checkbox.prop('checked')) {

     checkbox.prop('checked', false);
     }
     else {

     checkbox.prop('checked', true);
     }

     that.select();
     }
     */

    function buildTable() {

        var $panel = $('#' + that.panelId);
        if (data === undefined) {
            clearSelectControls();
        }

        // build query
        var queryObj = buildQuery(false);
        $('#sel-panel_jush-sql').html('<code>' + queryObj.query + '</code>');

        // add click handler to edit query
        $('#sel-panel-sql-edit').click(function (ev) {
            ev.stopPropagation();
            sqlPanel.showQueryLater(queryObj);
            rdbAdmin.loadNewPage('#/sqlcommand');
        });

        var insertAllowed = !isView && queryObj.isFullRecord,
            listIsEditable = insertAllowed && keyFieldIndexes.length > 0,
            deleteAllowed = listIsEditable;

        // querying
        function successcb(json) {

            rdbAdmin.showWorkingMessage(json.row_count[1]);
            data = json.records;

            limit = $('#sel-panel-limit').val();
            if (json.status[0] === 'complete' && (!json.records.rows || json.records.rows.length < limit)) {

                totalRowsCount = (page - 1) * limit + json.records.rows ? json.records.rows.length : 0;
                totalPages = page;
                buildPager()
            }

            // show notes for no-edit cases
            $('.no-primary-key-note', $panel)[(listIsEditable || isView) ? 'hide' : 'show']();
            $('.only-view-note', $panel)[isView ? 'show' : 'hide']();

            var fullRecs = $('#select-full-values').is(':checked');
            fillSelectControls(insertAllowed, deleteAllowed);

            dataDisplayer.show(tableId, json.records.header, json.records.rows || [], listIsEditable, fullRecs);

            if (dataDisplayer.dataWasTruncated || fullRecs)
                $('#select-full-value-checkbox').show();
            else
                $('#select-full-value-checkbox').hide();

            reveal();
        }

        rdbAdmin.onStartQueryExecution();

        // send query to server
        databaseManager.sqlEngine.query({
            'q': queryObj.query,
            'args': queryObj.args,
            'callback': successcb,
            'errback': errReveal
        });

        // build pager
        buildPager();
    }

    function deleteSelected() {

        var query = [], q = [], arglist = [], dTypes = [], primKeyList, col,
            fldVal, fldName, fldIdx, fldType;

        // find selected rows
        $('input.sel-table-selitem:checked').each(function () {

            var colDetails = keyFieldIndexes.slice(0);

            // get selected items from data.rows
            primKeyList = createPrimKeyValueList(this);
            q = [];

            while (colDetails.length) {

                col = colDetails.shift();
                fldIdx = col[0];
                fldType = col[1].dataType;
                fldName = primKeyList.shift();
                fldVal = primKeyList.shift();

                if (fldVal === null) {

                    q.push(quoteIdentifier(fldName) + " IS NULL");
                }
                else {

                    q.push(quoteIdentifier(fldName) + ' = %s ');
                    arglist.push(fldVal);
                    dTypes.push(fldType);
                }
            }

            query.push("DELETE FROM " + metaTable.quotedResourceName() +
                " WHERE " + q.join(' AND ') + ";");
        });

        query = query.join("\n");

        // send query to server
        databaseManager.sqlEngine.query({
            'q': query,
            'args': arglist,
            'argtypes': dTypes,
            'callback': buildTable,
            'errback': errback
        });
    }

    function buildPager() {

        // show page number of current page
        $('#page').text(page);

        // if page number is > 1, show sel-page-down link
        if (page > 1)
            $('#sel-pager-down').show();
        else
            $('#sel-pager-down').hide();

        //  if current page is known to be last page..
        //    show record count
        if (totalPages && page === totalPages) {

            $('#sel-pager-up').hide();
        }

        // else if current page is not last page...
        //    show next_page link
        else {

            $('#sel-pager-up').show();
        }
        $('#totalRowsCount').text(totalRowsCount || '');

    }

    function buildQuery(isCount) {

        var query = '',
            limitClause = '',
            limitArgs = [];

        limit = $('#sel-panel-limit').val();

        // if we have limit
        if (limit !== '') {
            var offsetLim = [(page - 1) * limit, limit];
            limitClause = ' OFFSET ' + offsetLim[0] + ' LIMIT ' + offsetLim[1];
        }
        else {
            limitClause = '';
        }

        // build what-to-select statement
        var what = [], i, whatArgs = [], isFullRecord = true,
            field, func, $selSpan,
            $selSpans = $('div#select-panel-select-div span');

        for (i = 0; i < $selSpans.length; i += 1) {

            $selSpan = $($selSpans[i]);
            func = $selSpan.find('select.sel-panel-functions:first').val();
            field = $selSpan.find('select.sel-table-fields:first').val();

            if (field !== '') {
                isFullRecord = false;
            }
            if ((func !== '') && (field !== '')) {

                if (func === 'unix_timestamp') {
                    what.push('extract(epoch FROM ' + field + ')');
                }
                else {
                    what.push(func + '(' + field + ')');
                }
            }
            else if (field !== '') {

                what.push(field);
            }
        }
        if (what.length === 0) {
            what = '*';
        }
        else {
            what = what.join(', ');
        }

        // 'searching' - where statement
        var where = [], whereArgs = [], val, statement;
        $selSpans = $('div#select-panel-fwhere-div span');

        for (i = 0; i < $selSpans.length; i += 1) {

            $selSpan = $($selSpans[i]);
            field = $selSpan.find('select.sel-table-fwhere:first').val();
            statement = $selSpan.find('select.sel-statement').val();
            val = $selSpan.find('input[name="where"]').val();

            if (field !== '') {

                // should we quote a value?
                var ftype = getFieldTypeByName(field);
                switch (ftype) {
                    case 'int':
                    case 'bigint':
                    case 'integer':
                    case 'number':
                    case 'serial':
                    case 'bigserial':
                    case 'float':
                    case 'double':
                    case 'decimal':
                    case 'numeric':
                    case 'smallint':
                    case 'real':
                    case 'boolean':
                        where.push(quoteIdentifier(field) + ' ' + statement + ' %s');
                        val = val.replace(/%/g, '%%');
                        whereArgs.push(val);
                        break;
                    default:
                        where.push(quoteIdentifier(field) + ' ' + statement + ' %s');
                        val = val.replace(/%/g, '%%');
                        whereArgs.push(val);
                        break;
                }
            }
        }
        if (where.length === 0) {
            where = '';
        }
        else {
            where = " WHERE " + where.join(' AND ') + " ";
        }

        // ordering and sorting
        var orderBy = [],
            sels = $('div#select-panel-fsort-div');

        for (i = 0; i < sels.length; i += 1) {

            field = $($(sels[i]).find('select')[0]).val();
            val = $($(sels[i]).find('input')).prop('checked') ? 'DESC' : 'ASC';
            if (field !== '') {
                orderBy.push(quoteIdentifier(field) + ' ' + val);
            }
        }

        if (orderBy.length === 0) {
            orderBy = '';
        }
        else {
            orderBy = " ORDER BY " + orderBy.join(', ') + " ";
        }

        var args;
        if (isCount) {

            query = "SELECT COUNT(*) FROM " + metaTable.quotedResourceName() + where;
            args = whereArgs;
        } else {

            query = "SELECT " + what + " FROM " + metaTable.quotedResourceName() +
                where + orderBy + limitClause;
            args = whatArgs.concat(whereArgs, limitArgs);
        }

        return {
            'status': 'ok',
            'query': query,
            'args': args,
            'isFullRecord': isFullRecord
        };
    }

    function getFieldTypeByName(name) {

        var fieldDetails = metaTable.getColumns();

        for (var i in fieldDetails) {
            if (fieldDetails[i].columnName === name) {
                return fieldDetails[i].dataType;
            }
        }

        return false;
    }

    function truncate() {

        // **** reform truncate
        if (!confirm('Are you sure?')) {
            return;
        }

        function callback(json) {
            rdbAdmin.showWorkingMessage(json.status[1]);
            that.show(tableIdentifier);
        }

        databaseManager.truncate(tableIdentifier, callback, errback);
    }
}
